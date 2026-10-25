// std:modal (Net48 components/modal.js) and the directives of a dialog's markup: v-drag-window, v-modal-width,
// v-maximize, v-modal-placement. Unchanged in behaviour; Vue 3's hooks (inserted is mounted, destroyed unmounted).
// v-modal-placement reached the modal through mw.__vue__ (Vue 2 only); here the modal window carries a setter.

import { app, require, vocabulary } from './platform.js';
import { defineComponent, type Directive } from 'vue';

type ModalWindow = HTMLElement & { _setPlacement?: (placement: string) => void };

const modalTemplate = `
<div class="modal-window modal-animation-window" @keydown.tab="tabPress" :class="mwClass" ref=dialog>
	<include v-if="isInclude" class="modal-body" :src="dialog.url" :done="loaded" :inside-dialog="true"></include>
	<div v-else class="modal-body">
		<div class="modal-header" v-drag-window><span v-text="title"></span><button ref='btnclose' class="btnclose" @click.prevent="modalClose(false)">&#x2715;</button></div>
		<div :class="bodyClass">
			<i v-if="hasIcon" :class="iconClass" />
			<div class="modal-body-content">
				<div v-html="messageText()" />
				<ul v-if="hasList" class="modal-error-list">
					<li v-for="(itm, ix) in dialog.list" :key="ix" v-text="itm"/>
				</ul>
			</div>
		</div>
		<div class="modal-footer">
			<button class="btn btn-default" v-for="(btn, index) in buttons"  :key="index" @click.prevent="modalClose(btn.result)" v-text="btn.text"/>
		</div>
	</div>
</div>
`;

const setWidthComponent: Directive<HTMLElement, any> = {
	mounted(el, binding) {
		// TODO: width or cssClass???
		const mw = el.closest<HTMLElement>('.modal-window');
		if (mw) {
			if (binding.value.width)
				mw.style.width = binding.value.width;
			const cssClass = binding.value.cssClass;
			switch (cssClass) {
				case 'modal-large':
					mw.style.width = '800px'; // from less
					break;
				case 'modal-small':
					mw.style.width = '350px'; // from less
					break;
			}
			if (binding.value.minWidth)
				mw.style.minWidth = binding.value.minWidth;
		}
	}
};

const maximizeComponent: Directive<HTMLElement, any> = {
	mounted(el, binding) {
		const mw = el.closest('.modal-window');
		if (mw && binding.value)
			mw.setAttribute('maximize', 'true');
	}
};

const modalPlacementComponent: Directive<HTMLElement, string> = {
	mounted(el, binding) {
		if (!binding.value)
			return;
		const mw = el.closest<ModalWindow>('.modal-window');
		if (!mw || !mw._setPlacement)
			return;
		mw._setPlacement(' with-placement ' + binding.value);
		const mf = mw.closest('.modal-wrapper');
		if (mf)
			mf.setAttribute('data-placement', binding.value);
	}
};

const dragDialogDirective: Directive<HTMLElement> = {
	mounted(el) {
		const mw = el.closest<HTMLElement>('.modal-window');
		if (!mw)
			return;
		const opts = {
			down: false,
			init: { x: 0, y: 0, cx: 0, cy: 0 },
			offset: { x: 0, y: 0 }
		};

		function onMouseDown(event: MouseEvent) {
			opts.down = true;
			opts.offset.x = event.pageX;
			opts.offset.y = event.pageY;
			const cs = window.getComputedStyle(mw!);
			opts.init.x = Number.parseFloat(cs.marginLeft);
			opts.init.y = Number.parseFloat(cs.marginTop);
			opts.init.cx = Number.parseFloat(cs.width);
			opts.init.cy = Number.parseFloat(cs.height);
			document.addEventListener('mouseup', onRelease, false);
			document.addEventListener('mousemove', onMouseMove, false);
		}

		function onRelease() {
			opts.down = false;
			document.removeEventListener('mouseup', onRelease);
			document.removeEventListener('mousemove', onMouseMove);
		}

		function onMouseMove(event: MouseEvent) {
			if (!opts.down)
				return;
			// flex centered window
			const dx = (event.pageX - opts.offset.x);
			const dy = (event.pageY - opts.offset.y);
			let mx = opts.init.x + dx;
			let my = opts.init.y + dy;
			// fit
			const maxX = window.innerWidth - opts.init.cx;
			if (mx < 0) mx = 0;
			if (mx > maxX) mx = maxX;
			if (my < 0) my = 0;
			mw!.style.marginLeft = mx + 'px';
			mw!.style.marginTop = my + 'px';
		}

		el.addEventListener('mousedown', onMouseDown, false);
	}
};

vocabulary.directive('drag-window', dragDialogDirective);
vocabulary.directive('modal-width', setWidthComponent);
vocabulary.directive('maximize', maximizeComponent);
vocabulary.directive('modal-placement', modalPlacementComponent);

const modalComponent = defineComponent({
	template: modalTemplate,
	props: {
		dialog: { type: Object, required: true }
	},
	data() {
		const eventBus = require('std:eventBus');
		// always need a new instance of function (modal stack)
		return {
			modalCreated: false,
			placement: '',
			keyUpHandler: function (event: KeyboardEvent) {
				// escape
				if (event.which === 27) {
					eventBus.$emit('modalClose', false);
					event.stopPropagation();
					event.preventDefault();
				}
			}
		};
	},
	methods: {
		modalClose(result: unknown) {
			require('std:eventBus').$emit('modalClose', result);
		},
		loaded() {
			// include loading is complete
		},
		messageText(): string {
			return require('std:utils').text.sanitize(this.dialog.message);
		},
		tabPress(event: KeyboardEvent) {
			const dialog = this.$refs.dialog as HTMLElement;
			const activeInput = document.activeElement;
			const elems = Array.from(dialog.querySelectorAll<HTMLElement>('input:enabled, button:enabled, textarea:enabled, select:enabled, a:not([disabled])'))
				.filter(el => el && (el.offsetLeft || el.offsetTop || el.offsetWidth || el.offsetHeight))
				.map(el => { return { elem: el, ti: +(el.getAttribute('tabindex') || 0) || 0, active: el == activeInput }; })
				.filter(el => el.ti !== -1)
				.sort((e1, e2) => e1.ti == e2.ti ? 0 : e1.ti < e2.ti ? -1 : 1);
			if (!elems.length) return;
			const d = event.shiftKey ? -1 : 1;
			const ai = elems.findIndex(x => x.active);
			let ni = ai + d;
			if (ni < 0)
				ni = elems.length - 1;
			else if (ni >= elems.length)
				ni = 0;
			elems[ni].elem.focus();
			event.preventDefault();
		},
		__modalRequery() {
			alert('requery yet not implemented');
		}
	},
	computed: {
		isInclude(): boolean {
			return !!this.dialog.url;
		},
		mwClass(): string {
			return this.placement + (this.modalCreated ? ' loaded' : '');
		},
		hasIcon(): boolean {
			return !!this.dialog.style;
		},
		title(): string {
			const locale = window.$$locale;
			// todo localization
			if (this.dialog.title)
				return this.dialog.title;
			return this.dialog.style === 'confirm' ? locale.$Confirm :
				this.dialog.style === 'info' ? locale.$Message : locale.$Error;
		},
		bodyClass(): string {
			return 'modal-body ' + (this.dialog.style || '');
		},
		iconClass(): string {
			let ico = this.dialog.style;
			if (ico === 'info')
				ico = 'info-blue';
			return 'ico ico-' + ico;
		},
		hasList(): boolean {
			return this.dialog.list && this.dialog.list.length;
		},
		buttons(): { text: string, result: unknown, tabindex?: number }[] {
			const locale = window.$$locale;
			const okText = this.dialog.okText || locale.$Ok;
			const cancelText = this.dialog.cancelText || locale.$Cancel;
			if (this.dialog.buttons)
				return this.dialog.buttons;
			else if (this.dialog.style === 'alert')
				return [{ text: okText, result: true, tabindex: 1 }];
			else if (this.dialog.style === 'info')
				return [{ text: okText, result: true, tabindex: 1 }];
			return [
				{ text: okText, result: true, tabindex: 2 },
				{ text: cancelText, result: false, tabindex: 1 }
			];
		}
	},
	created() {
		document.addEventListener('keyup', this.keyUpHandler);
		const self = this as any;
		self.savedFocus = document.activeElement;
		if (self.savedFocus && self.savedFocus.blur) {
			self.savedFocus.blur();
		}
	},
	mounted() {
		(this.$refs.dialog as ModalWindow)._setPlacement = placement => { this.placement = placement; };
		setTimeout(() => {
			this.modalCreated = true;
		}, 50); // same as shell
	},
	unmounted() {
		const self = this as any;
		if (self.savedFocus && self.savedFocus.focus)
			self.savedFocus.focus();
		document.removeEventListener('keyup', this.keyUpHandler);
	}
});

app.components['std:modal'] = modalComponent;
