// a2-multiselect (A2v10.Core Scripts/multiselect.js), unchanged in behaviour: item[prop] an array of { Id, Name } shown
// as tags; a pane fetches by the typed text (url's fetch through the page's $invoke, with fetchData), its checks applied
// to the array; the search link adds one picked in url's browse dialog. A popup.
// Vue 3: $root was the page (base.js): here the page's controller (inject $page); Vue.nextTick is $nextTick;
// destroyed is beforeUnmount.

import { defineComponent } from 'vue';
import { require, vocabulary } from './platform.js';

const popup = require('std:popup');
const utils = require('std:utils');
const locale = window.$$locale as any;

const DEFAULT_DELAY = 300;

type MsItem = { Id: unknown, Name: string, Checked: boolean };

vocabulary.component('a2-multiselect', defineComponent({
	template: `
<div class="a2-multiselect control-group" :style="{'--x-width': maxWidth}">
	<label v-text="label" />
	<div class="input-group" @click.stop.prevent=toggle>
		<div class="ms-placeholder" v-if="isEmpty">
			<span v-text="placeholder" />
		</div>
		<div class="ms-text" v-else>
			<span v-for="el in selArray" class="ms-tag">
				<span v-text="el.Name" class="ms-tag-body"/>
				<button @click.stop="removeItem(el)" class="ms-tag-remove">✕</button>
			</span>
		</div>
		<a href="" class="a2-hyperlink add-on" @click.stop.prevent=browseItem>
			<i class="ico ico-search"/>
		</a>
	</div>
	<div v-if="isOpen" class="ms-pane">
		<div class="input-group">
			<input v-focus v-model="query" @input="debouncedUpdate" class="ms-fetch"
				:placeholder="locale.$Search">
		</div>
		<ul class="ms-pane-list">
			<li v-for="itm in items" class="ms-pane-item" @click.stop="clickItem(itm)" :class="itemClass(itm)">
				<i class="ico" :class="itmIcon(itm)" />
				<span v-text="itm.Name" class="ms-pane-item-text line-clamp"/>
			</li>
		</ul>
		<div class="ms-pane-footer">
			<button class="btn btn-primary sm" @click=apply v-text="locale.$Apply"/>
			<button class="btn sm" @click=close v-text="locale.$Cancel"/>
		</div>
	</div>
</div>
`,
	inject: {
		page: { from: '$page', default: null }
	},
	props: {
		item: Object,
		prop: String,
		url: String,
		label: String,
		placeholder: String,
		fetchData: Object
	},
	data() {
		return {
			isOpen: false,
			query: '',
			items: [] as MsItem[],
			maxWidth: '250px'
		};
	},
	computed: {
		selArray(): any[] {
			return (this.item as any)[this.prop!];
		},
		locale(): any {
			return locale;
		},
		isEmpty(): boolean {
			return !this.selArray.length;
		},
		debouncedUpdate(): () => void {
			const delay = DEFAULT_DELAY;
			return utils.debounce(async () => {
				if (!this.query) {
					this.items.splice(0);
					return;
				}
				const invokeArg = Object.assign({}, { Text: this.query }, this.fetchData);
				const el = await (this.page as any).$invoke('fetch', invokeArg, this.url);
				if (!el) return;
				const keys = Object.keys(el);
				if (!keys || !keys.length) return;
				const arr = el[keys[0]];
				this.items.splice(0);
				for (const ai of arr)
					this.items.push({ Id: ai.Id, Name: ai.Name, Checked: this.isChecked(ai) });
			}, delay);
		}
	},
	methods: {
		async browseItem() {
			const vm = this.page as any;
			const be = await vm.$showDialog(this.url + '/browse', null, this.fetchData);
			if (!be) return;
			if (this.selArray.find((a: any) => a.Id === be.Id))
				return;
			const arr = (this.item as any)[this.prop!];
			const nelem = { Id: be.Id, Name: be.Name };
			if (arr.$append)
				arr.$append(nelem);
			else
				arr.push(nelem);
		},
		isChecked(itm: any): boolean {
			return !!this.selArray.find((x: any) => x.Id === itm.Id);
		},
		itmIcon(itm: MsItem): string {
			return itm.Checked ? 'ico-checkbox-checked' : 'ico-checkbox';
		},
		clickItem(itm: MsItem) {
			itm.Checked = !itm.Checked;
		},
		apply() {
			for (const x of this.items) {
				if (x.Checked)
					this.addItemToFilter(x);
				else
					this.removeItemFromFilter(x);
			}
			this.close();
		},
		addItemToFilter(itm: MsItem) {
			const ix = this.selArray.findIndex((x: any) => x.Id === itm.Id);
			if (ix >= 0) return;
			const nelem = { Id: itm.Id, Name: itm.Name };
			const arr = this.selArray as any;
			if (arr.$append)
				arr.$append(nelem);
			else
				arr.push(nelem);
		},
		removeItemFromFilter(itm: MsItem) {
			const arr = this.selArray;
			const ix = arr.findIndex((x: any) => x.Id === itm.Id);
			if (ix < 0) return;
			const el = arr[ix];
			if (el.$remove)
				el.$remove();
			else
				arr.splice(ix, 1);
		},
		itemClass(itm: MsItem): string | undefined {
			return itm.Checked ? 'active' : undefined;
		},
		toggle() {
			if (this.isOpen)
				this.close();
			else {
				this.isOpen = true;
				this.$nextTick(() => {
					const cs = this.$el.getElementsByClassName('ms-fetch');
					if (cs && cs.length && cs[0].focus)
						cs[0].focus();
				});
			}
		},
		close() {
			this.isOpen = false;
			this.items.splice(0);
			this.query = '';
		},
		removeItem(x: any) {
			if (x.$remove)
				x.$remove();
			else {
				const ix = this.selArray.indexOf(x);
				if (ix < 0) return;
				this.selArray.splice(ix, 1);
			}
		},
		__clickOutside(el: any) {
			if (el && el.closest && el.closest(".ms-pane"))
				return;
			this.close();
		}
	},
	mounted() {
		popup.registerPopup(this.$el);
		this.$el._close = this.__clickOutside;
		this.maxWidth = (this.$el.offsetWidth - 62) + 'px';
	},
	beforeUnmount() {
		popup.unregisterPopup(this.$el);
	}
}));
