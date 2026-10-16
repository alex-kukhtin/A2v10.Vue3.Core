// The trace of the Net48 model core over the scenarios.
// Run: node test/trace/net48.js        → writes test/trace/net48.trace

'use strict';

const fs = require('fs');
const path = require('path');
const { loadNet48 } = require('../net48/load.js');
const { createRecorder } = require('./recorder.js');
const { SCENARIOS } = require('./scenarios.js');

loadNet48({ specs: false });
const appRequire = globalThis.require; // app.js's registry, not Node's

const t = createRecorder({ cmn: appRequire('std:datamodel'), period: appRequire('std:period') });
const text = t.run(SCENARIOS);

const out = path.join(__dirname, 'net48.trace');
fs.writeFileSync(out, text);
console.log(`${SCENARIOS.length} scenarios, ${text.split('\n').length} lines → ${out}`);
