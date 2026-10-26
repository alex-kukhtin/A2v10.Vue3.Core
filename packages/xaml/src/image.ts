// a2-image, a2-file-preview (Net48 components/image.js), unchanged in behaviour. a2-file-image and a2-static-image of
// image.js are not ported yet.
// - a2-image: item[prop] (a reference with $id and $token, or an id with the token beside it in item) at
//   /_image/<base>/<prop>/<id>?token=…, removed by ✕ ($empty, or $remove inArray); none: a2-upload (upload.ts).
// - a2-file-preview: the file value (an object with Mime) at /_file/<url>/<id>?token=…, an <img> for image/*, an
//   <object> for a pdf, else "preview is unavailable". Net48's template had a stray quote after v-if="isImage" and
//   v-else-if="isPdf": Vue 2's parser took it, Vue 3's compiler refuses it; dropped.

import { defineComponent } from 'vue';
import { require, vocabulary } from './platform.js';

const url = require('std:url');
const utils = require('std:utils');
const locale = window.$$locale as any;

vocabulary.component('a2-image', defineComponent({
	template: `
<div class="a2-image">
	<img v-if="hasImage" :src="href" :style="cssStyle" @click.prevent="clickOnImage"/>
	<a class="remove-image" v-if="hasRemove" @click.prevent="removeImage">&#x2715;</a>
	<a2-upload v-if="isUploadVisible" :style=uploadStyle accept="image/*"
		:item=itemForUpload :base=base :prop=prop :new-item=newItem :tip=tip :read-only=readOnly :limit=limit :icon=icon></a2-upload>
</div>
`,
	props: {
		base: String,
		item: Object,
		prop: String,
		newItem: Boolean,
		inArray: Boolean,
		source: Array,
		width: String,
		height: String,
		readOnly: Boolean,
		limit: Number,
		placeholder: String,
		icon: String
	},
	data() {
		return {
			newElem: {} as any
		};
	},
	computed: {
		href(): string | undefined {
			if (this.newItem)
				return undefined;
			const root = window.$$rootUrl;
			const elem = this.imageOjb;
			if (!elem || !elem.id)
				return undefined;
			return url.combine(root, '_image', this.base, this.prop, elem.id) + url.makeQueryString({ token: elem.token });
		},
		tip(): string | undefined {
			if (this.readOnly) return this.placeholder;
			return this.placeholder ? this.placeholder : locale.$ClickToDownloadPicture;
		},
		cssStyle(): { maxWidth?: string, maxHeight?: string } {
			return { maxWidth: this.width, maxHeight: this.height };
		},
		uploadStyle(): { width?: string, height?: string } {
			const w = { width: this.width, height: this.height };
			if (!w.width) w.width = w.height;
			if (!w.height) w.height = w.width;
			return w;
		},
		hasImage(): boolean {
			return !!this.href;
		},
		hasRemove(): boolean {
			if (this.readOnly) return false;
			return this.hasImage;
		},
		isUploadVisible(): boolean {
			if (this.newItem) return true;
			if (this.readOnly)
				return !this.hasImage;
			return !this.inArray && !this.hasImage;
		},
		imageOjb(): { id: unknown, token: unknown } | undefined {
			const item = this.item as any;
			const elem = item[this.prop!];
			if (!elem)
				return undefined;
			if (utils.isObjectExact(elem))
				return { id: elem.$id, token: elem[elem._meta_.$token] };
			else
				return { id: elem, token: item[item._meta_.$token] };
		},
		itemForUpload(): object | undefined {
			return this.newItem ? this.newElem : this.item;
		}
	},
	methods: {
		removeImage() {
			const item = this.item as any;
			if (this.inArray)
				item.$remove();
			else {
				const elem = item[this.prop!];
				if (utils.isObjectExact(elem))
					elem.$empty();
				else
					item[this.prop!] = undefined;
			}
		},
		clickOnImage() {
			//alert('click on image');
		}
	},
	created() {
		const source = this.source as any;
		if (this.newItem && source && source.$new) {
			this.newElem = source.$new();
		}
	}
}));

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
