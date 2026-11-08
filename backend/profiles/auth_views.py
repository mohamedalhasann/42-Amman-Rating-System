import json
import logging
from smtplib import SMTPException

from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.core.exceptions import ValidationError
from django.db import transaction
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.shortcuts import render
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.debug import sensitive_post_parameters, sensitive_variables
from django.views.decorators.http import require_GET, require_POST, require_http_methods

from .accounts import (InvalidSetup, account_settings, complete_setup, complete_reset, eligible,
                       request_reset, request_setup, throttle)
from .models import AccountAudit, StudentProfile, User
from . import demo
from .views import error, protected, profile_json

logger = logging.getLogger(__name__)


def csrf_failure(request, reason=''):
    return error('CSRF_FAILED', 'Reload the page and try again.', 403)


def payload(request, allowed, maximum=16384):
    try:
        if request.content_type != 'application/json' or len(request.body) > maximum:
            raise ValueError
        data = json.loads(request.body)
        if not isinstance(data, dict) or set(data) - set(allowed):
            raise ValueError
        return data
    except (ValueError, UnicodeDecodeError):
        raise ValueError('Send a valid JSON object with supported fields.') from None


def identity(data):
    username = data.get('intra_username')
    if not isinstance(username, str) or not 1 <= len(username.strip()) <= 150:
        raise ValueError('Enter a valid Intra username.')
    return username.strip().lower()


def limited(request, scope, limit, seconds):
    # Trust the connection IP, not a caller-supplied forwarding header.
    return not throttle(scope, request.META.get('REMOTE_ADDR', ''), limit=limit, seconds=seconds)


@require_GET
@never_cache
@ensure_csrf_cookie
def csrf(request):
    return JsonResponse({'csrf_token': get_token(request), 'local_demo_login': demo.enabled()})


@require_POST
@never_cache
@sensitive_post_parameters()
@sensitive_variables()
def setup_request(request):
    if limited(request, 'setup-ip', settings.AUTH_SETUP_IP_LIMIT, 3600):
        return error('RATE_LIMITED', 'Too many requests. Try again later.', 429)
    try:
        data = payload(request, ['intra_username', 'account_type'])
        username = identity(data)
    except ValueError as exc:
        return error('INVALID_REQUEST', str(exc), 400)
    if throttle('setup-account', username, limit=3, seconds=3600):
        try:
            request_setup(username)
        except (SMTPException, OSError):
            # Never log email bodies, tokens, usernames, or credentials.
            logger.error('Account setup email delivery failed.')
    return JsonResponse({'message': 'If the account is eligible for setup, a link will be sent to its campus email.'}, status=202)


@require_POST
@never_cache
@sensitive_post_parameters()
@sensitive_variables()
def setup_complete(request):
    if limited(request, 'setup-complete-ip', settings.AUTH_COMPLETE_IP_LIMIT, 900):
        return error('RATE_LIMITED', 'Too many attempts. Try again later.', 429)
    try:
        data = payload(request, ['token', 'password'])
        password = data.get('password')
        if not isinstance(password, str) or not 1 <= len(password) <= 1024:
            raise ValueError('Enter a password up to 1024 characters.')
        status = complete_setup(data.get('token'), password)
    except ValueError as exc:
        return error('INVALID_REQUEST', str(exc), 400)
    except InvalidSetup:
        return error('INVALID_SETUP_LINK', 'This setup link is invalid or expired. Request a new one.', 400)
    except ValidationError as exc:
        return error('INVALID_PASSWORD', ' '.join(exc.messages), 422)
    return JsonResponse({'status': status})


@require_POST
@never_cache
@sensitive_post_parameters()
@sensitive_variables()
def sign_in(request):
    if limited(request, 'login-ip', settings.AUTH_LOGIN_IP_LIMIT, 900):
        return error('RATE_LIMITED', 'Too many sign-in attempts. Try again later.', 429)
    try:
        data = payload(request, ['intra_username', 'account_type', 'password'])
        username = identity(data)
        password = data.get('password')
        if not demo.enabled() and (not isinstance(password, str) or not 1 <= len(password) <= 1024):
            raise ValueError('Enter a username and password.')
    except ValueError as exc:
        return error('INVALID_REQUEST', str(exc), 400)
    if not throttle('login-account', username, limit=settings.AUTH_LOGIN_ACCOUNT_LIMIT, seconds=900):
        return error('RATE_LIMITED', 'Too many sign-in attempts. Try again later.', 429)
    # account_type is accepted for older clients, but never consulted. The unique
    # stored username determines the account and its trusted role.
    account = User.objects.filter(username__iexact=username).first()
    demo_login = demo.enabled()
    user = account if demo_login else authenticate(request, username=account.username if account else username, password=password)
    if not user or not eligible(user) or (not demo_login and not user.email_verified_at):
        return error('INVALID_CREDENTIALS', 'Unable to sign in with these credentials.', 401)
    login(request, user, backend='django.contrib.auth.backends.ModelBackend')
    request.session['local_demo_login'] = demo_login
    pending = not demo_login and not user.approved_at
    request.session.set_expiry(900 if pending else settings.SESSION_COOKIE_AGE)
    AccountAudit.objects.create(actor=user, subject=user, action='Local demo sign-in' if demo_login else ('Pending approval sign-in' if pending else 'Signed in'))
    return JsonResponse({'status': 'awaiting_approval' if pending else 'signed_in', 'role': user.role, 'csrf_token': get_token(request)})


@require_POST
@never_cache
@sensitive_post_parameters()
@sensitive_variables()
def reset_request(request):
    if limited(request, 'reset-ip', settings.AUTH_SETUP_IP_LIMIT, 3600):
        return error('RATE_LIMITED', 'Too many requests. Try again later.', 429)
    try:
        username = identity(payload(request, ['intra_username', 'account_type']))
    except ValueError as exc:
        return error('INVALID_REQUEST', str(exc), 400)
    if throttle('reset-account', username, limit=3, seconds=3600):
        try:
            request_reset(username)
        except (SMTPException, OSError):
            logger.error('Password reset email delivery failed.')
    return JsonResponse({'message': 'If this account can reset its password, a link will be sent to its campus email.'}, status=202)


@require_POST
@never_cache
@sensitive_post_parameters()
@sensitive_variables()
def reset_complete(request):
    if limited(request, 'reset-complete-ip', settings.AUTH_COMPLETE_IP_LIMIT, 900):
        return error('RATE_LIMITED', 'Too many attempts. Try again later.', 429)
    try:
        data = payload(request, ['token', 'password'])
        password = data.get('password')
        if not isinstance(password, str) or not 1 <= len(password) <= 1024:
            raise ValueError('Enter a password up to 1024 characters.')
        username = complete_reset(data.get('token'), password)
    except ValueError as exc:
        return error('INVALID_REQUEST', str(exc), 400)
    except InvalidSetup:
        return error('INVALID_TOKEN', 'This reset link is invalid or expired. Request a new one.', 400)
    except ValidationError as exc:
        return error('INVALID_PASSWORD', ' '.join(exc.messages), 422)
    logout(request)
    return JsonResponse({'status': 'ready', 'intra_username': username})


@require_POST
@never_cache
def sign_out(request):
    if request.user.is_authenticated:
        AccountAudit.objects.create(actor=request.user, subject=request.user, action='Signed out')
    logout(request)
    return JsonResponse({'status': 'signed_out'})


@require_http_methods(['GET', 'PATCH'])
@protected(staff=True)
def approval_settings(request):
    if request.method == 'GET':
        row = account_settings()
        return JsonResponse({'manual_student_approval_enabled': row.manual_student_approval_enabled, 'version': row.version})
    try:
        data = payload(request, ['manual_student_approval_enabled', 'version'])
        enabled, version = data.get('manual_student_approval_enabled'), data.get('version')
        if type(enabled) is not bool or type(version) is not int:
            raise ValueError('Provide a boolean approval setting and its version.')
    except ValueError as exc:
        return error('INVALID_REQUEST', str(exc), 400)
    with transaction.atomic():
        row = account_settings(lock=True)
        if row.version != version:
            return error('STATE_CONFLICT', 'Settings changed. Reload before saving.', 409)
        row.manual_student_approval_enabled = enabled
        row.version += 1
        row.save()
        AccountAudit.objects.create(actor=request.user, action='Approval setting updated', detail={
            'enabled': enabled, 'summary': 'Manual approval enabled' if enabled else 'Manual approval disabled; existing pending accounts retained'})
    return JsonResponse({'manual_student_approval_enabled': row.manual_student_approval_enabled, 'version': row.version})


@require_GET
@protected(staff=True)
def pending_accounts(request):
    try:
        limit = int(request.GET.get('limit', 25))
        from uuid import UUID
        cursor = UUID(request.GET['cursor']) if request.GET.get('cursor') else None
        if not 1 <= limit <= 100:
            raise ValueError
    except (ValueError, TypeError):
        return error('INVALID_FILTER', 'Use a valid cursor and limit from 1 to 100.', 400)
    rows = StudentProfile.objects.select_related('user').filter(eligibility_status='eligible', intra_active=True,
        user__role='student', user__is_active=True, user__email_verified_at__isnull=False, user__approved_at__isnull=True).order_by('id')
    if cursor:
        rows = rows.filter(id__gt=cursor)
    items = list(rows[:limit+1])
    return JsonResponse({'items': [profile_json(p) for p in items[:limit]],
                         'next_cursor': str(items[limit-1].id) if len(items) > limit else None})


@require_POST
@protected(staff=True)
def approve_account(request, profile_id):
    with transaction.atomic():
        profile = StudentProfile.objects.select_for_update().filter(pk=profile_id).first()
        user = User.objects.select_for_update().get(pk=profile.user_id) if profile else None
        if not user or user.role != 'student' or not eligible(user) or not user.email_verified_at or not user.has_usable_password():
            return error('ACCOUNT_UNAVAILABLE', 'This student account cannot be approved.', 409)
        if not user.approved_at:
            from django.utils import timezone
            user.approved_at, user.approved_by = timezone.now(), request.user
            user.save(update_fields=['approved_at', 'approved_by'])
            AccountAudit.objects.create(actor=request.user, subject=user, action='Student approved', detail={'summary': 'Student account approved'})
    return JsonResponse({'status': 'approved', 'student_id': str(profile.id)})


@require_GET
@never_cache
@ensure_csrf_cookie
def account_page(request, setup=False):
    response = render(request, 'profiles/account.html', {'setup': setup})
    response['Referrer-Policy'] = 'no-referrer'
    response['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
    return response
