# @a2v10/model against its Net48 source

The source: `Web/A2v10.Web.Site/app/services/` of the Net48 A2v10 repository (`datamodel.js`, `impl/array.js`, `validators.js`, `utils.js`, `period.js`, `modelinfo.js`). Its behaviour is the specification, held on the built package by:

- the Net48 jasmine specs, read in place: `node test/model/specs.js` (all but `urltools`: `url.js` is the platform's);
- the trace of the scenarios: `node test/trace/model.js` compares with `test/trace/net48.trace`, the trace of the Net48 sources (`node test/trace/net48.js`); `test/trace/divergences.js` lists, line by line, each fixed defect of `NET48-BUGS.md` that shows in the trace.

Both read the Net48 site (sources, specs, jasmine, the locale) from the folder `A2V10_NET48_SITE` names: in the environment, or in `.env` at the repository root (`.env.example` is the template).

The open defects of the source, and what the package does with each, are in `NET48-BUGS.md` at the repository root (IDs B…, Q…, cited in the code; a done entry is deleted, its history in git). This file lists what changed on purpose and is no defect: shelves and shapes.

## Moved between shelves

- `utils.text.applyFilters` (with `toLatin`) and `utils.mapTagColor` leave the core: the controls use them, `applyFilters` calls `eval`. The platform adds them to `std:utils` when it registers it.
- `Date.prototype.toJSON` (a date as local time, no zone): was in `platform/polyfills.js`; the core installs it in `createModel` (`base/json.ts`), since `toJson` and the `DateUrl` format depend on it, in the browser and on the server alike. `Date.prototype.isZero` stays a polyfill of the platform: the core does not use it.
- The locale comes in `runtime.locale`; Net48 read `window.$$locale` (`utils.js:8` through `std:locale`, `period.js:10` directly).
- `std:log` is not the core's: `runtime.log` is optional, as `require('std:log', true)` was.

## Dropped for Vue 3

- No seal. Net48's `_seal_` (`Object.seal` of every element at load, base.js `__doInit__`) is gone with its call. Vue 3's `reactive()` returns a non-extensible object as is, before its proxy cache: below the root nothing would be reactive, and a proxy made before the seal breaks the get invariant on the hidden members. So:
  - an assignment to an undeclared property after load adds it (Net48: TypeError in strict code, dropped in sloppy);
  - `$setProperty` on a map works after load too (Net48: throws "the map … is sealed after load").
  Traces: `test/trace/divergences.js` "seal" ("scalars", "maps").

## Same behaviour, other shape

- No `_src_`. A data property's value lives in a shadow only its accessor reaches (`model/element.ts`); there is no second way to the data. The setter reads the current value through `this[prop]`, as a proxy over the model sees it.
- Hidden members (`_path_`, `_root_`, `_parent_`, `_meta_`, `_errors_`, `_lockEvents_`, `$id`…) are `configurable: true` (Net48: false): a proxy may then report them.
- Methods live on prototypes, not on each instance:
  - arrays: one prototype per core over `Array.prototype` (`model/array.ts`); own are the hidden fields, `$lock`, and what the server and the platform set (`$RowCount`, `$ModelInfo`, `$loaded`, `$cross`, template properties);
  - elements: `$lockEvents`, `$unlockEvents`, `$noChangeEvents`, `$eventsLocked`, `$valid`, `$invalid`, `$errors`, `$groupName`, `$expand`, `$findTreeRoot`, `$selectPath` on the type's prototype (`defineObject`);
  - the root: `_modelLoad_`, `_setDefaults_`, `_fireLoad_`, `_fireUnload_`, `_fire*_`, `_saveSelections`, `_restoreSelections`, `_setRuntimeInfo_`, `$createModelInfo`, `_setModelInfo_`, `_findRootModelInfo`, `$readOnly`, `$stateReadOnly`, `$isCopy`, `$mainObject` on the root type's prototype (`implementRoot`); the caller of `_modelLoad_` is kept in a hidden `_lastCaller_`.
  Seen only by `hasOwnProperty` and `Object.keys`; `in`, calls and `for…in` see them as before.
- `implementRoot` no longer sets `$merge`: `defineObject` already put the same function on every type's prototype, the root's included.
- `TPeriod` is a class: its methods are non-enumerable on the prototype (Net48: enumerable prototype assignments). `for…in` over a period no longer lists them; own properties (`From`, `To`, `Name`) are as before.
- Event names are made in one place, `model/events.ts`; Net48 concatenated them in each emitter.
- Dropped, unused: `utils.ensureType`'s `typeof val === type` (a string compared with a constructor, never true); `datamodel.js` `__initialized__` (written, never read) and `collectErrors` (empty).
