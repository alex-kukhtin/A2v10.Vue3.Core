// Loads a built a2v10-core script as <script src> loads it, in a context of its own: a page. The context has
// what the bundle touches at load time and the browser globals it calls (File, performance), plus `globals`.
// errors: what console.error got.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DIST = path.join(__dirname, '../../packages/core/dist');

function loadCore(file, globals = {}) {
	const errors = [];
	const ctx = vm.createContext({
		console: { info() { }, warn() { }, log() { }, error: (...a) => errors.push(a.map(String).join(' ')) },
		document: {
			querySelector: () => null,    // modules.ts: meta rootUrl
			createElement: () => ({})     // Vue runtime-dom: its template container
		},
		File,
		performance,
		setTimeout,
		clearTimeout,
		...globals
	});
	ctx.window = ctx;
	const bundle = path.join(DIST, file);
	vm.runInContext(fs.readFileSync(bundle, 'utf8'), ctx, { filename: bundle });
	return { ctx, errors };
}

module.exports = { DIST, loadCore };
