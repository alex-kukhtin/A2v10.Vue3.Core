// Page scenarios: a page mounted over a model as the server declares it, driven the way templates, the
// renderer's markup and the shell drive a page controller; the server and the shell answer per section.
// No expectations here: the trace of the Net48 base.js is the expectation.

'use strict';

// A document with rows, its main object named ($main), as most edit pages have it.
const DOC = {
	TRoot: { props: { Document: 'TDocument' }, $main: 'Document' },
	TDocument: {
		props: { Id: Number, Name: { type: String, len: 50 }, Memo: String, Agent: 'TAgent', Rows: 'TRowArray' },
		$id: 'Id', $name: 'Name'
	},
	TAgent: { props: { Id: Number, Name: String }, $id: 'Id', $name: 'Name' },
	TRow: { array: true, props: { Id: Number, Qty: Number }, $id: 'Id' }
};

function doc(id, name = 'Doc') {
	return { Document: { Id: id, Name: name, Memo: '', Agent: { Id: 0, Name: '' }, Rows: [{ Id: 1, Qty: 1 }, { Id: 2, Qty: 2 }] } };
}

// An index page: a paged list with its $ModelInfo.
const LIST = {
	TRoot: { props: { Documents: 'TDocumentArray' } },
	TDocument: { array: true, props: { Id: Number, Name: String }, $id: 'Id', $name: 'Name' }
};

function list() {
	return {
		Documents: [{ Id: 1, Name: 'One' }, { Id: 2, Name: 'Two' }],
		$ModelInfo: { Documents: { PageSize: 20, Offset: 0, SortOrder: 'Name', SortDir: 'asc' } }
	};
}

// The answer of a route set per operation: `reply.next = …` before the operation.
function replies() {
	const r = { next: undefined };
	r.route = () => r.next;
	return r;
}

const PAGES = [

	async function saveNew(t) {
		t.section('$save: a new document', {
			server: {
				'POST /_data/save': body => ({ json: { Document: { ...body.data.Document, Id: 25 } } })
			}
		});
		const vm = await t.page('A', { decl: DOC, url: '/_page/document/edit/new', data: doc(0, '') });
		await t.op('Document.Name = "Doc"', () => { vm.Document.Name = 'Doc'; });
		await t.op('$save({ toast: "Saved" })', () => vm.$save({ toast: 'Saved' }));
		await t.op('$baseUrl, Document.$id, $isDirty', () => [vm.$baseUrl, vm.Document.$id, vm.$isDirty]);
		await t.op('$save() not dirty', () => vm.$save());
		t.show('data', vm.$data);
	},

	async function saveCopy(t) {
		t.section('$save: a copy', {
			server: {
				'POST /_data/save': body => ({ json: { Document: { ...body.data.Document, Id: 31 } } })
			}
		});
		const vm = await t.page('A', { decl: DOC, url: '/_page/document/edit/7', data: doc(7), info: { Copy: true } });
		await t.op('$isCopy, $isDirty', () => [vm.$data.$isCopy, vm.$isDirty]);
		await t.op('$save()', () => vm.$save());
		await t.op('$baseUrl', () => vm.$baseUrl);
	},

	async function saveRefused(t) {
		const reply = replies();
		t.section('$save: read-only, invalid, refused', { server: { 'POST /_data/save': reply.route } });
		const vm = await t.page('A', {
			decl: DOC, url: '/_page/document/edit/5', data: doc(5),
			template: { validators: { 'Document.Name': 'Name is required' } }
		});
		await t.op('Document.Name = ""', () => { vm.Document.Name = ''; });
		await t.op('$save({ options: { validRequired: true } })', () => vm.$save({ options: { validRequired: true } }));
		await t.op('Document.Name = "Doc"', () => { vm.Document.Name = 'Doc'; });
		reply.next = { status: 255, text: 'UI:Cannot save\\nthe document' };
		await t.op('$save() → 255 UI:', () => vm.$save());
		reply.next = { status: 255, text: 'Deadlock' };
		await t.op('$save() → 255 not UI:', () => vm.$save());
		reply.next = { status: 500 };
		await t.op('$save() → 500', () => vm.$save());
		reply.next = { fail: 'fetch failed' };
		await t.op('$save() → network failure', () => vm.$save());
		reply.next = { json: 5 };
		await t.op('$save() → not an object', () => vm.$save());
	},

	async function saveReadOnly(t) {
		t.section('$save, $savePart, $remove: read-only model', {});
		const vm = await t.page('A', { decl: DOC, url: '/_page/document/edit/6', data: doc(6), info: { ReadOnly: true } });
		await t.op('Document.Name = "Changed"', () => { vm.Document.Name = 'Changed'; });
		await t.op('$readOnly, $isDirty', () => [vm.$data.$readOnly, vm.$isDirty]);
		await t.op('$save()', () => vm.$save());
		await t.op('$savePart(Document, "/document/edit")', () => vm.$savePart(vm.Document, '/document/edit'));
		await t.op('$remove(Rows[0])', () => vm.$remove(vm.Document.Rows[0]));
		await t.op('$removeSelected(Rows)', () => vm.$removeSelected(vm.Document.Rows));
		await t.op('Rows.length', () => vm.Document.Rows.length);
	},

	async function savePartEnsure(t) {
		t.section('$savePart, $ensureSaved', {
			server: {
				// the root, or (savePart) the part itself
				'POST /_data/save': body => body.data.Document
					? { json: { Document: { ...body.data.Document, Id: body.data.Document.Id || 40 } } }
					: { json: { ...body.data, Memo: 'part saved' } }
			}
		});
		const vm = await t.page('A', { decl: DOC, url: '/_page/document/edit/new', data: doc(0) });
		await t.op('$ensureSaved() twice at once', () => Promise.all([vm.$ensureSaved(), vm.$ensureSaved()]));
		await t.op('$ensureSaved() saved', () => vm.$ensureSaved());
		await t.op('$savePart(Document, "/document/part", true)', () => vm.$savePart(vm.Document, '/document/part', true));
	},

	async function reload(t) {
		t.section('$reload: an element page', {
			server: { 'POST /_data/reload': { json: doc(5, 'Reloaded') } }
		});
		const vm = await t.page('A', { decl: DOC, url: '/_page/document/edit/5?Tab=2', data: doc(5) });
		await t.op('$baseUrl, $baseQuery', () => [vm.$baseUrl, vm.$baseQuery]);
		await t.op('Rows[1].$select()', () => { vm.Document.Rows[1].$select(); });
		await t.op('$reload()', () => vm.$reload());
		await t.op('Document.Name, Rows.$selected', () => [vm.Document.Name, vm.Document.Rows.$selected]);
		await t.op('$requery()', () => vm.$requery());
		await t.op('$requeryNew(9)', () => vm.$requeryNew(9));
		await t.op('$baseUrl', () => vm.$baseUrl);
	},

	async function reloadList(t) {
		t.section('$reload: an index page, its $ModelInfo, queryChange, $searchChange', {
			server: {
				'POST /_data/reload': {
					json: {
						Documents: [{ Id: 3, Name: 'Three' }], 'Documents.$RowCount': 1,
						$ModelInfo: { Documents: { PageSize: 20, Offset: 0, SortOrder: 'Name', SortDir: 'asc', Filter: { Text: 'abc' } } }
					}
				}
			}
		});
		const vm = await t.page('A', { decl: LIST, url: '/_page/document/index/0', data: list(), isIndex: true });
		await t.op('$reload(Documents)', () => vm.$reload(vm.Documents));
		await t.op('bus queryChange({ Text: "abc", Order: undefined })', () => t.emit('queryChange', { Text: 'abc', Order: undefined }));
		await t.op('bus queryChange of another page', () => t.emit('queryChange', { __baseUrl__: '/_page/agent/index/0', Text: 'x' }));
		await t.op('Documents.$ModelInfo', () => vm.Documents.$ModelInfo);
		await t.op('$searchChange()', () => vm.$searchChange());
		await t.op('$setFilter(Documents, "Text", "q"); $clearFilter(Documents)', () => {
			vm.$setFilter(vm.Documents, 'Text', 'q');
			vm.$clearFilter(vm.Documents);
		});
	},

	async function queryWatch(t) {
		t.section('$reload: the Query element, watched', {
			server: { 'POST /_data/reload': { json: { Query: { Text: 'abc' }, Documents: [] } } }
		});
		const vm = await t.page('A', {
			decl: {
				TRoot: { props: { Query: 'TQuery', Documents: 'TDocumentArray' } },
				TQuery: { props: { Text: String } },
				TDocument: { array: true, props: { Id: Number, Name: String }, $id: 'Id' }
			},
			url: '/_page/document/index/0', isIndex: true,
			data: { Query: { Text: '' }, Documents: [{ Id: 1, Name: 'One' }] }
		});
		await t.op('Query.Text = "abc"', () => { vm.Query.Text = 'abc'; });
		await t.op('$isDirty', () => vm.$isDirty);
	},

	async function dialogs(t) {
		t.section('$dialog: the commands', {
			server: {
				'POST /_data/reload': { json: doc(5) },
				'POST /_data/save': body => ({ json: body.data })
			},
			shell: {
				modal: url => ({
					'/agent/browse': { Id: 7, Name: 'Agent 7' },
					'/agent/edit': { Id: 7, Name: 'Agent 7 edited' },
					'/row/new': { Id: 5, Qty: 5 },
					'/row/edit': { Id: 1, Qty: 10 },
					'/row/show': 'reload',
					'/row/copy': { Id: 6, Qty: 1 },
					'/document/show': { Id: 5 },
					'/document/cancel': false
				})[url.split('?')[0]]
			}
		});
		const vm = await t.page('A', { decl: DOC, url: '/_page/document/edit/5', data: doc(5) });
		const d = vm.Document;
		await t.op('$dialog("show", "/document/show", Document)', () => vm.$dialog('show', '/document/show', d));
		await t.op('$showDialog("/document/show?Mode=1", Document, { Extra: 2 })', () => vm.$showDialog('/document/show?Mode=1', d, { Extra: 2 }));
		await t.op('$dialog("show", …, query as a function)', () => vm.$dialog('show', '/document/show', d, () => ({ Q: 1 })));
		await t.op('$dialog("browse", "/agent/browse", Document.Agent)', () => vm.$dialog('browse', '/agent/browse', d.Agent));
		await t.op('$dialog("browse", plain object)', () => vm.$dialog('browse', '/agent/browse', { Id: 0, Name: '', Memo: 'x' }));
		await t.op('$dialog("edit", "/agent/edit", Document.Agent)', () => vm.$dialog('edit', '/agent/edit', d.Agent));
		await t.op('$dialog("append", "/row/new", Rows)', () => vm.$dialog('append', '/row/new', d.Rows));
		await t.op('$dialog("new", "/row/new", Rows), nothing selected', () => vm.$dialog('new', '/row/new', d.Rows));
		await t.op('Rows[0].$select()', () => { d.Rows[0].$select(); });
		await t.op('$dialog("edit-selected", "/row/edit", Rows)', () => vm.$dialog('edit-selected', '/row/edit', d.Rows));
		await t.op('$dialog("show-selected", "/row/show", Rows) → "reload"', () => vm.$dialog('show-selected', '/row/show', d.Rows));
		await t.op('$dialog("copy", "/row/copy", Rows[0])', () => vm.$dialog('copy', '/row/copy', vm.Document.Rows[0]));
		await t.op('$dialog("append", "/row/new", Rows, null, { reloadAfter: true })',
			() => vm.$dialog('append', '/row/new', vm.Document.Rows, null, { reloadAfter: true }));
		await t.op('$dialog("show", "/document/cancel", Document) → false', () => vm.$dialog('show', '/document/cancel', vm.Document));
		await t.op('$dialog("append", …, an object)', () => vm.$dialog('append', '/row/new', vm.Document));
		await t.op('$dialog("edit", …, an array)', () => vm.$dialog('edit', '/agent/edit', vm.Document.Rows));
		await t.op('$dialog("edit", …, { checkPermission: "CanEdit" })',
			() => vm.$dialog('edit', '/agent/edit', vm.Document.Agent, null, { checkPermission: 'CanEdit' }));
		await t.op('$dialog("show", …, { validRequired: true })', () => vm.$dialog('show', '/document/show', vm.Document, null, { validRequired: true }));
		await t.op('Document.Memo = "m"', () => { vm.Document.Memo = 'm'; });
		await t.op('$dialog("show", …, { saveRequired: true })', () => vm.$dialog('show', '/document/show', vm.Document, null, { saveRequired: true }));
		await t.op('$dialog("show", …, { checkReadOnly: true }), not read-only',
			() => vm.$dialog('show', '/document/show', vm.Document, null, { checkReadOnly: true }));
		t.show('data', vm.$data);
	},

	async function dialogNew(t) {
		t.section('$dialog: saveRequired, a new document', {
			server: { 'POST /_data/save': body => ({ json: { Document: { ...body.data.Document, Id: 8 } } }) },
			shell: { modal: () => ({ Id: 1 }) }
		});
		const vm = await t.page('A', { decl: DOC, url: '/_page/document/edit/new', data: doc(0) });
		await t.op('$isDirty, $mainObject.$isNew', () => [vm.$isDirty, vm.$data.$mainObject.$isNew]);
		await t.op('$dialog("show", "/document/show", Document, null, { saveRequired: true }), new and clean',
			() => vm.$dialog('show', '/document/show', vm.Document, null, { saveRequired: true }));
	},

	async function messages(t) {
		t.section('$confirm, $alert, $msg, $toast, $remove', {
			shell: { confirm: data => data.message !== 'No?' }
		});
		const vm = await t.page('A', { decl: DOC, url: '/_page/document/edit/5', data: doc(5) });
		await t.op('$confirm("Sure?")', () => vm.$confirm('Sure?'));
		await t.op('$confirm({ msg: "No?", title: "T" }) → Cancel', () => vm.$confirm({ msg: 'No?', title: 'T' }));
		await t.op('$alert("Hi")', () => vm.$alert('Hi'));
		await t.op('$alert({ msg: "Hi", title: "T", list: ["a"] })', () => vm.$alert({ msg: 'Hi', title: 'T', list: ['a'] }));
		await t.op('$msg("Info")', () => vm.$msg('Info'));
		await t.op('$alertUi("UI:Text\\\\nmore")', () => vm.$alertUi('UI:Text\\nmore'));
		await t.op('$alertUi("raw")', () => vm.$alertUi('raw'));
		await t.op('$alertUi(new Error("boom"))', () => vm.$alertUi(new Error('boom')));
		await t.op('$alertUi({ x: 1 })', () => vm.$alertUi({ x: 1 }));
		await t.op('$toast("Done"); $toast({ text: "T", style: "info" }); $toast(null)', () => {
			vm.$toast('Done');
			vm.$toast({ text: 'T', style: 'info' });
			vm.$toast(null);
		});
		await t.op('$removeSelected(Rows), nothing selected', () => vm.$removeSelected(vm.Document.Rows));
		await t.op('$remove(Rows[0], "No?") → Cancel', () => vm.$remove(vm.Document.Rows[0], 'No?'));
		await t.op('$remove(Rows[0], "Delete?")', () => vm.$remove(vm.Document.Rows[0], 'Delete?'));
		await t.op('$removeSelected(Rows): the one $remove selected', () => vm.$removeSelected(vm.Document.Rows));
		await t.op('$removeSelected(Document)', () => vm.$removeSelected(vm.Document));
		await t.op('Rows.length', () => vm.Document.Rows.length);
	},

	async function saveModified(t) {
		let button = 'save';
		t.section('$saveModified, $close, $saveAndClose: a page', {
			server: { 'POST /_data/save': body => ({ json: body.data }) },
			shell: { confirm: data => data.buttons ? button : true }
		});
		const vm = await t.page('A', { decl: DOC, url: '/_page/document/edit/5', data: doc(5) });
		await t.op('$saveModified(), not dirty', () => vm.$saveModified());
		await t.op('Document.Name = "1"', () => { vm.Document.Name = '1'; });
		await t.op('$saveModified() → Save', () => vm.$saveModified());
		await t.op('Document.Name = "2"', () => { vm.Document.Name = '2'; });
		button = 'close';
		await t.op('$close() → Don\'t save', () => vm.$close());
		await t.op('Document.Name = "3"', () => { vm.Document.Name = '3'; });
		button = false;
		await t.op('$saveModified("Msg", "Title") → Cancel', () => vm.$saveModified('Msg', 'Title'));
		await t.op('$saveAndClose()', () => vm.$saveAndClose());
	},

	async function saveModifiedDialog(t) {
		let button = 'save';
		t.section('$saveModified, $modal*: a dialog', {
			server: { 'POST /_data/save': body => ({ json: body.data }) },
			shell: { confirm: data => data.buttons ? button : true }
		});
		const vm = await t.page('D', {
			decl: DOC, url: '/_dialog/document/edit/5', data: doc(5), inDialog: true,
			template: { validators: { 'Document.Memo': 'Memo is required' } }
		});
		await t.op('Document.Name = "1"', () => { vm.Document.Name = '1'; });
		await t.op('$saveModified(null, null, true) → Save, invalid', () => vm.$saveModified(null, null, true));
		await t.op('$saveModified() → Save', () => vm.$saveModified());
		await t.op('Document.Name = "2"', () => { vm.Document.Name = '2'; });
		button = 'close';
		await t.op('$saveModified() → Don\'t save', () => vm.$saveModified());
		await t.op('$modalClose({ Id: 1 })', () => vm.$modalClose({ Id: 1 }));
		await t.op('Document.Name = "3"', () => { vm.Document.Name = '3'; });
		await t.op('$modalSaveAndClose(true, { validRequired: true }), invalid', () => vm.$modalSaveAndClose(true, { validRequired: true }));
		await t.op('Document.Memo = "m"', () => { vm.Document.Memo = 'm'; });
		await t.op('$modalSaveAndClose(true)', () => vm.$modalSaveAndClose(true));
		await t.op('$modalSaveAndClose("x"), not dirty', () => vm.$modalSaveAndClose('x'));
		await t.op('$modalSelect(Rows), nothing selected', () => vm.$modalSelect(vm.Document.Rows));
		await t.op('Rows[1].$select(); $modalSelect(Rows)', () => { vm.Document.Rows[1].$select(); vm.$modalSelect(vm.Document.Rows); });
		await t.op('$modalSelect(Document)', () => vm.$modalSelect(vm.Document));
		await t.op('$modalSelectChecked(Rows)', () => vm.$modalSelectChecked(vm.Document.Rows));
		await t.op('$setCurrentUrl("/document/edit/6")', () => vm.$setCurrentUrl('/document/edit/6'));
		await t.op('$baseUrl', () => vm.$baseUrl);
		await t.op('$requery()', () => vm.$requery());
	},

	async function lazy(t) {
		t.section('$loadLazy, lazy $reload, $dbRemove', {
			server: {
				'POST /_data/loadlazy': { json: { Rows: [{ Id: 10, Qty: 1 }, { Id: 11, Qty: 2 }], 'Rows.$RowCount': 2 } },
				'POST /_data/dbRemove': { json: {} }
			}
		});
		const decl = { ...DOC, TDocument: { ...DOC.TDocument, $lazy: ['Rows'] } };
		const vm = await t.page('A', {
			decl, url: '/_page/document/edit/5', data: { Document: { Id: 5, Name: 'Doc', Rows: [] } },
			on: { 'Model.lazy.init': ev => { ev.modelInfo = { PageSize: 10 }; } }
		});
		await t.op('$loadLazy(Document, "Rows")', () => vm.$loadLazy(vm.Document, 'Rows'));
		await t.op('$loadLazy(Document, "Rows") loaded', () => vm.$loadLazy(vm.Document, 'Rows'));
		await t.op('Rows.$RowCount, $loaded', () => [vm.Document.Rows.$RowCount, vm.Document.Rows.$loaded]);
		await t.op('$reload(Rows)', () => vm.$reload(vm.Document.Rows));
		await t.op('$dbRemoveSelected(Rows), nothing selected', () => vm.$dbRemoveSelected(vm.Document.Rows));
		await t.op('$dbRemove(Rows[0], null, { checkPermission: "CanDelete" })',
			() => vm.$dbRemove(vm.Document.Rows[0], null, { checkPermission: 'CanDelete' }));
		await t.op('$dbRemove(null)', () => vm.$dbRemove(null));
		await t.op('$dbRemove(Rows[0], "Delete?")', () => vm.$dbRemove(vm.Document.Rows[0], 'Delete?'));
		await t.op('$dbRemoveSelected(Rows): the one $remove selected', () => vm.$dbRemoveSelected(vm.Document.Rows));
		t.show('data', vm.$data);
	},

	async function dbRemove(t) {
		t.section('$dbRemove: not lazy, refused', {
			server: { 'POST /_data/dbRemove': { status: 255, text: 'UI:In use' } }
		});
		const vm = await t.page('A', { decl: LIST, url: '/_page/document/index/0', data: list(), isIndex: true });
		await t.op('Documents[1].$select(); $dbRemoveSelected(Documents)', () => { vm.Documents[1].$select(); vm.$dbRemoveSelected(vm.Documents); });
		await t.op('Documents.length', () => vm.Documents.length);
	},

	async function expand(t) {
		t.section('$expand: a tree', {
			server: { 'POST /_data/expand': { json: { Items: [{ Id: 11, Name: 'Child', HasChildren: false, Items: [] }] } } }
		});
		const vm = await t.page('A', {
			decl: {
				TRoot: { props: { Folders: 'TFolderArray' } },
				TFolder: {
					array: true, props: { Id: Number, Name: String, HasChildren: Boolean, Items: 'TFolderArray' },
					$id: 'Id', $name: 'Name', $items: 'Items', $hasChildren: 'HasChildren'
				}
			},
			url: '/_page/folder/index/0', isIndex: true,
			data: { Folders: [{ Id: 1, Name: 'Root', HasChildren: true, Items: [] }, { Id: 2, Name: 'Empty', HasChildren: false, Items: [] }] }
		});
		await t.op('$expand(Folders[0], "Items", true)', () => vm.$expand(vm.Folders[0], 'Items', true));
		await t.op('$expand(Folders[0], "Items", true) again', () => vm.$expand(vm.Folders[0], 'Items', true));
		await t.op('$expand(Folders[1], "Items")', () => vm.$expand(vm.Folders[1], 'Items'));
		t.show('data', vm.$data);
	},

	async function invoke(t) {
		const reply = replies();
		t.section('$invoke, $invokeServer, $asyncValid', {
			server: { 'POST /_data/invoke': reply.route, 'POST /_data/reload': { json: doc(5) } }
		});
		const vm = await t.page('A', { decl: DOC, url: '/_page/document/edit/5', data: doc(5) });
		reply.next = { json: { Result: 1 } };
		await t.op('$invoke("calc", { X: 1 })', () => vm.$invoke('calc', { X: 1 }));
		await t.op('$invoke("calc", { X: 1 }, "/agent/edit")', () => vm.$invoke('calc', { X: 1 }, '/agent/edit'));
		reply.next = { text: 'plain' };
		await t.op('$invoke("calc") → text', () => vm.$invoke('calc'));
		reply.next = { json: 5 };
		await t.op('$invoke("calc") → a number', () => vm.$invoke('calc'));
		reply.next = { status: 255, text: 'UI:Refused' };
		await t.op('$invoke("calc") → 255', () => vm.$invoke('calc'));
		await t.op('$invoke("calc", null, null, { catchError: true }) → 255', () => vm.$invoke('calc', null, null, { catchError: true }));
		reply.next = { json: {} };
		await t.op('$invoke("calc", null, null, { hideIndicator: true })', () => vm.$invoke('calc', null, null, { hideIndicator: true }));
		await t.op('$invokeServer("/document/approve", Document, "Sure?", { reloadAfter: true })',
			() => vm.$invokeServer('/document/approve', vm.Document, 'Sure?', { reloadAfter: true }));
		await t.op('$invokeServer("/document/approve", Document, null, { requeryAfter: true })',
			() => vm.$invokeServer('/document/approve', vm.Document, null, { requeryAfter: true }));
		reply.next = { json: { Result: { Value: true } } };
		await t.op('$asyncValid("check", { X: 1 })', () => vm.$asyncValid('check', { X: 1 }));
		await t.op('$asyncValid("check", { X: 1 }) again', () => vm.$asyncValid('check', { X: 1 }));
		await t.op('$asyncValid("check", { X: 2 })', () => vm.$asyncValid('check', { X: 2 }));
		await t.op('bus beginRequest from another page; $isLoading; $invokeServer', () => {
			t.emit('beginRequest', '/other');
			return [vm.$isLoading, vm.$canSave, vm.$invokeServer('/document/approve', vm.Document)];
		});
		await t.op('bus endRequest; $isLoading', () => { t.emit('endRequest', '/other'); return vm.$isLoading; });
		await t.op('$longOperation(async)', () => vm.$longOperation(async () => { t.emit('toast', 'inside'); }));
	},

	async function exec(t) {
		t.section('$exec, $canExecute, $execSelected, $delegate, $handleClick', {
			shell: { confirm: data => data.message !== 'No?' }
		});
		const vm = await t.page('A', {
			decl: DOC, url: '/_page/document/edit/5', data: doc(5),
			template: {
				commands: {
					rename(arg) { arg.Name = 'Renamed'; return 'done'; },
					guarded: { exec(arg) { arg.Qty = 100; }, canExec(arg) { return arg.Qty > 1; } },
					confirmed: { exec(arg) { arg.Memo = 'confirmed'; }, confirm: 'Sure?' },
					readOnly: { exec(arg) { arg.Memo = 'ro'; }, checkReadOnly: true }
				},
				delegates: {
					filter(item) { return item.Qty > 1; },
					click(target, name) { this.Document.Memo = `clicked ${name}`; }
				}
			}
		});
		await t.op('$exec("rename", Document)', () => vm.$exec('rename', vm.Document));
		await t.op('$exec("missing")', () => vm.$exec('missing'));
		await t.op('$exec("rename", Document, "No?")', () => vm.$exec('rename', vm.Document, 'No?'));
		await t.op('$exec("confirmed", Document)', () => vm.$exec('confirmed', vm.Document));
		await t.op('$canExecute("guarded", Rows[0]), Rows[1]', () => [vm.$canExecute('guarded', vm.Document.Rows[0]), vm.$canExecute('guarded', vm.Document.Rows[1])]);
		await t.op('$canExecute("missing")', () => vm.$canExecute('missing'));
		await t.op('$canExecSel("guarded", Rows), nothing selected', () => vm.$canExecSel('guarded', vm.Document.Rows));
		await t.op('Rows[1].$select(); $execSelected("guarded", Rows)', () => { vm.Document.Rows[1].$select(); vm.$execSelected('guarded', vm.Document.Rows); });
		await t.op('$execSelected("guarded", Rows, "Sure?")', () => vm.$execSelected('guarded', vm.Document.Rows, 'Sure?'));
		await t.op('$execSelected("guarded", Document)', () => vm.$execSelected('guarded', vm.Document));
		await t.op('$exec("rename", Document, null, { checkPermission: "CanEdit" })',
			() => vm.$exec('rename', vm.Document, null, { checkPermission: 'CanEdit' }));
		await t.op('$isPermissionsDisabled({ checkPermission: "CanEdit" }, { $permissions: { CanEdit: true } })',
			() => vm.$isPermissionsDisabled({ checkPermission: 'CanEdit' }, { $permissions: { CanEdit: true } }));
		await t.op('$delegate("filter")(Rows[0])', () => vm.$delegate('filter')(vm.Document.Rows[0]));
		await t.op('$delegate("missing")', () => vm.$delegate('missing'));
		await t.op('$handleClick("click", event)', () => {
			const ev = { target: 'target', preventDefault() { }, stopPropagation() { } };
			vm.$handleClick('click', ev);
			return vm.Document.Memo;
		});
		await t.op('$move("down", Rows[0]); $canMove("up", Rows[0])', () => { vm.$move('down', vm.Document.Rows[0]); return vm.$canMove('up', vm.Document.Rows[0]); });
		await t.op('$moveSelected("up", Rows); $canMoveSelected("up", Rows)', () => { vm.$moveSelected('up', vm.Document.Rows); return vm.$canMoveSelected('up', vm.Document.Rows); });
		await t.op('$hasSelected(Rows), $hasChecked(Rows)', () => [vm.$hasSelected(vm.Document.Rows), vm.$hasChecked(vm.Document.Rows)]);
		t.show('data', vm.$data);
	},

	async function execReadOnly(t) {
		t.section('$exec, $canExecute, $navigate, $dialog: read-only model', {});
		const vm = await t.page('A', {
			decl: DOC, url: '/_page/document/edit/5', data: doc(5), info: { ReadOnly: true },
			template: { commands: { readOnly: { exec(arg) { arg.Memo = 'ro'; }, checkReadOnly: true }, plain(arg) { arg.Memo = 'plain'; } } }
		});
		await t.op('$exec("readOnly", Document)', () => vm.$exec('readOnly', vm.Document));
		await t.op('$exec("plain", Document, null, { checkReadOnly: true })', () => vm.$exec('plain', vm.Document, null, { checkReadOnly: true }));
		await t.op('$exec("plain", Document)', () => vm.$exec('plain', vm.Document));
		await t.op('$canExecute("readOnly", Document), $canExecute("plain", Document, { checkReadOnly: true })',
			() => [vm.$canExecute('readOnly', vm.Document), vm.$canExecute('plain', vm.Document, { checkReadOnly: true })]);
		await t.op('$navigate("/document/edit", 6, false, null, { checkReadOnly: true })',
			() => vm.$navigate('/document/edit', 6, false, null, { checkReadOnly: true }));
		await t.op('$dialog("show", "/x", Document, null, { checkReadOnly: true })',
			() => vm.$dialog('show', '/x', vm.Document, null, { checkReadOnly: true }));
		await t.op('Document.Memo', () => vm.Document.Memo);
	},

	async function navigate(t) {
		t.section('$navigate, files, reports, the side pane', {
			server: { 'POST /_data/save': body => ({ json: body.data }) },
			shell: { activeTabUrl: '/document/edit/5' }
		});
		const vm = await t.page('A', { decl: DOC, url: '/_page/document/edit/5', data: doc(5) });
		const d = vm.Document;
		await t.op('$href("/document/edit", Document), $href("/document/edit/new"), $href("/document/edit", { Id: 3, Mode: "x" })',
			() => [vm.$href('/document/edit', d), vm.$href('/document/edit/new'), vm.$href('/document/edit', { Id: 3, Mode: 'x' })]);
		await t.op('$mailto("a@b.c", "Hi there"), $callphone("123")', () => [vm.$mailto('a@b.c', 'Hi there'), vm.$callphone('123')]);
		await t.op('$navigate("/document/edit", Document)', () => vm.$navigate('/document/edit', d));
		await t.op('$navigate("/document/edit", 6, true, Rows)', () => vm.$navigate('/document/edit', 6, true, d.Rows));
		await t.op('Document.Memo = "m"; $navigate(…, { saveRequired: true })', () => {
			d.Memo = 'm';
			vm.$navigate('/document/edit', 6, false, null, { saveRequired: true });
		});
		await t.op('$navigateSimple("/document/edit/7"), $navigateSimple("/x", true)', () => { vm.$navigateSimple('/document/edit/7'); vm.$navigateSimple('/x', true); });
		await t.op('$navigateExternal("https://x"), $navigateExternal("https://y", true)', () => { vm.$navigateExternal('https://x'); vm.$navigateExternal('https://y', true); });
		await t.op('$openSelected("/row/edit", Rows), nothing selected', () => vm.$openSelected('/row/edit', d.Rows));
		await t.op('Rows[0].$select(); $openSelected("/row/edit", Rows, true)', () => {
			d.Rows[0].$select();
			vm.$openSelected('/row/edit', d.Rows, true);
		});
		await t.op('$openSelectedFrame("/row/frame", Rows)', () => vm.$openSelectedFrame('/row/frame', d.Rows));
		await t.op('$download("/doc.pdf")', () => vm.$download('/doc.pdf'));
		await t.op('$file("/document/print", 5), { action: "download" }, { action: "print" }', () => {
			vm.$file('/document/print', 5);
			vm.$file('/document/print', d, { action: 'download' }, { Lang: 'uk' });
			vm.$file('/document/print', 5, { action: 'print' });
		});
		await t.op('$attachment("/document/att", 3), { export: true }, { newWindow: true }, { print: true }', () => {
			vm.$attachment('/document/att', 3);
			vm.$attachment('/document/att', 3, { export: true });
			vm.$attachment('/document/att', 3, { newWindow: true });
			vm.$attachment('/document/att', 3, { print: true });
		});
		await t.op('$report("rep", Document)', () => vm.$report('rep', d));
		await t.op('$report("rep", Document, { export: true, format: "pdf" }), { print: true }, { attach: true }, { viewer: "v" }', () => {
			vm.$report('rep', d, { export: true, format: 'pdf' });
			vm.$report('rep', d, { print: true });
			vm.$report('rep', d, { attach: true });
			vm.$report('rep', d, { viewer: 'v' }, '/document/other/edit/5', { X: 1 });
		});
		await t.op('$report("rep", Document, { validRequired: true })', () => vm.$report('rep', d, { validRequired: true }));
		await t.op('$export(Document, "/document/exp", { F: 1 }), $export()', () => { vm.$export(d, '/document/exp', { F: 1 }); vm.$export(); });
		await t.op('$showSidePane("/agent/pane", 7, { X: 1 }); $hideSidePane()', () => { vm.$showSidePane('/agent/pane', 7, { X: 1 }); vm.$hideSidePane(); });
		await t.op('$shareUrl()', () => vm.$shareUrl());
		await t.op('$showHelp("/doc"), $helpHref("/doc")', () => { vm.$showHelp('/doc'); return vm.$helpHref('/doc'); });
		await t.op('$print()', () => vm.$print());
		await t.op('$inlineOpen("dlg"); $inlineClose("dlg", 1); $inlineDepth(); $closeAllPopups()', () => {
			vm.$inlineOpen('dlg');
			vm.$inlineClose('dlg', 1);
			const depth = vm.$inlineDepth();
			vm.$closeAllPopups();
			return depth;
		});
		// a url in braces: a property of the selected element holds it
		const l = await t.page('L', { decl: LIST, url: '/_page/document/index/0', data: list(), isIndex: true });
		await t.op('L: Documents[0].$select(); $openSelected("{Name}", Documents); $openSelected("{Missing}", Documents)', () => {
			l.Documents[0].$select();
			l.$openSelected('{Name}', l.Documents);
			l.$openSelected('{Missing}', l.Documents);
		});
	},

	async function upload(t) {
		const reply = replies();
		t.section('$upload, $uploadBlob, $uploadBlobFile', {
			server: {
				'POST /_file/document/upload/new?Key=k': reply.route,
				'POST /_blob/document/blob?base=B&owner=5': reply.route
			},
			shell: { 'html.uploadFile': () => new File(['x'], 'a.txt') }
		});
		const vm = await t.page('A', { decl: DOC, url: '/_page/document/edit/5', data: doc(5) });
		reply.next = { json: { Id: 100 } };
		await t.op('$upload("/document/upload", "image/*", { Key: "k" })', () => vm.$upload('/document/upload', 'image/*', { Key: 'k' }));
		reply.next = { status: 255, text: 'UI:Too big' };
		await t.op('$upload(…) → 255 UI:', () => vm.$upload('/document/upload', 'image/*', { Key: 'k' }));
		reply.next = { status: 500 };
		await t.op('$upload(…) → 500', () => vm.$upload('/document/upload', 'image/*', { Key: 'k' }));
		reply.next = { fail: 'fetch failed' };
		await t.op('$upload(…) → network failure', () => vm.$upload('/document/upload', 'image/*', { Key: 'k' }));
		await t.op('$upload(…, { catchError: true }) → network failure', () => vm.$upload('/document/upload', 'image/*', { Key: 'k' }, { catchError: true }));
		reply.next = { json: { Id: 200 } };
		await t.op('$uploadBlob("/document/blob", "*", { Base: "B", Id: 5 })', () => vm.$uploadBlob('/document/blob', '*', { Base: 'B', Id: 5 }));
		reply.next = { status: 255, text: 'UI:No' };
		await t.op('$uploadBlobFile("/document/blob", file, { Base: "B", Id: 5 }) → 255', () => vm.$uploadBlobFile('/document/blob', new File(['y'], 'b.txt'), { Base: 'B', Id: 5 }));
	},

	async function eusign(t) {
		t.section('$eusign', { shell: { modal: () => ({ signed: true }) } });
		const vm = await t.page('A', { decl: DOC, url: '/_page/document/edit/5', data: doc(5) });
		await t.op('$eusign("/document/sign", 3)', () => vm.$eusign('/document/sign', 3));
	},

	async function caller(t) {
		t.section('a dialog and its caller: saveEvent, $emitCaller, $saveCaller, $dirtyCaller', {
			server: { 'POST /_data/save': body => ({ json: body.data }) }
		});
		const a = await t.page('A', { decl: DOC, url: '/_page/document/edit/5', data: doc(5) });
		const d = await t.page('D', {
			decl: {
				TRoot: { props: { Agent: 'TAgent' }, $main: 'Agent' },
				TAgent: { props: { Id: Number, Name: String }, $id: 'Id', $name: 'Name' }
			},
			url: '/_dialog/agent/edit/7', inDialog: true, data: { Agent: { Id: 7, Name: 'Agent' } }
		});
		await t.op('D.$caller === A', () => d.$caller === a);
		await t.op('D.__parseControllerAttributes("{\'saveEvent\':\'agent.saved\',\'alwaysOk\':true,\'placement\':\'right\'}")',
			() => d.__parseControllerAttributes("{'saveEvent':'agent.saved','alwaysOk':true,'placement':'right'}"));
		await t.op('D: Agent.Name = "New"; $save()', () => { d.Agent.Name = 'New'; return d.$save(); });
		await t.op('D: $emitSaveEvent(); $emitCaller("x.y", 1, 2)', () => { d.$emitSaveEvent(); d.$emitCaller('x.y', 1, 2); });
		await t.op('D: $dirtyCaller(); A.$isDirty', () => { d.$dirtyCaller(); return a.$isDirty; });
		await t.op('D: $saveCaller()', () => d.$saveCaller());
		await t.op('D: $emitGlobal("g.ev", 1); $emitParentTab("p.ev", 2)', () => { d.$emitGlobal('g.ev', 1); d.$emitParentTab('p.ev', 2); });
		await t.op('A: $emitCaller("x") with no caller', () => a.$emitCaller('x'));
		await t.op('A.$destroy(); D: $saveCaller(), $emitCaller("x")', () => { a.$destroy(); return [d.$saveCaller(), d.$emitCaller('x')]; });
	},

	async function lifecycle(t) {
		t.section('the bus into a page, and its end', {
			server: { 'POST /_data/reload': { json: list() } }
		});
		const vm = await t.page('A', { decl: LIST, url: '/_page/document/index/0', data: list(), isIndex: true });
		await t.op('listeners', () => t.listeners());
		await t.op('bus childrenSaved, another token', () => t.emit('childrenSaved', { token: 'other', toast: 'No' }));
		await t.op('bus childrenSaved, the page\'s token', () =>
			t.emit('childrenSaved', { token: vm.__currentToken__, update: vm.Documents, toast: 'Saved', id: 2 }));
		await t.op('bus globalPeriodChanged; globalAppEvent; signalEvent', () => {
			t.emit('globalPeriodChanged', { From: 1 });
			t.emit('globalAppEvent', { event: 'app.ev', data: 1 });
			t.emit('signalEvent', { event: 'sig.ev', data: 2 });
		});
		const args = { target: 'controller', action: 'eval', path: 'Documents.length' };
		await t.op('bus invokeTest', () => { t.emit('invokeTest', args); return args.result; });
		await t.op('$emit("cwChange", Documents)', () => { vm.$emit('cwChange', vm.Documents); });
		await t.op('$destroy()', () => vm.$destroy());
		await t.op('listeners', () => t.listeners());
		await t.op('bus signalEvent; globalAppEvent', () => {
			t.emit('signalEvent', { event: 'sig.ev', data: 3 });
			t.emit('globalAppEvent', { event: 'app.ev', data: 4 });
		});
	},

	async function helpers(t) {
		t.section('helpers: format, errors, $nodirty, $clearObject', {
			shell: {}
		});
		const vm = await t.page('A', {
			decl: DOC, url: '/_page/document/edit/5', data: doc(5),
			template: { validators: { 'Document.Memo': 'Memo is required', 'Document.Rows[].Qty': { valid: 'notBlank', msg: 'Qty', severity: 'warning' } } }
		});
		await t.op('$format(1234.5, "Currency"), $format(0, { dataType: "Number", hideZeros: true }), $format("x", { format: "[{0}]" })',
			() => [vm.$format(1234.5, 'Currency'), vm.$format(0, { dataType: 'Number', hideZeros: true }), vm.$format('x', { format: '[{0}]' })]);
		await t.op('$format(new Date(2026, 0, 15), { dataType: "Date" }), $format(5), $format(5, { mask: "##-##" })',
			() => [vm.$format(new Date(2026, 0, 15), { dataType: 'Date' }), vm.$format(5), vm.$format('1234', { mask: '##-##' })]);
		await t.op('$getNegativeRedClass(-1), (1), ("x")', () => [vm.$getNegativeRedClass(-1), vm.$getNegativeRedClass(1), vm.$getNegativeRedClass('x')]);
		await t.op('$maxChars("abcdef", 3), $toJson({ A: 1 }), $sanitize("<b>x</b>")', () => [vm.$maxChars('abcdef', 3), vm.$toJson({ A: 1 }), vm.$sanitize('<b>x</b>')]);
		await t.op('$hasError("Document.Memo"), $errorMessage("Document.Memo")', () => [vm.$hasError('Document.Memo'), vm.$errorMessage('Document.Memo')]);
		await t.op('$getErrors(), $getErrors("warning"), $getErrors(["error"])', () => [vm.$getErrors(), vm.$getErrors('warning'), vm.$getErrors(['error'])]);
		await t.op('$hasError, $errorMessage after $getErrors', () => [vm.$hasError('Document.Memo'), vm.$errorMessage('Document.Memo')]);
		await t.op('$hasSelected(Rows, { validRequired: true })', () => vm.$hasSelected(vm.Document.Rows, { validRequired: true }));
		await t.op('$nodirty(async: Memo = "m")', () => vm.$nodirty(async () => { vm.Document.Memo = 'm'; }));
		await t.op('$isDirty, $isPristine, $canSave, $isLoading, $modelInfo, $indirectUrl, $query',
			() => [vm.$isDirty, vm.$isPristine, vm.$canSave, vm.$isLoading, vm.$modelInfo, vm.$indirectUrl, vm.$query]);
		await t.op('$clearObject(Document.Agent); $clearObject(Rows); $clearObject({ A: 1 }); $clearObject(null)', () => {
			vm.$clearObject(vm.Document.Agent);
			vm.$clearObject(vm.Document.Rows);
			const o = { A: 1 };
			vm.$clearObject(o);
			vm.$clearObject(null);
			return o;
		});
		await t.op('$defer(fn)', () => vm.$defer(() => { vm.Document.Name = 'deferred'; }));
		await t.op('$ctrl members', () => Object.keys(vm.$data._host_.$ctrl));
		t.show('data', vm.$data);
	}
];

module.exports = { PAGES };
