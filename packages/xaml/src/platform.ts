// What the XAML components take from the platform (a2v10-core.js, loaded before): the vocabulary they register into,
// app.js's registries (app.components: the bases the applications extend) and the std:* modules, untyped, as the
// Net48 components took them.

import { require as platformRequire, vocabulary, type AppRegistry } from '@a2v10/platform';

export { vocabulary };

export const app: AppRegistry = window.app;

export function require(name: string): any {
	return platformRequire(name);
}
