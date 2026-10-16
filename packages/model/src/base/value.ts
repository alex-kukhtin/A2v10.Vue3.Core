// Values: emptiness, equality, defaults, ids. Pure.

import * as date from './date.js';
import { isDate, isDefined, isNumber, isObject, isObjectExact } from './is.js';
import { toJson } from './json.js';

export function isEqual(o1: unknown, o2: unknown): boolean {
	if (o1 === o2) return true;
	else if (isDate(o1) && isDate(o2))
		return o1.getTime() === o2.getTime();
	else if (isObjectExact(o1) && isObjectExact(o2))
		return JSON.stringify(o1) === JSON.stringify(o2);
	return false;
}

// Has a value: a non-zero date, a non-empty string, an element with an id.
export function notBlank(val: any): boolean {
	if (!val)
		return false;
	if (isDate(val))
		return !date.isZero(val);
	if (typeof val === 'object' && '$id' in val)
		return !!val.$id;
	return (val || '') !== '';
}

export function toBoolean(obj: unknown): boolean {
	if (!obj) return false;
	const val = obj.toString().toLowerCase();
	return val === 'true' || val === '1';
}

// An object as its JSON; undefined and null as ''.
export function toString(obj: unknown): string {
	if (!isDefined(obj) || obj === null)
		return '';
	if (isObject(obj))
		return toJson(obj);
	return '' + obj;
}

export function isPlainObjectEmpty(obj: any): boolean {
	if (!obj) return true;
	return !Object.keys(obj).some(key => !!obj[key]);
}

// Resets every value in place, nested objects too.
export function clearObject(obj: any): void {
	for (const key of Object.keys(obj)) {
		const val = obj[key];
		if (!val)
			continue;
		switch (typeof val) {
			case 'number':
				obj[key] = 0;
				break;
			case 'string':
				obj[key] = '';
				break;
			case 'object':
				clearObject(val);
				break;
			case 'boolean':
				obj[key] = false;
				break;
			default:
				console.error(`utils.clearObject. Unknown property type ${typeof val}`);
		}
	}
}

// The value a property of this constructor starts with.
export function defaultValue(type: unknown): unknown {
	switch (type) {
		case undefined: return undefined;
		case Number: return 0;
		case String: return '';
		case Boolean: return false;
		case Date: return date.zero();
		case Object: return null;
		default:
			if (typeof type === 'function')
				return null; // complex object
			throw new Error(`There is no default value for type ${type}`);
	}
}

// The id of an element or of a plain object with Id, as text for a url; '0' for none.
export function getStringId(obj: any): any {
	if (!obj)
		return '0';
	if (isNumber(obj))
		return obj;
	else if (isObjectExact(obj)) {
		if ('$id' in obj)
			return obj.$id || 0;
		else if ('Id' in obj)
			return obj.Id || 0;
		else
			console.error('Id or @id not found in object');
	}
	return '0';
}

// A template over a base template: each section merged, the second wins.
export function mergeTemplate(src: any, tml: any): any {
	function assign(s: object | undefined, t: object | undefined) {
		return Object.assign({}, s || {}, t || {});
	}
	return assign(src, {
		properties: assign(src.properties, tml.properties),
		validators: assign(src.validators, tml.validators),
		events: assign(src.events, tml.events),
		defaults: assign(src.defaults, tml.defaults),
		commands: assign(src.commands, tml.commands),
		delegates: assign(src.delegates, tml.delegates),
		options: assign(src.options, tml.options),
		utils: assign(src.utils, tml.utils)
	});
}
