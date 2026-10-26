// a2-span-sum (Net48 components/spansum.js), unchanged in behaviour: the content and an arrow by dir: > 0 in (up,
// green), < 0 out (down, red), 0 in-out; no dir, no arrow. Vue 3's h: domProps are plain props.

import { defineComponent, h, type VNode } from 'vue';
import { vocabulary } from './platform.js';

vocabulary.component('a2-span-sum', defineComponent({
	props: {
		content: [String, Number],
		dir: Number
	},
	render() {
		const children: VNode[] = [];
		children.push(h('span', { innerText: this.content }));
		let dcls = 'span-sum ';
		if (this.dir! > 0) {/* in */
			children.push(h('i', { 'class': 'ico ico-arrow-up-green' }));
			dcls += 'in';
		}
		else if (this.dir! < 0) { /* out */
			children.push(h('i', { 'class': 'ico ico-arrow-down-red' }));
			dcls += 'out';
		}
		else if (this.dir === 0) { /* inout */
			children.push(h('i', { 'class': 'ico ico-arrow-sort' }));
			dcls += 'inout';
		}
		return h('span', { class: dcls }, children);
	}
}));
