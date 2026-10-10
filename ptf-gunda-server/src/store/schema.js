'use strict';
/* Schema. Created on start (idempotent). version is kept in meta so later releases can migrate. */
module.exports = function ddl(d) {
  return [
    `CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL, t BIGINT NOT NULL, seq BIGINT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS kv_seq ON kv(seq)`,
    `CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL, seq BIGINT NOT NULL DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, email TEXT NOT NULL, name TEXT, admin INTEGER NOT NULL DEFAULT 0, csrf TEXT NOT NULL, created BIGINT NOT NULL, last BIGINT NOT NULL, expires BIGINT NOT NULL, ip TEXT, ua TEXT)`,
    `CREATE INDEX IF NOT EXISTS sessions_email ON sessions(email)`,
    `CREATE TABLE IF NOT EXISTS audit (id ${d.idCol}, ts BIGINT NOT NULL, actor TEXT, action TEXT NOT NULL, detail TEXT, ip TEXT, prev TEXT, hash TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS outbox (id ${d.idCol}, ts BIGINT NOT NULL, to_addr TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued', tries INTEGER NOT NULL DEFAULT 0, next_at BIGINT NOT NULL DEFAULT 0, err TEXT)`,
    `CREATE TABLE IF NOT EXISTS prefs (email TEXT PRIMARY KEY, v TEXT NOT NULL, t BIGINT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS files (id TEXT PRIMARY KEY, name TEXT, mime TEXT, size BIGINT, owner TEXT, kind TEXT, created BIGINT NOT NULL)`
  ];
};
