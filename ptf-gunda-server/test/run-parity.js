#!/usr/bin/env node
'use strict';
/* Runs every test file of the single-file edition (../tests/*.test.js) against the ported server rules. A failure only counts if it is not in the list of
   known, intended differences below (things the Server Edition removed on purpose). Takes about 15 minutes (the tests drive a browser). */
const { spawnSync } = require('child_process'), fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', '..', 'tests');
const KNOWN = {
  hardening: ['access requests are throttled (30 per 10 minutes)']   // there is no "request access" action any more: Microsoft decides who may sign in
};
const only = process.argv[2] ? process.argv[2].split(',') : null;
const files = fs.readdirSync(dir).filter((f) => /\.test\.js$/.test(f)).map((f) => f.replace('.test.js', '')).filter((f) => !only || only.includes(f));
let unexpected = 0, total = 0, known = 0;
for (const f of files) {
  const r = spawnSync('node', [path.join(__dirname, 'parity.js'), f], { encoding: 'utf8', maxBuffer: 1 << 28, timeout: 1200000 });
  const out = (r.stdout || '') + (r.stderr || ''), fails = out.split('\n').filter((l) => l.includes('❌')).map((l) => l.replace(/^\s*❌\s*/, '').replace(/\s+→.*$/, '').trim()), n = (out.match(/✅|❌/g) || []).length;
  const bad = fails.filter((x) => !(KNOWN[f] || []).includes(x)); total += n; known += fails.length - bad.length; unexpected += bad.length + (r.status === null || (r.status !== 0 && !fails.length) ? 1 : 0);
  console.log((bad.length || (r.status !== 0 && !fails.length) ? '❌ ' : '✅ ') + f.padEnd(20) + n + ' checks' + (fails.length - bad.length ? ', ' + (fails.length - bad.length) + ' known difference' : '') + (bad.length ? ', FAILED: ' + bad.join(' | ') : ''));
}
console.log('parity: ' + total + ' checks in ' + files.length + ' files; ' + known + ' known differences; ' + (unexpected ? unexpected + ' UNEXPECTED FAILURES' : 'no unexpected failures'));
process.exit(unexpected ? 1 : 0);
