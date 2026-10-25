# A2v10.Core and the Vue 3 client

The contract between A2v10.Core (`C:\A2v10_Net6\A2v10.Core`) and this repository's client, for `"Application": { "Framework": "vue3" }`: what Core serves, what the client takes. This repository builds the client files; Core's part is done in Core. Paths name A2v10.Core unless they name this repository.

Decided: one app per document, the shell's (2026-10-24); a page script returns a descriptor, not a component (2026-10-24); three files: the core, the shell, the XAML components (2026-10-25).

Seen working in A2v10.Core (MetaAppStand, 2026-10-25): the shell; `_home`; `catalog/company` (index, the edit dialog); `document/waybillin` (the journal with its filters, the form with its rows, posting); the browse dialog of a selector.

## 1. The files

Built here (`pnpm build`), each with its `.map`:

| file | holds | from |
|---|---|---|
| `a2v10-core.js`, `.min.js` | Vue 3 (runtime + this repository's compiler), the model, the platform: `app`, `require`, the `std:*` modules (`std:eventBus`, `utils`, `period`, `datamodel`, `url`, `http`, `dataservice`, `routing`, `popup`, `mask`, `accel`, `html`, `tools`, `signalR`…) and `app.components['std:store']`, include, the page's controller (base.js), `window.Vue`, the polyfills; the primitives (`v-dropdown`, `v-contextmenu`) | `packages/core/dist/` |
| `a2v10-shell-tabbed.js`, `.min.js` | the tabbed shell: `std:shellPlain`, header, navbar, modal (and its directives), toastr, debug, `a2-document-title`; `a2v10.shell.start` | `packages/shell-tabbed/dist/` |
| `a2v10-xaml.js`, `.min.js` | what the XAML renders: `collection-view-server(-url)`, `data-grid`, `data-grid-column`, `a2-pager`, `textbox`, `a2-textarea`, `static`, `validator`, `a2-static-validator`, `a2-selector`, `combobox`, `a2-date-picker`, `a2-period-picker`, `a2-calendar`, `a2-panel`, `a2-taskpad`, `a2-sheet`, `a2-sheet-section`, `a2-sheet-section-tree`, `a2-blob-image`, `a2-blob-preview`, `a2-list`, `a2-color-picker`; `v-focus`, `v-settabindex`, `v-disable`, `v-lazy`, `v-auto-size`; `app.components['control']` (the base the controls and applications extend). Grows by the pages met. | `packages/xaml/dist/` |

- `.js` carries Vue's development builds (warnings, template errors as text), `.min.js` the production builds. The layout's `minify` picks one (`MainController`: `Environment.IsRelease` → `min.`).
- `pnpm build` copies them, maps included, to `Web/A2v10.Core.Web.Site/wwwroot/scripts/vue3/` (`scripts/copy-assets.mjs`; the path is relative: A2v10.Core beside this repository).
- Open: the files are not in `Platform/A2v10.Web.Assets/wwwroot/scripts/vue3/` (the NuGet package's assets); an application on the package has no Vue 3 client yet.

## 2. The layout: done in Core

`Platform/A2v10.Platform.Web/Views/Shared/_Layout.tabbed.vue3.cshtml` loads, the core first:

```html
<script type="text/javascript" src="/scripts/vue3/a2v10-core.@Html.Raw(minify)js?v=@appVersion.AppBuild"></script>
<script type="text/javascript" src="/scripts/vue3/a2v10-shell-tabbed.@Html.Raw(minify)js?v=@appVersion.AppBuild"></script>
<script type="text/javascript" src="/scripts/vue3/a2v10-xaml.@Html.Raw(minify)js?v=@appVersion.AppBuild"></script>
```

- Before them: `signalr.min.js`, `locale-<lang>.min.js` (the core reads `window.$$locale`), `SwitchLocale()`.
- After them: `LayoutScripts()`, `AppScriptsLink()` (the application's scripts may call `Vue.component`/`Vue.directive`; `new Vue`, `Vue.extend`, `Vue.filter` throw by name), `ModelScripts`, `/_shell/script` last (it starts the app).
- One `?v=` on all files: the browser fetches them anew together; the client checks no version between them.
- The shell and the XAML components register into the core's vocabulary; their order after the core does not matter.
- `Views/Main/Default.tabbed.vue3.cshtml`: the shell takes `#shell` whole as its template (its `v-cloak`, classes and bindings included).
- A view that carries Vue is chosen by `Framework`: Vue 3's has the suffix `.vue3`; a missing one fails, never falls back to Vue 2 (`HostHelpers.ViewName`).

## 3. The shell script `/_shell/script`: done in Core

`ShellController` takes `ShellScriptsVue3.Plain` for Vue 3 (`Platform/A2v10.Platform.Web/Resources/ShellScriptsVue3.cs`), with Vue 2's macros (`$(Menu)`, `$(AppVersion)`, `$(Debug)`, `$(AppData)`, `$(Theme)`): it sets `$$rootUrl`, `$$debug`, `$$theme`, then calls `a2v10.shell.start('#shell', { version, menu, columns, title, subtitle, userState, isDebug, appData })`.

## 4. The page script: done in Core

A page's answer is the root element's HTML (from XAML) followed by one `<script type="text/javascript">`. The client's include parses it, takes the root element whole as the template, and runs the script's text as the body of `new Function('require', 'component', text)`; the body returns the page's descriptor. The script mounts nothing and registers no page.

`Vue3DataScripter` (`Platform/A2v10.Platform.Web/Builders/Vue3DataScripter.cs`) frames Vue 2's model function (`DataScript`) so:

```js
<script type="text/javascript">
'use strict';
const eventBus = require('std:eventBus');
const utils = require('std:utils');
const uPeriod = require('std:period');
const currentModule = $(CurrentModule);

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

- No IIFE: the client's function is the scope.
- `createModel` is called once per mount and returns a new root.
- The stand writes pages in the same shape (`test/stand/server.js`, `pageScript`) and serves pages as Core sent them (`test/stand/pages/`).

## 5. The XAML on Vue 3

By `Framework`, in Core's renderer (`ViewEngines/A2v10.ViewEngine.Xaml/Base/RenderContext.cs`; a control asks it, never `Framework` itself):

- `MergeSlot`: Vue 2 `slot="name" slot-scope="scope"`; Vue 3 `v-slot:name="scope"` (`v-slot` for the default slot) on a `<template>`, a tag of another kind wrapped in one.
- `MergeIs`: a component on a native element (`<select is="combobox">`) is `is="vue:combobox"` on Vue 3.
- To do: a bound `disabled` is written `:disabled="(…) || null"`, in the one place where `:disabled` reaches a tag (`BindCmd`: `MergeDisabled` and the `MergeAttribute(":disabled", …)` of `MergeCommandAttributes`, on a `<button>` or an `<a>`). Vue 2 removed an attribute bound to `false`; Vue 3 writes `disabled="false"` on an element with no `disabled` property (`<a>`, `<div>`), and the CSS `[disabled]` shows it off (seen: report/trialbalance, «Сформувати зараз»). `null` removes it on both; on a `<button>` it sets the property false, as `false` did. One markup for both frameworks.

In the client:

- A bare `<template>` (no `v-if`/`v-else`/`v-for`/`v-slot`): Vue 2 rendered its children, Vue 3 a native, hidden `<template>`. `Container.RenderChildren` writes one around a container's children (with `v-show` when `Show`/`Hide` is set: Vue 2 dropped it, the container's own element carries it). The client's compiler keeps Vue 2's way (`compatConfig.COMPILER_NATIVE_TEMPLATE`, `packages/platform/src/compiler.ts`); not writing a wrapper that does nothing is a cleanup in Core, not a need.
- Whitespace between elements is kept, as Vue 2 kept it (`whitespace: 'preserve'`).

## 6. Open

- `Views/Page/About.vue3.cshtml`, `ChangePassword.vue3.cshtml` do not exist; on Vue 3 About and ChangePassword fail (§2: no fallback). Their Vue 2 scripts give the page component options of its own (About: `appData`, `computed`; ChangePassword: `computed`, `methods`), which the descriptor of §4 has no place for.
- The NuGet package's assets (§1).
- `:disabled` bound to `false` (§5). Not covered by it: an application's HTML view binding `:disabled` on an `<a>` (shown off, still working).
