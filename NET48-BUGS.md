# Defects found in the Net48 client sources

Found while porting the model core to `@a2v10/model` (2026-10), and while tracing the page controller `controllers/base.js` (B20-B25). Paths are under `Web/A2v10.Web.Site/app/` of the Net48 A2v10 repository; line numbers as of 2026-10-16 (B19-B25 and the decision of B7: as of 2026-10-24).

Each entry: where, what, what follows from it, what the package does now, the fix proposed or decided. An ID is cited in the package's code and in `test/trace/divergences.js`.

An entry is deleted when done: Net48 and the package agree, and `test/trace/divergences.js` does not cite it. Its history is in git; delete its citations in the code with it. An ID is never reused: the next are B26 and Q4.

The package's rule: a crash is fixed at once; any other defect is kept as Net48 has it until decided here, since an application may depend on it. Deciding: fix it in the package (and in Net48, if it is critical there), add or change the scenario in `test/trace/scenarios.js`, record the divergence in `test/trace/divergences.js`; once Net48 has the fix too, drop the divergence and delete the entry.

The page controller is not ported yet: its entries say what the port does, and cite the section and operation of `test/trace/base.net48.trace` (scenarios: `test/trace/pages.js`) that shows the defect.

## Crashes

**B20** `controllers/base.js:1110` `$dialog`: `opts.validRequired && root.$invalid`; `root` is not declared in `$dialog`.
- Follows: every `$dialog` and `$showDialog` with `validRequired` throws ReferenceError; the dialog does not open, the user sees nothing.
- Port: fixed at once, `this.$data.$invalid`. Trace: "$dialog: the commands", `$dialog("show", …, { validRequired: true })`.
- Fix: `this.$data.$invalid` in Net48 too.

**B21** `controllers/base.js:1229` `$report`: `opts.validRequired && root.$invalid`; `root` is declared only inside `doReport` (`:1206`), and there it is `window.$$rootUrl`.
- Follows: every `$report` with `validRequired` throws ReferenceError; no report opens.
- Port: fixed at once, as B20. Trace: "$navigate, files, reports, the side pane", `$report("rep", Document, { validRequired: true })`.
- Fix: `this.$data.$invalid` in Net48 too.

**B22** `controllers/base.js:1116-1120` `$dialog` with `saveRequired`: `this.$save().then(() => { dlgResult = doDialog(); })`, then `return dlgResult`.
- Follows, when the main object is new and the page clean (`$isDirty` false, `$mainObject.$isNew` true): `$save()` returns undefined (`:330`, not dirty), `.then` throws TypeError; the dialog does not open.
- Follows, when dirty: the dialog opens after the save, but `$dialog` returns null at once, so `await $dialog(…)` never gets the dialog's result.
- Port: the crash fixed at once (the save runs, then the dialog); the null kept until decided. Trace: "$dialog: saveRequired, a new document" (the crash); "$dialog: the commands", `$dialog("show", …, { saveRequired: true })` (`= null`).
- Fix: `return Promise.resolve(this.$save(…)).then(() => doDialog())`, with the new clean object marked dirty first, as `$ensureSaved` does (`:422`): `$save` saves only a dirty model.

**B24** `controllers/base.js:717` `$upload` catch: `err.indexOf('UI:')` for any `err`; `http.upload` (`services/http.js:95`) rethrows what `fetch` throws, a TypeError on a network failure.
- Follows: a network failure rejects `$upload` with TypeError("err.indexOf is not a function"); the user sees nothing. With `catchError` the original error is rethrown, as meant.
- Port: fixed at once, `this.$alertUi(err)`, as `$uploadBlob` and `$uploadBlobFile` do (`:677`, `:696`): it takes an Error and a `UI:` text alike. Trace: "$upload, $uploadBlob, $uploadBlobFile", `$upload(…) → network failure`.
- Fix: the same in Net48.

**B25** `controllers/base.js:787-806` `$eusign`: `rawDialog` (a copy of `__runDialog`, `:28-43`) calls `cb(result)`; `cb` is not declared (`:797`). The caller then shows `alert('promise resolved')` (`:804`), and `const root` (`:802`) is unused.
- Follows: when the signing dialog closes with a result, ReferenceError rejects the inner promise, unhandled; the debug alert never shows. Reached from XAML: `{BindCmd EUSign}` renders `$eusign(url, arg)` (A2v10.Core `ViewEngines/A2v10.ViewEngine.Xaml/Base/BindCmd.cs:350`). Not in `platform.d.ts` nor in `$ctrl`.
- Port: fixed at once, no callback, no alert: the dialog's promise is returned. Trace: "$eusign".
- Fix: decide what `$eusign` returns (the dialog's result, as `$showDialog`); the same in Net48.

## Wrong behaviour

**B7** `services/datamodel.js:1102` (`$set`), `services/impl/array.js:72` (`$copy`), `:171` (`$empty`), `:274` (`$remove`) check `this.$root.isReadOnly`; no member has that name (the root's is `$readOnly`: `__modelInfo.ReadOnly` or `StateReadOnly`).
- Follows: the checks never stop anything. Read-only only stops dirtiness (`services/datamodel.js:1081`): setters store and emit change events, arrays add and remove.
- Decided 2026-10-24, not done: read-only is a model state. Reloading from the database is allowed; changing from inside is not. The cut is the load door:
  - `$copy` is the load door (its one caller: `$merge`, `services/datamodel.js:1196`): no check; it empties through `__empty__`, not `$empty`.
  - `$empty`, `$remove`, `$set` check `$readOnly`.
  - The lazy loaders reduce to `$copy`: `controllers/base.js:1418` (tree expand: `$empty()`, then push) and `:1462` (`$loadLazy`: `__empty__()`, then push). The reset before a reload reduces to `__empty__`: `$resetLazy` (`services/impl/array.js:319-325`, `$empty()`).
  - Order: the package first, with scenarios. Net48 is left as it is on purpose: this is a decision, not a forgotten entry.
- Open: property setters and `$append`, `$insert`, `$move` are not in the cut. A check in the setter must let `$merge` through: it writes scalars by the setter (`platform.set`).

**B19** `services/impl/array.js:89-95` `$clearSelected` on a nested tree array: `$selected` searches the descendants, so it clears the tree's one selection, and `emitSelect(this, null)` emits on the nested path.
- Follows: `Folders[0].Items.$clearSelected()` leaves the tree with no selection and emits `Folders[].Items[].select(…, null)`; a `Folders[].select` handler (where the applications subscribe) is not told.
- Package: kept (`model/array.ts`). Trace: "tree" `A2.$select(); A.Items.$clearSelected()`.
- Fix: in a tree, emit on the tree root (`$findTreeRoot` of the cleared element), as `$select` does.

**B23** `controllers/base.js:1727` `created` subscribes `signalEvent`; `destroyed` (`:1744-1750`) unsubscribes the other seven bus events, not this one.
- Follows: a closed page stays on the bus, and in memory with its view model, until the browser page reloads; each signal calls it. `__signalAppEvent__` (`:1701`) checks `this.$data`, null after destroy (`:1756`), so nothing else runs.
- Port: unsubscribes all it subscribed; no application sees the difference. Trace: "the bus into a page, and its end", `listeners` after `$destroy()` (`{signalEvent: 1}`).
- Fix: `eventBus.$off('signalEvent', this.__signalAppEvent__)` in `destroyed`.

## Questions: what was meant

**Q2** Assigning an element to an object property (`row.Entity = other`) merges `other` into the existing object (`services/datamodel.js:163-166`). The setter then emits no change: the merge emits `<path>.change` only when the id changes (`:1225-1232`), with the object as both new and old value.
- Follows: a handler of `Document.Agent.change` misses an assignment that keeps the id and changes other fields, and never sees the old value.
- Decide: the event an assignment of an element emits, and its arguments.

**Q3** `defaults` for an array element's property (`'Document.Rows[].Qty'`) are ignored: `setDefaults` evaluates the path `'Document.Rows[]'`, gets `''`, skips (`services/datamodel.js:424`). Nothing else reads `defaults`.
- Decide: apply them to new array elements (`$new`), or refuse such keys loudly.
