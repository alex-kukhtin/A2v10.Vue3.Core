// a2-document-title (Net48 components/doctitleplain.js, std:doctitle), unchanged in behaviour: Page.cs renders it for a
// page's Title; it renders nothing and tells the shell the title (setdoctitle), at creation and on each change.
// Net48's base.js gave it to every page as a local component; here it is the shell's word in the vocabulary.

import { defineComponent } from 'vue';
import { require, vocabulary } from './platform.js';

const eventBus = require('std:eventBus');

vocabulary.component('a2-document-title', defineComponent({
	render() {
		return null;
	},
	props: ['page-title'],
	watch: {
		pageTitle() {
			this.setTitle();
		}
	},
	methods: {
		setTitle() {
			eventBus.$emit('setdoctitle', this.pageTitle);
		}
	},
	created() {
		this.setTitle();
	}
}));
