// After the build (pnpm build): the delivered files, with their maps, into the A2v10.Core site beside this
// repository, wwwroot/scripts/vue3/ (CORE-VUE3.md, "The files"). A missing site fails loudly: the build has no
// other place to put them.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = path.join(ROOT, '../A2v10.Core/Web/A2v10.Core.Web.Site/wwwroot/scripts/vue3');

// The files a layout loads: per file, its .js, .min.js and their maps.
const FILES = [
	['packages/core/dist', 'a2v10-core'],
	['packages/shell-tabbed/dist', 'a2v10-shell-tabbed'],
	['packages/xaml/dist', 'a2v10-xaml']
];

const scripts = path.dirname(TARGET);
if (!fs.existsSync(scripts))
	throw new Error(`copy-assets: ${scripts} does not exist (A2v10.Core beside this repository)`);
fs.mkdirSync(TARGET, { recursive: true });

for (const [dir, name] of FILES) {
	for (const ext of ['.js', '.js.map', '.min.js', '.min.js.map']) {
		const file = name + ext;
		fs.copyFileSync(path.join(ROOT, dir, file), path.join(TARGET, file));
	}
}
console.log(`copy-assets: ${FILES.map(f => f[1]).join(', ')} → ${path.relative(ROOT, TARGET)}`);
