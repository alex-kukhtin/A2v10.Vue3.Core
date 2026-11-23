// Mutation run over the datasheet's core (packages/primitives/src/sheet.ts) as the built a2v10-core.js holds it: one
// operator changed at a time, the bundle written to a temp folder (the built one never touched), test/core/sheet.js
// run against it (A2V10_CORE_BUNDLE). A mutant the test still passes is a survivor: a gap in the test, or an
// equivalent mutant, listed below with its reason. Comments are not mutated.
// Fails (exit 1) on a survivor not listed, and on a listed one not met any more (the code changed: the list is stale).
// Run: pnpm test:mutants (after pnpm build). ~1 min.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { DIST } = require('./load.js');

const BUNDLE = path.join(DIST, 'a2v10-core.js');
const TEST = path.join(__dirname, 'sheet.js');

// The operators changed, each match one mutant.
const OPS = [
	[/ <= /g, ' < '], [/ < /g, ' <= '], [/ >= /g, ' > '], [/ > /g, ' >= '],
	[/ === /g, ' !== '], [/ !== /g, ' === '],
	[/ \+ 1\b/g, ' - 1'], [/ - 1\b/g, ' + 1'], [/ \+= /g, ' -= '], [/ -= /g, ' += '],
	[/ \+ /g, ' - '], [/ - /g, ' + '], [/ \* /g, ' / '], [/ \/ /g, ' * '],
	[/Math\.max/g, 'Math.min'], [/Math\.min/g, 'Math.max'],
	[/Math\.floor/g, 'Math.ceil'], [/Math\.trunc/g, 'Math.round'],
	[/return -1;/g, 'return 0;'], [/return 1;/g, 'return 0;'], [/ \|\| 0/g, ''],
	[/\(0, /g, '(1, '], [/c = 0;/g, 'c = 1;'], [/row = 0;/g, 'row = 1;'], [/col = 0;/g, 'col = 1;'],
	[/ && /g, ' || '], [/ \|\| /g, ' && '], [/break;/g, ';'], [/this\.rest = 0;/g, ';']
];

// Equivalent mutants: the program changed, its results not; no test can tell them. Keyed by the bundle's line
// (trimmed) and the change.
const EQUIVALENT = [
	{ line: 'if (y < headerHeight || rowHeight <= 0)', from: ' <= ', to: ' < ',
		why: 'rowAt, rowHeight 0: the division gives Infinity or NaN, `row < rowCount` is false: -1 as well' },
	{ line: 'if (row < pos)', from: ' < ', to: ' <= ',
		why: 'fitRowPos, row === pos: both branches give clampRowPos(pos)' },
	{ line: 'if (col < colPos)', from: ' < ', to: ' <= ',
		why: 'fitColPos, col === colPos: clampColPos(col) is what the loop gives, clampColPos(colPos)' },
	{ line: 'while (c > fixed && x + widths[c - 1] <= avail) {', from: ' > ', to: ' >= ',
		why: 'maxColPos: a step into a fixed column, undone by Math.max(fixed, …)' },
	{ line: 'row = rowCount - 1;', from: ' - 1', to: ' + 1',
		why: 'moveCursor, End by rows: a row past the last, clamped to it by the return' },
	{ line: 'row = rowCount - 1;', from: ' - ', to: ' + ',
		why: 'moveCursor, End by rows: a row past the last, clamped to it by the return' },
	{ line: 'col = colCount - 1;', from: ' - 1', to: ' + 1',
		why: 'moveCursor, End: a column past the last, clamped to it by the return' },
	{ line: 'col = colCount - 1;', from: ' - ', to: ' + ',
		why: 'moveCursor, End: a column past the last, clamped to it by the return' }
];

const orig = fs.readFileSync(BUNDLE, 'utf8');
const start = orig.indexOf('    function rowPage(');
const wheel = orig.indexOf('    class WheelSteps {', start);
const end = orig.indexOf('\n    }\n', wheel) + 7; // the class's closing brace
if (start < 0 || wheel < 0 || end < wheel)
	throw new Error(`the sheet core not found in ${BUNDLE}: from rowPage to the class WheelSteps`);
const region = orig.substring(start, end);

const lineOf = at => region.substring(region.lastIndexOf('\n', at - 1) + 1, region.indexOf('\n', at));
const inComment = at => region.substring(region.lastIndexOf('\n', at - 1) + 1, at).includes('//');

const mutants = [];
for (const [re, to] of OPS) {
	re.lastIndex = 0;
	let m;
	while ((m = re.exec(region))) {
		if (inComment(m.index))
			continue;
		mutants.push({ at: m.index, from: m[0], to, line: lineOf(m.index).trim() });
	}
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'a2v10-mutant-'));
const file = path.join(dir, 'a2v10-core.js');
const survivors = [];
try {
	for (const mu of mutants) {
		const text = region.substring(0, mu.at) + mu.to + region.substring(mu.at + mu.from.length);
		fs.writeFileSync(file, orig.substring(0, start) + text + orig.substring(end));
		const r = spawnSync(process.execPath, [TEST], {
			env: { ...process.env, A2V10_CORE_BUNDLE: file }, timeout: 10000, encoding: 'utf8'
		});
		if (r.status === 0)
			survivors.push(mu);
	}
} finally {
	fs.rmSync(dir, { recursive: true, force: true });
}

const same = (e, s) => e.line === s.line && e.from === s.from && e.to === s.to;
const unexpected = survivors.filter(s => !EQUIVALENT.some(e => same(e, s)));
const stale = EQUIVALENT.filter(e => !survivors.some(s => same(e, s)));

console.log(`the datasheet core: ${mutants.length} mutants, ${mutants.length - survivors.length} killed, ` +
	`${survivors.length - unexpected.length} equivalent (listed), ${unexpected.length} survived unexpected`);
for (const s of unexpected)
	console.log(`  survived: '${s.from}' → '${s.to}'   ${s.line}`);
for (const e of stale)
	console.log(`  listed as equivalent, not met (remove it): '${e.from}' → '${e.to}'   ${e.line}`);
process.exitCode = unexpected.length || stale.length ? 1 : 0;
