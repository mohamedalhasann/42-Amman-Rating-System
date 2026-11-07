from apps.ratings.models import Rating
from apps.abuse_detection.models import AbuseCaseFinding


def detect_pair_revenge(rating):
    """
    Detector 4: Pair voting / revenge (Contextual Advisory).
    Identifies reciprocal 1-star ratings exchanged between two students within the same voting window.
    Designed as an informational staff advisory rather than an accusatory abuse alert,
    preserving student peer evaluation integrity unless an objective violation is proven.
    """
    if rating.stars != 1:
        return {"flagged": False}

    student_a = rating.voter
    student_b = rating.recipient
    submission_time = rating.submitted_at
    window = rating.window

    # Check if student_b gave student_a a 1-star rating earlier in the same voting window
    prior_rating = Rating.objects.filter(
        window=window,
        voter=student_b,
        recipient=student_a,
        stars=1,
        submitted_at__lt=submission_time
    ).first()

    if prior_rating:
        delta = submission_time - prior_rating.submitted_at
        delta_hours = delta.total_seconds() / 3600.0

        explanation = (
            f"Mutual 1-star exchange in this window: @{student_b.intra_username} rated @{student_a.intra_username} "
            f"at {prior_rating.submitted_at.strftime('%H:%M')}, and @{student_a.intra_username} rated @{student_b.intra_username} "
            f"at {submission_time.strftime('%H:%M')} ({delta_hours:.1f} hours apart). "
            f"Staff Note: Contextual peer dispute advisory. Both ratings remain active; do not invalidate without objective policy violation."
        )

        return {
            "flagged": True,
            "mechanism": AbuseCaseFinding.MECHANISM_PAIR_REVENGE,
            "summary": f"Reciprocal 1-star ratings: @{student_a.intra_username} and @{student_b.intra_username}",
            "explanation": explanation,
            "observed_from": prior_rating.submitted_at,
            "observed_to": submission_time,
            "evidence": {
                "advisory_only": True,
                "ui_badge": "Contextual Note",
                "initiator_username": student_b.intra_username,
                "retaliator_username": student_a.intra_username,
                "delta_hours": round(delta_hours, 2),
                "prior_rating_id": str(prior_rating.id),
                "retaliatory_rating_id": str(rating.id),
                "student_b_explanation": prior_rating.explanation,
                "student_a_explanation": rating.explanation
            },
            "students": [(student_a, 'voter'), (student_b, 'participant')],
            "ratings": [prior_rating, rating],
            "deduplication_key": f"revenge:{min(student_a.id, student_b.id)}:{max(student_a.id, student_b.id)}:{rating.window_id}"
        }

    return {"flagged": False}
