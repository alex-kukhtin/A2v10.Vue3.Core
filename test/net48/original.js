// Net48 jasmine specs against the Net48 sources, in Node.
// Run: node test/net48/original.js

'use strict';

const { loadNet48 } = require('./load.js');
const { bootJasmine } = require('../jasmine.js');

const jasmine = bootJasmine();
const scripts = loadNet48({ specs: true });
jasmine.run(`net48, ${scripts.length} scripts`);
