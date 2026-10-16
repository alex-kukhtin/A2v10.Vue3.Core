// std:datamodel and std:modelInfo, wired from the model's modules. std:datamodel is what the
// server's page script calls (VueDataScripter): createObject, defineObject, createArray,
// implementRoot, setModelInfo; enumData walks validator keys.

import { createArrays } from './array.js';
import type { ModelContext } from './context.js';
import { createElements } from './element.js';
import { createModelInfo } from './modelinfo.js';
import { createRoots } from './root.js';
import { createTemplate } from './template.js';
import { createValidation, enumData } from './validate.js';

export function createDataModel(ctx: ModelContext) {
	const tpl = createTemplate(ctx);
	const validation = createValidation(ctx);
	const modelInfo = createModelInfo(ctx.period);
	const arrays = createArrays(ctx, tpl);
	const roots = createRoots(ctx, tpl, validation, modelInfo);
	const elements = createElements(ctx, tpl, validation, arrays, roots);
	return {
		modelInfo,
		datamodel: {
			createObject: elements.createObject,
			createArray: arrays.createArray,
			defineObject: elements.defineObject,
			implementRoot: roots.implementRoot,
			setModelInfo: modelInfo.setModelInfo,
			enumData
		}
	};
}
