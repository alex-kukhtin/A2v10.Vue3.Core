// The datasheet's core (PLAN.md, "The 1C dialect"): the scroll window by rows and by columns, the cursor and its keys, the
// next cell to edit, search by typing, the wheel. No Vue, no DOM: numbers in, numbers out. Written anew after A2v10.SpreadSheet, not ported: its position
// math walked the rows; here one row height for the whole sheet makes a row's place arithmetic.
// Rows: `pos` is the first shown row, `page` the rows shown whole. Columns: the first `fixed` are always shown, the
// others from `colPos` as many as the width holds; `widths` in px, one a column; `fixed` <= widths.length (the caller
// clamps it).

export interface Cursor {
	row: number;
	col: number;
}

// --- rows ------------------------------------------------------------------------------------------------------

// The rows shown whole under the header; at least one, so that the keys and the scrollbar always move.
export function rowPage(viewHeight: number, headerHeight: number, rowHeight: number): number {
	if (rowHeight <= 0)
		return 1;
	return Math.max(1, Math.floor((viewHeight - headerHeight) / rowHeight));
}

export function maxRowPos(rowCount: number, page: number): number {
	return Math.max(0, rowCount - page);
}

export function clampRowPos(pos: number, rowCount: number, page: number): number {
	return Math.min(Math.max(0, pos), maxRowPos(rowCount, page));
}

// The rows rendered from pos: the whole ones and the one cut by the bottom edge, none past the last.
export function renderedRowCount(pos: number, page: number, rowCount: number): number {
	return Math.max(0, Math.min(page + 1, rowCount - pos));
}

// The row under y (px from the view's top); -1 on the header and past the last row.
export function rowAt(y: number, pos: number, headerHeight: number, rowHeight: number, rowCount: number): number {
	if (y < headerHeight || rowHeight <= 0)
		return -1;
	const row = pos + Math.floor((y - headerHeight) / rowHeight);
	return row < rowCount ? row : -1;
}

// The scroll position that shows the row whole, moved as little as it takes.
export function fitRowPos(row: number, pos: number, page: number, rowCount: number): number {
	if (row < pos)
		return clampRowPos(row, rowCount, page);
	if (row >= pos + page)
		return clampRowPos(row - page + 1, rowCount, page);
	return clampRowPos(pos, rowCount, page);
}

// --- columns ---------------------------------------------------------------------------------------------------

function fixedWidth(widths: readonly number[], fixed: number): number {
	let w = 0;
	for (let c = 0; c < fixed; c++)
		w += widths[c];
	return w;
}

// The columns rendered: the fixed ones, then from colPos while the width lasts (the last one may be cut).
export function visibleColumns(widths: readonly number[], fixed: number, colPos: number, viewWidth: number): number[] {
	const cols: number[] = [];
	const n = widths.length;
	for (let c = 0; c < fixed; c++)
		cols.push(c);
	let x = fixedWidth(widths, fixed);
	for (let c = Math.max(colPos, fixed); c < n && x < viewWidth; c++) {
		cols.push(c);
		x += widths[c];
	}
	return cols;
}

// The scrolled columns shown whole from colPos; at least one.
export function columnPage(widths: readonly number[], fixed: number, colPos: number, viewWidth: number): number {
	const avail = viewWidth - fixedWidth(widths, fixed);
	let x = 0;
	let count = 0;
	for (let c = Math.max(colPos, fixed); c < widths.length; c++) {
		x += widths[c];
		if (x > avail)
			break;
		count += 1;
	}
	return Math.max(1, count);
}

// The least colPos from which the remaining columns all fit; `fixed` when everything fits.
export function maxColPos(widths: readonly number[], fixed: number, viewWidth: number): number {
	const n = widths.length;
	const avail = viewWidth - fixedWidth(widths, fixed);
	let c = n;
	let x = 0;
	while (c > fixed && x + widths[c - 1] <= avail) {
		x += widths[c - 1];
		c -= 1;
	}
	return Math.max(fixed, Math.min(c, n - 1));
}

export function clampColPos(colPos: number, widths: readonly number[], fixed: number, viewWidth: number): number {
	return Math.min(Math.max(fixed, colPos), maxColPos(widths, fixed, viewWidth));
}

// The column under x (px from the view's left); -1 past the last one shown.
export function columnAt(x: number, widths: readonly number[], fixed: number, colPos: number, viewWidth: number): number {
	let left = 0;
	for (const c of visibleColumns(widths, fixed, colPos, viewWidth)) {
		if (x < left + widths[c])
			return x >= left ? c : -1;
		left += widths[c];
	}
	return -1;
}

// The column scroll position that shows the column whole, moved as little as it takes; a fixed column is always shown.
export function fitColPos(col: number, colPos: number, widths: readonly number[], fixed: number, viewWidth: number): number {
	if (col < fixed)
		return clampColPos(colPos, widths, fixed, viewWidth);
	if (col < colPos)
		return clampColPos(col, widths, fixed, viewWidth);
	const avail = viewWidth - fixedWidth(widths, fixed);
	let p = colPos;
	for (; p < col; p++) {
		let x = 0;
		for (let c = p; c <= col; c++)
			x += widths[c];
		if (x <= avail)
			break;
	}
	return clampColPos(p, widths, fixed, viewWidth);
}

// --- keys ------------------------------------------------------------------------------------------------------

// The cursor a key moves to (KeyboardEvent.key), clamped to the sheet; null: not a cursor key, or no rows.
// Home / End: the row's first / last column; Ctrl+Home / Ctrl+End: the first / last row, the column kept.
// rowMode (the cursor is the row): no column to move; Home / End are the first / last row, ArrowLeft / Right not
// the cursor's (the caller scrolls the columns).
export function moveCursor(key: string, ctrl: boolean, cur: Cursor, rowCount: number, colCount: number, page: number,
	rowMode = false): Cursor | null {
	if (rowCount <= 0 || colCount <= 0)
		return null;
	let { row, col } = cur;
	const byRow = ctrl || rowMode;
	switch (key) {
		case 'ArrowUp': row -= 1; break;
		case 'ArrowDown': row += 1; break;
		case 'ArrowLeft': if (rowMode) return null; col -= 1; break;
		case 'ArrowRight': if (rowMode) return null; col += 1; break;
		case 'PageUp': row -= page; break;
		case 'PageDown': row += page; break;
		case 'Home': if (byRow) row = 0; else col = 0; break;
		case 'End': if (byRow) row = rowCount - 1; else col = colCount - 1; break;
		default: return null;
	}
	return {
		row: Math.min(Math.max(0, row), rowCount - 1),
		col: Math.min(Math.max(0, col), colCount - 1)
	};
}

// The cell an edit's Enter or Tab goes on to: the next column that `editable` lets stop at, along the row, then the
// next row's first one; `back` (Shift+Tab): the other way. null: none (the sheet's end; the cursor stays).
export function nextCell(cur: Cursor, back: boolean, rowCount: number, colCount: number, editable: (col: number) => boolean): Cursor | null {
	const step = back ? -1 : 1;
	for (let c = cur.col + step; c >= 0 && c < colCount; c += step)
		if (editable(c))
			return { row: cur.row, col: c };
	const row = cur.row + step;
	if (row < 0 || row >= rowCount)
		return null;
	for (let i = 0; i < colCount; i++) {
		const c = back ? colCount - 1 - i : i;
		if (editable(c))
			return { row, col: c };
	}
	return null;
}

// --- search by typing ------------------------------------------------------------------------------------------

// What one types into the sheet, as a prefix: characters typed with pauses of `pause` ms or less add up, a longer
// pause starts a new prefix. `now` in ms, the caller's clock.
export class TypeAhead {
	private text = '';
	private last = -Infinity;

	constructor(private readonly pause: number) { }

	push(ch: string, now: number): string {
		if (now - this.last > this.pause)
			this.text = '';
		this.last = now;
		this.text += ch;
		return this.text;
	}

	clear(): void {
		this.text = '';
	}
}

// The first row from `from` on, around past the last, whose text starts with the prefix, any case; -1: none.
// From the current row itself: a longer prefix that still fits it keeps the cursor where it is.
export function findRow(rowCount: number, from: number, prefix: string, text: (row: number) => string): number {
	const p = prefix.toLocaleLowerCase();
	for (let i = 0; i < rowCount; i++) {
		const row = (from + i) % rowCount;
		if (text(row).toLocaleLowerCase().startsWith(p))
			return row;
	}
	return -1;
}

// --- the wheel -------------------------------------------------------------------------------------------------

// Whole steps (rows, columns) out of wheel deltas. A touchpad sends many small pixel deltas: they add up until a
// step's worth (`unit` px), the rest kept for the next; rounding each delta (SpreadSheet's) never moves on one.
// deltaMode: 0 pixels, 1 lines (a line a step), 2 pages (`page` steps). A turn of direction drops the rest. No
// unit yet (a row not measured): no steps in pixels.
export class WheelSteps {
	private rest = 0;

	steps(delta: number, deltaMode: number, unit: number, page: number): number {
		const d = deltaMode === 1 ? delta : deltaMode === 2 ? delta * page : unit > 0 ? delta / unit : 0;
		if (d === 0)
			return 0;
		if (Math.sign(d) !== Math.sign(this.rest))
			this.rest = 0;
		this.rest += d;
		const steps = Math.trunc(this.rest) || 0; // not -0
		this.rest -= steps;
		return steps;
	}
}
