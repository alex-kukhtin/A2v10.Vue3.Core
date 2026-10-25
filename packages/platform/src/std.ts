// The std:* modules the platform gives, under their Net48 names, in one place. A function module is created on
// its first require (app.js), so the locale and the runtime are read then, not at load: as Net48's were.

import { createModel } from '@a2v10/model';
import { createAccel } from './accel.js';
import { bus } from './bus.js';
import { withControls } from './controls.js';
import { createHtml } from './html.js';
import { createHttp } from './http.js';
import { createConsole, createLog } from './log.js';
import { createMask } from './mask.js';
import { app, require } from './modules.js';
import { platform } from './platform.js';
import { createPopup } from './popup.js';
import { createSignalR } from './signalr.js';
import { store } from './store.js';
import { createTools } from './tools.js';
import { createUrl } from './url.js';

type Model = ReturnType<typeof createModel>;

let core: Model | null = null;

// The model core, once, with this runtime: std:utils, std:period, std:validators, std:modelInfo, std:datamodel.
function model(): Model {
	return core ??= createModel({
		platform,
		eventBus: bus,
		locale: window.$$locale,
		log: require('std:log') as ReturnType<typeof createLog>
	});
}

Object.assign(app.modules, {
	'std:eventBus': bus,
	'std:platform': platform,
	'std:locale': () => window.$$locale,
	'std:const': () => ({
		SEVERITY: {
			ERROR: 'error',
			WARNING: 'warning',
			INFO: 'info'
		}
	}),
	'std:log': createLog,
	'std:console': createConsole,
	'std:utils': () => withControls(model().utils),
	'std:period': () => model().period,
	'std:validators': () => model().validators,
	'std:modelInfo': () => model().modelInfo,
	'std:datamodel': () => model().datamodel,
	'std:url': () => createUrl(require('std:utils') as Model['utils'], require('std:period') as Model['period']),
	'std:http': () => createHttp(bus),
	'std:dataservice': () => {
		const http = require('std:http') as ReturnType<typeof createHttp>;
		return {
			post: (url: string, data: BodyInit | null, raw?: boolean, hideIndicator?: boolean) => http.post(url, data, raw, hideIndicator),
			get: (url: string) => http.get(url)
		};
	},
	'std:routing': () => ({ dataUrl: () => '_data' }),
	'std:popup': createPopup,
	'std:html': createHtml,
	'std:tools': createTools,
	'std:mask': createMask,
	'std:accel': createAccel,
	'std:signalR': () => createSignalR(bus)
});

app.components['std:store'] = store;
