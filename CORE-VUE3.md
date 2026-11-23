# A2v10.Core and the Vue 3 client

The contract between A2v10.Core (`C:\A2v10_Net6\A2v10.Core`) and this repository's client, for `"Application": { "Framework": "vue3" }`: what Core serves, what the client takes. This repository builds the client files; Core's part is done in Core. Paths name A2v10.Core unless they name this repository.

Decided: one app per document, the shell's (2026-10-24); a page script returns a descriptor, not a component (2026-10-24); three files: the core, the shell, the XAML components (2026-10-25).

Seen working in A2v10.Core (MetaAppStand, 2026-10-25): the shell, its debug pane's data model; `_home`; `catalog/company` (index, the edit dialog); `catalog/agent` (index with tags); `document/waybillin` (the journal with its filters, the form with its rows, posting, the print form); `document/order` (the journal, its state filter); `report/trialbalance`; `accplan/national` (tree); `task/edit` (comments, text editor); the dialogs: browse of a selector, the agent's blob, attachments, item category.

## 1. The files

Built here (`pnpm build`), each with its `.map`:

| file | holds | from |
|---|---|---|
| `a2v10-core.js`, `.min.js` | Vue 3 (runtime + this repository's compiler), the model, the platform: `app`, `require`, the `std:*` modules (`std:eventBus`, `utils`, `period`, `datamodel`, `url`, `http`, `dataservice`, `routing`, `popup`, `mask`, `accel`, `html`, `tools`, `signalR`…) and `app.components['std:store']`, include, the page's controller (base.js), `window.Vue`, the polyfills; the primitives (`v-dropdown`, `v-contextmenu`; the datasheet's core as `a2v10.primitives`) | `packages/core/dist/` |
| `a2v10-shell-tabbed.js`, `.min.js` | the tabbed shell: `std:shellPlain`, header, navbar, modal (and its directives), toastr, debug with `a2-json-browser`, `a2-document-title`; `a2v10.shell.start` | `packages/shell-tabbed/dist/` |
| `a2v10-xaml.js`, `.min.js` | what the XAML renders: `collection-view-server(-url)`, `data-grid`, `data-grid-column`, `a2-pager`, `textbox`, `a2-textarea`, `static`, `validator`, `a2-static-validator`, `a2-selector`, `combobox`, `a2-date-picker`, `a2-period-picker`, `a2-calendar`, `a2-panel`, `a2-taskpad`, `a2-sheet`, `a2-sheet-section`, `a2-sheet-section-tree`, `a2-blob-image`, `a2-blob-preview`, `a2-list`, `a2-color-picker`, `a2-color-combobox`, `a2-pdfreport-viewer`, `tree-grid`, `tree-view`, `a2-text-editor`, `a2-text-view`, `a2-tags`, `a2-tags-filter`, `a2-tags-list`, `popover`, `a2-span-sum`, `a2-inline-dialog`, `a2-kanban`, `a2-time-picker`, `a2-dashboard`, `a2-dashboard-item`, `a2-file-preview`, `a2-big-calendar`, `a2-multiselect`, `a2-image`, `a2-static-image`, `a2-file-image`, `a2-upload`, `a2-simple-upload`, `a2-tab-panel`, `a2-tab-item`, `mega-menu`, `data-sheet`, `data-sheet-column`, `a2-sheet-scrollbar` (§6); `v-focus`, `v-settabindex`, `v-disable`, `v-lazy`, `v-auto-size`; `app.components['control']` (the base the controls and applications extend). Grows by the pages met. | `packages/xaml/dist/` |

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
- Done (seen 2026-10-25): `MergeDisabledRemovable`, by `Framework`: Vue 3 writes a command's bound `disabled` as `:disabled="(…) || null"`, once on its final value (`BindCmd.MergeCommandAttributes`, on a `<button>` or an `<a>`); Vue 2's markup is as it was. Vue 2 removed an attribute bound to `false`; Vue 3 writes `disabled="false"` on an element with no `disabled` property (`<a>`, `<div>`), and the CSS `[disabled]` shows it off (seen: report/trialbalance, «Сформувати зараз»). `null` removes it; on a `<button>` it sets the property false, as `false` did.
- Done (seen 2026-10-25): `MergeForTemplateKey` / `MergeForItemKey`, by `Framework`: the key of a `<template v-for>` is on the `<template>` for Vue 3, on each item for Vue 2 (Vue 2 refused it on the `<template>`; Vue 3 refuses it on the items: a compile error "<template v-for> key should be placed on the <template> tag"; seen: task/edit, the comments' `Repeater`). A call site calls both, each writes for one framework (`Container`, `Flex`, `Repeater`, `Table`). A key on the element that carries the `v-for` itself (`ImageList`, `PropertyGrid`, `TableCell`, `TableColumn`) is right on both, unchanged.

In the client:

- A bare `<template>` (no `v-if`/`v-else`/`v-for`/`v-slot`): Vue 2 rendered its children, Vue 3 a native, hidden `<template>`. `Container.RenderChildren` writes one around a container's children (with `v-show` when `Show`/`Hide` is set: Vue 2 dropped it, the container's own element carries it). The client's compiler keeps Vue 2's way (`compatConfig.COMPILER_NATIVE_TEMPLATE`, `packages/platform/src/compiler.ts`); not writing a wrapper that does nothing is a cleanup in Core, not a need.
- Whitespace between elements is kept, as Vue 2 kept it (`whitespace: 'preserve'`).

## 6. DataSheet: to do in Core

New elements, not a port (PLAN.md, «The 1C dialect»): `DataSheet` and `DataSheetColumn` in `A2v10.Xaml`, rendered as this repository's `data-sheet` and `data-sheet-column` (`packages/xaml/src/datasheet.ts`, `cellkinds.ts`). Not `DataGrid`'s markup rendered anew: their own classes, their own properties. Seen so far on the stand only (`/stand/datasheet/index/0`, `list/0`, `part/0`, written in `test/stand/server.js` as Core is to render them).

A table part, the XAML and what Core writes:

```xml
<DataSheet ItemsSource="{Bind Document.Rows}" FixedColumns="1"
		Add="{BindCmd Append, Argument={Bind Document.Rows}}" Remove="{BindCmd RemoveSelected, Argument={Bind Document.Rows}}">
	<DataSheetColumn Header="Товар" Content="{Bind Item}" ControlType="Selector" DisplayProperty="Name" Fetch="/catalog/item" Width="14rem"/>
	<DataSheetColumn Header="Кількість" Content="{Bind Qty, DataType=Number}" ControlType="TextBox" Width="6rem"/>
</DataSheet>
```

```html
<data-sheet :items-source="Document.Rows" :fixed-columns="1"
		:add="() => Document.Rows.$append()" :remove="() => $removeSelected(Document.Rows, null)">
	<data-sheet-column header="Товар" content="Item" control-type="Selector" display="Name" fetch-command="/catalog/item" width="14rem"></data-sheet-column>
	<data-sheet-column header="Кількість" content="Qty" data-type="Number" control-type="TextBox" width="6rem"></data-sheet-column>
</data-sheet>
```

`DataSheet` (`[ContentProperty("Columns")]`), as `DataGrid` writes the same things:
- `ItemsSource`: a binding, `:items-source` by `GetPath(context)`.
- `FixedColumns` (Int32): `:fixed-columns`, written when not 0.
- `CursorMode`, an enum of its own: `Cell` (the default: nothing written) | `Row` → `cursor-mode="row"` (the cursor is the row, 1C's `RowSelectionMode=Row`). A `DataSheetColumn` with `ControlType` in a sheet of `Row`: the client throws (no cell to edit); Core may refuse it first.
- `Sort` (Boolean): `:sort="true"` when set, as `DataGrid`'s; its columns sort by a header's click, by the collection view that holds `ItemsSource` (no collection view: no sort).
- `RowPicture`: a binding only, a row's property holding an icon's name; `row-picture` by the path without context (as `DataGrid`'s `Mark`); a value not bound: `XamlException`.
- `AutoSelect` (`AutoSelectMode`): `LastItem` → `auto-select="last-item"`; `None`, `FirstItem`: nothing (the sheet always has a cursor, the first row by default); `ItemId`: `XamlException` (the sheet has none).
- The keys of rows, `Command`s: `Open` (Enter, a double click), `Add` (Ins), `Copy` (F9), `Remove` (Del) → `:open`, `:add`, `:copy`, `:remove`, each `"() => " + GetCommand(context)`, as `DataGrid`'s `DoubleClick`. The cursor's row is the array's `$selected`: a command's argument reaches it as a toolbar's does (`{Bind Document.Rows}` with `…Selected`, `{Bind Document.Rows.$selected}`). Not bound: the key does nothing.
- `Height`: the style, as `DataGrid`'s; `MergeAttributes` (margin, visibility, `TestId`) as `DataGrid`'s.
- Its columns: in its body, the default slot, one `data-sheet-column` each, in order; nothing else in the body.

`DataSheetColumn` (no content property: a child element is a XAML parse error, PLAN.md):
- `Content`: a binding only; as `DataGridColumn`'s: `content` by the path without context, `data-type` (not `String`), `:hide-zeros`, `format` from the binding.
- `Header`: `header` (localized) or `:header` bound, as `DataGridColumn`'s.
- `Width` (`Length`): `width`. `Align` (`TextAlign`): `align`, lower case, when not `Default`.
- `Sort` (Boolean?): `:sort` when set (the sheet's overridden); `SortProperty`: `sort-prop`, the order the server sorts by (the content's path by default); as `DataGridColumn`'s.
- `ControlType`, an enum of its own, not `ColumnControlType`: `None` (the default: the column does not edit) | `TextBox` | `DatePicker` | `Selector` | `ComboBox` | `CheckBox`; written `control-type` by the member's name as it is, not lower-cased (`DataGridColumn` lower-cases its own): the client's kinds are keyed by these names and throw on another. A binding: not supported.
- The editor's attributes, this list only (the client's `SheetColumn`): `DisplayProperty` → `display` (`Selector`'s name; `ComboBox`'s option name, else `$name`); `ItemsSource` → `:items-source` by `GetPath(context)`; `Fetch` → `fetch-command` (bound: `:fetch-command` by `GetPathFormat(context)`), `Delegate` → `:fetch="$delegate('…')"`, both as `Selector`'s; `ValueProperty` → `value-prop` (`ComboBox`'s by `ComboBoxItem`'s `Value`). Another attribute: not written; a column needs no more today.
- An attribute evaluated by the sheet's render (the columns are its slot) must not make a new object each time (a literal array): it renders the sheet again without end. Bindings are stable; Core writes no literal.

Only on Vue 3: rendered under another `Framework`, `XamlException` naming the element (`DataSheet is supported by the Vue 3 client only`), asked of `RenderContext` as `MergeSlot` is, never `Framework` itself.

Its CSS (`packages/xaml/src/datasheet.css`): not served by Core yet, so the sheet shows unstyled there; where it goes is open (§7).

Not in this requirement: the a2v10meta generator's key (`Xaml:Grid` = `DataGrid` | `DataSheet`, PLAN.md) and the selector of the 1C dialect: their wiring waits.

## 7. Open

- `Views/Page/ChangePassword.vue3.cshtml` does not exist; on Vue 3 ChangePassword fails (§2: no fallback). Its Vue 2 script gives the page component options of its own (`computed`, `methods`), which the descriptor of §4 has no place for. About is done: `About.vue3.cshtml` returns a plain object as its model, `locale` in it.
- The NuGet package's assets (§1).
- The datasheet's CSS (§6): into Core's CSS (`tabbed.css`), then every change of the sheet's look is a requirement to Core; or built here beside the scripts and copied by `pnpm build`, then Core's part is one `<link>` in `_Layout.tabbed.vue3.cshtml`.
- An application's HTML view binding `:disabled` on an `<a>` to `false`: shown off on Vue 3, still working (§5 covers the XAML only).
