from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
import uuid

from apps.ratings.models import Student, Rating, VotingWindow


class AbuseCase(models.Model):
    STATUS_OPEN = 'open'
    STATUS_CONFIRMED = 'confirmed'
    STATUS_DISMISSED = 'dismissed'

    STATUS_CHOICES = [
        (STATUS_OPEN, 'Open'),
        (STATUS_CONFIRMED, 'Confirmed Abuse'),
        (STATUS_DISMISSED, 'Dismissed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_OPEN, db_index=True)
    summary = models.CharField(max_length=255)
    detected_at = models.DateTimeField(default=timezone.now, db_index=True)
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_abuse_cases')
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_reason = models.TextField(blank=True, default='')
    deduplication_key = models.CharField(max_length=255, unique=True, db_index=True)

    students = models.ManyToManyField(Student, through='AbuseCaseStudent', related_name='abuse_cases')
    ratings = models.ManyToManyField(Rating, through='AbuseCaseRating', related_name='abuse_cases')

    class Meta:
        ordering = ['-detected_at']

    def __str__(self):
        return f"Case #{str(self.id)[:8]} [{self.status.upper()}]: {self.summary}"


class AbuseCaseFinding(models.Model):
    MECHANISM_BULK_VOTES = 'bulk_votes'
    MECHANISM_REPEATED_VOTES = 'repeated_votes'
    MECHANISM_GROUP_VOTING = 'group_voting'
    MECHANISM_PAIR_REVENGE = 'pair_voting_revenge'
    MECHANISM_FRIENDS_BOOSTING = 'friends_boosting'
    MECHANISM_TOO_FAST = 'too_fast_or_too_often'
    MECHANISM_EXTREME_VOTER = 'extreme_voter'
    MECHANISM_MALICIOUS_SERIOUS = 'malicious_serious_vote'

    MECHANISM_CHOICES = [
        (MECHANISM_BULK_VOTES, 'Bulk votes'),
        (MECHANISM_REPEATED_VOTES, 'Repeated votes'),
        (MECHANISM_GROUP_VOTING, 'Group voting'),
        (MECHANISM_PAIR_REVENGE, 'Pair voting / revenge'),
        (MECHANISM_FRIENDS_BOOSTING, 'Friends boosting'),
        (MECHANISM_TOO_FAST, 'Too fast or too often'),
        (MECHANISM_EXTREME_VOTER, 'Extreme voter'),
        (MECHANISM_MALICIOUS_SERIOUS, 'Malicious serious vote'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    case = models.ForeignKey(AbuseCase, on_delete=models.CASCADE, related_name='findings')
    mechanism = models.CharField(max_length=64, choices=MECHANISM_CHOICES, db_index=True)
    rule_version = models.CharField(max_length=32, default="v1.0")
    observed_from = models.DateTimeField()
    observed_to = models.DateTimeField()
    evidence = models.JSONField(default=dict)
    explanation = models.TextField(help_text="Plain language description for staff")

    def __str__(self):
        return f"{self.get_mechanism_display()} for Case #{str(self.case.id)[:8]}"


class AbuseCaseStudent(models.Model):
    ROLE_TARGET = 'target'
    ROLE_VOTER = 'voter'
    ROLE_PARTICIPANT = 'participant'

    ROLE_CHOICES = [
        (ROLE_TARGET, 'Target / Recipient'),
        (ROLE_VOTER, 'Voter / Instigator'),
        (ROLE_PARTICIPANT, 'Participant'),
    ]

    case = models.ForeignKey(AbuseCase, on_delete=models.CASCADE)
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    role = models.CharField(max_length=32, choices=ROLE_CHOICES, default=ROLE_PARTICIPANT)

    class Meta:
        unique_together = ('case', 'student')

    def __str__(self):
        return f"{self.student.intra_username} ({self.role}) in Case #{str(self.case.id)[:8]}"


class AbuseCaseRating(models.Model):
    case = models.ForeignKey(AbuseCase, on_delete=models.CASCADE)
    rating = models.ForeignKey(Rating, on_delete=models.CASCADE)

    class Meta:
        unique_together = ('case', 'rating')

    def __str__(self):
        return f"Rating {self.rating.id} in Case #{str(self.case.id)[:8]}"


class VoteAttempt(models.Model):
    """
    Records submitted or blocked vote attempts to detect repetition, rate-limiting, and quota abuse.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    voter = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='vote_attempts')
    recipient = models.ForeignKey(Student, on_delete=models.SET_NULL, null=True, blank=True, related_name='received_attempts')
    window = models.ForeignKey(VotingWindow, on_delete=models.SET_NULL, null=True, blank=True)
    attempted_at = models.DateTimeField(default=timezone.now, db_index=True)
    outcome = models.CharField(max_length=32, db_index=True)  # 'accepted', 'blocked_duplicate', 'blocked_quota', 'rate_limited'
    reason_code = models.CharField(max_length=64, blank=True, default='')
    request_reference = models.CharField(max_length=128, blank=True, default='')

    class Meta:
        ordering = ['-attempted_at']
        indexes = [
            models.Index(fields=['voter', 'recipient', 'attempted_at']),
            models.Index(fields=['voter', 'attempted_at']),
        ]

    def __str__(self):
        return f"Attempt by {self.voter.intra_username}: {self.outcome} at {self.attempted_at}"


class Invalidation(models.Model):
    """
    Confirms an abusive vote is negated. Negates the vote from calculations
    without deleting the original vote record.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rating = models.OneToOneField(Rating, on_delete=models.CASCADE, related_name='invalidation')
    case = models.ForeignKey(AbuseCase, on_delete=models.CASCADE, related_name='invalidations')
    invalidated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    reason = models.TextField()
    created_at = models.DateTimeField(default=timezone.now)

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Ensure the rating is marked as invalidated
        if not self.rating.is_invalidated:
            self.rating.is_invalidated = True
            self.rating.save(update_fields=['is_invalidated'])

    def __str__(self):
        return f"Invalidation of Rating {self.rating.id} (Case #{str(self.case.id)[:8]})"


class AntiAbuseSettings(models.Model):
    """
    Centralized, staff-configurable thresholds for all anti-abuse detection rules.
    Singleton pattern: staff can update thresholds dynamically at runtime.
    """
    # Rule 1: Bulk votes
    bulk_votes_window_minutes = models.PositiveIntegerField(default=20)
    bulk_votes_min_voters = models.PositiveIntegerField(default=4)
    bulk_votes_concentration = models.FloatField(default=0.35)
    bulk_votes_rush_voters = models.PositiveIntegerField(default=6)

    # Rule 2: Repeated votes
    repeated_votes_consecutive_windows = models.PositiveIntegerField(default=2)

    # Rule 3: Group voting (Mob attack)
    mob_attack_min_students = models.PositiveIntegerField(default=3)
    mob_attack_window_minutes = models.PositiveIntegerField(default=60)

    # Rule 4: Pair revenge
    pair_revenge_window_hours = models.PositiveIntegerField(default=12)

    # Rule 5: Friends boosting
    boosting_min_group_size = models.PositiveIntegerField(default=3)
    boosting_internal_ratio = models.FloatField(default=0.70)

    # Rule 6: Too fast (bot / script speed)
    fast_voting_min_count = models.PositiveIntegerField(default=4)
    fast_voting_window_seconds = models.PositiveIntegerField(default=10)

    # Rule 7: Extreme voter
    extreme_voter_min_sample = models.PositiveIntegerField(default=4)
    extreme_voter_min_positive_sample = models.PositiveIntegerField(default=10)

    # Rule 8: Malicious serious vote
    suspicious_explanation_min_chars = models.PositiveIntegerField(default=10)

    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(id=1)
        return obj

    def __str__(self):
        return f"AntiAbuseSettings (Updated: {self.updated_at})"
