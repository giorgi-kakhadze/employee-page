# Moving existing data into the Server Edition

Nothing is deleted from the old edition. You can run both side by side until you trust the new one; they do not share data after the copy.

## A. From the Google Drive file (the shared "Tool Data")
1. In Google Drive open the **Tool Data** folder and download `tool-data.json` (all locations in one file, keys like `s~site2~totSchedule`).
2. Stop people from editing in the old tool for the moment of the copy (announce a short freeze), or accept that edits made after the download are not copied.
3. On a machine that can reach the new database (or in the App Service SSH console):
   ```bash
   export DATABASE_URL=...   # the same value as the app uses
   node scripts/import-backup.js tool-data.json            # refuses if the database already holds data
   node scripts/import-backup.js tool-data.json --replace # overwrites (take a database backup first)
   ```
4. Open the new address, sign in as administrator, check a few screens against the old tool.
5. Tell people the new address. In the old tool, switch off sync (admin → Google Drive sync → Disconnect) so nobody keeps saving there by mistake.

## B. From a backup file made in the tool (Settings → Backup)
```bash
node scripts/import-backup.js PTF-backup.json --site main
```
A backup holds one location. Repeat with `--site <id>` for each location (the id is the one shown in the site switcher). Local-only settings in the file (your display name, theme, password hashes, sync settings) are skipped on purpose.

## C. What does **not** move
* **Evaluation videos and project attachments** stored in Google Drive. The records keep the old file id; the new server does not have the file. Download them from Drive and re-upload if they must stay available (videos are deleted after 62 days anyway).
* **Employee-page accounts and passwords** of the old edition: not needed. People sign in with Microsoft.
* **Staff passwords**: gone. Staff sign in with Microsoft; their position still comes from Access management.
* **The admin key**: gone. Administrators are people with the `PTF.Admin` app role.

## D. People who must be set up
* Staff: Access management → their work e-mail (the Microsoft sign-in address) with a position. If the e-mail in the tool differs from the Microsoft address (alias), the person sees the employee page instead of the tool.
* Employees: the e-mail on their row in the employee list must equal the Microsoft address. Exactly one row per e-mail.
* Administrators: assign the `PTF.Admin` app role in Entra.

## E. Scale test with realistic data
`node scripts/scale-demo.js` builds about 5,400 fictional people on 4 locations from `demo/PTF-demo-backup.json`; `node scripts/import-backup.js data/scaled-demo.json` loads them. Use it on a staging database, never on production.

## F. Going back
The daily export `ptf-data-YYYY-MM-DD.json` (in the files share, folder `backups`) is in the format the importer reads, and `tool-data.json` is the format the old Apps Script wrote, so data can be moved back to the old edition by converting `keys` (both are `{ keys: { name: { v, t } } }`).
