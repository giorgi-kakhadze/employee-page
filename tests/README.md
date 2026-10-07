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
```

- `sync_privacy.test.js`: what each person receives (tickets, cases, comments, announcements, audit log), writes from people who see only part of the list, deleting, forged pushes, two people saving at once, HR case progress.
- `sync_more.test.js`: deletions in other shared lists, multi-site keys, admin pull.
- `sync_directory.test.js`: the colleague list each person receives for "Assign to…" (own department, or everyone for managers and seniors, and for a position the admin mapped to the old Management department; name and position only), department mapping changes, the assign lists on a synced device, must-read totals.
- `nav_spaces.test.js`: the departments-only top bar for admin, manager, coach, shift lead, HR and FMD. Only department buttons and utilities are shown (no Departments, Recruiting, Requests, Coach, Employees, Integrations or Permissions tabs); each visible department opens its own space and second bar (Coach board in Performance; Employees, Employee requests and Game counts in FMD; Recruiting and the board in HR; Uniforms; Office = Building access + IT); no "Management" department anywhere; HR's Home is HR; managers see every department.
- `work_types.test.js`: work type rules. A Termination ticket on the HR board creates linked Uniforms, Building access, FMD and IT tickets and one case on the server; a General ticket stays one ticket; a position mapped to Uniforms receives its linked ticket and the case title; only the admin can write the rules (totProcessTpl); a custom work type added by the admin on the FMD board reaches the FMD device and fans out as configured; game counts reach the scheduling coordinator; a work type sent to another department still creates the board department's step and no duplicate; a linked department can read a case but not edit or delete it; a made-up ticket with someone else's case id does not reveal that case; in admin-only mode a department button opens a screen the person was granted and shows locks on the others.

- `onboarding_share.test.js`: onboarding templates sent as live tickets. A trainer creates a group through the screens and sends Fingerprints (to Building access), Live exam (to Performance) and Uniforms (to Uniforms); one ticket each, no duplicates, the live-exam due date and times; the access team sees the table with the drop-out row in red, ticks a row, adds a note, corrects a Biostar ID and comments; the correction is written back into the onboarding and the trainer's comment reaches the ticket; the ticket record itself is never rewritten; Performance does not receive the Fingerprints table.

Each prints one line per check and exits with code 1 if any check fails.
