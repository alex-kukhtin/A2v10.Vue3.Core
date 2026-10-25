// a2-color-combobox (Net48 components/colorcombobox.js), unchanged in behaviour: over control; item[prop] is one of
// itemsSource, shown as a tag-label of its colorProp, picked from a pane or stepped by the arrows. item[prop] is the
// element itself (an object) or its valueProp. A popup.

import { defineComponent } from 'vue';
import { control } from './control.js';
import { require, vocabulary } from './platform.js';

const popup = require('std:popup');
const eventBus = require('std:eventBus');
const platform = require('std:platform');
const utils = require('std:utils');

const colorComboboxTemplate =
	`<div class="color-picker" :class="cssClass()" :test-id="testId">
	<label v-if="hasLabel"><span v-text="label"/><slot name="hint"/><slot name="link"></slot></label>
	<div class="input-group">
		<div v-focus tabindex="0" @click.stop.prevent="toggle"
				@keydown="keydown" class="color-picker-wrapper">
			<span class="tag-label" :class="color" v-text="text"/>
			<span class="caret"/>
		</div>
		<validator :invalid="invalid" :errors="errors" :options="validatorOptions"></validator>
		<div class="color-picker-pane" v-show="isOpen">
			<div class="color-picker-list">
				<span class="tag-label" :class="itemClass(itm)" @mousedown.prevent="hit(itm)"
					v-for="(itm, ix) in itemsSource" :key="ix" v-text="itemText(itm)">
				</span>
			</div>
		</div>
	</div>
	<slot name="popover"></slot>
	<span class="descr" v-if="hasDescr" v-text="description"></span>
</div>
`;

vocabulary.component('a2-color-combobox', defineComponent({
	extends: control,
	props: {
		item: {
			type: Object, default() { return {}; }
		},
		itemsSource: Array as () => any[],
		prop: String,
		nameProp: String,
		colorProp: String,
		valueProp: String,
		outline: Boolean
	},
	data() {
		return {
			isOpen: false
		};
	},
	template: colorComboboxTemplate,
	computed: {
		text(): string {
			const cv = this.cmbValue;
			return cv ? cv[this.nameProp!] : '';
		},
		color(): string {
			const cv = this.cmbValue;
			let clr = cv ? (cv[this.colorProp!] || 'transparent') : 'transparent';
			if (this.outline)
				clr += ' outline';
			return clr;
		},
		cmbValue: {
			get(): any {
				const v = (this.item as any)[this.prop!];
				if (utils.isObjectExact(v))
					return v;
				return this.itemsSource!.find((s: any) => s[this.valueProp!] === v);
			},
			set(val: any) {
				const v = (this.item as any)[this.prop!];
				if (utils.isObjectExact(v))
					platform.set(this.item, this.prop, val);
				else
					(this.item as any)[this.prop!] = val[this.valueProp!];
			}
		}
	},
	methods: {
		itemText(itm: any): string {
			return itm[this.nameProp!];
		},
		itemClass(itm: any): string {
			return itm[this.colorProp!] + (this.outline ? ' outline' : '');
		},
		keydown(event: KeyboardEvent) {
			event.stopPropagation();
			if (this.disabled) return;
			const items = this.itemsSource!;
			switch (event.which) {
				case 40: { // down
					event.preventDefault();
					const ix = items.indexOf(this.cmbValue);
					if (ix < items.length - 1)
						this.cmbValue = items[ix + 1];
					else
						this.cmbValue = items[0];
					break;
				}
				case 38: { // up
					event.preventDefault();
					const ix = items.indexOf(this.cmbValue);
					if (ix > 0)
						this.cmbValue = items[ix - 1];
					else
						this.cmbValue = items[items.length - 1];
					break;
				}
			}
		},
		toggle() {
			if (this.disabled) return;
			if (!this.isOpen) {
				eventBus.$emit('closeAllPopups');
			}
			this.isOpen = !this.isOpen;
		},
		hit(itm: any) {
			this.cmbValue = itm;
			this.isOpen = false;
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
