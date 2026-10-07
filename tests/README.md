# Tests

Sync and privacy tests. They run the real `tool/Code.gs` against an in-memory Google Drive, and open the real tool in headless Chromium for each person (admin, HR, shift lead, coach, scheduling coordinator, manager).

```
npm install -g playwright      # once; uses the Chromium Playwright provides
node tests/sync_privacy.test.js
node tests/sync_more.test.js
node tests/sync_directory.test.js
node tests/nav_spaces.test.js
node tests/work_types.test.js
node tests/onboarding_share.test.js
node tests/schedule_grid.test.js
node tests/evaluation.test.js
node tests/overview_history.test.js
node tests/service_mgmt.test.js
node tests/unique_names.test.js
node tests/bonus_pay.test.js
node tests/projects.test.js
node tests/projects_teams.test.js
```

- `sync_privacy.test.js`: what each person receives (tickets, cases, comments, announcements, audit log), writes from people who see only part of the list, deleting, forged pushes, two people saving at once, HR case progress.
- `sync_more.test.js`: deletions in other shared lists, multi-site keys, admin pull.
- `sync_directory.test.js`: the colleague list each person receives for "Assign to…" (own department, or everyone for managers and seniors, and for a position the admin mapped to the old Management department; name and position only), department mapping changes, the assign lists on a synced device, must-read totals.
- `nav_spaces.test.js`: the departments-only top bar for admin, manager, coach, shift lead, HR and FMD. Only department buttons and utilities are shown (no Departments, Recruiting, Requests, Coach, Employees, Integrations or Permissions tabs); each visible department opens its own space and second bar (Coach board in Performance; Employees, Employee requests and Game counts in FMD; Recruiting and the board in HR; Uniforms; Office = Building access + IT); no "Management" department anywhere; HR's Home is HR; managers see every department.
- `work_types.test.js`: work type rules. A Termination ticket on the HR board creates linked Uniforms, Building access, FMD and IT tickets and one case on the server; a General ticket stays one ticket; a position mapped to Uniforms receives its linked ticket and the case title; only the admin can write the rules (totProcessTpl); a custom work type added by the admin on the FMD board reaches the FMD device and fans out as configured; game counts reach the scheduling coordinator; a work type sent to another department still creates the board department's step and no duplicate; a linked department can read a case but not edit or delete it; a made-up ticket with someone else's case id does not reveal that case; in admin-only mode a department button opens a screen the person was granted and shows locks on the others.

- `onboarding_share.test.js`: onboarding templates sent as live tickets. A trainer creates a group through the screens and sends Fingerprints (to Building access), Live exam (to Performance) and Uniforms (to Uniforms); one ticket each, no duplicates, the live-exam due date and times; the access team sees the table with the drop-out row in red, ticks a row, adds a note, corrects a Biostar ID and comments; the correction is written back into the onboarding and the trainer's comment reaches the ticket; the ticket record itself is never rewritten; Performance does not receive the Fingerprints table.
- `schedule_grid.test.js`: FMD schedule and rotation grids: breaks count as working hours; Ctrl+click and whole-person selection; Delete clears the selection; drag shifts to another day or person (comments move along), swap by dropping one on another, move a block; show only selected people.
- `evaluation.test.js`: evaluation kinds (Exam, Beginner, Regular…) and Average / Close-up scoring (main criteria only, procedural deductions shown but not counted); a photo attached while evaluating one by one is stored with the result and shown in Results; a video is uploaded to (simulated) Drive and linked to the result; grid photos; the type editor keeps the method and main criteria; saving inside the evaluation frame is recorded in the change journal.
- `overview_history.test.js`: Settings instead of Print/Backup (who sees it, full backup only for the admin and managers); every department opens on its Overview, with History at the end of its second bar; the tools moved out of More; Retraining stays in Academy, Performance or FMD; the FMD staff directory (search by Work ID, barcode, badge, screen name; position, team, status and working-today filters; opening a profile); the profile's next 7 days and rotation right now; shift and profile changes recorded with who and when, shown in the profile History and FMD → History; the server journal is add-only and each person reads only what they may; sync does not record changes twice or resend the journal.
- `service_mgmt.test.js`: the Service Management department (🚨 Service, position Service manager): its Overview and second bar; the Jira CSV import (date formats, column guessing from Jira headers, Check, employee matching by Work ID / name / screen name, re-import updates by Jira key and keeps the follow-up note, undo); logging an incident by hand; reports and CSV; the journal; who receives incidents on the server (coaches read only, HR and shift leads nothing, a position mapped to the department yes); the person 360 view.
- `unique_names.test.js`: one nickname / one full name per person in Onboarding (typing, paste, import) and the employee file; repeated names get a number ("Georgi Kakadze 1"); the same person moving groups is not a duplicate; only the admin can switch the rules off (admin space, Settings), and the server refuses the setting from anyone else; the duplicate finder.
- `bonus_pay.test.js`: pay per hour with actual hours (left early); bonus programs with levels per position; the month review (numbers, levels, hours, remarks shown or internal, final); the profile Month tab; pay statements; the server rules for bonus, review, pay and remark data; 'me' returns only the employee's own statement, shown remarks, incidents and evaluation comments; new request types; the employee page with Home / Schedule / Rotation, read-only.
- `projects.test.js`: projects per person (assigned departments and people, viewers, private and open projects); sub-projects; what the server refuses (viewer edits, access changes by assigned people, forged owners, deleting without rights); item assignees; the board and project discussion; bell notifications only for the people involved; the daily digest and on-demand e-mail updates; the pages (My work, All projects, Data explorer filters by any field including own fields, work map, timeline, board, items, access, Updates); creating through the forms; deleting a project with its items.
- `projects_teams.test.js`: teams (only managers write; members get team and team-department projects); restricted and shared items; board drawing rights; approvals (server-computed status, own decision only, no wiping); workflow stage gates; sub-tasks and distribution; comments on items (not leaked from restricted items); deadline warnings; file upload / download with access checks and the Files tab; Progress page (projects, teams, departments) and the Teams page; digest with team members and deadlines.

Each prints one line per check and exits with code 1 if any check fails.
