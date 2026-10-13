# PTF / Gunda v3.22 — what changed

Files: `tool/PTF-pass-to-floor-Gunda.html` (the tool), `tool/Code.gs` (Apps Script), `index.html` (employee page, renamed from `index.html.html`).
Full requirement-by-requirement status: `docs/STATUS.md`.

## Tickets (Tasks and Departments boards)
- Four priority levels: Low, Normal, High, Urgent. Old tickets (Normal/Urgent) are unchanged.
- **⚠ Escalate** inside a ticket. It needs a reason, makes the ticket urgent, and notifies Management, the sender and the assignee. "Remove escalation" puts the old priority back. Completing or cancelling a ticket ends the escalation.
- **Links** on a ticket (SharePoint, Drive, Jira…). Only `https://` / `http://` links are accepted. The file keeps its own permissions; nothing is uploaded.
- Completion date is stored and shown, and exported in the CSV.
- Department board: filter by assignee (or unassigned), priority, escalated or overdue; sort by priority, due date, oldest or last updated.
- Dashboards: "Escalated" tile and list; Management overview has an Escalated column.
- Notification bell: overdue tickets, plus escalations.
- Ticket templates can use all four priorities.

## Recruiting workbooks
- New template **Interview workbook (scored)**: Candidate, Interview date, Interviewer, Communication, Game knowledge, Appearance (1–5 ratings), Comments, Hire? (Yes/No/Maybe), Status.
- New column types: **rating** (1–5, average in the Σ row) and **choice** (your own list; "Edit choices" changes it).
- Shift+click selects a range. Ctrl+C / Ctrl+V copy and paste ranges, also to and from Excel. **Fill down** (Ctrl+D), **Fill right** (Ctrl+R), **Clear cells** (Delete key). Enter / ↑ / ↓ move between rows.
- **Undo** (Ctrl+Z, up to 40 changes on this device). Undo is refused if another device changed the workbook since your last edit; use Versions then.
- Drag a column heading's edge to resize. "Freeze 1st column" keeps the candidate name visible while scrolling.
- Duplicate sheet, duplicate workbook, "Save as template" (keeps the columns; listed under "Saved templates").
- Fixed: buttons, headings and the Σ row were hard to read in dark mode.
- Still not supported (and the page says so): formulas, macros, `.xlsx` files (save as CSV in Excel first).

## Employee page (`index.html`)
- Tabs: Overview, My profile, My evaluations, My procedural mistakes (criteria with lost points, counted per game), My retraining, My games, My schedule (and rotation), My requests.
- Requests: swap or give away a shift (only working days from the schedule sent to the employee), annual leave, sick leave (up to 14 days back). Pending requests can be cancelled.
- If `SERVER_URL` is not set, the page says so instead of failing silently. When the Google sign-in expires, the person is asked to sign in again.
- `index.html?demo` shows clearly labelled sample data and never contacts the server (for checking the layout).

## Code.gs
- `me` also returns the employee's own **game counts** (last 12 months, matched by work ID, or by exact name only when the employee has no ID) and the **manager** name if the employee record has one (`ext.manager` or `ext.lineManager`).
- No other rule changed.

## You must do
1. Paste the new `Code.gs` into your Apps Script project (keep your own `ADMIN_SECRET` and `SERVER_SALT`) → Deploy → Manage deployments → edit → New version.
2. In `index.html`, set `SERVER_URL` to your web app URL (ends in `/exec`). If the page is published with GitHub Pages, it is now served at the site root because the file is called `index.html`.

## Tested (headless Chromium) / not tested
Tested: every screen opens without errors as admin; legacy tickets render; priorities, sorting, filters, escalation (prompt, notification to a manager), links (bad link rejected), completion date, CSV export; notifications for overdue and escalated tickets; the whole workbook list above, including paste beyond the last column and undo; HR candidate board still reads workbooks; game-count self-test (all checks pass); search; employee page in demo mode at phone width (all tabs, sending and cancelling requests, missing `SERVER_URL` message); `Code.gs` `me` on a simulated Apps Script (own game counts only, 12-month cut-off, manager field).
Not tested: the real Apps Script deployment, real Google sign-in, real Drive sync of the new ticket fields between two devices, keyboard clipboard in Safari.
