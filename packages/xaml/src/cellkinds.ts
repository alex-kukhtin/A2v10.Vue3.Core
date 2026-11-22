// The cell kinds of data-sheet (PLAN.md, "The 1C dialect"): the one place that knows a column's ControlType. A kind
// says how its cell shows (the text, the alignment, an icon), the text it is searched by, and how it edits: an editor
// over the cell (an existing control, its tag and props) or a toggle in place. The sheet asks a kind and nothing
// else: a new kind or a column attribute is an entry here. No ControlType: the text kind, the column does not edit.

import { require } from './platform.js'; // std:utils: required when used, not at load (CLAUDE.md)

export interface SheetColumn {
	header?: string;
	content?: string;
	dataType?: string;
	format?: string;
	hideZeros?: boolean;
	align?: string;
	controlType?: string;
	// the editors' attributes, the explicit list (PLAN.md): DisplayProperty, ItemsSource, Fetch, FetchCommand, ValueProperty
	display?: string;
	itemsSource?: unknown[];
	fetch?: Function;
	fetchCommand?: string;
	valueProp?: string;
}

// What a cell edits: the element holding the value and its property; the content's path split at its last dot.
export interface CellTarget {
	item: any;
	prop: string;
}

export interface CellEditor {
	tag: string;
	props(t: CellTarget, col: SheetColumn): Record<string, unknown>;
	open?(vm: any): void; // F4: the editor's choice (a list, a calendar)
}

export interface CellKind {
	text(row: unknown, col: SheetColumn): string;
	align(col: SheetColumn): string;
	icon?(row: unknown, col: SheetColumn): string; // classes of an icon the cell shows
	editor?: CellEditor;
	toggle?: boolean; // the value flipped in place: Space, a click on the icon
}

const NUMERIC = ['Number', 'Currency'];
const utils = () => require('std:utils');
const raw = (obj: unknown, path: string) => utils().eval(obj, path, undefined, undefined, true /*skip format*/);

export function targetOf(row: unknown, col: SheetColumn): CellTarget | null {
	if (!col.content || !row)
		return null;
	const ix = col.content.lastIndexOf('.');
	const item = ix < 0 ? row : raw(row, col.content.substring(0, ix));
	return item ? { item, prop: col.content.substring(ix + 1) } : null;
}

function evalText(row: unknown, path: string | undefined, dataType: string | undefined, col: SheetColumn): string {
	if (!path || !row)
		return '';
	const val = utils().eval(row, path, dataType, { hideZeros: col.hideZeros, format: col.format });
	return val == null ? '' : String(val);
}

const alignBy = (col: SheetColumn) => col.align || (NUMERIC.includes(col.dataType!) ? 'right' : 'left');

const textKind: CellKind = {
	text: (row, col) => evalText(row, col.content, col.dataType, col),
	align: alignBy
};

const textBoxKind: CellKind = {
	...textKind,
	editor: {
		tag: 'textbox',
		props: (t, col) => ({ item: t.item, prop: t.prop, dataType: col.dataType, format: col.format, hideZeros: col.hideZeros, align: alignBy(col) })
	}
};

const datePickerKind: CellKind = {
	text: (row, col) => evalText(row, col.content, col.dataType || 'Date', col),
	align: col => col.align || 'center', // the date picker's own
	editor: {
		tag: 'a2-date-picker',
		props: (t, col) => ({ item: t.item, prop: t.prop, align: col.align || 'center' }),
		open: vm => vm.toggle()
	}
};

const SELECTOR_DISPLAY = 'Name'; // as Core renders a Selector without DisplayProperty
const selectorKind: CellKind = {
	text: (row, col) => col.content ? evalText(row, `${col.content}.${col.display || SELECTOR_DISPLAY}`, undefined, col) : '',
	align: col => col.align || 'left',
	editor: {
		tag: 'a2-selector',
		props: (t, col) => ({
			item: t.item, prop: t.prop, display: col.display || SELECTOR_DISPLAY,
			itemsSource: col.itemsSource, fetch: col.fetch, fetchCommand: col.fetchCommand
		}),
		open: vm => { if (!vm.isOpen) vm.open(); }
	}
};

// The combobox's own text: an option's name (DisplayProperty, else $name); by ValueProperty, the option with the value.
const comboBoxKind: CellKind = {
	text(row, col) {
		if (!col.content || !row)
			return '';
		const val = raw(row, col.content);
		const name = (opt: any) => opt == null ? '' : String((col.display ? raw(opt, col.display) : opt.$name) ?? '');
		if (!col.valueProp)
			return name(val);
		return name((col.itemsSource || []).find(x => raw(x, col.valueProp!) === val));
	},
	align: col => col.align || 'left',
	editor: {
		tag: 'combobox',
		props: (t, col) => ({ item: t.item, prop: t.prop, itemsSource: col.itemsSource || [], nameProp: col.display, valueProp: col.valueProp }),
		open: vm => vm.$refs.sel?.showPicker?.()
	}
};

const checkBoxKind: CellKind = {
	text: () => '',
	align: col => col.align || 'center',
	icon: (row, col) => col.content && row && raw(row, col.content) ? 'ds-check checked' : 'ds-check',
	toggle: true
};

const KINDS: Record<string, CellKind> = {
	'': textKind,
	TextBox: textBoxKind,
	DatePicker: datePickerKind,
	Selector: selectorKind,
	ComboBox: comboBoxKind,
	CheckBox: checkBoxKind
};

export function kindOf(col: SheetColumn): CellKind {
	const kind = KINDS[col.controlType || ''];
	if (!kind)
		throw new Error(`data-sheet-column: ControlType "${col.controlType}" is not a cell kind (${Object.keys(KINDS).filter(k => k).join(', ')})`);
	return kind;
}
