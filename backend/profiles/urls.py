from django.urls import path
from . import auth_views, views
from . import student, workspace

urlpatterns = [
    path('student/dashboard', student.dashboard),
    path('student/peers', student.peers),
    path('student/labels', student.labels),
    path('student/ratings', student.submit_rating),
    path('student/ratings/given', student.given),
    path('student/history', student.history),
    path('student/participation', student.participation),
    path('me/profile', student.save_profile),
    path('staff/workspace', workspace.read_workspace),
    path('staff/actions', workspace.mutate_workspace),
    path('staff/ratings/export.csv', workspace.export_ratings),
    path('auth/csrf', auth_views.csrf),
    path('auth/setup-request', auth_views.setup_request),
    path('auth/setup-complete', auth_views.setup_complete),
    path('auth/password-reset-request', auth_views.reset_request),
    path('auth/password-reset-complete', auth_views.reset_complete),
    path('auth/login', auth_views.sign_in),
    path('auth/logout', auth_views.sign_out),
    path('staff/settings', auth_views.approval_settings),
    path('staff/account-approvals', auth_views.pending_accounts),
    path('staff/account-approvals/<uuid:profile_id>/approve', auth_views.approve_account),
    path('me', views.me, name='me'),
    path('staff/students', views.students, name='staff-students'),
    path('profiles/<uuid:profile_id>/photo', views.photo, name='profile-photo'),
]
