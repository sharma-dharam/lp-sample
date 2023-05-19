const path = require('path');

const { series, src, dest, watch } = require('gulp');
const clean = require('gulp-clean');
const gulpif = require('gulp-if');

// For CSS
const sass = require('gulp-sass')(require('sass'));

// For JavaScript
const uglify = require('gulp-uglify');
const javascriptObfuscator = require('gulp-javascript-obfuscator');

// For HTML
const cheerio = require('gulp-cheerio');
const htmlmin = require('gulp-htmlmin');

// For Development
const browserSync = require('browser-sync').create();

// Build Config
const buildConfig = require('./build.config');

// Prepare environment
const { paths, css: cssConfig, js: jsConfig } = buildConfig;

paths.src = path.resolve(paths.src);
paths.build = path.resolve(paths.build);

const streams = { css: null, js: null, html: null };

const outputStyles = [];
const outputScripts = [];

const env = { dev: false };

function buildHtml() {
	//
	streams.html = src(paths.src + '/index.html')
		.pipe(
			cheerio(function ($, htmlFile, done) {
				//
				$('head').append(outputStyles.join('\n'));
				$('body').append(outputScripts.join('\n'));

				done();
			})
		)
		.pipe(
			gulpif(
				env.dev === false,
				htmlmin({
					collapseWhitespace: true,
					minifyCSS: cssConfig.minify,
				})
			)
		)
		.pipe(dest(paths.build));

	return streams.html;
}

function buildJs() {
	//
	outputScripts.length = 0;

	streams.js = src(paths.src + '/js/*.js')
		//
		.pipe(gulpif(env.dev === false && jsConfig.uglify, uglify()))
		//
		.pipe(gulpif(env.dev === false && jsConfig.obfuscate, javascriptObfuscator()))
		//
		.pipe(gulpif(env.dev, dest(paths.build + '/js')))
		//
		.on('data', function (file) {
			outputScripts.push(
				env.dev
					? `<script src="${path.relative(paths.build, file.path)}"></script>`
					: `<script>${file.contents.toString()}</script>`
			);
		});

	return streams.js;
}

function buildCss() {
	//
	outputStyles.length = 0;

	streams.css = src(paths.src + '/scss/*.scss')
		.pipe(sass())
		.pipe(gulpif(env.dev, dest(paths.build + '/css')))
		.on('data', function (file) {
			outputScripts.push(
				env.dev
					? `<link rel="stylesheet" href="${path.relative(paths.build, file.path)}">`
					: `<style>${file.contents.toString()}</style>`
			);
		});

	return streams.css;
}

function cleanOldBuild(cb) {
	//
	return src(paths.build, { read: false }).pipe(clean());
}

function serve(cb) {
	//
	const port = 8000;
	//
	browserSync.init({ server: paths.build, port }, function () {
		//
		console.log(`Development server started at port ${8000}`);
		cb();
	});
}

function watchChanges(cb) {
	//
	env.dev = true;

	watch(paths.src + '/scss/*.scss', function rebuildCss(watchCssCallback) {
		//
		buildCss().pipe(browserSync.stream());
		watchCssCallback();
	});

	watch(paths.src + '/js/*.js', function rebuildJs(watchJsCallback) {
		//
		buildJs().on('end', browserSync.reload);
		watchJsCallback();
	});

	watch(paths.src + '/index.html', function rebuildHtml(watchHtmlCallback) {
		//
		buildHtml().on('end', browserSync.reload);
		watchHtmlCallback();
	});

	cb();
}

const build = series(cleanOldBuild, buildCss, buildJs, buildHtml);

exports.build = build;
exports.dev = series(watchChanges, build, serve);
