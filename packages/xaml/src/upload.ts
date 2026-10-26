// a2-upload (Net48 components/upload.js), unchanged in behaviour: a label with a file input, dropped on or clicked;
// the files posted to /_image/<base>/<prop>/<id>, the answer's { status: 'OK', elems: [{ Id, Token }] } written to
// item[prop] (a reference's $id and $token, or the id with the token beside it in item); newItem appends one element
// per file to item's parent array. A file over limit (KB) is refused with an alert. a2-simple-upload of upload.js is
// not ported yet.

import { defineComponent } from 'vue';
import { require, vocabulary } from './platform.js';

const url = require('std:url');
const http = require('std:http');
const tools = require('std:tools');
const utils = require('std:utils');
const locale = window.$$locale as any;

vocabulary.component('a2-upload', defineComponent({
	template: `
<label :class="cssClass" @dragover="dragOver" @dragleave="dragLeave">
	<input v-if='canUpload' type="file" @change="uploadImage" v-bind:multiple="isMultiple" :accept="accept" />
	<i class="ico" :class="icoClass"></i>
	<span class="upload-tip" v-text="tip" v-if="tip"></span>
</label>
		`,
	props: {
		item: Object,
		prop: String,
		base: String,
		newItem: Boolean,
		tip: String,
		readOnly: Boolean,
		accept: String,
		limit: Number,
		icon: String
	},
	data() {
		return {
			hover: false
		};
	},
	computed: {
		cssClass(): string {
			return 'file-upload' + (this.hover ? ' hover' : '');
		},
		isMultiple(): boolean {
			return !!this.newItem;
		},
		canUpload(): boolean {
			return !this.readOnly;
		},
		icoClass(): string {
			if (this.icon)
				return `ico-${this.icon}`;
			return this.accept === 'image/*' ? 'ico-image' : 'ico-upload';
		}
	},
	methods: {
		dragOver(ev: DragEvent) {
			this.hover = true;
			ev.preventDefault();
		},
		dragLeave(ev: DragEvent) {
			this.hover = false;
			ev.preventDefault();
		},
		checkLimit(file: File): boolean {
			if (!this.limit) return false;
			const sizeKB = file.size / 1024;
			return sizeKB > this.limit;
		},
		uploadImage(ev: Event) {
			const target = ev.target as HTMLInputElement;
			const item = this.item as any;
			const root = window.$$rootUrl;
			let id = item[this.prop!];
			if (utils.isObjectExact(id))
				id = id.$id;
			const imgUrl = url.combine(root, '_image', this.base, this.prop, id);
			const fd = new FormData();
			for (const file of target.files!) {
				if (this.checkLimit(file)) {
					target.value = ''; // clear current selection
					const msg = locale.$FileTooLarge.replace('{0}', this.limit);
					tools.alert(msg);
					return;
				}
				fd.append('file', file, file.name);
			}
			http.upload(imgUrl, fd).then((result: any) => {
				// result = {status: '', elems:[Id:0, Token:'']}
				target.value = ''; // clear current selection
				let token = undefined;
				if (item._meta_)
					token = item._meta_.$token;
				if (result.status === 'OK') {
					if (this.newItem) {
						const p0 = item.$parent;
						for (const elem of result.elems) {
							const ni = p0.$append();
							ni[this.prop!] = elem.Id;
							ni[token] = elem.Token;
						}
					} else {
						const elem = item[this.prop!];
						if (utils.isObjectExact(elem)) {
							elem[elem._meta_.$id] = result.elems[0].Id;
							elem[elem._meta_.$token] = result.elems[0].Token;
						} else {
							item[this.prop!] = result.elems[0].Id;
							item[token] = result.elems[0].Token;
						}
					}
				}
			}).catch((msg: string) => {
				if (msg.indexOf('UI:') === 0)
					tools.alert(msg.substring(3).replace('\\n', '\n'));
				else
					alert(msg);
			});
		}
	}
}));
