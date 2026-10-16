// The names of the events the model emits to the template (template.events). Applications handle
// them by these names: this is the contract, and the only place a name is made.
// path: an element's type path ('Document.Rows[]'); the root's is '' and reads 'Root' in a name.

export const events = {
	// a property is about to change; the handler returns false to cancel
	changing: (path: string, prop: string) => `${path || 'Root'}.${prop}.changing`,
	// a property changed
	change: (path: string, prop: string) => `${path || 'Root'}.${prop}.change`,
	// an element merged into an object property got another id
	elementChange: (path: string) => `${path}.change`,
	// an element or an array of this type was constructed
	construct: (typeName: string) => `${typeName}.construct`,
	// array events, by the array's path: adding may return false to cancel
	adding: (arrayPath: string) => `${arrayPath}[].adding`,
	add: (arrayPath: string) => `${arrayPath}[].add`,
	remove: (arrayPath: string) => `${arrayPath}[].remove`,
	select: (arrayPath: string) => `${arrayPath}[].select`,
	check: (arrayPath: string) => `${arrayPath}[].check`,
	arrayChange: (arrayPath: string) => `${arrayPath}[].change`,
	// the model's lifecycle
	load: 'Model.load',
	unload: 'Model.unload',
	defaults: 'Model.defaults',
	dirtyChange: 'Model.dirty.change',
	// application-wide events, relayed by the platform
	globalPeriodChange: 'GlobalPeriod.change',
	signal: (event: string) => `Signal.${event}`
} as const;
