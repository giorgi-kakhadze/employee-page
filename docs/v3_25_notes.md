# PTF / Gunda v3.25: departments-only navigation, work types, Management as a position

Files changed:
- `tool/PTF-pass-to-floor-Gunda.html`
- `tool/Code.gs`
- tests: `tests/nav_spaces.test.js` and `tests/work_types.test.js` are new; `tests/sync_directory.test.js` uses a tighter selector.

## Navigation: only departments in the top bar

**Home · 🎓 Academy · 📊 Performance · 📅 FMD · 👕 Uniforms · 🧲 HR · 🏢 Office**, then:
- ✅ My tickets: your inbox, tickets you sent, all tickets for managers, and News.
- 🔔 Notifications.
- 🔍 Search.

Each department's screens are in the second bar under it:

| Department | Second bar |
|---|---|
| Academy | Overview · Onboarding · Workshop · ID Creation · Logbooks · Board · Dashboard · Documents · Work types |
| Performance | Exam Evaluation · Workshop Evaluation · Results · Retraining · Videos · Send results · **🎯 Coach board** · Board · Dashboard · Documents · Work types |
| FMD | Schedule · **👥 Employees** · **📨 Employee requests** (with the count) · Board · Dashboard · **🎮 Game counts** · Documents · Work types |
| Uniforms (was Appearance) | Uniforms · Board · Dashboard · Documents · Work types |
| HR | **🧲 Recruiting** · Board · Candidates · Lifecycle · Dashboard · Documents · Work types |
| Office | 🔑 Building access: Board · Dashboard · Documents · Work types, then 💻 IT: the same |

The admin also sees ⚙ Setup in every department.

- **The "Departments" screen is gone.** Each department's ticket board lives in its own space. It no longer has a department switcher.
- **Integrations and Permissions** are in **More** (admin only).
- **A department button only shows if the person has at least one screen in it.** HR and FMD no longer see a Performance button that led nowhere.
- **Admin-only mode:** a department button opens the first screen the person was granted. Locked screens show 🔒 in the second bar instead of bouncing to Home.
- **On phones**, both bars scroll sideways.

## Management is a position, not a department

- **Managers and seniors** (heads of studio, operations managers) see every department. They have no department of their own, and there is no Management board.
- **In Admin → Space access by role**, manager and senior show "— all departments (position) —".
  - A position you had mapped to the old Management department keeps that mapping and its wide access. It shows as "— all departments (old Management mapping) —", and saving does not change it.
- **Built-in process steps** no longer create a "Management" ticket. Saved steps for Management are skipped.
- **Old tickets** addressed to Management stay visible to managers and seniors under ✅ My tickets → All.
- **Escalations** now notify "managers and seniors and the sender".
- **Home** greets each person with their own department: HR now sees "HR", not "Management". Managers see "All departments", plus a 🏢 All departments button that opens a table of every department.

## Work types (rules)

Every department has a **⚡ Work types** tab. A work type is a list of follow-up steps: department, ticket title, and due in N days.

- **Built-in types** are on the HR board:
  - **Termination:** HR processes it; Uniforms collects the uniform; Building access removes access; FMD removes the person from future schedules; IT removes system access.
  - **Onboarding** and **Transfer**: the same idea.
- **The admin can add custom types on any board**, for example "Shift swap" on FMD with steps for Uniforms and IT, and can edit or reset the built-in steps. Everyone else sees the list read-only.
- **In ＋ New ticket, choose the Work type.** A preview shows what else will be created. Creating the ticket:
  - also creates one linked ticket per step on the other boards,
  - groups them all in one 📁 case with progress (e.g. 2/5 done).
  - The step for the department you send the ticket to is the ticket itself.
  - A **General** ticket is only one ticket.
- **Visibility:** each linked department sees its own ticket and can **read** the case title. It cannot edit or delete the case. HR and managers see the whole case.
- **Where they are stored:** work types live in the existing process templates (`totProcessTpl`). On the server, only the admin can write them.

## Fixes found in the review of the whole tool
- **HR's Home said "Management".** Fixed: every department has its own Home.
- **Employee requests:** the filter buttons and the type list were white on white in the dark theme. Fixed; the same fix applies to the Coach board buttons.
- **Department boards** had no side margin and ran off the right edge at 1440px. Fixed; the columns now fit.
- **The floating "← Back" button** showed internal names ("Back to perm", "Back to dept"). It now says, for example, "Back to FMD · Employees".
- **The assistant's speech bubble** showed one word per line. Fixed.
- **The Uniforms screen** used bigger text and a narrower column than the other screens. It now matches them.
- **Screen bottoms:** the last row of every space screen can now scroll clear of the Back button and the assistant.
- **Second bar on wide screens:** one row, scrolling sideways when a department has many screens.
- **Toolbar:**
  - The sound and music quick buttons moved into More.
  - The old "📁 Spaces" pill shows only to the admin, and only when spaces exist.
- **Employees** shows only to people who can open it (it used to show "managers only" to everyone).
- **The Integrations page** used light-theme colours on the dark theme. Fixed.
- **Tickets:** the case chip on a ticket card had a broken tooltip. Fixed.

## Server (`Code.gs`)
- **Departments:** `management` left the department list. Managers and seniors still see everything by position. A position mapped to `management` in the policy keeps its wide access (legacy compatibility).
- **Case records:** readable by anyone who has a ticket that the case itself created. Only HR, managers and seniors, or the case's creator can save or delete one. A ticket a person makes up with someone else's case id does not reveal that case.
- **Game counts:** they and their import history now reach the scheduling coordinator, because Game counts moved to FMD.

## You must do
1. Paste the new `tool/Code.gs` into Apps Script, keeping your own `ADMIN_SECRET` and `SERVER_SALT`. Then Deploy → Manage deployments → edit → **New version**.
2. Give everyone the new `tool/PTF-pass-to-floor-Gunda.html`.
3. **Optional:** in Admin → Space access by role, map a position to Uniforms, Building access or IT if those boards should have members. By default no position belongs to them, so only managers, seniors and the admin see their boards. HR still sees every case ticket.
4. Nothing to migrate.

## Tested
All 169 checks pass:

| File | Checks | What it covers |
|---|---|---|
| `sync_privacy` | 38 | |
| `sync_more` | 6 | |
| `sync_directory` | 25 | |
| `nav_spaces` (new) | 60 | The bar and second bar for admin, manager, coach, shift lead, HR and FMD |
| `work_types` (new) | 40 | Fan-out; who receives what; admin-only rules; custom types; game counts; and the review fixes: a work type sent to another department, linked departments not able to edit or delete a case, fake case ids, admin-only mode |

A headless tour that clicks every top button and every second-bar item for the same six positions shows no page errors.

Three independent reviews found 4 major and 10 minor problems. All major ones and most minor ones are fixed, with tests. The 8 new review checks fail on the code from before the fixes and pass now.

**Not tested:** the real Apps Script runtime and Google Drive.

**Known limits:**
- Uniforms, Building access and IT boards have no members until the admin maps a position to them.
- A work type ticket for an employee who already has an open case of the same type starts a second case.
