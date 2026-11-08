"""Explicit local presentation mode; never grants or changes a stored role."""
from django.conf import settings


def enabled():
    return settings.DEBUG and getattr(settings, 'LOCAL_DEMO_LOGIN', False)


def session_enabled(request):
    return enabled() and request.session.get('local_demo_login') is True
