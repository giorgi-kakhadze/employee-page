# Operations

## Daily
Nothing. The server exports all data once a day (14 kept in the files share `backups/`), sends the project e-mail at 07:00 (`PTF_TZ`), deletes evaluation videos after 62 days, and expires old sessions.

## Watch
* **Application Insights → Logs**: the server prints one JSON line a minute: `{"m":"metrics","rssMB":..,"lagP99":..,"ruleMs":{"pull":{"n":..,"p50":..,"p95":..},...}}`. Alert when `lagP99` stays above 200 ms (the server is busy: add an instance) or `rssMB` rises steadily (a leak: restart and tell me).
* **Front Door**: 4xx/5xx rate, WAF blocks.
* **PostgreSQL**: CPU, storage, connections (the app uses at most 10 per instance).
* **Audit**: `GET /api/admin/audit?verify=1` as administrator. `chain.ok:false` means a row was changed or deleted.

## Common tasks
| Task | How |
|---|---|
| Add an instance | App Service plan → scale out. No downtime. Each instance catches up from the database in about a second |
| Rotate a secret | Key Vault → new secret version → restart the app. Rotating `PTF_SESSION_SECRET` signs everybody out |
| Make someone administrator | Entra → enterprise application → Users and groups → assign `PTF.Admin`. Effective at their next sign-in |
| Remove someone | Remove them in Access management (tool) **and** remove their assignment in Entra. To end their session now: `DELETE FROM sessions WHERE email='x@y.com'` (takes effect on every instance within 30 s) |
| A person sees the employee page, not the tool | Their Microsoft e-mail is not in Access management with a position, or differs from the address listed there |
| A person says "e-mail is on more than one employee list" | Two rows in the employee list have the same e-mail; fix the list |
| Restore | PostgreSQL → *Restore* to a point in time into a new server; point `database-url` at it; restart. For a single key, import from a daily export with `scripts/import-backup.js` into a **staging** database and copy the value through the tool's backup/restore |
| Roll back a release | App Service → Deployment slots / redeploy the previous zip. The database schema is created idempotently and has not changed between releases yet; check release notes before rolling back across a schema change |
| Look at the outbox | `SELECT status, count(*) FROM outbox GROUP BY 1;` (failed = Graph refused after 6 tries; `err` says why) |

## Incident: suspected unauthorised access
1. Entra: revoke the person's sessions (Revoke sessions) and disable the account if needed.
2. `DELETE FROM sessions;` signs everybody out (they sign in again with Microsoft; takes effect on all instances within 30 s).
3. Audit: `GET /api/admin/audit?n=1000` (look for `login`, `push.refused`, `csrf.refused`, `origin.refused`, `tool.denied`, `videoGet`, `pjFileGet`). Check the chain.
4. Rotate `PTF_SESSION_SECRET` and `PTF_SALT`, and the Entra client secret.
5. Restore from a point in time before the incident if data was changed (the tool's own change journal shows who changed which record).

## Capacity signs
`lagP99` > 200 ms for minutes, `ruleMs.pull.p95` > 50 ms, or CPU > 70 % on all instances → add an instance. Memory per instance is about 300 MB + 4× the data size.
