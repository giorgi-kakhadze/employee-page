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

## Lobby screens: "Everything at once" view (many teams on one TV)
- New choice under Screens → Show: **Everything at once: all teams, right now**. One block per team; each person with the table they are on now and the next one in small grey; breaks in orange. Teams with zone rotation (shufflers) show a block per zone with the people in it and every table number of the zone. Text shrinks automatically until everything fits one screen (about 170 people on a 1920×1080 TV: 10 teams + shufflers). Tip: set names to "first name only" for the most room.
- Code.gs `tv_` accepts view `board`; Server Edition rebuilt.
- Second board view: **Whole shift, all teams**. Every person's full shift as a thin timeline (tables, zone letters, Br = break, current slot framed in green), team blocks 3 across and 2 down; with more than 6 teams the screen turns the page by itself every 15 s (page 1 / 2). Zone tables are written out under the shufflers block.
- Whole-shift screens: every half hour has its own column and its own time label right above it (hour in bold, ":30" dimmer), a line marks every full hour, and the current half hour is framed. The name column has the same width in the header and in every row, so a time can never sit over the wrong table. The classic "The whole shift" view also labels every half hour now.

## Sign out (shared computers)
- New **Sign out** button in the top bar and in More. It first saves the person's changes to the team (a few seconds), then removes everything from this browser: all data, the sign-in, the admin key and session, and the automatic local backups. What stays: the connection to the team and the theme / sound choices. The next person signs in with their own email and password and gets their own data. Sync is switched off while signing out, so nothing empty can be sent to the team.
- Employee page: Sign out now really signs out (it also tells Google not to pick the same account again automatically).
- Server Edition: Sign out waits for pending changes, then ends the server session and the Microsoft sign-in (`/auth/logout`); nothing was stored on the computer anyway.
- Test: `tests/signout.test.js`, `ptf-gunda-server/test/signout.test.js`.

## Chain rotation: a table is never left without somebody
- With more people than tables, the rotation is now one circle: everybody moves one place forward every half hour: **break → table 1 → table 2 → … → last table → break**. The person coming back from a break takes table 1, the person on table 1 goes to table 2, and so on. Every table has somebody in every half hour, and only (people − tables) are on a break at a time, never the whole team at the start. With several breaks per round they are spread evenly between the tables. Example: 5 people, 4 tables → one person on a break, four on tables, shifting one place each half hour.
- Used when the team starts and ends together. With late starters or loans the older flexible planner is used.
- Shufflers (zones) use the same circle: break → zone A → zone B → … → last zone → break.
- If there are so few spare people that somebody works more tables in a row than the limit, the tool still covers every table and says how many in a row it needs.
- Test: `tests/chain_rotation.test.js` (5/4, 8/4, 10/8, 13/10).

## Default theme: creamy light
- The tool (and the Server Edition) now opens in a **creamy light theme** by default instead of dark. **More → Theme** switches to dark and back; the choice is remembered (per person on the server). The cream colours were applied to the main tool and to the Exam and ID Creation screens. Lobby TV screens stay dark on purpose.

## 200-person demo backup
- `demo/PTF-demo-backup-200.json` (1.5 MB): 200 people (100 Set 1, 100 Set 2; 3 days on / 3 off; about 33 per shift and set: 8 shufflers + game presenters), a 6-day rotation (Set 1 for three days, then Set 2 for three days) on all three shifts, chain rotation for tables, zones for shufflers, Community chats, 7 tickets on every department board in all stages, onboarding groups, evaluations, pay, uniforms and more.
- Nicknames: shufflers have none; every game presenter has a normal first name as nickname, one person per nickname, never the person's own first or last name.
- Built by `make-demo200.py` → `build-rotation-demo.js` (`TEAMS=3 IN OUT DAYS`) → `finish-demo200.py`.

## Zones follow the teams (shufflers shuffle the tables the presenters deal)
- Setup → Tables → the Shufflers team (Zone rotation on) has a new green box **"Zones follow the teams"**: **Zones from the teams** makes one zone per team (Team 1 tables 1–4 = zone A, Team 2 tables 5–8 = zone B, VIP tables = zone D …); with "Most tables in one zone" a big team is cut into smaller zones (never across two teams); **… fit to N shufflers** chooses the size so that there are not more zones than shufflers (so somebody can always be on a break). The zone map shows which team each zone belongs to.
- Zones made by hand on tables nobody deals (for example 21–60) still work: add them yourself as before.
- Press the button again when the teams' tables change. Test: `tests/zones_from_teams.test.js`.
- The 200-person demo uses this: teams Team 1–3 and VIP (5 VIP presenters per shift and set, 4 VIP tables), shufflers' zones are the teams' tables.

## Step 1 of the operations roadmap: absence and cover
- Rotation tab → **🚑 Absence / cover**. Choose who is sick, late or leaves early, from when and until when. The person shows OFF in that time, and the rest of the rotation is planned again from the next half hour with the people who are present (chain rotation for tables, zones for shufflers). Earlier slots never change, so the history of the day stays true. "Back at work" cancels an absence and plans again.
- If there are then too few people for the tables, the panel says how many table-slots have nobody and lists the people who are **off today** (not on another shift, not on leave or sick; shufflers are offered only for shufflers) with a **Call in** button: they are added to the shift from the next half hour and the rotation is planned again.
- Employees and the lobby screens see the new rotation through the normal sync. Test: `tests/cover.test.js`.

## Step 2: requests with real rules (the employee page and the schedule now agree)
- FMD → **Employee requests** (what employees send from their own page) used to record a decision only. Now each pending request shows a **Rules check** and approving it **changes the schedule**:
  - annual leave → days marked VAC (balance of vacation days, team leave limit, minimum cover);
  - sick leave → SICK; day off → OFF (only on days the person works);
  - swap / give-away → the colleague takes the shift (rest between shifts, days in a row, weekly hours, monthly hour limit for the colleague, same team / same kind of work);
  - impossible requests (colleague busy, no shift that day) cannot be approved; reject them with a reason.
- **Labour rules** (Setup) have a new switch: *Only warn* (as before) or *Block*: a request that breaks a rule can then only be approved if the manager types a reason; the reason is stored on the request and shown on the card. In block mode the schedule's own swap requests are stopped as soon as the employee sends them.
- The vacation balance counts the working days really marked VAC in the schedule plus requests still waiting. Days without an entry in the month grid follow the 3-on / 3-off pattern for the rule checks.
- The employee page shows **Vacation days left** (worked out by the tool, sent with the schedule). Server Edition rules updated.
- Test: `tests/request_rules.test.js`.

## Step 3: publishing and confirmations ("I have seen my schedule")
- Everything the tool sends to a person (Send schedule / Send rotation) now carries a **version** and the time it last changed. On the employee page a banner says **"Your schedule or rotation was updated … Please confirm"** with an **I have seen it** button; afterwards it shows "You confirmed on …". Any later change to what was sent to that person (a new day, a changed table, a cover rebuild) asks them again. Confirming an old version is refused.
- FMD → Schedule → **✅ Confirmations** (new tab): how many were sent, confirmed, not yet, or changed since they confirmed; filter by status and team; **Copy names that still need to confirm** (paste into a message) and **CSV**. The tab updates by itself while it is open.
- New data key `totScheduleAcks` (one record per person), new employee action `ack` (tool Apps Script and Server Edition), employee page demo updated. Tests: `tests/ack.test.js`, Server Edition `test/signout.test.js` part 3.
- Not included yet: automatic reminders (that is the next step, notifications).

## Step 4: notifications
- **Bell (🔔) for people who run the schedule:** "N of M people have not confirmed their schedule or rotation" and "N employee requests are waiting for a decision". They stay on the bell until done and open the right screen when clicked.
- **E-mail reminders:** Confirmations tab → **✉ Remind by e-mail** writes to everybody in the view who has not confirmed the current version (once every 10 minutes; the people are worked out on the server, never taken from the browser). The mail carries the link to the employee page (Server Edition: your public URL + /employee; single-file edition: set the script property `EMPLOYEE_PAGE_URL`).
- **E-mail about decisions:** a switch in the Employee requests screen, "✉ E-mail the employee when I decide" (on by default): approving or rejecting sends the employee a short mail with the manager's note, once. If the server has no e-mail, nothing is sent and nothing breaks.
- **Employee page:** Home shows **Updates for you**: requests decided in the last 7 days with the manager's note (the schedule banner from step 3 is still there).
- New staff actions `ackRemind` and `reqMail` (tool Apps Script and Server Edition; need edit rights on the schedule / requests). Tests: `tests/notify.test.js`, Server Edition `test/signout.test.js` part 4.
- Not included: push messages to phones (they need a service worker and a push service, see the next steps), and e-mail on every small schedule change.

## Step 5: the employee page as a phone app (PWA)
- **Installable:** the page now has a web app manifest, icons (192, 512, maskable, Apple touch) and a service worker. On Android/Chrome the Home screen shows **Install this page on my phone**; on iPhone it explains **Share → Add to Home Screen**. It then opens full screen like an app.
- **Opens without a connection:** the service worker keeps only the page itself (the "shell") and the icons. It never caches the API or any data.
- **Optional offline copy:** Home → **My phone** → "Keep my schedule and rotation on this phone". Only the schedule, rotation, vacation days and the confirmation state are saved (no pay, results or remarks). Offline, the page shows them with a banner "You are offline … saved on …" and Try again. **Signing out removes the copy and the choice.** Off by default, with a warning not to switch it on for shared devices.
- **Single-file edition:** put `manifest.webmanifest`, `sw.js` and the `icons/` folder next to `index.html` on your web host (https is required for installing). **Server Edition:** served automatically (`/employee.webmanifest`, `/employee-sw.js`, `/pwa-icon-*.png`; public, no personal data; the security policy allows `manifest-src 'self'`).
- Tests: `tests/pwa.test.js` (real service worker over http://127.0.0.1, offline reload), Server Edition `test/pwa.test.js` (found and fixed: the Server Edition's sign-out button skipped removing the copy).
- Not included: push messages (they need a push service and permission handling on each phone; the e-mail reminders from step 4 cover the need for now). I could not test installing on a real phone here: the install button depends on the phone's browser.

## Step 6: "I am sick / running late / have to leave early" from the employee page
- Home and Schedule show **Something wrong today?** to an employee who has a shift today (or last night's shift still running): **I am sick**, **I will be late** (15 min – 2 h), **I have to leave early** (choose the time), with an optional note. It goes to the manager at once and shows "You reported …" with the time; when the schedule people plan the cover it turns into "✔ Your manager has planned for it".
- **For the schedule people:** the bell shows "N absence reports from employees" (stays until handled); clicking opens that day and shift with the cover panel, which lists **Reported by the employees** with **Plan the cover** (one click: marks the right half hours absent and plans the rest again; sick = from now to the end, late = the first half hours, leaving early = from that time) and **Dismiss**. The scheduling coordinators and shift leads of the location are also **e-mailed**.
- **Safeguards:** only for today (or yesterday's night shift), only for a shift that is really theirs, not twice, at most three reports a day; lateness 5–240 minutes.
- New data key `totAbsenceReports`, new employee action `report` (tool Apps Script and Server Edition). Tests: `tests/report.test.js`, Server Edition `test/signout.test.js` part 5.
- Not included: phone calls or SMS, and an automatic cover (the manager still decides; the cover panel from step 1 makes it one click).
