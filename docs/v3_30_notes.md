# PTF / Gunda v3.30: one nickname = one person, one full name = one person

Files changed:
- `tool/PTF-pass-to-floor-Gunda.html`
- `tool/Code.gs` (the new admin-only setting)
- new test: `tests/unique_names.test.js`

## The rules (both on by default)
**Nicknames:** a nickname belongs to one person. If "James" is used by anyone, no one else can be James.

**Full names:** a first + last name belongs to one person. The next person with the same name gets a number: "Georgi Kakadze 1", then "Georgi Kakadze 2", and so on.

**Who is compared:**
- everyone in the employee list, whatever their status;
- every trainee in every onboarding group, including the group you are in.

Capital letters and extra spaces do not matter: "james" = "James".

**The same person is not a duplicate:**
- a trainee who moves to another group (same Personal ID or Employee ID);
- a trainee who was already registered in the employee list from this group.

## In Onboarding (Information sheet)
**Typing a nickname that is taken:** the value is **not saved**. A red line under the toolbar names who uses it and where. For example:

> Not saved. The nickname "James" is already used by Georgi Kakadze (employee list (Employed)). One nickname belongs to one person: choose another one.

The message also appears as a notification.

**Typing a first or last name that makes an existing full name:** the tool says where the name already exists and asks:

> Save this person as "Georgi Kakadze 1"?

- **OK** saves the person with the number added to the last name.
- **Cancel** saves nothing.

**Pasting cells:**
- taken nicknames are not saved;
- repeated names get the next number.

One message lists everything that happened.

**Importing (Excel / CSV or the "Paste here" box):**
- repeated names are numbered;
- taken nicknames are left empty.

The green line under the toolbar lists each change, for example "Georgi Kakadze → Georgi Kakadze 2" and "James (Georgi Kakadze 2)".

The red cell marking for taken nicknames follows the same switch.

## In the employee file (person profile → Edit)
Changing a person's nickname or full name to one someone else already uses is not saved. The message gives the free numbered name to use.

## Only the admin can switch the rules off
- **Admin space (Ctrl+G or the logo) → 🪪 Unique nicknames and names:**
  - ☑ One nickname per person
  - ☑ One full name per person (repeats get a number)
- **More → ⚙ Settings** (admin) has the same switches.
- **Switching a rule off** asks for confirmation and is written to the audit log. Everyone receives the change at their next sync.
- **Nobody else can change it.** The switches tell anyone else "Only the admin can change this", and the server refuses the setting (`totUniqRules`) from anyone but the admin.
- **🔎 Find duplicates already in the data** lists the nicknames and full names that several people already share: data from before v3.30, or saved while a rule was off. Fix them in Onboarding or the employee file.

## You must do
1. Paste the new `tool/Code.gs` into Apps Script, keeping your own `ADMIN_SECRET` and `SERVER_SALT`. Then Deploy → Manage deployments → edit → **New version**.
2. Give everyone the new `tool/PTF-pass-to-floor-Gunda.html`.
3. Optional: as admin, open the admin space and press **Find duplicates already in the data**.

## Tested
`unique_names.test.js` (22 checks):
- **Nicknames:** a nickname taken in the employee list is refused; one taken in another group is refused, in any capitalisation; the same nickname twice in one group is refused; a free one is saved; a person keeps their own nickname.
- **Names:** "Georgi Kakadze" becomes "Georgi Kakadze 1" when typed and "Georgi Kakadze 2" when imported; a second "Ana Lomidze" in the same group becomes "Ana Lomidze 1"; a person moving from another group keeps their name and nickname; the import message.
- **Employee file:** a taken nickname is refused.
- **Admin switches:** in the admin space and Settings; switching each rule off works; with the rules off, repeats are saved; the duplicate finder; a manager receives the rule but cannot change it; the server refuses it from a manager.

All 355 checks in the 11 test files pass, and a test that clicks every button for each position shows no page errors.

**Not tested:** the real Apps Script runtime and Google Drive.
