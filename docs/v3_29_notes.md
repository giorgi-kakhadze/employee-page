# PTF / Gunda v3.29: Service Management department

Files changed:
- `tool/PTF-pass-to-floor-Gunda.html`
- `tool/Code.gs`
- tests:
  - new: `tests/service_mgmt.test.js`;
  - changed: `tests/nav_spaces.test.js`, which now expects the 🚨 Service button and no longer mistakes "Service Management" for the old Management department.

## What it is for
Service managers register game presenters' procedural mistakes and cases in Jira; the game itself is resumed with the internal tool. The tool can now hold those incidents next to everything else about the person. Service managers export from Jira, import the file here, edit the incidents and report on them.

**The tool does not connect to Jira.** It reads the CSV file Jira exports.

## The department
- **New top-bar button: 🚨 Service** (Service Management).
- **New position: Service manager.** It belongs to Service Management. The admin can also map any other position to the department (Admin → Space access by role).
- **Who sees the Service button:** service managers, managers, seniors and the admin.
- **Home** for a service manager says "Service Management" and has shortcuts to Incidents, Jira import and Service reports.

The second bar has these pages:

| Page | What it does |
|---|---|
| 🏠 Overview | Incidents this month, open incidents, presenters this month, presenters with 3 or more this month, last Jira import, open tickets; cards for every page; latest changes |
| 🚨 Incidents | The list of incidents (see below) |
| ⬆ Jira import | Load the Jira export (see below) |
| 📈 Reports | Numbers and breakdowns for a period (see below) |
| 🗂 Board · 📊 Dashboard · 📄 Documents · ⚡ Work types | The department's own ticket board, like every other department |
| 📜 History | Who imported, logged, edited or deleted what, and when |

### 🚨 Incidents
- **One row per incident:** Jira key, date and time, game presenter with Work ID, game and table, mistake type, severity, summary, status, reported by.
  - Newest first, 100 at a time.
  - A **?** marks a presenter who is not in the employee list.
- **Filters:** search (key, presenter, Work ID, game, table, summary, note…), period (last 7 / 30 / 90 days, this month, last month, this year, all time, from–to), status (open / closed), mistake type, game, severity.
- **Click a row** to open the incident. You can:
  - edit any field (service managers, managers and seniors);
  - add a **follow-up note**, which only lives in the tool;
  - **👤 Open profile**;
  - **🔁 Ask Performance for a re-evaluation**, which creates the usual re-evaluation ticket;
  - **↗ Open in Jira**, once the Jira address is set in Jira settings;
  - **Delete**.
- **＋ New incident:** log one by hand when it is not in Jira. It gets a key like `LOCAL-…`. The presenter is matched to the employee list by Work ID, full name or screen name.
- **⬇ Export CSV:** downloads the filtered list.

### ⬆ Jira import
1. In Jira, search the issues (e.g. `project = SM AND created >= -30d`), then **Export → Export CSV (all fields)**.
2. Choose the file (or paste the rows). The tool guesses which column is which:
   - It understands Jira's own headers ("Issue key", "Created", "Priority", "Reporter", "Status") and custom fields ("Custom field (Game presenter)", "Custom field (Mistake type)", …).
   - You can change any column. The mapping you used is remembered for next time.
   - A preview shows the first 3 rows.
3. **Check** shows:
   - how many rows are new, updated in Jira, or unchanged;
   - the rows that cannot be imported (no key, a date it does not understand, no presenter), with the row number;
   - keys repeated in the file;
   - presenters not found in the employee list. They are still imported, as written.
4. **Import.** Importing the same issues again **updates them by Jira key**: the Jira fields change, and the follow-up note written in the tool stays. A weekly export is enough.

Details:
- **Dates:** `07/Oct/26 2:15 PM` (Jira's default), `2026-10-07 14:15`, `07.10.2026 09:30`, `Oct 7, 2026 11:05 PM` and `07/10/2026`.
- **Priority → severity:** Highest / Blocker → Critical; High / Major → High; Medium → Medium; Low / Lowest / Minor → Low.
- **Import history:** every import is listed (who, file, numbers). The latest one can be **undone**: new incidents are removed and updated ones go back to how they were.
- **⬇ Example CSV:** a file with the expected columns.
- **Jira settings:** the Jira address, used for the "Open in Jira" link.

### 📈 Reports
For a period (this month by default):
- **Numbers:** incidents, presenters involved, incidents per presenter, presenters with 3 or more, high or critical, still open.
- **Game presenters with the most incidents:** count, high or critical, most common type, last date, a **repeat** tag at 3 or more, and buttons to open the profile or the list of their incidents.
- **Breakdowns:** by mistake type, game, shift, severity, table, reporter, week and status. When there is no Shift column, the shift is taken from the time.
- **Downloads:** each section as CSV, the full report as one CSV, and 🖨 Print.

### Elsewhere in the tool
- **The person's profile**, Info tab: "Service incidents" with the last 5. Click one to open it. Everyone who may read incidents sees this.
- **The person 360 view** has a "Service incidents (from Jira)" section: the count, the last date and the last 5 incidents.
- **The profile 📜 History tab** lists incident changes about the person.
- **Service Management is a normal department** for tickets, work types and the department selects.

## Who sees and changes incidents (server)
| Who | Incidents |
|---|---|
| Service managers, managers, seniors, the admin, and positions mapped to Service Management | Read and change |
| Performance coaches | Read only (to coach). The server refuses their changes. They see incidents in the person's profile (Info tab) and open them read-only; they have no Service button. |
| HR, shift leads and everyone else | Do not receive incidents |

In admin-only mode, incidents follow the "department boards" grant.

New keys: `totIncidents` (the incidents), `totIncImports` (import history) and `totIncCfg` (Jira address and the last column mapping). They are part of backups and sync.

## You must do
1. Paste the new `tool/Code.gs` into Apps Script, keeping your own `ADMIN_SECRET` and `SERVER_SALT`. Then Deploy → Manage deployments → edit → **New version**.
2. Give everyone the new `tool/PTF-pass-to-floor-Gunda.html`.
3. In Admin, give each service manager the position **Service manager**. If you use the old position picker with a password, set a password for the position first (Admin → position password); it has no starting password.

## Tested
All 333 checks pass:

| File | Checks |
|---|---|
| sync_privacy | 38 |
| sync_more | 6 |
| sync_directory | 25 |
| nav_spaces | 60 |
| work_types | 41 |
| onboarding_share | 26 |
| schedule_grid | 20 |
| evaluation | 24 |
| overview_history | 55 |
| service_mgmt (new) | 38 |

**What `service_mgmt` covers:**
- **The space:** the Service button only for the service manager, Home, Overview, the second bar.
- **Jira import:** the Jira date formats; the column guessing; Check (new, not imported, repeated key, unknown presenter); importing, with screen-name matching and Priority → severity; one History line per import.
- **Incidents:** search; a follow-up note; a re-import that updates the Jira status and keeps the note; undo; an incident logged by hand.
- **Reports:** the numbers and sections; the CSV download.
- **Server:** the coach reads but cannot change incidents; HR and shift leads receive nothing; a position mapped to the department receives them.
- **Elsewhere:** the person 360 view; a coach opening an incident read-only from a profile.

A headless tour that clicks every button as admin, manager, coach, shift lead, HR and FMD shows no page errors. On a 390 px phone the incidents page has no sideways scroll.

**Not tested:** the real Apps Script runtime, Google Drive, and a real Jira export from your Jira. Custom field names differ per Jira; check the column mapping on the first import.
