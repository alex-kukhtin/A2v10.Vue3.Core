# Defects found in the Net48 client sources

Found while porting the model core to `@a2v10/model` (2026-10). Paths are under `Web/A2v10.Web.Site/app/` of the Net48 A2v10 repository; line numbers as of 2026-10-16 (B16, B17: as of 2026-10-24, after the fixes of B1-B13).

Each entry: where, what, what follows from it, what the package does now, the fix proposed. An ID is cited in the package's code and in `test/trace/divergences.js`; keep IDs stable, mark an entry done instead of deleting it.

The package's rule: a crash is fixed at once; any other defect is kept as Net48 has it until decided here, since an application may depend on it. Deciding: fix it in the package (and in Net48, if it is critical there), add or change the scenario in `test/trace/scenarios.js`, record the divergence in `test/trace/divergences.js`, mark the entry.

## Crashes

**B1** `services/utils.js:371` `convertToString` returns `'' + val`; `val` is not declared.
- Follows: ReferenceError for any value not falsy, not an element with Name, not a date. `controllers/base.js:1367` calls it.
- Done 2026-10-24: `'' + obj` in Net48 and the package (`locale/format.ts`).

**B2** `services/datamodel.js:870` `console.error($\`There is no method 'exec'…\`)`: a stray `$` before the template literal.
- Follows: a command object without `exec` throws ReferenceError instead of logging.
- Done 2026-10-24: logs, in Net48 and the package (`model/template.ts`). Trace: `_exec_(noExec)`.

**B3** `services/datamodel.js:240` `alert('todo: invalid property type')` for a template property that is neither a constructor, a function, nor a plain object (an array, a number).
- Follows: a browser modal in the model; outside a browser (server, tests) ReferenceError, the model is not created.
- Done 2026-10-24: `console.error("invalid template property: <Type>.<prop>")`, the property skipped, in Net48 and the package (`model/template.ts`). Trace: "template: a property of an unknown kind".

**B4** `services/datamodel.js:315` `source[elem._meta_.$expanded]` with `source` null: a tree element type with `$expanded`, built with no source (`$new()`, `$append()` with no argument).
- Follows: TypeError; an empty tree node cannot be added.
- Done 2026-10-24: the element is not expanded, collapsed, in Net48 and the package (`model/element.ts`). Trace: `A2.Items.$append() (no source)`.

## Wrong behaviour

**B5** `services/impl/array.js:225-227` `$insert` of one element: `ne.$select()` emits `[].select`, then `emitSelect(that, ne)` emits it again.
- Follows: a `Rows[].select` handler runs twice per `$append`/`$prepend`/`$insert`.
- Done 2026-10-24: the second `emitSelect` dropped, in Net48 and the package (`model/array.ts`). Trace: every `$append` in "arrays", "template", "model info". In a tree the second event was on another path, dropped too: see B16.

**B6** `services/impl/array.js:71-82` `$copy` empties through `__empty__` (sets `$RowCount` 0) and pushes without counting.
- Follows: after `$copy` alone, `$RowCount` is 0 whatever was copied. `$merge` sets it right after from the source, so loads are not affected; a direct `$copy` is.
- Done 2026-10-24: `$RowCount = this.length` after the push, in Net48 and the package (`model/array.ts`). Trace: "arrays" `$copy`.

**B7** `services/datamodel.js:1102` (`$set`), `services/impl/array.js:72` (`$copy`), `:171` (`$empty`), `:274` (`$remove`) check `this.$root.isReadOnly`; no member has that name (the root's is `$readOnly`).
- Follows: the checks never stop anything; a read-only model accepts `$set`, `$copy`, `$empty`, `$remove`.
- Fix: decide with Q1; then `$readOnly`, or drop the checks.

**B8** `services/utils.js:608` `dateHasTime`: `getHours() !== 0 || getMinutes() !== 0 && getSeconds() !== 0`; `&&` binds first.
- Follows: 00:05:00 has no time, 00:05:30 has. `format(d, 'DateUrl')` drops the time of the first.
- Done 2026-10-24: `getHours() !== 0 || getMinutes() !== 0 || getSeconds() !== 0`, in Net48 and the package (`base/date.ts`).

**B9** `services/utils.js:123` `isPromise(null)`: `isDefined(null)` is true, then `null.then`.
- Follows: TypeError for null.
- Done 2026-10-24: `v !== null && (typeof v === 'object' || typeof v === 'function')` before reading `then`, in Net48 and the package (`base/is.ts`).

**B10** `services/datamodel.js:122-128`, `:145-153` A template property `{ type: Number, value: 5 }` (`templatePropDefault` in `platform.d.ts`) becomes a marker (`TMarker`); the setter coerces by the property's constructor, TMarker, so not at all.
- Follows: `elem.$Count = '8'` stores the string `'8'` though the template says Number.
- Done 2026-10-24: the setter coerces by the marker's `type` when it has `type` and `value`, in Net48 and the package (`model/element.ts`). Trace: "template" `$Count = "8"`.

**B11** `services/datamodel.js:1213` `$merge` builds a nested element as `new ctor(src[prop], prop, this)`: the path is the property name, not `pathdot + prop`; the element is then merged into the one already there and dropped.
- Follows: every merge of a nested element emits `<Type>.construct` for a throwaway element with a wrong path ('Agent', not 'Document.Agent'); a construct handler runs on it.
- Done 2026-10-24: the source is merged into the existing element (`trg.$merge(src[prop] || null)`); with none there, a new one at the full path; in Net48 and the package (`model/element.ts`). Trace: "objects" `Document.$merge(…)`.

**B12** `services/datamodel.js:402-408` `$setProperty` (a map, `$itemType`) builds the path as `path + '.' + prop` from the constructor's `path` argument, undefined for a root.
- Follows: an element of a root-level map gets the path `'undefined.Prop'`; event names built from it are wrong.
- Done 2026-10-24: `elem._path_ ? elem._path_ + '.' + prop : prop`, in Net48 and the package (`model/element.ts`).

**B13** `services/validators.js:41` `` console.error(`invalid std rule: '${rule}'`) ``: `rule` is an object.
- Follows: the message reads `invalid std rule: '[object Object]'`.
- Done 2026-10-24: `${rule.valid}`, in Net48 and the package (`model/rules.ts`).

**B16** `services/impl/array.js:226-227` (the B5 fix) In a tree the dropped `emitSelect(that, ne)` was no duplicate: `ne.$select()` emits `[].select` on the tree root array (`$findTreeRoot`, `:418-427`), the dropped call emitted it on the element's own nested array (`Folders[].Items[].select`).
- Follows: `$append` into a nested tree array emits `Folders[].select` only.
- Decided 2026-10-24: dropped. Selecting in a tree emits on the root only: `$select` (a click), the reselect after `$remove`, a multi-element `$insert` never emitted the nested event; a one-element `$insert` alone did, so a handler on it saw appends, not selection. No subscriber in the Net48 and Net6 applications: they subscribe on root paths (`Folders[].select`, `Customers[].select`).
- Package: as Net48 (`model/array.ts`). Trace: "tree" `B.Items.$append({Id: 21})`, `A2.Items.$append() (no source)`.

**B17** `services/datamodel.js:1213-1222` `$merge` treats a template marker property (`TMarker`) as a nested element: its value has no `$merge`, so `new TMarker(…)` is set through the setter.
- Follows: every `$merge` (a reload) resets the markers: `{ type: Number, value: 5 }` becomes `0` (the setter coerces the TMarker object, since B10), a plain object becomes an empty TMarker object.
- Done 2026-10-24: `$merge` skips markers (`if (ctor === TMarker) continue;`): they are client state, the server does not send them; in Net48 and the package (`model/element.ts`). Not in the trace.

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
- Done 2026-10-24 in Net48: `std:eventBus` has an empty `$emit() {}`. The package requires it: `Runtime.eventBus.$emit` (`runtime.ts`).

**B15** `services/url.js:210` `replaceId` is `alert('todo::replaceId')`.
- Follows: a browser modal instead of a result.
- Done 2026-10-24 in Net48: `replaceId` removed; nothing in `app/` called it. The platform's shelf: url.js is not ported.
