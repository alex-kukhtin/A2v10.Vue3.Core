// A period of dates (TPeriod: From, To) and the named periods of the period menu.
// One TPeriod class per core: the model tells a period property by this constructor.

import type { Locale } from '../runtime.js';
import * as date from '../base/date.js';
import { isObject } from '../base/is.js';
import type { DataType, Format } from './format.js';

export type PeriodKey = 'today' | 'yesterday' | 'last7' | 'last30' | 'startMonth' | 'prevMonth' | 'currMonth'
	| 'startQuart' | 'currQuart' | 'prevQuart' | 'startYear' | 'currYear' | 'prevYear' | 'allData' | 'custom';

export function createPeriod(locale: Locale, fmt: Format) {

	class TPeriod {
		declare From: Date;
		declare To: Date;
		declare readonly Name: string;

		// From a server or url object { From, To }; none, or both empty: all the data.
		constructor(source?: any) {
			if (source && 'From' in source) {
				if (!source.From && !source.To) {
					this.From = date.minDate;
					this.To = date.maxDate;
				} else {
					this.From = date.tryParse(source.From);
					this.To = date.tryParse(source.To);
				}
			} else {
				this.From = date.minDate;
				this.To = date.maxDate;
			}
			Object.defineProperty(this, 'Name', {
				enumerable: true,
				get() { return this.format('Date'); }
			});
		}

		assign(v: any): this {
			if (isPeriod(v)) {
				this.From = v.From;
				this.To = v.To;
			} else if (v.From === null && v.To === null) {
				this.From = date.minDate;
				this.To = date.maxDate;
			} else {
				this.From = date.tryParse(v.From);
				this.To = date.tryParse(v.To);
			}
			return this.normalize();
		}

		equal(p: TPeriod): boolean {
			return date.equal(this.From, p.From) && date.equal(this.To, p.To);
		}

		// { From, To }, 'yyyyMMdd-yyyyMMdd', 'yyyyMMdd', or 'all'.
		fromUrl(v: any): this {
			if (isObject(v) && 'From' in v) {
				this.From = date.tryParse((v as any).From);
				this.To = date.tryParse((v as any).To);
				return this.normalize();
			}
			const px = (v || '').split('-');
			if (px[0].toLowerCase() === 'all') {
				this.From = date.minDate;
				this.To = date.maxDate;
				return this;
			}
			this.From = date.tryParse(px[0]);
			this.To = date.tryParse(px.length > 1 ? px[1] : px[0]);
			return this;
		}

		isAllData(): boolean {
			return this.From.getTime() === date.minDate.getTime() &&
				this.To.getTime() === date.maxDate.getTime();
		}

		format(dataType: DataType): string {
			if (this.isAllData())
				return dataType === 'DateUrl' ? 'All' : locale.$AllPeriodData;
			const from = this.From;
			const to = this.To;
			if (from.getTime() === to.getTime())
				return fmt.format(from, dataType);
			if (dataType === 'DateUrl')
				return fmt.format(from, dataType) + '-' + fmt.format(to, dataType);
			return fmt.format(from, dataType) + ' - ' + (fmt.format(to, dataType) || '???');
		}

		// The menu name of a named period; else the custom-period text, or the dates.
		text(showCustom?: boolean): string {
			if (this.isAllData())
				return locale.$AllPeriodData;
			for (const mi of predefined(false)) {
				if (this.equal(create(mi.key)))
					return mi.name;
			}
			if (showCustom)
				return locale.$CustomPeriod;
			return fmt.format(this.From, 'Date') + ' - ' + (fmt.format(this.To, 'Date') || '???');
		}

		// undefined when a bound is the zero date.
		in(dt: Date): boolean | undefined {
			const t = dt.getTime();
			const zd = date.zero().getTime();
			if (this.From.getTime() === zd || this.To.getTime() === zd) return;
			return t >= this.From.getTime() && t <= this.To.getTime();
		}

		normalize(): this {
			if (this.From.getTime() > this.To.getTime())
				[this.From, this.To] = [this.To, this.From];
			return this;
		}

		set(from: Date, to: Date): this {
			this.From = from;
			this.To = to;
			return this.normalize();
		}

		setFrom(from: Date): this {
			this.From = from;
			if (this.To.getTime() < this.From.getTime())
				this.To = this.From;
			return this;
		}

		setTo(to: Date): this {
			this.To = to;
			if (this.From.getTime() > this.To.getTime())
				this.From = this.To;
			return this;
		}

		toJson(): string {
			return JSON.stringify(this);
		}
	}

	function isPeriod(value: unknown): value is TPeriod {
		return value instanceof TPeriod;
	}

	// A plain { From, To } and nothing else.
	function like(obj: any): boolean {
		if (!obj)
			return false;
		if (Object.getOwnPropertyNames(obj).length !== 2)
			return false;
		return obj.hasOwnProperty('From') && obj.hasOwnProperty('To');
	}

	function zero(): TPeriod {
		return new TPeriod();
	}

	function all(): TPeriod {
		return create('allData');
	}

	function predefined(showAll: boolean): { name: string, key: PeriodKey }[] {
		const menu: { name: string, key: PeriodKey }[] = [
			{ name: locale.$Today, key: 'today' },
			{ name: locale.$Yesterday, key: 'yesterday' },
			{ name: locale.$Last7Days, key: 'last7' },
			{ name: locale.$CurrMonth, key: 'currMonth' },
			{ name: locale.$PrevMonth, key: 'prevMonth' },
			{ name: locale.$CurrQuart, key: 'currQuart' },
			{ name: locale.$PrevQuart, key: 'prevQuart' },
			{ name: locale.$CurrYear, key: 'currYear' },
			{ name: locale.$PrevYear, key: 'prevYear' }
		];
		if (showAll)
			menu.push({ name: locale.$AllPeriodData, key: 'allData' });
		return menu;
	}

	// A named period relative to today; 'custom' from..to.
	function create(key: PeriodKey, from?: Date, to?: Date): TPeriod {
		const today = date.today();
		const year = today.getFullYear();
		const p = zero();
		const add = (d: Date, n: number) => date.add(d, n, 'day') as Date;
		switch (key) {
			case 'today':
				p.set(today, today);
				break;
			case 'yesterday': {
				const yesterday = add(today, -1);
				p.set(yesterday, yesterday);
				break;
			}
			case 'last7': // today included
				p.set(add(today, -6), today);
				break;
			case 'last30': // today included
				p.set(add(today, -29), today);
				break;
			case 'startMonth':
				p.set(date.create(year, today.getMonth() + 1, 1), today);
				break;
			case 'prevMonth':
				p.set(date.create(year, today.getMonth(), 1), add(date.create(year, today.getMonth() + 1, 1), -1));
				break;
			case 'currMonth':
				p.set(date.create(year, today.getMonth() + 1, 1), add(date.create(year, today.getMonth() + 2, 1), -1));
				break;
			case 'startQuart': {
				const q = Math.floor(today.getMonth() / 3);
				p.set(date.create(year, q * 3 + 1, 1), today);
				break;
			}
			case 'currQuart': {
				const q = Math.floor(today.getMonth() / 3);
				p.set(date.create(year, q * 3 + 1, 1), add(date.create(year, (q + 1) * 3 + 1, 1), -1));
				break;
			}
			case 'prevQuart': {
				let y = year;
				let q = Math.floor(today.getMonth() / 3) - 1;
				if (q < 0) {
					y -= 1;
					q = 3;
				}
				p.set(date.create(y, q * 3 + 1, 1), add(date.create(y, (q + 1) * 3 + 1, 1), -1));
				break;
			}
			case 'startYear':
				p.set(date.create(year, 1, 1), today);
				break;
			case 'currYear':
				p.set(date.create(year, 1, 1), date.create(year, 12, 31));
				break;
			case 'prevYear':
				p.set(date.create(year - 1, 1, 1), date.create(year - 1, 12, 31));
				break;
			case 'allData':
				p.set(date.minDate, date.maxDate);
				break;
			case 'custom':
				p.set(from as Date, to as Date);
				break;
			default:
				console.error('invalid menu key: ' + key);
		}
		return p;
	}

	return {
		isPeriod,
		like,
		constructor: TPeriod,
		zero,
		all,
		create,
		predefined
	};
}

export type Periods = ReturnType<typeof createPeriod>;
export type TPeriod = InstanceType<Periods['constructor']>;
