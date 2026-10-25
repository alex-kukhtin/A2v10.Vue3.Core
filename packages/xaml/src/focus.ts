// v-focus, v-settabindex (Net48 directives/focus.js), unchanged in behaviour. Vue 2's bind is created, inserted is
// mounted.

import { vocabulary } from './platform.js';

type Selectable = HTMLElement & { select?: () => void, _selectDone?: boolean, __opts?: { mask?: unknown } };

// selects all text on focus
vocabulary.directive('focus', {
	created(el: Selectable) {
		function doSelect(t: Selectable) {
			if (!t.select) return;
			if (t._selectDone) return;
			t.select();
			t._selectDone = true;
		}

		el.addEventListener('focus', function (event) {
			// focus occurs before click!
			const target = event.target as Selectable;
			target.parentElement!.classList.add('focus');
			if (el.__opts && el.__opts.mask) return;
			target._selectDone = false;
			setTimeout(() => {
				doSelect(target);
			}, 0);
		}, false);

		el.addEventListener('blur', function (event) {
			const t = event.target as Selectable;
			t._selectDone = true;
			t.parentElement!.classList.remove('focus');
		}, false);

		el.addEventListener('click', function (event) {
			if (el.__opts && el.__opts.mask) return;
			doSelect(event.target as Selectable);
		}, false);
	},

	mounted(el: Selectable) {
		el._selectDone = false;
		if (el.tabIndex === 1) {
			setTimeout(() => {
				if (el.focus) el.focus();
				if (el.select) el.select();
			}, 0);
		}
	}
});

vocabulary.directive('settabindex', {
	mounted(el: HTMLElement) {
		if (el.tabIndex === 1) {
			setTimeout(() => {
				if (el.focus) el.focus();
			}, 0);
		}
	}
});
