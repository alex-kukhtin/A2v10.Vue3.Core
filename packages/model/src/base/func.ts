// Function and property helpers; currency rounding. Pure.

import { isDefined } from './is.js';

export function curry(fn: Function, ...args: unknown[]) {
	return (...rest: unknown[]) => fn(...args, ...rest);
}

// Calls fn with the last argument once calls stop for timeout ms.
export function debounce(fn: Function, timeout: number) {
	let timerId: number | null = null;
	return function (arg: unknown) {
		clearTimeout(timerId);
		timerId = setTimeout(() => fn.call(undefined, arg), timeout);
	};
}

// An enumerable getter, configurable: later definitions and proxies may replace it.
export function defPropertyGet(trg: object, prop: string, get: () => unknown): void {
	Object.defineProperty(trg, prop, {
		enumerable: true,
		configurable: true,
		get
	});
}

// Rounds to digits (default 2) without the binary error of toFixed: 1.005 → 1.01.
export function currencyRound(n: number, digits?: number): number {
	if (isNaN(n))
		return NaN;
	if (!isDefined(digits))
		digits = 2;
	let m = false;
	if (n < 0) {
		n = -n;
		m = true;
	}
	const exp = Math.floor(Math.log2(n));
	const eps = Math.pow(2, exp - 52);
	n += eps;
	const r = Number(Math.round(Number(n.toFixed(12) + `e${digits}`)) + `e-${digits}`);
	return m ? -r : r;
}
