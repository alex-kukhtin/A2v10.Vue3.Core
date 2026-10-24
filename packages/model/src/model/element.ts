// Elements: what a type's constructor builds and what its prototype carries.
// The server writes one constructor per type (VueDataScripter):
//   function TRow(source, path, parent) { cmn.createObject(this, source, path, parent); }
//   cmn.defineObject(TRow, { props: {…}, $id: 'Id', … }, isArrayItem);
// Data properties are accessors on the element; values live in a shadow that only the accessors
// reach (Net48 kept it as a hidden _src_; there is no such member now: one way in, one way out).

import * as date from '../base/date.js';
import { isDate, isDateCtor, isDefined, isObjectExact, isPrimitiveCtor } from '../base/is.js';
import { propFromPath } from '../base/path.js';
import type { Arrays } from './array.js';
import { createPermissionObject, defineCommonProps } from './common.js';
import type { ModelContext } from './context.js';
import { logTime } from './context.js';
import { defHidden, defHiddenGet, defPropertyGet } from './define.js';
import { events } from './events.js';
import type { Roots } from './root.js';
import { TMarker } from './template.js';
import type { Template } from './template.js';
import { defineTreeProto } from './tree.js';
import type { Elem, ElementCtor, ElementMeta } from './types.js';
import type { Validation } from './validate.js';

const ERR_STR = '#err#';
const ROWCOUNT = '$RowCount';

export function createElements(ctx: ModelContext, tpl: Template, validation: Validation, arrays: Arrays, roots: Roots) {
	const { platform, format, period } = ctx;
	const file = platform.File;

	// The data property prop of trg: its initial value from source, then the accessor.
	// Setting: coerce to the type (not json), skip an equal value, emit changing (false cancels),
	// store — or merge into the element already there, which emits its own change — mark dirty
	// (not $$ properties), emit change. With events locked: store and dirty only.
	function defSource(trg: Elem, shadow: Record<string, any>, source: any, prop: string): void {
		let propCtor: any = trg._meta_.props[prop];
		if (propCtor.type) propCtor = propCtor.type;
		const pathdot = trg._path_ ? trg._path_ + '.' : '';
		source = source || {};
		if (isObjectExact(propCtor)) {
			if ('type' in propCtor)
				propCtor = propCtor.type;
			else
				throw new Error(`Invalid _meta_ for '${prop}'`);
		}
		switch (propCtor) {
			case Number:
				shadow[prop] = source[prop] || 0;
				break;
			case String:
				shadow[prop] = source[prop] || '';
				break;
			case Boolean:
				shadow[prop] = source[prop] || false;
				break;
			case Date: {
				const srcval = source[prop] || null;
				shadow[prop] = srcval ? date.fromServer(srcval) : date.zero();
				break;
			}
			case file:
			case Object:
				shadow[prop] = null;
				break;
			case TMarker: {
				const mp = trg._meta_.markerProps![prop];
				shadow[prop] = isDefined(mp.type) && isDefined(mp.value) ? mp.value : mp;
				break;
			}
			case period.constructor:
				shadow[prop] = new propCtor(source[prop]);
				break;
			default: // an element or an array
				shadow[prop] = new propCtor(source[prop] || null, pathdot + prop, trg);
				break;
		}
		Object.defineProperty(trg, prop, {
			enumerable: true,
			configurable: true,
			get() {
				return shadow[prop];
			},
			// `this`, not trg: a proxy over the model calls the setter with itself as `this`, and
			// the events must carry what the application holds. Reads go through this[prop] too.
			set(this: Elem, val: any) {
				const skipDirty = prop.startsWith('$$');
				let ctor: any = this._meta_.props[prop];
				if (ctor === TMarker) {
					const mp = this._meta_.markerProps![prop];
					if (isDefined(mp.type) && isDefined(mp.value))
						ctor = mp.type;
				}
				let isjson = false;
				if (ctor.type) {
					isjson = !!ctor.json;
					ctor = ctor.type;
				}
				if (!isjson)
					val = format.ensureType(ctor, val);
				const oldVal = this[prop];
				if (val === oldVal)
					return;
				if (!this._lockEvents_) {
					if (this._root_.$emit(events.changing(this._path_, prop), this, val, oldVal, prop) === false)
						return;
				}
				let merged = false;
				const cur = this[prop]; // again: a changing handler may have set it
				if (cur && cur.$set) {
					cur.$set(val);
					merged = true;
				} else {
					shadow[prop] = val;
				}
				if (!skipDirty)
					this._root_.$setDirty(true, this._path_, prop);
				if (this._lockEvents_ || merged)
					return; // locked; or merged: the merge emits only on a new id (NET48-BUGS.md Q2)
				this._root_.$emit(events.change(this._path_, prop), this, val, oldVal, prop);
			}
		});
	}

	// The body of every element constructor. path: the type path ('Document.Rows[]'); a root has
	// none and is its own parent. Emits <Type>.construct after its data is built, children first.
	function createObject(elem: any, source: any, path?: string, parent?: any): Elem {
		const ctorname = elem.constructor.name;
		const startTime = ctorname === 'TRoot' ? platform.performance.now() : null;
		parent = parent || elem;
		const shadow: Record<string, any> = {};
		defHidden(elem, '_path_', path || '');
		defHidden(elem, '_root_', parent._root_ || parent);
		defHidden(elem, '_parent_', parent);
		defHidden(elem, '_errors_', null, true);
		defHidden(elem, '_lockEvents_', 0, true);
		elem._uiprops_ = {}; // observable!

		const hasTemplProps = tpl.hasTemplateProps(elem);
		if (hasTemplProps)
			tpl.createPrimitiveProperties(elem, elem.constructor);
		for (const propName in elem._meta_.props)
			defSource(elem, shadow, source, propName);
		if (hasTemplProps)
			tpl.createObjProperties(elem, elem.constructor);

		if (path && path.endsWith(']'))
			elem.$selected = false;

		const meta: ElementMeta = elem._meta_;
		if (meta.$items) {
			let exp = false;
			let clps = false;
			if (meta.$expanded) {
				const val = source ? source[meta.$expanded] : false;
				exp = !!val;
				clps = !val;
			}
			elem.$expanded = exp;  // tree
			elem.$collapsed = clps; // sheet
			elem.$level = 0;
		}

		if (meta.$itemType) {
			// a map: a new element of $itemType at prop. The shape is fixed at _seal_: a map grows in
			// <Type>.construct and Model.defaults; Model.load comes after the seal in the browser
			// (defer is Vue.nextTick), before it on the server (defer is synchronous).
			elem.$setProperty = function (prop: string, src: unknown) {
				if (Object.isSealed(this))
					throw new Error(`$setProperty: the map '${this._path_ || 'Root'}' is sealed after load`);
				const ne = new meta.$itemType!(src, elem._path_ ? `${elem._path_}.${prop}` : prop, elem);
				platform.set(this, prop, ne);
				this._root_.$setDirty(true);
				return ne;
			};
		}

		elem._root_.$emit(events.construct(ctorname), elem, path ? propFromPath(path) : '');

		if (elem._root_ === elem)
			roots.initRoot(elem, source);
		if (startTime)
			logTime(ctx, 'create root time:', startTime);
		return elem;
	}

	// --- the prototype ---------------------------------------------------------------------------

	// Copies src into the element with events locked and validation off: scalars assigned, dates
	// parsed, nested elements merged into the ones there, arrays rebuilt with their $RowCount;
	// template markers skipped.
	// checkBindOnce: skip options.bindOnce; existsOnly: skip nested elements src lacks.
	// After: if the id changed, <path>.change with the element as new and old value.
	function merge(this: Elem, src: any, checkBindOnce?: boolean, existsOnly?: boolean): Elem {
		const oldId = this.$id__;
		try {
			if (src === null)
				src = {};
			this._root_._enableValidate_ = false;
			this._lockEvents_ += 1;
			for (const prop in this._meta_.props) {
				if (prop.startsWith('$$')) continue;
				if (checkBindOnce && tpl.isSkipMerge(this._root_, prop)) continue;
				let ctor: any = this._meta_.props[prop];
				if (ctor === TMarker) continue; // a marker is client state, not data
				if (ctor.type) ctor = ctor.type;
				const trg = this[prop];
				if (Array.isArray(trg)) {
					if ((trg as any).$loaded)
						(trg as any).$loaded = false; // may be lazy
					if ('$copy' in trg)
						(trg as any).$copy(src[prop]);
					if (ROWCOUNT in trg) {
						const rcProp = prop + '.$RowCount';
						(trg as any).$RowCount = rcProp in src ? src[rcProp] || 0 : 0;
					}
				} else if (isDateCtor(ctor)) {
					const dt = src[prop];
					platform.set(this, prop, dt ? date.fromServer(dt) : date.zero());
				} else if (isPrimitiveCtor(ctor, file)) {
					platform.set(this, prop, src[prop]);
				} else {
					if (existsOnly && !(prop in src))
						continue;
					if (trg && trg.$merge)
						trg.$merge(src[prop] || null);
					else
						platform.set(this, prop, new ctor(src[prop] || null, this._path_ ? `${this._path_}.${prop}` : prop, this));
				}
			}
		} finally {
			this._root_._enableValidate_ = true;
			this._root_._needValidate_ = true;
			this._lockEvents_ -= 1;
		}
		if (this.$parent._lockEvents_) return this; // may be a custom lock
		const newId = this.$id__;
		if (isDefined(newId) && isDefined(oldId) && newId !== oldId)
			this._root_.$emit(events.elementChange(this._path_), this.$parent, this, this, propFromPath(this._path_));
		return this;
	}

	function empty(this: Elem): Elem {
		this.$set({});
		return this;
	}

	function setElement(this: Elem, src: unknown): void {
		if (this.$root.isReadOnly) // isReadOnly: no member has that name, never true (NET48-BUGS.md B7, kept)
			return;
		this.$merge(src);
	}

	function getMaxLength(this: Elem, prop: string): number | undefined {
		const m = this._meta_.props;
		if (!m) return undefined;
		const x: any = m[prop];
		if (isObjectExact(x))
			return x.len;
		return undefined;
	}

	// A type's metadata and members. arrayItem: its elements live in arrays (selection, checks).
	function defineObject(obj: ElementCtor, meta: ElementMeta, arrayItem?: boolean): void {
		const p = obj.prototype;
		defHidden(p, '_meta_', meta);

		p.$merge = merge;
		p.$empty = empty;
		p.$set = setElement;
		p.$maxLength = getMaxLength;

		defineCommonProps(p);

		defHiddenGet(p, '$isNew', function (this: Elem) {
			return !this.$id;
		});
		defHiddenGet(p, '$isEmpty', function (this: Elem) {
			return !this.$id;
		});
		defHiddenGet(p, '$id', function (this: Elem) {
			const idName = this._meta_.$id;
			if (!idName)
				throw new Error(this.constructor.name + ' object does not have an Id property');
			return this[idName];
		});
		defHiddenGet(p, '$id__', function (this: Elem) {
			const idName = this._meta_.$id;
			if (!idName)
				return undefined;
			return this[idName];
		});
		defHiddenGet(p, '$name', function (this: Elem) {
			const nameName = this._meta_.$name;
			if (!nameName)
				throw new Error(this.constructor.name + ' object does not have a Name property');
			return this[nameName];
		});

		// Net48 set these on each instance in createObject.
		p.$lockEvents = function (this: Elem) {
			this._lockEvents_ += 1;
		};
		p.$unlockEvents = function (this: Elem) {
			this._lockEvents_ -= 1;
		};
		defHiddenGet(p, '$eventsLocked', function (this: Elem) {
			return this._lockEvents_ > 0;
		});
		defPropertyGet(p, '$valid', validation.elementValid);
		defPropertyGet(p, '$invalid', function (this: Elem) {
			return !this.$valid;
		});
		p.$errors = validation.elementErrors;

		if (arrayItem)
			arrays.defineArrayItemProto(obj);

		if (meta.$hasChildren) {
			defHiddenGet(p, '$hasChildren', function (this: Elem) {
				const hcName = this._meta_.$hasChildren;
				return hcName ? this[hcName] : undefined;
			});
		}
		if (meta.$items) {
			defHiddenGet(p, '$items', function (this: Elem) {
				const itmsName = this._meta_.$items;
				return itmsName ? this[itmsName] : undefined;
			});
			defineTreeProto(p);
		}
		if (meta.$permissions) {
			defHiddenGet(p, '$permissions', function (this: Elem) {
				const permName = this._meta_.$permissions;
				if (!permName) return undefined;
				let perm = this[permName];
				if (this.$isNew && perm === 0) {
					const mi = this.$ModelInfo;
					if (mi && isDefined(mi.Permissions))
						perm = mi.Permissions;
				}
				return createPermissionObject(perm);
			});
		}
		if (meta.$group === true) {
			// The text of a group row: its level's field ($level is set by TreeSection only).
			defPropertyGet(p, '$groupName', function (this: Elem) {
				if (!isDefined(this.$level))
					return ERR_STR;
				const mi = this._root_.__modelInfo.Levels;
				if (mi) {
					const levs = mi[this.constructor.name];
					if (levs && this.$level <= levs.length) {
						const xv = this[levs[this.$level - 1]];
						if (!xv) return '';
						if (isObjectExact(xv))
							return xv.$name;
						else if (isDate(xv))
							return format.format(xv, 'Date');
						return xv;
					}
				}
				console.error('invalid data for $groupName');
				return ERR_STR;
			});
		}
	}

	return {
		createObject,
		defineObject
	};
}
