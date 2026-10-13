# PTF / Gunda — user guide (updates from the October 2026 audit)

This guide covers what changed and the everyday tasks around it. Earlier guides (`docs/v3_*_notes.md`, the Confluence PTF space) still apply to everything else.

---

## 1. Signing in on a shared computer

- When somebody else signs in on a browser that holds another person's data, the tool **clears the browser first** and then loads only the new person's data. You do not need to do anything.
- Still: press **Sign out** when you leave a shared computer. It removes your data from that browser.
- **New accounts:** after the admin approves you, you see **Home only** with the note "Your account is ready, but it has no position yet". Ask your manager to give you a position in **Admin → Access management**. The spaces appear on your next sync.

## 2. Documents that staff must read and confirm (HR, Operations, any department)

**For the document owner (department staff with board rights, managers, admin)**
1. Open the department → **📄 Documents** → **＋ Add a link** (or **Edit** on an existing one).
2. Fill **Title** and **Link** (SharePoint, OneDrive, Drive…). The file stays where it is.
3. Set **Version** (for example `1`, `2`, `2.1`).
4. Tick **Staff must read and confirm this version**.
5. **Visible to:** *This department* asks the people of that department; *Everyone* asks every person with a position.
6. Save.

You then see **"N of M confirmed version 2"** on the document. **Who has not?** lists the people who still need to confirm.
When the procedure changes, raise the **Version**. Everybody is asked again; old confirmations stay in the history but do not count for the new version.

**For staff**
1. Open your department → **📄 Documents**. Documents waiting for you show **✓ I have read version N**.
2. Open the link and read the document.
3. Press **✓ I have read version N** and confirm. It turns into "You confirmed version N on …".

Nobody can confirm for somebody else. The server only accepts confirmations made in your own name.

## 3. Shift handover (Today screen)

Who: everybody who can edit the schedule (shift leads, scheduling coordinators, seniors, managers).

**Writing the handover (outgoing shift)**
1. **FMD → Schedule → Today**, choose the date and your shift.
2. In **📤 Handover to the next shift**, write what the next shift must know: open issues, people to watch, equipment, promises made.
3. Press **💾 Save handover**. The shift summary at that moment (expected, working, absent, gaps, unconfirmed) is saved with it.
4. You can update it until the next shift has read it. After that it is locked.

**Reading it (incoming shift)**
1. **FMD → Schedule → Today**, your shift. The box **📥 From the previous shift** shows the note, who wrote it and when. **Shift summary at save time** opens the saved summary.
2. Press **✔ I have read it**. The writer sees "read by <your name>".

Rules the server keeps: only the writer can change a note; only somebody else can mark it read, and only in their own name; staff cannot delete a handover. "Previous shift" means the shift that starts before the one you have open (for the first shift of the day, the last shift of the day before).

**Copy handover text** still exists if you also want to paste the summary into a chat.

## 4. Exporting to CSV / Excel

Cells that would start with `=`, `+`, `@` or `-text` are written with a leading `'`, so Excel shows them as text instead of running them as formulas. Negative numbers stay numbers. If you see a `'` at the start of a name in Excel, that is why. It does not change the data in the tool.

## 5. For the admin

- **Change the admin key** in `Code.gs` (`ADMIN_SECRET`, at least 6 characters, not the example) and deploy a new version. While the example key is in place, admin access is refused with a message that says so.
- The same applies to the two keys in the mailer script.
- **Admin → Integrations** shows which links work now and which need company settings (Dynamics 365).
- Use a separate browser profile for admin work in the single-file edition, and sign out afterwards.

## 6. Where to get help

Problems with a screen: send a ticket to **IT** from any department board. Problems with access: **Admin → Access management** (admin) or ask your manager.
