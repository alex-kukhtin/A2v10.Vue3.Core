// a2-tags, a2-tags-list, a2-tags-filter (Net48 components/tagscontrol.js), unchanged in behaviour: an element's tags
// (item[prop], an array) picked from itemsSource; the tags shown; a filter's tags as ids joined by '-'. a2-tags and
// a2-tags-filter are popups over control.

import { defineComponent } from 'vue';
import { control } from './control.js';
import { require, vocabulary } from './platform.js';

const popup = require('std:popup');
const eventBus = require('std:eventBus');

const template = `
<div class="tags-control" :class="cssClass()" :test-id="testId">
	<label v-if="hasLabel"><span v-text="label"/><slot name="hint"/><slot name="link"></slot></label>
	<div class="input-group" :class="{focus: isOpen}" @click.stop.prevent="toggle">
		<ul class="tags-items" v-if="hasItems">
			<li v-for="(itm, ix) in value" :key="ix" class="tag-body tag-md-close" :class="tagColor(itm)">
				<span v-text="tagName(itm)" :title="tagTitle(itm)"/>
				<button @click.stop.prevent="itm.$remove()" class="btn-close">×</button>
			</li>
		</ul>
		<div class="tags-placeholder" v-else v-text="placeholder"></div>
		<div class="tags-pane" v-if=isOpen>
			<ul class="tags-pane-items">
				<li v-for="(itm, ix) in actualItemsSource" :key="ix" class="tag-body tag-md" :class="tagColor(itm)"
					@click.stop.prevent="addTag(itm)">
					<span v-text="tagName(itm)" :title="tagTitle(itm)"/>
				</li>
			</ul>
			<div class="tags-settings" v-if="!disabled">
				<button class="btn-settings" v-text="settingsText" @click.stop.prevent=doSettings></button>
			</div>
		</div>
	</div>
	<slot name="popover"></slot>
	<span class="descr" v-if="hasDescr" v-text="description"></span>
</div>
`;

const templateList = `
<div class="tags-list" :test-id="testId">
	<span v-for="(itm, ix) in itemsSource" :key="ix" class="tag-body tag-sm" :class="tagColor(itm)" v-text="tagName(itm)" :title="tagTitle(itm)"/>
</div>
`;

const templateFilter = `
<div class="tags-control" :class="cssClass()" :test-id="testId">
	<label v-if="hasLabel"><span v-text="label"/><slot name="hint"/><slot name="link"></slot></label>
	<div class="input-group" :class="{focus: isOpen}" @click.stop.prevent="toggle">
		<ul class="tags-items" v-if="hasItems">
			<li v-for="(itm, ix) in valueList" :key="ix" class="tag-body tag-md-close" :class="tagColor(itm)">
				<span v-text="tagName(itm)" :title="tagTitle(itm)"/>
				<button @click.stop.prevent="removeTag(itm)" class="btn-close">×</button>
			</li>
		</ul>
		<div class="tags-placeholder" v-else v-text="placeholder"></div>
		<div class="tags-pane" v-if=isOpen>
			<ul class="tags-pane-items">
				<li v-for="(itm, ix) in actualItemsSource" :key="ix" class="tag-body tag-md" :class="tagColor(itm)"
						@click.stop.prevent="addTag(itm)">
					<span v-text="tagName(itm)" :title="tagTitle(itm)" />
				</li>
			</ul>
		</div>
	</div>
	<slot name="popover"></slot>
	<span class="descr" v-if="hasDescr" v-text="description"></span>
</div>
`;

// the tag's name, color and title by the props naming them
const tagMethods = {
	tagName(this: any, itm: any) {
		return itm[this.contentProp];
	},
	tagColor(this: any, itm: any) {
		return itm[this.colorProp];
	},
	tagTitle(this: any, itm: any) {
		return itm[this.titleProp];
	}
};

vocabulary.component('a2-tags', defineComponent({
	extends: control,
	props: {
		item: {
			type: Object, default() { return {}; }
		},
		prop: String,
		itemsSource: Array,
		contentProp: { type: String, default: 'Name' },
		colorProp: { type: String, default: 'Color' },
		titleProp: { type: String, default: 'Memo' },
		disabled: Boolean,
		settingsText: { type: String, default: 'Settings' },
		placeholder: String,
		settingsFunc: Function,
		settingsCommand: Function
	},
	data() {
		return {
			isOpen: false
		};
	},
	template,
	computed: {
		value(): any[] {
			return (this.item as any)[this.prop!];
		},
		hasItems(): boolean {
			return this.value.length > 0;
		},
		actualItemsSource(): any[] {
			const val = this.value;
			return (this.itemsSource as any[]).filter(x => !val.some((ix: any) => x.$id === ix.$id));
		}
	},
	methods: {
		...tagMethods,
		addTag(itm: any) {
			if (this.disabled)
				return;
			const val = this.value;
			if (val.some((x: any) => x.$id === itm.$id))
				return; // already added
			(this.item as any)[this.prop!].$append(itm);
		},
		toggle() {
			if (this.disabled)
				return;
			if (!this.isOpen) {
				eventBus.$emit('closeAllPopups');
			}
			this.isOpen = !this.isOpen;
		},
		doSettings() {
			const root = (this.item as any).$root;
			if (this.settingsCommand)
				this.settingsCommand.call(root);
			else if (this.settingsFunc)
				this.settingsFunc.call(root, this.itemsSource);
		},
		__clickOutside() {
			this.isOpen = false;
		}
	},
	mounted() {
		popup.registerPopup(this.$el);
		this.$el._close = this.__clickOutside;
	},
	beforeUnmount() {
		popup.unregisterPopup(this.$el);
	}
}));

vocabulary.component('a2-tags-list', defineComponent({
	template: templateList,
	props: {
		testId: String,
		itemsSource: Array,
		contentProp: { type: String, default: 'Name' },
		colorProp: { type: String, default: 'Color' },
		titleProp: { type: String, default: 'Memo' }
	},
	methods: {
		...tagMethods
	}
}));

vocabulary.component('a2-tags-filter', defineComponent({
	extends: control,
	props: {
		item: {
			type: Object, default() { return {}; }
		},
		prop: String,
		itemsSource: Array,
		contentProp: { type: String, default: 'Name' },
		colorProp: { type: String, default: 'Color' },
		titleProp: { type: String, default: 'Memo' },
		placeholder: String
	},
	data() {
		return {
			isOpen: false
		};
	},
	template: templateFilter,
	computed: {
		value(): string {
			return (this.item as any)[this.prop!];
		},
		valueArray(): string[] {
			const v = this.value;
			return v ? v.split('-') : [];
		},
		valueList(): any[] {
			const va = this.valueArray;
			return (this.itemsSource as any[]).filter(tag => va.indexOf('' + tag.$id) >= 0);
		},
		actualItemsSource(): any[] {
			const va = this.valueArray;
			return (this.itemsSource as any[]).filter(tag => va.indexOf('' + tag.$id) < 0);
		},
		hasItems(): boolean {
			return !!this.value;
		}
	},
	methods: {
		...tagMethods,
		addTag(itm: any) {
			if (this.disabled)
				return;
			const va = this.valueArray;
			if (va.indexOf('' + itm.$id) >= 0)
				return; // already added
			(this.item as any)[this.prop!] = (va as unknown[]).concat([itm.$id]).join('-');
		},
		removeTag(itm: any) {
			const va = this.valueArray.filter((x: string) => x != itm.$id);
			(this.item as any)[this.prop!] = va.join('-');
		},
		toggle() {
			if (this.disabled)
				return;
			if (!this.isOpen) {
				eventBus.$emit('closeAllPopups');
			}
			this.isOpen = !this.isOpen;
		},
		__clickOutside() {
			this.isOpen = false;
		}
	},
	mounted() {
		popup.registerPopup(this.$el);
		this.$el._close = this.__clickOutside;
	},
	beforeUnmount() {
		popup.unregisterPopup(this.$el);
	}
}));
