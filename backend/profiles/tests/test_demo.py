import json
from datetime import timedelta
from unittest.mock import patch
from uuid import uuid4

from django.test import Client, TestCase, override_settings
from django.utils import timezone

from profiles.models import AccountAudit, Rating, StudentProfile, User, VotingWindow


@override_settings(DEBUG=True, LOCAL_DEMO_LOGIN=True)
class LocalDemoTests(TestCase):
    def setUp(self):
        now = timezone.now()
        self.students = []
        for index in range(2):
            user = User.objects.create_user(username=f'learner{index}')
            self.students.append(StudentProfile.objects.create(user=user, intra_id=9000+index,
                campus_id=35, intra_active=True, eligibility_status='eligible', profile_synced_at=now))
        self.staff = User.objects.create_user(username='demo-staff', role='staff', is_staff=True, approved_at=now)
        self.window = VotingWindow.objects.create(name='Presentation', starts_at=now-timedelta(minutes=1),
            ends_at=now+timedelta(hours=1), max_votes=8)

    def sign_in(self, username, **extra):
        return self.client.post('/api/v1/auth/login', json.dumps({'intra_username': username, **extra}),
            content_type='application/json')

    def test_username_only_login_leaves_credentials_and_verification_unchanged(self):
        self.assertTrue(self.client.get('/api/v1/auth/csrf').json()['local_demo_login'])
        user = self.students[0].user
        original_password = user.password
        self.assertEqual(self.sign_in(' LEARNER0 ').status_code, 200)
        me = self.client.get('/api/v1/me').json()
        self.assertEqual(me['status'], 'active')
        self.assertIsNotNone(me['profile'])
        self.assertEqual(self.client.get('/api/v1/student/dashboard').status_code, 200)
        user.refresh_from_db()
        self.assertEqual(user.password, original_password)
        self.assertIsNone(user.email_verified_at)
        self.assertIsNone(user.approved_at)
        self.assertTrue(AccountAudit.objects.filter(action='Local demo sign-in').exists())

    def test_stored_roles_are_respected_and_unknown_accounts_are_not_created(self):
        self.assertEqual(self.sign_in('missing').status_code, 401)
        self.assertFalse(User.objects.filter(username='missing').exists())
        self.assertEqual(self.sign_in('learner0', account_type='staff').json()['role'], 'student')
        self.assertEqual(self.client.get('/api/v1/staff/workspace').status_code, 403)
        self.assertEqual(self.sign_in('demo-staff').json()['role'], 'staff')
        self.assertEqual(self.client.get('/api/v1/staff/workspace').status_code, 200)
        self.assertEqual(self.client.get('/api/v1/student/dashboard').status_code, 403)

    def test_inactive_excluded_and_unprovisioned_staff_cannot_sign_in(self):
        user = self.students[0].user
        user.is_active = False
        user.save()
        self.assertEqual(self.sign_in(user.username).status_code, 401)
        profile = self.students[1]
        profile.eligibility_status = 'excluded'
        profile.save()
        self.assertEqual(self.sign_in(profile.user.username).status_code, 401)
        self.staff.is_staff = False
        self.staff.save()
        self.assertEqual(self.sign_in(self.staff.username).status_code, 401)

    def test_disabling_mode_revokes_demo_sessions_and_restores_password_checks(self):
        self.assertEqual(self.sign_in('learner0').status_code, 200)
        with override_settings(LOCAL_DEMO_LOGIN=False):
            self.assertFalse(self.client.get('/api/v1/auth/csrf').json()['local_demo_login'])
            self.assertEqual(self.client.get('/api/v1/me').status_code, 403)
            self.assertEqual(self.client.get('/api/v1/student/dashboard').status_code, 403)
            self.assertEqual(self.sign_in('learner0').status_code, 400)

    def test_non_debug_mode_never_allows_passwordless_login(self):
        self.assertEqual(self.sign_in('learner0').status_code, 200)
        with override_settings(DEBUG=False):
            self.assertFalse(self.client.get('/api/v1/auth/csrf').json()['local_demo_login'])
            self.assertEqual(self.client.get('/api/v1/me').status_code, 403)
            self.assertEqual(self.sign_in('learner0').status_code, 400)

    def test_csrf_is_required_even_for_demo_login(self):
        client = Client(enforce_csrf_checks=True)
        result = client.post('/api/v1/auth/login', json.dumps({'intra_username': 'learner0'}),
            content_type='application/json')
        self.assertEqual(result.status_code, 403)

    @patch('profiles.student.detection.run_soon')
    def test_demo_roster_peers_profile_and_vote_work_without_approving_accounts(self, run_soon):
        self.sign_in('learner0')
        peers = self.client.get('/api/v1/student/peers').json()['items']
        self.assertEqual(len(peers), 1)
        self.assertEqual(peers[0]['intra_username'], 'learner1')
        saved = self.client.patch('/api/v1/me/profile', json.dumps({'accent': '#FF6EC7', 'onboarded': True}),
            content_type='application/json')
        self.assertTrue(saved.json()['profile']['onboarded'])
        body = {'window_id': str(self.window.id), 'recipient_id': str(self.students[1].id),
            'stars': 3, 'label_ids': []}
        result = self.client.post('/api/v1/student/ratings', json.dumps(body),
            content_type='application/json', HTTP_IDEMPOTENCY_KEY=str(uuid4()))
        self.assertEqual(result.status_code, 201)
        self.assertEqual(Rating.objects.get().voter, self.students[0])
        self.assertFalse(User.objects.filter(email_verified_at__isnull=False).exists())
        self.assertFalse(User.objects.filter(role='student', approved_at__isnull=False).exists())

    def test_existing_roster_is_not_rewritten(self):
        self.window.roster_captured_at = timezone.now()
        self.window.save()
        self.sign_in('learner0')
        self.assertIsNone(self.client.get('/api/v1/student/dashboard').json()['allowance'])
        self.assertEqual(self.window.roster.count(), 0)
