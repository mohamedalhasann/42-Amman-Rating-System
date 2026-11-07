from rest_framework import serializers
from apps.ratings.models import Student, Rating
from apps.abuse_detection.models import (
    AbuseCase,
    AbuseCaseFinding,
    AbuseCaseStudent,
    AbuseCaseRating,
    Invalidation,
    AntiAbuseSettings
)


class StudentMinimalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Student
        fields = ['id', 'intra_username', 'first_name', 'last_name']


class AbuseCaseFindingSerializer(serializers.ModelSerializer):
    mechanism_display = serializers.CharField(source='get_mechanism_display', read_only=True)

    class Meta:
        model = AbuseCaseFinding
        fields = [
            'id',
            'mechanism',
            'mechanism_display',
            'rule_version',
            'observed_from',
            'observed_to',
            'evidence',
            'explanation'
        ]


class AbuseCaseStudentSerializer(serializers.ModelSerializer):
    student = StudentMinimalSerializer(read_only=True)

    class Meta:
        model = AbuseCaseStudent
        fields = ['student', 'role']


class RatingEvidenceSerializer(serializers.ModelSerializer):
    voter = StudentMinimalSerializer(read_only=True)
    recipient = StudentMinimalSerializer(read_only=True)

    class Meta:
        model = Rating
        fields = [
            'id',
            'voter',
            'recipient',
            'stars',
            'explanation',
            'submitted_at',
            'is_invalidated',
            'state'
        ]


class AbuseCaseListSerializer(serializers.ModelSerializer):
    findings_count = serializers.IntegerField(source='findings.count', read_only=True)
    students = StudentMinimalSerializer(many=True, read_only=True)

    class Meta:
        model = AbuseCase
        fields = [
            'id',
            'status',
            'summary',
            'detected_at',
            'reviewed_at',
            'findings_count',
            'students'
        ]


class AbuseCaseDetailSerializer(serializers.ModelSerializer):
    findings = AbuseCaseFindingSerializer(many=True, read_only=True)
    involved_students = AbuseCaseStudentSerializer(source='abusecasestudent_set', many=True, read_only=True)
    evidence_ratings = RatingEvidenceSerializer(source='ratings', many=True, read_only=True)
    reviewed_by_username = serializers.CharField(source='reviewed_by.username', read_only=True, default=None)

    class Meta:
        model = AbuseCase
        fields = [
            'id',
            'status',
            'summary',
            'detected_at',
            'reviewed_by_username',
            'reviewed_at',
            'review_reason',
            'findings',
            'involved_students',
            'evidence_ratings'
        ]


class InvalidationRequestSerializer(serializers.Serializer):
    case_id = serializers.UUIDField()
    reason = serializers.CharField(min_length=3, max_length=500)


class InvalidationResponseSerializer(serializers.ModelSerializer):
    rating = RatingEvidenceSerializer(read_only=True)
    invalidated_by_username = serializers.CharField(source='invalidated_by.username', read_only=True, default=None)

    class Meta:
        model = Invalidation
        fields = [
            'id',
            'rating',
            'case_id',
            'invalidated_by_username',
            'reason',
            'created_at'
        ]


class AntiAbuseSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = AntiAbuseSettings
        fields = [
            'bulk_votes_window_minutes',
            'bulk_votes_min_voters',
            'bulk_votes_concentration',
            'bulk_votes_rush_voters',
            'repeated_votes_consecutive_windows',
            'mob_attack_min_students',
            'mob_attack_window_minutes',
            'pair_revenge_window_hours',
            'boosting_min_group_size',
            'boosting_internal_ratio',
            'fast_voting_min_count',
            'fast_voting_window_seconds',
            'extreme_voter_min_sample',
            'extreme_voter_min_positive_sample',
            'suspicious_explanation_min_chars',
            'updated_at'
        ]
        read_only_fields = ['updated_at']
