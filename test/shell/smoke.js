// The built a2v10-shell-tabbed.js (and .min.js) loaded after the core, in a page of its own, as the layout loads
// them: it takes Vue and the platform from a2v10-core.js, registers its components and directives, and gives
// a2v10.shell.start. The shell running is the stand's (test/stand: http://localhost:3077/).
// Run: node test/shell/smoke.js (after pnpm build)

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadCore } = require('../core/load.js');

const DIST = path.join(__dirname, '../../packages/shell-tabbed/dist');

for (const [core, shell] of [['a2v10-core.js', 'a2v10-shell-tabbed.js'], ['a2v10-core.min.js', 'a2v10-shell-tabbed.min.js']]) {
	const { ctx, errors } = loadCore(core);
	const file = path.join(DIST, shell);
	vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });

	assert.strictEqual(typeof ctx.a2v10.shell.start, 'function', `${shell}: a2v10.shell.start`);
	assert.strictEqual(typeof ctx.a2v10.platform.compileTemplate, 'function', `${shell}: the core kept`);
	for (const name of ['std:shellPlain', 'std:modal', 'std:toastr'])
		assert.ok(name in ctx.app.components, `${shell}: ${name}`);

	const got = [];
	ctx.a2v10.platform.vocabulary.attach({
		component: name => got.push(name),
		directive: name => got.push(`v-${name}`)
	});
	for (const name of ['include', 'a2-include', 'v-dropdown', 'v-drag-window', 'v-modal-width', 'v-maximize',
		'v-modal-placement', 'a2-debug', 'a2-mdi-header', 'a2-mdi-navbar'])
		assert.ok(got.includes(name), `${shell}: ${name} in the vocabulary`);
	assert.deepStrictEqual(errors, [], `${shell}: no errors at load`);

	// the application's scripts: Vue 2's globals that mean something, and the rest refused by name
	const Vue = ctx.Vue;
	assert.strictEqual(typeof Vue.nextTick, 'function', 'window.Vue.nextTick');
	assert.throws(() => new Vue({}), /new Vue is not supported on Vue 3/);
	assert.throws(() => Vue.extend({}), /Vue\.extend is not supported on Vue 3/);
	assert.throws(() => Vue.filter('x', () => 0), /Vue\.filter is not supported on Vue 3/);
}

console.log('a2v10-shell-tabbed.js, .min.js: after the core; std:shellPlain, std:modal, std:toastr; the vocabulary; window.Vue');
