import hashlib
import json
import re
from datetime import timedelta
from smtplib import SMTPException
from unittest.mock import patch

from django.core import mail
from django.test import Client, TestCase, override_settings
from django.utils import timezone

from profiles.models import AccountAudit, PasswordResetToken, SetupToken, StudentProfile, User

OLD = 'Hearth-River-Signal-29!'
NEW = 'Rainy-Copper-Skies-74!'


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend', ACCOUNT_ORIGIN='http://testserver')
class PasswordResetTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='learner', password=OLD, email_verified_at=timezone.now(), approved_at=timezone.now())
        self.profile = StudentProfile.objects.create(user=self.user, intra_id=123, campus_id=35,
            eligibility_status='eligible', intra_active=True, profile_synced_at=timezone.now())

    def post(self, path, data, client=None):
        return (client or self.client).post('/api/v1/auth/'+path, json.dumps(data), content_type='application/json')

    def link(self, username='learner'):
        response = self.post('password-reset-request', {'intra_username': username})
        self.assertEqual(response.status_code, 202)
        return re.search(r'#token=([A-Za-z0-9_-]+)', mail.outbox[-1].body).group(1)

    def complete(self, token, password=NEW):
        return self.post('password-reset-complete', {'token': token, 'password': password})

    def test_password_reset_changes_only_credential_and_revokes_old_sessions(self):
        first, second = Client(), Client()
        for client in (first, second):
            self.assertEqual(self.post('login', {'intra_username': 'learner', 'password': OLD}, client).status_code, 200)
        verified, approved = self.user.email_verified_at, self.user.approved_at
        token = self.link()
        self.assertEqual(mail.outbox[-1].to, ['learner@student.42amman.com'])
        self.assertIn('/reset/complete#token=', mail.outbox[-1].body)
        self.assertEqual(PasswordResetToken.objects.get().token_hash, hashlib.sha256(token.encode()).hexdigest())
        self.assertEqual(self.complete(token).status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(NEW))
        self.assertEqual(self.user.email_verified_at, verified)
        self.assertEqual(self.user.approved_at, approved)
        for client in (first, second):
            self.assertEqual(client.get('/api/v1/me').status_code, 401)
        self.assertEqual(self.post('login', {'intra_username': 'learner', 'password': OLD}).status_code, 401)
        self.assertEqual(self.post('login', {'intra_username': 'learner', 'password': NEW}).status_code, 200)
        self.assertNotIn(token, json.dumps(list(AccountAudit.objects.values('detail'))))

    def test_reset_tokens_expire_are_single_use_and_purpose_bound(self):
        old = self.link()
        token = self.link()
        self.assertEqual(self.complete(old).status_code, 400)
        self.assertEqual(self.post('setup-complete', {'token': token, 'password': NEW}).status_code, 400)
        row = PasswordResetToken.objects.get(token_hash=hashlib.sha256(token.encode()).hexdigest())
        row.expires_at = timezone.now()-timedelta(seconds=1)
        row.save()
        self.assertEqual(self.complete(token).status_code, 400)
        token = self.link()
        self.assertEqual(self.complete(token).status_code, 200)
        self.assertEqual(self.complete(token).json()['error']['code'], 'INVALID_TOKEN')
        setup = 's'*43
        SetupToken.objects.create(user=self.user, token_hash=hashlib.sha256(setup.encode()).hexdigest(), expires_at=timezone.now()+timedelta(minutes=30))
        self.assertEqual(self.complete(setup).status_code, 400)

    def test_reset_cannot_approve_pending_or_reactivate_excluded_accounts(self):
        self.user.approved_at = None
        self.user.save()
        token = self.link()
        self.assertEqual(self.complete(token).status_code, 200)
        self.user.refresh_from_db()
        self.assertIsNone(self.user.approved_at)
        self.assertEqual(self.post('login', {'intra_username': 'learner', 'password': NEW}).json()['status'], 'awaiting_approval')
        self.assertEqual(self.client.get('/api/v1/student/dashboard').status_code, 403)
        token = self.link()
        self.profile.eligibility_status = 'excluded'
        self.profile.save()
        self.assertEqual(self.complete(token).status_code, 400)

    def test_reset_requests_are_generic_and_never_accept_delivery_address(self):
        known = self.post('password-reset-request', {'intra_username': 'learner'})
        unknown = self.post('password-reset-request', {'intra_username': 'unknown'})
        self.assertEqual(known.content, unknown.content)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(self.post('password-reset-request', {'intra_username': 'learner', 'email': 'bad@example.com'}).status_code, 400)
        self.user.set_unusable_password()
        self.user.save()
        self.assertEqual(self.post('password-reset-request', {'intra_username': 'learner'}).content, unknown.content)
        self.assertEqual(len(mail.outbox), 1)

    def test_weak_password_and_mail_failure_do_not_consume_or_persist_tokens(self):
        token = self.link()
        self.assertEqual(self.complete(token, 'short').status_code, 422)
        self.assertIsNone(PasswordResetToken.objects.get().used_at)
        with patch('profiles.accounts.send_mail', side_effect=SMTPException('test failure')):
            with self.assertLogs('profiles.auth_views', level='ERROR'):
                response = self.post('password-reset-request', {'intra_username': 'learner'})
        self.assertEqual(response.status_code, 202)
        self.assertEqual(PasswordResetToken.objects.count(), 1)
        self.assertIsNone(PasswordResetToken.objects.get().used_at)

    def test_staff_reset_uses_staff_domain_and_does_not_change_role(self):
        staff = User.objects.create_superuser(username='staffmember', password=OLD)
        token = self.link('staffmember')
        self.assertEqual(mail.outbox[-1].to, ['staffmember@42amman.com'])
        self.assertEqual(self.complete(token).status_code, 200)
        self.assertEqual(self.post('login', {'intra_username': 'staffmember', 'password': NEW}).json()['role'], 'staff')
        staff.refresh_from_db()
        self.assertEqual(staff.role, 'staff')
