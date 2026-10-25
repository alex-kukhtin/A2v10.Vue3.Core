# A2v10.Vue3.Core

The A2v10 client on Vue 3: the port of Net48 `Scripts/tabmain.js` and A2v10.Core `wwwroot/scripts/tabbed.js`. Done when a production application moves to Vue 3 (`"Framework": "vue3"`) without a line of its ts, xaml or sql changed.

## Where things are

- `packages/model`: the data model (Net48 `services/datamodel.js`…); `platform`: the `std:*` modules, the page controller (base.js), include; `primitives`: `v-dropdown`, `v-contextmenu`; `core`: bundles them as `a2v10-core.js`; `shell-tabbed`: the tabbed shell; `xaml`: the components the XAML renders.
- Net48 sources: `C:\A2v10_Net48\A2v10\Web\A2v10.Web.Site\app\` (`components/`, `services/`, `controllers/`); the tests find the site by `A2V10_NET48_SITE` (`.env`, template `.env.example`).
- A2v10.Core: `C:\A2v10_Net6\A2v10.Core`; Core-only client sources in `Web/A2v10.Core.Web.Site/Scripts/`.
- The application the pages come from: `C:\A2v10_Net6\MetaAppStand`.
- CORE-VUE3.md: the contract with Core, what Core serves and what is open there.
- NET48-BUGS.md: defects of the Net48 sources, what the port does with each, its rules (IDs, next free ones).
- packages/model/NET48.md: what the model changed on purpose.
- COMPONENTS-TODO.md: the components not ported yet.
- PLAN.md: work decided but not started (the 1C dialect).

## Rules

- Commit only when asked; leave changes in the working copy.
- Never edit A2v10.Core or Net48. A need on the server is written as a requirement in CORE-VUE3.md. `pnpm build` copying the built files into Core's `wwwroot/scripts/vue3` is allowed.
- Do not patch our compiler for a Vue 2 → 3 difference: fix it at the source (Core renders by `Framework`) unless Vue itself has a switch (as `compatConfig.COMPILER_NATIVE_TEMPLATE`).
- The order of COMPONENTS-TODO.md is the user's; take the component the user names.
- Reply in Russian.

## Porting a component

- `packages/xaml/src/<file>.ts` (shell components: `packages/shell-tabbed/src/`); its first comment: `<name> (Net48 components/<file>.js), unchanged in behaviour: …`, then each Vue 3 change.
- Import it in the package's `index.ts`; name it in CORE-VUE3.md §1; delete its COMPONENTS-TODO.md entry.
- Vue 2 → 3, as done so far: the page controller by `inject: { page: { from: '$page', default: null } }`, not `$root`; `$children` → `ref`; `beforeDestroy`/`destroyed` → `beforeUnmount`/`unmounted`; declare `emits`; props read under their declared names (`itemsSource`); `<col>` is void.
- A `std:*` module that needs the locale or the model (`std:utils`) is required when used, not at load: the shell's bundle loads before them (`test/shell/smoke.js` fails otherwise).

## The loop

1. The user opens a page in Core (MetaAppStand) and pastes the `/_page` or `/_dialog` answer and the console's warnings.
2. The page goes to `test/stand/pages/<area>-<name>-<action>.html`, its route to `test/stand/server.js`, a menu entry to `test/stand/shell.html`; rows added when the answer has none.
3. Port, `pnpm build`, check on the stand in the browser pane (no warnings, the component's behaviour).
4. The user confirms in Core.

- Write decodes `\u0022` and `\n` in a pasted answer: write such parts by a node script (or copy them from an existing stand page).

## Commands

- `pnpm build`: the packages, then copies the files to Core (`scripts/copy-assets.mjs`).
- `pnpm test`: model, trace, platform and shell tests; stops at the first failing suite.
- `pnpm stand`: the stand, `http://localhost:3077/`.
