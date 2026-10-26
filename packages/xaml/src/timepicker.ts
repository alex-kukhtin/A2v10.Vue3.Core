// a2-time-picker (Net48 components/timepicker.js), unchanged in behaviour: over control; the time of item[prop] typed,
// or picked on a sheet (an hour, then minutes by 5, which closes it); the date is kept, a zero date is today's on
// open. A popup. beforeDestroy is beforeUnmount. The sheet's headers lose their text under v-text (Години, Хвилини):
// Vue 2's v-text replaced it, Vue 3's compiler refuses it.

import { defineComponent } from 'vue';
import { control } from './control.js';
import { require, vocabulary } from './platform.js';

const popup = require('std:popup');
const utils = require('std:utils');
const eventBus = require('std:eventBus');
const locale = window.$$locale as any;
const dateLocale = locale.$DateLocale || locale.$Locale;

const timesheet = defineComponent({
	props: {
		model: Date,
		setHour: Function,
		setMinute: Function,
		getHourClass: Function,
		getMinuteClass: Function
	},
	template: `
<div @click.stop.prevent="dummy" class="time-picker-pane calendar-pane">
<table class="table-hours">
<thead><tr><th colspan="6" v-text="locale.$Hours"></th></tr></thead>
<tbody>
	<tr v-for="row in hours">
		<td v-for="h in row" :class="getHourClass(h)"><a @click.stop.prevent="clickHours(h)" v-text="h"/></td>
	</tr>
</tbody></table>
<div class="divider"/>
<table class="table-minutes">
<thead><tr><th colspan="3" v-text="locale.$Minutes"></th></tr></thead>
<tbody>
	<tr v-for="row in minutes">
		<td v-for="m in row" :class="getMinuteClass(m)"><a @click.stop.prevent="clickMinutes(m)" v-text="m"/></td>
	</tr>
</tbody></table>
</div>
`,
	methods: {
		clickHours(h: string) {
			if (this.setHour)
				this.setHour(+h);
		},
		clickMinutes(m: string) {
			if (this.setMinute)
				this.setMinute(m);
		},
		dummy() {

		}
	},
	computed: {
		locale(): any { return locale; },
		hours(): (number | string)[][] {
			const a: (number | string)[][] = [];
			for (let y = 0; y < 4; y++) {
				const r: (number | string)[] = [];
				a.push(r);
				for (let x = 0; x < 6; x++) {
					let v: number | string = y * 6 + x;
					if (v < 10)
						v = '0' + v;
					r.push(v);
				}
			}
			return a;
		},
		minutes(): (number | string)[][] {
			const a: (number | string)[][] = [];
			for (let y = 0; y < 4; y++) {
				const r: (number | string)[] = [];
				a.push(r);
				for (let x = 0; x < 3; x++) {
					let v: number | string = (y * 3 + x) * 5;
					if (v < 10)
						v = '0' + v;
					r.push(v);
				}
			}
			return a;
		}
	}
});

vocabulary.component('a2-time-picker', defineComponent({
	extends: control,
	template: `
<div :class="cssClass2()" class="date-picker">
	<label v-if="hasLabel"><span v-text="label"/><slot name="hint"/><slot name="link"></slot></label>
	<div class="input-group">
		<input v-focus v-model.lazy="model" :class="inputClass" :disabled="inputDisabled"/>
		<a href @click.stop.prevent="toggle($event)"><i class="ico ico-waiting-outline"></i></a>
		<validator :invalid="invalid" :errors="errors" :options="validatorOptions"></validator>
		<div class="calendar" v-if="isOpen">
			<a2-time-sheet :model="modelDate" :set-hour="setHour" :set-minute="setMinute" :get-hour-class="hourClass" :get-minute-class="minuteClass"/>
		</div>
	</div>
	<span class="descr" v-if="hasDescr" v-text="description"></span>
</div>
`,
	components: {
		'a2-time-sheet': timesheet
	},
	props: {
		item: Object,
		prop: String,
		itemToValidate: Object,
		propToValidate: String,
		// override control.align (default value)
		align: { type: String, default: 'center' }
	},
	data() {
		return {
			isOpen: false
		};
	},
	methods: {
		toggle() {
			if (this.disabled) return;
			if (!this.isOpen) {
				// close other popups
				eventBus.$emit('closeAllPopups');
				if (utils.date.isZero(this.modelDate))
					(this.item as any)[this.prop!] = utils.date.today();
			}
			this.isOpen = !this.isOpen;
		},
		setHour(h: number) {
			const nd = new Date(this.modelDate);
			nd.setHours(h);
			(this.item as any)[this.prop!] = nd;
		},
		setMinute(m: number) {
			const md = new Date(this.modelDate);
			md.setMinutes(m);
			(this.item as any)[this.prop!] = md;
			this.isOpen = false;
		},
		hourClass(h: string) {
			let cls = '';
			if (this.modelDate.getHours() === +h)
				cls += ' active';
			return cls;
		},
		minuteClass(m: string) {
			return this.modelDate.getMinutes() === +m ? 'active' : undefined;
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
		inputDisabled(): boolean {
			return this.disabled;
		},
		model: {
			get(): string {
				const md = this.modelDate;
				if (utils.date.isZero(md))
					return '';
				return md.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: "2-digit" });
			},
			set(str: string) {
				let md = new Date(this.modelDate);
				if (str) {
					if (utils.date.isZero(md))
						md = utils.date.today();
					const time = utils.date.parseTime(str);
					md.setHours(time.getHours(), time.getMinutes());
				} else {
					md.setHours(0, 0);
				}
				(this.item as any)[this.prop!] = md;
				this.isOpen = false;
			}
		}
	},
	mounted() {
		popup.registerPopup(this.$el);
		this.$el._close = this.__clickOutside;
	},
	beforeUnmount() {
		popup.unregisterPopup(this.$el);
	}
}));
