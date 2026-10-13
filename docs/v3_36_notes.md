# PTF / Gunda v3.36: Access to spaces and pages — Hidden, View only or Edit for everything, per position and per person

Files changed:
- `tool/PTF-pass-to-floor-Gunda.html`
- `tool/Code.gs`
- tests:
  - new: `tests/page_access.test.js`;
  - changed: `tests/ui_polish.test.js` (version check).

## What the admin can do now
Go to **Admin space → 🔐 Access to spaces and pages**.

1. **Choose who to set.** Pick a **position** (e.g. Training coordinator) or a **person** (anyone in the access list).
2. **Set each space, board or page** to one of these levels:

| Level | What the person gets |
|---|---|
| 🚫 **Hidden** | They do not see it at all. It is not in the menus, it cannot be opened from search, Giorgi or links, and the server does not send its data. |
| 👁 **View only** | They can open it and look. A "👁 View only" ribbon shows at the bottom. Editing buttons are hidden where the screen supports it, changes to the tool's data are not saved, and the server refuses them. |
| ✏️ **Edit** | Full use, even if the position normally does not have it. |
| **As before** | The normal rules of the position (what the tool did until now). |

3. **Choose where the setting applies.** There are three levels of rows:
   - **🌐 All spaces:** one setting for everything.
   - **Each space:** Academy, Performance, FMD, Uniforms, HR, Office, Service Management, Projects and Custom spaces. A space row has the same choices plus "Same as All spaces".
   - **Each page and board inside a space:** for example Academy → Onboarding, Workshop, ID Creation, Logbooks, Retraining, the Academy board, Dashboard, Documents and Work types; HR → Recruiting, Candidates, Lifecycle, the HR board; Service Management → Incidents, Jira import, Reports, board; FMD → Schedule, Employees, Employee requests, Game counts, Bonuses, board; and each space's Overview and History. A page row has the same choices plus "Same as the space".
4. **Press Save access.** It reaches everyone on their next sync and is written to the audit log.

**Rules:**
- **The most specific setting wins:** page, then space, then All spaces.
- **A person's settings come before their position's.** A person row also offers "Same as their position".
- **A space disappears from the top bar when nothing in it is visible.** Home always stays.
- **New things appear by themselves:** new spaces, pages and department tabs, and every custom space (Admin → Custom spaces). Spaces added later follow **All spaces** until you set them.
- **The admin always sees everything.**
- **Quick buttons:**
  - **Only the spaces I set:** sets All spaces to Hidden.
  - **Clear all settings:** removes the settings for that position or person.

## Examples (from the request)
- **A training coordinator who sees only Home and Academy, without the Workshop register:**
  - All spaces → Hidden
  - Academy → As before (or Edit)
  - Academy → Workshop → Hidden

  Result: only Academy is in the top bar. Its Onboarding, ID Creation, Logbooks and Retraining stay, Workshop is gone, and Projects and every other space are hidden.
- **A senior shift lead who sees Academy, Performance, Service Management, Uniforms and HR:**
  - Academy → View only
  - HR → View only
  - Performance, Service Management and Uniforms → Edit
  - optionally All spaces → Hidden, to hide the rest
- **One person who may only look at the schedule:** choose the person, then All spaces → Hidden and FMD → Schedule → View only.
- **Opening another department's board:**
  - Example: FMD → the HR board → View only. The person sees the HR space with only the HR board. They read its tickets but cannot change them, unless they sent the ticket or it is assigned to them.
  - Setting a person's own board to Hidden removes its tickets for them.

## How it is enforced
**In the tool:**
- Every menu item, department tab and custom space checks its level.
- Screens refuse to open when all their pages are Hidden.
- The parts in "Detailed access" follow the page levels. Example: Results on View only means results can be seen but not edited, deleted or sent.
- On a View only page the ribbon shows. Writes to the tool's data are dropped, also inside the Workshop / evaluation frame. Data from the server still comes in.
- Projects on View only open every project as a reader.

**On the server (`Code.gs`):**
- **Data used only by certain pages is sent only when one of those pages is View only or Edit.** This covers:
  - incidents
  - recruiting and workbooks
  - lifecycle
  - employee requests
  - bonuses
  - game counts
  - schedule
  - projects and project files
  - onboarding
  - retraining
  - ID history
  - logbooks
- **That data is saved only when one of those pages is Edit.**
- **When every page using a piece of data is Hidden, the server refuses it.**
- **When nothing is set, the old rules apply unchanged.**
- **Parts of tools follow the same levels:** evaluation results, workshop files, videos and uniforms (`ACC_CAPS`).
- **Tickets follow the board levels:**
  - a board opened to someone (View only or Edit) sends its tickets;
  - a Hidden own board stops sending them;
  - on a View only board, tickets cannot be changed or created by anyone who is not the sender or assignee.
- **Each person receives only their own personal settings.**

## Setup
- **Deploy the new `Code.gs` as a new version.**
- **The settings are stored in `totAccessPolicy.access`,** which only the admin key can write. Full backups include them.
- **The older "Detailed access by role" ticks still work** and count as "As before".
- **Giorgi knows it:** ask "how do I hide a space or give view-only access".
