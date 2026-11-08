"""Import eligibility is separate from local account approval and activation."""
from .fortytwo import ImportFailure

POLICY = 'active-42cursus-v1'


def check_eligibility(data, campus_id):
    if not isinstance(data, dict):
        raise ImportFailure('Invalid user response.')
    campuses = data.get('campus')
    if not isinstance(campuses, list) or not any(isinstance(c, dict) and c.get('id') == campus_id for c in campuses):
        raise ImportFailure('User campus membership could not be verified.')
    if data.get('staff?') is True:
        return False
    active = data.get('active?')
    if type(active) is not bool:
        raise ImportFailure('42 account activation status is missing; eligibility was not granted.')
    if not active:
        return False
    enrollments = data.get('cursus_users')
    if not isinstance(enrollments, list):
        raise ImportFailure('Cursus enrollment data is missing; eligibility was not granted.')
    # Exact cursus identity; a matching substring in a Piscine name is not enough.
    return any(isinstance(e, dict) and isinstance(e.get('cursus'), dict)
               and (e['cursus'].get('slug') == '42cursus' or e['cursus'].get('name') == '42cursus')
               for e in enrollments)
