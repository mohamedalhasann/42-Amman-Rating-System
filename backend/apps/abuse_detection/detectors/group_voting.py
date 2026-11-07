from datetime import timedelta
from django.utils import timezone
from apps.ratings.models import Rating
from apps.abuse_detection.models import AbuseCaseFinding
from apps.abuse_detection import thresholds


def detect_group_voting(recipient, window=None, reference_time=None):
    """
    Detector 3: Group voting ("The Mob Attack").
    Identifies a coordinated group of students submitting 1-star ratings against one target student
    within a short time interval.
    """
    if reference_time is None:
        reference_time = timezone.now()

    min_students = thresholds.get_threshold('mob_attack_min_students', 3)
    window_minutes = thresholds.get_threshold('mob_attack_window_minutes', 60)

    interval = timedelta(minutes=window_minutes)
    start_time = reference_time - interval

    # Fetch 1-star ratings received by recipient in this time interval
    ratings_qs = Rating.objects.filter(
        recipient=recipient,
        stars=1,
        submitted_at__gte=start_time,
        submitted_at__lte=reference_time
    )
    if window:
        ratings_qs = ratings_qs.filter(window=window)

    ratings = list(ratings_qs.select_related('voter').prefetch_related('labels__label'))
    distinct_voters = {r.voter for r in ratings}

    if len(distinct_voters) >= min_students:
        voter_usernames = [v.intra_username for v in distinct_voters]

        # Collect shared labels/flags if any
        all_labels = []
        for r in ratings:
            for rl in r.labels.all():
                all_labels.append(rl.label.name)

        shared_labels_str = f" (Labels: {', '.join(set(all_labels))})" if all_labels else ""

        explanation = (
            f"Mob attack detected: A group of {len(distinct_voters)} students (@{', @'.join(voter_usernames)}) "
            f"submitted coordinated 1-star ratings against @{recipient.intra_username} within {window_minutes} minutes{shared_labels_str}."
        )

        return {
            "flagged": True,
            "mechanism": AbuseCaseFinding.MECHANISM_GROUP_VOTING,
            "summary": f"Coordinated 1-star mob attack on @{recipient.intra_username} ({len(distinct_voters)} students)",
            "explanation": explanation,
            "observed_from": min(r.submitted_at for r in ratings),
            "observed_to": max(r.submitted_at for r in ratings),
            "evidence": {
                "recipient_username": recipient.intra_username,
                "voters_count": len(distinct_voters),
                "voter_usernames": voter_usernames,
                "window_minutes": window_minutes,
                "rating_ids": [str(r.id) for r in ratings],
                "labels": list(set(all_labels))
            },
            "students": [(recipient, 'target')] + [(v, 'voter') for v in distinct_voters],
            "ratings": ratings,
            "deduplication_key": f"mob_attack:{recipient.id}:{start_time.strftime('%Y%m%d%H')}"
        }

    return {"flagged": False}
