from django.db import models
from django.contrib.auth.models import AbstractUser, User
from django.utils import timezone
import uuid


class Student(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='student_profile', null=True, blank=True)
    intra_username = models.CharField(max_length=64, unique=True, db_index=True)
    first_name = models.CharField(max_length=128)
    last_name = models.CharField(max_length=128)
    picture_storage_key = models.CharField(max_length=255, null=True, blank=True)
    campus = models.CharField(max_length=64, default="42 Amman")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name} (@{self.intra_username})"


class VotingWindow(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=128)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    min_votes = models.PositiveIntegerField(default=0)
    max_votes = models.PositiveIntegerField(default=10)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def is_open(self):
        now = timezone.now()
        return self.starts_at <= now < self.ends_at

    def __str__(self):
        return f"{self.name} ({self.starts_at.date()} to {self.ends_at.date()})"


class Label(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=128, unique=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class LabelStar(models.Model):
    label = models.ForeignKey(Label, on_delete=models.CASCADE, related_name='allowed_stars')
    stars = models.PositiveSmallIntegerField(choices=[(1, '1 Star'), (2, '2 Stars'), (3, '3 Stars')])

    class Meta:
        unique_together = ('label', 'stars')

    def __str__(self):
        return f"{self.label.name} ({self.stars} stars)"


class Rating(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    window = models.ForeignKey(VotingWindow, on_delete=models.CASCADE, related_name='ratings')
    voter = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='ratings_given')
    recipient = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='ratings_received')
    stars = models.PositiveSmallIntegerField(choices=[(1, '1 Star'), (2, '2 Stars'), (3, '3 Stars')])
    explanation = models.TextField(blank=True, default='')
    submitted_at = models.DateTimeField(default=timezone.now, db_index=True)
    idempotency_key = models.CharField(max_length=128, blank=True, null=True)
    is_invalidated = models.BooleanField(default=False, db_index=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['window', 'voter', 'recipient'],
                name='unique_vote_per_pair_per_window'
            )
        ]
        indexes = [
            models.Index(fields=['recipient', 'is_invalidated']),
            models.Index(fields=['voter', 'submitted_at']),
            models.Index(fields=['recipient', 'submitted_at']),
        ]

    @property
    def state(self):
        return 'invalidated' if self.is_invalidated else 'counted'

    def __str__(self):
        return f"{self.voter.intra_username} -> {self.recipient.intra_username}: {self.stars}* ({self.state})"


class RatingLabel(models.Model):
    rating = models.ForeignKey(Rating, on_delete=models.CASCADE, related_name='labels')
    label = models.ForeignKey(Label, on_delete=models.CASCADE, related_name='rating_instances')

    class Meta:
        unique_together = ('rating', 'label')

    def __str__(self):
        return f"{self.rating.id} - {self.label.name}"
