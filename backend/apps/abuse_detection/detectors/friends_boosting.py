from collections import defaultdict
from apps.ratings.models import Rating, VotingWindow
from apps.abuse_detection.models import AbuseCaseFinding
from apps.abuse_detection import thresholds


def _find_3star_clusters_in_window(window, min_size=3):
    """
    Helper that finds all connected groups of students who exchanged mutual 3-star ratings in a given window.
    Returns a list of tuples: (student_set, ratings_list).
    """
    ratings = list(
        Rating.objects.filter(window=window, stars=3).select_related('voter', 'recipient')
    )
    if len(ratings) < min_size:
        return []

    # Map voter -> set of recipients they gave 3-stars to
    given_to = defaultdict(set)
    ratings_by_pair = {}
    for r in ratings:
        given_to[r.voter].add(r.recipient)
        ratings_by_pair[(r.voter, r.recipient)] = r

    # Find mutual pairs (A gave 3 to B, and B gave 3 to A)
    adj = defaultdict(set)
    students_in_mutual = set()
    for voter, recipients in given_to.items():
        for recipient in recipients:
            if voter in given_to.get(recipient, set()):
                adj[voter].add(recipient)
                adj[recipient].add(voter)
                students_in_mutual.add(voter)
                students_in_mutual.add(recipient)

    if len(students_in_mutual) < min_size:
        return []

    visited = set()
    clusters = []

    for student in students_in_mutual:
        if student in visited:
            continue

        cluster = []
        queue = [student]
        visited.add(student)

        while queue:
            curr = queue.pop(0)
            cluster.append(curr)
            for neighbor in adj[curr]:
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append(neighbor)

        if len(cluster) >= min_size:
            cluster_set = set(cluster)
            cluster_ratings = [
                r for (v, rec), r in ratings_by_pair.items()
                if v in cluster_set and rec in cluster_set
            ]
            clusters.append((cluster_set, cluster_ratings))

    return clusters


def detect_friends_boosting(current_window):
    """
    Detector 5: Friends boosting (Cross-Window Circular Ring).
    Identifies a closed circle of students exchanging mutual 3-star ratings across multiple voting windows.
    Exempts single-window collaboration (assumed to be legitimate group projects like ft_transcendence).
    Uses core overlap (>= 3 students) to detect cartels even if they add or swap members between windows.
    """
    min_group_size = thresholds.get_threshold('boosting_min_group_size', 3)

    # 1. Find 3-star clusters in current window
    current_clusters = _find_3star_clusters_in_window(current_window, min_size=min_group_size)
    if not current_clusters:
        return []

    # 2. Find prior windows chronologically before current_window
    prior_windows = list(
        VotingWindow.objects.filter(starts_at__lt=current_window.starts_at).order_by('-starts_at')
    )
    if not prior_windows:
        # First window ever: no historical repetition possible; do not false-alarm normal teams
        return []

    flagged_cases = []

    # 3. For each cluster in current window, check for core overlap with clusters in prior windows
    for current_set, current_ratings in current_clusters:
        for prior_window in prior_windows:
            prior_clusters = _find_3star_clusters_in_window(prior_window, min_size=min_group_size)

            for prior_set, prior_ratings in prior_clusters:
                core_overlap = current_set.intersection(prior_set)

                # If at least `min_group_size` members overlap, it is a persistent ring!
                if len(core_overlap) >= min_group_size:
                    core_usernames = sorted([s.intra_username for s in core_overlap])
                    current_usernames = sorted([s.intra_username for s in current_set])

                    expansion_note = ""
                    if len(current_set) > len(core_overlap):
                        new_members = [s.intra_username for s in current_set - core_overlap]
                        expansion_note = f" (expanded from {len(core_overlap)} to {len(current_set)} members with @{', @'.join(new_members)})"

                    explanation = (
                        f"Persistent 3-star boosting circle detected: Core members (@{', @'.join(core_usernames)}) "
                        f"have traded mutual 3-star ratings across multiple voting windows "
                        f"({prior_window.name} and {current_window.name}){expansion_note}."
                    )

                    combined_ratings = prior_ratings + current_ratings
                    all_students = current_set.union(prior_set)

                    flagged_cases.append({
                        "flagged": True,
                        "mechanism": AbuseCaseFinding.MECHANISM_FRIENDS_BOOSTING,
                        "summary": f"Cross-window 3-star boosting ring (@{', @'.join(core_usernames)})",
                        "explanation": explanation,
                        "observed_from": min(r.submitted_at for r in combined_ratings),
                        "observed_to": max(r.submitted_at for r in combined_ratings),
                        "evidence": {
                            "core_members": core_usernames,
                            "current_members": current_usernames,
                            "prior_window_name": prior_window.name,
                            "current_window_name": current_window.name,
                            "is_expanded": len(current_set) > len(core_overlap)
                        },
                        "students": [(m, 'participant') for m in all_students],
                        "ratings": combined_ratings,
                        "deduplication_key": f"boosting:{current_window.id}:" + ":".join(sorted(str(m.id) for m in core_overlap))
                    })
                    break  # Found match for this cluster, move to next

    return flagged_cases
