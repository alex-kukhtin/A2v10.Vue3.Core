// Where the package's trace differs from Net48's on purpose: a defect of NET48-BUGS.md fixed in the package, or a
// change of packages/model/NET48.md. Each: id (the entry), trace ('model': net48.trace vs model.trace; 'page': base.net48.trace vs base.port.trace),
// the Net48 lines (a block occurring `times` times in its trace, once if not given) and the package's in their place.

'use strict';

// B7: a load does not make the model dirty. $copy (the load door: $merge, $expand, $loadLazy) empties by
// __empty__, not $empty; Net48's $empty marked the model dirty, and a load then cleaned it (Model.load).
const B7 = 'B7';

// seal: no Object.seal at load (packages/model/NET48.md, "Dropped for Vue 3"): an undeclared property is added,
// a map grows after load.
const SEAL = 'seal';

const DIVERGENCES = [
	{
		id: SEAL, trace: 'model',
		net48: [
			'> add a property to an element after load',
			'  throws TypeError: Cannot add property Extra, object is not extensible'
		],
		ours: [
			'> add a property to an element after load',
			'  = true'
		]
	},
	{
		id: SEAL, trace: 'model',
		net48: [
			'> after load: root.$setProperty("X", {Id: 1})',
			'  throws Error: $setProperty: the map \'Root\' is sealed after load',
			'> after load: Document.Map.$setProperty("Y", {Id: 2})',
			'  throws Error: $setProperty: the map \'Document.Map\' is sealed after load'
		],
		ours: [
			'> after load: root.$setProperty("X", {Id: 1})',
			'  ev TItem.construct(@~X, "X")',
			'  ev Model.dirty.change(true, undefined)',
			'  = @~X',
			'  $dirty → true',
			'> after load: Document.Map.$setProperty("Y", {Id: 2})',
			'  ev TItem.construct(@~Document.Map.Y, "Y")',
			'  = @~Document.Map.Y'
		]
	},
	{
		id: B7, trace: 'model',
		net48: [
			'  = [1, 9]',
			'> root.$setDirty(false); $copy([{Id: 41, RowNo: 1}]); $dirty',
			'  ev Model.dirty.change(false, undefined)',
			'  ev Model.dirty.change(true, "Rows")',
			'  ev TRow.construct(@~Rows[], "Rows[]")',
			'  = true'
		],
		ours: [
			'  = [1, 9]',
			'> root.$setDirty(false); $copy([{Id: 41, RowNo: 1}]); $dirty',
			'  ev Model.dirty.change(false, undefined)',
			'  ev TRow.construct(@~Rows[], "Rows[]")',
			'  = false',
			'  $dirty → false'
		]
	},
	// B7: on a read-only model $remove, $empty, $set are refused (Net48 checked a member no one has); $merge loads.
	// $set refused, Document keeps its Name and Period.
	{
		id: B7, trace: 'model',
		net48: [
			'> Agents.$remove(Agents[0]) (read-only)',
			'  ev Agents[].remove(@Root.Agents, @~Agents[], 0)',
			'  = "2"',
			'> Agents.$empty() (read-only)',
			'  = 0',
			'> Document.$set({Name: "set"}) (read-only)',
			'  = "set"',
			'> $merge({Agents: [{Id: 3}]}) (read-only: the load door)',
			'  ev TAgent.construct(@~Agents[], "Agents[]")',
			'  = "3"',
			'> Document.Period',
			'  = P(D1901-01-01T00:00:00..D2999-12-31T00:00:00)'
		],
		ours: [
			'> Agents.$remove(Agents[0]) (read-only)',
			'  = "1,2"',
			'> Agents.$empty() (read-only)',
			'  = 2',
			'> Document.$set({Name: "set"}) (read-only)',
			'  = "x"',
			'> $merge({Agents: [{Id: 3}]}) (read-only: the load door)',
			'  ev TAgent.construct(@~Agents[], "Agents[]")',
			'  = "3"',
			'> Document.Period',
			'  = P(D2026-01-01T00:00:00..D2026-01-31T00:00:00)'
		]
	},
	{
		id: B7, trace: 'model',
		net48: [
			'        Name: "set"',
			'        Perm: 0',
			'        Period: P(D1901-01-01T00:00:00..D2999-12-31T00:00:00)'
		],
		ours: [
			'        Name: "x"',
			'        Perm: 0',
			'        Period: P(D2026-01-01T00:00:00..D2026-01-31T00:00:00)'
		]
	},
	{
		id: B7, trace: 'page', times: 3,
		net48: [
			'  bus pageReloaded("/_page/document/index/0?pageSize=20&dir=asc&order=Name")',
			'  ev Model.dirty.change(true, "Documents")'
		],
		ours: [
			'  bus pageReloaded("/_page/document/index/0?pageSize=20&dir=asc&order=Name")'
		]
	},
	{
		id: B7, trace: 'page', times: 2,
		net48: [
			'  bus pageReloaded("/_page/document/index/0?Text=abc")',
			'  ev Model.dirty.change(true, "Documents")'
		],
		ours: [
			'  bus pageReloaded("/_page/document/index/0?Text=abc")'
		]
	},
	{
		id: B7, trace: 'page',
		net48: [
			'  bus pageReloaded("/_page/document/index/0?pageSize=20&dir=asc&order=Name&Text=abc")',
			'  ev Model.dirty.change(true, "Documents")'
		],
		ours: [
			'  bus pageReloaded("/_page/document/index/0?pageSize=20&dir=asc&order=Name&Text=abc")'
		]
	},
	{
		id: B7, trace: 'page',
		net48: [
			'  bus endRequest("/_data/expand")',
			'  ev Model.dirty.change(true, "Folders[].Items")'
		],
		ours: [
			'  bus endRequest("/_data/expand")'
		]
	},
	{
		id: B7, trace: 'page',
		net48: [
			'  bus pageReloaded("/_page/document/edit/5")',
			'  ev Model.dirty.change(true, "Document.Rows")',
			'  ev TRow.construct(@~Document.Rows[], "Rows[]")',
			'  ev TRow.construct(@~Document.Rows[], "Rows[]")',
			'  bus isModalRequery({url: "/_page/document/edit/5", result: false})',
			'  ev Model.load(@Root, null, false)',
			'  ev Model.dirty.change(false, undefined)',
			'  resolved undefined'
		],
		ours: [
			'  bus pageReloaded("/_page/document/edit/5")',
			'  ev TRow.construct(@~Document.Rows[], "Rows[]")',
			'  ev TRow.construct(@~Document.Rows[], "Rows[]")',
			'  bus isModalRequery({url: "/_page/document/edit/5", result: false})',
			'  ev Model.load(@Root, null, false)',
			'  resolved undefined'
		]
	}
];

// Net48's trace text as the package's must be: each divergence of that trace in its place. A block found other
// than `times` times is an error: the scenarios moved, the divergence must be cut again.
function expectedTrace(net48Text, trace) {
	let text = net48Text.replace(/\r\n/g, '\n');
	for (const d of DIVERGENCES.filter(x => x.trace === trace)) {
		const from = d.net48.join('\n') + '\n';
		const count = text.split(from).length - 1;
		const times = d.times || 1;
		if (count !== times)
			throw new Error(`divergence ${d.id} (${trace}): its Net48 block occurs ${count} times, not ${times}:\n${from}`);
		text = text.split(from).join(d.ours.join('\n') + '\n');
	}
	return text;
}

module.exports = { DIVERGENCES, expectedTrace };
