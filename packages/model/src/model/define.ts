// How the model defines its members.
// Hidden: non-enumerable, so data walks (toJson, $valid, for…in) skip them; configurable, so a proxy
// over the model may report them (Vue 3 reactive(): a non-configurable read-only data property
// must be returned as is, never wrapped).

export { defPropertyGet } from '../base/func.js';

export function defHidden(obj: object, prop: string, value: unknown, writable?: boolean): void {
	Object.defineProperty(obj, prop, {
		writable: writable || false,
		enumerable: false,
		configurable: true,
		value
	});
}

export function defHiddenGet(obj: object, prop: string, get: (this: any) => unknown): void {
	Object.defineProperty(obj, prop, {
		enumerable: false,
		configurable: true,
		get
	});
}
