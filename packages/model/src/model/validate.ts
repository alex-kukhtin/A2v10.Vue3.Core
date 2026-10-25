// Validation of the model by template.validators: { 'Document.Rows[].Qty': rule | rule[] }.
// A key is a property path; '[]' walks every element of an array. Errors live on each element
// (_errors_, by key) and in the root's list (_allErrors_). Any event marks the model as needing
// validation (template.ts: emit); $valid validates then, lazily.

import type { ModelContext } from './context.js';
import { logTime } from './context.js';
import type { Rule, RuleErrors } from './rules.js';
import type { Elem, Root } from './types.js';

// Every value a validator key reaches, with the array indexes on the way (':0:2').
export function* enumData(root: any, path: string, name: string, index?: string): Generator<{ item: any, val: any, ix: string }> {
	index = index || '';
	if (!path) {
		yield { item: root, val: root[name], ix: index }; // a scalar of the root
		return;
	}
	const sp = path.split('.');
	let currentData = root;
	for (let i = 0; i < sp.length; i++) {
		const last = i === sp.length - 1;
		const prop = sp[i];
		if (prop.endsWith('[]')) {
			const pname = prop.substring(0, prop.length - 2);
			if (!(pname in currentData))
				console.error(`Invalid validator key. Property '${pname}' not found in '${currentData.constructor.name}'`);
			const objto = currentData[pname];
			if (!objto) continue;
			for (let j = 0; j < objto.length; j++) {
				const arrItem = objto[j];
				if (last)
					yield { item: arrItem, val: arrItem[name], ix: index + ':' + j };
				else
					yield* enumData(arrItem, sp.slice(i + 1).join('.'), name, index + ':' + j);
			}
			return;
		}
		if (!(prop in currentData))
			console.error(`Invalid Validator key. property '${prop}' not found in '${currentData.constructor.name}'`);
		const objto = currentData[prop];
		if (last) {
			if (objto)
				yield { item: objto, val: objto[name], ix: index };
			return;
		}
		currentData = objto;
	}
}

// 'A.B.C' → the values of C over every A.B.
function* dataForVal(root: Root, path: string) {
	const ld = path.lastIndexOf('.');
	if (ld === -1)
		yield* enumData(root, '', path, '');
	else
		yield* enumData(root, path.substring(0, ld), path.substring(ld + 1), '');
}

// Keeps an element's errors of one key; _errors_ is null when it has none. item: the raw element (platform.raw):
// a control validates while it renders, and a write the runtime observes would render the others again, and so on.
function saveErrors(item: Elem, path: string, errors: RuleErrors | null): RuleErrors | null | undefined {
	if (!item._errors_ && !errors)
		return; // already null
	else if (!item._errors_ && errors)
		item._errors_ = {};
	if (errors && errors.length > 0)
		item._errors_![path] = errors;
	else if (path in item._errors_!)
		delete item._errors_![path];
	if (Object.keys(item._errors_!).length === 0 && item._errors_!.constructor === Object)
		item._errors_ = null;
	return errors;
}

export function createValidation(ctx: ModelContext) {
	const rules = ctx.rules;

	function rulesOf(item: Elem, path: string): Rule | Rule[] | null {
		return item._root_.$template?.validators?.[path] || null;
	}

	// The errors of one value; computed only when the model needs validation, else the kept ones.
	// Root's _validate_.
	function validate(this: Root, item: Elem, path: string, val: unknown, onAsyncError?: () => void) {
		if (!item._root_._needValidate_) {
			if (!item._errors_)
				return null;
			if (path in item._errors_)
				return item._errors_[path];
			return null;
		}
		const elemRules = rulesOf(item, path);
		const res = elemRules ? rules.validate(elemRules, item, val, onAsyncError) : null;
		return saveErrors(ctx.platform.raw(item), path, res);
	}

	function validateOneElement(root: Root, path: string, keyRules: Rule | Rule[]) {
		if (!keyRules)
			return;
		const errs: unknown[] = [];
		for (const elem of dataForVal(root, path)) {
			const res = rules.validate(keyRules, elem.item, elem.val);
			saveErrors(ctx.platform.raw(elem.item), path, res);
			if (res && res.length)
				errs.push(...res);
		}
		return errs.length ? errs : null;
	}

	// Validates every key, once per need; the root's list keeps its order: gone keys leave, new
	// ones go last. Not before the model has a host. force: async rules ask again. Root's _validateAll_.
	function validateAll(this: Root, force?: boolean) {
		const me = this;
		if (!me._host_) return;
		if (!me._needValidate_) return;
		me._needValidate_ = false;
		if (force)
			rules.removeWeak();
		const startTime = ctx.platform.performance.now();
		const vals = me.$template?.validators;
		if (!vals) return;
		const allerrs: { x: string, e: any[] }[] = [];
		for (const val in vals) {
			const err1 = validateOneElement(me, val, vals[val]);
			if (err1)
				allerrs.push({ x: val, e: err1 });
		}
		logTime(ctx, 'validation time:', startTime);
		let i = me._allErrors_.length;
		while (i--) {
			const a = me._allErrors_[i];
			if (!allerrs.find(n => n.x === a.x))
				me._allErrors_.splice(i, 1);
		}
		allerrs.forEach(n => {
			if (!me._allErrors_.find(a => a.x === n.x))
				me._allErrors_.push(n);
		});
		return allerrs;
	}

	// Validates now, and again with async rules asking anew. Root's $forceValidate.
	function forceValidateAll(this: Root) {
		this._needValidate_ = true;
		const retArr = this._validateAll_(false);
		this._validateAll_(true);
		return retArr;
	}

	// After the runtime's update: the async rules of key valname ask again for itm. Root's $revalidate.
	function revalidateItem(this: Root, itm: Elem, valname: string): void {
		this.$defer(() => {
			rules.revalidate(itm, valname, this.$template);
			this._needValidate_ = true;
			this._validateAll_(false);
		});
	}

	// Has any of these keys errors in the root's list. Root's $hasErrors.
	function hasErrors(this: Root, props: string[]): boolean {
		if (!props || !props.length) return false;
		const errs = this._allErrors_;
		if (!errs.length) return false;
		return errs.some(e => props.some(p => p === e.x));
	}

	// An element's $valid: no own errors, every nested element and array element valid.
	function elementValid(this: Elem): boolean {
		if (this._root_._needValidate_)
			this._root_._validateAll_();
		if (this._errors_)
			return false;
		for (const x in this) {
			if (x[0] === '$' || x[0] === '_')
				continue;
			const sx = this[x];
			if (Array.isArray(sx)) {
				for (const ax of sx) {
					if (ax !== null && typeof ax === 'object' && '$valid' in ax && !ax.$valid)
						return false;
				}
			} else if (sx !== null && typeof sx === 'object' && '$valid' in sx && !sx.$valid) {
				return false;
			}
		}
		return true;
	}

	// An element's $errors(prop): the errors of its key, or null.
	function elementErrors(this: Elem, prop: string) {
		if (!this) return null;
		const root = this._root_;
		if (!root) return null;
		if (!root._validate_)
			return null;
		const arr = root._validate_(this, `${this._path_}.${prop}`, this[prop]);
		if (arr && arr.length === 0) return null;
		return arr;
	}

	return {
		validate,
		validateAll,
		forceValidateAll,
		revalidateItem,
		hasErrors,
		elementValid,
		elementErrors
	};
}

export type Validation = ReturnType<typeof createValidation>;
