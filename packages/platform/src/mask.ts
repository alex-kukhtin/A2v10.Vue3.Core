// std:mask (Net48 services/mask.js), unchanged in behaviour: an input's mask ('#': a digit; '@': reserved), the
// masked and unmasked value, the keyboard and paste handlers an element gets by mountElement.

import { nextTick } from 'vue';

type MaskInput = HTMLInputElement & { __opts?: { mask: string } };

export function createMask() {

	const PLACE_CHAR = '_';

	return {
		getMasked,
		getUnmasked,
		mountElement,
		unmountElement,
		setMask
	};

	function isMaskChar(ch: string) {
		return ch === '#' || ch === '@';
	}

	function isSpaceChar(ch: string) {
		return '- ()'.indexOf(ch) !== -1;
	}

	function isValidChar(mask: string, char: string) {
		if (mask === '#') {
			return char >= '0' && char <= '9' || char === PLACE_CHAR;
		}
		return false; // todo: alpha
	}

	function getMasked(mask: string, value: string) {
		let str = '';
		let j = 0;
		for (let i = 0; i < mask.length; i++) {
			const mc = mask[i];
			const ch = value[j];
			if (mc === ch) {
				str += ch;
				j++;
			} else if (isMaskChar(mc)) {
				str += ch || PLACE_CHAR;
				j++;
			} else {
				str += mc;
			}
		}
		return str;
	}

	function fitMask(mask: string, value: string) {
		let str = '';
		let j = 0;

		function nextValueChar() {
			let ch;
			for (; ;) {
				ch = value[j];
				if (!ch) return PLACE_CHAR;
				// TODO: this is for digits only!
				j++;
				if (ch >= '0' && ch <= '9') {
					return ch;
				}
			}
		}

		let ch = nextValueChar();

		for (let i = 0; i < mask.length; i++) {
			const mc = mask[i];
			if (isSpaceChar(mc)) {
				str += mc;
			}
			else if (isMaskChar(mc)) {
				str += ch;
				ch = nextValueChar();
			} else {
				str += mc;
				if (mc === ch)
					ch = nextValueChar();
			}
		}
		return str;
	}

	function getUnmasked(mask: string, value: string) {
		let str = '';
		for (let i = 0; i < mask.length; i++) {
			const mc = mask[i];
			const ch = value[i];
			if (isSpaceChar(mc)) continue;
			if (isMaskChar(mc)) {
				if (ch && ch !== PLACE_CHAR) {
					str += ch;
				} else {
					return '';
				}
			} else {
				str += mc;
			}
		}
		return str;
	}

	function mountElement(el: MaskInput | null, mask: string) {
		if (!el) return; // static, etc
		el.__opts = {
			mask: mask
		};
		el.addEventListener('keydown', keydownHandler, false);
		el.addEventListener('blur', blurHandler, false);
		el.addEventListener('focus', focusHandler, false);
		el.addEventListener('paste', pasteHandler, false);
	}

	function unmountElement(el: MaskInput | null, _mask?: string) {
		if (!el) return;
		delete el.__opts;
		el.removeEventListener('keydown', keydownHandler);
		el.removeEventListener('blur', blurHandler);
		el.removeEventListener('focus', focusHandler);
		el.removeEventListener('paste', pasteHandler);
	}

	function setMask(el: MaskInput | null, mask: string) {
		if (!el) return;
		if (!mask) {
			// remove mask
			unmountElement(el, mask);
			el.value = '';
		} else if (el.__opts) {
			// change mask
			el.__opts.mask = mask;
			el.value = getMasked(mask, '');
		} else {
			// set new
			mountElement(el, mask);
			el.value = getMasked(mask, '');
		}
	}

	function getCaretPosition(input: MaskInput) {
		if (!input)
			return 0;
		if (input.selectionStart !== undefined && input.selectionStart !== null) {
			if (input.selectionStart !== input.selectionEnd)
				input.setSelectionRange(input.selectionStart, input.selectionStart);
			return input.selectionStart;
		}
		return 0;
	}

	function fitCaret(mask: string, pos: number, fit: string): number {
		if (pos >= mask.length)
			return pos + 1; // after text
		const mc = mask[pos];
		if (isMaskChar(mc))
			return pos;
		if (fit === 'r') {
			for (let i = pos + 1; i < mask.length; i++) {
				if (isMaskChar(mask[i])) return i;
			}
			return mask.length + 1;
		} else if (fit === 'l') {
			for (let i = pos - 1; i >= 0; i--) {
				if (isMaskChar(mask[i])) return i;
			}
			return fitCaret(mask, 0, 'r'); // first
		}
		throw new Error(`mask.fitCaret. Invalid fit value '${fit}'`);
	}

	function setCaretPosition(input: MaskInput, pos: number, fit: string) {
		if (!input) return;
		if (input.offsetWidth === 0 || input.offsetHeight === 0) {
			return; // Input's hidden
		}
		if (input.setSelectionRange) {
			const mask = input.__opts!.mask;
			pos = fitCaret(mask, pos, fit);
			input.setSelectionRange(pos, pos);
		}
	}

	function setRangeText(input: MaskInput, text: string, s: number, e: number) {
		if (input.setRangeText) {
			input.setRangeText(text, s, e);
			return;
		}
		const val = (input as HTMLInputElement).value;
		let r = val.substring(0, s);
		r += text;
		r += val.substring(e);
		(input as HTMLInputElement).value = r;
	}

	function clearSelectionFull(ev: KeyboardEvent, input: MaskInput) {
		if (ev.which !== 46 && ev.which !== 8) return false;
		const s = input.selectionStart;
		const e = input.selectionEnd;
		const l = input.value.length;
		if (s === 0 && e === l) {
			input.value = getMasked(input.__opts!.mask, '');
			setCaretPosition(input, 0, 'r');
			ev.preventDefault();
			ev.stopPropagation();
			return true;
		}
		return false;
	}

	function setCurrentChar(input: MaskInput, char: string) {
		let pos = getCaretPosition(input);
		const mask = input.__opts!.mask;
		pos = fitCaret(mask, pos, 'r');
		const cm = mask[pos];
		if (isValidChar(cm, char)) {
			setRangeText(input, char, pos, pos + 1);
			const np = fitCaret(mask, pos + 1, 'r');
			input.setSelectionRange(np, np);
		}
	}

	function isAccel(e: KeyboardEvent, input: MaskInput) {
		if (e.which >= 112 && e.which <= 123)
			return true; // f1-f12
		if (e.which === 16 || e.which === 17)
			return true; // ctrl || shift
		if (e.which === 9) return true; // tab
		if (e.which === 13) {
			fireChange(input);
			setTimeout(() => {
				let d = 'l'; // last
				if (!input.value) {
					input.value = getMasked(input.__opts!.mask, '');
					d = 'r'; // first
				}
				setCaretPosition(input, d === 'r' ? 0 : 32768, d);
			}, 10);
			return true; // enter
		}
		if (e.ctrlKey) {
			switch (e.which) {
				case 86: // V
				case 67: // C
				case 65: // A
				case 88: // X
				case 90: // Z
				case 45: // Ins
					return true;
			}
		} else if (e.shiftKey) {
			switch (e.which) {
				case 45: // ins
				case 46: // del
				case 37: // left
				case 39: // right
				case 36: // home
				case 35: // end
					return true;
			}
		}
		return false;
	}

	function keydownHandler(this: MaskInput, e: KeyboardEvent) {
		if (isAccel(e, this)) return;
		let handled = false;
		if (clearSelectionFull(e, this)) return;
		const pos = getCaretPosition(this);
		let char = e.which;
		if (char === 229) {
			// mobile fix
			const t = e.target as HTMLInputElement;
			char = t.value.charAt(t.selectionStart! - 1).charCodeAt(0);
		}
		switch (char) {
			case 37: /* left */
				setCaretPosition(this, pos - 1, 'l');
				handled = true;
				break;
			case 39: /* right */
				setCaretPosition(this, pos + 1, 'r');
				handled = true;
				break;
			case 38: /* up */
			case 40: /* down */
			case 33: /* pgUp */
			case 34: /* pgDn* */
				handled = true;
				break;
			case 36: /*home*/
				setCaretPosition(this, 0, 'r');
				handled = true;
				break;
			case 35: /*end*/
				setCaretPosition(this, this.__opts!.mask.length, 'l');
				handled = true;
				break;
			case 46: /*delete*/
				setCurrentChar(this, PLACE_CHAR);
				handled = true;
				break;
			case 8: /*backspace*/
				setCaretPosition(this, pos - 1, 'l');
				setCurrentChar(this, PLACE_CHAR);
				setCaretPosition(this, pos - 1, 'l');
				handled = true;
				break;
			default:
				if (e.key.length === 1)
					setCurrentChar(this, e.key);
				handled = true;
				break;
		}
		if (handled) {
			e.preventDefault();
			e.stopPropagation();
		}
	}

	function blurHandler(this: MaskInput) {
		fireChange(this);
	}

	function focusHandler(this: MaskInput) {
		nextTick(() => {
			if (!this.value)
				this.value = getMasked(this.__opts!.mask, '');
			setCaretPosition(this, 0, 'r');
		});
	}

	function pasteHandler(this: MaskInput, e: ClipboardEvent) {
		e.preventDefault();
		const dat = e.clipboardData!.getData('text/plain');
		if (!dat) return;
		this.value = fitMask(this.__opts!.mask, dat);
	}

	function fireChange(input: MaskInput) {
		const evt = new Event('change', { bubbles: false, cancelable: true });
		input.dispatchEvent(evt);
	}
}
