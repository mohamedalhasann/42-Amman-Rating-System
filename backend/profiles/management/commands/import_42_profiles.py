from itertools import islice

from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import IntegrityError
from django.utils import timezone

from profiles.fortytwo import FortyTwoClient, ImportFailure, PhotoAccessDenied
from profiles.importer import import_profile
from profiles.eligibility import POLICY
from profiles.models import ImportRun, StudentProfile


class Command(BaseCommand):
    help = 'Import active Amman 42cursus students only. Never sets passwords, verification, or approval.'

    def add_arguments(self, parser):
        parser.add_argument('--campus-id', type=int, required=True, help='Staff-confirmed 42 Amman campus ID.')
        parser.add_argument('--dry-run', action='store_true', help='Validate remote profiles; no database or photo writes.')
        parser.add_argument('--skip-photos', action='store_true', help='Import names only; retain existing photos.')
        parser.add_argument('--resume', action='store_true', help='With --skip-photos, skip saved campus profiles before fetching details.')
        parser.add_argument('--limit', type=int, help='Validate/import only this many roster entries; a sample is not a complete roster.')
        parser.add_argument('--interval', type=float, default=0.6, help='Minimum seconds between HTTP requests (default 0.6).')

    def handle(self, *args, **options):
        if options['campus_id'] <= 0 or not 0.5 <= options['interval'] <= 30:
            raise CommandError('Use a positive campus ID and an interval between 0.5 and 30 seconds.')
        if options['limit'] is not None and options['limit'] <= 0:
            raise CommandError('The sample limit must be a positive integer.')
        if options['resume'] and not options['skip_photos']:
            raise CommandError('--resume currently requires --skip-photos. Omit --resume when refreshing photos.')
        client = FortyTwoClient(interval=options['interval'])
        self.stdout.write('Using batch lookup: campus accounts and 42cursus memberships, up to 100 accounts per page.')
        counts = dict(created=0, updated=0, skipped=0, failed=0)
        run = None if options['dry_run'] else ImportRun.objects.create(campus_id=options['campus_id'])
        failure = None
        completed = False
        try:
            # Check the campus itself rather than guessing a numeric ID.
            campus = client.get(f"/v2/campus/{options['campus_id']}")
            if not isinstance(campus, dict) or str(campus.get('name', '')).strip().casefold() not in ('amman', '42 amman'):
                raise ImportFailure('Configured campus is not 42 Amman. Confirm the campus ID with staff.')
            if options['resume']:
                skip_ids = set(StudentProfile.objects.filter(campus_id=options['campus_id'],
                    eligibility_policy=POLICY, eligibility_status__in=['eligible', 'excluded']).values_list('intra_id', flat=True))
                self.stdout.write(f'Resuming: up to {len(skip_ids)} profiles already checked against active 42cursus eligibility will be skipped. Older unfiltered imports will be rechecked.')
                rows = client.campus_users(options['campus_id'], skip_ids=skip_ids)
            else:
                rows = client.campus_users(options['campus_id'])
            if options['limit'] is not None:
                rows = islice(rows, options['limit'])
            for data in rows:
                try:
                    outcome = import_profile(data, options['campus_id'], client,
                        dry_run=options['dry_run'], photos=not options['skip_photos'])
                    counts[outcome] += 1
                except PhotoAccessDenied:
                    counts['failed'] += 1
                    raise
                except ImportFailure as error:
                    counts['failed'] += 1
                    self.stderr.write(f'Profile skipped: {error}')
                except (ValidationError, IntegrityError):
                    counts['failed'] += 1
                    self.stderr.write('One profile failed validation, photo download, or account matching. Rerun after checking configuration; existing account access is preserved.')
                processed = sum(counts.values())
                if processed % 25 == 0:
                    self.stdout.write(f'Checked {processed} · created: {counts["created"]} · updated: {counts["updated"]} · skipped: {counts["skipped"]} · failed: {counts["failed"]}')
                    self.stdout.flush()
            completed = True
        except ImportFailure as error:
            failure = str(error)
        finally:
            if options['resume']:
                counts['skipped'] += client.skipped_existing
            client.close()
            if run:
                run.finished_at = timezone.now()
                run.status = ('sample' if options['limit'] else 'complete') if completed and not counts['failed'] else 'incomplete'
                for key, value in counts.items():
                    setattr(run, key, value)
                run.save()
        prefix = 'DRY RUN · ' if options['dry_run'] else ''
        self.stdout.write(prefix + ' · '.join(f'{key}: {value}' for key, value in counts.items()))
        if failure or counts['failed']:
            raise CommandError(failure or 'Import incomplete. Failed profiles were not saved. Rerunning is safe.')
        if options['limit']:
            self.stdout.write(self.style.SUCCESS('Sample complete. This does not verify the full campus roster.'))
        else:
            self.stdout.write(self.style.SUCCESS('Profile validation complete.' if options['dry_run'] else 'Import complete. No account access was granted.'))
