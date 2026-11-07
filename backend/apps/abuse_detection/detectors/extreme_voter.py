from apps.ratings.models import Rating
from apps.abuse_detection.models import AbuseCaseFinding
from apps.abuse_detection import thresholds


def detect_extreme_voter(voter, window=None):
    """
    Detector 7: Extreme voter.
    Identifies voters who exclusively cast only 1-star (negative) or only 3-star (positive) ratings.
    Applies asymmetric thresholds:
      - 1-star (negative) votes: flags at lower threshold (default 4) because serial negativity is toxic.
      - 3-star (positive) votes: flags at a much higher threshold (default 10) to respect genuine
        peer appreciation and avoid false positives on standard project ratings.
    """
    ratings_qs = Rating.objects.filter(voter=voter)
    if window:
        ratings_qs = ratings_qs.filter(window=window)

    ratings = list(ratings_qs.select_related('recipient'))
    if not ratings:
        return {"flagged": False}

    stars_set = {r.stars for r in ratings}
    if len(stars_set) != 1:
        return {"flagged": False}

    only_star = list(stars_set)[0]
    total_votes = len(ratings)

    min_negative = thresholds.get_threshold('extreme_voter_min_sample', 4)
    min_positive = thresholds.get_threshold('extreme_voter_min_positive_sample', 10)

    if only_star == 1:
        if total_votes < min_negative:
            return {"flagged": False}
        summary = f"Serial 1-star negative voter: @{voter.intra_username}"
        explanation = (
            f"Serial negative voting pattern: @{voter.intra_username} cast {total_votes} votes, "
            f"giving exclusively 1-star ratings without any variation."
        )
        is_advisory = False
    elif only_star == 3:
        if total_votes < min_positive:
            return {"flagged": False}
        summary = f"Unvaried 3-star positive voter: @{voter.intra_username}"
        explanation = (
            f"Unvaried positive voting pattern: @{voter.intra_username} cast {total_votes} votes, "
            f"giving exclusively 3-star ratings across all evaluated peers."
        )
        is_advisory = True
    else:
        return {"flagged": False}

    recipients = [r.recipient for r in ratings]
    window_id = window.id if window else 'all'

    return {
        "flagged": True,
        "mechanism": AbuseCaseFinding.MECHANISM_EXTREME_VOTER,
        "summary": summary,
        "explanation": explanation,
        "observed_from": min(r.submitted_at for r in ratings),
        "observed_to": max(r.submitted_at for r in ratings),
        "evidence": {
            "voter_username": voter.intra_username,
            "votes_count": total_votes,
            "stars": only_star,
            "advisory_only": is_advisory,
            "target_usernames": [rec.intra_username for rec in recipients]
        },
        "students": [(voter, 'voter')] + [(rec, 'target') for rec in recipients],
        "ratings": ratings,
        "deduplication_key": f"extreme_voter:{voter.id}:{only_star}:{window_id}"
    }
