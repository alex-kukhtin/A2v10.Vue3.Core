// The page's template (the application's template.ts), as the model reads it:
//   properties: members a type gets beyond its data, 'TRow.Sum' → a getter, { get, set }, a scalar
//     constructor (a data property), or a plain object (a marker: its value, or its `value`);
//   defaults: values of a new element's properties, 'Document.Date' → a value or a function;
//   events: handlers by event name (events.ts); a handler's false cancels a changing/adding event;
//   commands, delegates: called by the view; options: dirtiness and merge rules.

import { isEmptyObject, isFunction, isObjectExact, isPrimitiveCtor, isBoolean, isDefined } from '../base/is.js';
import { simpleEval } from '../base/path.js';
import type { ModelContext } from './context.js';
import { logInfo } from './context.js';
import { events } from './events.js';
import type { Elem, Root } from './types.js';

// The type of a template property declared as a plain object (template.ts: templatePropDefault).
// Its setter coerces by `type` when the object has both `type` and `value`; else stores what it is given.
export function TMarker() { }

export function createTemplate(ctx: ModelContext) {
	const file = ctx.platform.File;

	// template.properties by type: { TRow: { Sum: … } }, cached on the template as _props_.
	function cacheProperties(template: any): void {
		const byType: Record<string, Record<string, any>> = {};
		for (const p in template.properties) {
			const px = p.split('.');
			if (px.length !== 2) {
				console.error(`invalid propery name '${p}'`);
				continue;
			}
			const [typeName, propName] = px;
			(byType[typeName] ||= {})[propName] = template.properties[p];
		}
		template._props_ = byType;
	}

	function typeProps(elem: Elem, ctor: Function): Record<string, any> | null {
		const templ = elem._root_.$template;
		if (!templ) return null;
		const props = templ._props_;
		if (!props) return null;
		return ctor.name in props ? props[ctor.name] : null;
	}

	// Before the data properties: scalar ones join the type's metadata (so the data loop defines
	// them), plain objects become markers.
	function createPrimitiveProperties(elem: Elem, ctor: Function): void {
		const props = typeProps(elem, ctor);
		if (!props) return;
		for (const p in props) {
			const propInfo = props[p];
			if (!propInfo) continue;
			if (isPrimitiveCtor(propInfo, file)) {
				logInfo(ctx, `create scalar property: ${ctor.name}.${p}`);
				elem._meta_.props[p] = propInfo;
			} else if (isObjectExact(propInfo) && !propInfo.get) {
				logInfo(ctx, `create object property: ${ctor.name}.${p}`);
				elem._meta_.props[p] = TMarker;
				if (!elem._meta_.markerProps)
					elem._meta_.markerProps = {};
				elem._meta_.markerProps[p] = propInfo;
			}
		}
	}

	// After the data properties: getters and { get, set }, on the instance.
	function createObjProperties(elem: any, ctor: Function): void {
		const props = typeProps(elem, ctor);
		if (!props) return;
		for (const p in props) {
			const propInfo = props[p];
			if (!propInfo) continue;
			if (isPrimitiveCtor(propInfo, file))
				continue;
			else if (isFunction(propInfo)) {
				logInfo(ctx, `create property: ${ctor.name}.${p}`);
				Object.defineProperty(elem, p, {
					configurable: false,
					enumerable: true,
					get: propInfo as () => unknown
				});
			} else if (isObjectExact(propInfo)) {
				if (propInfo.get) {
					logInfo(ctx, `create property: ${ctor.name}.${p}`);
					Object.defineProperty(elem, p, {
						configurable: false,
						enumerable: true,
						get: propInfo.get,
						set: propInfo.set
					});
				}
			} else {
				console.error(`invalid template property: ${ctor.name}.${p}`);
			}
		}
	}

	function hasTemplateProps(elem: Elem): boolean {
		const templ = elem._root_.$template;
		return !!templ && !isEmptyObject(templ._props_);
	}

	// Calls the template's handler of the event, if any; its answer is the event's answer.
	// Any event marks the model for validation.
	function emit(this: Root, event: string, ...args: unknown[]): unknown {
		if (this._enableValidate_ && !this._needValidate_)
			this._needValidate_ = true;
		logInfo(ctx, 'emit: ' + event);
		const handlers = this.$template?.events;
		if (!handlers) return;
		if (event in handlers) {
			logInfo(ctx, 'handle: ' + event);
			const rv = handlers[event].call(this, ...args);
			if (rv === false)
				logInfo(ctx, event + ' returns false');
			return rv;
		}
	}

	// Applies template.defaults to the new elements ($isNew) at their paths; not to array elements.
	function setDefaults(root: Root): boolean | undefined {
		const defaults = root.$template?.defaults;
		if (!defaults) return false;
		if (root.$isCopy) return false;
		let called: boolean | undefined;
		for (const p in defaults) {
			const px = p.lastIndexOf('.');
			if (px === -1)
				continue;
			const path = p.substring(0, px);
			const prop = p.substring(px + 1);
			if (prop.endsWith('[]'))
				continue;
			const def = defaults[p];
			const obj = simpleEval(root, path); // '' for 'Rows[]': array elements get no defaults (NET48-BUGS.md Q3)
			if (obj.$isNew) {
				called = true;
				ctx.platform.set(obj, prop, isFunction(def) ? def.call(root, obj, prop) : def);
			}
		}
		return called;
	}

	// --- options ---------------------------------------------------------------------------------

	function options(root: Root): any {
		const t = root.$template;
		return t && t.options;
	}

	// options.bindOnce: properties a merge with checkBindOnce leaves as they are.
	function isSkipMerge(root: Root, prop: string): boolean {
		const bo = options(root)?.bindOnce;
		if (!bo) return false;
		return bo.indexOf(prop) !== -1;
	}

	// options.noDirty: nothing makes the model dirty.
	function isNoDirty(root: Root): boolean {
		return options(root)?.noDirty;
	}

	// options.skipDirty: 'Path.Prop' or an array's 'Path' whose changes do not make it dirty.
	function isSkipDirty(root: Root, path: string): boolean {
		const sd = options(root)?.skipDirty;
		if (!sd || !Array.isArray(sd)) return false;
		return sd.indexOf(path) !== -1;
	}

	function getGlobalSaveEvent(this: Root): string | undefined {
		return options(this)?.globalSaveEvent;
	}

	// --- commands and delegates ------------------------------------------------------------------

	function canExecuteCommand(this: Root, cmd: string, arg?: unknown, opts?: any): boolean {
		const cmdf = this.$template?.commands?.[cmd];
		if (!cmdf) return false;
		if (opts && opts.checkArgument === true && !arg)
			return false;
		if ((cmdf.checkReadOnly === true || opts && opts.checkReadOnly === true) && this.$root.$readOnly)
			return false;
		if ((cmdf.validRequired === true || opts && opts.validRequired === true) && !this.$root.$valid)
			return false;
		if (isFunction(cmdf.canExec))
			return cmdf.canExec.call(this, arg);
		else if (isBoolean(cmdf.canExec))
			return cmdf.canExec; // for debugging purposes
		else if (isDefined(cmdf.canExec)) {
			console.error(`${cmd}.canExec should be a function`);
			return false;
		}
		return true;
	}

	// Runs a command: confirm (vm.$confirm), save first (vm.$save) and validity as the command or
	// opts ask. Validation is off while it runs, and marked needed after.
	function executeCommand(this: Root, cmd: string, arg?: unknown, confirm?: unknown, opts?: any): unknown {
		try {
			this._root_._enableValidate_ = false;
			const vm = this.$vm;
			const commands = this.$template?.commands;
			if (!commands) return;
			const cmdf = commands[cmd];
			if (!cmdf) {
				console.error(`Command "${cmd}" not found`);
				return;
			}
			const optConfirm = cmdf.confirm || confirm;
			const optSaveRequired = cmdf.saveRequired || opts && opts.saveRequired;
			const optValidRequired = cmdf.validRequired || opts && opts.validRequired;

			if (optValidRequired && !vm.$data.$valid) return;
			if (isFunction(cmdf.canExec) && !cmdf.canExec.call(this, arg)) return;

			const that = this;
			const realExec = function () {
				if (isFunction(cmdf))
					return cmdf.call(that, arg);
				else if (isFunction(cmdf.exec))
					return cmdf.exec.call(that, arg);
				console.error(`There is no method 'exec' in command '${cmd}'`);
			};
			const doExec = function () {
				if (optConfirm)
					vm.$confirm(optConfirm).then(realExec);
				else
					return realExec();
			};
			if (optSaveRequired && vm.$isDirty)
				vm.$save().then(doExec);
			else
				return doExec();
		} finally {
			this._root_._enableValidate_ = true;
			this._root_._needValidate_ = true;
		}
	}

	// A template delegate bound to the root.
	function getDelegate(this: Root, name: string): Function | null | undefined {
		const delegates = this.$template?.delegates;
		if (!delegates) {
			console.error('There are no delegates in the template');
			return null;
		}
		if (name in delegates)
			return delegates[name].bind(this.$root);
		console.error(`Delegate "${name}" not found in the template`);
	}

	return {
		events,
		cacheProperties,
		hasTemplateProps,
		createPrimitiveProperties,
		createObjProperties,
		emit,
		setDefaults,
		isSkipMerge,
		isNoDirty,
		isSkipDirty,
		getGlobalSaveEvent,
		canExecuteCommand,
		executeCommand,
		getDelegate
	};
}

export type Template = ReturnType<typeof createTemplate>;
