"""Trusted, local provisioning; no public endpoint can grant staff access."""
import json
import re
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from profiles.models import AccountAudit, SetupToken, User


class Command(BaseCommand):
    help = 'Provision the owner-approved staff roster. Does not send email or create passwords.'

    def add_arguments(self, parser):
        parser.add_argument('--roster', type=Path, default=settings.BASE_DIR / 'staff-roster.json')

    @transaction.atomic
    def handle(self, *args, **options):
        try:
            rows = json.loads(Path(options['roster']).read_text())
            if not isinstance(rows, list) or not rows:
                raise ValueError
            seen = set()
            for row in rows:
                if set(row) != {'intra_username', 'first_name', 'last_name'}:
                    raise ValueError
                username = row['intra_username']
                if not isinstance(username, str) or not re.fullmatch(r'[a-z0-9_-]{1,100}', username) or username in seen:
                    raise ValueError
                if any(not isinstance(row[k], str) or not row[k].strip() or len(row[k]) > 150 for k in ('first_name', 'last_name')):
                    raise ValueError
                seen.add(username)
        except (OSError, ValueError, TypeError):
            raise CommandError('Use a valid staff roster with unique normalized usernames and names.') from None
        for row in rows:
            user = User.objects.select_for_update().filter(username__iexact=row['intra_username']).first()
            created = user is None
            if created:
                user = User(username=row['intra_username'])
            promoted = user.role != 'staff'
            if not created and not user.is_active:
                raise CommandError(f'{user.username} is disabled; resolve this explicitly before provisioning.')
            if created or promoted:
                # A student credential verified at the student domain cannot
                # authenticate a newly privileged staff identity.
                user.set_unusable_password()
                user.email_verified_at = None
                user.approved_at = timezone.now()
                user.approved_by = None
            user.role, user.is_staff = 'staff', True
            user.first_name, user.last_name = row['first_name'].strip(), row['last_name'].strip()
            user.email = f'{user.username}@42amman.com'
            user.save()
            if created or promoted:
                SetupToken.objects.filter(user=user, used_at__isnull=True).update(used_at=timezone.now())
                AccountAudit.objects.create(subject=user, action='Staff provisioned', detail={'source': 'Trusted local roster'})
            self.stdout.write(f'{user.username}: staff provisioned' if created or promoted else f'{user.username}: staff retained')
        self.stdout.write(self.style.SUCCESS('Staff roster saved. Email verification and password setup are still required.'))
