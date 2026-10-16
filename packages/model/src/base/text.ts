// Text helpers. Pure.

export function contains(text: unknown, probe: string): boolean {
	if (!probe)
		return true;
	if (!text)
		return false;
	return (text || '').toString().toLowerCase().indexOf(probe.toLowerCase()) !== -1;
}

// Any of the comma-separated props of obj contains probe.
export function containsText(obj: any, props: string, probe: string): boolean {
	if (!probe) return true;
	if (!obj)
		return false;
	for (const v of props.split(',')) {
		if (contains(obj[v], probe))
			return true;
	}
	return false;
}

// Removes <script> and <iframe> elements.
export function sanitize(text: unknown): string {
	const t = '' + text || '';
	return t.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
		.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
}

// 'A.B.C' → { obj: 'A.B', prop: 'C' }.
export function splitPath(path: string): { obj: string, prop: string } {
	const propIx = path.lastIndexOf('.');
	return {
		obj: path.substring(0, propIx),
		prop: path.substring(propIx + 1)
	};
}

export function capitalize(text: string): string {
	if (!text) return '';
	return text.charAt(0).toUpperCase() + text.slice(1);
}

// At most length chars; a cut text ends with an ellipsis.
export function maxChars(text: unknown, length: number): unknown {
	if (!text) return text;
	const t = '' + text || '';
	if (t.length < length)
		return t;
	return t.substring(0, length - 1) + '…';
}

export function equalNoCase(s1: string, s2: string): boolean {
	return (s1 || '').toLowerCase() === (s2 || '').toLowerCase();
}
