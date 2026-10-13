'use strict';
/* Microsoft Dynamics 365 as the HR source: the server signs in to Dynamics itself (the secret never reaches the browser) and returns the people in the columns the import understands. A fake Dynamics runs here. */
const http = require('http');
const { ok, section, done, sample } = require('./util'); const { start } = require('./lib');
(async () => {
  const seen = { token: 0, data: [], auth: [], body: '' };
  const D = http.createServer((req, res) => {
    let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => {
      const port = D.address().port, base = 'http://127.0.0.1:' + port;
      if (req.method === 'POST' && /\/oauth2\/v2\.0\/token$/.test(req.url)) { seen.token++; seen.body = b; const p = new URLSearchParams(b); if (p.get('client_secret') !== 'S3CR3T' || p.get('client_id') !== 'cid') { res.writeHead(401, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: 'invalid_client', error_description: 'AADSTS7000215: Invalid client secret provided.' })); } res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ access_token: 'TOK123', expires_in: 3600 })); }
      seen.data.push(req.url); seen.auth.push(req.headers.authorization);
      if (req.headers.authorization !== 'Bearer TOK123') { res.writeHead(401, { 'content-type': 'application/json' }); return res.end('{"error":{"message":"no"}}'); }
      if (/^\/data\/Workers\?\$top=5000$/.test(req.url)) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ value: [{ PersonnelNumber: '000123', Name: 'Ana Beridze', PrimaryContactEmail: 'ana@x.com', EmploymentStartDate: '2024-03-01T00:00:00Z', EmploymentEndDate: '2154-12-31T00:00:00Z', Position: 'Game Presenter', Junk: { a: 1 } }, { PersonnelNumber: '000124', Name: 'Dato Lomidze', EmploymentStartDate: '2023-01-10T00:00:00Z', EmploymentEndDate: '2025-06-30T00:00:00Z' }], '@odata.nextLink': base + '/data/Workers?page=2' })); }
      if (req.url === '/data/Workers?page=2') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ value: [{ PersonnelNumber: '000125', Name: 'Mariam Kiknadze', PrimaryContactEmail: 'mariam@x.com', EmploymentStartDate: '1900-01-01T00:00:00Z' }], '@odata.nextLink': 'http://evil.example/steal' })); }
      if (/^\/data\/Empty/.test(req.url)) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{"value":[{"Foo":"x"}]}'); }
      res.writeHead(404, { 'content-type': 'application/json' }); res.end('{"error":{"message":"Resource not found for the segment"}}'); }); });
  await new Promise((r) => D.listen(0, '127.0.0.1', r)); const base = 'http://127.0.0.1:' + D.address().port;
  Object.assign(process.env, { PTF_DYN_TENANT: '11111111-2222-3333-4444-555555555555', PTF_DYN_CLIENT_ID: 'cid', PTF_DYN_SECRET: 'S3CR3T', PTF_DYN_RESOURCE: base, PTF_DYN_LOGIN_URL: base, PTF_DYN_ALLOW_HTTP: '1' });
  const S = await start({}); await S.state.replaceAll({ keys: sample() }); const ana = await S.client('ana@x.com'), mgr = await S.client('mgr@x.com'), boss = await S.client('boss@x.com', { admin: true });
  section('1. Who may ask');
  let r = await ana.post('/api/hr/dynamics', { mode: 'preview' }); ok('an employee is refused', r.status === 403, r.status);
  r = await mgr.post('/api/hr/dynamics', { mode: 'preview' }); ok('a manager may ask', r.status === 200, r.status);
  r = await fetch(S.base + '/api/hr/dynamics', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }); ok('without signing in it is refused', r.status === 401 || r.status === 403 || r.status === 302, r.status);
  r = await boss.post('/api/hr/dynamics', { mode: 'preview' }, { 'x-ptf-csrf': 'wrong' }); ok('a request without the right CSRF header is refused', r.status === 403, r.status);
  section('2. Show fields (preview)');
  let j = await (await boss.post('/api/hr/dynamics', { mode: 'preview' })).json();
  ok('preview signs in with the client credentials and lists the first page only', j.ok && j.count === 2 && seen.token >= 1 && !seen.data.some((u) => /page=2/.test(u)), JSON.stringify(j).slice(0, 200));
  ok('the field names of Dynamics are shown, nested objects are not expanded', j.keys.indexOf('PersonnelNumber') >= 0 && j.sample[0].Junk === '(object)', JSON.stringify(j.sample[0]));
  ok('the token request used the secret, the browser never saw it', /client_secret=S3CR3T/.test(seen.body) && !JSON.stringify(j).includes('S3CR3T'));
  section('3. Pull the people');
  j = await (await boss.post('/api/hr/dynamics', { mode: 'pull' })).json();
  ok('all pages are read (3 people) and the other host in a next-link is NOT followed', j.ok && j.count === 3 && !seen.data.some((u) => /steal/.test(u)), JSON.stringify(j).slice(0, 300));
  ok('columns are in the import format: Full Name, HR ID, Email Address, Start Date, End Date, Position, Status', JSON.stringify(j.data[0]) === JSON.stringify(['Full Name', 'HR ID', 'Email Address', 'Start Date', 'End Date', 'Position', 'Status']), JSON.stringify(j.data[0]));
  ok('values: ID and name, date without time, "no end date" (2154) and 1900 dates are empty', JSON.stringify(j.data[1]) === JSON.stringify(['Ana Beridze', '000123', 'ana@x.com', '2024-03-01', '', 'Game Presenter', 'Employed']) && j.data[3][3] === '', JSON.stringify(j.data.slice(1)));
  ok('a person whose end date has passed is "Terminated"', j.data[2][6] === 'Terminated' && j.data[2][4] === '2025-06-30', JSON.stringify(j.data[2]));
  ok('every request to Dynamics carried the bearer token', seen.auth.every((a) => a === 'Bearer TOK123'));
  section('4. Problems are explained, without secrets');
  const keep = process.env.PTF_DYN_SECRET; process.env.PTF_DYN_SECRET = 'wrong'; j = await (await boss.post('/api/hr/dynamics', { mode: 'pull' })).json();
  ok('a wrong secret: "sign-in failed" with the Microsoft reason, secret not repeated', /sign-in failed/.test(j.error) && /Invalid client secret/.test(j.error) && !/wrong/.test(j.error.replace('Invalid client secret', '')), j.error); process.env.PTF_DYN_SECRET = keep;
  process.env.PTF_DYN_PATH = '/data/Missing'; j = await (await boss.post('/api/hr/dynamics', { mode: 'pull' })).json(); ok('a wrong path: the answer of Dynamics is shown', /404/.test(j.error) && /not found/i.test(j.error), j.error);
  process.env.PTF_DYN_PATH = '/data/Empty'; j = await (await boss.post('/api/hr/dynamics', { mode: 'pull' })).json(); ok('records without a name or ID field: tells to use Show fields / DYN_MAP', /DYN_MAP/.test(j.error), j.error);
  process.env.PTF_DYN_MAP = JSON.stringify({ 'Full Name': 'Foo', 'HR ID': ['Foo'] }); j = await (await boss.post('/api/hr/dynamics', { mode: 'pull' })).json(); ok('DYN_MAP changes which Dynamics field fills a column', j.ok && j.data[1][0] === 'x' && j.data[1][1] === 'x', JSON.stringify(j).slice(0, 160)); delete process.env.PTF_DYN_MAP; delete process.env.PTF_DYN_PATH;
  delete process.env.PTF_DYN_SECRET; j = await (await boss.post('/api/hr/dynamics', { mode: 'pull' })).json(); ok('not set up: says what to set', /not set up/.test(j.error) && /PTF_DYN_SECRET/.test(j.error), j.error); process.env.PTF_DYN_SECRET = keep;
  section('5. Audit');
  const A = await (await boss.get('/api/admin/audit')).text(); ok('every pull is written to the audit log (who, what, how many) without the secret', /hr\.dynamics\.pull/.test(A) && /3 records/.test(A) && !/S3CR3T/.test(A), A.slice(-300));
  await S.close(); D.close(); done();
})();
