# Security report — audit October 2026

## 1. Where the security boundary is

| Layer | Single-file edition | Server Edition |
|---|---|---|
| Who you are | E-mail + password checked by `Code.gs` (password hash, account must be approved by the admin). Admin = the admin key in `Code.gs`. | Microsoft Entra ID (or Google) sign-in checked on the server; admin = Entra app role. No shared admin key. |
| What you may read and write | **Enforced by `Code.gs`** per key and per record: position, department, record owner, site, admin-only keys, read-only fields (pay), add-only logs. | The same rules, generated from `Code.gs` (`src/rules/rules.js`), run on the server. |
| Where data lives on the device | Browser `localStorage` (disk) for the signed-in person's permitted data. | Browser memory only; nothing written to disk. |
| What the screens hide | Convenience only. A person can always read what is in their own browser. | Convenience only, same. |

**Rule used in this audit:** a finding counts as fixed only when the server side (`Code.gs` / Server Edition) refuses the action, or when it is purely a browser-side problem (for example data left on a shared device). Hiding a button was never counted as a security fix.

## 2. Authorization findings

| # | Finding | Where enforced now | Verified by |
|---|---|---|---|
| S-1 (F-06) | Default admin keys worked. | `Code.gs` refuses admin requests while `ADMIN_SECRET` is the default or under 6 characters; mailer script refuses its default keys. | `audit_default_keys.test.js` |
| S-2 (F-02) | No-position accounts reached department screens. | Server already sent no site data to them (`whoIs_`, re-verified). The tool now also shows Home only. | `audit_account_switch.test.js`, `sync_privacy.test.js` |
| S-3 (F-01) | Data of the previous person stayed in a shared browser. | Browser: data-owner mark and wipe on person change. | `audit_account_switch.test.js` |
| S-4 (F-04) | CSV formula injection. | Browser: every CSV the tool writes is neutralised. | `audit_csv_injection.test.js` |
| S-5 (new) | Document confirmations could be forged by editing local data. | `Code.gs` `mergeOwn_`: a person can only add/change confirmations with their own e-mail; other people's are kept. | `doc_acks.test.js` |
| S-6 (new) | Handover notes could be changed or deleted by others. | `Code.gs` `handoverPush_`: new handovers only in your own name; only the writer edits, until it is read; "read" only in your own name and not by the writer; staff cannot delete. Read and write limited to schedule positions. | `handover.test.js` |

Re-verified without change: record-level privacy of tickets, cases, comments, announcements, projects, chats (`sync_privacy`, `sync_more`, `community`, `projects*`); pay stripped for non-pay positions (`bonus_pay`); add-only audit log and journal (`hardening`); Google token audience check on the employee page (`employee_page`); TV links reveal names and tables only (`tv_screens`); no script injection on any screen (injection crawl with positive control).

## 3. Data risks

| Risk | Edition | Severity | Mitigation now | Recommended |
|---|---|---|---|---|
| Admin key kept in the admin's browser while signed in (`totSyncCfg.key`) | Single-file | High if that browser is shared | Admin idle lock; sign-out wipes | Separate browser profile for admin work; or the Server Edition (no shared key). |
| Lost or shared laptop holds the person's permitted data on disk | Single-file | Medium | Sign-out wipes; owner change wipes (F-01) | Disk encryption (company standard); Server Edition keeps nothing on disk. |
| Devices used before this update have no owner mark | Single-file | Low | Old `totAuth` e-mail is used as the owner | Sign out once on shared devices after updating. |
| Password accounts in `Code.gs` | Single-file | Medium | Hash + admin approval | Company sign-in (Entra) via the Server Edition. |
| Confirmations prove a click, not understanding | Both | Low | Clearly worded ("I have read version N") | Pair important procedures with a short check in Academy. |
| CSP allows inline scripts | Server Edition | Medium | Escaping everywhere, injection crawl clean | Long-term removal of inline handlers (see Server Edition `docs/SECURITY.md`). |
| Not penetration-tested | Both | — | Automated tests only | Third-party test before real pay and evaluation data go in. |

## 4. Privacy

- The employee page and TV pages receive only what is needed (schedule, rotation, own requests; TV: names and tables).
- Candidate (recruiting) data is sent by `Code.gs` only to people whose position has access to HR → Recruiting. No automatic retention/deletion exists yet — see the department plan (HR/Recruiting, "retention rule").
- No new network destination was added in this audit. The Dynamics 365 connection is off until the company configures it, and it then talks only to the company's own tenant.
- No employee scoring or monitoring feature was added.

## 5. What cannot be secured without a server

In the single-file edition, a person who is allowed to see data has a copy of it on their device. Nothing in the HTML file can stop them from copying it. Ending access only stops future syncs; it does not remove what was already downloaded. Where that is unacceptable (pay, evaluations, HR cases), use the Server Edition.
