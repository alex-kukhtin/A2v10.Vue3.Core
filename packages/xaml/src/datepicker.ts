// a2-date-picker (Net48 components/datepicker.js), unchanged in behaviour: over control; a date typed, or picked on a
// calendar (a month, for view 'month'); the time of the model's date is kept. A popup.

import { defineComponent } from 'vue';
import { control } from './control.js';
import { require, vocabulary } from './platform.js';

const popup = require('std:popup');
const utils = require('std:utils');
const eventBus = require('std:eventBus');
const locale = window.$$locale as any;
const dateLocale = locale.$DateLocale || locale.$Locale;
const monthLocale = locale.$Locale; // for text

vocabulary.component('a2-date-picker', defineComponent({
	extends: control,
	template: `
<div :class="cssClass2()" class="date-picker" :test-id="testId">
	<label v-if="hasLabel"><span v-text="label"/><slot name="hint"/><slot name="link"></slot></label>
	<div class="input-group"  @click="clickInput($event)">
		<input v-focus v-model.lazy="model" v-if="!isMonth" :class="inputClass" :readonly="inputDisabled"/>
		<div class="month-wrapper" v-if=isMonth v-text=model></div>
		<a href @click.stop.prevent="toggle($event)" tabindex="-1"><i class="ico ico-calendar"></i></a>
		<a href v-if="clearVisible" @click.stop.prevent="clear($event)" tabindex="-1">✕</a>
		<validator :invalid="invalid" :errors="errors" :options="validatorOptions"></validator>
		<div class="calendar" v-if="isOpen">
			<a2-calendar :model="viewDate" :view="view" :current-model="modelDate"
				:set-month="setMonth" :set-day="selectDay" :get-day-class="dayClass"/>
		</div>
	</div>
	<span class="descr" v-if="hasDescr" v-text="description"></span>
</div>
`,
	props: {
		item: Object,
		prop: String,
		itemToValidate: Object,
		propToValidate: String,
		// override control.align (default value)
		align: { type: String, default: 'center' },
		view: String,
		yearCutOff: String,
		hasClear: Boolean
	},
	data() {
		return {
			isOpen: false,
			viewDate: null as Date | null
		};
	},
	watch: {
		modelDate() {
			this.viewDate = this.modelDate;
		}
	},
	methods: {
		toggle() {
			if (this.disabled) return;
			if (!this.isOpen) {
				// close other popups
				eventBus.$emit('closeAllPopups');
				if (utils.date.isZero(this.modelDate))
					this.viewDate = utils.date.today();
			}
			this.isOpen = !this.isOpen;
		},
		clear() {
			this.isOpen = false;
			this.updateModel(utils.date.zero());
		},
		updateModel(date: Date) {
			(this.item as any)[this.prop!] = date;
			this.viewDate = date;
		},
		fitDate(dt: Date) {
			const du = utils.date;
			if (du.isZero(dt))
				return dt;
			if (dt < du.minDate)
				dt = du.minDate;
			else if (dt > du.maxDate)
				dt = du.maxDate;
			return dt;
		},
		clickInput(ev: Event) {
			if (this.view === 'month') {
				this.toggle();
				ev.stopPropagation();
				ev.preventDefault();
			}
		},
		setMonth(dt: Date) {
			this.viewDate = dt;
		},
		selectDay(day: Date) {
			const dt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
			this.setDate(dt);
			this.isOpen = false;
		},
		setDate(d: Date) {
			// save time
			const md = this.modelDate || d;
			let nd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), md.getHours(), md.getMinutes(), 0, 0);
			nd = this.fitDate(nd);
			this.updateModel(nd);
		},
		dayClass(day: Date) {
			let cls = '';
			const tls = utils.date;
			if (tls.equal(day, tls.today()))
				cls += ' today';
			if (tls.equal(day, this.modelDate))
				cls += ' active';
			if (day.getMonth() !== this.viewDate!.getMonth())
				cls += ' other';
			return cls;
		},
		cssClass2() {
			let cx = this.cssClass();
			if (this.isOpen)
				cx += ' open';
			return cx;
		},
		__clickOutside() {
			this.isOpen = false;
		}
	},
	computed: {
		modelDate(): Date {
			return (this.item as any)[this.prop!];
		},
		isMonth(): boolean {
			return this.view === 'month';
		},
		inputDisabled(): boolean {
			return this.disabled || this.view === 'month';
		},
		clearVisible(): boolean {
			return this.hasClear && !utils.date.isZero(this.modelDate);
		},
		model: {
			get(): string {
				if (utils.date.isZero(this.modelDate))
					return ' '; /* avoid baseline problem */
				if (this.view === 'month')
					return utils.text.capitalize(this.modelDate.toLocaleString(monthLocale, { year: 'numeric', month: 'long' }));
				else
					return this.modelDate.toLocaleString(dateLocale, { year: 'numeric', month: '2-digit', day: '2-digit' });
			},
			set(str: string) {
				let md = utils.date.parse(str, this.yearCutOff);
				md = this.fitDate(md);
				if (utils.date.isZero(md)) {
					this.updateModel(md);
					this.isOpen = false;
				} else {
					this.setDate(md);
				}
			}
		}
	},
	mounted() {
		this.viewDate = this.modelDate;
		popup.registerPopup(this.$el);
		this.$el._close = this.__clickOutside;
	},
	beforeUnmount() {
		popup.unregisterPopup(this.$el);
	}
}));
