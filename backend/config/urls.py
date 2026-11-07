from django.contrib import admin
from django.conf import settings
from django.urls import include, path, re_path
from django.views.generic import RedirectView
from django.views.static import serve
from profiles.frontend import staff_page, student_page

urlpatterns = [path('admin/', admin.site.urls), path('api/v1/', include('profiles.urls')), path('staff/', staff_page),
               path('account/', RedirectView.as_view(url='/login')),
               path('account/setup/', RedirectView.as_view(url='/setup/complete')),
               re_path(r'^(?:login|welcome|setup(?:/complete)?|reset(?:/complete)?)?/?$', student_page)]
if settings.DEBUG:
    urlpatterns += [path('staff/assets/<path:path>', serve, {
        'document_root': settings.BASE_DIR.parent / 'staff-frontend' / 'dist' / 'assets'})]
    urlpatterns += [path('assets/<path:path>', serve, {
        'document_root': settings.BASE_DIR.parent / 'frontend' / 'dist' / 'assets'})]
