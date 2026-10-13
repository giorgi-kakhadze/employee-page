# Integration plan

Status words: **Implemented** (works now, tested) · **Built, needs settings** (code exists and is tested against a stand-in; it needs company credentials) · **Partial** · **Planned** (not built) · **Unavailable** (no data source).
Nothing in the tool claims a link that is not in the "Implemented" or "Built" rows.

| Integration | Purpose | Data and direction | Authentication / permissions | Errors | Owner | Status |
|---|---|---|---|---|---|---|
| Google Drive via Apps Script (`Code.gs`) | Shared data for the single-file edition | Tool ⇄ one JSON file on Drive | Staff: e-mail + password approved by admin; admin key (must be changed, F-06) | Conflicts detected per key; refused keys listed; daily backup copy | Admin | **Implemented** |
| Google sign-in (employee page) | Employees see their own schedule | Page ← schedule/rotation of that person | Google ID token; audience checked | Clear message; no data without a valid token | Admin | **Implemented** |
| E-mail (Apps Script MailApp) | Reminders, schedule mails, mistake reports | Out only | Script's Google account; team/admin keys (defaults refused) | Per-recipient result | Admin | **Implemented** (optional) |
| Excel / CSV / Google Sheets files | Imports (employees, game counts, Jira) and exports (pay, reports) | Both, by file | None (local files) | Row-level messages; CSV formula guard (F-04) | Each department | **Implemented** |
| Microsoft Dynamics 365 (HR) | Employee master data | Dynamics → tool, read only | Entra app registration, client credentials, read-only Dynamics role. Secrets stay in the Apps Script properties or server settings, never in the HTML | Stops if Dynamics returns fewer than half the people; nothing removed; history entry per change | HR + IT | **Built, needs settings** (see `docs/hr-dynamics.md`). Live tenant not tested. |
| Microsoft Entra ID sign-in | Company accounts, admin by app role | Sign-in only | OIDC + PKCE, tenant/issuer/audience/nonce checks | Fails closed | IT | **Implemented in the Server Edition**; tested against a local stand-in with real signatures; live tenant not tested |
| SharePoint / OneDrive | Store documents | Links only (document register) | The file keeps SharePoint permissions | — | Document owners | **Partial** (links, no file API) |
| Microsoft Teams | Notifications | — | — | — | — | **Planned.** Option: Teams Workflows (Power Automate) webhook per channel for new urgent tickets. Needs IT approval of the webhook. |
| Power Automate / Power Apps | Company automations | — | — | — | — | **Planned.** Needs the Server Edition API with a service account; not in the single-file edition. |
| Jira | Service incidents | Jira → tool by CSV export | None | Row messages | Service | **Partial** (CSV import). Live sync **planned**: Jira API token owned by IT, Server Edition only. |
| Payroll / finance system | Pay | Tool → file | — | — | Finance | **Implemented as export only.** The tool does not compute pay rules beyond the rates Finance enters. |
| Door access / fingerprint | Attendance evidence | — | — | — | Security | **Unavailable** — no export or API has been provided. Needed: vendor export format, an owner, a data-protection decision. |
| Lobby TVs | Rotation and information board | Server → TV, read only | Secret link per screen | Shows last picture when offline | FMD | **Implemented** |

## Configuration checklist for what is built

1. **Code.gs:** change `ADMIN_SECRET` (6+ characters, not the default), deploy a new version. Without this the admin is refused (intended).
2. **Mailer script:** change both keys; deploy.
3. **Dynamics 365:** IT creates the app registration and the read-only application user; HR checks the first "Show fields" run and the field mapping.
4. **Server Edition:** follow `ptf-gunda-server/docs/DEPLOYMENT-AZURE.md` and `CONFIG.md`.

## Not added in this audit
No new outside network address was added. The tool still works offline (single-file, no sync) as before.
