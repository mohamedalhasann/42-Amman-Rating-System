from functools import wraps
from uuid import UUID

from django.db.models import Q
from django.http import FileResponse, JsonResponse
from django.urls import reverse
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET

from .models import StudentProfile


def error(code, message, status):
    return JsonResponse({'error': {'code': code, 'message': message}}, status=status)


def protected(*, staff=False):
    def decorator(view):
        @wraps(view)
        @never_cache
        def wrapper(request, *args, **kwargs):
            user = request.user
            if not user.is_authenticated:
                return error('UNAUTHENTICATED', 'Sign in to continue.', 401)
            if not user.is_active or not user.email_verified_at or not user.approved_at:
                return error('ACCESS_DENIED', 'Account access is not enabled.', 403)
            if user.role == 'staff' and not user.is_staff:
                return error('ACCESS_DENIED', 'Staff access is not enabled.', 403)
            if user.role == 'student' and not StudentProfile.objects.filter(user=user, eligibility_status='eligible', intra_active=True).exists():
                return error('ACCESS_DENIED', 'An active 42cursus profile is required.', 403)
            if staff and (user.role != 'staff' or not user.is_staff):
                return error('FORBIDDEN', 'Staff access required.', 403)
            return view(request, *args, **kwargs)
        return wrapper
    return decorator


def profile_json(profile):
    return {'id': str(profile.id), 'intra_username': profile.user.username,
            'first_name': profile.user.first_name, 'last_name': profile.user.last_name,
            'photo_url': reverse('profile-photo', args=[profile.id]) if profile.photo else None}


@require_GET
@protected()
def me(request):
    user = request.user
    profile = StudentProfile.objects.select_related('user').filter(user=user).first()
    identity = profile_json(profile) if profile else {'id': str(user.id), 'intra_username': user.username,
        'first_name': user.first_name, 'last_name': user.last_name, 'photo_url': None}
    return JsonResponse({**identity, 'role': user.role})


@require_GET
@protected(staff=True)
def students(request):
    try:
        limit = int(request.GET.get('limit', 25))
        if not 1 <= limit <= 100:
            raise ValueError
        cursor = UUID(request.GET['cursor']) if request.GET.get('cursor') else None
        query = request.GET.get('query', '').strip()
        if len(query) > 100:
            raise ValueError
    except (ValueError, TypeError):
        return error('INVALID_FILTER', 'Use a valid cursor, query up to 100 characters, and limit from 1 to 100.', 400)
    rows = StudentProfile.objects.select_related('user').filter(user__role='student', eligibility_status='eligible', intra_active=True).order_by('id')
    if query:
        rows = rows.filter(Q(user__username__icontains=query) | Q(user__first_name__icontains=query) | Q(user__last_name__icontains=query))
    if cursor:
        rows = rows.filter(id__gt=cursor)
    items = list(rows[:limit+1])
    return JsonResponse({'items': [profile_json(p) for p in items[:limit]],
                         'next_cursor': str(items[limit-1].id) if len(items) > limit else None})


@require_GET
@protected()
def photo(request, profile_id):
    rows = StudentProfile.objects.select_related('user').filter(user__role='student', eligibility_status='eligible', intra_active=True)
    if request.user.role != 'staff' or not request.user.is_staff:
        # Students may see display photos of approved peers, never pending profiles.
        rows = rows.filter(user__is_active=True, user__email_verified_at__isnull=False, user__approved_at__isnull=False)
    profile = rows.filter(pk=profile_id).first()
    if not profile or not profile.photo:
        return error('NOT_FOUND', 'Photo unavailable.', 404)
    try:
        stream = profile.photo.open('rb')
    except FileNotFoundError:
        return error('NOT_FOUND', 'Photo unavailable.', 404)
    response = FileResponse(stream, content_type='image/jpeg')
    response['Content-Disposition'] = 'inline; filename="profile.jpg"'
    response['X-Content-Type-Options'] = 'nosniff'
    return response
