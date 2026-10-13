# Bug register — audit October 2026

Line numbers refer to the files delivered with this audit. "Test" names a file in `tests/`; every test listed here was run on the final code (see `04-test-report.md`).

---

## F-01 · High · Previous person's data visible after another person signs in on the same browser

- **Evidence:** In `audit_account_switch.test.js` the manager signs in and syncs, so restricted data (bonus setup, remarks, the employee list) lands in that browser. The manager's sign-in runs out and a new person signs in on the same browser through the sign-in screen. Before the fix, that data stayed in the browser's storage and was readable by the new person. The server sent the stylist nothing restricted, but nothing removed what was already there.
- **Root cause:** Local data had no owner. The sign-in screen (`tool/PTF-pass-to-floor-Gunda.html`, gate, approved branch around line 19709) replaced `totAuth` but kept every other key.
- **Fix:** A new global key `totDataOwner` records whose data the browser holds. It is set on sign-in and set to `admin` on admin unlock. When a different person signs in, the tool wipes local data first (`window.totWipeLocal`, the same wipe that Sign out uses, line 28551) and then stores the new owner. It also wipes on `pagehide` if the page is closed half-way. For older browsers without the mark, the previous `totAuth` e-mail counts as the owner.
- **Status:** Fixed.
- **Test:** `audit_account_switch.test.js` — "nothing of the manager's is left in the browser" ✅.

## F-02 · High · An account with no position could reach department spaces

- **Evidence:** A freshly approved account with no position, in a shared (synced) setup, saw Projects, Community, Academy and Performance in the top bar and could open them with `switchView(...)`. The server already refused the data (`whoIs_` gives no sites to a person without a role), so the screens were empty or showed only what was in the browser. The rule "new users see Home only" was still broken.
- **Root cause:** `allowed0` in role access treated "no position" like "local single user with full access". `__dept.wide()`, `mine()` and `sees()`, and `spaceNavApply`, had the same assumption.
- **Fix:** `window.totNoRoleAccount()` (line 6823) is true when a sync setup exists, a person is signed in, they have no position, and this is not the admin or "view as". In that case `allowed0` allows only `home`; the department helpers return nothing; the top-bar spaces are hidden; Home shows "Your account is ready, but it has no position yet…". A purely local copy (no sync) is unchanged.
- **Status:** Fixed. This is UI hiding; the data protection is the server rule that already existed and was re-verified.
- **Test:** `audit_account_switch.test.js` — "a person with no position sees Home only", "a direct switch to another screen is refused" ✅. Server side: `sync_privacy.test.js` ✅.

## F-03 · Medium · Dates counted in UTC instead of local time

- **Evidence:** `audit_timezone.test.js` runs the browser in Asia/Tbilisi. On 1 November at 01:00 local time (still 31 October in UTC), "Evaluations this month" counted the October evaluation and missed the one made that night. Overdue tasks and coaching follow-ups used `new Date().toISOString().slice(0,10)` in the same way.
- **Root cause:** `toISOString()` is always UTC.
- **Fix:** Local helpers `ymOf(t)` and `today0()` (lines 26334–26335) in the space home statistics, and a local "today" in coaching follow-ups.
- **Status:** Fixed.
- **Test:** `audit_timezone.test.js` ✅.

## F-04 · Medium · CSV / formula injection in exports

- **Evidence:** An employee name or note starting with `=`, `+`, `@` or `-text` was written to CSV unchanged. Excel and Google Sheets run such cells as formulas (for example `=HYPERLINK(...)`).
- **Root cause:** Exports are built in many places, each with its own quoting. None of them neutralised leading formula characters.
- **Fix:** One guard placed before any other script (`<script id="csvGuard">`, line 32). It wraps `Blob` for `text/csv` only, detects the delimiter, and prefixes `'` to any field that starts with `=`, `+`, `@`, tab or carriage return, or with `-` followed by something that is not a number. Negative numbers (`-5`, `-3.5`) are left as numbers. JSON backups and other files are not touched.
- **Status:** Fixed for every CSV the tool creates (they all go through `Blob`).
- **Test:** `audit_csv_injection.test.js` ✅ (7 checks, including "negative amounts stay numbers" and "JSON backups are not changed").

## F-05 · Low · Form fields without accessible labels

- **Evidence:** The crawler found inputs with no label, title or placeholder (date and file pickers in schedule, pay, holidays, imports). Screen readers announce them as "edit text".
- **Fix:** `a11yPass` (line ~28362) gives `aria-label`s to 21 known fields (`A11Y_IDS`), labels symbol-only buttons, and re-runs on screen changes. The Set 1 start-date field in Schedule → Setup was found by the final click crawl and labelled in the markup.
- **Status:** Fixed for the fields found. Full keyboard and contrast review: not tested (see test report).
- **Test:** `ui_polish.test.js` ✅; click crawl.

## F-06 · High · Default admin keys gave admin rights

- **Evidence:** `Code.gs` ships with `ADMIN_SECRET = 'CHANGE-ME-ADMIN-KEY'`, and the mailer/Dynamics script offered in the tool ships with `CHANGE-THIS-ADMIN-SECRET` / `CHANGE-THIS-TEAM-SECRET`. Both texts are public (they are in the delivered files). If a deployment kept them, anybody who knew them had admin rights.
- **Fix:** `Code.gs` line 794: when the key is the default or shorter than 6 characters, every admin request is refused with "The admin key in Code.gs is still the default (or too short)…", and nothing is read or written as admin. The mailer script refuses the default keys and says that they are still the defaults (tool line ~12066).
- **Status:** Fixed. **Action needed:** a deployment that still uses the default key will refuse the admin until the key is changed. This is intended.
- **Test:** `audit_default_keys.test.js` ✅ (5 checks).

## F-07 · Low · Integrations page overstated nothing, but was unclear

- **Evidence:** The Integrations page listed Microsoft Dynamics 365 without saying that it needs company settings (tenant, app registration, permission) before it works.
- **Fix:** Status column "Built · needs settings" and a plain explanation of what HR/IT must provide.
- **Status:** Fixed.

## F-08 · High · Onboarding paste filled every column with M / F

- **Evidence:** reported with a screenshot: after pasting trainee rows into Onboarding → "Paste here", Employee ID, Last Name, First Name, Phone, E-mail, EmpStage, Trainer e-mail and Team all showed M or F. Reproduced by `onboarding_paste.test.js` on the previous file (10 failed checks).
- **Root cause:** the header search matched loosely in both directions. A data cell "m" is contained in "email" and "last name", so a data row became the header row; every field whose name contains an "m" was then read from the Gender column.
- **Fix:** `hdrLike()` — a cell matches a header name only if it is the name, or at least 3 characters and contains it, or at least 4 characters and is part of it. Rows with an e-mail or a 6+ digit number are never headers. Used by the Information-sheet import, the "Paste here" import and the trainee header lookup.
- **Status:** Fixed. **Test:** `onboarding_paste.test.js` ✅ (rows without a header, with the header, after empty lines).

---

## Earlier in this work period (already delivered, listed for completeness)

| ID | Severity | Bug | Fix | Test |
|---|---|---|---|---|
| E-01 | High | Recording an emergency/ambulance absence wiped the rest of the rotation until the absence was removed. | Cover planning honours auto-from-staff and plans teams that share tables together; Generate keeps absences; gap check corrected. | `cover.test.js`, `cover_auto.test.js` ✅ |
| E-02 | Medium | Mentor rows: `note is not defined` inside the schedule script stopped the mentors panel. | Local `note()` helper. | `mentors.test.js` ✅ |
| E-03 | Medium | Information board: dragging after a redraw moved a stale box; undo restored the state after the add. | Box re-read after redraw; snapshot before the change. | `info_board.test.js` ✅ |
| E-04 | Medium | Dynamics import rejected rows without a Screen Name. An existing Drive setup could be switched to Dynamics by mistake. | Merge by HR ID / e-mail; source is stored per setup (`siSrcOf`). | `dynamics_import.test.js` ✅ |

## Checked and found working (no change needed)

- Storage-full guard: a save that does not fit says "NOT SAVED" and keeps the old data.
- Restore safety: a backup restore asks first and keeps a copy of the current data.
- Server refuses all site data to accounts without a position (`whoIs_`).
- Record-level privacy for tickets, cases, comments, announcements, projects and chats (`sync_privacy`, `community`, `projects*`).
- Google sign-in on the employee page checks the token audience.
- No script injection on any screen (injection crawl, 0 hits, positive control confirmed).
