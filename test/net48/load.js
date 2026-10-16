// Loads the Net48 client scripts into the Node global, as JasmineTests.html loads them into a page.
// Read in place, never modified.

'use strict';

process.env.TZ = 'Europe/Kyiv'; // datetools asserts Kyiv DST shifts; set before the first Date

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { SITE, SPECS, pageScripts } = require('./site.js');

// What the scripts touch at load time, and nothing else.
globalThis.window = globalThis;
globalThis.document = { querySelector: () => null }; // app.js:24, meta rootUrl
globalThis.Element = function Element() { };          // polyfills.js:44

// specs: false → the platform and the model only; app.modules and require are then global.
function loadNet48({ specs }) {
	const scripts = pageScripts().filter(src => specs || !src.startsWith(SPECS));
	for (const src of scripts) {
		const file = path.join(SITE, src);
		vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
	}
	return scripts;
}

module.exports = { SITE, loadNet48 };
