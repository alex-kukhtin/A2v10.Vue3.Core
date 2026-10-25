// a2-mdi-navbar (A2v10.Core Scripts/navbar.js), unchanged in behaviour: the menu bar and its open menu. It asked
// the shell to navigate by $parent.$emit('navigate'), an instance event Vue 3 dropped: the shell is injected.

import { require, vocabulary } from './platform.js';
import { defineComponent } from 'vue';

interface MenuItem {
	Name: string;
	Url?: string;
	Icon?: string;
	ClassName?: string;
	Menu?: MenuItem[];
	Row?: number;
	Col?: number;
	CreateUrl?: string;
	CreateName?: string;
}

type Shell = { navigate(to: { title: string, url: string }): void };

vocabulary.component('a2-mdi-navbar', defineComponent({
	template: `
<div class="mdi-navbar">
	<ul class="bar">
		<li v-for="m in menu" @click.stop.prevent=clickMenu(m) :title=m.Name :class="menuClass(m)">
			<i class="ico" :class="menuIcon(m)"></i>
			<span v-text="m.Name" class="menu-text"></span>
		</li>
	</ul>
	<div class="mdi-menu" v-if="isMenuVisible">
		<div class="menu-title" v-text=activeMenu.Name></div>
		<ul :style="mdiMenuStyle" :class="mdiMenuClass">
			<li v-for="m in activeMenu.Menu" class="level-0" :style="lev0Style(m)">
				<span class="folder" v-text="m.Name"></span>
				<ul v-if="!!m.Menu">
					<li v-for="im in m.Menu" class="level-1" @click.stop.prevent="clickSubMenu(im.Url, im.Name)">
						<span v-text="im.Name"></span>
						<button v-if="im.CreateUrl" class="btn-plus ico ico-plus-circle" 
							:title="im.CreateName" @click.stop.prevent="clickSubMenu(im.CreateUrl, im.CreateName)"></button>
					</li>
				</ul>
			</li>
		</ul>
	</div>
</div>
	`,
	inject: ['$shell'],
	props: {
		menu: Array as () => MenuItem[],
		columns: Number
	},
	data() {
		return {
			activeMenu: null as MenuItem | null
		};
	},
	computed: {
		isMenuVisible(): boolean {
			return !!this.activeMenu;
		},
		mdiMenuClass(): string {
			return this.columns! > 1 ? 'mdi-menu-grid' : '';
		},
		mdiMenuStyle(): Record<string, string> {
			if (this.columns! > 1)
				return { 'grid-template-columns': 'auto '.repeat(this.columns!) };
			return {};
		}
	},
	methods: {
		clickMenu(m: MenuItem) {
			const am = this.activeMenu;
			require('std:eventBus').$emit('closeAllPopups');
			const shell = this.$shell as Shell;
			if (m.ClassName === 'grow')
				return;
			if (!m.Menu) {
				this.activeMenu = null;
				shell.navigate({ title: m.Name, url: m.Url! });
			} else if (am === m) {
				this.activeMenu = null;
			} else {
				this.activeMenu = m;
			}
		},
		clickSubMenu(url: string, title: string) {
			require('std:eventBus').$emit('closeAllPopups');
			const shell = this.$shell as Shell;
			this.activeMenu = null;
			if (url.startsWith('page:'))
				shell.navigate({ title: title, url: url.substring(5) });
			else if (url.startsWith('dialog:')) {
				const dlgData = { promise: null, rd: true, direct: true };
				require('std:eventBus').$emit('modal', url.substring(7), dlgData);
			} else
				alert('invalid menu url: ' + url);
		},
		menuClass(m: MenuItem): string {
			return (m.ClassName ? m.ClassName : '') + ((m === this.activeMenu) ? ' active' : '');
		},
		menuIcon(m: MenuItem): string {
			return 'ico-' + m.Icon;
		},
		lev0Style(m: MenuItem): Record<string, string> {
			const s: Record<string, string> = {};
			if (m.Row! > 0)
				s['grid-row'] = '' + m.Row;
			if (m.Col! > 0)
				s['grid-column'] = '' + m.Col;
			return s;
		},
		__clickOutside() {
			this.activeMenu = null;
		}
	},
	mounted() {
		require('std:popup').registerPopup(this.$el);
		this.$el._close = this.__clickOutside;
	}
}));
