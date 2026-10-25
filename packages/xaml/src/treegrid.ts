// tree-grid (Net48 components/treegrid.js), unchanged in behaviour: a tree as table rows, an element's children
// (item) shown while it is $expanded; the rows, header and columns are the page's slots, given the grid as 'that'.
// Vue 3: <col> is void; $parent.$emit('sort') was heard by a collection view's $on('sort') only, else by none:
// $parent.doSort, when the parent has one.

import { defineComponent } from 'vue';
import { require, vocabulary } from './platform.js';

const utils = require('std:utils');
const eventBus = require('std:eventBus');

const debouncedUpdate = utils.debounce((pane: HTMLElement | undefined) => {
	if (!pane) return;
	const elem = pane.querySelector('.active');
	if (!elem) return;
	if (elem && elem.scrollIntoViewCheck)
		elem.scrollIntoViewCheck();
}, 300);

const gridTemplate = `
<table v-lazy="root">
	<colgroup><col class="fit c-m" v-if=isMarkCell /><slot name="columns" v-bind:that="that"></slot></colgroup>
	<thead><tr>
		<th class="c-m" v-if=isMarkCell :class=gridLines></th>
		<slot name="header" v-bind:that="that"></slot>
	</tr></thead>
	<tbody ref="pane">
		<tr v-for="(itm, ix) in rows" :class="rowClass(itm)"
				@click.stop="select(itm)" v-on:dblclick.prevent="dblClick($event, itm)">
			<td class="c-m" v-if=isMarkCell :class="rowMarkClass(itm)"></td>
			<slot name="row" v-bind:itm="itm.elem" v-bind:that="that"></slot>
		</tr>
	</tbody>
</table>
`;

interface Row {
	elem: any;
	level: number;
}

vocabulary.component('tree-grid', defineComponent({
	template: gridTemplate,
	props: {
		root: [Object, Array],
		item: String,
		folderStyle: String,
		doubleclick: Function,
		isFolder: String,
		mark: String,
		markStyle: String,
		gridLines: String
	},
	computed: {
		rows(): Row[] {
			const arr: Row[] = [];
			const collect = (pa: any[], lev: number) => {
				for (let i = 0; i < pa.length; i++) {
					const el = pa[i];
					const ch = el[this.item!];
					arr.push({ elem: el, level: lev });
					if (ch && el.$expanded)
						collect(ch, lev + 1);
				}
			};
			const root = this.root as any;
			if (Array.isArray(root))
				collect(root, 0);
			else
				collect(root[this.item!], 0);
			return arr;
		},
		sortColumn(): { dir: string, order: string } {
			const sort = {
				dir: '',
				order: ''
			};
			const mi = (this.root as any).$ModelInfo;
			if (!mi)
				return sort;
			sort.dir = (mi.SortDir || '').toLowerCase();
			sort.order = (mi.SortOrder || '').toLowerCase();
			return sort;
		},
		that(): unknown {
			return this;
		},
		isMarkCell(): boolean {
			return this.markStyle === 'marker' || this.markStyle === 'both';
		},
		isMarkRow(): boolean {
			return this.markStyle === 'row' || this.markStyle === 'both';
		}
	},
	methods: {
		toggle(itm: any) {
			itm.$select(this.root);
			if (itm.$expand) {
				if (!itm.$expanded)
					itm.$expand();
				else
					itm.$expanded = false;
			}
			else
				itm.$expanded = !itm.$expanded;
		},
		select(itm: Row) {
			eventBus.$emit('closeAllPopups');
			itm.elem.$select(this.root);
		},
		dblClick(evt: Event) {
			eventBus.$emit('closeAllPopups');
			evt.stopImmediatePropagation();
			window.getSelection()!.removeAllRanges();
			if (this.doubleclick)
				this.doubleclick();
		},
		hasChildren(itm: any) {
			const hc = utils.isDefined(itm.$hasChildren) && itm.$hasChildren;
			const ch = itm[this.item!];
			return hc || (ch && ch.length > 0);
		},
		isRowFolder(elm: any) {
			if (this.hasChildren(elm))
				return true;
			if (this.isFolder)
				return utils.simpleEval(elm, this.isFolder);
			return '';
		},
		rowMarkClass(itm: Row) {
			if (this.isMarkRow && this.mark)
				return utils.simpleEval(itm.elem, this.mark) + ' ' + this.gridLines;
			return this.gridLines;
		},
		rowMarker(itm: Row) {
			if (this.isMarkRow && this.mark)
				return utils.simpleEval(itm.elem, this.mark);
			return '';
		},
		rowClass(itm: Row) {
			let cls = `lev lev-${itm.level} ` + this.rowMarker(itm);
			if (itm.elem.$selected)
				cls += ' active';
			if (this.isRowFolder(itm.elem) && this.folderStyle !== 'none')
				cls += ' ' + this.folderStyle;
			return cls;
		},
		toggleClass(itm: any) {
			return itm.$expanded ? 'expanded' : 'collapsed';
		},
		columnClass(sort: string, fitcol: boolean) {
			const col = this.sortColumn;
			const cls = {
				sorted: false,
				fit: fitcol
			};
			if (sort.toLowerCase() === col.order) {
				cls.sorted = true;
			}
			return cls;
		},
		headerClass(sort?: string) {
			const col = this.sortColumn;
			if (col.order === (sort || '').toLowerCase())
				return col.dir;
			return null;
		},
		doSort(prop?: string) {
			prop = (prop || '').toLowerCase();
			const parent = this.$parent as any;
			if (parent && parent.doSort)
				parent.doSort(prop);
		}
	},
	updated() {
		debouncedUpdate(this.$refs['pane']);
	}
}));
