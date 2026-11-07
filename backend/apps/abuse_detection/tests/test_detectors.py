from datetime import timedelta
from django.test import TestCase
from django.utils import timezone
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status

from apps.ratings.models import Student, VotingWindow, Label, LabelStar, Rating, RatingLabel
from apps.abuse_detection.models import (
    AbuseCase,
    AbuseCaseFinding,
    VoteAttempt,
    Invalidation
)
from apps.abuse_detection.services import (
    evaluate_vote_submission,
    run_periodic_scan,
    record_vote_attempt,
    confirm_abuse_case,
    dismiss_abuse_case,
    invalidate_vote
)


class AntiAbuseComprehensiveTestCase(TestCase):
    def setUp(self):
        self.now = timezone.now()

        # Create active voting window
        self.window = VotingWindow.objects.create(
            name="Sprint 1 Voting",
            starts_at=self.now - timedelta(days=1),
            ends_at=self.now + timedelta(days=2),
            min_votes=1,
            max_votes=10
        )

        # Create staff user
        self.staff_user = User.objects.create_user(username="staff_admin", password="password123", is_staff=True)

        # Create students
        self.students = []
        for i in range(15):
            st = Student.objects.create(
                intra_username=f"student_{i}",
                first_name=f"Student{i}",
                last_name="Test"
            )
            self.students.append(st)

        # Labels
        self.label_helpful = Label.objects.create(name="Helpful", active=True)
        LabelStar.objects.create(label=self.label_helpful, stars=3)
        LabelStar.objects.create(label=self.label_helpful, stars=2)

        self.label_aggressive = Label.objects.create(name="Aggressive behavior", active=True)
        LabelStar.objects.create(label=self.label_aggressive, stars=1)

        self.client = APIClient()

    # -------------------------------------------------------------
    # 0. Normal voting baseline (no false positives)
    # -------------------------------------------------------------
    def test_normal_voting_does_not_flag(self):
        """Ordinary, spaced out, varied ratings should not trigger any abuse alerts."""
        s0, s1, s2 = self.students[0], self.students[1], self.students[2]

        r1 = Rating.objects.create(
            window=self.window,
            voter=s0,
            recipient=s1,
            stars=3,
            submitted_at=self.now - timedelta(minutes=45)
        )
        RatingLabel.objects.create(rating=r1, label=self.label_helpful)

        cases1 = evaluate_vote_submission(r1)
        self.assertEqual(len(cases1), 0)
        self.assertEqual(AbuseCase.objects.count(), 0)

    # -------------------------------------------------------------
    # 1. Bulk votes
    # -------------------------------------------------------------
    def test_detector_bulk_votes(self):
        """Many distinct voters rating one student in a short time frame should trigger bulk_votes."""
        target = self.students[0]
        # 4 different voters rate target within 10 minutes
        for i in range(1, 5):
            r = Rating.objects.create(
                window=self.window,
                voter=self.students[i],
                recipient=target,
                stars=2,
                submitted_at=self.now - timedelta(minutes=10 - i)
            )
            evaluate_vote_submission(r)

        case = AbuseCase.objects.filter(findings__mechanism=AbuseCaseFinding.MECHANISM_BULK_VOTES).first()
        self.assertIsNotNone(case)
        self.assertIn(f"Bulk votes received by @{target.intra_username}", case.summary)
        self.assertIn("distinct students", case.findings.first().explanation)
        self.assertEqual(case.students.count(), 5)  # target + 4 voters

    def test_bulk_votes_deadline_rush_protection(self):
        """During deadline rush with high campus activity, 4 votes for one peer does not false-alarm."""
        target = self.students[0]
        rush_window = VotingWindow.objects.create(
            name="Rush Window",
            starts_at=self.now - timedelta(days=2),
            ends_at=self.now + timedelta(minutes=30),
            max_votes=10
        )
        # Campus activity: peers rating other peers
        for i in range(1, 9):
            Rating.objects.create(
                window=rush_window,
                voter=self.students[i],
                recipient=self.students[(i + 1) % 9],
                stars=3,
                submitted_at=self.now - timedelta(minutes=5)
            )
        # Target gets 4 votes in the rush (below rush threshold of 6)
        for i in range(1, 5):
            Rating.objects.create(
                window=rush_window,
                voter=self.students[i],
                recipient=target,
                stars=3,
                submitted_at=self.now - timedelta(minutes=3)
            )

        from apps.abuse_detection.detectors import detect_bulk_votes
        res = detect_bulk_votes(target, window=rush_window, reference_time=self.now)
        # Deadline rush protection successfully avoids false alarm!
        self.assertFalse(res['flagged'])

    # -------------------------------------------------------------
    # 2. Repeated votes
    # -------------------------------------------------------------
    def test_detector_repeated_votes_negative(self):
        """Student persistently submitting identical 1-star ratings across consecutive windows flags."""
        voter = self.students[1]
        recipient = self.students[2]

        # Prior window 1
        window_1 = VotingWindow.objects.create(
            name="Sprint 1",
            starts_at=self.now - timedelta(days=10),
            ends_at=self.now - timedelta(days=7),
            max_votes=10
        )
        r1 = Rating.objects.create(
            window=window_1,
            voter=voter,
            recipient=recipient,
            stars=1,
            explanation="Legitimate project conflict.",
            submitted_at=self.now - timedelta(days=8)
        )

        # Current window 2
        r2 = Rating.objects.create(
            window=self.window,
            voter=voter,
            recipient=recipient,
            stars=1,
            explanation="Another issue in sprint 2.",
            submitted_at=self.now
        )
        evaluate_vote_submission(r2)

        case = AbuseCase.objects.filter(findings__mechanism=AbuseCaseFinding.MECHANISM_REPEATED_VOTES).first()
        self.assertIsNotNone(case)
        self.assertIn("Persistent negative targeting", case.summary)
        self.assertIn("identical 1-star ratings", case.findings.first().explanation)

    def test_detector_repeated_votes_positive(self):
        """Student persistently submitting identical 3-star ratings across consecutive windows flags."""
        voter = self.students[3]
        recipient = self.students[4]

        # Window 1
        window_1 = VotingWindow.objects.create(
            name="Sprint 1",
            starts_at=self.now - timedelta(days=10),
            ends_at=self.now - timedelta(days=7),
            max_votes=10
        )
        Rating.objects.create(
            window=window_1,
            voter=voter,
            recipient=recipient,
            stars=3,
            submitted_at=self.now - timedelta(days=8)
        )

        # Window 2
        r2 = Rating.objects.create(
            window=self.window,
            voter=voter,
            recipient=recipient,
            stars=3,
            submitted_at=self.now
        )
        evaluate_vote_submission(r2)

        case = AbuseCase.objects.filter(findings__mechanism=AbuseCaseFinding.MECHANISM_REPEATED_VOTES, summary__contains="high voting").first()
        self.assertIsNotNone(case)
        self.assertIn("Persistent repeated high voting", case.summary)
        self.assertIn("instead of evaluating different peers", case.findings.first().explanation)

    def test_detector_repeated_votes_fluctuation_exempt(self):
        """Ratings that fluctuate (1 star -> 3 stars) across windows are exempt and not flagged."""
        voter = self.students[5]
        recipient = self.students[6]

        # Window 1: 1 star
        window_1 = VotingWindow.objects.create(
            name="Sprint 1",
            starts_at=self.now - timedelta(days=10),
            ends_at=self.now - timedelta(days=7),
            max_votes=10
        )
        Rating.objects.create(
            window=window_1,
            voter=voter,
            recipient=recipient,
            stars=1,
            explanation="Initial conflict.",
            submitted_at=self.now - timedelta(days=8)
        )

        # Window 2: 3 stars (dynamic improvement)
        r2 = Rating.objects.create(
            window=self.window,
            voter=voter,
            recipient=recipient,
            stars=3,
            submitted_at=self.now
        )
        evaluate_vote_submission(r2)

        case = AbuseCase.objects.filter(
            findings__mechanism=AbuseCaseFinding.MECHANISM_REPEATED_VOTES,
            students=recipient
        ).first()
        self.assertIsNone(case)

    # -------------------------------------------------------------
    # 3. Group voting
    # -------------------------------------------------------------
    def test_detector_group_voting(self):
        """A coordinated group submitting identical low ratings to one peer triggers group_voting."""
        target = self.students[0]
        # 3 students submit identical 1-star ratings close together
        for i in range(1, 4):
            r = Rating.objects.create(
                window=self.window,
                voter=self.students[i],
                recipient=target,
                stars=1,
                explanation="Valid and detailed explanation about teamwork issues.",
                submitted_at=self.now - timedelta(minutes=15)
            )
            RatingLabel.objects.create(rating=r, label=self.label_aggressive)

        # Trigger periodic scan
        run_periodic_scan(self.window)

        case = AbuseCase.objects.filter(findings__mechanism=AbuseCaseFinding.MECHANISM_GROUP_VOTING).first()
        self.assertIsNotNone(case)
        self.assertIn("1-star mob attack", case.summary)
        self.assertIn("A group of 3 students", case.findings.first().explanation)

    # -------------------------------------------------------------
    # 4. Pair voting / revenge
    # -------------------------------------------------------------
    def test_detector_pair_revenge(self):
        """Student A rating Student B with 1 star shortly after B gave A 1 star triggers revenge detection."""
        alice = self.students[1]
        bob = self.students[2]

        # Bob gives Alice 1 star
        r_bob = Rating.objects.create(
            window=self.window,
            voter=bob,
            recipient=alice,
            stars=1,
            explanation="Legitimate issue explanation here for staff review.",
            submitted_at=self.now - timedelta(hours=2)
        )
        RatingLabel.objects.create(rating=r_bob, label=self.label_aggressive)

        # Alice rates Bob back with 1 star 2 hours later
        r_alice = Rating.objects.create(
            window=self.window,
            voter=alice,
            recipient=bob,
            stars=1,
            explanation="Retaliatory complaint with sufficient length.",
            submitted_at=self.now
        )
        RatingLabel.objects.create(rating=r_alice, label=self.label_aggressive)

        evaluate_vote_submission(r_alice)

        case = AbuseCase.objects.filter(findings__mechanism=AbuseCaseFinding.MECHANISM_PAIR_REVENGE).first()
        self.assertIsNotNone(case)
        self.assertIn("Reciprocal 1-star ratings", case.summary)
        self.assertIn("Mutual 1-star exchange in this window", case.findings.first().explanation)
        self.assertTrue(case.findings.first().evidence.get('advisory_only'))
        self.assertEqual(case.ratings.count(), 2)

    # -------------------------------------------------------------
    # 5. Friends boosting
    # -------------------------------------------------------------
    def test_detector_friends_boosting_single_window_exempt(self):
        """Single-window mutual 3-star ratings (e.g. group project) are exempted and do NOT flag."""
        s1, s2, s3 = self.students[1], self.students[2], self.students[3]
        pairs = [(s1, s2), (s2, s1), (s2, s3), (s3, s2), (s1, s3), (s3, s1)]
        for v, r in pairs:
            vote = Rating.objects.create(
                window=self.window,
                voter=v,
                recipient=r,
                stars=3,
                submitted_at=self.now - timedelta(hours=1)
            )
            RatingLabel.objects.create(rating=vote, label=self.label_helpful)

        run_periodic_scan(self.window)

        case = AbuseCase.objects.filter(findings__mechanism=AbuseCaseFinding.MECHANISM_FRIENDS_BOOSTING).first()
        self.assertIsNone(case)

    def test_detector_friends_boosting(self):
        """Cross-window 3-star boosting ring detected even if members expand (e.g. 3 students -> 4 students)."""
        s1, s2, s3, s4 = self.students[1], self.students[2], self.students[3], self.students[4]

        # Prior Window
        prior_window = VotingWindow.objects.create(
            name="Sprint 0 Voting",
            starts_at=self.now - timedelta(days=14),
            ends_at=self.now - timedelta(days=10),
            min_votes=1,
            max_votes=10
        )
        # Ring in prior window among s1, s2, s3
        for v, r in [(s1, s2), (s2, s1), (s2, s3), (s3, s2), (s1, s3), (s3, s1)]:
            vote = Rating.objects.create(
                window=prior_window,
                voter=v,
                recipient=r,
                stars=3,
                submitted_at=self.now - timedelta(days=12)
            )
            RatingLabel.objects.create(rating=vote, label=self.label_helpful)

        # In current window, the ring continues AND adds s4 (4 members now)
        current_pairs = [
            (s1, s2), (s2, s1),
            (s2, s3), (s3, s2),
            (s1, s3), (s3, s1),
            (s1, s4), (s4, s1),
            (s2, s4), (s4, s2),
            (s3, s4), (s4, s3),
        ]
        for v, r in current_pairs:
            vote = Rating.objects.create(
                window=self.window,
                voter=v,
                recipient=r,
                stars=3,
                submitted_at=self.now - timedelta(hours=1)
            )
            RatingLabel.objects.create(rating=vote, label=self.label_helpful)

        run_periodic_scan(self.window)

        case = AbuseCase.objects.filter(findings__mechanism=AbuseCaseFinding.MECHANISM_FRIENDS_BOOSTING).first()
        self.assertIsNotNone(case)
        self.assertIn("Cross-window 3-star boosting ring", case.summary)
        self.assertIn("Persistent 3-star boosting circle detected", case.findings.first().explanation)
        self.assertTrue(case.findings.first().evidence.get('is_expanded'))
        self.assertEqual(len(case.findings.first().evidence.get('core_members')), 3)

    # -------------------------------------------------------------
    # 7. Extreme voter
    # -------------------------------------------------------------
    def test_detector_extreme_voter_negative(self):
        """A voter casting 4 votes all with 1 star triggers serial negative voter."""
        voter = self.students[1]
        for i in range(2, 6):
            r = Rating.objects.create(
                window=self.window,
                voter=voter,
                recipient=self.students[i],
                stars=1,
                explanation="Detailed explanation that satisfies length requirements.",
                submitted_at=self.now - timedelta(minutes=30 * (6 - i))
            )
            RatingLabel.objects.create(rating=r, label=self.label_aggressive)
            evaluate_vote_submission(r)

        case = AbuseCase.objects.filter(findings__mechanism=AbuseCaseFinding.MECHANISM_EXTREME_VOTER).first()
        self.assertIsNotNone(case)
        self.assertIn(f"Serial 1-star negative voter: @{voter.intra_username}", case.summary)
        self.assertIn("Serial negative voting pattern", case.findings.first().explanation)
        self.assertFalse(case.findings.first().evidence.get('advisory_only'))

    def test_detector_extreme_voter_positive_normal_not_flagged(self):
        """A student giving 4 positive 3-star ratings is normal peer appreciation and does NOT flag."""
        voter = self.students[1]
        for i in range(2, 6):
            r = Rating.objects.create(
                window=self.window,
                voter=voter,
                recipient=self.students[i],
                stars=3,
                submitted_at=self.now - timedelta(minutes=30 * (6 - i))
            )
            RatingLabel.objects.create(rating=r, label=self.label_helpful)
            evaluate_vote_submission(r)

        case = AbuseCase.objects.filter(findings__mechanism=AbuseCaseFinding.MECHANISM_EXTREME_VOTER).first()
        self.assertIsNone(case)

    def test_detector_extreme_voter_positive_extreme_flagged(self):
        """A student giving 10 positive 3-star ratings flags as unvaried positive with advisory note."""
        voter = self.students[1]
        for i in range(2, 12):
            r = Rating.objects.create(
                window=self.window,
                voter=voter,
                recipient=self.students[i],
                stars=3,
                submitted_at=self.now - timedelta(minutes=30 * (12 - i))
            )
            RatingLabel.objects.create(rating=r, label=self.label_helpful)
            evaluate_vote_submission(r)

        case = AbuseCase.objects.filter(findings__mechanism=AbuseCaseFinding.MECHANISM_EXTREME_VOTER).first()
        self.assertIsNotNone(case)
        self.assertIn(f"Unvaried 3-star positive voter: @{voter.intra_username}", case.summary)
        self.assertTrue(case.findings.first().evidence.get('advisory_only'))

    # -------------------------------------------------------------
    # 8. Malicious serious vote
    # -------------------------------------------------------------
    def test_detector_malicious_serious(self):
        """Any 1-star vote triggers malicious_serious queue for staff verification and invalidation review."""
        voter = self.students[1]
        target = self.students[2]

        r = Rating.objects.create(
            window=self.window,
            voter=voter,
            recipient=target,
            stars=1,
            explanation="Claimed peer was unhelpful.",
            submitted_at=self.now
        )
        RatingLabel.objects.create(rating=r, label=self.label_aggressive)

        evaluate_vote_submission(r)

        case = AbuseCase.objects.filter(findings__mechanism=AbuseCaseFinding.MECHANISM_MALICIOUS_SERIOUS).first()
        self.assertIsNotNone(case)
        self.assertIn(f"1-star serious report on @{target.intra_username}", case.summary)
        self.assertIn("1-star serious report submitted", case.findings.first().explanation)
        self.assertTrue(case.findings.first().evidence.get('requires_staff_verification'))

    # -------------------------------------------------------------
    # 9. Invalidation & Staff Actions
    # -------------------------------------------------------------
    def test_staff_case_review_and_vote_invalidation(self):
        """Staff confirms case and invalidates vote; vote state becomes invalidated and excludes from average."""
        voter = self.students[1]
        target = self.students[2]

        # Valid vote 1
        Rating.objects.create(window=self.window, voter=self.students[3], recipient=target, stars=3)
        # Abusive vote 2 (1 star)
        r_abusive = Rating.objects.create(
            window=self.window,
            voter=voter,
            recipient=target,
            stars=1,
            explanation="asdf test"
        )
        evaluate_vote_submission(r_abusive)

        case = AbuseCase.objects.get(deduplication_key=f"malicious_1star:{r_abusive.id}")
        self.assertEqual(case.status, AbuseCase.STATUS_OPEN)

        # Confirm case
        confirm_abuse_case(case.id, self.staff_user, "Confirmed invented report.")
        case.refresh_from_db()
        self.assertEqual(case.status, AbuseCase.STATUS_CONFIRMED)

        # Invalidate the abusive vote
        invalidation = invalidate_vote(
            rating_id=r_abusive.id,
            case_id=case.id,
            staff_user=self.staff_user,
            reason="Confirmed bad-faith report"
        )
        self.assertIsNotNone(invalidation)

        r_abusive.refresh_from_db()
        self.assertTrue(r_abusive.is_invalidated)
        self.assertEqual(r_abusive.state, 'invalidated')

        # Check average calculation: only counted (non-invalidated) votes
        from django.db.models import Avg
        valid_avg = Rating.objects.filter(recipient=target, is_invalidated=False).aggregate(Avg('stars'))['stars__avg']
        self.assertEqual(valid_avg, 3.0)  # 1-star vote was invalidated, only 3-star counted!

    # -------------------------------------------------------------
    # 10. REST API Endpoints
    # -------------------------------------------------------------
    def test_api_endpoints(self):
        """Tests GET /staff/abuse-cases, PATCH review, and POST invalidation via REST API."""
        voter = self.students[1]
        target = self.students[2]

        r = Rating.objects.create(
            window=self.window,
            voter=voter,
            recipient=target,
            stars=1,
            explanation="none"
        )
        evaluate_vote_submission(r)
        case = AbuseCase.objects.first()

        # 1. GET /api/v1/staff/abuse-cases
        res_list = self.client.get('/api/v1/staff/abuse-cases?status=open')
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(res_list.data['items']), 1)

        # 2. GET /api/v1/staff/abuse-cases/{id}
        res_detail = self.client.get(f'/api/v1/staff/abuse-cases/{case.id}')
        self.assertEqual(res_detail.status_code, status.HTTP_200_OK)
        self.assertEqual(res_detail.data['id'], str(case.id))

        # 3. PATCH /api/v1/staff/abuse-cases/{id} (Confirm)
        res_patch = self.client.patch(
            f'/api/v1/staff/abuse-cases/{case.id}',
            {"status": "confirmed", "review_reason": "Staff verified abuse."},
            format='json'
        )
        self.assertEqual(res_patch.status_code, status.HTTP_200_OK)
        self.assertEqual(res_patch.data['status'], 'confirmed')

        # 4. POST /api/v1/staff/ratings/{rating_id}/invalidation
        res_inv = self.client.post(
            f'/api/v1/staff/ratings/{r.id}/invalidation',
            {"case_id": str(case.id), "reason": "Confirmed bad-faith report."},
            format='json'
        )
        self.assertEqual(res_inv.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_inv.data['rating']['state'], 'invalidated')

    def test_staff_abuse_settings_api(self):
        """Staff can read and customize anti-abuse thresholds dynamically via REST API."""
        # 1. GET /api/v1/staff/abuse-settings
        res_get = self.client.get('/api/v1/staff/abuse-settings')
        self.assertEqual(res_get.status_code, status.HTTP_200_OK)
        self.assertEqual(res_get.data['mob_attack_min_students'], 3)
        self.assertEqual(res_get.data['repeated_votes_consecutive_windows'], 2)

        # 2. PATCH /api/v1/staff/abuse-settings
        res_patch = self.client.patch(
            '/api/v1/staff/abuse-settings',
            {"mob_attack_min_students": 4, "repeated_votes_consecutive_windows": 3},
            format='json'
        )
        self.assertEqual(res_patch.status_code, status.HTTP_200_OK)
        self.assertEqual(res_patch.data['mob_attack_min_students'], 4)
        self.assertEqual(res_patch.data['repeated_votes_consecutive_windows'], 3)
