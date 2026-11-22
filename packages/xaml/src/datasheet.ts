// data-sheet, data-sheet-column, a2-sheet-scrollbar: new, not a Net48 port (PLAN.md, "The 1C dialect"). A table of
// records as cells, Excel style: the cursor is a cell, the row is highlighted; one row height; scrolled by whole rows
// and columns, only the shown ones rendered; the header and the first `fixed-columns` always shown. The positions are
// the core's arithmetic (@a2v10/primitives, sheet.ts); what a cell shows is its kind's (cellkinds.ts).
// The cursor's row IS the array's $selected: moving the cursor selects, a selection made elsewhere (a command's
// $append, $remove) moves the cursor. The sheet never adds or removes rows: the keys of rows raise the commands bound
// to it (Enter and a double click `open`, Ins `add`, F9 `copy`, Del `remove`; a list binds new / copy / mark for
// deletion, a table part append / copy / remove), each called with the cursor's element. Typing searches by the
// cursor's column, its cell kind's text. The row picture: `row-picture`, a row's property holding an icon's name.
// Its CSS: datasheet.css, beside. Not yet: editing.

import { defineComponent, type PropType } from 'vue';
import {
	WheelSteps, TypeAhead, rowPage, clampRowPos, renderedRowCount, rowAt, fitRowPos,
	visibleColumns, columnPage, clampColPos, columnAt, fitColPos, moveCursor, findRow
} from '@a2v10/primitives';
import { require, vocabulary } from './platform.js';
import { kindOf, type SheetColumn } from './cellkinds.js';

const DEFAULT_WIDTH = '8rem';
const PICTURE_WIDTH = '1.75rem';
const SEARCH_PAUSE = 1000; // ms: typing adds up to one prefix; its badge shown as long

// The keys of rows (no Ctrl, no Shift): the command each raises, a prop of the sheet.
const ROW_KEYS: Record<string, 'open' | 'add' | 'copy' | 'remove'> = {
	Enter: 'open', Insert: 'add', F9: 'copy', Delete: 'remove'
};

// A column's width in px: the core counts in px. px, rem, em, or a bare number (px); anything else is the default.
function toPx(width: string | undefined, rem: number, em: number): number {
	const m = /^\s*([\d.]+)\s*(px|rem|em)?\s*$/.exec(width || '');
	if (!m)
		return toPx(DEFAULT_WIDTH, rem, em);
	const n = parseFloat(m[1]);
	switch (m[2]) {
		case 'rem': return Math.round(n * rem);
		case 'em': return Math.round(n * em);
		default: return Math.round(n);
	}
}

const px = (n: number) => `${n}px`;

// --- the scrollbar, counted in steps (rows, columns): min / max / pos / page; the thumb placed by CSS, no measuring
vocabulary.component('a2-sheet-scrollbar', defineComponent({
	template: `
<div class="ds-sb" :class="horz ? 'horz' : 'vert'" @pointerdown.self="clickTrack" ref="track">
	<div class="ds-thumb" v-if="active" :class="{drag: drag}" :style="thumbStyle"
		@pointerdown.stop="dragStart" @pointermove="dragMove" @pointerup="dragEnd" @lostpointercapture="dragEnd"></div>
</div>`,
	props: {
		horz: Boolean,
		min: { type: Number, default: 0 },
		max: { type: Number, default: 0 },
		pos: { type: Number, default: 0 },
		page: { type: Number, default: 1 }
	},
	emits: ['update:pos'],
	data() {
		return { drag: null as null | { from: number, pos: number, span: number } };
	},
	computed: {
		size(): number { return this.max - this.min; },
		active(): boolean { return this.size > this.page; },
		thumbStyle(): Record<string, string> {
			const len = `max(${(this.page / this.size * 100).toFixed(3)}%, 1.5rem)`;
			const frac = (this.pos - this.min) / (this.size - this.page);
			const at = `calc((100% - ${len}) * ${frac.toFixed(5)})`;
			return this.horz ? { left: at, width: len } : { top: at, height: len };
		}
	},
	methods: {
		setPos(pos: number) {
			const np = Math.min(Math.max(this.min, pos), this.max - this.page);
			if (np !== this.pos)
				this.$emit('update:pos', np);
		},
		clickTrack(ev: PointerEvent) {
			const thumb = (this.$el as HTMLElement).firstElementChild as HTMLElement | null;
			if (!thumb) return;
			const r = thumb.getBoundingClientRect();
			const before = this.horz ? ev.clientX < r.left : ev.clientY < r.top;
			this.setPos(this.pos + (before ? -this.page : this.page));
		},
		dragStart(ev: PointerEvent) {
			const thumb = ev.target as HTMLElement;
			thumb.setPointerCapture(ev.pointerId);
			const t = (this.$refs.track as HTMLElement).getBoundingClientRect();
			const r = thumb.getBoundingClientRect();
			this.drag = {
				from: this.horz ? ev.clientX : ev.clientY,
				pos: this.pos,
				span: this.horz ? t.width - r.width : t.height - r.height
			};
		},
		dragMove(ev: PointerEvent) {
			const d = this.drag;
			if (!d || d.span <= 0) return;
			const moved = (this.horz ? ev.clientX : ev.clientY) - d.from;
			this.setPos(Math.round(d.pos + moved / d.span * (this.size - this.page)));
		},
		dragEnd() {
			this.drag = null;
		}
	}
}));

// --- the column: a field (PLAN.md), no content; registers with its sheet and renders nothing
vocabulary.component('data-sheet-column', defineComponent({
	inject: { sheet: { from: 'dataSheet' } },
	props: {
		header: String,
		content: String,
		dataType: String,
		format: String,
		hideZeros: Boolean,
		align: String,
		width: String,
		controlType: String
	},
	created() {
		(this.sheet as any).$addColumn(this);
	},
	unmounted() {
		(this.sheet as any).$removeColumn(this);
	},
	render() {
		return null;
	}
}));

// --- the sheet
vocabulary.component('data-sheet', defineComponent({
	template: `
<div class="data-sheet" tabindex="0" :test-id="testId" @keydown="keydown">
	<div class="ds-view" ref="view" @wheel.prevent="wheel" @pointerdown="pointerdown" @dblclick="dblclick">
		<table class="ds-table" :style="{width: px(tableWidth)}">
			<colgroup><col v-if="rowPicture" :style="{width: px(lead)}"/><col v-for="c in shownCols" :key="c" :style="{width: px(widths[c])}"/></colgroup>
			<thead><tr><th v-if="rowPicture" class="ds-picture"></th><th v-for="c in shownCols" :key="c" :class="colClass(c)" v-text="columns[c].header"></th></tr></thead>
			<tbody>
				<tr v-for="r in shownRows" :key="r" :class="{active: r === cursorRow}">
					<td v-if="rowPicture" class="ds-picture"><i v-if="picture(r)" :class="'ico ico-' + picture(r)"></i></td>
					<td v-for="c in shownCols" :key="c" :class="cellClass(r, c)" v-text="cellText(r, c)"></td>
				</tr>
			</tbody>
		</table>
		<div class="ds-search" v-if="search.text" :class="{fail: search.fail}" v-text="search.text"></div>
	</div>
	<a2-sheet-scrollbar class="ds-vscroll" :min="0" :max="rowCount" :page="page" :pos="pos" @update:pos="setPos"/>
	<a2-sheet-scrollbar class="ds-hscroll" :horz="true" :min="fixed" :max="columns.length" :page="colPage" :pos="colPos" @update:pos="setColPos"/>
	<div class="ds-columns"><slot></slot></div>
</div>`,
	props: {
		itemsSource: Array as PropType<any[]>,
		fixedColumns: { type: Number, default: 0 },
		rowPicture: String,
		autoSelect: { type: String, default: 'first-item' }, // 'last-item': a list, the newest at the bottom
		open: Function,
		add: Function,
		copy: Function,
		remove: Function,
		testId: String
	},
	provide() {
		return { dataSheet: this };
	},
	data() {
		return {
			columns: [] as any[],
			pos: 0,           // the first scrolled row shown
			colPos: 0,        // the first scrolled column shown (>= fixed)
			col: 0,           // the cursor's column; its row is the array's $selected
			viewWidth: 0,
			viewHeight: 0,
			headerHeight: 0,
			rowHeight: 0,
			rem: 16,
			em: 16,
			search: { text: '', fail: false }
		};
	},
	computed: {
		items(): any[] {
			return this.itemsSource || [];
		},
		rowCount(): number {
			return this.items.length;
		},
		cursorRow(): number {
			const ix = (this.items as any).$selectedIndex;
			return typeof ix === 'number' ? ix : -1;
		},
		page(): number {
			return rowPage(this.viewHeight, this.headerHeight, this.rowHeight);
		},
		shownRows(): number[] {
			const n = renderedRowCount(this.pos, this.page, this.rowCount);
			return Array.from({ length: n }, (_, i) => this.pos + i);
		},
		widths(): number[] {
			return this.columns.map((c: SheetColumn & { width?: string }) => toPx(c.width, this.rem, this.em));
		},
		fixed(): number {
			return Math.min(Math.max(0, this.fixedColumns), this.columns.length);
		},
		// the row picture's column, before the fixed ones: the core counts the columns' width without it
		lead(): number {
			return this.rowPicture ? toPx(PICTURE_WIDTH, this.rem, this.em) : 0;
		},
		// not measured yet: every column, so that a row has cells to measure
		width(): number {
			return this.viewWidth ? this.viewWidth - this.lead : Number.MAX_SAFE_INTEGER;
		},
		shownCols(): number[] {
			return visibleColumns(this.widths, this.fixed, this.colPos, this.width);
		},
		colPage(): number {
			return columnPage(this.widths, this.fixed, this.colPos, this.width);
		},
		tableWidth(): number {
			return this.shownCols.reduce((w: number, c: number) => w + this.widths[c], this.lead);
		}
	},
	watch: {
		itemsSource() {
			this.selectStart();
		},
		// a new page of a list keeps no selection: the cursor goes to the start again
		cursorRow(row: number) {
			if (row >= 0)
				this.pos = fitRowPos(row, this.pos, this.page, this.rowCount);
			else
				this.selectStart();
		},
		page() {
			this.fitRows();
		},
		rowCount() {
			this.fitRows();
			this.selectStart();
		},
		col(c: number) {
			this.colPos = fitColPos(c, this.colPos, this.widths, this.fixed, this.width);
		}
	},
	methods: {
		px,
		$addColumn(column: unknown) {
			this.columns.push(column); // a component instance: Vue never makes it reactive
		},
		$removeColumn(column: unknown) {
			const ix = this.columns.indexOf(column);
			if (ix !== -1)
				this.columns.splice(ix, 1);
			this.col = Math.min(this.col, Math.max(0, this.columns.length - 1));
		},
		column(c: number): SheetColumn {
			return this.columns[c] as SheetColumn;
		},
		colClass(c: number): string[] {
			const cls = [kindOf(this.column(c)).align(this.column(c))];
			if (c === this.fixed - 1)
				cls.push('ds-fixed-last');
			return cls;
		},
		cellClass(r: number, c: number): string[] {
			const cls = this.colClass(c);
			if (r === this.cursorRow && c === this.col)
				cls.push('cursor');
			return cls;
		},
		cellText(r: number, c: number): string {
			const col = this.column(c);
			return kindOf(col).text(this.items[r], col);
		},
		select(row: number) {
			const elem = this.items[row];
			if (elem && elem.$select && row !== this.cursorRow)
				elem.$select();
		},
		selectStart() {
			if (this.rowCount && this.cursorRow < 0)
				this.select(this.autoSelect === 'last-item' ? this.rowCount - 1 : 0);
		},
		picture(r: number): string {
			return require('std:utils').eval(this.items[r], this.rowPicture, undefined, undefined, true /*skip format*/) || '';
		},
		// A key of rows: the bound command with the cursor's element; `add` with none too (an empty table). False: not bound.
		command(name: 'open' | 'add' | 'copy' | 'remove'): boolean {
			const fn = this[name] as ((elem: unknown) => void) | undefined;
			if (typeof fn !== 'function')
				return false;
			const elem = this.cursorRow >= 0 ? this.items[this.cursorRow] : undefined;
			if (!elem && name !== 'add')
				return false;
			fn(elem);
			return true;
		},
		typeSearch(ch: string) {
			const self = this as any;
			const col = this.column(this.col);
			if (!col)
				return;
			const kind = kindOf(col);
			const prefix = self._typeAhead.push(ch, performance.now());
			const row = findRow(this.rowCount, Math.max(0, this.cursorRow), prefix, (r: number) => kind.text(this.items[r], col));
			this.search.text = prefix;
			this.search.fail = row < 0;
			if (row >= 0)
				this.select(row);
			clearTimeout(self._searchTimer);
			self._searchTimer = setTimeout(() => this.search.text = '', SEARCH_PAUSE);
		},
		clearSearch() {
			const self = this as any;
			self._typeAhead.clear();
			clearTimeout(self._searchTimer);
			this.search.text = '';
		},
		fitRows() {
			this.pos = this.cursorRow >= 0
				? fitRowPos(this.cursorRow, this.pos, this.page, this.rowCount)
				: clampRowPos(this.pos, this.rowCount, this.page);
		},
		setPos(pos: number) {
			this.pos = clampRowPos(pos, this.rowCount, this.page);
		},
		setColPos(pos: number) {
			this.colPos = clampColPos(pos, this.widths, this.fixed, this.width);
		},
		keydown(ev: KeyboardEvent) {
			if (ev.target !== this.$el || ev.altKey)
				return;
			const ctrl = ev.ctrlKey || ev.metaKey;
			const name = !ctrl && !ev.shiftKey ? ROW_KEYS[ev.key] : undefined;
			if (name) {
				this.clearSearch();
				if (this.command(name))
					ev.preventDefault();
				return;
			}
			if (ev.key === 'Escape' && this.search.text) {
				ev.preventDefault();
				ev.stopPropagation(); // the search's, not the dialog's
				this.clearSearch();
				return;
			}
			if (ev.key.length === 1 && !ctrl) {
				ev.preventDefault();
				this.typeSearch(ev.key);
				return;
			}
			const cur = { row: Math.max(0, this.cursorRow), col: this.col };
			const to = moveCursor(ev.key, ctrl, cur, this.rowCount, this.columns.length, this.page);
			if (!to)
				return;
			ev.preventDefault();
			this.clearSearch();
			this.select(to.row);
			this.col = to.col;
		},
		wheel(ev: WheelEvent) {
			const self = this as any;
			const horz = ev.shiftKey || Math.abs(ev.deltaX) > Math.abs(ev.deltaY);
			if (horz) {
				const delta = ev.shiftKey && !ev.deltaX ? ev.deltaY : ev.deltaX;
				const steps = self._wheelH.steps(delta, ev.deltaMode, this.widths[this.colPos] || 0, this.colPage);
				if (steps)
					this.setColPos(this.colPos + steps);
			} else {
				const steps = self._wheelV.steps(ev.deltaY, ev.deltaMode, this.rowHeight, this.page);
				if (steps)
					this.setPos(this.pos + steps);
			}
		},
		pointerdown(ev: PointerEvent) {
			if (ev.button !== 0)
				return;
			const { row, col } = this.cellAt(ev);
			if (row < 0)
				return;
			this.clearSearch();
			this.select(row);
			if (col >= 0)
				this.col = col;
		},
		dblclick(ev: MouseEvent) {
			if (this.cellAt(ev).row >= 0)
				this.command('open');
		},
		// The cell under the pointer; col -1 on the row picture (its row still found) or past the columns.
		cellAt(ev: MouseEvent): { row: number, col: number } {
			const r = (this.$refs.view as HTMLElement).getBoundingClientRect();
			const x = ev.clientX - r.left - this.lead;
			return {
				row: rowAt(ev.clientY - r.top, this.pos, this.headerHeight, this.rowHeight, this.rowCount),
				col: x < 0 ? -1 : columnAt(x, this.widths, this.fixed, this.colPos, this.width)
			};
		},
		// The sizes the core counts with, read from the DOM: the view's, the header's and a row's (one for all).
		measure() {
			const view = this.$refs.view as HTMLElement | undefined;
			if (!view) return;
			this.viewWidth = view.clientWidth;
			this.viewHeight = view.clientHeight;
			const head = view.querySelector('thead tr');
			if (head)
				this.headerHeight = head.getBoundingClientRect().height;
			const row = view.querySelector('tbody tr');
			if (row)
				this.rowHeight = row.getBoundingClientRect().height;
			this.rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
			this.em = parseFloat(getComputedStyle(this.$el as Element).fontSize) || this.rem;
		}
	},
	created() {
		const self = this as any;
		self._wheelV = new WheelSteps();
		self._wheelH = new WheelSteps();
		self._typeAhead = new TypeAhead(SEARCH_PAUSE);
	},
	mounted() {
		this.colPos = this.fixed;
		this.selectStart();
		const self = this as any;
		self._resize = new ResizeObserver(() => this.measure());
		self._resize.observe(this.$refs.view);
		this.$nextTick(() => this.measure());
	},
	updated() {
		// a row's height is known only once a row is there: the first rows, or the first column after none
		if (!this.rowHeight && this.rowCount && this.columns.length)
			this.measure();
	},
	beforeUnmount() {
		const self = this as any;
		self._resize?.disconnect();
		clearTimeout(self._searchTimer);
	}
}));
