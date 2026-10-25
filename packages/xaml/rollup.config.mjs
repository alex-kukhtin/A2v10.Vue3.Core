// Bundles the XAML components' build (tsc's output) into one classic script that extends a2v10 as a2v10.xaml. Vue and
// the platform are not in it: they are a2v10-core.js's, loaded before (one runtime for the document).
// Every rollup warning fails the build: an unresolved import would otherwise become a silent external.

import terser from '@rollup/plugin-terser';
import { tscMaps, WHITESPACE_ONLY } from '../../scripts/rollup-shared.mjs';

const iife = {
	format: 'iife', name: 'a2v10.xaml', extend: true, sourcemap: true,
	globals: { 'vue': 'a2v10.platform.Vue', '@a2v10/platform': 'a2v10.platform' }
};

export default {
	input: 'build/index.js',
	external: ['vue', '@a2v10/platform'],
	plugins: [tscMaps()],
	output: [
		{ ...iife, file: 'dist/a2v10-xaml.js' },
		{ ...iife, file: 'dist/a2v10-xaml.min.js', plugins: [terser(WHITESPACE_ONLY)] }
	],
	onwarn(warning) {
		throw new Error(`rollup: ${warning.code}: ${warning.message}`);
	}
};
