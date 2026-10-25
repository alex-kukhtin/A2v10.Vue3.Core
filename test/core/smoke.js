// The built a2v10-core.js and a2v10-core.min.js, each loaded as <script src> loads it, in a context of its own:
// the globals of app.js, the runtime compiler (no cache), the vocabulary (kept before the shell's app, passed to
// it after). The two differ by Vue's builds: dev (errors as text) and prod (errors by code).
// Run: node test/core/smoke.js (after pnpm build)

'use strict';

const assert = require('assert');
const { loadCore } = require('./load.js');

function check(file, broken, reported) {
	const { ctx, errors } = loadCore(file);
	const { model, platform } = ctx.a2v10;

	// shelves
	assert.strictEqual(typeof model.createModel, 'function', `${file}: a2v10.model.createModel`);
	assert.strictEqual(typeof platform.compileTemplate, 'function', `${file}: a2v10.platform.compileTemplate`);

	// std:*: the platform's, the model's
	for (const name of ['std:eventBus', 'std:platform', 'std:locale', 'std:const', 'std:log', 'std:console',
		'std:utils', 'std:period', 'std:validators', 'std:modelInfo', 'std:datamodel', 'std:url', 'std:http',
		'std:popup', 'std:signalR'])
		assert.ok(name in ctx.app.modules, `${file}: ${name} registered`);
	assert.ok('std:store' in ctx.app.components, `${file}: std:store registered`);

	// app.js
	const { app, require, component, template, define } = ctx;
	assert.strictEqual(ctx.$$rootUrl, '', '$$rootUrl: no meta');
	assert.throws(() => require('std:nothing'), /module "std:nothing" not found/);
	assert.strictEqual(require('std:nothing', true), null, 'require noerror: null');
	let created = 0;
	app.modules['test:lazy'] = function () { created += 1; return { n: created }; };
	assert.strictEqual(require('test:lazy'), require('test:lazy'), 'a function module: one instance');
	assert.strictEqual(created, 1, 'a function module: created once');
	assert.throws(() => component('std:nothing'), /component "std:nothing" not found/);
	assert.deepStrictEqual({ ...component('std:nothing', true) }, {}, 'component noerror: {}');
	assert.deepStrictEqual({ ...template('std:nothing', true) }, {}, 'template noerror: {}');
	assert.strictEqual(define(['require', 'exports'], (rq, exports) => { exports.default = rq('test:lazy'); }),
		require('test:lazy'), 'define: exports.default');
	assert.strictEqual(app.nextToken(), '1603');
	assert.strictEqual(app.nextToken(), '1604');

	// the compiler
	const TEMPLATE = '<div id="el1"><span>{{ Name }}</span>\n<span>x</span></div>';
	const r1 = platform.compileTemplate(TEMPLATE);
	const r2 = platform.compileTemplate(TEMPLATE);
	assert.notStrictEqual(r1, r2, 'no cache: a template compiled twice gives two render functions');
	assert.strictEqual(r1._rc, true, 'runtime compiled mark');
	errors.length = 0;
	platform.compileTemplate(broken);
	assert.ok(errors.length && errors[0].includes(reported), `${file}: ${broken} reported (${errors[0]}), not thrown`);

	// the vocabulary
	const got = [];
	const fakeApp = {
		component: name => got.push(`component ${name}`),
		directive: name => got.push(`directive ${name}`)
	};
	platform.vocabulary.component('a2-early', {});
	platform.vocabulary.directive('early', {});
	assert.deepStrictEqual(got, [], 'before attach: kept');
	platform.vocabulary.attach(fakeApp);
	assert.deepStrictEqual(got, ['component include', 'component a2-include', 'component a2-queued-include',
		'directive dropdown', 'directive contextmenu',
		'component a2-early', 'directive early'], 'attach: the platform\'s, the primitives\', then the others, in order');
	got.length = 0;
	platform.vocabulary.component('a2-late', {});
	assert.deepStrictEqual(got, ['component a2-late'], 'after attach: at once');
	assert.throws(() => platform.vocabulary.attach(fakeApp), /a document has one app/);
}

// dev: the compiler's text; prod: few checks, a code (a link to the error reference)
check('a2v10-core.js', '<div><span></div>', '[compiler] template error: Element is missing end tag.');
check('a2v10-core.min.js', '<div v-if></div>', '[compiler] template error: https://vuejs.org/error-reference/#compiler-');

console.log('a2v10-core.js, .min.js: model, platform; app.js globals; compiler without cache; vocabulary kept, then passed');
