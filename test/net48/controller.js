// Loads the Net48 page controller (controllers/base.js) into the Node global with what it stands on, in the
// order of the tabbed bundle (bundleconfig.json, Scripts/tabmain.js): Vue 2, the platform, the model, http,
// the plain store. Read in place, never modified.
// The browser and the shell are the host's: the bus, fetch, location, window.open, alert, print and std:html
// call it, so a recorder sees each one and answers for the shell.

'use strict';

process.env.TZ = 'Europe/Kyiv'; // as the model's runs: dates in a trace are local

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { SITE } = require('./site.js');

// tabmain.js's list, but for what base.js does not reach: popup, tools, accel, barcode, the components
// and directives. std:html is the host's (it is all DOM).
const SCRIPTS = [
	'scripts/vue.min.js',
	'app/localization/locale-uk.js', // the jasmine page's locale
	'app/app.js',
	'app/services/locale.js',
	'app/platform/polyfills.js',
	'app/platform/webvue.js',
	'app/services/const.js',
	'app/services/utils.js',
	'app/services/url.js',
	'app/services/period.js',
	'app/services/modelinfo.js',
	'app/services/http.js',
	'app/platform/routeplain.js',
	'app/services/log.js',
	'app/services/validators.js',
	'app/services/impl/array.js',
	'app/services/datamodel.js',
	'app/services/dataservice.js',
	'app/services/mask.js',
	'app/services/routing.js',
	'app/components/doctitleplain.js',
	'app/controllers/base.js'
];
// webvue.js sets the bus; routeplain.js and dataservice.js (through http.js) take it at load.
const BUS_AFTER = 'app/platform/webvue.js';

// The bus as webvue.js's `new Vue({})` behaves: $on/$off/$emit, a listener's throw logged, not passed on.
// Each emit is told to the host first; the host answers for the shell, then runs the listeners (dispatch).
function createBus(host) {
	let listeners = new Map();
	return {
		$on(event, fn) {
			for (const e of [].concat(event)) {
				if (!listeners.has(e)) listeners.set(e, []);
				listeners.get(e).push(fn);
			}
			return this;
		},
		$off(event, fn) {
			const list = listeners.get(event);
			if (!list) return this;
			if (!fn) {
				listeners.delete(event);
				return this;
			}
			const i = list.lastIndexOf(fn); // Vue 2 removes the last one
			if (i !== -1) list.splice(i, 1);
			return this;
		},
		$emit(event, ...args) {
			host.emit(event, args, () => {
				for (const fn of [...(listeners.get(event) || [])]) {
					try {
						fn(...args);
					} catch (e) {
						console.error(e); // Vue 2: invokeWithErrorHandling → console.error
					}
				}
			});
			return this;
		},
		// For the recorder: the listeners by event, and a fresh start between scenarios.
		counts() {
			const rv = {};
			for (const [e, list] of [...listeners].sort((a, b) => a[0] < b[0] ? -1 : 1))
				if (list.length) rv[e] = list.length;
			return rv;
		},
		reset() {
			listeners = new Map();
		}
	};
}

// host: { emit(event, args, dispatch), fetch(url, init) → Promise<Response>, call(name, args) → answer }.
function loadNet48Controller(host) {
	const location = {
		pathname: '/', search: '', // the shell's page: url.js reads it for the current url
		assign(url) { host.call('location.assign', [url]); }
	};
	globalThis.window = globalThis;
	globalThis.document = {
		querySelector: () => null,               // app.js: meta rootUrl
		createEvent: () => ({ timeStamp: 0 }),   // Vue 2 at load: the event time stamp check
		createElement: () => ({ innerHTML: '' }) // Vue 2 at load: the attribute newline decoding check
	};
	globalThis.Element = function Element() { }; // polyfills.js
	globalThis.fetch = (url, init) => host.fetch(url, init);
	globalThis.open = (url, target) => host.call('window.open', [url, target]) ?? null;
	globalThis.alert = msg => { host.call('alert', [msg]); };
	globalThis.print = () => { host.call('window.print', []); };
	Object.defineProperty(globalThis, 'location', {
		configurable: true,
		get: () => location,
		set: url => { host.call('location =', [url]); }
	});

	let bus = null;
	for (const src of SCRIPTS) {
		const file = path.join(SITE, src);
		vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
		if (src === BUS_AFTER) {
			bus = createBus(host);
			app.modules['std:eventBus'] = bus;
			app.modules['std:html'] = new Proxy({}, {
				get: (_, k) => typeof k === 'string' ? (...args) => host.call(`html.${k}`, args) : undefined
			});
		}
	}
	return { appRequire: globalThis.require, Vue: globalThis.Vue, DataModelController: app.components['baseController'], bus };
}

module.exports = { loadNet48Controller };
