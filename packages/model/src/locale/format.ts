// Text of values and values of text, in the locale's culture: dates, numbers, currency, percent.
// The number parser is the locale's too: it drops the culture's grouping symbol.

import type { Locale } from '../runtime.js';
import * as date from '../base/date.js';
import { isDate, isNumber, isObject, isObjectExact, isString, isDefined } from '../base/is.js';
import { toJson } from '../base/json.js';
import { simpleEval } from '../base/path.js';
import { capitalize } from '../base/text.js';
import { defaultValue, toBoolean, toString } from '../base/value.js';

export type DataType = 'DateTime' | 'DateTime2' | 'Date' | 'DateUrl' | 'Time' | 'Period' | 'Currency' | 'Number' | 'Percent';

export interface FormatOptions {
	format?: string;    // a date pattern (dd.MM.yyyy HH:mm…) or a number pattern (#,##0.00)
	hideZeros?: boolean;
}

function pad2(num: number): string {
	return num < 10 ? '0' + num : '' + num;
}

export function createFormat(locale: Locale) {
	const dateLocale = locale.$DateLocale || locale.$Locale;
	const numLocale = locale.$NumberLocale || locale.$Locale;

	const _2digit = '2-digit';
	const formatDate = new Intl.DateTimeFormat(dateLocale, { year: 'numeric', month: _2digit, day: _2digit }).format;
	const formatTime = new Intl.DateTimeFormat(dateLocale, { hour: _2digit, minute: _2digit }).format;
	const formatTime2 = new Intl.DateTimeFormat(dateLocale, { hour: _2digit, minute: _2digit, second: _2digit }).format;

	const currencyFormat = new Intl.NumberFormat(numLocale, { minimumFractionDigits: 2, maximumFractionDigits: 6, useGrouping: true }).format;
	const nf = new Intl.NumberFormat(numLocale, { minimumFractionDigits: 0, maximumFractionDigits: 6, useGrouping: true });
	const numberFormat = nf.format;

	// 1000.5 → integer, group, integer, decimal, fraction
	const groupingSymbol = nf.formatToParts(1000.5)[1].value;

	const numFormatCache: Record<string, (n: number) => string> = {};

	// '#,##0.00': [#,] grouping, # and 0 integer digits, 0 and # fraction digits.
	function formatNumber(num: number, format?: string): string | number {
		if (!format)
			return numberFormat(num);
		if (numFormatCache[format])
			return numFormatCache[format](num);
		const fmt = format.match(/^([#][,\s])?(#*)?(0*)?\.?(0*)?(#*)?$/);
		if (!fmt) {
			console.error(`Invalid number format: '${format}'`);
			return num;
		}
		const len = (x: string | undefined) => x ? x.length : 0;
		const fi0 = len(fmt[3]), fp0 = len(fmt[4]), fph = len(fmt[5]);
		const formatFunc = new Intl.NumberFormat(numLocale, {
			minimumFractionDigits: fp0,
			maximumFractionDigits: fp0 + fph,
			minimumIntegerDigits: fi0,
			useGrouping: !!fmt[1]
		}).format;
		numFormatCache[format] = formatFunc;
		return formatFunc(num);
	}

	// yyyy yy MM dd HH hh mm ss tt
	function formatDatePattern(dt: Date, format: string): string {
		if (!dt) return '';
		const parts: Record<string, string | number> = {
			yyyy: dt.getFullYear(),
			yy: ('' + dt.getFullYear()).substring(2),
			MM: pad2(dt.getMonth() + 1),
			dd: pad2(dt.getDate()),
			HH: pad2(dt.getHours()),
			hh: pad2(dt.getHours() > 12 ? dt.getHours() - 12 : dt.getHours()),
			mm: pad2(dt.getMinutes()),
			ss: pad2(dt.getSeconds()),
			tt: dt.getHours() < 12 ? 'AM' : 'PM'
		};
		return format.replace(/yyyy|yy|MM|dd|HH|hh|mm|ss|tt/g, match => '' + parts[match]);
	}

	function formatDateWithFormat(dt: Date, format?: string): string {
		if (!format)
			return formatDate(dt);
		switch (format) {
			case 'dd.MM':
				return `${pad2(dt.getDate())}.${pad2(dt.getMonth() + 1)}`;
			case 'ddMMyyyy':
				return '' + pad2(dt.getDate()) + pad2(dt.getMonth() + 1) + dt.getFullYear();
			case 'dd.MM.yyyy HH:mm:ss':
				return `${formatDate(dt)}  ${formatTime2(dt)}`;
			case 'MM.yyyy':
				return `${pad2(dt.getMonth() + 1)}.${dt.getFullYear()}`;
			case 'MMMM yyyy':
				return capitalize(dt.toLocaleDateString(locale.$Locale, { month: 'long', year: 'numeric' }));
			default:
				return formatDatePattern(dt, format);
		}
	}

	// The display text of a value; without a dataType the value itself.
	function format(obj: any, dataType?: DataType, opts?: FormatOptions): any {
		opts = opts || {};
		if (!dataType)
			return obj;
		if (!isDefined(obj))
			return '';
		switch (dataType) {
			case 'DateTime':
			case 'DateTime2': {
				if (!obj) return '';
				if (!isDate(obj)) {
					console.error(`Invalid Date for utils.format (${obj})`);
					return obj;
				}
				if (date.isZero(obj))
					return '';
				if (opts.format)
					return formatDateWithFormat(obj, opts.format);
				const fnTime = dataType === 'DateTime2' ? formatTime2 : formatTime;
				return `${formatDate(obj)} ${fnTime(obj)}`;
			}
			case 'Date':
				if (!obj) return '';
				if (isString(obj))
					obj = date.string2Date(obj);
				if (!isDate(obj)) {
					console.error(`Invalid Date for utils.format (${obj})`);
					return obj;
				}
				if (date.isZero(obj))
					return '';
				if (opts.format)
					return formatDateWithFormat(obj, opts.format);
				return formatDate(obj);
			case 'DateUrl':
				if (date.isZero(obj))
					return '';
				if (date.hasTime(obj))
					return obj.toJSON();
				return '' + obj.getFullYear() + pad2(obj.getMonth() + 1) + pad2(obj.getDate());
			case 'Time':
				if (!isDate(obj)) {
					console.error(`Invalid Date for utils.format (${obj})`);
					return obj;
				}
				if (date.isZero(obj))
					return '';
				return formatTime(obj);
			case 'Period':
				if (!obj.format) {
					console.error(`Invalid Period for utils.format (${obj})`);
					return obj;
				}
				return obj.format('Date');
			case 'Currency':
				if (!isNumber(obj))
					obj = toNumber(obj);
				if (opts.hideZeros && obj === 0)
					return '';
				if (opts.format)
					return formatNumber(obj, opts.format);
				return currencyFormat(obj);
			case 'Number':
				if (!isNumber(obj))
					obj = toNumber(obj);
				if (opts.hideZeros && obj === 0)
					return '';
				return formatNumber(obj, opts.format);
			case 'Percent':
				if (!isNumber(obj))
					obj = toNumber(obj);
				if (opts.hideZeros && obj === 0)
					return '';
				return formatNumber((+obj) * 100, opts.format) + '%';
			default:
				console.error(`Invalid DataType for utils.format (${dataType})`);
		}
		return obj;
	}

	// '1 234,5' → 1234.5; not a number → 0.
	function toNumber(val: any): number {
		if (isString(val)) {
			val = val.replaceAll(groupingSymbol, '');
			val = val.replace(/\s|%/g, '').replace(',', '.');
		}
		return isFinite(val) ? +val : 0;
	}

	// The value of a typed text.
	function parse(obj: any, dataType?: string): any {
		switch (dataType) {
			case 'Currency':
			case 'Number':
				return toNumber(obj);
			case 'Percent':
				return toNumber(obj) / 100.0;
			case 'Date':
				return date.parse(obj);
		}
		return obj;
	}

	// The value a property of this type holds when assigned val: what the model's setter stores.
	function ensureType(type: unknown, val: any): any {
		if (!isDefined(val))
			val = defaultValue(type);
		if (type === Number)
			return toNumber(val);
		else if (type === String)
			return toString(val);
		else if (type === Boolean)
			return toBoolean(val);
		else if (type === Date && !isDate(val))
			return date.parse('' + val);
		return val;
	}

	// The display text at a path of obj.
	function evaluate(obj: any, path: string, dataType?: DataType, opts?: FormatOptions, skipFormat?: boolean): any {
		const r = simpleEval(obj, path);
		if (skipFormat) return r;
		if (isDate(r))
			return format(r, dataType, opts);
		else if (isObject(r))
			return toJson(r);
		return format(r, dataType, opts);
	}

	// An element by its Name, a date by the culture. Net48 returned '' + val (NET48-BUGS.md B1, fixed).
	function convertToString(obj: any): string {
		if (!obj)
			return '';
		if (isObjectExact(obj) && 'Name' in obj)
			return obj.Name;
		else if (isDate(obj))
			return formatDate(obj);
		return '' + obj;
	}

	return {
		formatDate,
		formatDateWithFormat,
		currencyFormat,
		format,
		toNumber,
		parse,
		ensureType,
		evaluate,
		convertToString
	};
}

export type Format = ReturnType<typeof createFormat>;
