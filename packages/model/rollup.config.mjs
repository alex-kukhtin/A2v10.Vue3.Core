// Bundles tsc's output (build/) into one classic script that defines a2v10.model.
// Every rollup warning fails the build: an unresolved import (a package not declared, e.g. vue)
// would otherwise become a silent external.

import fs from 'node:fs';
import terser from '@rollup/plugin-terser';

// rollup does not read the maps of its inputs; tsc wrote one next to each file. Loading them here
// chains the bundle's map back to the .ts sources (their text is inlined: inlineSources).
function tscMaps() {
	return {
		name: 'tsc-maps',
		load(id) {
			if (!id.endsWith('.js')) return null;
			const map = id + '.map';
			return {
				code: fs.readFileSync(id, 'utf8'),
				map: fs.existsSync(map) ? fs.readFileSync(map, 'utf8') : null
			};
		}
	};
}

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
			// Whitespace only (A2v10 policy for its own code). Constructor names are a contract with
			// the server (datamodel dispatches on constructor.name): never mangled.
			plugins: [terser({ compress: false, mangle: false, keep_fnames: true, keep_classnames: true })]
		}
	],
	onwarn(warning) {
		throw new Error(`rollup: ${warning.code}: ${warning.message}`);
	}
};
