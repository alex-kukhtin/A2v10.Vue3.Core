// a2-taskpad, a2-panel (Net48 components/taskpad.js, panel.js), unchanged in behaviour: the page's side pane, a
// collapsible panel.

import { defineComponent } from 'vue';
import { vocabulary } from './platform.js';

vocabulary.component('a2-taskpad', defineComponent({
	template:
		`<div :class="cssClass" :style="{width:width}">
	<a class="ico taskpad-collapse-handle" @click.stop="toggle"></a>
	<div v-if="expanded" class="taskpad-body">
		<slot>
		</slot>
	</div>
	<div v-else class="taskpad-title" @click.prevent="toggle">
		<span class="taskpad-label" v-text="tasksText"></span>
	</div>
</div>
`,
	props: {
		title: String,
		initialCollapsed: Boolean,
		position: String,
		initialWidth: { type: String, default: '20rem' }
	},
	data() {
		return {
			expanded: true
		};
	},
	computed: {
		width(): string | undefined {
			return this.expanded ? this.initialWidth : undefined;
		},
		cssClass(): string {
			let cls = 'taskpad';
			cls += ' position-' + this.position;
			if (this.expanded) cls += ' expanded'; else cls += ' collapsed';
			return cls;
		},
		tasksText(): string {
			return this.title || (window.$$locale as any).$Tasks;
		}
	},
	methods: {
		setExpanded(exp: boolean) {
			this.expanded = exp;
		},
		toggle() {
			this.setExpanded(!this.expanded);
		}
	},
	mounted() {
		if (this.initialCollapsed)
			this.setExpanded(false);
	}
}));

vocabulary.component('a2-panel', defineComponent({
	template:
		`<div :class="cssClass" :test-id="testId">
	<div class="panel-header" @click.prevent="toggle" v-if="!noHeader">
		<slot name='header'></slot>
		<span v-if="collapsible" class="ico panel-collapse-handle"></span>
	</div>
	<slot v-if="expanded"></slot>
</div>
`,
	props: {
		initialCollapsed: Boolean,
		collapsible: Boolean,
		panelStyle: String,
		noHeader: Boolean,
		testId: String
	},
	data() {
		return {
			collapsed: this.initialCollapsed
		};
	},
	computed: {
		cssClass(): string {
			let cls = 'panel';
			if (this.collapsed) cls += ' collapsed'; else cls += ' expanded';
			if (this.panelStyle) {
				const ps = this.panelStyle.toLowerCase();
				switch (ps) {
					case 'red':
					case 'danger':
					case 'error':
						cls += ' panel-red';
						break;
					case 'info':
					case 'cyan':
						cls += ' panel-cyan';
						break;
					case 'green':
					case 'success':
						cls += ' panel-green';
						break;
					case 'warning':
					case 'yellow':
						cls += ' panel-yellow';
						break;
					default:
						cls += ' panel-' + ps;
						break;
				}
			}
			return cls;
		},
		expanded(): boolean {
			return !this.collapsed;
		}
	},
	methods: {
		toggle() {
			if (!this.collapsible)
				return;
			this.collapsed = !this.collapsed;
		}
	}
}));
