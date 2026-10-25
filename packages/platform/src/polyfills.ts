// What Net48 platform/polyfills.js put on the browser's prototypes, the controls and applications call: an element's
// scrollIntoViewCheck (the data grid's selected row), a date's isZero. Not ported: closest (every browser has it),
// Date.prototype.toJSON (the model installs it: @a2v10/model, base/json.ts).

export {};

declare global {
	interface Element {
		scrollIntoViewCheck(): void;
	}
	interface Date {
		isZero(): boolean;
	}
}

// Scrolls the nearest scrolling ancestor only when the element is out of its view. No Element: the core loaded in
// Node by the tests.
if (typeof Element !== 'undefined')
	Element.prototype.scrollIntoViewCheck = Element.prototype.scrollIntoViewCheck || function (this: Element) {
		const el = this;
		const elRect = el.getBoundingClientRect();
		let pElem = el.parentElement;
		while (pElem) {
			if (pElem.offsetHeight < pElem.scrollHeight)
				break;
			pElem = pElem.parentElement;
		}
		if (!pElem)
			return;
		const parentRect = pElem.getBoundingClientRect();
		if (elRect.top < parentRect.top)
			el.scrollIntoView({ block: 'nearest' });
		else if (elRect.bottom > parentRect.bottom)
			el.scrollIntoView({ block: 'nearest' });
	};

const td = new Date(0, 0, 1, 0, 0, 0, 0);

Date.prototype.isZero = Date.prototype.isZero || function (this: Date) {
	return this.getTime() === td.getTime();
};
