# PTF / Gunda v3.25 — spaces on synced devices

Files changed: `tool/Code.gs` (Apps Script) and `tool/PTF-pass-to-floor-Gunda.html` (the Spaces script). New test: `tests/sync_spaces.test.js`.

## The problem
Spaces (Admin → ⚙ Manage spaces, since v2.72) only worked on the admin's own device. The admin saves the spaces inside the access list (`totAccessPolicy.spaces` and `totAccessPolicy.spacesStrict`). The server sends non-admins a cut-down access list (`redactPolicy_` in Code.gs) that had only `roles`, `depts`, `users` and `upd`, so every space and the "Strict" switch were dropped.

On everyone else's synced device:
- each person had every screen their position allows, whatever space they were in;
- "Viewer (view only)" members could still edit the Schedule and profiles;
- with "Strict" on, people in no space could still open every screen;
- the space pill was hidden, and the extra profile tabs a space adds (for example "Mentor" or "Contract type") did not appear.

Checked with the test harness before the fix: the coach's device held no `spaces` key, `totSpaceAllows('exam')` returned `true` although the coach's only space had no Workshop, and `totSpaceRole()` returned `''`.

## What each person now receives
The admin key still receives the full access list, with every space and every member. The Manage spaces screen reads that list.

A non-admin now receives:

| Space | What is sent |
|---|---|
| A space the person is a member of | The whole space (name, icon, screens, profile fields, "everyone can view" setting), with `members` cut to the person's own entry, for example `{ "coach@x.com": "viewer" }` |
| A space they are not in whose profile tab is set to "Everyone can view this tab" | Name, icon and profile fields only, so the tab can be shown read-only. No members, no screens |
| Any other space | Nothing |

They also receive:
- `spacesStrict`: the "Strict" switch, as the admin set it.
- `spacesOn: true` when the organisation has at least one space. A person in no space may receive no spaces at all, so this is how the device knows that "Strict" applies to them.

Nobody sees who else is in a space or what role they have. Member e-mails are matched without regard to upper and lower case.

If the admin has never saved spaces, the access list has the same shape as in v3.24.

## On the screens
- **Members:** the space pill in the top bar shows the space and, for viewers, 👁. Home shows "you are Viewer (view only)" and the space's screens. The menu shows only screens that are both in the person's position and in the current space. People in more than one space switch with the pill.
- **Viewers:** Schedule, profile and the other screens that check `totSpaceRO()` are view only, as they already were on the admin's device.
- **"Strict" on, person in no space:** only Home opens. The pill says "📁 No space", and Home says "You are not in any space yet, so no screens are open. Ask your admin to add you." This now also works when none of the spaces is open to everyone, so the device received no spaces at all.
- **"Strict" on but every space deleted:** nobody is locked out, as before.
- **Profile tabs:** a member sees their space's tab (editable for owners and editors, view only for viewers). Everyone sees, view only, the tabs of spaces marked "Everyone can view this tab".

## Before you deploy
Spaces the admin saved earlier now take effect for everybody at their next sync. Open ⚙ Manage spaces first and check the members, their roles and the "Strict" box. Anyone left out of every space is kept to Home if "Strict" is ticked.

## You must do
1. Paste the new `tool/Code.gs` into Apps Script (keep your own `ADMIN_SECRET` and `SERVER_SALT`) → Deploy → Manage deployments → edit → **New version**.
2. Give everyone the new `tool/PTF-pass-to-floor-Gunda.html`. With Code.gs v3.25, a v3.24 tool file already applies spaces to members. One case needs the new file: with "Strict" on and no space open to everyone, the old file lets a person who is in no space open every screen.
3. Nothing to migrate.

## Known limits
- Spaces decide what the tool shows. The server does not check them when it sends or saves data. Positions, sites and admin-only mode are what the server enforces.
- The values typed into a space's profile tab are stored with the person's profile inside the schedule (`totSchedule`). The schedule goes to everyone who may open it. So the server still sends those values to people who are not in the space, even though their device no longer shows the tab. This was true before v3.25 as well.

## Tested
`tests/sync_spaces.test.js` (31 checks) runs the real `Code.gs` against the in-memory Drive and opens the real tool in headless Chromium. The test policy has three spaces: Training (coach as viewer, shift lead as owner, closed), Scheduling (FMD as editor, open to everyone) and HR (HR as owner, closed). "Strict" is on.

- Server pull: the coach receives Training and Scheduling, not HR. Training's members are only `{ "coach@x.com": "viewer" }`, and its screens and fields are kept. Scheduling has its fields but no members and no screens. `spacesStrict` and `spacesOn` are sent. The shift lead's entry, stored as `Lead@X.com`, still matches. HR, FMD and the manager (in no space) each receive the right list. The admin receives everything. Entries without an id or name are skipped. With no spaces saved, the access list has the v3.24 shape.
- The coach's device: Onboarding is allowed, Workshop and Schedule are blocked and the Workshop button is hidden. The role is viewer, so the device is view only. The pill shows "T Training 👁", Home names the space, and the profile tabs are Training (viewer) and Scheduling (view only). The coach's syncs leave the server's spaces unchanged.
- The manager in no space, with "Strict" on: only Home is open. The pill says "No space" and Home shows the banner. The same holds when no space is open to everyone. Turning "Strict" off opens the screens again. With "Strict" on but no spaces, nobody is locked out.
- The admin's Manage spaces screen still lists every member.

Run against the v3.24 `Code.gs` and tool, the same test fails 24 checks. With the new `Code.gs` and the v3.24 tool, it fails the 2 checks for a person who received no spaces at all. The existing tests give the same results as before: `tests/sync_privacy.test.js` 38 checks, `tests/sync_more.test.js` 6 checks, `tests/sync_directory.test.js` 25 checks.

Not tested: the real Apps Script runtime and real Google Drive.
