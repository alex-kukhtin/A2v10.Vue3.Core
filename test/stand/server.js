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
