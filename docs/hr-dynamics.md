# HR source: Microsoft Dynamics 365

The tool takes its employee list from Microsoft Dynamics 365 (it used to be Workday). Two ways, pick one:

1. **Direct connection** (recommended): the tool asks Dynamics for the list on a schedule. No files.
2. **Excel / CSV export** from Dynamics, imported by hand or dropped into the Google Drive folder (the older way, still works).

## What the tool does with the list
- Matches people by **HR ID** (in Dynamics: the personnel number).
- **Updates** what HR owns: name, status, e-mail, phone, start date, end date, position.
- **Adds** new people.
- **Never removes** anybody and **never touches** what only this tool holds: screen name, barcode, team, set, shift, games, badge.
- Asks for confirmation on a manual update (new / updated / unchanged / kept). A scheduled update never asks, and stops if Dynamics sends fewer than half of the people the tool already has.
- Every change is written to the employee change history with the source "Microsoft Dynamics".

## One-time setup in Microsoft Entra / Dynamics (your IT administrator, about 15 minutes)
1. Entra admin centre → App registrations → **New registration** ("PTF HR read"). Note the **Directory (tenant) ID** and **Application (client) ID**.
2. Certificates & secrets → **New client secret**. Copy the secret value (shown once).
3. In Dynamics: create an **application user** for this app (Dynamics 365 → System administration → Microsoft Entra ID applications) and give it a **read-only role** on the worker / employee data. Nothing else.
4. Note the address of your Dynamics environment, for example `https://yourcompany.operations.dynamics.com` (Finance and Operations / HR) or `https://yourcompany.crm.dynamics.com`.

## Single-file edition (Google script)
1. In the Admin panel (📧 section) copy the **newest mailer script text** into your Google script and deploy a new version.
2. Google script → Project settings → **Script properties**, add:

| Property | Value |
|---|---|
| `DYN_TENANT` | the tenant ID (or domain) |
| `DYN_CLIENT_ID` | the application (client) ID |
| `DYN_SECRET` | the client secret |
| `DYN_RESOURCE` | the Dynamics address, `https://….dynamics.com` |
| `DYN_PATH` | optional, the OData path. Default: `/data/Workers?$top=5000` |
| `DYN_MAP` | optional, JSON that says which Dynamics field fills which column |

3. In the tool: Home → Employee Data → **⏱ Scheduled import** → Source **Microsoft Dynamics 365** → **Show fields**.

## Server Edition
Set these in the server settings (they stay on the server): `PTF_DYN_TENANT`, `PTF_DYN_CLIENT_ID`, `PTF_DYN_SECRET`, `PTF_DYN_RESOURCE`, optional `PTF_DYN_PATH`, `PTF_DYN_MAP`. Admin, managers and HR can press **Show fields** / **Import now**; every pull is in the audit log.

## First run: match the field names
Dynamics environments differ in the names of their fields. Press **Show fields**: the tool prints the field names Dynamics really has and the first record. The tool already tries the usual names (`PersonnelNumber`, `Name`, `PrimaryContactEmail`, `EmploymentStartDate`, `EmploymentEndDate`, `Position`, and similar). If something is not found, set `DYN_MAP` (or `PTF_DYN_MAP`), for example:

```json
{ "HR ID": ["PersonnelNumber"], "Full Name": ["Name"], "Email Address": ["PrimaryContactEmail"], "Position": ["JobTitle"] }
```
Columns you can set: Full Name, HR ID, Email Address, Phone Number, Start Date, End Date, Position, Status. Dynamics "no date" values (1900-01-01, 2154-12-31) are treated as empty. A person with an end date in the past is **Terminated**.

## Excel / CSV from Dynamics
The import knows the usual Dynamics column names (Personnel number, Worker, Primary contact email, Employment start date, Employment end date, Job title, Employee number). The tool's label **Workday ID** is now **HR ID**; old Workday files still import.

## Security
- The secret is only ever in the Google script properties or the server settings, never in the browser, a backup file or the page.
- Only the Dynamics address you set is called; links to other addresses in an answer are ignored.
- Use a read-only role for the application user.
