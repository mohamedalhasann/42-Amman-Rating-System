import json
from datetime import timedelta
from uuid import uuid4

from django.test import Client, TestCase
from django.utils import timezone

from profiles.models import (AbuseCase, BlockedAttempt, DetectionJob, Invalidation, Label, Rating,
                             RatingSubmission, StudentProfile, User, VotingWindow, WindowParticipant)


class StudentTests(TestCase):
    def setUp(self):
        self.now = timezone.now()
        self.profiles = []
        for index in range(4):
            user = User.objects.create_user(username=f'student{index}', first_name='Example', last_name=str(index),
                email_verified_at=self.now-timedelta(days=3), approved_at=self.now-timedelta(days=3))
            self.profiles.append(StudentProfile.objects.create(user=user, intra_id=index+1, campus_id=35,
                eligibility_status='eligible', intra_active=True, profile_synced_at=self.now))
        self.profile = self.profiles[0]
        self.client.force_login(self.profile.user)
        self.window = VotingWindow.objects.create(name='Current', starts_at=self.now-timedelta(days=1),
            ends_at=self.now+timedelta(days=1), min_votes=2, max_votes=3)
        self.staff = User.objects.create_superuser(username='admin', password=None)

    def get(self, route, **query):
        return self.client.get('/api/v1/'+route, query)

    def submit(self, **changes):
        key = changes.pop('key', str(uuid4()))
        body = {'window_id': str(self.window.id), 'recipient_id': str(self.profiles[1].id), 'stars': 3, 'label_ids': [], **changes}
        return self.client.post('/api/v1/student/ratings', json.dumps(body), content_type='application/json', HTTP_IDEMPOTENCY_KEY=key)

    def invalidate(self, rating):
        case = AbuseCase.objects.create(window=self.window, title='Confirmed example', status='confirmed', resolved_at=self.now)
        case.ratings.add(rating)
        Invalidation.objects.create(rating=rating, case=case, reason='Confirmed.', by=self.staff)

    def test_student_routes_require_active_approved_eligible_student(self):
        routes = ['student/dashboard', 'student/peers', 'student/labels?stars=3', 'student/history',
                  'student/participation', f'student/ratings/given?window_id={self.window.id}']
        self.client.logout()
        for route in routes:
            self.assertEqual(self.get(route).status_code, 401)
        self.client.force_login(self.staff)
        for route in routes:
            self.assertEqual(self.get(route).status_code, 403)
        self.assertEqual(self.submit().status_code, 403)
        self.client.force_login(self.profile.user)
        self.profile.user.approved_at = None
        self.profile.user.save()
        self.assertEqual(self.get('me').json()['status'], 'pending')
        for route in routes:
            self.assertEqual(self.get(route).status_code, 403)
        self.assertEqual(self.submit().status_code, 403)

    def test_dashboard_empty_window_and_own_average_privacy(self):
        self.window.delete()
        self.assertEqual(self.get('student/dashboard').json()['own_rating']['average'], None)
        self.assertIsNone(self.get('student/dashboard').json()['window'])
        self.window = VotingWindow.objects.create(name='Current', starts_at=self.now-timedelta(days=1), ends_at=self.now+timedelta(days=1))
        own = Rating.objects.create(window=self.window, voter=self.profiles[1], recipient=self.profile, stars=1)
        Rating.objects.create(window=self.window, voter=self.profiles[2], recipient=self.profile, stars=3)
        Rating.objects.create(window=self.window, voter=self.profiles[1], recipient=self.profiles[2], stars=1)
        data = self.get('student/dashboard').json()
        self.assertEqual(data['own_rating']['average'], 2)
        for forbidden in ('campus_average', 'received_labels', 'received_count', 'voter_id', 'recipient_id'):
            self.assertNotIn(forbidden, json.dumps(data))
        self.invalidate(own)
        self.assertEqual(self.get('student/dashboard').json()['own_rating']['average'], 3)

    def test_late_approval_cannot_join_captured_window(self):
        self.get('student/dashboard')
        late = self.profiles[3].user
        late.approved_at = self.now
        late.save()
        # Snapshot membership is preserved even if approval is edited later.
        self.assertEqual(WindowParticipant.objects.count(), 4)
        WindowParticipant.objects.filter(student=self.profiles[3]).delete()
        self.client.force_login(late)
        data = self.get('student/dashboard').json()
        self.assertIsNone(data['allowance'])
        self.assertIn('opening roster', data['voting_notice'])
        self.assertEqual(self.get('student/peers').json()['items'], [])
        self.assertEqual(self.submit().json()['error']['code'], 'VOTER_UNAVAILABLE')

    def test_opening_capture_excludes_accounts_approved_after_opening(self):
        self.profile.user.approved_at = self.now
        self.profile.user.save()
        data = self.get('student/dashboard').json()
        self.assertIsNone(data['allowance'])
        self.assertNotIn(str(self.profile.id), [str(pk) for pk in self.window.roster.values_list('id', flat=True)])

    def test_peer_search_pagination_only_returns_available_window_members(self):
        data = self.get('student/peers', limit=1).json()
        self.assertEqual(len(data['items']), 1)
        next_page = self.get('student/peers', limit=1, cursor=data['next_cursor']).json()
        self.assertNotEqual(data['items'][0]['recipient_id'], next_page['items'][0]['recipient_id'])
        self.assertNotEqual(data['items'][0]['recipient_id'], str(self.profile.id))
        self.assertEqual(self.get('student/peers', query='STUDENT2').json()['items'][0]['recipient_id'], str(self.profiles[2].id))
        for changes in ({'intra_active': False}, {'eligibility_status': 'excluded'}):
            for key, value in changes.items():
                setattr(self.profiles[2], key, value)
            self.profiles[2].save()
            self.assertEqual(self.get('student/peers', query='student2').json()['items'], [])
        for query in ({'limit': 0}, {'cursor': 'bad'}, {'query': 'a'*101}):
            self.assertEqual(self.get('student/peers', **query).status_code, 400)

    def test_label_catalog_and_star_validation(self):
        response = self.get('student/labels', stars=1)
        items = response.json()['items']
        self.assertTrue(any(label['name'] == 'Other' and label['tone'] == 'flag' for label in items))
        self.assertFalse(any(label['name'] == 'Helpful' for label in items))
        label = Label.objects.get(name='Other')
        label.active = False
        label.save()
        self.assertNotIn(str(label.id), [item['id'] for item in self.get('student/labels', stars=1).json()['items']])
        self.assertEqual(self.get('student/labels', stars=4).status_code, 400)

    def test_submission_is_persisted_counted_and_queued_once(self):
        key = str(uuid4())
        response = self.submit(key=key)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['allowance'], {'votes_used': 1, 'votes_remaining': 2})
        self.assertEqual(Rating.objects.get().voter, self.profile)
        self.assertEqual(DetectionJob.objects.count(), 1)
        replay = self.submit(key=key)
        self.assertEqual(replay.status_code, 200)
        self.assertEqual(replay.json()['rating_id'], response.json()['rating_id'])
        self.assertEqual(Rating.objects.count(), 1)
        self.assertEqual(DetectionJob.objects.count(), 1)
        self.assertFalse(BlockedAttempt.objects.exists())
        self.assertEqual(self.submit(key=key, stars=2).json()['error']['code'], 'IDEMPOTENCY_CONFLICT')
        self.client.force_login(self.profiles[1].user)
        self.assertEqual(self.get('student/dashboard').json()['own_rating']['average'], 3)

    def test_idempotent_retry_survives_window_closure_and_invalidation(self):
        key = str(uuid4())
        self.assertEqual(self.submit(key=key).status_code, 201)
        self.invalidate(Rating.objects.get())
        self.window.ends_at = self.now-timedelta(hours=1)
        self.window.save(update_fields=['ends_at'])
        replay = self.submit(key=key)
        self.assertEqual(replay.status_code, 200)
        self.assertEqual(replay.json()['state'], 'invalidated')
        self.assertEqual(replay.json()['allowance']['votes_used'], 1)
        self.assertEqual(self.submit(recipient_id=str(self.profiles[2].id)).json()['error']['code'], 'WINDOW_CLOSED')

    def test_invalidated_votes_still_use_allowance_and_prevent_pair_reuse(self):
        self.window.max_votes = 1
        self.window.min_votes = 0
        self.window.save(update_fields=['max_votes', 'min_votes'])
        self.assertEqual(self.submit().status_code, 201)
        self.invalidate(Rating.objects.get())
        self.assertEqual(self.submit().json()['error']['code'], 'ALREADY_RATED')
        self.assertEqual(self.submit(recipient_id=str(self.profiles[2].id)).json()['error']['code'], 'VOTE_LIMIT_REACHED')
        self.assertEqual(Rating.objects.count(), 1)
        self.assertEqual(BlockedAttempt.objects.count(), 2)
        self.assertEqual(DetectionJob.objects.filter(attempt__isnull=False).count(), 2)

    def test_rejects_self_votes_and_invalid_or_inactive_recipients(self):
        self.assertEqual(self.submit(recipient_id=str(self.profile.id)).json()['error']['code'], 'SELF_VOTE_NOT_ALLOWED')
        self.assertEqual(self.submit(recipient_id=str(uuid4())).status_code, 404)
        self.profiles[1].user.is_active = False
        self.profiles[1].user.save()
        self.assertEqual(self.submit().status_code, 404)
        self.assertFalse(Rating.objects.exists())

    def test_serious_vote_needs_valid_labels_and_explanation(self):
        flag = Label.objects.get(name='Other')
        helpful = Label.objects.get(name='Helpful')
        for fields in ({'stars': 1}, {'stars': 1, 'label_ids': [str(flag.id)]},
                       {'stars': 1, 'label_ids': [str(helpful.id)], 'explanation': 'Context.'},
                       {'stars': 3, 'label_ids': [str(flag.id)]}):
            self.assertEqual(self.submit(**fields).status_code, 422)
        self.assertFalse(Rating.objects.exists())
        response = self.submit(stars=1, label_ids=[str(flag.id)], explanation='Detailed context.')
        self.assertEqual(response.status_code, 201)
        rating = Rating.objects.get()
        self.assertEqual(rating.explanation, 'Detailed context.')
        self.assertEqual(rating.labels.get(), flag)

    def test_request_cannot_forge_identity_or_exceed_limits(self):
        for fields in ({'voter_id': str(self.profiles[2].id)}, {'role': 'staff'}, {'stars': True},
                       {'label_ids': [str(uuid4())]*2}, {'explanation': 'x'*1001}, {'key': 'invalid'}):
            self.assertEqual(self.submit(**fields).status_code, 400)
        self.assertFalse(Rating.objects.exists())
        self.assertFalse(RatingSubmission.objects.exists())

    def test_given_ratings_and_history_never_expose_received_records(self):
        self.assertEqual(self.submit().status_code, 201)
        received = Rating.objects.create(window=self.window, voter=self.profiles[2], recipient=self.profile, stars=2)
        data = self.get('student/ratings/given', window_id=str(self.window.id)).json()
        self.assertEqual(len(data['items']), 1)
        self.assertNotEqual(data['items'][0]['rating_id'], str(received.id))
        self.assertNotIn('voter_id', json.dumps(data))
        self.window.ends_at = self.now-timedelta(hours=1)
        self.window.save(update_fields=['ends_at'])
        received.submitted_at = self.now-timedelta(hours=2)
        received.save()
        history = self.get('student/history').json()['items']
        self.assertEqual(history[0]['average'], 2)
        self.assertNotIn('received', json.dumps(history))

    def test_profile_persists_only_own_valid_preferences(self):
        def save(data):
            return self.client.patch('/api/v1/me/profile', json.dumps(data), content_type='application/json')
        self.assertEqual(save({'accent': '#FF6EC7', 'onboarded': True}).json()['profile'], {'accent': '#FF6EC7', 'onboarded': True})
        self.assertEqual(self.get('me').json()['profile']['accent'], '#FF6EC7')
        for data in ({'accent': '#000000', 'onboarded': True}, {'accent': '#00CED1', 'onboarded': 1},
                     {'accent': '#00CED1', 'onboarded': True, 'role': 'staff'}):
            self.assertEqual(save(data).status_code, 400)
        self.assertEqual(save({'accent': '#00CED1', 'onboarded': False}).json()['profile']['onboarded'], True)
        self.assertFalse(self.profiles[1].onboarded)

    def test_csrf_is_required_for_profile_and_rating_writes(self):
        client = Client(enforce_csrf_checks=True)
        client.force_login(self.profile.user)
        self.assertEqual(client.post('/api/v1/student/ratings', '{}', content_type='application/json').status_code, 403)
        self.assertEqual(client.patch('/api/v1/me/profile', '{}', content_type='application/json').status_code, 403)

    def test_participation_uses_accepted_votes_even_after_invalidation(self):
        self.window.min_votes = 1
        self.window.save(update_fields=['min_votes'])
        self.submit()
        self.invalidate(Rating.objects.get())
        self.window.ends_at = self.now-timedelta(hours=1)
        self.window.save(update_fields=['ends_at'])
        self.assertEqual(self.get('student/participation').json(), {'streak': 1, 'windows_joined': 1,
            'windows_total': 1, 'votes_given_total': 1})
