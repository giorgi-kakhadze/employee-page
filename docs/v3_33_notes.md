# PTF / Gunda v3.33: Projects, round 2 — teams, finer access, branching tasks, workflow, approvals, file storage, progress board

Files changed:
- `tool/PTF-pass-to-floor-Gunda.html`
- `tool/Code.gs`
- tests:
  - new: `tests/projects_teams.test.js`;
  - changed: `tests/fakegas.js`, which now keeps uploaded Drive files and serves downloads.
- screenshots: `docs/guide-screenshots/p16…p27_*.png` (example data only)

## Check: the 12 requests — what was there, what was missing

| # | Request | Before this round | Now |
|---|---|---|---|
| A1 | Shared / separate project and department data; restrict visibility and editing; filter by any field | **Had** (v3.32: access per project, Data explorer) | Also per item and file, and teams as an access group |
| A2 | Shared / individual projects; assign to team / department / person; they break it down, still connected | **Had** for departments and people (sub-projects). **Missing:** teams | Teams can be assigned |
| A3 | Map of the work, timeline tree with blockers, help needed, waiting time for specs | **Had** (work map, timeline) | Sub-tasks shown as branches |
| A4 | Automatic and on-demand updates to the people involved only | **Had** (bell, daily digest, Send update) | Adds approvals, comments on items, deadlines within 2 days, team members |
| A5 | Figma-like board | **Had** (v3.32) | Drawing rights per project |
| 1 | Restrict / expand access to projects, project segments, boards… | **Partly:** projects and sub-projects only | Items, files and documents can be 🔒 restricted or 🔗 shared outside the project; per-project board rights |
| 2 | Distribute people into teams / departments | **Missing:** departments came only from the position; no teams | 👥 Teams & departments page |
| 3 | Branching task management with granular distribution | **Missing:** tasks were flat (only sub-projects branched) | Sub-tasks to any depth; 👥 Distribute (one sub-task per person or per member of a team) |
| 4 | Deadlines, commenting, project workflow | **Partly:** deadlines and project comments | Comments on every item; workflow stages; deadline warnings |
| 5 | Approval flow | **Missing** | Approvals for items, files, documents and workflow stages |
| 6 | Info / document / attachment storage with restrict / expand access | **Partly:** links and notes only | File upload and download (stored in Drive, up to 25 MB each); info pages; access per file |
| 7 | Display page for projects, teams and departments with task / project progress | **Missing** | 📊 Progress page |

## 1. Restricting and widening access
- **Item, file or document (🔐 Access to this item):**
  - **🔒 Restrict to** people, departments or teams. Then only they, the project managers, the assignee and the creator see it. The listed people can read it even if they are not on the project.
  - **🔗 Also share with** people, departments or teams outside the project, read only or with editing.
  - Only the project managers and the item's creator change these settings.
- **Board:**
  - **Who can draw:** everyone who works on the project (the default), only the owner and managers, or also the viewers. The setting is in the project form under Managers, viewers and visibility.
- **Projects and sub-projects** (as before):
  - owner, managers, assigned people, viewers and visibility;
  - every sub-project can narrow or widen its own access;
  - **teams** can now be assigned, made managers or viewers.

The **Access** tab lists the restricted and shared items and the board rule.

**Server enforcement** (`Code.gs`, `pjRecLevel_`):
- a restricted item, its comments and its file are not sent to, or downloadable by, anyone else;
- people it is shared with read-only cannot change it;
- people who only work on the project cannot change who can see an item;
- the board refuses shapes from people without drawing rights.

## 2. Teams and departments (Projects → 👥 Teams & departments)
- Every department shows:
  - its people (from their position, as the admin sets it);
  - its **teams**;
  - who is **not in a team yet**.
- **Managers and seniors** (the server allows only them) create and edit teams: name, department (or cross-department), lead, members and description.
- A team member counts as part of the **team** and of the **team's department** when projects are assigned. For example, putting someone into an IT team gives them the IT projects.
- **Where teams can be used:**
  - project assignment, managers and viewers;
  - item access;
  - task distribution;
  - the team field on tasks;
  - the daily e-mail, which includes the members of an assigned team.

## 3. Branching tasks and granular distribution
- A task can be **part of another task** (Part of task). Sub-tasks can have their own sub-tasks, to any depth.
- **⑂ + Sub-task** in the task form adds one.
- **👥 Distribute to people / a team** creates **one sub-task per person**:
  - you pick people, or tick a team to select all its members;
  - each sub-task gets its own assignee and deadline;
  - the title is taken from a template, e.g. "Coaches for group B — {name}".
- The work map and the Items list show the branches. A task shows "⑂ 1/3 sub-tasks".
- The person given a sub-task receives it even if they are not on the project ("🔗 Shared with me / given to me" on My work).

## 4. Deadlines, comments, workflow
- **Deadlines:**
  - start and deadline on every item;
  - **📅 due within 2 days** shows on the item, on My work ("Due in 2 days"), in the bell and in the daily e-mail;
  - overdue items are marked as before.
- **Comments on every item:** 💬 in the item form. They go to everyone who can see that item (never to people a restricted item is hidden from). The assignee and the creator are notified in the bell. Project-level discussion stays on Activity.
- **Workflow stages:**
  - each project has a stage bar (default: Idea → Planning → In progress → Review → Done ✔);
  - managers edit the stages in the project form (one per line; "!" means entering that stage needs approval) and choose who approves them;
  - managers move the project forward or back.

## 5. Approval flow
- **✔ Ask for approval:**
  - available on any item, file or document (item form) or on the Approvals tab;
  - fill in what to approve, details, the **approvers** (anyone, also outside the project), the rule (**all must approve** / **one is enough**) and an "answer by" date.
- **Approvers** see the request on My work ("✔ Waiting for my approval") and in the bell. They choose **✅ Approve**, **↩ Request changes** or **⛔ Reject**; a comment is required for changes and rejections. Each decision shows who decided, when, and the comment.
- **The server decides the status:**
  - each approver can only record their own decision;
  - nobody can fill in or wipe someone else's decision;
  - "Waiting / Approved / Changes requested / Rejected" is computed from the decisions.
- **Stage gates:** entering a stage marked "!" first needs an approved "Ask approval for …" request. The server refuses the stage change without it, even from a manager. Only the admin key skips it.
- **After changes or a rejection:** **↻ Ask again** sends the request again (the old one is kept, closed). **Close** withdraws a request.
- Pending approvals appear in the daily e-mail and the Progress page.

## 6. Files, documents and info pages
- **⬆ Upload file** (Files & docs tab):
  - files up to 25 MB, several at once;
  - stored privately in the tool's Google Drive folder through the server, in 1.5 MB pieces;
  - named by the server `pjfile-<project>-<name>`.
- **📄 Info page:** a document whose text lives in the tool (a long text field). **🔗 Link:** Drive, Confluence, Jira, Figma…
- Every file, page and link has the same 🔒 / 🔗 access as other items. The table shows "Who can open it".
- **⬇ Download** asks the server, which checks:
  - access to that item;
  - that the file belongs to that project, so a copied file id from another project is refused.
- Evaluation-video cleanup (62 days) never deletes project files.

## 7. 📊 Progress page
- **Projects:**
  - one row per project (optionally per sub-project);
  - workflow stage, status and progress bar;
  - open, overdue, blocked / help, waiting, due ≤2 days and approvals pending;
  - due date and owner.
- **Teams:**
  - per team: department, people and projects;
  - open tasks, done in the last 30 days, overdue, blocked, waiting, due soon;
  - a **workload bar per member** (open tasks, the overdue part in red).
- **Departments:** the same per department, with the projects assigned to it.
- Only what the viewer may see is counted.

## Setup
- **Deploy the new `Code.gs` as a new version.** Uploads use the same Drive access as the evaluation videos; Google may ask to confirm it.
- Teams live in the shared key `totTeams`. Managers and seniors write it; everyone signed in reads it.
