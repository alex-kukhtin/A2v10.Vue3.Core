// Net48 jasmine specs against the built core (dist/a2v10-model.js, loaded as <script> loads it).
// The spec files are the page's, read in place and unchanged; only the registry they require from
// differs: here it maps std:* to what createModel returned, as the platform will.
// Run: node test/model/specs.js [name ...]   (names: utils, datetools, …; default: all)

'use strict';

process.env.TZ = 'Europe/Kyiv'; // datetools asserts Kyiv DST shifts; set before the first Date

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { SITE, SPECS, pageScripts } = require('../net48/site.js');
const { bootJasmine } = require('../jasmine.js');
const { loadModelBundle } = require('./load.js');
const { loadLocale, serverRuntime } = require('./runtime.js');

// Specs of modules outside the model core shelf.
const NOT_CORE = [
	'tests/urltools.js' // url.js: the platform's shelf
];
const FIXTURE = 'tests/testdata.js';

const only = process.argv.slice(2);
const specs = pageScripts()
	.filter(src => src.startsWith(SPECS) && !NOT_CORE.includes(src))
	.filter(src => src === FIXTURE || !only.length || only.includes(path.basename(src, '.js')));

const locale = loadLocale();
const core = loadModelBundle().createModel(serverRuntime(locale));

const app = {
	modules: {
		'std:locale': locale,
		'std:utils': core.utils,
		'std:period': core.period,
		'std:validators': core.validators,
		'std:modelInfo': core.modelInfo,
		'std:datamodel': core.datamodel
	}
};
globalThis.app = app;
// As app.js: an unknown name throws. A listed one the core does not export yet is undefined, so the
// fixture (testdata.js requires std:datamodel at load) loads while the port is partial.
globalThis.require = function (name) {
	if (!(name in app.modules)) throw new Error(`module "${name}" not found`);
	return app.modules[name];
};

const jasmine = bootJasmine();
for (const src of specs) {
	const file = path.join(SITE, src);
	vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
}
jasmine.run(`package, ${specs.filter(s => s !== FIXTURE).map(s => path.basename(s, '.js')).join(' ')}`);
