// Bundles the shelves' builds (their build/, tsc's output) and Vue into one classic script that extends a2v10.
// Two scripts: the server picks .min.js when Environment is Release (MainController: Minify), the other one else.
// Every rollup warning fails the build: an unresolved import would otherwise become a silent external.

import { createRequire } from 'node:module';
import nodeResolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import { tscMaps, WHITESPACE_ONLY } from '../../scripts/rollup-shared.mjs';

// Vue as its browser builds: runtime-only (it has no compile cache; the platform registers its own compiler,
// platform/src/compiler.ts) and the compiler. The dev builds warn and give the compiler's errors as text; the
// prod builds are minified by Vue and report by code. Resolved from the importer: the platform declares them.
const DEV = {
	'vue': 'vue/dist/vue.runtime.esm-browser.js',
	'@vue/compiler-dom': '@vue/compiler-dom/dist/compiler-dom.esm-browser.js'
};
const PROD = {
	'vue': 'vue/dist/vue.runtime.esm-browser.prod.js',
	'@vue/compiler-dom': '@vue/compiler-dom/dist/compiler-dom.esm-browser.prod.js'
};

function browserBuilds(builds) {
	return {
		name: 'browser-builds',
		resolveId(source, importer) {
			if (!(source in builds) || !importer) return null;
			return createRequire(importer).resolve(builds[source]);
		}
	};
}

const iife = { format: 'iife', name: 'a2v10', extend: true, sourcemap: true };

function bundle(builds, output) {
	return {
		input: 'index.js',
		plugins: [browserBuilds(builds), nodeResolve(), tscMaps()],
		output: { ...iife, ...output },
		onwarn(warning) {
			throw new Error(`rollup: ${warning.code}: ${warning.message}`);
		}
	};
}

export default [
	bundle(DEV, { file: 'dist/a2v10-core.js' }),
	bundle(PROD, { file: 'dist/a2v10-core.min.js', plugins: [terser(WHITESPACE_ONLY)] })
];
