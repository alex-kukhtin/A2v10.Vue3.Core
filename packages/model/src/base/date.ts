// Dates. Local time throughout: the server sends and takes local time without a zone.
// Pure: no runtime, no locale (a date's text is the locale's: locale/format.ts).

import { isDate } from './is.js';

export const utcdatRegEx = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?$/;

// One instance: zero() returns it, isZero compares a day with it.
const zeroDate = new Date(0, 0, 1, 0, 0, 0, 0);

export function zero(): Date {
	return zeroDate;
}

export function today(): Date {
	const td = new Date();
	td.setHours(0, 0, 0, 0);
	return td;
}

export function now(second?: boolean): Date {
	const td = new Date();
	const sec = second ? td.getSeconds() : 0;
	return new Date(td.getFullYear(), td.getMonth(), td.getDate(), td.getHours(), td.getMinutes(), sec, 0);
}

// month: 1-based.
export function create(year: number, month: number, day: number): Date {
	return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export function createTime(year: number, month: number, day: number, hour?: number, min?: number, sec?: number): Date {
	return new Date(year, month - 1, day, hour || 0, min || 0, sec || 0, 0);
}

export const minDate = create(1901, 1, 1);
export const maxDate = create(2999, 12, 31);

export function fromServer(src: Date | string): Date {
	if (isDate(src))
		return src;
	return new Date(src);
}

export function fromDays(days: number): Date {
	return new Date(1900, 0, days, 0, 0, 0, 0);
}

export function equal(d1: Date, d2: Date): boolean {
	return d1.getFullYear() === d2.getFullYear() &&
		d1.getMonth() === d2.getMonth() &&
		d1.getDate() === d2.getDate();
}

export function isZero(d1: unknown): boolean {
	if (d1 === null) return true;
	if (!isDate(d1)) return false;
	return equal(d1, zero());
}

export function hasTime(d1: unknown): boolean {
	if (!isDate(d1)) return false;
	return d1.getHours() !== 0 || d1.getMinutes() !== 0 || d1.getSeconds() !== 0;
}

export function compare(d1: unknown, d2: unknown): number | null {
	if (!isDate(d1) || !isDate(d2)) return null;
	return d1.getTime() - d2.getTime();
}

export function endOfMonth(dt: Date): Date {
	return new Date(dt.getFullYear(), dt.getMonth() + 1, 0, 0, 0, 0);
}

// The date of a server or url text: an ISO local time, yyyyMMdd, or "\/"…"\/"; a Date passes.
// Text that is no date comes back as it is.
export function tryParse(str: any): any {
	if (!str) return zero();
	if (isDate(str)) return str;
	if (utcdatRegEx.test(str))
		return fromServer(str);
	let dt: Date;
	if (str.length === 8)
		dt = new Date(+str.substring(0, 4), +str.substring(4, 6) - 1, +str.substring(6, 8), 0, 0, 0, 0);
	else if (str.startsWith('\"\\/\"'))
		dt = fromServer(str.substring(4, str.length - 4));
	else
		dt = fromServer(str);
	if (!isNaN(dt.getTime()))
		return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 0, 0, 0, 0);
	return str;
}

// Midnight of a date text; text no Date accepts comes back as it is.
export function string2Date(str: any): any {
	try {
		const dt = new Date(str);
		dt.setHours(0, 0, 0, 0);
		return dt;
	} catch {
		return str;
	}
}

export function parseTime(str: string): Date {
	str = str || '';
	const seg = str.split(/[^\d]/).filter(x => x);
	if (seg.length === 0)
		return new Date(1970, 0, 1, 0, 0, 0, 0);
	else if (seg.length === 1)
		seg.push('0');
	const h = Math.min(+seg[0], 23);
	const m = Math.min(+seg[1], 59);
	return new Date(1970, 0, 1, h, m, 0, 0);
}

// The date a user typed: d, d.M, d.M.y, ddMMyyyy, or an ISO local time. A missing month or year is
// today's; a two-digit year is 20xx up to yearCutOff ('+10': ten years ahead of today), else 19xx.
export function parse(str: string, yearCutOff?: string): Date {
	str = str || '';
	if (utcdatRegEx.test(str))
		return new Date(str);
	if (!str) return zero();
	const td = today();
	let seg = str.split(/[^\d]/).filter(x => x);
	if (seg.length === 1) {
		if (seg[0].length === 8) {
			const x = seg[0]; // ddMMyyyy
			seg = [x.substring(0, 2), x.substring(2, 4), x.substring(4)];
		} else {
			seg.push('' + (td.getMonth() + 1));
			seg.push('' + td.getFullYear());
		}
	}
	else if (seg.length === 2) {
		seg.push('' + td.getFullYear());
	}

	function cutOffYear(year: string): string {
		const yco = yearCutOff || '+10';
		const th = (yco.startsWith('+') || yco.startsWith('-')) ? (td.getFullYear() % 100 + parseInt(yco, 10)) : (+yco % 100);
		return +year <= th ? '20' : '19';
	}

	function normalizeYear(y: string): number {
		switch (y.length) {
			case 1: return +(cutOffYear(y) + '0' + y);
			case 2: return +(cutOffYear(y) + y);
			case 4: return +y;
			default: return td.getFullYear();
		}
	}

	const dt = new Date(normalizeYear('' + seg[2]), +(+(seg[1] ? seg[1] : 1) - 1), +seg[0], 0, 0, 0, 0);
	if (isNaN(dt.getDate()))
		return zero();
	return dt;
}

export type DateUnit = 'second' | 'minute' | 'hour' | 'day' | 'month' | 'year';

// Whole units from d1 to d2, either order. 'day' counts calendar days across a DST shift.
export function diff(unit: DateUnit, d1: Date, d2: Date): number {
	if (d1.getTime() > d2.getTime())
		[d1, d2] = [d2, d1];
	const timezoneDiff = (d1.getTimezoneOffset() - d2.getTimezoneOffset()) * 60 * 1000;
	const ms = d2.getTime() - d1.getTime();
	switch (unit) {
		case 'second':
			return ms / 1000;
		case 'minute':
			return +((ms / 1000) / 60).toFixed(0);
		case 'month': {
			const delta = d2.getDate() < d1.getDate() ? -1 : 0;
			if (d1.getFullYear() === d2.getFullYear())
				return d2.getMonth() - d1.getMonth() + delta;
			let month = 0;
			let year = d1.getFullYear();
			while (year < d2.getFullYear()) {
				let day = d2.getDate();
				const dayOfMonth = endOfMonth(new Date(year + 1, d1.getMonth(), 1, 0, 0, 0, 0)).getDate();
				if (day > dayOfMonth)
					day = dayOfMonth;
				d1 = new Date(year + 1, d1.getMonth(), day, 0, 0, 0, 0);
				year = d1.getFullYear();
				month += 12;
			}
			month += d2.getMonth() - d1.getMonth();
			return month + delta;
		}
		case 'day':
			return Math.floor((ms + timezoneDiff) / (1000 * 60 * 60 * 24));
		case 'year': {
			const dd = new Date(d1.getFullYear(), d2.getMonth(), d2.getDate(), d2.getHours(), d2.getMinutes(), d2.getSeconds(), d2.getMilliseconds());
			const t = dd.getTime(), t1 = d1.getTime(), t2 = d2.getTime();
			const dy = t < t1 ? (t2 > t1 ? -1 : 0) : (t2 < t1 ? 1 : 0);
			return d2.getFullYear() - d1.getFullYear() + dy;
		}
	}
	throw new Error('Invalid unit value for utils.date.diff');
}

// year, month, day: calendar steps at midnight (a month keeps its day, clamped); the rest: elapsed time.
export function add(dt: unknown, nm: number, unit: DateUnit): Date | null {
	if (!isDate(dt))
		return null;
	let du = 0;
	switch (unit) {
		case 'year':
			return new Date(dt.getFullYear() + nm, dt.getMonth(), dt.getDate(), 0, 0, 0, 0);
		case 'month': {
			const newMonth = dt.getMonth() + nm;
			let day = dt.getDate();
			const ldm = new Date(dt.getFullYear(), newMonth + 1, 0, 0, 0).getDate();
			if (day > ldm)
				day = ldm;
			return new Date(dt.getFullYear(), newMonth, day, 0, 0, 0);
		}
		case 'day':
			return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + nm, 0, 0, 0, 0);
		case 'hour':
			du = 1000 * 60 * 60;
			break;
		case 'minute':
			du = 1000 * 60;
			break;
		case 'second':
			du = 1000;
			break;
		default:
			throw new Error('Invalid unit value for utils.date.add');
	}
	return new Date(dt.getTime() + nm * du);
}

// Minutes of a day ↔ 'h:mm'.
export function int2time(val: number): string {
	if (!val) return '';
	const h = Math.floor(val / 60), m = val % 60;
	const mm = m < 10 ? '0' + m : m;
	return (h || mm) ? `${h}:${mm}` : '';
}

export function time2int(val: string): number {
	const v = (val || '').split(':');
	const h = v[0];
	const m = v.length > 1 ? v[1] : 0;
	return +h * 60 + (+m);
}
