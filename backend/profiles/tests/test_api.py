from tempfile import TemporaryDirectory

from django.core.files.base import ContentFile
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from profiles.models import StudentProfile, User


class ProfileApiTests(TestCase):
    def setUp(self):
        self.directory = TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.override = override_settings(PRIVATE_MEDIA_ROOT=self.directory.name)
        self.override.enable()
        self.addCleanup(self.override.disable)
        self.student = User.objects.create_user(username='student', first_name='Example', last_name='Person',
            password='test-password', email_verified_at=timezone.now(), approved_at=timezone.now())
        self.profile = StudentProfile.objects.create(user=self.student, intra_id=123, campus_id=99, profile_synced_at=timezone.now(), eligibility_status='eligible', intra_active=True)
        self.profile.photo.save('test.jpg', ContentFile(b'example-photo'))
        self.staff = User.objects.create_superuser(username='admin', password='test-password')

    def test_no_public_profile_or_photo_endpoints(self):
        for url in ('/api/v1/me', '/api/v1/staff/students', reverse('profile-photo', args=[self.profile.pk])):
            response = self.client.get(url)
            self.assertEqual(response.status_code, 401)
            self.assertIn('no-store', response['Cache-Control'])

    def test_role_approval_and_explicit_identity_fields(self):
        self.client.force_login(self.student)
        response = self.client.get('/api/v1/me')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(set(response.json()), {'id', 'intra_username', 'first_name', 'last_name', 'photo_url', 'picture_url', 'role', 'status', 'profile'})
        self.assertEqual(self.client.get('/api/v1/staff/students').status_code, 403)
        self.student.approved_at = None
        self.student.save()
        self.assertEqual(self.client.get('/api/v1/me').json()['status'], 'pending')
        self.assertEqual(self.client.get('/api/v1/student/dashboard').status_code, 403)

    def test_staff_search_pagination_and_private_photos(self):
        self.client.force_login(self.staff)
        self.assertEqual(self.client.get('/api/v1/staff/students?query=EXAMP').json()['items'][0]['intra_username'], 'student')
        self.assertEqual(self.client.get('/api/v1/staff/students?query=absent').json()['items'], [])
        for query in ('limit=0', 'limit=101', 'cursor=broken'):
            self.assertEqual(self.client.get('/api/v1/staff/students?' + query).status_code, 400)
        user = User.objects.create_user(username='another')
        StudentProfile.objects.create(user=user, intra_id=456, campus_id=99, profile_synced_at=timezone.now(), eligibility_status='eligible', intra_active=True)
        page = self.client.get('/api/v1/staff/students?limit=1').json()
        self.assertEqual(len(page['items']), 1)
        next_page = self.client.get('/api/v1/staff/students?limit=1&cursor=' + page['next_cursor']).json()
        self.assertNotEqual(page['items'][0]['id'], next_page['items'][0]['id'])
        self.assertIsNone(next_page['next_cursor'])
        response = self.client.get(reverse('profile-photo', args=[self.profile.pk]))
        self.assertEqual(b''.join(response.streaming_content), b'example-photo')
        self.assertIn('no-store', response['Cache-Control'])
        self.assertEqual(response['Content-Type'], 'image/jpeg')

    def test_students_cannot_view_pending_profile_photos(self):
        pending = User.objects.create_user(username='pending')
        profile = StudentProfile.objects.create(user=pending, intra_id=456, campus_id=99, profile_synced_at=timezone.now())
        profile.photo.save('pending.jpg', ContentFile(b'private'))
        self.client.force_login(self.student)
        self.assertEqual(self.client.get(reverse('profile-photo', args=[profile.pk])).status_code, 404)

    def test_unchecked_and_excluded_profiles_are_not_in_directory_or_student_access(self):
        self.client.force_login(self.staff)
        for status in ('unchecked', 'excluded'):
            self.profile.eligibility_status = status
            self.profile.save()
            self.assertEqual(self.client.get('/api/v1/staff/students').json()['items'], [])
            self.assertEqual(self.client.get(reverse('profile-photo', args=[self.profile.pk])).status_code, 404)
        self.client.force_login(self.student)
        self.assertEqual(self.client.get('/api/v1/me').status_code, 403)

    def test_admin_defaults_to_eligible_profiles_and_can_inspect_older_records(self):
        self.profile.eligibility_status = 'unchecked'
        self.profile.save()
        self.client.force_login(self.staff)
        response = self.client.get('/admin/profiles/studentprofile/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['cl'].result_count, 0)
        response = self.client.get('/admin/profiles/studentprofile/?eligibility=all')
        self.assertEqual(response.context['cl'].result_count, 1)
