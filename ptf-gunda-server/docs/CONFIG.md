# Settings

All settings are environment variables (App Service → Configuration). `.env.example` has a template. In production the server **refuses to start** and lists what is missing or unsafe.

| Variable | Required in production | Meaning |
|---|---|---|
| `PTF_ENV` | yes (`production`) | `dev` allows the development login, SQLite and weak defaults; never use on a shared server |
| `PTF_PUBLIC_URL` | yes, https | the address people open; used for the Origin check and the Entra redirect |
| `DATABASE_URL` | yes | PostgreSQL connection string (without it the server uses SQLite, dev only) |
| `DATABASE_SSL` | yes (default on in production) | verify the database's TLS certificate |
| `PTF_SALT` | yes, ≥ 24 chars | salt for the server's hashes |
| `PTF_SESSION_SECRET` | yes, ≥ 32 chars | signs the sign-in state and hashes session tokens |
| `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET` | yes | the app registration |
| `ENTRA_ADMIN_ROLE` | no (`PTF.Admin`) | app role value that makes an administrator |
| `ENTRA_ADMIN_GROUP_ID` | no | a group object id that also makes administrators (the token's `groups` claim; with more than 200 groups use app roles instead) |
| `PTF_ALLOWED_DOMAINS` | yes | e-mail domains allowed to sign in, comma separated |
| `PTF_BOOTSTRAP_ADMINS` | no | e-mails that are administrators even without the app role; use for the first sign-in, then empty it |
| `PTF_SESSION_HOURS` / `PTF_SESSION_IDLE_MIN` | no (10 / 120) | session lifetime and idle limit |
| `PTF_MAIL` | no (`graph` in production, `log` in dev) | `graph` or `log` |
| `PTF_MAIL_FROM` | yes with `graph` | sending mailbox |
| `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET` | no | separate app for mail; default is the sign-in app |
| `PTF_DATA_DIR` | no | folder for videos, project files, daily exports (mount an Azure Files share) |
| `PTF_TZ` | no (`UTC`) | time zone for dates and the 07:00 mail |
| `PTF_TRUST_PROXY` | no (on in production) | read the client address from Front Door's header |
| `PTF_FRONTDOOR_ID` | recommended | accept only requests carrying this `X-Azure-FDID` |
| `PTF_RPC_PER_MIN` | no (600) | requests per person per minute |
| `PTF_AUTH_PER_MIN` | no (30) | sign-in requests per address per minute |
| `PTF_TV_IPS` | no | lobby screens (`/tv/<token>`) may only be opened from these addresses or address prefixes, comma separated (for example `203.0.113.7,10.20.`); empty = any |
| `PTF_METRICS` | no | `fast` prints metrics every 5 s |
| `PORT` | no (8080) | listen port |
