from datetime import timedelta
from django.utils import timezone
from apps.ratings.models import Rating
from apps.abuse_detection.models import AbuseCaseFinding
from apps.abuse_detection import thresholds


def detect_bulk_votes(recipient, window=None, reference_time=None):
    """
    Detector 1: Bulk votes (Dynamic).
    Identifies sudden surges targeting one student.
    Uses dynamic thresholds based on:
      1. Campus volume concentration (target votes / total campus votes)
      2. Deadline proximity (whether the window is within its final rush hours)
    """
    if reference_time is None:
        reference_time = timezone.now()

    window_delta = timedelta(minutes=thresholds.BULK_VOTES_WINDOW_MINUTES)
    start_time = reference_time - window_delta

    # 1. Fetch ratings received by this recipient in the interval
    recipient_ratings_qs = Rating.objects.filter(
        recipient=recipient,
        submitted_at__gte=start_time,
        submitted_at__lte=reference_time
    )
    if window:
        recipient_ratings_qs = recipient_ratings_qs.filter(window=window)

    recipient_ratings = list(recipient_ratings_qs.select_related('voter'))
    distinct_voters = {r.voter for r in recipient_ratings}
    voter_count = len(distinct_voters)

    # Minimum threshold floor: if fewer than 3 distinct voters, cannot be bulk voting
    if voter_count < 3:
        return {"flagged": False}

    # 2. Check if we are in the deadline rush (last N hours of window)
    is_deadline_rush = False
    deadline_info = "Normal window period"
    if window and window.ends_at:
        remaining_seconds = (window.ends_at - reference_time).total_seconds()
        rush_limit_seconds = thresholds.BULK_VOTES_RUSH_HOURS * 3600
        if 0 < remaining_seconds <= rush_limit_seconds:
            is_deadline_rush = True
            minutes_left = int(remaining_seconds // 60)
            deadline_info = f"Deadline rush ({minutes_left} minutes until window close)"

    # 3. Query total campus-wide votes in that same interval
    campus_votes_qs = Rating.objects.filter(
        submitted_at__gte=start_time,
        submitted_at__lte=reference_time
    )
    if window:
        campus_votes_qs = campus_votes_qs.filter(window=window)

    total_campus_votes = campus_votes_qs.count()
    concentration_ratio = len(recipient_ratings) / float(total_campus_votes) if total_campus_votes > 0 else 1.0

    # 4. Dynamic evaluation
    flagged = False

    if is_deadline_rush:
        # In deadline rush, require higher threshold (>= 6 voters) and significant concentration (>= 25%),
        # OR an overwhelming volume (>= 8 voters) regardless of concentration
        if (voter_count >= thresholds.BULK_VOTES_RUSH_MIN_VOTERS and concentration_ratio >= thresholds.BULK_VOTES_RUSH_CONCENTRATION) or voter_count >= 8:
            flagged = True
    else:
        # In normal period, require >= 4 voters and >= 35% concentration, or >= 6 voters regardless
        if (voter_count >= thresholds.BULK_VOTES_NORMAL_MIN_VOTERS and concentration_ratio >= thresholds.BULK_VOTES_NORMAL_CONCENTRATION) or voter_count >= 6:
            flagged = True

    if flagged:
        explanation = (
            f"Student @{recipient.intra_username} received {len(recipient_ratings)} ratings from "
            f"{voter_count} distinct students within {thresholds.BULK_VOTES_WINDOW_MINUTES} minutes, "
            f"accounting for {concentration_ratio * 100:.0f}% of all campus voting activity in this period. "
            f"Context: {deadline_info}."
        )

        return {
            "flagged": True,
            "mechanism": AbuseCaseFinding.MECHANISM_BULK_VOTES,
            "summary": f"Bulk votes received by @{recipient.intra_username} ({concentration_ratio * 100:.0f}% concentration)",
            "explanation": explanation,
            "observed_from": start_time,
            "observed_to": reference_time,
            "evidence": {
                "recipient_id": str(recipient.id),
                "recipient_username": recipient.intra_username,
                "ratings_count": len(recipient_ratings),
                "distinct_voters_count": voter_count,
                "window_minutes": thresholds.BULK_VOTES_WINDOW_MINUTES,
                "total_campus_votes": total_campus_votes,
                "concentration_percentage": round(concentration_ratio * 100, 1),
                "is_deadline_rush": is_deadline_rush,
                "deadline_info": deadline_info,
                "voter_usernames": [v.intra_username for v in distinct_voters]
            },
            "students": [(recipient, 'target')] + [(v, 'voter') for v in distinct_voters],
            "ratings": recipient_ratings,
            "deduplication_key": f"bulk_votes:{recipient.id}:{start_time.strftime('%Y%m%d%H')}"
        }

    return {"flagged": False}
