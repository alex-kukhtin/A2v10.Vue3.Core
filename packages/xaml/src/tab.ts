// a2-tab-panel, a2-tab-item (Net48 components/tab.js), unchanged in behaviour: XAML's TabPanel, its tabs static (the
// items reach the panel by $parent, a control its item by $registerControl: an invalid control marks the header) or
// over :items (the slots items, header); only the active tab is rendered. Keeps NET48-BUGS.md B35, B36.
// Vue 3:
// - v-if binds tighter than v-for: the dynamic tab's v-if is inside a <template v-for>;
// - the watcher on items is deep: 1: Vue 2's fired on a mutation of the array, not of its elements (B35);
// - destroyed is unmounted.

import { defineComponent } from 'vue';
import { vocabulary } from './platform.js';

const tabPanelTemplate = `
<div class="tab-panel">
	<template v-if="static">
		<ul class="tab-header">
			<li :class="tab.tabCssClass" v-for="(tab, tabIndex) in tabs" :key="tabIndex" @click.prevent="select(tab)" v-show="tab.isVisible">
				<i v-if="tab.hasIcon" :class="tab.iconCss" ></i>
				<span v-text="tab.header"></span><span class="badge" v-if="tab.hasBadge" v-text="tab.badge"></span>
				<i v-if="tab.isInvalid()" class="ico ico-error-outline"/>
			</li>
		</ul>
		<slot name="title" />
		<div class="tab-content" :class="contentCssClass">
			<slot />
		</div>
	</template>
	<template v-else>
		<ul class="tab-header">
			<li :class="{active: isActiveTab(item)}" v-for="(item, tabIndex) in items" :key="tabIndex" @click.prevent="select(item)" v-show="item.isVisible">
				<slot name="header" :item="item" :index="tabIndex" :number="tabIndex + 1">
					<span v-text="defaultTabHeader(item, tabIndex)"></span>
				</slot>
			</li>
		</ul>
		<slot name="title" />
		<div class="tab-content">
			<template v-for="(item, tabIndex) in items" :key="tabIndex">
				<div class="tab-item" v-if="isActiveTab(item)">
					<slot name="items" :item="item" :index="tabIndex" />
				</div>
			</template>
		</div>
	</template>
</div>
`;

const tabItemTemplate = `
<div class="tab-item" v-if="isActive" v-show="isVisible">
	<slot />
</div>
`;

vocabulary.component('a2-tab-item', defineComponent({
	name: 'a2-tab-item',
	template: tabItemTemplate,
	props: {
		header: String,
		badge: [String, Number, Object],
		icon: String,
		tabStyle: String,
		tabShow: { type: Boolean, default: true },
		itemToValidate: Object,
		propToValidate: String
	},
	data() {
		return {
			controls: [] as any[]
		};
	},
	computed: {
		hasIcon(): boolean {
			return !!this.icon;
		},
		hasBadge(): boolean {
			return !!this.badge;
		},
		iconCss(): string {
			return this.icon ? 'ico ico-' + this.icon : '';
		},
		isActive(): boolean {
			return this === (this.$parent as any).activeTab;
		},
		tabCssClass(): string {
			return (this.isActive ? 'active ' : '') + (this.tabStyle || '');
		},
		isVisible(): boolean {
			return this.tabShow;
		}
	},
	methods: {
		isInvalid(): boolean {
			if (!this.controls.length) return false;
			for (const c of this.controls) {
				if (c.invalid()) {
					return true;
				}
			}
			return false;
		},
		$registerControl(control: any) {
			this.controls.push(control);
		},
		$unregisterControl(control: any) {
			const ix = this.controls.indexOf(control);
			if (ix !== -1)
				this.controls.splice(ix, 1);
		}
	},
	created() {
		(this.$parent as any).$addTab(this);
	},
	unmounted() {
		(this.$parent as any).$removeTab(this);
	}
}));

vocabulary.component('a2-tab-panel', defineComponent({
	template: tabPanelTemplate,
	props: {
		items: Array,
		header: String
	},
	data() {
		return {
			tabs: [] as any[],
			activeTab: null as any
		};
	},
	computed: {
		static(): boolean {
			return !this.items;
		},
		contentCssClass(): string {
			return this.activeTab ? this.activeTab.tabStyle : '';
		}
	},
	watch: {
		items: {
			deep: 1,
			handler(this: any, newVal: unknown[], oldVal: unknown[]) {
				const tabs = this.items;
				if (newVal.length < oldVal.length) {
					// tab has been removed
					if (this._index >= tabs.length)
						this._index = tabs.length - 1;
					this.select(tabs[this._index]);
				} else if (newVal.length === oldVal.length) {
					// may be reloaded; a mutation comes here too, newVal is oldVal (B35)
					if (tabs.length > 0) this.select(tabs[0]);
				} else {
					// tab has been added
					this.select(tabs[tabs.length - 1]);
				}
			}
		}
	},
	methods: {
		select(item: any) {
			this.activeTab = item;
			if (this.items)
				(this as any)._index = this.items.indexOf(item);
		},
		nextTab() {
			alert('next');
		},
		prevTab() {
			alert('prev');
		},
		isActiveTab(item: unknown): boolean {
			return item === this.activeTab;
		},
		defaultTabHeader(item: unknown, index: number): string {
			return 'Tab ' + (index + 1);
		},
		$addTab(tab: any) {
			this.tabs.push(tab);
		},
		$removeTab(tab: any) {
			const ix = this.tabs.indexOf(tab);
			if (ix === -1) return;
			this.tabs.splice(ix, 1);
			if (this.tabs.indexOf(this.activeTab) === -1) {
				if (this.tabs.length > 0)
					this.select(this.tabs[0]);
			}
		}
	},
	mounted() {
		if (this.tabs.length > 0)
			this.activeTab = this.tabs[0]; // no tab, reactive item
		else if (this.items && this.items.length)
			this.activeTab = this.items[0];
		(this as any)._index = 0;
	}
}));
