// The datasheet's core (packages/primitives/src/sheet.ts) as the built a2v10-core.js exports it (a2v10.primitives):
// the scroll window by rows and columns, the cursor's keys, the wheel's steps.
// Run: node test/core/sheet.js (after pnpm build)

'use strict';

const assert = require('assert');
const { loadCore } = require('./load.js');

const { ctx } = loadCore(process.env.A2V10_CORE_BUNDLE || 'a2v10-core.js'); // the env: a mutant's (sheet-mutants.js)
const s = ctx.a2v10.primitives;
const plain = v => JSON.parse(JSON.stringify(v)); // the context's arrays and objects are of another realm

// rows: a view of 230px, a header of 30px, rows of 20px: 10 whole rows, the 11th cut
assert.strictEqual(s.rowPage(230, 30, 20), 10);
assert.strictEqual(s.rowPage(235, 30, 20), 10, 'the cut row is not in the page');
assert.strictEqual(s.rowPage(35, 30, 20), 1, 'at least one row');
assert.strictEqual(s.rowPage(230, 30, 0), 1, 'no height yet');
assert.strictEqual(s.maxRowPos(100, 10), 90);
assert.strictEqual(s.maxRowPos(5, 10), 0);
assert.strictEqual(s.clampRowPos(95, 100, 10), 90);
assert.strictEqual(s.clampRowPos(-3, 100, 10), 0);
assert.strictEqual(s.renderedRowCount(0, 10, 100), 11, 'the cut row rendered');
assert.strictEqual(s.renderedRowCount(90, 10, 100), 10, 'none past the last');
assert.strictEqual(s.renderedRowCount(0, 10, 0), 0);

assert.strictEqual(s.rowAt(29, 0, 30, 20, 100), -1, 'the header');
assert.strictEqual(s.rowAt(29, 5, 30, 20, 100), -1, 'the header, scrolled');
assert.strictEqual(s.rowAt(30, 0, 30, 20, 100), 0);
assert.strictEqual(s.rowAt(49, 5, 30, 20, 100), 5);
assert.strictEqual(s.rowAt(50, 5, 30, 20, 100), 6);
assert.strictEqual(s.rowAt(90, 0, 30, 20, 3), -1, 'past the last row');

assert.strictEqual(s.fitRowPos(5, 0, 10, 100), 0, 'shown: not moved');
assert.strictEqual(s.fitRowPos(25, 20, 10, 100), 20, 'shown, scrolled: not moved');
assert.strictEqual(s.fitRowPos(10, 0, 10, 100), 1, 'below: the least move');
assert.strictEqual(s.fitRowPos(3, 20, 10, 100), 3, 'above: to the row');
assert.strictEqual(s.fitRowPos(99, 0, 10, 100), 90);

// columns: widths 100 | 50, 80, 120, 60 (one fixed); a view of 300px leaves 200px to the scrolled ones
const W = [100, 50, 80, 120, 60];
assert.deepStrictEqual(plain(s.visibleColumns(W, 1, 1, 300)), [0, 1, 2, 3], 'the 4th cut at 350');
assert.deepStrictEqual(plain(s.visibleColumns(W, 1, 1, 230)), [0, 1, 2], 'ends at the edge: the next not rendered');
assert.deepStrictEqual(plain(s.visibleColumns(W, 1, 3, 300)), [0, 3, 4]);
assert.deepStrictEqual(plain(s.visibleColumns(W, 0, 0, 1000)), [0, 1, 2, 3, 4]);
assert.deepStrictEqual(plain(s.visibleColumns(W, 1, 0, 300)), [0, 1, 2, 3], 'colPos below fixed: from fixed');
assert.strictEqual(s.columnPage(W, 1, 1, 300), 2, '50 + 80 whole, 120 not');
assert.strictEqual(s.columnPage(W, 1, 1, 230), 2, '50 + 80 = 130 to the px: whole');
assert.strictEqual(s.columnPage(W, 2, 0, 330), 1, 'colPos below fixed: counted from fixed');
assert.strictEqual(s.columnPage(W, 1, 3, 300), 2, '120 + 60');
assert.strictEqual(s.columnPage([100, 500], 1, 1, 300), 1, 'at least one');
assert.strictEqual(s.maxColPos(W, 1, 300), 3, '120 + 60 fit, 80 more not');
assert.strictEqual(s.maxColPos(W, 1, 280), 3, '120 + 60 = 180 to the px: fit');
assert.strictEqual(s.maxColPos(W, 0, 1000), 0, 'all fit');
assert.strictEqual(s.maxColPos([100, 500], 0, 300), 1, 'the last alone too wide: still reachable');
assert.strictEqual(s.maxColPos([100], 1, 300), 1, 'all fixed');
assert.strictEqual(s.clampColPos(4, W, 1, 300), 3);
assert.strictEqual(s.clampColPos(0, W, 1, 300), 1);

assert.strictEqual(s.columnAt(99, W, 1, 1, 300), 0);
assert.strictEqual(s.columnAt(100, W, 1, 1, 300), 1);
assert.strictEqual(s.columnAt(150, W, 1, 1, 300), 2);
assert.strictEqual(s.columnAt(299, W, 1, 1, 300), 3, 'the cut one');
assert.strictEqual(s.columnAt(400, W, 1, 1, 300), -1, 'past the shown');
assert.strictEqual(s.columnAt(120, W, 1, 3, 300), 3, 'after the fixed: from colPos');

assert.strictEqual(s.fitColPos(4, 1, W, 1, 300), 3, 'right: the least move');
assert.strictEqual(s.fitColPos(2, 3, W, 1, 300), 2, 'left: to the column');
assert.strictEqual(s.fitColPos(0, 3, W, 1, 300), 3, 'a fixed column: not moved');
assert.strictEqual(s.fitColPos(2, 1, W, 1, 300), 1, 'shown: not moved');
assert.strictEqual(s.fitColPos(3, 1, [100, 50, 50, 50, 50], 1, 200), 2, 'fits to the px: the least move');
assert.strictEqual(s.fitColPos(1, 3, W, 1, 300), 1, 'the first scrolled column: scrolled back to');
assert.strictEqual(s.fitColPos(1, 0, [100, 500, 50], 0, 300), 1, 'wider than the view: its start shown, not passed');

// keys: 100 rows, 5 columns, a page of 10
const at = (row, col) => ({ row, col });
const move = (key, ctrl, cur) => plain(s.moveCursor(key, ctrl, cur, 100, 5, 10));
assert.deepStrictEqual(move('ArrowDown', false, at(0, 0)), at(1, 0));
assert.deepStrictEqual(move('ArrowDown', false, at(5, 2)), at(6, 2));
assert.deepStrictEqual(move('ArrowUp', false, at(5, 2)), at(4, 2));
assert.deepStrictEqual(move('ArrowUp', false, at(0, 2)), at(0, 2), 'clamped');
assert.deepStrictEqual(move('ArrowRight', false, at(3, 4)), at(3, 4), 'clamped');
assert.deepStrictEqual(move('ArrowLeft', false, at(3, 4)), at(3, 3));
assert.deepStrictEqual(move('PageDown', false, at(95, 1)), at(99, 1));
assert.deepStrictEqual(move('PageUp', false, at(15, 1)), at(5, 1));
assert.deepStrictEqual(move('Home', false, at(7, 3)), at(7, 0));
assert.deepStrictEqual(move('End', false, at(7, 3)), at(7, 4));
assert.deepStrictEqual(move('Home', true, at(7, 3)), at(0, 3));
assert.deepStrictEqual(move('End', true, at(7, 3)), at(99, 3));
assert.strictEqual(s.moveCursor('Enter', false, at(0, 0), 100, 5, 10), null, 'not a cursor key');
// row mode: Home / End by rows, the column kept; ArrowLeft / Right not the cursor's
const moveRow = (key, ctrl, cur) => plain(s.moveCursor(key, ctrl, cur, 100, 5, 10, true));
assert.deepStrictEqual(moveRow('Home', false, at(7, 3)), at(0, 3));
assert.deepStrictEqual(moveRow('End', false, at(7, 3)), at(99, 3));
assert.deepStrictEqual(moveRow('End', true, at(7, 3)), at(99, 3));
assert.deepStrictEqual(moveRow('ArrowDown', false, at(7, 3)), at(8, 3));
assert.strictEqual(s.moveCursor('ArrowLeft', false, at(7, 3), 100, 5, 10, true), null);
assert.strictEqual(s.moveCursor('ArrowRight', false, at(7, 3), 100, 5, 10, true), null);
assert.strictEqual(s.moveCursor('ArrowDown', false, at(0, 0), 0, 5, 10), null, 'no rows');
assert.strictEqual(s.moveCursor('ArrowDown', false, at(0, 0), 100, 0, 10), null, 'no columns');

// the next cell to edit: 3 rows, 5 columns, the 0th and 3rd not editable
const ed = c => c !== 0 && c !== 3;
const next = (cur, back) => plain(s.nextCell(cur, back, 3, 5, ed));
assert.deepStrictEqual(next(at(0, 1), false), at(0, 2));
assert.deepStrictEqual(next(at(0, 2), false), at(0, 4), 'not editable: passed');
assert.deepStrictEqual(next(at(0, 4), false), at(1, 1), 'the row\'s end: the next row\'s first');
assert.deepStrictEqual(next(at(0, 0), false), at(0, 1), 'from a column not editable');
assert.strictEqual(s.nextCell(at(2, 4), false, 3, 5, ed), null, 'the sheet\'s end');
assert.deepStrictEqual(next(at(1, 4), true), at(1, 2), 'back');
assert.deepStrictEqual(next(at(1, 1), true), at(0, 4), 'back: the row\'s start, the previous row\'s last');
assert.strictEqual(s.nextCell(at(0, 1), true, 3, 5, ed), null, 'back: the sheet\'s start');
assert.strictEqual(s.nextCell(at(0, 1), false, 3, 5, () => false), null, 'none editable');
assert.strictEqual(s.nextCell(at(0, 0), false, 1, 1, () => true), null, 'one cell');
assert.deepStrictEqual(plain(s.nextCell(at(1, 2), true, 3, 5, c => c !== 1)), at(1, 0), 'back: to the 0th column');
assert.deepStrictEqual(plain(s.nextCell(at(1, 2), true, 3, 5, c => c === 2)), at(0, 2), 'back: the previous row\'s last editable');
assert.strictEqual(s.nextCell(at(0, 4), false, 2, 5, c => c > 4), null, 'asked of the columns only');

// search by typing: a pause of 1000ms or less adds up
const ta = new s.TypeAhead(1000);
assert.strictEqual(ta.push('a', 0), 'a');
assert.strictEqual(ta.push('b', 500), 'ab');
assert.strictEqual(ta.push('c', 1500), 'abc', 'a pause of exactly 1000ms: still adds up');
assert.strictEqual(ta.push('d', 2501), 'd', 'a longer pause: a new prefix');
ta.clear();
assert.strictEqual(ta.push('e', 2600), 'e', 'cleared');

const T = ['Alpha', 'beta', 'Bravo', 'alpine'];
const text = row => T[row];
assert.strictEqual(s.findRow(4, 0, 'b', text), 1, 'any case');
assert.strictEqual(s.findRow(4, 2, 'b', text), 2, 'from the current row itself');
assert.strictEqual(s.findRow(4, 3, 'al', text), 3);
assert.strictEqual(s.findRow(4, 3, 'alph', text), 0, 'around past the last');
assert.strictEqual(s.findRow(4, 0, 'z', text), -1);
assert.strictEqual(s.findRow(0, 0, 'a', text), -1, 'no rows');
assert.strictEqual(s.findRow(2, 0, 'тов', row => ['Склад', 'ТОВАР'][row]), 1, 'Cyrillic, any case');

// the wheel: rows of 25px
const w = new s.WheelSteps();
assert.strictEqual(new s.WheelSteps().steps(100, 0, 0, 10), 0, 'no row height yet: no steps');
assert.strictEqual(w.steps(100, 0, 25, 10), 4, 'a mouse notch');
assert.strictEqual(w.steps(10, 0, 25, 10), 0, 'a touchpad: kept');
assert.strictEqual(w.steps(10, 0, 25, 10), 0);
assert.strictEqual(w.steps(10, 0, 25, 10), 1, 'added up to a row');
assert.strictEqual(w.steps(-10, 0, 25, 10), 0, 'turned: the rest dropped, not -0');
assert.strictEqual(w.steps(-20, 0, 25, 10), -1);
assert.strictEqual(w.steps(3, 1, 25, 10), 3, 'lines');
assert.strictEqual(w.steps(1, 2, 25, 10), 10, 'pages');

console.log('a2v10-core.js, the datasheet core: OK');
