// The host globals the model core may use, and only these: lib has no "DOM" (tsconfig.json).
// Each one must exist in every host: the browser, Node, Jint (there the server host provides them).
// Anything that differs between hosts goes through the runtime (runtime.ts), not here.

declare const console: {
	log(...args: unknown[]): void;
	info(...args: unknown[]): void;
	warn(...args: unknown[]): void;
	error(...args: unknown[]): void;
	dir(...args: unknown[]): void;
};

declare function setTimeout(handler: () => void, timeout?: number): number;
declare function clearTimeout(id: number | null | undefined): void;
