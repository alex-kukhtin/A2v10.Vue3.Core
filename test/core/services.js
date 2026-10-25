// The services of the built core against their Net48 sources, side by side: the same calls on both, the same
// answers expected. Net48 (read in place) runs in a page of its own: app.js, its server platform, utils, period,
// url, routeplain, log, popup (and locale.js, const.js). Covered: std:const, std:log, std:console, std:utils' controls part (text.applyFilters,
// mapTagColor), std:store, std:popup; std:signalR against a scripted signalR (Net48's is A2v10.Core's, B31).
// Run: node test/core/services.js (after pnpm build)

'use strict';

process.env.TZ = 'Europe/Kyiv';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { SITE } = require('../net48/site.js');
const { loadLocale } = require('../model/runtime.js');
const { loadCore } = require('./load.js');

const NET48 = ['app/app.js', 'app/services/locale.js', 'app/server/platform.js', 'app/services/const.js', 'app/services/utils.js', 'app/services/period.js',
	'app/services/url.js', 'app/platform/routeplain.js', 'app/services/log.js', 'app/services/popup.js'];
const BUS_EVENTS = ['closeAllPopups', 'modalCloseAll', 'showSidePane', 'navigateto', 'closePlain', 'setnewid', 'signalEvent'];

// The browser both pages see: a console that records, sessionStorage, a body with listeners, context menus.
function browser() {
	const out = [];
	const storage = {};
	const listeners = {};
	const menus = [1, 2].map(n => ({ classList: { remove: c => out.push(`menu${n}.remove ${c}`) } }));
	const page = {
		console: {
			log: (...a) => out.push(`log ${a.join(' ')}`), info: (...a) => out.push(`info ${a.join(' ')}`),
			warn: (...a) => out.push(`warn ${a.join(' ')}`), error: (...a) => out.push(`error ${a.join(' ')}`),
			dir: (...a) => out.push(`dir ${a.join(' ')}`)
		},
		sessionStorage: {
			getItem: k => k in storage ? storage[k] : null,
			setItem: (k, v) => { storage[k] = '' + v; }
		},
		document: {
			querySelector: () => null,
			createElement: () => ({}),
			querySelectorAll: css => css === '.contextmenu' ? menus : [],
			body: { addEventListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); out.push(`body.on ${ev}`); } }
		},
		$$locale: loadLocale(),
		$$debug: false,
		performance: { now: () => 0 }
	};
	return { page, out, listeners };
}

function loadNet48() {
	const b = browser();
	const ctx = vm.createContext({ ...b.page });
	ctx.window = ctx;
	for (const src of NET48) {
		const file = path.join(SITE, src);
		vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
		if (src === 'app/server/platform.js') // a bus that records, before routeplain takes it
			ctx.app.modules['std:eventBus'] = { $emit: (e, arg) => b.out.push(`bus ${e} ${JSON.stringify(arg)}`) };
	}
	return { ...b, ctx, require: ctx.require, component: ctx.component };
}

function loadOurs(globals = {}) {
	const b = browser();
	const { ctx } = loadCore('a2v10-core.js', { ...b.page, ...globals });
	b.out.length = 0; // Vue's "development build" notice
	const bus = ctx.require('std:eventBus');
	for (const e of BUS_EVENTS)
		bus.$on(e, arg => b.out.push(`bus ${e} ${JSON.stringify(arg)}`));
	return { ...b, ctx, require: ctx.require, component: ctx.component };
}

const n48 = loadNet48();
const ours = loadOurs();

// The same thing done on both: what it returns (as JSON) and what it wrote out.
function same(label, fn) {
	const run = side => {
		side.out.length = 0;
		let value;
		try {
			value = JSON.stringify(fn(side));
		} catch (e) {
			value = `throws ${e.constructor.name}: ${e.message}`;
		}
		return { value, out: [...side.out] };
	};
	assert.deepStrictEqual(run(ours), run(n48), label);
}

// --- std:const --------------------------------------------------------------------------------------------

same('std:const', s => s.require('std:const'));

// --- std:utils: the controls' part ----------------------------------------------------------------------------

const FILTERS = [
	[[], ' x '], [null, ' x '], [['trim'], ''], [['trim'], 0], [['trim'], '  a b  '], [['upper'], 'abc'],
	[['lower'], 'ÄBC'], [['trim', 'upper'], ' abc '], [['barcode'], 'йцукен123'], [['barcode'], 'ЇЄІжэю'],
	[['fract2'], '12,345'], [['fract3'], '1.23456'], [['fract2'], 'abc'], [['fract2', 'trim'], '1.5'],
	[['eval'], '=2+3*4'], [['eval'], '=1,5*2'], [['eval'], '=alert(1)'], [['eval'], '=2+'], [['eval'], '5+5'],
	[['unknown'], 'v'], [['upper'], 123]
];
for (const [filters, value] of FILTERS)
	same(`applyFilters(${JSON.stringify(filters)}, ${JSON.stringify(value)})`, s => s.require('std:utils').text.applyFilters(filters, value));
for (const style of ['cyan', 'green', 'null', 'lightgray', 'nothing', '', undefined, null])
	same(`mapTagColor(${style})`, s => s.require('std:utils').mapTagColor(style));
assert.strictEqual(ours.require('std:utils'), ours.require('std:utils'), 'std:utils: one object');
assert.strictEqual(typeof ours.require('std:utils').text.contains, 'function', 'the model\'s text kept');

// --- std:log, std:console ----------------------------------------------------------------------------------------

same('log: error, info, warn, time; tracing off', s => {
	const log = s.require('std:log');
	log.error('e'); log.info('i'); log.warn('w'); log.time('t', 0); log.time('t', 0, true);
	return log.traceEnabled();
});
same('log: enableTrace not in debug', s => { s.require('std:log').enableTrace(true); return s.require('std:log').traceEnabled(); });
same('console: not in debug', s => { const c = s.require('std:console'); c.log('l'); c.error('e'); c.dir('d'); });
for (const side of [ours, n48]) side.ctx.$$debug = true;
same('log: enableTrace in debug; info, warn traced', s => {
	const log = s.require('std:log');
	log.enableTrace(true); log.info('i'); log.warn('w'); log.time('t', 0);
	return [log.traceEnabled(), s.ctx.sessionStorage.getItem('traceEnabled')];
});
same('console: in debug', s => { const c = s.require('std:console'); c.log('l', 1); c.info('i'); c.warn('w'); c.error('e'); c.dir('d'); });
for (const side of [ours, n48]) side.ctx.$$debug = false;
// a log created when the session has tracing on
for (const side of [ours, n48]) side.ctx.sessionStorage.setItem('traceEnabled', 'true');
same('log: tracing on in the session (a new page)', s => {
	const page = s === ours ? loadOurs() : loadNet48();
	page.ctx.sessionStorage.setItem('traceEnabled', 'true');
	const log = page.require('std:log');
	const on = log.traceEnabled();
	log.info('i');
	s.out.push(...page.out);
	return on;
});

// --- std:store --------------------------------------------------------------------------------------------

same('store helpers', s => {
	const store = s.component('std:store');
	return [
		store.replaceUrlSearch('/a/b?x=1', '?y=2'), store.replaceUrlSearch('/a/b?x=1'),
		store.replaceUrlQuery('/a/b?x=1', { y: 2, z: 'з' }), store.makeQueryString({ a: 1 }), store.parseQueryString('?a=1&b=2'),
		store.makeBackUrl('/a/b/c/d'), store.makeBackUrl('/a/b'), store.makeBackUrl('/abc'), store.makeBackUrl(''),
		typeof store.replaceBrowseUrl('/x')
	];
});
same('StoreClass: commit setroute, setnewid, navigate, close; the instance helpers', s => {
	const st = s.component('std:store').create('page');
	st.commit('setroute', '/document/edit/new');
	st.commit('setnewid', { id: 25 });
	const r1 = st.route;
	st.commit('setnewid', { id: 26, action: 'edit' });
	st.commit('navigate', { url: '/document/edit/26' });
	st.commit('close');
	return [r1, st.route, st.query, st.makeBackUrl('/a/b/c/d'), st.replaceUrlSearch('/a?b=1', '?c=2'),
		st.parseQueryString('?q=1'), st.makeQueryString({ q: 2 }), st.root];
});
same('StoreClass: an unknown commit', s => s.component('std:store').create('page').commit('setquery', {}));

// --- std:popup ---------------------------------------------------------------------------------------------

const elem = (side, name, opts = {}) => ({
	_close: target => side.out.push(`${name}._close ${target === side.ctx.document ? 'document' : target && target.name}`),
	closest: css => opts.closest && opts.closest[css] || null,
	hasAttribute: a => !!(opts.attrs && opts.attrs.includes(a)),
	querySelectorAll: () => opts.inside || [],
	name
});
same('popup: startService once, closeAll, closeInside, unregister', s => {
	const popup = s.require('std:popup');
	popup.startService();
	popup.startService();
	const a = elem(s, 'a');
	const b = elem(s, 'b');
	popup.registerPopup(a);
	popup.registerPopup(b);
	popup.closeAll();
	popup.closeInside(elem(s, 'host', { inside: [elem(s, 'in1'), { name: 'noclose' }] }));
	popup.unregisterPopup(a);
	popup.closeAll();
	return ['_close' in a, popup.closest(null, '.x')];
});
same('popup: a click, a context menu, Esc, a mouseup', s => {
	const popup = s.require('std:popup');
	const dd = elem(s, 'dd');
	popup.registerPopup(dd);
	const click = (target) => s.listeners.click.forEach(fn => fn({ target }));
	click(elem(s, 'inside', { closest: { '[dropdown-top]': dd } }));        // inside the dropdown: kept open
	click(elem(s, 'item', { closest: { '.dropdown-item': {}, '[dropdown-top]': dd } })); // an item: closes
	click(elem(s, 'outside'));                                                // outside: closes
	click(elem(s, 'marked', { attrs: ['close-dropdown'], closest: { '[dropdown-top]': dd } }));
	s.listeners.contextmenu.forEach(fn => fn({ target: elem(s, 'ctx') }));
	s.listeners.keydown.forEach(fn => fn({ which: 13, target: elem(s, 'enter') }));
	s.listeners.keydown.forEach(fn => fn({ which: 27, target: elem(s, 'esc') }));
	s.listeners.mouseup.forEach(fn => fn({}));
	popup.unregisterPopup(dd);
});
same('popup: a registered element without _close', s => {
	const popup = s.require('std:popup');
	const bad = elem(s, 'bad');
	delete bad._close;
	popup.registerPopup(bad);
	try {
		s.listeners.keydown.forEach(fn => fn({ which: 27, target: elem(s, 'esc') }));
	} finally {
		popup.unregisterPopup(bad);
	}
});

// --- std:signalR -----------------------------------------------------------------------------------------------

(async function () {
	const hub = { handlers: {}, starts: 0, fail: 1 };
	const signalR = {
		LogLevel: { Information: 2 },
		HubConnectionBuilder: class {
			withUrl(url) { hub.url = url; return this; }
			withAutomaticReconnect() { return this; }
			configureLogging(level) { hub.level = level; return this; }
			build() {
				return {
					on: (name, fn) => { hub.handlers[name] = fn; },
					start: async () => { hub.starts += 1; if (hub.fail-- > 0) throw new Error('offline'); }
				};
			}
		}
	};
	const timers = [];
	const page = loadOurs({ signalR, setTimeout: (fn, ms) => timers.push({ fn, ms }) });
	const sr = page.require('std:signalR');
	assert.deepStrictEqual([hub.url, hub.level], ['/_userhub', 2], 'the user hub, logging Information');
	hub.handlers.signal('doc.changed', { Id: 5 });
	assert.deepStrictEqual(page.out, ['bus signalEvent {"event":"doc.changed","data":{"Id":5}}'], 'a signal: signalEvent');
	page.out.length = 0;
	await sr.startService();
	assert.deepStrictEqual([hub.starts, timers.length, timers[0] && timers[0].ms], [1, 1, 5000], 'a failed start: retried in 5 s');
	await timers[0].fn();
	assert.deepStrictEqual([hub.starts, page.out], [2, ['log Error: offline', 'log SignalR Connected.']], 'the retry connects (Net48: ReferenceError, B31)');

	console.log('services: std:const, std:log, std:console, applyFilters, mapTagColor, std:store, std:popup as Net48; std:signalR');
})().catch(e => {
	console.error(e);
	process.exitCode = 1;
});
