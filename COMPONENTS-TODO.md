# Components not ported yet

The Vue 2 set the tabbed shell loads: Net48 `Scripts/tabmain.js` (bundleconfig.json: `app/components/*`, `app/directives/*`) and A2v10.Core `wwwroot/scripts/tabbed.js` (`Scripts/bigcalendar.js`, `multiselect.js`, `texteditor.js`). Compared by the names they register (`Vue.component`, `Vue.directive`, `app.components[…]`) with the port's (`vocabulary.component`, `vocabulary.directive`, `app.components[…]` in `packages/*/src`). Seen 2026-10-25: 85 names, 36 not ported.

A port goes to `packages/xaml/src/<file>.ts`, is imported by `packages/xaml/src/index.ts`, and is named in CORE-VUE3.md §1. An entry is deleted when ported.

## Likely on forms: next

- [ ] `tab.js` (209): `a2-tab-panel`, `a2-tab-item` — XAML `TabPanel`
- [ ] `popover.js` (111): `popover`
- [ ] `upload.js` (172): `a2-upload`, `a2-simple-upload`
- [ ] `fileupload.js` (107): `a2-file-upload`
- [ ] `image.js` (223): `a2-image`, `a2-file-image`, `a2-file-preview`, `a2-static-image`
- [ ] `timepicker.js` (206): `a2-time-picker`
- [ ] `inlinedialog.js` (91): `a2-inline-dialog`
- [ ] `resize.js` (158): `v-resize` — the splitter of panes

## When a page needs it

- [ ] `wizard.js` (226): `a2-wizard-panel`, `a2-wizard-page`
- [ ] `megamenu.js` (69): `mega-menu`
- [ ] `treeview.js` (257): `tree-view`
- [ ] `dashboard.js` (383): `a2-dashboard`, `a2-dashboard-item`
- [ ] `kanban.js` (113): `a2-kanban`
- [ ] `graphics.js` (65): `a2-graphics`
- [ ] `collectionviewplain.js` (part): `collection-view` — the client one; `collection-view-server(-url)` is ported
- [ ] `inlineedit.js` (77): `a2-edit-inline`
- [ ] `spansum.js` (33): `a2-span-sum`
- [ ] `pageorient.js` (107): `v-print-page`, `v-page-orientation`
- [ ] `accelcommand.js` (25): `a2-accel-command`
- [ ] `waitcursor.js` (22): `wait-cursor`
- [ ] Core `multiselect.js` (189): `a2-multiselect`
- [ ] Core `bigcalendar.js` (289): `a2-big-calendar`

## Not gaps

- `includeplain.js`: `include`, `a2-include`, `a2-queued-include` — in the platform (`packages/platform/src/include.ts`).
- `doctitleplain.js`: `app.components['std:doctitle']` — the shell registers `a2-document-title` itself (`packages/shell-tabbed/src/doctitle.ts`).
- `validator.js`: `validator-control` — commented out in Net48.
- `directives/mask.nojs`: `v-mask` — not a `.js`, not in the bundle.
