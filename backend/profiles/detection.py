"""Automatic abuse detection for the staff review queue.

Ported from the anti-abuse workstream (feature/anti-abuse-system, backend/apps/abuse_detection):
same patterns, thresholds and intent, adapted to this app's models. Detection never blocks a
student and never changes a rating; it only opens cases for staff to read and decide.

Each detector returns a Finding or None. record() turns findings into AbuseCase rows, keyed so a
rescan updates the case it already opened instead of creating another.
"""
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta

import logging

from django.db import transaction
from django.utils import timezone

from .models import AbuseCase, CaseFinding, DetectionJob, Rating, VotingWindow

# Thresholds from the anti-abuse workstream (thresholds.py there).
BULK_WINDOW_MINUTES = 20
BULK_NORMAL_MIN_VOTERS, BULK_NORMAL_CONCENTRATION = 4, 0.35
BULK_RUSH_MIN_VOTERS, BULK_RUSH_CONCENTRATION, BULK_RUSH_HOURS = 6, 0.25, 2
REPEATED_CONSECUTIVE_WINDOWS = 2
GROUP_MIN_STUDENTS, GROUP_WINDOW_MINUTES = 3, 60
BOOSTING_MIN_GROUP = 3
# "Too fast or too often" has no detector there on purpose: it is enforced when the vote is
# submitted (the window's vote limit and request throttling), so those attempts never become votes.
EXTREME_MIN_NEGATIVE, EXTREME_MIN_POSITIVE = 4, 10

# Plain names staff see; the code in `kind` lets the UI group and present each pattern.
NAMES = {
    'bulk': 'Bulk votes', 'repeated': 'Repeated votes', 'group': 'Group voting', 'revenge': 'Pair voting',
    'boosting': 'Friends boosting', 'extreme': 'Extreme voter',
    'serious': 'Serious vote check',
}


@dataclass
class Finding:
    kind: str
    window: VotingWindow
    title: str
    explanation: str
    key: str
    observed_from: datetime
    observed_to: datetime
    evidence: dict = field(default_factory=dict)
    roles: dict = field(default_factory=dict)  # StudentProfile -> role
    ratings: list = field(default_factory=list)
    attempts: list = field(default_factory=list)
    advisory: bool = False


def name(profile):
    full = f'{profile.user.first_name} {profile.user.last_name}'.strip()
    return full or profile.user.username


def names(profiles):
    listed = sorted(name(p) for p in profiles)
    return listed[0] if len(listed) == 1 else ', '.join(listed[:-1]) + ' and ' + listed[-1]


def plural(n, word):
    return f'{n} {word}' + ('' if n == 1 else 's')


def _ratings():
    # only votes that still count: staff-invalidated votes were already decided
    return (Rating.objects.filter(invalidation__isnull=True)
            .select_related('voter__user', 'recipient__user', 'window').prefetch_related('labels'))


# ---------- 1. bulk votes ----------
def detect_bulk(recipient, window, at):
    """Many votes on one student in a short time, judged against the rest of the campus."""
    start = at - timedelta(minutes=BULK_WINDOW_MINUTES)
    rows = list(_ratings().filter(recipient=recipient, window=window, submitted_at__gte=start, submitted_at__lte=at))
    voters = {r.voter for r in rows}
    if len(voters) < 3:
        return None
    campus = Rating.objects.filter(window=window, submitted_at__gte=start, submitted_at__lte=at).count()
    share = len(rows) / campus if campus else 1.0
    left = (window.ends_at - at).total_seconds()
    rush = 0 < left <= BULK_RUSH_HOURS * 3600
    if rush:
        hit = (len(voters) >= BULK_RUSH_MIN_VOTERS and share >= BULK_RUSH_CONCENTRATION) or len(voters) >= 8
    else:
        hit = (len(voters) >= BULK_NORMAL_MIN_VOTERS and share >= BULK_NORMAL_CONCENTRATION) or len(voters) >= 6
    if not hit:
        return None
    context = f' This was in the last {int(left // 60)} minutes before the window closed.' if rush else ''
    return Finding(
        'bulk', window, f'{plural(len(voters), "student")} rated {name(recipient)} within {BULK_WINDOW_MINUTES} minutes',
        f'{name(recipient)} received {plural(len(rows), "rating")} from {plural(len(voters), "different student")} '
        f'within {BULK_WINDOW_MINUTES} minutes, {share:.0%} of all votes on campus in that period.{context}',
        f'bulk:{recipient.id}:{window.id}:{start:%Y%m%d%H}', min(r.submitted_at for r in rows), max(r.submitted_at for r in rows),
        {'ratings': len(rows), 'voters': len(voters), 'minutes': BULK_WINDOW_MINUTES, 'campus_votes': campus,
         'share': round(share * 100, 1), 'deadline_rush': rush},
        {recipient: 'target', **{v: 'voter' for v in voters}}, rows)


# ---------- 2. repeated votes ----------
def detect_repeated(voter, recipient):
    """The same student rating the same peer identically across consecutive windows."""
    rows = list(_ratings().filter(voter=voter, recipient=recipient).order_by('window__starts_at', 'submitted_at'))
    recent = rows[-REPEATED_CONSECUTIVE_WINDOWS:]
    if len(recent) < REPEATED_CONSECUTIVE_WINDOWS or len({r.stars for r in recent}) != 1:
        return None
    stars = recent[0].stars
    windows = [r.window.name for r in recent]
    what = {1: 'the same 1-star rating', 3: 'the same 3-star rating'}.get(stars, 'the same 2-star rating')
    return Finding(
        'repeated', recent[-1].window, f'{name(voter)} gave {name(recipient)} {stars} star{"s" if stars > 1 else ""} {len(recent)} windows running',
        f'{name(voter)} gave {name(recipient)} {what} in {plural(len(recent), "consecutive window")} '
        f'({", ".join(windows)}), with no variation.',
        f'repeated:{voter.id}:{recipient.id}:{recent[-1].window_id}', recent[0].submitted_at, recent[-1].submitted_at,
        {'stars': stars, 'windows': windows},
        {voter: 'voter', recipient: 'target'}, recent)


# ---------- 3. group voting ----------
def detect_group(recipient, window, at):
    """Several students giving one student 1 star within an hour."""
    start = at - timedelta(minutes=GROUP_WINDOW_MINUTES)
    rows = list(_ratings().filter(recipient=recipient, window=window, stars=1, submitted_at__gte=start, submitted_at__lte=at))
    voters = {r.voter for r in rows}
    if len(voters) < GROUP_MIN_STUDENTS:
        return None
    labels = sorted({l.name for r in rows for l in r.labels.all()})
    span = max(r.submitted_at for r in rows) - min(r.submitted_at for r in rows)
    minutes = max(1, int(span.total_seconds() // 60))
    shared = f' Labels used: {", ".join(labels)}.' if labels else ''
    return Finding(
        'group', window, f'{plural(len(voters), "student")} gave {name(recipient)} 1 star within {minutes} minutes',
        f'{names(voters)} each gave {name(recipient)} 1 star within {minutes} minutes.{shared}',
        f'group:{recipient.id}:{window.id}:{start:%Y%m%d%H}', min(r.submitted_at for r in rows), max(r.submitted_at for r in rows),
        {'voters': len(voters), 'minutes': minutes, 'labels': labels},
        {recipient: 'target', **{v: 'voter' for v in voters}}, rows)


# ---------- 4. pair voting / revenge ----------
def detect_revenge(rating):
    """Two students giving each other 1 star in the same window. Context, not an accusation."""
    if rating.stars != 1:
        return None
    earlier = _ratings().filter(window=rating.window, voter=rating.recipient, recipient=rating.voter, stars=1,
                                submitted_at__lt=rating.submitted_at).first()
    if not earlier:
        return None
    first, second = earlier.voter, rating.voter
    hours = (rating.submitted_at - earlier.submitted_at).total_seconds() / 3600
    a, b = sorted([first.id, second.id], key=str)
    return Finding(
        'revenge', rating.window, f'{name(first)} and {name(second)} gave each other 1 star',
        f'{name(first)} gave {name(second)} 1 star, and {name(second)} answered with 1 star {hours:.1f} hours later. '
        'This may be a real dispute between them; both explanations are shown side by side.',
        f'revenge:{a}:{b}:{rating.window_id}', earlier.submitted_at, rating.submitted_at,
        {'hours_apart': round(hours, 1), 'first': str(first.id), 'second': str(second.id)},
        {first: 'participant', second: 'participant'}, [earlier, rating], advisory=True)


# ---------- 5. friends boosting ----------
def _three_star_circles(window):
    rows = list(_ratings().filter(window=window, stars=3))
    given = defaultdict(set)
    by_pair = {}
    for r in rows:
        given[r.voter].add(r.recipient)
        by_pair[(r.voter, r.recipient)] = r
    linked = defaultdict(set)
    for v, recipients in given.items():
        for rec in recipients:
            if v in given.get(rec, ()):
                linked[v].add(rec)
                linked[rec].add(v)
    seen, circles = set(), []
    for start in linked:
        if start in seen:
            continue
        group, queue = set(), [start]
        seen.add(start)
        while queue:
            cur = queue.pop()
            group.add(cur)
            for n in linked[cur] - seen:
                seen.add(n)
                queue.append(n)
        if len(group) >= BOOSTING_MIN_GROUP:
            circles.append((group, [r for (v, rec), r in by_pair.items() if v in group and rec in group]))
    return circles


def detect_boosting(window):
    """A circle of students trading 3 stars, kept up across windows (one shared project is exempt)."""
    out = []
    current = _three_star_circles(window)
    if not current:
        return out
    for group, rows in current:
        for prior in VotingWindow.objects.filter(starts_at__lt=window.starts_at).order_by('-starts_at'):
            match = next(((g, r) for g, r in _three_star_circles(prior) if len(group & g) >= BOOSTING_MIN_GROUP), None)
            if not match:
                continue
            core = group & match[0]
            both = rows + match[1]
            out.append(Finding(
                'boosting', window, f'{names(core)} keep rating each other 3 stars',
                f'{names(core)} traded 3-star ratings with each other in {prior.name} and again in {window.name}.'
                + (f' {plural(len(group) - len(core), "more student")} joined them this time.' if len(group) > len(core) else ''),
                f'boosting:{window.id}:' + ':'.join(sorted(str(m.id) for m in core)),
                min(r.submitted_at for r in both), max(r.submitted_at for r in both),
                {'members': len(group | match[0]), 'core': len(core), 'windows': [prior.name, window.name]},
                {m: 'participant' for m in group | match[0]}, both))
            break
    return out


# ---------- 7. extreme voter ----------
def detect_extreme(voter, window):
    """Someone giving only 1-star (from 4 votes) or only 3-star (from 10 votes) ratings."""
    rows = list(_ratings().filter(voter=voter, window=window))
    if not rows or len({r.stars for r in rows}) != 1:
        return None
    stars = rows[0].stars
    if stars == 1 and len(rows) >= EXTREME_MIN_NEGATIVE:
        title, advisory = f'{name(voter)} gave only 1-star ratings', False
    elif stars == 3 and len(rows) >= EXTREME_MIN_POSITIVE:
        title, advisory = f'{name(voter)} gave only 3-star ratings', True
    else:
        return None
    return Finding(
        'extreme', window, title,
        f'{name(voter)} cast {plural(len(rows), "vote")} in {window.name}, every one of them {stars} star{"s" if stars > 1 else ""}.',
        f'extreme:{voter.id}:{stars}:{window.id}', min(r.submitted_at for r in rows), max(r.submitted_at for r in rows),
        {'votes': len(rows), 'stars': stars},
        {voter: 'voter', **{r.recipient: 'target' for r in rows}}, rows, advisory=advisory)


# ---------- 8. malicious serious vote ----------
def detect_serious(rating):
    """Every 1-star vote is surfaced for a human check; the system doesn't guess whether a claim is true."""
    if rating.stars != 1:
        return None
    labels = sorted(l.name for l in rating.labels.all())
    text = (rating.explanation or '').strip()
    return Finding(
        'serious', rating.window, f'{name(rating.voter)} gave {name(rating.recipient)} 1 star',
        f'{name(rating.voter)} reported {name(rating.recipient)} for {", ".join(labels) or "a serious issue"}. '
        'Read the explanation and decide whether it is genuine.',
        f'serious:{rating.id}', rating.submitted_at, rating.submitted_at,
        {'labels': labels, 'explanation': text},
        {rating.voter: 'voter', rating.recipient: 'target'}, [rating])


# ---------- recording ----------
@transaction.atomic
def record(f):
    """Open a case for a finding, or refresh the open case it belongs to. Decided cases stay decided."""
    case = AbuseCase.objects.select_for_update().filter(dedup_key=f.key).first()
    if case and case.status != 'open':
        return case
    if not case:
        case = AbuseCase.objects.create(window=f.window, title=f.title[:200], dedup_key=f.key, detected_at=timezone.now())
    case.title = f.title[:200]
    case.roles = {**case.roles, **{str(p.id): role for p, role in f.roles.items()}}
    case.save(update_fields=['title', 'roles'])
    CaseFinding.objects.update_or_create(case=case, kind=f.kind, defaults={
        'mechanism': NAMES[f.kind], 'explanation': f.explanation, 'evidence': f.evidence,
        'observed_from': f.observed_from, 'observed_to': f.observed_to, 'advisory': f.advisory})
    case.students.add(*f.roles.keys())
    if f.ratings:
        case.ratings.add(*f.ratings)
    if f.attempts:
        case.attempts.add(*f.attempts)
    return case


def check_rating(rating):
    """Checks that only need the new vote, run right after it is saved."""
    at = rating.submitted_at
    found = [detect_revenge(rating), detect_serious(rating), detect_bulk(rating.recipient, rating.window, at),
             detect_group(rating.recipient, rating.window, at), detect_extreme(rating.voter, rating.window),
             detect_repeated(rating.voter, rating.recipient)]
    return [record(f) for f in found if f]


def run_soon():
    """Called after a vote or blocked attempt commits. Detection must never affect the student."""
    try:
        run_jobs(limit=50)
    except Exception:
        logging.getLogger(__name__).exception('Abuse detection failed; jobs stay queued for the next run.')


def run_jobs(limit=500):
    """Process queued detection jobs (one per accepted vote or blocked attempt)."""
    done = 0
    for job in DetectionJob.objects.select_related('rating', 'attempt').filter(status='pending').order_by('created_at')[:limit]:
        try:
            if job.rating_id:
                rating = _ratings().filter(pk=job.rating_id).first()
                if rating:
                    check_rating(rating)
            # blocked attempts were already refused at submission; nothing to detect
            job.status = 'done'
        except Exception:  # a broken job must not stop the queue; it stays visible as failed
            job.status = 'failed'
        job.save(update_fields=['status'])
        done += 1
    return done


def scan_window(window):
    """Whole-window patterns (circles, groups, bursts) plus every vote, as a catch-up pass."""
    cases = []
    for f in detect_boosting(window):
        cases.append(record(f))
    for r in _ratings().filter(window=window).order_by('submitted_at'):
        cases.extend(check_rating(r))
    DetectionJob.objects.filter(status='pending').filter(rating__window=window).update(status='done')
    DetectionJob.objects.filter(status='pending').filter(attempt__window=window).update(status='done')
    return {c.id for c in cases if c}
