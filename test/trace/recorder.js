// Records what the model core does, as text: each operation, every event the core emits (by name, its
// arguments by address), the handler's answer, console errors, throws, and changes of $dirty.
// Core-agnostic: it is given the datamodel API (`cmn`) and the period module, so the same scenarios run
// on the Net48 original and on the package, and their traces are compared line by line.

'use strict';

// A model is declared as the server declares it (VueDataScripter.GetConstructors): one constructor per
// type, `array: true` adds `<Type>Array`; a property type is a constructor, or a type name as a string.
// The constructors get the declared names: the core dispatches on constructor.name.
function createRecorder({ cmn, period }) {
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
	// ($valid validates the whole model) and change what is being recorded.
	function addr(x) {
		if (x._root_ === x) return 'Root';
		const p = x._parent_;
		if (!p) return '?';
		if (Array.isArray(p)) {
			const i = p.indexOf(x);
			return `${addr(p)}[${i < 0 ? '?' : i}]`;
		}
		for (const k in p._meta_.props)
			if (p[k] === x) return `${addr(p)}.${k}`;
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
	const events = new Proxy({}, {
		has: (_, k) => typeof k === 'string',
		get: (_, k) => typeof k !== 'string' ? undefined : function (...args) {
			const at = lines.length;
			const text = `${ind()}ev ${k}(${args.map(a => fmt(a)).join(', ')})`;
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
			cmn.defineObject(ctors[name], meta, !!array);
		}
		return ctors;
	}

	// As the page does it: modelData() (VueDataScripter.CreateScript), then the host (FOOTER),
	// then __doInit__ (base.js: _modelLoad_, _seal_).
	function model(title, { decl, template = {}, data = {}, info = {}, on = {} }) {
		lines.push('', `## ${title}`);
		handlers = on;
		lastDirty = undefined;
		root = null;
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
		const log = s => lines.push(`${ind()}${s}`);
		root._host_ = { $viewModel: createViewModel(log), $ctrl: {} };
		op('load', () => {
			root._modelLoad_(null);
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
		return lines.join('\n').trimStart() + '\n';
	}

	const api = { model, op, show, run };
	return api;
}

const ABORTED = Symbol('scenario aborted');

module.exports = { createRecorder };
