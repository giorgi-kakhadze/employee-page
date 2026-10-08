# Demo data: PTF-demo-backup.json

A complete **made-up** company to try the tool with. Every name, e-mail (@example.com), phone number and figure is fake.

## What is inside
- **1,073 people in the employee list**: 1,000 employees plus 73 recent hires from the onboarding groups (work IDs N20001 and up): VIP, Premium, regular and beginner game presenters, shufflers and pit supervisors.
  - They are spread over 8 teams and 3 shifts.
  - Statuses: employed, probation, retired and terminated.
  - Each has a work ID (E10001–E11000 for the 1,000; N20001 and up for recent hires), a badge, the games they know, a phone, an e-mail and a team manager.
- **26 staff in the access list**: 5 managers (operations), 5 shift leads, 5 training coordinators, 2 seniors, 3 performance coaches, 2 scheduling coordinators (FMD), 2 HR recruiters and 2 service managers.
- **Schedule:** last, this and next month, with vacations and sick days.
- **Rotation:** yesterday, today and tomorrow — 40 people and 32 tables per shift, without conflicts.
- **Pay:** rates per position, paid by the hour.
- **About 500 evaluations** (Roulette, Blackjack, Baccarat, Poker, Dragon Tiger). Each has points per criterion, comments, and is shared with the employee.
- **Retraining:** last month and this month (people under 75%), plus coaching follow-ups and trainee notes.
- **Onboarding:** the 5 trainers have 2–3 groups each (game presenters and shufflers, finished and running). Trainees have hours, test scores and checklists.
- **Workshops:** 6 workshop registers over two months (attendance, passed / failed), plus onboarding files.
- **170 tickets on every department board:**
  - every status and priority, some escalated, some waiting for an answer;
  - comments;
  - 6 termination cases, each with linked tickets for HR, Uniforms, Building access, FMD and IT.
- **Announcements:** 6, with read confirmations.
- **Service:** 180 incidents and 2 Jira imports.
- **Remarks:** 90 (positive feedback, remarks, violations, disciplinary cases).
- **Bonuses:** 4 bonus programs, last month's final month reviews and this month's drafts.
- **Employee requests:** 45.
- **Game counts:** two months.
- **Uniforms:** 320, of which 210 are issued.
- **HR:** lifecycle events, a recruiting workbook with 60 candidates, and 10 department documents.
- **Projects:** 3 teams, 5 projects, sub-tasks and an approval waiting.

## How to open it (safely)
1. Open the tool in a **separate browser profile or a private window**, where Drive sync is **not** connected.
   - A restore replaces the data on that device.
   - With sync connected it would go to everyone.
2. More → ⚙ Settings → **Restore from backup** (or admin space → Backup & settings), choose `PTF-demo-backup.json`, then **Replace**.
3. To see the tool as a given position or person, use the admin's **👁 View as**.
4. To remove the demo afterwards, clear that browser profile, or use More → Clear all data.

Dates are relative to **2026-10-07** (the day the file was made). Schedules, deadlines and "this month" figures fit that week best.

## Staff accounts in the demo
The people below are in the access list (positions and departments) so that Assign to…, View as and the boards work. They have no passwords: they are only for looking around.

| Position | Name | E-mail |
|---|---|---|
| Manager (operations) | Luka Chkheidze | luka.chkheidze@example.com |
| Manager (operations) | Mikheil Tabatadze | mikheil.tabatadze@example.com |
| Manager (operations) | Barbare Kvaratskhelia | barbare.kvaratskhelia@example.com |
| Manager (operations) | Natia Gvenetadze | natia.gvenetadze@example.com |
| Manager (operations) | Shota Javakhishvili | shota.javakhishvili@example.com |
| Shift lead | Mariami Beridze | mariami.beridze@example.com |
| Shift lead | Nino Kvaratskhelia | nino.kvaratskhelia@example.com |
| Shift lead | Ilia Chikovani | ilia.chikovani@example.com |
| Shift lead | Khatia Maisuradze | khatia.maisuradze@example.com |
| Shift lead | Ilia Javakhishvili | ilia.javakhishvili@example.com |
| Training coordinator | Revaz Gabunia | revaz.gabunia@example.com |
| Training coordinator | Levan Gabunia | levan.gabunia@example.com |
| Training coordinator | Salome Nozadze | salome.nozadze@example.com |
| Training coordinator | Eka Japaridze | eka.japaridze@example.com |
| Training coordinator | Diana Nozadze | diana.nozadze@example.com |
| Senior of the team | Nana Chikovani | nana.chikovani@example.com |
| Senior of the team | Dato Kapanadze | dato.kapanadze@example.com |
| Performance coach | Gela Nozadze | gela.nozadze@example.com |
| Performance coach | Tiko Lomidze | tiko.lomidze@example.com |
| Performance coach | Lela Kvaratskhelia | lela.kvaratskhelia@example.com |
| Scheduling coordinator (FMD) | Ilia Gelashvili | ilia.gelashvili@example.com |
| Scheduling coordinator (FMD) | Mikheil Gelashvili | mikheil.gelashvili@example.com |
| HR / Recruiter | Revaz Lomidze | revaz.lomidze@example.com |
| HR / Recruiter | Aleksandre Gvenetadze | aleksandre.gvenetadze@example.com |
| Service manager | Eka Kobakhidze | eka.kobakhidze@example.com |
| Service manager | Teona Gabunia | teona.gabunia@example.com |

## Try the schedule and rotation with 200 fake people
* `PTF-fake-employees-200.xlsx` (and `.csv`): 150 game presenters and 50 shufflers, three shifts, two sets, three teams. Fictional.
* **Upload:** Home → Employee Data Source → ⬆️ Import Excel / CSV. Then FMD → Schedule → Roster: set **"Set 1 starts a 3-day work block on"** to a date (for example today), add a few tables to each team (Setup → Tables), press **Generate whole shift**.
* **Shufflers** have their own team called **Shufflers** (presenters are in Team One, Two and Three): Setup → Tables → Shufflers → tick **Zone rotation** → **Split tables into zones**.
* `PTF-demo-backup-with-rotation.json` (made by `build-rotation-demo.js`): the big demo company with a ready-made week of rotation for every shift (restore it with More → Restore from backup).

## Full demo backup (rotation + chat)

`PTF-demo-backup-full.json` = the demo company (about 1000 staff and employees) + a full week of rotation for all three shifts (presenters on tables, shufflers on zones) + Community: 8 channels and 8 direct/group chats with threads, reactions, pins and announcements. Restore it with Home → Backup → Import → *Replace*, then open FMD → Schedule and Community. Built by `add-chat-to-demo.py` from `PTF-demo-backup-with-rotation.json`.

## Employee page demo: game presenter and shuffler rotation

`employee-demo.html` (open it in a browser, also on a phone) shows the employee page with made-up data. Use the buttons at the top to switch between **Game presenter** (one table per half hour, breaks) and **Shuffler** (one zone per hour with its table numbers, breaks); **New random** makes another random person. The Rotation tab highlights the current slot as NOW. The same buttons work in the real page with `?demo` in the address.

## Lite backup (about 2 MB)
`PTF-demo-backup-lite.json`: about 270 people, all three shifts, 3 days of rotation (presenters on tables, shufflers on zones), Community channels and chats, evaluations, tickets, pay, uniforms and the rest, in under 2 MB. Built by `make-lite-backup.py` → `build-rotation-demo.js` (with `IN`, `OUT`, `DAYS`) → `add-chat-to-demo.py` (with `IN`, `OUT`).
