// $ModelInfo: the paging, sort and filter state of an array that the server pages (std:modelInfo).
// The server sends it in the data's $ModelInfo by array name; the platform reads it to request a
// page (get) and writes a query back into it (copyfromQuery). A Period* filter is a TPeriod.

import type { Periods } from '../locale/period.js';

const DEFAULT_PAGE_SIZE = 20;

export function createModelInfo(period: Periods) {

	function copyfromQuery(mi: any, q: any): void {
		if (!mi) return;
		const psq: Record<string, unknown> = { PageSize: q.pageSize, Offset: q.offset, SortDir: q.dir, SortOrder: q.order, GroupBy: q.group };
		for (const p in psq)
			mi[p] = psq[p];
		if (mi.Filter) {
			for (const p in mi.Filter)
				mi.Filter[p] = q[p];
		}
	}

	// The query of a page request; a filter value that is a function is called with this.
	function get(this: any, mi: any): any {
		if (!mi) return undefined;
		const x: Record<string, unknown> = { pageSize: mi.PageSize, offset: mi.Offset, dir: mi.SortDir, order: mi.SortOrder, group: mi.GroupBy };
		if (mi.Filter) {
			for (const p in mi.Filter) {
				let fv = mi.Filter[p];
				if (fv && fv.call)
					fv = fv.call(this);
				x[p] = fv;
			}
		}
		return x;
	}

	// Filter dates the server wrapped as "\/"…"\/" become Dates.
	function reconcile(mi: any): void {
		if (!mi) return;
		if (!mi.Filter) return;
		for (const p in mi.Filter) {
			const fv = mi.Filter[p];
			if (typeof fv === 'string' && fv.startsWith('\"\\/\"'))
				mi.Filter[p] = new Date(fv.substring(4, fv.length - 4));
		}
	}

	function reconcileAll(m: any): void {
		if (!m) return;
		for (const p in m)
			reconcile(m[p]);
	}

	function checkPeriod(obj: any): any {
		const f = obj.Filter;
		if (!f) return obj;
		Object.keys(f).filter(k => k.startsWith('Period')).forEach(k => {
			const p = f[k];
			if (period.like(p))
				f[k] = new period.constructor(p);
		});
		return obj;
	}

	// The root's __modelInfo (the server's system values: ReadOnly, Copy, Levels…), and each
	// array's $ModelInfo from the data.
	function setModelInfo(root: any, info: any, rawData: any): void {
		root.__modelInfo = info ? info : { PageSize: DEFAULT_PAGE_SIZE };
		const mi = rawData.$ModelInfo;
		if (!mi) return;
		reconcileAll(mi);
		for (const p in mi)
			root[p].$ModelInfo = checkPeriod(mi[p]);
	}

	function setModelInfoFilter(this: any, prop: string, val: any): void {
		if (period.isPeriod(val))
			this.Filter[prop].assign(val);
		else
			this.Filter[prop] = val;
	}

	// Root's _setModelInfo_: the $ModelInfo of one array (elem, or the root's first by the data).
	function setRootModelInfo(this: any, elem: any, data: any): any {
		if (!data.$ModelInfo) return;
		for (const p in data.$ModelInfo) {
			if (!elem) elem = this[p];
			elem.$ModelInfo = checkPeriod(data.$ModelInfo[p]);
			elem.$ModelInfo.$setFilter = setModelInfoFilter;
			return elem.$ModelInfo;
		}
	}

	// Root's $createModelInfo: an array's $ModelInfo, unless it has one.
	function createElemModelInfo(elem: any, raw: any): any {
		if (!elem.$ModelInfo) {
			elem.$ModelInfo = checkPeriod(raw);
			elem.$ModelInfo.$setFilter = setModelInfoFilter;
		}
		return elem.$ModelInfo;
	}

	// Root's _findRootModelInfo: the $ModelInfo of its first array that has one.
	function findRootModelInfo(this: any): any {
		for (const p in this._meta_.props) {
			const x = this[p];
			if (x && x.$ModelInfo)
				return x.$ModelInfo;
		}
		return null;
	}

	// Gives a root (or the root type's prototype) its $ModelInfo members.
	function setModelInfoForRoot(elem: any): void {
		elem.$createModelInfo = createElemModelInfo;
		elem._setModelInfo_ = setRootModelInfo;
		elem._findRootModelInfo = findRootModelInfo;
	}

	return {
		copyfromQuery,
		get,
		reconcile,
		reconcileAll,
		setModelInfoForRoot,
		setModelInfo
	};
}

export type ModelInfo = ReturnType<typeof createModelInfo>;
