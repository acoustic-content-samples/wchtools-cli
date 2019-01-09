/*
Copyright 2016 IBM Corporation

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
"use strict";

const fs = require('fs');
const util = require('util');
const Q = require('q');
Q.longStackSupport = true;
const program = require('commander');
const colors = require('colors');

const commands = require('./commands')(program);
const packageJson = require('./package.json');
const ToolsApi = require("wchtools-api");
const utils = ToolsApi.getUtils();
const i18n = utils.getI18N(__dirname, ".json", "en");
const spinner = require("ora")();

program.LOG_PATH = process.cwd() + '/.cli-log';

// Initialize cli options
program
	.version(packageJson.version)
	.usage('<command> [options]')
	.option('-d, --debug', i18n.__('cli_opt_debug'));

// Turn off colors when non-interactive
/* istanbul ignore next */
colors.enabled = process.stdout.isTTY ? true : false; // NOSONAR

// Define a utility function for console.log(), so that only one line has to be excluded from the Sonar analysis.
const displayToConsole = function (message) {
    console.log(message); // NOSONAR
};

program.debugMessage = function () {
    const msg = util.format.apply(this, arguments);
    displayToConsole(msg.cyan);
};

program.successMessage = function () {
	const msg = util.format.apply(this, arguments);
    displayToConsole(msg.green);
};

program.warningMessage = function () {
    const msg = util.format.apply(this, arguments);
    displayToConsole(msg.yellow);
};

program.errorMessage = function () {
	const msg = util.format.apply(this, arguments);
    displayToConsole(msg.red);
};

/* istanbul ignore next */
program.on('command:*', function () {
    program.outputHelp(); // NOSONAR
    program.errorMessage('Unknown Command: ' + program.args.join(' ')); // NOSONAR
});

program.getSpinner = function(){
    return spinner;
};

program.successMessageSave = program.successMessage;
program.errorMessageSave = program.errorMessage;

/**
 * Execute the given command using the specified arguments.
 *
 * @param {Array} argv An array of arguments including the command to be executed.
 *
 * @returns {Q.Promise} A promise to parse the given arguments and execute the included command.
 */
const parseArgs = function (argv) {
    // Create a promise for this command.
    const deferred = Q.defer();

    // Override the successMessage method to resolve the promise.
    program.successMessage = function (msg) {
        program.successMessageSave(msg);
        deferred.resolve(i18n.__("cli_success_message", {"message": msg}));
    };

    // Override the errorMessage method to reject the promise.
    program.errorMessage = function (msg) {
        program.errorMessageSave(msg);
        deferred.reject(new Error(msg));
    };

    // Execute the command (asynchronously).
    program.parse(argv);

    // Return the promise for this command.
    return deferred.promise;
};

module.exports =  {
    program: program,
    parseArgs: parseArgs
};
