// Bundles tsc's output (build/) into one classic script that defines a2v10.model.
// Every rollup warning fails the build: an unresolved import (a package not declared, e.g. vue)
// would otherwise become a silent external.

import terser from '@rollup/plugin-terser';
import { tscMaps, WHITESPACE_ONLY } from '../../scripts/rollup-shared.mjs';

// The global: a2v10.<shelf>; extend keeps what other shelves' scripts put into a2v10.
const iife = { format: 'iife', name: 'a2v10.model', extend: true, sourcemap: true };

export default {
	input: 'build/index.js',
	plugins: [tscMaps()],
	output: [
		{ ...iife, file: 'dist/a2v10-model.js' },
		{
			...iife,
			file: 'dist/a2v10-model.min.js',
			plugins: [terser(WHITESPACE_ONLY)]
		}
	],
	onwarn(warning) {
		throw new Error(`rollup: ${warning.code}: ${warning.message}`);
	}
};
