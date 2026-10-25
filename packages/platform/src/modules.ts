// The registries of app.js (Net48 app/app.js), unchanged in behaviour: window.app with modules, components,
// templates and nextToken, and the globals require, component, template, define that page scripts, template.ts
// and application modules call. A module registered as a function is created by its first require and kept.

import type { Locale } from '@a2v10/model';

type Registry = Record<string, unknown>;

export interface AppRegistry {
	modules: Registry;
	components: Registry;
	templates: Registry;
	nextToken(): string;
}

declare global {
	interface Window {
		app: AppRegistry;
		$$rootUrl: string;
		$$locale: Locale; // the locale script, loaded before the platform
		$$debug: boolean; // the shell script's
	}
}

let currentToken = 1603;

function nextToken(): string {
	return '' + currentToken++;
}

export const app: AppRegistry = { modules: {}, components: {}, templates: {}, nextToken };

export function require(module: string, noerror?: boolean): unknown {
	if (module in app.modules) {
		let am = app.modules[module];
		if (typeof am === 'function') {
			am = am(); // always singleton
			app.modules[module] = am;
		}
		return am;
	}
	if (noerror)
		return null;
	throw new Error('module "' + module + '" not found');
}

export function component(name: string, noerror?: boolean): unknown {
	if (name in app.components)
		return app.components[name];
	if (noerror)
		return {};
	throw new Error('component "' + name + '" not found');
}

function template(name: string, noerror?: boolean): unknown {
	if (name in app.templates)
		return app.templates[name];
	if (noerror)
		return {};
	throw new Error('template "' + name + '" not found');
}

// template.ts compiled as AMD: define(["require", "exports"], factory) returns what the module exports as default.
function define(_args: string[], factory: (rq: typeof require, exports: { default: unknown }) => void): unknown {
	const exports = { default: undefined as unknown };
	factory(require, exports);
	return exports.default;
}

Object.assign(window, { app, require, component, template, define });

const rootElem = document.querySelector<HTMLMetaElement>('meta[name=rootUrl]');
window.$$rootUrl = rootElem ? rootElem.content || '' : '';
