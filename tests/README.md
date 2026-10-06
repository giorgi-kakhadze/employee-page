# Tests

Sync and privacy tests. They run the real `tool/Code.gs` against an in-memory Google Drive, and open the real tool in headless Chromium for each person (admin, HR, shift lead, coach, scheduling coordinator, manager).

```
npm install -g playwright      # once; uses the Chromium Playwright provides
node tests/sync_privacy.test.js
node tests/sync_more.test.js
node tests/sync_directory.test.js
node tests/sync_spaces.test.js
```

- `sync_privacy.test.js`: what each person receives (tickets, cases, comments, announcements, audit log), writes from people who see only part of the list, deleting, forged pushes, two people saving at once, HR case progress.
- `sync_more.test.js`: deletions in other shared lists, multi-site keys, admin pull.
- `sync_directory.test.js`: the colleague list each person receives for "Assign to…" (own department, or everyone for managers, seniors and Management; name and position only), department mapping changes, the assign lists on a synced device, must-read totals.
- `sync_spaces.test.js`: the spaces each person receives (only spaces they are in, members cut to their own entry; open profile tabs without members; the "Strict" switch), and on a synced device the allowed screens, view-only role, space pill and Home banner, "Strict" for a person in no space, and the admin's Manage spaces screen.

Each prints one line per check and exits with code 1 if any check fails.
