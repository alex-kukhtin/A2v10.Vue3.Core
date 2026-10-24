// The trace of the Net48 page controller (controllers/base.js) over the page scenarios.
// Run: node test/trace/base.net48.js        → writes test/trace/base.net48.trace

'use strict';

const fs = require('fs');
const path = require('path');
const { loadNet48Controller } = require('../net48/controller.js');
const { createPageRecorder } = require('./page.js');
const { PAGES } = require('./pages.js');

const pr = createPageRecorder();
const { appRequire, DataModelController, bus } = loadNet48Controller(pr.host);
const utils = appRequire('std:utils');
const period = appRequire('std:period');
const urlTools = appRequire('std:url');

// As a page comes to life: the script VueDataScripter writes (FOOTER: the view model, the host, __doInit__),
// then http.js load (:185-189), which sets the base url and query once the script has run. The server's
// $(BaseUrl) and the requested url are the same url here. Not mounted: no DOM, no render.
function mount(root, { url, inDialog = false, isIndex = false, isSkipDataStack = false }) {
	const vm = new DataModelController({
		props: {
			inDialog: { type: Boolean, default: inDialog },
			isIndex: { type: Boolean, default: isIndex },
			isSkipDataStack: { type: Boolean, default: isSkipDataStack },
			pageTitle: { type: String }
		},
		data: root,
		computed: {
			utils() { return utils; },
			period() { return period; }
		}
	});
	vm.$data._host_ = {
		$viewModel: vm,
		$ctrl: vm.__createController__(vm)
	};
	vm.__doInit__(url);
	vm.$data.__baseUrl__ = urlTools.normalizeRoot(url);
	vm.$data.__baseQuery__ = urlTools.parseUrlAndQuery(url).query;
	return vm;
}

pr.attach({ cmn: appRequire('std:datamodel'), period, utils, bus, mount });

pr.api.run(PAGES).then(text => {
	const out = path.join(__dirname, 'base.net48.trace');
	fs.writeFileSync(out, text);
	console.log(`${PAGES.length} scenarios, ${text.split('\n').length} lines → ${out}`);
}, e => {
	// console.error is the recorder's now
	process.stderr.write(`${e.stack || e}\n`);
	process.exitCode = 1;
});
