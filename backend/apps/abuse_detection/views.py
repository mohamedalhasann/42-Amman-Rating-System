from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.shortcuts import get_object_or_404
from django.utils import timezone

from apps.ratings.models import Rating, VotingWindow
from apps.abuse_detection.models import AbuseCase, AntiAbuseSettings
from apps.abuse_detection.serializers import (
    AbuseCaseListSerializer,
    AbuseCaseDetailSerializer,
    InvalidationRequestSerializer,
    InvalidationResponseSerializer,
    AntiAbuseSettingsSerializer
)
from apps.abuse_detection.services import (
    confirm_abuse_case,
    dismiss_abuse_case,
    invalidate_vote,
    run_periodic_scan
)


class AbuseCaseListView(APIView):
    """
    GET /api/v1/staff/abuse-cases?status=open
    Unified staff queue displaying suspicious voting cases across all mechanisms.
    """
    def get(self, request):
        status_filter = request.query_params.get('status')
        queryset = AbuseCase.objects.prefetch_related('students', 'findings').all()

        if status_filter:
            queryset = queryset.filter(status=status_filter)

        serializer = AbuseCaseListSerializer(queryset, many=True)
        return Response({"items": serializer.data, "count": queryset.count()}, status=status.HTTP_200_OK)


class AbuseCaseDetailView(APIView):
    """
    GET /api/v1/staff/abuse-cases/{id}
    Inspect a specific abuse case with findings, plain language explanations, and linked ratings.

    PATCH /api/v1/staff/abuse-cases/{id}
    Update review status: 'confirmed' or 'dismissed'.
    """
    def get(self, request, case_id):
        case = get_object_or_404(
            AbuseCase.objects.prefetch_related('findings', 'abusecasestudent_set__student', 'ratings'),
            id=case_id
        )
        serializer = AbuseCaseDetailSerializer(case)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, case_id):
        case = get_object_or_404(AbuseCase, id=case_id)
        new_status = request.data.get('status')
        reason = request.data.get('review_reason', '')
        staff_user = request.user if request.user.is_authenticated else None

        if new_status == AbuseCase.STATUS_CONFIRMED:
            case = confirm_abuse_case(case.id, staff_user, reason)
        elif new_status == AbuseCase.STATUS_DISMISSED:
            case = dismiss_abuse_case(case.id, staff_user, reason)
        else:
            return Response(
                {"error": {"code": "INVALID_STATUS", "message": "Status must be 'confirmed' or 'dismissed'."}},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = AbuseCaseDetailSerializer(case)
        return Response(serializer.data, status=status.HTTP_200_OK)


class VoteInvalidationView(APIView):
    """
    POST /api/v1/staff/ratings/{rating_id}/invalidation
    Staff action to invalidate (negate) a confirmed abusive rating.
    """
    def post(self, request, rating_id):
        serializer = InvalidationRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"error": {"code": "VALIDATION_ERROR", "details": serializer.errors}}, status=status.HTTP_400_BAD_REQUEST)

        case_id = serializer.validated_data['case_id']
        reason = serializer.validated_data['reason']
        staff_user = request.user if request.user.is_authenticated else None

        # Verify rating and case existence
        rating = get_object_or_404(Rating, id=rating_id)
        get_object_or_404(AbuseCase, id=case_id)

        invalidation = invalidate_vote(
            rating_id=rating.id,
            case_id=case_id,
            staff_user=staff_user,
            reason=reason
        )

        return Response(InvalidationResponseSerializer(invalidation).data, status=status.HTTP_201_CREATED)


class TriggerPeriodicScanView(APIView):
    """
    POST /api/v1/staff/abuse-cases/scan
    Triggers an immediate scan across active voting windows for multi-student group patterns.
    """
    def post(self, request):
        window_id = request.data.get('window_id')
        if window_id:
            windows = VotingWindow.objects.filter(id=window_id)
        else:
            now = timezone.now()
            windows = VotingWindow.objects.filter(starts_at__lte=now, ends_at__gte=now)

        total_flagged = 0
        for w in windows:
            cases = run_periodic_scan(w)
            total_flagged += len(cases)

        return Response({
            "message": "Scan completed.",
            "windows_scanned": windows.count(),
            "cases_flagged": total_flagged
        }, status=status.HTTP_200_OK)


class AntiAbuseSettingsView(APIView):
    """
    GET /api/v1/staff/abuse-settings
    Reads the centralized live threshold settings.

    PATCH /api/v1/staff/abuse-settings
    Updates one or more anti-abuse thresholds at runtime.
    """
    def get(self, request):
        settings_obj = AntiAbuseSettings.get_solo()
        serializer = AntiAbuseSettingsSerializer(settings_obj)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request):
        settings_obj = AntiAbuseSettings.get_solo()
        serializer = AntiAbuseSettingsSerializer(settings_obj, data=request.data, partial=True)
        if serializer.is_valid():
            staff_user = request.user if request.user.is_authenticated else None
            serializer.save(updated_by=staff_user)
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
