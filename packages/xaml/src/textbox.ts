// textbox, a2-textarea, static (Net48 components/textbox.js), unchanged in behaviour: over control (control.ts).
// Vue 3: an event a component does not declare in emits is also a native listener on its root, and the input's own
// change bubbles to it: the handler would run twice. change is declared.
// password-- fake fields are a workaround for chrome autofill getting the wrong fields

import { defineComponent } from 'vue';
import { control } from './control.js';
import { app, require, vocabulary } from './platform.js';

const utils = require('std:utils');
const mask = require('std:mask');

const textBoxTemplate =
	`<div :class="cssClass()" :test-id="testId">
	<label v-if="hasLabel"><span v-text="label"/><slot name="hint"/><slot name="link"></slot></label>
	<div class="input-group">
		<input v-if="password" type="text" class="fake-pwd-field" tabindex="-1"/>
		<input ref="input" :type="controlType" v-focus :autocomplete="autocompleteText"
			v-bind:value="modelValue"
				v-on:change="onChange($event.target.value)"
				v-on:input="onInput($event.target.value)"
				v-on:keypress="onKey($event)"
				:class="inputClass" :placeholder="placeholder" :readonly="disabled" :tabindex="tabIndex" :maxlength="maxLength" :spellcheck="spellCheck"/>
		<slot></slot>
		<a class="a2-hyperlink add-on a2-inline" href="" @click.stop.prevent="dummy" v-if=hasFilter><i class="ico ico-filter-outline"></i></a>
		<a class="a2-hyperlink add-on a2-inline" href="" @click.stop.prevent="dummy" v-if=searchVisible><i class="ico ico-search"></i></a>
		<a class="a2-hyperlink add-on a2-inline" tabindex="-1" href="" @click.stop.prevent="clear" v-if="clearVisible"><i class="ico ico-clear"></i></a>
		<validator :invalid="invalid" :errors="errors" :options="validatorOptions"></validator>
	</div>
	<slot name="popover"></slot>
	<span class="descr" v-if="hasDescr" v-text="description"></span>
</div>
`;

const textAreaTemplate =
	`<div :class="cssClass()" :test-id="testId">
	<label v-if="hasLabel"><span v-text="label"/><slot name="hint"/><slot name="link"></slot></label>
	<div class="input-group">
		<textarea ref="input" v-focus v-auto-size="autoSize" v-bind:value="modelValue2" :style="areaStyle"
			v-on:change="onChange($event.target.value)"
			v-on:input="onInput($event.target.value)"
			v-on:keypress="onKey($event)"
			:rows="rows" :class="inputClass" :placeholder="placeholder" :readonly="disabled" :tabindex="tabIndex" :maxlength="maxLength" :spellcheck="spellCheck"/>
		<slot></slot>
		<validator :invalid="invalid" :errors="errors" :options="validatorOptions"></validator>
	</div>
	<slot name="popover"></slot>
	<span class="descr" v-if="hasDescr" v-text="description"></span>
</div>
`;

const staticTemplate =
	`<div :class="cssClass()" :test-id="testId">
	<label v-if="hasLabel"><span v-text="label"/><slot name="hint"/><slot name="link"></slot></label>
	<div class="input-group static">
		<span v-focus v-text="textProp" :class="inputClass" :tabindex="tabIndex" class="static-input"/>
		<slot></slot>
		<validator :invalid="invalid" :errors="errors" :options="validatorOptions"></validator>
	</div>
	<slot name="popover"></slot>
	<span class="descr" v-if="hasDescr" v-text="description"></span>
</div>
`;

const textbox = defineComponent({
	extends: control,
	template: textBoxTemplate,
	emits: ['change'],
	props: {
		item: {
			type: [Object, Array], default() {
				return {};
			}
		},
		prop: String,
		itemToValidate: Object,
		propToValidate: String,
		placeholder: String,
		password: Boolean,
		number: Boolean,
		spellCheck: { type: Boolean, default: undefined },
		enterCommand: Function,
		hasClear: Boolean,
		hasFilter: Boolean,
		hasSearch: Boolean,
		filters: Array
	},
	computed: {
		controlType(): string {
			return this.password ? 'password' : 'text';
		},
		autocompleteText(): string {
			return this.password ? 'new-password' : 'off';
		},
		searchVisible(): boolean {
			if (this.clearVisible) return false;
			return this.hasSearch;
		},
		clearVisible(): boolean {
			if (!this.hasClear) return false;
			return !!(this.item as any)[this.prop!];
		}
	},
	methods: {
		doFilter(value: string) {
			return utils.text.applyFilters(this.filters, value);
		},
		updateValue(value: string) {
			const item = this.item as any;
			if (this.mask)
				item[this.prop!] = mask.getUnmasked(this.mask, this.doFilter(value));
			else
				item[this.prop!] = utils.parse(this.doFilter(value), this.dataType);
			const mv = this.modelValue;
			const input = this.$refs.input as HTMLInputElement;
			if (input.value !== mv) {
				input.value = mv;
				this.$emit('change', item[this.prop!]);
			}
		},
		onInput(value: string) {
			if (this.updateTrigger === 'input')
				this.updateValue(value);
		},
		onChange(value: string) {
			if (this.updateTrigger !== 'input')
				this.updateValue(value);
		},
		onKey(event: KeyboardEvent) {
			if (this.number) {
				if ((event.charCode < 48 || event.charCode > 57) && event.charCode !== 45 /*minus*/) {
					event.preventDefault();
					event.stopPropagation();
				}
			}
			if (event.code === 'Enter') {
				if (this.enterCommand) {
					this.enterCommand();
				}
			}
		},
		clear() {
			(this.item as any)[this.prop!] = '';
		},
		dummy() {
		}
	}
});

const textarea = defineComponent({
	extends: control,
	template: textAreaTemplate,
	emits: ['change'],
	props: {
		item: {
			type: [Object, Array], default() {
				return {};
			}
		},
		prop: String,
		itemToValidate: Object,
		propToValidate: String,
		placeholder: String,
		autoSize: Boolean,
		rows: Number,
		spellCheck: { type: Boolean, default: undefined },
		enterCommand: Function,
		maxHeight: String,
		filters: Array
	},
	computed: {
		modelValue2(): unknown {
			if (!this.item) return null;
			return (this.item as any)[this.prop!];
		},
		areaStyle(): Record<string, string> | undefined {
			if (this.maxHeight)
				return { 'max-height': this.maxHeight };
			return undefined;
		}
	},
	methods: {
		updateValue(value: string) {
			const item = this.item as any;
			value = utils.text.applyFilters(this.filters, value);
			if (item[this.prop!] === value) return;
			item[this.prop!] = value;
			this.$emit('change', item[this.prop!]);
		},
		onInput(value: string) {
			if (this.updateTrigger === 'input')
				this.updateValue(value);
		},
		onChange(value: string) {
			if (this.updateTrigger !== 'input')
				this.updateValue(value);
		},
		onKey(event: KeyboardEvent) {
			if (event.code === 'Enter' && event.ctrlKey) {
				if (this.enterCommand) {
					this.enterCommand();
				}
			}
		}
	},
	watch: {
		modelValue() {
			if (!this.autoSize) return;
			const inp = this.$refs.input as HTMLElement;
			if (!inp) return;
			// send for auto size
			const evt = new Event('autosize', { bubbles: false, cancelable: true });
			inp.dispatchEvent(evt);
		}
	}
});

const staticControl = defineComponent({
	extends: control,
	template: staticTemplate,
	props: {
		item: {
			type: [Object, Array], default() {
				return {};
			}
		},
		prop: String,
		itemToValidate: Object,
		propToValidate: String,
		text: [String, Number, Date]
	},
	computed: {
		textProp(): unknown {
			if (this.mask && this.text)
				return mask.getMasked(this.mask, this.text);
			return this.text;
		}
	}
});

vocabulary.component('textbox', textbox);
app.components['textbox'] = textbox;

// Net48 meant app.components for these two too, but wrote app.components['a2-textarea', textarea]: none.
vocabulary.component('a2-textarea', textarea);
vocabulary.component('static', staticControl);
