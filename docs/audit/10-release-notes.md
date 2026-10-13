# Release notes — audit update (October 2026)

The app version label stays **3.40**; this update is applied on top of it.

## Files
| File | Change | Action |
|---|---|---|
| `tool/PTF-pass-to-floor-Gunda.html` | Fixes F-01…F-07, document confirmations, shift handover | Give everyone the new file |
| `tool/Code.gs` | Default admin key refused; rules for `totDocAcks` and `totHandover` | **Deploy as a new version** (Deploy → Manage deployments → Edit → New version) |
| `ptf-gunda-server/src/rules/rules.js`, `public/tool.html` | Regenerated from the files above (`npm run build`) | Redeploy the Server Edition |
| `tests/` | 6 new test files; harness option for real sign-in tests | — |

## Changes
**Fixed**
- F-01 Previous person's data left in a shared browser → wiped on person change.
- F-02 Accounts with no position reached department spaces → Home only.
- F-03 Overdue / "this month" counted in UTC → local time.
- F-04 CSV formula injection → neutralised in every CSV export.
- F-05 Unlabelled form fields → labels added.
- F-06 Example admin keys worked → refused until changed.
- F-07 Integrations page status made explicit.

**New**
- Department documents: version, "staff must read and confirm", who has confirmed, "Who has not?", re-confirm on a new version.
- Today screen: shift handover log with "I have read it", writer-only editing, locked once read.

**Follow-up fixes after the audit**
- F-08 Onboarding → "Paste here": a pasted Gender cell (M / F) was taken as a header row, so every column whose name contains an "m" (Employee ID, names, phone, e-mail, team …) was filled with M or F. Header detection now needs real header text and never treats a row with an e-mail or phone number as a header. Test: `onboarding_paste.test.js`.
- Backup and Clear history in every space (and Backup / Clear employee data) are for the **admin only**; staff don't see them and the actions are refused for them, also from the browser console and while the admin uses View as. Test: `space_backup_admin.test.js`.
- Home is shared by every department: the Logbook descriptions card is removed (Logbooks shows it), and the Last backup card is shown to the admin only. Test: `home_cards.test.js`.

## Known issues and limits
- A confirmation proves the button was pressed, not understanding.
- "Who has not?" counts people with a position in Access management. People only in the employee list (without an account) are not counted.
- The handover "previous shift" is worked out from shift start times. It does not know about split or custom shifts.
- Single-file edition: data a person may see is stored in their browser (see the security report).
- Not tested here: a live Dynamics 365 tenant, a live Entra tenant, real devices other than desktop Chromium, screen readers.

## Migration
- No data conversion. New keys (`totDocAcks`, `totHandover`) start empty. Existing documents have no version: they show as version 1 and are not "must confirm" until somebody ticks it.
- **Breaking on purpose:** a `Code.gs` deployment that still uses `CHANGE-ME-ADMIN-KEY` refuses the admin after this update. Change the key first.
- Shared computers used before the update: sign out once on each.

## Backup before updating
1. **💾 Backup & settings** → download a full backup (JSON) and keep it.
2. Google Drive: make a copy of the sync data file (`Code.gs` also keeps its own daily copy).
3. Server Edition: confirm last night's export exists (`RUNBOOK.md`).

## Rollback
1. Give everyone the previous `PTF-pass-to-floor-Gunda.html` again.
2. In Apps Script, **Manage deployments → Edit → Version:** pick the previous version. The web address does not change.
3. The new keys stay in the data file and are ignored by the old version. Nothing else needs to be undone.
4. If data was damaged: **💾 Backup & settings → ⬆ Restore from backup**, using the file from "Backup before updating".

## Release checklist
- [x] Full automated regression run (see `04-test-report.md`)
- [x] Click crawl: 106 screens, 2,505 clicks, 0 errors
- [ ] Change `ADMIN_SECRET` and the mailer keys; deploy `Code.gs` as a new version
- [ ] Distribute the new HTML file
- [ ] Pilot handover and document confirmations with one studio for 4 weeks; record the metrics baseline
