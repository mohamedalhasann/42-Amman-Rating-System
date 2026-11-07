"""
Detectors module for Anti-Abuse System.
Exposes active detectors with plain-language explanations.
Note: "Too fast or too often" is enforced at infrastructure rate-limiting (Nginx / API throttle)
and database quota constraints (VotingWindow.max_votes).
"""
from .bulk_votes import detect_bulk_votes
from .repeated_votes import detect_repeated_votes
from .group_voting import detect_group_voting
from .pair_revenge import detect_pair_revenge
from .friends_boosting import detect_friends_boosting
from .extreme_voter import detect_extreme_voter
from .malicious_serious import detect_malicious_serious

__all__ = [
    'detect_bulk_votes',
    'detect_repeated_votes',
    'detect_group_voting',
    'detect_pair_revenge',
    'detect_friends_boosting',
    'detect_extreme_voter',
    'detect_malicious_serious',
]
