// include, a2-include, a2-queued-include (Net48 components/includeplain.js): where a page is shown. include: a tab,
// a dialog, the side pane (the shell's markup); a2-include and a2-queued-include: a page inside a page (XAML's
// Include). A page is a value: the loader returns it, <component :is> renders it, dropping it closes it. A reload
// keeps the shown page until the new one is there: Vue 2 kept its DOM, so nothing blinked.

import { defineComponent, type Component } from 'vue';
import { bus } from './bus.js';
import { require } from './modules.js';
import { loadPage, pageComponent, staticComponent } from './page.js';
import type { createUrl } from './url.js';
import { component } from './vocabulary.js';

type UrlTools = ReturnType<typeof createUrl>;
type Utils = { isEqual(a: unknown, b: unknown): boolean, isObjectExact(v: unknown): boolean, isDefined(v: unknown): boolean };

const urlTools = () => require('std:url') as UrlTools;
const utils = () => require('std:utils') as Utils;

interface Host {
	page: Component | null;
}

// The last load each host asked for: an answer to an older one is dropped.
const lastLoad = new WeakMap<object, number>();

// Loads url into the host. Resolves with the page (its controller) once it is mounted, as Vue 2's load resolved once
// the page's script had mounted it; with null at once for a static page, as it resolved with no script found.
// What the host does then (loaded, complete) runs in this chain, and a throw there reaches the host's error, as it
// did (.then(loaded).catch(error)). Never settles for an answer dropped.
function show(host: Host, url: string, hideIndicator: boolean | undefined): Promise<object | null> {
	const id = (lastLoad.get(host) || 0) + 1;
	lastLoad.set(host, id);
	return loadPage(url, hideIndicator, () => lastLoad.get(host) === id).then(page =>
		new Promise<object | null>(resolve => {
			if (!page || lastLoad.get(host) !== id)
				return;
			if ('descriptor' in page)
				host.page = pageComponent(page, resolve);
			else {
				host.page = staticComponent(page);
				resolve(null);
			}
		}));
}

const PAGE_TEMPLATE = '<component v-if="page" :is="page"/>';

component('include', defineComponent({
	template: `<div :class="implClass">${PAGE_TEMPLATE}</div>`,
	props: {
		src: String,
		cssClass: String,
		needReload: Boolean,
		insideDialog: Boolean,
		done: Function,
		queued: Boolean,
		hideIndicator: Boolean
	},
	data() {
		return {
			loading: true,
			currentUrl: '',
			page: null as Component | null
		};
	},
	methods: {
		loaded(): void {
			this.loading = false;
			if (this.insideDialog)
				bus.$emit('modalCreated', this);
			if (this.done)
				this.done();
		},
		load(url: string): void {
			show(this, url, this.hideIndicator).then(() => this.loaded()).catch(this.error);
		},
		requery(): void {
			// Do not set loading. Avoid blinking
			if (this.currentUrl)
				this.load(this.currentUrl);
		},
		modalRequery(): void {
			if (!this.insideDialog) return;
			setTimeout(() => {
				this.requery();
			}, 1);
		},
		error(msg: unknown): void {
			if (msg instanceof Error)
				msg = msg.message;
			else
				msg = msg || '';
			const text = msg as string;
			if (this.insideDialog)
				bus.$emit('modalClose', false);
			if (text.indexOf('UI:') === 0) {
				const dlgData = {
					promise: null, data: {
						message: text.substring(3).replace('\\n', '\n'),
						style: 'alert'
					}
				};
				bus.$emit('confirm', dlgData);
			} else
				alert(text);
		}
	},
	computed: {
		implClass(): string {
			return `include ${this.cssClass || ''} ${this.loading ? 'loading' : ''}`;
		}
	},
	mounted() {
		if (this.src) {
			this.currentUrl = this.src;
			this.load(this.src);
		}
	},
	watch: {
		src(newUrl: string, oldUrl: string) {
			const ut = urlTools();
			if (this.insideDialog) {
				// Dialog. No need to reload always.
				this.currentUrl = newUrl;
			}
			else if (newUrl.split('?')[0] === oldUrl.split('?')[0]) {
				// Only the search has changed. No need to reload.
				this.currentUrl = newUrl;
			}
			else if (ut.idChangedOnly(newUrl, oldUrl)) {
				// Id has changed after save. No need to reload.
				this.currentUrl = newUrl;
			} else if (ut.idOrCopyChanged(newUrl, oldUrl)) {
				// Id has changed after save. No need to reload.
				this.currentUrl = newUrl;
			}
			else {
				this.loading = true; // hides the current view
				this.currentUrl = newUrl;
				this.page = null;
				this.load(newUrl);
			}
		},
		needReload(val: boolean) {
			// works like a trigger
			if (val) this.requery();
		}
	}
}));

// The url of a2-include: a page under /_page, its argument ({0} in the source, or the last segment), its data
// as the query, run=true when the reload jumped by 7.
function includeUrl(source: string, arg: any, dat: unknown, addRun: boolean): string {
	const ut = urlTools();
	arg = arg || '';
	if (source.indexOf('{0}') >= 0) {
		if (utils().isObjectExact(arg)) {
			if (!utils().isDefined(arg.Id))
				console.error('Id is not defined for source object');
			arg = arg.Id;
		}
		return ut.combine('_page', source.replace('{0}', arg));
	}
	let url = ut.combine('_page', source, arg);
	if (dat)
		url += ut.makeQueryString(dat);
	if (addRun) {
		if (url.indexOf('?') !== -1)
			url += '&run=true';
		else
			url += '?run=true';
	}
	return url;
}

component('a2-include', defineComponent({
	template: `<div class="a2-include">${PAGE_TEMPLATE}</div>`,
	props: {
		source: String,
		arg: null,
		dat: null,
		complete: Function,
		lock: Boolean,
		reload: Number,
		onError: Function
	},
	data() {
		return {
			needLoad: 0,
			addRun: false,
			page: null as Component | null
		};
	},
	methods: {
		loaded(data: any): void {
			if (data)
				data.__requery = () => {
					this.needLoad += 1;
				};
			if (this.complete)
				this.complete({ src: this.source, root: data });
		},
		error(msg: unknown): void {
			if (msg instanceof Error)
				msg = msg.message;
			if (this.onError)
				this.onError(this.source, msg);
			else
				alert(msg);
		},
		makeUrl(): string {
			return includeUrl(this.source!, this.arg, this.dat, this.addRun);
		},
		load(url: string): void {
			// hideIndicator is not a prop here: Net48 read this.hideIndicator, always undefined (B29)
			show(this, url, undefined).then(handle => this.loaded(handle)).catch(this.error);
		}
	},
	watch: {
		source(newVal: unknown, oldVal: unknown) {
			if (this.lock) return;
			if (utils().isEqual(newVal, oldVal)) return;
			this.needLoad += 1;
		},
		arg(newVal: unknown, oldVal: unknown) {
			if (this.lock) return;
			if (utils().isEqual(newVal, oldVal)) return;
			this.needLoad += 1;
		},
		dat(newVal: unknown, oldVal: unknown) {
			if (this.lock) return;
			if (utils().isEqual(newVal, oldVal)) return;
			this.needLoad += 1;
		},
		reload(newVal: number, oldVal: number) {
			this.addRun = false;
			if (newVal - oldVal == 7)
				this.addRun = true;
			this.needLoad += 1;
		},
		needLoad() {
			this.load(this.makeUrl());
		}
	},
	mounted() {
		if (this.source)
			this.load(this.makeUrl());
	}
}));

// a2-queued-include: pages loaded one after another, document-wide. A failed load stops the queue for good, and
// a load that never settles holds it (Net48 http.js doQueue: B30).
const queue: { url: string, host: Host }[] = [];
let processing = false;

function enqueue(url: string, host: Host): void {
	queue.push({ url, host });
	if (!processing)
		doQueue();
}

async function doQueue(): Promise<void> {
	if (!queue.length)
		return;
	processing = true;
	while (queue.length > 0) {
		const el = queue.shift()!;
		await show(el.host, el.url, undefined);
	}
	processing = false;
}

component('a2-queued-include', defineComponent({
	template: `<div class="a2-include">${PAGE_TEMPLATE}</div>`,
	props: {
		source: String,
		arg: null,
		dat: null
	},
	data() {
		return {
			needLoad: 0,
			page: null as Component | null
		};
	},
	methods: {
		makeUrl(): string {
			const ut = urlTools();
			let url = ut.combine('_page', this.source, this.arg || '0');
			if (this.dat)
				url += ut.makeQueryString(this.dat);
			return url;
		}
	},
	watch: {
		source(newVal: unknown, oldVal: unknown) {
			if (utils().isEqual(newVal, oldVal)) return;
			this.needLoad += 1;
		},
		arg(newVal: unknown, oldVal: unknown) {
			if (utils().isEqual(newVal, oldVal)) return;
			this.needLoad += 1;
		},
		dat(newVal: unknown, oldVal: unknown) {
			if (utils().isEqual(newVal, oldVal)) return;
			this.needLoad += 1;
		},
		needLoad() {
			enqueue(this.makeUrl(), this);
		}
	},
	mounted() {
		if (this.source)
			enqueue(this.makeUrl(), this);
	}
}));
