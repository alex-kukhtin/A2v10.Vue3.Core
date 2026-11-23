// data-sheet, data-sheet-column, a2-sheet-scrollbar: new, not a Net48 port (PLAN.md, "The 1C dialect"). A table of
// records as cells, Excel style: the cursor is a cell, the row is highlighted; one row height; scrolled by whole rows
// and columns, only the shown ones rendered; the header and the first `fixed-columns` always shown. The positions are
// the core's arithmetic (@a2v10/primitives, sheet.ts); what a cell shows is its kind's (cellkinds.ts).
// The cursor's row IS the array's $selected: moving the cursor selects, a selection made elsewhere (a command's
// $append, $remove) moves the cursor. The sheet never adds or removes rows: the keys of rows raise the commands bound
// to it (Enter and a double click `open`, Ins `add`, F9 `copy`, Del `remove`; a list binds new / copy / mark for
// deletion, a table part append / copy / remove), each called with the cursor's element. Typing searches by the
// cursor's column, its cell kind's text. The row picture: `row-picture`, a row's property holding an icon's name.
// Editing: a column with ControlType (cellkinds.ts). Enter, a typed character (the edit starts with it) or F4 (the
// editor's choice) mount the kind's editor, an existing control, over the cursor's cell; the control writes to the model
// itself, the sheet keeps the value the edit started with: Esc writes it back. Enter / Tab end the edit and go on to the
// next editable cell (Shift+Tab back); focus leaving the editor, a click elsewhere, the wheel end it in place. A toggle
// kind (CheckBox) edits in place: Space, a click on its icon; Enter goes on. Without ControlType: Enter opens, typing
// searches. Sorting: a click on a header, by the collection view holding the sheet's array (on the server: its
// $ModelInfo's SortOrder / SortDir, as data-grid's); no collection view, no sort: a sorted copy would part the rows
// shown from the model's (the cursor is $selected), and reordering the model's rows is a command's, not the sheet's.
// Row mode (`cursor-mode="row"`, 1C's RowSelectionMode=Row): the cursor is the row, no cell: the column stays the
// first (search by typing goes by it), ArrowLeft / Right scroll the columns, Home / End go to the first / last row; no
// edit: a column with ControlType throws.
// Its CSS: datasheet.css, beside.

import { defineComponent, type PropType } from 'vue';
import {
	WheelSteps, TypeAhead, rowPage, clampRowPos, renderedRowCount, rowAt, fitRowPos,
	visibleColumns, columnPage, clampColPos, columnAt, fitColPos, moveCursor, nextCell, findRow
} from '@a2v10/primitives';
import { require, vocabulary } from './platform.js';
import { kindOf, targetOf, type SheetColumn, type CellTarget } from './cellkinds.js';

const DEFAULT_WIDTH = '8rem';
const PICTURE_WIDTH = '1.75rem';
const SEARCH_PAUSE = 1000; // ms: typing adds up to one prefix; its badge shown as long

// The keys of rows (no Ctrl, no Shift): the command each raises, a prop of the sheet.
const ROW_KEYS: Record<string, 'open' | 'add' | 'copy' | 'remove'> = {
	Enter: 'open', Insert: 'add', F9: 'copy', Delete: 'remove'
};

// Row mode: the keys that scroll the columns by one, the cursor having none.
const HORZ_KEYS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 };

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

// --- the column: a field (PLAN.md), no content; registers with its sheet and renders nothing. Its props are evaluated
// by the sheet's render (the columns are its slot): a prop a cell reads (ItemsSource) made anew there, a literal array,
// renders the sheet again without end; a binding to the model is stable.
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
		controlType: String,
		display: String, // DisplayProperty
		itemsSource: Array,
		fetch: Function,
		fetchCommand: String,
		valueProp: String,
		sort: { type: Boolean, default: undefined }, // the sheet's `sort` overridden
		sortProp: String // the order the server sorts by; the content's path by default
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
<div class="data-sheet" :class="{'ds-row-mode': rowMode}" tabindex="0" :test-id="testId" @keydown="keydown">
	<div class="ds-view" ref="view" @wheel="wheel" @pointerdown="pointerdown" @dblclick="dblclick">
		<table class="ds-table" :style="{width: px(tableWidth)}">
			<colgroup><col v-if="rowPicture" :style="{width: px(lead)}"/><col v-for="c in shownCols" :key="c" :style="{width: px(widths[c])}"/></colgroup>
			<thead><tr><th v-if="rowPicture" class="ds-picture"></th><th v-for="c in shownCols" :key="c" :class="headClass(c)" v-text="columns[c].header" @click="sortBy(c)"></th></tr></thead>
			<tbody>
				<tr v-for="r in shownRows" :key="r" :class="{active: r === cursorRow}">
					<td v-if="rowPicture" class="ds-picture"><i v-if="picture(r)" :class="'ico ico-' + picture(r)"></i></td>
					<td v-for="c in shownCols" :key="c" :class="cellClass(r, c)"><i v-if="cellIcon(r, c)" class="ds-icon" :class="cellIcon(r, c)"></i>{{cellText(r, c)}}</td>
				</tr>
			</tbody>
		</table>
		<div class="ds-search" v-if="search.text" :class="{fail: search.fail}" v-text="search.text"></div>
	</div>
	<div class="ds-editor" v-if="editing" ref="editor" tabindex="-1" :style="editorStyle" @keydown="editorKeydown" @focusout="editorFocusout">
		<component :is="editing.tag" v-bind="editing.props" ref="editorVm"></component>
	</div>
	<a2-sheet-scrollbar class="ds-vscroll" :min="0" :max="rowCount" :page="page" :pos="pos" @update:pos="setPos"/>
	<a2-sheet-scrollbar class="ds-hscroll" :horz="true" :min="fixed" :max="columns.length" :page="colPage" :pos="colPos" @update:pos="setColPos"/>
	<div class="ds-columns"><slot></slot></div>
</div>`,
	props: {
		itemsSource: Array as PropType<any[]>,
		fixedColumns: { type: Number, default: 0 },
		sort: Boolean, // the columns sort (each may say otherwise), when a collection view holds the array
		rowPicture: String,
		autoSelect: { type: String, default: 'first-item' }, // 'last-item': a list, the newest at the bottom
		cursorMode: { type: String, default: 'cell' }, // 'row': the cursor is the row
		open: Function,
		add: Function,
		copy: Function,
		remove: Function,
		testId: String
	},
	inject: {
		collectionView: { from: 'collectionView', default: null }
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
			search: { text: '', fail: false },
			// the edit: the cell, its kind's editor (tag, props); the value it started with is _undo's, not reactive
			editing: null as null | { row: number, col: number, tag: string, props: Record<string, unknown> }
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
		// the collection view that sorts the rows: the nearest one, if it holds this array
		sorter(): any {
			const cw = this.collectionView as any;
			return cw && cw.ItemsSource === this.itemsSource ? cw : null;
		},
		rowMode(): boolean {
			return this.cursorMode === 'row';
		},
		tableWidth(): number {
			return this.shownCols.reduce((w: number, c: number) => w + this.widths[c], this.lead);
		},
		// over the edited cell, in the view's coordinates: the editor is the root's child, the view clips (its lists)
		editorStyle(): Record<string, string> {
			const e = this.editing;
			if (!e)
				return {};
			let left = this.lead;
			for (const c of this.shownCols) {
				if (c === e.col)
					break;
				left += this.widths[c];
			}
			return {
				left: px(left), top: px(this.headerHeight + (e.row - this.pos) * this.rowHeight),
				width: px(this.widths[e.col]), height: px(this.rowHeight)
			};
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
			if (this.rowMode && (column as SheetColumn).controlType)
				throw new Error(`data-sheet: a column with ControlType "${(column as SheetColumn).controlType}" in a sheet of cursor-mode "row" (no cell to edit)`);
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
		// The order a column sorts by; undefined: it does not sort.
		sortOrder(c: number): string | undefined {
			const col = this.columns[c] as { sort?: boolean, sortProp?: string, content?: string };
			if (!this.sorter || !(col.sort ?? this.sort))
				return undefined;
			return col.sortProp || col.content;
		},
		sortBy(c: number) {
			const order = this.sortOrder(c);
			if (order)
				this.sorter.doSort(order); // the same column: the other direction; another: ascending (the collection view's)
		},
		headClass(c: number): string[] {
			const cls = this.colClass(c);
			const order = this.sortOrder(c);
			if (order) {
				cls.push('sort');
				const dir = this.sorter.sortDir(order);
				if (dir)
					cls.push(String(dir).toLowerCase());
			}
			return cls;
		},
		colClass(c: number): string[] {
			const cls = [kindOf(this.column(c)).align(this.column(c))];
			if (c === this.fixed - 1)
				cls.push('ds-fixed-last');
			return cls;
		},
		cellClass(r: number, c: number): string[] {
			const cls = this.colClass(c);
			if (r === this.cursorRow && c === this.col && !this.rowMode)
				cls.push('cursor');
			return cls;
		},
		cellText(r: number, c: number): string {
			const col = this.column(c);
			return kindOf(col).text(this.items[r], col);
		},
		cellIcon(r: number, c: number): string {
			const col = this.column(c);
			return kindOf(col).icon?.(this.items[r], col) || '';
		},
		editable(c: number): boolean {
			const kind = kindOf(this.column(c));
			return !!(kind.editor || kind.toggle);
		},
		// Starts the edit of the cursor's cell: `ch` typed (it replaces the value), `open` the editor's choice (F4).
		// False: the column does not edit.
		startEdit(ch?: string, open?: boolean): boolean {
			const row = this.cursorRow;
			const col = this.column(this.col);
			const ed = col && kindOf(col).editor;
			const t = ed && row >= 0 ? targetOf(this.items[row], col) : null;
			if (!ed || !t)
				return false;
			this.clearSearch();
			const old = t.item[t.prop];
			(this as any)._undo = { t, old, json: require('std:utils').toJson(old) };
			this.editing = { row, col: this.col, tag: ed.tag, props: ed.props(t, col) };
			this.$nextTick(() => {
				const box = this.$refs.editor as HTMLElement | undefined;
				if (!box)
					return;
				const input = box.querySelector('input, select, textarea') as HTMLInputElement | null;
				(input || box).focus();
				if (open)
					ed.open?.(this.$refs.editorVm);
				else if (ch && input?.tagName === 'INPUT')
					setTimeout(() => { // after v-focus selects the value (focus.ts), or the next key would replace the character
						if (!input.isConnected)
							return;
						input.select();
						// typed, not set: a value set by script raises no change on blur (the textbox writes on change)
						document.execCommand('insertText', false, ch);
					});
			});
			return true;
		},
		// Ends the edit, its value kept: the input blurred while still mounted, so that its change writes. `move`: on
		// to the next editable cell (back: Shift+Tab); `refocus`: the sheet takes the focus (not when it went elsewhere).
		endEdit(move: 'next' | 'back' | null, refocus: boolean) {
			const e = this.editing;
			if (!e)
				return;
			const box = this.$refs.editor as HTMLElement | undefined;
			const active = document.activeElement as HTMLElement | null;
			this.editing = null; // first: the focusout the blur raises finds no edit
			if (refocus)
				(this.$el as HTMLElement).focus();
			else if (box && active && box.contains(active))
				active.blur();
			if (move)
				this.goNext(move === 'back', e);
		},
		// Esc: the editor unmounted, the value the edit started with written back, after the editor's last write (the
		// selector's pick writes on nextTick). An element (a reference) is merged into in place: its copy is written.
		cancelEdit() {
			if (!this.editing)
				return;
			const u = (this as any)._undo as { t: CellTarget, old: any, json: string };
			this.editing = null;
			(this.$el as HTMLElement).focus();
			this.$nextTick(() => {
				const utils = require('std:utils');
				const cur = u.t.item[u.t.prop];
				if (utils.toJson(cur) === u.json)
					return; // unchanged: not written, not dirty
				u.t.item[u.t.prop] = cur && cur.$merge ? JSON.parse(u.json) : u.old;
			});
		},
		goNext(back: boolean, from?: { row: number, col: number }): boolean {
			const to = nextCell(from || { row: this.cursorRow, col: this.col }, back, this.rowCount, this.columns.length, (c: number) => this.editable(c));
			if (to) {
				this.select(to.row);
				this.col = to.col;
			}
			return true;
		},
		toggle(r: number, c: number): boolean {
			const t = targetOf(this.items[r], this.column(c));
			if (t)
				t.item[t.prop] = !t.item[t.prop];
			return true;
		},
		// The keys of a column that edits: Enter edits (a toggle: goes on), F4 the editor's choice, Space toggles.
		cellKey(key: string): boolean {
			if (this.cursorRow < 0 || !this.columns.length)
				return false;
			const kind = kindOf(this.column(this.col));
			switch (key) {
				case 'Enter': return kind.editor ? this.startEdit() : !!kind.toggle && this.goNext(false);
				case 'F4': return this.startEdit(undefined, true);
				case ' ': return !!kind.toggle && this.toggle(this.cursorRow, this.col);
			}
			return false;
		},
		editorKeydown(ev: KeyboardEvent) {
			if (ev.defaultPrevented) // the editor's own (a list's Esc)
				return;
			switch (ev.key) {
				case 'Enter': this.endEdit('next', true); break;
				case 'Tab': this.endEdit(ev.shiftKey ? 'back' : 'next', true); break;
				case 'Escape': this.cancelEdit(); break;
				default: return;
			}
			ev.preventDefault();
			ev.stopPropagation(); // the edit's, not the dialog's
		},
		editorFocusout(ev: FocusEvent) {
			const to = ev.relatedTarget as Node | null;
			if (to && (this.$refs.editor as HTMLElement | undefined)?.contains(to))
				return; // within: a click on a calendar's day focuses the editor's box
			this.endEdit(null, false);
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
			if (!ctrl && !ev.shiftKey && this.cellKey(ev.key)) {
				ev.preventDefault();
				return;
			}
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
				if (!this.startEdit(ev.key))
					this.typeSearch(ev.key);
				return;
			}
			const cur = { row: Math.max(0, this.cursorRow), col: this.col };
			const to = moveCursor(ev.key, ctrl, cur, this.rowCount, this.columns.length, this.page, this.rowMode);
			if (!to) {
				const step = this.rowMode ? HORZ_KEYS[ev.key] : undefined;
				if (step) {
					ev.preventDefault();
					this.setColPos(this.colPos + step);
				}
				return;
			}
			ev.preventDefault();
			this.clearSearch();
			this.select(to.row);
			this.col = to.col;
		},
		wheel(ev: WheelEvent) {
			const self = this as any;
			ev.preventDefault();
			this.endEdit(null, true);
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
			this.endEdit(null, false); // the click focuses the sheet itself
			const { row, col } = this.cellAt(ev);
			if (row < 0)
				return;
			this.clearSearch();
			this.select(row);
			if (col < 0 || this.rowMode)
				return;
			this.col = col;
			if ((ev.target as Element).closest('.ds-icon') && kindOf(this.column(col)).toggle)
				this.toggle(row, col);
		},
		// A column that edits: its edit (a toggle: none, its clicks toggled); else the open command.
		dblclick(ev: MouseEvent) {
			const { row, col } = this.cellAt(ev);
			if (row < 0)
				return;
			if (col >= 0 && this.editable(col))
				this.startEdit();
			else
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
