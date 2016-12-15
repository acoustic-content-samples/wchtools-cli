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
const status = require('./lib/status');
const request = require('request');
const program = require('commander');
const commands = require('./commands')(program);
const packageJson = require('./package.json');
const utils = require("dxauthoringapi").utils;
var i18n = utils.getI18N(__dirname, ".json", "en");

program.LOG_PATH = process.cwd() + '/.cli-log';

// Initialize cli options
program
	.version(packageJson.version)
	.usage('<command> [options]')
	.option('-d, --debug', i18n.__('cli_opt_debug'));

// Turn off colors when non-interactive
const colors = require('colors');
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

program.errorMessage = function () {
	const msg = util.format.apply(this, arguments);
    displayToConsole(msg.red);
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

module.exports =  {
    program: program,
    parseArgs: function (argv) {
        const Q = require('q');
        const deferred = Q.defer();
        program.successMessage = function (msg) {
            program.successMessageSave(msg);
            deferred.resolve('Success: ' +msg);
        };
        program.errorMessage = function (msg) {
            program.errorMessageSave(msg);
            deferred.reject(msg);
        };
        program.parse(argv);
        return deferred.promise;
    }
};
