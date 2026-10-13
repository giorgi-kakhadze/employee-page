'use strict';
/* E-mail: the rule code calls MailApp.sendEmail, which only puts the message in the outbox table. A worker sends it (Microsoft Graph in production),
   retries with growing delay, and gives up after 6 tries. A slow or broken mail service therefore never slows down a save. */
const https = require('https'), { URL } = require('url');
function req(method, url, headers, body) {
  return new Promise((res, rej) => { const u = new URL(url), r = https.request({ method, hostname: u.hostname, path: u.pathname + u.search, timeout: 15000, headers }, (s) => { let d = ''; s.on('data', c => { d += c; }); s.on('end', () => res({ status: s.statusCode, text: d })); }); r.on('error', rej).on('timeout', () => r.destroy(new Error('timeout'))); r.end(body); });
}
function graphTransport(m) {
  let tok = null, exp = 0;
  async function token() {
    if (tok && Date.now() < exp - 60e3) return tok;
    const body = new URLSearchParams({ client_id: m.clientId, client_secret: m.clientSecret, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' }).toString();
    const r = await req('POST', 'https://login.microsoftonline.com/' + m.tenant + '/oauth2/v2.0/token', { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }, body);
    const j = JSON.parse(r.text); if (!j.access_token) throw new Error('graph token failed'); tok = j.access_token; exp = Date.now() + (j.expires_in || 3000) * 1000; return tok;
  }
  return async (to, subject, text) => {
    const body = JSON.stringify({ message: { subject, body: { contentType: 'Text', content: text }, toRecipients: [{ emailAddress: { address: to } }] }, saveToSentItems: false });
    const r = await req('POST', 'https://graph.microsoft.com/v1.0/users/' + encodeURIComponent(m.from) + '/sendMail', { Authorization: 'Bearer ' + await token(), 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, body);
    if (r.status !== 202) throw new Error('graph ' + r.status + ' ' + r.text.slice(0, 120));
  };
}
module.exports = function mail(db, cfg, sent) {
  const transport = cfg.mail.transport === 'graph' ? graphTransport(cfg.mail) : async (to, subject, text) => { if (sent) sent.push({ to, subject, text }); else if (!cfg.prod) console.log('[mail:log] to=' + to + ' subject=' + subject); };
  let pending = [];
  return {
    enqueue(to, subject, body) { pending.push([Date.now(), String(to).slice(0, 200), String(subject).slice(0, 300), String(body).slice(0, 20000)]); },
    async flushQueue() { const p = pending; pending = []; for (const r of p) await db.q('INSERT INTO outbox(ts,to_addr,subject,body) VALUES(?,?,?,?)', r).catch(e => { console.error('[mail] queue failed', e.message); }); },
    async work() {
      await this.flushQueue();
      const rows = await db.q(`SELECT * FROM outbox WHERE status IN ('queued','sending') AND next_at<=? ORDER BY id LIMIT 20`, [Date.now()]); let ok = 0;
      for (const r of rows) {
        const got = await db.q(`UPDATE outbox SET status='sending', next_at=? WHERE id=? AND status IN ('queued','sending') AND next_at<=? RETURNING id`, [Date.now() + 300e3, r.id, Date.now()]); if (!got.length) continue;   // another instance took it
        try { await transport(r.to_addr, r.subject, r.body); await db.q(`UPDATE outbox SET status='sent', tries=tries+1, err=NULL WHERE id=?`, [r.id]); ok++; }
        catch (e) { const t = Number(r.tries) + 1; await db.q(`UPDATE outbox SET tries=?, status=?, next_at=?, err=? WHERE id=?`, [t, t >= 6 ? 'failed' : 'queued', Date.now() + Math.min(3600e3, 30e3 * Math.pow(3, t)), String(e.message).slice(0, 200), r.id]); }
      }
      return ok;
    },
    async cleanup() { await db.q(`DELETE FROM outbox WHERE status IN ('sent','failed') AND ts < ?`, [Date.now() - 30 * 864e5]); }
  };
};
