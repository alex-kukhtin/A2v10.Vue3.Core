// The runtime compiler for templates that arrive at run time: a page's markup from the server, the shell's.
// Vue's own (vue.esm-bundler.js) is the runtime-only build plus one line: a compile cache keyed by the template
// text, never cleared. A page's template carries its own id="el{Guid}", so each open is a new key: an eternal
// leak. Hence the bundle takes the runtime-only build and registers this one: no cache. Lost registration makes
// Vue say "runtime compilation is not supported in this build" instead of growing silently.

import * as Vue from 'vue';
import { compile, type CompilerError, type CompilerOptions } from '@vue/compiler-dom';

// options: what Vue passes from app.config.compilerOptions and the component (isCustomElement, delimiters).
export function compileTemplate(template: string, options?: CompilerOptions): Vue.RenderFunction {
	const { code } = compile(template, {
		hoistStatic: true,
		// Vue 2 kept whitespace between elements; Vue 3's default 'condense' drops it where it holds a newline,
		// and inline elements of a page would close up.
		whitespace: 'preserve',
		// Vue 2 rendered a <template> with no v-if/v-else/v-for/v-slot as its children; Vue 3 renders a native
		// <template>, whose content the browser hides. The server wraps a container's children so (Container.cs).
		compatConfig: { MODE: 3, COMPILER_NATIVE_TEMPLATE: true },
		onError: err => report(err, template, 'error'),
		onWarn: err => {
			if (err.code as unknown === 'COMPILER_NATIVE_TEMPLATE') return; // chosen above, not a defect
			report(err, template, 'warning');
		},
		...options
	});
	const render = new Function('Vue', code)(Vue) as Vue.RenderFunction & { _rc?: boolean };
	// "Runtime compiled": the code reads the instance through `with (_ctx)`, and only the proxy Vue picks by this
	// mark answers the engine's Symbol.unscopables lookup; without it every render warns "Property … accessed".
	render._rc = true;
	return render;
}

function report(err: CompilerError, template: string, what: string): void {
	const at = err.loc ? template.slice(err.loc.start.offset, err.loc.end.offset) : '';
	console.error(`[compiler] template ${what}: ${err.message}${at ? `\n  at: ${at}` : ''}`);
}

Vue.registerRuntimeCompiler(compileTemplate);
