// window.Vue for the application's own scripts (/_shell/appscripts), written against Vue 2's globals: what of that
// API has a meaning in the document's one app. Vue.component and Vue.directive register into the vocabulary
// (before the shell's start or after); nextTick, set, delete, observable are Vue 3's. A second app (new Vue,
// Vue.extend) and filters do not exist in Vue 3: they say so, by name.

import { nextTick, reactive, version, type Component, type Directive } from 'vue';
import { component, directive } from './vocabulary.js';

function gone(what: string, instead: string): never {
	throw new Error(`${what} is not supported on Vue 3: ${instead}`);
}

function Vue(): never {
	return gone('new Vue', 'the document has one app, the shell\'s');
}

Object.assign(Vue, {
	version,
	component(name: string, def: Component): Component {
		component(name, def);
		return def;
	},
	directive(name: string, def: Directive): Directive {
		directive(name, def);
		return def;
	},
	nextTick,
	set(target: Record<string, unknown>, key: string, value: unknown): unknown {
		target[key] = value;
		return value;
	},
	delete(target: Record<string, unknown>, key: string): void {
		delete target[key];
	},
	observable: reactive,
	extend(): never {
		return gone('Vue.extend', 'register the options object itself');
	},
	filter(): never {
		return gone('Vue.filter', 'filters were removed; call a method');
	}
});

(window as any).Vue = Vue;
