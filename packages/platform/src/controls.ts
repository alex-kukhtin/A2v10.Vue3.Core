// What std:utils gives the controls, and the model core leaves out (packages/model/NET48.md): text.applyFilters
// (with toLatin) and mapTagColor (Net48 services/utils.js), unchanged in behaviour. The platform adds them to the
// model's utils when it registers std:utils.

import type { createModel } from '@a2v10/model';

type Utils = ReturnType<typeof createModel>['utils'];

// A Cyrillic layout read as Latin: what a barcode scanner types into a Ukrainian or Russian keyboard.
function toLatin(v: string): string {
	v = v.toUpperCase();

	const tbl: Record<string, string> = {
		'Й': 'Q', 'Ц': 'W', 'У': 'E', 'К': 'R', 'Е': 'T', 'Н': 'Y', 'Г': 'U', 'Ш': 'I', 'Щ': 'O', 'З': 'P', 'Х': '[', 'Ъ': ']', 'Ї': ']',
		'Ф': 'A', 'Ы': 'S', 'В': 'D', 'А': 'F', 'П': 'G', 'Р': 'H', 'О': 'J', 'Л': 'K', 'Д': 'L', 'І': 'S', 'Ж': ':', 'Э': '"', 'Є': '"',
		'Я': 'Z', 'Ч': 'X', 'С': 'C', 'М': 'V', 'И': 'B', 'Т': 'N', 'Ь': 'M', 'Б': '<', 'Ю': '>'
	};

	let r = '';
	for (let i = 0; i < v.length; i++) {
		const ch = tbl[v[i]];
		if (ch)
			r += ch;
		else
			r += v[i];
	}
	return r;
}

function createApplyFilters(utils: Utils) {
	return function applyFilters(filters: string[] | null | undefined, value: any): any {
		if (!filters || !filters.length)
			return value;
		if (!value)
			return value;
		value = '' + value;
		for (const f of filters) {
			switch (f) {
				case 'trim':
					value = value.trim();
					break;
				case 'upper':
					value = value.toUpperCase();
					break;
				case 'lower':
					value = value.toLowerCase();
					break;
				case 'barcode':
					value = toLatin(value);
					break;
				case 'fract3':
					value = utils.currency.round(utils.toNumber(value), 3);
					break;
				case 'fract2':
					value = utils.currency.round(utils.toNumber(value), 2);
					break;
				case 'eval':
					if (value.startsWith('=')) {
						try {
							// indirect: what is left of the text is digits and operators, evaluated in no scope
							value = (0, eval)(value.replace(/[^0-9\s\+\-\*\/\,\.\,]/g, '').replaceAll(',', '.'));
						} catch (err) {
							value = '';
						}
					}
					break;
			}
		}
		return value;
	};
}

function mapTagColor(style?: string): string {
	const tagColors: Record<string, string> = {
		'cyan': '#60bbe5',
		'green': '#5db750',
		'olive': '#b5cc18',
		'white': '#ffffff',
		'teal': '#00b5ad',
		'tan': '#d2b48c',      // tan,
		'red': '#da533f',
		'blue': '#6495ed',     //cornflowerblue
		'orange': '#ffb74d',
		'seagreen': '#8fbc8f', // darkseagreen
		'null': '#8f94b0',
		'gold': '#eac500',
		'salmon': '#fa8072',   //salmon
		'purple': '#9370db',   // mediumpurple
		'pink': '#ff69b4',     // hotpink
		'magenta': '#8b008b',  // darkmagenta
		'lightgray': '#cccccc'
	};
	return tagColors[style || 'null'] || '#8f94b0';
}

type ApplyFilters = ReturnType<typeof createApplyFilters>;

// The model's utils, with the controls' part added in place: one std:utils object.
export function withControls(utils: Utils): Utils & { text: { applyFilters: ApplyFilters }, mapTagColor: typeof mapTagColor } {
	return Object.assign(utils, {
		text: Object.assign(utils.text, { applyFilters: createApplyFilters(utils) }),
		mapTagColor
	});
}
