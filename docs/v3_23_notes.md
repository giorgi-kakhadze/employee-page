# PTF / Gunda v3.23 — ticket privacy on the server

Files changed: `tool/Code.gs` (Apps Script) and `tool/PTF-pass-to-floor-Gunda.html` (sync code only). New: `tests/`.

## What each person now receives from the server

| Data | Who receives a record |
|---|---|
| **Tickets** (`totTasks`) | The sender · the assignee · everyone in the department it is addressed to · everyone in the department that sent it · HR for tickets that belong to a case · managers, seniors and Management: all |
| **Cases** (`totCases`) | HR · the person who started it · managers, seniors and Management |
| **Comments** (`totComments`) | Whoever can see the ticket or announcement it belongs to · its author |
| **Announcements** (`totAnnouncements`) | The departments it was sent to (or everyone if it was sent to everyone) · its author · managers, seniors and Management |
| **Audit log** | Non-admins: only their own entries. The admin: everything |

This is the same rule the screens already used for "my board", "sent by me" and "All tasks" (managers and seniors). The difference is that the other records are no longer on the device at all, so they can't be found through search, notifications, the browser's developer tools or a backup file. Old tickets addressed to a position (for example "scheduling_coordinator") go to that position's department, using the mapping in Admin → Space access by role.

The admin key still receives everything.

## How saving works now
- A save is merged **ticket by ticket**. Records a person can't see are never changed or removed by their save.
- A person can delete only records they created (or anything, if they are a manager, senior, Management or the admin). This is the same rule as the delete buttons. Other "deletions" are ignored, and the record comes back on their device at the next sync.
- New records are accepted only if the person who saves can see them. For example, a ticket "sent by HR" saved from a shift lead's account is refused.
- Deleted ticket, case, comment and announcement ids are remembered on the server for 180 days, so a device with an old copy cannot bring them back.
- Audit log: new entries from a non-admin are added, never replacing the list. Entries in someone else's name are refused; entries without an e-mail are stamped with the sender's e-mail.

## Two older sync bugs fixed (they were in v3.21 and v3.22 too)
1. **Deleted records came back.** Deleting a ticket, a department document, a request or any other shared record was undone by the next sync, because the merge re-added whatever the server still had. Now a record this device had at the last sync and removed since stays deleted, unless someone else edited it in the meantime (then their edit wins, so no work is lost).
2. **Edits were lost when two people saved at the same moment.** The second device was told to merge and retry, but it forgot what the last synced state was, so its own edit lost to the other person's. Now both edits are kept.

## You must do
1. Paste the new `tool/Code.gs` into Apps Script (keep your own `ADMIN_SECRET` and `SERVER_SALT`) → Deploy → Manage deployments → edit → **New version**.
2. Give everyone the new `tool/PTF-pass-to-floor-Gunda.html`. An old tool file still works with the new Code.gs, but it keeps the two sync bugs above.
3. Nothing to migrate. On each device's next sync, the records it may no longer see are removed from that device automatically.

## Known limit (queued as a separate task)
On a synced device, "Assign to…" lists only yourself, because the server sends a non-admin only their own account. This was already the case before v3.23. It needs a small colleague list (name and position) from the server.

## Tested
`tests/sync_privacy.test.js` (40 checks) and `tests/sync_more.test.js` (6 checks) run the real `Code.gs` against an in-memory Drive, with the real tool open in headless Chromium for the admin, HR, a shift lead, a performance coach, a scheduling coordinator and a manager:

- what each person receives;
- creating, commenting and deleting from a partial view;
- a stale device with local edits not bringing deleted tickets back;
- refusing deletes of other people's tickets;
- forged pushes (changing a hidden ticket, creating a ticket in someone else's name, a forged audit entry);
- an empty-list push deleting only the sender's own tickets;
- two people saving at the same moment;
- HR case progress across departments;
- deletions in another list (department documents);
- multi-site keys.

The lost-edit bug was reproduced on the original v3.21 files with the same test before it was fixed. The earlier v3.22 screen tests still pass.

Not tested: the real Apps Script runtime and real Google Drive. The test server imitates them, and its speed or limits may differ.
