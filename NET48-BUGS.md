# Defects found in the Net48 client sources

Found while porting the model core to `@a2v10/model` (2026-10). Paths are under `Web/A2v10.Web.Site/app/` of the Net48 A2v10 repository; line numbers as of 2026-10-16.

Each entry: where, what, what follows from it, what the package does now, the fix proposed. An ID is cited in the package's code and in `test/trace/divergences.js`; keep IDs stable, mark an entry done instead of deleting it.

The package's rule: a crash is fixed at once; any other defect is kept as Net48 has it until decided here, since an application may depend on it. Deciding: fix it in the package (and in Net48, if it is critical there), add or change the scenario in `test/trace/scenarios.js`, record the divergence in `test/trace/divergences.js`, mark the entry.

## Crashes

**B1** `services/utils.js:371` `convertToString` returns `'' + val`; `val` is not declared.
- Follows: ReferenceError for any value not falsy, not an element with Name, not a date. `controllers/base.js:1367` calls it.
- Package: fixed, `'' + obj` (`locale/format.ts`).

**B2** `services/datamodel.js:870` `console.error($\`There is no method 'exec'…\`)`: a stray `$` before the template literal.
- Follows: a command object without `exec` throws ReferenceError instead of logging.
- Package: fixed, logs (`model/template.ts`). Trace: `_exec_(noExec)`.

**B3** `services/datamodel.js:240` `alert('todo: invalid property type')` for a template property that is neither a constructor, a function, nor a plain object (an array, a number).
- Follows: a browser modal in the model; outside a browser (server, tests) ReferenceError, the model is not created.
- Package: fixed, `console.error` naming the property; the property is skipped (`model/template.ts`). Trace: "template: a property of an unknown kind".

**B4** `services/datamodel.js:315` `source[elem._meta_.$expanded]` with `source` null: a tree element type with `$expanded`, built with no source (`$new()`, `$append()` with no argument).
- Follows: TypeError; an empty tree node cannot be added.
- Package: fixed, the element is not expanded, collapsed (`model/element.ts`). Trace: `A2.Items.$append() (no source)`.

## Wrong behaviour (kept in the package)

**B5** `services/impl/array.js:225-227` `$insert` of one element: `ne.$select()` emits `[].select`, then `emitSelect(that, ne)` emits it again.
- Follows: a `Rows[].select` handler runs twice per `$append`/`$prepend`/`$insert`.
- Fix: drop the second `emitSelect`. Trace: every `$append` in "arrays", "template", "model info".

**B6** `services/impl/array.js:71-82` `$copy` empties through `__empty__` (sets `$RowCount` 0) and pushes without counting.
- Follows: after `$copy` alone, `$RowCount` is 0 whatever was copied. `$merge` sets it right after from the source, so loads are not affected; a direct `$copy` is.
- Fix: `$RowCount = this.length` after the push, when the array has `$RowCount`. Trace: "arrays" `$copy`.

**B7** `services/datamodel.js:1102` (`$set`), `services/impl/array.js:72` (`$copy`), `:171` (`$empty`), `:274` (`$remove`) check `this.$root.isReadOnly`; no member has that name (the root's is `$readOnly`).
- Follows: the checks never stop anything; a read-only model accepts `$set`, `$copy`, `$empty`, `$remove`.
- Fix: decide with Q1; then `$readOnly`, or drop the checks.

**B8** `services/utils.js:608` `dateHasTime`: `getHours() !== 0 || getMinutes() !== 0 && getSeconds() !== 0`; `&&` binds first.
- Follows: 00:05:00 has no time, 00:05:30 has. `format(d, 'DateUrl')` drops the time of the first.
- Fix: `getHours() !== 0 || getMinutes() !== 0 || getSeconds() !== 0`.

**B9** `services/utils.js:123` `isPromise(null)`: `isDefined(null)` is true, then `null.then`.
- Follows: TypeError for null.
- Fix: `v !== null && (typeof v === 'object' || typeof v === 'function')` before reading `then`.

**B10** `services/datamodel.js:122-128`, `:145-153` A template property `{ type: Number, value: 5 }` (`templatePropDefault` in `platform.d.ts`) becomes a marker (`TMarker`); the setter coerces by the property's constructor, TMarker, so not at all.
- Follows: `elem.$Count = '8'` stores the string `'8'` though the template says Number.
- Fix: keep the declared type in the metadata and coerce by it. Trace: "template" `$Count = "8"`.

**B11** `services/datamodel.js:1213` `$merge` builds a nested element as `new ctor(src[prop], prop, this)`: the path is the property name, not `pathdot + prop`; the element is then merged into the one already there and dropped.
- Follows: every merge of a nested element emits `<Type>.construct` for a throwaway element with a wrong path ('Agent', not 'Document.Agent'); a construct handler runs on it.
- Fix: merge the source into the existing element (`this[prop].$merge(src[prop])`) instead of building one. Trace: "objects" `Document.$merge(…)`.

**B12** `services/datamodel.js:402-408` `$setProperty` (a map, `$itemType`) builds the path as `path + '.' + prop` from the constructor's `path` argument, undefined for a root.
- Follows: an element of a root-level map gets the path `'undefined.Prop'`; event names built from it are wrong.
- Fix: `this._path_ ? this._path_ + '.' + prop : prop`.

**B13** `services/validators.js:41` `` console.error(`invalid std rule: '${rule}'`) ``: `rule` is an object.
- Follows: the message reads `invalid std rule: '[object Object]'`.
- Fix: `${rule.valid}`.

## Questions: what was meant

**Q1** Read-only (`__modelInfo.ReadOnly`, `StateReadOnly`) only stops dirtiness (`services/datamodel.js:1081`): setters store and emit change events, arrays add and remove.
- Decide: is read-only a display state (the view disables the controls; the model accepts writes), or a model state (writes refused)? B7 depends on it.

**Q2** Assigning an element to an object property (`row.Entity = other`) merges `other` into the existing object (`services/datamodel.js:163-166`). The setter then emits no change: the merge emits `<path>.change` only when the id changes (`:1225-1232`), with the object as both new and old value.
- Follows: a handler of `Document.Agent.change` misses an assignment that keeps the id and changes other fields, and never sees the old value.
- Decide: the event an assignment of an element emits, and its arguments.

**Q3** `defaults` for an array element's property (`'Document.Rows[].Qty'`) are ignored: `setDefaults` evaluates the path `'Document.Rows[]'`, gets `''`, skips (`services/datamodel.js:424`). Nothing else reads `defaults`.
- Decide: apply them to new array elements (`$new`), or refuse such keys loudly.

## Other shelves

**B14** `server/platform.js:30` `app.modules['std:eventBus'] = {}`: no `$emit`.
- Follows: on the server an async validator's answer throws (`services/validators.js:176`). Matters when the model runs in Jint (`design/view-engines.md`): the server adapter must give `eventBus.$emit`.

**B15** `services/url.js:210` `replaceId` is `alert('todo::replaceId')`.
- Follows: a browser modal instead of a result. The platform's shelf: decide when url.js is ported.
