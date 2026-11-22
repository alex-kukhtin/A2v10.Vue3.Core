// The cell kinds of data-sheet (PLAN.md, "The 1C dialect"): the one place that knows a column's ControlType. A kind
// says how its cell shows (the text, the alignment), and the text it is searched by; the editor over the cell is a
// kind's too (not yet). The sheet asks a kind and nothing else: a new kind or a column attribute is an entry here.
// No ControlType: the text kind, the column does not edit.

import { require } from './platform.js'; // std:utils: required when used, not at load (CLAUDE.md)

export interface SheetColumn {
	header?: string;
	content?: string;
	dataType?: string;
	format?: string;
	hideZeros?: boolean;
	align?: string;
	controlType?: string;
}

export interface CellKind {
	text(row: unknown, col: SheetColumn): string;
	align(col: SheetColumn): string;
}

const NUMERIC = ['Number', 'Currency'];

const textKind: CellKind = {
	text(row, col) {
		if (!col.content || !row)
			return '';
		const val = require('std:utils').eval(row, col.content, col.dataType, { hideZeros: col.hideZeros, format: col.format });
		return val == null ? '' : String(val);
	},
	align(col) {
		return col.align || (NUMERIC.includes(col.dataType!) ? 'right' : 'left');
	}
};

const KINDS: Record<string, CellKind> = {
	'': textKind
};

export function kindOf(col: SheetColumn): CellKind {
	const kind = KINDS[col.controlType || ''];
	if (!kind)
		throw new Error(`data-sheet-column: ControlType "${col.controlType}" is not a cell kind (${Object.keys(KINDS).filter(k => k).join(', ') || 'none yet'})`);
	return kind;
}
