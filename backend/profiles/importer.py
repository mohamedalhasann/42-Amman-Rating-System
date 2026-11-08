import hashlib
import re
import warnings
from io import BytesIO

from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone
from PIL import Image, ImageOps, UnidentifiedImageError

from .fortytwo import ImportFailure
from .eligibility import POLICY, check_eligibility
from .models import StudentProfile, User


def validate_profile(data, campus_id):
    if not isinstance(data, dict):
        raise ImportFailure('Invalid user response.')
    if not check_eligibility(data, campus_id):
        return None
    intra_id = data.get('id')
    username = data.get('login')
    if type(intra_id) is not int or intra_id <= 0 or not isinstance(username, str):
        raise ImportFailure('User ID or login is missing.')
    username = username.strip().lower()
    if not re.fullmatch(r'[a-z0-9_-]{1,100}', username):
        raise ImportFailure('User login has an unsupported format.')
    names = [data.get('first_name'), data.get('last_name')]
    if any(not isinstance(n, str) or not n.strip() or len(n.strip()) > 150 for n in names):
        raise ImportFailure('User first or last name is missing or invalid.')
    image = data.get('image') or {}
    if not isinstance(image, dict):
        raise ImportFailure('Invalid photo metadata.')
    versions = image.get('versions') or {}
    photo_url = (versions.get('medium') or image.get('link')) if isinstance(versions, dict) else image.get('link')
    if photo_url is not None and not isinstance(photo_url, str):
        raise ImportFailure('Invalid photo URL.')
    return {'intra_id': intra_id, 'username': username, 'first_name': names[0].strip(),
            'last_name': names[1].strip(), 'photo_url': photo_url}


def normalize_photo(content):
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(BytesIO(content)) as source:
                if source.width * source.height > 16_000_000:
                    raise ImportFailure('Photo dimensions exceed the limit.')
                source.load()
                image = ImageOps.exif_transpose(source).convert('RGB')
                image.thumbnail((512, 512))
                output = BytesIO()
                # Re-encode without EXIF metadata or source-file contents.
                image.save(output, 'JPEG', quality=85)
                return output.getvalue()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise ImportFailure('Photo is not a supported safe image.') from None


def import_profile(data, campus_id, client, *, dry_run=False, photos=True):
    value = validate_profile(data, campus_id)
    if value is None:
        # Retain historical identities and credentials; remove them from eligibility.
        if not dry_run and type(data.get('id')) is int:
            StudentProfile.objects.filter(intra_id=data['id'], campus_id=campus_id).update(
                eligibility_status='excluded', eligibility_policy=POLICY,
                eligibility_checked_at=timezone.now(), intra_active=data.get('active?') if type(data.get('active?')) is bool else None)
        return 'skipped'
    existing = StudentProfile.objects.filter(intra_id=value['intra_id']).first()
    if User.objects.filter(username__iexact=value['username']).exclude(pk=existing.user_id if existing else None).exists():
        raise ImportFailure('Username conflicts with an existing account; no accounts were merged.')
    if dry_run:
        return 'updated' if existing else 'created'
    photo = normalize_photo(client.photo_bytes(value['photo_url'])) if photos and value['photo_url'] else None
    with transaction.atomic():
        profile = StudentProfile.objects.select_for_update().filter(intra_id=value['intra_id']).first()
        if profile:
            user = User.objects.select_for_update().get(pk=profile.user_id)
            if user.role != 'student':
                raise ImportFailure('Imported profile belongs to a non-student account.')
        else:
            user = User(role='student')
            user.set_unusable_password()
        user.username = value['username']
        user.first_name = value['first_name']
        user.last_name = value['last_name']
        user.full_clean(exclude=['password'])
        user.save()
        created = profile is None
        if created:
            profile = StudentProfile(user=user, intra_id=value['intra_id'])
        profile.campus_id = campus_id
        profile.intra_active = True
        profile.eligibility_status = 'eligible'
        profile.eligibility_policy = POLICY
        profile.eligibility_checked_at = timezone.now()
        profile.profile_synced_at = timezone.now()
        if photo:
            filename = f'profiles/{profile.id}/{hashlib.sha256(photo).hexdigest()}.jpg'
            storage = profile.photo.storage
            if not storage.exists(filename):
                filename = storage.save(filename, ContentFile(photo))
            profile.photo.name = filename
            profile.photo_synced_at = timezone.now()
        profile.save()
    return 'created' if created else 'updated'
