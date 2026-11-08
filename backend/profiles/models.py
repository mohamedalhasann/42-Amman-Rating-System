import uuid

from django.conf import settings
from django.contrib.auth.models import AbstractUser, UserManager
from django.core.files.storage import FileSystemStorage
from django.db import models
from django.db.models.functions import Lower
from django.utils import timezone


class AccountManager(UserManager):
    def create_superuser(self, username, email=None, password=None, **extra_fields):
        extra_fields.update(role='staff', email_verified_at=timezone.now(), approved_at=timezone.now())
        return super().create_superuser(username, email, password, **extra_fields)


class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role = models.CharField(max_length=7, choices=[('student', 'Student'), ('staff', 'Staff')], default='student')
    email_verified_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL)
    objects = AccountManager()

    class Meta:
        constraints = [models.UniqueConstraint(Lower('username'), name='account_username_case_unique')]


def private_storage():
    return FileSystemStorage(location=settings.PRIVATE_MEDIA_ROOT)


class StudentProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='student_profile')
    intra_id = models.PositiveBigIntegerField(unique=True)
    campus_id = models.PositiveIntegerField()
    intra_active = models.BooleanField(null=True, blank=True)
    eligibility_status = models.CharField(max_length=10, choices=[('unchecked', 'Not checked'), ('eligible', 'Eligible'), ('excluded', 'Excluded')], default='unchecked')
    eligibility_policy = models.CharField(max_length=40, blank=True)
    eligibility_checked_at = models.DateTimeField(null=True, blank=True)
    photo = models.FileField(storage=private_storage, blank=True, max_length=250)
    profile_synced_at = models.DateTimeField()
    photo_synced_at = models.DateTimeField(null=True, blank=True)
    accent = models.CharField(max_length=7, default='#00CED1')
    onboarded = models.BooleanField(default=False)

    def __str__(self):
        return self.user.username


class ImportRun(models.Model):
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True)
    campus_id = models.PositiveIntegerField()
    status = models.CharField(max_length=12, default='running')
    created = models.PositiveIntegerField(default=0)
    updated = models.PositiveIntegerField(default=0)
    skipped = models.PositiveIntegerField(default=0)
    failed = models.PositiveIntegerField(default=0)


class AccountSettings(models.Model):
    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    manual_student_approval_enabled = models.BooleanField(default=True)
    version = models.PositiveIntegerField(default=1)

    class Meta:
        constraints = [models.CheckConstraint(condition=models.Q(id=1), name='one_account_settings_row')]


class SetupToken(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    token_hash = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)


class PasswordResetToken(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    token_hash = models.CharField(max_length=64, unique=True)
    credential_hash = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)


class AuthThrottle(models.Model):
    key = models.CharField(max_length=64, primary_key=True)
    count = models.PositiveIntegerField(default=0)
    expires_at = models.DateTimeField()


class AccountAudit(models.Model):
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name='+')
    subject = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name='+')
    action = models.CharField(max_length=50)
    occurred_at = models.DateTimeField(auto_now_add=True)
    detail = models.JSONField(default=dict)


class WorkspaceState(models.Model):
    """Serialize staff configuration writes, including non-overlap checks."""
    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    version = models.PositiveIntegerField(default=1)

    class Meta:
        constraints = [models.CheckConstraint(condition=models.Q(id=1), name='one_workspace_state_row')]


class VotingWindow(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    min_votes = models.PositiveIntegerField(default=0)
    max_votes = models.PositiveIntegerField(default=8)
    version = models.PositiveIntegerField(default=1)
    roster_captured_at = models.DateTimeField(null=True)
    roster = models.ManyToManyField(StudentProfile, through='WindowParticipant')

    class Meta:
        constraints = [
            models.CheckConstraint(condition=models.Q(ends_at__gt=models.F('starts_at')), name='window_dates_ordered'),
            models.CheckConstraint(condition=models.Q(max_votes__gte=models.F('min_votes')), name='window_vote_limits_ordered'),
        ]


class WindowParticipant(models.Model):
    window = models.ForeignKey(VotingWindow, on_delete=models.PROTECT)
    student = models.ForeignKey(StudentProfile, on_delete=models.PROTECT)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['window', 'student'], name='unique_window_participant')]


class Label(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    allowed_stars = models.JSONField(default=list)
    active = models.BooleanField(default=True)
    version = models.PositiveIntegerField(default=1)

    class Meta:
        constraints = [models.UniqueConstraint(Lower('name'), name='label_name_case_unique')]


class Rating(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    window = models.ForeignKey(VotingWindow, on_delete=models.PROTECT)
    voter = models.ForeignKey(StudentProfile, on_delete=models.PROTECT, related_name='ratings_given')
    recipient = models.ForeignKey(StudentProfile, on_delete=models.PROTECT, related_name='ratings_received')
    stars = models.PositiveSmallIntegerField()
    labels = models.ManyToManyField(Label)
    explanation = models.TextField(blank=True)
    submitted_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=models.Q(stars__in=[1, 2, 3]), name='rating_stars_valid'),
            models.CheckConstraint(condition=~models.Q(voter=models.F('recipient')), name='rating_not_self'),
            models.UniqueConstraint(fields=['window', 'voter', 'recipient'], name='one_rating_per_pair_per_window'),
        ]


class BlockedAttempt(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    window = models.ForeignKey(VotingWindow, on_delete=models.PROTECT)
    voter = models.ForeignKey(StudentProfile, on_delete=models.PROTECT, related_name='+')
    recipient = models.ForeignKey(StudentProfile, on_delete=models.PROTECT, related_name='+')
    reason = models.TextField()
    attempted_at = models.DateTimeField(default=timezone.now)
    is_retry = models.BooleanField(default=False)


class AbuseCase(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    window = models.ForeignKey(VotingWindow, on_delete=models.PROTECT)
    title = models.CharField(max_length=200)
    status = models.CharField(max_length=10, choices=[('open', 'Open'), ('confirmed', 'Confirmed'), ('dismissed', 'Dismissed')], default='open')
    students = models.ManyToManyField(StudentProfile)
    ratings = models.ManyToManyField(Rating)
    attempts = models.ManyToManyField(BlockedAttempt)
    detected_at = models.DateTimeField(default=timezone.now)
    resolved_at = models.DateTimeField(null=True)
    reviewed_by = models.ForeignKey(User, null=True, on_delete=models.PROTECT)
    review_reason = models.TextField(blank=True)
    # set by automatic detection: one case per pattern instance, so rescans update instead of duplicating
    dedup_key = models.CharField(max_length=255, unique=True, null=True, blank=True)
    # student id -> 'target' | 'voter' | 'participant', as recorded by the detector
    roles = models.JSONField(default=dict, blank=True)


class CaseFinding(models.Model):
    case = models.ForeignKey(AbuseCase, related_name='findings', on_delete=models.PROTECT)
    mechanism = models.CharField(max_length=150)
    explanation = models.TextField()
    # detector output: a stable pattern code, the numbers behind it and the span it looked at
    kind = models.CharField(max_length=40, blank=True)
    evidence = models.JSONField(default=dict, blank=True)
    observed_from = models.DateTimeField(null=True, blank=True)
    observed_to = models.DateTimeField(null=True, blank=True)
    # context for staff rather than an accusation (revenge pairs, only-3-star voters)
    advisory = models.BooleanField(default=False)


class Invalidation(models.Model):
    rating = models.OneToOneField(Rating, related_name='invalidation', on_delete=models.PROTECT)
    case = models.ForeignKey(AbuseCase, on_delete=models.PROTECT)
    reason = models.TextField()
    by = models.ForeignKey(User, on_delete=models.PROTECT)
    at = models.DateTimeField(default=timezone.now)


class RatingSubmission(models.Model):
    student = models.ForeignKey(StudentProfile, on_delete=models.PROTECT)
    key = models.UUIDField()
    request_hash = models.CharField(max_length=64)
    rating = models.OneToOneField(Rating, on_delete=models.PROTECT)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['student', 'key'], name='student_submission_key_unique')]


class DetectionJob(models.Model):
    """Durable handoff; detector thresholds remain an owner decision."""
    rating = models.OneToOneField(Rating, null=True, on_delete=models.PROTECT)
    attempt = models.OneToOneField(BlockedAttempt, null=True, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=10, default='pending')

    class Meta:
        constraints = [models.CheckConstraint(condition=(
            models.Q(rating__isnull=False, attempt__isnull=True) |
            models.Q(rating__isnull=True, attempt__isnull=False)), name='detection_job_one_source')]
