from django.urls import path
from . import auth_views, views
from . import workspace

urlpatterns = [
    path('staff/workspace', workspace.read_workspace),
    path('staff/actions', workspace.mutate_workspace),
    path('staff/ratings/export.csv', workspace.export_ratings),
    path('auth/csrf', auth_views.csrf),
    path('auth/setup-request', auth_views.setup_request),
    path('auth/setup-complete', auth_views.setup_complete),
    path('auth/login', auth_views.sign_in),
    path('auth/logout', auth_views.sign_out),
    path('staff/settings', auth_views.approval_settings),
    path('staff/account-approvals', auth_views.pending_accounts),
    path('staff/account-approvals/<uuid:profile_id>/approve', auth_views.approve_account),
    path('me', views.me, name='me'),
    path('staff/students', views.students, name='staff-students'),
    path('profiles/<uuid:profile_id>/photo', views.photo, name='profile-photo'),
]
