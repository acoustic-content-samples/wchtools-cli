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
const request = require('request');
const program = require('commander');
const colors = require('colors');

const status = require('./lib/status');
const commands = require('./commands')(program);
const packageJson = require('./package.json');
const toolsApi = require("wchtools-api");
const utils = toolsApi.utils;
const i18n = utils.getI18N(__dirname, ".json", "en");

program.LOG_PATH = process.cwd() + '/.cli-log';

// Initialize cli options
program
	.version(packageJson.version)
	.usage('<command> [options]')
	.option('-d, --debug', i18n.__('cli_opt_debug'));

// Turn off colors when non-interactive
colors.mode = process.stdout.isTTY ? colors.mode : 'none';

// Define a utility function for console.log(), so that only one line has to be excluded from the Sonar analysis.
const displayToConsole = function (message) {
    console.log(message); // NOSONAR
};

// Setup logging and messaging
const logMessages = [];
program.log = (function (debugMode) {
    if(debugMode)
        utils.setLoggerLevel(utils.apisLog, 'DEBUG');
	return function (logEntry) {
		logMessages.push(logEntry);
		if (debugMode) {
            displayToConsole('--debug-- '.cyan + logEntry);
		}
	};
})(process.argv.indexOf('--debug') >= 0 ||
   process.argv.indexOf('-d') >= 0);

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

/**
 * Display any errors that occurred during initialization.
 *
 * @returns {Array} An array of initialization errors, or null if there were no errors.
 */
program.displayInitializationErrors = function () {
    // Get the initialization errors from the tools API. (For now this is the only source of initialization errors.)
    const errors = toolsApi.getInitializationErrors();
    if (errors && errors.length > 0) {
        // There was one or more errors, so send each one to the errorMessage method.
        errors.forEach(function (error, index) {
            program.errorMessage(error.message);

            // If this is not the final error to be displayed, add an empty line for separation.
            if (index < errors.length - 1) {
                program.errorMessage("");
            }
        });
        return errors;
    }
    return null;
};

// Create request wrapper
program.request = function (opts, next) {
    /*istanbul ignore next*/
    if (program.debug) {
        program.log('REQUEST: '.bold + JSON.stringify(opts, null, 2));
    } else {
  	    program.log(opts.uri);
    }

    /*istanbul ignore next*/
    status.start();

    /*istanbul ignore next*/
    return request(opts, function (err, res, body) {
        status.stop();
        if (err) {
            if (program.debug) {
                program.errorMessage(err.message);
            }
            return next(err, res, body);
        } else {
            if (program.debug) {
                program.log('RESPONSE: '.bold + JSON.stringify(res.headers, null, 2));
                program.log('BODY: '.bold + JSON.stringify(res.body, null, 2));
            }
            return next(err, res, body);
        }
    });
};

program.on('*', function() {
    displayToConsole('Unknown Command: ' + program.args.join(' '));
	program.help();
});

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

    const errors = program.displayInitializationErrors();
    if (errors && errors.length > 0) {
        // There were initialization errors, so the returned promise should be rejected.
        let error;
        if (errors.length === 1) {
            // There was a single error.
            error = errors[0];
        } else {
            // There were multiple errors, so combine their messages into a single error.
            let message = "";
            errors.forEach(function (error, index) {
                if (index === 0) {
                    message = error.message;
                } else {
                    message = message + "\n\n" + error.message;
                }
            });
            error = new Error(message);
        }
        deferred.reject(error);
    } else {
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
    }

    // Return the promise for this command.
    return deferred.promise;
};

module.exports =  {
    program: program,
    parseArgs: parseArgs
};
