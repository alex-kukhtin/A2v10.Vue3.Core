// a2-selector (Net48 components/selector.js), unchanged in behaviour: over control; a reference typed or picked from a
// list fetched as typed (fetch, fetchCommand through the page's $invoke, or itemsSource); a popup.
// Vue 3: $root was the page (base.js): here the page's controller (inject $page): fetchData's plain-object $vm.

import { defineComponent } from 'vue';
import { control } from './control.js';
import { require, vocabulary } from './platform.js';

const popup = require('std:popup');
const utils = require('std:utils');
const platform = require('std:platform');
const locale = window.$$locale as any;
const eventBus = require('std:eventBus');

const DEFAULT_DELAY = 300;

vocabulary.component('a2-selector', defineComponent({
	extends: control,
	template: `
<div :class="cssClass2()"  :test-id="testId">
	<label v-if="hasLabel"><span v-text="label"/><slot name="hint"/><slot name="link"></slot></label>
	<div class="input-group">
		<div v-if="isCombo" class="selector-combo" :class="colorClass" @click.stop.prevent="open"><span tabindex="-1" class="select-text" v-text="valueText" @keydown="keyDown" ref="xcombo"/></div>
		<input v-focus v-model="query" :class="[inputClass, colorClass]" :placeholder="placeholder" v-else
			@input="debouncedUpdate" @blur.stop="blur" @keydown="keyDown" @keyup="keyUp" ref="input"
			:readonly="disabled" @click="clickInput($event)" :tabindex="tabIndex"/>
		<slot></slot>
		<a class="selector-open" href="" @click.stop.prevent="open" v-if="caret"><span class="caret"></span></a>
		<a class="selector-clear" href="" @click.stop.prevent="clear" v-if="clearVisible" tabindex="-1">&#x2715;</a>
		<validator :invalid="invalid" :errors="errors" :options="validatorOptions"></validator>
		<div class="selector-pane" v-if="isOpen" ref="pane" :class="paneClass">
			<div class="selector-body" :style="bodyStyle">
				<slot name="pane" :items="items" :is-item-active="isItemActive2" :item-name="itemName" :hit="hit" :max-chars="maxChars" :line-clamp="lineClamp" :slotStyle="slotStyle">
					<ul class="selector-ul">
						<li @mousedown.prevent="hit(itm)" :class="{'active': isItemActive(itmIndex)}"
							v-for="(itm, itmIndex) in items" :key="itmIndex">
							<span :style="itemStyle(itm)" :class="itemClass(itm, itmIndex)" :title="itemTitle(itm)" v-text="itemName(itm)"></span>
						</li>
					</ul>
				</slot>
			</div>
			<a v-if='canNew' class="create-elem a2-hyperlink a2-inline" @mousedown.stop.prevent="doNew()"><i class="ico ico-plus"/> <span v-text="newText"></span></a>
		</div>
		<div class="selector-pane" v-if="isOpenNew" @click.stop.prevent="dummy">
			<slot name="new-pane"></slot>
		</div>
	</div>
	<slot name="popover"></slot>
	<span class="descr" v-if="hasDescr" v-text="description"></span>
</div>
`,
	inject: {
		page: { from: '$page', default: null }
	},
	props: {
		item: Object,
		prop: String,
		itemsSource: Array,
		textItem: Object,
		textProp: String,
		colorProp: String,
		display: String,
		itemToValidate: Object,
		propToValidate: String,
		placeholder: String,
		delay: Number,
		minChars: Number,
		fetch: Function,
		hitfunc: Function,
		listWidth: String,
		listHeight: String,
		createNew: Function,
		placement: String,
		caret: Boolean,
		hasClear: Boolean,
		useAll: Boolean,
		mode: String,
		fetchCommand: String,
		fetchCommandData: Object,
		maxChars: Number,
		lineClamp: Number,
		highlight: Boolean
	},
	data() {
		return {
			isOpen: false,
			isOpenNew: false,
			loading: false,
			items: [] as any[],
			query: '',
			filter: '',
			current: -1
		};
	},
	computed: {
		valueText(): string {
			const item = this.item as any;
			if (!item) return '';
			if (this.hasText) {
				const el = item[this.prop!];
				if (el.$isEmpty)
					return (this.textItem as any)[this.textProp!];
			}
			let el = item[this.prop!];
			if (utils.isNumber(el) && this.itemsSource) {
				el = (this.itemsSource as any[]).find(x => x.$id === el);
				if (!el) return '';
			}
			return utils.simpleEval(el, this.display);
		},
		hasValue(): boolean | undefined {
			if (!this.highlight) return false;
			if (!this.item) return false;
			const el = (this.item as any)[this.prop!];
			if (utils.isObjectExact(el) && el.Id && el.Id != -1)
				return true;
			return undefined;
		},
		canNew(): boolean {
			return !!this.createNew;
		},
		clearVisible(): boolean {
			if (!this.hasClear) return false;
			const to = (this.item as any)[this.prop!];
			if (!to) return false;
			if (this.useAll && to.Id === -1) return false;
			if (utils.isDefined(to.$isEmpty))
				return !to.$isEmpty;
			return !utils.isPlainObjectEmpty(to);
		},
		hasText(): boolean { return !!this.textProp; },
		newText(): string {
			return `${locale.$CreateLC} "${this.query}"`;
		},
		pane(): object {
			return {
				items: this.items,
				isItemActive: this.isItemActive2,
				itemName: this.itemName,
				hit: this.hit
			};
		},
		paneClass(): string | undefined {
			if (this.placement)
				return 'panel-' + this.placement;
			return undefined;
		},
		bodyStyle(): Record<string, string> {
			const s: Record<string, string> = {};
			if (this.listWidth) {
				s.minWidth = this.listWidth;
			}
			if (this.listHeight)
				s.maxHeight = this.listHeight;
			return s;
		},
		slotStyle(): Record<string, unknown> {
			const r: Record<string, unknown> = {};
			if (this.listWidth) {
				r.width = this.listWidth;
				r.minWidth = this.listWidth;
			}
			if (this.listHeight)
				r.maxHeight = (this as any).maxHeight;
			return r;
		},
		colorClass(): string | undefined {
			return this.item ? this.colorOf((this.item as any)[this.prop!]) : undefined;
		},
		debouncedUpdate(): () => void {
			const delay = this.delay || DEFAULT_DELAY;
			return utils.debounce(() => {
				this.current = -1;
				this.filter = this.query;
				this.update();
			}, delay);
		},
		isCombo(): boolean {
			return this.mode === 'combo-box' || this.mode === 'hyperlink';
		}
	},
	watch: {
		valueText() {
			if (this.hasText) {
				const el = (this.item as any)[this.prop!];
				if (!el.$isEmpty)
					(this.textItem as any)[this.textProp!] = ''; // clear text
			}
			this.query = this.valueText;
		}
	},
	methods: {
		dummy() {
		},
		__clickOutside() {
			this.isOpen = false;
			this.isOpenNew = false;
		},
		colorOf(el: unknown) {
			if (!this.colorProp) return undefined;
			const clr = utils.simpleEval(el, this.colorProp);
			return clr ? `color color-${clr}` : undefined;
		},
		cssClass2() {
			let cx = this.cssClass();
			if (this.isOpen || this.isOpenNew)
				cx += ' open';
			if (this.mode === 'hyperlink')
				cx += ' selector-hyperlink';
			else if (this.mode === 'combo-box')
				cx += ' selector-combobox';
			if (this.hasValue)
				cx += ' has-value';
			return cx;
		},
		isItemActive(ix: number) {
			return ix === this.current;
		},
		isItemActive2(ix: number, row?: unknown) {
			if (!row)
				return this.isItemActive(ix);
			if (this.current === -1)
				return false;
			return this.items[this.current] === row;
		},
		itemName(itm: unknown) {
			const v = utils.simpleEval(itm, this.display);
			if (this.maxChars)
				return utils.text.maxChars(v, this.maxChars);
			return v;
		},
		blur() {
			const text = this.query;
			if (this.hasText && text !== this.valueText) {
				const to = (this.item as any)[this.prop!];
				if (to && to.$empty)
					to.$empty();
				(this.textItem as any)[this.textProp!] = text;
			}
			this.cancel();
		},
		open() {
			if (!this.isOpen) {
				eventBus.$emit('closeAllPopups');
				if (this.current != -1)
					this.$nextTick(() => this.scrollIntoView());
				this.doFetch(this.valueText, true);
				if (this.isCombo) {
					const combo = this.$refs['xcombo'] as HTMLElement;
					if (combo)
						combo.focus();
				} else {
					const input = this.$refs['input'] as HTMLElement;
					if (input)
						input.focus();
				}
			}
			this.isOpen = !this.isOpen;
		},
		cancel() {
			this.query = this.valueText;
			this.isOpen = false;
		},
		keyUp(event: KeyboardEvent) {
			if (this.isOpen && event.which === 27) {
				event.preventDefault();
				event.stopPropagation();
				this.cancel();
			} else if (event.which === 13) {
				if (this.hasText)
					this.blur();
			}
		},
		clickInput(event: Event) {
			if (this.caret && !this.isOpen) {
				event.stopPropagation();
				event.preventDefault();
				this.open();
			}
		},
		keyDown(event: KeyboardEvent) {
			if (!this.isOpen) {
				if (event.which === 115)
					this.open();
				return;
			}
			event.stopPropagation();
			switch (event.which) {
				case 27: // esc
					event.preventDefault();
					break;
				case 13: // enter
					if (this.current === -1) return;
					this.hit(this.items[this.current]);
					break;
				case 40: // down
					event.preventDefault();
					this.current += 1;
					if (this.current >= this.items.length)
						this.current = 0;
					this.query = this.itemName(this.items[this.current]);
					this.scrollIntoView();
					break;
				case 38: // up
					event.preventDefault();
					this.current -= 1;
					if (this.current < 0)
						this.current = this.items.length - 1;
					this.query = this.itemName(this.items[this.current]);
					this.scrollIntoView();
					break;
				case 115: // F4
					this.cancel();
					break;
				default:
					return;
			}
		},
		itemTitle(itm: unknown) {
			if (this.lineClamp! > 0)
				return this.itemName(itm);
			return '';
		},
		itemStyle() {
			if (this.lineClamp! > 0)
				return { '-webkit-line-clamp': this.lineClamp };
			return undefined;
		},
		itemClass(itm: unknown) {
			let cls = '';
			if (this.lineClamp! > 0)
				cls += ' line-clamp';
			const clr = this.colorOf(itm);
			if (clr)
				cls += ' ' + clr;
			return cls;
		},
		hit(itm: any) {
			const item = this.item as any;
			const obj = item[this.prop!];
			this.query = this.valueText;
			this.isOpen = false;
			this.isOpenNew = false;
			this.current = this.items.indexOf(itm);
			this.$nextTick(() => {
				if (this.hitfunc) {
					this.hitfunc.call(item.$root, itm, item, this.prop);
					return;
				}
				if (obj && obj.$merge)
					obj.$merge(itm, true /*fire*/);
				else if (utils.isNumber(obj))
					item[this.prop!] = itm.$id;
				else
					platform.set(item, this.prop, itm);
			});
		},
		clear() {
			this.query = '';
			this.isOpen = false;
			this.isOpenNew = false;
			const obj = (this.item as any)[this.prop!];
			if (!obj) return;
			if (this.useAll) {
				obj.Id = -1;
				obj.Name = '';
				return;
			}
			if (obj.$empty)
				obj.$empty();
			else if (utils.isObjectExact(obj))
				utils.clearObject(obj);
		},
		scrollIntoView() {
			this.$nextTick(() => {
				const pane = this.$refs['pane'] as HTMLElement;
				if (!pane) return;
				const elem = pane.querySelector('.active');
				if (!elem) return;
				elem.scrollIntoView(false);
			});
		},
		update() {
			const text = this.query || '';
			const chars = +(this.minChars || 0);
			if (chars && text.length < chars) return;
			this.isOpen = true;
			this.isOpenNew = false;
			if (text === '') {
				this.clear();
				return;
			}
			this.doFetch(text, false);
		},
		doFetch(text: string, all: boolean) {
			if (this.itemsSource) {
				if (!this.items.length)
					this.items = this.itemsSource as any[];
				let fi = -1;
				const el = (this.item as any)[this.prop!];
				if (utils.isNumber(el))
					fi = this.items.findIndex((x: any) => x.Id === el);
				else
					fi = this.items.indexOf(el);
				if (fi !== -1) {
					this.current = fi;
					setTimeout(() => this.scrollIntoView(), 10);
				}
				return;
			}
			this.loading = true;
			const fData = this.fetchData(text, all);
			if (fData.then) {
				// promise
				fData.then((result: any) => {
					this.loading = false;
					// first property from result
					const prop = Object.keys(result)[0];
					this.items = result[prop];
					if (this.items.length)
						this.current = 0;
				}).catch(() => {
					this.items = [];
				});
			} else {
				if (utils.isArray(fData)) {
					if (this.items != fData) {
						if (this.items.length != fData.length)
							this.current = -1; // reset current element
						this.items = fData;
					}
				}
			}
		},
		fetchData(text: string, all?: boolean): any {
			all = all || false;
			const item = this.item as any;
			const elem = item[this.prop!];
			if (elem && !('$vm' in elem)) {
				// plain object hack
				Object.defineProperty(elem, '$vm', { value: this.page, writable: false, enumerable: false });
			}
			if (this.fetch) {
				return this.fetch.call(item.$root, elem, text, all);
			} else if (this.fetchCommand) {
				if (!text) return [];
				const fc = this.fetchCommand.split('/');
				const action = fc.pop();
				const invokeArg = Object.assign({}, { Text: text }, this.fetchCommandData);
				return elem.$vm.$invoke(action, invokeArg, fc.join('/'));
			}
			console.error('Selector. Fetch or Delegate not defined');
		},
		doNew() {
			this.isOpen = false;
			if (this.createNew) {
				const elem = (this.item as any)[this.prop!];
				const arg = {
					elem: elem,
					text: this.query
				};
				this.createNew(arg);
			}
		}
	},
	mounted() {
		popup.registerPopup(this.$el);
		this.query = this.valueText;
		this.$el._close = this.__clickOutside;
	},
	beforeUnmount() {
		popup.unregisterPopup(this.$el);
	}
}));
