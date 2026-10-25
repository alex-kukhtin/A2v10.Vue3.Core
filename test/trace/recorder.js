// Records what the model core does, as text: each operation, every event the core emits (by name, its
// arguments by address), the handler's answer, console errors, throws, and changes of $dirty.
// Core-agnostic: it is given the datamodel API (`cmn`), the period module and utils, so the same scenarios
// run on the Net48 original and on the package, and their traces are compared line by line.

'use strict';

// A model is declared as the server declares it (VueDataScripter.GetConstructors): one constructor per
// type, `array: true` adds `<Type>Array`; a property type is a constructor, or a type name as a string.
// The constructors get the declared names: the core dispatches on constructor.name.
// known(v): the text of a value the caller knows (the page recorder: a view model, a promise), or undefined.
function createRecorder({ cmn, period, utils, known, origin, raw = v => v }) {
	const lines = [];
	let handlers = {};
	let root = null;
	let depth = 0;
	let lastDirty;

	function ind() {
		return '  '.repeat(depth + 1);
	}

	// --- formatting -----------------------------------------------------------------------------

	function pad(n, w = 2) {
		return String(n).padStart(w, '0');
	}

	function fmtDate(d) {
		if (isNaN(d)) return 'Date(NaN)';
		return `D${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
			`T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
	}

	function isModel(v) {
		return v !== null && typeof v === 'object' && '_root_' in v && '_path_' in v;
	}

	// Data properties only (_meta_.props): reading any other enumerable member may run a getter
	// ($valid validates the whole model) and change what is being recorded. Compared raw (raw: Vue 3's toRaw):
	// the port's model is reached through reactive() and through its hidden members, which Vue leaves raw.
	function addr(x) {
		x = raw(x);
		if (raw(x._root_) === x) return 'Root';
		const p = raw(x._parent_);
		if (!p) return '?';
		if (Array.isArray(p)) {
			const i = p.indexOf(x);
			return `${addr(p)}[${i < 0 ? '?' : i}]`;
		}
		for (const k in p._meta_.props)
			if (raw(p[k]) === x) return `${addr(p)}.${k}`;
		return `${addr(p)}.?`;
	}

	function fmt(v, level = 0) {
		if (v === undefined) return 'undefined';
		if (v === null) return 'null';
		switch (typeof v) {
			case 'string': return JSON.stringify(v);
			case 'number':
			case 'boolean': return String(v);
			case 'function': return `fn ${v.name}`.trimEnd();
			case 'symbol': return v.toString();
		}
		const s = known ? known(v) : undefined;
		if (s !== undefined) return s;
		if (v instanceof Date) return fmtDate(v);
		if (isModel(v)) {
			// Not placed in its parent (yet, or any more): construct, adding, remove. Its path then.
			const a = addr(v);
			return a.includes('?') ? `@~${v._path_}` : '@' + a;
		}
		if (v instanceof period.constructor) return `P(${fmtDate(v.From)}..${fmtDate(v.To)})`;
		if (level > 3) return '…';
		if (Array.isArray(v)) return `[${v.map(x => fmt(x, level + 1)).join(', ')}]`;
		const keys = Object.keys(v);
		return `{${keys.map(k => `${k}: ${fmt(v[k], level + 1)}`).join(', ')}}`;
	}

	// The data of an element, by _meta_.props, plus the state flags the UI reads.
	function snap(x, level = 0) {
		const pre = '  '.repeat(level + 2);
		if (Array.isArray(x)) {
			const head = '$RowCount' in x ? ` $RowCount=${x.$RowCount}` : '';
			if (!x.length) return `[]${head}`;
			return `[${head}\n${x.map((e, i) => `${pre}  [${i}] ${snap(e, level + 1)}`).join('\n')}\n${pre}]`;
		}
		if (!isModel(x)) return fmt(x);
		const flags = ['$selected', '$checked', '$expanded'].filter(f => f in x && x[f] === true);
		const props = Object.keys(x._meta_.props).map(k => {
			const v = x[k];
			return isModel(v) ? `${pre}  ${k}: ${snap(v, level + 1)}` : `${pre}  ${k}: ${fmt(v)}`;
		});
		return `${x.constructor.name}${flags.length ? ' ' + flags.join(' ') : ''} {\n${props.join('\n')}\n${pre}}`;
	}

	// --- capture --------------------------------------------------------------------------------

	function capture(fn) {
		const saved = { error: console.error, warn: console.warn };
		console.error = (...a) => lines.push(`${ind()}console.error ${a.map(x => fmt(x)).join(' ')}`);
		console.warn = (...a) => lines.push(`${ind()}console.warn ${a.map(x => fmt(x)).join(' ')}`);
		try {
			return { value: fn() };
		} catch (e) {
			return { error: e };
		} finally {
			Object.assign(console, saved);
		}
	}

	function noteDirty() {
		if (!root) return;
		const d = root.$dirty;
		if (d !== lastDirty)
			lines.push(`  $dirty → ${fmt(d)}`);
		lastDirty = d;
	}

	// Every event name exists for the core (`event in events`); the handler records the call,
	// then runs the scenario's handler for that name, if any. Nested events are indented.
	// origin(root): the name of the root an event comes from, written before it, or undefined.
	const events = new Proxy({}, {
		has: (_, k) => typeof k === 'string',
		get: (_, k) => typeof k !== 'string' ? undefined : function (...args) {
			const at = lines.length;
			const who = origin ? origin(this) : undefined;
			const text = `${ind()}${who ? who + ' ' : ''}ev ${k}(${args.map(a => fmt(a)).join(', ')})`;
			lines.push(text);
			depth += 1;
			let rv;
			try {
				rv = handlers[k] ? handlers[k].apply(this, args) : undefined;
			} finally {
				depth -= 1;
			}
			if (rv !== undefined)
				lines[at] = `${text} → ${fmt(rv)}`;
			return rv;
		}
	});

	// What the core reaches on its host (_host_.$viewModel): synchronous, so the trace keeps its order.
	function createViewModel(log) {
		const done = { then(f) { return f(); } };
		return {
			$isLoading: false,
			isIndex: false,
			get $data() { return root; },
			get $isDirty() { return root.$dirty; },
			__isModalRequery() { return false; },
			$confirm(msg) { log(`vm.$confirm(${fmt(msg)})`); return done; },
			$save() { log('vm.$save()'); return done; },
			$expand(elem, prop) { log(`vm.$expand(${fmt(elem)}, ${fmt(prop)})`); return done; },
			$reload(arg) { log(`vm.$reload(${fmt(arg)})`); return done; },
			$loadLazy(elem, prop) { log(`vm.$loadLazy(${fmt(elem)}, ${fmt(prop)})`); return done; }
		};
	}

	// --- API for scenarios ----------------------------------------------------------------------

	// A function passed as an argument has no name of its own; `name` is configurable.
	function named(name, body) {
		return Object.defineProperty(body, 'name', { value: name });
	}

	function declare(decl) {
		const ctors = {};
		for (const [name, spec] of Object.entries(decl)) {
			const elem = named(name, function (source, path, parent) {
				cmn.createObject(this, source, path, parent);
			});
			ctors[name] = elem;
			if (spec.array) {
				const arrName = name + 'Array';
				ctors[arrName] = named(arrName, function (source, path, parent) {
					return cmn.createArray(source, path, elem, ctors[arrName], parent);
				});
			}
		}
		const resolve = t => t === 'TPeriod' ? period.constructor : typeof t === 'string' ? ctors[t] : t;
		for (const [name, spec] of Object.entries(decl)) {
			const { array, props, ...special } = spec;
			const meta = { props: {} };
			for (const [p, t] of Object.entries(props)) {
				const isObj = t !== null && typeof t === 'object';
				meta.props[p] = isObj ? { ...t, type: resolve(t.type) } : resolve(t);
			}
			Object.assign(meta, special);
			if (meta.$itemType)
				meta.$itemType = resolve(meta.$itemType); // a map: the server writes the constructor
			cmn.defineObject(ctors[name], meta, !!array);
		}
		return ctors;
	}

	// As the page does it: modelData() (VueDataScripter.CreateScript), then the host (FOOTER),
	// then __doInit__ (base.js: _modelLoad_, _seal_; the package has no _seal_: NET48.md).
	// A scenario's heading; with no model after it, operations call the modules directly.
	function section(title) {
		lines.push('', `## ${title}`);
		handlers = {};
		lastDirty = undefined;
		root = null;
	}

	// The root as modelData() builds it; no host, not loaded. The page recorder hands it to a page.
	function build({ decl, template = {}, data = {}, info = {}, on = {} }) {
		handlers = on;
		const tml = { ...template, events };
		lines.push('> create');
		const r = capture(() => {
			const ctors = declare(decl);
			cmn.implementRoot(ctors.TRoot, tml, ctors);
			const rt = new ctors.TRoot(data);
			cmn.setModelInfo(rt, info, data);
			return rt;
		});
		if (r.error) {
			lines.push(`  throws ${r.error.constructor.name}: ${r.error.message}`);
			throw ABORTED; // the rest of the scenario has no model to drive
		}
		root = r.value;
		return root;
	}

	function model(title, spec) {
		section(title);
		build(spec);
		root._host_ = { $viewModel: createViewModel(write), $ctrl: {} };
		op('load', () => {
			root._modelLoad_(null);
			if (root._seal_)
				root._seal_(root);
		});
		return root;
	}

	function op(label, fn) {
		lines.push(`> ${label}`);
		const r = capture(fn);
		if (r.error)
			lines.push(`  throws ${r.error.constructor.name}: ${r.error.message}`);
		else if (r.value !== undefined)
			lines.push(`  = ${fmt(r.value)}`);
		noteDirty();
	}

	function show(label, x) {
		lines.push(`> ${label}`, `  = ${snap(x)}`);
	}

	function run(scenarios) {
		for (const scenario of scenarios) {
			try {
				scenario(api);
			} catch (e) {
				if (e !== ABORTED) throw e;
			}
		}
		return text();
	}

	// line: as is (an operation's head, its result); write: at the current depth, nested() indents.
	function line(s) {
		lines.push(s);
	}

	function write(s) {
		lines.push(`${ind()}${s}`);
	}

	function nested(fn) {
		depth += 1;
		try {
			return fn();
		} finally {
			depth -= 1;
		}
	}

	// fn with nothing it writes kept: a page recorder's teardown between scenarios.
	function quiet(fn) {
		const n = lines.length;
		try {
			return fn();
		} finally {
			lines.length = n;
		}
	}

	function text() {
		return lines.join('\n').trimStart() + '\n';
	}

	// model, op, run: the model's scenarios; the rest: for a recorder built on this one (test/trace/page.js).
	const api = { model, section, op, show, run, utils, build, line, write, nested, quiet, noteDirty, fmt, snap, text };
	return api;
}

const ABORTED = Symbol('scenario aborted');

module.exports = { createRecorder, ABORTED };
