// What the model's modules share: the runtime's platform and log, and the core's own services.

import type { Log, Platform } from '../runtime.js';
import type { Format } from '../locale/format.js';
import type { Periods } from '../locale/period.js';
import type { Rules } from './rules.js';

export interface ModelContext {
	platform: Platform;
	log?: Log;
	format: Format;
	period: Periods;
	rules: Rules;
}

export function logInfo(ctx: ModelContext, msg: string): void {
	if (ctx.log)
		ctx.log.info(msg);
}

export function logTime(ctx: ModelContext, msg: string, start: number): void {
	if (ctx.log)
		ctx.log.time(msg, start);
}
