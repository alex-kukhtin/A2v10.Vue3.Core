// a2-big-calendar (A2v10.Core Scripts/bigcalendar.js), unchanged in behaviour: events by a month or by a week of half
// hours; item[prop] the date shown, viewItem[viewProp] the view ('week', 'month'); a click on a day, an hour or an
// event goes to delegates.ClickDay, ClickEvent. In a week the current time's line is redrawn every 10 seconds.
// destroyed is unmounted.

import { defineComponent } from 'vue';
import { require, vocabulary } from './platform.js';

const TODAY_COLOR = "#fffff080"; // sync with LESS!
const locale = window.$$locale as any;
const dateLocale = locale.$DateLocale || locale.$Locale;
const monthLocale = locale.$Locale; // for text

const utils = require('std:utils');
const tu = utils.text;
const du = utils.date;

type CalEvent = { Date: Date, Name: string, Duration: number, Color?: string };

vocabulary.component('a2-big-calendar', defineComponent({
	template: `
<div class="a2-big-calendar">
<div class="top-bar">
	<div class="toolbar">
		<button class="btn btn-tb btn-icon" @click="nextPart(-1)"><i class="ico ico-arrow-left"></i></button>
		<button class="btn btn-tb btn-icon" @click="nextPart(1)"><i class="ico ico-arrow-right"></i></button>
		<button class="btn btn-tb btn-icon" @click="todayPart"><i class="ico ico-calendar-today"></i> <span v-text="locale.$Today"></span></button>
		<slot name="leftbar"></slot>
	</div>
	<div class="title">
		<span v-text=topTitle></span>
	</div>
	<div class="toolbar">
		<button class="btn btn-tb btn-icon" @click="setView('week')"><i class="ico ico-calendar-week"></i> <span v-text="locale.$Week"></span></button>
		<button class="btn btn-tb btn-icon" @click="setView('month')"><i class="ico ico-calendar"></i> <span v-text="locale.$Month"></span></button>
		<slot name="topbar"></slot>
	</div>
</div>
<div v-if="isView('month')" class="bc-month-conainer bc-container" ref="mc">
<table class="bc-month bc-table">
	<thead>
		<tr class="weekdays"><th v-for="d in 7" v-text="wdTitle(d)"></th></tr>
	</thead>
	<tbody>
		<tr v-for="row in days">
			<td v-for="day in row" class=bc-day :class="dayClass(day)" @click.stop.prevent="clickDay(day)">
				<div v-text="day.getDate()" class="day-date"></div>
				<div class="bc-day-body">
					<div v-for="(ev, ix) in dayEvents(day)" :key=ix class="day-event"
							:style="{backgroundColor: ev.Color || ''}" @click.stop.prevent="clickEvent(ev)">
						<slot name="monthev" v-bind:item="ev" class="me-body">
							<span class="me-body" v-text="eventTitle(ev)" :title="eventTitle(ev)"/>
						</slot>
					</div>
				</div>
			</td>
		</tr>
	</tbody>
</table>
</div>
<div v-if="isView('week')" class="bc-week-container bc-container" ref=wc>
	<table class="bc-week bc-table">
		<colgroup>
			<col style="width:2%"/>
			<col v-for="d in 7" style="width:14%" :style="weekColumnStyle(d)">
		</colgroup>
		<thead>
			<tr class="weekdays">
				<th></th>
				<th v-for="d in 7" v-text="wdWeekTitle(d)" :class="{today: isWeekDayToday(d)}"></th>
			</tr>
		</thead>
		<tbody>
			<template v-for="h in 24">
				<tr>
					<th rowspan=2>
						<span v-text="hoursText(h - 1)" class="h-title"></span>
					</th>
					<td v-for="d in 7" class="bc-h-top" @click.stop.prevent="clickHours(d, h, false)">
						<div class="h-event" v-for="(ev, ix) in hourEvents(d, h-1, false)" :key=ix
								:style="hourStyle(ev, false)" @click.stop.prevent="clickEvent(ev)">
							<slot name="weekev" v-bind:item="ev">
								<span class="h-ev-body" v-text="eventTitle(ev)" :title="eventTitle(ev)"></span>
							</slot>
						</div>
					</td>
				</tr>
				<tr>
					<td v-for="d in 7" class="bc-h-bottom" @click.stop.prevent="clickHours(d, h, true)">
						<div class="h-event" v-for="(ev, ix) in hourEvents(d, h-1, true)" :key=ix
							:style="hourStyle(ev, true)" @click.stop.prevent="clickEvent(ev)">
							<slot name="weekev" v-bind:item="ev">
								<span class="h-ev-body" v-text="eventTitle(ev)" :title="eventTitle(ev)"></span>
							</slot>
						</div>
					</td>
				</tr>
			</template>
		</tbody>
	</table>
	<div class="current-time" :style="currentTimeStyle()" :key=updateKey></div>
</div>
</div>
`,
	props: {
		item: Object,
		prop: String,
		viewItem: Object,
		viewProp: String,
		events: Array,
		delegates: Object
	},
	data() {
		return {
			updateKey: 1,
			timerId: 0
		};
	},
	computed: {
		locale(): any {
			return locale;
		},
		modelDate(): Date {
			return (this.item as any)[this.prop!];
		},
		modelView(): string {
			return (this.viewItem as any)[this.viewProp!];
		},
		days(): Date[][] {
			const dt = new Date(this.modelDate);
			dt.setDate(1); // 1-st day of month
			let w = dt.getDay() - 1; // weekday
			if (w === -1) w = 6;
			dt.setDate(-w + 1);
			const arr: Date[][] = [];
			for (let r = 0; r < 6; r++) {
				const row: Date[] = [];
				for (let c = 0; c < 7; c++) {
					row.push(new Date(dt));
					dt.setDate(dt.getDate() + 1);
				}
				arr.push(row);
			}
			return arr;
		},
		topTitle(): string {
			const m = this.modelDate.toLocaleDateString(monthLocale, { month: "long" });
			return `${tu.capitalize(m)} ${this.modelDate.getFullYear()}`;
		},
		firstMonday(): Date {
			let wd = this.modelDate.getDay();
			if (wd == 1) return this.modelDate;
			if (!wd) wd = 7;
			return du.add(this.modelDate, -(wd - 1), 'day');
		}
	},
	methods: {
		isView(view: string): boolean {
			return (this.viewItem as any)[this.viewProp!] === view;
		},
		wdTitle(d: number): string {
			const dt = this.days[0][d - 1];
			return dt.toLocaleString(monthLocale, { weekday: "long" });
		},
		wdWeekTitle(d: number): string {
			const fd: Date = du.add(this.firstMonday, d - 1, 'day');
			const wd = fd.toLocaleString(monthLocale, { weekday: 'long' });
			const day = fd.toLocaleString(monthLocale, { month: "long", day: 'numeric' });
			return `${wd}, ${day}`;
		},
		dayClass(day: Date): string {
			let cls = '';
			if (du.equal(day, du.today()))
				cls += ' today';
			if (day.getMonth() !== this.modelDate.getMonth())
				cls += " other";
			return cls;
		},
		dayEvents(day: Date): CalEvent[] {
			return (this.events as CalEvent[]).filter(e => du.equal(e.Date, day));
		},
		hoursText(h: number): string {
			return `${h}:00`;
		},
		hourStyle(ev: CalEvent, h2: boolean) {
			const min = ev.Date.getMinutes();
			const s = {
				backgroundColor: ev.Color,
				height: `${ev.Duration}px`,
				top: `${h2 ? min - 30 : min}px`
			};
			return s;
		},
		hourEvents(dno: number, hour: number, h2: boolean): CalEvent[] {
			const day = du.add(this.firstMonday, dno - 1, 'day');
			const inside = (ev: CalEvent) => {
				if (!du.equal(ev.Date, day)) return false;
				const h = ev.Date.getHours();
				const m = ev.Date.getMinutes();
				if (h2)
					return h >= hour && h < hour + 1 && m >= 30;
				else
					return h >= hour && h < hour + 1 && m < 30;
			};
			return (this.events as CalEvent[]).filter(inside);
		},
		nextPart(d: number) {
			let dt = new Date(this.modelDate);
			if (this.isView('week'))
				dt = du.add(dt, 7 * d, 'day');
			else
				dt.setMonth(dt.getMonth() + d);
			(this.item as any)[this.prop!] = dt;
		},
		todayPart() {
			const dt = new Date();
			(this.item as any)[this.prop!] = dt;
		},
		setView(view: string) {
			(this.viewItem as any)[this.viewProp!] = view;
		},
		clickEvent(ev: CalEvent) {
			if (this.delegates && this.delegates.ClickEvent)
				this.delegates.ClickEvent(ev);
		},
		clickDay(day: Date) {
			if (!this.delegates || !this.delegates.ClickDay) return;
			const dt = new Date(day);
			dt.setHours(0);
			dt.setMinutes(0);
			this.delegates.ClickDay(day);
		},
		clickHours(d: number, h: number, h2: boolean) {
			if (!this.delegates || !this.delegates.ClickDay) return;
			const fmd = this.firstMonday;
			const dt: Date = du.add(fmd, d - 1, 'day');
			dt.setMinutes(h2 ? 30 : 0);
			dt.setHours(h - 1);
			this.delegates.ClickDay(dt);
		},
		currentTimeStyle() {
			const dt = new Date();
			const x = dt.getHours() * 60 + dt.getMinutes() + 35 - 1 /*thead*/;
			return {
				top: `${x}px`,
				'--time': `"${dt.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}"`
			};
		},
		isWeekDayToday(d: number): boolean {
			const day = du.add(this.firstMonday, d - 1, 'day');
			return du.equal(day, du.today());
		},
		weekColumnStyle(d: number) {
			if (this.isWeekDayToday(d))
				return { backgroundColor: TODAY_COLOR };
			return undefined;
		},
		eventTitle(ev: CalEvent): string {
			const time = ev.Date.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' });
			return `${time} ${ev.Name}`;
		},
		__fitScroll() {
			if (this.isView('month')) {
				setTimeout(() => {
					(this.$refs.mc as HTMLElement).scrollTop = 0;
				}, 0);
			} else
				setTimeout(() => {
					const rows = (this.$refs.wc as HTMLElement).getElementsByTagName('tr');
					rows[8 * 2 + 1].scrollIntoView(true);
				}, 0);
		}
	},
	watch: {
		modelView() {
			this.__fitScroll();
		}
	},
	mounted() {
		this.__fitScroll();
		this.timerId = setInterval(() => {
			if (this.isView('week')) {
				this.updateKey++;
			}
		}, 10 * 1000) as unknown as number;
	},
	unmounted() {
		if (this.timerId)
			clearInterval(this.timerId);
	}
}));
