// std:http of the built core against a scripted fetch: what a request emits on the bus (beginRequest,
// endRequest, checkVersion), what it resolves with, what it throws (the text of a 255, '__blank__' on 401).
// Run: node test/core/http.js (after pnpm build)

'use strict';

const assert = require('assert');
const { loadCore } = require('./load.js');

(async function () {
	let reply = null;
	const requests = [];
	const navigations = [];
	const { ctx } = loadCore('a2v10-core.js', {
		fetch: (url, init) => {
			requests.push(`${init.method} ${url}`);
			return reply instanceof Error ? Promise.reject(reply) : Promise.resolve(reply);
		},
		location: { assign: url => navigations.push(url) }
	});
	const http = ctx.require('std:http');
	const bus = ctx.require('std:eventBus');
	const events = [];
	for (const e of ['beginRequest', 'endRequest', 'checkVersion'])
		bus.$on(e, arg => events.push(`${e} ${JSON.stringify(arg)}`));

	const json = (body, status = 200, headers = {}) =>
		new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
	const text = (body, status = 200) => new Response(body, { status, headers: { 'content-type': 'text/plain' } });
	const caught = p => p.then(v => ({ value: v }), e => ({ thrown: e }));

	assert.deepStrictEqual(Object.keys(http).sort(), ['get', 'localpost', 'post', 'upload'], 'no load, no queue');

	// 200: json, text, raw; the bus around it, checkVersion from the headers
	reply = json({ A: 1 }, 200, { 'app-version': '7' });
	assert.deepStrictEqual(await http.post('/_data/reload', '{}'), { A: 1 });
	assert.deepStrictEqual(events, ['beginRequest "/_data/reload"', 'endRequest "/_data/reload"',
		'checkVersion {"app":"7","module":""}'], 'begin, end, checkVersion');
	reply = text('plain');
	assert.strictEqual(await http.get('/x'), 'plain');
	reply = text('blob');
	assert.strictEqual(typeof (await http.get('/x', true)).arrayBuffer, 'function', 'raw: a blob');

	// skipEvents: no bus
	events.length = 0;
	reply = text('quiet');
	await http.post('/x', null, false, true);
	assert.deepStrictEqual(events, [], 'skipEvents');

	// refusals
	reply = text('UI:Refused', 255);
	assert.deepStrictEqual(await caught(http.post('/x', null)), { thrown: 'UI:Refused' }, '255: the text');
	reply = new Response('', { status: 500, statusText: 'Server Error' });
	assert.deepStrictEqual(await caught(http.post('/x', null)), { thrown: 'Server Error' }, 'else: statusText');
	reply = new Response('', { status: 401 });
	assert.deepStrictEqual(await caught(http.get('/x')), { thrown: '__blank__' }, '401: handled');
	await new Promise(r => setTimeout(r, 20));
	assert.deepStrictEqual(navigations, ['/'], '401: to the login page');
	reply = new Response('Other', { status: 473 });
	assert.deepStrictEqual(await caught(http.get('/x')), { value: undefined }, '473 not Unauthorized: undefined (Net48)');
	events.length = 0;
	reply = new Error('fetch failed');
	assert.strictEqual((await caught(http.get('/x'))).thrown.message, 'fetch failed', 'network: the fetch error');
	assert.deepStrictEqual(events, ['beginRequest "/x"', 'endRequest "/x"'], 'network: endRequest still');

	// upload: 200, 255, else undefined
	reply = json({ Id: 1 });
	assert.deepStrictEqual(await http.upload('/_file/x', null), { Id: 1 });
	reply = text('UI:Too big', 255);
	assert.deepStrictEqual(await caught(http.upload('/_file/x', null)), { thrown: 'UI:Too big' });
	reply = new Response('', { status: 500 });
	assert.deepStrictEqual(await caught(http.upload('/_file/x', null)), { value: undefined }, 'upload 500: undefined (Net48)');

	console.log('std:http: get, post, upload as Net48; bus events; refusals as text, 401 as __blank__');
})().catch(e => {
	console.error(e);
	process.exitCode = 1;
});
