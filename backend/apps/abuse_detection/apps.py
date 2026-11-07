from django.apps import AppConfig


class AbuseDetectionConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.abuse_detection'
    verbose_name = 'Anti-Abuse Detection System'
