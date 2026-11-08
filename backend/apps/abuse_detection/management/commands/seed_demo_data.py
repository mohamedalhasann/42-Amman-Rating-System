from datetime import timedelta
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone

from apps.ratings.models import Student, VotingWindow, Label, LabelStar
from apps.abuse_detection.models import AntiAbuseSettings


class Command(BaseCommand):
    help = 'Seeds 42 Amman demo data (staff user, students, labels, active window) for immediate live testing'

    def handle(self, *args, **options):
        self.stdout.write("Seeding demo data for 42 Amman Rating System...")

        # 1. Staff Admin User
        admin_user, created = User.objects.get_or_create(
            username='admin',
            defaults={
                'first_name': 'Staff',
                'last_name': 'Admin',
                'email': 'staff@42amman.com',
                'is_staff': True,
                'is_superuser': True
            }
        )
        admin_user.set_password('admin123')
        admin_user.save()
        self.stdout.write(self.style.SUCCESS("[OK] Staff User: 'admin' (password: 'admin123')"))

        # 2. Active Voting Window
        now = timezone.now()
        window, _ = VotingWindow.objects.get_or_create(
            name="Sprint 1 - Common Core Voting",
            defaults={
                'starts_at': now - timedelta(days=2),
                'ends_at': now + timedelta(days=3),
                'min_votes': 1,
                'max_votes': 10
            }
        )
        self.stdout.write(self.style.SUCCESS(f"[OK] Active Window: '{window.name}' (max_votes: {window.max_votes})"))

        # 3. Official Hackathon Labels
        labels_data = [
            # 3 Stars
            ("Helpful", [3, 2]),
            ("Good teammate", [3, 2]),
            ("Community contributor", [3]),
            ("Respectful", [3, 2]),
            ("Fair", [3]),
            ("Thorough", [3]),
            ("Clear explainer", [3]),
            ("Helpful feedback", [3]),
            ("Well prepared", [3]),
            ("Knows their code", [3]),
            ("Open to feedback", [3]),
            # 2 Stars
            ("Unreliable teammate", [2]),
            ("Disruptive", [2]),
            ("Rushed", [2]),
            ("Late", [2]),
            ("Defensive", [2]),
            # 1 Star
            ("Aggressive behavior", [1]),
            ("Disrespectful", [1]),
            ("Bad Evaluator", [1]),
            ("Unprepared", [1]),
        ]

        for label_name, stars_list in labels_data:
            label, _ = Label.objects.get_or_create(name=label_name, defaults={'active': True})
            for s in stars_list:
                LabelStar.objects.get_or_create(label=label, stars=s)
        self.stdout.write(self.style.SUCCESS(f"[OK] Created {len(labels_data)} official hackathon labels"))

        # 4. Realistic 42 Amman Students
        students_roster = [
            ("aal-hadd", "Ali", "Al-Haddad"),
            ("mhasan", "Mohamed", "Hasan"),
            ("hshater", "Hadi", "Shater"),
            ("tqasem", "Tariq", "Qasem"),
            ("ykhaled", "Yazan", "Khaled"),
            ("sodeh", "Sara", "Odeh"),
            ("oamr", "Omar", "Amr"),
            ("kzaid", "Karam", "Zaid"),
            ("lmasri", "Lina", "Masri"),
            ("nfarah", "Nour", "Farah"),
            ("rabbasi", "Rami", "Abbasi"),
            ("dhamdan", "Dana", "Hamdan"),
        ]

        for intra, fn, ln in students_roster:
            u, _ = User.objects.get_or_create(
                username=intra,
                defaults={'first_name': fn, 'last_name': ln, 'email': f"{intra}@student.42amman.com"}
            )
            u.set_password('student123')
            u.save()

            Student.objects.get_or_create(
                intra_username=intra,
                defaults={'first_name': fn, 'last_name': ln, 'user': u, 'campus': '42 Amman'}
            )

        self.stdout.write(self.style.SUCCESS(f"[OK] Seeded {len(students_roster)} 42 Amman student profiles (passwords: 'student123')"))

        # 5. Initialize AntiAbuseSettings singleton
        AntiAbuseSettings.get_solo()
        self.stdout.write(self.style.SUCCESS("[OK] Initialized AntiAbuseSettings defaults"))

        self.stdout.write(self.style.SUCCESS("\nDemo data successfully loaded!"))
