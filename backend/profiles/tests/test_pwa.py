from django.test import TestCase


class PwaFileTests(TestCase):
    def test_only_listed_files_are_served(self):
        for name in ['index.html', 'assets/x.js', 'icons/../index.html', 'icons/secret.png']:
            self.assertEqual(self.client.get('/' + name).status_code, 404, name)

    def test_worker_is_never_cached(self):
        response = self.client.get('/sw.js')
        if response.status_code == 404:
            self.skipTest('student frontend is not built')
        self.assertEqual(response['Cache-Control'], 'no-cache')
        self.assertEqual(response['Service-Worker-Allowed'], '/')
        self.assertEqual(self.client.get('/manifest.webmanifest')['Content-Type'], 'application/manifest+json')
