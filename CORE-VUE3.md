# What A2v10.Core gives the Vue 3 client: step A

What A2v10.Core (`C:\A2v10_Net6\A2v10.Core`) must serve for the tabbed shell on Vue 3 to come up (`"Application": { "Framework": "vue3" }`). Done in Core, not here; this repository builds the client files. Paths below are under A2v10.Core unless they name this repository.

Decided (2026-10-24): one app per document, the shell's; two files, the core and the shell; a page script returns a descriptor, not a component. Added (2026-10-25): a third file, the XAML components.

## 1. The files

Built here (`pnpm build`), each with its `.map`:

| file | holds | from |
|---|---|---|
| `a2v10-core.js`, `a2v10-core.min.js` | Vue 3 (runtime + compiler), the model, the platform (`app`, `require`, `std:*`, include, `window.Vue`), the primitives | `packages/core/dist/` |
| `a2v10-shell-tabbed.js`, `a2v10-shell-tabbed.min.js` | the tabbed shell: `std:shellPlain`, header, navbar, modal, toastr, debug; `a2v10.shell.start` | `packages/shell-tabbed/dist/` |
| `a2v10-xaml.js`, `a2v10-xaml.min.js` | what the XAML renders: `data-grid`, `collection-view-*`, `textbox`, `a2-pager`, `v-focus`, `v-settabindex`… (growing) | `packages/xaml/dist/` |

- `.js` carries Vue's development builds (warnings, template errors as text), `.min.js` the production builds. The layout's `minify` picks one (`MainController`: `Environment.IsRelease` → `min.`).
- `pnpm build` copies them, maps included, to `Web/A2v10.Core.Web.Site/wwwroot/scripts/vue3/` (`scripts/copy-assets.mjs`; the path is relative: A2v10.Core beside this repository).
- On to the NuGet package: `CreateWebAssets.cmd` copies `wwwroot/scripts/vue3/*` of the site to `Platform/A2v10.Web.Assets/wwwroot/scripts/vue3/`, as it copies `tabbed.js`.

## 2. The layout: `Views/Shared/_Layout.tabbed.vue3.cshtml`

The stub (`/scripts/a2v10.vue3.@Html.Raw(minify)js`) becomes the files, the core first, at its place:

```html
<script type="text/javascript" src="/scripts/vue3/a2v10-core.@Html.Raw(minify)js?v=@appVersion.AppBuild"></script>
<script type="text/javascript" src="/scripts/vue3/a2v10-shell-tabbed.@Html.Raw(minify)js?v=@appVersion.AppBuild"></script>
<script type="text/javascript" src="/scripts/vue3/a2v10-xaml.@Html.Raw(minify)js?v=@appVersion.AppBuild"></script>
```

- Before them, as now: `signalr.min.js`, `locale-<lang>.min.js` (the core reads `window.$$locale`), `SwitchLocale()`.
- After them, as now: `LayoutScripts()`, `AppScriptsLink()` (the application's scripts may call `Vue.component`/`Vue.directive`; `new Vue`, `Vue.extend`, `Vue.filter` throw by name), `ModelScripts`, `/_shell/script` last (it starts the app).
- One `?v=` on all files: the browser fetches them anew together, so the client checks no version between them.
- The shell and the XAML components register into the core's vocabulary; their order after the core does not matter.
- `Views/Main/Default.tabbed.vue3.cshtml` stays as it is: the shell takes `#shell` whole as its template (its `v-cloak`, classes and bindings included).

## 3. The shell script: `/_shell/script`

`ShellController.BuildScriptPlain` takes a resource by `AppOptions.Framework`: `shellPlain` (Vue 2, as now) or `shellPlainVue3` (new), with the same macros (`$(Menu)`, `$(AppVersion)`, `$(Debug)`, `$(AppData)`, `$(Theme)`). `shellPlainVue3`:

```js
(function () {

	const menu = $(Menu);

	const sp = menu.SysParams || {};

	window.$$rootUrl = '';
	window.$$debug = $(Debug);
	window.$$theme = '$(Theme)';

	a2v10.shell.start('#shell', {
		version: '$(AppVersion)',
		menu: menu.Menu ? menu.Menu[0].Menu : null,
		columns: menu.Columns || 1,
		title: sp.AppTitle || '',
		subtitle: sp.AppSubTitle || '',
		userState: menu.UserState,
		isDebug: $(Debug),
		appData: $(AppData),
	});
})();
```

Against `shellPlain`: `a2v10.shell.start` in place of `new (component('std:shellPlain'))({ el, data })`; the three globals set before the start, not after.

## 4. The page script: `Vue3DataScripter`

A page's answer stays the root element's HTML (from XAML) followed by one `<script type="text/javascript">`. The client (include) parses it, takes the root element whole as the template, and runs the script's text as the body of a function (`new Function('require', 'component', text)`); the body returns the page's descriptor. The script mounts nothing and registers no page.

`Vue3DataScripter` writes these in place of `SCRIPT_PARTS.HEADER` and `SCRIPT_PARTS.FOOTER`; `DATAFUNC` (`$(CurrentModule)`: required modules, template, data, `modelData`) and the macro replacement stay as `VueDataScripter` has them.

HEADER:

```js
<script type="text/javascript">
'use strict';
const eventBus = require('std:eventBus');
const utils = require('std:utils');
const uPeriod = require('std:period');
const currentModule = $(CurrentModule);
```

FOOTER:

```js
return {
	baseUrl: '$(BaseUrl)',
	inDialog: $(IsDialog),
	isIndex: $(IsIndex),
	isSkipDataStack: $(IsSkipDataStack),
	createModel: () => currentModule().dataModel
};
//# sourceURL=a2v10://$(BaseUrl)
</script>
```

- No IIFE around the body: the client's function is the scope. `'use strict'` stays the body's first statement.
- `createModel` is called once per mount and returns a new root: `currentModule()` builds one per call.
- `uPeriod` stays: `modelData` names it for a period property (`GetProperties`: `uPeriod.constructor`); `eventBus` and `utils` stay for what the module text may name.
- Gone from the script: `component('baseController')`, `new DataModelController({ el: '#$(RootId)', … })`, `_host_`, `__doInit__`, `beginLoad`/`endLoad` (include emits them). `$(RootId)` stays only as the root element's `id`.
- Checked here: the stand's server writes pages in exactly this shape (`test/stand/server.js`, `pageScript`); they load, mount and render through include.

## 5. Open: `Views/Page/About.vue3.cshtml`, `ChangePassword.vue3.cshtml`

The server already looks for them (`Framework.ViewName("About")`); they do not exist. Their Vue 2 scripts give the page component options of its own: About its own data (`appData`) and `computed` (`hasLogo`, `logoSrc`, `locale`); ChangePassword `computed` (`isInvalid`) and `methods` (`doChangePassword`, `modalClose`). The descriptor of §4 has no place for them.

Proposed: an optional `options` in the descriptor (`{ computed, methods }`), merged into the page's component; only these platform views write it. To decide.

## 6. Later, step B

- Slots: the XAML engine writes Vue 2's `<template slot="name" slot-scope="scope">` (48 places in 16 files: `Selector.cs`, `DataGrid.cs`, `Control.cs`, `Calendar.cs`, `TabPanel.cs`, `CollectionView.cs`…); Vue 3 has only `v-slot`: `<template v-slot:name="scope">`, a default slot `<template v-slot="scope">`. Vue 2.6+ reads `v-slot` too: one markup for both frameworks. In hand (2026-10-25).
- A bare `<template>` (no `v-if`/`v-else`/`v-for`/`v-slot`; `Container.RenderChildren` writes one around a container's children, `v-show` from `Show`/`Hide` included): Vue 2 rendered its children, Vue 3 a native, hidden `<template>`. The client's compiler keeps Vue 2's way (`compatConfig.COMPILER_NATIVE_TEMPLATE`); not writing a wrapper that does nothing is a cleanup, not a need.

- `ViewEngines/A2v10.ViewEngine.Xaml/Controls/ComboBox.cs:98` writes `<select is="combobox">`; on Vue 3 a component on a native element is `is="vue:combobox"`: a difference of render by `Framework`.

## 7. What step A is to show in a real application

As the stand shows it (`test/stand`, `/`); not yet seen on A2v10.Core.

- The shell comes up: header, menu, home tab, footer; tabs open, switch, close, persist in `localStorage`; dialogs, confirm, toasts, dropdowns work.
- A page in a tab loads and renders its template over its model, then the tab closes with an alert: the shell's `tabLoadComplete` calls `page.root.$store.commit(…)`, and the page has no controller (`$store`, `$close`, `$isDirty`…) until step B. The home page gives the alert only. This is the expected refusal of step A, not a defect.
