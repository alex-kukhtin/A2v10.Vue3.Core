// std:url (Net48 services/url.js), unchanged in behaviour: the platform's urls (/_page, /_dialog, /_blob…), the
// query string of model values, the segments a save or a copy replaces.

import type { createModel } from '@a2v10/model';

type Model = ReturnType<typeof createModel>;

export function createUrl(utils: Model['utils'], period: Model['period']) {

	return {
		combine,
		makeQueryString,
		parseQueryString,
		normalizeRoot,
		idChangedOnly,
		idOrCopyChanged,
		makeBaseUrl,
		parseUrlAndQuery,
		replaceUrlQuery,
		createUrlForNavigate,
		firstUrl: '',
		encodeUrl: encodeURIComponent,
		helpHref,
		replaceSegment,
		removeFirstSlash,
		isNewPath,
		splitCommand,
		blobUrl
	};

	// '' + elem: undefined and null become 'undefined' and 'null', kept (B26).
	function normalize(elem: unknown): string {
		let s = '' + elem || '';
		s = s.replace(/\\/g, '/');
		if (s.startsWith('/'))
			s = s.substring(1);
		if (s.endsWith('/'))
			s = s.substring(0, s.length - 1);
		return s;
	}

	function normalizeRoot(path: string): string {
		const root = window.$$rootUrl;
		if (root && path.startsWith(root))
			return path.substring(root.length);
		return path;
	}

	function removeFirstSlash(url: any): any {
		if (url && url.startsWith && url.startsWith('/'))
			return url.substring(1);
		return url;
	}

	function combine(...args: unknown[]): string {
		return '/' + args.map(normalize).filter(x => !!x).join('/');
	}

	function toUrl(obj: any): string {
		if (!utils.isDefined(obj) || obj === null) return '';
		if (utils.isDate(obj)) {
			return utils.format(obj, 'DateUrl');
		} else if (period.isPeriod(obj)) {
			return obj.format('DateUrl');
		} else if (Array.isArray(obj)) {
			return obj.map(x => x.Id).join(',');
		} else if (utils.isObjectExact(obj)) {
			if (obj.constructor.name === 'Object') {
				if (!utils.isDefined(obj.Id))
					console.error('Id is not defined for Filter object');
				return '' + (obj.Id || '');
			} else if (!utils.isDefined(obj.$id)) {
				console.error(`$id is not defined for ${obj.constructor.name}`);
			}
			return '' + (obj.$id || '0');
		}
		return '' + obj;
	}

	function isEmptyForUrl(obj: unknown): boolean {
		if (!obj) return true;
		const objUrl = toUrl(obj);
		if (!objUrl) return true;
		if (objUrl === '0') return true;
		return false;
	}

	function makeQueryString(obj?: any): string {
		if (!obj) return '';
		if (!utils.isObjectExact(obj)) return '';

		const esc = encodeURIComponent;

		// skip special (starts with '_' or '$')
		const query = Object.keys(obj)
			.filter(k => !k.startsWith('_') && !k.startsWith('$') && !isEmptyForUrl(obj[k]))
			.map(k => esc(k) + '=' + esc(toUrl(obj[k])))
			.join('&');
		return query ? '?' + query : '';
	}

	function parseQueryString(str: string): Record<string, string> {
		const obj: Record<string, string> = {};
		str.replace(/\??([^=&]+)=([^&]*)/g, function (m, key, value) {
			obj[decodeURIComponent(key)] = '' + decodeURIComponent(value);
			return m;
		});
		return obj;
	}

	function isNewPathArr(arr: string[]): boolean {
		const ai = arr[arr.length - 1];
		return ai === 'new' || ai === '0';
	}

	function idChangedOnly(newUrl: string, oldUrl: string): boolean {
		const n1 = (newUrl || '').split('?')[0];
		const o1 = (oldUrl || '').split('?')[0];
		const ns = n1.split('/');
		const os = o1.split('/');
		if (ns.length !== os.length)
			return false;
		if (isNewPathArr(os) && !isNewPathArr(ns)) {
			if (ns.slice(0, ns.length - 1).join('/') === os.slice(0, os.length - 1).join('/'))
				return true;
		}
		return false;
	}

	function idOrCopyChanged(newUrl: string, oldUrl: string): boolean {
		const n1 = (newUrl || '').split('?')[0];
		const o1 = (oldUrl || '').split('?')[0];
		const ns = n1.split('/');
		const os = o1.split('/');
		if (ns.length !== os.length)
			return false;
		// remove id
		ns.pop();
		os.pop();
		if (ns.pop() === 'edit' && os.pop() === 'copy') {
			return ns.join('/') === os.join('/');
		}
		return false;
	}

	function makeBaseUrl(url: string): string {
		const x = (url || '').split('/');
		const len = x.length;
		if (len >= 6)
			return x.slice(2, len - 2).join('/');
		return url;
	}

	function parseUrlAndQuery(url: string, querySrc?: any): { url: string, query: Record<string, string> } {
		let query: Record<string, string> = {};
		for (const p in querySrc) {
			if (p.startsWith('_') || p.startsWith('$')) continue;
			query[p] = toUrl(querySrc[p]); // all values are string
		}
		const rv = { url: url, query: query };
		if (url.indexOf('?') !== -1) {
			const a = url.split('?');
			rv.url = a[0];
			// first from url then from query
			rv.query = Object.assign({}, parseQueryString(a[1]), query);
		}
		return rv;
	}

	function replaceUrlQuery(url: string | null | undefined, query?: any): string {
		if (!url)
			url = window.location.pathname + window.location.search;
		const pu = parseUrlAndQuery(url, query);
		return pu.url + makeQueryString(pu.query);
	}

	function createUrlForNavigate(url: string, data?: any): string {
		let urlId = data || 'new';
		let qs = '';
		if (utils.isDefined(urlId.$id))
			urlId = urlId.$id;
		else if (utils.isObjectExact(urlId)) {
			urlId = data.Id;
			// a copy: data is often a bound object (a filter of $href), and a deleted Id is gone from the model
			const rest = Object.assign({}, data);
			delete rest['Id'];
			qs = makeQueryString(rest);
			if (!utils.isDefined(urlId))
				urlId = 'new';
		}
		if (url.endsWith('new') && urlId === 'new')
			urlId = '';
		if (url.indexOf('{0}') >= 0)
			return url.replace('{0}', urlId);
		// special behaviour for main menu urls
		if (url.split('/').length === 3 && urlId === 'new')
			urlId = '';
		return combine(url, urlId) + qs;
	}

	function helpHref(path?: string): string {
		const helpUrlElem = document.querySelector<HTMLMetaElement>('meta[name=helpUrl]');
		if (!helpUrlElem || !helpUrlElem.content) {
			console.warn('help url is not specified');
			return '';
		}
		return helpUrlElem.content + (path || '');
	}

	function isDialogPath(url: string): boolean {
		return url.startsWith('/_dialog/');
	}

	function replaceSegment(url: string, id: unknown, action?: string): string {
		// only the path: a value in the query may hold '/' itself (?Base=/document/order)
		const qpos = url.indexOf('?');
		const path = qpos === -1 ? url : url.substring(0, qpos);
		const query = qpos === -1 ? '' : url.substring(qpos);
		const parts: unknown[] = path.split('/');
		if (isDialogPath(path)) {
			parts.pop();
			if (id)
				parts.push(id);
		} else {
			if (action) parts.pop();
			if (id) parts.pop();
			if (action) parts.push(action);
			if (id) parts.push(id);
		}
		return parts.join('/') + query;
	}

	function isNewPath(url: string): boolean {
		url = url.split('?')[0]; // first segment
		if (!url) return false;
		if (url.indexOf('/new') !== -1)
			return true;
		if (isDialogPath(url) && url.endsWith('/0'))
			return true;
		return false;
	}

	function splitCommand(url: string): { action: string | undefined, url: string } {
		const seg = url.split('/');
		const action = seg.pop();
		return {
			action,
			url: seg.join('/')
		};
	}

	// a blob of the model: $id and the token by its meta name; an empty reference has $id = 0
	function blobUrl(blob: any): string | undefined {
		if (!blob || !blob.$id)
			return undefined;
		return combine(window.$$rootUrl, '_blob', blob.$id) + makeQueryString({ token: blob[blob._meta_.$token] });
	}
}
