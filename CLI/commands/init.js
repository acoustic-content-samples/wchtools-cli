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

'use strict';

const BaseCommand = require("../lib/baseCommand");

const ToolsApi = require("wchtools-api");
const Q = require("q");
const utils = ToolsApi.getUtils();
const options = ToolsApi.getOptions();
const prompt = require("prompt");
const creds = require("@acoustic-content-sdk/cli-credentials");
const i18n = utils.getI18N(__dirname, ".json", "en");

class InitCommand extends BaseCommand {
    /**
     * Create an InitCommand object.
     *
     * @param {object} program A Commander program object.
     */
    constructor (program) {
        super(program);
    }

    /**
     * Get the schema for the prompt data.
     *
     * @param {Object} context The API context associated with this init command.
     *
     * @returns {Object} The schema for the prompt data, or null if a prompt is not required.
     *
     * @private
     */
    getInitPromptSchema (context) {
        const url = this.getCommandLineOption("url");
        const user = this.getCommandLineOption("user");
        const password = this.getCommandLineOption("password");
        const storeCredentials = this.getCommandLineOption("storeCredentials") && (process.platform === "darwin" || process.platform === "win32");

        // If all options were specified on the command line, then a prompt schema is not required.
        if (url && user && (password || !storeCredentials)) {
            return null;
        }

        const schema = {};

        // If the url option was not specified on the command line, add it to the prompt schema.
        if (!url) {
            const defaultUrl = options.getProperty(context, "x-ibm-dx-tenant-base-url");

            schema["x-ibm-dx-tenant-base-url"] = {
                description: i18n.__('cli_init_url'),
                default: defaultUrl ? defaultUrl : "",
                required: storeCredentials
            };
        }

        // If the user option was not specified on the command line, add it to the prompt schema.
        if (!user) {
            const defaultUser = options.getProperty(context, "username");

            schema["username"] = {
                description: i18n.__('cli_init_user_name'),
                default: defaultUser ? defaultUser : "",
                required: storeCredentials
            };
        }

        // If the password option was not specified and the store-credentials option was, add password to the prompt schema.
        if (!password && storeCredentials) {
            schema["password"] = {
                description: user ? i18n.__('cli_base_password_for_user', {username: user}) : i18n.__('cli_base_password'),
                default: "",
                hidden: true,
                required: storeCredentials
            };
        }
        return schema;
    }

    /**
     * Check for the specified numeric option
     * @param {string} option name
     */
    checkForNumericOption(optionName, configOptionName, newOptions) {
        const n = this.getCommandLineOption(optionName);
        if (n) {
            if (Number.isNaN(n) || (Number(n)<0) || !Number.isSafeInteger(Number(n)))
                this.getProgram().errorMessage(i18n.__('cli_init_expected_numeric_arg', {arg: "retryMaxAttempts", argv: n}));
            else
                newOptions[configOptionName] = Number(n);
        }
    }

    /**
     * Update the given options, and presist to file.
     *
     * @param {Object} context The API context associated with this init command.
     * @param {Object} [promptedOptions] The options specified using a prompt.
     *
     * @private
     */
    updateOptions (context, promptedOptions) {
        const self = this;

        // The new options to be persisted should include all of the values entered via prompt.
        const newOptions = promptedOptions || {};

        // Add any options specified on the command line to the prompted options.
        if (this.getCommandLineOption("url")) {
            newOptions["x-ibm-dx-tenant-base-url"] = this.getCommandLineOption("url");
        }
        if (this.getCommandLineOption("user")) {
            newOptions["username"] = this.getCommandLineOption("user");
        }
        if (this.getCommandLineOption("password")) {
            newOptions["password"] = this.getCommandLineOption("password");
        }

        this.checkForNumericOption("retryMaxAttempts", "retryMaxAttempts", newOptions);
        this.checkForNumericOption("retryMinTime", "retryMinTimeout",  newOptions);
        this.checkForNumericOption("retryMaxTime", "retryMaxTimeout",  newOptions);

        // Validate the specified API URL.
        if (utils.isValidApiUrl(newOptions["x-ibm-dx-tenant-base-url"])) {
            // Update the appropriate options file and display the result.
            try {
                newOptions["x-ibm-dx-tenant-base-url"] = newOptions["x-ibm-dx-tenant-base-url"].trim();
                // Remove the password before saving.
                const password = newOptions["password"];
                delete newOptions["password"];
                const optionsFilePath = options.setOptions(context, newOptions, true, this.getCommandLineOption("dir"));
                this.getProgram().successMessage(i18n.__('cli_init_success', {"path": optionsFilePath}));

                const storeCredentials = this.getCommandLineOption("storeCredentials");
                if (storeCredentials && (process.platform === "darwin" || process.platform === "win32")) {
                    creds.wchStoreCredentials({baseUrl: newOptions["x-ibm-dx-tenant-base-url"], username: newOptions["username"], password: password})
                        .then(function () {
                            self.getProgram().successMessage(i18n.__('cli_init_store_creds_success', {"url": newOptions["x-ibm-dx-tenant-base-url"]}));
                        })
                        .catch(function (err) {
                            self.getProgram().errorMessage(i18n.__('cli_init_store_creds_error', {"url": newOptions["x-ibm-dx-tenant-base-url"], message: err.toString()}));
                        });
                }
            } catch (e) {
                this.getProgram().errorMessage(i18n.__('cli_init_error', {message: e.toString()}));
            }
        } else {
            // Display an error message that the URL is not valid.
            this.getProgram().errorMessage(i18n.__('cli_invalid_url_option'));
        }

        // Reset the command line options.
        this.resetCommandLineOptions();
    }

    /**
     * Initialize the configuration settings.
     */
    doInit () {
        // Create the context for initializing the WCH Tools options.
        const toolsApi = new ToolsApi();
        const context = toolsApi.getContext();

        // Handle the various validation checks.
        if (this.getCommandLineOption("storeCredentials") && !(process.platform === "darwin" || process.platform === "win32")) {
            // --store-credentials is not supported on this OS.
            this.errorMessage(i18n.__("cli_init_store_creds_not_supported", {"platform": process.platform}));
            this.resetCommandLineOptions();
            return;
        }

        // Extend the options using the options file in the specified directory.
        const dir = this.getCommandLineOption("dir");
        if (dir) {
            options.extendOptionsFromDirectory(context, dir);
        }

        // Check to see if the initialization process was successful.
        const self = this;
        this.handleInitialization(context)
            .then (function () {
                // Determine which options will require a command line prompt.
                const promptSchema = self.getInitPromptSchema(context);

                if (promptSchema) {
                    // Handle the case where some options were not specified and will be prompted for.
                    const schemaProps = {"properties": promptSchema};
                    prompt.message = '';
                    prompt.delimiter = ' ';
                    prompt.start();
                    const deferred = Q.defer();
                    prompt.get(schemaProps, function (err, results) {
                        if (err) {
                            // Reset the command line options and display the error.
                            self.resetCommandLineOptions();
                            self.getProgram().errorMessage(i18n.__('cli_init_error', {message: err.toString()}));
                            deferred.reject(err);
                        } else {
                            self.updateOptions(context, results);
                            deferred.resolve();
                        }
                    });
                    return deferred.promise;
                } else {
                    // Handle the case where all options were specified and no prompt is required.
                    self.updateOptions(context);
                }
            })
            .catch(function (err) {
                self.errorMessage(err.message);
            })
            .finally(function () {
                // Reset the command line options once the command has completed.
                self.resetCommandLineOptions();
            });
    }

    /**
     * Reset the command line options for this command.
     *
     * NOTE: This is used to reset the values when the command is invoked by the mocha testing. Normally the Commander
     * process ends after the command is executed and so these values go away. But when running the tests, the process
     * isn't terminated and these values need to be reset.
     */
    resetCommandLineOptions () {
        this.setCommandLineOption("storeCredentials", undefined);
        this.setCommandLineOption("retryMaxAttempts", undefined);
        this.setCommandLineOption("retryMinTime", undefined);
        this.setCommandLineOption("retryMaxTime", undefined);

        super.resetCommandLineOptions();
    }
}

/**
 * Execute the "init" command.
 *
 * @param {object} program A Commander program object.
 */
function initCommand (program) {
    program
        .command('init')
        .description(i18n.__('cli_init_description', {"product_name": utils.ProductName}))
        .option('--url <url>', i18n.__('cli_init_opt_url', {"product_name": utils.ProductName}))
        .option('--user <user>', i18n.__('cli_init_opt_user_name'))
        .option('--password <password>', i18n.__('cli_opt_password'))
        .option('--store-credentials', i18n.__('cli_init_opt_store_credentials'))
        .option('--dir <directory>', i18n.__('cli_init_opt_dir'))
        .option('--retry-max-attempts <n>', i18n.__('cli_init_opt_retry_max_attempts'))
        .option('--retry-min-time <n>', i18n.__('cli_init_opt_retry_min_time'), parseInt)
        .option('--retry-max-time <n>', i18n.__('cli_init_opt_retry_max_time'), parseInt)
        .action(function (commandLineOptions) {
            const command = new InitCommand(program);
            if (command.setCommandLineOptions(commandLineOptions, this)) {
                command.doInit();
            }
        });
}

module.exports = initCommand;
