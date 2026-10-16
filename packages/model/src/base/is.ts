// Type tests. Pure: no runtime, no locale.

export const isArray = Array.isArray;

export function isFunction(value: unknown): value is Function {
	return typeof value === 'function';
}

export function isDefined(value: unknown): boolean {
	return typeof value !== 'undefined';
}

export function isObject(value: unknown): value is object {
	return value !== null && typeof value === 'object';
}

// An object, not an array.
export function isObjectExact(value: unknown): value is Record<string, any> {
	return isObject(value) && !Array.isArray(value);
}

export function isDate(value: unknown): value is Date {
	return value instanceof Date;
}

export function isString(value: unknown): value is string {
	return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
	return typeof value === 'number';
}

export function isBoolean(value: unknown): value is boolean {
	return typeof value === 'boolean';
}

// As Net48: null throws, reads null.then (NET48-BUGS.md B9, kept).
export function isPromise(v: any): v is Promise<unknown> {
	return isDefined(v) && isFunction(v.then) && isFunction(v.catch);
}

export function isDateCtor(ctor: unknown): boolean {
	return ctor === Date;
}

// The constructors of a scalar model property; `file` is the runtime's File (runtime.ts).
export function isPrimitiveCtor(ctor: unknown, file: Function): boolean {
	return ctor === String || ctor === Number || ctor === Boolean || ctor === Date || ctor === file || ctor === Object;
}

export function isEmptyObject(obj: any): boolean {
	return !obj || Object.keys(obj).length === 0 && obj.constructor === Object;
}
