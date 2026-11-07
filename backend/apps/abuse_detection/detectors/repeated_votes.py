from apps.ratings.models import Rating
from apps.abuse_detection.models import AbuseCaseFinding
from apps.abuse_detection import thresholds


def detect_repeated_votes(voter, recipient, current_window=None, reference_time=None):
    """
    Detector 2: Repeated votes (Cross-Window).
    Identifies a student persistently targeting the same peer across consecutive voting windows
    with consistent/identical rating levels (e.g. repeated 1-star strikes, or repeated 3-star monopolies).
    Exempts fluctuating ratings (e.g. 1-star -> 3-star).
    """
    # Fetch all ratings from voter to recipient, ordered chronologically by window
    ratings_qs = Rating.objects.filter(
        voter=voter,
        recipient=recipient
    ).select_related('window').order_by('window__starts_at', 'submitted_at')

    ratings = list(ratings_qs)

    min_consecutive = thresholds.REPEATED_VOTES_CONSECUTIVE_WINDOWS  # Default: 2

    if len(ratings) < min_consecutive:
        return {"flagged": False}

    # Take the most recent `min_consecutive` ratings
    recent_ratings = ratings[-min_consecutive:]

    # Check star values: must be identical across these consecutive windows
    stars_set = {r.stars for r in recent_ratings}
    if len(stars_set) != 1:
        # Fluctuation detected (e.g. 1-star then 3-star)! Exempt from abuse.
        return {"flagged": False}

    consistent_star = list(stars_set)[0]
    windows_names = [r.window.name for r in recent_ratings]
    windows_str = ", ".join(windows_names)

    # Plain-language explanation based on whether it's 1-star or 3-star
    if consistent_star == 1:
        summary = f"Persistent negative targeting: @{voter.intra_username} on @{recipient.intra_username}"
        explanation = (
            f"Student @{voter.intra_username} has submitted identical 1-star ratings against "
            f"@{recipient.intra_username} across {len(recent_ratings)} consecutive voting windows "
            f"({windows_str}) with no rating variation."
        )
    elif consistent_star == 3:
        summary = f"Persistent repeated high voting: @{voter.intra_username} on @{recipient.intra_username}"
        explanation = (
            f"Student @{voter.intra_username} has repeatedly given 3-star ratings to "
            f"@{recipient.intra_username} across {len(recent_ratings)} consecutive voting windows "
            f"({windows_str}) instead of evaluating different peers in the community."
        )
    else:
        summary = f"Persistent repeated 2-star voting: @{voter.intra_username} on @{recipient.intra_username}"
        explanation = (
            f"Student @{voter.intra_username} has repeatedly given 2-star ratings to "
            f"@{recipient.intra_username} across {len(recent_ratings)} consecutive voting windows "
            f"({windows_str})."
        )

    observed_from = min(r.submitted_at for r in recent_ratings)
    observed_to = max(r.submitted_at for r in recent_ratings)

    return {
        "flagged": True,
        "mechanism": AbuseCaseFinding.MECHANISM_REPEATED_VOTES,
        "summary": summary,
        "explanation": explanation,
        "observed_from": observed_from,
        "observed_to": observed_to,
        "evidence": {
            "voter_username": voter.intra_username,
            "recipient_username": recipient.intra_username,
            "consistent_stars": consistent_star,
            "consecutive_windows_count": len(recent_ratings),
            "window_names": windows_names,
            "rating_ids": [str(r.id) for r in recent_ratings]
        },
        "students": [(voter, 'voter'), (recipient, 'target')],
        "ratings": recent_ratings,
        "deduplication_key": f"repeated_votes:{voter.id}:{recipient.id}:{recent_ratings[-1].window_id}"
    }
