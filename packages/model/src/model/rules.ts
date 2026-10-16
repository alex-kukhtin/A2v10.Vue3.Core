// Evaluating a template's validation rules for one value of one element (Net48: validators.js).
// Walking the model and keeping its errors is validate.ts.
//
// A rule is a message (the value must not be blank), a function (a message, a result, or nothing),
// or { valid, msg, severity, applyIf, when, async }; valid is a function or a standard rule's name.
// An async rule answers later: its first call only remembers the value, a later call with the same
// value returns the remembered result, and the answer bumps the root to validate again and emits
// 'pendingValidate' on the application bus.

import type { EventBus } from '../runtime.js';
import { isArray, isFunction, isObject, isObjectExact, isString } from '../base/is.js';
import { notBlank } from '../base/value.js';

export type Severity = 'error' | 'warning' | 'info';
export interface RuleResult { msg: string, severity: Severity }

type RuleFunc = (elem: any, value: any) => any;
export interface RuleObject {
	valid: RuleFunc | StdRule;
	msg?: string;
	severity?: Severity;
	regExp?: RegExp;
	async?: boolean;
	applyIf?: (elem: any, value: any) => boolean;
	when?: (this: any, value: any) => boolean;
}
export type Rule = string | RuleFunc | RuleObject;
type StdRule = 'notBlank' | 'email' | 'url' | 'isTrue' | 'regExp';

// The errors of one value; `pending` counts async rules not answered yet.
export type RuleErrors = RuleResult[] & { pending: number };

// The element a rule runs for; its root is told when an async answer arrives.
export interface RuleTarget { _root_: { _needValidate_: boolean } }

const ERROR: Severity = 'error';

// from chromium? https://stackoverflow.com/questions/46155/how-to-validate-an-email-address-in-javascript
const EMAIL_REGEXP = /^(([^<>()\[\]\.,;:\s@\"]+(\.[^<>()\[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i;
const URL_REGEXP = /^[a-z][a-z\d.+-]*:\/*(?:[^:@]+(?::[^@]+)?@)?(?:[^\s:/?#]+|\[[a-f\d:]+\])(?::\d+)?(?:\/[^?#]*)?(?:\?[^#]*)?(?:#.*)?$/i;

function validateStd(rule: { valid: string, regExp?: RegExp }, val: any): boolean {
	switch (rule.valid) {
		case 'notBlank':
			return notBlank(val);
		case 'email':
			return val === '' || EMAIL_REGEXP.test(val);
		case 'url':
			return val === '' || URL_REGEXP.test(val);
		case 'isTrue':
			return val === true;
		case 'regExp':
			if (!(rule.regExp instanceof RegExp)) {
				console.error('rule.regExp is undefined or is not an regular expression');
				return false;
			}
			return val === '' || rule.regExp.test(val);
	}
	console.error(`invalid std rule: '${rule}'`); // an object: '[object Object]' (NET48-BUGS.md B13, kept)
	return true;
}

// An element value compares by its id.
function valForCompare(o1: any): any {
	if (isObjectExact(o1) && '$id' in o1)
		return o1.$id;
	return o1;
}

export function createRules(eventBus: EventBus) {

	interface AsyncState { val: any, result: RuleResult | null }

	// async rule → element → the value it was asked for and the answer
	let asyncState = new WeakMap<object, WeakMap<object, AsyncState>>();

	function remember(rule: object, item: object, val: any): AsyncState {
		let byItem = asyncState.get(rule);
		if (!byItem) {
			byItem = new WeakMap();
			asyncState.set(rule, byItem);
		}
		const state = { val: valForCompare(val), result: null };
		byItem.set(item, state);
		return state;
	}

	// Forgets every async answer: the next validation asks again.
	function removeWeak(): void {
		asyncState = new WeakMap();
	}

	// Forgets the async answers of the rules at key for this element.
	function revalidate(item: object, key: string, templ: any): void {
		if (!asyncState || !key || !templ || !templ.validators) return;
		const rule = templ.validators[key];
		if (!rule) return;
		const forget = (r: object) => {
			const state = asyncState.get(r)?.get(item);
			if (state) {
				state.val = undefined;
				state.result = null;
			}
		};
		if (isArray(rule))
			rule.forEach(r => { if (isObject(r) && asyncState.has(r)) forget(r); });
		else if (isObject(rule) && asyncState.has(rule))
			forget(rule);
	}

	function validateRules(rules: Rule[], item: RuleTarget, val: any, onAsyncError?: () => void): RuleErrors {
		const retval = [] as unknown as RuleErrors;
		retval.pending = 0;
		rules.forEach(function (rule: any) {
			const sev: Severity = rule.severity || ERROR;
			if (isFunction(rule.applyIf) && !rule.applyIf(item, val)) return;
			if (isFunction(rule.when) && !rule.when.call(item, val)) return;
			if (isString(rule)) {
				if (!validateStd({ valid: 'notBlank' }, val))
					retval.push({ msg: rule, severity: ERROR });
			} else if (isFunction(rule)) {
				const vr = rule(item, val);
				if (isString(vr) && vr)
					retval.push({ msg: vr, severity: sev });
				else if (isObject(vr))
					retval.push({ msg: (vr as any).msg, severity: (vr as any).severity || sev });
			} else if (isString(rule.valid)) {
				if (!validateStd(rule, val))
					retval.push({ msg: rule.msg, severity: sev });
			} else if (isFunction(rule.valid)) {
				if (rule.async) {
					const state = asyncState.get(rule)?.get(item);
					if (!state) {
						remember(rule, item, val); // the first call: remember the value only
						return;
					}
					if (state.val === valForCompare(val)) {
						if (state.result)
							retval.push(state.result);
						return; // asked already
					}
				}
				const vr = rule.valid(item, val);
				if (vr && vr.then) {
					retval.pending += 1;
					if (!rule.async) {
						console.error('Async rules should be marked async:true');
						return;
					}
					const state = remember(rule, item, val);
					vr.then((result: unknown) => {
						const dm: RuleResult = { severity: sev, msg: rule.msg };
						let failed = false;
						if (isString(result)) {
							if (result) {
								dm.msg = result;
								failed = true;
							}
						} else if (!result) {
							failed = true;
						}
						if (failed) {
							state.result = dm;
							retval.push(dm);
						}
						item._root_._needValidate_ = true;
						if (failed && onAsyncError) onAsyncError();
						retval.pending -= 1;
						eventBus.$emit('pendingValidate');
					});
				}
				else if (isString(vr))
					retval.push({ msg: vr, severity: sev });
				else if (isObjectExact(vr))
					retval.push({ msg: vr.msg, severity: vr.severity });
				else if (!vr)
					retval.push({ msg: rule.msg, severity: sev });
			} else {
				console.error('invalid valid element type for rule');
			}
		});
		return retval;
	}

	// rules: one rule or an array. Always an array, async answers may arrive into it later.
	function validate(rules: Rule | Rule[], item: RuleTarget, val: any, onAsyncError?: () => void): RuleErrors {
		let arr: Rule[] = [];
		if (isArray(rules))
			arr = rules;
		else if (isObject(rules) || isFunction(rules))
			arr.push(rules);
		else if (isString(rules))
			arr.push({ valid: 'notBlank', msg: rules });
		return validateRules(arr, item, val, onAsyncError);
	}

	return {
		validate,
		removeWeak,
		revalidate
	};
}

export type Rules = ReturnType<typeof createRules>;
