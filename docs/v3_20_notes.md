# PTF / Gunda v3.20 — what changed

Files: PTF-pass-to-floor-Gunda_v3_20.html (the tool), Code.gs (Apps Script; old copy kept as Code_v3_19.gs). employee.html is unchanged.

## New: 🏢 Departments (one workspace per department)
HR and Recruitment are ONE department: "HR / Recruitment" (new position "HR / Recruiter", assigned by the admin like the others).
Tabs: Board · Candidates · Lifecycle · Dashboard · Game counts · Documents · Process templates · Setup (admin) · Overview (Management).
- Board: own columns per department. HR: New, Reviewing, Action required, Waiting for department, Processing, Delayed, Completed, Cancelled. Others: New, In progress, Waiting, Delayed, Completed, Cancelled. Admin can change columns and ticket templates (Setup). Tickets stay in the shared Tasks board; each column maps to one of the six basic statuses. Waiting/Delayed/Cancelled ask for a reason. "Reopened" is counted and shown. "Assigned" = the person shown on the card.
- Candidates: the rows of your Recruiting workbooks (Candidate + Status columns) as a pipeline. Moving a card changes the Status cell and the workbook history. "Start onboarding case" for Accepted candidates.
- Lifecycle: stage per employee (Onboarding, Probation, Active, Transfer, Leaving, Retired, Terminated), calculated from the employee Status + open cases. Start onboarding / transfer / termination cases (one task per department). Event log (hired, probation passed, leave...). It never edits the employee record.
- Dashboard per department (open, unassigned, overdue, waiting, urgent, completed, age, by column, by person, stale) + CSV export. HR also shows the recruitment pipeline and open cases. Management Overview compares all departments.
- Documents: register of LINKS (SharePoint/Drive/etc.). No uploads. Review-by dates. Searchable in the main search.
- Process templates: onboarding, transfer, termination steps (admin edits; others read).
- Game counts: import a CSV (Grafana export or other), match columns, validation, employee matching (ID first, then exact name), game-name matching, duplicate detection, import history, undo last import, CSV export. NOT a Grafana connection.
- Integrations page: honest status of every connection, data-ownership and sync-policy tables, planned connector contract, self-test of the import rules.

## Changed in existing code (extend, not replace)
- Tasks: moveTo accepts a department column; reopened counter; cases now support onboarding/transfer/termination (termination unchanged); HR may start cases and see Cases.
- Recruiting and Requests open to the new HR / Recruiter position. Department label HR → "HR / Recruitment" (id unchanged, no data moved).
- New synced keys: totDeptCfg, totDeptDocs, totLifecycle, totGameCounts, totImportHistory.

## You must do
1. Paste the changes of Code.gs into your deployed Apps Script (keep your own ADMIN_SECRET / SERVER_SALT) and deploy a New version. Changed lines: RESTRICT (3 existing keys + 3 new keys) and ADMIN_ONLY_WRITE (+ totDeptCfg).
2. In Admin → Access, give the HR person the position "HR / Recruiter".
3. Still open from before: real Apps Script URL and Client ID in employee.html.

## Tested (headless browser) / not tested
Tested: all new tabs, role access (HR, shift lead, coach, manager, admin), moving cards (buttons and drag), reasons, reopen, templates, cases, candidates, lifecycle, documents (bad links rejected), game-count import incl. duplicates/undo/replace, setup validation, search, mobile width, HTML-injection attempt, old features (evaluations, coach board, demo, templates, search, all views open), Code.gs rules with a simulated server.
Not tested: real Google Drive sync of the 5 new keys, real Apps Script deployment, real Grafana/Jira/SharePoint (not connected), Excel/CSV files from your real systems.

## Honest limits
- Browser role filters are not real security; only the keys in RESTRICT / ADMIN_ONLY_WRITE are enforced by the Apps Script.
- Documents are links only. Game counts are not shown on the employee page yet (needs a server change).
- No automatic escalation rules and no e-mail/Teams notifications yet.
- Start password of the new position (only matters if the position gate is opened): hr-0hcf8rs

---
# v3.21 — Admin-only mode (added later)
File: PTF-pass-to-floor-Gunda_v3_21.html (v3_20 kept). Code.gs updated again (Code_v3_20.gs = previous).
- Everything except Home is locked for everybody but the admin (managers and seniors too): Onboarding, Workshop/Exam, ID, Logbooks, Scheduling, Appearance, Tasks, Recruiting, Coach board, Requests, Departments, Employees.
- A locked tab shows a 🔒. Opening it shows "Request access" (optional reason). The admin gets the request in the new 🔐 Permissions tab (badge + Home "needs attention").
- Admin approves (until removed, 1, 7 or 30 days) or declines (with a note). A grid also lets the admin tick/untick screens per person, grant "the position's screens" in one click, or remove all.
- Mode is ON automatically when Drive sync is set up on the device; OFF for single-user local use. The admin can switch it by hand in Permissions.
- The Apps Script enforces it for the synced data behind each screen (grants only writable by the admin, a person sees only their own grant and requests). Server also now checks admin-only keys by key name on every site.
- Not locked: Home (landing page + employee import there), audit log, employee list sync. The admin sees everything, also in "view as".
- Coach flow opens the exam screen, so a coach needs both Coach board and Workshop/Exam.
- Roll-out: after deploying the new Code.gs everyone except you is locked until you grant access, so open Permissions and use "Position's screens" per person first.
