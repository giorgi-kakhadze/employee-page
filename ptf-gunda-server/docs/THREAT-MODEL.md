# Threat model

What is protected: employee personal data (names, e-mails, work ids, schedules), pay and bonus data, evaluation results and videos, disciplinary remarks, incidents, internal tickets and chats.

Who could attack, and what stops them. "Test" names point to `SECURITY.md`.

| # | Threat | Who | What stops it | Residual risk |
|---|---|---|---|---|
| 1 | Reading data without being a company employee | outsider | every page and API needs a session; sessions come only from a verified Entra sign-in (tenant, audience, signature, nonce, PKCE); assignment required in Entra; Front Door WAF; app reachable only through Front Door | a compromised Microsoft account (mitigate with MFA / conditional access, outside this tool) |
| 2 | Employee reads other people's data through the employee page | employee | the employee API accepts three actions and returns only the signed-in person's own data (rule code `me_`); the person is the session's e-mail, never a request field; same-name colleagues are not mixed (tested in the single-file suite, run unchanged here) | wrong e-mail on an employee row (data quality) |
| 3 | Staff member reads or writes beyond their position | staff | the original permission rules, per key and per record, enforced on every pull and push; the browser's copy is only a cache of what the server already allowed | the rules themselves are as designed in the tool |
| 4 | Forging who you are | staff | identity, admin flag and e-mail come from the session; body fields are ignored (test section 6); authors of records cannot be rewritten (rule code, tests from v3.39) | none known |
| 5 | Cross-site request forgery | any website a signed-in person visits | SameSite=Lax cookie, custom header with a per-session token, Origin check | none known |
| 6 | Cross-site scripting stealing data | attacker who gets text into the tool | the tool escapes displayed text; CSP `connect-src 'self'` and `default-src 'none'` stop data from leaving; HttpOnly cookie is not readable by scripts | `script-src 'unsafe-inline'` (see SECURITY.md limit 1): an injected script could act as the user inside the page, but not send data out or steal the session cookie |
| 7 | Session theft | malware, shared computer | token in HttpOnly Secure cookie; server-side revocation; 10 h / 2 h idle; logout deletes the session | malware on the user's device can use the open session |
| 8 | Stolen database or backup | insider, leaked backup | session tokens stored hashed; no passwords exist in the system; Azure encrypts at rest; private network only | the data itself is readable by whoever reads the database; restrict database access to the platform team and use Azure's audit |
| 9 | Admin abuse | administrator | few administrators, MFA, hash-chained audit of sign-ins and refusals, tool's change journal for records | an administrator can read everything |
| 10 | Tampering with the audit trail | database operator | each row hashes the previous row; `verify` finds the first change | someone who can rewrite the *whole* table and recompute the chain; ship the audit rows to Log Analytics (append-only) to cover this |
| 11 | Denial of service | outsider / noisy client | Front Door WAF rate limits, per-person limits, body limit, request timeouts, health check restarts | volumetric attacks are Azure's job (Front Door) |
| 12 | Lost update (two people save at once) | normal use | save-if-unchanged under a database lock across instances (tested with concurrent writers) | merged by the tool's merge code when conflicts happen |
| 13 | Secrets in the repository | developer | no secrets committed; production refuses weak or missing secrets; Key Vault references | secrets entered by hand in the portal are the operator's responsibility |
| 14 | Dependency attack | supply chain | one runtime dependency; `npm audit` and committed lock file in CI | `pg` itself |
| 15 | Mail abuse | staff | mail goes only to people in the access list (rule fix from v3.39); sent through one restricted mailbox; outbox with limits | anything a manager writes in a project update note |
| 16 | Open redirect / phishing via sign-in | attacker | `to` accepts only same-site paths | none known |
| 17 | File access | staff | videos and project files are only returned through the rule code after rights are checked; ids are random; path-like ids refused | files are not virus-scanned; add Defender for Storage if employees upload arbitrary files |
| 18 | A lobby screen link leaks | anyone who sees the TV or the link | the link holds a 32-character random token (190 bits); it returns only names and tables of its scope (no e-mail, Work ID, pay); "New link" and "Delete" kill it at once; unknown tokens are refused and audited; per-address rate limit; optional address list `PTF_TV_IPS` | Anyone with the link sees that rotation (as anyone standing in the lobby does). The tokens are readable by managers, seniors, coordinators and shift leads, who also edit the schedule |
