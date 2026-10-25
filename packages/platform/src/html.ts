// std:html (Net48 services/html.js), unchanged in behaviour: what the page does with the document beside Vue: open,
// download (a url, a blob), print directly through a hidden frame, pick a file, measure and purge a sheet's table for
// export.

const frameId = 'print-direct-frame';

export function createHtml() {

	return {
		getColumnsWidth,
		getRowHeight,
		downloadBlob,
		downloadUrl,
		openUrl,
		printDirect,
		removePrintFrame,
		updateDocTitle,
		uploadFile,
		purgeTable
	};

	function getColumnsWidth(elem: Element) {
		const cols = elem.getElementsByTagName('col');
		// FF bug fix. Popover does not work inside <td>.
		const body = elem.querySelectorAll('tbody.col-shadow')[0] as HTMLElement;
		body.style.display = 'table-row-group';
		const cells = elem.querySelectorAll('tbody.col-shadow > tr > td');
		const len = Math.min(cols.length, cells.length);
		for (let i = 0; i < len; i++) {
			const w = (cells[i] as HTMLElement).offsetWidth;
			cols[i].setAttribute('data-col-width', '' + w);
		}
		body.style.display = 'none';
	}

	function getRowHeight(elem: Element, padding?: number) {
		const rows = elem.getElementsByTagName('tr');
		for (let r = 0; r < rows.length; r++) {
			const h = rows[r].offsetHeight - (padding || 12); /* padding from css */
			rows[r].setAttribute('data-row-height', '' + h);
		}
	}

	function hiddenLink(url: string): HTMLAnchorElement {
		const link = document.createElement('a');
		link.style.display = 'none';
		document.body.appendChild(link); // FF!
		link.href = url;
		return link;
	}

	function openUrl(url: string) {
		const link = hiddenLink(url);
		link.setAttribute('target', '_blank');
		link.click();
		document.body.removeChild(link);
	}

	function downloadUrl(url: string) {
		const link = hiddenLink(url);
		link.setAttribute('download', '');
		link.click();
		document.body.removeChild(link);
	}

	function downloadBlob(blob: Blob, fileName?: string, format?: string) {
		const objUrl = URL.createObjectURL(blob);
		const link = hiddenLink(objUrl);
		let downloadFile = fileName || 'file';
		format = (format || '').toLowerCase();
		if (format === 'excel')
			downloadFile += '.xlsx';
		else if (format === 'pdf')
			downloadFile += '.pdf';
		link.download = downloadFile;
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(objUrl);
	}

	function printDirect(url: string) {
		if ((window as any).cefHost || navigator.userAgent.toLowerCase().indexOf('firefox') > -1) {
			window.open(url);
			return;
		}
		removePrintFrame();
		const frame = document.createElement('iframe');
		document.body.classList.add('waiting');
		frame.id = frameId;
		frame.style.cssText = 'display:none;width:0;height:0;border:none;position:absolute;left:-10000,top:-100000';
		document.body.appendChild(frame);
		if (document.activeElement)
			(document.activeElement as HTMLElement).blur();
		frame.setAttribute('src', url);

		frame.onload = function () {
			const cw = frame.contentWindow!;
			if (cw.document.body) {
				const finp = cw.document.createElement('input');
				finp.setAttribute('id', 'dummy-focus');
				finp.style.cssText = 'width:0;height:0;border:none;position:absolute;left:-10000,top:-100000';
				cw.document.body.appendChild(finp);
				finp.focus();
				cw.document.body.removeChild(finp);
			}
			document.body.classList.remove('waiting');
			cw.print();
		};
	}

	// the frame element (Net48 took window.frames[id], the frame's window, and removeChild threw: B34)
	function removePrintFrame() {
		const frame = document.getElementById(frameId);
		if (frame)
			document.body.removeChild(frame);
	}

	function updateDocTitle(title: string) {
		if (document.title === title)
			return;
		document.title = title;
	}

	function uploadFile(accept?: string): Promise<File> {
		return new Promise(function (resolve) {
			const input = document.createElement('input');
			input.setAttribute('type', 'file');
			if (accept)
				input.setAttribute('accept', accept);
			input.style.display = 'none';
			input.addEventListener('change', ev => {
				resolve((ev.target as HTMLInputElement).files![0]);
			});
			document.body.appendChild(input); // FF!
			input.click();
			document.body.removeChild(input);
		});
	}
}

// A sheet's table for export: no titles; a popover's or a dropdown's cell keeps its first element's text.
function purgeTable(tbl: Element): Element {
	const node = tbl.cloneNode(true) as Element;
	for (const td of node.getElementsByTagName('TD')) {
		if (!td.childNodes.length) continue;
		td.removeAttribute('title');
		const qs = td.querySelector('.popover-wrapper, .hlink-dd-wrapper');
		if (!qs) continue;
		if (!qs.childNodes.length) continue;
		for (const c of qs.childNodes) {
			if (c.nodeType != c.ELEMENT_NODE) continue;
			(td as HTMLElement).innerText = (c as HTMLElement).innerText;
			break;
		}
	}
	return node;
}
