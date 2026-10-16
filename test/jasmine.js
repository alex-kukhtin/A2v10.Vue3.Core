// Boots the Net48 page's own jasmine-core (2.6.4) in Node: the specs run under the matchers they
// were written for. One runner for both targets: the Net48 sources and the built package.

'use strict';

const path = require('path');
const { SITE } = require('./net48/site.js');

// Installs describe/it/expect as globals; run() executes what was loaded and reports.
function bootJasmine() {
	const jasmineRequire = require(path.join(SITE, 'scripts/jasmine/jasmine.js'));
	const j$ = jasmineRequire.core(jasmineRequire);
	const env = j$.getEnv();
	Object.assign(globalThis, jasmineRequire.interface(j$, env));

	function run(title) {
		let total = 0;
		const failed = [];
		env.addReporter({
			specDone(r) {
				total += 1;
				if (r.status === 'failed')
					failed.push(r);
			},
			jasmineDone() {
				for (const r of failed) {
					console.log(`\nFAIL ${r.fullName}`);
					for (const e of r.failedExpectations)
						console.log(`  ${e.message}`);
				}
				console.log(`\n${title}: ${total} specs, ${failed.length} failed`);
				process.exitCode = failed.length ? 1 : 0;
			}
		});
		env.execute();
	}

	return { run };
}

module.exports = { bootJasmine };
