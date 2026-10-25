// The document's one app, as the platform wants it: a shell creates it and attaches it here, before mount.
// An error in a render, a hook or a watcher is logged and the update goes on, as Vue 2 did (and Vue 3's production
// build does): Vue 3's development build rethrows it out of the scheduler, and the rest of that update is lost
// (seen: the navbar's menu stays open, a new tab is not drawn).

import type { App } from 'vue';
import { attach as attachVocabulary } from './vocabulary.js';

export function attach(app: App): void {
	app.config.errorHandler = (err, _instance, info) => {
		console.error(`Error in ${info}:`, err);
	};
	attachVocabulary(app);
}
