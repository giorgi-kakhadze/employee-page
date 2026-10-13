# Architecture

**Pass to the Floor · Gunda · Server Edition** is the same tool as the single-file edition (same screens, same permission rules), hosted centrally, signed in with Microsoft, with the data in a database on the company's own cloud.

## 1. What this assumes about the company (and why)

You asked me to decide as if I ran the technology of a live-casino studio company: bigger than Pragmatic Play Live / Proxy Life Solutions in budget, smaller than Evolution; about 5,000 employees, one location above 2,000, three more around 1,000 each; Microsoft everywhere. A company like that almost certainly has:

| Need | What such a company would run | Used here |
|---|---|---|
| Identity | Microsoft Entra ID (Azure AD) with conditional access and MFA, because all e-mail, Teams and laptops are Microsoft | Entra ID, OpenID Connect, app role for admins |
| Cloud | Azure (they already pay for it through the Microsoft agreement; gaming regulators accept it; data centres in the EU) | Azure |
| Documents | SharePoint / OneDrive / Teams | Not used for data (see 2.3) |
| Database | A managed relational database operated by the platform team | PostgreSQL Flexible Server (zone-redundant, private network, point-in-time restore) |
| Secrets | Key Vault | Key Vault, read through the app's managed identity |
| Edge | A WAF in front of anything staff open | Azure Front Door with WAF |
| Logs | Log Analytics / Sentinel | Application Insights + Log Analytics; the audit table is also kept in the database |
| Mail | Exchange Online | Microsoft Graph `sendMail` from one service mailbox |

These are assumptions, not facts about your IT. Everything that depends on them is in one place (see section 6), so if your IT already runs something else the change is small.

## 2. Decisions and the reasons

### 2.1 Keep the 27,000-line screen code; replace what is under it
The user interface and, more importantly, the **permission rules** (who may read or write which key, record filtering for tickets, projects, chats, pay stripping, employee-page privacy) were built and tested over many versions. Rewriting them is the biggest risk in the project: a rewrite would silently change who can see pay or evaluations. So:

* The rules are **derived mechanically from `tool/Code.gs`** by `tools/port-code-gs.js` (every replacement must match exactly once; if the single-file edition changes in a way that breaks the port, the build fails and says where).
* The 20 test files of the single-file edition run **unchanged** against the ported rules (`npm run test:parity`), so parity is checked, not assumed.
* The browser code gets the same treatment (`client/build.js`): exact, asserted replacements, nothing rewritten.

### 2.2 Why not a framework, why not microservices
One Node.js process, no web framework, one runtime dependency (`pg`). Reasons: a security-sensitive tool with fewer moving parts has fewer places for a vulnerability; 500 simultaneous users is small for Node; the data (tens of MB) fits in memory. Microservices would add network hops and deployment work with no gain at this size.

### 2.3 Why the data is not in SharePoint
SharePoint (including Premium) is a document system. As a database for this tool it fails in specific ways: list view threshold (5,000 items), API throttling (HTTP 429) under 500 users, no transactions (the tool relies on "save only if nobody saved in between"), no row-level rules, and every request would pass through Graph with delegated tokens. SharePoint stays what it is for: documents. The tool can link to it.

### 2.4 Why not Power Apps / Dataverse
It would be a rewrite of everything above, with per-user licences for 5,000 people and a platform that cannot express these permission rules.

### 2.5 State in memory, written through to PostgreSQL
The rule code needs the whole policy and often several keys at once, and all data is about 20–50 MB at this company's size. So the server keeps it in memory and writes every change to PostgreSQL in one transaction (only the changed keys). Reads never touch the database. Consequences, stated plainly:

* **Scale-out:** several instances share one database. A save takes a PostgreSQL advisory lock, first catches up with what other instances saved (sequence numbers), then runs the rules, then writes. Tested with two instances and concurrent writers on a real PostgreSQL (`test/postgres.test.js`: 24 simultaneous read-modify-write cycles on one key end at exactly 24).
* **A failed write** reloads memory from the database, so memory never keeps a value that was not saved (tested).
* **Limit:** each instance holds all data. Up to roughly 500 MB of shared data is comfortable on a 8 GB instance; beyond that the store needs per-site partitioning. At 5,365 people the whole data set is 19 MB.

### 2.6 Delta sync and live notices
The single-file edition downloaded **all** keys on every sync (3.8 MB for 1,073 people). Now: the page is sent with the person's data already in it; afterwards a pull asks "what changed after sequence N" and usually receives nothing. When anybody saves, the server sends a one-line notice (`{"seq":N}`, never data) over a Server-Sent Events channel; browsers pull what changed, spread over a few seconds. Other people's edits appear in about 1.5 s (measured).

### 2.7 No data on the laptop
The browser's `localStorage` is replaced by memory (`client/shim.js`) under the tool's existing storage layer, so every one of the 441 storage calls in the tool works unchanged and nothing is written to the laptop (verified through the browser's DevTools protocol: 0 entries). Closing the tab loses nothing that was saved; edits not yet sent (up to about 2.3 s) are lost on a crash, like any unsaved typing.

### 2.8 Sign-in
Authorization-code flow with PKCE and a confidential client (secret in Key Vault). The id token is verified locally with Node's crypto (RS256, issuer, tenant, audience, expiry, nonce) against the tenant's published keys. The server issues its own opaque session cookie; the browser never holds a Microsoft token. The tool's own roles still live in the tool (Access management): Entra answers "is this a company employee" and "is this a tool administrator" (app role `PTF.Admin`).

## 3. Components

```
browser ── https ──> Azure Front Door (WAF, rate limits) ──> App Service (2+ instances of this server)
   ▲  SSE "something changed"                                   │  Entra ID (sign-in)         ──> login.microsoftonline.com
   │                                                            │  PostgreSQL Flexible Server ──> private network only
   └── page + person's data, then deltas                        │  Azure Files share          ──> videos, project files
                                                                │  Microsoft Graph            ──> e-mail from one mailbox
                                                                └  Key Vault (managed identity) ──> secrets
```

| Folder | Contents |
|---|---|
| `src/store` | SQLite (dev/tests) and PostgreSQL drivers, schema, in-memory state with write-through, change feed, cross-instance lock |
| `src/rules` | `rules.js` (generated from `Code.gs`), `env.js` (the few Google services the rules still touch) |
| `src/auth` | OIDC, JWT verification, sessions |
| `src/http` | security headers, helpers |
| `src/services` | files, audit (hash chain), mail outbox, daily export |
| `src/app.js` | routes |
| `client` | build of the tool page and the employee page, the storage shim |
| `test`, `loadtest` | tests and load test |
| `infra/azure` | Bicep (not validated) |

## 4. What stayed, what changed
See `CHANGES-FROM-SINGLE-FILE.md`.

## 5. Capacity
See `LOADTEST.md` for measured numbers and how to read them.

## 6. If your IT runs something different
* **Identity is not Entra:** replace `src/auth/oidc.js` (one file); the rest asks only for `{email, name, admin}`.
* **SQL Server instead of PostgreSQL:** replace `src/store/drivers.js` and `schema.js` (they hold all SQL; two statements use `ON CONFLICT`).
* **Blob Storage instead of a file share:** replace `src/services/files.js`.
* **Not Azure:** the server is a plain container (`Dockerfile`).
