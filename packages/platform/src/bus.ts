// std:eventBus: the application bus. Vue 2 gave it as an instance (webvue.js: new Vue({})); Vue 3 dropped
// instance events, and the ~120 places that call $on/$off/$emit are kept as they are.
// A subscription made while an effect scope is active (a component's setup, created, mounted…) is released
// with that scope: whoever subscribes inside a page is let go when the page is. Out of any scope (a module, an
// event handler) a subscription stays until $off, as in Vue 2.

import { getCurrentScope, onScopeDispose } from 'vue';

type Handler = (...args: any[]) => unknown;

// An entry, not the bare handler: a scope removes its own subscription even when another owner subscribed
// the same function.
interface Entry {
	fn: Handler;
}

const listeners = new Map<string, Entry[]>();

function $on(event: string | string[], fn: Handler): EventBus {
	for (const e of Array.isArray(event) ? event : [event]) {
		const entry: Entry = { fn };
		let list = listeners.get(e);
		if (!list)
			listeners.set(e, list = []);
		list.push(entry);
		if (getCurrentScope())
			onScopeDispose(() => remove(e, entry));
	}
	return bus;
}

function remove(event: string, entry: Entry): void {
	const list = listeners.get(event);
	const i = list ? list.indexOf(entry) : -1;
	if (i !== -1)
		list!.splice(i, 1);
}

// As Vue 2: no arguments, all; no handler, all of the event; else the handler's last subscription.
function $off(event?: string | string[], fn?: Handler): EventBus {
	if (event === undefined) {
		listeners.clear();
		return bus;
	}
	for (const e of Array.isArray(event) ? event : [event]) {
		const list = listeners.get(e);
		if (!list) continue;
		if (!fn) {
			listeners.delete(e);
			continue;
		}
		for (let i = list.length - 1; i >= 0; i--) {
			if (list[i].fn === fn) {
				list.splice(i, 1);
				break;
			}
		}
	}
	return bus;
}

// As Vue 2 (invokeWithErrorHandling): a handler's throw, or its promise's rejection, is logged and the
// others still run.
function $emit(event: string, ...args: unknown[]): EventBus {
	const list = listeners.get(event);
	if (!list) return bus;
	for (const { fn } of [...list]) {
		try {
			const rv = fn(...args) as any;
			if (rv && typeof rv.then === 'function' && typeof rv.catch === 'function') // Vue 2: isPromise
				rv.catch((err: unknown) => logError(err, event));
		} catch (err) {
			logError(err, event);
		}
	}
	return bus;
}

function logError(err: unknown, event: string): void {
	console.error(`Error in event handler for "${event}":`, err);
}

// Diagnostics (the tests, the stands): the number of subscriptions by event, the events with none left out.
function __counts__(): Record<string, number> {
	const rv: Record<string, number> = {};
	for (const [e, list] of [...listeners].sort((a, b) => a[0] < b[0] ? -1 : 1))
		if (list.length) rv[e] = list.length;
	return rv;
}

export interface EventBus {
	$on(event: string | string[], fn: Handler): EventBus;
	$off(event?: string | string[], fn?: Handler): EventBus;
	$emit(event: string, ...args: unknown[]): EventBus;
	__counts__(): Record<string, number>;
}

export const bus: EventBus = { $on, $off, $emit, __counts__ };
