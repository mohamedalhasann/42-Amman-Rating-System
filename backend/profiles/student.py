"""Authenticated student data and submission. Never exposes received vote records."""
import hashlib
import json
from uuid import UUID

from django.db import transaction
from django.db.models import Avg, Count, Q
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET, require_POST, require_http_methods

from .auth_views import payload
from .models import (BlockedAttempt, DetectionJob, Label, Rating, RatingSubmission,
                     StudentProfile, User, VotingWindow, WindowParticipant)
from .views import account_json, error, protected
from .workspace import capture_rosters, locked_state, stamp, uuid_value

ACCENTS = ('#00CED1', '#5BA4FF', '#FF6EC7', '#24387A', '#EF4444', '#B79CF2')


def prepare_windows():
    state = locked_state()
    if capture_rosters():
        state.version += 1
        state.save(update_fields=['version'])


def current_window(now):
    return VotingWindow.objects.filter(starts_at__lte=now, ends_at__gt=now).first()


def allowance(profile, window):
    used = Rating.objects.filter(voter=profile, window=window).count()
    return {'votes_used': used, 'votes_remaining': max(0, window.max_votes-used)}


def peer_json(profile):
    return {'recipient_id': str(profile.id), 'first_name': profile.user.first_name,
        'last_name': profile.user.last_name, 'intra_username': profile.user.username,
        'picture_url': f'/api/v1/profiles/{profile.id}/photo' if profile.photo else None}


def page_options(request, *, query=False):
    limit = int(request.GET.get('limit', 25))
    cursor = uuid_value(request.GET['cursor']) if request.GET.get('cursor') else None
    if not 1 <= limit <= 100:
        raise ValueError('Use a limit from 1 to 100.')
    term = request.GET.get('query', '').strip()
    if len(term) > 100 or (term and not query):
        raise ValueError('Use a search query up to 100 characters.')
    return limit, cursor, term


def list_page(items, limit, cursor, key):
    if cursor:
        position = next((index for index, item in enumerate(items) if key(item) == str(cursor)), None)
        if position is None:
            raise ValueError('Use a cursor from this collection.')
        items = items[position+1:]
    return JsonResponse({'items': items[:limit], 'next_cursor': key(items[limit-1]) if len(items) > limit else None})


@require_http_methods(['PATCH'])
@protected(student=True)
def save_profile(request):
    try:
        data = payload(request, ['accent', 'onboarded'])
        accent, onboarded = data.get('accent'), data.get('onboarded')
        if accent not in ACCENTS or type(onboarded) is not bool:
            raise ValueError('Choose an available accent and a valid onboarding state.')
    except ValueError as exc:
        return error('INVALID_PROFILE', str(exc), 400)
    with transaction.atomic():
        profile = StudentProfile.objects.select_for_update().get(user=request.user)
        profile.accent = accent
        profile.onboarded = profile.onboarded or onboarded
        profile.save(update_fields=['accent', 'onboarded'])
    return JsonResponse(account_json(request.user))


@require_GET
@protected(student=True)
def dashboard(request):
    with transaction.atomic():
        prepare_windows()
        now = timezone.now()
        profile = request.user.student_profile
        window = current_window(now)
        member = bool(window and WindowParticipant.objects.filter(window=window, student=profile).exists())
        own_average = Rating.objects.filter(recipient=profile, invalidation__isnull=True).aggregate(value=Avg('stars'))['value']
        return JsonResponse({'server_time': stamp(now), 'window': {
            'id': str(window.id), 'name': window.name, 'starts_at': stamp(window.starts_at), 'ends_at': stamp(window.ends_at),
            'state': 'open', 'min_votes': window.min_votes, 'max_votes': window.max_votes} if window else None,
            'own_rating': {'average': round(own_average, 2) if own_average is not None else None, 'scope': 'all_windows'},
            'allowance': allowance(profile, window) if member else None,
            'voting_notice': 'You are not in this window’s opening roster. You can join a future window.' if window and not member else None})


@require_GET
@protected(student=True)
def peers(request):
    try:
        limit, cursor, query = page_options(request, query=True)
    except (ValueError, TypeError) as exc:
        return error('INVALID_FILTER', str(exc), 400)
    with transaction.atomic():
        prepare_windows()
        window = current_window(timezone.now())
        profile = request.user.student_profile
        if not window or not WindowParticipant.objects.filter(window=window, student=profile).exists():
            return JsonResponse({'items': [], 'next_cursor': None})
        rows = StudentProfile.objects.select_related('user').filter(
            windowparticipant__window=window, user__role='student', user__is_active=True,
            user__email_verified_at__isnull=False, user__approved_at__isnull=False,
            eligibility_status='eligible', intra_active=True).exclude(pk=profile.pk).order_by('id')
        if query:
            rows = rows.filter(Q(user__username__icontains=query) | Q(user__first_name__icontains=query) | Q(user__last_name__icontains=query))
        if cursor:
            rows = rows.filter(id__gt=cursor)
        items = list(rows[:limit+1])
        return JsonResponse({'items': [peer_json(p) for p in items[:limit]],
            'next_cursor': str(items[limit-1].id) if len(items) > limit else None})


@require_GET
@protected(student=True)
def labels(request):
    try:
        stars = int(request.GET.get('stars', 0))
        limit, cursor, _ = page_options(request)
        if stars not in (1, 2, 3):
            raise ValueError('Choose 1, 2 or 3 stars.')
    except (ValueError, TypeError) as exc:
        return error('INVALID_FILTER', str(exc), 400)
    # JSON array containment is not portable to local SQLite, so filter the
    # small staff-controlled catalog in Python on both database engines.
    items = [{'id': str(label.id), 'name': label.name,
              'tone': 'positive' if 3 in label.allowed_stars else 'concern' if 2 in label.allowed_stars else 'flag'}
             for label in Label.objects.filter(active=True).order_by('name', 'id') if stars in label.allowed_stars]
    try:
        return list_page(items, limit, cursor, lambda item: item['id'])
    except ValueError as exc:
        return error('INVALID_FILTER', str(exc), 400)


def rating_result(rating, profile):
    return {'rating_id': str(rating.id), 'state': 'invalidated' if hasattr(rating, 'invalidation') else 'counted',
        'submitted_at': stamp(rating.submitted_at), 'allowance': allowance(profile, rating.window)}


def blocked(window, voter, recipient, reason, code):
    attempt = BlockedAttempt.objects.create(window=window, voter=voter, recipient=recipient, reason=reason)
    DetectionJob.objects.create(attempt=attempt)
    return error(code, reason, 409)


@require_POST
@protected(student=True)
def submit_rating(request):
    try:
        data = payload(request, ['window_id', 'recipient_id', 'stars', 'label_ids', 'explanation'])
        window_id, recipient_id = uuid_value(data.get('window_id')), uuid_value(data.get('recipient_id'))
        key = uuid_value(request.headers.get('Idempotency-Key'))
        stars, label_ids, explanation = data.get('stars'), data.get('label_ids'), data.get('explanation', '')
        if type(stars) is not int or stars not in (1, 2, 3):
            raise ValueError('Choose 1, 2 or 3 stars.')
        if not isinstance(label_ids, list) or len(label_ids) > 100:
            raise ValueError('Choose up to 100 distinct labels.')
        label_ids = [uuid_value(pk) for pk in label_ids]
        if len(set(label_ids)) != len(label_ids) or not isinstance(explanation, str) or len(explanation) > 1000:
            raise ValueError('Choose distinct labels and an explanation up to 1000 characters.')
        explanation = explanation.strip()
        normalized = {'window_id': str(window_id), 'recipient_id': str(recipient_id), 'stars': stars,
                      'label_ids': sorted(map(str, label_ids)), 'explanation': explanation}
        digest = hashlib.sha256(json.dumps(normalized, sort_keys=True).encode()).hexdigest()
    except (ValueError, TypeError) as exc:
        return error('INVALID_REQUEST', str(exc), 400)
    with transaction.atomic():
        # Same global configuration lock as staff writes: no concurrent window,
        # label edit or submission can overspend allowance or use stale rules.
        prepare_windows()
        profile = StudentProfile.objects.select_for_update().get(user=request.user)
        user = User.objects.select_for_update().get(pk=request.user.pk)
        if (user.role != 'student' or not user.is_active or not user.email_verified_at or not user.approved_at or
                profile.eligibility_status != 'eligible' or not profile.intra_active):
            return error('ACCESS_DENIED', 'Student access is not enabled.', 403)
        previous = RatingSubmission.objects.select_related('rating__window').filter(student=profile, key=key).first()
        if previous:
            if previous.request_hash != digest:
                return error('IDEMPOTENCY_CONFLICT', 'This submission key was used for a different vote.', 409)
            return JsonResponse(rating_result(previous.rating, profile))
        window = current_window(timezone.now())
        if not window or window.id != window_id:
            return error('WINDOW_CLOSED', 'This voting window is closed.', 409)
        if not WindowParticipant.objects.filter(window=window, student=profile).exists():
            return error('VOTER_UNAVAILABLE', 'Your account is not in this window’s opening roster.', 403)
        recipient = StudentProfile.objects.select_related('user').filter(pk=recipient_id,
            windowparticipant__window=window, user__role='student', user__is_active=True,
            user__email_verified_at__isnull=False, user__approved_at__isnull=False,
            eligibility_status='eligible', intra_active=True).first()
        if not recipient:
            return error('RECIPIENT_UNAVAILABLE', 'This student is not available to rate.', 404)
        if recipient.pk == profile.pk:
            return blocked(window, profile, recipient, 'You cannot rate yourself.', 'SELF_VOTE_NOT_ALLOWED')
        if Rating.objects.filter(window=window, voter=profile, recipient=recipient).exists():
            return blocked(window, profile, recipient, 'You already rated this student in this window.', 'ALREADY_RATED')
        if allowance(profile, window)['votes_remaining'] <= 0:
            return blocked(window, profile, recipient, 'You have used all votes for this window.', 'VOTE_LIMIT_REACHED')
        selected = list(Label.objects.filter(pk__in=label_ids, active=True))
        if len(selected) != len(label_ids) or any(stars not in label.allowed_stars for label in selected):
            return error('INVALID_LABEL_SELECTION', 'Choose labels available at this star level.', 422)
        if stars == 1 and (not selected or not explanation):
            return error('INVALID_LABEL_SELECTION', 'A 1-star vote needs a reason and an explanation.', 422)
        rating = Rating.objects.create(window=window, voter=profile, recipient=recipient, stars=stars, explanation=explanation)
        rating.labels.set(selected)
        RatingSubmission.objects.create(student=profile, key=key, request_hash=digest, rating=rating)
        DetectionJob.objects.create(rating=rating)
        return JsonResponse(rating_result(rating, profile), status=201)


@require_GET
@protected(student=True)
def given(request):
    try:
        window_id = uuid_value(request.GET.get('window_id'))
        limit, cursor, _ = page_options(request)
    except (ValueError, TypeError) as exc:
        return error('INVALID_FILTER', str(exc), 400)
    profile = request.user.student_profile
    rows = Rating.objects.filter(voter=profile, window_id=window_id).select_related('recipient__user', 'invalidation').order_by('id')
    if cursor:
        rows = rows.filter(id__gt=cursor)
    items = list(rows[:limit+1])
    return JsonResponse({'items': [{'rating_id': str(r.id), 'recipient': peer_json(r.recipient), 'stars': r.stars,
        'state': 'invalidated' if hasattr(r, 'invalidation') else 'counted', 'submitted_at': stamp(r.submitted_at)} for r in items[:limit]],
        'next_cursor': str(items[limit-1].id) if len(items) > limit else None})


@require_GET
@protected(student=True)
def history(request):
    try:
        limit, cursor, _ = page_options(request)
    except (ValueError, TypeError) as exc:
        return error('INVALID_FILTER', str(exc), 400)
    with transaction.atomic():
        prepare_windows()
        now, profile = timezone.now(), request.user.student_profile
        windows = VotingWindow.objects.filter(roster=profile, starts_at__lte=now).order_by('ends_at', 'id')
        ratings = list(Rating.objects.filter(recipient=profile, invalidation__isnull=True).order_by('submitted_at').values_list('submitted_at', 'stars'))
        total, count, index, items = 0, 0, 0, []
        for window in windows:
            closed = window.ends_at <= now
            if closed:
                while index < len(ratings) and ratings[index][0] < window.ends_at:
                    total += ratings[index][1]
                    count += 1
                    index += 1
            items.append({'window_id': str(window.id), 'name': window.name,
                'average': round(total/count, 2) if closed and count else None, 'state': 'closed' if closed else 'open'})
        try:
            return list_page(items, limit, cursor, lambda item: item['window_id'])
        except ValueError as exc:
            return error('INVALID_FILTER', str(exc), 400)


@require_GET
@protected(student=True)
def participation(request):
    with transaction.atomic():
        prepare_windows()
        now, profile = timezone.now(), request.user.student_profile
        windows = list(VotingWindow.objects.filter(roster=profile, starts_at__lte=now).order_by('-ends_at', '-id'))
        counts = dict(Rating.objects.filter(voter=profile).values('window_id').annotate(count=Count('id')).values_list('window_id', 'count'))
        streak = 0
        for window in (w for w in windows if w.ends_at <= now):
            used = counts.get(window.id, 0)
            if not used or used < window.min_votes:
                break
            streak += 1
        return JsonResponse({'streak': streak, 'windows_joined': sum(counts.get(w.id, 0) > 0 for w in windows),
            'windows_total': len(windows), 'votes_given_total': sum(counts.values())})
