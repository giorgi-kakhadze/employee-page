# PTF / Gunda — Audit report (October 2026)

Scope: the single-file edition (`tool/PTF-pass-to-floor-Gunda.html`, `tool/Code.gs`, `tool/PTF-tv.html`, `index.html` employee page) and the Server Edition (`ptf-gunda-server/`). I read the source and ran it in a real browser (Chromium, Playwright) against a stand-in for the Google Apps Script (`tests/fakegas.js` runs the real `Code.gs` in Node). Every finding below links to code or to a check that reproduces it. Results that were not run are marked as not tested.

## 1. How the application is built (facts)

| Part | What it is | Size |
|---|---|---|
| `tool/PTF-pass-to-floor-Gunda.html` | The whole tool in one HTML file: plain JavaScript, no framework, no build step, no outside libraries at run time. Data is kept in the browser (`localStorage`), with one key per data set and a site prefix for multi-site use. | 2.9 MB |
| `tool/Code.gs` | Optional Google Apps Script. It stores the shared data as one JSON file on Google Drive and enforces who may read and write each key (positions, departments, record owners, admin key). | 120 KB |
| `index.html` | Employee page (phone): schedule and rotation, confirmations, absence reports, requests. Signs in with Google. | 49 KB |
| `tool/PTF-tv.html` | Lobby TV page (rotation and information board), opened with a secret link. | 26 KB |
| `ptf-gunda-server/` | Server Edition: Node server with the same rules (`src/rules/rules.js` is generated from `Code.gs`), sessions, CSRF protection, Entra ID / Google sign-in, Postgres or file storage. | separate |

Security model of the single-file edition: **what a browser hides is not security**. The real boundary is `Code.gs` (or the Server Edition): it decides what each signed-in person receives and may write. A person who opens the HTML file without a sync setup has full local access to whatever is in their own browser, by design.

## 2. Module inventory and current state

Status key: ✅ working (tested) · ⚠ working with limits · ❌ defective (fixed in this audit, see bug register) · ➖ not in this app on purpose · 🔌 depends on an outside system.

| Space / module | Main screens | State after this audit | Evidence |
|---|---|---|---|
| Home | Search, my tickets, announcements, information for people with no position | ✅ (no-role accounts now see Home only — F-02) | `audit_account_switch.test.js`, `nav_spaces.test.js` |
| Academy | Onboarding groups, workshops, exams, ID cards, logbooks, retraining | ✅ | `onboarding_share`, `evaluation`, crawl |
| Performance | Evaluations, coaching, follow-ups, remarks, bonuses | ✅ (month counting by local date — F-03) | `evaluation`, `bonus_pay`, `audit_timezone` |
| FMD — Schedule | Roster, rotation generator, cover/absence, mentors, zones, Today screen, confirmations, swaps, pay export, TV screens, information board | ✅ — new: shift handover log | `schedule_grid`, `chain_rotation`, `cover*`, `mentors`, `zones*`, `today`, `ack`, `payroll_export`, `tv_screens`, `info_board`, `handover` |
| FMD — Employees | Employee list, imports (Excel, Drive, Dynamics 365) | ✅ / 🔌 Dynamics needs company settings | `dynamics_import`, `large_data` |
| Appearance (Uniforms) | Stock, issue/return, departments | ✅ | crawl, `nav_spaces` |
| HR | Lifecycle, recruiting, requests, documents | ✅ — new: document read-and-confirm | `request_rules`, `doc_acks` |
| Office / IT / Access | Department boards with tickets, templates, work types | ✅ | `work_types`, `sync_privacy` |
| Service | Incidents, Jira CSV import, reports | ✅ (Jira is CSV import only, no live link) | `service_mgmt` |
| Projects | Projects, items, teams, approvals, board | ✅ | `projects`, `projects_teams` |
| Community | Channels and direct chats | ✅ | `community` |
| Tasks / cases / announcements / comments | Cross-department tickets with record-level privacy | ✅ | `sync_privacy`, `sync_more` |
| Admin | Access by position/person, sites, sync, backups, journal, integrations | ✅ (default admin keys now refused — F-06) | `page_access`, `hardening`, `audit_default_keys` |
| Exports | CSV/Excel downloads | ✅ (formula injection blocked — F-04) | `audit_csv_injection`, `report` |
| Employee page | Schedule, rotation, confirmations, absence reports | ✅ | `employee_page`, `employee_zone_view`, `ack` |
| TV pages | Rotation and information board | ✅ | `tv_screens`, `info_board` |
| Server Edition | Same rules, sessions, CSRF, storage | ✅ | `ptf-gunda-server/test/run-all.js` |

## 3. Baseline measurements (before fixes)

- **Screen crawl** (`tests/audit/crawl.js`): 7 positions × every space × every tab = 431 screens, **0 page errors**, 0 console errors.
- **Script-injection crawl**: every text field seeded with an HTML/script payload, 0 executions; the detector was checked with a planted positive control (it fired).
- **Click crawl** (admin, every visible button on 106 screens, 2,505 clicks, dialogs dismissed): **0 errors**, 0 screens wider than a phone; 8 screens with controls that had no readable label (one real: the Set 1 date field — fixed; the others were buttons whose text was present but measured empty by the crawler because their toolbar was collapsed).
- Automated tests before this audit: 39 test files in `tests/` plus the Server Edition suite. The final run after all changes is in `04-test-report.md`.

## 4. Prioritised findings

Full detail (evidence, root cause, fix, test) is in `02-bug-register.md`.

| ID | Severity | Finding | Status |
|---|---|---|---|
| F-01 | High | On a shared computer, the next person who signed in could see the previous person's data that was still in the browser. | Fixed, tested |
| F-02 | High | A new account with no position saw department spaces in the top bar and could open their screens (they were empty because the server refused the data, but the screens and some local data were reachable). | Fixed, tested |
| F-06 | High | The admin key printed in `Code.gs` and in the mailer script worked if nobody changed it. | Fixed, tested |
| F-04 | Medium | CSV exports wrote text starting with `=`, `+`, `@` as-is; Excel runs it as a formula (CSV/formula injection). | Fixed, tested |
| F-03 | Medium | "Overdue" and "this month" counts used the UTC date, so around midnight in Tbilisi (UTC+4) items were counted on the wrong day/month. | Fixed, tested |
| F-05 | Low | Some form fields had no accessible label (screen readers read "edit text"). | Fixed (label pass + one field) |
| F-07 | Low | Integrations page did not say clearly which links are working and which need company settings. | Fixed (honest status column) |

Department and workflow gaps found and closed in this audit (see `06-department-plan.md`):

- **Procedures with versions and acknowledgement** (Operations, HR): documents could be listed but nobody could confirm they read the current version. Added: version + "staff must read and confirm", per-person confirmation, "x of y confirmed", "who has not", re-confirm on a new version; the server refuses confirmations made in somebody else's name.
- **Shift handover** (Team leaders, FMD): the Today screen could only copy a text to paste into a chat; nothing was kept. Added: a handover log per date and shift, saved with the shift summary, "I have read it" by the next shift, writer-only editing, no deletion by staff, locked once read.

## 5. What the app is not, and should not pretend to be

- It is **not** an HR information system or a payroll system. It prepares data (pay export, Dynamics import) for the approved systems; it does not decide pay rules.
- It does **not** read building access-card or fingerprint data. "Absent" and "called in" are what a lead records, not attendance evidence.
- It does **not** sync live with Jira; Service imports a Jira CSV export.
- The single-file edition cannot protect data from a person who already has it in their own browser. Use the Server Edition when that matters.

## 6. Remaining risks, in priority order

1. Single-file edition: while the admin is signed in, the admin key is kept in that browser's storage (`totSyncCfg.key`). Anyone with that browser profile has admin rights. Mitigation: use a separate browser profile for admin work, sign out after; the Server Edition keeps the admin right in a server session instead.
2. Devices that were used before this update have no data-owner mark. The first sign-in after the update on such a device is treated as the same person if the e-mail matches the remembered one; otherwise the browser data is wiped. A device that was shared before the update should be wiped once (Settings → Sign out removes local data).
3. Confirmations (documents, schedules, handovers) prove that the signed-in account pressed the button, not that the person understood the content.
4. Google Apps Script limits (execution time, file size, ~30 s polling) cap the single-file edition at roughly the volume tested in `large_data.test.js`; above that, the Server Edition is the supported path.
