"""Staff-only workspace API. No fixtures, credentials, or provider IDs in responses."""
import csv
import io
import json
from uuid import UUID

from django.db import transaction
from django.db.models import Q
from django.http import HttpResponse, JsonResponse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.views.decorators.http import require_GET, require_POST

from .accounts import account_settings
from .auth_views import payload
from .models import (AbuseCase, AccountAudit, BlockedAttempt, Invalidation, Label,
                     Rating, StudentProfile, User, VotingWindow, WindowParticipant, WorkspaceState)
from .views import error, profile_json, protected


class Conflict(Exception):
    pass


def locked_state():
    WorkspaceState.objects.get_or_create(pk=1)
    return WorkspaceState.objects.select_for_update().get(pk=1)


def capture_rosters():
    """Caller holds the workspace lock. Existing snapshots are immutable."""
    now = timezone.now()
    captured = 0
    for window in VotingWindow.objects.filter(starts_at__lte=now, roster_captured_at__isnull=True):
        students = StudentProfile.objects.filter(user__role='student', user__is_active=True,
            intra_active=True, eligibility_status='eligible', user__email_verified_at__lte=window.starts_at,
            user__approved_at__lte=window.starts_at)
        WindowParticipant.objects.bulk_create([WindowParticipant(window=window, student=s) for s in students])
        window.roster_captured_at = now
        window.save(update_fields=['roster_captured_at'])
        captured += 1
    return captured


def stamp(value):
    return value.isoformat() if value else None


def snapshot(state):
    # Retain identities referenced by history even after eligibility changes.
    profiles = StudentProfile.objects.select_related('user').filter(
        Q(user__role='student', eligibility_status='eligible', intra_active=True) |
        Q(pk__in=WindowParticipant.objects.values('student_id')) |
        Q(pk__in=Rating.objects.values('voter_id')) | Q(pk__in=Rating.objects.values('recipient_id')) |
        Q(abusecase__isnull=False) | Q(pk__in=BlockedAttempt.objects.values('voter_id')) |
        Q(pk__in=BlockedAttempt.objects.values('recipient_id'))
    ).distinct().order_by('user__username')
    students = [{**profile_json(p), 'active': bool(p.user.is_active and p.user.role == 'student' and
        p.eligibility_status == 'eligible' and p.intra_active),
        'email_verified_at': stamp(p.user.email_verified_at), 'approved_at': stamp(p.user.approved_at)} for p in profiles]
    windows = [{'id': str(w.id), 'name': w.name, 'starts_at': stamp(w.starts_at), 'ends_at': stamp(w.ends_at),
        'min_votes': w.min_votes, 'max_votes': w.max_votes, 'version': w.version,
        'roster_captured_at': stamp(w.roster_captured_at), 'roster': [str(p.id) for p in w.roster.all()]}
        for w in VotingWindow.objects.prefetch_related('roster').order_by('-starts_at')]
    labels = [{'id': str(l.id), 'name': l.name, 'allowed_stars': l.allowed_stars, 'active': l.active,
               'version': l.version} for l in Label.objects.order_by('name')]
    ratings = []
    for r in Rating.objects.select_related('invalidation__by').prefetch_related('labels').order_by('-submitted_at', 'id'):
        invalidation = getattr(r, 'invalidation', None)
        ratings.append({'id': str(r.id), 'window_id': str(r.window_id), 'voter_id': str(r.voter_id),
            'recipient_id': str(r.recipient_id), 'stars': r.stars, 'label_ids': [str(l.id) for l in r.labels.all()],
            'explanation': r.explanation, 'submitted_at': stamp(r.submitted_at), 'invalidation': {
                'case_id': str(invalidation.case_id), 'reason': invalidation.reason,
                'by': invalidation.by.username, 'at': stamp(invalidation.at)} if invalidation else None})
    cases = [{'id': str(c.id), 'window_id': str(c.window_id), 'title': c.title, 'status': c.status,
        'student_ids': [str(p.id) for p in c.students.all()], 'rating_ids': [str(r.id) for r in c.ratings.all()],
        'attempt_ids': [str(a.id) for a in c.attempts.all()], 'detected_at': stamp(c.detected_at),
        'resolved_at': stamp(c.resolved_at),
        'findings': [{'mechanism': f.mechanism, 'explanation': f.explanation} for f in c.findings.all()],
        'review': {'reason': c.review_reason, 'by': c.reviewed_by.username, 'at': stamp(c.resolved_at)} if c.reviewed_by_id else None}
        for c in AbuseCase.objects.select_related('reviewed_by').prefetch_related('students', 'ratings', 'attempts', 'findings').order_by('-detected_at', 'id')]
    attempts = [{'id': str(a.id), 'window_id': str(a.window_id), 'voter_id': str(a.voter_id),
        'recipient_id': str(a.recipient_id), 'reason': a.reason, 'attempted_at': stamp(a.attempted_at), 'is_retry': a.is_retry}
        for a in BlockedAttempt.objects.order_by('attempted_at', 'id')]
    configuration = account_settings()
    # Authentication events by students are not staff activity.
    events = AccountAudit.objects.select_related('actor', 'subject').filter(
        Q(actor__role='staff') | Q(action='Staff provisioned')).order_by('-occurred_at', '-id')
    audit = [{'id': str(e.id), 'action': e.action, 'actor': e.actor.username if e.actor else 'System',
        'target': e.subject.username if e.subject else e.detail.get('target', ''),
        'detail': e.detail.get('summary', json.dumps(e.detail, ensure_ascii=False) if e.detail else ''),
        'at': stamp(e.occurred_at)} for e in events]
    staff = [{'id': str(u.id), 'intra_username': u.username, 'first_name': u.first_name, 'last_name': u.last_name,
              'active': u.is_active and u.is_staff, 'email_verified_at': stamp(u.email_verified_at)}
             for u in User.objects.filter(role='staff').order_by('username')]
    return {'schema': 4, 'version': state.version, 'server_time': stamp(timezone.now()), 'students': students, 'staff': staff,
        'windows': windows, 'labels': labels, 'ratings': ratings, 'cases': cases, 'attempts': attempts, 'audit': audit,
        'settings': {'manual_student_approval_enabled': configuration.manual_student_approval_enabled,
                     'version': configuration.version}}


@require_GET
@protected(staff=True)
def read_workspace(request):
    with transaction.atomic():
        state = locked_state()
        if capture_rosters():
            state.version += 1
            state.save(update_fields=['version'])
        return JsonResponse(snapshot(state))


def uuid_value(value):
    try:
        return UUID(str(value))
    except (ValueError, TypeError, AttributeError):
        raise ValueError('Use a valid record ID.') from None


def text_value(value, label, maximum=150):
    if not isinstance(value, str) or not 1 <= len(value.strip()) <= maximum:
        raise ValueError(f'Enter {label} up to {maximum} characters.')
    return value.strip()


def save_window(value):
    if not isinstance(value, dict):
        raise ValueError('Provide window details.')
    pk = uuid_value(value.get('id'))
    window = VotingWindow.objects.filter(pk=pk).first()
    version = value.get('version')
    if type(version) is not int or version != (window.version if window else 0):
        raise Conflict('This window changed. Reload before saving.')
    name = text_value(value.get('name'), 'a window name')
    try:
        start, end = (parse_datetime(value.get(k, '')) for k in ('starts_at', 'ends_at'))
    except (ValueError, TypeError):
        raise ValueError('Enter valid dates with a timezone.') from None
    if not start or not end or timezone.is_naive(start) or timezone.is_naive(end) or end <= start:
        raise ValueError('The end must be after the start; dates must include a timezone.')
    minimum, maximum = value.get('min_votes'), value.get('max_votes')
    if type(minimum) is not int or type(maximum) is not int or not 0 <= minimum <= maximum <= 10000:
        raise ValueError('Use whole numbers with 0 ≤ minimum ≤ maximum ≤ 10000.')
    if VotingWindow.objects.exclude(pk=pk).filter(starts_at__lt=end, ends_at__gt=start).exists():
        raise ValueError('This overlaps another voting window.')
    created = window is None
    if created:
        window = VotingWindow(id=pk)
    window.name, window.starts_at, window.ends_at = name, start, end
    window.min_votes, window.max_votes = minimum, maximum
    window.version = version + 1
    window.save()
    capture_rosters()
    return 'Window created' if created else 'Window updated', str(pk), name


def save_label(value):
    if not isinstance(value, dict):
        raise ValueError('Provide label details.')
    pk = uuid_value(value.get('id'))
    label = Label.objects.filter(pk=pk).first()
    if type(value.get('version', 0)) is not int or value.get('version', 0) != (label.version if label else 0):
        raise Conflict('This label changed. Reload before saving.')
    name = text_value(value.get('name'), 'a label name')
    stars, active = value.get('allowed_stars'), value.get('active')
    if (not isinstance(stars, list) or not stars or len(stars) > 3 or
            any(type(s) is not int or s not in (1, 2, 3) for s in stars) or len(set(stars)) != len(stars) or type(active) is not bool):
        raise ValueError('Select distinct star levels from 1 to 3 and a valid active status.')
    if Label.objects.exclude(pk=pk).filter(name__iexact=name).exists():
        raise ValueError('A label with this name already exists.')
    if label and name != label.name:
        raise ValueError('Create a replacement label to preserve historical wording.')
    label = label or Label(id=pk, name=name, version=0)
    label.allowed_stars, label.active = sorted(stars), active
    label.version += 1
    label.save()
    return 'Label updated', str(pk), f'{name} · {"active" if active else "inactive"} · {"/".join(map(str, sorted(stars)))}'


def resolve_case(data, actor):
    case = AbuseCase.objects.select_for_update().filter(pk=uuid_value(data.get('id'))).first()
    if not case or case.status != 'open' or case.resolved_at:
        raise Conflict('This case has already been resolved or is unavailable.')
    reason = text_value(data.get('reason'), 'a decision reason', 5000)
    status, ids = data.get('status'), data.get('ids')
    if status not in ('confirmed', 'dismissed') or not isinstance(ids, list) or len(ids) > 10000:
        raise ValueError('Select an outcome and linked ratings.')
    ids = [uuid_value(pk) for pk in ids]
    if len(set(ids)) != len(ids) or (status == 'dismissed' and ids):
        raise ValueError('Dismiss without exclusions, or select distinct abusive ratings.')
    ratings = list(case.ratings.select_for_update(of=('self',)).filter(invalidation__isnull=True))
    valid_ids = {r.id for r in ratings}
    if not set(ids) <= valid_ids or (status == 'confirmed' and valid_ids and not ids):
        raise Conflict('Select counted ratings linked to this case, or dismiss it. Reload if the evidence changed.')
    now = timezone.now()
    Invalidation.objects.bulk_create([Invalidation(rating_id=pk, case=case, reason=reason, by=actor, at=now) for pk in ids])
    case.status, case.review_reason, case.reviewed_by, case.resolved_at = status, reason, actor, now
    case.save(update_fields=['status', 'review_reason', 'reviewed_by', 'resolved_at'])
    return 'Case resolved', str(case.id), f'{status.capitalize()} · {len(ids)} ratings excluded · {reason}', [str(pk) for pk in ids]


@require_POST
@protected(staff=True)
def mutate_workspace(request):
    try:
        data = payload(request, ['type', 'value', 'version', 'id', 'status', 'ids', 'reason'], maximum=1_000_000)
        with transaction.atomic():
            state = locked_state()
            if type(data.get('version')) is not int or data['version'] != state.version:
                raise Conflict('The workspace changed. Reload before saving again.')
            kind = data.get('type')
            detail = {}
            if kind == 'window':
                action, target, summary = save_window(data.get('value'))
            elif kind == 'label':
                action, target, summary = save_label(data.get('value'))
            elif kind == 'resolve-case':
                action, target, summary, rating_ids = resolve_case(data, request.user)
                detail['rating_ids'] = rating_ids
            else:
                raise ValueError('Unsupported staff action.')
            AccountAudit.objects.create(actor=request.user, action=action, detail={**detail, 'target': target, 'summary': summary})
            state.version += 1
            state.save(update_fields=['version'])
            return JsonResponse(snapshot(state))
    except Conflict as exc:
        return error('STATE_CONFLICT', str(exc), 409)
    except ValueError as exc:
        return error('INVALID_REQUEST', str(exc), 400)


def csv_cell(value):
    value = str(value or '')
    return "'" + value if value.lstrip().startswith(('=', '+', '-', '@')) or value.startswith(('\t', '\r', '\n')) else value


@require_POST
@protected(staff=True)
def export_ratings(request):
    try:
        data = payload(request, ['window_id', 'rating_ids'], maximum=1_000_000)
        window_id = uuid_value(data.get('window_id'))
        ids = data.get('rating_ids')
        if not isinstance(ids, list) or not ids or len(ids) > 10000:
            raise ValueError('Choose between 1 and 10000 ratings to export.')
        ids = {uuid_value(pk) for pk in ids}
    except ValueError as exc:
        return error('INVALID_REQUEST', str(exc), 400)
    with transaction.atomic():
        locked_state()
        rows = list(Rating.objects.filter(pk__in=ids, window_id=window_id).select_related(
            'voter__user', 'recipient__user', 'invalidation').prefetch_related('labels').order_by('submitted_at', 'id'))
        if len(rows) != len(ids):
            return error('STATE_CONFLICT', 'Some ratings are unavailable in this window. Reload before exporting.', 409)
        output = io.StringIO(newline='')
        output.write('\ufeff')
        writer = csv.writer(output)
        writer.writerow(['rating_id', 'window_id', 'voter_id', 'voter_name', 'recipient_id', 'recipient_name',
                         'stars', 'labels', 'submitted_at', 'state', 'explanation', 'invalidation_reason'])
        for r in rows:
            invalidation = getattr(r, 'invalidation', None)
            writer.writerow([csv_cell(v) for v in [r.id, r.window_id, r.voter_id, r.voter.user.get_full_name(),
                r.recipient_id, r.recipient.user.get_full_name(), r.stars, '; '.join(l.name for l in r.labels.all()),
                stamp(r.submitted_at), 'invalidated' if invalidation else 'counted', r.explanation,
                invalidation.reason if invalidation else '']])
        AccountAudit.objects.create(actor=request.user, action='Ratings exported', detail={
            'target': str(window_id), 'summary': f'{len(rows)} records', 'rating_ids': [str(r.id) for r in rows]})
        response = HttpResponse(output.getvalue(), content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="fairly-ratings.csv"'
        response['X-Content-Type-Options'] = 'nosniff'
        return response
