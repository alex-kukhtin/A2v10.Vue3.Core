// The trace of the built core over the scenarios, compared with Net48's (net48.trace): equal but for
// the divergences listed in divergences.js, each one a fixed defect of NET48-BUGS.md.
// Run: node test/trace/model.js        → writes test/trace/model.trace; exit 1 on a difference

'use strict';

process.env.TZ = 'Europe/Kyiv'; // as the Net48 run: dates in the trace are local

const fs = require('fs');
const path = require('path');
const { loadModelBundle } = require('../model/load.js');
const { loadLocale, serverRuntime } = require('../model/runtime.js');
const { createRecorder } = require('./recorder.js');
const { SCENARIOS } = require('./scenarios.js');
const { DIVERGENCES } = require('./divergences.js');

const core = loadModelBundle().createModel(serverRuntime(loadLocale()));
const t = createRecorder({ cmn: core.datamodel, period: core.period, utils: core.utils });
const actual = t.run(SCENARIOS);
fs.writeFileSync(path.join(__dirname, 'model.trace'), actual);

// Net48's trace with each divergence's block replaced by the package's; a block must occur once.
let expected = fs.readFileSync(path.join(__dirname, 'net48.trace'), 'utf8').replace(/\r\n/g, '\n');
for (const d of DIVERGENCES) {
	const from = d.net48.join('\n') + '\n';
	const count = expected.split(from).length - 1;
	if (count !== 1)
		throw new Error(`divergence '${d.why}': its Net48 block occurs ${count} times in net48.trace`);
	expected = expected.replace(from, () => d.model.join('\n') + '\n');
}

const a = actual.split('\n');
const e = expected.split('\n');
const at = a.findIndex((line, i) => line !== e[i]);
if (at === -1 && a.length === e.length) {
	console.log(`trace: ${SCENARIOS.length} scenarios, ${a.length} lines, equal to Net48 but for ${DIVERGENCES.length} divergences`);
} else {
	const i = at === -1 ? Math.min(a.length, e.length) : at;
	const head = e.slice(0, i).reverse().find(l => l.startsWith('## ')) || '';
	console.log(`trace differs at line ${i + 1} ${head}`);
	for (let k = Math.max(0, i - 3); k < i + 4; k++)
		console.log(`${k === i ? '>' : ' '} net48  ${e[k] ?? '<end>'}\n${k === i ? '>' : ' '} model  ${a[k] ?? '<end>'}`);
	process.exitCode = 1;
}
