// What the shell takes from the platform (a2v10-core.js, loaded before): the registries of app.js and the
// vocabulary. The std:* modules come untyped, as the Net48 shell took them.

import { attach, component as platformComponent, require as platformRequire, vocabulary, type AppRegistry } from '@a2v10/platform';

export { attach, vocabulary };

export const app: AppRegistry = window.app;

export function require(name: string): any {
	return platformRequire(name);
}

export function component(name: string): any {
	return platformComponent(name);
}
