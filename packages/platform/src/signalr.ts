// std:signalR (A2v10.Core Web/A2v10.Core.Web.Site/Scripts/signalr.js): the user hub. A signal from the server is
// emitted on the bus as signalEvent. The client library (signalr.min.js) is the layout's, loaded before.

import type { EventBus } from './bus.js';

declare const signalR: any;

export function createSignalR(eventBus: EventBus) {
	const connection = new signalR.HubConnectionBuilder()
		.withUrl('/_userhub')
		.withAutomaticReconnect()
		.configureLogging(signalR.LogLevel.Information)
		.build();

	connection.on('signal', (event: string, data: unknown) => {
		eventBus.$emit('signalEvent', { event, data });
	});

	return {
		startService
	};

	async function startService(): Promise<void> {
		try {
			await connection.start();
			console.log('SignalR Connected.');
		} catch (err) {
			console.log(err);
			setTimeout(startService, 5000); // Net48: setTimeout(start), start undeclared (B31)
		}
	}
}
