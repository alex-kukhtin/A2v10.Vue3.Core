// a2-list (Net48 components/list.js), unchanged in behaviour: the elements of an array by the slot 'items', grouped
// by a property if asked, selected by mouse and arrows; the first, the last or the model's element selected at start.
// Vue 3: $root was the page (base.js): its $modelInfo is the page's controller's (inject $page).

import { defineComponent } from 'vue';
import { require, vocabulary } from './platform.js';

const utils = require('std:utils');
const locale = window.$$locale as any;

vocabulary.component('a2-list', defineComponent({
	template:
		`
<ul class="a2-list" v-lazy="itemsSource">
	<template v-if="itemsSource">
		<li class="a2-list-item" tabindex="1" :class="cssClass(listItem)" v-for="(listItem, listItemIndex) in source" :key="listItemIndex"
				@mousedown="select(listItem)" @keydown="keyDown"
				ref="li" v-on:dblclick.prevent="doDblClick">
			<span v-if="listItem.__group" v-text="listItem.__group"></span>
			<slot name="items" :item="listItem" v-if="!listItem.__group"/>
		</li>
		<div class="list-empty" v-if="$isEmpty">
			<slot name="empty" />
		</div>
	</template>
	<template v-else>
		<slot />
	</template>
</ul>
`,
	inject: {
		page: { from: '$page', default: null }
	},
	props: {
		itemsSource: Array,
		autoSelect: String,
		mark: String,
		markStyle: String,
		command: Function,
		selectable: {
			type: Boolean, default: true
		},
		hover: {
			type: Boolean, default: true
		},
		groupBy: String,
		doubleclick: Function
	},
	computed: {
		items(): any {
			return this.itemsSource;
		},
		selectedSource(): any {
			let src = this.items;
			if (!src) return null;
			if (src.$origin)
				src = src.$origin;
			return src.$selected;
		},
		source(): any[] {
			if (!this.groupBy)
				return this.items;
			const grmap: Record<string, { group: string, items: any[] }> = {};
			for (const itm of this.items) {
				let key = utils.eval(itm, this.groupBy);
				if (utils.isDate(key))
					key = utils.format(key, 'Date');
				if (!utils.isDefined(key)) key = '';
				if (key === '') key = locale.$Unknown || 'Unknown';
				if (!(key in grmap)) {
					grmap[key] = {
						group: key,
						items: []
					};
				}
				grmap[key].items.push(itm);
			}
			const rarr: any[] = [];
			for (const key in grmap) {
				const me = grmap[key];
				rarr.push(Object.assign({}, me, { __group: me.group, __count: me.items.length }));
				for (const e of me.items) {
					rarr.push(e);
				}
			}
			return rarr;
		},
		$isEmpty(): boolean {
			return this.items && this.items.length === 0;
		}
	},
	methods: {
		cssClass(item: any) {
			const getMark = (el: unknown) => {
				if (!this.mark) return '';
				let cls = utils.eval(el, this.mark);
				if (this.markStyle === 'row')
					cls += ' no-marker';
				else if (this.markStyle === 'marker')
					cls += ' no-background';
				return cls;
			};
			if (this.groupBy && item.__group)
				return 'group' + (this.mark ? ' mark' : '');
			return (item.$selected ? 'active ' : ' ') + getMark(item);
		},
		select(item: any) {
			if (!this.selectable) return;
			if (item.$select) item.$select();
		},
		selectStatic() {
			alert('yet not implemented');
			console.dir(this);
		},
		selectFirstItem() {
			if (!this.autoSelect) return;
			if (!this.selectable) return;
			const src = this.items;
			if (src.$selected) return; // already selected
			if (!src || !src.length)
				return;
			if (this.autoSelect === 'first-item') {
				// from source (not $origin!)
				const fe = src[0];
				this.select(fe);
				return;
			} else if (this.autoSelect === 'last-item') {
				// from source (not $origin!)
				const fe = src[src.length - 1];
				this.select(fe);
				return;
			} else if (this.autoSelect === 'item-id') {
				const rootId = (this.page as any).$modelInfo.Id;
				if (!utils.isDefined(rootId)) {
					console.error('Id not found in Root.modelInfo');
					return;
				}
				let fe = src[0];
				if (rootId) {
					fe = src.find((itm: any) => itm.$id === rootId);
					if (!fe)
						console.error(`Element with id=${rootId} not found`);
				}
				if (fe) this.select(fe);
			}
		},
		keyDown(e: KeyboardEvent) {
			const next = (delta: number) => {
				let index = this.items.indexOf(this.selectedSource);
				if (index === -1)
					return;
				index += delta;
				if (index === -1)
					return;
				if (index < this.items.length)
					this.select(this.items[index]);
			};
			switch (e.which) {
				case 38: // up
					next(-1);
					break;
				case 40: // down
					next(1);
					break;
				case 36: // home
				case 35: // end
				case 33: // pgUp
				case 34: // pgDn
					break;
				case 13: // Enter
					if (utils.isFunction(this.command)) {
						this.command!();
					}
					break;
				default:
					return;
			}
			e.preventDefault();
			e.stopPropagation();
		},
		doDblClick($event: Event) {
			$event.stopImmediatePropagation();
			if (this.doubleclick)
				this.doubleclick();
		}
	},
	created() {
		this.selectFirstItem();
	},
	updated() {
		if (!this.selectedSource && this.autoSelect) {
			this.selectFirstItem();
		}
		const src = this.items;
		if (!src) return;
		const li = this.$refs.li as Element[] | undefined;
		if (!li) return;
		setTimeout(() => {
			const ix = li.findIndex(itm => itm.classList.contains('active'));
			if (ix !== -1 && li && ix < li.length)
				li[ix].scrollIntoViewCheck();
		}, 0);
	}
}));
