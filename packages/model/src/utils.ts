// std:utils as the components and the applications know it, assembled from base/ and the locale.
// Not here, on purpose: text.applyFilters, mapTagColor (and toLatin under applyFilters) serve the
// controls only, and applyFilters calls eval. The platform adds them when it registers std:utils.

import * as date from './base/date.js';
import { currencyRound, curry, debounce, defPropertyGet } from './base/func.js';
import {
	isArray, isBoolean, isDate, isDateCtor, isDefined, isEmptyObject, isFunction, isNumber,
	isObject, isObjectExact, isPrimitiveCtor, isPromise, isString
} from './base/is.js';
import { toJson } from './base/json.js';
import { propFromPath, simpleEval } from './base/path.js';
import { capitalize, contains, containsText, equalNoCase, maxChars, sanitize, splitPath } from './base/text.js';
import {
	clearObject, defaultValue, getStringId, isEqual, isPlainObjectEmpty, mergeTemplate, notBlank, toBoolean, toString
} from './base/value.js';
import type { Format } from './locale/format.js';

// file: the runtime's File, a scalar property type like String and Date.
export function createUtils(fmt: Format, file: Function) {
	return {
		isArray, isFunction, isDefined,
		isObject, isObjectExact,
		isDate, isString, isNumber, isBoolean,
		isPromise,
		toString,
		toBoolean,
		defaultValue,
		notBlank,
		toJson,
		fromJson: JSON.parse,
		isPrimitiveCtor: (ctor: unknown) => isPrimitiveCtor(ctor, file),
		isDateCtor,
		isEmptyObject,
		defineProperty: defPropertyGet,
		eval: fmt.evaluate,
		simpleEval,
		format: fmt.format,
		convertToString: fmt.convertToString,
		toNumber: fmt.toNumber,
		parse: fmt.parse,
		getStringId,
		isEqual,
		ensureType: fmt.ensureType,
		clearObject,
		isPlainObjectEmpty,
		date: {
			today: date.today,
			now: date.now,
			zero: date.zero,
			parse: date.parse,
			tryParse: date.tryParse,
			equal: date.equal,
			isZero: date.isZero,
			formatDate: fmt.formatDate,
			format: fmt.formatDateWithFormat,
			add: date.add,
			diff: date.diff,
			create: date.create,
			createTime: date.createTime,
			compare: date.compare,
			endOfMonth: date.endOfMonth,
			minDate: date.minDate,
			maxDate: date.maxDate,
			fromDays: date.fromDays,
			parseTime: date.parseTime,
			fromServer: date.fromServer,
			int2time: date.int2time,
			time2int: date.time2int
		},
		text: {
			contains,
			containsText,
			sanitize,
			splitPath,
			capitalize,
			maxChars,
			equalNoCase
		},
		currency: {
			round: currencyRound,
			format: fmt.currencyFormat
		},
		func: {
			curry,
			debounce,
			defPropertyGet
		},
		debounce,
		model: {
			propFromPath
		},
		mergeTemplate
	};
}

export type Utils = ReturnType<typeof createUtils>;
