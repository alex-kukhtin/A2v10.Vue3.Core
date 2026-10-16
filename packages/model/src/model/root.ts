// The root: the element the page's model is, built by `new TRoot(data)`. implementRoot gives the
// root type the template and the members the platform drives the model by (base.js):
//   _modelLoad_ → defaults, then Model.load after the runtime's update; _seal_ → Object.seal;
//   _exec_/_canExec_/_delegate_ → commands; _validate_/_validateAll_ → validation;
//   _saveSelections/_restoreSelections, _setRuntimeInfo_, _fire*_ → application events.
// Net48 set the root-only members on each root in createObject; they live on the prototype now.

import { isArray, isDefined, isObject, isObjectExact, isPrimitiveCtor } from '../base/is.js';
import { simpleEval } from '../base/path.js';
import type { ModelContext } from './context.js';
import { defHidden, defHiddenGet } from './define.js';
import { events } from './events.js';
import type { ModelInfo } from './modelinfo.js';
import type { Template } from './template.js';
import type { ElementCtor, Root } from './types.js';
import type { Validation } from './validate.js';

export function createRoots(ctx: ModelContext, tpl: Template, validation: Validation, modelInfo: ModelInfo) {
	const { platform, period } = ctx;
	const file = platform.File;

	// The state of a new root; createObject calls it last.
	function initRoot(root: any, source: any): void {
		root._root_ctor_ = root.constructor;
		root.$dirty = false;
		root._query_ = {};
		root._allErrors_ = [];
		for (const m in root._meta_.props) {
			const rcp = m + '.$RowCount';
			if (source && rcp in source)
				root[m].$RowCount = source[rcp] || 0;
		}
		root._enableValidate_ = true;
		root._needValidate_ = false;
		defHidden(root, '_lastCaller_', null, true); // the caller of _modelLoad_: Model.load's argument
	}

	// Marks the model dirty or clean; Model.dirty.change tells the key either way. Not dirty: a
	// read-only model (only this: NET48-BUGS.md Q1), an index page, options.noDirty, a Query… path,
	// an options.skipDirty key.
	function setDirty(this: Root, val: boolean, path?: string, prop?: string): void {
		if (val === this.$dirty) return;
		if (this.$root.$readOnly)
			return;
		const key = prop ? `${path}.${prop}` : path;
		this.$root.$emit(events.dirtyChange, val, key);
		if (this.$vm && this.$vm.isIndex)
			return;
		if (tpl.isNoDirty(this.$root))
			return;
		if (path && prop && path.toLowerCase().startsWith('query'))
			return;
		if (path && tpl.isSkipDirty(this.$root, key!))
			return;
		this.$dirty = val;
	}

	function modelLoad(this: Root, caller: unknown): void {
		this._lastCaller_ = caller;
		this._setDefaults_();
		this._fireLoad_();
	}

	function setDefaults(this: Root): void {
		if (tpl.setDefaults(this))
			this.$emit(events.defaults, this);
	}

	// After the runtime's update, once the view model is there: Model.load, then clean (a copy: dirty).
	function fireLoad(this: Root): void {
		const root = this;
		platform.defer(() => {
			if (!root.$vm) return;
			const isRequery = root.$vm.__isModalRequery();
			root.$emit(events.load, root, root._lastCaller_, isRequery);
			root._root_.$setDirty(root._root_.$isCopy ? true : false);
		});
	}

	function fireUnload(this: Root): void {
		this.$emit(events.unload, this);
	}

	// Seals the element and every nested element: no member can be added after load.
	function seal(elem: any): void {
		Object.seal(elem);
		if (!elem._meta_) return;
		for (const p in elem._meta_.props) {
			let ctor = elem._meta_.props[p];
			if (ctor.type) ctor = ctor.type;
			if (isPrimitiveCtor(ctor, file)) continue;
			if (ctor === period.constructor) continue;
			const val = elem[p];
			if (isArray(val))
				val.forEach(itm => seal(itm));
			else if (isObjectExact(val))
				seal(val);
		}
	}

	function isReadOnly(this: Root): boolean {
		if ('__modelInfo' in this) {
			const mi = this.__modelInfo;
			if (isDefined(mi.ReadOnly) && mi.ReadOnly)
				return true;
			if (isDefined(mi.StateReadOnly) && mi.StateReadOnly)
				return true;
		}
		return false;
	}

	function isStateReadOnly(this: Root): boolean {
		if ('__modelInfo' in this) {
			const mi = this.__modelInfo;
			if (isDefined(mi.StateReadOnly) && mi.StateReadOnly)
				return true;
		}
		return false;
	}

	function isCopy(this: Root): boolean {
		if ('__modelInfo' in this) {
			const mi = this.__modelInfo;
			if (isDefined(mi.Copy))
				return mi.Copy;
		}
		return false;
	}

	function mainObject(this: Root): unknown {
		if ('$main' in this._meta_)
			return this[this._meta_.$main!];
		return null;
	}

	// The server's runtime info: $cross sets each array's cross columns to the server's lists.
	function setRootRuntimeInfo(this: Root, runtime: any): void {
		if (!runtime || !runtime.$cross) return;
		function ensureCrossSize(elem: any, cross: Record<string, any>) {
			if (!elem._elem_ || !elem.$cross) return;
			for (const crstp in cross) {
				if (elem._elem_.name !== crstp) continue;
				const t = elem.$cross;
				const s = cross[crstp];
				for (const p in t) {
					const ta = t[p];
					const sa = s[p];
					if (ta && sa)
						ta.splice(0, ta.length, ...sa);
					else if (ta && !sa)
						ta.splice(0, ta.length);
				}
			}
		}
		for (const p in this) {
			if (p.startsWith('$') || p.startsWith('_')) continue;
			let ta = this[p];
			ensureCrossSize(ta, runtime.$cross);
			if (ta._meta_ && ta._meta_.$items) {
				ta = ta[ta._meta_.$items];
				ensureCrossSize(ta, runtime.$cross);
			}
		}
	}

	// The ids of the selected elements of options.persistSelect arrays, before a save…
	function saveSelections(this: Root): Record<string, unknown> | undefined {
		const ps = this.$template?.options?.persistSelect;
		if (!ps || !ps.length) return;
		const result: Record<string, unknown> = {};
		for (const p of ps) {
			const arr = simpleEval(this, p);
			if (isObject(arr) && '$selected' in arr) {
				const sel = (arr as any).$selected;
				if (sel)
					result[p] = sel.$id;
			}
		}
		return result;
	}

	// …selected again after it.
	function restoreSelections(this: Root, sels: Record<string, unknown>): void {
		if (!sels) return;
		for (const p in sels) {
			const arr = simpleEval(this, p);
			const selId = sels[p];
			if ('$find' in arr) {
				const se = arr.$find((x: any) => x.$id === selId);
				if (se)
					se.$select();
			}
		}
	}

	function destroyRoot(this: Root): void {
		this._host_!.$viewModel = null;
		this._host_ = null;
	}

	// The root type of a page: its template, and the members of a root.
	function implementRoot(root: ElementCtor, template: any, _ctors?: unknown): void {
		const p = root.prototype;
		p.$emit = tpl.emit;
		p.$setDirty = setDirty;
		p.$defer = platform.defer;
		p.$template = template;
		p._exec_ = tpl.executeCommand;
		p._canExec_ = tpl.canExecuteCommand;
		p._delegate_ = tpl.getDelegate;
		p._globalSaveEvent_ = tpl.getGlobalSaveEvent;
		p._validate_ = validation.validate;
		p._validateAll_ = validation.validateAll;
		p.$forceValidate = validation.forceValidateAll;
		p.$revalidate = validation.revalidateItem;
		p.$hasErrors = validation.hasErrors;
		p.$destroy = destroyRoot;

		modelInfo.setModelInfoForRoot(p);
		p._setRuntimeInfo_ = setRootRuntimeInfo;
		p._saveSelections = saveSelections;
		p._restoreSelections = restoreSelections;
		p._modelLoad_ = modelLoad;
		p._setDefaults_ = setDefaults;
		p._fireLoad_ = fireLoad;
		p._fireUnload_ = fireUnload;
		p._seal_ = seal;
		defHiddenGet(p, '$readOnly', isReadOnly);
		defHiddenGet(p, '$stateReadOnly', isStateReadOnly);
		defHiddenGet(p, '$isCopy', isCopy);
		defHiddenGet(p, '$mainObject', mainObject);
		p._fireGlobalPeriodChanged_ = function (this: Root, period: unknown) {
			this.$emit(events.globalPeriodChange, this, period);
		};
		p._fireGlobalAppEvent_ = function (this: Root, ev: { event: string, data: unknown }) {
			this.$emit(ev.event, ev.data);
		};
		p._fireSignalAppEvent_ = function (this: Root, ev: { event: string, data: unknown }) {
			this.$emit(events.signal(ev.event), ev.data);
		};

		if (!template) return;
		tpl.cacheProperties(template);
	}

	return {
		initRoot,
		implementRoot
	};
}

export type Roots = ReturnType<typeof createRoots>;
