// JSON of model data, as the server takes it. Pure but for installDateToJson.

import * as date from './date.js';

// Members named $… and _… are the model's own, not data; a zero date is no value.
export function toJson(data: unknown): string {
	return JSON.stringify(data, function (this: any, key: string, value: unknown) {
		if (date.isZero(this[key])) return undefined; // value is already the string
		return key[0] === '$' || key[0] === '_' ? undefined : value;
	}, 2);
}

// A Date serializes as its local time with no zone ('2025-03-30T00:00:00.000'), as the server reads it.
// Global: JSON.stringify of any data on the page must agree. Net48 put this in platform/polyfills.js.
export function installDateToJson(): void {
	Date.prototype.toJSON = function () {
		// the sv locale writes ISO date and time
		return this.toLocaleString('sv').replace(' ', 'T') + '.000';
	};
}
