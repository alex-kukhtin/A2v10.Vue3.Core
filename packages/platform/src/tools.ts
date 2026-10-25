// std:tools (Net48 services/tools.js), unchanged in behaviour: an alert through the shell's confirm (bus 'confirm'),
// for code with no page at hand (the controls).

import { bus } from './bus.js';

export function createTools() {
	return {
		alert
	};

	function alert(msg: string, title?: string, list?: unknown): Promise<unknown> {
		const dlgData = {
			promise: null as Promise<unknown> | null, data: {
				message: msg, title: title, style: 'alert', list: list
			}
		};
		bus.$emit('confirm', dlgData);
		return dlgData.promise!;
	}
}
