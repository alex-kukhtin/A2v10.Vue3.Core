// std:http (Net48 services/http.js), unchanged in behaviour but for load and queue: a page is loaded by include,
// which mounts it (Vue 2's load wrote the page's HTML into a container and found the instance by __vue__).
// A refusal is thrown as text: 255 carries the server's message ('UI:' for the user); '__blank__' means it is
// handled already (401: the login page is on its way).

import type { EventBus } from './bus.js';

export function createHttp(eventBus: EventBus) {

	return {
		get,
		post,
		upload,
		localpost
	};

	async function doRequest(method: string, url: string, data: BodyInit | null, raw?: boolean, skipEvents?: boolean): Promise<any> {
		if (!skipEvents)
			eventBus.$emit('beginRequest', url);
		let appver = '';
		let modulever = '';
		try {
			const response = await fetch(url, {
				method,
				mode: 'same-origin',
				headers: {
					'X-Requested-With': 'XMLHttpRequest',
					'Accept': 'application/json, text/html'
				},
				body: data
			});
			const ct = response.headers.get('content-type') || '';
			appver = response.headers.get('app-version') || '';
			modulever = response.headers.get('module-version') || '';
			switch (response.status) {
				case 200:
					if (raw)
						return await response.blob();
					if (ct.startsWith('application/json'))
						return await response.json();
					return await response.text();
				case 255: {
					let txt = response.statusText;
					if (ct.startsWith('text/'))
						txt = await response.text();
					throw txt;
				}
				case 401: // Unauthorized
					setTimeout(() => {
						window.location.assign('/');
					}, 10);
					throw '__blank__';
				case 473: /*non standard */
					if ((response.statusText || (await response.text())) === 'Unauthorized') {
						// go to login page
						setTimeout(() => {
							window.location.assign('/');
						}, 10);
						throw '__blank__';
					}
					break; // resolves with undefined (B27)
				default:
					throw response.statusText;
			}
		} finally {
			if (!skipEvents) {
				eventBus.$emit('endRequest', url);
				if (appver || modulever)
					eventBus.$emit('checkVersion', { app: appver, module: modulever });
			}
		}
	}

	// skipEvents: include's hideIndicator (Net48 load called doRequest with it)
	function get(url: string, raw?: boolean, skipEvents?: boolean): Promise<any> {
		return doRequest('GET', url, null, raw, skipEvents);
	}

	function post(url: string, data: BodyInit | null, raw?: boolean, skipEvents?: boolean): Promise<any> {
		return doRequest('POST', url, data, raw, skipEvents);
	}

	// A status but 200 and 255 resolves with undefined (B27: the switch has no default).
	async function upload(url: string, data: BodyInit): Promise<any> {
		eventBus.$emit('beginRequest', url);
		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'X-Requested-With': 'XMLHttpRequest',
					'Accept': 'application/json'
				},
				body: data
			});
			const ct = response.headers.get('content-type') || '';
			switch (response.status) {
				case 200:
					if (ct.startsWith('application/json'))
						return await response.json();
					return await response.text();
				case 255: {
					let txt = response.statusText;
					if (ct.startsWith('text/'))
						txt = await response.text();
					throw txt;
				}
			}
		} finally {
			eventBus.$emit('endRequest', url);
		}
	}

	// The local agent of the workstation (printing, devices).
	async function localpost(command: string, data: BodyInit | null): Promise<any> {
		const url = 'http://127.0.0.1:64031/' + command;
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'X-Requested-With': 'XMLHttpRequest',
				'Accept': 'text/plain',
				'Content-Type': 'text/plain'
			},
			body: data
		});

		if (response.status == 200) {
			const ct = response.headers.get('content-type') || '';
			if (ct.startsWith('application/json'))
				return await response.json();
			return await response.text();
		} else if (response.status == 255) {
			throw await response.text() || response.statusText;
		} else {
			throw response.statusText;
		}
	}
}
