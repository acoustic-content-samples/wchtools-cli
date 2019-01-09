/*
Copyright IBM Corporation 2018

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

const BaseCommand = require("../lib/baseCommand");

const ToolsApi = require("wchtools-api");
const utils = ToolsApi.getUtils();
const i18n = utils.getI18N(__dirname, ".json", "en");

class ClearCommand extends BaseCommand {
    /**
     * Create a ClearCommand object.
     *
     * @param {object} program A Commander program object.
     */
    constructor (program) {
        super(program);
    }

    /**
     * Execute the clear
     */
    doClear () {
        // Create the context for publishing.
        const toolsApi = new ToolsApi();
        const context = toolsApi.getContext();

        const logger = this.getLogger();
        const apiOptions = this.getApiOptions();
        const helper = ToolsApi.getEdgeConfigHelper();
        const self = this;

        if (!self.getCommandLineOption("cache")) {
            this.errorMessage(i18n.__("cli_clear_requires_cache", {cache: "--cache"}));
            this.resetCommandLineOptions();
            return;
        }

        // Make sure the initialization process was successful.
        self.handleInitialization(context)
            .then(function () {
                // Make sure the url option has been specified.
                return self.handleUrlOption(context);
            })
            .then(function () {
                // Handle the necessary command line options.
                return self.handleAuthenticationOptions(context);
            })
            .then(function () {
                // Login using the current options.
                return self.handleLogin(context, apiOptions);
            })
            .then(function (/*results*/) {
                BaseCommand.displayToConsole(i18n.__("cli_clear_cache_started"));
                self.spinner = self.getProgram().getSpinner();
                self.spinner.start();
                return helper.clearCache(context, apiOptions)
                    .then( res => {
                        self.spinner.stop();
                        self.successMessage(i18n.__("cli_clear_cache_successful"));
                        if (res && res.estimatedSeconds) {
                            self.successMessage(i18n.__n('cli_clear_cache_estimate', res.estimatedSeconds));
                        }
                        if (self.getCommandLineOption("verbose")) {
                            logger.info(i18n.__("cli_clear_cache_details", {clear_cache_response_details: "\n"+JSON.stringify(res, null, "  ")}));
                        }
                        self.resetCommandLineOptions();
                    })
                    .catch(err => {
                        const curError = i18n.__("cli_clear_cache_error", {message: err.message});
                        self.spinner.stop();
                        self.errorMessage(curError);
                        self.resetCommandLineOptions();
                    });
            })
            .catch(err => {
                const curError = i18n.__("cli_clear_cache_error", {message: err.message});
                self.errorMessage(curError);
                self.resetCommandLineOptions();
            });
    }

    /**
     * Reset the command line options for this command.
     *
     * NOTE: This is used to reset the values when the command is invoked by the mocha testing. Normally the process
     * ends after the command is executed and so these values go away. But when running the tests, the process isn't
     * terminated and these values need to be reset.
     */
    resetCommandLineOptions () {
        this.setCommandLineOption("cache", undefined);
        super.resetCommandLineOptions();
    }
}

function clearCommand (program) {
    program
        .command("clear")
        .description(i18n.__("cli_clear_description"))
        .option("--cache",               i18n.__("cli_opt_clear_cache"))
        .option("--user <user>",         i18n.__("cli_opt_user_name"))
        .option("--password <password>", i18n.__("cli_opt_password"))
        .option("--url <url>",           i18n.__("cli_opt_url", {"product_name": utils.ProductName}))
        .option('-v --verbose',          i18n.__('cli_opt_verbose'))        .action(function (commandLineOptions) {
            const command = new ClearCommand(program);
            if (command.setCommandLineOptions(commandLineOptions, this)) {
                command.doClear();
            }
        });
}

module.exports = clearCommand;
