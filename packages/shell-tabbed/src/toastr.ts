// std:toastr (Net48 components/toastr.js), unchanged in behaviour: the toasts of the bus's 'toast'. Vue 3 renamed
// a transition's start classes (list-enter is list-enter-from): the old names are given, so the CSS (Toastr.less)
// stays as it is.

import { app, require } from './platform.js';
import { defineComponent } from 'vue';

const toastTemplate = `
<li class="toast" :class="toast.style">
	<i class="ico" :class="icoCssClass"></i>
	<span v-text="toast.text" />
</li>
`;

const toastrTemplate = `
<div class="toastr-stack" >
	<transition-group name="list" tag="ul" enter-from-class="list-enter" leave-from-class="list-leave">
		<a2-toast v-for="(t, k) in items" :toast="t" :key="t.$index"></a2-toast>
	</transition-group>
</div>
`;

interface Toast {
	text: string;
	style?: string;
	time?: number;
	$index?: number;
}

const toastComponent = defineComponent({
	template: toastTemplate,
	props: {
		toast: { type: Object, required: true }
	},
	computed: {
		icoCssClass(): string {
			switch (this.toast.style) {
				case 'success': return 'ico-check';
				case 'danger':
				case 'error':
					return 'ico-error-outline-nocolor';
				case 'warning': return 'ico-warning-outline';
				case 'info': return 'ico-info-outline';
			}
			return 'ico-dot';
		}
	}
});

const toastrComponent = defineComponent({
	template: toastrTemplate,
	components: {
		'a2-toast': toastComponent
	},
	data() {
		return {
			items: [] as Toast[],
			currentIndex: 0
		};
	},
	methods: {
		showToast(toast: Toast) {
			toast.$index = ++this.currentIndex;
			this.items.unshift(toast);

			setTimeout(() => {
				this.removeToast(toast.$index!);
			}, toast.time || 2000);
		},
		removeToast(tstIndex: number) {
			const ix = this.items.findIndex(x => x.$index === tstIndex);
			if (ix === -1) return;
			this.items.splice(ix, 1);
		}
	},
	created() {
		require('std:eventBus').$on('toast', this.showToast);
	}
});

app.components['std:toastr'] = toastrComponent;
