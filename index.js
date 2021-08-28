#!/usr/bin/env node

/**
 * video-duration-cli
 * A CLI to get duration of videos
 *
 * @author Muhammad Yasser <iamrokt.github.io>
 *
 */

import init from "./utils/init.js";
// for dealing with cli arguments
import cli from "./utils/cli.js";
import debugLog from "./utils/log.js";
// import getDuration from "get-video-duration";
import { promisify } from "util";

import globWithCallBacks from "glob";
import chalk from "chalk";
import ora from "ora";
import alert from "cli-alerts";
import { to } from "await-to-js";
import ffmpeg from "fluent-ffmpeg";
const ffprobe = promisify(ffmpeg.ffprobe);
import fss from "fs";
const fs = fss.promises;

const spinner = ora({ text: `` });

const glob = promisify(globWithCallBacks);

const { input, flags } = cli;
const { clear, debug } = flags;

const log = console.log;

const targetExtensions = [
	"mp4",
	"mkv",
	"webm",
	"avi",
	"mov",
	"mp3",
	"wav",
	"m4a",
	"flac",
	"wma",
];
// const videoExtensions = ["webm"];

async function getFilePaths() {
	const dir = process.cwd();
	const extensions = targetExtensions.map((ex) => `.${ex}`).join("|");
	const pattern = `${dir}/**/*@(${extensions})`;

	const files = await glob(pattern);
	// log(files)
	return files;
}

async function getFileDuration(file) {
	try {
		const metadata = await ffprobe(file);
		return parseFloat(metadata.format.duration);
	} catch (e) {
		return null;
	}
}

async function getDuration(files) {
	let totalDuration = 0;
	let succeeded = 0;
	let failed = 0;

	const durations = await Promise.all(files.map(getFileDuration));

	for (const duration of durations) {
		if (duration && !isNaN(duration)) {
			totalDuration += duration;
			succeeded++;
		} else {
			failed++;
		}
	}

	return { succeeded, failed, totalDuration };
}

function formatDuration(duration) {
	// 1 round duration to integer: 416458.971992 -> 416458
	const roundDuration = Math.round(duration);

	// 2 split into hours, minutes and seconds
	const h = Math.trunc(roundDuration / 3600);

	const m =
		h > 0
			? Math.trunc((roundDuration % (h * 3600)) / 60)
			: Math.trunc(roundDuration / 60);

	const s = roundDuration % 60;

	return { h, m, s };
}

function addZeroFormatting(n) {
	return n < 10 ? `0${n}` : n;
}

(async function () {
	await init({ clear });
	input.includes(`help`) && cli.showHelp(0);

	// show loading spinner
	spinner.start(`${chalk.yellow(`CALCULATING`)} in progress...`);

	const [globError, files] = await to(getFilePaths());
	// log(files);
	// durationData = {succeeded, failed, duration}
	const [durationErr, durationData] = await to(getDuration(files));

	// log(duration);

	if (globError || durationErr) {
		spinner.clear();
		console.clear();

		alert({
			type: "error",
			name: "OOPS!",
			// msg: `Couldn't get results! ${
			// 	globError && globError.message.slice(0, globError.message.indexOf(":")) ||
			// 	durationErr && durationErr.message.slice(0, durationErr.message.indexOf(":"))
			// }`,
			msg: globError || durationErr,
		});

		process.exit(0);
	}

	const { h, m, s } = formatDuration(durationData.totalDuration);
	// log(formattedDuration);

	// hide loading spinner
	spinner.stop(`${chalk.yellow(`CALCULATING`)} finished!`);

	log(
		`${chalk.dim.italic(` TOTAL FILES: `)}${chalk.cyan(
			files.length
		)} ${chalk.dim(`files`)}`
	);

	// log();

	if (durationData.failed > 0) {
		log(
			`${chalk.dim(` GOT DURATION FOR: `)}${chalk.green(
				durationData.succeeded
			)} ${chalk.dim(durationData.succeeded > 0 ? `files` : "file")} `
		);

		// log();

		log(
			`${chalk.dim(` FAILED TO GET DURATION FOR: `)}${chalk.red(
				durationData.failed
			)} ${chalk.dim(durationData.failed > 1 ? `files` : `file`)} `
		);
	}

	log();
	log(
		` ${
			// ` TOTAL DURATION of (${durationData.succeeded}) ${
			chalk.bgGreen.bold(` TOTAL DURATION `)
		} (${addZeroFormatting(h)}:${addZeroFormatting(m)}:${addZeroFormatting(s)})`
	);

	log();
	const hours = h > 0 ? `${h} ${chalk.dim(`Hours`)}` : ``;
	const minutes = m > 0 ? `${m} ${chalk.dim(`Minutes`)}` : ``;
	const seconds = s > 0 ? `${s} ${chalk.dim(`Seconds`)}` : ``;
	const positions = [hours !== ``, minutes !== ``, seconds !== ``];

	if (h || m || s) {
		log(
			` ${chalk.bgMagenta.bold(` DESCRIPTION `)}    ${chalk.italic(
				`${hours}${
					positions[0] && (positions[1] || positions[2]) ? `,` : ``
				} ${minutes}${positions[2] ? `,` : ``} ${seconds}`
			)}`
		);
	}

	log();

	debug && debugLog(flags);
})();
