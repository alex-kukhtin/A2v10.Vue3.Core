// The seam: everything the model core needs from the runtime it runs in, passed to createModel.
// Implementations: the platform's adapter for Vue 3 (as platform/webvue.js for Vue 2), the server
// host for Jint (as server/platform.js). The core never reaches a runtime any other way.

export interface Platform {
	// Assign a property so the runtime observes it (Vue 2: Vue.set; Vue 3 and server: plain assignment).
	set(target: object, prop: string, value: unknown): void;
	// Run after the runtime's current update (Vue: nextTick; server: at once).
	defer(fn: () => void): void;
	// The file constructor; a model property of this type holds a file and starts null.
	File: Function;
	performance: { now(): number };
}

// The application bus; the core emits only 'pendingValidate' (an async validator has settled).
export interface EventBus {
	$emit(event: string, ...args: unknown[]): void;
}

// The localized strings and the culture: window.$$locale in the browser.
export type Locale = Readonly<Record<string, string>>;

// Tracing; optional: the core is silent without it.
export interface Log {
	info(msg: string): void;
	time(msg: string, start: number, enable?: boolean): void;
}

export interface Runtime {
	platform: Platform;
	eventBus: EventBus;
	locale: Locale;
	log?: Log;
}
