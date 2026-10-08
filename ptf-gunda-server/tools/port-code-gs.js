#!/usr/bin/env node
'use strict';
/* Derives src/rules/rules.js from ../tool/Code.gs (the Google Apps Script server of the single-file edition).

   Why a derived file and not a rewrite: Code.gs holds every permission rule of the tool (who may read or write which key, record-level
   filtering of tickets, projects, chats, pay stripping, employee-page privacy), and it is covered by hundreds of tests. The server edition
   must enforce exactly the same rules, so the rule code is taken from Code.gs mechanically. Only the Google-specific parts are replaced:
   Drive file storage, the password/access-request flow, Google token check, UrlFetch uploads, triggers and the global script lock.
   Every replacement below must match exactly once; if Code.gs changes in a way that breaks a replacement this script stops with an error,
   so the two editions cannot drift apart unnoticed.

   Usage: node tools/port-code-gs.js [path/to/Code.gs]      (writes src/rules/rules.js) */
const fs = require('fs'), path = require('path');
const srcPath = process.argv[2] || path.join(__dirname, '..', '..', 'tool', 'Code.gs');
let s = fs.readFileSync(srcPath, 'utf8');
const ver = (/Pass-to-Floor[^\n]*v?(\d+\.\d+)/.exec(s) || [])[1] || '';

function rep(from, to) { const i = s.indexOf(from); if (i < 0) throw new Error('port: anchor not found: ' + from.slice(0, 70)); if (s.indexOf(from, i + 1) >= 0) throw new Error('port: anchor not unique: ' + from.slice(0, 70)); s = s.slice(0, i) + to + s.slice(i + from.length); }
function cut(a, b, to) { const i = s.indexOf(a); if (i < 0) throw new Error('port: cut start not found: ' + a.slice(0, 70)); const j = b == null ? s.length : s.indexOf(b, i); if (j < 0) throw new Error('port: cut end not found: ' + b.slice(0, 70)); s = s.slice(0, i) + to + s.slice(j); }

/* 1. constants that no longer apply */
rep("const ADMIN_SECRET = 'CHANGE-ME-ADMIN-KEY';", "const ADMIN_SECRET = null;   /* server edition: the admin is an Entra ID sign-in, there is no shared key */");
rep("const SERVER_SALT = 'CHANGE-ME-SALT';", "const SERVER_SALT = ENV.salt;");
rep(/const GOOGLE_CLIENT_ID = '[^']*';/.exec(s)[0], "const GOOGLE_CLIENT_ID = 'sso';");

/* 2. storage: the data lives in memory (ENV.state.cur), saved by the server after each write */
cut('function folder_() {', 'function sh_(s)', "function file_(name) { return { mem: ENV.state.cur, setContent: function () {} }; }\nfunction readJ_(f, def) { return f && f.mem ? f.mem : def; }\n");
rep("function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }", "function out_(o) { return o; }");

/* 3. identity: the verified e-mail comes from the Entra ID session, never from the request */
cut('/* Checks a Google sign-in token with Google', '/* What ONE employee may see', "function verifyGoogle_() { return ENV.id && ENV.id.email ? { email: String(ENV.id.email).trim().toLowerCase(), name: String(ENV.id.name || '') } : null; }\n\n");

/* 4. the Google Apps Script services that remain are provided by src/rules/env.js (Utilities, Session, CacheService, PropertiesService, MailApp) */

/* 5. project files: stored by the file service instead of Drive */
cut('function pjFileUp_(b, cx, me) {', '/* Run ONCE from the Apps Script editor', `function pjFileUp_(b, cx, me) {
  var pre = pjPre_(b, me); if (pre == null) return { error: 'not allowed' };
  var ix = cx.idx(pre, 'totProjects'), p = ix[String(b.pid || '')]; if (!p || pjLevel_(p, cx, ix, 0) < 2) return { error: 'not allowed' };
  var up = String(b.up || '').replace(/[^\\w]/g, '').slice(0, 40), i = +b.i, n = +b.n, size = +b.size;
  if (!up || !(size > 0) || !(n >= 1) || !(i >= 0) || i >= n) return { error: 'bad upload' }; if (size > PJ_FILE_MAX) return { error: 'The file is larger than 25 MB.' };
  var mime = String(b.mime || 'application/octet-stream').replace(/[^\\w.+\\/-]/g, '').slice(0, 100) || 'application/octet-stream';
  var nm = 'pjfile-' + String(p.id).replace(/[^\\w-]/g, '') + '-' + String(b.name || 'file').replace(/[\\\\/:*?"<>|]/g, '_').slice(0, 100);
  return ENV.files.chunk({ up: 'pf' + up, i: i, n: n, size: size, mime: mime, name: nm, owner: cx.em, kind: 'project', data: String(b.data || '') });
}
function pjFileGet_(b, cx, me) {
  var pre = pjPre_(b, me); if (pre == null) return { error: 'not allowed' };
  var it = cx.idx(pre, 'totProjItems')[String(b.id || '')]; if (!it || !it.fileId) return { error: 'gone' };
  if (pjRecLevel_('totProjItems', it, cx, cx.idx(pre, 'totProjects')) < 1) return { error: 'not allowed' };
  var fid = String(it.fileId); if (!/^[\\w-]+$/.test(fid)) return { error: 'bad id' };
  var f = ENV.files.info(fid); if (!f) return { error: 'gone' };
  if (String(f.name).indexOf('pjfile-' + String(it.pid).replace(/[^\\w-]/g, '') + '-') !== 0) return { error: 'not allowed' };   /* only files uploaded to this project */
  var r = ENV.files.read(fid, Math.max(0, +b.i || 0)); if (!r) return { error: 'bad range' };
  return { ok: true, n: r.n, mime: f.mime, name: String(it.fileName || it.title || 'file'), data: r.data };
}
`);
cut('/* Run ONCE from the Apps Script editor', 'function delMap_', '');

/* 6. everything from backup_ to the end (Drive backups, doPost, video cleanup, triggers) is replaced by the server handler */
cut('function backup_(df) {', null, '/*__HANDLER__*/\n');

const head = s;
const handler = fs.readFileSync(path.join(__dirname, 'handler.template.js'), 'utf8');
const orig = fs.readFileSync(srcPath, 'utf8');
/* the pull / push / project actions of doPost are reused verbatim */
const a = orig.indexOf("    var cx = ctx_(cur, em, admin);"), b = orig.indexOf("    return out_({ error: 'unknown' });");
if (a < 0 || b < 0 || b < a) throw new Error('port: doPost body anchors not found');
let body = orig.slice(a, b);
function brep(from, to) { const i = body.indexOf(from); if (i < 0) throw new Error('port: body anchor not found: ' + from.slice(0, 70)); if (body.indexOf(from, i + 1) >= 0) throw new Error('port: body anchor not unique: ' + from.slice(0, 70)); body = body.slice(0, i) + to + body.slice(i + from.length); }
/* delta pull: a browser that already holds sequence N receives only the keys saved after N */
brep("      if (admin) return out_({ keys: cur.keys, updatedAt: cur.updatedAt || 0 });\n      var res = { keys: {}, updatedAt: cur.updatedAt || 0 };",
     "      var dl = deltaPlan_(+b.since || 0);\n      if (admin) { var ak = {}; Object.keys(cur.keys).forEach(function (k) { if (!dl.delta || dl.sent(k, parseKey_(k))) ak[k] = cur.keys[k]; }); return out_({ keys: ak, updatedAt: cur.updatedAt || 0, seq: ENV.seq(), delta: dl.delta }); }\n      var res = { keys: {}, updatedAt: cur.updatedAt || 0, seq: ENV.seq(), delta: dl.delta };");
brep("var p = parseKey_(k), en = cur.keys[k]; if (!p || !en) return;\n        if (k === 'totAccessPolicy')", "var p = parseKey_(k), en = cur.keys[k]; if (!p || !en) return;\n        if (dl.delta && !dl.sent(k, p)) return;\n        if (k === 'totAccessPolicy')");
brep("if (changed) { backup_(df); cur.updatedAt = now; df.setContent(JSON.stringify(cur)); try { projDigest_(cur, false); } catch (x) {} }   /* v3.32 daily project digest */", "if (changed) { cur.updatedAt = now; }");

const out = '/* GENERATED by tools/port-code-gs.js from tool/Code.gs' + (ver ? ' (v' + ver + ')' : '') + '. Do not edit; edit the source and run:  npm run build:rules */\n\'use strict\';\n' +
  'module.exports = function createRules(ENV) {\n' +
  'var Utilities = ENV.Utilities, Session = ENV.Session, CacheService = ENV.CacheService, PropertiesService = ENV.PropertiesService, MailApp = ENV.MailApp, Logger = ENV.Logger;\n' +
  head.replace('/*__HANDLER__*/', handler.replace('/*__BODY__*/', body)) + '\n};\n';
fs.mkdirSync(path.join(__dirname, '..', 'src', 'rules'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', 'src', 'rules', 'rules.js'), out);
console.log('rules.js written (' + out.length + ' bytes) from ' + path.relative(process.cwd(), srcPath));
