// control (Net48 components/control.js), unchanged in behaviour: the base of the input controls (textbox, combobox,
// datepicker…): label, validation, the masked or formatted value, the accelerator. Not a tag: app.components['control'],
// which the controls and the applications extend. The item and prop are the derived control's props.
// Vue 3: beforeDestroy is beforeUnmount; $children is gone (deferUpdate: forceUpdateChildren). itemToValidate and
// propToValidate are a derived control's, when it declares them: read from $props, where an undeclared one is
// undefined as in Vue 2, not through the instance, where Vue 3 warns while it renders.

import { defineComponent, type ComponentInternalInstance, type VNode } from 'vue';
import { app, require } from './platform.js';

const utils = require('std:utils');
const mask = require('std:mask');
const maccel = require('std:accel');

// Vue 2's $children: the component instances of a component's own render, not deeper. Each is updated.
export function forceUpdateChildren(instance: ComponentInternalInstance): void {
	const walk = (vnode: VNode | null | undefined) => {
		if (!vnode) return;
		if (vnode.component) {
			vnode.component.proxy!.$forceUpdate();
			return;
		}
		if (Array.isArray(vnode.children))
			for (const c of vnode.children)
				walk(c as VNode);
	};
	walk(instance.subTree);
}

export const control = defineComponent({
	props: {
		label: String,
		required: { type: null },
		align: { type: String, default: 'left' },
		description: String,
		disabled: { type: null },
		tabIndex: Number,
		dataType: String,
		format: String,
		validatorOptions: Object,
		updateTrigger: String,
		mask: String,
		hideZeros: Boolean,
		testId: String,
		accel: String,
		highlight: { type: null }
	},
	computed: {
		path(): string {
			const self = this as any;
			if (self.item._path_)
				return self.item._path_ + '.' + self.prop;
			else
				return self.prop;
		},
		pathToValidate(): string {
			const self = this as any;
			const p = self.$props;
			return p.itemToValidate._path_ + '.' + p.propToValidate;
		},
		modelValue(): any {
			const self = this as any;
			if (!self.item) return null;
			const val = self.item[self.prop];
			if (this.dataType)
				return utils.format(val, this.dataType, { hideZeros: this.hideZeros, format: this.format });
			else if (this.mask && val)
				return mask.getMasked(this.mask, val);
			return val;
		},
		hasValue(): boolean {
			const self = this as any;
			if (!self.item) return false;
			const val = self.item[self.prop];
			if (!val) return false;
			if (utils.isObjectExact(val))
				return !!val.Id;
			return true;
		},
		modelValueRaw(): unknown {
			const self = this as any;
			if (!self.item) return null;
			return self.item[self.prop];
		},
		errors(): any {
			const self = this as any;
			if (!self.item) return null;
			const root = self.item._root_;
			if (!root) return null;
			if (!root._validate_)
				return null;
			let err;
			const p = self.$props;
			if (p.itemToValidate)
				err = root._validate_(p.itemToValidate, this.pathToValidate, p.itemToValidate[p.propToValidate], this.deferUpdate);
			else
				err = root._validate_(self.item, this.path, this.modelValueRaw, this.deferUpdate);
			return err;
		},
		inputClass(): string {
			let cls = '';
			if (this.align && this.align !== 'left')
				cls += 'text-' + this.align;
			if (this.isNegative) cls += ' negative-red';
			if (this.updateTrigger === 'input')
				cls += ' trigger-input';
			return cls;
		},
		isNegative(): boolean {
			const self = this as any;
			if (this.dataType === 'Number' || this.dataType === 'Currency')
				if (self.item && this.modelValue < 0)
					return true;
			return false;
		},
		hasLabel(): boolean {
			return !!this.label;
		},
		hasDescr(): boolean {
			return !!this.description;
		},
		maxLength(): number | undefined {
			const self = this as any;
			if (!self.item) return undefined;
			if (!self.item.$maxLength) return undefined;
			return self.item.$maxLength(self.prop);
		}
	},
	mounted() {
		const self = this as any;
		// direct parent only
		if (self.$parent.$registerControl)
			self.$parent.$registerControl(this);
		if (this.accel)
			self._accelKey = maccel.registerControl(this.accel, this.$refs.input, 'focus');
		if (!this.mask) return;
		mask.mountElement(this.$refs.input, this.mask);
	},
	beforeUnmount() {
		const self = this as any;
		// direct parent only
		if (self.$parent.$unregisterControl)
			self.$parent.$unregisterControl(this);
		if (this.accel)
			maccel.unregisterControl(self._accelKey);
		if (!this.mask) return;
		mask.unmountElement(this.$refs.input, this.mask);
	},
	methods: {
		valid() {
			// method! no cache!
			return !this.invalid();
		},
		invalid(out?: { warn?: boolean, info?: boolean, all?: number }) {
			// method! no cache!
			const err = this.errors;
			if (!err) return false;
			if (out) {
				out.warn = err.every((r: any) => r.severity === 'warning');
				out.info = err.every((r: any) => r.severity === 'info');
				out.all = err.length;
			}
			return err.length > 0;
		},
		pending() {
			return this.errors && this.errors.pending > 0;
		},
		cssClass() {
			// method! no cached!!!
			const out: { warn?: boolean, info?: boolean } = {};
			const inv = this.invalid(out);
			let cls = 'control-group' + (inv ? ' invalid' : ' valid');
			if (inv && out.warn)
				cls += ' val-warning';
			else if (inv && out.info)
				cls += ' val-info';
			if (this.required) cls += ' required';
			if (this.disabled) cls += ' disabled';
			if (this.highlight && this.hasValue)
				cls += ' has-value';
			return cls;
		},
		deferUpdate() {
			forceUpdateChildren(this.$);
			this.$forceUpdate();
		},
		test() {
			alert('from base control');
		}
	},
	watch: {
		mask() {
			const self = this as any;
			mask.setMask(this.$refs.input, this.mask);
			if (self.updateValue)
				self.updateValue((this.$refs.input as HTMLInputElement).value);
		}
	}
});

app.components['control'] = control;
