// The trace of the port of base.js (the controller of @a2v10/platform, inside the built a2v10-core.js) over the
// page scenarios, compared with Net48's (base.net48.trace) section by section, but for the divergences of
// divergences.js ('page'). A page is mounted as include
// mounts it (pageComponent: the controller created over the reactive root, its life in Vue 2's order), by a
// renderer of Vue's own over plain objects: no DOM. The scenarios drive it as they drive base.js.
// Run: node test/trace/base.port.js        → writes test/trace/base.port.trace; prints the sections that differ

'use strict';

process.env.TZ = 'Europe/Kyiv'; // as the Net48 run: dates in the trace are local

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadLocale } = require('../model/runtime.js');
const { DIST } = require('../core/load.js');
const { createPageRecorder } = require('./page.js');
const { PAGES } = require('./pages.js');
const { DIVERGENCES, expectedTrace } = require('./divergences.js');

const pr = createPageRecorder();
const host = pr.host;

// The page the core runs in: what it touches at load, and the browser's calls, told to the host.
const location = { pathname: '/', search: '', assign(url) { host.call('location.assign', [url]); } };
globalThis.window = globalThis;
globalThis.document = { querySelector: () => null, createElement: () => ({}) };
globalThis.$$locale = loadLocale();
globalThis.fetch = (url, init) => host.fetch(url, init);
globalThis.open = (url, target) => host.call('window.open', [url, target]) ?? null;
globalThis.alert = msg => { host.call('alert', [msg]); };
globalThis.print = () => { host.call('window.print', []); };
Object.defineProperty(globalThis, 'location', { configurable: true, get: () => location, set: url => { host.call('location =', [url]); } });

const bundle = path.join(DIST, 'a2v10-core.js');
const consoleInfo = console.info;
console.info = () => { }; // Vue's "development build" notice
vm.runInThisContext(fs.readFileSync(bundle, 'utf8'), { filename: bundle });
console.info = consoleInfo;

const { platform } = globalThis.a2v10;
const { Vue } = platform;
const appRequire = globalThis.require; // app.js's registry, not Node's

// std:html is the host's (not ported yet: step B4); the bus tells the host first, as Net48's harness's did.
app.modules['std:html'] = new Proxy({}, {
	get: (_, k) => typeof k === 'string' ? (...args) => host.call(`html.${k}`, args) : undefined
});
const bus = appRequire('std:eventBus');
const emit = bus.$emit;
bus.$emit = (event, ...args) => {
	host.emit(event, args, () => emit(event, ...args));
	return bus;
};

// A renderer over plain objects: what Vue needs to mount a page without a document.
function createNodeOps() {
	const remove = child => {
		const p = child.parentNode;
		if (!p) return;
		const i = p.children.indexOf(child);
		if (i >= 0) p.children.splice(i, 1);
		child.parentNode = null;
	};
	const element = tag => {
		const el = {
			tag, children: [], attrs: {}, parentNode: null, text: '',
			getAttribute: n => n in el.attrs ? el.attrs[n] : null,
			setAttribute: (n, v) => { el.attrs[n] = '' + v; },
			classList: { contains: c => (el.attrs.class || '').split(/\s+/).includes(c) }
		};
		return el;
	};
	return {
		insert(child, parent, anchor) {
			remove(child);
			const i = anchor ? parent.children.indexOf(anchor) : -1;
			if (i >= 0) parent.children.splice(i, 0, child);
			else parent.children.push(child);
			child.parentNode = parent;
		},
		remove,
		createElement: element,
		createText: text => ({ text, parentNode: null }),
		createComment: text => ({ comment: text, parentNode: null }),
		setText(node, text) { node.text = text; },
		setElementText(el, text) { el.children = []; el.text = text; },
		parentNode: node => node.parentNode,
		nextSibling(node) {
			const p = node.parentNode;
			if (!p) return null;
			return p.children[p.children.indexOf(node) + 1] || null;
		},
		patchProp(el, key, prev, next) {
			if (next == null) delete el.attrs[key];
			else el.attrs[key] = next;
		}
	};
}

const renderer = Vue.createRenderer(createNodeOps());
const controllers = new WeakMap();

// A page as include mounts it: the scenario's root as the descriptor's model. The scenarios reach a Vue 2 page:
// its data and methods are the component's; what was base.js's own ($caller, __currentToken__, …) is the
// controller's; $destroy is the app's unmount; $emit('cwChange') was the page's own event (collection-view).
function mount(root, { url, inDialog = false, isIndex = false, isSkipDataStack = false }) {
	const descriptor = { baseUrl: url, inDialog, isIndex, isSkipDataStack, createModel: () => root };
	const def = platform.pageComponent({ url, template: '<div></div>', descriptor }, () => { });
	const app = renderer.createApp(def);
	app.config.errorHandler = (err, _instance, info) => { console.error(`Error in ${info}:`, err); }; // the platform's attach
	const page = app.mount({ tag: 'root', children: [], attrs: {}, parentNode: null });
	const ctrl = page.$.provides.$page;
	const adapter = new Proxy(page, {
		get(target, k) {
			if (k === '$destroy') return () => app.unmount();
			if (k === '$emit') return (e, ...a) => e === 'cwChange' ? ctrl.__cwChange(...a) : target.$emit(e, ...a);
			if (typeof k === 'string' && !(k in target) && k in ctrl) return ctrl[k];
			return target[k];
		}
	});
	controllers.set(adapter, ctrl);
	return adapter;
}

pr.attach({
	cmn: appRequire('std:datamodel'), period: appRequire('std:period'), utils: appRequire('std:utils'),
	bus: { $emit: (e, ...a) => bus.$emit(e, ...a), counts: () => bus.__counts__(), reset() { } },
	mount,
	isPage: v => v instanceof platform.Controller,
	pageOf: v => controllers.get(v),
	raw: v => Vue.toRaw(v)
});

// Sections of a trace: '## title' and its lines.
function sections(text) {
	const rv = new Map();
	for (const part of text.replace(/\r\n/g, '\n').split(/\n(?=## )/)) {
		const nl = part.indexOf('\n');
		rv.set(part.substring(0, nl).trim(), part.substring(nl + 1));
	}
	return rv;
}

pr.api.run(PAGES).then(text => {
	fs.writeFileSync(path.join(__dirname, 'base.port.trace'), text);
	const net48 = sections(expectedTrace(fs.readFileSync(path.join(__dirname, 'base.net48.trace'), 'utf8'), 'page'));
	const port = sections(text);
	let equal = 0;
	const lines = [];
	for (const [title, body] of net48) {
		const mine = port.get(title);
		if (mine === body) {
			equal += 1;
			lines.push(`  =  ${title}`);
			continue;
		}
		const a = body.split('\n');
		const b = (mine || '').split('\n');
		const at = a.findIndex((l, i) => l !== b[i]);
		lines.push(`  ≠  ${title}\n       line ${at + 1}: net48 ${JSON.stringify(a[at] ?? '<end>')}\n                port  ${JSON.stringify(b[at] ?? '<end>')}`);
	}
	const divergences = DIVERGENCES.filter(d => d.trace === 'page').length;
	process.stdout.write(`${lines.join('\n')}\n${equal} of ${net48.size} sections equal to Net48 but for ${divergences} divergences\n`);
}, e => {
	process.stderr.write(`${e.stack || e}\n`);
	process.exitCode = 1;
});
