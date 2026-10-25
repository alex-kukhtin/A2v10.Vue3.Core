// validator, a2-static-validator (Net48 components/validator.js), unchanged in behaviour: the errors of a control's
// value, and of a model property alone.

import { defineComponent } from 'vue';
import { vocabulary } from './platform.js';

vocabulary.component('validator', defineComponent({
	props: {
		invalid: Function,
		errors: Array,
		options: Object
	},
	template: '<div v-if="invalid()" class="validator" :class="cssClass" :style="cssStyle"><span v-for="err in errors" v-text="err.msg" :class="err.severity"></span></div>',
	computed: {
		cssStyle(): Record<string, unknown> {
			const r: Record<string, unknown> = {};
			if (this.options && this.options.width)
				r.width = this.options.width;
			return r;
		},
		cssClass(): Record<string, boolean> {
			const r: Record<string, boolean> = {};
			if (!this.options)
				return r;
			if (this.options.placement)
				r[this.options.placement] = true;
			if (this.options.width)
				r['with-width'] = true;
			return r;
		}
	}
}));

vocabulary.component('a2-static-validator', defineComponent({
	props: {
		item: {
			type: Object, default() {
				return {};
			}
		},
		prop: String
	},
	template: '<div v-if="invalid()" class="static-validator"><span v-for="err in errors" v-text="err.msg" :class="err.severity"></span></div>',
	computed: {
		path(): string {
			return (this.item as any)._path_ + '.' + this.prop;
		},
		modelValue(): unknown {
			if (!this.item) return null;
			return (this.item as any)[this.prop!];
		},
		errors(): any {
			const item = this.item as any;
			if (!item) return null;
			const root = item._root_;
			if (!root) return null;
			if (!root._validate_)
				return null;
			return root._validate_(item, this.path, this.modelValue, (this as any).deferUpdate);
		}
	},
	methods: {
		invalid() {
			// method! no cache!
			const err = this.errors;
			if (!err) return false;
			return err.length > 0;
		}
	}
}));
