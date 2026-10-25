// v-auto-size (Net48 directives/autosize.js, 'autoSize'), unchanged in behaviour: a textarea grows with its text, from
// its first height; 'autosize', dispatched on it, measures again after the update (a2-textarea, a value set by code).
// Vue 2's bind is created, inserted is mounted.

import { nextTick } from 'vue';
import { vocabulary } from './platform.js';

type AutoSizeElement = HTMLElement & {
	_ops: { initHeight: number, extraSpace: number },
	_autosize: () => void
};

vocabulary.directive('autoSize', {
	created(el: AutoSizeElement, binding: { value: unknown }) {
		if (!binding.value) return;

		el.style.overflowY = '';
		el._ops = {
			initHeight: -1,
			extraSpace: 0
		};

		el._autosize = function () {
			if (!el.offsetHeight)
				return;
			const ops = el._ops;
			if (ops.initHeight === -1) {
				ops.initHeight = el.offsetHeight;
			}
			el.style.height = ops.initHeight + 'px';
			const needHeight = el.scrollHeight + ops.extraSpace;
			if (needHeight > ops.initHeight)
				el.style.height = needHeight + 'px';
		};

		function onInput() {
			el._autosize();
		}

		function onAutoSize() {
			nextTick(() => el._autosize());
		}

		el.addEventListener('input', onInput);
		// Perhaps the value was set programmatically.
		el.addEventListener('autosize', onAutoSize);
	},

	mounted(el: AutoSizeElement, binding: { value: unknown }) {
		if (!binding.value) return;
		const style = window.getComputedStyle(el);
		const es = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
		el._ops.extraSpace = es;
		setTimeout(() => el._autosize(), 1);
	}
});
