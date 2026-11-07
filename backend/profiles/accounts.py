"""Local account services. Nothing here contacts 42."""
import hashlib
import re
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from django.utils.crypto import salted_hmac
from django.views.decorators.debug import sensitive_variables

from .models import AccountAudit, AccountSettings, AuthThrottle, PasswordResetToken, SetupToken, StudentProfile, User


def eligible(user):
    if not user or not user.is_active:
        return False
    if user.role == 'staff':
        return bool(user.is_staff and user.approved_at)
    return user.role == 'student' and StudentProfile.objects.filter(
        user=user, intra_active=True, eligibility_status='eligible').exists()


def throttle(scope, identity, *, limit, seconds):
    # Hash identities/IPs; never store passwords or raw tokens in throttle rows.
    key = salted_hmac('account-rate-limit', scope + ':' + identity, algorithm='sha256').hexdigest()
    now = timezone.now()
    with transaction.atomic():
        row, _ = AuthThrottle.objects.get_or_create(key=key, defaults={'expires_at': now + timedelta(seconds=seconds)})
        row = AuthThrottle.objects.select_for_update().get(pk=row.pk)
        if row.expires_at <= now:
            row.count, row.expires_at = 0, now + timedelta(seconds=seconds)
        if row.count >= limit:
            return False
        row.count += 1
        row.save(update_fields=['count', 'expires_at'])
    return True


def account_settings(*, lock=False):
    AccountSettings.objects.get_or_create(pk=1)
    rows = AccountSettings.objects.select_for_update() if lock else AccountSettings.objects
    return rows.get(pk=1)


@sensitive_variables()
def request_setup(username):
    with transaction.atomic():
        user = User.objects.select_for_update().filter(username__iexact=username).first()
        if not eligible(user) or user.has_usable_password():
            return
        now = timezone.now()
        token = secrets.token_urlsafe(32)
        SetupToken.objects.filter(user=user, used_at__isnull=True).update(used_at=now)
        SetupToken.objects.create(user=user, token_hash=hashlib.sha256(token.encode()).hexdigest(),
                                  expires_at=now + timedelta(seconds=settings.SETUP_TOKEN_SECONDS))
        domain = '42amman.com' if user.role == 'staff' else 'student.42amman.com'
        destination = f'{user.username}@{domain}'
        # Fragment keeps the token out of ordinary HTTP request URLs/access logs.
        link = settings.ACCOUNT_ORIGIN + '/setup/complete#token=' + token
        send_mail('Set up your Fairly account',
                  f'Create your Fairly password:\n\n{link}\n\nThis link expires in 30 minutes and can be used once.\n'
                  'If you did not request it, you can ignore this email.',
                  settings.DEFAULT_FROM_EMAIL, [destination], fail_silently=False)
        AccountAudit.objects.create(subject=user, action='Setup link requested')


class InvalidSetup(Exception):
    pass


@sensitive_variables()
def complete_setup(token, password):
    if not isinstance(token, str) or not re.fullmatch(r'[A-Za-z0-9_-]{43}', token):
        raise InvalidSetup
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    with transaction.atomic():
        # Lock order is settings, user, then token for setup and approval settings.
        configuration = account_settings(lock=True)
        token_row = SetupToken.objects.filter(token_hash=token_hash).first()
        if not token_row:
            raise InvalidSetup
        user = User.objects.select_for_update().get(pk=token_row.user_id)
        row = SetupToken.objects.select_for_update().get(pk=token_row.pk)
        now = timezone.now()
        if row.used_at or row.expires_at <= now or user.has_usable_password() or not eligible(user):
            raise InvalidSetup
        validate_password(password, user=user)
        user.set_password(password)
        user.email = f'{user.username}@' + ('42amman.com' if user.role == 'staff' else 'student.42amman.com')
        user.email_verified_at = now
        if user.role == 'student' and not configuration.manual_student_approval_enabled and not user.approved_at:
            user.approved_at = now
        user.save(update_fields=['password', 'email', 'email_verified_at', 'approved_at'])
        SetupToken.objects.filter(user=user, used_at__isnull=True).update(used_at=now)
        AccountAudit.objects.create(subject=user, action='Account setup completed',
                                   detail={'approved': bool(user.approved_at)})
        return 'ready' if user.approved_at else 'awaiting_approval'


@sensitive_variables()
def request_reset(username):
    with transaction.atomic():
        user = User.objects.select_for_update().filter(username__iexact=username).first()
        if not eligible(user) or not user.email_verified_at or not user.has_usable_password():
            return
        now = timezone.now()
        token = secrets.token_urlsafe(32)
        PasswordResetToken.objects.filter(user=user, used_at__isnull=True).update(used_at=now)
        PasswordResetToken.objects.create(user=user, token_hash=hashlib.sha256(token.encode()).hexdigest(),
            credential_hash=hashlib.sha256(user.password.encode()).hexdigest(),
            expires_at=now+timedelta(seconds=settings.SETUP_TOKEN_SECONDS))
        destination = f'{user.username}@' + ('42amman.com' if user.role == 'staff' else 'student.42amman.com')
        link = settings.ACCOUNT_ORIGIN + '/reset/complete#token=' + token
        send_mail('Reset your Fairly password',
            f'Choose a new password:\n\n{link}\n\nThis link expires in 30 minutes and can be used once.\n'
            'If you did not request it, you can ignore this email.', settings.DEFAULT_FROM_EMAIL, [destination], fail_silently=False)
        AccountAudit.objects.create(subject=user, action='Password reset requested')


@sensitive_variables()
def complete_reset(token, password):
    if not isinstance(token, str) or not re.fullmatch(r'[A-Za-z0-9_-]{43}', token):
        raise InvalidSetup
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    with transaction.atomic():
        row = PasswordResetToken.objects.filter(token_hash=token_hash).first()
        if not row:
            raise InvalidSetup
        user = User.objects.select_for_update().get(pk=row.user_id)
        row = PasswordResetToken.objects.select_for_update().get(pk=row.pk)
        now = timezone.now()
        if (row.used_at or row.expires_at <= now or not eligible(user) or not user.email_verified_at or
                not user.has_usable_password() or row.credential_hash != hashlib.sha256(user.password.encode()).hexdigest()):
            raise InvalidSetup
        validate_password(password, user=user)
        user.set_password(password)
        user.save(update_fields=['password'])
        # Django session auth hashes stop every old session on its next request.
        # Neither verification nor approval is changed by password recovery.
        PasswordResetToken.objects.filter(user=user, used_at__isnull=True).update(used_at=now)
        SetupToken.objects.filter(user=user, used_at__isnull=True).update(used_at=now)
        AccountAudit.objects.create(subject=user, action='Password reset completed')
        return user.username
