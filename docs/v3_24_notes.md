# PTF / Gunda v3.24 — colleague list for "Assign to…"

Files changed: `tool/Code.gs` (Apps Script) and `tool/PTF-pass-to-floor-Gunda.html` (one small change to must-read counts). New test: `tests/sync_directory.test.js`.

## The problem
Once Drive sync was set up, only the admin could assign a ticket to another person. Everyone else saw only their own name in every "Assign to…" list: the ticket window, "New ticket" on the Tasks and department boards, and the department board's assignee filter. These lists are built from the access list (`totAccessPolicy.users`), and the server sent a non-admin only their own entry of it.

## What each person now receives
Besides their own entry, the access list sent to a non-admin now holds a colleague directory:

| Person | Colleagues in their list |
|---|---|
| Managers, seniors, and anyone whose position is in the Management department | Everyone |
| Everyone else | The people whose position is in the same department |
| An approved account with no position yet | Nobody |

Each colleague entry has only a name and a position, for example `{ "name": "Levan Lead", "role": "shift_lead" }`. Sites and other fields are not sent. The person's own entry is unchanged.

Departments follow Admin → Space access by role (`policy.depts`), the same rule the server has used for tickets since v3.23. If the admin moves a position to another department, everyone's lists follow at the next sync.

The admin key still receives the full access list.

Checked before the change: outside the admin screens, the tool reads only `name` and `role` from other people's entries. It reads `sites` only from the person's own entry, which is still sent in full.

## On the screens
- **Tasks:** "Assign to…" in the ticket window and the person list in "New ticket" show colleagues from your department. Managers, seniors and Management see everyone.
- **Department board:** the same goes for "Assign to a person" in "New ticket" and for the assignee filter.
- If you pick a department other than your own in "New ticket", the person list shows only "Anyone in the department" (unless you see everyone). The ticket goes to that department's board, as before.
- **Must-read counts:** the "✔ Acknowledged x / y" line under an important announcement and "x / y read" in Home → Overview → Team count y from the same list. With only part of the company in the list, a training coordinator who posted a must-read to everyone would have seen a y that counted only their own department. They would also have seen "everyone has read it" when only their department had. The tool now shows y only when the device holds everyone the announcement went to. That is true for the admin, managers, seniors and Management, and for announcements sent only to your own department. Otherwise it shows x with no total. Managers and seniors see the full count, as before. (Before this release the Team dashboard showed "x / 1 read" in that case, because the device only knew the viewer.)

## You must do
1. Paste the new `tool/Code.gs` into Apps Script (keep your own `ADMIN_SECRET` and `SERVER_SALT`) → Deploy → Manage deployments → edit → **New version**.
2. Give everyone the new `tool/PTF-pass-to-floor-Gunda.html`. The colleague lists come from Code.gs alone, so a v3.23 tool file also shows them after its next sync. With the old file, though, a training coordinator's must-read to everyone shows a total that counts only their department.
3. Nothing to migrate.

## Known limits
- Sites are not checked. The list holds department colleagues from every site. A ticket on one site that is assigned to someone who may not open that site does not reach them. The admin's own device has worked the same way all along.
- Only managers, seniors and Management can pick a person in another department. Everyone else sends to that department's board.

## Tested
`tests/sync_directory.test.js` (25 checks) runs the real `Code.gs` against the in-memory Drive and opens the real tool in headless Chromium:

- a coach's pull lists the coach and the shift lead, but not HR, FMD or the manager. The shift lead's entry is exactly name and position, and the coach's own entry (with sites) is unchanged;
- the shift lead sees the coach. HR, alone in its department, sees only itself. An account with no position gets an empty list;
- the manager and a senior see everyone, with only name and position for other people;
- `policy.depts`: after HR is moved to Performance, the coach sees HR. After the scheduling coordinator is moved to Management, they see everyone. Removing the mapping puts the lists back;
- on the coach's synced device, the Tasks ticket window, the department board's "New ticket" and its assignee filter list both Performance people. "New ticket" to HR shows no HR names;
- must-read counts: a training coordinator's post to everyone shows no total, and their post to Academy shows the full total (in the announcement card and on the Team dashboard). The manager sees "1 / 7" with the names still waiting.

Run against the v3.23 `Code.gs`, the same test fails 12 checks, and the coach's lists show only "Cora Coach". The existing tests give the same results as before: `tests/sync_privacy.test.js` 38 checks, `tests/sync_more.test.js` 6 checks.

Not tested: the real Apps Script runtime and real Google Drive.
