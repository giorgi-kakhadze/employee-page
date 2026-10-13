# Pass to the Floor · Gunda · Server Edition

The Pass to the Floor tool for a company with thousands of employees: hosted centrally, opened by link, **signed in with Microsoft (Entra ID)**, data in **PostgreSQL**, nothing stored on laptops.

> The original **single-file edition** (`../tool/`) is unchanged. This folder is built from it, see `docs/CHANGES-FROM-SINGLE-FILE.md` ("which one do I update?").

## Try it (5 minutes, no Microsoft account needed)
```bash
cd ptf-gunda-server
npm install                       # only dependency: pg (needed for PostgreSQL; not for this trial)
PTF_ENV=dev PTF_DEV_LOGIN=1 node src/server.js        # SQLite file in ./data
# optional: load the demo company (1,073 people)
node scripts/import-backup.js ../demo/PTF-demo-backup.json --replace     (stop the server first)
```
Open `http://localhost:8080/dev/login?email=you@example.com&admin=1` once, then `http://localhost:8080/`. For a real PostgreSQL: `docker compose up --build`.

## Documents
| | |
|---|---|
| `docs/ARCHITECTURE.md` | what it is, what I assumed about the company, why each choice |
| `docs/SECURITY.md` | every control and the test that proves it; known limits |
| `docs/THREAT-MODEL.md` | who could attack what, and what stops them |
| `docs/DEPLOYMENT-AZURE.md` | step by step; Entra registration, infrastructure, secrets, checks (**not run on Azure**) |
| `docs/RUNBOOK.md` | operations, incidents, restore |
| `docs/CONFIG.md` | all settings |
| `docs/MIGRATION.md` | moving the data from Google Drive |
| `docs/LOADTEST.md` | measured capacity |
| `docs/CHANGES-FROM-SINGLE-FILE.md` | differences and which edition to change |

## Commands
```bash
npm run build          # regenerate public/ and src/rules/rules.js from ../tool (committed, so deploy needs no build)
npm test               # all tests (needs a local PostgreSQL for the postgres test: TEST_PG_URL)
npm run test:parity    # the single-file edition's own tests against the ported rules
npm run loadtest       # 500 staff + 300 employees on ~5,400 people (needs PostgreSQL)
```
