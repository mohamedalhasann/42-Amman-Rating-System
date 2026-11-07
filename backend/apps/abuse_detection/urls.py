from django.urls import path
from apps.abuse_detection.views import (
    AbuseCaseListView,
    AbuseCaseDetailView,
    VoteInvalidationView,
    TriggerPeriodicScanView,
    AntiAbuseSettingsView
)

urlpatterns = [
    # Staff Abuse Case Queue
    path('api/v1/staff/abuse-cases', AbuseCaseListView.as_view(), name='abuse_case_list'),
    path('api/v1/staff/abuse-cases/<uuid:case_id>', AbuseCaseDetailView.as_view(), name='abuse_case_detail'),
    path('api/v1/staff/abuse-cases/scan', TriggerPeriodicScanView.as_view(), name='abuse_case_scan'),

    # Staff Vote Invalidation
    path('api/v1/staff/ratings/<uuid:rating_id>/invalidation', VoteInvalidationView.as_view(), name='vote_invalidation'),

    # Staff Centralized Abuse Settings
    path('api/v1/staff/abuse-settings', AntiAbuseSettingsView.as_view(), name='abuse_settings'),
]
