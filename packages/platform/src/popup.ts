// std:popup (Net48 services/popup.js), unchanged in behaviour: the open dropdowns of the document, closed on a
// click outside, a context menu, Esc. An element registers with a _close function of its own.

type PopupElement = Element & { _close?: (target?: unknown) => void };

export function createPopup() {
	const __dropDowns__: PopupElement[] = [];
	let __started = false;

	const __error = 'Perhaps you forgot to create a _close function for popup element';

	return {
		startService,
		registerPopup,
		unregisterPopup,
		closeAll: closeAllPopups,
		closest,
		closeInside
	};

	function registerPopup(el: PopupElement): void {
		__dropDowns__.push(el);
	}

	function unregisterPopup(el: PopupElement): void {
		const ix = __dropDowns__.indexOf(el);
		if (ix !== -1)
			__dropDowns__.splice(ix, 1);
		delete el._close;
	}

	// The listeners of the document's lifetime: once, never removed.
	function startService(): void {
		if (__started)
			return;

		__started = true;

		document.body.addEventListener('click', closePopups);
		document.body.addEventListener('contextmenu', closePopups);
		document.body.addEventListener('keydown', closeOnEsc);
		document.body.addEventListener('mouseup', closeContextMenus);
	}

	function closest(node: Element | null, css: string): Element | null {
		if (node) return node.closest(css);
		return null;
	}

	function closeAllPopups(): void {
		closeContextMenus();
		__dropDowns__.forEach((el) => {
			if (el._close)
				el._close(document);
		});
	}

	function closeContextMenus(): void {
		const ctxmenus = document.querySelectorAll('.contextmenu');
		if (ctxmenus != null) {
			for (const menu of ctxmenus) {
				menu.classList.remove('show');
			}
		}
	}

	function closeInside(el: Element | null): void {
		if (!el) return;
		// inside el only
		const ch = el.querySelectorAll<PopupElement>('.popover-wrapper');
		for (let i = 0; i < ch.length; i++) {
			const chel = ch[i];
			if (chel._close) {
				chel._close();
			}
		}
	}

	function closePopups(ev: Event): void {
		closeContextMenus();
		if (__dropDowns__.length === 0)
			return;
		const target = ev.target as Element;
		for (let i = 0; i < __dropDowns__.length; i++) {
			const el = __dropDowns__[i];
			if (closest(target, '.dropdown-item') ||
				target.hasAttribute('close-dropdown') ||
				closest(target, '[dropdown-top]') !== el) {
				if (!el._close) {
					throw new Error(__error);
				}
				el._close(target);
			}
		}
	}

	// close on esc
	function closeOnEsc(ev: KeyboardEvent): void {
		if (ev.which !== 27) return;
		for (let i = 0; i < __dropDowns__.length; i++) {
			const el = __dropDowns__[i];
			if (!el._close)
				throw new Error(__error);
			el._close(ev.target);
		}
	}
}
