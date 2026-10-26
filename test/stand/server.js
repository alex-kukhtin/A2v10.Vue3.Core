// The memory stand's server: the probe page, the built core, the locale, and synthetic pages in the form the
// server will send them (Vue3DataScripter: the root element's HTML, a <script> whose body returns the descriptor).
// Every page has a template of its own (id="el{Guid}", as PageController.Render) and its own model types.
// Run: node test/stand/server.js [port]   then open http://localhost:<port>/memory with DevTools closed (the memory
// stand), or http://localhost:<port>/ (the tabbed shell on its synthetic pages)

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { SITE } = require('../net48/site.js');

const PORT = +(process.argv[2] || 3077);
const DIST = path.join(__dirname, '../../packages/core/dist');
const SHELL = path.join(__dirname, '../../packages/shell-tabbed/dist');
const XAML = path.join(__dirname, '../../packages/xaml/dist');
// The theme of the shell's stand: A2v10.Core beside this repository (read only); without it, no styles.
const CSS = path.join(__dirname, '../../../A2v10.Core/Platform/A2v10.Web.Assets/wwwroot/css');
const CSS_TYPES = { '.css': 'text/css; charset=utf-8', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };

const FILES = {
	// the shell takes the path for a tab's url (as the app is served at '/'): it is at the root, the memory stand aside
	'/': [path.join(__dirname, 'shell.html'), 'text/html; charset=utf-8'],
	'/memory': [path.join(__dirname, 'index.html'), 'text/html; charset=utf-8'],
	'/a2v10-core.js': [path.join(DIST, 'a2v10-core.js'), 'text/javascript; charset=utf-8'],
	'/a2v10-core.js.map': [path.join(DIST, 'a2v10-core.js.map'), 'application/json'],
	'/a2v10-shell-tabbed.js': [path.join(SHELL, 'a2v10-shell-tabbed.js'), 'text/javascript; charset=utf-8'],
	'/a2v10-shell-tabbed.js.map': [path.join(SHELL, 'a2v10-shell-tabbed.js.map'), 'application/json'],
	'/a2v10-xaml.js': [path.join(XAML, 'a2v10-xaml.js'), 'text/javascript; charset=utf-8'],
	'/a2v10-xaml.js.map': [path.join(XAML, 'a2v10-xaml.js.map'), 'application/json'],
	// pages as A2v10.Core sends them (MetaAppStand, seen 2026-10-25), with v-slot for slot-scope as Core is to send
	'/_page/catalog/company/index/0': [path.join(__dirname, 'pages/catalog-company-index.html'), 'text/html; charset=utf-8'],
	'/_dialog/catalog/company/edit/1001': [path.join(__dirname, 'pages/catalog-company-edit.html'), 'text/html; charset=utf-8'],
	'/_page/document/waybillin/index/0': [path.join(__dirname, 'pages/document-waybillin-index.html'), 'text/html; charset=utf-8'],
	'/_page/document/waybillin/edit/1007': [path.join(__dirname, 'pages/document-waybillin-edit.html'), 'text/html; charset=utf-8'],
	'/_page/report/trialbalance/index/0': [path.join(__dirname, 'pages/report-trialbalance-index.html'), 'text/html; charset=utf-8'],
	'/_page/accplan/national/index/0': [path.join(__dirname, 'pages/accplan-national-index.html'), 'text/html; charset=utf-8'],
	'/_page/task/edit/104': [path.join(__dirname, 'pages/task-edit.html'), 'text/html; charset=utf-8'],
	'/_page/catalog/agent/index/0': [path.join(__dirname, 'pages/catalog-agent-index.html'), 'text/html; charset=utf-8'],
	'/_page/document/order/index/0': [path.join(__dirname, 'pages/document-order-index.html'), 'text/html; charset=utf-8'],
	'/_page/catalog/item/index/0': [path.join(__dirname, 'pages/catalog-item-index.html'), 'text/html; charset=utf-8'],
	'/_page/service/service/index/0': [path.join(__dirname, 'pages/service-service-index.html'), 'text/html; charset=utf-8'],
	'/_page/task/kanban/0': [path.join(__dirname, 'pages/task-kanban.html'), 'text/html; charset=utf-8'],
	'/_page/dashboard/index/0': [path.join(__dirname, 'pages/dashboard-index.html'), 'text/html; charset=utf-8'],
	'/_page/attachment/partial/100': [path.join(__dirname, 'pages/attachment-partial.html'), 'text/html; charset=utf-8'],
	'/_page/task/calendar/index/0': [path.join(__dirname, 'pages/task-calendar-index.html'), 'text/html; charset=utf-8'],
	'/_page/catalog/tender/index/0': [path.join(__dirname, 'pages/catalog-tender-index.html'), 'text/html; charset=utf-8'],
	// task/kanban's card 101 opens it; the answer is task 1825's as Core sent it
	'/_dialog/task/edit/101': [path.join(__dirname, 'pages/task-edit-dialog.html'), 'text/html; charset=utf-8'],
	// the answer came cut at its script: the template, the types and the rows written on the stand
	'/_page/finance/transaction/index/0': [path.join(__dirname, 'pages/finance-transaction-index.html'), 'text/html; charset=utf-8'],
	'/locale.js': [path.join(SITE, 'app/localization/locale-uk.js'), 'text/javascript; charset=utf-8']
};

// The script body as Vue3DataScripter is to write it (CORE-VUE3.md, "The page script"): its HEADER, the module
// function (DATAFUNC: template, data, modelData as CreateScript writes it), its FOOTER returning the descriptor.
// types: modelData's type declarations, TRoot and the ctors map last.
function pageScript(url, rawData, types) {
	return `'use strict';
const eventBus = require('std:eventBus');
const utils = require('std:utils');
const uPeriod = require('std:period');
const currentModule = function() {

	const template = (function() {
		let module = { exports: undefined };
		(function(module, exports) {
			module.exports = {};
		})(module, module.exports);
		return module.exports;
	})();

	const rawData = ${JSON.stringify(rawData)};

	function modelData(template, data) {
		const cmn = require('std:datamodel');
${types}
		cmn.implementRoot(TRoot, template, ctors);
		let root = new TRoot(data);
		cmn.setModelInfo(root, {}, rawData);
		return root;
	}

	return {
		dataModel: modelData(template, rawData)
	};
};

return {
	baseUrl: '${url}',
	inDialog: ${url.startsWith('/_dialog/')},
	isIndex: false,
	isSkipDataStack: false,
	createModel: () => currentModule().dataModel
};
//# sourceURL=a2v10://${url}`;
}

const ROWS_TYPES = `		function TDocument(source, path, parent) { cmn.createObject(this, source, path, parent); }
		cmn.defineObject(TDocument, {props: {'Id':Number,'Name':{type:String, len:50},'Rows':TRowArray}, $id: 'Id'}, false);
		function TRow(source, path, parent) { cmn.createObject(this, source, path, parent); }
		cmn.defineObject(TRow, {props: {'Id':Number,'Qty':Number}, $id: 'Id'}, true);
		function TRowArray(source, path, parent) { return cmn.createArray(source, path, TRow, TRowArray, parent); }
		function TRoot(source, path, parent) { cmn.createObject(this, source, path, parent); }
		cmn.defineObject(TRoot, {props: {'Document':TDocument}}, false);
		const ctors = {"TDocument":TDocument,"TRow":TRow,"TRowArray":TRowArray,"TRoot":TRoot};`;

// A page of rows with an a2-include of an inner page inside: nested pages are released with their host.
function pageHtml(url, n, inner) {
	const id = `el${crypto.randomUUID()}`;
	const rows = Array.from({ length: inner ? 3 : 20 }, (_, i) => ({ Id: i + 1, Qty: i * n }));
	const rawData = { Document: { Id: n, Name: `${inner ? 'Inner' : 'Page'} ${n}`, Rows: rows } };
	const nested = inner ? '' : `<a2-include source="stand/inner" :arg="Document.Id"></a2-include>`;
	return `<div id="${id}" class="page absolute">
	<h3 v-text="Document.Name"></h3>
	<table><tbody><tr v-for="r in Document.Rows" :key="r.Id"><td v-text="r.Id"></td> <td v-text="r.Qty"></td></tr></tbody></table>
	${nested}
</div>
<script type="text/javascript">
${pageScript(url, rawData, ROWS_TYPES)}
</script>`;
}

// The shell's home page as A2v10.Core sends it (seen 2026-10-25): Web/MainApp/_home, model.json with no model.
// Container.RenderChildren wraps children in a bare <template> (Page's, StackPanel's): Vue 2 rendered its content.
const EMPTY_TYPES = `		function TRoot(source, path, parent) { cmn.createObject(this, source, path, parent); }
		cmn.defineObject(TRoot, {props: {}}, false);
		const ctors = {"TRoot":TRoot};`;

function homeHtml() {
	const id = `el${crypto.randomUUID()}`;
	return `<div class="page absolute" id="${id}"><a2-document-title page-title="Home"></a2-document-title><template><div class="empty-panel"><div class="empty-panel-content"><div class="stack-panel vertical align-center" style="gap:1rem"><template><span>Yet not implemented</span></template></div></div></div></template><div class="page-canvas-outer"><div class="page-canvas" id="page-canvas"></div></div></div>
<script type="text/javascript">
${pageScript('_home/index/', {}, EMPTY_TYPES)}
</script>`;
}

// finance/transaction's info popover (url: /_popup/finance/transaction/info/{id}): not seen from Core, written here
const INFO_TYPES = `		function TTransaction(source, path, parent) { cmn.createObject(this, source, path, parent); }
		cmn.defineObject(TTransaction, {props: {'Id':Number,'Text':String}, $id: 'Id'}, false);
		function TRoot(source, path, parent) { cmn.createObject(this, source, path, parent); }
		cmn.defineObject(TRoot, {props: {'Transaction':TTransaction}}, false);
		const ctors = {"TTransaction":TTransaction,"TRoot":TRoot};`;

function infoHtml(url, id) {
	const elId = `el${crypto.randomUUID()}`;
	return `<div class="popover-content" id="${elId}" style="padding:.5rem">
	<div class="stack-panel vertical"><span class="bold" v-text="Transaction.Id"></span><span v-text="Transaction.Text"></span></div>
</div>
<script type="text/javascript">
${pageScript(url, { Transaction: { Id: id, Text: `Transaction ${id} info` } }, INFO_TYPES)}
</script>`;
}

// dashboard/index's widgets to add (Dashboard.Widgets, lazy): the answer had none
const WIDGETS = [
	{ Name: 'Залишки', Icon: 'chart-column', Memo: 'Залишки на рахунках', Category: 'Фінанси', rowSpan: 2, colSpan: 3, Url: '/dashboard/widget/balance', Widget: 'balance' },
	{ Name: 'Каса', Icon: 'currency', Memo: 'Рух коштів за день', Category: 'Фінанси', rowSpan: 2, colSpan: 2, Url: '/dashboard/widget/cash', Widget: 'cash' },
	{ Name: 'Борги', Icon: 'list', Memo: 'Дебіторська заборгованість', Category: 'Продажі', rowSpan: 1, colSpan: 2, Url: '/dashboard/widget/debts', Widget: 'debts' }
];

// a dashboard widget's page (/_page/dashboard/widget/{name}/{id}): not seen from Core, written here
function widgetHtml(url, name, id) {
	const elId = `el${crypto.randomUUID()}`;
	return `<div class="widget" id="${elId}" style="padding:.5rem;background:#f4f6f8;height:100%">
	<b v-text="Widget.Name"></b> <span v-text="Widget.Id"></span>
</div>
<script type="text/javascript">
${pageScript(url, { Widget: { Id: id, Name: name } }, WIDGET_TYPES)}
</script>`;
}

const WIDGET_TYPES = `		function TWidget(source, path, parent) { cmn.createObject(this, source, path, parent); }
		cmn.defineObject(TWidget, {props: {'Id':Number,'Name':String}, $id: 'Id'}, false);
		function TRoot(source, path, parent) { cmn.createObject(this, source, path, parent); }
		cmn.defineObject(TRoot, {props: {'Widget':TWidget}}, false);
		const ctors = {"TWidget":TWidget,"TRoot":TRoot};`;

// attachment/partial's files (/_file/attachment/upload/{id}), by the rows written in its page: 1 an image, 2 a pdf;
// 3 (docx) has no preview and no file
function pdfFile() {
	const objs = [
		'<< /Type /Catalog /Pages 2 0 R >>',
		'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
		'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
		'<< /Length 44 >>\nstream\nBT /F1 24 Tf 40 100 Td (Contract 2) Tj ET\nendstream',
		'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
	];
	let pdf = '%PDF-1.4\n';
	const offsets = objs.map((o, i) => {
		const at = pdf.length;
		pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
		return at;
	});
	const xref = pdf.length;
	pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
	pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
	return pdf;
}

const ATTACHMENT_FILES = {
	1: ['image/svg+xml', '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="#cde"/><text x="40" y="110" font-size="28">Scan 1</text></svg>'],
	2: ['application/pdf', pdfFile()]
};

// catalog/tender's budgets (a2-multiselect url="/finance/budget"): fetch's and browse's, by the names in the answer's rows
const BUDGETS = [
	{ Id: 107, Name: 'NRC - ECHO III (ПОВНА НАЗВА)' }, { Id: 109, Name: 'HIAS 4M (Budget)' },
	{ Id: 115, Name: 'PIN CLASTER (красивый)' }, { Id: 116, Name: 'NRC - EU Schock-Familen' },
	{ Id: 118, Name: 'McKenzi i Ko 2022' }, { Id: 124, Name: 'NRC EU 2022' },
	{ Id: 125, Name: 'ACTED-SWISS - СУБПАРТНЕР № 1' }
];

const BUDGET_TYPES = `		function TBudget(source, path, parent) { cmn.createObject(this, source, path, parent); }
		cmn.defineObject(TBudget, {props: {'Id':Number,'Name':String}, $id: 'Id', $name: 'Name'}, true);
		function TBudgetArray(source, path, parent) { return cmn.createArray(source, path, TBudget, TBudgetArray, parent); }
		function TRoot(source, path, parent) { cmn.createObject(this, source, path, parent); }
		cmn.defineObject(TRoot, {props: {'Budgets':TBudgetArray}}, false);
		const ctors = {"TBudget":TBudget,"TBudgetArray":TBudgetArray,"TRoot":TRoot};`;

// finance/budget/browse (a2-multiselect's search link): not seen from Core, written here
function budgetBrowseHtml(url) {
	const elId = `el${crypto.randomUUID()}`;
	return `<div class="modal" id="${elId}" v-cloak style="width:30rem"><div class="modal-header" v-drag-window><span class="modal-title">Бюджети</span><button class="btnclose" tabindex="-1" @click.prevent="$modalClose(false)">&#x2715;</button></div><div class="modal-content"><data-grid :items-source="Budgets" :fixed-header="true" style="height:20rem" :hover="true" :border="true" :doubleclick="() => $modalSelect(Budgets)"><data-grid-column align="right" header="#" content="Id" width="4rem"></data-grid-column><data-grid-column header="Назва" content="Name"></data-grid-column></data-grid></div><div class="modal-footer"><button class="btn a2-inline btn-primary" :disabled="!$hasSelected(Budgets)" @click.stop.prevent="$modalSelect(Budgets)">Вибрати</button><button class="btn a2-inline" @click.stop.prevent="$modalClose(false)">Скасувати</button></div></div>
<script type="text/javascript">
${pageScript(url, { Budgets: BUDGETS }, BUDGET_TYPES)}
</script>`;
}

// catalog/item's Items of a folder: the answer had none (Core loads them lazily)
function lazyRows(folderId) {
	const n = Math.abs(folderId) % 4 + 1;
	return Array.from({ length: n }, (_, i) => ({
		Id: Math.abs(folderId) * 10 + i + 1, Name: `Item ${folderId}.${i + 1}`, Memo: '',
		Folder: { Id: folderId, Name: `Folder ${folderId}` }, Unit: { Id: 1, Name: 'шт' },
		ItemCategory: { Id: 0, Name: '', Color: '' }, VatRate: { Id: '20', Name: '20%' }
	}));
}

const server = http.createServer((req, res) => {
	const url = req.url.split('?')[0];
	const file = FILES[url];
	if (file) {
		res.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-store' });
		fs.createReadStream(file[0]).pipe(res);
		return;
	}
	const cssType = url.startsWith('/css/') && !url.includes('..') && CSS_TYPES[path.extname(url)];
	if (cssType && fs.existsSync(path.join(CSS, url.substring(5)))) {
		res.writeHead(200, { 'Content-Type': cssType });
		fs.createReadStream(path.join(CSS, url.substring(5))).pipe(res);
		return;
	}
	// the shell's home page: a page as any other
	if (url === '/_page/_home/index/0') {
		res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
		res.end(homeHtml());
		return;
	}
	// a lazy array's rows (catalog/item: a folder's Items; dashboard: Widgets), as /_data/loadlazy answers: { [prop]: rows }
	if (url === '/_data/loadlazy' && req.method === 'POST') {
		let body = '';
		req.on('data', chunk => body += chunk);
		req.on('end', () => {
			const { id, prop } = JSON.parse(body);
			res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
			res.end(JSON.stringify({ [prop]: prop === 'Widgets' ? WIDGETS : lazyRows(id) }));
		});
		return;
	}
	const attachment = /^\/_file\/attachment\/upload\/(\d+)$/.exec(url);
	if (attachment && ATTACHMENT_FILES[attachment[1]]) {
		const [mime, body] = ATTACHMENT_FILES[attachment[1]];
		res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' });
		res.end(body);
		return;
	}
	const widget = /^\/_page\/dashboard\/widget\/(\w+)\/(\d+)$/.exec(url);
	if (widget) {
		res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
		res.end(widgetHtml(url, widget[1], +widget[2]));
		return;
	}
	const info = /^\/_popup\/finance\/transaction\/info\/(\d+)$/.exec(url);
	if (info) {
		res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
		res.end(infoHtml(url, +info[1]));
		return;
	}
	const budgetBrowse = /^\/_dialog\/finance\/budget\/browse(?:\/\d+)?$/.exec(url);
	if (budgetBrowse) {
		res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
		res.end(budgetBrowseHtml(url));
		return;
	}
	// $invoke: finance/budget's fetch answers the budgets with the text in their names; task/kanban's setTaskState
	// and archiveTask an empty object, as their procedures return nothing
	if (url === '/_data/invoke' && req.method === 'POST') {
		let body = '';
		req.on('data', chunk => body += chunk);
		req.on('end', () => {
			const { cmd, baseUrl, data } = JSON.parse(body);
			let answer = {};
			if (cmd === 'fetch' && baseUrl.includes('/finance/budget/')) {
				const text = (data.Text || '').toLowerCase();
				answer = { Budgets: BUDGETS.filter(b => b.Name.toLowerCase().includes(text)) };
			}
			res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
			res.end(JSON.stringify(answer));
		});
		return;
	}
	// a page, or a dialog (the shell adds the argument's id as the last segment)
	const m = /^\/_(?:page|dialog)\/stand\/(page|inner)\/(\d+)(?:\/\d+)?$/.exec(url);
	if (m) {
		res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
		res.end(pageHtml(url, +m[2], m[1] === 'inner'));
		return;
	}
	res.writeHead(404, { 'Content-Type': 'text/plain' });
	res.end('Not Found');
});

server.listen(PORT, () => console.log(`stand: http://localhost:${PORT}/`));
