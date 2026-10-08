# Security

What protects the data, and **where each claim is tested**. "Tested" means an automated test in this folder that fails if the control is removed. "Not verifiable here" means it depends on Azure or Microsoft services I could not reach from the build environment; it is listed so it is checked at deployment, not assumed.

## 1. Controls

### Identity and sessions
| Control | How | Evidence |
|---|---|---|
| Only company Microsoft accounts | Entra OIDC code flow + PKCE; tenant, issuer, audience, expiry, nonce verified; e-mail domain allow-list | `test/auth.test.js` sections 2–3 (wrong audience, issuer, tenant, expiry, nonce, key, algorithm "none", unknown key id, other domain, wrong state, wrong PKCE verifier) |
| Live Microsoft sign-in | the same code against the real tenant | **Not verifiable here** (tested against a local stand-in with real RSA signatures) |
| Admin is a Microsoft app role, not a shared password | app role `PTF.Admin` (or a group); the old "admin key" no longer exists | `test/auth.test.js` section 2; `test/server.test.js` section 6 |
| No open redirect after sign-in | `to` must start with a single `/` | `test/auth.test.js` section 2 |
| Server-side sessions | opaque 256-bit token in a `__Host-`, HttpOnly, Secure, SameSite=Lax cookie; the database stores an HMAC of the token, never the token | `test/server.test.js` section 7 |
| Sessions end | 10 h absolute, 2 h idle (configurable); logout deletes the row; revocation reaches every instance within 30 s | `test/server.test.js` section 7 |
| Live channel ends with the session | checked every 25 s | code (`src/app.js`) |

### Requests
| Control | How | Evidence |
|---|---|---|
| CSRF | custom header `X-PTF-CSRF` (per-session token) required on every write, plus an `Origin` check; SameSite=Lax cookie | `test/server.test.js` section 4 |
| The server decides who you are | the person and the admin flag come from the session; any `email`, `pwHash` or `admin` in the request body is ignored | `test/server.test.js` section 6 |
| Same permission rules as before | derived from `Code.gs`; the 20 original test files run against them | `npm run test:parity` |
| Employees cannot use the staff API | `/api/rpc` is staff-only; `/api/employee` accepts only `me`, `reqNew`, `reqCancel` | `test/server.test.js` section 5 |
| Body and rate limits | 6 MB body; 600 requests/min/person; 30 boot loads/min; 30 sign-in attempts/min/IP | `test/server.test.js` section 8, `test/auth.test.js` section 4 |
| Malformed input never crashes or leaks | always a JSON answer | `test/server.test.js` section 8 |

### Browser
| Control | How | Evidence |
|---|---|---|
| Nothing on the laptop | storage replaced by memory | browser test (0 entries read through DevTools) |
| Content-Security-Policy | `default-src 'none'`, `connect-src 'self'` (nothing can be sent to another site), `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'none'`, `form-action 'self'` | `test/server.test.js` section 2; browser test collects every CSP violation |
| Clickjacking, sniffing, referrer | `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, COOP/CORP same-origin | `test/server.test.js` section 2 |
| HSTS | `max-age=31536000; includeSubDomains` in production | code |
| Data cannot break out of the page | the person's data is embedded as JSON with `<` escaped | `test/server.test.js` section 5 |

### Data
| Control | How | Evidence |
|---|---|---|
| Encrypted in transit | HTTPS only (Front Door → App Service → PostgreSQL with TLS; private network to the database) | Not verifiable here (Bicep sets it; check at deployment) |
| Encrypted at rest | PostgreSQL, storage account and backups are encrypted by Azure by default | Not verifiable here |
| Secrets | Key Vault references; the app has a managed identity; no secret in the repository | `.env.example` has none; `PTF_SALT` and `PTF_SESSION_SECRET` are refused if shorter than 24 / 32 characters |
| Fails closed | production refuses to start if anything security-relevant is missing or if the development login is on | `test/server.test.js` section 3 |
| Videos and project files | private; returned only after the rule code checks the right; a path-like id is refused | `test/server.test.js` section 10 |
| Backups | PostgreSQL point-in-time restore (35 days), plus a daily JSON export (14 kept) | export: code; PITR: **not verifiable here** |
| Concurrent saves cannot overwrite each other | "save only if nobody saved in between" is checked under a database lock across instances | `test/postgres.test.js` sections 2–3 |

### Audit
Every sign-in, sign-out, refused save, refused request (CSRF, origin), failed sign-in, denied tool access and every video or project-file download is written to a table where each row contains a hash of the previous one. `GET /api/admin/audit?verify=1` (admin only) checks the chain and reports the first broken row. Tested: `test/server.test.js` section 11 (a changed row is found, and where) and `test/postgres.test.js` section 5 (one valid chain written by two instances).
Not in the trail (to keep it readable): ordinary saves. Set `cfg.auditEveryPush` in code if you want one line per save. Record-level history stays in the tool's own change journal.

## 2. Known limits (read these)
1. **`script-src 'unsafe-inline'`.** The tool uses inline event handlers and builds embedded tools as inline documents. A nonce-based policy would block them. The tool escapes all text it displays, and `connect-src 'self'` stops stolen data from being sent anywhere, but a future script-injection bug would not be stopped by CSP. Removing inline handlers from 27,000 lines is a separate project.
2. **The rules are the old rules.** Anything the single-file edition allowed (for example a manager being able to watch evaluation videos by default) is still allowed. The change here is *who can reach the rules*, not what the rules say.
3. **An administrator sees everything**, as before. Use few administrators, require MFA and conditional access on the app registration, and read the audit trail.
4. **Instances catch up once a second.** A save on one instance is visible on the others within about a second; a revoked session within 30 seconds.
5. **Keys are whole documents.** Two people editing the same key (for example the monthly schedule) are merged by the tool's own merge code, as before. This is not row-level locking.
6. **Pay.** Pay data is stripped for every position except Manager by the rule code, as before; managers' browsers hold it in memory while the tab is open.
7. **Browser memory.** Data a person may see is in that tab's memory (not on disk). Screenshots, screen sharing and malicious browser extensions can still read it.
8. **Not penetration-tested.** The tests above are mine. Have a third party test it before it holds real pay and evaluation data.
9. **Dependencies.** One runtime dependency (`pg`); run `npm audit` in CI (template included).

## 3. What to configure in Microsoft Entra
* App registration, single tenant, redirect URI `https://<host>/auth/callback` (Web), no implicit flow.
* App role `PTF.Admin` assigned to the few administrators; "Assignment required" ON for the enterprise application, so only assigned people or groups can sign in at all.
* Conditional access: MFA, compliant device, block legacy auth.
* Graph application permission `Mail.Send`, restricted to the one mailbox with an Exchange *application access policy*.
