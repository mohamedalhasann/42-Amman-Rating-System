from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone

from profiles.models import User, StudentProfile, VotingWindow, WindowParticipant


class Command(BaseCommand):
    help = 'Seeds active students and an open voting window for immediate demo/testing'

    def handle(self, *args, **options):
        now = timezone.now()
        self.stdout.write("Seeding students and active voting window...")

        # 1. Active Voting Window
        window, _ = VotingWindow.objects.get_or_create(
            name="Sprint 1 - Common Core Voting",
            defaults={
                'starts_at': now - timedelta(days=2),
                'ends_at': now + timedelta(days=5),
                'min_votes': 1,
                'max_votes': 10
            }
        )
        self.stdout.write(f"[OK] Voting window: '{window.name}' (max_votes: {window.max_votes})")

        # 2. Staff user passwords
        staff_users = ['admin', 'jsukkari', 'malhaimo', 'mosalim', 'abeleima', 'daomar']
        for username in staff_users:
            u = User.objects.filter(username=username).first()
            if u:
                u.set_password('admin123')
                u.email_verified_at = now
                u.approved_at = now
                u.save()
        self.stdout.write(f"[OK] Staff passwords set to 'admin123' for: {', '.join(staff_users)}")

        # 3. 10 Approved Students
        students_roster = [
            ("aal-hadd", "Ali", "Al-Haddad", 101),
            ("mhasan", "Mohamed", "Hasan", 102),
            ("hshater", "Hadi", "Shater", 103),
            ("tqasem", "Tariq", "Qasem", 104),
            ("ykhaled", "Yazan", "Khaled", 105),
            ("sodeh", "Sara", "Odeh", 106),
            ("oamr", "Omar", "Amr", 107),
            ("kzaid", "Karam", "Zaid", 108),
            ("lmasri", "Lina", "Masri", 109),
            ("nfarah", "Nour", "Farah", 110),
        ]

        for intra, fn, ln, intra_id in students_roster:
            u, _ = User.objects.get_or_create(
                username=intra,
                defaults={
                    'first_name': fn,
                    'last_name': ln,
                    'email': f"{intra}@student.42amman.com",
                    'role': 'student',
                    'email_verified_at': now,
                    'approved_at': now
                }
            )
            u.set_password('student123')
            u.email_verified_at = now
            u.approved_at = now
            u.save()

            sp, _ = StudentProfile.objects.get_or_create(
                user=u,
                defaults={
                    'intra_id': intra_id,
                    'campus_id': 35,
                    'intra_active': True,
                    'eligibility_status': 'eligible',
                    'profile_synced_at': now,
                    'onboarded': True,
                    'accent': '#00CED1'
                }
            )

            # Link student to active window participant roster
            WindowParticipant.objects.get_or_create(window=window, student=sp)

        self.stdout.write(self.style.SUCCESS(f"[OK] Successfully seeded 10 approved students with password 'student123'!"))
