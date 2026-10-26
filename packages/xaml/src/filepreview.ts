// a2-file-preview (Net48 components/image.js), unchanged in behaviour: the file value (an object with Mime) at
// /_file/<url>/<id>?token=…, an <img> for image/*, an <object> for a pdf, else "preview is unavailable". The other
// components of image.js (a2-image over a2-upload, a2-file-image, a2-static-image) are not ported yet.
// Net48's template had a stray quote after v-if="isImage" and v-else-if="isPdf": Vue 2's parser took it, Vue 3's
// compiler refuses it; dropped.

import { defineComponent } from 'vue';
import { require, vocabulary } from './platform.js';

const url = require('std:url');
const utils = require('std:utils');
const locale = window.$$locale as any;

vocabulary.component('a2-file-preview', defineComponent({
	template: `<div class="a2-file-preview">
		<img v-if="isImage" :src=href :style=cssStyle />
		<object v-else-if="isPdf" type="application/pdf" :data=href
			:width=pdfWidth :height=height :style=cssStyle></object>
		<div v-else class="no-preview">
			<span class="ico ico-file-preview"></span>
			<span v-text="unavailable"></span>
		</div>
	</div>`,
	props: {
		url: String,
		width: String,
		height: String,
		value: Object
	},
	computed: {
		mime(): string {
			if (utils.isObjectExact(this.value))
				return (this.value as any).Mime;
			console.error('value must be an Object');
			return undefined as unknown as string;
		},
		isImage(): boolean {
			return this.mime.startsWith('image');
		},
		isPdf(): boolean {
			return this.mime.endsWith('pdf');
		},
		pdfWidth(): string {
			return this.width ?? '100%';
		},
		href(): string {
			const root = window.$$rootUrl;
			const value = this.value as any;
			let id = value;
			const qry: { token?: string } = {};
			if (utils.isObjectExact(value)) {
				id = utils.getStringId(value);
				if (value._meta_ && value._meta_.$token)
					qry.token = value[value._meta_.$token];
			}
			return url.combine(root, '_file', this.url, id) + url.makeQueryString(qry);
		},
		unavailable(): string {
			return locale.$PreviewIsUnavailable;
		},
		cssStyle(): { maxWidth?: string, maxHeight?: string } {
			const r: { maxWidth?: string, maxHeight?: string } = {};
			if (this.width)
				r.maxWidth = this.width;
			if (this.height)
				r.maxHeight = this.height;
			return r;
		}
	}
}));
