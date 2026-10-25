// v-lazy (Net48 directives/lazy.js), unchanged in behaviour: a lazy array bound to an element loads itself when the
// element is mounted and when it updates. Vue 2's inserted is mounted, componentUpdated is updated.

import { vocabulary } from './platform.js';

function updateLazy(arr: any) {
	if (arr && arr.$loadLazy) {
		arr.$loadLazy();
	}
}

vocabulary.directive('lazy', {
	updated(_el: Element, binding: { value: unknown }) {
		updateLazy(binding.value);
	},
	mounted(_el: Element, binding: { value: unknown }) {
		updateLazy(binding.value);
	}
});
