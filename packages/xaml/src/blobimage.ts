// a2-blob-image (Net48 components/blobimage.js), unchanged in behaviour: the image of a blob reference (item[prop]:
// always an object, $id 0 when empty), shown by its url (std:url blobUrl); a file chosen or dropped goes up to
// _blob/<url>/<prop>, and the answer (Id, Token, Name, Mime) is written into the reference.

import { defineComponent } from 'vue';
import { require, vocabulary } from './platform.js';

const url = require('std:url');
const http = require('std:http');
const tools = require('std:tools');

const locale = window.$$locale as any;

vocabulary.component('a2-blob-image', defineComponent({
	template: `
<div class="a2-image">
	<img v-if="hasImage" :src="href" :style="cssStyle"/>
	<a class="remove-image" v-if="hasImage" @click.prevent="removeImage">&#x2715;</a>
	<label v-else :class="uploadClass" :style="uploadStyle"
			@dragover.prevent="hover = true" @dragleave.prevent="hover = false">
		<input type="file" accept="image/*" @change="uploadImage"/>
		<i class="ico ico-image"></i>
		<span class="upload-tip" v-text="tip"></span>
	</label>
</div>
`,
	props: {
		url: String,
		item: Object,
		prop: String,
		width: String,
		height: String
	},
	data() {
		return {
			hover: false
		};
	},
	computed: {
		blob(): any {
			// RefId: always an object; an empty reference has $id = 0
			return (this.item as any)[this.prop!];
		},
		href(): string | undefined {
			return url.blobUrl(this.blob);
		},
		hasImage(): boolean {
			return !!this.href;
		},
		tip(): string {
			return locale.$ClickToDownloadPicture;
		},
		cssStyle(): Record<string, string | undefined> {
			return { maxWidth: this.width, maxHeight: this.height };
		},
		uploadStyle(): Record<string, string | undefined> {
			const w = { width: this.width, height: this.height };
			if (!w.width) w.width = w.height;
			if (!w.height) w.height = w.width;
			return w;
		},
		uploadClass(): string {
			return 'file-upload' + (this.hover ? ' hover' : '');
		}
	},
	methods: {
		removeImage() {
			this.blob.$empty();
		},
		uploadImage(ev: Event) {
			this.hover = false;
			const input = ev.target as HTMLInputElement;
			const file = input.files![0];
			if (!file)
				return;
			const fd = new FormData();
			fd.append('file', file, file.name);
			// the door: endpoint from Url, key = prop
			const uploadUrl = url.combine(window.$$rootUrl, '_blob', this.url, this.prop);
			http.upload(uploadUrl, fd).then((result: any) => {
				// result = { Id, Token, Name, Mime }
				input.value = '';
				const b = this.blob;
				b[b._meta_.$id] = result.Id;
				b[b._meta_.$token] = result.Token;
				if ('Name' in b) b.Name = result.Name;
				if ('Mime' in b) b.Mime = result.Mime;
			}).catch((msg: string) => {
				input.value = '';
				if (msg.indexOf('UI:') === 0)
					tools.alert(msg.substring(3).replace('\\n', '\n'));
				else
					alert(msg);
			});
		}
	}
}));
