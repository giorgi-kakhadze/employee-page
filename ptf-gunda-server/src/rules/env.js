'use strict';
/* The small set of Google Apps Script services the rule code still touches, implemented in Node. */
const crypto = require('crypto');
module.exports = function makeEnv(o) {
  const tz = o.tz || 'UTC', cache = new Map(), props = o.props || {}, mails = [];
  const fmt = (d, pat) => {
    const p = {}; new Intl.DateTimeFormat('en-GB', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(d).forEach(x => { p[x.type] = x.value; });
    const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+p.month - 1];
    return pat.replace('yyyy', p.year).replace('MMM', mon).replace('MM', p.month).replace('dd', p.day).replace('HH', p.hour).replace('mm', p.minute);
  };
  const env = {
    salt: o.salt || 'ptf-salt', files: o.files, id: null, state: null,
    seq: () => o.seq ? o.seq() : 0, seqOf: () => o.seqOf ? o.seqOf() : {},
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: (a, s) => Array.from(crypto.createHash('sha256').update(s, 'utf8').digest()).map(b => b > 127 ? b - 256 : b),
      formatDate: (d, _tz, pat) => fmt(new Date(d), pat),
      base64Decode: (s) => Buffer.from(s, 'base64'), base64Encode: (b) => Buffer.from(b).toString('base64')
    },
    Session: { getScriptTimeZone: () => tz },
    CacheService: { getScriptCache: () => ({
      get: (k) => { const e = cache.get(k); if (!e) return null; if (e.x < Date.now()) { cache.delete(k); return null; } return e.v; },
      put: (k, v, sec) => { cache.set(k, { v, x: Date.now() + (sec || 600) * 1000 }); if (cache.size > 5000) for (const [kk, e] of cache) if (e.x < Date.now()) cache.delete(kk); },
      remove: (k) => { cache.delete(k); } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] == null ? null : props[k], setProperty: (k, v) => { props[k] = v; if (o.onProp) o.onProp(k, v); } }) },
    MailApp: { sendEmail(to, subject, body) { mails.push({ to, subject, body }); if (o.onMail) o.onMail(to, subject, body); } },
    Logger: { log: (m) => (o.log || console.error)(String(m)) }
  };
  env.mails = mails; env.cache = cache; env.props = props;
  return env;
};
