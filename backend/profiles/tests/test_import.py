from io import BytesIO, StringIO
from tempfile import TemporaryDirectory
from unittest.mock import Mock, patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings
from django.utils import timezone
from PIL import Image

from profiles.fortytwo import FortyTwoClient, ImportFailure, PhotoAccessDenied
from profiles.importer import import_profile
from profiles.models import ImportRun, StudentProfile, User


def fixture(**changes):
    return {'id': 123, 'login': 'example', 'first_name': 'Example', 'last_name': 'Student',
            'active?': True, 'cursus_users': [{'cursus': {'id': 21, 'slug': '42cursus', 'name': '42cursus'}}],
            'campus': [{'id': 99, 'name': 'Amman'}], 'image': {'link': 'https://cdn.intra.42.fr/photo.jpg'}, **changes}


def image_bytes():
    result = BytesIO()
    Image.new('RGB', (600, 400), 'cyan').save(result, 'PNG')
    return result.getvalue()


def membership(user_id):
    return {'id': user_id, 'user': {'id': user_id}, 'cursus_id': 21,
            'cursus': {'id': 21, 'name': '42cursus', 'slug': '42cursus'}}


CURSUS = {'id': 21, 'name': '42cursus', 'slug': '42cursus'}


class ImportTests(TestCase):
    def test_only_active_42cursus_profiles_are_imported(self):
        for changes in [
            {'active?': False}, {'cursus_users': []},
            {'cursus_users': [{'cursus': {'name': 'C Piscine', 'slug': 'c-piscine'}}]},
            {'cursus_users': [{'cursus': {'name': 'Pro Piscine - Web Application Security Fundamentals', 'slug': 'pro-piscine-web-security'}}]},
        ]:
            self.assertEqual(import_profile(fixture(**changes), 99, self.api, photos=False), 'skipped')
        self.assertEqual(StudentProfile.objects.count(), 0)
        with self.assertRaisesMessage(ImportFailure, 'activation status is missing'):
            import_profile(fixture(**{'active?': None}), 99, self.api, photos=False)
        with self.assertRaisesMessage(ImportFailure, 'enrollment data is missing'):
            import_profile(fixture(cursus_users=None), 99, self.api, photos=False)
        multiple = fixture()['cursus_users'] + [{'cursus': {'name': 'C Piscine', 'slug': 'c-piscine'}}]
        self.assertEqual(import_profile(fixture(cursus_users=multiple), 99, self.api, photos=False), 'created')
        self.assertEqual(StudentProfile.objects.get().eligibility_status, 'eligible')

    def test_previously_imported_piscine_is_excluded_without_deletion(self):
        import_profile(fixture(), 99, self.api, photos=False)
        profile = StudentProfile.objects.get()
        user = profile.user
        user.set_password('retained-password')
        user.approved_at = user.email_verified_at = timezone.now()
        user.save()
        old_password = user.password
        self.assertEqual(import_profile(fixture(cursus_users=[]), 99, self.api, photos=False, dry_run=True), 'skipped')
        profile.refresh_from_db()
        self.assertEqual(profile.eligibility_status, 'eligible')
        self.assertEqual(import_profile(fixture(cursus_users=[]), 99, self.api, photos=False), 'skipped')
        profile.refresh_from_db()
        user.refresh_from_db()
        self.assertEqual(profile.eligibility_status, 'excluded')
        self.assertEqual(user.password, old_password)
        self.assertIsNotNone(user.approved_at)
        self.assertTrue(user.is_active)
        self.assertEqual(StudentProfile.objects.count(), 1)

    def setUp(self):
        self.directory = TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.settings_override = override_settings(PRIVATE_MEDIA_ROOT=self.directory.name)
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)
        self.api = Mock()
        self.api.photo_bytes.return_value = image_bytes()

    def test_import_and_reimport_preserve_access_and_stable_id(self):
        self.assertEqual(import_profile(fixture(), 99, self.api), 'created')
        profile = StudentProfile.objects.select_related('user').get(intra_id=123)
        user = profile.user
        self.assertFalse(user.has_usable_password())
        self.assertIsNone(user.approved_at)
        self.assertIsNone(user.email_verified_at)
        original_id, original_photo = profile.id, profile.photo.name
        with profile.photo.open() as stream:
            with Image.open(stream) as photo:
                self.assertEqual(photo.format, 'JPEG')
                self.assertEqual(photo.width, 512)
        user.set_password('local-test-password')
        user.approved_at = user.email_verified_at = timezone.now()
        user.is_active = False
        user.save()
        original_password = user.password
        self.assertEqual(import_profile(fixture(login='changed', first_name='New'), 99, self.api), 'updated')
        profile.refresh_from_db()
        user.refresh_from_db()
        self.assertEqual(profile.id, original_id)
        self.assertEqual(profile.photo.name, original_photo)
        self.assertEqual(user.username, 'changed')
        self.assertEqual(user.password, original_password)
        self.assertIsNotNone(user.approved_at)
        self.assertIsNotNone(user.email_verified_at)
        self.assertFalse(user.is_active)
        self.assertEqual(StudentProfile.objects.count(), 1)

    def test_campus_staff_duplicates_and_dry_run(self):
        with self.assertRaises(ImportFailure):
            import_profile(fixture(campus=[{'id': 1}]), 99, self.api)
        self.assertEqual(import_profile(fixture(**{'staff?': True}), 99, self.api), 'skipped')
        self.assertEqual(import_profile(fixture(), 99, self.api, dry_run=True), 'created')
        self.assertEqual(User.objects.count(), 0)
        self.api.photo_bytes.assert_not_called()
        User.objects.create_user(username='Example', password='unchanged')
        with self.assertRaises(ImportFailure):
            import_profile(fixture(), 99, self.api)
        self.assertEqual(StudentProfile.objects.count(), 0)

    def test_failed_photo_preserves_profile_and_skip_photos_works(self):
        import_profile(fixture(), 99, self.api)
        before = StudentProfile.objects.get().photo.name
        self.api.photo_bytes.return_value = b'<html>invalid</html>'
        with self.assertRaises(ImportFailure):
            import_profile(fixture(first_name='Unsafe update'), 99, self.api)
        self.assertEqual(User.objects.get().first_name, 'Example')
        self.assertEqual(StudentProfile.objects.get().photo.name, before)
        import_profile(fixture(first_name='Names only'), 99, self.api, photos=False)
        self.assertEqual(User.objects.get().first_name, 'Names only')
        self.assertEqual(StudentProfile.objects.get().photo.name, before)

    @patch('profiles.management.commands.import_42_profiles.FortyTwoClient')
    def test_command_dry_run_completion_and_failure(self, cls):
        api = cls.return_value
        api.get.return_value = {'id': 99, 'name': 'Amman'}
        api.campus_users.side_effect = lambda campus: iter([fixture()])
        api.photo_bytes.return_value = image_bytes()
        output = StringIO()
        call_command('import_42_profiles', campus_id=99, dry_run=True, stdout=output)
        self.assertEqual(ImportRun.objects.count(), 0)
        self.assertEqual(StudentProfile.objects.count(), 0)
        call_command('import_42_profiles', campus_id=99, stdout=output)
        self.assertEqual(ImportRun.objects.get().status, 'complete')
        api.campus_users.side_effect = lambda campus: iter([fixture(campus=[])])
        with self.assertRaises(CommandError):
            call_command('import_42_profiles', campus_id=99, stdout=output, stderr=StringIO())
        self.assertEqual(ImportRun.objects.order_by('-id').first().status, 'incomplete')


    @patch('profiles.management.commands.import_42_profiles.FortyTwoClient')
    def test_sample_limits_roster_reads_and_is_not_marked_complete(self, cls):
        api = cls.return_value
        api.get.return_value = {'id': 99, 'name': 'Amman'}
        def rows(campus):
            yield fixture()
            raise AssertionError('Sample fetched beyond the requested limit')
        api.campus_users.side_effect = rows
        api.photo_bytes.return_value = image_bytes()
        output = StringIO()
        call_command('import_42_profiles', campus_id=99, limit=1, dry_run=True, stdout=output)
        self.assertEqual(StudentProfile.objects.count(), 0)
        self.assertIn('Sample complete', output.getvalue())
        call_command('import_42_profiles', campus_id=99, limit=1, stdout=StringIO())
        self.assertEqual(ImportRun.objects.get().status, 'sample')
        self.assertEqual(StudentProfile.objects.count(), 1)
        with self.assertRaises(CommandError):
            call_command('import_42_profiles', campus_id=99, limit=0, stdout=StringIO())


    @patch('profiles.management.commands.import_42_profiles.FortyTwoClient')
    def test_cdn_access_denied_stops_run_and_preserves_existing_records(self, cls):
        api = cls.return_value
        api.get.return_value = {'id': 99, 'name': 'Amman'}
        def rows(campus):
            yield fixture(image={})
            yield fixture(id=456, login='photo-user')
            raise AssertionError('Importer continued after a CDN authorization failure')
        api.campus_users.side_effect = rows
        api.photo_bytes.side_effect = PhotoAccessDenied('Photo CDN returned HTTP 403; use --skip-photos.')
        with self.assertRaisesMessage(CommandError, 'Photo CDN returned HTTP 403'):
            call_command('import_42_profiles', campus_id=99, stdout=StringIO())
        self.assertEqual(StudentProfile.objects.count(), 1)
        self.assertEqual(User.objects.get().username, 'example')
        run = ImportRun.objects.get()
        self.assertEqual(run.status, 'incomplete')
        self.assertEqual(run.created, 1)
        self.assertEqual(run.failed, 1)
        api.photo_bytes.assert_called_once()

    @patch('profiles.management.commands.import_42_profiles.FortyTwoClient')
    def test_resume_rechecks_profiles_imported_before_eligibility_policy(self, cls):
        from profiles.eligibility import POLICY
        user = User.objects.create_user(username='old-import')
        StudentProfile.objects.create(user=user, intra_id=999, campus_id=99, profile_synced_at=timezone.now())
        import_profile(fixture(), 99, self.api, photos=False)
        api = cls.return_value
        api.skipped_existing = 1
        api.get.return_value = {'name': 'Amman'}
        api.campus_users.return_value = iter([])
        call_command('import_42_profiles', campus_id=99, resume=True, skip_photos=True, stdout=StringIO())
        api.campus_users.assert_called_once_with(99, skip_ids={123})
        self.assertEqual(StudentProfile.objects.get(intra_id=123).eligibility_policy, POLICY)


class ClientTests(TestCase):
    @override_settings(FORTYTWO_ACCESS_TOKEN='fake-test-token')
    def test_resume_does_not_fetch_saved_profile_details(self):
        api = FortyTwoClient(interval=0)
        self.addCleanup(api.close)
        with patch.object(api, 'get', side_effect=[CURSUS, [fixture(), fixture(id=456)], [membership(456)], []]) as get:
            self.assertEqual([p['id'] for p in api.campus_users(99, skip_ids={123})], [456])
            self.assertEqual(api.skipped_existing, 1)
            self.assertNotIn('/v2/users/123', [call.args[0] for call in get.call_args_list])
            self.assertNotIn('/v2/users/456', [call.args[0] for call in get.call_args_list])

    @override_settings(FORTYTWO_ACCESS_TOKEN='fake-test-token')
    @patch('profiles.fortytwo.time.sleep')
    def test_long_retry_delay_is_reported_and_not_retried_early(self, sleep):
        api = FortyTwoClient(interval=0)
        self.addCleanup(api.close)
        response = Mock(status_code=429, headers={'Retry-After': '1800'})
        with patch.object(api.session, 'request', return_value=response) as request:
            with self.assertRaisesMessage(ImportFailure, 'retry after 1800 seconds'):
                api.get('/v2/users')
            request.assert_called_once()
        response.headers = {'Retry-After': 'Wed, 21 Oct 2015 07:28:00 GMT'}
        with patch('profiles.fortytwo.time.time', return_value=1445411880), patch.object(api.session, 'request', return_value=response):
            with self.assertRaisesMessage(ImportFailure, 'retry after 600 seconds'):
                api.get('/v2/users')

    @override_settings(FORTYTWO_ACCESS_TOKEN='fake-test-token', FORTYTWO_IMAGE_HOSTS=('cdn.intra.42.fr',))
    def test_photo_allowlist_and_no_bearer_token(self):
        api = FortyTwoClient(interval=0)
        self.addCleanup(api.close)
        for url in ('http://cdn.intra.42.fr/a', 'https://evil.example/a', 'https://127.0.0.1/a', 'https://cdn.intra.42.fr@evil.example/a'):
            with self.assertRaises(ImportFailure):
                api.photo_bytes(url)
        response = Mock(status_code=200)
        response.iter_content.return_value = [b'picture']
        with patch.object(api.session, 'request', return_value=response) as request:
            self.assertEqual(api.photo_bytes('https://cdn.intra.42.fr/a'), b'picture')
            self.assertNotIn('headers', request.call_args.kwargs)
            self.assertFalse(request.call_args.kwargs['allow_redirects'])

    @override_settings(FORTYTWO_ACCESS_TOKEN='fake-test-token')
    def test_pagination_fetches_every_profile_and_rejects_repeated_pages(self):
        api = FortyTwoClient(interval=0)
        self.addCleanup(api.close)
        with patch.object(api, 'get', side_effect=[CURSUS, [fixture()], [membership(123)], []]) as get:
            profiles = list(api.campus_users(99))
            self.assertEqual(profiles[0]['id'], 123)
            self.assertEqual(profiles[0]['cursus_users'], [membership(123)])
            self.assertEqual(get.call_count, 4)
        with patch.object(api, 'get', side_effect=[CURSUS, [fixture()], [membership(123)], [fixture()]]):
            with self.assertRaises(ImportFailure):
                list(api.campus_users(99))
        with patch.object(api, 'get', side_effect=[CURSUS, [fixture()], [membership(456)]]):
            with self.assertRaises(ImportFailure):
                list(api.campus_users(99))

    @override_settings(FORTYTWO_ACCESS_TOKEN='fake-test-token')
    def test_batches_100_profiles_without_individual_profile_requests(self):
        api = FortyTwoClient(interval=0)
        self.addCleanup(api.close)
        roster = [fixture(id=i) for i in range(1, 101)]
        enrollments = [membership(i) for i in range(1, 101)]
        with patch.object(api, 'get', side_effect=[CURSUS, roster, enrollments, [], []]) as get:
            self.assertEqual(len(list(api.campus_users(99))), 100)
            self.assertEqual(get.call_count, 5)
            self.assertFalse(any(call.args[0].startswith('/v2/users/') for call in get.call_args_list))

    @override_settings(FORTYTWO_ACCESS_TOKEN='fake-test-token')
    def test_inactive_and_staff_skip_membership_requests_and_piscine_remains_excluded(self):
        from profiles.eligibility import check_eligibility
        api = FortyTwoClient(interval=0)
        self.addCleanup(api.close)
        rows = [fixture(**{'active?': False}), fixture(id=456, **{'staff?': True})]
        with patch.object(api, 'get', side_effect=[CURSUS, rows, []]) as get:
            profiles = list(api.campus_users(99))
            self.assertEqual(len(profiles), 2)
            self.assertTrue(all(not check_eligibility(p, 99) for p in profiles))
            self.assertEqual(get.call_count, 3)
        with patch.object(api, 'get', side_effect=[CURSUS, [fixture()], [], []]):
            profile = list(api.campus_users(99))[0]
            self.assertFalse(check_eligibility(profile, 99))

    @override_settings(FORTYTWO_ACCESS_TOKEN='fake-test-token')
    def test_batch_enrollment_pagination_and_identity_validation(self):
        api = FortyTwoClient(interval=0)
        self.addCleanup(api.close)
        repeated = [membership(i) for i in range(1, 101)]
        with patch.object(api, 'get', side_effect=[repeated, repeated]):
            with self.assertRaises(ImportFailure):
                api._cursus_memberships(21, set(range(1, 101)))
        for bad in [{**membership(123), 'cursus_id': 9}, {**membership(123), 'cursus': {'id': 21, 'name': 'Pro Piscine'}}]:
            with patch.object(api, 'get', return_value=[bad]):
                with self.assertRaises(ImportFailure):
                    api._cursus_memberships(21, {123})

    @override_settings(FORTYTWO_ACCESS_TOKEN='fake-test-token')
    def test_incomplete_roster_row_falls_back_to_verified_detail(self):
        api = FortyTwoClient(interval=0)
        self.addCleanup(api.close)
        with patch.object(api, 'get', side_effect=[CURSUS, [{'id': 123}], [membership(123)], fixture(), []]):
            self.assertEqual(list(api.campus_users(99)), [fixture()])
        with patch.object(api, 'get', side_effect=[CURSUS, [{'id': 123}], [membership(123)], fixture(id=456)]):
            with self.assertRaises(ImportFailure):
                list(api.campus_users(99))

    @override_settings(FORTYTWO_ACCESS_TOKEN='fake-test-token')
    @patch('profiles.fortytwo.time.sleep')
    def test_bounded_retries_and_sanitized_errors(self, sleep):
        api = FortyTwoClient(interval=0)
        self.addCleanup(api.close)
        retry = Mock(status_code=429, headers={'Retry-After': '0'})
        success = Mock(status_code=200)
        success.json.return_value = []
        with patch.object(api.session, 'request', side_effect=[retry, success]) as request:
            self.assertEqual(api.get('/v2/users'), [])
            self.assertEqual(request.call_count, 2)
        with patch.object(api.session, 'request', return_value=Mock(status_code=401)):
            with self.assertRaises(ImportFailure) as error:
                api.get('/v2/users')
            self.assertNotIn('fake-test-token', str(error.exception))

    @override_settings(FORTYTWO_ACCESS_TOKEN='fake-test-token', FORTYTWO_IMAGE_HOSTS=('cdn.intra.42.fr',))
    def test_cdn_403_is_distinct_from_api_failure(self):
        api = FortyTwoClient(interval=0)
        self.addCleanup(api.close)
        with patch.object(api.session, 'request', return_value=Mock(status_code=403)):
            with self.assertRaisesMessage(PhotoAccessDenied, 'Photo CDN returned HTTP 403'):
                api.photo_bytes('https://cdn.intra.42.fr/photo.jpg')
            with self.assertRaisesMessage(ImportFailure, '42 API returned HTTP 403') as error:
                api.get('/v2/users')
            self.assertNotIsInstance(error.exception, PhotoAccessDenied)
