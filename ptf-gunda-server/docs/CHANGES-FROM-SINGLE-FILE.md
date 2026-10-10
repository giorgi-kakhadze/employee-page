# What is different from the single-file edition

Which edition do I change? The **single-file edition** (`tool/PTF-pass-to-floor-Gunda.html` + `tool/Code.gs`, Google Drive) is untouched and still works. The **Server Edition** (`ptf-gunda-server/`) is built *from* it: `npm run build` regenerates `public/` and `src/rules/rules.js` from the single-file files. So:

* A **new feature in the tool or a new rule** → change the single-file edition (as before), then run `npm run build` in `ptf-gunda-server` and commit the generated files. Both editions get it.
* A change that only concerns the **server** (sign-in, hosting, limits, database) → change `ptf-gunda-server/src`.
* If the build stops with "anchor not found", the single-file change touched a line the server build patches; the message says which. Adjust the patch in `client/build.js` or `tools/port-code-gs.js`.

| Area | Single-file edition | Server Edition |
|---|---|---|
| Where it runs | a file opened in the browser; Google Apps Script as the shared store | a web server (Azure App Service), opened by link |
| Sign-in | tool password per person + admin key; employee page with Google sign-in | Microsoft Entra ID for everybody (employees too); administrators = app role |
| Data on the laptop | the full copy of what you may see, in the browser's storage (about 5 MB limit) | none (memory only) |
| Where data lives | `tool-data.json` in Google Drive, one file, one global lock | PostgreSQL, one row per key, transactions |
| Size limit | about 2,200 employees (browser storage) and about 4,400 (one key) | no browser limit; one key still 4.5 MB (the tool's own limit) |
| Sync | every device downloads everything every 90 s | the page arrives with the data; afterwards only what changed; live notice within about 1.5 s |
| Simultaneous users | a few dozen before Google script quotas and the global lock hurt | measured in `LOADTEST.md` |
| Permission rules | `Code.gs` | the same code, derived from `Code.gs` |
| Request access / approve flow | people request access with a password; admin approves | removed; staff positions are set in Access management; Microsoft decides who is an employee |
| Google Drive sync panel, device codes, password gate | present | hidden / not used |
| Videos and project files | Google Drive | files share (Azure Files) |
| E-mail | Apps Script `MailApp` | Microsoft Graph from one mailbox, with a retrying outbox |
| Daily project e-mail | sent on the first save of the day (or a trigger) | 07:00 in `PTF_TZ`, once across all instances |
| Backups | daily copy in Drive (14 kept) | PostgreSQL point-in-time restore + daily JSON export (14 kept) |
| Audit | the tool's change journal | the same, plus a hash-chained server audit of sign-ins and refusals |
| Header "Data saved locally" | yes | "Saved on the server" |
| Browser storage warnings | yes | hidden |
| Save delay after an edit | up to 13 s | about 2.3 s |

## Behaviour you may notice
* **Reload shows the latest server data**, never an older local copy.
* **A change not yet sent when the tab is closed is lost.** The tool sends within about 2.3 s of an edit; the browser asks before closing a tab with unsent changes (where the browser allows it).
* **Several locations:** the page loads one location at a time (the location of the tab). Switching location reloads the page with that location's data.
* **Employee page address:** `/employee` on the same site (the front address `/` shows it to people without a staff position).
* **Removed on purpose:** "Request access" and the admin's approve/deny list (the Microsoft assignment and Access management replace them), "Disconnect Drive", "Create access code" for sites still works inside the tool but a person's sites come from Access management.
