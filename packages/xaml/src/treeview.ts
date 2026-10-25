// tree-view (Net48 components/treeview.js), unchanged in behaviour: a tree as nested lists, tree-item per element,
// its children (options.subitems) shown while it is $expanded; a click selects ($select over the root items) or
// toggles a folder that options.folderSelect does not let select; options name the label, icon, title, css props.
// Vue 3: tree-item resolves itself by its name; _toggling, a data key Vue 2 did not proxy (so not reactive), is set
// on the instance in created; $children → ref 'items'.

import { defineComponent } from 'vue';
import { require, vocabulary } from './platform.js';

const utils = require('std:utils');
const eventBus = require('std:eventBus');
const platform = require('std:platform');

//stop for toggle is required!

const treeItemComponent = defineComponent({
	name: 'tree-item',
	template: `
<li @click.stop.prevent="doClick(item)" :title=title v-on:dblclick.stop.prevent="doDblClick(item)"
	v-show=isItemVisible
	:class="[cssClass, {expanded: isExpanded, collapsed:isCollapsed, active:isItemSelected, folder:isFolder, group: isItemGroup}]" >
	<div :class="{overlay:true, 'no-icons': !options.hasIcon}">
		<a class="toggle" v-if="isFolder" href @click.stop.prevent=toggle></a>
		<span v-else class="toggle"/>
		<i v-if="options.hasIcon" :class="iconClass"/>
		<a v-if="hasLink(item)" :href=dataHref tabindex="-1" v-text="item[options.label]" :class="{'no-wrap':!options.wrapLabel }"/>
		<span v-else v-text="item[options.label]" :class="{'tv-folder':true, 'no-wrap':!options.wrapLabel}"/>
	</div>
	<ul v-if=isFolder v-show=isExpanded>
		<tree-item v-for="(itm, index) in item[options.subitems]" :options="options"
			:key="index" :item="itm" :click="click" :doubleclick="doubleclick" :get-href="getHref" :is-active="isActive" :expand="expand" :root-items="rootItems">
		</tree-item>
	</ul>
</li>
`,
	props: {
		item: { type: Object, required: true },
		options: { type: Object, required: true },
		rootItems: Array,
		/* callbacks */
		click: Function,
		expand: Function,
		isActive: Function,
		isGroup: Function,
		getHref: Function,
		doubleclick: Function
	},
	methods: {
		isFolderSelect(item: any) {
			const fs = this.options.folderSelect;
			if (utils.isFunction(fs))
				return fs(item);
			return !!this.options.folderSelect;
		},
		doClick(item: any) {
			eventBus.$emit('closeAllPopups');
			if (this.isFolder && !this.isFolderSelect(item))
				this.toggle();
			else if ("$select" in item)
				item.$select(this.rootItems);
			else if (this.click)
				this.click(item);
		},
		doDblClick(item: any) {
			eventBus.$emit('closeAllPopups');
			if (this.isFolder && !this.isFolderSelect(item))
				return;
			if (this.doubleclick)
				this.doubleclick();
		},
		hasLink(item: any) {
			return !this.isFolder || this.isFolderSelect(item);
		},
		toggle() {
			// toggle with stop!
			eventBus.$emit('closeAllPopups');
			if (!this.isFolder)
				return;
			const self = this as any;
			self._toggling = true;
			this.expandItem(!this.item.$expanded);
			if (this.expand) {
				this.expand(this.item, this.options.subitems);
			}
			this.$nextTick(() => {
				self._toggling = false;
			});
		},
		expandItem(val: boolean) {
			platform.set(this.item, '$expanded', val);
		},
		openElem() {
			if (!this.isFolder)
				return;
			this.expandItem(true);
		}
	},
	computed: {
		isFolder(): boolean {
			if (utils.isDefined(this.item.$hasChildren) && this.item.$hasChildren)
				return true;
			if (utils.isDefined(this.options.isFolder))
				return this.item[this.options.isFolder];
			const ch = this.item[this.options.subitems];
			return ch && ch.length;
		},
		isItemVisible(): boolean {
			const iv = this.options.isVisible;
			if (!iv) return true;
			return this.item[iv];
		},
		isExpanded(): boolean {
			return this.isFolder && this.item.$expanded;
		},
		isCollapsed(): boolean {
			return this.isFolder && !this.item.$expanded;
		},
		title(): string {
			let t = this.item[this.options.title];
			if (!t)
				t = this.item[this.options.label];
			return t;
		},
		isItemSelected(): boolean {
			if (this.item && "$selected" in this.item)
				return this.item.$selected;
			return this.isActive && this.isActive(this.item);
		},
		isItemGroup(): boolean {
			const gp = this.options ? this.options.isGroup : undefined;
			if (gp)
				return utils.eval(this.item, gp);
			else
				return this.isGroup && this.isGroup(this.item);
		},
		iconClass(): string | undefined {
			const icons = this.options.staticIcons;
			if (icons)
				return "ico ico-" + (this.isFolder ? icons[0] : icons[1]);
			if (this.options.icon) {
				const icon = this.item[this.options.icon];
				return icon ? "ico ico-" + (icon || 'empty') : '';
			}
			return undefined;
		},
		dataHref(): string {
			return this.getHref ? this.getHref(this.item) : '';
		},
		cssClass(): string | undefined {
			if (!this.options) return undefined;
			const xname = this.options.xtraClass;
			if (!xname) return undefined;
			return this.item[xname] || undefined;
		}
	},
	watch: {
		isItemSelected(newVal: boolean) {
			const el = this.$el as Element;
			if (newVal && el.scrollIntoViewCheck)
				el.scrollIntoViewCheck();
		}
	},
	updated() {
		// open expanded when reloaded
		if (!(this as any)._toggling && this.options.initialExpand)
			this.item.$expanded = true;
		if (this.item.$expanded) {
			if (this.item.$hasChildren) {
				const arr = this.item[this.options.subitems];
				if (!arr.$loaded) {
					this.expandItem(false);
				}
			}
		}
	},
	created() {
		(this as any)._toggling = false;
		if (this.options.initialExpand)
			platform.set(this.item, '$expanded', true);
	}
});

vocabulary.component('tree-view', defineComponent({
	components: {
		'tree-item': treeItemComponent
	},
	template: `
<ul class="tree-view">
	<tree-item v-for="(itm, index) in items" :options="options" :get-href="getHref"
		:item="itm" :key="index" ref="items"
		:click="click" :doubleclick="doubleclick" :is-active="isActive" :is-group="isGroup" :expand="expand" :root-items="items">
	</tree-item>
	<slot name=contextmenu></slot>
</ul>`,
	props: {
		options: Object,
		items: Array,
		isActive: Function,
		isGroup: Function,
		click: Function,
		expand: Function,
		autoSelect: String,
		getHref: Function,
		expandFirstItem: Boolean,
		doubleclick: Function
	},
	computed: {
		isSelectFirstItem(): boolean {
			return this.autoSelect === 'first-item';
		}
	},
	watch: {
		items() {
			this.doExpandFirst();
		}
	},
	methods: {
		selectFirstItem() {
			if (!this.isSelectFirstItem) return;
			const itms = this.items as any;
			if (!itms.length) return;
			let fe = null;
			if (this.options && this.options.isVisible) {
				const vi = this.options.isVisible;
				fe = itms.$find((x: any) => x[vi]);
			} else
				fe = itms[0];
			if (!fe) return;
			if (fe.$select)
				fe.$select(this.items);
		},
		doExpandFirst() {
			if (!this.expandFirstItem)
				return;
			this.$nextTick(() => {
				const children = this.$refs['items'] as any[] | undefined;
				if (!children)
					return;
				children.forEach((val) => {
					if (val && val.openElem) {
						val.openElem();
					}
				});
			});
		}
	},
	created() {
		this.selectFirstItem();
		this.doExpandFirst();
	},
	updated() {
		if (this.isSelectFirstItem && !(this.items as any).$selected) {
			this.selectFirstItem();
		}
	}
}));
