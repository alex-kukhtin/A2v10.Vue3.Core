// a2-text-editor, a2-text-view (A2v10.Core Web/A2v10.Core.Web.Site/Scripts/texteditor.js; not in Net48), unchanged
// in behaviour. A comment: own contenteditable, the text is markdown of three elements — \n, **bold**, ![name](src).
// Decisions — A2v10.Core design/texteditor.md.
// Vue 3: a hook's this was vm.$root.$data, the page's model: the page's controller's $data (inject $page);
// destroyed is unmounted. md, moving, gone, ranges are set on the instance in mounted: not reactive, as in Vue 2.

import { defineComponent } from 'vue';
import { vocabulary } from './platform.js';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

function escapeHtml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeMd(s: string): string {
	return s.replace(/[\\*]/g, '\\$&');
}

// One rule for a link: the view makes it clickable, the editor highlights it. Trailing punctuation belongs to the sentence
function* findLinks(s: string): Generator<{ index: number, url: string }> {
	for (const m of s.matchAll(/https?:\/\/[^\s<>"]+/g))
		yield { index: m.index!, url: m[0].replace(/[.,;:!?)]+$/, '') };
}

function textHtml(s: string, view: boolean): string {
	if (!view)
		return escapeHtml(s);
	let out = '';
	let last = 0;
	for (const { index, url } of findLinks(s)) {
		out += escapeHtml(s.substring(last, index));
		out += `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(url)}</a>`;
		last = index + url.length;
	}
	return out + escapeHtml(s.substring(last));
}

// The links of the editor's text, as ranges over its text nodes: the highlight paints them, a click opens them — one rule.
// A link cut by bold into two text nodes is not a link here — accepted
function linkRanges(el: Element): Range[] {
	const ranges: Range[] = [];
	const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
	for (let n = walker.nextNode(); n; n = walker.nextNode()) {
		for (const { index, url } of findLinks(n.nodeValue!)) {
			const r = new Range();
			r.setStart(n, index);
			r.setEnd(n, index + url.length);
			ranges.push(r);
		}
	}
	return ranges;
}

// by the rects, not by the caret: a caret lands on the nearest boundary, a click past the end of a line would open the link
function hit(range: Range, x: number, y: number): boolean {
	return Array.from(range.getClientRects()).some(c => x >= c.left && x <= c.right && y >= c.top && y <= c.bottom);
}

// The CSS Custom Highlight API paints over the text: the DOM, the caret and undo stay as they are.
// The registry is global, so editors share one Highlight, each holding its own ranges. No API — no highlight
const HIGHLIGHT = 'a2-link';

function linkHighlight(): any {
	const css = (window as any).CSS;
	if (!css || !css.highlights) return null;
	let hl = css.highlights.get(HIGHLIGHT);
	if (!hl) {
		hl = new (window as any).Highlight();
		css.highlights.set(HIGHLIGHT, hl);
	}
	return hl;
}

const IMAGE_RX = /^!\[((?:\\.|[^\]\\])*)\]\(([^)\s]+)\)/;

// The one render: the view and the text loaded into the editor. Everything is escaped; the output is own markup only.
// An image is an <img> only if imageUrl gives it a URL — otherwise text (a spy pixel); data-src keeps the stored form.
// view: links clickable, an image is a link to its original (max-height cuts it) and lazy.
// .loading — a fixed block with a spinner in the background until load/error (from Azure it takes seconds); on the img itself,
// no wrapper: a wrapper in contenteditable breaks editing, and the editor loads images too
function toHtml(md: string, imageUrl: (src: string) => string | null, view: boolean): string {
	let out = '';
	let text = '';
	let bold = false;
	const flush = () => { out += textHtml(text, view); text = ''; };
	for (let i = 0; i < md.length;) {
		const ch = md[i];
		if (ch === '\\' && i + 1 < md.length) {
			text += md[i + 1];
			i += 2;
		} else if (ch === '*' && md[i + 1] === '*' && (bold || hasClose(md, i + 2))) {
			flush();
			out += bold ? '</b>' : '<b>';
			bold = !bold;
			i += 2;
		} else if (ch === '\n') {
			flush();
			out += '<br>';
			i++;
		} else if (ch === '!' && md[i + 1] === '[') {
			const m = IMAGE_RX.exec(md.substring(i));
			const url = m ? imageUrl(m[2]) : null;
			if (m && url) {
				flush();
				const name = m[1].replace(/\\(.)/g, '$1');
				const href = escapeHtml(url);
				const img = `<img src="${href}" data-src="${escapeHtml(m[2])}" alt="${escapeHtml(name)}" class="loading"`;
				out += view ? `<a href="${href}" target="_blank" rel="noopener">${img} loading="lazy"></a>` : `${img}>`;
				i += m[0].length;
			} else {
				text += ch;
				i++;
			}
		} else {
			text += ch;
			i++;
		}
	}
	flush();
	return out;
}

// A hook is called as a template's function is: this = the model of the page (as emptyPanelCallback). No hook — undefined
function hook(vm: any, name: string, ...args: unknown[]): any {
	const d = vm.delegates;
	return d && d[name] ? d[name].apply(vm.page.$data, args) : undefined;
}

// load/error do not bubble — the root sees them on capture. An error too: a broken image, not an endless spinner
function loaded(ev: Event) {
	const t = ev.target as Element;
	if (t.tagName === 'IMG')
		t.classList.remove('loading');
}

// an unpaired ** is text
function hasClose(md: string, i: number): boolean {
	for (; i < md.length; i++) {
		if (md[i] === '\\')
			i++;
		else if (md[i] === '*' && md[i + 1] === '*')
			return true;
	}
	return false;
}

// Enter: Chrome makes a div, Firefox a br. The last br of a block is Chrome's stub of an empty line.
// An img without data-src (still uploading — blob:) is not written: the model never holds a dead address.
function toMarkdown(root: Element): string {
	let out = '';
	let breakAfterBlock = false;
	const emit = (s: string) => {
		if (breakAfterBlock) {
			out += '\n';
			breakAfterBlock = false;
		}
		out += s;
	};
	const walk = (node: Element, inBold: boolean) => {
		for (let n = node.firstChild; n; n = n.nextSibling) {
			if (n.nodeType === Node.TEXT_NODE) {
				if (n.nodeValue)
					emit(escapeMd(n.nodeValue.replace(/\u00a0/g, ' ')));
				continue;
			}
			if (n.nodeType !== Node.ELEMENT_NODE)
				continue;
			const e = n as Element;
			switch (e.tagName) {
				case 'BR':
					if (!e.nextSibling && (node.tagName === 'DIV' || node.tagName === 'P'))
						break;
					emit('\n');
					break;
				case 'B':
				case 'STRONG': {
					if (inBold) {
						walk(e, true);
						break;
					}
					emit('');
					const start = out.length;
					out += '**';
					walk(e, true);
					// an empty bold is skipped
					if (out.length === start + 2)
						out = out.substring(0, start);
					else
						out += '**';
					break;
				}
				case 'DIV':
				case 'P':
					if (out)
						out += '\n';
					breakAfterBlock = false;
					walk(e, inBold);
					breakAfterBlock = true;
					break;
				case 'IMG': {
					const src = e.getAttribute('data-src');
					if (src)
						emit(`![${((e as HTMLImageElement).alt || '').replace(/[\\\]]/g, '\\$&')}](${src.replace(/[\s)]/g, encodeURIComponent)})`);
					break;
				}
				default:
					walk(e, inBold);
			}
		}
	};
	walk(root, false);
	return out.replace(/\n+$/, '');
}

function images(files: FileList | null | undefined): File[] {
	return Array.from(files || []).filter(f => IMAGE_TYPES.includes(f.type));
}

// a screenshot from the clipboard is always image.png
function named(file: File): File {
	if (!/^image\.\w+$/i.test(file.name))
		return file;
	const d = new Date();
	const p = (n: number) => String(n).padStart(2, '0');
	const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
	return new File([file], `Знімок ${stamp}.${file.name.split('.').pop()}`, { type: file.type });
}

function caretAt(x: number, y: number) {
	let r: Range | null = null;
	const doc = document as any;
	if (doc.caretPositionFromPoint) {
		const p = doc.caretPositionFromPoint(x, y);
		if (p) {
			r = document.createRange();
			r.setStart(p.offsetNode, p.offset);
		}
	} else if (doc.caretRangeFromPoint)
		r = doc.caretRangeFromPoint(x, y);
	if (!r) return;
	r.collapse(true);
	const sel = window.getSelection()!;
	sel.removeAllRanges();
	sel.addRange(r);
}

vocabulary.component('a2-text-editor', defineComponent({
	template: `
<div class="a2-text-editor" :contenteditable="disabled ? 'false' : 'true'" :data-placeholder="placeholder"
	@input="sync" @keydown="keydown" @focus="focus" @paste="paste" @click="open" @load.capture="loaded" @error.capture="loaded"
	@dragstart="dragInside(true)" @dragend="dragInside(false)" @drop="drop"></div>
`,
	inject: {
		page: { from: '$page', default: null }
	},
	props: {
		item: Object,
		prop: String,
		placeholder: String,
		disabled: Boolean,
		delegates: Object
	},
	computed: {
		value(): string {
			return (this.item as any)[this.prop!] || '';
		}
	},
	watch: {
		// own input is never re-rendered — the caret stays
		value(v: string) {
			if (v === (this as any).md) return;
			this.render(v);
		}
	},
	methods: {
		loaded,
		imageUrl(src: string): string | null {
			return hook(this, 'ImageUrl', src) || null;
		},
		render(md: string) {
			const self = this as any;
			self.md = md;
			this.$el.innerHTML = toHtml(md, src => this.imageUrl(src), false);
			this.highlight();
		},
		highlight() {
			const self = this as any;
			const hl = linkHighlight();
			if (!hl) return;
			for (const r of self.ranges)
				hl.delete(r);
			self.ranges = self.gone ? [] : linkRanges(this.$el);
			for (const r of self.ranges)
				hl.add(r);
		},
		// Ctrl/⌘+click opens an image or a link, as a click in the view does; a plain click edits (places the caret,
		// selects an image). A disabled editor cannot be edited, so any click opens. An image still uploading
		// (blob:, no data-src) has nothing to open yet
		open(ev: MouseEvent) {
			if (!(ev.ctrlKey || ev.metaKey) && !this.disabled)
				return;
			let url: string | null = null;
			const t = ev.target as HTMLImageElement;
			if (t.tagName === 'IMG') {
				if (t.getAttribute('data-src'))
					url = t.src;
			} else {
				const link = linkRanges(this.$el).find(r => hit(r, ev.clientX, ev.clientY));
				if (link)
					url = link.toString();
			}
			if (!url)
				return;
			ev.preventDefault();
			window.open(url, '_blank', 'noopener');
		},
		sync() {
			const self = this as any;
			if (self.gone) return;
			const el = this.$el as HTMLElement;
			// Chrome leaves a <br> in an emptied editor — :empty and the placeholder need it gone
			if (!el.textContent && !el.querySelector('img'))
				el.innerHTML = '';
			self.md = toMarkdown(el);
			this.highlight();
			if (this.value !== self.md)
				(this.item as any)[this.prop!] = self.md;
		},
		focus() {
			// Ctrl+B → <b>, not <span style>
			document.execCommand('styleWithCSS', false, 'false');
		},
		keydown(ev: KeyboardEvent) {
			if (!(ev.ctrlKey || ev.metaKey)) return;
			if (ev.key === 'Enter') {
				ev.preventDefault();
				hook(this, 'Submit');
			} else if (ev.code === 'KeyI' || ev.code === 'KeyU')
				ev.preventDefault(); // italic and underline would be lost on save
		},
		canUpload(): boolean {
			const d = this.delegates as any;
			return !!(d && d.UploadImage);
		},
		paste(ev: ClipboardEvent) {
			const dt = ev.clipboardData;
			if (!dt) return;
			ev.preventDefault();
			const files = this.canUpload() ? images(dt.files) : [];
			if (files.length)
				this.insertImages(files);
			else
				this.insertText(dt.getData('text/plain'));
		},
		// dragstart fires only for a drag that began inside the editor
		dragInside(on: boolean) {
			(this as any).moving = on;
		},
		drop(ev: DragEvent) {
			if ((this as any).moving) return; // a move inside the editor is the browser's
			ev.preventDefault();
			const dt = ev.dataTransfer!;
			(this.$el as HTMLElement).focus();
			caretAt(ev.clientX, ev.clientY);
			const files = this.canUpload() ? images(dt.files) : [];
			if (files.length)
				this.insertImages(files);
			else
				this.insertText(dt.getData('text/plain'));
		},
		insertText(text: string) {
			// foreign HTML never enters
			if (text)
				document.execCommand('insertText', false, text);
		},
		insertImages(files: File[]) {
			const items = files.map(f => {
				const file = named(f);
				return { file, url: URL.createObjectURL(file) };
			});
			// execCommand — for the native undo
			const html = items.map(x => `<img src="${x.url}" alt="${escapeHtml(x.file.name)}" class="uploading">`).join('');
			document.execCommand('insertHTML', false, html);
			for (const x of items)
				this.upload(x);
		},
		async upload(x: { file: File, url: string }) {
			let src: string | null = null;
			try {
				src = await hook(this, 'UploadImage', x.file);
			} catch (err) {
				console.error(err);
			}
			const url = src ? this.imageUrl(src) : null;
			if (src && !url)
				console.error(`a2-text-editor: ImageUrl knows nothing of '${src}' returned by UploadImage`);
			// erased while uploading — nothing to do
			const img = Array.from((this.$el as Element).querySelectorAll('img')).find(i => i.getAttribute('src') === x.url);
			if (img) {
				if (url) {
					img.setAttribute('data-src', src!);
					img.src = url;
					img.classList.remove('uploading');
				} else
					img.remove();
			}
			URL.revokeObjectURL(x.url);
			// an attribute change fires no input
			this.sync();
		}
	},
	mounted() {
		// not reactive: own state of the DOM, never rendered
		const self = this as any;
		self.md = '';
		self.moving = false;
		self.gone = false;
		self.ranges = [];
		this.render(this.value);
	},
	unmounted() {
		(this as any).gone = true;
		this.highlight();
	}
}));

vocabulary.component('a2-text-view', defineComponent({
	template: `<div class="a2-text-view" v-html="html" @load.capture="loaded" @error.capture="loaded"></div>`,
	inject: {
		page: { from: '$page', default: null }
	},
	// shown, not written — value, as a2-blob-preview
	props: {
		value: String,
		delegates: Object
	},
	computed: {
		html(): string {
			return toHtml(this.value || '', src => hook(this, 'ImageUrl', src) || null, true);
		}
	},
	methods: {
		loaded
	}
}));
