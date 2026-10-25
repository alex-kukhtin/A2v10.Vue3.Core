// Net48 jasmine specs of the platform's shelf against the built core (a2v10-core.js, loaded as <script> loads it
// into the page): urltools (std:url), with its fixture testdata.js. The spec files are the page's, read in place.
// Run: node test/core/specs.js (after pnpm build)

'use strict';

process.env.TZ = 'Europe/Kyiv'; // as the model's specs: dates are local

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { SITE } = require('../net48/site.js');
const { bootJasmine } = require('../jasmine.js');
const { loadLocale } = require('../model/runtime.js');
const { DIST } = require('./load.js');

const SPECS = ['tests/testdata.js', 'tests/urltools.js'];

// The page: what the bundle touches at load, the locale script before it.
globalThis.window = globalThis;
globalThis.document = { querySelector: () => null, createElement: () => ({}) };
globalThis.$$locale = loadLocale();
const bundle = path.join(DIST, 'a2v10-core.js');
const consoleInfo = console.info;
console.info = () => { }; // Vue's "development build" notice
vm.runInThisContext(fs.readFileSync(bundle, 'utf8'), { filename: bundle });
console.info = consoleInfo;

const jasmine = bootJasmine();
for (const src of SPECS) {
	const file = path.join(SITE, src);
	vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
}
jasmine.run('a2v10-core.js, urltools');
