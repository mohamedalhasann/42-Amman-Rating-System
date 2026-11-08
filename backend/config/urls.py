from django.contrib import admin
from django.conf import settings
from django.urls import include, path, re_path
from django.views.generic import RedirectView
from django.views.static import serve
from profiles.frontend import pwa_file, staff_page, student_page

urlpatterns = [path('admin/', admin.site.urls), path('api/v1/', include('profiles.urls')), path('staff/', staff_page),
               re_path(r'^(?P<name>manifest\.webmanifest|sw\.js|icons/[a-z0-9-]+\.png|cats/cat-\d{2}\.jpg)$', pwa_file),
               path('account/', RedirectView.as_view(url='/login')),
               path('account/setup/', RedirectView.as_view(url='/setup/complete')),
               re_path(r'^(?:login|welcome|setup(?:/complete)?|reset(?:/complete)?)?/?$', student_page)]
# The built apps are served by Django itself, so one process is a complete deployment (no separate web
# server). Asset names are content-hashed, so they can be cached for a long time.
def built(app):
    root = settings.BASE_DIR.parent / app / 'dist' / 'assets'
    def view(request, path):
        response = serve(request, path, document_root=root)
        response['Cache-Control'] = 'public, max-age=31536000, immutable'
        return response
    return view


urlpatterns += [path('staff/assets/<path:path>', built('staff-frontend')),
                path('assets/<path:path>', built('frontend'))]
