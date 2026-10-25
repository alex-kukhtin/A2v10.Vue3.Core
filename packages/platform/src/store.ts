// std:store (Net48 platform/routeplain.js), unchanged in behaviour: the tabbed shell's store of a page. A page
// creates one (base.js: store.create(this)); commit(name, state) calls its method: setroute, navigate, close,
// setnewid. Net48's storeOld (a Vuex-like store, never used) is not ported.

import { bus } from './bus.js';
import { require } from './modules.js';
import type { createUrl } from './url.js';

type UrlTools = ReturnType<typeof createUrl>;

const urlTools = () => require('std:url') as UrlTools;

function replaceUrlSearch(url: string, search?: string): string {
	const parts = url.split('?');
	return parts[0] + (search || '');
}

function replaceUrlQuery(url: string, query?: object): string {
	return replaceUrlSearch(url, urlTools().makeQueryString(query));
}

function makeBackUrl(url: string): string {
	const urlArr = url.split('/');
	if (urlArr.length === 5)
		return urlArr.slice(0, 3).join('/');
	else if (urlArr.length === 4)
		return urlArr.slice(0, 2).join('/');
	return url;
}

class StoreClass {
	root: unknown;
	parseQueryString: UrlTools['parseQueryString'];
	makeQueryString: UrlTools['makeQueryString'];
	replaceUrlSearch = replaceUrlSearch;
	replaceUrlQuery = replaceUrlQuery;
	makeBackUrl = makeBackUrl;
	route = '';
	query = {};

	constructor(elem: unknown) {
		this.root = elem;
		this.parseQueryString = urlTools().parseQueryString;
		this.makeQueryString = urlTools().makeQueryString;
	}

	commit(name: string, state?: unknown): void {
		(this as any)[name](state);
	}

	setroute(url: string): void {
		this.route = url;
	}

	navigate(url: unknown): void {
		bus.$emit('closeAllPopups');
		bus.$emit('modalCloseAll');
		bus.$emit('showSidePane', null);
		bus.$emit('navigateto', url);
	}

	close(): void {
		bus.$emit('closePlain', { root: this.root });
	}

	setnewid(to: { id: unknown, action?: string }): void {
		const oldRoute = this.route;
		const newRoute = urlTools().replaceSegment(oldRoute, to.id, to.action);
		this.route = newRoute;
		bus.$emit('setnewid', { from: oldRoute, to: newRoute });
	}
}

// The url tools are read when called: std:url comes up with the model, on its first require.
export const store = {
	create(elem: unknown): StoreClass {
		return new StoreClass(elem);
	},
	get parseQueryString() { return urlTools().parseQueryString; },
	get makeQueryString() { return urlTools().makeQueryString; },
	replaceUrlSearch,
	replaceUrlQuery,
	makeBackUrl,
	replaceBrowseUrl(_newUrl: string): void {
		// do nothing
	}
};
