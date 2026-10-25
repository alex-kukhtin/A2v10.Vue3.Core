// a2-blob-preview (Net48 components/blobpreview.js), unchanged in behaviour: a blob reference (value: an object,
// $id 0 when empty) previewed by its Mime: an image, a pdf object, else a link to it; nothing to show, a note.

import { defineComponent } from 'vue';
import { require, vocabulary } from './platform.js';

const url = require('std:url');

const locale = window.$$locale as any;

vocabulary.component('a2-blob-preview', defineComponent({
	template: `<div class="a2-file-preview">
	<img v-if="isImage" :src="href" :style="cssStyle"/>
	<object v-else-if="isPdf" type="application/pdf" :data="href"
		:width="pdfWidth" :height="height" :style="cssStyle"></object>
	<div v-else-if="hasBlob" class="no-preview">
		<span class="ico ico-file-preview"></span>
		<a :href="href" v-text="name"></a>
	</div>
	<div v-else class="no-preview">
		<span class="ico ico-file-preview"></span>
		<span v-text="unavailable"></span>
	</div>
</div>`,
	props: {
		value: Object,
		width: String,
		height: String
	},
	computed: {
		val(): any {
			return this.value;
		},
		// RefId: an object; an empty reference has $id = 0
		hasBlob(): boolean {
			return !!(this.val && this.val.$id);
		},
		mime(): string {
			return this.hasBlob ? (this.val.Mime || '') : '';
		},
		name(): string {
			return this.hasBlob ? this.val.Name : '';
		},
		// svg too: <img> runs no script, and the server never serves it inline
		isImage(): boolean {
			return this.mime.startsWith('image/');
		},
		isPdf(): boolean {
			return this.mime === 'application/pdf';
		},
		href(): string | undefined {
			if (!this.hasBlob)
				return undefined;
			return url.blobUrl(this.val);
		},
		pdfWidth(): string {
			return this.width || '100%';
		},
		unavailable(): string {
			return locale.$PreviewIsUnavailable;
		},
		cssStyle(): Record<string, string> {
			const r: Record<string, string> = {};
			if (this.width)
				r.maxWidth = this.width;
			if (this.height)
				r.maxHeight = this.height;
			return r;
		}
	}
}));
