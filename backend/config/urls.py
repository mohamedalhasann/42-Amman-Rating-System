from django.contrib import admin
from django.conf import settings
from django.urls import include, path
from django.views.static import serve
from profiles.auth_views import account_page
from profiles.frontend import staff_page

urlpatterns = [path('admin/', admin.site.urls), path('api/v1/', include('profiles.urls')), path('staff/', staff_page),
               path('account/', account_page), path('account/setup/', account_page, {'setup': True})]
if settings.DEBUG:
    urlpatterns += [path('staff/assets/<path:path>', serve, {
        'document_root': settings.BASE_DIR.parent / 'staff-frontend' / 'dist' / 'assets'})]
