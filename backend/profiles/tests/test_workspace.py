import csv
import io
import json
from datetime import timedelta
from tempfile import NamedTemporaryFile
from uuid import uuid4

from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import IntegrityError, transaction
from django.test import Client, TestCase
from django.utils import timezone

from profiles.models import (AbuseCase, AccountAudit, BlockedAttempt, CaseFinding, Invalidation, Label, Rating,
                             StudentProfile, User, VotingWindow, WindowParticipant)


class WorkspaceTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_superuser(username='admin', password='River-Signal-29!')
        self.client.force_login(self.staff)
        self.now = timezone.now()
        self.students = []
        for index in range(3):
            user = User.objects.create_user(username=f'learner{index}', first_name='Example', last_name=str(index),
                email_verified_at=self.now-timedelta(days=2), approved_at=self.now-timedelta(days=2))
            self.students.append(StudentProfile.objects.create(user=user, intra_id=index+1, campus_id=35,
                intra_active=True, eligibility_status='eligible', profile_synced_at=self.now))
        self.window = VotingWindow.objects.create(name='Current window', starts_at=self.now-timedelta(days=1),
            ends_at=self.now+timedelta(days=1), min_votes=2, max_votes=8)

    def read(self):
        response = self.client.get('/api/v1/staff/workspace')
        self.assertEqual(response.status_code, 200)
        return response.json()

    def action(self, data, version=None):
        if version is None:
            version = self.read()['version']
        return self.client.post('/api/v1/staff/actions', json.dumps({**data, 'version': version}), content_type='application/json')

    def rating(self, voter=0, recipient=1, **fields):
        return Rating.objects.create(window=self.window, voter=self.students[voter], recipient=self.students[recipient], stars=3, **fields)

    def case(self, ratings):
        case = AbuseCase.objects.create(window=self.window, title='Suspicious voting')
        case.ratings.set(ratings)
        case.students.set(self.students[:2])
        CaseFinding.objects.create(case=case, mechanism='Reciprocal voting', explanation='Example evidence.')
        return case

    def test_all_staff_endpoints_enforce_access_and_csrf(self):
        routes = ['/api/v1/staff/workspace', '/api/v1/staff/actions', '/api/v1/staff/ratings/export.csv']
        for route in routes:
            method = 'get' if route.endswith('workspace') else 'post'
            self.assertEqual(getattr(Client(), method)(route).status_code, 401)
            client = Client()
            client.force_login(self.students[0].user)
            self.assertEqual(getattr(client, method)(route).status_code, 403)
        client = Client(enforce_csrf_checks=True)
        client.force_login(self.staff)
        for route in routes[1:]:
            self.assertEqual(client.post(route, '{}', content_type='application/json').status_code, 403)
        self.staff.is_staff = False
        self.staff.save()
        self.assertEqual(self.client.get(routes[0]).status_code, 403)

    def test_snapshot_uses_real_identities_and_retains_historical_people(self):
        rating = self.rating()
        excluded = self.students[0]
        excluded.eligibility_status = 'excluded'
        excluded.save()
        self.students[2].eligibility_status = 'excluded'
        self.students[2].save()
        data = self.read()
        self.assertEqual(len(data['students']), 2)
        self.assertFalse(next(s for s in data['students'] if s['id'] == str(excluded.id))['active'])
        self.assertEqual(data['ratings'][0]['id'], str(rating.id))
        self.assertEqual(data['staff'][0]['intra_username'], 'admin')
        for secret in ('password', 'token_hash', 'intra_id', '@student.42amman.com'):
            self.assertNotIn(secret, json.dumps(data))
        response = self.client.get('/api/v1/staff/workspace')
        self.assertIn('no-store', response['Cache-Control'])

    def test_empty_workspace_and_attempt_only_case(self):
        self.window.delete()
        data = self.read()
        self.assertEqual(data['windows'], [])
        self.assertEqual(data['cases'], [])
        self.assertEqual(len(data['students']), 3)
        self.window = VotingWindow.objects.create(name='Attempt window', starts_at=self.now,
            ends_at=self.now+timedelta(days=1))
        attempt = BlockedAttempt.objects.create(window=self.window, voter=self.students[0], recipient=self.students[1], reason='Duplicate blocked')
        for student in self.students[:2]:
            student.eligibility_status = 'excluded'
            student.save()
        case = self.case([])
        case.attempts.add(attempt)
        data = self.read()
        self.assertEqual(len(data['students']), 3)
        self.assertEqual(data['attempts'][0]['reason'], 'Duplicate blocked')
        response = self.action({'type': 'resolve-case', 'id': str(case.id), 'status': 'confirmed', 'ids': [], 'reason': 'Only blocked attempts.'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['cases'][0]['status'], 'confirmed')
        self.assertFalse(Invalidation.objects.exists())

    def test_roster_capture_is_durable_excludes_late_approvals_and_keeps_zero_voters(self):
        late = self.students[2].user
        late.approved_at = self.now
        late.save()
        data = self.read()
        self.assertEqual(len(data['windows'][0]['roster']), 2)
        self.assertEqual(data['ratings'], [])
        self.students[1].user.is_active = False
        self.students[1].user.save()
        call_command('capture_window_rosters', stdout=io.StringIO())
        self.assertEqual(WindowParticipant.objects.count(), 2)
        data = self.read()
        self.assertEqual(len(data['windows'][0]['roster']), 2)

    def test_window_updates_validate_overlap_versions_and_preserve_roster(self):
        data = self.read()
        window = data['windows'][0]
        new = {**window, 'id': str(uuid4()), 'version': 0}
        self.assertEqual(self.action({'type': 'window', 'value': new}).status_code, 400)
        rating = self.rating()
        response = self.action({'type': 'window', 'value': {**window, 'name': 'Changed', 'max_votes': 0, 'min_votes': 0}}, version=data['version'])
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['windows'][0]['roster'], window['roster'])
        self.assertTrue(Rating.objects.filter(pk=rating.pk).exists())
        self.assertEqual(self.action({'type': 'window', 'value': window}, version=data['version']).status_code, 409)
        for changes in ({'max_votes': True}, {'min_votes': -1}, {'starts_at': '2026-01-01T00:00:00'}, {'ends_at': window['starts_at']}):
            current = self.read()['windows'][0]
            self.assertEqual(self.action({'type': 'window', 'value': {**current, **changes}}).status_code, 400)

    def test_label_controls_preserve_history_and_reject_stale_updates(self):
        value = {'id': str(uuid4()), 'name': 'Example label', 'allowed_stars': [2, 3], 'active': True, 'version': 0}
        response = self.action({'type': 'label', 'value': value})
        self.assertEqual(response.status_code, 200)
        saved = next(label for label in response.json()['labels'] if label['id'] == value['id'])
        rating = self.rating()
        rating.labels.add(saved['id'])
        self.assertEqual(self.action({'type': 'label', 'value': {**saved, 'name': 'Replacement'}}).status_code, 400)
        self.assertEqual(self.action({'type': 'label', 'value': {**saved, 'active': False}}).status_code, 200)
        self.assertEqual(rating.labels.get().name, 'Example label')
        self.assertEqual(self.action({'type': 'label', 'value': saved}).status_code, 409)
        self.assertEqual(self.action({'type': 'label', 'value': {**value, 'id': str(uuid4()), 'name': 'example LABEL'}}).status_code, 400)

    def test_resolve_is_atomic_selective_audited_and_cannot_be_replayed(self):
        selected, preserved = self.rating(), self.rating(1, 0)
        case = self.case([selected, preserved])
        request = {'type': 'resolve-case', 'id': str(case.id), 'status': 'confirmed', 'reason': 'Confirmed evidence.', 'ids': []}
        self.assertEqual(self.action(request).status_code, 409)
        self.assertFalse(Invalidation.objects.exists())
        request['ids'] = [str(selected.id)]
        response = self.action(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Invalidation.objects.get().rating, selected)
        self.assertEqual(Invalidation.objects.get().by, self.staff)
        self.assertEqual(Rating.objects.count(), 2)
        case.refresh_from_db()
        self.assertEqual(case.status, 'confirmed')
        self.assertIsNotNone(case.resolved_at)
        self.assertEqual(AccountAudit.objects.get(action='Case resolved').detail['rating_ids'], [str(selected.id)])
        self.assertEqual(self.action(request).status_code, 409)
        self.assertEqual(Invalidation.objects.count(), 1)

    def test_dismissal_and_outside_evidence_leave_scores_unchanged(self):
        linked, outside = self.rating(), self.rating(1, 0)
        case = self.case([linked])
        request = {'type': 'resolve-case', 'id': str(case.id), 'status': 'confirmed', 'reason': 'Evidence.', 'ids': [str(outside.id)]}
        self.assertEqual(self.action(request).status_code, 409)
        request.update(status='dismissed', ids=[str(linked.id)])
        self.assertEqual(self.action(request).status_code, 400)
        request['ids'] = []
        self.assertEqual(self.action(request).status_code, 200)
        self.assertFalse(Invalidation.objects.exists())

    def test_csv_is_scoped_formula_safe_and_audited(self):
        rating = self.rating(explanation='=DANGEROUS()\n"quoted", text')
        response = self.client.post('/api/v1/staff/ratings/export.csv', json.dumps({
            'window_id': str(self.window.id), 'rating_ids': [str(rating.id)]}), content_type='application/json')
        self.assertEqual(response.status_code, 200)
        rows = list(csv.reader(io.StringIO(response.content.decode('utf-8-sig'))))
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[1][10], '\'=DANGEROUS()\n"quoted", text')
        self.assertEqual(AccountAudit.objects.filter(action='Ratings exported').count(), 1)
        self.assertIn('no-store', response['Cache-Control'])
        response = self.client.post('/api/v1/staff/ratings/export.csv', json.dumps({
            'window_id': str(uuid4()), 'rating_ids': [str(rating.id)]}), content_type='application/json')
        self.assertEqual(response.status_code, 409)
        self.assertEqual(AccountAudit.objects.filter(action='Ratings exported').count(), 1)

    def test_database_rejects_self_votes_duplicates_and_invalid_stars(self):
        self.rating()
        for values in ({'voter': 0, 'recipient': 0}, {'voter': 0, 'recipient': 1}):
            with self.assertRaises(IntegrityError), transaction.atomic():
                self.rating(**values)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Rating.objects.create(window=self.window, voter=self.students[1], recipient=self.students[0], stars=4)


class ProvisionStaffTests(TestCase):
    def provision(self, rows):
        with NamedTemporaryFile(mode='w+', suffix='.json') as roster:
            json.dump(rows, roster)
            roster.flush()
            call_command('provision_staff', roster=roster.name, stdout=io.StringIO())

    def test_trusted_provisioning_is_idempotent_and_requires_staff_domain_verification(self):
        rows = [{'intra_username': 'staffmember', 'first_name': 'Example', 'last_name': 'Staff'}]
        student = User.objects.create_user(username='staffmember', password='Old-Student-Password!', email_verified_at=timezone.now())
        self.provision(rows)
        student.refresh_from_db()
        self.assertEqual(student.role, 'staff')
        self.assertTrue(student.is_staff)
        self.assertFalse(student.is_superuser)
        self.assertFalse(student.has_usable_password())
        self.assertIsNone(student.email_verified_at)
        self.assertEqual(student.email, 'staffmember@42amman.com')
        self.assertIsNotNone(student.approved_at)
        student.set_password('New-Staff-Password!')
        student.email_verified_at = timezone.now()
        student.save()
        self.provision(rows)
        student.refresh_from_db()
        self.assertTrue(student.check_password('New-Staff-Password!'))
        self.assertIsNotNone(student.email_verified_at)
        self.assertEqual(AccountAudit.objects.filter(action='Staff provisioned').count(), 1)

    def test_invalid_roster_rolls_back_all_staff_creation(self):
        with self.assertRaises(CommandError):
            self.provision([{'intra_username': 'newstaff', 'first_name': 'A', 'last_name': 'B'}, {}])
        self.assertFalse(User.objects.exists())
