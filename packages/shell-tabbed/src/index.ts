// The tabbed shell on Vue 3, delivered as a2v10-shell-tabbed.js after a2v10-core.js. Loading it registers its
// components; start, called by the server's shell script (/_shell/script), creates the document's one app.

import './modal.js';
import './toastr.js';
import './debug.js';
import './header.js';
import './navbar.js';
import './doctitle.js';
import { shellPlain } from './shell.js';
import { app as registry, attach } from './platform.js';
import { createApp } from 'vue';

registry.components['std:shellPlain'] = shellPlain;

// The shell's markup is the page's #shell, whole (its root carries v-cloak and classes): the template. Vue 3 renders
// into a container and keeps it, so #shell is replaced by an element that the app renders #shell into; the container
// generates no box (display: contents), and #shell is sized against body as it was (.mdi-shell: height 100%).
// data: the shell's (Resources/shellPlain.js: version, menu, columns, title, subtitle, userState, isDebug, appData).
export function start(selector: string, data: Record<string, unknown>): void {
	const host = document.querySelector(selector);
	if (!host)
		throw new Error(`shell: no element '${selector}' to start in`);
	const template = host.outerHTML;
	const container = document.createElement('div');
	container.style.display = 'contents';
	host.replaceWith(container);
	const app = createApp({
		extends: shellPlain,
		data: () => data,
		template
	});
	attach(app);
	app.mount(container);
}
