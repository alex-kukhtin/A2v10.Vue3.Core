// The vocabulary: the platform's components and directives, the only global registrations of the document's one
// app (the shell's). They may come at any time: before the shell attaches its app they are kept, after it they go
// to the app at once. Vue resolves a name at render, so a later registration serves the next render.

import type { App, Component, Directive } from 'vue';

let target: App | null = null;
const pending: ((app: App) => void)[] = [];

function register(fn: (app: App) => void): void {
	if (target)
		fn(target);
	else
		pending.push(fn);
}

export function component(name: string, def: Component): void {
	register(app => app.component(name, def));
}

export function directive(name: string, def: Directive): void {
	register(app => app.directive(name, def));
}

// The shell's createApp, before mount (through the platform's attach, app.ts). A document has one app: a second
// one is a defect, not a choice.
export function attach(app: App): void {
	if (target)
		throw new Error('vocabulary: an app is attached already; a document has one app, the shell\'s');
	target = app;
	for (const fn of pending)
		fn(app);
	pending.length = 0;
}
