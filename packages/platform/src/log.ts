// std:log and std:console (Net48 services/log.js), unchanged in behaviour. std:log traces when tracing is on
// (kept in sessionStorage, switched only in debug); its errors always go out. std:console speaks in debug only.

export function createLog() {
	let _traceEnabled = false;
	let _sessionLoaded = false;
	const traceEnabledKey = 'traceEnabled';

	return {
		info,
		warn: warning,
		error,
		time: countTime,
		traceEnabled(): boolean {
			if (!_sessionLoaded)
				loadSession();
			return _traceEnabled;
		},
		enableTrace(val: boolean): void {
			if (!window.$$debug) return;
			_traceEnabled = val;
			console.warn('tracing is ' + (_traceEnabled ? 'enabled' : 'disabled'));
			try {
				window.sessionStorage.setItem(traceEnabledKey, '' + val);
			}
			catch (err) {
				// do nothing
			}
		}
	};

	function info(msg: unknown): void {
		if (!_traceEnabled) return;
		console.info(msg);
	}

	function warning(msg: unknown): void {
		if (!_traceEnabled) return;
		console.warn(msg);
	}

	function error(msg: unknown): void {
		console.error(msg); // always
	}

	function countTime(msg: string, start: number, enable?: boolean): void {
		if (!_traceEnabled && !enable) return;
		console.warn(msg + ' ' + (performance.now() - start).toFixed(2) + ' ms');
	}

	function loadSession(): void {
		const te = window.sessionStorage.getItem(traceEnabledKey);
		if (te !== null) {
			_traceEnabled = te === 'true';
			if (_traceEnabled)
				console.warn('tracing is enabled');
		}
		_sessionLoaded = true;
	}
}

export function createConsole() {
	return {
		log(...args: unknown[]): void {
			if (window.$$debug)
				console.log(...args);
		},
		dir(...args: unknown[]): void {
			if (window.$$debug)
				console.dir(...args);
		},
		info(...args: unknown[]): void {
			if (window.$$debug)
				console.info(...args);
		},
		error(...args: unknown[]): void {
			if (window.$$debug)
				console.error(...args);
		},
		warn(...args: unknown[]): void {
			if (window.$$debug)
				console.warn(...args);
		}
	};
}
