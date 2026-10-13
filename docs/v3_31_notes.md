# PTF / Gunda v3.31: bonuses, month review, pay by the hour, and the employee page (Home / Schedule / Rotation)

Files changed:
- `tool/PTF-pass-to-floor-Gunda.html`
- `tool/Code.gs`
- `index.html` (the employee page)
- tests:
  - new: `tests/bonus_pay.test.js`;
  - changed: `tests/fakegas.js`, which can now simulate a Google sign-in for the employee page.

## 1. Pay per shift or per hour (FMD → Schedule → Pay)
**New setting: "Rates are: per shift / per hour".** Per shift is the default, so existing pay does not change.

**Per hour:** each worked shift pays **rate × hours × multiplier**. The day rate applies to morning and afternoon shifts, and the night rate to night shifts. Multipliers are holidays, extra pay days and overtime, as before.

**The hours of a day are:**
1. the hours entered by hand for that day, when someone **left in the middle of the shift** or stayed longer;
2. otherwise the person's row in that day's rotation (breaks count, as in v3.27);
3. otherwise the shift length.

In per-shift mode, entering 0 hours means the shift is not paid.

**Leave** (vacation, sick, study, family) pays the day rate × the leave %. In hourly mode the day rate is multiplied by the shift hours.

The Pay table has a new **Hours** column.

## 2. Bonus programs (FMD → 🏅 Bonuses & month → 🎁 Bonus programs)
Each program has:
- a **name** and a **type** (Performance, Attendance, …);
- the **positions** that can get it (for example VIP, Premium, regular game presenter, shuffler; none ticked = everyone);
- **levels**: Level 1 … Level 10, each with an **amount** and **the rule to reach it**.

**Load 4 example programs** gives a starting point you then edit:

| Program | Levels |
|---|---|
| VIP quality | L1–L5 |
| Premium quality | L1–L3 |
| Game presenter | L1–L2 |
| Shuffler attendance | L1–L2 |

The admin and managers can edit programs. Seniors see them.

## 3. Month review for team managers (FMD → 🏅 Bonuses & month → 🏅 Month review)
**One row per active employee** for the chosen month:
- shifts and hours worked;
- evaluation average, and procedural points lost;
- service incidents (Jira);
- violations / disciplinary cases, and positive feedback;
- games dealt;
- **salary so far** (managers only);
- one **level picker per bonus the person's position can get**, the bonus amount, and Draft / Final.

**Filters:** month, team, **My team only** (people whose "Team manager" is you), search, status. **⬇ CSV** exports the table.

**Click a name** to see the person's whole month:
- the numbers;
- the bonus pickers with each level's rule, and a note for the month;
- every day with its hours, rate, multiplier and pay. **Hours can be changed here** (left early).
- evaluations, with the points lost and the **evaluator's comments**;
- incidents;
- violations, disciplinary cases, remarks and feedback;
- retraining and games.

**✔ Mark the month final** locks the levels and hours until **↺ Reopen**. The same view is in every profile as the **🏅 Month** tab (managers and seniors; other staff who may write remarks see the remarks part).

**Chosen bonuses are added to the pay** in FMD → Schedule → Pay.

## 4. Remarks and cases
There are 5 types: 👍 **Positive feedback**, 📝 **Remark**, ⚠ **Violation**, ⛔ **Disciplinary case**, 🗒 **Note**. Each has a date, title and details, plus a tick: **Show to the employee on their page** (otherwise internal).

- **Added** from a person's month or profile by managers, seniors, HR, shift leads, performance coaches, service managers and the scheduling coordinator.
- **All of them are listed** in 📝 Remarks & cases.
- **Changes are recorded** in FMD → 📜 History and in the person's history.

## 5. Pay pages for employees
**A manager's device writes each employee's statement for this month and last month:**
- every worked shift: day, shift type (day or night rate), hours, rate, multiplier and pay;
- paid leave;
- **the bonus**, once the month is final;
- manual bonuses;
- what is still planned this month.

**When it updates:** by itself whenever the schedule, the hours or the reviews change, checked every 30 seconds while a manager has the tool open. You can also press **📤 Update employees' pay pages**.

Only employees with an e-mail in the employee file get a page.

## 6. The employee page: three buttons
Everything on the page is read-only. The only thing an employee can do is send requests.

**🏠 Home**
- **Tiles:** earned so far this month, shifts and hours, last evaluation %, mistakes, violations and disciplinary cases, positive feedback, games this month, next shift.
- **My information:** name, nickname, employee ID, position, team, team manager, shift, start date, status, contacts, games.
- **My salary:**
  - this month "so far": total, shifts, paid leave, what is still planned;
  - **Show each shift**: date, shift, day or night rate, hours (* = changed by the manager, for example left early), rate and pay;
  - last month, with its **bonus, level X of Y**, once final.
- **My evaluations:** tap one to see each criterion, the points lost, **the evaluator's comment per criterion**, the focus points and the feedback.
- **My mistakes:** procedural mistakes from evaluations, and **incidents on the floor** from Service Management.
- **Feedback, remarks and cases:** only the ones staff chose to show.
- **My games** (per game, last 3 months) and **My retraining**.

**📅 Schedule**
- Shifts worked, hours worked, shifts still planned, requests waiting.
- The schedule, and the days worked this month with their hours.
- **Requests:** swap a shift, give away a shift, **vacation / annual leave**, sick leave, **day off (new)**, **question about my pay (new)**.

**🔄 Rotation:** tables per day, view only.

## Suggestions: added in this version
1. **Pay by the hour with actual hours.** Without it, leaving in the middle of a shift could not be paid correctly.
2. **"Final" month.** Employees only see the bonus once the manager closes the month, and the levels and hours are locked.
3. **Remarks: shown or internal.** Not every note should reach the employee.
4. **"Question about my pay" and "Day off" requests**, so mistakes in pay are reported in the tool.
5. **Evaluator comments on the employee page**, for evaluations that staff shared.
6. **History for bonuses and remarks.** Who chose which level, who finalised or reopened a month, and who added or deleted a remark.

## Suggestions: not built yet
- **Real attendance.** Hours today come from the schedule and the hours entered by the manager. The building-access events could fill them automatically (clock-in and clock-out).
- **Rules that suggest the level.** Today the manager picks it; the tool could suggest one, e.g. "≥ 90% and ≤ 1 incident → Level 2", from the numbers already shown.
- **Payroll export** in your payroll system's format.
- **Employee acknowledgement** of a disciplinary case ("I have read this").
- **Approval step:** a senior approves the bonuses before the month becomes final.

## Who sees what (server)
| Data | Who |
|---|---|
| Bonus programs (`totBonusCfg`) | managers write; seniors read |
| Month reviews (`totBonusReviews`) | managers and seniors |
| Pay pages (`totMyPay`) | managers only; each employee sees only their own, through the employee page |
| Remarks and cases (`totRemarks`) | managers, seniors, HR, shift leads, performance coaches, service managers, scheduling coordinator; the employee sees only the ones marked "show" |

The employee page also receives the employee's own incidents and the comments on their shared evaluations. The server never sends another person's pay, remarks or incidents.

## You must do
1. Paste the new `tool/Code.gs` into Apps Script, keeping your own `ADMIN_SECRET` and `SERVER_SALT`. Then Deploy → Manage deployments → edit → **New version**.
2. Give everyone the new `tool/PTF-pass-to-floor-Gunda.html`.
3. Publish the new `index.html` (employee page). Keep your own `SERVER_URL` and `CLIENT_ID` in it.
4. In FMD → Schedule → Pay, choose **per hour** if pay is by hours, and enter the **hourly** day and night rates per position.
5. In FMD → 🏅 Bonuses & month → 🎁 Bonus programs, create your programs (or load the examples and change names, amounts and rules).
6. Make sure employees have an **e-mail** and a **Team manager** in the employee file.

## Tested
`bonus_pay.test.js` (34 checks), from the tool through the server to the employee page:
- **Tool:** bonus programs; the month review numbers; position-based bonuses; hourly pay with a "left early" day (242 + 80 leave + 175 bonus = 497); remarks shown or internal; a final month locked; the profile Month tab; statements.
- **Server:** who receives what; the manager-only pay pages; "me" for two employees.
- **Employee page:** the three buttons; Home; the evaluation comments; requests; read-only.

All 12 test files pass (389 checks), and a test that clicks every button for each position shows no page errors.

**Not tested:** the real Apps Script runtime, Google sign-in and Google Drive.
