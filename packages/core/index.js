// The shelves every A2v10 page stands on, as one script: <script src="a2v10-core.js"> defines a2v10.model and
// a2v10.platform, and registers the primitives. A file is a unit of choice: these are never chosen apart; a
// shell and an engine are their own files.

export * as model from '@a2v10/model';
export * as platform from '@a2v10/platform';
import '@a2v10/primitives';
