// Records what a page controller does, as text, on top of the model recorder (recorder.js): every bus event
// with its arguments and the shell's answer, every request with its body and the server's answer, the calls
// to the browser (window.open, location, alert, print, std:html), console errors, throws, how a returned
// promise ends (resolved, rejected, or still pending once the queues are empty), and the model's events.
// Controller-agnostic: a runner gives it the loaded core and how a page is mounted (env.mount), so the same
// scenarios run on the Net48 base.js and on its port.
//
// The trace speaks the Net48 bus: an event name is the shell's contract (contract 4). A port that calls the
// shell another way logs each call under the event it replaces.

'use strict';

const { createRecorder, ABORTED } = require('./recorder.js');

// How long an operation's effects may run: until this many turns of the event loop pass. Requests here
// answer at once; the turns cover fetch's body, the then-chains and Vue's nextTick.
const DRAIN_TURNS = 50;

function createPageRecorder() {
	let rec = null;
	let env = null;
	let routes = {};  // the section's server: 'METHOD url' → response spec, or (body) → response spec
	let answers = {}; // the section's shell and browser: event or call name → value, or (...args) → value
	const pages = [];
	const names = new Map(); // view model → its name in the scenario
	const roots = new Map(); // root → its page's name: with two pages, a model event says whose it is
	let mounting = null;     // the name of the page being mounted: its view model speaks before mount returns
	const dataStack = [];    // the shell's, as registerData keeps it

	// --- the shell -------------------------------------------------------------------------------
	// As the tabbed shell answers (A2v10.Core: Web/A2v10.Core.Web.Site/Scripts/shell.js). A dialog's promise
	// resolves with what it closes with, and only when that is truthy (_eventModalClose: closeImpl): Cancel
	// leaves it pending. Undefined: the event has no answer to write.

	function answer(name, ...args) {
		const a = answers[name];
		return typeof a === 'function' ? a(...args) : a;
	}

	function settle(dlgData, result) {
		dlgData.promise = result ? Promise.resolve(result) : new Promise(() => { });
		return result;
	}

	const SHELL = {
		// _eventConfirm: confirm, alert and message boxes; OK unless the scenario says otherwise
		confirm: dlgData => settle(dlgData, answer('confirm', dlgData.data) ?? true),
		// showModal: a dialog page; it closes with the scenario's answer, or never
		modal: (url, dlgData) => settle(dlgData, answer('modal', url, dlgData) ?? null),
		registerData(component, out) {
			if (component) {
				if (dataStack.length > 0)
					out.caller = dataStack[0];
				dataStack.unshift(component);
				return out.caller;
			}
			if (dataStack.length > 1)
				dataStack.shift();
			return undefined;
		},
		activeTabUrl(s) {
			const url = answer('activeTabUrl');
			if (url !== undefined) s.url = url;
			return url;
		}
	};

	// --- the host the loader wires the browser to ------------------------------------------------

	function emit(event, args, dispatch) {
		const text = `bus ${event}(${args.map(x => rec.fmt(x)).join(', ')})`;
		const rv = SHELL[event] ? SHELL[event](...args) : undefined;
		rec.write(rv === undefined ? text : `${text} → ${rec.fmt(rv)}`);
		rec.nested(dispatch);
	}

	function respond(spec) {
		if (spec === undefined)
			return { text: '404 (no route)', response: new Response('', { status: 404, statusText: 'Not Found' }) };
		if (spec.fail)
			return { text: `fails ${spec.fail}`, error: new TypeError(spec.fail) };
		const status = spec.status ?? 200;
		if ('json' in spec) {
			const body = JSON.stringify(spec.json);
			return { text: `${status} ${body}`, response: new Response(body, { status, headers: { 'content-type': 'application/json' } }) };
		}
		const body = spec.text ?? '';
		return { text: `${status} ${JSON.stringify(body)}`, response: new Response(body, { status, headers: { 'content-type': 'text/plain' } }) };
	}

	function parseJson(text) {
		try {
			return JSON.parse(text);
		} catch {
			return text;
		}
	}

	function fetch(url, init) {
		const key = `${init.method} ${url}`;
		const body = init.body;
		const route = routes[key];
		const parsed = typeof body === 'string' ? parseJson(body) : body;
		let spec;
		try {
			spec = typeof route === 'function' ? route(parsed) : route;
		} catch (e) {
			// the scenario's fault, not the page's: loud, and the run fails
			process.stderr.write(`route ${key} throws: ${e.stack}\n`);
			process.exitCode = 1;
		}
		const r = respond(spec);
		// utils.toJson indents: the body on one line, as parsed (key order and values are the wire's)
		const shown = body === undefined || body === null ? '' :
			' ' + (typeof body === 'string' ? (parsed === body ? body : JSON.stringify(parsed)) : rec.fmt(body));
		rec.write(`fetch ${key}${shown} → ${r.text}`);
		return r.error ? Promise.reject(r.error) : Promise.resolve(r.response);
	}

	function call(name, args) {
		const rv = answer(name, ...args);
		const text = `${name}(${args.map(x => rec.fmt(x)).join(', ')})`;
		rec.write(rv === undefined ? text : `${text} → ${rec.fmt(rv)}`);
		return rv;
	}

	const host = { emit, fetch, call };

	// --- values the model recorder does not know --------------------------------------------------

	// A page is Net48's Vue instance, or the port's controller (env.isPage); the name its scenario gave it.
	function known(v) {
		if (names.has(v)) return `vm:${names.get(v)}`;
		if (v._isVue || (env.isPage && env.isPage(v))) return `vm:${mounting ?? '?'}`;
		if (v instanceof Promise) return 'Promise';
		if (v instanceof Error) return `${v.constructor.name}(${JSON.stringify(v.message)})`;
		if (v instanceof FormData) return `FormData(${[...v.keys()].join(', ')})`;
		if (v instanceof File) return `File(${JSON.stringify(v.name)})`;
		return undefined;
	}

	// env: { cmn, period, utils, bus, mount(root, spec) → view model }, from the runner once the core is loaded;
	// for the port also: isPage(v), pageOf(vm) (the controller behind a mounted page), raw(root) (Vue's toRaw).
	function attach(e) {
		env = e;
		const origin = root => {
			const r = env.raw ? env.raw(root) : root;
			return pages.length > 1 && roots.has(r) ? `[${roots.get(r)}]` : undefined;
		};
		rec = createRecorder({ cmn: e.cmn, period: e.period, utils: e.utils, known, origin, raw: e.raw });
		// Console and stray rejections, at any time: a then-chain logs after its operation returned.
		console.error = (...a) => rec.write(`console.error ${a.map(x => rec.fmt(x)).join(' ')}`);
		console.warn = (...a) => rec.write(`console.warn ${a.map(x => rec.fmt(x)).join(' ')}`);
		process.on('unhandledRejection', err => rec.write(`unhandled rejection ${rec.fmt(err)}`));
	}

	// --- API for scenarios -----------------------------------------------------------------------

	async function drain() {
		for (let i = 0; i < DRAIN_TURNS; i++)
			await new Promise(r => setImmediate(r));
	}

	function isThenable(v) {
		return v !== null && (typeof v === 'object' || typeof v === 'function') && typeof v.then === 'function';
	}

	// Returns nothing: an async function returning the page's promise would wait for it, and many never end.
	async function op(label, fn) {
		rec.line(`> ${label}`);
		let value, error;
		try {
			value = fn();
		} catch (e) {
			error = e;
		}
		if (error)
			rec.line(`  throws ${error.constructor.name}: ${error.message}`);
		else if (isThenable(value)) {
			rec.line('  = Promise');
			let settled = false;
			value.then(
				v => { settled = true; rec.write(`resolved ${rec.fmt(v)}`); },
				e => { settled = true; rec.write(`rejected ${rec.fmt(e)}`); });
			await drain();
			if (!settled) rec.write('pending');
		} else {
			if (value !== undefined)
				rec.line(`  = ${rec.fmt(value)}`);
			await drain();
		}
		rec.noteDirty();
	}

	// The previous section's pages are destroyed unrecorded; the bus and the shell start afresh.
	function teardown() {
		rec.quiet(() => {
			for (const vm of pages.reverse()) {
				try {
					vm.$destroy();
				} catch {
					// a page a scenario broke: nothing to record
				}
			}
		});
		pages.length = 0;
		roots.clear();
		dataStack.length = 0;
		env.bus.reset();
	}

	// spec.server and spec.shell: the answers for the section's pages.
	function section(title, { server = {}, shell = {} } = {}) {
		teardown();
		rec.section(title);
		routes = server;
		answers = shell;
	}

	// A page as a runner mounts it: the root (modelData), then env.mount. spec: the model's (decl, template,
	// data, info, on) and the page's (url, inDialog, isIndex, isSkipDataStack). The model's handlers are the
	// last page's.
	async function page(name, spec) {
		const root = rec.build(spec);
		roots.set(root, name);
		let vm = null;
		mounting = name;
		await op(`mount ${name} ${spec.url}`, () => {
			vm = env.mount(root, spec);
			names.set(vm, name);
			if (env.pageOf)
				names.set(env.pageOf(vm), name);
			pages.push(vm);
		});
		mounting = null;
		if (!vm) throw ABORTED;
		return vm;
	}

	// The shell or another page speaks to the pages through the bus.
	function emitBus(event, ...args) {
		env.bus.$emit(event, ...args);
	}

	async function run(scenarios) {
		for (const scenario of scenarios) {
			try {
				await scenario(api);
			} catch (e) {
				if (e !== ABORTED) throw e;
			}
		}
		teardown();
		return rec.text();
	}

	const api = {
		section, page, op, run,
		show: (label, x) => rec.show(label, x),
		emit: emitBus,
		listeners: () => env.bus.counts()
	};
	return { host, attach, api };
}

module.exports = { createPageRecorder };
