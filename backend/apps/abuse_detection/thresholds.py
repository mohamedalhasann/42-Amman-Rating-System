"""
Configurable detection thresholds and observation windows.
Implements Decision D15 from project planning.
Staff or backend developers can adjust these settings or override them via Django settings.
"""
from django.conf import settings

# 1. Bulk votes: Dynamic thresholds (Volume + Campus Concentration + Deadline Proximity)
BULK_VOTES_WINDOW_MINUTES = getattr(settings, 'ABUSE_BULK_VOTES_WINDOW_MINUTES', 20)
BULK_VOTES_NORMAL_MIN_VOTERS = getattr(settings, 'ABUSE_BULK_VOTES_NORMAL_MIN_VOTERS', 4)
BULK_VOTES_NORMAL_CONCENTRATION = getattr(settings, 'ABUSE_BULK_VOTES_NORMAL_CONCENTRATION', 0.35)
BULK_VOTES_RUSH_MIN_VOTERS = getattr(settings, 'ABUSE_BULK_VOTES_RUSH_MIN_VOTERS', 6)
BULK_VOTES_RUSH_CONCENTRATION = getattr(settings, 'ABUSE_BULK_VOTES_RUSH_CONCENTRATION', 0.25)
BULK_VOTES_RUSH_HOURS = getattr(settings, 'ABUSE_BULK_VOTES_RUSH_HOURS', 2)

# Backward-compatibility alias
BULK_VOTES_MIN_VOTERS = BULK_VOTES_NORMAL_MIN_VOTERS

def get_threshold(setting_name, default_value):
    """
    Safely retrieves the staff-configured threshold from AntiAbuseSettings if available,
    falling back to Django settings or default constant without throwing errors.
    """
    try:
        from apps.abuse_detection.models import AntiAbuseSettings
        settings_obj = AntiAbuseSettings.get_solo()
        return getattr(settings_obj, setting_name, default_value)
    except Exception:
        return default_value

# 2. Repeated votes: Consecutive windows with consistent/identical ratings (Staff configurable)
REPEATED_VOTES_CONSECUTIVE_WINDOWS = getattr(settings, 'ABUSE_REPEATED_VOTES_CONSECUTIVE_WINDOWS', 2)

# 3. Group voting: Coordinated students giving identical ratings to one target
GROUP_VOTING_MIN_STUDENTS = getattr(settings, 'ABUSE_GROUP_VOTING_MIN_STUDENTS', 3)
GROUP_VOTING_WINDOW_MINUTES = getattr(settings, 'ABUSE_GROUP_VOTING_WINDOW_MINUTES', 60)

# 4. Pair voting / revenge: Retaliatory rating after receiving a negative rating
REVENGE_WINDOW_HOURS = getattr(settings, 'ABUSE_REVENGE_WINDOW_HOURS', 12)

# 5. Friends boosting: Dense reciprocal 3-star ratings inside a small cluster
BOOSTING_MIN_GROUP_SIZE = getattr(settings, 'ABUSE_BOOSTING_MIN_GROUP_SIZE', 3)
BOOSTING_INTERNAL_RATIO = getattr(settings, 'ABUSE_BOOSTING_INTERNAL_RATIO', 0.70)

# 6. Too fast or too often: High voting velocity from a single student
FAST_VOTING_MIN_COUNT = getattr(settings, 'ABUSE_FAST_VOTING_MIN_COUNT', 4)
FAST_VOTING_WINDOW_SECONDS = getattr(settings, 'ABUSE_FAST_VOTING_WINDOW_SECONDS', 120)

# 7. Extreme voter: Consistently voting only 1-star or only 3-star (asymmetric sample sizes)
EXTREME_VOTER_MIN_SAMPLE = getattr(settings, 'ABUSE_EXTREME_VOTER_MIN_SAMPLE', 4)
EXTREME_VOTER_MIN_POSITIVE_SAMPLE = getattr(settings, 'ABUSE_EXTREME_VOTER_MIN_POSITIVE_SAMPLE', 10)

# 8. Malicious serious vote: Suspicious 1-star submissions (boilerplate/spam explanations)
SUSPICIOUS_EXPLANATION_MIN_CHARS = getattr(settings, 'ABUSE_SUSPICIOUS_EXPLANATION_MIN_CHARS', 10)
SPAM_EXPLANATION_KEYWORDS = getattr(
    settings,
    'ABUSE_SPAM_EXPLANATION_KEYWORDS',
    ['none', 'test', 'asdf', 'nothing', 'idk', 'n/a', 'hate', 'bad', '...', 'no reason']
)
