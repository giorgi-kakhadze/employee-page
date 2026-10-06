# PTF / Gunda — status against the operations-platform requirements

Checked against `docs/platform-requirements.txt` (35 sections), using the code in `tool/PTF-pass-to-floor-Gunda.html` (v3.22), `tool/Code.gs` and `index.html` (employee page).

"v3.23" marks the server-side ticket privacy round (see `docs/v3_23_notes.md`).

"v3.24" marks the colleague list for "Assign to…" (see `docs/v3_24_notes.md`).

Legend: **Done** = works in the tool today · **Partial** = some of it works, the rest is listed · **Missing** = not built · **Not connected** = the screens and rules exist, but no live connection, on purpose (no fake integrations).

"v3.22" marks what this round added.

## Summary

| # | Requirement | Status | What is still open |
|---|---|---|---|
| 1 | Preserve the existing tool | Done | All 16 screens open without errors after the v3.22 changes (headless regression run). |
| 2 | Microsoft / Entra-ready identity | Partial | Identity today: tool accounts (email + password, approved by the admin) and Google sign-in for the employee page. There is no single "identity provider" layer yet, so Entra would need one (see Next steps). The Integrations page lists Entra as *Not connected*. |
| 3 | Role-based access | Partial (v3.24) | Positions, departments, per-screen grants (admin-only mode) and server checks for sensitive keys exist. **v3.23:** the server sends each person only the tickets, cases, comments and announcements they may see, and only their own audit log entries. **v3.24:** non-admins also receive a colleague list for "Assign to…" with only names and positions: their own department, or everyone for managers, seniors and Management. Still open: the employee list is sent to every approved account. |
| 4 | Department workspaces | Done | 8 departments (Academy, Performance, FMD, Appearance, HR/Recruitment, Building access, IT, Management), each with board, dashboard, documents, setup. HR also has candidates, lifecycle, game counts and process templates. Adding a department still needs a small code edit (`DEPTS` list). |
| 5 | Jira-like tickets | Done (v3.22) | Ticket ID, title, description, creator, dates, department, assignee, priority, status, due date, related employee and ID, comments, history, reassignment, reasons for wait/delay/cancel, reopen counter. **v3.22:** four priority levels (low / normal / high / urgent), escalation with a required reason, links to files on a ticket, completion date. File *uploads* on tickets: not built (links only). |
| 6 | Department boards | Done (v3.22) | Own columns per department (admin-editable), drag and drop, search. **v3.22:** filters by assignee, priority, escalated, overdue; sort by priority, due date, age, last update. |
| 7 | Inter-department workflow | Done | Termination, onboarding and transfer cases create one linked task per department with progress (e.g. 4/6). |
| 8 | Comments and exceptions | Done (v3.22) | Comments, Waiting/Delayed/Cancelled with reasons, all visible on the case. **v3.22:** Escalate button and links (e.g. a photo of the uniform form). |
| 9 | Re-evaluation workflow | Done | Request → Performance board → accept, start on coach board, return for clarification, link the new result, complete. |
| 10 | Employee self-service | Done (v3.22) | **v3.22** employee page: My profile, My evaluations, My procedural mistakes, My retraining, My games, My schedule and rotation, My requests (send and cancel). Only the person's own data is sent by the server. |
| 11 | Game-based performance data | Partial | CSV import from Grafana or similar with validation, employee and game matching, duplicates, history, undo. **v3.22:** employees see their own counts. A live Grafana API connection and scheduled sync are *Not connected*. |
| 12 | Recruitment workspace | Done (v3.22) | Workbooks, candidate pipeline from the Status column, start onboarding for accepted candidates. **v3.22:** scored interview template (Candidate, Interview date, Interviewer, Communication, Game knowledge, Appearance, Comments, Hire?, Status). |
| 13 | Workbook engine | Partial (v3.22) | Was: rows, columns, sheets, types, sort, find/replace, paste from Excel, CSV import/export, print, versions, audit. **v3.22:** range selection, multi-cell copy/paste (to and from Excel), fill down / fill right, clear a range, keyboard moves, undo, resizable columns, frozen first column, rating and custom-choice columns, edit choices, duplicate sheet, duplicate workbook, saved templates. **Not built:** formulas, conditional formatting, direct `.xlsx` import/export (CSV only), resizing rows, per-column filters. The page says so instead of pretending. |
| 14 | SharePoint-ready | Not connected | Documents are a register of links (SharePoint/OneDrive URLs work). The Integrations page has the planned connector contract. No Graph connection. |
| 15 | Jira-ready | Not connected | Ticket fields map 1:1 to Jira fields. No connector. |
| 16 | Unified employee record | Partial | One employee list (`employeeDataSource`) and the person 360 view link evaluations, retraining, cases, tasks, lifecycle. Not all modules link by work ID yet (some still match by name). |
| 17 | Employee lifecycle | Partial | Stages: Onboarding, Probation, Active, Transfer, Leaving, Retired, Terminated, plus an event log. Not yet: Candidate → Hired as linked stages, Training / Qualified, Archived. |
| 18 | Notifications | Partial (v3.22) | In-tool bell and desktop alerts: assigned, reassigned, comments, status changes, waiting-for-you, announcements. **v3.22:** overdue tickets, escalations (to Management, the sender and the assignee). Email / Teams / Power Automate: *Not connected* (two existing Apps Script emails aside). |
| 19 | Audit trail | Partial (v3.23) | Audit log of who / what / when across modules. **v3.23:** the server only accepts entries in the sender's own name (forged entries are dropped). Previous and new values are recorded for some actions (status moves, priority, re-evaluation scores), not for every field. |
| 20 | Files and documents | Partial | Department document links, workshop/onboarding files, ticket links (v3.22). No ticket file uploads. |
| 21 | Department templates | Done (v3.22) | Ticket templates per department, process templates. **v3.22:** saved workbook templates. |
| 22 | Cross-department process templates | Done | Admin edits the steps (department, title, due days). Progress is shown per case. "Responsible role" and "completion requirement" per step are not separate fields. |
| 23 | Dashboards | Partial (v3.22) | Department and Management dashboards; employee dashboard (v3.22). A dedicated manager "team" dashboard (team attendance, evaluations of my team) does not exist yet. |
| 24 | Unified search | Done (v3.23) | Searches employees, tickets, workbooks, documents and more, following screen access. It runs on the data on the device, which since v3.23 holds only the tickets, cases and comments that person may see. |
| 25 | Integration layer | Partial | Integrations page: honest status, data ownership, sync policy, connector contract, import self-test. The contract is documented, not implemented as code. |
| 26 | Offline / local | Done | Works fully offline. Drive sync is optional. |
| 27 | Data synchronisation rules | Done | Source of truth, direction, conflicts, duplicates, deletions and failures are written down on the Integrations page and enforced by the merge code. |
| 28 | Security | Partial (v3.23) | Server-side checks for sensitive keys, password throttling, Google token check, admin-only writes. **v3.23:** record-level ticket filtering and per-ticket merging on the server; a person cannot change or delete tickets they cannot see. Open: the `ADMIN_SECRET` is a shared key (fine for one admin, not for many), and a device keeps a local copy of everything that person may see. |
| 29 | UI / UX | Partial | Department switcher, "you are in…" header, counters, badges, mobile layouts. **v3.22:** fixed unreadable Recruiting workbook colours in dark mode. |
| 30 | No fake functionality | Done | Every external system is labelled *Not connected*. The workbook says formulas and `.xlsx` are not supported. The employee page has a demo mode (`?demo`) that is clearly labelled and never contacts the server. |
| 31 | Backward compatibility | Done | Old tickets (normal / urgent only), old workbooks and old rotation data all still work. No data is converted. |
| 32 | Migration strategy | Done | No migration was needed. All new fields are optional and added only when used. |
| 33–35 | Phased approach / acceptance | In progress | See Next steps. |

## Next steps (recommended order)

1. ~~Server-side ticket privacy~~ — done in v3.23.
2. ~~Colleague list for assigning tickets~~ — done in v3.24.
3. **Identity provider layer.** One module (`identity.provider = 'local' | 'google' | 'entra'`) used by both the tool and the employee page, so Microsoft Entra sign-in can be added later by writing one adapter. It needs an Entra app registration (tenant ID, client ID) from your IT.
4. **Manager team dashboard.** Team status, evaluations, re-evaluations, open requests and attendance for the people in a manager's team.
5. **Lifecycle stages.** Add Candidate → Hired (linked from Recruiting), Training, Qualified and Archived.
6. **Workbook:** per-column filters, `.xlsx` import/export (needs a spreadsheet library inside the file, about 1 MB), and a real formula engine only if you need it.
7. **Connectors.** Each of Jira, SharePoint/Graph and Power Automate needs credentials and a small server piece. The Apps Script can host simple ones (e.g. a Power Automate webhook for notifications).
