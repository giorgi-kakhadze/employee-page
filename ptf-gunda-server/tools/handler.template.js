/* ===== server handler (hand-written; the permission rules above and the pull / push body below are from Code.gs) ===== */
var FULL_KEYS = ['totAccessPolicy', 'totAccessGrants', 'totSites'];   /* when one of these changed, what each person may see changed too: send everything */
var DEPEND_KEYS = SCOPED.concat(['totTeams']);                       /* record filters depend on these: when one changed, re-send all filtered keys */
function deltaPlan_(since) {
  if (!(since > 0)) return { delta: false, sent: function () { return true; } };
  var full = false, scoped = false, seqOf = ENV.seqOf();
  Object.keys(seqOf).forEach(function (k) { if (seqOf[k] <= since) return; var q = parseKey_(k); if (!q) return; if (FULL_KEYS.indexOf(q.name) >= 0) full = true; if (DEPEND_KEYS.indexOf(q.name) >= 0) scoped = true; });
  if (full || since > ENV.seq()) return { delta: false, sent: function () { return true; } };
  return { delta: true, sent: function (k, q) { if ((seqOf[k] || 0) > since) return true; if (scoped && q && (SCOPED.indexOf(q.name) >= 0 || q.name === 'auditLog' || q.name === 'totJournal')) return true; return false; } };
}
/* handle(b, id, cur): b is the request body, id the verified identity { email, name, admin }, cur the live data.
   Returns the JSON answer. Actions that change data (push, reqNew, reqCancel) must be called inside State.mutate. */
function handle(b, id, cur) {
  ENV.id = id; ENV.state = { cur: cur };
  try {
    if (!b || typeof b !== 'object' || Array.isArray(b)) return { error: 'bad request' };
    var act = b.action, admin = !!id.admin, em = String(id.email || '').trim().toLowerCase();
    cur.keys = cur.keys || {};
    if (act === 'me') return out_(me_(''));
    if (act === 'reqNew') return out_(reqNew_(b));
    if (act === 'reqCancel') return out_(reqCancel_(b));
    if (act === 'login') { var who0 = admin ? { role: 'admin' } : whoIs_(cur, em); return { status: admin || who0.role ? 'approved' : 'pending' }; }
    if (act === 'video') {   /* resumable upload in pieces; private to the owner */
      if (!admin) { var mv = whoIs_(cur, em); if (!accCaps_(accA_(cur), em, mv.role, capsFor_(cur, mv.role)).videos_upload) return { error: 'not allowed' }; }
      var up = String(b.up || '').replace(/[^\w]/g, '').slice(0, 40), i = +b.i, n = +b.n, size = +b.size;
      if (!up || !(size > 0) || size > 41943040 || !(n >= 1) || !(i >= 0) || i >= n) return { error: 'bad upload' };
      var mime = /^video\//.test(String(b.mime || '')) ? String(b.mime) : 'video/mp4';
      return ENV.files.chunk({ up: 'v' + up, i: i, n: n, size: size, mime: mime, name: String(b.name || 'video').slice(0, 100), owner: em, kind: 'video', data: String(b.data || '') });
    }
    var me = admin ? null : whoIs_(cur, em); if (me) { me.acc = accA_(cur); me.caps = accCaps_(me.acc, em, me.role, capsFor_(cur, me.role)); }
    if (act === 'videoGet') {   /* only people with the "Watch evaluation videos" tick */
      if (!(admin || (me && me.caps && me.caps.videos_view))) return { error: 'not allowed' };
      var vid = String(b.id || ''); if (!/^[\w-]+$/.test(vid)) return { error: 'bad id' };
      var vf = ENV.files.info(vid); if (!vf || vf.kind !== 'video') return { error: 'gone' };
      var rd = ENV.files.read(vid, Math.max(0, +b.i || 0)); if (!rd) return { error: 'bad range' };
      return { ok: true, n: rd.n, mime: vf.mime, data: rd.data };
    }
/*__BODY__*/
    return { error: 'unknown' };
  } catch (ex) { try { Logger.log('handle: ' + (ex && ex.stack || ex)); } catch (x) {} return { error: 'server error' }; }
}
/* the daily project e-mail (07:00) */
function runDigest(cur, id) { ENV.id = id || { email: '', name: '' }; ENV.state = { cur: cur }; return projDigest_(cur, false); }
return { handle: handle, runDigest: runDigest, parseKey_: parseKey_, whoIs_: whoIs_, ctx_: ctx_, policy_: policy_ };
