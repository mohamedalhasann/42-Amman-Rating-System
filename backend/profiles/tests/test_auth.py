import hashlib
import json
import re
from datetime import timedelta
from smtplib import SMTPException
from unittest.mock import patch

from django.contrib.sessions.models import Session
from django.core import mail
from django.test import Client, TestCase, override_settings
from django.utils import timezone

from profiles.accounts import throttle
from profiles.models import AccountAudit, AccountSettings, SetupToken, StudentProfile, User

PASSWORD = 'Hearth-River-Signal-29!'


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend', ACCOUNT_ORIGIN='http://testserver',
                   AUTH_SETUP_IP_LIMIT=10, AUTH_LOGIN_IP_LIMIT=20, AUTH_COMPLETE_IP_LIMIT=20)
class AccountTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='learner', first_name='Example', last_name='Person')
        self.profile = StudentProfile.objects.create(user=self.user, intra_id=123, campus_id=35,
            intra_active=True, eligibility_status='eligible', profile_synced_at=timezone.now())
        self.staff = User.objects.create_superuser(username='admin', password=PASSWORD)

    def post(self, path, data, client=None):
        return (client or self.client).post('/api/v1/' + path, json.dumps(data), content_type='application/json')

    def setup_link(self, username='learner', role='student'):
        response = self.post('auth/setup-request', {'intra_username': username})
        self.assertEqual(response.status_code, 202)
        return re.search(r'#token=([A-Za-z0-9_-]+)', mail.outbox[-1].body).group(1)

    def complete(self, token):
        return self.post('auth/setup-complete', {'token': token, 'password': PASSWORD})

    def login(self, username='learner', role='student'):
        return self.post('auth/login', {'intra_username': username, 'password': PASSWORD})

    def test_complete_student_flow_pending_approval_session_and_logout(self):
        token = self.setup_link()
        self.assertEqual(mail.outbox[0].to, ['learner@student.42amman.com'])
        self.assertIn('http://testserver/account/setup/#token=', mail.outbox[0].body)
        self.assertEqual(SetupToken.objects.get().token_hash, hashlib.sha256(token.encode()).hexdigest())
        self.assertNotIn(token, json.dumps(list(AccountAudit.objects.values('detail'))))
        response = self.complete(token)
        self.assertEqual(response.json(), {'status': 'awaiting_approval'})
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(PASSWORD))
        self.assertIsNotNone(self.user.email_verified_at)
        self.assertIsNone(self.user.approved_at)
        self.assertEqual(self.login().json()['error']['code'], 'PENDING_APPROVAL')
        self.assertNotIn('_auth_user_id', self.client.session)
        self.assertEqual(self.client.get('/api/v1/me').status_code, 401)
        self.client.force_login(self.staff)
        pending = self.client.get('/api/v1/staff/account-approvals').json()['items']
        self.assertEqual(pending[0]['id'], str(self.profile.pk))
        approve_url = f'staff/account-approvals/{self.profile.pk}/approve'
        self.assertEqual(self.post(approve_url, {}).status_code, 200)
        self.assertEqual(self.post(approve_url, {}).status_code, 200)
        self.assertEqual(AccountAudit.objects.filter(action='Student approved').count(), 1)
        self.user.refresh_from_db()
        self.assertEqual(self.user.approved_by, self.staff)
        self.post('auth/logout', {})
        self.assertEqual(self.login().status_code, 200)
        self.assertEqual(self.client.get('/api/v1/me').json()['intra_username'], 'learner')
        self.assertEqual(self.client.get('/api/v1/staff/account-approvals').status_code, 403)
        session_key = self.client.session.session_key
        self.assertEqual(self.post('auth/logout', {}).status_code, 200)
        self.assertFalse(Session.objects.filter(session_key=session_key).exists())
        self.assertEqual(self.client.get('/api/v1/me').status_code, 401)

    def test_invalid_expired_reissued_and_replayed_tokens(self):
        old_token = self.setup_link()
        token = self.setup_link()
        self.assertEqual(self.complete(old_token).status_code, 400)
        row = SetupToken.objects.get(token_hash=hashlib.sha256(token.encode()).hexdigest())
        row.expires_at = timezone.now() - timedelta(seconds=1)
        row.save()
        self.assertEqual(self.complete(token).status_code, 400)
        self.assertEqual(self.complete('invalid').status_code, 400)
        token = self.setup_link()
        self.assertEqual(self.complete(token).status_code, 200)
        self.assertEqual(self.complete(token).status_code, 400)

    def test_weak_password_or_ineligible_account_does_not_consume_token_or_grant_access(self):
        token = self.setup_link()
        result = self.post('auth/setup-complete', {'token': token, 'password': 'password'})
        self.assertEqual(result.status_code, 422)
        self.assertIsNone(SetupToken.objects.get().used_at)
        self.user.refresh_from_db()
        self.assertFalse(self.user.has_usable_password())
        self.assertIsNone(self.user.email_verified_at)
        self.profile.eligibility_status = 'excluded'
        self.profile.save()
        self.assertEqual(self.complete(token).status_code, 400)
        self.assertIsNone(SetupToken.objects.get().used_at)

    def test_setup_requests_are_generic_and_cannot_supply_email_or_create_staff(self):
        missing = self.post('auth/setup-request', {'intra_username': 'missing'})
        eligible = self.post('auth/setup-request', {'intra_username': 'learner'})
        staff_forge = self.post('auth/setup-request', {'intra_username': 'learner', 'account_type': 'staff'})
        self.assertEqual(missing.content, eligible.content)
        self.assertEqual(staff_forge.content, eligible.content)
        self.assertEqual(len(mail.outbox), 2)
        self.assertTrue(all(message.to == ['learner@student.42amman.com'] for message in mail.outbox))
        self.assertEqual(User.objects.count(), 2)
        self.assertEqual(self.post('auth/setup-request', {'intra_username': 'learner', 'email': 'attacker@example.com'}).status_code, 400)
        self.user.set_password(PASSWORD)
        self.user.save()
        existing = self.post('auth/setup-request', {'intra_username': 'learner'})
        self.assertEqual(existing.content, missing.content)
        self.assertEqual(len(mail.outbox), 2)

    def test_email_failure_returns_generic_response_and_rolls_back_token(self):
        with patch('profiles.accounts.send_mail', side_effect=SMTPException('test failure')):
            with self.assertLogs('profiles.auth_views', level='ERROR'):
                response = self.post('auth/setup-request', {'intra_username': 'learner'})
        self.assertEqual(response.status_code, 202)
        self.assertEqual(SetupToken.objects.count(), 0)
        self.assertFalse(AccountAudit.objects.filter(action='Setup link requested').exists())

    def test_preprovisioned_staff_can_setup_but_role_input_cannot_grant_staff(self):
        user = User.objects.create_user(username='staffmember', role='staff', is_staff=True, approved_at=timezone.now())
        token = self.setup_link('staffmember', 'staff')
        self.assertEqual(mail.outbox[-1].to, ['staffmember@42amman.com'])
        self.assertEqual(self.complete(token).json()['status'], 'ready')
        self.assertEqual(self.login('staffmember', 'staff').status_code, 200)
        self.assertEqual(self.client.get('/api/v1/staff/students').status_code, 200)
        user.refresh_from_db()
        self.assertFalse(user.is_superuser)
        # Older clients may still send account_type. It cannot change the stored role.
        response = self.post('auth/login', {'intra_username': 'STAFFMEMBER', 'password': PASSWORD, 'account_type': 'student'})
        self.assertEqual(response.json()['role'], 'staff')

    def test_configuration_is_versioned_and_evaluated_at_setup_completion(self):
        token = self.setup_link()
        self.client.force_login(self.staff)
        configuration = self.client.get('/api/v1/staff/settings').json()
        update = {'manual_student_approval_enabled': False, 'version': configuration['version']}
        response = self.client.patch('/api/v1/staff/settings', json.dumps(update), content_type='application/json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.patch('/api/v1/staff/settings', json.dumps(update), content_type='application/json').status_code, 409)
        self.assertEqual(self.complete(token).json()['status'], 'ready')
        self.assertEqual(self.login().status_code, 200)
        self.user.refresh_from_db()
        approved_at = self.user.approved_at
        self.client.force_login(self.staff)
        self.client.patch('/api/v1/staff/settings', json.dumps({'manual_student_approval_enabled': True, 'version': response.json()['version']}), content_type='application/json')
        self.user.refresh_from_db()
        self.assertEqual(self.user.approved_at, approved_at)

    def test_disabling_approval_does_not_approve_existing_pending_accounts(self):
        self.complete(self.setup_link())
        row, _ = AccountSettings.objects.get_or_create(pk=1)
        row.manual_student_approval_enabled = False
        row.save()
        self.assertEqual(self.login().json()['error']['code'], 'PENDING_APPROVAL')

    def test_access_is_checked_after_login_for_deactivation_or_exclusion(self):
        AccountSettings.objects.create(pk=1, manual_student_approval_enabled=False)
        self.complete(self.setup_link())
        self.assertEqual(self.login().status_code, 200)
        self.profile.eligibility_status = 'excluded'
        self.profile.save()
        self.assertEqual(self.client.get('/api/v1/me').status_code, 403)
        self.assertEqual(self.login().status_code, 401)

    def test_rate_limits_and_input_validation(self):
        for _ in range(3):
            self.post('auth/setup-request', {'intra_username': 'learner'})
        self.post('auth/setup-request', {'intra_username': 'learner'})
        self.assertEqual(len(mail.outbox), 3)
        for _ in range(6):
            self.post('auth/setup-request', {'intra_username': 'missing'})
        self.assertEqual(self.post('auth/setup-request', {'intra_username': 'missing'}).status_code, 429)
        self.assertTrue(throttle('test', 'identity', limit=1, seconds=60))
        self.assertFalse(throttle('test', 'identity', limit=1, seconds=60))
        self.assertEqual(self.post('auth/login', {'intra_username': 'learner', 'password': []}).status_code, 400)
        for _ in range(19):
            self.login()
        self.assertEqual(self.login().status_code, 429)

    def test_csrf_is_required_on_all_auth_writes_and_login_rotates_session(self):
        client = Client(enforce_csrf_checks=True)
        for route in ('auth/setup-request', 'auth/setup-complete', 'auth/login', 'auth/logout'):
            self.assertEqual(self.post(route, {}, client=client).status_code, 403)
        response = client.get('/api/v1/auth/csrf')
        csrf_token = response.json()['csrf_token']
        session = client.session
        session['example'] = True
        session.save()
        old_key = session.session_key
        response = client.post('/api/v1/auth/login', json.dumps({'intra_username': 'admin', 'account_type': 'staff', 'password': PASSWORD}),
                               content_type='application/json', HTTP_X_CSRFTOKEN=csrf_token)
        self.assertEqual(response.status_code, 200)
        self.assertNotEqual(client.session.session_key, old_key)
        self.assertNotEqual(response.json()['csrf_token'], csrf_token)
        response = client.post('/api/v1/auth/logout', '{}', content_type='application/json', HTTP_X_CSRFTOKEN=response.json()['csrf_token'])
        self.assertEqual(response.status_code, 200)

    def test_account_pages_do_not_change_account_or_expose_tokens(self):
        for url in ('/account/', '/account/setup/'):
            response = self.client.get(url)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response['Referrer-Policy'], 'no-referrer')
            self.assertIn("script-src 'self'", response['Content-Security-Policy'])
            self.assertIn('no-store', response['Cache-Control'])
        self.assertFalse(SetupToken.objects.exists())
