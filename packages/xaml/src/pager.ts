// a2-pager (Net48 components/pager.js), unchanged in behaviour: the pages of a collection view's source
// (Parent.Pager: pageSize, offset, sourceCount, $setOffset). Vue 3's h takes flat props: on.click is onClick,
// domProps and attrs are props.

import { defineComponent, h, type VNode } from 'vue';
import { require, vocabulary } from './platform.js';

const locale = window.$$locale as any;
const eventBus = require('std:eventBus');

const fmt = new Intl.NumberFormat('uk-UA').format;

vocabulary.component('a2-pager', defineComponent({
	props: {
		source: Object,
		emptyText: String,
		templateText: String
	},
	computed: {
		src(): any {
			return this.source;
		},
		pages(): number {
			return Math.ceil(this.count / this.src.pageSize);
		},
		currentPage(): number {
			return Math.ceil(this.offset / this.src.pageSize) + 1;
		},
		title(): string {
			if (!this.count)
				return this.emptyString;
			return this.textString;
		},
		emptyString(): string {
			return this.emptyText ? this.emptyText : locale.$NoElements;
		},
		textString(): string {
			const lastNo = Math.min(this.count, this.offset + this.src.pageSize);
			if (this.templateText)
				return this.templateText
					.replace(/\#\[Start\]/g, fmt(this.offset + 1))
					.replace(/\#\[End\]/g, fmt(lastNo))
					.replace(/\#\[Count\]/g, fmt(this.count));
			else
				return `${locale.$PagerElements}: <b>${fmt(this.offset + 1)}</b>-<b>${fmt(lastNo)}</b> ${locale.$Of} <b>${fmt(this.count)}</b>`;
		},
		offset(): number {
			return +this.src.offset;
		},
		count(): number {
			return +this.src.sourceCount;
		}
	},
	methods: {
		setOffset(offset: number) {
			offset = +offset;
			if (this.offset === offset)
				return;
			eventBus.$emit('closeAllPopups');
			this.$nextTick(() => this.src.$setOffset(offset));
		},
		isActive(page: number) {
			return page === this.currentPage;
		},
		click(arg: string, $ev: Event) {
			$ev.preventDefault();
			switch (arg) {
				case 'prev':
					this.setOffset(this.offset - this.src.pageSize);
					break;
				case 'next':
					this.setOffset(this.offset + this.src.pageSize);
					break;
			}
		},
		goto(page: number, $ev: Event) {
			$ev.preventDefault();
			const offset = (page - 1) * this.src.pageSize;
			this.setOffset(offset);
		}
	},
	render() {
		if (this.src.pageSize === -1) return null; // invisible
		const children: VNode[] = [];
		const dotsClass = { class: 'a2-pager-dots' };
		const renderBtn = (page: number) => {
			return h('button', {
				innerText: page,
				onClick: ($ev: Event) => this.goto(page, $ev),
				class: { active: this.isActive(page) }
			});
		};
		// prev
		children.push(h('button', {
			onClick: ($ev: Event) => this.click('prev', $ev),
			disabled: this.offset === 0, 'aria-label': 'Previous page'
		}, [h('i', { class: 'ico ico-chevron-left' })]
		));
		// first
		if (this.pages > 0)
			children.push(renderBtn(1));
		// middle
		let ms = 2;
		let me = this.pages - 1;
		if (this.pages == 2)
			me = 2;
		let sd = false, ed = false;
		const cp = this.currentPage;
		const len = me - ms;
		if (len > 4) {
			if (cp > 4)
				sd = true;
			if (cp < this.pages - 3)
				ed = true;
			if (sd && !ed)
				ms = me - 3;
			else if (!sd && ed)
				me = ms + 3;
			else if (sd && ed) {
				ms = cp - 1;
				me = cp + 1;
			}
		}
		if (sd)
			children.push(h('span', dotsClass, '...'));
		for (let mi = ms; mi <= me; ++mi)
			children.push(renderBtn(mi));
		if (ed)
			children.push(h('span', dotsClass, '...'));
		// last
		if (this.pages > 2)
			children.push(renderBtn(this.pages));
		// next
		children.push(h('button', {
			onClick: ($ev: Event) => this.click('next', $ev),
			disabled: this.currentPage >= this.pages, 'aria-label': 'Next Page'
		},
			[h('i', { class: 'ico ico-chevron-right' })]
		));

		children.push(h('span', { class: 'a2-pager-divider' }));
		children.push(h('span', { class: 'a2-pager-title', innerHTML: this.title }));
		return h('div', { class: 'a2-pager' }, children);
	}
}));
