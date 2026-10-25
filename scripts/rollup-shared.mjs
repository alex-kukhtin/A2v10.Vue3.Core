// What the packages' rollup builds share. No imports but node's: this folder has no node_modules of its own.

import fs from 'node:fs';

// rollup does not read the maps of its inputs; tsc wrote one next to each file. Loading them here chains a
// bundle's map back to the .ts sources (their text is inlined: inlineSources).
export function tscMaps() {
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

// The terser options of every .min.js: whitespace only (A2v10 policy for its own code). Constructor names are a
// contract with the server (datamodel dispatches on constructor.name): never mangled.
export const WHITESPACE_ONLY = { compress: false, mangle: false, keep_fnames: true, keep_classnames: true };
