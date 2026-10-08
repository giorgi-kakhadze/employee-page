#!/usr/bin/env node
'use strict';
/* Moves existing data into the server database.
     node scripts/import-backup.js <file> [--site main] [--replace]
   <file> can be
     - a Drive file "tool-data.json" of the single-file edition   { keys: { name: { v, t } }, del?, updatedAt? }   (all sites, as stored)
     - a backup made in the tool (Settings > Backup)              { _meta, data: { name: "json text" } }          (one site; --site names it)
   Without --replace the import is refused if the database already holds data. */
const fs = require('fs'), path = require('path');
const { load } = require('../src/config'); const { State } = require('../src/store/state');
const LOCAL_ONLY = ['totTrainerDisplayName', 'totSyncCfg', 'totSyncMeta', 'totSyncPrev', 'totMailerCfg', 'totMailerLast', 'totAdminHash', 'totAdminIdleMin', 'totAuth', 'totTombstones'];
(async () => {
  const args = process.argv.slice(2), file = args.find((a) => !a.startsWith('--')), site = (args[args.indexOf('--site') + 1] || 'main'), replace = args.includes('--replace');
  if (!file) { console.error('usage: node scripts/import-backup.js <file> [--site main] [--replace]'); process.exit(2); }
  const j = JSON.parse(fs.readFileSync(file, 'utf8')), now = Date.now(), keys = {};
  if (j.keys && typeof j.keys === 'object') Object.keys(j.keys).forEach((k) => { const e = j.keys[k]; if (e && typeof e.v === 'string') keys[k] = { v: e.v, t: +e.t || now }; });
  else if (j.data && typeof j.data === 'object') Object.keys(j.data).forEach((k) => { if (LOCAL_ONLY.includes(k) || typeof j.data[k] !== 'string') return; keys[site === 'main' ? k : 's~' + site + '~' + k] = { v: j.data[k], t: now }; });
  else { console.error('Unrecognised file format'); process.exit(2); }
  const cfg = load(); const st = await State.open(cfg);
  if (Object.keys(st.cur.keys).length && !replace) { console.error('The database already holds ' + Object.keys(st.cur.keys).length + ' keys. Use --replace to overwrite (take a backup first).'); await st.close(); process.exit(1); }
  await st.replaceAll({ keys, del: j.del || {}, updatedAt: j.updatedAt || now });
  console.log('Imported ' + Object.keys(keys).length + ' keys (' + Math.round(Object.values(keys).reduce((s, e) => s + e.v.length, 0) / 1024) + ' KB).'); await st.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
