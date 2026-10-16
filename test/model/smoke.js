// The built script defines a2v10.model.createModel and keeps what another shelf put into a2v10.
// Run: node test/model/smoke.js (after pnpm build)

'use strict';

const assert = require('assert');
const { loadModelBundle } = require('./load.js');

globalThis.a2v10 = { other: 'another shelf' };
const model = loadModelBundle();

assert.strictEqual(typeof model.createModel, 'function', 'a2v10.model.createModel');
assert.strictEqual(globalThis.a2v10.other, 'another shelf', 'extend: a2v10 kept');
console.log('a2v10.model.createModel: function; a2v10 extended, not replaced');
