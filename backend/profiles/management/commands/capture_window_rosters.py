from django.core.management.base import BaseCommand
from django.db import transaction
from profiles.workspace import capture_rosters, locked_state


class Command(BaseCommand):
    help = 'Capture due window rosters; run every minute in deployment. Safe to repeat.'

    @transaction.atomic
    def handle(self, *args, **options):
        state = locked_state()
        count = capture_rosters()
        if count:
            state.version += 1
            state.save(update_fields=['version'])
        self.stdout.write(f'{count} window rosters captured.')
