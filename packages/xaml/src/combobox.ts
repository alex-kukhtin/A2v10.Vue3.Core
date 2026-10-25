// combobox (Net48 components/combobox.js), unchanged in behaviour: over control; a select of itemsSource (or its own
// options in the slot), grouped by groupby; the value is always the itemsSource's element. The server writes it as
// <select is="vue:combobox"> (ComboBox.cs). v-if beside v-for tests groupby, a prop: Vue 3's order (v-if first)
// gives the same.

import { defineComponent } from 'vue';
import { control } from './control.js';
import { require, vocabulary } from './platform.js';

const utils = require('std:utils');

const comboBoxTemplate =
	`<div :class="cssClass()" v-lazy="itemsSource" :test-id="testId">
	<label v-if="hasLabel"><span v-text="label"/><slot name="hint"/><slot name="link"></slot></label>
	<div class="input-group">
		<div class="select-wrapper" :disabled="disabled" >
			<div v-text="getWrapText()" class="select-text" ref="wrap" :class="wrapClass"/>
			<span class="caret"/>
		</div>
		<select v-focus v-model="cmbValue" :disabled="disabled" :tabindex="tabIndex" ref="sel" :title="getWrapText()">
			<slot>
				<optgroup v-for="(grp, grpIndex) in itemsSourceGroup" :key="grpIndex" v-if="groupby"
					:label="grp.name">
					<option v-for="(cmb, cmbIndex) in grp.items" :key="grpIndex + '_' + cmbIndex"
						v-text="getName(cmb, true)" :value="getValue(cmb)" :class="getClass(cmb)"></option>
				</optgroup>
				<option v-for="(cmb, cmbIndex) in itemsSource" :key="cmbIndex" v-if="!groupby"
					v-text="getName(cmb, true)" :value="getValue(cmb)" :class="getClass(cmb)"></option>
			</slot>
		</select>
		<validator :invalid="invalid" :errors="errors" :options="validatorOptions"></validator>
	</div>
	<slot name="popover"></slot>
	<span class="descr" v-if="hasDescr" v-text="description"></span>
</div>
`;

vocabulary.component('combobox', defineComponent({
	extends: control,
	template: comboBoxTemplate,
	props: {
		prop: String,
		item: {
			type: Object, default() { return {}; }
		},
		itemsSource: {
			type: Array, default() { return []; }
		},
		itemToValidate: Object,
		propToValidate: String,
		nameProp: String,
		valueProp: String,
		boldProp: String,
		cssClassProp: String,
		showvalue: Boolean,
		align: String,
		groupby: String
	},
	computed: {
		cmbValue: {
			get(): unknown {
				const item = this.item as any;
				if (this.itemsSource.length === 0 && item) {
					const itemval = item[this.prop!];
					if (itemval && itemval.$empty && !itemval.$isEmpty)
						itemval.$empty();
				}
				return this.getComboValue();
			},
			set(value: unknown) {
				if (this.item) (this.item as any)[this.prop!] = value;
			}
		},
		itemsSourceGroup(): unknown[] {
			if (!this.groupby) return this.itemsSource;
			const prop = this.groupby;
			const items = this.itemsSource;
			const set = new Set(items.map((x: any) => utils.eval(x, prop)));
			return Array.from(set).map(key => { return { name: key, items: items.filter((val: any) => key == utils.eval(val, prop)) }; });
		},
		wrapClass(): string {
			let cls = '';
			if (this.align && this.align !== 'left')
				cls += 'text-' + this.align;
			return cls;
		}
	},
	methods: {
		getName(itm: any) {
			return this.nameProp ? utils.eval(itm, this.nameProp) : itm.$name;
		},
		getValue(itm: unknown) {
			return this.valueProp ? utils.eval(itm, this.valueProp) : itm;
		},
		getClass(itm: unknown) {
			if (this.boldProp)
				return utils.eval(itm, this.boldProp) ? 'bold' : undefined;
			if (this.cssClassProp)
				return utils.eval(itm, this.cssClassProp);
			return undefined;
		},
		getWrapText() {
			return this.showvalue ? this.getComboValue() : this.getText();
		},
		getComboValue(): any {
			const val = this.item ? (this.item as any)[this.prop!] : null;
			if (!utils.isObjectExact(val))
				return val;
			const vProp = this.valueProp || '$id';
			if (!(vProp in val))
				return val;
			if (this.itemsSource.indexOf(val) !== -1) {
				return val;
			}
			// always return value from ItemsSource
			return this.itemsSource.find((x: any) => x[vProp] === val[vProp]) || null;
		},
		getText() {
			const cv = this.getComboValue();
			if (cv === null)
				return '';
			if (utils.isObjectExact(cv))
				return this.getName(cv);
			if (this.itemsSource && this.itemsSource.length) {
				const vProp = this.valueProp || '$id';
				const ob = this.itemsSource.find((x: any) => x[vProp] === cv);
				return ob ? this.getName(ob) : '';
			} else {
				return this.getOptionsText(cv);
			}
		},
		getOptionsText(cv: unknown) {
			// get text from select directly.
			const sel = this.$refs.sel as HTMLSelectElement;
			if (!sel) return '';
			const ops = sel.options;
			for (let i = 0; i < ops.length; i++) {
				if ('' + ops[i].value === '' + cv)
					return ops[i].text;
			}
			const si = sel.selectedIndex;
			if (si < 0 || si >= ops.length) return '';
			return ops[si].text;
		}
	},
	mounted() {
		// litle hack. $refs are unavailable during init.
		const t = this.getText();
		if (t)
			(this.$refs.wrap as HTMLElement).innerText = t;
	}
}));
