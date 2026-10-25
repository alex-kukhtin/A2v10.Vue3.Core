// a2-json-browser (Net48 components/browsejson.js), unchanged in behaviour: the debug pane's tree of the page's model,
// each property with its value, objects and arrays expanded on a click; the spec properties ($valid, $dirty…) hidden
// unless asked.
// Vue 3: $children is gone: expandAll and clearExpanded walk the items by ref (the direct ones, as $children were).

import { defineComponent } from 'vue';
import { require, vocabulary } from './platform.js';

// read when used: std:utils comes up with the model, on its first require (after the locale)
const du = () => require('std:utils').date;

const sppArray = '$valid,$invalid,$dirty,$lock,$selected,$selectedIndex,$checked,$hasSelected,$hasChecked,$isEmpty,$permissions,$RowCount,$expanded,$collapsed,$level,$loaded,$names,$ids'
	.split(',');
const specProps = new Set(sppArray);

interface Prop {
	name: string;
	value: any;
	isObject: boolean;
	isArray: boolean;
	isDate: boolean;
	isString: boolean;
}

function getProps(root: any, skipSpec: boolean): Prop[] {
	if (!root) return [];
	const ff = (p: string) => {
		if (skipSpec && specProps.has(p)) return false;
		if (p.startsWith('_')) return false;
		const v = root[p];
		if (typeof v === 'function') return false;
		let c = v ? v.constructor : null;
		if (c) c = c.constructor;
		if (c && c.name === 'GeneratorFunction') return false;
		return true;
	};
	const fm = (p: string): Prop => {
		const v = root[p];
		const isDate = v instanceof Date;
		const tof = typeof v;
		return {
			name: p,
			value: v,
			isObject: !isDate && tof === 'object' && !Array.isArray(v),
			isArray: Array.isArray(v),
			isDate: isDate,
			isString: tof === 'string'
		};
	};
	return Object.keys(root).filter(ff).map(fm);
}

// the items rendered with ref="item": the direct ones
function itemsOf(vm: any): any[] {
	const r = vm.$refs.item;
	return r ? (Array.isArray(r) ? r : [r]) : [];
}

const jsonItemTemplate = `
	<li @click.stop.prevent="toggle">
		<span class="jb-label">
			<span v-text="chevron" class="jb-chevron"/>
			<span class="jbp-overlay">
				<span v-text="root.name" class="jbp-name"/>:
				<span class="jbp-value" :class="valueClass">
					<span v-text="valueText" />
					<span v-if="isScalar" class="ico ico-edit jbp-edit" @click.stop.prevent="editValue"/>
				</span>
			</span>
		</span>
		<ul v-if="expanded">
			<a2-json-browser-item v-if="!root.isScalar" v-for="(itm, ix) in items" :key=ix :root="itm" :use-spec="useSpec" ref="item"/>
		</ul>
	</li>
`;

const jsonTreeItem = defineComponent({
	template: jsonItemTemplate,
	name: 'a2-json-browser-item',
	props: {
		root: Object,
		useSpec: Boolean
	},
	data() {
		return {
			expanded: false
		};
	},
	methods: {
		toggle() {
			if (this.rp.isString) return;
			this.expanded = !this.expanded;
		},
		editValue() {
			// Net48: the parent's value taken, nothing done with it
		},
		expandAll(val: boolean) {
			if (this.rp.isString) return;
			this.expanded = val;
			this.$nextTick(() => {
				for (const c of itemsOf(this))
					c.expandAll(val);
			});
		},
		clearExpanded() {
			this.expanded = false;
			for (const c of itemsOf(this))
				c.clearExpanded();
		}
	},
	computed: {
		rp(): Prop {
			return this.root as unknown as Prop;
		},
		isScalar(): boolean {
			return !this.rp.isObject && !this.rp.isArray;
		},
		chevron(): string {
			//   - em-space
			let noExpand = this.isScalar || this.rp.isDate;
			if (this.rp.isObject && this.rp.value === null)
				noExpand = true;
			return noExpand ? ' ' : this.expanded ? '⏷' : '⏵';
		},
		valueText(): unknown {
			const r = this.rp;
			if (r.isObject) {
				if (!r.value) return 'null';
				return r.value.constructor.name; // "Object";
			}
			else if (r.isArray) {
				let ename = '';
				if (r.value && r.value._elem_)
					ename = r.value._elem_.name;
				return `${ename}Array(${r.value.length})`;
			}
			else if (r.isString)
				return `"${r.value}"`;
			else if (r.isDate)
				return du().isZero(r.value) ? 'null' : JSON.stringify(r.value);
			return r.value;
		},
		valueClass(): string {
			let cls = '';
			if (this.rp.isString)
				cls += ' jbp-string';
			else if (this.rp.isObject || this.rp.isArray)
				cls += ' jbp-object';
			return cls;
		},
		items(): Prop[] {
			return getProps(this.rp.value, !this.useSpec);
		}
	}
});

vocabulary.component('a2-json-browser', defineComponent({
	template: `
<ul class="a2-json-b">
	<a2-json-browser-item v-for="(itm, ix) in items" :key=ix :root="itm" :use-spec="useSpec" ref="item"/>
</ul>
`,
	components: {
		'a2-json-browser-item': jsonTreeItem
	},
	props: {
		root: Object,
		useSpec: Boolean
	},
	data() {
		return {
			expandFlag: false
		};
	},
	computed: {
		items(): Prop[] {
			return getProps(this.root, !this.useSpec);
		}
	},
	methods: {
		expandAll() {
			this.expandFlag = !this.expandFlag;
			for (const c of itemsOf(this))
				c.expandAll(this.expandFlag);
		},
		clearExpanded() {
			this.expandFlag = false;
			for (const c of itemsOf(this))
				c.clearExpanded();
		}
	}
}));
