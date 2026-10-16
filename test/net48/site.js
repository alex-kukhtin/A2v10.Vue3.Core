// Where the Net48 client lives, and the script list of its jasmine page. Read only.
// The place is the machine's: A2V10_NET48_SITE, from the environment or the repository's .env.

'use strict';

const fs = require('fs');
const path = require('path');

const ENV_FILE = path.join(__dirname, '../../.env');

function siteFolder() {
	if (!process.env.A2V10_NET48_SITE && fs.existsSync(ENV_FILE))
		process.loadEnvFile(ENV_FILE);
	const site = process.env.A2V10_NET48_SITE;
	if (!site)
		throw new Error('A2V10_NET48_SITE is not set: copy .env.example to .env and set the Net48 Web/A2v10.Web.Site folder');
	if (!fs.existsSync(path.join(site, 'app/services/datamodel.js')))
		throw new Error(`A2V10_NET48_SITE=${site}: no app/services/datamodel.js there; it must be the Net48 Web/A2v10.Web.Site folder`);
	return site;
}

const SITE = siteFolder();
const PAGE = path.join(SITE, 'TestPages/JasmineTests.html');

// Deviations from the page, by src relative to the site root.
const SKIP = [
	'scripts/jasmine/',   // the runner boots jasmine itself
	'scripts/vue.min.js', // no Vue: the server adapter replaces webvue.js
	'tests/platform.js'   // stood in for Vue.set; the server adapter already does
];
const SWAP = {
	'app/platform/webvue.js': 'app/server/platform.js'
};
const SPECS = 'tests/';   // specs and their fixture (testdata.js)

// The page's scripts in the page's order, deviations applied.
function pageScripts() {
	const html = fs.readFileSync(PAGE, 'utf8');
	return [...html.matchAll(/<script[^>]*\ssrc="\.\.\/([^"]+)"/g)]
		.map(m => m[1])
		.filter(src => !SKIP.some(s => src.startsWith(s)))
		.map(src => SWAP[src] || src);
}

module.exports = { SITE, SPECS, pageScripts };
