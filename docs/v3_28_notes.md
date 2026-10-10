# PTF / Gunda v3.28: overviews, staff directory, history everywhere, Settings, evaluation media and types

Files changed:
- `tool/PTF-pass-to-floor-Gunda.html`
- `tool/Code.gs`
- tests:
  - new: `tests/overview_history.test.js` and `tests/evaluation.test.js`;
  - changed: `tests/work_types.test.js` (a department now opens on its Overview) and `tests/fakegas.js` (simulates the Drive video upload).

## 1. Settings instead of Print and Backup in the top bar
- **Print** and **Backup** left the top bar.
  - Print is now **More → 🖨 Print this screen**.
- **More → ⚙ Settings** is shown to the admin and managers:
  - **Managers** get 💾 **Backup** (download a full backup).
  - **The admin** also gets Restore, Permissions (with the number of waiting requests), Integrations, Spaces and the Admin space.
- **The admin space** (Ctrl+G or the logo) has a "Backup & settings" block with the same buttons.
- **Full backups are now only for the admin and managers.** Anyone else who tries gets "Only the admin and managers can download a full backup". The small per-section backups inside a screen are unchanged.
- **More** no longer lists Integrations, Permissions, Spaces or Restore. They are all in Settings.

## 2. Every department opens on an Overview
Clicking **Performance, FMD, Uniforms, HR or Office** opens that department's **🏠 Overview** first. **Academy** keeps the overview it already had.

Each Overview has:
- **Numbers.**
  - Performance: evaluations this month, average score, people on retraining this month, open coaching follow-ups.
  - FMD: people, people working today, employee requests waiting.
  - Uniforms: total, issued, available, damaged or lost.
  - HR: candidates.
  - Every department: open and overdue tickets.
- **Screens:** a card for every screen the person can open in that space.
- **Latest changes:** the last 8 changes, with a button to the full History.

The second bar starts with **🏠 Overview** and ends with **📜 History**.

### FMD: staff directory
The FMD Overview opens on a **👥 Staff directory**.

**Search** finds people by name, screen name, Work ID, barcode, badge, employee ID, position, team, access code, phone, e-mail or games. Several words narrow the list ("shuffler team 2").

**Filters:**
- Position, Team and Status. Status defaults to Active; choose Everyone to include retired and terminated people.
- **Working today:** only people with a shift today.

**The table** shows name and screen name, Work ID, barcode and badge, position, team, status, start date, and today's shift with its time.

**Click a row (or press Enter)** to open the profile. The list shows 100 people at a time, with "Show 100 more", so it stays fast with thousands of people.

## 3. Tools moved out of More
| Tool | Now in |
|---|---|
| 🎯 Coaching hub | Performance |
| ✅ Who needs what | Performance and Academy |
| 📊 Trainee progress | Academy |
| 🔁 Retakes & trainee notes | Academy |
| 📚 Retraining register | Academy, Performance and FMD |

- **The Retraining register stays in the space it was opened from.** The second bar, the highlight and the Back button stay in Academy or FMD instead of jumping to Performance.
- **Academy's overview** has a "More in Academy" row with these tools, plus its latest changes.
- **More** keeps Management hub and Find employee.

## 4. Profiles: at a glance, and full history
The **👤 Info** tab now starts with:
- **Next 7 days:** shift and time per day (today highlighted). Tap a day to see the rotation for that day.
- **Rotation right now:** the table the person is on at this moment and until when, or "free / break", or "not on the floor". A night shift that started yesterday counts.
- **Last change:** what changed last, who changed it, and when, with a button to the History tab.

The new **📜 History** tab lists every recorded change about the person, newest first, each with **who** and **date and time**:
- **Profile & file:**
  - profile fields: start date, phone, e-mail, Work ID, access code, training group, notes, photo, extra fields;
  - games added or removed, and game certificates;
  - roster: position, team, shift, set;
  - changes to the employee file.
- **Shifts & rotation:**
  - shifts added, removed or changed (with the date and the old and new value), and schedule notes;
  - being added to or removed from a rotation shift, and how many rotation slots changed.
- **Evaluations, retraining, uniforms:** evaluations saved, edited or deleted; being signed on retraining; uniforms given out or returned.

Filter buttons show only one of these groups.

## 5. History in every department
**📜 History** (in the second bar and on the Overview) shows who changed what in that department, newest first. You can search it ("removed", a name, a person who made changes) and filter it to Added, Removed or Changed.

| Department | What it shows |
|---|---|
| FMD | Shifts, rotation, roster, profiles, employee file, employee requests, retraining |
| Performance | Evaluations (saved / edited / deleted, with the score), coaching follow-ups, retraining |
| Academy | Onboarding changes, trainee notes, retraining |
| Uniforms | Uniforms added, deleted, status / employee / size changes |
| HR | Recruiting |
| Every department | Its ticket history (created, assigned, status changes, comments) |

### How it is recorded
- **The change journal (`totJournal`).** It watches what each person saves on their own device and compares it with the value before that save. This works for the main screens and the evaluation frame.
- **One entry per change:** who, their position and e-mail, date and time, department, the person it is about, and what changed.
- **Large changes are summarised:** a month pasted for one person becomes one line ("Shifts changed for Ana on 12 days…"). One save writes at most 60 lines.
- **What arrives through sync is not recorded again.** Each change is written once, by the device that made it.
- **Changes made before v3.28 have no journal entries.** Older employee-file changes still show from the existing employee history.

## 6. Evaluations: photos and videos while evaluating
- **While evaluating one by one**, each participant has **📎 Photo / video** under their name. A duo has one per person.
- **In the grid**, each column has a **📎** button with a counter.
- **Queue mode** keeps each person's files with that person.
- **You can pick up to 6 files per person.** They are attached when the evaluation is saved:
  - **Photos:** up to 4 per result. They are shrunk (longest side 1024 px, JPEG) and kept 60 days, like videos.
  - **Video:** the first one is uploaded to Drive with the same upload as Performance → Videos (40 MB, 5 minutes) and linked to the result. If the upload fails, the toast says so, and the video can be uploaded later in Performance → Videos.
- **Results** shows **📎 N** on the row. Clicking it opens the photos and a Watch video button. Performance → Videos also shows a "🖼 N photos" button.

## 7. Evaluation types and scoring
- **"This evaluation is:" picker** above the game cards. It has Type default, Regular, Beginner, Exam, and the kinds the admin added. The kind is saved on the result and shown in Results.
- **Scoring method** per evaluation type, set by the admin in the type editor:
  - **Average** (as before): all criteria count by their weight.
  - **Close-up:**
    - Only the **main** criteria count: the ones ticked "Main", or the first 6 if none are ticked.
    - 3 stars on every main criterion = 100%.
    - Points lost on the other (procedural) criteria are shown as "−N procedural" but do **not** lower the score.
  - The live score, the grid, the saved result and Results all use the method of the type.

## Server (`Code.gs`)
- **New key `totJournal`:**
  - **Add-only, like the audit log.** A person can only add entries in their own name. Entries are never edited or removed by a device. The server keeps the newest 8000.
  - **Each person receives:** their own entries; their department's entries; and entries about data they are allowed to read themselves, checked with the same rules as reading that data. HR does not receive evaluation entries unless HR may read evaluations. Managers, seniors and the admin receive everything.
- **`evalPhotos`** follows the evaluation rights: it is read with the results / evaluation / video ticks and written by evaluators.

## You must do
1. Paste the new `tool/Code.gs` into Apps Script, keeping your own `ADMIN_SECRET` and `SERVER_SALT`. Then Deploy → Manage deployments → edit → **New version**.
2. Give everyone the new `tool/PTF-pass-to-floor-Gunda.html`.
3. Optional: in each evaluation type that should use close-up scoring, open the type editor, choose **Close-up**, and tick the main criteria.

## Tested
All 295 checks pass:

| File | Checks |
|---|---|
| sync_privacy | 38 |
| sync_more | 6 |
| sync_directory | 25 |
| nav_spaces | 60 |
| work_types | 41 |
| onboarding_share | 26 |
| schedule_grid | 20 |
| evaluation (new) | 24 |
| overview_history (new) | 55 |

**What the new tests cover:**
- **`evaluation`:**
  - Close-up and Average scoring, and the kind picker.
  - A Beginner close-up evaluation with a photo, end to end.
  - A video uploaded through the (simulated) Drive upload.
  - Grid photos, and the type editor.
  - The journal entry written from inside the evaluation frame.
- **`overview_history`:**
  - **Settings:** who sees it; backups allowed for the admin and a manager and refused for a coach.
  - **Navigation:** the Overview in every department; the moved tools; Retraining staying in Academy, Performance and FMD.
  - **The staff directory:** search by Work ID, barcode, badge and screen name; the position, team, status and working-today filters; opening a profile.
  - **The profile:** the 7-day strip and rotation right now.
  - **History:** a shift removed in the grid, a shift added and a profile edited, all recorded with who and when and shown in the profile History and in FMD → History.
  - **Server:** add-only (forged entries refused); who reads what; sync does not record changes twice; a device does not resend the journal when it has nothing new.

A headless tour that clicks every top button and every second-bar item as admin, manager, coach, shift lead, HR and FMD shows no page errors. On a 390 px phone the FMD overview has no sideways scroll.

**Not tested:** the real Apps Script runtime and Google Drive.

**Known limits:**
- The journal records changes from v3.28 on.
- A device that edits while offline records its changes when it saves. The entries reach others at its next sync.
