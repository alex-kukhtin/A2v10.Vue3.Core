# Defects found in the Net48 client sources

Found while porting the model core to `@a2v10/model` (2026-10). Paths are under `Web/A2v10.Web.Site/app/` of the Net48 A2v10 repository; line numbers as of 2026-10-16 (B19 and the decision of B7: as of 2026-10-24).

Each entry: where, what, what follows from it, what the package does now, the fix proposed or decided. An ID is cited in the package's code and in `test/trace/divergences.js`.

An entry is deleted when done: Net48 and the package agree, and `test/trace/divergences.js` does not cite it. Its history is in git; delete its citations in the code with it. An ID is never reused: the next are B20 and Q4.

The package's rule: a crash is fixed at once; any other defect is kept as Net48 has it until decided here, since an application may depend on it. Deciding: fix it in the package (and in Net48, if it is critical there), add or change the scenario in `test/trace/scenarios.js`, record the divergence in `test/trace/divergences.js`; once Net48 has the fix too, drop the divergence and delete the entry.

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

## Questions: what was meant

**Q2** Assigning an element to an object property (`row.Entity = other`) merges `other` into the existing object (`services/datamodel.js:163-166`). The setter then emits no change: the merge emits `<path>.change` only when the id changes (`:1225-1232`), with the object as both new and old value.
- Follows: a handler of `Document.Agent.change` misses an assignment that keeps the id and changes other fields, and never sees the old value.
- Decide: the event an assignment of an element emits, and its arguments.

**Q3** `defaults` for an array element's property (`'Document.Rows[].Qty'`) are ignored: `setDefaults` evaluates the path `'Document.Rows[]'`, gets `''`, skips (`services/datamodel.js:424`). Nothing else reads `defaults`.
- Decide: apply them to new array elements (`$new`), or refuse such keys loudly.
