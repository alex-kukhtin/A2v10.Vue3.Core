// Dotted paths over objects. Pure.

// The last segment: 'Document.Rows[].Qty' → 'Qty'.
export function propFromPath(path: string): string {
	if (!path)
		return '';
	return path.substring(path.lastIndexOf('.') + 1);
}

// The value at a dotted path; '' when a segment is missing.
export function simpleEval(obj: any, path: string): any {
	if (!path || !obj)
		return '';
	let r = obj;
	for (const p of path.split('.')) {
		if (!(p in r))
			return '';
		r = r[p];
	}
	return r;
}
