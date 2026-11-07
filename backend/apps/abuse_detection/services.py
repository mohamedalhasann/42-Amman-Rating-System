from django.db import transaction
from django.utils import timezone
from apps.ratings.models import Rating, Student, VotingWindow
from apps.abuse_detection.models import (
    AbuseCase,
    AbuseCaseFinding,
    AbuseCaseStudent,
    AbuseCaseRating,
    VoteAttempt,
    Invalidation
)
from apps.abuse_detection.detectors import (
    detect_bulk_votes,
    detect_repeated_votes,
    detect_group_voting,
    detect_pair_revenge,
    detect_friends_boosting,
    detect_extreme_voter,
    detect_malicious_serious,
)


@transaction.atomic
def record_case_from_finding(finding_dict):
    """
    Saves or updates an AbuseCase and links findings, students, and ratings safely.
    Deduplicates using deduplication_key so repetitive scans don't spam staff.
    """
    if not finding_dict or not finding_dict.get('flagged'):
        return None

    dedup_key = finding_dict['deduplication_key']

    # Find existing open case or create a new one
    case, created = AbuseCase.objects.get_or_create(
        deduplication_key=dedup_key,
        defaults={
            'summary': finding_dict['summary'],
            'status': AbuseCase.STATUS_OPEN,
            'detected_at': timezone.now()
        }
    )

    # If already dismissed or confirmed, don't reopen without reason
    if not created and case.status != AbuseCase.STATUS_OPEN:
        return case

    # Update summary to latest finding
    case.summary = finding_dict['summary']
    case.save(update_fields=['summary'])

    # Record the finding details
    AbuseCaseFinding.objects.create(
        case=case,
        mechanism=finding_dict['mechanism'],
        rule_version='v1.0',
        observed_from=finding_dict['observed_from'],
        observed_to=finding_dict['observed_to'],
        evidence=finding_dict['evidence'],
        explanation=finding_dict['explanation']
    )

    # Link involved students
    for student, role in finding_dict.get('students', []):
        AbuseCaseStudent.objects.get_or_create(
            case=case,
            student=student,
            defaults={'role': role}
        )

    # Link evidence ratings
    for rating in finding_dict.get('ratings', []):
        AbuseCaseRating.objects.get_or_create(
            case=case,
            rating=rating
        )

    return case


def evaluate_vote_submission(rating):
    """
    Primary submission hook.
    Runs immediate detector checks right after a vote is saved in the database.
    Can be called directly from the submit view or via a post_save signal.
    """
    flagged_cases = []

    # Check 1: Pair / Revenge voting
    res_revenge = detect_pair_revenge(rating)
    if res_revenge.get('flagged'):
        case = record_case_from_finding(res_revenge)
        if case:
            flagged_cases.append(case)

    # Check 2: Malicious serious vote (1-star staff review)
    res_malicious = detect_malicious_serious(rating)
    if res_malicious.get('flagged'):
        case = record_case_from_finding(res_malicious)
        if case:
            flagged_cases.append(case)

    # Check 3: Bulk votes targeting the recipient
    res_bulk = detect_bulk_votes(rating.recipient, window=rating.window)
    if res_bulk.get('flagged'):
        case = record_case_from_finding(res_bulk)
        if case:
            flagged_cases.append(case)

    # Check 5: Extreme voter check
    res_extreme = detect_extreme_voter(rating.voter, window=rating.window)
    if res_extreme.get('flagged'):
        case = record_case_from_finding(res_extreme)
        if case:
            flagged_cases.append(case)

    # Check 6: Repeated votes across consecutive windows
    res_repeated = detect_repeated_votes(rating.voter, rating.recipient, current_window=rating.window)
    if res_repeated.get('flagged'):
        case = record_case_from_finding(res_repeated)
        if case:
            flagged_cases.append(case)

    return flagged_cases


def run_periodic_scan(window):
    """
    Periodic background scan for complex graph / cluster patterns across a voting window.
    Evaluates friends boosting, group voting, and aggregate patterns.
    """
    flagged_cases = []

    # 1. Friends boosting clusters
    boosting_cases = detect_friends_boosting(window)
    for b_case in boosting_cases:
        case = record_case_from_finding(b_case)
        if case:
            flagged_cases.append(case)

    # 2. Group voting targeting recipients in this window
    recipients = Student.objects.filter(ratings_received__window=window).distinct()
    for recipient in recipients:
        res_group = detect_group_voting(recipient, window=window)
        if res_group.get('flagged'):
            case = record_case_from_finding(res_group)
            if case:
                flagged_cases.append(case)

        res_bulk = detect_bulk_votes(recipient, window=window)
        if res_bulk.get('flagged'):
            case = record_case_from_finding(res_bulk)
            if case:
                flagged_cases.append(case)

    return flagged_cases


def record_vote_attempt(voter, recipient=None, window=None, outcome='accepted', reason_code='', request_reference=''):
    """
    Helper for the backend to record vote attempts (including blocked/rejected attempts).
    Triggers the repeated votes detector when multiple attempts fail on the same peer.
    """
    attempt = VoteAttempt.objects.create(
        voter=voter,
        recipient=recipient,
        window=window,
        outcome=outcome,
        reason_code=reason_code,
        request_reference=request_reference
    )

    if recipient:
        res_repeated = detect_repeated_votes(voter, recipient, window=window)
        if res_repeated.get('flagged'):
            record_case_from_finding(res_repeated)

    return attempt


@transaction.atomic
def confirm_abuse_case(case_id, staff_user, review_reason=""):
    """
    Marks an abuse case as confirmed.
    """
    case = AbuseCase.objects.select_for_update().get(id=case_id)
    case.status = AbuseCase.STATUS_CONFIRMED
    case.reviewed_by = staff_user
    case.reviewed_at = timezone.now()
    case.review_reason = review_reason
    case.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'review_reason'])
    return case


@transaction.atomic
def dismiss_abuse_case(case_id, staff_user, review_reason=""):
    """
    Dismisses an open suspicion case as false positive / acceptable context.
    """
    case = AbuseCase.objects.select_for_update().get(id=case_id)
    case.status = AbuseCase.STATUS_DISMISSED
    case.reviewed_by = staff_user
    case.reviewed_at = timezone.now()
    case.review_reason = review_reason
    case.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'review_reason'])
    return case


@transaction.atomic
def invalidate_vote(rating_id, case_id, staff_user, reason):
    """
    Staff action: invalidates (negates) a vote linked to a confirmed abuse case.
    Negates the vote from average calculation, preserves audit history.
    """
    rating = Rating.objects.select_for_update().get(id=rating_id)
    case = AbuseCase.objects.get(id=case_id)

    if case.status != AbuseCase.STATUS_CONFIRMED:
        # Auto-confirm the case if staff is invalidating a vote from it
        confirm_abuse_case(case_id, staff_user, f"Confirmed via vote invalidation: {reason}")

    # Check if already invalidated
    invalidation, created = Invalidation.objects.get_or_create(
        rating=rating,
        defaults={
            'case': case,
            'invalidated_by': staff_user,
            'reason': reason
        }
    )

    if not created:
        invalidation.reason = reason
        invalidation.invalidated_by = staff_user
        invalidation.save(update_fields=['reason', 'invalidated_by'])

    rating.is_invalidated = True
    rating.save(update_fields=['is_invalidated'])

    return invalidation
