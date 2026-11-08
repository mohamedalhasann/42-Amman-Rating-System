import os
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')
DEBUG = os.getenv('DJANGO_DEBUG', 'false').lower() == 'true'
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', '')
if not SECRET_KEY:
    if not DEBUG:
        raise ImproperlyConfigured('Set DJANGO_SECRET_KEY, or enable DJANGO_DEBUG for local development.')
    SECRET_KEY = 'local-development-only-do-not-deploy'
ALLOWED_HOSTS = os.getenv('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')
CSRF_TRUSTED_ORIGINS = [s for s in os.getenv('DJANGO_CSRF_TRUSTED_ORIGINS', '').split(',') if s]
if DEBUG:
    CSRF_TRUSTED_ORIGINS += ['http://127.0.0.1:5173', 'http://localhost:5173']
INSTALLED_APPS = [
    'django.contrib.admin', 'django.contrib.auth', 'django.contrib.contenttypes',
    'django.contrib.sessions', 'django.contrib.messages', 'django.contrib.staticfiles',
    'profiles',
]
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware', 'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware', 'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware', 'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]
ROOT_URLCONF = 'config.urls'
TEMPLATES = [{'BACKEND': 'django.template.backends.django.DjangoTemplates', 'DIRS': [], 'APP_DIRS': True,
              'OPTIONS': {'context_processors': ['django.template.context_processors.request',
                  'django.contrib.auth.context_processors.auth', 'django.contrib.messages.context_processors.messages']}}]
WSGI_APPLICATION = 'config.wsgi.application'
database_url = os.getenv('DATABASE_URL', '')
if database_url:
    db = urlsplit(database_url)
    if db.scheme not in ('postgres', 'postgresql'):
        raise ImproperlyConfigured('DATABASE_URL must use PostgreSQL.')
    DATABASES = {'default': {'ENGINE': 'django.db.backends.postgresql', 'NAME': unquote(db.path.lstrip('/')),
        'USER': unquote(db.username or ''), 'PASSWORD': unquote(db.password or ''),
        'HOST': db.hostname, 'PORT': db.port or 5432, 'CONN_MAX_AGE': 60,
        'OPTIONS': {'sslmode': parse_qs(db.query).get('sslmode', ['prefer' if DEBUG else 'require'])[0]}}}
elif DEBUG:
    DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': BASE_DIR / 'db.sqlite3',
        'OPTIONS': {'transaction_mode': 'IMMEDIATE', 'timeout': 20}}}
else:
    raise ImproperlyConfigured('Set DATABASE_URL to a PostgreSQL database.')
AUTH_USER_MODEL = 'profiles.User'
AUTH_PASSWORD_VALIDATORS = [{'NAME': 'django.contrib.auth.password_validation.' + name} for name in [
    'UserAttributeSimilarityValidator', 'MinimumLengthValidator', 'CommonPasswordValidator', 'NumericPasswordValidator']]
AUTH_PASSWORD_VALIDATORS[1]['OPTIONS'] = {'min_length': 10}
LANGUAGE_CODE = 'en'
TIME_ZONE = 'Asia/Amman'
USE_TZ = True
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
PRIVATE_MEDIA_ROOT = Path(os.getenv('PRIVATE_MEDIA_ROOT', str(BASE_DIR / 'private-media')))
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SECURE_SSL_REDIRECT = not DEBUG
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
FORTYTWO_CLIENT_ID = os.getenv('FORTYTWO_CLIENT_ID', '')
FORTYTWO_CLIENT_SECRET = os.getenv('FORTYTWO_CLIENT_SECRET', '')
FORTYTWO_ACCESS_TOKEN = os.getenv('FORTYTWO_ACCESS_TOKEN', '')
FORTYTWO_IMAGE_HOSTS = tuple(h.strip().lower() for h in os.getenv('FORTYTWO_IMAGE_HOSTS', 'cdn.intra.42.fr').split(',') if h.strip())
EMAIL_BACKEND = os.getenv('EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend' if DEBUG else 'django.core.mail.backends.smtp.EmailBackend')
if not DEBUG and EMAIL_BACKEND.endswith('console.EmailBackend'):
    raise ImproperlyConfigured('Console email is for local development only.')
EMAIL_HOST = os.getenv('EMAIL_HOST', '')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', '587'))
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'true').lower() == 'true'
EMAIL_TIMEOUT = 10
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', 'Fairly <noreply@42amman.com>')
ACCOUNT_ORIGIN = os.getenv('ACCOUNT_ORIGIN', 'http://127.0.0.1:8000' if DEBUG else '').rstrip('/')
origin = urlsplit(ACCOUNT_ORIGIN)
if (not origin.hostname or origin.username or origin.password or origin.query or origin.fragment
        or origin.path or origin.scheme not in ('http', 'https') or (not DEBUG and origin.scheme != 'https')):
    raise ImproperlyConfigured('ACCOUNT_ORIGIN must be a trusted origin without a path, using HTTPS outside debug mode.')
SETUP_TOKEN_SECONDS = 1800
SESSION_COOKIE_AGE = 8 * 3600
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_FAILURE_VIEW = 'profiles.auth_views.csrf_failure'
# A campus may share one public IP; account-specific limits provide the tighter bound.
AUTH_SETUP_IP_LIMIT = int(os.getenv('AUTH_SETUP_IP_LIMIT', '300'))
AUTH_LOGIN_IP_LIMIT = int(os.getenv('AUTH_LOGIN_IP_LIMIT', '600'))
AUTH_LOGIN_ACCOUNT_LIMIT = int(os.getenv('AUTH_LOGIN_ACCOUNT_LIMIT', '10'))
AUTH_COMPLETE_IP_LIMIT = int(os.getenv('AUTH_COMPLETE_IP_LIMIT', '300'))
