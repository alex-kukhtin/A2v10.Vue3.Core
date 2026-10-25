// a2-debug (Net48 components/debug.js), unchanged in behaviour: the debug panel of the shell (the data model of
// the active page, the profiling of the server's requests). a2-json-browser (Net48 browsejson.js) is not ported
// yet: a stub stands in its place and says so.

import { require, vocabulary } from './platform.js';
import { defineComponent } from 'vue';

const traceItem = defineComponent({
	name: 'a2-trace-item',
	template: `
<div v-if="hasElem" class="trace-item-body">
	<span class="title" v-text="name"/><span class="badge" v-text="elem.length"/>
	<ul class="a2-debug-trace-item">
		<li v-for="itm in elem">
			<div class="rq-title"><span class="elapsed" v-text="itm.elapsed + ' ms'"/> <span v-text="itm.text"/></div>
		</li>
	</ul>
</div>`,
	props: {
		name: String,
		elem: Array as () => any[]
	},
	computed: {
		hasElem(): boolean {
			return !!(this.elem && this.elem.length);
		}
	}
});

const jsonBrowserStub = defineComponent({
	template: '<div class="a2-json-browser">a2-json-browser: not ported yet</div>',
	props: {
		root: null,
		useSpec: Boolean
	},
	methods: {
		expandAll() { },
		clearExpanded() { }
	}
});

vocabulary.component('a2-debug', defineComponent({
	template: `
<div class="debug-panel" v-if="paneVisible" :class="panelClass">
	<div class="debug-pane-header">
		<span class="debug-pane-title" v-text="title"></span>
		<a class="btn btn-close" @click.prevent="close">&#x2715</a>
	</div>
	<div class="toolbar">
		<button class="btn btn-tb" @click.prevent="refresh"><i class="ico ico-reload"></i> {{text('$Refresh')}}</button>
		<template v-if="modelVisible">
			<div class="divider"/>
			<label class="btn btn-tb btn-checkbox" :class="{checked: useSpec}"
				:title="text('$ShowSpecProps')">
				<input type="checkbox" v-model="useSpec"/>
				<i class="ico ico-list"/>
			</label>
			<button class="btn btn-tb" @click.prevent="expandAll"><i class="ico ico-arrow-sort"></i></button>
		</template>
		<div class="aligner"></div>
		<button class="btn btn-tb" @click.prevent="toggle"><i class="ico" :class="toggleIcon"></i></button>
	</div>
	<div class="debug-model debug-body" v-if="modelVisible">
		<a2-json-browser :root="modelRoot()" :use-spec="useSpec" ref="modelJson"/>
	</div>
	<div class="debug-trace debug-body" v-if="traceVisible">
		<ul class="a2-debug-trace">
			<li v-for="r in trace">
				<div class="rq-title"><span class="elapsed" v-text="r.elapsed + ' ms'"/> <span v-text="r.url" /></div>
				<a2-trace-item name="Sql" :elem="r.items.Sql"></a2-trace-item>
				<a2-trace-item name="Render" :elem="r.items.Render"></a2-trace-item>
				<a2-trace-item name="Report" :elem="r.items.Report"></a2-trace-item>
				<a2-trace-item name="Workflow" :elem="r.items.Workflow"></a2-trace-item>
				<a2-trace-item class="exception" name="Exceptions" :elem="r.items.Exception"></a2-trace-item>
			</li>
		</ul>
	</div>
</div>
`,
	components: {
		'a2-trace-item': traceItem,
		'a2-json-browser': jsonBrowserStub
	},
	props: {
		modelVisible: Boolean,
		traceVisible: Boolean,
		modelStack: Array as () => any[],
		counter: Number,
		close: Function
	},
	data() {
		return {
			trace: [] as any[],
			left: false,
			useSpec: false
		};
	},
	computed: {
		refreshCount(): number | undefined {
			return this.counter;
		},
		paneVisible(): boolean {
			return this.modelVisible || this.traceVisible;
		},
		title(): string {
			const locale = window.$$locale;
			return this.modelVisible ? locale.$DataModel
				: this.traceVisible ? locale.$Profiling
					: '';
		},
		traceView(): boolean {
			return this.traceVisible;
		},
		toggleIcon(): string {
			return this.left ? 'ico-pane-right' : 'ico-pane-left';
		},
		panelClass(): string {
			return this.left ? 'left' : 'right';
		}
	},
	methods: {
		modelRoot(): unknown {
			// method. not cached
			if (!this.modelVisible)
				return {};
			if (this.modelStack!.length)
				return this.modelStack![0].$data;
			return {};
		},
		refresh() {
			if (this.modelVisible)
				this.$forceUpdate();
			else if (this.traceVisible)
				this.loadTrace();
		},
		expandAll() {
			if (!this.modelVisible) return;
			const brw = this.$refs.modelJson as any;
			if (!brw) return;
			brw.expandAll();
		},
		toggle() {
			this.left = !this.left;
		},
		loadTrace() {
			const root = window.$$rootUrl;
			const url = require('std:url').combine(root, '_shell/trace');
			// with skip events
			require('std:http').post(url, null, false, true).then((result: any[]) => {
				this.trace.splice(0, this.trace.length);
				if (!result) return;
				result.forEach((val) => {
					this.trace.push(val);
				});
			});
		},
		text(key: string): string {
			return window.$$locale[key];
		}
	},
	watch: {
		refreshCount() {
			// dataModel stack changed
			const brw = this.$refs.modelJson as any;
			if (brw)
				brw.clearExpanded();
			this.$forceUpdate();
		},
		traceView(newVal: boolean) {
			if (newVal)
				this.loadTrace();
		}
	},
	created() {
		require('std:eventBus').$on('endRequest', (url: string) => {
			if (!url) return;
			if (url.indexOf('/_shell/trace') !== -1) return;
			if (!this.traceVisible) return;
			this.loadTrace();
		});
	}
}));
