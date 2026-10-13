# PTF / Gunda v3.37: one Access management section

Files changed:
- `tool/PTF-pass-to-floor-Gunda.html`
- tests: `tests/page_access.test.js`, `tests/ui_polish.test.js`

## What changed
**One section instead of two.** The admin space had two separate access sections: "🔐 Detailed access by role (each section)" and "🔐 Access to spaces and pages". They are now one section: **Admin space → 🔐 Access management**.

At the top, choose how you want to work:

| Choice | What it does |
|---|---|
| 🧩 **Access by role** | The tool-part ticks per position, unchanged from the old Detailed access. For example Onboarding, Workshop Registration, Results, Videos and Uniforms. Save with **Save detailed access**. |
| 🗂 **Access by spaces and pages** | Hidden / View only / Edit for every space, board and page, per position or per person (from v3.36). Save with **Save access**. |

**How the two work together:**
- Settings in **Access by spaces and pages** come first.
- Where they say **As before**, the ticks in **Access by role** decide.

The tool remembers your last choice while the admin space is open.

## Fix: the spaces and pages list looked empty
- **Before:** the section opened with only a "choose a position or a person" box and nothing under it.
- **Now:** it opens with the first position already chosen and its spaces listed. Pick another position or a person from the box.
- **If the list ever fails to draw,** the section shows the reason instead of staying blank.

## Unchanged
- **"Space access by role"** (the simple space table and each position's department) is still its own section.
- The server rules are the same as in v3.36. No `Code.gs` changes in this version.
