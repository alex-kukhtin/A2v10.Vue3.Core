// popover (Net48 components/popover.js), unchanged in behaviour: a v-dropdown whose [toggle] is the title (icon,
// content); its body is the slot and, with url, an include of /_popup/<url>/<arg> loaded while shown. hover shows it
// on mouseover. A [close-dropdown] element inside closes it; tabindex="-1" on the toggle closes it on blur.
// arg: Vue 2's `undefined` type is `null` (any).

import { defineComponent } from 'vue';
import { require, vocabulary } from './platform.js';

const template = `
<div v-dropdown class="popover-wrapper" :style="{top: top}" :class="{show: isShowHover}" :title="title">
	<span toggle class="popover-title" :class=poClass :style=poStyle v-on:mouseover="mouseover"
		v-on:mouseout="mouseout" ><i v-if="hasIcon" :class="iconClass"></i> <span v-text="content"></span><slot name="badge"></slot></span>
	<div class="popup-body" :style="{width: width, left:offsetLeft}">
		<div class="arrow" :style="{left:offsetArrowLeft}"/>
		<div v-if="visible">
			<include :src="popoverUrl"/>
		</div>
		<slot />
	</div>
</div>
`;

vocabulary.component('popover', defineComponent({
	template,
	data() {
		return {
			state: 'hidden',
			hoverstate: false,
			popoverUrl: ''
		};
	},
	props: {
		icon: String,
		url: String,
		content: [String, Number],
		title: String,
		width: String,
		top: String,
		hover: Boolean,
		offsetX: String,
		arg: null,
		lineClamp: Number
	},
	computed: {
		hasIcon(): boolean {
			return !!this.icon;
		},
		offsetLeft(): string | undefined {
			return this.offsetX || undefined;
		},
		offsetArrowLeft(): string | undefined {
			if (this.offsetX && this.offsetX.indexOf('-') === 0)
				return `calc(${this.offsetX.substring(1)} + 6px)`;
			return undefined;
		},
		iconClass(): string {
			let cls = "ico po-ico";
			if (this.icon)
				cls += ' ico-' + this.icon;
			return cls;
		},
		poClass(): string | undefined {
			return this.lineClamp ? 'line-clamp' : undefined;
		},
		poStyle(): Record<string, string> | undefined {
			return this.lineClamp ? { '-webkit-line-clamp': '' + this.lineClamp } : undefined;
		},
		visible(): boolean {
			return !!this.url && this.state === 'shown';
		},
		isShowHover(): string | undefined {
			return this.hover && this.hoverstate ? 'show' : undefined;
		}
	},
	methods: {
		mouseover() {
			if (this.hover)
				this.hoverstate = true;
		},
		mouseout() {
			if (this.hover)
				this.hoverstate = false;
		}
	},
	mounted() {
		this.$el._show = () => {
			this.state = 'shown';
			if (this.url) {
				const urltools = require('std:url');
				const root = window.$$rootUrl;
				let arg = this.arg || '';
				if (typeof arg === 'object')
					arg = (arg as any).Id;
				this.popoverUrl = urltools.combine(root, '/_popup', this.url, arg);
			}
		};
		this.$el._hide = () => {
			this.state = 'hidden';
			this.popoverUrl = '';
		};
	}
}));
