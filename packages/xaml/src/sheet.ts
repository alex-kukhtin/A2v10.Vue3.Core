// a2-sheet, a2-sheet-section, a2-sheet-section-tree (Net48 components/sheet.js), unchanged in behaviour: a report's
// table by named slots (columns, header, col-shadow, body, footer); a tree section renders its slot once per element
// of the tree, walked depth first, a collapsed element's children skipped.
// Vue 3: the tree is a functional component, a function of (props, { slots }); the slot's first vnode is taken as it
// is (Vue 2 made it anew from tag, data and children); Vue.set is an assignment; the scope's functions are bound to
// the scope (Vue 2's callers called them as its methods: tree.toggle()).

import { defineComponent, h, type FunctionalComponent, type VNode } from 'vue';
import { vocabulary } from './platform.js';

const sheetTemplate = `
<table class="sheet" :class="cssClass">
	<slot name="columns"></slot>
	<thead>
		<slot name="header"></slot>
	</thead>
	<slot name="col-shadow"></slot>
	<slot name="body"></slot>
	<tfoot>
		<slot name="footer"></slot>
	</tfoot>
</table>
`;

const sheetSectionTemplate = `
<tbody>
	<slot></slot>
</tbody>
`;

function* traverse(item: any, prop: string, lev: number): Generator<any> {
	if (prop in item) {
		const arr = item[prop];
		for (let i = 0; i < arr.length; i++) {
			const elem = arr[i];
			elem.$level = lev;
			yield elem;
			if (!elem.$collapsed) {
				const newprop = elem._meta_.$items || prop;
				yield* traverse(elem, newprop, lev + 1);
			}
		}
	}
}

vocabulary.component('a2-sheet', defineComponent({
	template: sheetTemplate,
	props: {
		stale: Boolean
	},
	computed: {
		cssClass(): Record<string, boolean> {
			return {
				'sheet-stale': this.stale
			};
		}
	}
}));

vocabulary.component('a2-sheet-section', defineComponent({
	template: sheetSectionTemplate
}));

const sheetSectionTree: FunctionalComponent<{ itemsSource?: any, propName?: string }> = (props, { slots }) => {
	const prop = props.propName;
	const source = props.itemsSource;
	if (!source) return null;
	if (!prop) return null;
	const slot = slots.default;
	if (!slot) return null;

	const compArr: VNode[] = [];

	for (const v of traverse(source, prop, 1)) {
		const scope: Record<string, any> = { item: v };
		scope.hasChildren = function (this: any) {
			const np = this.item._meta_.$items || prop;
			const chElems = this.item[np];
			return chElems && chElems.length > 0;
		}.bind(scope);
		scope.toggle = function (this: any) {
			const clpsed = this.item.$collapsed || false;
			this.item.$collapsed = !clpsed;
		}.bind(scope);
		scope.cssClass = function (this: any) {
			let cls = '';
			if (this.hasChildren())
				cls += 'has-children';
			if (this.item.$collapsed)
				cls += ' collapsed';
			cls += ' lev-' + this.item.$level;
			return cls;
		}.bind(scope);
		scope.rowCssClass = function (this: any, mark?: string) {
			let cls = mark || '';
			if (this.hasChildren())
				cls += ` group gl-${this.item.$level}`;
			if (this.item.$collapsed)
				cls += ' collapsed';
			return cls;
		}.bind(scope);
		scope.indentCssClass = function (this: any) {
			return 'indent lev-' + this.item.$level;
		}.bind(scope);
		compArr.push(slot(scope)[0]);
	}
	return h('tbody', {}, compArr);
};
sheetSectionTree.props = ['itemsSource', 'propName'];

vocabulary.component('a2-sheet-section-tree', sheetSectionTree);
