import re

from django.conf import settings
from django.http import FileResponse, Http404, HttpResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET


@require_GET
@never_cache
def staff_page(request):
    # The shell contains no private data. Every API and photo request enforces
    # account access independently; the React boundary handles expired sessions.
    index = settings.BASE_DIR.parent / 'staff-frontend' / 'dist' / 'index.html'
    if not index.is_file():
        return HttpResponse('Build the staff frontend first: cd staff-frontend && npm run build', status=503, content_type='text/plain')
    return FileResponse(index.open('rb'), content_type='text/html')


@require_GET
@never_cache
def student_page(request):
    index = settings.BASE_DIR.parent / 'frontend' / 'dist' / 'index.html'
    if not index.is_file():
        return HttpResponse('Build the student frontend first: cd frontend && npm run build', status=503, content_type='text/plain')
    response = FileResponse(index.open('rb'), content_type='text/html')
    response['Referrer-Policy'] = 'no-referrer'
    response['Content-Security-Policy'] = ("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'")
    return response


# Public PWA files at the site root. Only these exact names are served; nothing else from dist.
PWA_FILES = {
    'manifest.webmanifest': 'application/manifest+json',
    'sw.js': 'text/javascript',
    'icons/icon-192.png': 'image/png',
    'icons/icon-512.png': 'image/png',
    'icons/maskable-512.png': 'image/png',
    'icons/apple-touch-icon.png': 'image/png',
}


@require_GET
def pwa_file(request, name):
    kind = PWA_FILES.get(name) or ('image/jpeg' if re.fullmatch(r'cats/cat-\d{2}\.jpg', name) else None)
    if not kind:
        raise Http404
    path = settings.BASE_DIR.parent / 'frontend' / 'dist' / name
    if not path.is_file():
        raise Http404
    response = FileResponse(path.open('rb'), content_type=kind)
    if name == 'sw.js':
        # the worker must always be fresh so new builds reach students, and it controls the whole site
        response['Cache-Control'] = 'no-cache'
        response['Service-Worker-Allowed'] = '/'
    else:
        response['Cache-Control'] = 'public, max-age=86400'
    return response
