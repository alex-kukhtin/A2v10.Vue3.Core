// a2-inline-dialog (Net48 components/inlinedialog.js), unchanged in behaviour: a modal in the page's markup, opened and
// closed by eventBus 'inlineDialog' {cmd: 'open' | 'close' | 'count', id} (the controller's $inlineOpen, $inlineClose,
// $inlineDepth). The open ones are a stack: Esc closes the top one; no close while requests run (__requestsCount__).
// beforeDestroy is beforeUnmount.

import { defineComponent } from 'vue';
import { require, vocabulary } from './platform.js';

const eventBus = require('std:eventBus');

type InlineOpts = { cmd: string, id: string, count?: number };

const __inlineStack: string[] = []; // for ESC support

vocabulary.component('a2-inline-dialog', defineComponent({
	template:
`<div class="inline-modal-wrapper modal-animation-frame" v-if="visible" :class="{show: open}" v-cloak>
	<div class="modal-window modal-animation-window" :class="{loaded: open}" :style="dlgStyle">
		<slot></slot>
	</div>
</div>
`,
	props: {
		dialogId: String,
		dialogTitle: String,
		width: String,
		noClose: Boolean
	},
	data() {
		return {
			visible: false,
			open: false //for animation
		};
	},
	computed: {
		dlgStyle(): { width: string } | undefined {
			if (this.width)
				return { width: this.width };
			return undefined;
		}
	},
	methods: {
		__keyUp(event: KeyboardEvent) {
			if (this.noClose) return;
			if (event.which === 27) {
				event.stopPropagation();
				event.preventDefault();
				if (__inlineStack.length && __inlineStack[0] !== this.dialogId)
					return;
				setTimeout(() => {
					eventBus.$emit('inlineDialog', { cmd: 'close', id: this.dialogId });
				}, 1);
			}
		},
		__inlineEvent(opts: InlineOpts) {
			if (!opts) return;
			if (opts.id !== this.dialogId) return;
			switch (opts.cmd) {
				case 'close':
					if ((window as any).__requestsCount__ > 0) return;
					__inlineStack.shift();
					this.open = false;
					this.visible = false;
					document.removeEventListener('keyup', this.__keyUp);
					break;
				case 'open':
					this.visible = true;
					__inlineStack.unshift(this.dialogId!);
					document.addEventListener('keyup', this.__keyUp);
					setTimeout(() => {
						this.open = true;
					}, 50); // same as shell
					break;
				case 'count':
					opts.count = __inlineStack.length;
					break;
				default:
					console.error(`invalid inline command '${opts.cmd}'`);
			}
		},
		__inlineCount(opts: InlineOpts) {
			opts.count = __inlineStack.length;
		}
	},
	created() {
		eventBus.$on('inlineDialog', this.__inlineEvent);
		eventBus.$on('inlineDialogCount', this.__inlineCount);
	},
	beforeUnmount() {
		document.removeEventListener('keyup', this.__keyUp);
		eventBus.$off('inlineDialog', this.__inlineEvent);
		eventBus.$off('inlineDialogCount', this.__inlineCount);
	}
}));
