// Arrays of elements (an array property: 'Rows': TRowArray). A real Array whose prototype carries
// the model's members, one prototype per core; own are only its hidden fields, $lock, and what the
// platform and the server set ($RowCount, $ModelInfo, $loaded).
// Domain events, by the array's path: [].adding (false cancels), [].add, [].remove, [].select,
// [].check. Reactivity is the runtime's: the core only assigns and splices.

import { isArray, isDefined } from '../base/is.js';
import { propFromPath } from '../base/path.js';
import { createPermissionObject, defineCommonProps } from './common.js';
import type { ModelContext } from './context.js';
import { defHidden, defPropertyGet } from './define.js';
import { events } from './events.js';
import type { Template } from './template.js';
import { expandParents, setHasChildren } from './tree.js';
import type { ArrayCtor, Elem, ElementCtor, ModelArray } from './types.js';

type InsertTo = 'start' | 'end' | 'above' | 'below';

export function createArrays(ctx: ModelContext, tpl: Template) {

	function emitSelect(arr: ModelArray, item: Elem | null): void {
		arr._root_.$emit(events.select(arr._path_), arr, item);
	}

	// Renumbers the $rowNo property 1…n, if the element type has one.
	function renumberRows(arr: ModelArray): void {
		const meta = arr[0]._meta_;
		if (!('$rowNo' in meta)) return;
		for (let i = 0; i < arr.length; i++)
			arr[i][meta.$rowNo!] = i + 1;
	}

	const proto: any = Object.create(Array.prototype);
	defineCommonProps(proto);

	// --- state -----------------------------------------------------------------------------------

	defPropertyGet(proto, '$valid', function (this: ModelArray) {
		if (this._errors_)
			return false;
		for (const x of this) {
			if (x._errors_)
				return false;
		}
		return true;
	});

	defPropertyGet(proto, '$invalid', function (this: ModelArray) {
		return !this.$valid;
	});

	defPropertyGet(proto, '$permissions', function (this: ModelArray) {
		const mi = this.$ModelInfo;
		if (!mi || !isDefined(mi.Permissions))
			return {};
		return createPermissionObject(mi.Permissions);
	});

	// The elements, a tree's children too, depth first.
	defPropertyGet(proto, '$elements', function (this: ModelArray) {
		function* elems(arr: ModelArray): Generator<Elem> {
			for (let i = 0; i < arr.length; i++) {
				const val = arr[i];
				yield val;
				if (val.$items)
					yield* elems(val.$items);
			}
		}
		return elems(this);
	});

	defPropertyGet(proto, '$selected', function (this: ModelArray) {
		for (const x of this.$elements) {
			if (x.$selected)
				return x;
		}
		return undefined;
	});

	defPropertyGet(proto, '$selectedIndex', function (this: ModelArray) {
		for (let i = 0; i < this.length; i++) {
			if (this[i].$selected) return i;
		}
		return -1;
	});

	defPropertyGet(proto, 'Count', function (this: ModelArray) {
		return this.length;
	});

	defPropertyGet(proto, '$isEmpty', function (this: ModelArray) {
		return !this.length;
	});

	defPropertyGet(proto, '$checked', function (this: ModelArray) {
		return this.filter(el => el.$checked);
	});

	defPropertyGet(proto, '$hasSelected', function (this: ModelArray) {
		return !!this.$selected;
	});

	defPropertyGet(proto, '$hasChecked', function (this: ModelArray) {
		return !!(this.$checked && this.$checked.length);
	});

	defPropertyGet(proto, '$names', function (this: ModelArray) {
		return this.map(x => x.Name).join(', ');
	});

	defPropertyGet(proto, '$ids', function (this: ModelArray) {
		return this.map(x => x.Id).join(',');
	});

	proto.Selected = function (this: ModelArray, propName: string) {
		const sel = this.$selected;
		return sel ? sel[propName] : null;
	};

	proto.$lockUpdate = function (this: ModelArray, lock: boolean) {
		this.$lock = lock;
	};

	// --- elements --------------------------------------------------------------------------------

	// A new element of this array's type, not added.
	proto.$new = function (this: ModelArray, src?: unknown) {
		const newElem = new this._elem_(src || null, this._path_ + '[]', this);
		newElem.__checked = false;
		return newElem;
	};

	proto.$sum = function (this: ModelArray, fn: (e: Elem) => number) {
		return this.reduce((a, c) => a + fn(c), 0);
	};

	// The first element fc accepts, a tree's children searched too.
	proto.$find = function (this: ModelArray, fc: Function, thisArg?: unknown) {
		for (let i = 0; i < this.length; i++) {
			const el = this[i];
			if (fc.call(thisArg, el, i, this))
				return el;
			if ('$items' in el) {
				const x = el.$items.$find(fc, thisArg);
				if (x)
					return x;
			}
		}
		return null;
	};

	proto.$allItems = function* (this: ModelArray): Generator<Elem> {
		for (let i = 0; i < this.length; i++) {
			const el = this[i];
			yield el;
			if ('$items' in el)
				yield* el.$items.$allItems();
		}
	};

	proto.$sort = function (this: ModelArray, compare: (a: Elem, b: Elem) => number) {
		this.sort(compare);
		this.$renumberRows();
		return this;
	};

	// Replaces the elements with new ones from src; no events; $RowCount left 0 (NET48-BUGS.md B6, kept).
	proto.$copy = function (this: ModelArray, src: unknown) {
		if (this.$root.isReadOnly) // isReadOnly: no member has that name, never true (NET48-BUGS.md B7, kept)
			return this;
		this.$empty();
		if (isArray(src)) {
			for (let i = 0; i < src.length; i++)
				this.push(this.$new(src[i]));
		}
		this.$renumberRows();
		return this;
	};

	proto.$renumberRows = function (this: ModelArray) {
		if (!this.length) return this;
		renumberRows(this);
		return this;
	};

	// --- selection -------------------------------------------------------------------------------

	proto.$select = function (this: ModelArray, elem: Elem) {
		elem.$select();
	};

	proto.$clearSelected = function (this: ModelArray) {
		const sel = this.$selected;
		if (!sel) return this;
		sel.$selected = false;
		emitSelect(this, null);
		return this;
	};

	// --- resize ----------------------------------------------------------------------------------

	// Empties without making the model dirty.
	proto.__empty__ = function (this: ModelArray) {
		this.splice(0, this.length);
		if ('$RowCount' in this)
			this.$RowCount = 0;
		return this;
	};

	proto.$empty = function (this: ModelArray) {
		if (this.$root.isReadOnly)
			return this;
		this._root_.$setDirty(true, this._path_);
		return this.__empty__();
	};

	proto.$append = function (this: ModelArray, src?: unknown) {
		return this.$insert(src, 'end');
	};

	proto.$prepend = function (this: ModelArray, src?: unknown) {
		return this.$insert(src, 'start');
	};

	// Adds one element (selected) or several (the last one selected); current: the element of
	// 'above' and 'below'. [].adding may cancel an element: then null in its place.
	proto.$insert = function (this: ModelArray, src: unknown, to: InsertTo, current?: Elem) {
		const that = this;

		function append(src: unknown, select: boolean): Elem | null {
			const newElem = that.$new(src);
			if (that._root_.$emit(events.adding(that._path_), that, newElem) === false)
				return null;
			let len = that.length;
			let ne: Elem = newElem;
			let ix: number;
			switch (to) {
				case 'end':
					len = that.push(newElem);
					ne = that[len - 1]; // the runtime may hand back another (reactive) reference
					break;
				case 'start':
					that.unshift(newElem);
					ne = that[0];
					len = 1;
					break;
				case 'above':
					ix = that.indexOf(current!);
					that.splice(ix, 0, newElem);
					ne = that[ix];
					len = ix + 1;
					break;
				case 'below':
					ix = that.indexOf(current!) + 1;
					that.splice(ix, 0, newElem);
					ne = that[ix];
					len = ix + 1;
					break;
			}
			if ('$RowCount' in that) that.$RowCount += 1;
			that._root_.$setDirty(true, that._path_);
			that._root_.$emit(events.add(that._path_), that, ne, len - 1);
			if (select) {
				ne.$select();
				emitSelect(that, ne); // a second [].select: $select emitted one (NET48-BUGS.md B5, kept)
			}
			if ('$rowNo' in newElem._meta_)
				renumberRows(that);
			setHasChildren(that, true);
			return ne;
		}

		if (isArray(src)) {
			const ra: (Elem | null)[] = [];
			let lastElem: Elem | null = null;
			src.forEach(elem => {
				lastElem = append(elem, false);
				ra.push(lastElem);
			});
			if (lastElem)
				(lastElem as Elem).$select();
			return ra;
		}
		return append(src, true);
	};

	// Removes an element; the one in its place, or the last, gets selected. The last child of a
	// tree element gone: the element itself is selected.
	proto.$remove = function (this: ModelArray, item: Elem) {
		if (this.$root.isReadOnly)
			return this;
		if (!item)
			return this;
		let index = this.indexOf(item);
		if (index === -1)
			return this;
		this.splice(index, 1);
		if ('$RowCount' in this) this.$RowCount -= 1;
		this._root_.$setDirty(true, this._path_);
		this._root_.$emit(events.remove(this._path_), this, item, index);

		if (!this.length) {
			if (this.$parent) {
				setHasChildren(this, false);
				if (this.$parent._meta_.$items)
					this.$parent.$select();
			}
			return this;
		}
		if (index >= this.length)
			index -= 1;
		this.$renumberRows();
		if (this.length > index)
			this[index].$select();
		return this;
	};

	// --- order -----------------------------------------------------------------------------------

	type MoveDir = 'up' | 'down' | 'top' | 'bottom';

	proto.$move = function (this: ModelArray, el: Elem, dir: MoveDir) {
		if (!el) return;
		let ix1 = this.indexOf(el);
		let ix2 = 0;
		switch (dir) {
			case 'up':
				if (ix1 <= 0) return;
				ix2 = ix1;
				ix1 = ix2 - 1;
				break;
			case 'down':
				if (ix1 >= this.length - 1) return;
				ix2 = ix1 + 1;
				break;
			case 'top': {
				if (ix1 <= 0) return;
				const moved = this.splice(ix1, 1)[0];
				this.splice(0, 0, moved);
				this.$renumberRows();
				return;
			}
			case 'bottom': {
				if (ix1 >= this.length - 1) return;
				const moved = this.splice(ix1, 1)[0];
				this.splice(this.length, 0, moved);
				this.$renumberRows();
				return;
			}
			default:
				return;
		}
		const t = [this[ix1], this[ix2]];
		this.splice(ix1, 2, t[1], t[0]);
		this.$renumberRows();
	};

	proto.$canMove = function (this: ModelArray, el: Elem, dir: MoveDir) {
		switch (dir) {
			case 'up': return this.indexOf(el) > 0;
			case 'down': return this.indexOf(el) < this.length - 1;
			case 'top': return this.indexOf(el) != 0;
			case 'bottom': return this.indexOf(el) != this.length - 1;
		}
		return false;
	};

	// --- loading ---------------------------------------------------------------------------------

	// Lazy: the parent type lists this property in $lazy; the view model loads it on demand.
	proto.$isLazy = function (this: ModelArray) {
		const meta = this.$parent._meta_;
		if (!meta.$lazy) return false;
		return meta.$lazy.indexOf(propFromPath(this._path_)) !== -1;
	};

	proto.$resetLazy = function (this: ModelArray) {
		this.$lock = false;
		this.$empty();
		if (this.$loaded)
			this.$loaded = false;
		return this;
	};

	proto.$loadLazy = function (this: ModelArray) {
		if (!this.$isLazy())
			return;
		if (this.$lock) return;
		return new Promise((resolve) => {
			if (!this.$vm) return;
			if (this.$loaded) { resolve(this); return; }
			if (!this.$parent) { resolve(this); return; }
			const meta = this.$parent._meta_;
			if (!meta.$lazy) { resolve(this); return; }
			const prop = propFromPath(this._path_);
			if (meta.$lazy.indexOf(prop) === -1) { resolve(this); return; }
			this.$vm.$loadLazy(this.$parent, prop).then(() => resolve(this));
		});
	};

	proto.$load = function (this: ModelArray) {
		if (!this.$isLazy()) return;
		ctx.platform.defer(() => this.$loadLazy());
	};

	proto.$reload = function (this: ModelArray) {
		this.$lock = false;
		return this.$vm.$reload(this);
	};

	// Emits [].change with the array, or with its selected element.
	proto.__fireChange__ = function (this: ModelArray, opts?: string) {
		const itm = opts === 'selected' ? this.$selected : this;
		this.$root.$emit(events.arrayChange(this._path_), this, itm);
	};

	// --- creation --------------------------------------------------------------------------------

	// The body of every array constructor the server writes:
	// function TRowArray(source, path, parent) { return cmn.createArray(source, path, TRow, TRowArray, parent); }
	function createArray(source: unknown[] | null, path: string, ctor: ElementCtor, arrctor: ArrayCtor, parent: any): ModelArray {
		const arr = new Array(source ? source.length : 0) as unknown as ModelArray;
		Object.setPrototypeOf(arr, proto);
		arr.$lock = false;
		defHidden(arr, '_elem_', ctor);
		defHidden(arr, '_path_', path);
		defHidden(arr, '_parent_', parent);
		defHidden(arr, '_root_', parent._root_ || parent);
		if (ctor.prototype._meta_.$cross)
			defPropertyGet(arr, '$cross', () => ctor.prototype._meta_.$cross);
		tpl.createObjProperties(arr, arrctor);
		arr._root_.$emit(events.construct(arrctor.name), arr);
		if (!source)
			return arr;
		const dotPath = path + '[]';
		for (let i = 0; i < source.length; i++) {
			arr[i] = new arr._elem_(source[i], dotPath, arr);
			arr[i].__checked = false;
		}
		return arr;
	}

	// The members of an array element type: its place in the array, selection, the check box.
	function defineArrayItemProto(elemCtor: ElementCtor): void {
		const p = elemCtor.prototype;

		p.$remove = function (this: Elem) {
			this._parent_.$remove(this);
		};

		// Selects in its array, or in the tree's top array; the tree's ancestors expand.
		p.$select = function (this: Elem, root?: ModelArray) {
			if (!root && this.$findTreeRoot)
				root = this.$findTreeRoot();
			const arr: any = root || this._parent_;
			const sel = arr.$selected;
			if (sel === this) return;
			if (sel) sel.$selected = false;
			this.$selected = true;
			emitSelect(arr, this);
			expandParents(this);
		};

		p.$canMove = function (this: Elem, dir: MoveDir) {
			const arr: any = this._parent_;
			if (arr.length < 2) return false;
			return arr.$canMove(this, dir);
		};

		p.$move = function (this: Elem, dir: MoveDir) {
			const arr: any = this._parent_;
			if (arr.length < 2) return;
			arr.$move(this, dir);
			return this;
		};

		Object.defineProperty(p, '$checked', {
			enumerable: true,
			configurable: true,
			get(this: Elem) {
				return this.__checked;
			},
			set(this: Elem, val: boolean) {
				this.__checked = val;
				const arr: any = this.$parent;
				arr._root_.$emit(events.check(arr._path_), arr, this);
			}
		});
	}

	return {
		createArray,
		defineArrayItemProto
	};
}

export type Arrays = ReturnType<typeof createArrays>;
