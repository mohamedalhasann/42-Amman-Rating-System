from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from profiles import detection
from profiles.models import AbuseCase, BlockedAttempt, Invalidation, Rating, StudentProfile, User, VotingWindow


class DetectionTests(TestCase):
    def setUp(self):
        self.now = timezone.now()
        self.students = []
        for index in range(12):
            user = User.objects.create_user(username=f'learner{index}', first_name='Learner', last_name=str(index))
            self.students.append(StudentProfile.objects.create(user=user, intra_id=index + 1, campus_id=35,
                intra_active=True, eligibility_status='eligible', profile_synced_at=self.now))
        self.window = VotingWindow.objects.create(name='Window 2', starts_at=self.now - timedelta(days=2),
            ends_at=self.now + timedelta(days=3), min_votes=1, max_votes=10)

    def vote(self, voter, recipient, stars, at, window=None):
        return Rating.objects.create(window=window or self.window, voter=self.students[voter],
                                     recipient=self.students[recipient], stars=stars, submitted_at=at)

    def kinds(self):
        return sorted(f.kind for c in AbuseCase.objects.all() for f in c.findings.all())

    def test_fast_needs_speed_and_identical_stars(self):
        start = self.now - timedelta(hours=1)
        for i, recipient in enumerate([1, 2, 3, 4]):
            self.vote(0, recipient, 3, start + timedelta(seconds=20 * i))
        # quick but varied voting is fine
        for i, (recipient, stars) in enumerate([(1, 3), (2, 2), (3, 3), (4, 1)]):
            self.vote(5, recipient, stars, start + timedelta(seconds=20 * i))
        detection.scan_window(self.window)
        fast = [c for c in AbuseCase.objects.all() if c.findings.filter(kind='fast').exists()]
        self.assertEqual(len(fast), 1)
        self.assertEqual(fast[0].roles[str(self.students[0].id)], 'voter')
        self.assertFalse(fast[0].findings.get().advisory)

    def test_refused_attempts_are_context_only(self):
        for i in range(2):
            BlockedAttempt.objects.create(window=self.window, voter=self.students[0], recipient=self.students[0],
                                          reason='Self-vote blocked', attempted_at=self.now - timedelta(minutes=i))
        detection.scan_window(self.window)
        case = AbuseCase.objects.get()
        self.assertTrue(case.findings.get(kind='refused').advisory)
        self.assertEqual(case.attempts.count(), 2)

    def test_group_extreme_and_serious(self):
        start = self.now - timedelta(hours=3)
        for i, voter in enumerate([1, 2, 3]):
            self.vote(voter, 0, 1, start + timedelta(minutes=10 * i))
        for i, recipient in enumerate([4, 5, 6, 7]):
            self.vote(8, recipient, 1, start + timedelta(hours=1, minutes=30 * i))
        detection.scan_window(self.window)
        kinds = self.kinds()
        self.assertIn('group', kinds)
        self.assertIn('extreme', kinds)
        self.assertEqual(kinds.count('serious'), 7)  # every 1-star vote is checked by a person

    def test_rescan_updates_instead_of_duplicating_and_decided_cases_stay(self):
        start = self.now - timedelta(hours=3)
        for i, voter in enumerate([1, 2, 3]):
            self.vote(voter, 0, 1, start + timedelta(minutes=10 * i))
        detection.scan_window(self.window)
        first = AbuseCase.objects.count()
        detection.scan_window(self.window)
        self.assertEqual(AbuseCase.objects.count(), first)
        case = AbuseCase.objects.filter(findings__kind='group').get()
        case.status = 'dismissed'
        case.save()
        detection.scan_window(self.window)
        self.assertEqual(AbuseCase.objects.get(pk=case.pk).status, 'dismissed')

    def test_excluded_votes_do_not_open_new_cases(self):
        start = self.now - timedelta(hours=3)
        rows = [self.vote(voter, 0, 1, start + timedelta(minutes=10 * i)) for i, voter in enumerate([1, 2, 3])]
        staff = User.objects.create_superuser(username='admin', password='River-Signal-29!')
        holder = AbuseCase.objects.create(window=self.window, title='Earlier decision', status='confirmed')
        for r in rows:
            Invalidation.objects.create(rating=r, case=holder, reason='Confirmed earlier.', by=staff, at=self.now)
        detection.scan_window(self.window)
        self.assertEqual(AbuseCase.objects.exclude(pk=holder.pk).count(), 0)

    def test_boosting_needs_two_windows(self):
        earlier = VotingWindow.objects.create(name='Window 1', starts_at=self.now - timedelta(days=9),
            ends_at=self.now - timedelta(days=5), min_votes=1, max_votes=10)
        ring = [9, 10, 11]
        for w in (earlier, self.window):
            for v in ring:
                for r in ring:
                    if v != r:
                        self.vote(v, r, 3, w.starts_at + timedelta(hours=1), window=w)
        detection.scan_window(earlier)
        self.assertNotIn('boosting', self.kinds())
        detection.scan_window(self.window)
        self.assertIn('boosting', self.kinds())
