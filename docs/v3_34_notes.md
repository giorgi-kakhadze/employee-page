# PTF / Gunda v3.34: look & feel — admin space, motion, sound, Giorgi

Files changed:
- `tool/PTF-pass-to-floor-Gunda.html` (new module `uiPolish`; Giorgi's knowledge)
- tests: new `tests/ui_polish.test.js`

## What was checked
The tool was opened in a laptop-size (1440×900) and a phone-size (390×844) browser on every main screen: Home, admin space, department overviews, Schedule, Performance, tickets, Projects and the More menu.

| Found | Fixed |
|---|---|
| The **admin space** was a 420 px column, even on a laptop: about 25 settings blocks in one long scroll. | On screens 900 px and wider it opens as a **wide window with a side menu**: one section at a time, a "Find a setting…" search across all section content, and "Close admin space" in the menu. On phones it stays one column (now up to 640 px wide). |
| The **top bar** ran off the right edge on a laptop (the name pill was cut off). | The site and person pills moved to the action row; nothing in the top bar is clipped (checked by a test). |
| Department sub-bars with many screens (FMD) ran off-screen on a laptop. | On screens 1024 px and wider they wrap to a second line instead of hiding screens. |
| Projects and department overviews touched the screen edge on phones. | 14 px margin; stats in two columns. |
| Admin console showed "Tool version v2.94". | Now v3.34. |
| **Giorgi** only knew the old trainer tool (Onboarding, Workshop, IDs, Logbooks). | He now knows the whole tool (see below). |

## Motion
- **Page changes:** the new screen fades and slides up slightly (0.34 s). The department sub-bar fades in.
- **Windows** (tickets, projects, forms, the admin space): the background fades and blurs, and the window pops in. Menus (More, person, site) open with a short pop.
- **Cards** (projects, overviews, teams) lift slightly on hover. **Buttons** press down when clicked.
- **Keyboard focus:** a clear blue focus ring on inputs and buttons.
- **Scrollbars:** thin and quiet.
- **Respecting preferences:** the system setting "reduce motion" is respected, and **More → Sound → ✨ Reduce animations** switches all motion off for that person.

## Sound
The existing sound set is unchanged and stays **off by default**: success, warning, navigation and button clicks, as short quiet tones (More → Sound). New: when sounds are on, opening a window or the admin space plays the soft click.

## Giorgi
A new knowledge section covers 24 topics:
- departments and spaces; tickets, boards and work types;
- the schedule and rotation; employee requests; pay, bonuses and the month review;
- finding a person and their history; Service incidents and Jira import;
- Projects: access, restricted and shared items, teams, sub-tasks and Distribute, the work map and timeline, approvals and workflow stages, files, the visual board, the Data explorer, the Progress page, notifications and updates;
- sync and privacy; the admin space; View as; the employee phone page; history; sound and motion.

Other improvements to Giorgi:
- "What is this tool", "How do I move between sections", "What can you do" and "What is new" are rewritten for today's tool.
- He knows the newer screens (Schedule, department overviews and boards, My tickets, Projects, requests, employees, coach board, recruiting, uniforms), so **"What can I do here?"** answers for them.
- His answers can carry **Open Projects / Open FMD / Open Service** buttons that open that space.
- New topic chips: Departments, Projects, Schedule.
