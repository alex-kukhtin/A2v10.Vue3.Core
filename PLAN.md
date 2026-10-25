# Plan

Work decided but not started. A section is done only when it says so.

## The 1C dialect (decided 2026-10-25, not started)

Goal: an application converted from 1C (`D:\CLAUDE\from1c`: BAS Бухгалтерія КОРП 2.1, the «Такси» interface → a2v10meta `metadata.json`) behaves as its users know from 1C. The conversion is done there; this is UI only. The habits live in the table and the reference field.

Decided:
- A few controls in the current Vue 3 bundle (`packages/xaml`), ported by this repository's rules: one table, `DataSheet` (the component `data-sheet`, as `data-grid` and `tree-grid`), and two selectors. Their XAML elements in `A2v10.Xaml`; the shell is `shell-tabbed`, unchanged.

`DataSheet` — named after Access's and SharePoint's datasheet view (records as cells, moved through and edited in place, Excel style); one control for lists and table parts, as in 1C: Form.xml has one `<Table>` for both (`Список` over a dynamic list, `Товары` over `Объект.Товары`); they differ by data and properties, not by type.
- The cursor is a cell: arrows move it, the row is highlighted. A row mode is a property (1C `RowSelectionMode=Row`: 90 of 2 174 tables in BAS КОРП).
- One row height for the whole table, as in 1C (`AutoCellHeight`: 62 fields in BAS КОРП). The scroll position, the cell under the pointer and the page size are arithmetic: row = `pos + floor((y − header) / h)`. The auto height: not now.
- Scrolls by rows and columns, not pixels (Excel style): the wheel moves whole rows, the own scrollbar counts rows, only the visible rows render; the header and the first columns can be frozen.
- Two modes:
  - a table part: the cell edits in place; Enter edits / moves to the next cell; F4 choice in the cell; Ins adds a row (and a new row appears as one types past the last, 1C `AutoInsertNewRow`); F9 copies the row; Del deletes it;
  - a list: Enter opens the object's form; Ins new, F9 copy, Del mark for deletion; typing searches by the current column.
- The row picture is a property bound to a row's property (1C `RowPictureDataPath`: `Список.DefaultPicture` 611, `Список.СостояниеДокумента` 132 in BAS КОРП); posted / not posted / marked for deletion is one use of it. Own icons: 1C's picture library is not copied.
- The data source is the model's array either way: a list is a page of rows, the pager stands beside it (`Pager` in `FormMetadata`). No keyset: the pager is clearer. A list opens on its last page, the newest at the bottom.

The core under it, in `packages/primitives`: the scroll window by rows and columns, the cursor, the keys, the edit over a cell. Written anew, not ported: `C:\A2v10_Net6\A2v10.SpreadSheet` (Vue 2) is not debugged yet and is only the model of the approach — the scroll position as a row index, the scrollbar counted in rows (`min / max / pos / page`), the frozen rows and columns, the edit over a cell. Its position math walks the rows from the scroll position (O(n) per call); the core's is arithmetic. Its data (a sparse `Cells["A1"]` map, spans, styles, a height per row) stays its own: the table is not built on the sheet through an adapter. The SpreadSheet may later sit on the same core; then the core takes a height per row too, the table keeps the arithmetic path.

The selectors:
- input by string (code, name); the choice history; «Показать все» opens the choice form;
- F4 choose, Shift+F4 clear.

The requirement to Core (to CORE-VUE3.md when written): `XamlBuilder` emits the table instead of `DataGrid` in lists and instead of the standard table in table parts, and the selectors instead of the standard one, when the application asks by a key in `app.json` (next to `platformid`). A converted application gets the dialect whole, no form declared by hand.

Open:
- the key's name and values;
- what the two selectors are, each;
- Del as mark for deletion: a state a2v10meta has, or a new platform semantic (then not a UI question).
