import chalk from 'chalk';
import checkpoint from '../checkpoint.js';
import conventionalChangelog from 'conventional-changelog';
import fs from 'fs';
import runLifecycleScript from '../run-lifecycle-script.js';
import writeFile from '../write-file.js';
const START_OF_LAST_RELEASE_PATTERN = /(^#.*?[0-9]+\.[0-9]+\.[0-9]+|<a name=)/m;

async function Changelog(args, newVersion) {
	await runLifecycleScript(args, 'prechangelog');
	await outputChangelog(args, newVersion);
	await runLifecycleScript(args, 'postchangelog');
}

Changelog.START_OF_LAST_RELEASE_PATTERN = START_OF_LAST_RELEASE_PATTERN;

export default Changelog;

/**
 * Front matter is only extracted and therefore retained in final output where Changelog "header" begins with #Changelog,
 * e.g. meets Standard-Version (last release) or relow(current) format
 */
function extractFrontMatter(oldContent) {
	const headerStart = oldContent.indexOf('# Changelog');
	return headerStart !== -1 || headerStart !== 0
		? oldContent.substring(0, headerStart)
		: '';
}

/**
 * find the position of the last release and remove header
 */
function extractChangelogBody(oldContent) {
	const oldContentStart = oldContent.search(START_OF_LAST_RELEASE_PATTERN);
	return oldContentStart !== -1
		? oldContent.substring(oldContentStart)
		: oldContent;
}

function outputChangelog(args, newVersion) {
	return new Promise((resolve, reject) => {
		createIfMissing(args);
		const header = args.preset.header;

		const oldContent =
			args.dryRun || args.releaseCount === 0
				? ''
				: fs.readFileSync(args.infile, 'utf-8');

		const oldContentBody = extractChangelogBody(oldContent);

		const changelogFrontMatter = extractFrontMatter(oldContent);

		let content = '';
		const changelogStream = conventionalChangelog(
			{
				preset: args.preset,
				tagPrefix: args.tagPrefix,
				releaseCount: args.releaseCount,
				...(args.verbose
					? {
							debug: console.info.bind(console, 'conventional-recommended-bump'),
						}
					: {}),
			},
			args.context,
			{ merges: null, path: args.path, showSignature: false },
			args.parserOpts,
			args.writerOpts,
		).on('error', function (err) {
			return reject(err);
		});

		changelogStream.on('data', function (buffer) {
			content += buffer.toString();
		});

		changelogStream.on('end', function () {
			checkpoint(args, 'outputting changes to %s', [args.infile]);
			if (args.dryRun)
				console.info(`\n---\n${chalk.gray(content.trim())}\n---\n`);
			else
				writeFile(
					args,
					args.infile,
					changelogFrontMatter +
					header +
					(content + oldContentBody).replace(/\n+$/, '\n'),
				);
			return resolve();
		});
	});
}

function createIfMissing(args) {
	try {
		fs.accessSync(args.infile, fs.F_OK);
	} catch (err) {
		if (err.code === 'ENOENT') {
			checkpoint(args, 'created %s', [args.infile]);
			args.outputUnreleased = true;
			writeFile(args, args.infile, '\n');
		}
	}
}
