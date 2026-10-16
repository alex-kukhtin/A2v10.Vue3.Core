// Members every element and every array has: the way to the root, the parent, the view model.

import { defHiddenGet } from './define.js';

// $host: the root's _host_; $vm, $ctrl: its view model and controller; $ready: no request running.
export function defineCommonProps(obj: any): void {
	defHiddenGet(obj, '$host', function (this: any) {
		return this._root_._host_;
	});
	defHiddenGet(obj, '$root', function (this: any) {
		return this._root_;
	});
	defHiddenGet(obj, '$parent', function (this: any) {
		return this._parent_;
	});
	defHiddenGet(obj, '$vm', function (this: any) {
		if (this._root_ && this._root_._host_)
			return this._root_._host_.$viewModel;
		return null;
	});
	defHiddenGet(obj, '$ctrl', function (this: any) {
		if (this._root_ && this._root_._host_)
			return this._root_._host_.$ctrl;
		return null;
	});
	defHiddenGet(obj, '$ready', function (this: any) {
		if (!this.$vm) return true;
		return !this.$vm.$isLoading;
	});
	obj.$isValid = function () {
		return true;
	};
}

const FLAG_VIEW = 1;
const FLAG_EDIT = 2;
const FLAG_DELETE = 4;
const FLAG_APPLY = 8;
const FLAG_UNAPPLY = 16;
const FLAG_CREATE = 32;
const FLAG_64 = 64;
const FLAG_128 = 128;
const FLAG_256 = 256;

// The rights of a permissions bit mask ($permissions of an element or an array).
export function createPermissionObject(perm: number) {
	return Object.freeze({
		canView: !!(perm & FLAG_VIEW),
		canEdit: !!(perm & FLAG_EDIT),
		canDelete: !!(perm & FLAG_DELETE),
		canApply: !!(perm & FLAG_APPLY),
		canUnapply: !!(perm & FLAG_UNAPPLY),
		canCreate: !!(perm & FLAG_CREATE),
		canFlag64: !!(perm & FLAG_64),
		canFlag128: !!(perm & FLAG_128),
		canFlag256: !!(perm & FLAG_256)
	});
}
