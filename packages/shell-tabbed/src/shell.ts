// std:shellPlain (A2v10.Core Scripts/shell.js): the tabbed shell, unchanged in behaviour. A tab is a url; its page
// is shown by a2-include, and the shell keeps the page (tab.root) to ask it ($isDirty, $close, __requery…).
// For Vue 3: the shell provides itself as $shell (the navbar asked through $parent.$emit, an instance event
// Vue 3 dropped); Vue.nextTick is nextTick; the custom option `store` (unused) is dropped. Its markup is the
// server's (Default.tabbed.vue3.cshtml), compiled at start (index.ts).

import { component, require } from './platform.js';
import { defineComponent, nextTick } from 'vue';

const MAX_OPENED_TABS = 10;

let tabKey = 77;

interface Tab {
	title: string;
	url: string;
	query: string;
	cnt: number;
	o: number;
	loaded: boolean;
	key: number;
	root: any;
	parentUrl: string;
	reload: number;
	debug: boolean;
}

interface Dialog {
	url?: string;
	prms?: unknown;
	wrap: boolean;
	rd?: boolean;
	promise?: Promise<unknown>;
	resolve?: (result: unknown) => void;
	instance?: any;
	attrs?: any;
	[key: string]: unknown;
}

const tabUrlKey = (tab: Tab) => `${tab.url}:${tab.key}`;

function getClosestLi(ev: Event): Element | null {
	if (!ev.target) return null;
	return (ev.target as Element).closest('li');
}

function getTabUrl(tab: Tab | null): string {
	if (!tab) return '';
	const host = `${window.location.protocol}//${window.location.host}`;
	const concatChar = tab.url.includes('?') ? '&' : '?';
	let encQuery = '';
	if (tab.query)
		encQuery = `${concatChar}_xq=${encodeURIComponent(tab.query)}`;
	return `${host}${tab.url}${encQuery}`;
}

function intersectLines(t: { l: number, r: number }, c: { l: number, r: number }): boolean {
	let dx = 0;
	if (t.r > c.r)
		dx = c.r - t.l;
	else if (t.l < c.l)
		dx = t.r - c.l;
	return dx > 0;
}

// The fields Vue 2 kept on the instance, out of reactivity: Vue 3 does not expose data keys that start with '_'.
interface Own {
	__dataStack__: any[];
	_dragContext: { tabs: any[], currentTab: number, pointTab: number, left: number } | null;
}
const own = (vm: object) => vm as unknown as Own;

const shellPlain = defineComponent({
	provide() {
		return { $shell: this };
	},
	data() {
		return {
			tabs: [] as Tab[],
			closedTabs: [] as Tab[],
			activeTab: null as Tab | null,
			maxUsed: 0,
			modals: [] as Dialog[],
			modalRequeryUrl: '',
			traceEnabled: require('std:log').traceEnabled() as boolean,
			debugShowTrace: false,
			debugShowModel: false,
			dataCounter: 0,
			sidePaneUrl: '',
			tabPopupOpen: false,
			navigatingUrl: '',
			homePageTitle: '',
			homeRoot: null as any,
			homeLoaded: false,
			lockRoute: false,
			requestsCount: 0,
			contextTabKey: 0,
			newVersionAvailable: false,
			movedTab: null as { tab: Tab, x: number, l: number, pos: number } | null
		};
	},
	components: {
		'a2-modal': component('std:modal'),
		'a2-toastr': component('std:toastr')
	},
	computed: {
		modelStack(): any[] { return own(this).__dataStack__; },
		hasModals(): boolean { return this.modals.length > 0; },
		sidePaneVisible(): boolean { return !!this.sidePaneUrl; },
		storageKey(): string { const self = this as any; return `${self.appData.appId}_${self.appData.userId}_tabs`; },
		processing(): boolean { return !this.hasModals && this.requestsCount > 0; },
		canPopupClose(): boolean { return this.contextTabKey > 10; /* 10 - home */ },
		canPopupCloseRight(): boolean { return !!this.contextTabKey && this.tabs.some(v => v.key > this.contextTabKey); },
		canReopenClosed(): boolean { return this.closedTabs.length > 0; },
		hasModified(): boolean { return this.tabs.some(t => t.root && t.root.$isDirty); },
		maxTabWidth(): string { return `calc((100% - 50px) / ${this.tabs.length})`; }
	},
	methods: {
		replaceState(_tab: Tab | null) {
			//window.history.replaceState(null, null, tab ? tab.url : '/');
		},
		navigate(u1: { url: string, title: string, query?: string }) {
			if (u1.url.indexOf('{genrandom}') >= 0) {
				const randomString = Math.random().toString(36).substring(2);
				u1.url = u1.url.replace('{genrandom}', randomString);
			}
			let tab = this.tabs.find(tab => tab.url == u1.url);
			if (!tab) {
				let parentUrl = '';
				if (this.activeTab)
					parentUrl = this.activeTab.url || '';
				tab = { title: u1.title, url: u1.url, query: u1.query || '', cnt: 1, o: this.tabs.length + 1, loaded: true, key: tabKey++, root: null, parentUrl: parentUrl, reload: 0, debug: false };
				this.tabs.push(tab);
				tab = this.tabs[this.tabs.length - 1]; // the reactive one
				const cti = this.closedTabs.findIndex(t => t.url === u1.url);
				if (cti >= 0)
					this.closedTabs.splice(cti, 1);
			}
			if (tab.query !== u1.query) {
				tab.query = u1.query!;
				tab.reload += 1;
			}
			tab.loaded = true;
			this.activeTab = tab;
			this.useTab(tab);
			if (this.tabs.length > MAX_OPENED_TABS) {
				const mt = this.tabs.toSorted((a, b) => b.cnt - a.cnt);
				if (mt.length) {
					const ix = this.tabs.indexOf(mt[0]);
					this.tabs.splice(ix, 1);
				}
			}
			this.storeTabs();
		},
		navigateUrl(url: string, query?: string) {
			this.navigatingUrl = url;
			this.navigate({ url: url, title: '', query: query || '' });
		},
		navigateTo(to: { url: string }) {
			this.navigatingUrl = to.url;
			this.navigate({ url: to.url, title: '' });
		},
		dummy() { },
		reloadApplication() {
			window.location.reload();
		},
		setDocTitle(title: string) {
			let tab = this.activeTab;
			if (!tab && this.navigatingUrl)
				tab = this.tabs.find(tab => tab.url === this.navigatingUrl) || null;
			if (tab) {
				tab.title = title;
				document.title = title;
			} else {
				this.homePageTitle = title;
				document.title = title;
			}
		},
		setNewId(route: { from: string, to: string }) {
			const tab = this.tabs.find(tab => tab.url === route.from);
			if (!tab) return;
			this.lockRoute = true;
			tab.url = route.to;
			if (tab.root)
				tab.root.__tabUrl__ = tabUrlKey(tab);
			nextTick(() => {
				this.lockRoute = false;
			});
			this.storeTabs();
		},
		async tabLoadError(url: string, err: string) {
			if (err) err = err.replace('\\n', '\n');
			const tab = this.activeTab || this.tabs.find(t => t.url == url);
			if (tab) {
				if (err.indexOf('UI:') === 0)
					await this._alert(err.substring(3));
				else
					alert(err);
				if (tab.root && tab.root.$onError) {
					tab.root.$onError();
					return;
				}
				this.closeTab(tab);
			} else
				alert(err);
		},
		tabLoadComplete(page: { src: string, root: any }) {
			if (page) {
				const tab = this.activeTab || this.tabs.find(t => t.url == page.src);
				if (tab) {
					this.replaceState(tab);
					tab.root = page.root;
					document.title = tab.title;
					if (page.root) {
						page.root.__tabUrl__ = tabUrlKey(tab);
						page.root.$store.commit('setroute', tab.url);
					}
				} else if (page.src === '/_home/index/0')
					this.homeRoot = page.root;
			}
			this.navigatingUrl = '';
		},
		isTabActive(tab: Tab): boolean {
			return tab === this.activeTab;
		},
		isHomeActive(): boolean {
			return !this.activeTab;
		},
		clickTooltip(tab: Tab) {
			const url = getTabUrl(tab);
			navigator.clipboard.writeText(url);
		},
		tabTooltip(tab: Tab): string {
			return `${tab.url}`;
		},
		fitText(t: string): string {
			if (!t) return 'untitled';
			return t.length > 30 ? t.substring(0, 30) + '…' : t;
		},
		tabTitle(tab: Tab): string {
			let star = '';
			if (tab.root && tab.root.$isDirty)
				star = '* ';
			return star + tab.title;
		},
		tabSource(tab: Tab): string | null {
			return tab.loaded ? (tab.url + (tab.query || '')) : null;
		},
		homeSource(): string | null {
			return this.homeLoaded ? '/_home/index/0' : null;
		},
		useTab(tab: Tab) {
			this.tabs.filter(t => t != tab).forEach(t => t.cnt += 1);
			tab.cnt = 1;
			this.maxUsed = Math.max(...this.tabs.map(t => t.cnt));
		},
		selectHome(noStore?: boolean) {
			this.homeLoaded = true;
			this.activeTab = null;
			document.title = this.homePageTitle;
			this.replaceState(null);
			if (noStore)
				return;
			this.storeTabs();
		},
		selectTab(tab: Tab, noStore?: boolean, ev?: MouseEvent) {
			require('std:eventBus').$emit('closeAllPopups');
			if (ev && ev.ctrlKey) {
				tab.debug = true;
				return;
			}
			tab.loaded = true;
			if (this.activeTab != tab)
				this.useTab(tab);
			this.activeTab = tab;
			document.title = tab.title;
			this.replaceState(tab);
			if (noStore)
				return;
			this.storeTabs();
		},
		reopenTab(tab: Tab) {
			require('std:eventBus').$emit('closeAllPopups');
			this.navigate(tab);
		},
		closeTabFromStore(state: { root: any }) {
			if (!state || !state.root) return;
			const route = state.root.__tabUrl__;
			const tabIndex = this.tabs.findIndex(t => tabUrlKey(t) === route);
			if (tabIndex >= 0)
				this.removeTab(tabIndex);
		},
		closeTab(tab: Tab) {
			require('std:eventBus').$emit('closeAllPopups');
			const tabIndex = this.tabs.indexOf(tab);
			if (tabIndex == -1)
				return;
			if (tab.root && tab.root.$close)
				tab.root.$close();
			else
				this.removeTab(tabIndex);
		},
		removeTabs(ta: Tab[]) {
			if (!ta || !ta.length) return;
			ta.forEach(tab => {
				const ix = this.tabs.indexOf(tab);
				if (ix == -1) return;
				const rt = this.tabs.splice(ix, 1);
				if (rt.length) {
					this.closedTabs.unshift(rt[0]);
					if (this.closedTabs.length > MAX_OPENED_TABS)
						this.closedTabs.pop();
				}
			});
			if (!this.tabs.length)
				this.selectHome(true);
			else {
				const currentTab = this.tabs.find(t => t.key === this.contextTabKey);
				if (this.activeTab !== currentTab)
					this.selectTab(currentTab!, true);
			}
			this._resortTabs();
			this.storeTabs();
		},
		removeTab(tabIndex: number) {
			const currentTab = this.tabs[tabIndex];
			const parent = this.tabs.find(t => t.url === currentTab.parentUrl);
			if (parent)
				this.selectTab(parent, true);
			if (this.isTabActive(currentTab)) {
				if (tabIndex > 0)
					this.selectTab(this.tabs[tabIndex - 1], true);
				else if (this.tabs.length > 1)
					this.selectTab(this.tabs[tabIndex + 1], true);
				else
					this.selectHome(true);
			}
			const rt = this.tabs.splice(tabIndex, 1);
			if (rt.length) {
				this.closedTabs.unshift(rt[0]);
				if (this.closedTabs.length > MAX_OPENED_TABS)
					this.closedTabs.pop();
			}
			this._resortTabs();
			this.storeTabs();
		},
		clearLocalStorage() {
			const keys: string[] = [];
			for (const f in window.localStorage) {
				if (window.localStorage.hasOwnProperty(f) && f.endsWith('_tabs')) {
					if (f != this.storageKey)
						keys.push(f);
				}
			}
			if (keys.length > 10)
				keys.forEach(f => window.localStorage.removeItem(f));
		},
		storeTabs() {
			this.maxUsed = Math.max(...this.tabs.map(t => t.cnt));
			const mapTab = (t: Tab) => { return { title: t.title, url: t.url, cnt: t.cnt, query: t.query || '', parentUrl: t.parentUrl }; };
			const ix = this.tabs.indexOf(this.activeTab!);
			const tabs = JSON.stringify({
				index: ix,
				tabs: this.tabs.map(mapTab),
				closedTabs: this.closedTabs.map(mapTab)
			});
			window.localStorage.setItem(this.storageKey, tabs);
		},
		restoreTabs(path: string) {
			const tabs = window.localStorage.getItem(this.storageKey);
			if (!tabs) {
				this.selectHome(true);
				return;
			}
			try {
				const elems = JSON.parse(tabs);
				let ix = elems.index;
				if (path !== '/') {
					const f = elems.tabs.findIndex((t: Tab) => t.url === path);
					if (f >= 0)
						ix = f;
				}
				const len = elems.tabs.length;
				for (let i = 0; i < len; i++) {
					const t = elems.tabs[i];
					const loaded = ix === i;
					if (loaded)
						this.navigatingUrl = t.url;
					this.tabs.push({
						title: t.title, url: t.url, query: t.query,
						cnt: t.cnt || len - i - 1, o: i + 1, loaded, key: tabKey++, root: null, parentUrl: t.parentUrl, reload: 0, debug: false
					});
				}
				for (let i = 0; i < elems.closedTabs.length; i++) {
					const t = elems.closedTabs[i];
					this.closedTabs.push({ title: t.title, url: t.url, query: t.query, cnt: 1, loaded: true, key: tabKey++ } as Tab);
				}
				if (ix >= 0 && ix < this.tabs.length)
					this.activeTab = this.tabs[ix];
				else
					this.selectHome(true);
			} catch (err) {
				// a stored state that does not parse is dropped
			}
			this.maxUsed = Math.max(...this.tabs.map(t => t.cnt));
		},
		toggleTabPopup() {
			require('std:eventBus').$emit('closeAllPopups');
			this.tabPopupOpen = !this.tabPopupOpen;
		},
		// context menu
		tabsContextMenu(ev: MouseEvent) {
			require('std:eventBus').$emit('closeAllPopups');
			this.contextTabKey = 0;
			const li = (ev.target as Element).closest('li');
			if (li)
				this.contextTabKey = +(li.getAttribute('tab-key') || 0);
			const menu = document.querySelector<HTMLElement>('#ctx-tabs-popup')!;
			const br = (menu.parentNode as Element).getBoundingClientRect();
			const mw = 242; // menu width
			let lp = ev.clientX - br.left;
			if (lp + mw > br.right)
				lp -= mw;
			const style = menu.style;
			style.top = (ev.clientY - br.top) + 'px';
			style.left = lp + 'px';
			menu.classList.add('show');
		},
		popupClose() {
			const t = this.tabs.find(t => t.key === this.contextTabKey);
			if (t) this.closeTab(t);
		},
		copyTabUrl() {
			const t = this.tabs.find(t => t.key === this.contextTabKey);
			if (!t) return;
			window.navigator.clipboard.writeText(getTabUrl(t));
			if (t.root && t.root.$toast)
				t.root.$toast('URL copied to clipboard');
		},
		reopenClosedTab() {
			if (this.closedTabs.length <= 0) return;
			const t = this.closedTabs[0];
			this.reopenTab(t);
		},
		_resortTabs() {
			const arr = this.tabs;
			arr.sort((a, b) => a.o - b.o);
			for (let i = 0; i < arr.length; i++)
				arr[i].o = i + 1;
			this.storeTabs();
		},
		offsetLeft(t: Tab): string {
			const mt = this.movedTab;
			if (!mt || mt.tab !== t)
				return '0';
			return mt.pos + 'px';
		},
		isDragged(t: Tab): boolean {
			const mt = this.movedTab;
			return !!mt && mt.tab === t;
		},
		willClose(t: Tab): boolean {
			return this.tabs.length >= MAX_OPENED_TABS && t.cnt === this.maxUsed;
		},
		pointerDown(ev: PointerEvent, t: Tab) {
			if ((ev.target as Element).closest('.close')) return; // the close button is not a drag handle
			const li = getClosestLi(ev);
			if (!li) return;
			(ev.target as Element).setPointerCapture(ev.pointerId);
			const cr = li.getBoundingClientRect();
			this.movedTab = { tab: t, x: ev.x - cr.left, l: cr.left, pos: 0 };
			own(this)._dragContext = { tabs: [], currentTab: -1, pointTab: -1, left: 0 };
		},
		pointerUp(ev: PointerEvent) {
			if (!this.movedTab) return;
			(ev.target as Element).releasePointerCapture(ev.pointerId);
			this.movedTab = null;
			own(this)._dragContext = null;
			this._resortTabs();
		},
		pointerMove(ev: PointerEvent) {
			const mt = this.movedTab;
			if (!mt) return;

			let offset = ev.x - mt.l - mt.x;
			mt.pos = offset;

			const li = getClosestLi(ev);
			if (!li)
				return;
			const cr = li.getBoundingClientRect();
			const hw = cr.width / 4;

			if (Math.abs(offset) < hw)
				return;

			this._createOrderedTabs();

			const testTab = { l: ev.x - mt.x, r: ev.x - mt.x + cr.width };

			if (!this._testOrderedTabs(testTab))
				return;

			const nl = this._swapOrderedTabs(testTab);
			if (!nl) return;
			mt.l = nl.l;
			offset = ev.x - mt.l - mt.x;
			mt.pos = offset;
		},
		_createOrderedTabs() {
			const dc = own(this)._dragContext;
			if (!dc) return;
			if (dc.tabs.length) return;
			if (!this.tabs.length) return;

			const findAttr = (t: Tab) => {
				return (this.$refs.tab as Element[]).find(el => el.getAttribute('tab-key') == '' + t.key);
			};

			const otabs = this.tabs.map(t => ({
				tab: t,
				ref: findAttr(t)!, w: 0
			}));
			const hcr = (this.$refs.home as Element).getBoundingClientRect();
			dc.left = hcr.right;
			for (let i = 0; i < otabs.length; i++) {
				const t = otabs[i];
				if (t.tab === this.movedTab!.tab)
					dc.currentTab = i;
				const cr = t.ref.getBoundingClientRect();
				t.w = cr.width;
			}
			dc.tabs = otabs;
			return otabs;
		},
		_testOrderedTabs(testTab: { l: number, r: number }): boolean {
			const dc = own(this)._dragContext!;
			if (!this.movedTab) return false;
			const otabs = dc.tabs;
			if (!otabs || !otabs.length) return false;
			let l = dc.left;
			for (let i = 0; i < otabs.length; i++) {
				const t = otabs[i];
				if (t.tab === this.movedTab.tab)
					dc.currentTab = i;
				if (intersectLines(testTab, { l, r: l + t.w })) {
					dc.pointTab = i;
				}
				l += t.w;
			}
			return dc.currentTab != -1 &&
				dc.pointTab != -1 &&
				dc.currentTab != dc.pointTab;
		},
		_swapOrderedTabs(testTab: { l: number, r: number }): { l: number, i: number } | undefined {
			const dc = own(this)._dragContext;
			if (!dc) return;
			const tabs = dc.tabs;
			if (!tabs.length) return;
			const tab1 = tabs[dc.currentTab];
			const tab2 = tabs[dc.pointTab];
			if (tab1 === tab2) return;
			if (tab1.tab.o === tab2.tab.o)
				return;
			const tmp = tab1.tab.o;
			tab1.tab.o = tab2.tab.o;
			tab2.tab.o = tmp;
			let l = dc.left;
			const neo = tabs.toSorted((a, b) => a.tab.o - b.tab.o);
			dc.tabs = neo;
			for (let i = 0; i < neo.length; i++) {
				const t = neo[i];
				if (l >= testTab.l) {
					dc.pointTab = i;
					return { l, i };
				}
				l += t.w;
			}
			return { l, i: neo.length };
		},
		popupCloseOther() {
			if (!this.contextTabKey) return;
			const tabs = this.tabs.filter(t => t.key !== this.contextTabKey);
			this.removeTabs(tabs);
		},
		popupCloseRight() {
			if (!this.contextTabKey) return;
			const tabs = this.tabs.filter(t => t.key > this.contextTabKey);
			this.removeTabs(tabs);
		},
		popupCloseAll() {
			this.selectHome(true);
			const tabs = this.tabs.filter(t => t.key > 10);
			this.removeTabs(tabs);
		},
		showModal(modal: string, prms: any) {
			const urlTools = require('std:url');
			const id = require('std:utils').getStringId(prms ? prms.data : null);
			const raw = prms && prms.raw;
			const direct = prms && prms.direct;
			const root = window.$$rootUrl;
			let url = urlTools.combine(root, '/_dialog', modal, id);
			if (raw)
				url = urlTools.combine(root, modal, id);
			else if (direct)
				url = urlTools.combine(root, '/_dialog', modal);
			url = component('std:store').replaceUrlQuery(url, prms.query);
			const dlg: Dialog = { title: 'dialog', url: url, prms: prms.data, wrap: false, rd: prms.rd };
			dlg.promise = new Promise(function (resolve) {
				dlg.resolve = resolve;
			});
			prms.promise = dlg.promise;
			this.modals.push(dlg);
			this.setupWrapper(this.modals[this.modals.length - 1]);
		},
		setupWrapper(dlg: Dialog) {
			this.modalRequeryUrl = '';
			setTimeout(() => {
				dlg.wrap = true;
			}, 50); // same as modal
		},
		_requery(vm: any, data: any) {
			if (!vm) return;
			if (vm.__requery) {
				vm.__requery();
			}
			if (!vm.__tabUrl__) return;
			const t = this.tabs.find(t => tabUrlKey(t) === vm.__tabUrl__);
			if (!t) return;
			const run = data ? data.Run : false;
			if (data)
				data.Run = undefined;
			if (!t.loaded)
				return;
			t.url = require('std:url').replaceUrlQuery(t.url, data);
			if (t.root)
				t.root.__tabUrl__ = tabUrlKey(t);
			t.reload += run ? 7 : 1;
			this.storeTabs();
		},
		_isModalRequery(arg: { url: string, result: boolean }) {
			if (arg.url && this.modalRequeryUrl && this.modalRequeryUrl === arg.url)
				arg.result = true;
		},
		_modalRequery(baseUrl: string) {
			const dlg = this._findRealDialog();
			if (!dlg) return;
			const inst = dlg.instance; // include instance
			if (inst && inst.modalRequery) {
				if (baseUrl)
					dlg.url = baseUrl;
				this.modalRequeryUrl = dlg.url!;
				inst.modalRequery();
			}
		},
		_modalSetAttribites(attr: string, instance: any) {
			if (!attr || !instance) return;
			const dlg = this._findRealDialog();
			if (!dlg) return;
			dlg.attrs = instance.__parseControllerAttributes(attr);
		},
		_modalCreated(instance: any) {
			// include instance!
			const dlg = this._findRealDialog();
			if (!dlg) return;
			dlg.instance = instance;
		},
		_activeTabUrl(s: { url: string }): boolean {
			if (!s) return false;
			s.url = getTabUrl(this.activeTab);
			return true;
		},
		_eventModalClose(result: any) {
			if (!this.modals.length) return;

			const dlg = this.modals[this.modals.length - 1];

			const closeImpl = (closeResult: unknown) => {
				const dlg = this.modals.pop()!;
				if (closeResult)
					dlg.resolve!(closeResult);
			};

			if (!dlg.attrs) {
				closeImpl(result);
				return;
			}

			if (dlg.attrs.alwaysOk)
				result = true;

			if (dlg.attrs.canClose) {
				const canResult = dlg.attrs.canClose();
				if (canResult === true)
					closeImpl(result);
				else if (canResult.then) {
					// Core: result.then, the dialog's result, not the delegate's promise (B33)
					canResult.then(function (innerResult: unknown) {
						if (innerResult === true)
							closeImpl(result);
						else if (innerResult) {
							closeImpl(innerResult);
						}
					});
				}
				else if (canResult)
					closeImpl(canResult);
			} else {
				closeImpl(result);
			}
		},
		_eventModalCloseAll() {
			while (this.modals.length) {
				const dlg = this.modals.pop()!;
				dlg.resolve!(false);
			}
		},
		_alert(msg: string): Promise<unknown> {
			const dlgData = {
				promise: null as Promise<unknown> | null, data: {
					message: msg, style: 'alert'
				}
			};
			this._eventConfirm(dlgData);
			return dlgData.promise!;
		},
		_eventConfirm(prms: any) {
			const dlg = prms.data;
			dlg.wrap = false;
			dlg.promise = new Promise(function (resolve) {
				dlg.resolve = resolve;
			});
			prms.promise = dlg.promise;
			this.modals.push(dlg);
			this.setupWrapper(this.modals[this.modals.length - 1]);
		},
		_pageReloaded(path: string) {
			if (!path) return;
			const seg = path.split('?');
			if (seg.length < 2) return;
			const tab = this.tabs.find(t => '/_page' + t.url === seg[0]);
			if (!tab) return;
			let q = '';
			if (seg[1])
				q = '?' + seg[1];
			if (tab.query === q) return;
			this.lockRoute = true;
			tab.query = q;
			nextTick(() => {
				this.lockRoute = false;
			});
			this.storeTabs();
		},
		_eventToParentTab(ev: { event: string, source: any, data: unknown }) {
			const tab = this.tabs.find(t => t.root === ev.source);
			if (!tab || !tab.root || !tab.parentUrl) return;
			const ptab = this.tabs.find(t => t.url === tab.parentUrl);
			if (ptab && ptab.root)
				ptab.root.$data.$emit(ev.event, ev.data);
		},
		_findRealDialog(): Dialog | null {
			// skip alerts, confirm, etc
			for (let i = this.modals.length - 1; i >= 0; --i) {
				const md = this.modals[i];
				if (md.rd) {
					return md;
				}
			}
			return null;
		},
		debugTrace() {
			if (!window.$$debug) return;
			this.debugShowModel = false;
			this.debugShowTrace = !this.debugShowTrace;
		},
		debugModel() {
			if (!window.$$debug) return;
			this.debugShowTrace = false;
			this.debugShowModel = !this.debugShowModel;
		},
		debugClose() {
			this.debugShowModel = false;
			this.debugShowTrace = false;
		},
		registerData(component: any, out: { caller: unknown }) {
			const stack = own(this).__dataStack__;
			this.dataCounter += 1;
			if (component) {
				if (stack.length > 0)
					out.caller = stack[0];
				stack.unshift(component);
			}
			else if (stack.length > 1)
				stack.shift();
		},
		updateModelStack(root: any) {
			const stack = own(this).__dataStack__;
			if (stack.length > 0 && stack[0] === root)
				return;
			if (!root || !root.$data)
				return;
			stack.splice(0);
			stack.unshift(root);
			this.dataCounter += 1; // refresh
		},
		showSidePane(url: string | null) {
			if (!url) {
				this.sidePaneUrl = '';
			} else {
				const newurl = '/_page' + url;
				if (this.sidePaneUrl === newurl)
					this.sidePaneUrl = '';
				else
					this.sidePaneUrl = newurl;
			}
		},
		__clickOutside() {
			this.tabPopupOpen = false;
		}
	},
	watch: {
		traceEnabled(val: boolean) {
			require('std:log').enableTrace(val);
		},
		activeTab(newtab: Tab | null) {
			if (newtab && newtab.root)
				this.updateModelStack(newtab.root);
			else
				this.updateModelStack(this.homeRoot);
		}
	},
	mounted() {
		require('std:popup').registerPopup(this.$el);
		// home page here this.tabs.push({})
		this.$el._close = this.__clickOutside;
		this.clearLocalStorage();
		const menu = (this as any).menu;
		if (!menu || !menu.length)
			this.selectHome(false); // store empty tabs
		else {
			this.restoreTabs(window.location.pathname);
			if (window.location.pathname !== '/') {
				let p = window.location.pathname;
				let q = '';
				const usp = new URLSearchParams(window.location.search);
				if (usp.has('_xq')) {
					q = usp.get('_xq')!;
					usp.delete('_xq');
				}
				window.history.replaceState(undefined, '', '/');
				const sp = usp.toString();
				if (sp)
					p += '?' + sp;
				// path = url + normal query, query from _xq!
				this.navigateUrl(p, q);
			}
		}
	},
	created() {
		const eventBus = require('std:eventBus');
		const popup = require('std:popup');
		own(this).__dataStack__ = [];
		popup.startService();
		eventBus.$on('navigateto', this.navigateTo);
		eventBus.$on('setdoctitle', this.setDocTitle);
		eventBus.$on('setnewid', this.setNewId);
		eventBus.$on('closeAllPopups', popup.closeAll);
		eventBus.$on('modal', this.showModal);
		eventBus.$on('modalCreated', this._modalCreated);
		eventBus.$on('modalSetAttribites', this._modalSetAttribites);
		eventBus.$on('requery', this._requery);
		eventBus.$on('isModalRequery', this._isModalRequery);
		eventBus.$on('modalRequery', this._modalRequery);
		eventBus.$on('modalClose', this._eventModalClose);
		eventBus.$on('modalCloseAll', this._eventModalCloseAll);
		eventBus.$on('registerData', this.registerData);
		eventBus.$on('showSidePane', this.showSidePane);
		eventBus.$on('confirm', this._eventConfirm);
		eventBus.$on('closePlain', this.closeTabFromStore);
		eventBus.$on('pageReloaded', this._pageReloaded);
		eventBus.$on('toParentTab', this._eventToParentTab);
		eventBus.$on('activeTabUrl', this._activeTabUrl);
		eventBus.$on('closeAllTabs', this.popupCloseAll);
		eventBus.$on('beginRequest', () => {
			this.requestsCount += 1;
			(window as any).__requestsCount__ = this.requestsCount;
		});
		eventBus.$on('endRequest', () => {
			this.requestsCount -= 1;
			(window as any).__requestsCount__ = this.requestsCount;
		});
		eventBus.$on('checkVersion', (ver: { app: string, module: string }) => {
			const appData = (this as any).appData;
			if (ver && appData && (ver.app !== appData.version || ver.module !== appData.moduleVersion))
				this.newVersionAvailable = true;
		});

		require('std:signalR').startService();

		window.addEventListener('beforeunload', (ev) => {
			if (!this.hasModified)
				return;
			ev.preventDefault();
			if (ev) ev.returnValue = true;
			return true;
		});
	}
});

export { shellPlain };
