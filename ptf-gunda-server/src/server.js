#!/usr/bin/env node
'use strict';
const { load } = require('./config');
const { createApp } = require('./app');
(async () => {
  const cfg = load();
  if (cfg.errors.length) { console.error('Refusing to start. Fix the configuration:\n - ' + cfg.errors.join('\n - ')); process.exit(1); }
  const app = await createApp(cfg);
  const port = await app.listen();
  console.log('Pass to the Floor · Gunda · Server Edition listening on :' + port + ' (' + cfg.mode + ', ' + (cfg.databaseUrl ? 'PostgreSQL' : 'SQLite') + ')');
  if (cfg.devLogin) console.warn('WARNING: development login is ON (PTF_DEV_LOGIN). Never use this on a shared server.');
  const stop = async (sig) => { console.log(sig + ': shutting down'); const t = setTimeout(() => process.exit(1), 15000); t.unref(); try { await app.close(); } catch (e) {} process.exit(0); };
  process.on('SIGTERM', () => stop('SIGTERM')); process.on('SIGINT', () => stop('SIGINT'));
  process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e && e.stack || e));
})().catch((e) => { console.error('Failed to start:', e); process.exit(1); });
