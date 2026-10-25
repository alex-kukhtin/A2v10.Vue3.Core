// The page's controller (Net48 controllers/base.js). On Vue 2 it was the page's Vue instance; here it is an object
// over the page's reactive model root, created by the page's component (page.ts), which forwards its $-members to
// the template. It is the page for everyone else: the model ($vm), the template code ($ctrl, its face), the shell
// (tab.root, registerData, closePlain), the components (inject '$page').
// Ported member by member, as base.js has them, every one (the trace: test/trace/base.port.js against
// base.net48.trace). Its methods are bound to it, as Vue 2 bound a component's.

import { markRaw, nextTick, shallowReactive } from 'vue';
import { bus } from '../bus.js';
import { app, require } from '../modules.js';
import { platform } from '../platform.js';

// What the page's descriptor says of the page (Vue3DataScripter's FOOTER).
export interface PageInfo {
	baseUrl: string;
	inDialog: boolean;
	isIndex: boolean;
	isSkipDataStack: boolean;
}

const __blank__ = '__blank__';

const std = {
	get url() { return require('std:url') as any; },
	get utils() { return require('std:utils') as any; },
	get modelInfo() { return require('std:modelInfo') as any; },
	get dataservice() { return require('std:dataservice') as any; },
	get mask() { return require('std:mask') as any; },
	get html() { return require('std:html') as any; },
	get http() { return require('std:http') as any; },
	get locale() { return window.$$locale as any; },
	get store() { return app.components['std:store'] as any; }
};

// <root>/_data/<verb>
function dataUrl(verb: string): string {
	return `${window.$$rootUrl}/${(require('std:routing') as any).dataUrl()}/${verb}`;
}

function isPermissionsDisabled(opts: any, arg: any): boolean {
	if (!arg || !opts || !opts.checkPermission) return false;
	const prop = opts.checkPermission;
	if (!std.utils.isDefined(arg.$permissions)) {
		console.warn('[!!Permissions] not found');
		return true;
	}
	const perm = arg.$permissions;
	if (prop in perm)
		return !perm[prop];
	return true;
}

// The shell's modal (bus 'modal'): resolves with the dialog's result after cb has it; never, if the dialog is
// cancelled (the shell does not settle the promise).
function __runDialog(url: string, arg: unknown, query: unknown, cb: (result: any) => void): Promise<unknown> {
	if (url.indexOf('?') !== -1) {
		const x = std.url.parseUrlAndQuery(url);
		url = x.url;
		query = x.query;
	}
	return new Promise(function (resolve) {
		const dlgData = { promise: null as Promise<unknown> | null, data: arg, query: query, rd: true };
		bus.$emit('modal', url, dlgData);
		dlgData.promise!.then(function (result) {
			cb(result);
			resolve(result);
		});
	});
}

function treeNormalPath(path: string): string | undefined {
	if (!path) return;
	path = '' + path;
	return [...new Set(path.split('.'))].join('.');
}

function makeErrors(errs: any[]): string[] | null {
	const ra: string[] = [];
	for (const x of errs) {
		for (const y of x.e) {
			ra.push(y.msg);
		}
	}
	return ra.length ? ra : null;
}

export class Controller {
	// the model root, through Vue's proxy: the one way to it
	readonly $data: any;
	readonly inDialog: boolean;
	readonly isIndex: boolean;
	readonly isSkipDataStack: boolean;

	$caller: Controller | null = null;
	$store: any = null;
	$el: Element | null = null;

	// what the shell and the include write on a page
	__tabUrl__?: string;
	__requery?: () => void;

	__destroyed__ = false;
	__testId__: string | null = null;
	__saveEvent__: string | null = null;
	__asyncCache__: Record<string, any> = {};
	__currentToken__ = '';
	__ensureSaving__: Promise<unknown> | null = null;

	// Vue 2 kept these in the root's data, merged by Vue from base.js's data(): out of the model here.
	readonly __state__ = shallowReactive({
		baseUrl: '',
		baseQuery: {} as Record<string, string>,
		requestsCount: 0
	});

	$defer = platform.defer;
	$print = platform.print;

	constructor(root: object, info: PageInfo) {
		this.$data = root;
		this.inDialog = info.inDialog;
		this.isIndex = info.isIndex;
		this.isSkipDataStack = info.isSkipDataStack;
		for (const name of Object.getOwnPropertyNames(Controller.prototype)) {
			const d = Object.getOwnPropertyDescriptor(Controller.prototype, name)!;
			if (name !== 'constructor' && typeof d.value === 'function')
				(this as any)[name] = d.value.bind(this);
		}
		markRaw(this); // a page in the shell's reactive data (tab.root) stays itself
	}

	// --- what Vue 2 computed --------------------------------------------------------------------------------------

	get $baseUrl(): string { return this.__state__.baseUrl; }
	get $baseQuery(): Record<string, string> { return this.__state__.baseQuery; }
	get $indirectUrl(): string { return this.$data.__modelInfo.__indirectUrl__ || ''; }
	get $query(): unknown { return this.$data._query_; }
	get $jsonQuery(): string { return std.utils.toJson(this.$data.Query); } // watched by the page: a change reloads
	get $isDirty(): boolean { return this.$data.$dirty; }
	get $isPristine(): boolean { return !this.$data.$dirty; }
	get $isLoading(): boolean { return this.__state__.requestsCount > 0; }
	get $modelInfo(): unknown { return this.$data.__modelInfo; }
	get $canSave(): boolean { return this.$isDirty && !this.$isLoading; }

	// --- the messages ---------------------------------------------------------------------------------------------

	$confirm(prms: any): Promise<unknown> {
		// TODO: tools
		if (std.utils.isString(prms))
			prms = { message: prms };
		prms.style = prms.style || 'confirm';
		prms.message = prms.message || prms.msg; // message or msg
		const dlgData = { promise: null, data: prms };
		bus.$emit('confirm', dlgData);
		return dlgData.promise!;
	}

	$msg(msg: string, title?: string, style?: string): Promise<unknown> {
		const prms = { message: msg, title: title || std.locale.$Message, style: style || 'info' };
		return this.$confirm(prms);
	}

	$alert(msg: any, title?: string, list?: unknown): Promise<unknown> {
		// TODO: tools
		if (std.utils.isObject(msg) && !title && !list) {
			const prms = msg;
			msg = prms.message || prms.msg;
			title = prms.title;
			list = prms.list;
		}
		const dlgData = {
			promise: null, data: {
				message: msg, title: title, style: 'alert', list: list
			}
		};
		bus.$emit('confirm', dlgData);
		return dlgData.promise!;
	}

	$alertUi(msg: any): void {
		if (msg instanceof Error) {
			alert(msg.message);
			return;
		}
		if (msg.indexOf('UI:') === 0)
			this.$alert(msg.substring(3).replace('\\n', '\n'));
		else
			alert(msg);
	}

	$toast(toast: any, style?: string, time?: number): void {
		if (!toast) return;
		if (std.utils.isString(toast))
			toast = { text: toast, style: style || 'success', time: time };
		bus.$emit('toast', toast);
	}

	// --- dialogs --------------------------------------------------------------------------------------------------

	$showDialog(url: string, arg?: unknown, query?: unknown, opts?: any): Promise<unknown> | undefined {
		return this.$dialog('show', url, arg, query, opts);
	}

	$inlineOpen(id: string): void {
		bus.$emit('inlineDialog', { cmd: 'open', id: id });
	}

	$inlineClose(id: string, result?: unknown): void {
		bus.$emit('inlineDialog', { cmd: 'close', id: id, result: result });
	}

	$inlineDepth(): number {
		const opts = { count: 0 };
		bus.$emit('inlineDialogCount', opts);
		return opts.count;
	}

	$closeAllPopups(): void {
		bus.$emit('closeAllPopups');
	}

	// command: new, append, browse, edit-selected, show-selected, edit, copy; else a plain show. The result of the
	// dialog is merged where the command says. saveRequired: the page is saved first, the dialog opens if it was (B22).
	$dialog(command: string, url: string, arg?: any, query?: any, opts?: any): Promise<unknown> | undefined {
		if (this.$isReadOnly(opts))
			return;
		const that = this;
		bus.$emit('closeAllPopups');
		function argIsNotAnArray() {
			if (!std.utils.isArray(arg)) {
				console.error(`$dialog.${command}. The argument is not an array`);
				return true;
			}
		}
		function argIsNotAnObject() {
			if (!std.utils.isObjectExact(arg)) {
				console.error(`$dialog.${command}. The argument is not an object`);
				return true;
			}
		}

		function simpleMerge(target: any, src: any) {
			for (const p in target) {
				if (p in src)
					target[p] = src[p];
				else
					target[p] = undefined;
			}
		}

		function doDialog(): Promise<unknown> | undefined {
			// result always is raw data
			if (that.$isDisabledAlert(opts, arg))
				return;
			if (std.utils.isFunction(query))
				query = query();
			const reloadAfter = opts && opts.reloadAfter;
			switch (command) {
				case 'new':
					if (argIsNotAnArray()) return;
					return __runDialog(url, 0, query, (result) => {
						const sel = arg.$selected;
						if (sel)
							sel.$merge(result);
					});
				case 'append':
					if (argIsNotAnArray()) return;
					return __runDialog(url, 0, query, (result) => {
						arg.$append(result);
						if (reloadAfter)
							that.$reload();
					});
				case 'browse':
					if (!std.utils.isObject(arg)) {
						console.error(`$dialog.${command}. The argument is not an object`);
						return;
					}
					return __runDialog(url, arg, query, (result) => {
						if (arg.$merge) {
							arg.$merge(result);
						} else if (result !== false) {
							simpleMerge(arg, result);
						}
					});
				case 'edit-selected':
					if (argIsNotAnArray()) return;
					if (!arg.$selected) return;
					if (that.$isDisabledAlert(opts, arg.$selected))
						return;
					return __runDialog(url, arg.$selected, query, (result) => {
						arg.$selected.$merge(result);
						arg.__fireChange__('selected');
						if (reloadAfter)
							that.$reload();
					});
				case 'show-selected':
					if (argIsNotAnArray()) return;
					if (!arg.$selected) return;
					return __runDialog(url, arg.$selected, query, (result) => {
						if (result === 'reload' || reloadAfter)
							that.$reload();
					});
				case 'edit':
					if (argIsNotAnObject()) return;
					return __runDialog(url, arg, query, (result) => {
						if (arg.$merge && std.utils.isObjectExact(result))
							arg.$merge(result);
						if (result === 'reload' || reloadAfter)
							that.$reload();
					});
				case 'copy': {
					if (argIsNotAnObject()) return;
					const arr = arg.$parent;
					return __runDialog(url, arg, query, (result) => {
						arr.$append(result);
						if (reloadAfter)
							that.$reload();
					});
				}
				default: // simple show dialog
					return __runDialog(url, arg, query, () => {
						if (reloadAfter)
							that.$reload();
					});
			}
		}

		if (opts && opts.validRequired && this.$data.$invalid) {
			this.$alert(std.locale.$MakeValidFirst);
			return;
		}

		const mo = this.$data.$mainObject;
		if (opts && opts.saveRequired && (this.$isDirty || mo && mo.$isNew)) {
			this.$data.$setDirty(true);
			const saving = this.$save();
			return saving ? saving.then(() => doDialog()) : undefined;
		}
		return doDialog();
	}

	// --- closing --------------------------------------------------------------------------------------------------

	$close(): void {
		if (this.$saveModified())
			this.$store.commit('close');
	}

	$modalClose(result?: unknown): void {
		bus.$emit('modalClose', result);
	}

	// A dialog's OK: saved first if dirty (valid first, if asked); the modal closes with the saved element.
	$modalSaveAndClose(result?: unknown, opts?: any): void {
		if (this.$isDirty) {
			const root = this.$data;
			if (opts && opts.validRequired && root.$invalid) {
				const errs = makeErrors(root.$forceValidate());
				this.$alert(std.locale.$MakeValidFirst, undefined, errs);
				return;
			}
			this.$save()!.then((result) => bus.$emit('modalClose', result));
		}
		else
			bus.$emit('modalClose', result);
	}

	$modalSelect(array: any, opts?: any): void {
		if (!('$selected' in array)) {
			console.error('Invalid array for $modalSelect');
			return;
		}
		if (opts && opts.validRequired) {
			const root = this.$data;
			if (!root.$valid) return;
		}
		this.$modalClose(array.$selected);
	}

	$modalSelectChecked(array: any): void {
		if (!('$checked' in array)) {
			console.error('invalid array for $modalSelectChecked');
			return;
		}
		const chArray = array.$checked;
		if (chArray.length > 0)
			this.$modalClose(chArray);
	}

	$saveAndClose(opts?: any): void {
		if (this.$isDirty)
			this.$save(opts)!.then(() => this.$close());
		else
			this.$close();
	}

	$saveModified(message?: string, title?: string, validRequired?: boolean): boolean {
		if (!this.$isDirty)
			return true;
		if (this.isIndex)
			return true;
		const self = this as any;
		const locale = std.locale;
		const dlg = {
			message: message || locale.$ElementWasChanged,
			title: title || locale.$ConfirmClose,
			buttons: [
				{ text: locale.$Save, result: 'save' },
				{ text: locale.$NotSave, result: 'close' },
				{ text: locale.$Cancel, result: false }
			]
		};
		function closeImpl(result: unknown) {
			if (self.inDialog)
				bus.$emit('modalClose', result);
			else
				self.$close();
		}

		this.$confirm(dlg).then(function (result) {
			if (result === 'close') {
				// close without saving
				self.$data.$setDirty(false);
				closeImpl(false);
			} else if (result === 'save') {
				// save then close
				if (validRequired && self.$data.$invalid) {
					const errs = makeErrors(self.$data.$forceValidate());
					self.$alert(std.locale.$MakeValidFirst, undefined, errs);
					return false;
				}
				self.$save().then(function (saveResult: unknown) {
					closeImpl(saveResult);
				});
			}
		});
		return false;
	}

	// --- the caller, the bus ----------------------------------------------------------------------------------------

	$setCurrentUrl(url: string): void {
		if (this.inDialog)
			url = std.url.combine('_dialog', url);
		this.__state__.baseUrl = url;
		bus.$emit('modalSetBase', url);
	}

	$emitSaveEvent(): void {
		if (!this.__saveEvent__)
			return;
		const caller = this.__liveCaller__();
		if (caller)
			caller.$data.$emit(this.__saveEvent__, this.$data);
	}

	$emitGlobal(event: string, data?: unknown): void {
		bus.$emit('globalAppEvent', { event, data });
	}

	$emitParentTab(event: string, data?: unknown): void {
		bus.$emit('toParentTab', { event, source: this, data });
	}

	$emitCaller(event: string, ...arr: unknown[]): void {
		if (!this.$caller)
			console.error('There is no caller here'); // Net48: log.error, std:log's error
		const caller = this.__liveCaller__();
		if (caller)
			caller.$data.$emit(event, ...arr);
	}

	// the caller page, or null when it is gone: a caller tab may be closed before this one
	__liveCaller__(): Controller | null {
		const c = this.$caller;
		return c && !c.__destroyed__ ? c : null;
	}

	$saveCaller(): unknown {
		const caller = this.__liveCaller__() as any;
		if (caller)
			return caller.$save();
		return null;
	}

	$dirtyCaller(): void {
		const caller = this.__liveCaller__();
		if (caller)
			caller.$data.$setDirty(true);
	}

	$shareUrl(): string {
		const x = { url: '' };
		bus.$emit('activeTabUrl', x);
		return x.url;
	}

	$delegate(name: string): unknown {
		return this.$data._delegate_(name);
	}

	// --- commands: the template's (root._exec_, _canExec_), moves, delegates ----------------------------------------

	$marker(): boolean {
		return true;
	}

	$exec(cmd: string, arg?: unknown, confirm?: unknown, opts?: any): unknown {
		if (this.$isReadOnly(opts)) return;
		if (this.$isLoading) return;

		if (this.$isDisabledAlert(opts, arg))
			return;

		bus.$emit('closeAllPopups');
		const root = this.$data;
		return root._exec_(cmd, arg, confirm, opts);
	}

	$execSelected(cmd: string, arg: any, confirm?: unknown): void {
		if (this.$isLoading) return;
		const root = this.$data;
		if (!std.utils.isArray(arg)) {
			console.error('Invalid argument for $execSelected');
			return;
		}
		bus.$emit('closeAllPopups');
		if (!confirm)
			root._exec_(cmd, arg.$selected);
		else
			this.$confirm(confirm).then(() => root._exec_(cmd, arg.$selected));
	}

	$isPermissionsDisabled(opts: any, arg: any): boolean {
		return isPermissionsDisabled(opts, arg);
	}

	$canExecute(cmd: string, arg?: unknown, opts?: any): boolean {
		//if (this.$isLoading) return false; // do not check here. avoid blinking
		if (this.$isReadOnly(opts))
			return false;
		const root = this.$data;
		return root._canExec_(cmd, arg, opts);
	}

	$canExecSel(cmd: string, arg: any, opts?: any): boolean {
		if (!arg) return false;
		const sel = arg.$selected;
		if (!sel) return false;
		return this.$canExecute(cmd, sel, opts);
	}

	$move(dir: string, arg: any): void {
		if (!arg) return;
		arg.$parent.$move(arg, dir);
	}

	$moveSelected(dir: string, arg: any): void {
		if (!arg) return;
		const sel = arg.$selected;
		if (sel)
			arg.$move(sel, dir);
	}

	$canMove(dir: string, arg: any): boolean {
		if (!arg) return false;
		return arg.$parent.$canMove(arg, dir);
	}

	$canMoveSelected(dir: string, arg: any): boolean {
		if (!arg) return false;
		const sel = arg.$selected;
		if (!sel) return false;
		return arg.$canMove(sel, dir);
	}

	// A delegate of the template (delegates[name]) called with the clicked element.
	$handleClick(name: string, ev: Event): void {
		ev.preventDefault();
		ev.stopPropagation();
		const tml = this.$data.$template;
		if (!tml) return;
		const cmd = tml.delegates;
		if (!cmd) return;
		const func = cmd[name];
		if (!func) return;
		func.call(this.$data, ev.target, name);
	}

	$hasChecked(arr: any): unknown {
		return arr && arr.$checked && arr.$checked.length;
	}

	$sanitize(text: string): string {
		return std.utils.text.sanitize(text);
	}

	// The element of id htmlid, or its first input, gets the focus after the update.
	$focus(htmlid: string): void {
		const elem = document.querySelector('#' + htmlid) as HTMLElement | null;
		if (!elem) return;
		const ch = elem.querySelector('input, textarea, button, select') as HTMLElement | null;
		this.$defer(() => {
			if (ch && ch.focus)
				ch.focus();
			else if (elem.focus)
				elem.focus();
		});
	}

	$toJson(data: unknown): string {
		return std.utils.toJson(data);
	}

	$maxChars(text: string, length: number): string {
		return std.utils.text.maxChars(text, length);
	}

	// --- navigation -----------------------------------------------------------------------------------------------

	$mailto(arg: string, subject?: string): string {
		let href = 'mailto:' + arg;
		if (subject)
			href += '?subject=' + std.url.encodeUrl(subject);
		return href;
	}

	$callphone(phone: string): string {
		return `tel:${phone}`;
	}

	$href(url: string, data?: unknown): string {
		return std.url.createUrlForNavigate(url, data);
	}

	// A new window gets this page's token: its saves come back through childrenSaved (__notified).
	$navigate(url: string, data?: unknown, newWindow?: boolean, update?: unknown, opts?: any): void {
		if (this.$isReadOnly(opts)) return;
		bus.$emit('closeAllPopups');

		const doNavigate = () => {
			const urlToNavigate = std.url.createUrlForNavigate(url, data);
			if (newWindow === true) {
				const nwin = window.open(urlToNavigate, '_blank') as any;
				if (nwin)
					nwin.$$token = { token: this.__currentToken__, update: update };
			}
			else
				this.$store.commit('navigate', { url: urlToNavigate });
		};
		if (opts && opts.saveRequired && this.$isDirty)
			this.$save()!.then(() => doNavigate());
		else
			doNavigate();
	}

	$navigateSimple(url: string, newWindow?: boolean, update?: unknown): void {
		bus.$emit('closeAllPopups');
		if (newWindow === true) {
			const nwin = window.open(url, '_blank') as any;
			if (nwin)
				nwin.$$token = { token: this.__currentToken__, update: update };
		}
		else
			this.$store.commit('navigate', { url: url });
	}

	$navigateExternal(url: string, newWindow?: boolean): void {
		bus.$emit('closeAllPopups');
		if (newWindow === true) {
			window.open(url, '_blank');
		}
		else
			window.location.assign(url);
	}

	$openSelectedFrame(url: string, arr: any): void {
		url = url || '';
		const sel = arr.$selected;
		if (!sel)
			return;
		const urlToNavigate = std.url.createUrlForNavigate(url, sel.$id);
		bus.$emit('openframe', urlToNavigate);
	}

	// url '{Prop}': the selected element's property holds it.
	$openSelected(url: string, arr: any, newwin?: boolean, update?: unknown): void {
		bus.$emit('closeAllPopups');
		url = url || '';
		const sel = arr.$selected;
		if (!sel)
			return;
		if (url.startsWith('{')) { // decorated. defer evaluate
			url = url.substring(1, url.length - 1);
			const nUrl = std.utils.eval(sel, url);
			if (!nUrl)
				throw new Error(`Property '${url}' not found in ${sel.constructor.name} object`);
			url = nUrl;
		}
		this.$navigate(url, sel.$id, newwin, update);
	}

	// The side pane of the shell: _navpane/url/arg?data; null hides it.
	$showSidePane(url: string, arg?: unknown, data?: object): void {
		const newurl = std.url.combine('_navpane', url, arg || '0') + std.url.makeQueryString(data);
		bus.$emit('showSidePane', newurl);
	}

	$hideSidePane(): void {
		bus.$emit('showSidePane', null);
	}

	$showHelp(path: string): void {
		const w = window as any;
		if (w.$$helpWindow && !w.$$helpWindow.closed)
			w.$$helpWindow.close();
		w.$$helpWindow = window.open(this.$helpHref(path), '_blank');
	}

	$helpHref(path: string): string {
		return std.url.helpHref(path);
	}

	// --- files, exports, reports ----------------------------------------------------------------------------------

	$download(url: string): void {
		bus.$emit('closeAllPopups');
		const root = window.$$rootUrl;
		url = std.url.combine('/file', url.replace('.', '-'));
		(window as any).location = root + url;
	}

	async $uploadBlob(url: string, accept?: string, data?: any, opts?: any): Promise<unknown> {
		bus.$emit('closeAllPopups');
		try {
			const file = await std.html.uploadFile(accept);
			return await this.$uploadBlobFile(url, file, data, { catchError: true });
		} catch (err) {
			err = err || 'unknown error';
			if (opts && opts.catchError)
				throw err;
			else
				this.$alertUi(err);
			return false;
		}
	}

	// a ready file (paste, drop): no picker. No closeAllPopups either — the editor may itself live in a popup
	async $uploadBlobFile(url: string, file: File, data?: any, opts?: any): Promise<unknown> {
		const root = window.$$rootUrl;
		try {
			const dat = new FormData();
			dat.append('file', file, file.name);
			// an attachment: exactly Id and Base of data, nothing else reaches the query
			const qry = data ? { base: data.Base, owner: data.Id } : null;
			const uploadUrl = std.url.combine(root, '_blob', url) + std.url.makeQueryString(qry);
			return await std.http.upload(uploadUrl, dat);
		} catch (err) {
			err = err || 'unknown error';
			if (opts && opts.catchError)
				throw err;
			else
				this.$alertUi(err);
			return false;
		}
	}

	async $upload(url: string, accept?: string, data?: any, opts?: any): Promise<unknown> {
		bus.$emit('closeAllPopups');
		const root = window.$$rootUrl;
		try {
			const file = await std.html.uploadFile(accept, url);
			const dat = new FormData();
			dat.append('file', file, file.name);
			if (data)
				dat.append('Key', data.Key || null);
			let uploadUrl = std.url.combine(root, '_file', url);
			uploadUrl = std.url.createUrlForNavigate(uploadUrl, data);
			return await std.http.upload(uploadUrl, dat);
		} catch (err) {
			err = err || 'unknown error';
			if (opts && opts.catchError)
				throw err;
			else
				this.$alertUi(err);
			return false;
		}
	}

	// _file/url/id: opened, downloaded (action 'download') or printed (action 'print'); the element's $token goes too.
	$file(url: string, arg: any, opts?: any, dat?: Record<string, unknown>): void {
		bus.$emit('closeAllPopups');
		const doFile = () => {
			const root = window.$$rootUrl;
			let id = arg;
			let token = undefined;
			if (arg && std.utils.isObject(arg)) {
				id = std.utils.getStringId(arg);
				if (arg._meta_ && arg._meta_.$token)
					token = arg[arg._meta_.$token];
			}
			let fileUrl = std.url.combine(root, '_file', url, id);
			const qry = dat || {};
			const action = (opts || {}).action;
			if (token)
				qry.token = token;
			if (action == 'download')
				qry.export = 1;
			fileUrl += std.url.makeQueryString(qry);
			switch (action) {
				case 'download':
					std.html.downloadUrl(fileUrl);
					break;
				case 'print':
					std.html.printDirect(fileUrl);
					break;
				default:
					window.open(fileUrl, '_blank');
			}
		};
		if (opts && opts.saveRequired && this.$isDirty) {
			this.$save()!.then(() => {
				doFile();
			});
		} else
			doFile();
	}

	$attachment(url: string, arg: any, opts?: any): void {
		bus.$emit('closeAllPopups');
		const root = window.$$rootUrl;
		const cmd = opts && opts.export ? 'export' : 'show';
		let id = arg;
		let token = undefined;
		if (arg && std.utils.isObject(arg)) {
			id = std.utils.getStringId(arg);
			if (arg._meta_ && arg._meta_.$token)
				token = arg[arg._meta_.$token];
		}
		let attUrl = std.url.combine(root, 'attachment', cmd, id);
		const qry: Record<string, unknown> = { base: url };
		if (token)
			qry.token = token;
		attUrl = attUrl + std.url.makeQueryString(qry);
		if (opts && opts.newWindow)
			window.open(attUrl, '_blank');
		else if (opts && opts.print)
			std.html.printDirect(attUrl);
		else
			window.location.assign(attUrl);
	}

	// The signing dialog (eusign/index) over the attachment arg; its result. Net48 called an undeclared cb and
	// alerted (B25): fixed, the dialog's promise is returned.
	$eusign(baseurl: string, arg: unknown): Promise<unknown> {
		const dlgData = {
			promise: null as Promise<unknown> | null, data: arg, query: { base: baseurl }, raw: true
		};
		bus.$emit('modal', '/eusign/index', dlgData);
		return dlgData.promise!;
	}

	// _export/url/id (or this page's url): the browser goes there, to show the server's errors.
	$export(arg: any, url?: string, dat?: object, opts?: any): void {
		if (this.$isLoading) return;
		const doExport = () => {
			let id = arg || '0';
			if (arg && std.utils.isObject(arg))
				id = std.utils.getStringId(arg);
			const root = window.$$rootUrl;
			let newurl = url ? std.url.combine('/_export', url, id) : this.$baseUrl.split('?')[0].replace('/_page/', '/_export/');
			newurl = std.url.combine(root, newurl) + std.url.makeQueryString(dat);
			(window as any).location = newurl; // to display errors
		};

		if (opts && opts.saveRequired && this.$isDirty) {
			this.$save()!.then(() => {
				doExport();
			});
		}
		else {
			doExport();
		}
	}

	// The page's sheet (.sheet-page table), measured and purged, to the server's exportTo: a file comes back.
	$exportTo(format: string, fileName?: string): void {
		const root = window.$$rootUrl;
		const htmlTools = require('std:html', true) as any;
		const locale = std.locale;
		const elem = this.$el!.getElementsByClassName('sheet-page');
		if (!elem.length) {
			console.error('element not found (.sheet-page)');
			return;
		}
		const table = elem[0];
		const tbls = table.getElementsByTagName('table');
		if (tbls.length == 0) {
			console.error('element not found (.sheet-page table)');
			return;
		}
		let tbl: Element = tbls[0];
		if (htmlTools) {
			htmlTools.getColumnsWidth(tbl);
			// attention! from css!
			const padding = tbl.classList.contains('compact') ? 4 : 12;
			htmlTools.getRowHeight(tbl, padding);
			// after colWidth, rowHeight!
			tbl = htmlTools.purgeTable(tbl);
		}
		const dateLocale = locale.$DateLocale || locale.$Locale;
		const numLocale = locale.$NumberLocale || locale.$Locale;
		const html = `<table data-num-locale="${numLocale}" data-date-locale="${dateLocale}">${tbl.innerHTML}</table>`;
		const data = { format, html, fileName, zoom: +(window.devicePixelRatio).toFixed(2) };
		std.dataservice.post(dataUrl('exportTo'), std.utils.toJson(data), true).then(function (blob: Blob) {
			if (htmlTools)
				htmlTools.downloadBlob(blob, fileName, format);
		}).catch(function (error: unknown) {
			alert(error);
		});
	}

	// <viewer>/<cmd>/<id>?base&rep: shown in a new window (no opts), exported, printed, or attached.
	$report(rep: string, arg: any, opts?: any, repBaseUrl?: string, data?: object): void {
		if (this.$isReadOnly(opts)) return;
		if (this.$isLoading) return;
		bus.$emit('closeAllPopups');
		let cmd = 'show';
		let fmt = '';
		let viewer = 'report';
		if (opts) {
			if (opts.export) {
				cmd = 'export';
				fmt = opts.format || '';
			} else if (opts.attach)
				cmd = 'attach';
			else if (opts.print)
				cmd = 'print';
			if (opts.viewer && cmd === 'show')
				viewer = opts.viewer;
		}

		const doReport = () => {
			let id = arg;
			if (arg && std.utils.isObject(arg))
				id = std.utils.getStringId(arg);
			const root = window.$$rootUrl;
			let url = `${root}/${viewer}/${cmd}/${id}`;
			const reportUrl = std.url.removeFirstSlash(repBaseUrl) || this.$indirectUrl || this.$baseUrl;
			const baseUrl = std.url.makeBaseUrl(reportUrl);
			const qry: Record<string, unknown> = Object.assign({}, { base: baseUrl, rep: rep }, data);
			if (fmt)
				qry.format = fmt;
			url = url + std.url.makeQueryString(qry);
			// open in new window
			if (!opts) {
				window.open(url, '_blank');
				return;
			}
			if (opts.export)
				(window as any).location = url;
			else if (opts.print)
				std.html.printDirect(url);
			else if (opts.attach)
				return; // do nothing
			else
				window.open(url, '_blank');
		};

		if (opts && opts.validRequired && this.$data.$invalid) {
			this.$alert(std.locale.$MakeValidFirst);
			return;
		}

		if (opts && opts.saveRequired && this.$isDirty) {
			this.$save()!.then(() => {
				doReport();
			});
		} else
			doReport();
	}

	// --- helpers --------------------------------------------------------------------------------------------------

	$clearObject(obj: any): void {
		if (!obj) return;
		if (obj.$empty)
			obj.$empty();
		else {
			for (const k of Object.keys(obj))
				obj[k] = null;
		}
	}

	// The callback's changes leave the dirtiness as it was.
	async $nodirty(callback: () => unknown): Promise<void> {
		const wasDirty = this.$data.$dirty;
		await callback();
		if (!this.$data) return;
		this.$defer(() => this.$data ? this.$data.$setDirty(wasDirty) : undefined);
	}

	// path: 'Object.Prop' of the page's data; its element's errors of that key.
	$hasError(path: string): unknown {
		const ps = std.utils.text.splitPath(path);
		const err = this.$data[ps.obj]._errors_;
		if (!err) return false;
		const arr = err[path];
		return arr && arr.length;
	}

	$errorMessage(path: string): string {
		const ps = std.utils.text.splitPath(path);
		const err = this.$data[ps.obj]._errors_;
		if (!err) return '';
		const arr = err[path];
		if (arr && arr.length)
			return arr[0].msg;
		return '';
	}

	// Every error of the model now (validated anew), of the severities asked; null when none.
	$getErrors(severity?: string | string[]): unknown[] | null {
		const errs = this.$data.$forceValidate();
		if (!errs || !errs.length)
			return null;

		if (severity && !std.utils.isArray(severity))
			severity = [severity as string];

		function isInclude(sev: string) {
			if (!severity)
				return true; // include
			if ((severity as string[]).indexOf(sev) !== -1)
				return true;
			return false;
		}

		const result = [];
		for (const x of errs) {
			for (let ix = 0; ix < x.e.length; ix++) {
				const y = x.e[ix];
				if (isInclude(y.severity))
					result.push({ path: x, msg: y.msg, severity: y.severity, index: ix });
			}
		}
		return result.length ? result : null;
	}

	// opts: a dataType, or { dataType, format, mask, hideZeros }; format 'ToString', or with {0}.
	$format(value: any, opts?: any): unknown {
		const utils = std.utils;
		if (!opts) return value;
		if (utils.isString(opts))
			opts = { dataType: opts };
		if (!opts.format && !opts.dataType && !opts.mask)
			return value;
		if (opts.format === 'ToString')
			return utils.convertToString(value, opts);
		if (opts.mask)
			return value ? std.mask.getMasked(opts.mask, value) : value;
		if (opts.dataType)
			return utils.format(value, opts.dataType, { hideZeros: opts.hideZeros, format: opts.format });
		if (opts.format && opts.format.indexOf('{0}') !== -1)
			return opts.format.replace('{0}', value);
		if (utils.isDate(value) && opts.format)
			return utils.format(value, 'DateTime', { format: opts.format });
		return value;
	}

	$getNegativeRedClass(value: unknown): string {
		if (std.utils.isNumber(value))
			return (value as number) < 0 ? 'negative-red' : '';
		return '';
	}

	// --- the data: _data/save, reload, invoke, expand, loadlazy, dbRemove -------------------------------------------

	$isDisabledAlert(opts: any, arg: any): boolean {
		if (isPermissionsDisabled(opts, arg)) {
			this.$alert(std.locale.$PermissionDenied);
			return true;
		}
		return false;
	}

	$isReadOnly(opts: any): boolean {
		return opts && opts.checkReadOnly && this.$data.$readOnly;
	}

	// An element is selected in arr, the model valid if asked, the element's permission granted if asked.
	$hasSelected(arr: any, opts?: any): boolean {
		if (opts && opts.validRequired) {
			const root = this.$data;
			if (!root.$valid) return false;
		}
		const has = arr && !!arr.$selected;
		if (!has)
			return false;
		if (isPermissionsDisabled(opts, arr.$selected))
			return false;
		return true;
	}

	$savePart(dataToSave: any, urlToSave: string, dialog?: boolean): Promise<unknown> | undefined {
		if (this.$data.$readOnly)
			return;
		bus.$emit('closeAllPopups');
		const self = this;
		const url = dataUrl('save');
		return new Promise(function (resolve) {
			const baseUrl = std.url.combine(dialog ? '/_dialog' : '/_page', urlToSave);
			const jsonData = std.utils.toJson({ baseUrl: baseUrl, data: dataToSave });
			std.dataservice.post(url, jsonData).then(function (data: any) {
				if (self.__destroyed__) return;
				if (dataToSave.$merge) {
					dataToSave.$merge(data, true, true /*only exists*/);
					resolve(dataToSave); // merged
				} else
					resolve(data); // from server
			}).catch(function (msg: any) {
				if (msg === __blank__)
					return;
				self.$alertUi(msg);
			});
		});
	}

	$requeryNew(id: unknown): void {
		this.$store.commit('setnewid', { id: id });
		this.__state__.baseUrl = std.url.replaceSegment(this.__state__.baseUrl, id);
		this.$requery();
	}

	$save(opts?: any): Promise<unknown> | undefined {
		if (this.$data.$readOnly)
			return;
		if (!this.$data.$dirty)
			return;
		bus.$emit('closeAllPopups');
		const mainObjectName = this.$data._meta_.$main;
		const self = this;
		const url = dataUrl('save');
		const urlToSave = this.$indirectUrl || this.$baseUrl;
		const isCopy = this.$data.$isCopy;
		const validRequired = !!opts && opts.options && opts.options.validRequired;
		if (validRequired && this.$data.$invalid) {
			const errs = makeErrors(this.$data.$forceValidate());
			this.$alert(std.locale.$MakeValidFirst, undefined, errs);
			return;
		}
		self.$data.$emit('Model.beforeSave', self.$data);

		if (!this.$data.$dirty)
			return; // may be changed

		const saveSels = self.$data._saveSelections();

		return new Promise(function (resolve) {
			const jsonData = std.utils.toJson({ baseUrl: urlToSave, data: self.$data });
			const wasNew = std.url.isNewPath(self.$baseUrl);
			std.dataservice.post(url, jsonData).then(function (data: any) {
				if (self.__destroyed__) return;
				self.$data.$merge(data, true, true /*only exists*/);
				self.$data.$emit('Model.saved', self.$data);
				if (self.__saveEvent__) {
					const caller = self.__liveCaller__();
					if (caller)
						caller.$data.$emit(self.__saveEvent__, self.$data);
				}
				const globalSaveEvent = self.$data._globalSaveEvent_();
				if (globalSaveEvent)
					self.$emitGlobal(globalSaveEvent, self.$data);
				self.$data.$setDirty(false);
				// data is a full model. Resolve requires only single element.
				let dataToResolve;
				let newId;
				if (mainObjectName) {
					dataToResolve = data[mainObjectName];
					newId = self.$data[mainObjectName].$id; // new element
				}
				else {
					// mainObject not defined. Use first element in the result
					for (const p in data) {
						dataToResolve = data[p];
						newId = self.$data[p].$id; // new element
						if (dataToResolve)
							break;
					}
				}
				if (wasNew && newId) {
					// assign the new id to the route
					if (!self.inDialog)
						self.$store.commit('setnewid', { id: newId });
					// and in the baseUrl
					self.__state__.baseUrl = std.url.replaceSegment(self.__state__.baseUrl, newId);
				} else if (isCopy) {
					if (!self.inDialog)
						self.$store.commit('setnewid', { id: newId, action: 'edit' });
					// and in the baseUrl
					self.__state__.baseUrl = std.url.replaceSegment(self.__state__.baseUrl, newId, 'edit');
				}
				self.$data._restoreSelections(saveSels);
				resolve(dataToResolve); // single element (raw data)
				const toast = opts && opts.toast ? opts.toast : null;
				if (toast)
					self.$toast(toast);
				self.$notifyOwner(newId, toast);
			}).catch(function (msg: any) {
				if (msg === __blank__)
					return;
				self.$alertUi(msg);
			});
		});
	}

	async $ensureSaved(): Promise<boolean> {
		// as $save: the main object, else the first one of the model
		const name = this.$data._meta_.$main || Object.keys(this.$data._meta_.props)[0];
		const elem = this.$data[name];
		if (!elem || Array.isArray(elem))
			throw new Error(`$ensureSaved: '${name}' is not an object`);
		if (!elem.$isNew)
			return true;
		if (!this.__ensureSaving__) {
			this.$data.$setDirty(true);
			this.__ensureSaving__ = Promise.resolve(this.$save()).finally(() => { this.__ensureSaving__ = null; });
		}
		await this.__ensureSaving__;
		// $save merges into the root, and the root replaces an object property — read it again
		return !this.$data[name].$isNew;
	}

	// The window that opened this one (a page in a new browser window) is told what was saved.
	$notifyOwner(id: unknown, toast?: unknown): void {
		const opener = window.opener as any;
		const token = (window as any).$$token;
		if (!opener) return;
		if (!token) return;
		const rq = opener.require;
		if (!rq) return;
		const ownerBus = rq('std:eventBus');
		if (!ownerBus) return;
		const dat = {
			token: token.token,
			update: token.update,
			toast: toast || null,
			id: id
		};
		ownerBus.$emit('childrenSaved', dat);
	}

	$invoke(cmd: string, data?: unknown, base?: string, opts?: any): Promise<unknown> {
		const self = this;
		const url = dataUrl('invoke');
		let baseUrl = self.$indirectUrl || self.$baseUrl;
		if (base)
			baseUrl = std.url.combine('_page', base, 'index', 0);
		const hideIndicator = opts && opts.hideIndicator || false;
		return new Promise(function (resolve, reject) {
			const jsonData = std.utils.toJson({ cmd: cmd, baseUrl: baseUrl, data: data });
			std.dataservice.post(url, jsonData, false, hideIndicator).then(function (data: any) {
				if (self.__destroyed__) return;
				if (std.utils.isObject(data))
					resolve(data);
				else if (std.utils.isString(data))
					resolve(data);
				else
					throw new Error('Invalid response type for $invoke');
			}).catch(function (msg: any) {
				if (msg === __blank__)
					return; // already done
				if (opts && opts.catchError) {
					reject(msg);
				} else {
					self.$alertUi(msg);
				}
			});
		});
	}

	async $invokeServer(url: string, arg: any, confirm?: any, opts?: any): Promise<void> {
		if (this.$isReadOnly(opts)) return;
		if (this.$isLoading) return;
		bus.$emit('closeAllPopups');
		const root = this.$data;
		if (confirm)
			await this.$confirm(confirm);
		if (opts && opts.saveRequired && this.$isDirty)
			await this.$save();
		if (opts && opts.validRequired && root.$invalid) {
			this.$alert(std.locale.$MakeValidFirst);
			return;
		}
		const data = { Id: arg.$id };
		const cmd = std.url.splitCommand(url);
		await this.$invoke(cmd.action, data, cmd.url);
		if (opts && opts.requeryAfter)
			await this.$requery();
		else if (opts && opts.reloadAfter)
			await this.$reload();
	}

	// The cached answer for the same data; else the server's, after the update.
	$asyncValid(cmd: string, data: unknown): unknown {
		const vm = this;
		const cache = vm.__asyncCache__;
		const djson = JSON.stringify(data);
		let val = cache[cmd];
		if (!val) {
			val = { data: '', result: null };
			cache[cmd] = val;
		}
		if (val.data === djson) {
			return val.result;
		}
		val.data = djson;
		return new Promise(function (resolve) {
			if (vm.__destroyed__) return;
			nextTick(() => {
				vm.$invoke(cmd, data).then((result: any) => {
					if (vm.__destroyed__) return;
					val.result = result.Result.Value;
					resolve(val.result);
				});
			});
		});
	}

	// No argument: the whole model, by the root's $ModelInfo; a lazy array: that array again.
	$reload(args?: any): Promise<unknown> {
		bus.$emit('closeAllPopups');
		const self = this;
		if (std.utils.isArray(args) && args.$isLazy()) {
			// reload lazy
			const propIx = args._path_.lastIndexOf('.');
			const prop = args._path_.substring(propIx + 1);
			args.$loaded = false; // reload
			return self.$loadLazy(args.$parent, prop);
		}
		const url = dataUrl('reload');
		const dat = self.$data;

		let mi = args ? std.modelInfo.get.call(this.$data, args.$ModelInfo) : null;
		if (!args && !mi) {
			// try to get first $ModelInfo
			const modInfo = this.$data._findRootModelInfo();
			if (modInfo) {
				mi = std.modelInfo.get.call(this.$data, modInfo);
			}
		}

		const saveSels = dat._saveSelections();

		return new Promise(function (resolve) {
			const dataToQuery = { baseUrl: std.url.replaceUrlQuery(self.$baseUrl, mi) };
			if (std.utils.isDefined(dat.Query)) {
				// special element -> use url
				dataToQuery.baseUrl = std.url.replaceUrlQuery(self.$baseUrl, dat.Query);
				const newUrl = std.url.replaceUrlQuery(null/*current*/, dat.Query);
				std.store.replaceBrowseUrl(newUrl);
			}
			const jsonData = std.utils.toJson(dataToQuery);
			std.dataservice.post(url, jsonData).then(function (data: any) {
				if (self.__destroyed__) return;
				bus.$emit('pageReloaded', dataToQuery.baseUrl);
				if (std.utils.isObject(data)) {
					dat.$merge(data, true/*checkBindOnce*/);
					std.modelInfo.reconcileAll(data.$ModelInfo);
					dat._setModelInfo_(undefined, data);
					dat._setRuntimeInfo_(data.$runtime);
					dat._setDefaults_();
					dat._fireLoad_();
					dat._restoreSelections(saveSels);
					resolve(dat);
				} else {
					throw new Error('Invalid response type for $reload');
				}
			}).catch(function (msg: any) {
				if (msg === __blank__)
					return; // already done
				self.$alertUi(msg);
			});
		});
	}

	// To the collection view of obj (an array with $ModelInfo): it sets the filter and reloads through queryChange.
	$setFilter(obj: unknown, prop: string, val: unknown): void {
		bus.$emit('setFilter', { source: obj, prop: prop, value: val });
	}

	$clearFilter(obj: unknown): void {
		bus.$emit('clearFilter', { source: obj });
	}

	// The search of the url dropped, the page reloads.
	$searchChange(): void {
		const newUrl = this.$store.replaceUrlSearch(this.$baseUrl);
		this.__state__.baseUrl = newUrl;
		this.$reload();
	}

	// The loading indicator while the action runs.
	async $longOperation(action: () => unknown): Promise<void> {
		try {
			bus.$emit('beginRequest', '');
			await action();
		} finally {
			bus.$emit('endRequest', '');
		}
	}

	// The page's host loads the page again: the dialog's modal, the shell's tab.
	$requery(query?: unknown): void {
		if (this.inDialog)
			bus.$emit('modalRequery', this.$baseUrl);
		else
			bus.$emit('requery', this, query);
	}

	$remove(item: any, confirm?: any): void {
		if (this.$data.$readOnly) return;
		if (this.$isLoading) return;
		bus.$emit('closeAllPopups');
		if (!confirm)
			item.$remove();
		else
			this.$confirm(confirm).then(() => item.$remove());
	}

	$removeSelected(arr: any, confirm?: any): void {
		if (!std.utils.isArray(arr)) {
			console.error('$removeSelected. The argument is not an array');
		}
		if (this.$data.$readOnly)
			return;
		const item = arr.$selected;
		if (!item)
			return;
		this.$remove(item, confirm);
	}

	$dbRemove(elem: any, confirm?: any, opts?: any): void {
		if (!elem)
			return;

		if (this.$isDisabledAlert(opts, elem))
			return;

		if (this.$isLoading) return;
		bus.$emit('closeAllPopups');

		const id = elem.$id;
		const lazy = elem.$parent.$isLazy ? elem.$parent.$isLazy() : false;
		const self = this;

		function lastProperty(path: string): string | undefined {
			const pos = path.lastIndexOf('.');
			if (pos === -1)
				return undefined;
			return path.substring(pos + 1);
		}

		function dbRemove() {
			const postUrl = window.$$rootUrl + '/_data/dbRemove';
			const jsonObj: Record<string, unknown> = { baseUrl: self.$baseUrl, id: id };
			if (lazy) {
				jsonObj.prop = lastProperty(elem.$parent._path_);
			}
			const jsonData = std.utils.toJson(jsonObj);
			std.dataservice.post(postUrl, jsonData).then(function () {
				if (self.__destroyed__) return;
				elem.$remove(); // without confirm
			}).catch(function (msg: any) {
				if (msg === __blank__)
					return;
				self.$alertUi(msg);
			});
		}
		if (confirm) {
			this.$confirm(confirm).then(function () {
				dbRemove();
			});
		} else {
			dbRemove();
		}
	}

	$dbRemoveSelected(arr: any, confirm?: any, opts?: any): void {
		if (this.$isLoading) return;
		bus.$emit('closeAllPopups');
		const sel = arr.$selected;
		if (!sel) return;
		this.$dbRemove(sel, confirm, opts);
	}

	// A tree element's children: loaded once, when the element says it has them ($hasChildren).
	$expand(elem: any, propName: string, expval?: boolean): Promise<unknown> {
		const self = this;
		const url = window.$$rootUrl + '/_data/expand';

		return new Promise(function (resolve, reject) {
			const arr = elem[propName];
			if (std.utils.isDefined(expval)) {
				if (elem.$expanded == expval) {
					resolve(arr);
					return;
				} else {
					platform.set(elem, '$expanded', expval);
				}
			}
			if (arr.$loaded) {
				resolve(arr);
				return;
			}
			if (!std.utils.isDefined(elem.$hasChildren)) {
				resolve(arr);
				return; // no $hasChildren property - static expand
			}
			if (!elem.$hasChildren) {
				// try to expand empty array
				arr.$loaded = true;
				resolve(arr);
				return;
			}
			const jsonData = std.utils.toJson({ baseUrl: self.$baseUrl, id: elem.$id });
			std.dataservice.post(url, jsonData).then(function (data: any) {
				if (self.__destroyed__) return;
				arr.$copy(data[propName]); // the load door: a read-only model loads too (B7)
				resolve(arr);
			}).catch(function (msg: any) {
				if (msg === __blank__)
					return;
				self.$alertUi(msg);
				reject(arr);
			});

			arr.$loaded = true;
		});
	}

	// A lazy array ($lazy of its parent's type): loaded once, by its own $ModelInfo (or Model.lazy.init's).
	$loadLazy(elem: any, propName: string): Promise<unknown> {
		const self = this;
		const url = dataUrl('loadlazy');
		let selfMi = elem[propName].$ModelInfo;

		if (!selfMi) {
			const evData = { elem: elem, prop: propName, modelInfo: null };
			this.$data.$emit('Model.lazy.init', evData);
			selfMi = evData.modelInfo; // may be changed
		}

		const mi = std.modelInfo.get.call(self.$data, selfMi);
		const xQuery = std.url.parseUrlAndQuery(self.$baseUrl, mi);
		const newUrl = xQuery.url + std.url.makeQueryString(mi);
		const jsonData = std.utils.toJson({ baseUrl: newUrl, id: elem.$id, prop: propName });

		return new Promise(function (resolve) {
			const arr = elem[propName];
			if (arr.$loaded) {
				resolve(arr);
				return;
			}
			std.dataservice.post(url, jsonData).then(function (data: any) {
				if (self.__destroyed__) return;
				if (propName in data) {
					arr.$copy(data[propName]); // the load door (B7)
					const rcName = propName + '.$RowCount';
					if (rcName in data) {
						arr.$RowCount = data[rcName];
					}
					if (data.$ModelInfo)
						std.modelInfo.reconcile(data.$ModelInfo[propName]);
					arr._root_._setModelInfo_(arr, data);
					const eventName = treeNormalPath(arr._path_) + '.load';
					self.$data.$emit(eventName, arr);
				}
				resolve(arr);
			}).catch(function (msg: any) {
				if (msg === __blank__)
					return;
				self.$alertUi(msg);
			});
			arr.$loaded = true;
		});
	}

	// --- the page's life --------------------------------------------------------------------------------------------

	__beginRequest(): void {
		this.__state__.requestsCount += 1;
	}

	__endRequest(): void {
		this.__state__.requestsCount -= 1;
	}

	__cwChange(source: unknown): void {
		this.$reload(source);
	}

	__queryChange(search: any, source: any): void {
		// preserve $baseQuery (without data from search)
		if (!std.utils.isObjectExact(search)) {
			console.error('base.__queryChange. invalid argument type');
		}
		const searchBase = search.__baseUrl__;
		if (searchBase) {
			const searchurl = std.url.parseUrlAndQuery(searchBase);
			const thisurl = std.url.parseUrlAndQuery(this.__state__.baseUrl);
			if (searchurl.url !== thisurl.url)
				return;
		}
		const nq: Record<string, unknown> = Object.assign({}, this.$baseQuery);
		for (const p in search) {
			if (p.startsWith('__'))
				continue;
			if (search[p]) {
				// replace from search
				nq[p] = search[p];
			}
			else {
				// undefined element, delete from query
				delete nq[p];
			}
		}
		const mi = source ? source.$ModelInfo : this.$data._findRootModelInfo();
		std.modelInfo.copyfromQuery(mi, nq);
		this.$reload(source);
	}

	__doInit__(baseUrl?: string): void {
		const root = this.$data;
		if (!root._modelLoad_) return;
		let caller = null;
		if (baseUrl)
			this.__state__.baseUrl = baseUrl;
		if (this.$caller)
			caller = this.$caller.$data;
		this.__createController__();
		root._modelLoad_(caller);
	}

	// $ctrl: the face the template code gets ($ctrl.$save…): base.js's list, its members bound to this page.
	__createController__(): object {
		const self = this as any;
		const ctrl: Record<string, unknown> = {};
		for (const name of CTRL_MEMBERS)
			if (typeof self[name] === 'function')
				ctrl[name] = self[name];
		Object.defineProperty(ctrl, '$isDirty', {
			enumerable: true,
			configurable: true, /* needed */
			get: () => this.$isDirty
		});
		Object.defineProperty(ctrl, '$isPristine', {
			enumerable: true,
			configurable: true, /* needed */
			get: () => this.$isPristine
		});
		Object.seal(ctrl);
		return ctrl;
	}

	__notified(token: any): void {
		if (!token) return;
		if (this.__currentToken__ !== token.token) return;
		if (token.toast)
			this.$toast(token.toast);
		this.$reload(token.update || null).then(function (array: any) {
			if (!token.id) return;
			if (!std.utils.isArray(array)) return;
			const el = array.find((itm: any) => itm.$id === token.id);
			if (el && el.$select) el.$select();
		});
	}

	__parseControllerAttributes(attr: string): object | null {
		if (!attr) return null;
		const json = JSON.parse(attr.replace(/\'/g, '"'));
		const result: Record<string, unknown> = {};
		if (json.canClose) {
			const ccd = this.$delegate(json.canClose) as Function | null;
			if (ccd)
				result.canClose = ccd.bind(this.$data);
		}
		if (json.alwaysOk)
			result.alwaysOk = true;
		if (json.saveEvent) {
			this.__saveEvent__ = json.saveEvent;
		}
		if (json.placement)
			result.placement = json.placement;
		return result;
	}

	__isModalRequery(): boolean {
		const arg = { url: this.__state__.baseUrl, result: false };
		bus.$emit('isModalRequery', arg);
		return arg.result;
	}

	__invoke__test__(args: any): void {
		args = args || {};
		if (args.target !== 'controller')
			return;
		if (this.inDialog) {
			// testId for dialogs only
			if (args.testId !== this.__testId__)
				return;
		}
		const root = this.$data;
		switch (args.action) {
			case 'eval':
				args.result = std.utils.eval(root, args.path);
				break;
		}
	}

	__global_period_changed__(period: unknown): void {
		this.$data._fireGlobalPeriodChanged_(period);
	}

	__signalAppEvent__(data: unknown): void {
		if (this.$data && this.$data._fireSignalAppEvent_)
			this.$data._fireSignalAppEvent_(data);
	}

	__globalAppEvent__(data: unknown): void {
		if (this.$data && this.$data._fireGlobalAppEvent_)
			this.$data._fireGlobalAppEvent_(data);
	}

	// base.js's created: called by the page's component in its created, inside its effect scope, so the bus
	// subscriptions go with the page (Net48 took them off in destroyed, but for signalEvent: B23).
	created(): void {
		const out = { caller: null as Controller | null };
		if (!this.isSkipDataStack)
			bus.$emit('registerData', this, out);
		this.$caller = out.caller;
		this.__destroyed__ = false;

		this.$store = (app.components['std:store'] as any).create(this);

		bus.$on('beginRequest', this.__beginRequest);
		bus.$on('endRequest', this.__endRequest);
		bus.$on('queryChange', this.__queryChange);
		bus.$on('childrenSaved', this.__notified);
		bus.$on('invokeTest', this.__invoke__test__);
		bus.$on('globalPeriodChanged', this.__global_period_changed__);
		bus.$on('globalAppEvent', this.__globalAppEvent__);
		bus.$on('signalEvent', this.__signalAppEvent__);

		this.__asyncCache__ = {};
		this.__currentToken__ = app.nextToken();
	}

	// base.js's mounted: the element and its test-id.
	mounted(el: Element | null): void {
		this.$el = el;
		const testId = el && el.getAttribute ? el.getAttribute('test-id') : null;
		if (testId)
			this.__testId__ = testId;
	}

	beforeDestroy(): void {
		if (this.$data._fireUnload_)
			this.$data._fireUnload_();
	}

	destroyed(): void {
		this.$caller = null;
		if (!this.isSkipDataStack)
			bus.$emit('registerData', null);
		const htmlTools = require('std:html', true) as any; // std:html: step B4
		if (htmlTools)
			htmlTools.removePrintFrame();
		if (this.$data.$destroy)
			this.$data.$destroy();
		this.__destroyed__ = true;
	}

	// What the loader sets once the script has run (Net48 http.js load: __baseUrl__, __baseQuery__).
	__loaded__(url: string): void {
		this.__state__.baseUrl = std.url.normalizeRoot(url);
		this.__state__.baseQuery = std.url.parseUrlAndQuery(url).query;
	}
}

// base.js's __createController__ list: the members of $ctrl ($isDirty and $isPristine are getters on it).
const CTRL_MEMBERS = [
	'$save', '$ensureSaved', '$savePart', '$invoke', '$close', '$modalClose', '$msg', '$alert', '$confirm',
	'$showDialog', '$inlineOpen', '$inlineClose', '$inlineDepth', '$saveModified', '$asyncValid', '$toast',
	'$requery', '$reload', '$notifyOwner', '$navigate', '$defer', '$setFilter', '$clearFilter', '$expand', '$focus',
	'$report', '$upload', '$uploadBlob', '$uploadBlobFile', '$file', '$emitCaller', '$emitSaveEvent', '$emitGlobal',
	'$emitParentTab', '$nodirty', '$showSidePane', '$hideSidePane', '$longOperation', '$requeryNew', '$saveCaller',
	'$dirtyCaller', '$shareUrl'
];

// What the page's component forwards to its template: every $-method and $-getter of the controller, by name.
export const PAGE_METHODS: string[] = [];
export const PAGE_GETTERS: string[] = [];
for (const name of Object.getOwnPropertyNames(Controller.prototype)) {
	if (!name.startsWith('$')) continue;
	const d = Object.getOwnPropertyDescriptor(Controller.prototype, name)!;
	if (d.get) PAGE_GETTERS.push(name);
	else if (typeof d.value === 'function') PAGE_METHODS.push(name);
}
PAGE_METHODS.push('$defer', '$print'); // fields: the platform's own functions, as base.js put them
