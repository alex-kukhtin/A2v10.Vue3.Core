// The runtime the tests give the built core: the server adapter's shape (server/platform.js), and the
// locale of the Net48 jasmine page. The locale file runs in a sandbox of its own: the test global has
// no `window`, so a core that reached for one would fail here, not pass by accident.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { SITE } = require('../net48/site.js');

const LOCALE = path.join(SITE, 'app/localization/locale-uk.js'); // the page's locale

function loadLocale() {
	const sandbox = {};
	vm.runInNewContext(fs.readFileSync(LOCALE, 'utf8'), { window: sandbox }, { filename: LOCALE });
	return sandbox.$$locale;
}

function serverRuntime(locale) {
	return {
		platform: {
			set(target, prop, value) { target[prop] = value; },
			defer(fn) { fn(); },
			File: function () { return this; },
			performance: { now: () => 0 }
		},
		eventBus: { $emit() { } },
		locale
	};
}

module.exports = { loadLocale, serverRuntime };
