// The shapes of the model as the core sees them. Data members are declared by the server per type
// (VueDataScripter: defineObject), so an element is its hidden fields plus data by name.

// A property's type: a constructor (String, Number, Boolean, Date, the runtime's File, Object, a
// period, an element or array constructor), or { type, len, json } for strings.
export interface PropTypeObject {
	type: Function;
	len?: number;   // the column length: $maxLength
	json?: boolean; // the value is stored as given, not coerced to the type
}
export type PropType = Function | PropTypeObject;

// The metadata of a type (defineObject's second argument): its properties and the special ones.
export interface ElementMeta {
	props: Record<string, PropType>;
	markerProps?: Record<string, any>; // template properties declared as objects (template.ts)
	$id?: string;
	$name?: string;
	$rowNo?: string;
	$hasChildren?: string;
	$permissions?: string;
	$items?: string;    // the children's array of a tree element
	$expanded?: string; // the source field telling a tree element is expanded
	$main?: string;
	$token?: string;
	$group?: boolean;
	$itemType?: ElementCtor; // a map: elements of this type by property ($setProperty)
	$cross?: Record<string, string[]>;
	$lazy?: string[];
}

// The hidden fields of every element (non-enumerable: not data).
export interface Elem {
	readonly _meta_: ElementMeta;
	readonly _path_: string;            // the type path: 'Document.Rows[].Entity'
	readonly _root_: Root;
	readonly _parent_: Elem | ModelArray;
	_errors_: Record<string, any[]> | null;
	_lockEvents_: number;
	[prop: string]: any;
}

export interface Root extends Elem {
	_needValidate_: boolean;
	_enableValidate_: boolean;
	_allErrors_: { x: string, e: any[] }[];
	_host_: Host | null;
	$template: any;
	$dirty: boolean;
}

// What the root's _host_ is: the view model and its controller (the platform sets it after mount).
export interface Host {
	$viewModel: any;
	$ctrl: any;
}

export interface ModelArray extends Array<Elem> {
	readonly _elem_: ElementCtor;
	readonly _path_: string;
	readonly _root_: Root;
	readonly _parent_: Elem;
	[prop: string]: any;
}

export type ElementCtor = (new (source?: any, path?: string, parent?: any) => Elem) & { prototype: any };
export type ArrayCtor = Function;
