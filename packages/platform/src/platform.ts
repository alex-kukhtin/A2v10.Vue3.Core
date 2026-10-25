// std:platform on Vue 3 (Net48 platform/webvue.js on Vue 2): the seam through which the model core reaches the
// runtime. set is a plain assignment: the model is read through reactive(), whose proxy tracks it.
// defer runs after the update: nextTick.

import { nextTick } from 'vue';
import type { Platform } from '@a2v10/model';

export const platform: Platform & { print(): void } = {
	set(target: object, prop: string, value: unknown): void {
		(target as Record<string, unknown>)[prop] = value;
	},
	defer(fn: () => void): void {
		nextTick(fn);
	},
	print(): void {
		window.print();
	},
	File,
	performance
};
