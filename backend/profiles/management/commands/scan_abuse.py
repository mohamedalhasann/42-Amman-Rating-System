from django.core.management.base import BaseCommand

from profiles import detection
from profiles.models import VotingWindow


class Command(BaseCommand):
    help = 'Run abuse detection: process queued jobs, then scan every voting window for whole-window patterns.'

    def handle(self, *args, **options):
        jobs = detection.run_jobs()
        found = set()
        for window in VotingWindow.objects.order_by('starts_at'):
            found |= detection.scan_window(window)
        self.stdout.write(f'{jobs} queued jobs processed; {len(found)} cases found or refreshed.')
