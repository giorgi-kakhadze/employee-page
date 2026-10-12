# Updated application source

The changed files themselves are the deliverable. This page lists them and where each change sits.

| File | Lines changed | What changed |
|---|---|---|
| `tool/PTF-pass-to-floor-Gunda.html` | +146 / −32 (with `Code.gs`) | CSV guard (`<script id="csvGuard">`, top of file); `totDataOwner` and wipe on person change (sign-in screen); `totNoRoleAccount` (role access, department helpers, top bar, Home note); local dates in space statistics and coaching follow-ups; accessibility labels; Integrations status; document version + read-and-confirm (Department → Documents); shift handover log (FMD → Schedule → Today); new keys registered for sync (`totDocAcks`, `totHandover`). |
| `tool/Code.gs` | | Default/short `ADMIN_SECRET` refused; `mergeOwn_` for `totDocAcks`; `handoverPush_` for `totHandover`; `totHandover` read/write limited to schedule positions and gated like the schedule; `totDocAcks` gated like department documents. |
| `ptf-gunda-server/src/rules/rules.js` | regenerated | `npm run build:rules` from `tool/Code.gs` |
| `ptf-gunda-server/public/tool.html` | regenerated | `npm run build:client` from the tool |
| `tests/harness.js` | 1 line | `window.name = '__noinit'` lets a test sign in through the real sign-in screen |
| `tests/dynamics_import.test.js` | 1 line | expects the clearer wrong-key message |
| New tests | | `audit_account_switch`, `audit_timezone`, `audit_csv_injection`, `audit_default_keys`, `doc_acks`, `handover`; crawler `tests/audit/crawl.js` |

`tool/PTF-tv.html` and `index.html` (employee page) were audited and not changed.

The commit is local only (not pushed to GitHub), as requested.
