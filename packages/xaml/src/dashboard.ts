// a2-dashboard, a2-dashboard-item (Net48 components/dashboard.js), unchanged in behaviour: items on a grid of cells
// (row, col, rowSpan, colSpan); in editMode the free cells are placeholders, an item is dragged (HTML5 drag and drop)
// to a free place, a new one from the list (grouped by groupBy) beside, and removed by its ✕. The item and the
// placeholder reach the board by $parent, as Net48. Vue 3 changes:
// - the placeholders' v-for and v-if are on two elements, the key on the placeholder: Vue 3 wants a <template v-for>'s
//   key on the template, and gives v-if priority over v-for;
// - a placeholder is reactive: $hover sets its hover, which Vue 2 rendered when lastPhRow/lastPhCol changed with it,
//   Vue 3 only when the computed rows/cols change their value;
// - editMode: Vue 2's prop option `false` is `null` (any).

import { defineComponent, reactive } from 'vue';
import { vocabulary } from './platform.js';

const itemTemplate = `
<div class=dashboard-item :draggable="editMode"
	:style="{gridArea: gridArea}" @dragstart=dragStart @dragend=dragEnd>
	<slot></slot>
	<div class=drag-area v-if=editMode>
		<button v-if="!isnew" class="clear-button" @click=remove>✕</button>
	</div>
</div>
`;

const placeholderTemplate = `
<div class='dashboard-placeholder' @drop=drop @dragover=dragOver @dragenter=dragEnter
:style="{gridRow: row, gridColumn: col}" :class="{hover}"></div>
`;

const boardTemplate = `
<div class="dashboard-container" :class="{editing: editMode}">
	<div class="drag-host" ref=drag-host></div>
	<div class=dashboard :style="{gridTemplateColumns: templateColumns, gridTemplateRows: templateRows}" ref=dash>
		<div v-if="editable && !editMode" class="start-toolbar toolbar"
				:style="{'grid-column':cols + 1}" :class="{'no-items': !hasItems}">
			<slot name="startbtn"></slot>
		</div>
		<div v-if="!editMode" class="main-toolbar"
			:style="{'grid-column':cols + 1}">
			<slot name="toolbar2"></slot>
		</div>
		<template v-if=editMode>
			<a2-dashboard-placeholder v-for="ph in placeholders" v-show="placeholderVisible(ph.row, ph.col)"
				:row="ph.row" :col="ph.col" :key="ph.key" :hover="ph.hover"/>
		</template>
		<slot>
			<a2-dashboard-item v-for="(itm, ix) in items" :key=ix :item="itm"
					:edit-mode="editMode"
					:row="itm.row" :col="itm.col" :col-span="itm.colSpan" :row-span="itm.rowSpan">
				<slot name="element" v-bind:item="itm"></slot>
			</a2-dashboard-item>
		</slot>
		<div v-if="!hasItems && !editMode">
			<slot name="empty"></slot>
		</div>
	</div>
	<div class="dashboard-list" v-if="editMode">
		<div class="widget-toolbar">
			<slot name="toolbar"></slot>
		</div>
		<ul class="widget-list-grouping" v-if="groupBy">
			<li class="widget-group" v-for="(grp, ixg) in groupingList" :key="ixg"
					:class="{collapsed: isGroupCollapsed(grp)}">
				<div class="widget-group-title" @click.stop.prevent="toggleGroup(grp)">
					<span v-text="grp.name"/>
					<span class="ico collapse-handle"></span>
				</div>
				<ul class="widget-list">
					<a2-dashboard-item v-for="(itm, ix) in grp.items" :key=ix :edit-mode="true"
							:item=itm :col-span="itm.colSpan" :row-span="itm.rowSpan" :isnew=true>
						<slot name="listitem" v-bind:item="itm"></slot>
					</a2-dashboard-item>
				</ul>
			</li>
		</ul>
		<ul class="widget-list" v-else>
			<a2-dashboard-item v-for="(itm, ix) in list" :key=ix :edit-mode="true"
					:item=itm :col-span="itm.colSpan" :row-span="itm.rowSpan" :isnew=true>
				<slot name="listitem" v-bind:item="itm"></slot>
			</a2-dashboard-item>
		</ul>
	</div>
</div>
`;

type Cell = { row: number, col: number };
type Placeholder = Cell & { key: string, hover: boolean };
type Elem = { startRow: number, startCol: number, endRow: number, endCol: number };

const placeHolder = defineComponent({
	name: 'a2-dashboard-placeholder',
	template: placeholderTemplate,
	props: {
		row: Number,
		col: Number,
		hover: Boolean
	},
	computed: {
		obj(): Cell {
			return { row: this.row!, col: this.col! };
		}
	},
	methods: {
		dragOver(ev: DragEvent) {
			if ((this.$parent as any).$canDrop(this.obj))
				ev.preventDefault();
		},
		dragEnter() {
			(this.$parent as any).$enter(this.obj);
		},
		drop() {
			(this.$parent as any).$drop(this.obj);
		}
	}
});

vocabulary.component('a2-dashboard-item', defineComponent({
	template: itemTemplate,
	props: {
		row: { type: Number, default: 1 },
		rowSpan: { type: Number, default: 1 },
		col: { type: Number, default: 1 },
		colSpan: { type: Number, default: 1 },
		isnew: Boolean,
		item: Object,
		editMode: Boolean
	},
	data() {
		return {
			posX: 0,
			posY: 0
		};
	},
	computed: {
		gridArea(): string {
			return `${this.row} / ${this.col} / span ${this.rowSpan} / span ${this.colSpan}`;
		}
	},
	methods: {
		dragStart(ev: DragEvent) {
			if (!this.editMode) return;
			ev.dataTransfer!.effectAllowed = "move";
			if (this.isnew) {
				this.posX = 0;
				this.posY = 0;
			}
			else {
				const target = ev.target as HTMLElement;
				this.posY = Math.floor(ev.offsetY / (target.offsetHeight / this.rowSpan));
				this.posX = Math.floor(ev.offsetX / (target.offsetWidth / this.colSpan));
			}
			const img = (this.$parent as any).$getDragImage(this);
			ev.dataTransfer!.setDragImage(img, ev.offsetX, ev.offsetY);
			(this.$parent as any).$start(this);
		},
		dragEnd() {
			if (!this.editMode) return;
			(this.$parent as any).$dragEnd();
		},
		remove() {
			(this.$parent as any).$removeItem(this.item);
		}
	},
	mounted() {
		(this.$parent as any).$register(this);
	}
}));

vocabulary.component('a2-dashboard', defineComponent({
	template: boardTemplate,
	components: {
		'a2-dashboard-placeholder': placeHolder
	},
	props: {
		items: Array,
		list: Array,
		groupBy: String,
		editable: Boolean,
		editMode: null,
		cellSize: {
			type: Object, default() { return { cx: '100px', cy: '100px' }; }
		},
	},
	data() {
		return {
			staticElems: [] as Elem[],
			currentElem: null as any,
			lastPhRow: 0,
			lastPhCol: 0,
			collapsedGroups: [] as string[]
		};
	},
	computed: {
		hasItems(): boolean {
			return !!(this.items && this.items.length);
		},
		groupingList(): { name: string, items: any[] }[] {
			if (!this.groupBy)
				return [];
			const el: { name: string, items: any[] }[] = [];
			(this.list as any[]).forEach(p => {
				const g = p[this.groupBy!];
				const found = el.find(x => x.name === g);
				if (found)
					found.items.push(p);
				else
					el.push({
						name: g,
						items: [p]
					});
			});
			return el;
		},
		rows(): number {
			let rows = 0;
			const items = this.items as any[];
			if (items && items.length)
				rows = items.reduce((p, c) => Math.max(p, c.row + (c.rowSpan || 1) - 1), -Infinity);
			if (this.editMode) {
				rows += 1;
				rows = Math.max(rows, this.lastPhRow);
			}
			return rows;
		},
		cols(): number {
			let cols = 0;
			const items = this.items as any[];
			if (items && items.length)
				cols = items.reduce((p, c) => Math.max(p, c.col + (c.colSpan || 1) - 1), -Infinity);
			if (this.editMode) {
				cols += 1;
				cols = Math.max(cols, this.lastPhCol);
			}
			return cols;
		},
		placeholders(): Placeholder[] {
			const ph: Placeholder[] = [];
			for (let r = 0; r < this.rows; r++) {
				for (let c = 0; c < this.cols; c++) {
					ph.push(reactive({ row: r + 1, col: c + 1, key: `${c}:${r}`, hover: false }));
				}
			}
			return ph;
		},
		templateColumns(): string {
			if (!this.hasItems && !this.editMode)
				return '';
			return `repeat(${this.cols}, ${this.cellSize.cx}) ${this.editable ? 'minmax(20px,1fr)' : ''}`;
		},
		templateRows(): string {
			if (!this.hasItems && !this.editMode)
				return '';
			return `repeat(${this.rows}, ${this.cellSize.cy})`;
		},
		elements(): Elem[] {
			if (this.items)
				return (this.items as any[]).map(item => {
					return {
						startRow: item.row,
						startCol: item.col,
						endRow: item.row + (item.rowSpan || 1) - 1,
						endCol: item.col + (item.colSpan || 1) - 1
					};
				});
			return this.staticElems;
		}
	},
	methods: {
		placeholderVisible(row: number, col: number): boolean {
			if (!this.editMode) return false;
			const intercect = (elem: Elem) =>
				row >= elem.startRow && row <= elem.endRow &&
				col >= elem.startCol && col <= elem.endCol;
			return !this.elements.find(intercect);
		},
		$register(item: any) {
			this.staticElems.push({ startRow: item.row, startCol: item.col, endRow: item.row + item.rowSpan - 1, endCol: item.col + item.colSpan - 1 });
		},
		$removeItem(itm: any) {
			(this.items as any).$remove(itm);
			this.$clearHover();
			this.lastPhRow = 0;
			this.lastPhCol = 0;
		},
		$findPlaceholder(el: Cell) {
			return this.placeholders.find((x: Placeholder) => x.row === el.row && x.col == el.col);
		},
		$hover(arr: string[], pos: { x: number, y: number, cx: number, cy: number }) {
			this.lastPhRow = pos.y + pos.cy;
			this.lastPhCol = pos.x + pos.cx;
			this.placeholders.forEach((ph: Placeholder) => {
				const sign = `${ph.row}:${ph.col}`;
				const find = arr.find(ai => ai === sign);
				ph.hover = !!find;
			});
		},
		$dragEnd() {
			this.$clearHover();
			this.lastPhRow = 0;
			this.lastPhCol = 0;
		},
		$clearHover() {
			this.placeholders.forEach((ph: Placeholder) => ph.hover = false);
		},
		$start(el: any) {
			this.currentElem = el;
		},
		$getDragImage(el: any) {
			const img = this.$refs['drag-host'] as HTMLElement;
			const rs = window.getComputedStyle(this.$refs.dash as Element);
			const colSize = parseFloat(rs.gridTemplateColumns.split(' ')[0]);
			const rowSize = parseFloat(rs.gridTemplateRows.split(' ')[0]);
			const colGap = parseFloat(rs.columnGap);
			const rowGap = parseFloat(rs.rowGap);
			img.style.width = (colSize * el.colSpan + (el.colSpan - 1) * colGap) + 'px';
			img.style.height = (rowSize * el.rowSpan + (el.rowSpan - 1) * rowGap) + 'px';
			return img;
		},
		$setHover(el: Cell) {
			const ce = this.currentElem;
			if (!ce) return;
			const ph = this.$findPlaceholder(el);
			if (!ph) return;
			const x = ph.col - ce.posX;
			const y = ph.row - ce.posY;
			const arr: string[] = [];
			for (let r = 0; r < ce.rowSpan; r++)
				for (let c = 0; c < ce.colSpan; c++)
					arr.push(`${r + y}:${c + x}`);
			this.$hover(arr, { x, y, cx: ce.colSpan, cy: ce.rowSpan });
		},
		$enter(el: Cell) {
			this.$setHover(el);
		},
		$canDrop(el: Cell): boolean {
			const ce = this.currentElem;
			if (!ce) return false;
			const pos = {
				t: el.row - ce.posY,
				l: el.col - ce.posX,
				b: 0,
				r: 0
			};
			pos.b = pos.t + ce.rowSpan - 1;
			pos.r = pos.l + ce.colSpan - 1;

			const intersect = (el: any) => {
				const r = {
					t: el.row,
					l: el.col,
					b: el.row + (el.rowSpan || 1) - 1,
					r: el.col + (el.colSpan || 1) - 1
				};
				const ints =
					r.l > pos.r ||
					r.r < pos.l ||
					r.t > pos.b ||
					r.b < pos.t;
				return !ints;
			};
			// check intersections here
			return !(this.items as any[]).some(el => el !== ce.item && intersect(el));
		},
		$drop(el: Cell) {
			this.$clearHover();
			const ce = this.currentElem;
			if (ce) {
				if (ce.item) {
					ce.item.row = el.row - ce.posY;
					ce.item.col = el.col - ce.posX;
					if (ce.isnew)
						(this.items as any[]).push(Object.assign({}, ce.item));
				}
				this.currentElem = null;
			}
		},
		isGroupCollapsed(grp: { name: string }): boolean {
			return this.collapsedGroups.indexOf(grp.name) >= 0;
		},
		toggleGroup(grp: { name: string }) {
			if (!this.isGroupCollapsed(grp))
				this.collapsedGroups.push(grp.name);
			else {
				const ix = this.collapsedGroups.indexOf(grp.name);
				if (ix >= 0)
					this.collapsedGroups.splice(ix, 1);
			}
		}
	},
	watch: {
		editMode(val: unknown) {
			if (!val) {
				this.lastPhRow = 0;
				this.lastPhCol = 0;
			}
		}
	}
}));
