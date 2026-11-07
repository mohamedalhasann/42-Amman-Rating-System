# Profile backend

Django 5.2 with PostgreSQL support; SQLite is available only in local debug mode. This implements **profile import, local accounts and the staff workspace API**, including persisted windows, labels, rating/case models, atomic case resolution and CSV. See [account setup and trusted staff provisioning](ACCOUNTS.md) and the [connected React staff workspace](../staff-frontend/README.md). Student submission and automatic abuse detection remain pending. Photo downloads remain blocked by the upstream CDN.

## Local setup

From the repository root:

```sh
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.lock
cp backend/.env.example backend/.env
```

Edit `backend/.env`. Set `FORTYTWO_CLIENT_ID` and `FORTYTWO_CLIENT_SECRET`, or an existing `FORTYTWO_ACCESS_TOKEN`. Never put these in React, commit them, paste them into chat, or supply them as command-line arguments. The example enables local debug mode; configure a secret key, PostgreSQL, hosts, and HTTPS for deployment.

```sh
cd backend
../.venv/bin/python manage.py migrate
../.venv/bin/python manage.py createsuperuser
../.venv/bin/python manage.py runserver
```

The superuser command provisions a trusted, verified, approved staff account. Django admin is at `/admin/`; student/staff setup and sign-in are at `/account/`. Imported students start with unusable passwords and no verification or approval. Importing cannot grant account access. The local default prints setup emails in the runserver terminal rather than sending them externally.

## Import authorized Amman profiles

Only **active 42cursus students** qualify: verified Amman campus membership, upstream `active?` strictly true, non-staff, and an exact `42cursus` name or slug in `cursus_users[].cursus`. Piscine-only and Pro Piscine-only accounts are skipped; prior Piscine history does not exclude a student who also has 42cursus enrollment. Missing activation/enrollment data fails validation rather than granting eligibility. This checks account activation, not an extra rule about cursus end dates, blackhole dates, or alumni status. Local account activation, email verification, and approval remain independent.

The eligibility migration defaults old broad imports to `unchecked`. Student-profile admin defaults to **Active 42cursus**; its eligibility sidebar exposes **Awaiting recheck**, **Excluded**, and **All saved records**. The application directory and student access require verified eligibility. A real re-import marks qualifying records eligible and existing non-qualifying records excluded without deleting identities, passwords, approvals, or retained pictures. Dry run does not change eligibility.

Resume skips only records previously checked with the current eligibility policy. Old unfiltered imports are rechecked through the same batch membership lookup. A live read-only batch of 100 Amman accounts returned 21 qualifying records, 79 skipped, and zero failures. That check saved no records and does not prove full-roster completeness.

Amman was confirmed through an authorized API lookup as campus **35**. Confirm authorization to retain profile photos with staff. Start with a small read-only sample:

```sh
../.venv/bin/python manage.py import_42_profiles --campus-id 35 --dry-run --limit 5
# Full validation (may take several minutes):
../.venv/bin/python manage.py import_42_profiles --campus-id 35 --dry-run
# Real import, including photos:
../.venv/bin/python manage.py import_42_profiles --campus-id 35
```

Dry run reads the API but writes no profiles, images, or import history. It checks profile structure, campus membership, and account collisions; it does **not** download or validate photos. `--limit` restricts roster entries inspected, including skipped staff entries; real limited imports are recorded as `sample`, never `complete`. Full runs report progress every 25 entries. In dry-run totals, `created` and `updated` mean what would happen, not database writes.

The importer verifies the campus and resolves the `42cursus` identity. It reads up to 100 campus accounts per page and joins their IDs against `/v2/cursus_users` using `filter[user_id]` and `filter[cursus_id]`. Membership results are validated against every requested user/cursus ID and paginated independently. Staff and explicitly inactive accounts need no enrollment lookup. Campus membership is established by the campus-scoped list, and exact cursus membership by the separate enrollment response; no primary-campus restriction excludes transfers. Only incomplete list records fall back to an individual full-profile request. This replaces the former one-detail-request-per-campus-account scan. A tested 100-student batch uses five API calls including metadata/pagination checks rather than over 100, assuming complete roster fields and one enrollment per user. Photos still require separate downloads when enabled.

The command waits at least 0.6 seconds between HTTP requests, retries transient failures a bounded number of times, honors short numeric retry delays, and stops on authentication errors or longer requested delays. This interval is a configurable conservative default, not a claim about your application's assigned API quota. Use `--interval 2` to slow down further.

Re-running matches profiles by 42 user ID, preserves internal UUIDs, passwords, active state, verification, and approval, and updates profile fields. Username collisions fail rather than merging accounts. Each profile is committed separately: successful records remain if a later record fails. Failed photo downloads leave that entire existing profile unchanged. Use `--skip-photos` to import names independently and preserve existing photos. An absent upstream photo never deletes a locally retained image.

The command exits nonzero if any profile fails, and records created/updated/skipped/failed totals in `ImportRun` (visible in admin). It never treats a failed or interrupted run as complete. Review the counts and roster with staff before access expires. It does not automatically deactivate accounts absent from a subsequent import. Avoid concurrent imports; database constraints prevent duplicate IDs and case-insensitive usernames, but a competing run may need a retry. A paginated live roster can change during collection, so command completion alone is not proof of campus-roster completeness.

If 42 requests more than 30 seconds of cooldown, the command reports the HTTP status and requested wait in seconds and stops rather than retrying early. All earlier successful records remain saved. After the requested wait, resume the names-only import with:

```sh
../.venv/bin/python manage.py import_42_profiles --campus-id 35 --skip-photos --resume --interval 2
```

`--resume` skips profiles checked under the current eligibility policy before batch enrollment lookups; campus list pages still need to be read. Existing checked names will not be refreshed in resume mode. It requires `--skip-photos` to avoid silently skipping missing photos. Remove `--resume` for an intentional full profile refresh later. Summary `skipped` includes saved profiles encountered during the resumed scan. A sample limit applies to yielded profiles, after existing IDs have been skipped; the batch containing those profiles may be prefetched in full. A slower interval reduces request volume but does not guarantee an hourly quota will not be reached.

## Private photos

Live diagnostics confirmed that campus/profile API access works but the image CDN returns HTTP 403 for all variants of two sampled photos. This does not establish that API credentials are invalid. The importer stops on the first photo-CDN 401/403 and reports it separately; it does not continue failing across the roster or try to bypass the restriction. Profiles already saved remain intact. Import names independently while authorized photo access is resolved:

```sh
../.venv/bin/python manage.py import_42_profiles --campus-id 35 --skip-photos
```

This explicitly skips photo requests and preserves existing local images. A later rerun with photos enabled can fill them in once access is restored.

Images are downloaded only from explicitly allowed HTTPS hosts, without API authorization headers or redirects. Only add a CDN hostname to `FORTYTWO_IMAGE_HOSTS` after verifying it is an authorized 42 image source. Downloads are limited to 5 MB, decoded with Pillow, resized to at most 512 × 512, and re-encoded as JPEG without original metadata.

Photo files live in `private-media/`; PostgreSQL stores their paths. There is no public media route. Back up **both** PostgreSQL and this directory (or configure a durable private volume). Deploying on ephemeral disk would lose images. Content-addressed names avoid duplicate files on unchanged re-imports. Older versions are retained rather than deleted automatically; retention/cleanup is a later operational decision. A database transaction rollback can leave an unreferenced image file; it never makes that file public.

## Implemented API

All routes use Django sessions and require active, verified, approved accounts. Data and photo responses use private/no-store cache headers. No endpoint contacts 42 at request time.

| Route | Access | Returns |
| --- | --- | --- |
| `GET /api/v1/me` | Approved account | Own display identity and role |
| `GET /api/v1/staff/students?query=...&limit=25&cursor=...` | Trusted staff | Minimal student profiles, name/username search, cursor pagination |
| `GET /api/v1/profiles/{profile_uuid}/photo` | Approved account | Private image; students cannot view pending/inactive/unverified profiles |

Profile response example (synthetic):

```json
{
  "id": "b562b5a3-0828-4c5d-ab5f-e73f7ff14431",
  "intra_username": "example",
  "first_name": "Example",
  "last_name": "Student",
  "photo_url": "/api/v1/profiles/b562b5a3-0828-4c5d-ab5f-e73f7ff14431/photo"
}
```

Collections return `{ "items": [...], "next_cursor": null }`. Provider IDs, emails, credentials, and photo paths are not exposed. Missing images return `photo_url: null`; frontends should display initials. Use the same origin for session-authenticated API and image URLs, or configure a trusted development proxy. Do not expose `private-media/` through the web server.

The staff React frontend now uses the protected workspace API, settings/approval endpoints and server-generated CSV. It keeps private records in memory and never falls back to browser-storage fixtures. See [staff integration](../staff-frontend/README.md) and [local accounts](ACCOUNTS.md) for exact setup and limits. Student frontend integration, submission and automated abuse detection remain pending. Student peer selection must use the captured voting roster when that workstream is implemented.

## Verification

```sh
DJANGO_DEBUG=true ../.venv/bin/python manage.py test profiles
DJANGO_DEBUG=true ../.venv/bin/python manage.py check
DJANGO_DEBUG=true ../.venv/bin/python manage.py makemigrations --check --dry-run
```

Tests use mocked upstream responses and a disposable SQLite database. They cover profile identity and account preservation, eligibility, batch membership identity/pagination checks and request counts, resume, duplicate handling, dry run, sample limits, failed imports, image normalization, download allowlisting, retries, staff-only directory access, pending-account restrictions, and private photo delivery. Five live full profiles and one live 100-account batch were checked read-only. PostgreSQL deployment, full-roster completeness, and successful live photo downloads remain unverified.
