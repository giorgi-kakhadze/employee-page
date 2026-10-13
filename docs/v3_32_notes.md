# PTF / Gunda v3.32: Projects — shared work across departments

Files changed:
- `tool/PTF-pass-to-floor-Gunda.html` (new module `projectsSpace`, the 🗂 Projects button, sync lists, bell)
- `tool/Code.gs` (per-project access, daily digest, action `projNotify`)
- tests:
  - new: `tests/projects.test.js`;
  - changed: `tests/fakegas.js`, which now keeps the e-mails the server sends so tests can check who got them.
- screenshots: `docs/guide-screenshots/p01…p15_*.png` (example data only)

The five requests and where each one is answered:

| # | Request | Where |
|---|---|---|
| 1 | Shared and separate project / department data, restricted visibility and editing, filter the store by any field | Access per project (server-enforced) · 🔎 Data explorer |
| 2 | Shared and personal projects, assign to a team / department / person, who break it down into their own connected parts | Assigned to… · 🧩 Sub-projects · 🗺 Work map |
| 3 | A map of the work and a timeline tree with blockers, help needed, waiting time for specs | 🗺 Work map · 📅 Timeline |
| 4 | Automatic and on-demand updates only to the people involved: changes, blockers, news | 🔔 Bell · 📣 Updates · 📧 Daily digest · 📣 Send update |
| 5 | A Figma-like board to see everything together | 🎨 Board |

## 1. Storage with access per project
Projects live in three shared keys: `totProjects` (projects and sub-projects), `totProjItems` (tasks, milestones, documents, links, notes and sent updates) and `totProjBoard` (one record per board shape, so two people drawing at the same time keep both of their changes).

**Who can do what, per project:**

| Role | Can |
|---|---|
| **Owner** (whoever created it) | Everything, including access and deleting. |
| **Managers** | The same as the owner. |
| **Assigned** (departments and/or people) | Edit the project, add items, draw on the board, send updates, and add their own sub-projects. Cannot change access or delete the project. |
| **Viewers** (departments and/or people) | Read and post in the discussion. Not e-mailed. |

**Who can see it:**
- **Only the people above** (the default for a main project; a personal project is simply one with nobody else listed);
- **Same as the parent project** (the default for sub-projects);
- **Everyone with the tool can read it.**

Managing a project also means managing every sub-project below it. Managers and seniors (positions with full access) and the admin see and manage all projects.

**The server enforces this, not only the browser** (`Code.gs`, `pjLevel_` / `projPush_`):
- a device only receives the projects, items, board shapes and project comments its person may open;
- edits from a viewer are dropped;
- an assigned person's changes to owner, managers, assigned, viewers, visibility or parent are dropped;
- items never move to another project;
- only managers delete a project;
- a new main project must be owned by the person saving it;
- a new sub-project, item or shape needs work rights on its project;
- a person with one item assigned may update that item, even as a viewer;
- deleting a project removes its items and board shapes on the server too.

**🔎 Data explorer** (Projects → Data explorer) filters everything this device is allowed to hold, by **any field of any record**. Nested fields appear as `fields.Budget`, `assignees.depts`, and so on. You can search across every field at once or add field filters:
- operators: contains / is / is not / after or more than / before or less than / is empty / is not empty;
- each filter suggests the values that exist in that field;
- you can choose the columns and export to CSV.

The collections are:
- projects;
- project work items, files and notes;
- tickets;
- department documents;
- announcements;
- incidents;
- cases.

Each collection appears only when the person has that data. Projects can carry **own fields**, one per line as "Field: value" (Budget: 48000, Client: Ops…), and these are filterable like any other field.

## 2. Shared and personal projects, broken down into connected parts
**+ New project:**
- title, goal, status, priority, colour, start and due dates;
- **Assigned to:** departments and/or people;
- managers, viewers and visibility;
- daily e-mail on/off;
- tags and own fields.

**+ Sub-project / + part:** anyone who works on a project adds **their part** as a sub-project. They own it, it stays connected to the main project, and it counts in its progress, work map, timeline, board and digest. The default "same as parent" visibility lets everyone on the main project read it. Parts can be split again, up to 12 levels deep.

Each project page has these tabs: **Overview, Work map, Items, Timeline, Board, Files & docs, Access, Activity**. Above the tabs:
- breadcrumbs to the main project;
- progress across all parts;
- your access level ("You manage it / You work on it / Read only").

**Items:**
- **Kinds:** task, milestone, document, link / file (Drive, Jira, Confluence, Figma…), note.
- **Statuses:** To do, In progress, Waiting, Blocked, Needs help, In review, Done. Waiting asks *for what* (e.g. "specs from the Product team"), Blocked asks *what blocks it*, and Needs help asks *what help, from whom*.
- **Other fields:** assignee, start, due, "depends on" other items (also across parts), notes, own fields.
- **History:** every change is kept on the item.

The **Items** tab is a kanban with seven columns: drag a card to change its status. A list view is also available, with or without sub-projects.

## 3. Work map and timeline tree
**🗺 Work map:** the whole tree (project → items → sub-projects → their items…) with owners, assigned teams, progress and a ⚠ count per part. Under each item: ⛔ what blocks it, 🙋 what help is needed, ⏳ what it waits for and for how many days, ⛓ "Blocked by: …" for unfinished dependencies, and ⏰ overdue. Parts fold open and closed.

**📅 Timeline** (days / weeks / months):
- a calendar tree of the project and every part;
- **project bars** show progress;
- **item bars** are coloured by status: blocked items are striped red, waiting items are hatched amber, overdue items get a red outline, and milestones are diamonds;
- **dependency arrows** are red while the other item is unfinished;
- a **today** line;
- after each bar, the blocker, the help needed, or what it waits for and how many days;
- the totals: blocked, need help, waiting, and **days spent waiting in total**.

Waiting time is tracked automatically: each waiting period is kept on the item, so the timeline also shows "waited N d" after the item moves on.

## 4. Notifications only to the people involved
- **🔔 Bell** (new "🗂 Projects" filter). It shows:
  - changes by other people on projects you own, manage or are assigned to;
  - items assigned to you, and your overdue items;
  - sent updates and discussion messages.

  Viewers only hear about items assigned to them. Clicking a notification opens the project.
- **📣 Updates page:** your digest for the last 24 hours, 7 days or 30 days, plus the updates people sent.
- **📣 Send update** (on demand, for people who work on the project):
  - a message plus an automatic summary: progress, ⛔ blockers, 🙋 help needed, ⏳ waiting with days, ⏰ overdue, and the changes of the last 1, 7 or 30 days;
  - before sending, it shows who will receive it;
  - it is posted in the tool (bell and Updates) and e-mailed by the server (`projNotify`) to the people involved: owner, managers, assigned people, members of assigned departments, and people with an item. Viewers and muted people are left out;
  - at most once a minute per project.
- **📧 Daily digest (automatic):**
  - the server e-mails each involved person one summary of their projects;
  - a project is included only when something changed in the last 24 hours or something is blocked, needs help or is overdue;
  - it is sent on the first save of the day; run `installProjectDigest()` once in the Apps Script editor to send it at about 7:00 every day, even when nobody saves;
  - the daily e-mail can be switched off per project (Edit → Daily e-mail), and each person can mute it for themselves (🔔 E-mails on / 🔕 muted on the project).

## 5. Visual board (Figma-like)
Each project has a shared canvas. It holds:
- **sticky notes**, rectangles, ellipses, text and **frames** (moving a frame moves what is inside);
- **arrows** between shapes, with labels;
- **live cards** of items and sub-projects. Their colour and text follow the real status, assignee, due date and blocker. **＋ Cards** adds them, and **▦ Arrange by status** puts them into status columns.

To work on the board:
- pick a tool and click to place a shape; double-click to edit its text;
- drag to move a shape, and drag its blue corner to resize it;
- the colour palette and "bring to front" apply to the selected shape; Del deletes it;
- drag the background to pan; the mouse wheel or −/+ zooms; Fit shows everything;
- ⬇ downloads the board as SVG.

Changes save as you go and sync to everyone on the project. Viewers can look around but cannot draw. Double-clicking a card opens its item or sub-project.

## Not included / next steps
- The daily e-mail needs the Apps Script project to have permission to send mail (MailApp). The first deploy asks for it.
- File uploads into a project are links (Drive, Confluence…), not stored copies; the tool's storage is the shared JSON file.
- Real-time co-editing of the same sticky note text is last-save-wins (each shape merges separately).
