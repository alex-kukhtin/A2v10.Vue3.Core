// A page as the server sends it: the HTML of its root element (from XAML) and a <script> whose body returns the
// page's descriptor (Vue3DataScripter's FOOTER). The template is the root element whole: the root carries bindings
// of its own (v-cloak, v-maximize, data-controller-attr), or is a component itself (collection-view).
// Nothing is registered and nothing mounted here: include renders what this returns, and drops it to close it.

import { markRaw, type Component } from 'vue';
import { bus } from './bus.js';
import { Controller, PAGE_GETTERS, PAGE_METHODS } from './controller/controller.js';
import type { createHttp } from './http.js';
import { component, require } from './modules.js';

export interface PageDescriptor {
	baseUrl: string;
	inDialog: boolean;
	isIndex: boolean;
	isSkipDataStack: boolean;
	createModel(): object;
}

export interface LoadedPage {
	url: string;
	template: string;
	descriptor: PageDescriptor;
}

// Null where Net48's load (services/http.js:126-207) never settled: a 401 (handled), an empty answer, a login page
// (it navigates away), an answer no longer wanted (isCurrent: include has asked for another url since).
// beginLoad and endLoad go as they went there.
export async function loadPage(url: string, hideIndicator: boolean | undefined, isCurrent: () => boolean): Promise<LoadedPage | null> {
	const http = require('std:http') as ReturnType<typeof createHttp>;
	bus.$emit('beginLoad');
	let html: string;
	try {
		html = await http.get(url, false, hideIndicator);
	} catch (err) {
		if (err === '__blank__')
			return null;
		bus.$emit('endLoad');
		throw err;
	}
	if (!html)
		return null;
	if (html.startsWith('<!DOCTYPE')) {
		// full page - may be login?
		window.location.assign('/');
		return null;
	}
	if (!isCurrent()) {
		bus.$emit('endLoad');
		return null;
	}
	try {
		const rdoc = new DOMParser().parseFromString(html, 'text/html');
		const root = rdoc.body.firstElementChild;
		if (!root) // Net48 read the id of null (B28)
			throw new Error(`page ${url}: no root element`);
		let descriptor: PageDescriptor | undefined;
		for (const script of rdoc.scripts) {
			if (script.type !== 'text/javascript') continue;
			if (script.src)
				throw new Error(`page ${url}: <script src> is not supported`);
			const rv = new Function('require', 'component', script.text)(require, component);
			if (rv !== undefined)
				descriptor = rv;
		}
		if (!descriptor)
			throw new Error(`page ${url}: its script returned no descriptor`);
		bus.$emit('endLoad');
		return { url, template: root.outerHTML, descriptor };
	} catch (err) {
		bus.$emit('endLoad');
		throw err;
	}
}

// The page's controller, by the page's component's instance.
const controllers = new WeakMap<object, Controller>();
const controllerOf = (vm: object) => controllers.get(vm)!;

// The page's component: its template, its model root as data, its controller (controller/controller.ts) created
// over the root as Vue made it reactive, and the controller's $-members under their names for the template.
// The page's life goes as Vue 2's did with base.js and the FOOTER: created (registerData, the bus, the store);
// mounted, then the host, __doInit__ (Model.load), what the loader set (the url, the query), then onMounted
// is told, with the controller. onMounted must not throw (it runs inside Vue's hook).
export function pageComponent(page: LoadedPage, onMounted: (page: Controller) => void): Component {
	const { url, template, descriptor } = page;
	const methods: Record<string, Function> = {};
	for (const name of PAGE_METHODS)
		methods[name] = function (this: object, ...args: unknown[]) {
			return (controllerOf(this) as any)[name](...args);
		};
	const computed: Record<string, () => unknown> = {
		utils: () => require('std:utils'),
		period: () => require('std:period')
	};
	for (const name of PAGE_GETTERS)
		computed[name] = function (this: object) {
			return (controllerOf(this) as any)[name];
		};
	return markRaw({
		template,
		data: () => descriptor.createModel(),
		computed,
		methods,
		// the first option Vue runs with the data there (after data, before created): the controller is made here
		provide(this: any) {
			const ctrl = new Controller(this.$data, descriptor);
			controllers.set(this, ctrl);
			return { $page: ctrl };
		},
		created(this: any) {
			const ctrl = controllerOf(this);
			ctrl.created();
			// base.js's watch: the Query element changed, the page reloads. Here, not in watch: Vue 3 makes those
			// before provide, and runs their getter at once.
			this.$watch('$jsonQuery', () => this.$nextTick(() => ctrl.$reload()));
		},
		mounted(this: any) {
			const ctrl = controllerOf(this);
			const el = this.$el as Element;
			ctrl.mounted(el);
			this.$data._host_ = {
				$viewModel: ctrl,
				$ctrl: ctrl.__createController__()
			};
			ctrl.__doInit__(descriptor.baseUrl);
			ctrl.__loaded__(url);
			if (el && el.classList && el.classList.contains('modal')) {
				const dca = el.getAttribute('data-controller-attr');
				if (dca)
					bus.$emit('modalSetAttribites', dca, ctrl);
			}
			onMounted(ctrl);
		},
		beforeUnmount(this: object) {
			controllerOf(this).beforeDestroy();
		},
		unmounted(this: object) {
			controllerOf(this).destroyed();
		}
	});
}
