// a2-mdi-header (A2v10.Core Scripts/appheader.js), unchanged in behaviour: the title or the logo, the slot (the
// nav pane), the user's menu. The logo's <img> lost its end tag: Vue 3's compiler refuses one on a void element.

import { require, vocabulary } from './platform.js';
import { defineComponent } from 'vue';

vocabulary.component('a2-mdi-header', defineComponent({
	template: `
	<div class="mdi-header">
		<div class="app-logo" v-if="hasLogo">
			<img :src="logo">
		</div>
		<div v-else class="app-title" v-text=title></div>
		<div class="aligner"></div>
		<slot></slot>
		<div class="dropdown dir-down separate" v-dropdown>
			<button class="user-name" toggle :title="personName"><i class="ico ico-user"></i> 
				<span id="layout-person-name" class="person-name" v-text="personName"></span>
				<span class="caret"></span>
			</button>
			<div class="dropdown-menu menu down-left">
				<button v-if=hasProfile @click=profile tabindex="-1" class="dropdown-item">
					<i class="ico ico-user"></i> 
					<span v-text="profileText"></span>
				</button>
				<button v-if=hasLicense @click=license tabindex="-1" class="dropdown-item">
					<i class="ico ico-policy"></i>
					<span v-text="licenseText"></span>
				</button>
				<button @click=logout tabindex="-1" class="dropdown-item">
					<i class="ico ico-logout"></i> 
					<span v-text="locale.$Quit"></span>
				</button>
			</div>
		</div>
	</div>
		`,
	props: {
		title: String,
		subTitle: String,
		personName: String,
		hasProfile: Boolean,
		hasLicense: Boolean,
		profileText: String,
		licenseText: String,
		enableDark: Boolean,
		isDark: Boolean,
		logo: String
	},
	computed: {
		locale() { return window.$$locale; },
		hasLogo(): boolean { return !!this.logo; }
	},
	methods: {
		async logout() {
			const res = await require('std:http').post('/account/logout2');
			window.location.assign(`/account/${res.showLogOut ? 'loggedout' : 'login'}`);
		},
		profile() {
			require('std:eventBus').$emit('navigateto', { url: '/_profile/index/0' });
		},
		license() {
			const dlgData = { promise: null, rd: true, raw: true };
			require('std:eventBus').$emit('modal', '/viewlicense', dlgData);
		},
		async setTheme(theme: string) {
			const res = await fetch(`/account/darkmode?theme=${theme}`, { method: 'POST' });
			if (res.ok)
				window.location.reload();
		}
	}
}));
