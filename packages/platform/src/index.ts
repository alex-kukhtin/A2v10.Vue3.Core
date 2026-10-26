// The client platform on Vue 3, delivered inside a2v10-core.js as a2v10.platform. Loading it registers the
// runtime compiler with Vue, sets the globals of app.js (modules.ts), the std:* modules (std.ts) and window.Vue
// for the application's scripts (facade.ts).
// Vue is exported for the scripts built apart (the shell, an engine): one runtime for the document.

import './polyfills.js';
import './modules.js';
import './std.js';
import './include.js';
import './facade.js';

export * as Vue from 'vue';
export { compileTemplate } from './compiler.js';
export { require, component } from './modules.js';
export type { AppRegistry } from './modules.js';
export * as vocabulary from './vocabulary.js';
export { attach } from './app.js';
// for a renderer of pages other than include (the tests: test/trace/base.port.js)
export { pageComponent, type ScriptedPage } from './page.js';
export { Controller } from './controller/controller.js';
