#!/usr/bin/env node

import relow from '../src/index.js';
import cmdParser from '../src/commands.js';

relow(cmdParser.argv).catch((err) => {
	console.error(err);
	process.exit(1);
});
