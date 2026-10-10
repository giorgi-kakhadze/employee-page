#!/usr/bin/env node
'use strict';
/* Runs one of the ORIGINAL tests (tests/*.test.js) against the ported server rules. It swaps tests/fakegas.js for the adapter, then runs the test file unchanged.
   Usage: node test/parity.js sync_privacy [more...]          */
const Module = require('module'), path = require('path');
const orig = Module._resolveFilename, adapter = path.join(__dirname, 'parity-adapter.js');
Module._resolveFilename = function (req, parent, ...r) { if (parent && /[\\/]tests[\\/][^\\/]+$/.test(parent.filename) && /^\.\/fakegas(\.js)?$/.test(req)) return adapter; return orig.call(this, req, parent, ...r); };
const t = process.argv[2]; if (!t) { console.error('usage: parity.js <test-name>'); process.exit(2); }
process.argv.splice(2, 1);
require(path.join(__dirname, '..', '..', 'tests', t.replace(/\.test\.js$/, '') + '.test.js'));
