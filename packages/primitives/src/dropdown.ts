// v-dropdown and v-contextmenu (Net48 directives/dropdown.js), unchanged in behaviour; Vue 3's hooks: bind is
// beforeMount, unbind is unmounted. v-dropdown: the element with a [toggle] inside opens and closes, and is a
// popup of std:popup (closed by a click outside). v-contextmenu="id": a right click shows the menu #id there.

import { require, vocabulary } from '@a2v10/platform';
import type { Directive } from 'vue';

type Popup = {
	registerPopup(el: Element): void,
	unregisterPopup(el: Element): void,
	closeAll(): void,
	closest(node: Element | null, css: string): Element | null,
	closeInside(el: Element | null): void
};

type DropDownElement = HTMLElement & {
	_close?: (ev?: unknown) => void,
	_hide?: () => void,
	_show?: () => void,
	_findButton?: () => HTMLButtonElement | null,
	_handler?: (event: Event) => void
};

const popup = () => require('std:popup') as Popup;

const dropdown: Directive<DropDownElement> = {
	beforeMount(el) {
		el.setAttribute('dropdown-top', '');
		popup().registerPopup(el);

		el._close = function () {
			if (el._hide)
				el._hide();
			el.classList.remove('show');
		};

		el._findButton = function () {
			const btn = el.querySelector<HTMLButtonElement>('[toggle]');
			if (!btn) {
				console.error('DropDown does not have a toggle element');
			}
			return btn;
		};

		el._handler = function (event: Event) {
			let trg = event.target as Element | null;
			const btn = el._findButton!();
			if (!btn || btn.disabled) return;
			while (trg) {
				if (trg === btn) break;
				if (trg === el) return;
				trg = trg.parentElement;
			}
			if (trg === btn) {
				event.preventDefault();
				event.stopPropagation();
				const isVisible = el.classList.contains('show');
				if (isVisible) {
					if (el._hide)
						el._hide();
					el.classList.remove('show');
				} else {
					// not nested popup
					const outer = popup().closest(el, '.popup-body');
					if (outer) {
						popup().closeInside(outer);
					} else {
						popup().closeAll();
					}
					if (el._show)
						el._show();
					el.classList.add('show');
				}
			}
		};

		el.addEventListener('click', el._handler);
	},
	unmounted(el) {
		popup().unregisterPopup(el);
		el.removeEventListener('click', el._handler!);
	}
};

function canClick(el: Element): boolean {
	const hlink = 'a2-hyperlink';
	if (el.classList.contains(hlink))
		return false;
	const parent = el.parentElement;
	if (parent && parent.classList.contains(hlink))
		return false;
	return true;
}

type ContextMenuElement = HTMLElement & { _contextMenu?: (ev: MouseEvent) => void };

// The menu's id is the value at mount, as Net48's bind kept it. Net48's unbind removed another bound function
// than the one added; here the one added is removed.
const contextmenu: Directive<ContextMenuElement, string> = {
	beforeMount(el, binding) {
		const id = binding.value;
		el._contextMenu = function (ev: MouseEvent) {
			ev.preventDefault();
			ev.stopPropagation();
			const target = ev.target as HTMLElement;
			if (canClick(target))
				target.click();
			const menu = document.querySelector<HTMLElement>('#' + id)!;
			const br = (menu.parentNode as Element).getBoundingClientRect();
			const style = menu.style;
			style.top = (ev.clientY - br.top) + 'px';
			style.left = (ev.clientX - br.left) + 'px';
			menu.classList.add('show');
		};
		el.addEventListener('contextmenu', el._contextMenu);
	},
	unmounted(el) {
		el.removeEventListener('contextmenu', el._contextMenu!);
	}
};

vocabulary.directive('dropdown', dropdown);
vocabulary.directive('contextmenu', contextmenu);
