from django.conf import settings
from django.http import FileResponse, HttpResponse
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
