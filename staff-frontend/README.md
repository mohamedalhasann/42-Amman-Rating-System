# Fairly staff frontend

React + Vite. Run from this directory:

```sh
npm install
npm run dev
```

Open the printed localhost URL. The app opens directly to the staff dashboard. Authentication is intentionally left to the teammate implementing it. All names, votes, attempts, and cases are synthetic.

```sh
npm test
npm run build
```

## Staff coverage

The visual system follows the supplied Fairly student reference: locally bundled Space Grotesk and JetBrains Mono, cyan `#00BABC`, ink `#121417`, off-white `#F4F5F2`, dotted backgrounds, dark outlines, and rounded controls. The bundled font files were extracted unchanged from the supplied student prototype; their original SIL Open Font License notices are retained in `src/fonts.css`.

The campus branding imports the original `../docs/42-logo.jpeg` through Vite and displays only its 42 symbol using a compact CSS crop. The adjacent wordmark is hidden without stretching or altering the source file. The sidebar shows it on desktop; the header shows it in compact layouts. Build from the repository checkout so this source asset is available.

Usability refinements include a labeled and remembered window selection, clear-search controls, distinct table headings, accessible star values and active navigation, keyboard skip/focus handling, sticky dialog close controls, and an activity chart that covers the entire window without implying votes on zero-activity days. Long windows are grouped into at most seven date ranges; retained historical votes stay visible after date edits.

The three PDFs under `../docs/` are the source requirements. The current decisions, voting rules, authentication plan, and proposed API contract define additional team policies.

| Requirement | Frontend flow |
| --- | --- |
| Overview | Submitted, counted, invalidated, participating/eligible totals; daily activity; stars. All computed from the same records. The requested “Yet to participate” overview card is removed. |
| Window-specific participation | One Students page with the captured window roster, including zero-vote students; name/username search; everyone/rated/not-rated filters; votes given, counted totals when different, remaining allowance, minimum progress; pagination. The old `#participation` route redirects here. |
| Student inspection | Click a student or View record to navigate to a dedicated `#students/<id>` page. Direct links, refresh, and browser back/forward work. Back to students restores the roster's search, filters, pagination, and scroll position. The record page includes overall/window averages, given/received histories showing only the other student, a window scope switch, received labels, and rating detail with explanation, timestamp, state, and related cases. Student records are not drawers; individual rating details still open in a dialog over the record page. |
| Rating explorer | Browse ratings has Student, Stars, and Label tabs for the required grouped summaries; Student means the recipient. Student browsing uses case-insensitive name/username search instead of a long dropdown and shows names with usernames. Group summaries render 10 items per page. View ratings and group names navigate to dedicated `#explorer/<student\|stars\|label>/<id>` pages with rating history, status filtering, pagination, and a scoped export. Direct links, refresh, and browser back/forward work. Back to ratings restores the browse category, search, filters, group page, scroll, and focus. Stars and Label selectors filter the grouped summaries; individual records open on their own page. Search/selection combines with Status, and Clear filters resets both. Empty combinations stay empty rather than reverting to all ratings. No separate Group by/View selector. Submitted/counted/invalidated totals and one export action following the visible results are retained. |
| Labels | Add labels; edit permitted star levels; activate/deactivate; historical wording/selections preserved. Replacements rather than renaming historical labels. |
| Voting configuration | Create/edit/select windows, dates, minimum and maximum; derived upcoming/open/closed state; overlap/integer/range validation; existing votes and captured rosters preserved. All date inputs explicitly use Amman time. |
| CSV | Export all ratings in selected window or current filtered/grouped view; identities, stars, labels, time, state, explanation, and invalidation reason; CSV quoting and spreadsheet-formula neutralization; export audit event. |
| Unified abuse review | One searchable inbox covering all eight required scenarios, with pattern/status/window filters and pagination. Cases open on dedicated `#review/<id>` pages, with a plain-language explanation first, chronological rating cards with student explanations inline, and the staff decision after the evidence. A side column shows every flagged mechanism, involved students and their roles, the case window, and detection time. Linked evidence retains its own window and can cross windows. Accepted ratings and blocked attempts are separate, each paginated six per page. Back to review inbox preserves search, filters, page, scroll, and focus. Direct links, refresh, and browser history work. |
| Decisions and invalidation | Select abusive ratings during evidence review, then resolve once with one reason: confirm abuse and exclude the selected ratings together, or dismiss without changing ratings. Case resolution, exclusions, and audit are saved atomically by the preview adapter. Cases with no counted ratings can be confirmed without exclusions. Original records, decisions, and exclusion reasons remain inspectable; unrelated votes and voting allowance are preserved. The backend must enforce the same transaction boundary when integrated. |
| Account administration | Manual student-approval setting; verified pending accounts; explicit approval; established approvals retained; existing captured window roster unaffected. Disabling manual approval leaves existing pending accounts for explicit review, shown in the UI. This is a preview policy for the unresolved pending-account decision. |
| Authentication | Delegated to the teammate responsible for authentication. No sign-in, credential, setup, or session implementation is included in this frontend. |
| Audit | Staff decisions, per-rating invalidation data, label/window edits, approvals, settings, and exports retain actor, timestamp, and reason/detail. Searchable and paginated activity log. |

The dashboard shows participation as a fraction. Students who have not voted remain discoverable in Participation, as required, without a separate overview card.

## Local preview and production boundary

The local adapter uses browser storage under `fairly.staff.preview.v3` for **synthetic data only**. Changes survive refresh and synchronize between tabs. Clearing that storage resets the preview on the next load. This frontend does not implement login, credentials, email, or sessions.

This is a frontend workflow implementation with a local data adapter, not a deployed secure application. Before using real student records, connect the proposed `/api/v1` Django endpoints from `../docs/planning/api-contract.md`, remove the bundled fixtures, and integrate the teammate's authentication with server-side staff authorization for every data, mutation, and CSV request. Enforce verified/approved/active accounts, secure sessions/CSRF, protected storage, token lifetime/single use, and privacy on the server.

The eight case fixtures demonstrate the review interface. They are not running abuse detectors, and their examples do not approve numeric detection thresholds. Detector rules, trusted roster imports, and email delivery belong to the backend workstreams. Thresholds remain deferred in the team decisions.

Window rosters are captured on preview load when a window has started; future windows have no snapshot until then. The backend must capture eligibility durably at the actual opening instant. Existing snapshots do not change on approvals or window edits. All-window averages remain independent of selected-window filters.

## Verification

`npm test` exercises fixture validity, all eight mechanisms, totals reconciliation, invalidation prerequisites/recalculation/idempotency, dismissal, preserved allowances, window validation, approvals, historical labels, grouping, filters, and CSV escaping.

Scale checks cover 235 recipients, including duplicate display names. Browser verification with an isolated synthetic dataset of 235 students and 470 ratings checks that only 10 grouped rows render at once, name/username search combines with status, pagination is preserved on returning from a group, and export includes the entire matching set rather than only the displayed page. This does not replace Django-side search, aggregation, and cursor pagination when live data is integrated.

Browser verification also exercises screen navigation, searches/filters, student directions, grouping, case decisions, selective invalidation, updated totals, approval, audit entries, CSV flow, persistence after refresh, and desktop/narrow layouts. Production backend authorization remains an integration acceptance check, not a verified frontend capability.

Case review checks cover all eight case types, inline explanations, inbox state restoration, required decision reasons, confirmation without automatic invalidation, cancellation and selective exclusion, persisted reasons and audit entries, and dismissal without changes to ratings. A separate synthetic case checks 31 ratings across voting windows, selection across evidence pages, and 15 non-retry blocked attempts with independent pagination. Desktop and narrow layouts are checked for page overflow.
