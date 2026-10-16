// Trees: an element type with $items (its children's array property), $hasChildren (a data flag
// the model keeps true while the children's array is not empty) and $expanded.

import { isDefined } from '../base/is.js';
import type { Elem, ModelArray } from './types.js';

// The members of a tree element type: $expand asks the view model to load and show the children.
export function defineTreeProto(proto: any): void {
	proto.$expand = function (this: Elem) {
		if (!this._meta_.$items) return null;
		if (this.$expanded) return null;
		return this.$vm.$expand(this, this._meta_.$items, true);
	};

	// The array the topmost tree element of this branch lives in.
	proto.$findTreeRoot = function (this: Elem) {
		let p: any = this;
		let r: any = null;
		while (p && p !== this.$root) {
			if (p._meta_ && p._meta_.$items)
				r = p;
			p = p._parent_;
		}
		return r ? r._parent_ : null;
	};

	// Walks a path of values down the tree, expanding on the way: cb(item, value) finds each step.
	proto.$selectPath = async function (this: Elem, arr: unknown[], cb: (item: any, val: unknown) => boolean) {
		if (!arr.length) return null;
		const itemsProp = this._meta_.$items;
		if (!itemsProp) return null;
		let current: any = null;
		if (cb(this, arr[0]))
			current = this;
		for (let i = 1; i < arr.length; i++) {
			if (!current) return null;
			await current.$expand();
			current = current[itemsProp].$find((itm: any) => cb(itm, arr[i]));
		}
		return current;
	};
}

// A selected tree element shows: its tree ancestors expand.
export function expandParents(elem: Elem): void {
	if (!elem._meta_.$items) return;
	let p: any = elem._parent_._parent_;
	while (p) {
		if (p === elem.$root || !isDefined(p.$expanded))
			break;
		p.$expanded = true;
		p = p._parent_._parent_;
	}
}

// After an add or a remove: the parent's $hasChildren follows its children's array.
export function setHasChildren(arr: ModelArray, value: boolean): void {
	const parent = arr.$parent;
	if (!parent) return;
	const m = parent._meta_;
	if (m.$hasChildren && arr._path_.endsWith('.' + m.$items))
		parent[m.$hasChildren] = value;
}
