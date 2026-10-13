# PTF / Gunda v3.26: send onboarding templates to departments as live tickets

Files changed: `tool/PTF-pass-to-floor-Gunda.html` only (Code.gs is unchanged). New test: `tests/onboarding_share.test.js`.

## What it does
In **Academy → Onboarding → (a group) → Templates**, three templates now have a **📨 Send to …** button next to Print and Copy:

| Template | Goes to | Due date of the ticket |
|---|---|---|
| Fingerprints | 🔑 Office · Building access | training start + 3 days |
| Live Exam Email / Jira tkt | 📊 Performance | the Exam Date (when written as dd/mm/yyyy), otherwise training start + 1 day |
| UNIFORMS | 👕 Uniforms | training start + 2 days |

One click creates **one ticket** on that department's board, carrying the whole table. After that, the button reads **✓ Sent to …**: clicking it opens the ticket instead of creating another. A line under the template shows the ticket number, its status, and how many rows the department has ticked done.

## The table stays up to date
Whenever the trainer changes the onboarding group, the table in the ticket updates by itself. This covers:
- new trainees and any cell of the template;
- a trainee's **Status** (Drop Out, Terminated, Absent, Mover, Finished Training) and **Drop-out reason**, both now part of the shared table;
- the new **Comment** column on these three templates, for things like "Late on day 2".

Rows for people who dropped out, were terminated, are absent or moved are shown in red. The ticket says when the table was last updated.

The Live exam table also shows the Exam Date, Live Exam Time and Group start date, plus each person's **Time Frame**.

## What the department can do in the ticket
- **Tick a row ✓ Done**, so the trainer sees "2/3 done by the department".
- **Add a note** to a row.
- **Correct an editable cell** (shown with a white box), for example a Biostar ID, a team, a group type or a time frame. The correction is written back into the onboarding group on the trainer's device, so it is not typed twice.
- **Comment, assign, change the status, escalate**, as on any ticket.

The trainer gets a 🔔 notification when the department ticks, notes or corrects something.

## How it is built
The table is not stored inside the ticket itself. It sits next to the ticket, in the same kind of small records as comments:
- one "snapshot" record, which the trainer's device rewrites;
- one record per tick, note or correction from the department.

This keeps two things separate. The trainer's automatic refresh never changes the ticket's status, assignee or due date. And the department's edits and the trainer's updates never overwrite each other, even when both happen at the same moment. These records follow the ticket's visibility on the server:
- The Fingerprints table, with phones and e-mails, reaches Building access, the sender's department and managers/seniors.
- It does not reach Performance or FMD.
- The table records never show up as comments.

## Limits
- A table refreshes from a device that has the onboarding group open. That is normally the trainer's own device, within a few seconds of a change. If nobody has the group open, the table updates the next time someone opens it.
- Corrections from the department are written back the next time a device with that group open syncs.
- Uniforms, Building access and IT boards need a position mapped to them (Admin → Space access by role) to have members. Until then, managers, seniors and the admin see them.
- If the ticket is cancelled, the template shows the Send button again, so a new ticket can be sent.

## You must do
Give everyone the new `tool/PTF-pass-to-floor-Gunda.html`. `Code.gs` does not change (v3.25 is enough).

## Tested
- `onboarding_share.test.js` (26 checks). A trainer creates a real group through the screens and sends all three templates. Then:
  - Building access sees the table, with the drop-out in red.
  - Building access ticks a row, adds a note, corrects a Biostar ID and comments.
  - The correction lands in the onboarding, and the trainer's comment reaches the ticket.
  - The ticket record itself is never rewritten.
  - Performance does not receive the Fingerprints table.
- All other files still pass: sync_privacy 38, sync_more 6, sync_directory 25, nav_spaces 60, work_types 40. That is 195 checks in total.
- Clicking every button and sub-tab as admin, manager, coach, shift lead, HR and FMD shows no page errors.
