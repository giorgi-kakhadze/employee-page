# Test report — audit October 2026

Environment: Linux container, Node 22, Chromium (Playwright), Google Apps Script replaced by `tests/fakegas.js`, which runs the real `tool/Code.gs` in Node. Run on 12 October 2026 on the final code (commit `5c6c651` plus the documentation).

## 1. Automated regression — PASSED

| Suite | Files | Result |
|---|---|---|
| `tests/*.test.js` (tool, employee page, Code.gs rules) | 45 (39 existing + 6 new) | **All passed, 0 failed checks** |
| Server Edition `node test/run-all.js` | server, auth, browser, tv, tv-browser, signout, pwa, dynamics | **All passed** |
| Server Edition `postgres` | 1 | **Blocked** — no PostgreSQL server in this environment (skipped by the suite itself) |
| Server Edition parity (`npm run test:parity`: all 45 tool test files run against the server rules) | 45 files, 967 checks | **Passed** after recording 6 intended differences (section 4) |

New tests written in this audit (all passed):

| Test | Checks | Covers |
|---|---|---|
| `audit_account_switch.test.js` | 8 | F-01 wipe on person change; F-02 Home only for no-position accounts |
| `audit_timezone.test.js` | 3 | F-03 local month and day (browser in Asia/Tbilisi) |
| `audit_csv_injection.test.js` | 7 | F-04 formula guard; numbers and JSON untouched |
| `audit_default_keys.test.js` | 5 | F-06 default keys refused in Code.gs and the mailer script |
| `doc_acks.test.js` | 10 | Read-and-confirm: confirm, persistence, forgery refused, deletion of others refused, manager counts, "who has not", new version asks again |
| `handover.test.js` | 13 | Save, draft kept on redraw, ownership, forgery refused (edit, impersonation, false "read", self-read, delete), read receipt, lock after read |

## 2. Crawls — PASSED

| Crawl | Result |
|---|---|
| Screens: 7 positions × every space and tab (431 screens) | 0 page errors, 0 console errors |
| Script injection (payload in every field, positive control) | 0 executions; control fired |
| Click every visible button as admin (106 screens, 2,505 clicks) | 0 errors, 0 screens overflowing a phone width; 1 real unlabeled field, now fixed |

The click crawl ran **before** the two new features were added. The new screens are covered by `doc_acks` and `handover` (both check for page errors). The screen crawl was not repeated after them.

## 3. Not tested / blocked

| Item | Why |
|---|---|
| Live Google Apps Script deployment | No Google account in this environment; the real `Code.gs` was run in a stand-in |
| Live Microsoft Entra tenant and Dynamics 365 | No company tenant; tested against local stand-ins |
| PostgreSQL storage (Server Edition) | No database server here |
| Safari, Firefox, real phones and tablets, TV browsers | Only Chromium is available |
| Screen readers, full keyboard-only use, colour contrast | Not tested; labels were checked by script only |
| Load above the volumes in `large_data.test.js` | Not tested |
| Restore of a real company backup | Restore was tested with test data only |

## 4. Server Edition parity — intended differences

The first parity run reported 6 failures, all in two new audit tests:
- `audit_account_switch` (5 checks) uses the password sign-in screen. The Server Edition has no such screen: people sign in with Microsoft, and data lives only in the tab's memory, so nothing of a previous person can remain in the browser (covered by the Server Edition's own `signout` and `browser` tests). Whether a no-position account sees only Home in the Server Edition was **not tested**; the server sends such an account no data either way.
- `audit_default_keys` (1 check) checks the `Code.gs` admin key. The Server Edition has no admin key; admin is an Entra app role (`test/auth`).

These are now listed as known differences in `ptf-gunda-server/test/run-parity.js`. Re-run of those two files: no unexpected failures. Every other file and check passed with no new differences.
