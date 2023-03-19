#!/usr/bin/env node

import { Ninja } from './ninja.class';
import { existsSync } from 'fs';

const yargs = require('yargs').argv;

const command = yargs._[0];
let project = yargs._[1];


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

const knownCommands = ['build', 'serve', 'help'];
const knownProjects = Object.keys(ninjaConfig.projects);
const knownParameters = ['c', 'configuration'];

const server = command === 'serve';
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

Ninja.log(`command: ${command}, project: ${project}`);

const ninjaCli = new Ninja(ninjaConfig, project, { configurations, server });

if (server) {
  ninjaCli.serve();
} else {
  ninjaCli.build();
}
