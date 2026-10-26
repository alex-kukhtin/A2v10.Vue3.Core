// a2-kanban (Net48 components/kanban.js), unchanged in behaviour: lanes, and in each the items whose item[stateProp]
// is the lane (by $id); slots header and footer take the lane, card the item. A card is dragged (HTML5 drag and drop)
// onto a lane: dropDelegate(card, lane); onto the trash: trashDelegate(card). No dropDelegate, no drag.

import { defineComponent } from 'vue';
import { vocabulary } from './platform.js';

const template = `
<div class="kanban">
	<div class="kanban-header kanban-part">
		<div class=lane-header v-for="(lane, lx) in lanes" :key=lx :class="laneClass(lane)">
			<div class=lane-header-body>
				<slot name=header v-bind:lane=lane></slot>
			</div>
			<button v-if="false">›</button>
		</div>
		<div class="kanban-trash drop-shadow shadow1" v-if="showTrash" @dragover="dragTrash($event)"
				@drop="dropTrash($event)" :class="trashClass()" @dragleave="clearDrag($event)">
			<i class="ico ico-trash"></i>
		</div>
	</div>
	<div class="kanban-body kanban-part">
		<div class=lane v-for="(lane, lx) in lanes" :key=lx @dragover="dragOver($event, lane)"
				@drop="drop($event, lane)" :class="laneClass(lane)" @dragleave="clearDrag($event)">
			<ul class=card-list>
				<li class=card v-for="(card, cx) in cards(lane)" :key=cx :draggable="true"
						@dragstart="dragStart($event, card)" @dragend=dragEnd>
					<slot name=card v-bind:card=card></slot>
				</li>
			</ul>
		</div>
	</div>
	<div class="kanban-footer kanban-part">
		<div class=lane-footer  v-for="(lane, lx) in lanes" :key=lx>
			<slot name=footer v-bind:lane=lane></slot>
		</div>
	</div>
</div>
`;

vocabulary.component('a2-kanban', defineComponent({
	template,
	props: {
		lanes: Array,
		items: Array,
		dropDelegate: Function,
		trashDelegate: Function,
		stateProp: String,
		showTrash: Boolean
	},
	data() {
		return {
			currentElem: null as any,
			laneOver: null as any,
			insideTrash: false
		};
	},
	methods: {
		cards(lane: any): any[] {
			const id = lane.$id;
			return (this.items as any[]).filter(itm => itm[this.stateProp!].$id === id);
		},
		clearDrag(ev?: DragEvent) {
			if (ev && (ev.currentTarget as Element).contains(ev.relatedTarget as Node))
				return;
			this.laneOver = null;
			this.insideTrash = false;
		},
		dragEnd() {
			this.clearDrag();
		},
		dragStart(ev: DragEvent, card: any) {
			this.clearDrag();
			if (!this.dropDelegate) {
				ev.preventDefault();
				return;
			}
			ev.dataTransfer!.effectAllowed = "move";
			this.currentElem = card;
		},
		dragOver(ev: DragEvent, lane: any) {
			this.laneOver = lane;
			this.insideTrash = false;
			ev.preventDefault();
		},
		dragTrash(ev: DragEvent) {
			this.insideTrash = true;
			ev.preventDefault();
		},
		drop(ev: DragEvent, lane: any) {
			this.clearDrag();
			if (!this.currentElem) return;
			if (this.dropDelegate)
				this.dropDelegate(this.currentElem, lane);
			this.currentElem = null;
		},
		dropTrash(ev: DragEvent) {
			this.clearDrag();
			if (!this.currentElem) return;
			if (this.trashDelegate)
				this.trashDelegate(this.currentElem);
			this.currentElem = null;
		},
		laneClass(lane: any): string | undefined {
			return lane == this.laneOver ? 'over' : undefined;
		},
		trashClass(): string | undefined {
			return this.insideTrash ? 'over' : undefined;
		}
	}
}));
