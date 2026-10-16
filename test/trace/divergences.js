// Where the package's trace differs from Net48's on purpose: a fixed defect of NET48-BUGS.md.
// Each: the Net48 lines (a block occurring once in net48.trace) and the package's in their place.

'use strict';

const DIVERGENCES = [
	{
		why: 'B3: alert() on a template property of an unknown kind',
		net48: [
			'## template: a property of an unknown kind',
			'> create',
			'  throws ReferenceError: alert is not defined'
		],
		model: [
			'## template: a property of an unknown kind',
			'> create',
			`  console.error "invalid template property 'TRoot.$List'"`,
			'  ev TRoot.construct(@Root, "")',
			'> load',
			'  ev Model.load(@Root, null, false)',
			'  $dirty → false'
		]
	},
	{
		why: 'B2: console.error($`…`) for a command without exec',
		net48: [
			'> _exec_(noExec)',
			'  throws ReferenceError: $ is not defined'
		],
		model: [
			'> _exec_(noExec)',
			`  console.error "There is no method 'exec' in command 'noExec'"`
		]
	},
	{
		why: 'B4: a tree element with $expanded and no source',
		net48: [
			'> A2.Items.$append() (no source)',
			'  ev TFolderArray.construct(@~Folders[].Items[].Items[].Items)',
			`  throws TypeError: Cannot read properties of null (reading 'Expanded')`
		],
		model: [
			'> A2.Items.$append() (no source)',
			'  ev TFolderArray.construct(@~Folders[].Items[].Items[].Items)',
			'  ev TFolder.construct(@~Folders[].Items[].Items[], "Items[]")',
			'  ev Folders[].Items[].Items[].adding(@Root.Folders[0].Items[1].Items, @~Folders[].Items[].Items[])',
			'  ev Folders[].Items[].Items[].add(@Root.Folders[0].Items[1].Items, @Root.Folders[0].Items[1].Items[0], 0)',
			'  ev Folders[].select(@Root.Folders, @Root.Folders[0].Items[1].Items[0])',
			'  ev Folders[].Items[].Items[].select(@Root.Folders[0].Items[1].Items, @Root.Folders[0].Items[1].Items[0])',
			'  ev Folders[].Items[].HasChildren.changing(@Root.Folders[0].Items[1], true, false, "HasChildren")',
			'  ev Folders[].Items[].HasChildren.change(@Root.Folders[0].Items[1], true, false, "HasChildren")',
			'  = @Root.Folders[0].Items[1].Items[0]'
		]
	}
];

module.exports = { DIVERGENCES };
