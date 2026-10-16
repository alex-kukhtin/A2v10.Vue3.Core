// Loads the built model core as <script src> loads it: a classic script run in the global scope.
// Tests run against this file, the artifact that ships, not against the sources.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BUNDLE = path.join(__dirname, '../../packages/model/dist/a2v10-model.js');

function loadModelBundle() {
	vm.runInThisContext(fs.readFileSync(BUNDLE, 'utf8'), { filename: BUNDLE });
	return globalThis.a2v10.model;
}

module.exports = { BUNDLE, loadModelBundle };
