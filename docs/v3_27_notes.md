# PTF / Gunda v3.27: schedule and rotation editing like a workbook

Files changed:
- `tool/PTF-pass-to-floor-Gunda.html` only (Code.gs is unchanged).
- New test: `tests/schedule_grid.test.js`.

## Breaks count as working hours (fix)
The rotation counted only table slots as worked time and subtracted breaks. So an 8-hour shift with breaks showed fewer hours, and the month summary said "breaks, OFF not counted".

Now every filled slot counts, breaks included: an 8-hour shift is 8 hours. Only OFF and empty slots are not counted. This changes:
- the "Worked h" column,
- the month's Hours summary, which also feeds Limit and Overtime h.

The "Break h" column still shows how much of that time was breaks.

## FMD → Schedule (the month grid)
- **Select many days at once:**
  - drag across cells, or Shift+click for a range;
  - **Ctrl+click** single days (on Mac, ⌘+click), across different people;
  - **click a person's name** (or their Days cell) to select their whole month. Ctrl+click more names to add people, Shift+click for a range of people.
- **Delete** (or Backspace, or 🗑 Clear selected) clears everything selected in one go. That covers 5 days, a full month, or several people.
- **Move shifts by dragging.** Click a shift (or select several), then press on it and drag:
  - to another day of the same person (for example 5 days later), or
  - to another person.

  Comments move with the shift. Dropping one shift on another **swaps** them. When a block of shifts would overwrite existing entries, the tool asks first. A message confirms what moved.
- **👤 Only selected people** shows just the people you selected (pick them by name), so you can adjust two or three people's schedules without scrolling. **👥 Show everyone** brings the rest back. Generate still covers everyone.

## FMD → Rotation (in the 🧩 Layout editor)
The same works for table slots:
- drag, Shift+click or **Ctrl+click** slots;
- **click a person's hours** to select their whole shift;
- **Delete** clears all selected slots;
- **drag** selected slots to another time or another person;
- one slot dropped on another swaps them.

After a move, a table shared by two people in the same time slot is marked as before. Ctrl+click and multi-selection no longer open the table picker.

## Tested
- `schedule_grid.test.js` (20 checks):
  - rotation hours with breaks counted, and the month summary wording;
  - rotation Ctrl+click, whole-shift select, Delete, move to another person and time, swap;
  - schedule Ctrl+click across people, Delete, whole-month select by name and Delete;
  - drag 5 days later with the comment moving along, drag to another person, swap, drag a block;
  - only-selected-people view.
- All other files still pass. In total 215 checks pass.
- Clicking through every screen and sub-tab shows no page errors.

## You must do
Give everyone the new `tool/PTF-pass-to-floor-Gunda.html`. No server change.
