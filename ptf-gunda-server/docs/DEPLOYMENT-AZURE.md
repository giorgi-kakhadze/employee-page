# Deploying on Azure

> **Status: not tested on Azure.** I had no Azure subscription or Microsoft tenant. The server, the sign-in code, the database layer and the multi-instance behaviour are tested locally (see `SECURITY.md`, `LOADTEST.md`). `infra/azure/main.bicep` was written by hand and has **not** been compiled or deployed: run `az bicep build` and `az deployment group what-if` first and expect to fix small things. Every step below says what to check.

You (or your platform team) need: an Azure subscription, permission to create an *App registration* in Entra ID, a DNS name for the tool, and a mailbox to send from.

## 1. Entra ID: register the application (15 minutes)
1. Entra admin centre → App registrations → New registration. Name `Pass to the Floor`. Supported account types: *this organizational directory only*. Redirect URI (Web): `https://<your-host>/auth/callback`.
2. Certificates & secrets → New client secret (24 months). Copy the value; it goes into Key Vault in step 3.
3. App roles → Create app role: display name `PTF Administrator`, value `PTF.Admin`, allowed member types *Users/Groups*.
4. Enterprise applications → the app → Properties → **Assignment required = Yes**. Users and groups → add the groups that may use the tool (everyone who should reach the employee page, and the staff) and assign `PTF.Admin` to the few administrators.
5. API permissions → Microsoft Graph → Application permissions → `Mail.Send` → grant admin consent. In Exchange Online, limit it to one mailbox with an *application access policy* (`New-ApplicationAccessPolicy`), otherwise the app could send as anyone.
6. Conditional access: require MFA and a compliant device for this application.
7. Note the tenant id and the application (client) id.

## 2. Deploy the infrastructure
```bash
az group create -n rg-ptf -l westeurope
az deployment group what-if  -g rg-ptf -f infra/azure/main.bicep -p publicHost=ptf.your-company.com entraClientId=<id> allowedDomains=your-company.com mailFrom=ptf-noreply@your-company.com pgAdminPassword=<long random>
az deployment group create   -g rg-ptf -f infra/azure/main.bicep -p ...same...
```
This creates: virtual network (app subnet, database subnet), PostgreSQL Flexible Server 16 (private, zone-redundant, 35-day backups), Key Vault (RBAC, purge protection), storage account with an Azure Files share, App Service plan + app (Node 22, managed identity, VNet integration, health check `/healthz`, access limited to your Front Door), Front Door Premium with a WAF (managed rule sets + rate limits), Log Analytics and Application Insights.

## 3. Secrets
In the Key Vault create these secrets (the app's identity already has *Key Vault Secrets User*):

| Secret name | Value |
|---|---|
| `database-url` | `postgres://ptfadmin:<password>@<server>.postgres.database.azure.com:5432/ptf?sslmode=require` (better: create a separate database user `ptfapp` with rights on the `ptf` database only) |
| `ptf-salt` | `openssl rand -base64 48` |
| `ptf-session-secret` | `openssl rand -base64 48` |
| `entra-client-secret` | the value from step 1.2 |

Put each in as a *different* random value. Do not reuse.

## 4. Deploy the code
GitHub Actions template: `infra/ci/azure-deploy.yml` (build, `npm audit`, tests, zip deploy). Or by hand: `cd ptf-gunda-server && npm ci --omit=dev && zip -r app.zip package.json src public node_modules scripts && az webapp deploy -g rg-ptf -n <app> --src-path app.zip --type zip`.
The page files in `public/` are committed; run `npm run build` first only if you changed the single-file tool.

## 5. DNS and certificate
Front Door → Domains → add `ptf.your-company.com` (managed certificate) and point a CNAME at the Front Door endpoint. Update `PTF_PUBLIC_URL` and the Entra redirect URI if the host differs from what you used in step 1.

## 6. First sign-in and data
1. Open the address. You are sent to Microsoft; after sign-in the tool opens (as administrator, because you hold `PTF.Admin`).
2. Move your existing data in: `docs/MIGRATION.md`.
3. In the tool: Access management → add staff e-mails with their position. Everybody else who signs in sees only the employee page.

## 7. Check list before real data goes in
* [ ] `GET https://<host>/healthz` returns `{"ok":true,...}`; the app's default `*.azurewebsites.net` address answers 403 (Front Door only).
* [ ] Open the site in a private window: you are sent to Microsoft; a person who is not assigned in the enterprise application cannot sign in.
* [ ] A non-staff employee sees the employee page, not the tool; the e-mail on their employee row matches their Microsoft e-mail.
* [ ] Sign out: the old tab shows "signed out" on its next request.
* [ ] Response headers (browser dev tools → Network): `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`.
* [ ] Application Insights shows the minute metrics line (`"m":"metrics"`).
* [ ] A project update e-mail arrives (tests Graph mail).
* [ ] Restore test: restore the PostgreSQL server to a new point in time and start a second instance on it.
* [ ] Load test against a staging copy with `loadtest/run.js` (see `LOADTEST.md`) before the first day with all locations.

## 8. Sizing
Start with 2 × P1v3 (2 vCPU, 8 GB) and PostgreSQL D4ds_v5. The load test gives rule CPU per request; use it to decide. Scale out by raising the instance count; no code change.

## 9. Cost (order of magnitude, West Europe, list prices)
App Service 2 × P1v3 ≈ €280/month; PostgreSQL D4ds_v5 zone-redundant + 128 GB ≈ €450/month; Front Door Premium ≈ €300/month base; Log Analytics, Key Vault, storage ≈ €50–100. Roughly **€1,100–1,300 per month** before traffic. Standard Front Door (custom WAF rules only) and a single-zone database cut this to about €500. Check the Azure pricing calculator; these are my estimates.
