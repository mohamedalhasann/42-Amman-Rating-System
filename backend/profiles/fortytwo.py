"""Server-only 42 client. No tokens or upstream response bodies are logged."""
import math
import time
from email.utils import parsedate_to_datetime
from urllib.parse import urlsplit

import requests
from django.conf import settings


class ImportFailure(Exception):
    pass


class PhotoAccessDenied(ImportFailure):
    pass


class FortyTwoClient:
    origin = 'https://api.intra.42.fr'

    def __init__(self, interval=0.6):
        self.session = requests.Session()
        self.token = settings.FORTYTWO_ACCESS_TOKEN
        self.expires_at = float('inf') if self.token else 0
        self.interval = interval
        self.next_request = 0
        self.skipped_existing = 0

    def close(self):
        self.session.close()

    def _request(self, method, url, **kwargs):
        for attempt in range(4):
            time.sleep(max(0, self.next_request - time.monotonic()))
            self.next_request = time.monotonic() + self.interval
            try:
                response = self.session.request(method, url, timeout=(10, 30), allow_redirects=False, **kwargs)
            except requests.RequestException:
                if attempt == 3:
                    raise ImportFailure('42 connection failed; rerun the import when access is available.') from None
                time.sleep(2 ** attempt)
                continue
            if response.status_code == 429 or response.status_code >= 500:
                status = response.status_code
                retry_after = response.headers.get('Retry-After')
                response.close()
                try:
                    delay = float(retry_after) if retry_after is not None else 2 ** attempt
                    if not math.isfinite(delay):
                        raise ValueError
                except (ValueError, TypeError):
                    try:
                        delay = parsedate_to_datetime(retry_after).timestamp() - time.time()
                    except (ValueError, TypeError, OverflowError):
                        delay = 2 ** attempt
                delay = max(0, delay)
                if delay > 30 or attempt == 3:
                    raise ImportFailure(
                        f'42 returned HTTP {status}; retry after {math.ceil(delay)} seconds. '
                        'Previously saved profiles are retained. Resume later with --skip-photos --resume.')
                time.sleep(delay)
                continue
            if response.status_code != 200:
                status = response.status_code
                response.close()
                if urlsplit(url).hostname != urlsplit(self.origin).hostname and status in (401, 403):
                    raise PhotoAccessDenied(
                        f'Photo CDN returned HTTP {status}; profile API access may still be valid. '
                        'Import stopped. Use --skip-photos to import names while photo access is resolved.')
                source = '42 API' if urlsplit(url).hostname == urlsplit(self.origin).hostname else 'Photo CDN'
                raise ImportFailure(f'{source} returned HTTP {status}. Check access to that service.')
            return response

    def _access_token(self):
        if time.monotonic() < self.expires_at:
            return self.token
        if not settings.FORTYTWO_CLIENT_ID or not settings.FORTYTWO_CLIENT_SECRET:
            raise ImportFailure('Configure FORTYTWO_CLIENT_ID and FORTYTWO_CLIENT_SECRET, or FORTYTWO_ACCESS_TOKEN.')
        response = self._request('POST', self.origin + '/oauth/token', data={
            'grant_type': 'client_credentials', 'client_id': settings.FORTYTWO_CLIENT_ID,
            'client_secret': settings.FORTYTWO_CLIENT_SECRET,
        })
        try:
            data = response.json()
            token, lifetime = data['access_token'], int(data['expires_in'])
            if not isinstance(token, str) or not token or lifetime <= 0:
                raise ValueError
        except (ValueError, KeyError, TypeError):
            raise ImportFailure('42 returned an invalid token response.') from None
        finally:
            response.close()
        self.token = token
        self.expires_at = time.monotonic() + max(1, lifetime - 30)
        return self.token

    def get(self, path, params=None):
        response = self._request('GET', self.origin + path, params=params,
                                 headers={'Authorization': 'Bearer ' + self._access_token()})
        try:
            return response.json()
        except ValueError:
            raise ImportFailure('42 returned invalid JSON.') from None
        finally:
            response.close()

    def campus_users(self, campus_id, *, skip_ids=()):
        skip_ids = set(skip_ids)
        self.skipped_existing = 0
        cursus = self.get('/v2/cursus/42cursus')
        if (not isinstance(cursus, dict) or type(cursus.get('id')) is not int
                or not (cursus.get('slug') == '42cursus' or cursus.get('name') == '42cursus')):
            raise ImportFailure('Could not verify the 42cursus identity.')
        seen = set()
        for page in range(1, 10001):
            rows = self.get(f'/v2/campus/{campus_id}/users', {'page[number]': page, 'page[size]': 100, 'sort': 'id'})
            if not isinstance(rows, list):
                raise ImportFailure('42 returned an invalid campus roster.')
            if not rows:
                return
            pending = []
            for row in rows:
                user_id = row.get('id') if isinstance(row, dict) else None
                if type(user_id) is not int or user_id <= 0 or user_id in seen:
                    raise ImportFailure('Roster contains invalid or repeated IDs; import stopped to prevent silent omissions.')
                seen.add(user_id)
                if user_id in skip_ids:
                    self.skipped_existing += 1
                    continue
                pending.append(row)
            candidate_ids = {r['id'] for r in pending if r.get('active?') is not False and r.get('staff?') is not True}
            memberships = self._cursus_memberships(cursus['id'], candidate_ids) if candidate_ids else {}
            for row in pending:
                # Campus membership comes from the scoped roster endpoint; cursus
                # membership comes from the independently validated batch join.
                # No primary-campus filter is used, so transfers aren't omitted.
                required = ('active?', 'first_name', 'last_name', 'login')
                if any(key not in row for key in required):
                    profile = self.get(f"/v2/users/{row['id']}")
                    if not isinstance(profile, dict) or profile.get('id') != row['id']:
                        raise ImportFailure('42 profile ID did not match the requested roster member.')
                    yield profile
                else:
                    yield {**row, 'campus': [{'id': campus_id}], 'cursus_users': memberships.get(row['id'], [])}
        raise ImportFailure('Pagination safety limit reached.')

    def _cursus_memberships(self, cursus_id, user_ids):
        result, seen = {}, set()
        for page in range(1, 10001):
            rows = self.get('/v2/cursus_users', {'filter[cursus_id]': cursus_id,
                'filter[user_id]': ','.join(str(i) for i in sorted(user_ids)),
                'page[number]': page, 'page[size]': 100, 'sort': 'id'})
            if not isinstance(rows, list):
                raise ImportFailure('42 returned invalid batch cursus memberships.')
            if not rows:
                return result
            for enrollment in rows:
                if not isinstance(enrollment, dict):
                    raise ImportFailure('Invalid batch cursus enrollment.')
                user = enrollment.get('user')
                user_id = user.get('id') if isinstance(user, dict) else None
                identity = enrollment.get('cursus')
                enrollment_id = enrollment.get('id')
                if (type(enrollment_id) is not int or enrollment_id in seen or user_id not in user_ids
                        or enrollment.get('cursus_id') != cursus_id or not isinstance(identity, dict)
                        or identity.get('id') != cursus_id
                        or not (identity.get('name') == '42cursus' or identity.get('slug') == '42cursus')):
                    raise ImportFailure('Batch cursus membership did not match the requested users and cursus.')
                seen.add(enrollment_id)
                result.setdefault(user_id, []).append(enrollment)
            if len(rows) < 100:
                return result
        raise ImportFailure('Cursus membership pagination safety limit reached.')

    def photo_bytes(self, url):
        try:
            parsed = urlsplit(url)
            allowed = (parsed.scheme == 'https' and parsed.hostname in settings.FORTYTWO_IMAGE_HOSTS
                       and not parsed.username and not parsed.password and parsed.port in (None, 443))
        except ValueError:
            allowed = False
        if not allowed:
            raise ImportFailure('Photo host is not authorized. Check FORTYTWO_IMAGE_HOSTS.')
        # Separate request: never send the API bearer token to a photo host.
        response = self._request('GET', url, stream=True)
        try:
            content = bytearray()
            for chunk in response.iter_content(65536):
                content.extend(chunk)
                if len(content) > 5 * 1024 * 1024:
                    raise ImportFailure('Photo exceeds the 5 MB limit.')
            return bytes(content)
        except requests.RequestException:
            raise ImportFailure('Photo download failed; existing photo was preserved.') from None
        finally:
            response.close()
