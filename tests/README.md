# Tests

Sync and privacy tests. They run the real `tool/Code.gs` against an in-memory Google Drive, and open the real tool in headless Chromium for each person (admin, HR, shift lead, coach, scheduling coordinator, manager).

```
npm install -g playwright      # once; uses the Chromium Playwright provides
node tests/sync_privacy.test.js
node tests/sync_more.test.js
```

- `sync_privacy.test.js`: what each person receives (tickets, cases, comments, announcements, audit log), writes from people who see only part of the list, deleting, forged pushes, two people saving at once, HR case progress.
- `sync_more.test.js`: deletions in other shared lists, multi-site keys, admin pull.

Both print one line per check and exit with code 1 if any check fails.
