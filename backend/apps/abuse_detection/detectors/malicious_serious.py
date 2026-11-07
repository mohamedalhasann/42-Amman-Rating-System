from apps.abuse_detection.models import AbuseCaseFinding


def detect_malicious_serious(rating):
    """
    Detector 8: Malicious serious vote (1-Star Staff Review Docket).
    Per hackathon subject, software does not run algorithmic guessing on real-world truth.
    Instead, every 1-star submission is surfaced to the staff review queue so staff can
    inspect the reported flags/explanation and negate (invalidate) the vote if confirmed invented.
    """
    if rating.stars != 1:
        return {"flagged": False}

    voter = rating.voter
    recipient = rating.recipient
    explanation_text = (rating.explanation or '').strip()

    # Collect any attached labels safely
    labels = []
    try:
        labels = [rl.label.name for rl in rating.labels.all()]
    except Exception:
        pass

    explanation = (
        f"1-star serious report submitted by @{voter.intra_username} against @{recipient.intra_username}. "
        f"Staff verification required to verify authenticity or negate if invented."
    )

    return {
        "flagged": True,
        "mechanism": AbuseCaseFinding.MECHANISM_MALICIOUS_SERIOUS,
        "summary": f"1-star serious report on @{recipient.intra_username} by @{voter.intra_username}",
        "explanation": explanation,
        "observed_from": rating.submitted_at,
        "observed_to": rating.submitted_at,
        "evidence": {
            "voter_username": voter.intra_username,
            "recipient_username": recipient.intra_username,
            "labels": labels,
            "explanation_text": explanation_text if explanation_text else "[Labels only - no written text]",
            "requires_staff_verification": True
        },
        "students": [(voter, 'voter'), (recipient, 'target')],
        "ratings": [rating],
        "deduplication_key": f"malicious_1star:{rating.id}"
    }
