'use strict';
/* Daily JSON export of all shared data (14 copies kept), in addition to the database's own point-in-time restore.
   It is the file the single-file edition's import accepts, so data can always be moved back out. */
const fs = require('fs'), path = require('path');
module.exports.run = async function (state, cfg) {
  const dir = path.join(cfg.dataDir, 'backups'); fs.mkdirSync(dir, { recursive: true });
  const day = new Date().toISOString().slice(0, 10), f = path.join(dir, 'ptf-data-' + day + '.json');
  if (fs.existsSync(f)) return null;
  fs.writeFileSync(f, JSON.stringify({ keys: state.cur.keys, del: state.cur.del, updatedAt: state.cur.updatedAt }), { mode: 0o600 });
  const all = fs.readdirSync(dir).filter((x) => /^ptf-data-\d{4}-\d{2}-\d{2}\.json$/.test(x)).sort().reverse();
  all.slice(14).forEach((x) => fs.rmSync(path.join(dir, x), { force: true }));
  return f;
};
