// The model core, delivered as one script: <script src="a2v10-model.js"> defines a2v10.model.
// The platform calls a2v10.model.createModel(runtime) once and registers what it returns in
// app.modules['std:…']; the server's page script reaches the model by require('std:datamodel').

import type { Runtime } from './runtime.js';
import { installDateToJson } from './base/json.js';
import { createFormat } from './locale/format.js';
import { createPeriod } from './locale/period.js';
import { createDataModel } from './model/datamodel.js';
import { createRules } from './model/rules.js';
import { createUtils } from './utils.js';

export type { Runtime, Platform, EventBus, Locale, Log } from './runtime.js';

// The modules, by their std:* names: utils → std:utils, period → std:period, validators →
// std:validators, modelInfo → std:modelInfo, datamodel → std:datamodel.
export function createModel(runtime: Runtime) {
	installDateToJson();
	const format = createFormat(runtime.locale);
	const utils = createUtils(format, runtime.platform.File);
	const period = createPeriod(runtime.locale, format);
	const validators = createRules(runtime.eventBus);
	const { datamodel, modelInfo } = createDataModel({
		platform: runtime.platform,
		log: runtime.log,
		format,
		period,
		rules: validators
	});
	return {
		utils,
		period,
		validators,
		modelInfo,
		datamodel
	};
}
