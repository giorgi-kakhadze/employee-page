'use strict';
/* File store for evaluation videos and project attachments.
   Files live on a directory (in Azure: an Azure Files share mounted into App Service, so every instance sees the same files and Azure
   encrypts them at rest). Uploads arrive in 1.5 MB pieces, exactly like the Drive upload of the single-file edition. Private: a file is
   only ever returned through the rule code, which checks the caller's rights first. */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const CH = 1572864;
module.exports = function files(dir) {
  const up = path.join(dir, 'uploads'), fl = path.join(dir, 'files');
  fs.mkdirSync(up, { recursive: true }); fs.mkdirSync(fl, { recursive: true });
  const meta = (id) => { try { return JSON.parse(fs.readFileSync(path.join(fl, id + '.json'), 'utf8')); } catch (e) { return null; } };
  const tmpOf = (owner, u) => path.join(up, crypto.createHash('sha256').update(owner + '|' + u).digest('hex').slice(0, 40) + '.part');
  return {
    CH,
    chunk(o) {
      const bytes = Buffer.from(String(o.data || ''), 'base64'), f = tmpOf(o.owner, o.up);
      if (!bytes.length || bytes.length > CH || !Number.isInteger(o.i) || !Number.isInteger(o.n) || o.i < 0 || o.n !== Math.ceil(o.size / CH) || o.i * CH + bytes.length > o.size) return { error: 'bad upload' };
      if (o.i === 0) { try { fs.rmSync(f, { force: true }); } catch (e) {} } else if (!fs.existsSync(f)) return { error: 'upload session lost, start again' };
      const fd = fs.openSync(f, o.i === 0 ? 'w' : 'r+'); try { fs.writeSync(fd, bytes, 0, bytes.length, o.i * CH); } finally { fs.closeSync(fd); }
      if (o.i < o.n - 1) return { ok: true };
      if (fs.statSync(f).size !== o.size) { try { fs.rmSync(f, { force: true }); } catch (e) {} return { error: 'upload incomplete, start again' }; }
      const id = 'f' + crypto.randomBytes(12).toString('hex');
      fs.renameSync(f, path.join(fl, id)); fs.writeFileSync(path.join(fl, id + '.json'), JSON.stringify({ id, name: o.name, mime: o.mime, size: o.size, owner: o.owner, kind: o.kind, created: Date.now() }));
      return { ok: true, fileId: id };
    },
    info(id) { if (!/^[\w-]+$/.test(id)) return null; return meta(id); },
    read(id, i) {
      const m = this.info(id); if (!m) return null; const s0 = i * CH; if (m.size && s0 >= m.size) return null;
      const fd = fs.openSync(path.join(fl, id), 'r'); try { const len = Math.min(CH, m.size - s0), b = Buffer.alloc(len); fs.readSync(fd, b, 0, len, s0); return { n: Math.max(1, Math.ceil(m.size / CH)), data: b.toString('base64') }; } finally { fs.closeSync(fd); }
    },
    /* videos older than 62 days are deleted (as before); returns how many */
    cleanVideos(maxAgeDays) {
      let n = 0; const cut = Date.now() - (maxAgeDays || 62) * 864e5;
      for (const f of fs.readdirSync(fl)) { if (!f.endsWith('.json')) continue; const m = meta(f.slice(0, -5)); if (m && m.kind === 'video' && m.created < cut) { try { fs.rmSync(path.join(fl, m.id), { force: true }); fs.rmSync(path.join(fl, f), { force: true }); n++; } catch (e) {} } }
      for (const f of fs.readdirSync(up)) { try { if (fs.statSync(path.join(up, f)).mtimeMs < Date.now() - 864e5) fs.rmSync(path.join(up, f), { force: true }); } catch (e) {} }
      return n;
    }
  };
};
