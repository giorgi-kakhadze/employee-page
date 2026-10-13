'use strict';
/* Configuration from environment variables. In production the process refuses to start unless every security-relevant setting is present and sane
   ("fail closed"): a half-configured server must never run with weak defaults. Secrets come from Azure Key Vault references in App Service settings. */
const path = require('path');
const env = process.env;
function bool(v, d) { return v == null || v === '' ? d : /^(1|true|yes|on)$/i.test(v); }
function list(v) { return String(v || '').split(/[,;\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean); }

function load(e) {
  e = e || env;
  const mode = (e.PTF_ENV || 'production').toLowerCase();
  if (['production', 'dev', 'test'].indexOf(mode) < 0) { const c0 = { errors: ['PTF_ENV must be "production", "dev" or "test" (got "' + mode + '")'], mode, prod: true, entra: {}, limits: {}, mail: {}, bootstrapAdmins: [] }; return c0; }
  const prod = mode === 'production';
  const c = {
    mode, prod,
    port: +e.PORT || +e.WEBSITES_PORT || 8080,
    publicUrl: String(e.PTF_PUBLIC_URL || (prod ? '' : 'http://localhost:' + (+e.PORT || 8080))).replace(/\/+$/, ''),
    databaseUrl: e.DATABASE_URL || '', databaseSsl: bool(e.DATABASE_SSL, prod),
    sqliteFile: e.PTF_SQLITE_FILE || path.join(__dirname, '..', 'data', 'ptf.sqlite'),
    dataDir: e.PTF_DATA_DIR || path.join(__dirname, '..', 'data'),
    tz: e.PTF_TZ || 'UTC',
    salt: e.PTF_SALT || '',
    sessionSecret: e.PTF_SESSION_SECRET || '',
    sessionHours: +e.PTF_SESSION_HOURS || 10, sessionIdleMinutes: +e.PTF_SESSION_IDLE_MIN || 120,
    entra: { tenant: e.ENTRA_TENANT_ID || '', clientId: e.ENTRA_CLIENT_ID || '', clientSecret: e.ENTRA_CLIENT_SECRET || '', adminRole: e.ENTRA_ADMIN_ROLE || 'PTF.Admin', adminGroup: e.ENTRA_ADMIN_GROUP_ID || '', allowedDomains: list(e.PTF_ALLOWED_DOMAINS) },
    bootstrapAdmins: list(e.PTF_BOOTSTRAP_ADMINS),
    devLogin: bool(e.PTF_DEV_LOGIN, false),
    tvIps: list(e.PTF_TV_IPS),   // optional: only these addresses (or address prefixes) may open lobby screens
    trustProxy: bool(e.PTF_TRUST_PROXY, !!e.PTF_FRONTDOOR_ID),
    frontDoorId: e.PTF_FRONTDOOR_ID || '',
    mail: { transport: e.PTF_MAIL || (prod ? 'graph' : 'log'), from: e.PTF_MAIL_FROM || '', tenant: e.ENTRA_TENANT_ID || '', clientId: e.GRAPH_CLIENT_ID || e.ENTRA_CLIENT_ID || '', clientSecret: e.GRAPH_CLIENT_SECRET || e.ENTRA_CLIENT_SECRET || '' },
    limits: { rpcPerMin: +e.PTF_RPC_PER_MIN || 600, bodyBytes: 6 * 1024 * 1024, uploadBytes: 3 * 1024 * 1024, authPerMin: +e.PTF_AUTH_PER_MIN || 30, fullPullPerMin: +e.PTF_FULLPULL_PER_MIN || 20 },
    appInsights: e.APPLICATIONINSIGHTS_CONNECTION_STRING || ''
  };
  const errs = [];
  if (prod) {
    if (c.devLogin) errs.push('PTF_DEV_LOGIN must be off in production');
    if (!c.databaseUrl) errs.push('DATABASE_URL (PostgreSQL) is required in production');
    if (!/^https:\/\//.test(c.publicUrl)) errs.push('PTF_PUBLIC_URL must be the https address of the tool');
    if (c.salt.length < 24) errs.push('PTF_SALT must be a random secret of at least 24 characters');
    if (c.sessionSecret.length < 32) errs.push('PTF_SESSION_SECRET must be a random secret of at least 32 characters');
    if (!c.entra.tenant || !c.entra.clientId || !c.entra.clientSecret) errs.push('ENTRA_TENANT_ID, ENTRA_CLIENT_ID and ENTRA_CLIENT_SECRET are required');
    if (!c.entra.allowedDomains.length) errs.push('PTF_ALLOWED_DOMAINS (your company e-mail domains) is required');
    if (c.trustProxy && !c.frontDoorId) errs.push('PTF_FRONTDOOR_ID is required when PTF_TRUST_PROXY is on (otherwise anyone could fake their address)');
    if (c.mail.transport === 'graph' && !c.mail.from) errs.push('PTF_MAIL_FROM (the sending mailbox) is required for e-mail');
  } else {
    c.salt = c.salt || 'dev-salt-not-secret'; c.sessionSecret = c.sessionSecret || 'dev-session-secret-not-secret-0000000000';
  }
  c.errors = errs;
  return c;
}
module.exports = { load };
