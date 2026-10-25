# Defects found in the Net48 client sources

Found while porting the model core to `@a2v10/model` (2026-10), while tracing the page controller `controllers/base.js` (B20-B25), and while porting the platform (B26-). Paths are under `Web/A2v10.Web.Site/app/` of the Net48 A2v10 repository; line numbers as of 2026-10-16 (B19 and later, and the decision of B7: as of 2026-10-24).

Each entry: where, what, what follows from it, what the package does now, the fix proposed or decided. An ID is cited in the package's code and in `test/trace/divergences.js`.

An entry is deleted when done: Net48 and the package agree, and `test/trace/divergences.js` does not cite it. Its history is in git; delete its citations in the code with it. An ID is never reused: the next are B34 and Q4.

The package's rule: a crash is fixed at once; any other defect is kept as Net48 has it until decided here, since an application may depend on it. Deciding: fix it in the package (and in Net48, if it is critical there), add or change the scenario in `test/trace/scenarios.js`, record the divergence in `test/trace/divergences.js`; once Net48 has the fix too, drop the divergence and delete the entry.

The page controller is not ported yet, the platform is being ported (`@a2v10/platform`): their entries say what the port does, and cite where the defect shows: a section and operation of `test/trace/base.net48.trace` (scenarios: `test/trace/pages.js`), or a test of `test/core/`.

## Crashes

**B25** `controllers/base.js:785-804` `$eusign`: `rawDialog` (a copy of `__runDialog`, `:28-43`) calls `cb(result)`; `cb` is not declared (`:795`). The caller then shows `alert('promise resolved')` (`:802`), and `const root` (`:800`) is unused.
- Follows: when the signing dialog closes with a result, ReferenceError rejects the inner promise, unhandled; the debug alert never shows. Reached from XAML: `{BindCmd EUSign}` renders `$eusign(url, arg)` (A2v10.Core `ViewEngines/A2v10.ViewEngine.Xaml/Base/BindCmd.cs:350`). Not in `platform.d.ts` nor in `$ctrl`.
- Net48: left as it is on purpose (2026-10-24): an old tail, not maintained there. The entry stays while the port differs.
- Port: fixed at once, no callback, no alert: the dialog's promise is returned. Trace: "$eusign".

**B28** `services/http.js:164` `load`: `srcElem.id` is read before the null check of `:165`.
- Follows: a page whose answer has no element (an empty body, text only) throws TypeError; include shows it as an alert of that TypeError.
- Port: fixed at once: `Error('page <url>: no root element')` (`packages/platform/src/page.ts`).
- Net48: fixed 2026-10-24 (`84e0f9ffb`), otherwise: `srcElem ? srcElem.id || null : null`; with no element the selector is emptied and the load resolves `null` (`:166-199`), quietly. The port throws.
- Decide: the port follows Net48 (an empty include, no error), or Net48 refuses loudly as the port does.

**B31** A2v10.Core `Web/A2v10.Core.Web.Site/Scripts/signalr.js:28` (not Net48: the tabbed shell's, bundled into `tabbed.js`) `startService`: a failed `connection.start()` retries with `setTimeout(start, 5000)`; `start` is not declared.
- Follows: the first failure throws ReferenceError inside the async function: an unhandled rejection, and no retry; signals are lost until the browser page reloads (`withAutomaticReconnect` covers a dropped connection, not a failed first start).
- Port: fixed at once, `setTimeout(startService, 5000)` (`packages/platform/src/signalr.ts`). Test: `test/core/services.js`, std:signalR.
- Fix: the same in A2v10.Core.

**B33** A2v10.Core `Web/A2v10.Core.Web.Site/Scripts/shell.js:669-670` (the tabbed shell) `_eventModalClose`: when a dialog's `canClose` delegate returns a promise (`canResult.then`), the code calls `result.then`: `result` is what the dialog closes with (`true`, an object), not the delegate's promise.
- Follows: a dialog whose canClose answers with a promise throws TypeError on close and stays open; the promise is never awaited.
- Port: fixed at once, `canResult.then(...)` (`packages/shell-tabbed/src/shell.ts`, `_eventModalClose`).
- Fix: the same in A2v10.Core.

## Wrong behaviour

**B7** `services/datamodel.js:1102` (`$set`), `services/impl/array.js:72` (`$copy`), `:171` (`$empty`), `:274` (`$remove`) check `this.$root.isReadOnly`; no member has that name (the root's is `$readOnly`: `__modelInfo.ReadOnly` or `StateReadOnly`).
- Follows: the checks never stop anything. Read-only only stops dirtiness (`services/datamodel.js:1081`): setters store and emit change events, arrays add and remove.
- Package: done (`model/array.ts`, `model/element.ts`; the controller's `$expand`, `$loadLazy`). Traces: `test/trace/divergences.js` B7 (model: "arrays" `$copy`, "model info" read-only; page: every reload, "$expand: a tree").
- Decided 2026-10-24: read-only is a model state. Reloading from the database is allowed; changing from inside is not. The cut is the load door:
  - `$copy` is the load door (its one caller: `$merge`, `services/datamodel.js:1196`): no check; it empties through `__empty__`, not `$empty`.
  - `$empty`, `$remove`, `$set` check `$readOnly`.
  - The lazy loaders reduce to `$copy`: `controllers/base.js:1418` (tree expand: `$empty()`, then push) and `:1462` (`$loadLazy`: `__empty__()`, then push). The reset before a reload reduces to `__empty__`: `$resetLazy` (`services/impl/array.js:319-325`, `$empty()`).
  - Order: the package first, with scenarios. Net48 is left as it is on purpose: this is a decision, not a forgotten entry.
- Open: property setters and `$append`, `$insert`, `$move` are not in the cut. A check in the setter must let `$merge` through: it writes scalars by the setter (`platform.set`).
- Open: `$copy` renumbers (`$renumberRows`) through the setter, events unlocked: rows loaded without their `$rowNo` value make the model dirty. Net48's `$empty` dirtied it first, which hid this; its tree expand and `$loadLazy` did not renumber.

**B19** `services/impl/array.js:89-95` `$clearSelected` on a nested tree array: `$selected` searches the descendants, so it clears the tree's one selection, and `emitSelect(this, null)` emits on the nested path.
- Follows: `Folders[0].Items.$clearSelected()` leaves the tree with no selection and emits `Folders[].Items[].select(…, null)`; a `Folders[].select` handler (where the applications subscribe) is not told.
- Package: kept (`model/array.ts`). Trace: "tree" `A2.$select(); A.Items.$clearSelected()`.
- Fix: in a tree, emit on the tree root (`$findTreeRoot` of the cleared element), as `$select` does.

**B26** `services/url.js:33` `normalize`: `'' + elem || ''`; the `+` binds first, so `undefined` and `null` become the segments `'undefined'` and `'null'`, never dropped by `combine`'s filter.
- Follows: `combine('/_file', url, undefined)` gives `/_file/<url>/undefined`. `$file(url)` with no argument (`controllers/base.js:734`) asks the server for the file `undefined`.
- Port: kept (`packages/platform/src/url.ts`, `normalize`).
- Net48: fixed 2026-10-24 (`84e0f9ffb`): `elem == null ? '' : '' + elem`, an absent segment dropped. The port follows, then the entry is deleted.

**B27** `services/http.js:95-123` `upload`: the `switch` has cases 200 and 255 only; `doRequest` (`:62-69`) breaks out of 473 when the text is not `Unauthorized`.
- Follows: `upload` on any other status (500, 413, 401) and a request answered 473 otherwise resolve with `undefined`: the caller takes a failure for an empty success. `$upload` returns it to the application.
- Port: kept (`packages/platform/src/http.ts`). Test: `test/core/http.js`, "upload 500", "473 not Unauthorized".
- Net48: half fixed 2026-10-24 (`84e0f9ffb`): `upload` has `default: throw response.statusText` (`:117-118`). `doRequest`'s 473 not `Unauthorized` still breaks out of the switch (`:62-70`) and resolves `undefined`.
- Fix (left): in the 473 branch, `throw response.statusText` after the `Unauthorized` check. The port follows each half as Net48 gets it.

**B29** `components/includeplain.js:204`, `:238` `a2-include` passes `this.hideIndicator` to `http.load`; `hideIndicator` is not among its props (`:142-150`).
- Follows: always undefined: XAML's Include never hides the request indicator, and a `hide-indicator` attribute falls through to the element.
- Port: kept, undefined passed (`packages/platform/src/include.ts`, `a2-include`).
- Net48: fixed 2026-10-24 (`84e0f9ffb`): `hideIndicator: Boolean` declared on `include` (`components/include.js`) and `a2-include` (`includeplain.js`). The port follows, then the entry is deleted.

**B30** `services/http.js:233-248` `queue`/`doQueue` (`a2-queued-include`): a load that rejects leaves the loop with `processing` still true; a load that never settles (401, an empty answer, a login page) holds the loop.
- Follows: after one failed or unanswered queued page, no `a2-queued-include` of the document loads again until the browser page reloads; the rejection is unhandled.
- Port: kept (`packages/platform/src/include.ts`, `doQueue`).
- Net48: half fixed 2026-10-24 (`84e0f9ffb`): `try`/`catch` around the await logs a rejection and goes on (`:247-251`). A load that never settles still holds the loop: `load` returns without resolving or rejecting on an empty answer (`:147-148`), a full page (`:149-152`), a foreign url (`:155-160`) and `__blank__` (401, 473 `Unauthorized`: `:203-204`).
- Fix (left): settle `load` in those branches, or do not await them in the queue. The port follows the rejection half now.

## Questions: what was meant

**Q2** Assigning an element to an object property (`row.Entity = other`) merges `other` into the existing object (`services/datamodel.js:163-166`). The setter then emits no change: the merge emits `<path>.change` only when the id changes (`:1225-1232`), with the object as both new and old value.
- Follows: a handler of `Document.Agent.change` misses an assignment that keeps the id and changes other fields, and never sees the old value.
- Decide: the event an assignment of an element emits, and its arguments.

**Q3** `defaults` for an array element's property (`'Document.Rows[].Qty'`) are ignored: `setDefaults` evaluates the path `'Document.Rows[]'`, gets `''`, skips (`services/datamodel.js:424`). Nothing else reads `defaults`.
- Decide: apply them to new array elements (`$new`), or refuse such keys loudly.
