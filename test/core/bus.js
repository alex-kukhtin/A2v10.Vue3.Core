// std:eventBus of the built core: Vue 2's $on/$off/$emit (webvue.js: new Vue({})), and a subscription made
// inside an effect scope released with the scope.
// Run: node test/core/bus.js (after pnpm build)

'use strict';

const assert = require('assert');
const { loadCore } = require('./load.js');

(async function () {
	const { ctx, errors } = loadCore('a2v10-core.js');
	const bus = ctx.require('std:eventBus');
	const { effectScope } = ctx.a2v10.platform.Vue;

	let log = [];
	const a = x => log.push(`a${x}`);
	const b = x => log.push(`b${x}`);

	// $on, $emit; an array of events
	assert.strictEqual(bus.$on('e', a), bus, '$on returns the bus');
	bus.$on(['e', 'f'], b);
	bus.$emit('e', 1);
	bus.$emit('f', 2);
	bus.$emit('none', 3);
	assert.deepStrictEqual(log, ['a1', 'b1', 'b2'], 'in subscription order');

	// $off: the handler's last subscription; the event; all
	log = [];
	bus.$on('e', a);
	bus.$off('e', a);
	bus.$emit('e', 1);
	assert.deepStrictEqual(log, ['a1', 'b1'], '$off(e, fn): one subscription, the last');
	log = [];
	bus.$off('e');
	bus.$emit('e', 1);
	bus.$emit('f', 2);
	assert.deepStrictEqual(log, ['b2'], '$off(e): all of e');
	log = [];
	bus.$off();
	bus.$emit('f', 2);
	assert.deepStrictEqual(log, [], '$off(): all');

	// a handler's throw and its promise's rejection: logged, the others run
	log = [];
	bus.$on('g', () => { throw new Error('boom'); });
	bus.$on('g', async () => { throw new Error('async boom'); });
	bus.$on('g', x => log.push(`after${x}`));
	bus.$emit('g', 1);
	await null;
	await null;
	assert.deepStrictEqual(log, ['after1'], 'the others run');
	assert.deepStrictEqual(errors, ['Error in event handler for "g": Error: boom',
		'Error in event handler for "g": Error: async boom'], 'logged as Vue 2 does');
	bus.$off('g');

	// a scope: its subscriptions go with it; another owner's subscription of the same function stays
	log = [];
	bus.$on('h', a);
	const scope = effectScope();
	scope.run(() => {
		bus.$on('h', a);
		bus.$on(['h', 'i'], b);
	});
	bus.$emit('h', 1);
	assert.deepStrictEqual(log, ['a1', 'a1', 'b1'], 'inside and outside the scope');
	log = [];
	scope.stop();
	bus.$emit('h', 2);
	bus.$emit('i', 3);
	assert.deepStrictEqual(log, ['a2'], 'scope stopped: its own released, the outside one kept');

	// a scope's subscription already taken off by hand: the stop does not touch another's
	log = [];
	const scope2 = effectScope();
	scope2.run(() => bus.$on('h', b));
	bus.$off('h', b);
	scope2.stop();
	bus.$emit('h', 4);
	assert.deepStrictEqual(log, ['a4'], 'manual $off, then stop');

	console.log('std:eventBus: $on/$off/$emit as Vue 2; errors logged; a scope releases its own subscriptions');
})().catch(e => {
	console.error(e);
	process.exitCode = 1;
});
