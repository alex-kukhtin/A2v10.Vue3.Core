// collection-view-server, collection-view-server-url (Net48 components/collectionviewplain.js), unchanged in behaviour:
// the pager, the sort and the filter of a server's array (its $ModelInfo); a change reloads the page's data. The
// client collection-view of the same file is not ported yet.
// Vue 3:
// - the prop is itemsSource: Vue 3 matches items-source to itemsSource only (Vue 2 also to ItemsSource); the code
//   reads ItemsSource, a computed;
// - Vue 2's $root was the page (base.js): $root.$emit('cwChange') and $root[prop] are the page's controller
//   (inject $page, page.ts): __cwChange, $data;
// - $on('sort') is gone: doSort is called by the data grid (the data-grid step).

import { defineComponent, type ComponentPublicInstance } from 'vue';
import { require, vocabulary } from './platform.js';

const utils = require('std:utils');
const period = require('std:period');
const eventBus = require('std:eventBus');

const eqlower = utils.text.equalNoCase;

function getModelInfoProp(src: any, propName: string) {
	if (!src) return undefined;
	const mi = src.$ModelInfo;
	if (!mi) return undefined;
	return mi[propName];
}

function setModelInfoProp(src: any, propName: string, value: unknown) {
	if (!src) return;
	const mi = src.$ModelInfo;
	if (!mi) return;
	mi[propName] = value;
}

function modelInfoToFilter(q: any, filter: any) {
	if (!q) return;
	for (const x in filter) {
		if (x in q) {
			const iv = filter[x];
			if (period.isPeriod(iv)) {
				filter[x] = iv.fromUrl(q[x]);
			}
			else if (utils.isDate(iv)) {
				filter[x] = utils.date.tryParse(q[x]);
			}
			else if (utils.isObjectExact(iv))
				iv.Id = q[x];
			else if (utils.isNumber(iv))
				filter[x] = +q[x];
			else {
				filter[x] = q[x];
			}
		}
	}
}

// server collection view
const collectionView = defineComponent({
	template: `
<div>
	<slot :ItemsSource="ItemsSource" :Pager="thisPager" :Filter="filter" :ParentCollectionView="parentCw">
	</slot>
</div>
`,
	inject: {
		page: { from: '$page', default: null }
	},
	props: {
		itemsSource: [Array, Object],
		initialFilter: Object,
		persistentFilter: Array
	},

	data() {
		return {
			filter: this.initialFilter as any,
			lockChange: true
		};
	},

	watch: {
		jsonFilter: {
			handler() {
				this.filterChanged();
			}
		},
		ItemsSource: {
			handler() {
				this.updateFilter();
			}
		}
	},

	computed: {
		ItemsSource(): any {
			return this.itemsSource;
		},
		jsonFilter(): string {
			return utils.toJson(this.filter);
		},
		thisPager(): ComponentPublicInstance {
			return this;
		},
		pageSize(): number {
			return getModelInfoProp(this.ItemsSource, 'PageSize');
		},
		dir(): string {
			return getModelInfoProp(this.ItemsSource, 'SortDir');
		},
		order(): string {
			return getModelInfoProp(this.ItemsSource, 'SortOrder');
		},
		offset(): number {
			return getModelInfoProp(this.ItemsSource, 'Offset');
		},
		pages(): number {
			const cnt = this.sourceCount;
			return Math.ceil(cnt / this.pageSize);
		},
		sourceCount(): number {
			if (!this.ItemsSource) return 0;
			return this.ItemsSource.$RowCount || 0;
		},
		parentCw(): unknown {
			// find parent collection view; none: the page (Vue 2: the page's root instance)
			let p = this.$parent;
			while (p && p.$.type !== collectionView)
				p = p.$parent;
			return p || this.page;
		}
	},
	methods: {
		$setOffset(offset: number) {
			if (this.offset === offset)
				return;
			setModelInfoProp(this.ItemsSource, 'Offset', offset);
			this.reload();
		},
		sortDir(order: string) {
			return eqlower(order, this.order) ? this.dir : undefined;
		},
		doSort(order: string) {
			if (eqlower(order, this.order)) {
				const dir = eqlower(this.dir, 'asc') ? 'desc' : 'asc';
				setModelInfoProp(this.ItemsSource, 'SortDir', dir);
			} else {
				setModelInfoProp(this.ItemsSource, 'SortOrder', order);
				setModelInfoProp(this.ItemsSource, 'SortDir', 'asc');
			}
			this.reload();
		},
		filterChanged() {
			if (this.lockChange) return;
			let mi = this.ItemsSource.$ModelInfo;
			if (!mi) {
				mi = { Filter: this.filter };
				this.ItemsSource.$ModelInfo = mi;
			}
			else {
				this.ItemsSource.$ModelInfo.Filter = this.filter;
			}
			if (this.persistentFilter && this.persistentFilter.length) {
				const parentProp = this.ItemsSource._path_;
				const propIx = parentProp.lastIndexOf('.');
				const propTop = parentProp.indexOf('[]');
				const lastProp = parentProp.substring(propIx + 1);
				const firstProp = parentProp.substring(0, propTop);
				for (const topElem of (this.page as any).$data[firstProp].$allItems()) {
					if (!topElem[lastProp].$ModelInfo)
						topElem[lastProp].$ModelInfo = mi;
					else {
						for (const pp of this.persistentFilter as string[]) {
							const te = topElem[lastProp];
							if (!utils.isEqual(te.$ModelInfo.Filter[pp], this.filter[pp])) {
								te.$ModelInfo.Filter[pp] = this.filter[pp];
								if (te.$loaded)
									te.$empty();
								te.$loaded = false;
							}
						}
					}
				}
			}
			if ('Offset' in mi)
				setModelInfoProp(this.ItemsSource, 'Offset', 0);
			this.reload();
		},
		reload() {
			(this.page as any).__cwChange(this.ItemsSource);
		},
		updateFilter() {
			// modelInfo to filter
			const mi = this.ItemsSource ? this.ItemsSource.$ModelInfo : null;
			if (!mi) return;
			const fi = mi.Filter;
			if (!fi) return;
			this.lockChange = true;
			for (const prop in this.filter) {
				if (prop in fi)
					this.filter[prop] = fi[prop];
			}
			this.$nextTick(() => {
				this.lockChange = false;
			});
		},
		__setFilter(props: { source: unknown, prop: string, value: any }) {
			if (this.ItemsSource !== props.source) return;
			if (period.isPeriod(props.value))
				this.filter[props.prop].assign(props.value);
			else
				this.filter[props.prop] = props.value;
		}
	},
	created() {
		// get filter values from modelInfo
		const mi = this.ItemsSource ? this.ItemsSource.$ModelInfo : null;
		if (mi) {
			modelInfoToFilter(mi.Filter, this.filter);
		}
		this.$nextTick(() => {
			this.lockChange = false;
		});
		eventBus.$on('setFilter', this.__setFilter);
	},
	beforeUnmount() {
		eventBus.$off('setFilter', this.__setFilter);
	}
});

vocabulary.component('collection-view-server', collectionView);
vocabulary.component('collection-view-server-url', collectionView);
