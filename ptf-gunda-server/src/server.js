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
  /* one JSON line per minute (every 5 s with PTF_METRICS=fast): memory, event-loop delay, open live connections. App Insights / Log Analytics pick these up from stdout. */
  const { monitorEventLoopDelay } = require('perf_hooks'), h = monitorEventLoopDelay({ resolution: 10 }); h.enable();
  const mt = setInterval(() => { const m = process.memoryUsage(); console.log(JSON.stringify({ m: 'metrics', t: Date.now(), rssMB: Math.round(m.rss / 1048576), heapMB: Math.round(m.heapUsed / 1048576), lagP50: Math.round(h.percentile(50) / 1e4) / 100, lagP99: Math.round(h.percentile(99) / 1e4) / 100, lagMax: Math.round(h.max / 1e4) / 100, seq: app.state.seq, keys: Object.keys(app.state.cur.keys).length, stats: app.stats.take() })); h.reset(); }, process.env.PTF_METRICS === 'fast' ? 5000 : 60000); mt.unref();
  if (cfg.devLogin) console.warn('WARNING: development login is ON (PTF_DEV_LOGIN). Never use this on a shared server.');
  const stop = async (sig) => { console.log(sig + ': shutting down'); const t = setTimeout(() => process.exit(1), 15000); t.unref(); try { await app.close(); } catch (e) {} process.exit(0); };
  process.on('SIGTERM', () => stop('SIGTERM')); process.on('SIGINT', () => stop('SIGINT'));
  process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e && e.stack || e));
})().catch((e) => { console.error('Failed to start:', e); process.exit(1); });
