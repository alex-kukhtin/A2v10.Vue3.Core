// std:accel (Net48 services/accel.js), unchanged in behaviour: keyboard accelerators of the document ('CASM:Code',
// '_' for a modifier not held); the last registered handler of a key wins; one keydown listener while any is.

import { nextTick } from 'vue';

interface Handler {
	key: number;
	elem: any;
	action: string;
}

export function createAccel() {

	const _elems: { accel: string, handlers: Handler[] }[] = [];
	let _listenerAdded = false;
	let _key = 42;

	return {
		registerControl,
		unregisterControl
	};

	function _keyDownHandler(ev: KeyboardEvent) {
		// control/alt/shift/meta
		let code = ev.code;
		if (code === 'NumpadEnter')
			code = 'Enter';
		const keyAccel = `${ev.ctrlKey ? 'C' : '_'}${ev.altKey ? 'A' : '_'}${ev.shiftKey ? 'S' : '_'}${ev.metaKey ? 'M' : '_'}:${code}`;
		const el = _elems.find(x => x.accel === keyAccel);
		if (!el || !el.handlers || !el.handlers.length) return;
		const handler = el.handlers[0];
		if (handler.action === 'focus') {
			ev.preventDefault();
			ev.stopPropagation();
			nextTick(() => {
				if (typeof handler.elem.focus === 'function')
					handler.elem.focus();
			});
		} else if (handler.action == 'func') {
			ev.preventDefault();
			ev.stopPropagation();
			nextTick(() => {
				if (typeof handler.elem === 'function')
					handler.elem();
			});
		}
	}

	function setListeners() {
		if (_elems.length > 0) {
			if (_listenerAdded)
				return;
			document.addEventListener('keydown', _keyDownHandler, false);
			_listenerAdded = true;
		} else {
			if (!_listenerAdded)
				return;
			document.removeEventListener('keydown', _keyDownHandler, false);
			_listenerAdded = false;
		}
	}

	function registerControl(accel: string, elem: any, action: string): number {
		const key = _key++;
		const found = _elems.find(c => c.accel === accel);
		if (found)
			found.handlers.unshift({ key, elem, action });
		else
			_elems.push({ accel: accel, handlers: [{ key, elem, action }] });
		setListeners();
		return key;
	}

	function unregisterControl(key: number): void {
		const found = _elems.findIndex(c => c.handlers.findIndex(x => x.key === key) != -1);
		if (found == -1) {
			console.error('Invalid accel handler');
			return;
		}
		const elem1 = _elems[found];
		elem1.handlers.shift();
		if (!elem1.handlers.length)
			_elems.splice(found, 1);
		setListeners();
	}
}
