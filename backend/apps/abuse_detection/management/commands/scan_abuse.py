from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.ratings.models import VotingWindow
from apps.abuse_detection.services import run_periodic_scan


class Command(BaseCommand):
    help = 'Scans active voting windows for multi-student abuse patterns (friends boosting, group voting, bulk votes)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--window-id',
            type=str,
            help='Specific voting window UUID to scan (defaults to all currently open windows)'
        )

    def handle(self, *args, **options):
        window_id = options.get('window_id')
        if window_id:
            windows = VotingWindow.objects.filter(id=window_id)
        else:
            now = timezone.now()
            windows = VotingWindow.objects.filter(starts_at__lte=now, ends_at__gte=now)

        if not windows.exists():
            self.stdout.write(self.style.WARNING("No active voting windows found to scan."))
            return

        self.stdout.write(f"Scanning {windows.count()} window(s) for abuse patterns...")
        total_cases = 0
        for window in windows:
            cases = run_periodic_scan(window)
            total_cases += len(cases)
            self.stdout.write(f"  - Window '{window.name}': flagged {len(cases)} case(s)")

        self.stdout.write(self.style.SUCCESS(f"Done. Flagged {total_cases} total abuse case(s)."))
