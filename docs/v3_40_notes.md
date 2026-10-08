# PTF / Gunda v3.40: zones for shufflers and live lobby screens

Files changed:
- `tool/PTF-pass-to-floor-Gunda.html`
- `tool/Code.gs` (new `tv` action, new key `totTvScreens`)
- `tool/PTF-tv.html` (new: the page a TV opens)
- `index.html` (the employee page shows a zone like a table)
- tests: new `tests/zones.test.js` and `tests/tv_screens.test.js`; version checks in six other test files.

## 1. Zones (shufflers hold a group of tables, not one table)
A team can switch to **zone rotation**: **FMD → Schedule → ⚙ Setup → Tables → (the team) → ☑ Zone rotation**.

**Zones**
- A zone is a name (A, B, C… or 1, 2, North) with a list of tables.
- **Split tables into zones:** cuts the team's table list into zones of N tables (5 tables per zone: Zone A = 1–5, Zone B = 6–10, …).
- **Fit to N people:** chooses the zone size so that there are as many zones as people on the shift.
- **Add zone / remove zone / rename.**
- **Add a table to a zone, take a table out of a zone.** A table typed into a zone is added to the team's tables if it was not there; a table that is already in another zone is moved after you confirm.
- **Change only for this day:** tick it and every change is stored on that day only. The standing zones are not touched. **Back to the standing zones** removes the day change.
- Each shift has its own zones (a team can have different zones in the morning and the afternoon).
- The page shows tables that are in no zone and tables that are in two zones.

**Generate** (Rotation tab)
- Everybody holds a zone for **30 minutes, 1 hour, 1.5 or 2 hours** (set per team) and then moves to the next. Cells read `Z:A` in the grid; they can be edited by hand like any other cell.
- **More people than zones:** the extra people are on break in turn. Breaks are spread between the zones, so nobody gets two breaks in a row and everybody gets one. A break lasts as long as a zone is held.
- **Fewer people than zones:** the page says how many zone-slots nobody covers, and from when.
- The old table checks (gap, clash, "needs N people for N tables") no longer apply to zone teams; "people needed" is one per zone.

**Every table number is written out** (1, 2, 3, 4, 5), never as a range like 1–5.

**A separate zone map:** the Rotation tab shows a box **🗺 Which tables belong to which zone** (for the day and shift you are looking at, and it says when the zones were changed for this day).

**What employees see:** on their page and in Send rotation a zone reads **Zone A · tables 1, 2, 3, 4, 5**, shown like a table.

## 2. Lobby screens (live rotation on a TV)
**FMD → Schedule → 📺 Screens** (people who edit the schedule).

For each TV:
- **Scope:** everyone, or chosen **teams**, or chosen **positions** (for example Shufflers only).
- **Shift:** automatic (the shift that is running now, also after midnight), or morning / afternoon / night.
- **Show:** *Now and the next hours* (big; you choose how many hours ahead) or *the whole shift*.
- **Names:** first name and initial (default), first name only, or full name.
- **Zone tables:** a separate **zone map under the table** (default: *Zone A: 1, 2, 3, 4, 5*), **inside each cell**, or both.
- **Zoom:** 0.6 × to 2.5 ×, and rows per page (0 = as many as fit; more rows turn pages by themselves every 12 s).
- **Title on screen**, **On/Off**, **Delete**, **New link** (the old link stops working at once).

Each screen has a **link** with a long secret token. Open it on the TV browser, press **F** for full screen. **+ / −** zoom on that TV only, **0** goes back to the setting.

**The TV shows:** title, shift and date, the clock, a column for every half hour (the current one is marked NOW and outlined), one row per person with the table or zone (and its tables), breaks, and a green dot while it is connected. Without a connection it keeps the last picture and says so.

**Live**
- *Server Edition:* the screen is told within a second when the rotation, or the screen's own settings (zoom, scope, title), change.
- *Single-file edition:* the TV asks the Google script every 30 seconds, so a change arrives within about half a minute. (Google's script limits make faster polling unwise; use the Server Edition for many screens.)

**Link format**
- Server Edition: `https://<your-address>/tv/<token>`.
- Single-file edition: `PTF-tv.html#<script address>|<token>`. Put `PTF-tv.html` somewhere the TV can open it (a web address or a file on the TV) and enter that address once in the Screens tab.

**What leaves the server for a screen:** names (as chosen), the tables / zones and times of its scope. No e-mail, Work ID, pay, or anything else. Anyone who has the link can see that rotation, so share it only with the TV; use **New link** if it went astray.

## Server rules (Code.gs)
- New key `totTvScreens` (the screen list with the tokens): **read and written only by manager, senior, scheduling coordinator and shift lead.**
- New action `tv` answers a token without sign-in. Unknown, switched-off or malformed tokens get "not found". Server Edition adds rate limits and an optional address list (see its `docs/CONFIG.md`).

## Tested
`zones.test.js` (24 checks): zone setup, add / remove tables and zones, day-only changes, rotation with 8, 10 and 5 people for 8 zones, what employees receive.
`tv_screens.test.js` (19 checks): the Screens tab, tokens, "New link", and what the Apps Script answers a TV (scope, no personal data, old links dead, who sees the list).
Server Edition: `test/tv.test.js` (41 checks) and `test/tv-browser.test.js` (15 checks, real browser).

## Known limits
- A break lasts as long as a zone is held (30–60 minutes). Edit cells by hand for shorter breaks.
- Zones of one team are not shared between teams.
- The TV decides "now" from its own clock; a wrong clock on the TV shows the wrong column.

## You must do
Give everyone the new `tool/PTF-pass-to-floor-Gunda.html`, **deploy the new `Code.gs` as a new version** (the screens need it), and put `PTF-tv.html` where the TVs can open it. Server Edition: nothing else; open the Screens tab.


## Employee page: zone rotation (shufflers)
- The Rotation tab now shows zones clearly on a phone: a big "Zone C" badge, the table numbers of the zone as large chips, hours per block, a NOW marker for the current slot, and breaks in a separate colour. Tables show as a big "Table 12".
- Code.gs: rotation cells sent to the employee page may now be 160 characters long (was 40), so a zone with all its table numbers is not cut off. The Server Edition rules are regenerated from Code.gs.
- Demo: `demo/employee-demo.html` has Game presenter / Shuffler buttons.
