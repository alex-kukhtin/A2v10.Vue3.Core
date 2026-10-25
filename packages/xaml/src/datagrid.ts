// data-grid, data-grid-column (Net48 components/datagrid.js), unchanged in behaviour: columns register with their grid
// ($parent.$addColumn), rows and cells render the grid's items, grouped or not, sorted by the collection view or
// locally. Some ideas from https://github.com/andrewcourtice/vuetiful/tree/master/src/components/datatable
// Groupings: "v-show" on a line is much faster than "v-if" on an entire template.
// Vue 3:
// - the cell is a functional component: a function of its props; h takes flat props;
// - the cell's validator and command link were component objects made at each render; Vue 2 cached their compiled
//   templates by text, this compiler keeps no cache: they are made once, the command's arguments are props;
// - <template v-for> carries the key (Vue 3 refuses it on the children); <col> is void;
// - a ref in v-for is an array in no promised order: the selected row is found by its index;
// - $parent.$emit('sort') was heard by the collection view's $on('sort', doSort): $parent.doSort;
// - $scopedSlots is $slots; Vue.set is an assignment; $root ($data, inDialog) is the page's controller (inject).

import { defineComponent, h, type FunctionalComponent, type VNode } from 'vue';
import { require, vocabulary } from './platform.js';

const utils = require('std:utils');
const log = require('std:log');
const eventBus = require('std:eventBus');
const locale = window.$$locale as any;

const eqlower = utils.text.equalNoCase;

const dataGridTemplate = `
<div v-lazy="itemsSource" :class="{'data-grid-container':true, 'fixed-header': fixedHeader, 'bordered': border, 'compact': compact}" :test-id="testId">
	<div class="data-grid-header-border" v-if="fixedHeader" />
	<div :class="{'data-grid-body': true, 'fixed-header': fixedHeader}">
	<div class="data-grid-empty" v-if="$isEmpty">
		<slot name="empty" />
	</div>
	<table :class="cssClass">
		<colgroup>
			<col v-if="isMarkCell" class="fit"/>
			<col v-if="isRowDetailsCell" class="fit" />
			<col v-bind:class="columnClass(col, colIndex)" v-bind:style="columnStyle(col)" v-for="(col, colIndex) in columns" :key="colIndex"/>
		</colgroup>
		<thead>
			<tr v-show="isHeaderVisible">
				<th v-if="isMarkCell" class="marker"><div v-if=fixedHeader class="h-fill"></div><div v-if=fixedHeader class="h-holder">&#160;</div></th>
				<th v-if="isRowDetailsCell" class="details-marker"><div v-if="fixedHeader" class="h-holder">&#160;</div></th>
				<slot></slot>
			</tr>
		</thead>
		<template v-if="isGrouping">
			<tbody>
				<template v-for="(g, gIndex) of $groups" :key="gIndex">
					<tr v-if="isGroupGroupVisible(g)" :class="'group lev-' + g.level">
						<td @click.prevent='toggleGroup(g)' :colspan="groupColumns">
						<span :class="{expmark: true, expanded: g.expanded}" />
						<span class="grtitle" v-text="groupTitle(g)" />
						<span v-if="isGroupCountVisible(g)" class="grcount" v-text="g.count" /></td>
					</tr>
					<template v-for="(row, rowIndex) in g.items" :key="gIndex + ':' + rowIndex">
						<data-grid-row v-show="isGroupBodyVisible(g)" :group="true" :level="g.level" :cols="columns" :row="row" :index="rowIndex" :mark="mark" ref="row"  :is-item-active="isItemActive" :hit-item="hitItem"/>
						<data-grid-row-details v-if="rowDetailsShow(row)" v-show="isGroupBodyVisible(g)" :cols="columns.length" :row="row" :mark="mark">
							<slot name="row-details" :row="row"></slot>
						</data-grid-row-details>
					</template>
				</template>
			</tbody>
		</template>
		<template v-else>
			<tbody>
				<template v-for="(item, rowIndex) in $items" :key="rowIndex">
					<data-grid-row :cols="columns" :row="item" :index="rowIndex" :mark="mark" ref="row" :is-item-active="isItemActive" :hit-item="hitItem"/>
					<data-grid-row-details v-if="rowDetailsShow(item)" :cols="columns.length" :row="item" :mark="mark">
						<slot name="row-details" :row="item"></slot>
					</data-grid-row-details>
				</template>
			</tbody>
		</template>
		<slot name="footer"></slot>
	</table>
	</div>
</div>
`;

/* @click.prevent disables checkboxes & other controls in cells
<td class="group-marker" v-if="group"></td>
*/
const dataGridRowTemplate = `
<tr @click="rowSelect(row)" :class="rowClass()" v-on:dblclick.prevent="doDblClick" ref="tr" @mousedown="mouseDown(row)">
	<td v-if="isMarkCell" class="marker">
		<div :class="markClass"></div>
	</td>
	<td v-if="detailsMarker" class="details-marker" @click.prevent="toggleDetails">
		<i v-if="detailsIcon" class="ico" :class="detailsExpandClass" />
	</td>
	<data-grid-cell v-for="(col, colIndex) in cols" :key="colIndex" :row="row" :col="col" :index="index" />
</tr>`;

const dataGridRowDetailsTemplate = `
<tr v-if="visible()" class="row-details">
	<td v-if="isMarkCell" class="marker">
		<div :class="markClass"></div>
	</td>
	<td :colspan='totalCols' class="details-cell">
		<div class="details-wrapper"><slot></slot></div>
	</td>
</tr>
`;

/**
	icon on header!!!
	<i :class="\'ico ico-\' + icon" v-if="icon"></i>
 */
const dataGridColumnTemplate = `
<th :class="cssClass" @click.prevent="doSort">
	<div class="h-fill" v-if="fixedHeader" v-text="headerText">
	</div>
	<div class="h-holder">
		<slot><label v-if=checkAll class="like-checkbox" :class="checkAllClass" @click=doCheckAll><span></span></label>
			<span v-else v-text="headerText"></span>
		</slot>
	</div>
</th>
`;

const dataGridColumn = defineComponent({
	name: 'data-grid-column',
	template: dataGridColumnTemplate,
	inject: {
		page: { from: '$page', default: null }
	},
	props: {
		header: String,
		content: String,
		dataType: String,
		hideZeros: Boolean,
		format: String,
		icon: String,
		bindIcon: String,
		id: String,
		align: { type: String, default: 'left' },
		editable: { type: Boolean, default: false },
		noPadding: { type: Boolean, default: false },
		validate: String,
		sort: { type: Boolean, default: undefined },
		sortProp: String,
		small: { type: Boolean, default: undefined },
		bold: String, //{ type: Boolean, default: undefined },
		mark: String,
		done: String,
		controlType: String,
		width: String,
		minWidth: String,
		fit: Boolean,
		backColor: String,
		wrap: String,
		command: Object,
		maxChars: Number,
		lineClamp: Number,
		colCssClass: String,
		checkAll: String
	},
	created() {
		(this.$parent as any).$addColumn(this);
	},
	unmounted() {
		(this.$parent as any).$removeColumn(this);
	},
	computed: {
		grid(): any {
			return this.$parent;
		},
		sortProperty(): string | undefined {
			return this.sortProp || this.content;
		},
		dir(): string | undefined {
			return this.grid.sortDir(this.sortProperty);
		},
		fixedHeader(): boolean {
			return this.grid.fixedHeader;
		},
		isSortable(): boolean {
			if (!this.sortProperty)
				return false;
			return typeof this.sort === 'undefined' ? this.grid.isGridSortable : this.sort;
		},
		isUpdateUrl(): boolean {
			return !(this.page as any).inDialog;
		},
		template(): ((props: object) => VNode[]) | null {
			return this.id ? this.grid.$slots[this.id] : null;
		},
		classAlign(): string {
			return this.align !== 'left' ? (' text-' + this.align).toLowerCase() : '';
		},
		checkAllClass(): string | undefined {
			const state = this.grid.$checkAllState(this.checkAll);
			if (state === 1)
				return 'checked'; // indeterminate';
			else if (state === 2)
				return 'indeterminate';
			return undefined;
		},
		cssClass(): string {
			let cssClass = this.classAlign;
			if (this.isSortable) {
				cssClass += ' sort';
				if (this.dir)
					cssClass += ' ' + this.dir;
			}
			if (this.checkAll)
				cssClass += ' check-all';
			return cssClass;
		},
		headerText(): string {
			return this.header || '\xa0';
		},
		evalOpts(): object {
			return {
				hideZeros: this.hideZeros,
				format: this.format
			};
		}
	},
	methods: {
		doSort() {
			if (!this.isSortable)
				return;
			this.grid.doSort(this.sortProperty);
		},
		doCheckAll() {
			if (!this.checkAll) return;
			this.grid.$checkAll(this.checkAll);
		},
		cellCssClass(row: any, editable: boolean) {
			let cssClass = this.classAlign;

			if (this.mark) {
				const mark = utils.simpleEval(row, this.mark);
				if (mark)
					cssClass += ' ' + mark;
			}
			if (editable && this.controlType !== 'checkbox')
				cssClass += ' cell-editable';

			function addClassBool(bind: string | undefined, cls: string) {
				if (!bind) return;
				if (bind === 'true')
					cssClass += cls;
				else if (bind.startsWith('{')) {
					const prop = bind.substring(1, bind.length - 1);
					if (utils.simpleEval(row, prop))
						cssClass += cls;
				}
			}

			if (this.wrap)
				cssClass += ' ' + this.wrap;
			if (this.small)
				cssClass += ' small';
			addClassBool(this.bold, ' bold');

			if (this.colCssClass)
				cssClass += ' ' + this.colCssClass;

			return cssClass.trim();
		}
	}
});

vocabulary.component('data-grid-column', dataGridColumn);

// what the cell renders by a column's controlType 'validator', its validate, its command
const cellValid = {
	props: ['item', 'col'],
	template: '<span><i v-if="item.$invalid" class="ico ico-error"></i></span>'
};

const cellValidator = {
	props: ['path', 'item'],
	template: '<validator :path="path" :item="item"></validator>'
};

// column command -> hyperlink; args: arg1..arg4 as the cell normalized them
const cellCommand = defineComponent({
	props: ['row', 'col', 'args'],
	/*@click.prevent, no stop*/
	template: '<a @click.prevent="doCommand($event)" :href="getHref()"><i v-if="hasIcon" :class="iconClass" class="ico"></i><span v-text="eval(row, col.content, col.dataType, col.evalOpts)"></span></a>',
	computed: {
		hasIcon(): boolean { return this.col.icon || this.col.bindIcon || this.col.done; },
		iconClass(): string | null {
			const col = this.col;
			const icoSingle = !col.content ? ' ico-single' : '';
			if (col.bindIcon)
				return 'ico-' + utils.eval(this.row, col.bindIcon) + icoSingle;
			else if (col.done)
				return (utils.eval(this.row, col.done) ? 'ico-success-outline-green' : 'ico-warning-outline-yellow') + icoSingle;
			else if (col.icon)
				return 'ico-' + col.icon + icoSingle;
			return null;
		}
	},
	methods: {
		doCommand() {
			this.col.command.cmd(...this.args);
		},
		eval: utils.eval,
		getHref() {
			const col = this.col;
			if (!col.command) return null;
			if (col.command.isDialog)
				return '';
			if (col.command.cmd.name.indexOf('$exec') !== -1)
				return '';
			const [arg1, arg2] = this.args;
			let id = arg2;
			if (utils.isObjectExact(arg2))
				id = arg2.$id;
			return arg1 + '/' + id;
		}
	}
});

const dataGridCell: FunctionalComponent<{ row: any, col: any, index: number }> = (props) => {
	const tag = 'td';
	const row = props.row;
	const col = props.col;
	const ix = props.index;
	const cellProps: Record<string, any> = {
		class: col.cellCssClass(row, col.editable || col.noPadding)
	};

	if (col.template) {
		const vNodes = col.template({ row: row, col: col });
		return h(tag, cellProps, vNodes);
	}

	if (col.controlType === 'validator') {
		cellProps.class = { 'cell-validator': true };
		return h(tag, cellProps, [h(cellValid, { item: row, col: col })]);
	}

	if (!col.content && !col.icon && !col.bindIcon && !col.done) {
		return h(tag, cellProps);
	}

	function normalizeArg(arg: any, doEval?: boolean) {
		if (utils.isBoolean(arg) || utils.isNumber(arg) || utils.isObjectExact(arg))
			return arg;
		arg = arg || '';
		if (arg === 'this')
			arg = row;
		else if (arg.startsWith('{')) {
			arg = arg.substring(1, arg.length - 1);
			if (arg.indexOf('.') !== -1)
				arg = utils.eval(row, arg);
			else {
				if (!(arg in row))
					throw new Error(`Property '${arg}' not found in ${row.constructor.name} object`);
				arg = row[arg];
			}
		} else if (arg && doEval) {
			arg = utils.eval(row, arg, col.dataType, col.evalOpts);
		}
		return arg;
	}

	if (col.command) {
		const arg1 = normalizeArg(col.command.arg1, false);
		const arg2 = normalizeArg(col.command.arg2, col.command.eval);
		const arg3 = normalizeArg(col.command.arg3, false);
		const arg4 = col.command.arg4; // without normalize
		return h(tag, cellProps, [h(cellCommand, { row: row, col: col, args: [arg1, arg2, arg3, arg4] })]);
	}
	/* simple content */
	if (col.content === '$index')
		return h(tag, cellProps, [ix + 1]);

	function isNegativeRed(col: any) {
		if (col.dataType === 'Number' || col.dataType === 'Currency') {
			const val = utils.eval(row, col.content, col.dataType, col.evalOpts, true /*skip format*/);
			if (val < 0)
				return true;
		}
		return false;
	}

	let content = utils.eval(row, col.content, col.dataType, col.evalOpts);
	const spanProps: Record<string, any> = { class: { 'dg-cell': true, 'negative-red': isNegativeRed(col), 'line-clamp': col.lineClamp > 0 } };
	if (col.maxChars) {
		spanProps.title = content;
		content = utils.text.maxChars(content, col.maxChars);
	}
	else if (col.lineClamp > 0) {
		spanProps.title = content;
		spanProps.style = { '-webkit-line-clamp': col.lineClamp };
	}

	const chElems: VNode[] = [h('span', spanProps, content)];
	const icoSingle = !col.content ? ' ico-single' : '';
	if (col.icon)
		chElems.unshift(h('i', { class: 'ico ico-' + col.icon + icoSingle }));
	else if (col.bindIcon)
		chElems.unshift(h('i', { class: 'ico ico-' + utils.eval(row, col.bindIcon) + icoSingle }));
	else if (col.done)
		chElems.unshift(h('i', { class: 'ico ico-' + (utils.eval(row, col.done) ? 'success-outline-green' : 'warning-outline-yellow') + icoSingle }));
	/*TODO: validate ???? */
	if (col.validate) {
		chElems.push(h(cellValidator, { path: col.validate, item: row }));
	}
	return h(tag, cellProps, chElems);
};
dataGridCell.props = ['row', 'col', 'index'];

const dataGridRow = defineComponent({
	name: 'data-grid-row',
	template: dataGridRowTemplate,
	components: {
		'data-grid-cell': dataGridCell
	},
	props: {
		row: Object,
		cols: Array,
		index: Number,
		mark: String,
		group: Boolean,
		level: Number,
		isItemActive: Function,
		hitItem: Function
	},
	computed: {
		grid(): any {
			return this.$parent;
		},
		isMarkCell(): boolean {
			return this.grid.isMarkCell;
		},
		detailsMarker(): boolean {
			return this.grid.isRowDetailsCell;
		},
		detailsIcon(): boolean {
			if (!this.detailsMarker)
				return false;
			const prdv = this.grid.rowDetailsVisible;
			if (prdv === false) return true; // property not specified
			return prdv && (this.row as any)[prdv];
		},
		detailsExpandClass(): string {
			return (this.row as any)._uiprops_.$details ? 'ico-minus-circle' : 'ico-plus-circle';
		},
		totalColumns(): void {
			console.error('implement me');
		},
		markClass(): string {
			return this.mark ? utils.simpleEval(this.row, this.mark) : '';
		},
		_itemActive(): boolean {
			return this.isItemActive ? this.isItemActive(this.index, this.row) : !!(this.row as any).$selected;
		}
	},
	watch: {
		_itemActive(newValue: boolean) {
			if (newValue) {
				const tr = this.$refs.tr as Element;
				if (tr && tr.scrollIntoViewCheck)
					tr.scrollIntoViewCheck();
			}
		}
	},
	methods: {
		rowClass() {
			const row = this.row as any;
			let cssClass = 'dg-row';
			const isActive = this.isItemActive ? this.isItemActive(this.index, row) : !!row.$selected;
			if (isActive) cssClass += ' active';
			if (this.grid.isMarkRow && this.mark) {
				cssClass += ' ' + utils.simpleEval(row, this.mark);
			}
			if ((this.index! + 1) % 2)
				cssClass += ' even';
			if (this.grid.rowBold && row[this.grid.rowBold])
				cssClass += ' bold';
			if (this.level)
				cssClass += ' lev-' + this.level;
			return cssClass.trim();
		},
		rowSelect(row: any) {
			if (row.$select)
				row.$select();
		},
		mouseDown(row: any) {
			if (this.hitItem)
				this.hitItem(row);
		},
		doDblClick($event: Event) {
			// deselect text
			$event.stopImmediatePropagation();
			if (!this.grid.doubleclick)
				return;
			window.getSelection()!.removeAllRanges();
			this.grid.doubleclick();
		},
		toggleDetails() {
			if (!this.detailsIcon) return;
			const ui = (this.row as any)._uiprops_;
			ui.$details = !ui.$details;
		}
	}
});

const dataGridRowDetails = defineComponent({
	name: 'data-grid-row-details',
	template: dataGridRowDetailsTemplate,
	props: {
		cols: Number,
		row: Object,
		mark: String
	},
	computed: {
		grid(): any {
			return this.$parent;
		},
		isMarkCell(): boolean {
			return this.grid.isMarkCell;
		},
		markClass(): string {
			return this.mark ? utils.simpleEval(this.row, this.mark) : '';
		},
		detailsMarker(): boolean {
			return this.grid.isRowDetailsCell;
		},
		totalCols(): number {
			return this.cols! +
				(this.isMarkCell ? 1 : 0) +
				(this.detailsMarker ? 1 : 0);
		}
	},
	methods: {
		visible() {
			if (this.grid.isRowDetailsAlways)
				return true;
			else if (this.grid.isRowDetailsCell)
				return (this.row as any)._uiprops_.$details ? true : false;
			return this.row === this.grid.selected();
		}
	}
});

interface Group {
	group: string;
	p0: Group | null;
	expanded: boolean;
	level: number;
	items: unknown[] | null;
	count: number;
	source?: any;
}

vocabulary.component('data-grid', defineComponent({
	inject: {
		page: { from: '$page', default: null }
	},
	props: {
		itemsSource: [Object, Array],
		border: Boolean,
		grid: String,
		fixedHeader: Boolean,
		hideHeader: Boolean,
		hover: {
			type: Boolean, default: undefined
		},
		striped: {
			type: Boolean,
			default: undefined
		},
		compact: Boolean,
		sort: Boolean,
		routeQuery: Object,
		mark: String,
		filterFields: String,
		markStyle: String,
		rowBold: String,
		doubleclick: Function,
		groupBy: [Array, Object, String],
		rowDetails: Boolean,
		rowDetailsActivate: String,
		rowDetailsVisible: [String /*path*/, Boolean],
		isItemActive: Function,
		hitItem: Function,
		emptyPanelCallback: Function,
		testId: String,
		autoSelect: String
	},
	template: dataGridTemplate,
	components: {
		'data-grid-row': dataGridRow,
		'data-grid-row-details': dataGridRowDetails
	},
	data() {
		return {
			columns: [] as any[],
			clientItems: null as any[] | null,
			clientGroups: null as Group[] | null,
			localSort: {
				dir: 'asc',
				order: ''
			}
		};
	},
	computed: {
		$items(): any {
			return this.clientItems ? this.clientItems : this.itemsSource;
		},
		isMarkCell(): boolean {
			return this.markStyle === 'marker' || this.markStyle === 'both';
		},
		isRowDetailsCell(): boolean {
			return this.rowDetails && this.rowDetailsActivate === 'cell';
		},
		isRowDetailsAlways(): boolean {
			return this.rowDetails && this.rowDetailsActivate === 'always';
		},
		isMarkRow(): boolean {
			return this.markStyle === 'row' || this.markStyle === 'both';
		},
		isHeaderVisible(): boolean {
			return !this.hideHeader;
		},
		cssClass(): string {
			let cssClass = 'data-grid';
			if (this.grid) cssClass += ' grid-' + this.grid.toLowerCase();
			if (this.striped != undefined)
				cssClass += this.striped ? ' striped' : ' no-striped';
			if (this.hover != undefined)
				cssClass += this.hover ? ' hover' : ' no-hover';
			if (this.compact) cssClass += ' compact';
			return cssClass;
		},
		isGridSortable(): boolean {
			return !!this.sort;
		},
		isLocal(): boolean {
			return !(this.$parent as any).sortDir;
		},
		isGrouping(): unknown {
			return this.groupBy;
		},
		groupColumns(): number {
			return this.columns.length + //1 +
				(this.isMarkCell ? 1 : 0) +
				(this.isRowDetailsCell ? 1 : 0);
		},
		$groupCount(): number {
			const groupBy = this.groupBy as any;
			if (utils.isString(groupBy))
				return groupBy.split('-').length;
			else if (utils.isObjectExact(groupBy))
				return 1;
			else
				return groupBy.length;
		},
		$groups(): Group[] | null {
			function* enumGroups(src: any, p0: Group | null, lev: number, cnt?: { c: number }): Generator<Group> {
				for (const grKey in src) {
					if (grKey === 'items') continue;
					const srcElem = src[grKey];
					const count = srcElem.items ? srcElem.items.length : 0;
					if (cnt)
						cnt.c += count;
					const pElem: Group = {
						group: grKey,
						p0: p0,
						expanded: true,
						level: lev,
						items: srcElem.items || null,
						count: count
					};
					yield pElem;
					if (!src.items) {
						const cnt = { c: 0 };
						yield* enumGroups(srcElem, pElem, lev + 1, cnt);
						pElem.count += cnt.c;
					}
				}
			}
			this.doSortLocally();
			// classic tree
			const startTime = performance.now();
			const grmap: any = {};
			let grBy: any = this.groupBy;
			if (utils.isString(grBy)) {
				const rarr = [];
				for (const vs of grBy.split('-'))
					rarr.push({ prop: vs.trim(), count: true });
				grBy = rarr;
			}
			else if (utils.isObjectExact(grBy))
				grBy = [grBy];
			if (!this.$items) return null;
			for (const itm of this.$items) {
				let root = grmap;
				for (const gr of grBy) {
					let key = utils.eval(itm, gr.prop);
					if (utils.isDate(key))
						key = utils.format(key, 'Date');
					if (!utils.isDefined(key)) key = '';
					if (key === '') key = locale.$Unknown || 'Unknown';
					if (!(key in root)) root[key] = {};
					root = root[key];
				}
				if (!root.items)
					root.items = [];
				root.items.push(itm);
			}
			// tree to plain array
			const grArray: Group[] = [];
			for (const el of enumGroups(grmap, null, 1)) {
				el.source = grBy[el.level - 1];
				if (el.source.expanded === false)
					el.expanded = false;
				grArray.push(el);
			}
			this.clientGroups = grArray;
			log.time('datagrid grouping time:', startTime);
			return this.clientGroups;
		},
		$isEmpty(): boolean {
			const src = this.itemsSource as any;
			if (!src) return false;
			const mi = src.$ModelInfo;
			if (!mi)
				return src.length === 0;
			if ('HasRows' in mi) {
				if (src.length)
					return false;
				return mi.HasRows === false;
			} else {
				return src.length === 0;
			}
		}
	},
	watch: {
		localSort: {
			handler() {
				this.handleSort();
			},
			deep: true
		},
		'itemsSource.length'() {
			this.handleSort();
		},
		'$isEmpty'(newval: boolean) {
			if (this.emptyPanelCallback)
				this.emptyPanelCallback.call((this.page as any).$data, newval);
		}
	},
	methods: {
		selected() {
			let src = this.itemsSource as any;
			if (src.$origin)
				src = src.$origin;
			return src.$selected;
		},
		$addColumn(column: unknown) {
			this.columns.push(column);
		},
		$removeColumn(column: unknown) {
			const ix = this.columns.indexOf(column);
			if (ix !== -1)
				this.columns.splice(ix, 1);
		},
		rowDetailsShow(item: any) {
			if (!this.rowDetails)
				return false;
			if (utils.isBoolean(this.rowDetailsVisible))
				return this.rowDetailsVisible; // unset
			const vis = item[this.rowDetailsVisible as string];
			return !!vis;
		},
		columnClass(column: any) {
			let cls = '';
			if (column.fit || column.controlType === 'validator')
				cls += 'fit';
			if (this.sort && column.isSortable && utils.isDefined(column.dir))
				cls += ' sorted';
			if (column.backColor) {
				cls += ` ${column.backColor}`;
			}
			return cls;
		},
		columnStyle(column: any) {
			return {
				width: utils.isDefined(column.width) ? column.width : undefined,
				minWidth: utils.isDefined(column.minWidth) ? column.minWidth : undefined
			};
		},
		doSort(order: string) {
			// TODO: // collectionView || locally
			if (this.isLocal) {
				if (eqlower(this.localSort.order, order))
					this.localSort.dir = eqlower(this.localSort.dir, 'asc') ? 'desc' : 'asc';
				else {
					this.localSort = { order: order, dir: 'asc' };
				}
			} else {
				(this.$parent as any).doSort(order);
			}
		},
		sortDir(order: string) {
			if (this.isLocal)
				return eqlower(this.localSort.order, order) ? this.localSort.dir : undefined;
			else
				return (this.$parent as any).sortDir(order);
		},
		doSortLocally() {
			if (!this.isLocal) return;
			if (!this.localSort.order) return;
			const startTime = performance.now();
			const rev = this.localSort.dir === 'desc';
			const sortProp = this.localSort.order;
			const arr = ([] as any[]).concat(this.itemsSource);
			arr.sort((a, b) => {
				const av = a[sortProp];
				const bv = b[sortProp];
				if (av === bv)
					return 0;
				else if (av < bv)
					return rev ? 1 : -1;
				else
					return rev ? -1 : 1;
			});
			log.time('datagrid sorting time:', startTime);
			this.clientItems = arr;
		},
		handleSort() {
			if (this.isGrouping)
				this.clientGroups = null;
			else
				this.doSortLocally();
		},
		toggleGroup(g: Group) {
			g.expanded = !g.expanded;
		},
		isGroupCountVisible(g: Group) {
			if (g && g.source && utils.isDefined(g.source.count))
				return g.source.count;
			return true;
		},
		isGroupGroupVisible(g: Group) {
			if (!g.group)
				return false;
			if (!g.p0)
				return true;
			let cg: Group | null = g.p0;
			while (cg) {
				if (!cg.expanded) return false;
				cg = cg.p0;
			}
			return true;
		},
		isGroupBodyVisible(g: Group) {
			if (!g.expanded) return false;
			let cg = g.p0;
			while (cg) {
				if (!cg.expanded) return false;
				cg = cg.p0;
			}
			return true;
		},
		groupTitle(g: Group) {
			if (g.source && g.source.title)
				return g.source.title
					.replace('{Value}', g.group)
					.replace('{Count}', g.count);
			return g.group;
		},
		expandGroups(lev: number) {
			// lev 1-based
			for (const gr of this.$groups!)
				gr.expanded = gr.level < lev;
		},
		$checkAll(path: string) {
			if (!this.$items) return;
			const s = this.$checkAllState(path);
			const val = s != 1;
			this.$items.forEach((itm: any) => itm[path] = val);
		},
		$checkAllState(path: string) {
			// 0 - unchecked; 1 - checked, 2-indeterminate
			if (!this.$items) return 0;
			let checked = 0;
			let unchecked = 0;
			this.$items.forEach((itm: any) => {
				if (itm[path])
					checked += 1;
				else
					unchecked += 1;
			});
			if (checked === 0)
				return 0;
			else if (unchecked === 0)
				return 1;
			return 2;
		},
		__autoSelect() {
			if (!this.autoSelect || !this.$items || !this.$items.length) return;
			if (this.$items.$selected) return;
			switch (this.autoSelect) {
				case 'first-item':
					this.$items[0].$select();
					break;
				case 'last-item':
					this.$items[this.$items.length - 1].$select();
			}
		},
		__invoke__test__(args: any) {
			args = args || {};
			if (args.target !== 'datagrid')
				return;
			if (args.testId !== this.testId)
				return;
			switch (args.action) {
				case 'selectRow':
					this.$items.forEach((e: any) => {
						if (e.$id.toString() === args.id) {
							e.$select();
							args.result = 'success';
						}
					});
					break;
			}
		}
	},
	updated() {
		const src = this.itemsSource as any;
		if (!src) return;
		const ix = src.$selectedIndex;
		const rows = this.$refs.row as any[] | undefined;
		const row = ix !== -1 && rows ? rows.find(r => r.index === ix) : null;
		if (row) {
			const tr = row.$refs.tr as Element;
			tr.scrollIntoViewCheck();
		}
		this.__autoSelect();
	},
	mounted() {
		if (this.testId)
			eventBus.$on('invokeTest', this.__invoke__test__);
	},
	beforeUnmount() {
		if (this.testId)
			eventBus.$off('invokeTest', this.__invoke__test__);
	}
}));
