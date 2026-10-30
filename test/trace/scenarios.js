// Scenarios over models declared as the server declares them. Each one drives the model the way the
// platform and application code do, and the recorder writes down what the core does in answer.
// No expectations here: the trace of the original is the expectation.

'use strict';

const SCENARIOS = [

	function scalars(t) {
		const root = t.model('scalars: types, changing/change, cancel, $$, lock', {
			decl: {
				TRoot: { props: { Document: 'TDocument' } },
				TDocument: {
					props: {
						Id: Number, Name: { type: String, len: 50 }, Amount: Number,
						Done: Boolean, Date: Date, $$Tab: String
					},
					$id: 'Id', $name: 'Name'
				}
			},
			data: { Document: { Id: 10, Name: 'Doc', Amount: 5, Date: '2025-03-30T00:00:00' } },
			on: {
				'Document.Name.changing': (doc, val) => val === 'forbidden' ? false : undefined
			}
		});
		const doc = root.Document;
		t.op('Name = "New"', () => { doc.Name = 'New'; });
		t.op('Name = "New" again', () => { doc.Name = 'New'; });
		t.op('Name = "forbidden" (changing → false)', () => { doc.Name = 'forbidden'; return doc.Name; });
		t.op('Amount = "1 234,5"', () => { doc.Amount = '1 234,5'; return doc.Amount; });
		t.op('Amount = "abc"', () => { doc.Amount = 'abc'; return doc.Amount; });
		t.op('Amount = null', () => { doc.Amount = null; return doc.Amount; });
		t.op('Done = 1', () => { doc.Done = 1; return doc.Done; });
		t.op('Done = "false"', () => { doc.Done = 'false'; return doc.Done; });
		t.op('Name = 42', () => { doc.Name = 42; return doc.Name; });
		t.op('Date = new Date(2026, 0, 15)', () => { doc.Date = new Date(2026, 0, 15); return doc.Date; });
		t.op('Date = "2026-02-01T00:00:00"', () => { doc.Date = '2026-02-01T00:00:00'; return doc.Date; });
		t.op('$$Tab = "x"', () => { doc.$$Tab = 'x'; });
		t.op('$lockEvents; Name = "Locked"; $unlockEvents', () => {
			doc.$lockEvents();
			doc.Name = 'Locked';
			const locked = doc.$eventsLocked;
			doc.$unlockEvents();
			return locked;
		});
		t.op('$noChangeEvents(Name = "Quiet")', () => {
			const res = doc.$noChangeEvents(d => { d.Name = 'Quiet'; return [d === doc, d.$eventsLocked]; });
			return [res, doc.$eventsLocked];
		});
		t.op('$id, $name, $isNew, $maxLength(Name), $maxLength(Amount)',
			() => [doc.$id, doc.$name, doc.$isNew, doc.$maxLength('Name'), doc.$maxLength('Amount')]);
		t.op('$root, $parent, $vm present', () => [doc.$root === root, doc.$parent === root, !!doc.$vm]);
		t.op('add a property to an element after load', () => { doc.Extra = 1; return 'Extra' in doc; });
		t.op('root.$setDirty(false)', () => { root.$setDirty(false); });
		t.show('data', root);
	},

	function objects(t) {
		const root = t.model('objects: assign element, null, plain object, $empty, $merge', {
			decl: {
				TRoot: { props: { Document: 'TDocument', Agents: 'TAgentArray' } },
				TDocument: { props: { Id: Number, Agent: 'TAgent', Memo: String }, $id: 'Id' },
				TAgent: { array: true, props: { Id: Number, Name: String }, $id: 'Id', $name: 'Name' }
			},
			data: {
				Document: { Id: 1, Agent: { Id: 5, Name: 'Five' } },
				Agents: [{ Id: 6, Name: 'Six' }, { Id: 7, Name: 'Seven' }]
			}
		});
		const doc = root.Document;
		const agent = doc.Agent;
		t.op('Agent = Agents[0]', () => { doc.Agent = root.Agents[0]; return [doc.Agent === agent, doc.Agent.Id]; });
		t.op('Agent.Name = "Changed"; Agents[0].Name', () => { doc.Agent.Name = 'Changed'; return root.Agents[0].Name; });
		t.op('Agent = Agents[0] again (same Id)', () => { doc.Agent = root.Agents[0]; });
		t.op('Agent = null', () => { doc.Agent = null; return [doc.Agent.Id, doc.Agent.Name]; });
		t.op('Agent = {Id: 8, Name: "Plain"}', () => { doc.Agent = { Id: 8, Name: 'Plain' }; });
		t.op('Agent.$empty()', () => { doc.Agent.$empty(); return doc.Agent.$isEmpty; });
		t.op('Document.$merge({Id: 2, Agent: {Id: 9}, Memo: "m"})', () => {
			doc.$merge({ Id: 2, Agent: { Id: 9, Name: 'Nine' }, Memo: 'm' });
			return [doc.Agent === agent, doc.Agent._path_];
		});
		t.op('Document.$merge({Id: 2, Memo: "same id"})', () => { doc.$merge({ Id: 2, Memo: 'same id' }); });
		t.op('Agent.$set({Id: 10})', () => { doc.Agent.$set({ Id: 10 }); });
		t.show('data', root);
	},

	function arrays(t) {
		const root = t.model('arrays: insert, cancel, remove, select, check, rows, move, sort, copy', {
			decl: {
				TRoot: { props: { Rows: 'TRowArray' } },
				TRow: {
					array: true,
					props: { Id: Number, Qty: Number, Price: Number, Sum: Number, RowNo: Number },
					$id: 'Id', $rowNo: 'RowNo'
				}
			},
			data: {
				Rows: [{ Id: 1, Qty: 1, Price: 10 }, { Id: 2, Qty: 2, Price: 20 }, { Id: 3, Qty: 3, Price: 30 }],
				'Rows.$RowCount': 3
			},
			on: {
				'Rows[].Qty.change': row => { row.Sum = row.Qty * row.Price; },
				'Rows[].adding': (arr, elem) => elem.Id === 99 ? false : undefined
			}
		});
		const rows = root.Rows;
		t.op('Rows[1].Qty = 5', () => { rows[1].Qty = 5; return rows[1].Sum; });
		t.op('$append({Id: 4})', () => rows.$append({ Id: 4, Qty: 1, Price: 1 }));
		t.op('$prepend({Id: 5})', () => rows.$prepend({ Id: 5 }));
		t.op('$insert({Id: 6}, "above", Rows[2])', () => rows.$insert({ Id: 6 }, 'above', rows[2]));
		t.op('$insert({Id: 7}, "below", Rows[0])', () => rows.$insert({ Id: 7 }, 'below', rows[0]));
		t.op('$append({Id: 99}) (adding → false)', () => rows.$append({ Id: 99 }));
		t.op('$append([{Id: 11}, {Id: 12}])', () => rows.$append([{ Id: 11 }, { Id: 12 }]));
		t.op('$selected, $selectedIndex, $RowCount', () => [rows.$selected, rows.$selectedIndex, rows.$RowCount]);
		t.op('Rows[2].$select()', () => { rows[2].$select(); return rows.$selected; });
		t.op('Rows[2].$select() again', () => { rows[2].$select(); });
		t.op('$clearSelected()', () => { rows.$clearSelected(); return rows.$selected; });
		t.op('Rows[0].$checked = true; Rows[3].$checked = true', () => {
			rows[0].$checked = true;
			rows[3].$checked = true;
			return [rows.$checked, rows.$hasChecked];
		});
		t.op('Rows[2].$select(); $remove(Rows[2])', () => { rows[2].$select(); rows.$remove(rows[2]); return rows.$selected; });
		t.op('Rows[last].$remove()', () => { rows[rows.length - 1].$remove(); return rows.$selected; });
		t.op('$remove(detached row)', () => { rows.$remove(rows.$new({ Id: 50 })); });
		t.op('$move(Rows[0], "down")', () => { rows.$move(rows[0], 'down'); return rows.$ids; });
		t.op('Rows[3].$move("top")', () => { rows[3].$move('top'); return rows.$ids; });
		t.op('$canMove(Rows[0], "up"), Rows[0].$canMove("down")', () => [rows.$canMove(rows[0], 'up'), rows[0].$canMove('down')]);
		t.op('$sort(by Id desc)', () => { rows.$sort((a, b) => b.Id - a.Id); return rows.$ids; });
		t.op('$find(Id === 4), $sum(Qty), Count, $isEmpty', () => [rows.$find(r => r.Id === 4), rows.$sum(r => r.Qty), rows.Count, rows.$isEmpty]);
		t.op('Selected("Id")', () => rows.Selected('Id'));
		t.op('$new({Id: 30}) (not added)', () => [rows.$new({ Id: 30 }), rows.length]);
		t.op('$valid, $permissions', () => [rows.$valid, rows.$permissions]);
		t.show('data', root);
		t.op('$copy([{Id: 21}, {Id: 22}])', () => { rows.$copy([{ Id: 21 }, { Id: 22 }]); return rows.$RowCount; });
		t.op('$empty()', () => { rows.$empty(); return [rows.length, rows.$RowCount]; });
		t.op('root.$merge({Rows: [{Id: 31}], "Rows.$RowCount": 9})', () => {
			root.$merge({ Rows: [{ Id: 31, Qty: 2, Price: 3 }], 'Rows.$RowCount': 9 });
			return [rows.length, rows.$RowCount];
		});
		t.op('root.$setDirty(false); $copy([{Id: 41, RowNo: 1}]); $dirty', () => { // B7: a load, not a change
			root.$setDirty(false);
			rows.$copy([{ Id: 41, RowNo: 1 }]);
			return root.$dirty;
		});
		t.show('data', root);
	},

	function template(t) {
		const root = t.model('template: properties, defaults, construct, Model.load', {
			decl: {
				TRoot: { props: { Document: 'TDocument' } },
				TDocument: {
					props: { Id: Number, Name: String, Date: Date, Rows: 'TRowArray' },
					$id: 'Id'
				},
				TRow: { array: true, props: { Qty: Number, Price: Number } }
			},
			data: { Document: { Id: 0, Rows: [{ Qty: 2, Price: 5 }] } },
			template: {
				properties: {
					'TRow.$Sum'() { return this.Qty * this.Price; },
					'TDocument.$Total'() { return this.Rows.reduce((a, r) => a + r.$Sum, 0); },
					'TDocument.$Upper': {
						get() { return this.Name.toUpperCase(); },
						set(v) { this.Name = v.toLowerCase(); }
					},
					'TRoot.$$Filter': String,
					'TDocument.$Flag': Boolean,
					'TDocument.$Count': { type: Number, value: 5 },
					'TDocument.$Info': { kind: 'plain' },
					'Bad': Number
				},
				defaults: {
					'Document.Name': 'Default name',
					'Document.Date'(obj, prop) { return new Date(2026, 0, 15); },
					'Document.Rows[].Qty': 7
				}
			}
		});
		const doc = root.Document;
		t.op('$Total, Rows[0].$Sum', () => [doc.$Total, doc.Rows[0].$Sum]);
		t.op('Rows[0].Qty = 3; $Total', () => { doc.Rows[0].Qty = 3; return doc.$Total; });
		t.op('$Upper, $Upper = "MIXED"', () => { const u = doc.$Upper; doc.$Upper = 'MIXED'; return [u, doc.Name]; });
		t.op('$$Filter = "flt"', () => { root.$$Filter = 'flt'; return root.$$Filter; });
		t.op('$Flag = 1', () => { doc.$Flag = 1; return doc.$Flag; });
		t.op('$Count, $Info, $Rows', () => [doc.$Count, doc.$Info, doc.$Rows]);
		t.op('$Count = "8"', () => { doc.$Count = '8'; return doc.$Count; });
		t.op('Rows.$append({})', () => doc.Rows.$append({}));
		t.show('data', root);
		t.op('Document.$merge({Id: 0, Name: "merged"}); $Count, $Info', () => {
			doc.$merge({ Id: 0, Name: 'merged' });
			return [doc.$Count, doc.$Info];
		});

		// A property of an unknown kind (an array): Net48 answered with alert(), a browser global.
		t.model('template: a property of an unknown kind', {
			decl: { TRoot: { props: { Name: String } } },
			template: { properties: { 'TRoot.$List': [1, 2] } }
		});
	},

	function validators(t) {
		const root = t.model('validators: rules, $valid, $errors, array paths, $forceValidate', {
			decl: {
				TRoot: { props: { Document: 'TDocument' } },
				TDocument: { props: { Name: String, Email: String, Code: String, Rows: 'TRowArray' } },
				TRow: { array: true, props: { Qty: Number, Note: String } }
			},
			data: { Document: { Name: '', Email: 'bad', Code: 'ok', Rows: [{ Qty: 1 }, { Qty: 0 }] } },
			template: {
				validators: {
					'Document.Name': 'Name is required',
					'Document.Email': { valid: 'email', msg: 'Bad email' },
					'Document.Code': (doc, val) => val.length > 3 ? 'Code is too long' : '',
					'Document.Rows[].Qty': [
						{ valid: (row, val) => val > 0, msg: 'Qty must be positive' },
						{ valid: (row, val) => val < 100, msg: 'Qty is too big', severity: 'warning' }
					],
					'Document.Rows[].Note': { valid: 'notBlank', msg: 'Note', applyIf: (row) => row.Qty > 50 }
				}
			}
		});
		const doc = root.Document;
		t.op('root.$valid, Document.$valid, Rows.$valid', () => [root.$valid, doc.$valid, doc.Rows.$valid]);
		t.op('$errors(Name), $errors(Email), $errors(Code)', () => [doc.$errors('Name'), doc.$errors('Email'), doc.$errors('Code')]);
		t.op('Rows[1].$errors(Qty), Rows[0].$errors(Qty)', () => [doc.Rows[1].$errors('Qty'), doc.Rows[0].$errors('Qty')]);
		t.op('$hasErrors([Document.Name]), $hasErrors([Document.Memo])',
			() => [root.$hasErrors(['Document.Name']), root.$hasErrors(['Document.Memo'])]);
		t.op('Name = "n"; Email = "a@b.cc"; Rows[1].Qty = 200', () => {
			doc.Name = 'n';
			doc.Email = 'a@b.cc';
			doc.Rows[1].Qty = 200;
			return [root.$valid, doc.$errors('Name'), doc.Rows[1].$errors('Qty')];
		});
		t.op('Code = "toolong"; $forceValidate()', () => { doc.Code = 'toolong'; return root.$forceValidate(); });
		t.op('Rows[1].Qty = 60 (applyIf Note)', () => { doc.Rows[1].Qty = 60; return [root.$valid, doc.Rows[1].$errors('Note')]; });

		const unknown = t.model('validators: an unknown std rule', {
			decl: {
				TRoot: { props: { Document: 'TDocument' } },
				TDocument: { props: { Name: String } }
			},
			data: { Document: { Name: '' } },
			template: { validators: { 'Document.Name': { valid: 'unknown', msg: 'Unknown' } } }
		});
		t.op('$valid, $errors(Name)', () => [unknown.$valid, unknown.Document.$errors('Name')]);
	},

	function commands(t) {
		const root = t.model('commands and delegates', {
			decl: {
				TRoot: { props: { Document: 'TDocument' } },
				TDocument: { props: { Name: String } }
			},
			data: { Document: { Name: '' } },
			template: {
				validators: { 'Document.Name': 'required' },
				commands: {
					plain(arg) { this.Document.Name = arg; return 'plain:' + arg; },
					guarded: { exec(arg) { return 'guarded:' + arg; }, canExec(arg) { return !!arg; } },
					confirmed: { exec(arg) { this.Document.Name = 'confirmed'; }, confirm: 'Sure?' },
					saveFirst: { exec() { return 'saved'; }, saveRequired: true },
					validFirst: { exec() { return 'valid'; }, validRequired: true },
					readOnly: { exec() { return 'ro'; }, checkReadOnly: true },
					badCanExec: { exec() { }, canExec: 'yes' },
					constFalse: { exec() { }, canExec: false },
					noExec: {}
				},
				delegates: {
					wrap(x) { return `<${x}:${this.Document.Name}>`; }
				}
			}
		});
		t.op('_canExec_: plain, guarded(null), guarded(1), missing', () =>
			[root._canExec_('plain'), root._canExec_('guarded', null), root._canExec_('guarded', 1), root._canExec_('missing')]);
		t.op('_canExec_: validFirst, readOnly, badCanExec, constFalse', () =>
			[root._canExec_('validFirst'), root._canExec_('readOnly'), root._canExec_('badCanExec'), root._canExec_('constFalse')]);
		t.op('_canExec_(plain, null, {checkArgument, validRequired})', () =>
			[root._canExec_('plain', null, { checkArgument: true }), root._canExec_('plain', 1, { validRequired: true })]);
		t.op('_exec_(validFirst) while invalid', () => root._exec_('validFirst'));
		t.op('_exec_(plain, "x")', () => root._exec_('plain', 'x'));
		t.op('_exec_(guarded, 0), _exec_(guarded, 2)', () => [root._exec_('guarded', 0), root._exec_('guarded', 2)]);
		t.op('_exec_(confirmed)', () => root._exec_('confirmed'));
		t.op('_exec_(saveFirst) while dirty', () => root._exec_('saveFirst'));
		t.op('_exec_(validFirst) while valid', () => root._exec_('validFirst'));
		t.op('_exec_(missing)', () => root._exec_('missing'));
		t.op('_exec_(noExec)', () => root._exec_('noExec'));
		t.op('_delegate_(wrap)("a")', () => root._delegate_('wrap')('a'));
		t.op('_delegate_(missing)', () => root._delegate_('missing'));
	},

	function tree(t) {
		const root = t.model('tree: $items, $hasChildren, $expanded, select, insert, remove', {
			decl: {
				TRoot: { props: { Folders: 'TFolderArray' } },
				TFolder: {
					array: true,
					props: { Id: Number, Name: String, HasChildren: Boolean, Expanded: Boolean, Items: 'TFolderArray' },
					$id: 'Id', $name: 'Name', $items: 'Items', $hasChildren: 'HasChildren', $expanded: 'Expanded'
				}
			},
			data: {
				Folders: [
					{
						Id: 1, Name: 'A', HasChildren: true, Expanded: true, Items: [
							{ Id: 11, Name: 'A1', HasChildren: true, Items: [{ Id: 111, Name: 'A11' }] },
							{ Id: 12, Name: 'A2' }
						]
					},
					{ Id: 2, Name: 'B' }
				]
			}
		});
		const f = root.Folders;
		t.op('$expanded/$collapsed/$level of A, A1', () =>
			[f[0].$expanded, f[0].$collapsed, f[0].$level, f[0].Items[0].$expanded, f[0].Items[0].$level]);
		t.op('A11.$select()', () => { f[0].Items[0].Items[0].$select(); return [f.$selected, f[0].Items[0].$expanded]; });
		t.op('A11.$findTreeRoot(), $items', () => [f[0].Items[0].Items[0].$findTreeRoot(), f[0].$items]);
		t.op('A2.$select()', () => { f[0].Items[1].$select(); return f.$selected; });
		t.op('B.Items.$append({Id: 21})', () => f[1].Items.$append({ Id: 21, Name: 'B1' }));
		t.op('B1.$remove()', () => { f[1].Items[0].$remove(); return [f[1].HasChildren, f.$selected]; });
		t.op('$find(Name === "A11"), [...$elements] ids', () => [f.$find(x => x.Name === 'A11'), [...f.$elements].map(x => x.Id)]);
		t.op('[...$allItems()] ids', () => [...f.$allItems()].map(x => x.Id));
		t.op('B.$expand() (expanded)', () => f[1].$expand());
		t.op('A2.$expand() (collapsed)', () => f[0].Items[1].$expand());
		t.op('A2.$select(); A.Items.$clearSelected()', () => {
			f[0].Items[1].$select();
			f[0].Items.$clearSelected();
			return [f.$selected, f[0].Items.$selected];
		});
		t.show('data', root);
		// last: Net48 throws here, and the data above stays comparable
		t.op('A2.Items.$append() (no source)', () => f[0].Items[1].Items.$append());
	},

	function maps(t) {
		// A map grows in construct handlers; after load Net48 refuses (its _seal_), the package does not (NET48.md).
		const root = t.model('maps: $itemType, $setProperty on the root and nested', {
			decl: {
				TRoot: { props: { Document: 'TDocument' }, $itemType: 'TItem' },
				TDocument: { props: { Id: Number, Map: 'TMap' } },
				TMap: { props: {}, $itemType: 'TItem' },
				TItem: { props: { Id: Number, Name: String } }
			},
			data: { Document: { Id: 1 } },
			on: {
				'TMap.construct': map => { map.$setProperty('W', { Id: 3, Name: 'w' }); },
				'TRoot.construct': rt => { rt.$setProperty('V', { Id: 4, Name: 'v' }); }
			}
		});
		t.op('added in construct: root.V, Document.Map.W paths',() => [root.V._path_, root.Document.Map.W._path_]);
		t.op('after load: root.$setProperty("X", {Id: 1})', () => root.$setProperty('X', { Id: 1, Name: 'x' }));
		t.op('after load: Document.Map.$setProperty("Y", {Id: 2})', () => root.Document.Map.$setProperty('Y', { Id: 2, Name: 'y' }));
	},

	function modelInfo(t) {
		const root = t.model('model info: $ModelInfo, $permissions, read-only', {
			decl: {
				TRoot: { props: { Agents: 'TAgentArray', Document: 'TDocument' } },
				TAgent: { array: true, props: { Id: Number, Name: String }, $id: 'Id' },
				TDocument: { props: { Id: Number, Name: String, Perm: Number, Period: 'TPeriod' }, $id: 'Id', $permissions: 'Perm' }
			},
			data: {
				Agents: [{ Id: 1, Name: 'One' }],
				Document: { Id: 0, Perm: 0, Period: { From: '2026-01-01T00:00:00', To: '2026-01-31T00:00:00' } },
				$ModelInfo: {
					Agents: {
						PageSize: 20, Offset: 0, SortOrder: 'Name', SortDir: 'asc', Permissions: 7,
						Filter: { Fragment: 'x', Period: { From: '2026-01-01T00:00:00', To: '2026-03-31T00:00:00' } }
					}
				}
			},
			info: { ReadOnly: true, StateReadOnly: false, Copy: false }
		});
		t.op('Agents.$ModelInfo', () => root.Agents.$ModelInfo);
		t.op('Agents.$permissions, Document.$permissions', () => [root.Agents.$permissions, root.Document.$permissions]);
		t.op('$readOnly, $stateReadOnly, $isCopy, __modelInfo', () => [root.$readOnly, root.$stateReadOnly, root.$isCopy, root.__modelInfo]);
		t.op('Document.Name = "x" (read-only)', () => { root.Document.Name = 'x'; return root.Document.Name; });
		t.op('Agents.$append({Id: 2}) (read-only)', () => root.Agents.$append({ Id: 2 }));
		// B7: changed from inside, refused; loaded ($merge → $copy), allowed
		t.op('Agents.$remove(Agents[0]) (read-only)', () => { root.Agents.$remove(root.Agents[0]); return root.Agents.$ids; });
		t.op('Agents.$empty() (read-only)', () => { root.Agents.$empty(); return root.Agents.length; });
		t.op('Document.$set({Name: "set"}) (read-only)', () => { root.Document.$set({ Name: 'set' }); return root.Document.Name; });
		t.op('$merge({Agents: [{Id: 3}]}) (read-only: the load door)', () => {
			root.$merge({ Agents: [{ Id: 3, Name: 'Three' }] }, false, true);
			return root.Agents.$ids;
		});
		t.op('Document.Period', () => root.Document.Period);
		t.op('_findRootModelInfo()', () => root._findRootModelInfo());
		t.show('data', root);

		const copy = t.model('model info: copy', {
			decl: {
				TRoot: { props: { Document: 'TDocument' } },
				TDocument: { props: { Id: Number, Name: String }, $id: 'Id' }
			},
			data: { Document: { Id: 3, Name: 'Copied' } },
			info: { Copy: true }
		});
		t.op('$isCopy, $dirty', () => [copy.$isCopy, copy.$dirty]);
	},

	function options(t) {
		const root = t.model('options: skipDirty, bindOnce, persistSelect, query', {
			decl: {
				TRoot: { props: { Document: 'TDocument', Query: 'TQuery', Rows: 'TRowArray' } },
				TDocument: { props: { Id: Number, Name: String, Memo: String }, $id: 'Id' },
				TQuery: { props: { Text: String } },
				TRow: { array: true, props: { Id: Number }, $id: 'Id' }
			},
			data: { Document: { Id: 1, Name: 'n', Memo: 'm' }, Rows: [{ Id: 1 }, { Id: 2 }] },
			template: {
				options: {
					skipDirty: ['Document.Memo'],
					bindOnce: ['Memo'],
					persistSelect: ['Rows'],
					globalSaveEvent: 'g.saved'
				}
			}
		});
		const doc = root.Document;
		t.op('Memo = "skip"', () => { doc.Memo = 'skip'; });
		t.op('Query.Text = "q"', () => { root.Query.Text = 'q'; });
		t.op('Name = "dirty"', () => { doc.Name = 'dirty'; });
		t.op('Document.$merge({Id: 1, Name: "m2", Memo: "m2"}, true)', () => { doc.$merge({ Id: 1, Name: 'm2', Memo: 'm2' }, true); return [doc.Name, doc.Memo]; });
		t.op('Rows[1].$select(); _saveSelections()', () => { root.Rows[1].$select(); return root._saveSelections(); });
		t.op('Rows[0].$select(); _restoreSelections({Rows: 2})', () => {
			root.Rows[0].$select();
			root._restoreSelections({ Rows: 2 });
			return root.Rows.$selected;
		});
		t.op('_globalSaveEvent_()', () => root._globalSaveEvent_());
		t.op('_fireGlobalPeriodChanged_, _fireGlobalAppEvent_, _fireSignalAppEvent_, _fireUnload_', () => {
			root._fireGlobalPeriodChanged_('p');
			root._fireGlobalAppEvent_({ event: 'App.ev', data: 1 });
			root._fireSignalAppEvent_({ event: 'sig', data: 2 });
			root._fireUnload_();
		});
	},

	function utils(t) {
		t.section('utils: convertToString, DateUrl, isPromise');
		const u = t.utils;
		t.op('convertToString: null, "", 42, "s", {Name: "n"}', () =>
			[null, '', 42, 's', { Name: 'n' }].map(v => u.convertToString(v)));
		t.op('format DateUrl: 00:00:00, 00:05:00, 00:05:30, 10:00:00', () =>
			[[0, 0, 0], [0, 5, 0], [0, 5, 30], [10, 0, 0]].map(([h, m, s]) => u.format(new Date(2026, 0, 15, h, m, s), 'DateUrl')));
		t.op('isPromise: null, undefined, 0, {then, catch}, a Promise', () =>
			[null, undefined, 0, { then() { }, catch() { } }, Promise.resolve()].map(v => u.isPromise(v)));
	}
];

module.exports = { SCENARIOS };
