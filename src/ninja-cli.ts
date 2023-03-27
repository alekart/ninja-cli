#!/usr/bin/env node
import { Ninja } from './ninja.class';
import { existsSync } from 'fs';
import { Extractor } from './extract-i18n';

// TODO: use YARGS properly to create good cli
const yargs = require('yargs').argv;

const command = yargs._[0];
let project = yargs._[1];

// TODO: use YARGS properly to create good cli
if (yargs._.length === 0 || command === 'help') {
  console.log('NO COMMANDS >>> DISPLAY HELP');
  process.exit(0);
}

const configPath = Ninja.ninjaPath('ninja.config.json');
if (!existsSync(configPath)) {
  Ninja.log('Not a Ninja project.');
  process.exit(1);
}

// TODO: make config validation, must have a JSON Schema
const ninjaConfig = require(configPath);

const knownCommands = ['build', 'serve', 'i18n-extract', 'help'];
const knownProjects = Object.keys(ninjaConfig.projects);
const knownParameters = ['c', 'configuration'];

const server = command === 'serve';
// TODO: use YARGS properly to create good cli
const configNames = yargs.c || yargs.configuration;
const configurations = configNames ? configNames.split(',') : [];

if (!knownCommands.includes(command)) {
  Ninja.error(`The specified command ("${command}") is invalid. For a list of available options, run "ninja".`);
  process.exit(1);
}

if (!project) {
  project = ninjaConfig.defaultProject;
} else if (!knownProjects.includes(project)) {
  Ninja.error(`Unknown project "${project}".`);
}

if(command === 'build' || command === 'serve') {
  if (server) {
    serveCmd();
  } else {
    buildCmd();
  }
}

if(command === 'i18n-extract') {
  i18nExtractCmd();
}

function serveCmd() {
  const ninja = new Ninja(ninjaConfig, project, { configurations, server });
  ninja.serve();
}

function buildCmd() {
  const ninja = new Ninja(ninjaConfig, project, { configurations, server });
  ninja.build();
}

function i18nExtractCmd() {
  const ninja = new Ninja(ninjaConfig, project);
  const extractor = new Extractor(ninja);

  extractor.extract();
}
