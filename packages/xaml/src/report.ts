// a2-pdfreport-viewer (Net48 components/report.js), unchanged in behaviour: the report as pdf in an <object>, from
// report/show/<the argument's id>?base=<url>&rep=<report>.

import { defineComponent } from 'vue';
import { require, vocabulary } from './platform.js';

const url = require('std:url');
const utils = require('std:utils');

vocabulary.component('a2-pdfreport-viewer', defineComponent({
	template: `
<div class="a2-pdfreport-viewer">
	<object type="application/pdf" :data="source" width="100%" height="100%"/>
</div>
`,
	props: {
		url: String,
		argument: Object,
		report: String
	},
	computed: {
		source(): string {
			const root = window.$$rootUrl;
			let arg: unknown = this.argument || 0;
			if (utils.isObjectExact(this.argument)) {
				arg = (this.argument as any).$id || 0;
			}
			return url.combine(root, 'report/show', arg) + url.makeQueryString({ base: this.url, rep: this.report });
		}
	}
}));
