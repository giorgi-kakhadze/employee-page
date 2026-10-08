#!/usr/bin/env node
'use strict';
/* node test/run-all.js [--parity]     server, sign-in, PostgreSQL (if reachable), browser; with --parity also the single-file edition's own tests (slow) */
const { spawnSync } = require('child_process'), path = require('path');
const steps = [['server', 'server.test.js'], ['auth', 'auth.test.js'], ['postgres', 'postgres.test.js'], ['browser', 'browser.test.js'], ['tv', 'tv.test.js'], ['tv-browser', 'tv-browser.test.js']];
if (process.argv.includes('--parity')) steps.push(['parity', 'run-parity.js']);
let fail = 0;
for (const [n, f] of steps) { const r = spawnSync('node', [path.join(__dirname, f)], { encoding: 'utf8', maxBuffer: 1 << 28 }); const out = r.stdout + r.stderr, last = out.trim().split('\n').slice(-1)[0];
  if (n === 'postgres' && /ECONNREFUSED|ENOTFOUND/.test(out)) { console.log('-  postgres   skipped (no PostgreSQL at ' + (process.env.TEST_PG_URL || 'postgres://postgres@127.0.0.1:54329') + ')'); continue; }
  console.log((r.status === 0 ? '✅ ' : '❌ ') + n.padEnd(10) + last); if (r.status !== 0) { fail++; console.log(out.split('\n').filter((l) => l.includes('❌')).slice(0, 10).join('\n')); } }
process.exit(fail ? 1 : 0);
