// mega-menu (Net48 components/megamenu.js), unchanged in behaviour: a dropdown's menu of an array's elements in
// groups by a property (groupBy), the groups in columns; an element by the slot 'item', one named '-' a divider.

import { defineComponent, type PropType } from 'vue';
import { require, vocabulary } from './platform.js';

const utils = require('std:utils');

type MenuGroup = { Name: string, menu: any[] };

vocabulary.component('mega-menu', defineComponent({
	template:
`<div class="dropdown-menu menu" role="menu">
	<div class="super-menu" :class="cssClass" :style="cssStyle">
		<div v-for="(m, mx) of topMenu" :key="mx" class="menu-group">
			<div class="group-title" v-text="m.Name"></div>
			<template v-for="(itm, ix) in m.menu">
				<div class="divider" v-if="isDivider(itm)"></div>
				<slot name="item" :menuItem="itm" v-else></slot>
			</template>
		</div>
	</div>
</div>
`,
	props: {
		itemsSource: Array as PropType<any[]>,
		groupBy: String,
		columns: Number,
		width: String
	},
	computed: {
		cssClass(): string {
			let cls = 'cols-' + (this.columns || 1);
			if (this.width)
				cls += ' with-width';
			return cls;
		},
		cssStyle(): { width: string } | undefined {
			if (this.width)
				return { width: this.width };
			return undefined;
		},
		topMenu(): Record<string, MenuGroup> {
			if (!this.itemsSource) return {};
			return this.itemsSource.reduce((acc: Record<string, MenuGroup>, itm: any) => {
				const g = utils.simpleEval(itm, this.groupBy) || '';
				const ma = acc[g];
				if (ma)
					ma.menu.push(itm);
				else
					acc[g] = { Name: g, menu: [itm] };
				return acc;
			}, {});
		}
	},
	methods: {
		isDivider(itm: any): boolean {
			return itm.Name === '-';
		}
	}
}));
