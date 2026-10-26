# Components not ported yet

The Vue 2 set the tabbed shell loads: Net48 `Scripts/tabmain.js` (bundleconfig.json: `app/components/*`, `app/directives/*`) and A2v10.Core `wwwroot/scripts/tabbed.js` (`Scripts/bigcalendar.js`, `multiselect.js`, `texteditor.js`). Compared by the names they register (`Vue.component`, `Vue.directive`, `app.components[…]`) with the port's (`vocabulary.component`, `vocabulary.directive`, `app.components[…]` in `packages/*/src`).
A port goes to `packages/xaml/src/<file>.ts`, is imported by `packages/xaml/src/index.ts`, and is named in CORE-VUE3.md §1. An entry is deleted when ported.

## Likely on forms: next

- [ ] `tab.js` (209): `a2-tab-panel`, `a2-tab-item` — XAML `TabPanel`
- [ ] `upload.js` (172): `a2-simple-upload` — `a2-upload` is ported (`upload.ts`)
- [ ] `fileupload.js` (107): `a2-file-upload`
- [ ] `image.js` (223): `a2-file-image`, `a2-static-image` — `a2-image`, `a2-file-preview` are ported (`image.ts`)
- [ ] `resize.js` (158): `v-resize` — the splitter of panes

## When a page needs it

- [ ] `wizard.js` (226): `a2-wizard-panel`, `a2-wizard-page`
- [ ] `megamenu.js` (69): `mega-menu`
- [ ] `graphics.js` (65): `a2-graphics`
- [ ] `collectionviewplain.js` (part): `collection-view` — the client one; `collection-view-server(-url)` is ported
- [ ] `inlineedit.js` (77): `a2-edit-inline`
- [ ] `pageorient.js` (107): `v-print-page`, `v-page-orientation`
- [ ] `accelcommand.js` (25): `a2-accel-command`
- [ ] `waitcursor.js` (22): `wait-cursor`

## Not gaps

- `includeplain.js`: `include`, `a2-include`, `a2-queued-include` — in the platform (`packages/platform/src/include.ts`).
- `doctitleplain.js`: `app.components['std:doctitle']` — the shell registers `a2-document-title` itself (`packages/shell-tabbed/src/doctitle.ts`).
- `validator.js`: `validator-control` — commented out in Net48.
- `directives/mask.nojs`: `v-mask` — not a `.js`, not in the bundle.
