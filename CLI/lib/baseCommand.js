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

const ToolsApi = require("wchtools-api");
const utils = ToolsApi.getUtils();
const options = ToolsApi.getOptions();
const fs  = require('fs');
const i18n = utils.getI18N(__dirname, ".json", "en");
const prompt = require("prompt");
const Q = require("q");
const log4js = require('log4js');
const ProductVersion = require("../package.json").version;
const cliLog = "cli" + " " + ProductVersion;

class BaseCommand {
    /**
     * Create a BaseCommand object.
     *
     * @param {object} program A Commander program object.
     */
    constructor (program) {
        // The Commander instance to be used for this command.
        this._program = program;

        // The logger for this command, which will be lazy loaded.
        this._logger;

        // The command line options for this command, which must be set using the setCommandLineOptions method.
        this._commandLineOptions;

        // The options used by this command for making API calls.
        this._apiOptions = {};

        // Flag to indicate whether the directory specified by the "dir" option on the command line should be created.
        this._createDir = false;

        // Keep track of the number of artifact types specified by the command line options.
        this._optionArtifactCount = 0;

        // Keep track of the number of artifacts successfully pushed or pulled, and the number of errors.
        this._artifactsCount = 0;
        this._artifactsError = 0;

        // The process exit code to use for a CLI error.
        this.CLI_ERROR_EXIT_CODE = 1;

        // The cleanup functions to execute after the command has been completed.
        this._cleanups = [];
    }

    /**
     * Get the Commander program object used by this command.
     *
     * @returns {object} The Commander program object used by this command.
     */
    getProgram () {
        return this._program;
    }

    /**
     * Get the options used by this command for making API calls.
     *
     * @returns {object} The options used by this command for making API calls.
     */
    getApiOptions () {
        return this._apiOptions;
    }

    /**
     * Set the API option with the given name to the specified value.
     *
     * @param {string} name The name of the API option.
     * @param {object} value The value of the API option.
     */
    setApiOption (name, value) {
        this._apiOptions[name] = value;
    }

    /**
     * Set whether this command should create the directory specified by the "dir" option on the command line.
     *
     * @param {boolean} state A value of true indicates this command should create the directory specified by the "dir"
     *             option on the command line, otherwise false indicates this command should not create the directory.
     */
    setCreateDir (state) {
        this._createDir = state;
    }

    /**
     * Get the number of artifact type options that have been specified.
     *
     * @returns {number} The number of artifact type options that have been specified.
     */
    getOptionArtifactCount () {
        return this._optionArtifactCount;
    }

    /**
     * Add a cleanup function to be executed after the command has been completed.
     *
     * @param {function} cleanup A cleanup function to be executed after the command has been completed.
     */
    addCleanup (cleanup) {
        this._cleanups.push(cleanup);
    }

    /**
     * Handle any cleanup tasks.
     */
    handleCleanup () {
        // Execute each of the specified cleanup functions.
        this._cleanups.forEach(function (cleanup) {
            cleanup();
        });
    }

    /**
     * Set the command line options for this command.
     *
     * @param {object} commandLineOptions The command line options for this command.
     * @param {object} command The Commander command currently being executed.
     *
     * @returns {boolean} A value of true if the given command line options are valid for this command, otherwise false
     *          to indicate that command execution should not continue.
     */
    setCommandLineOptions (commandLineOptions, command) {
        // If Commander was able to successfully parse the command line options, the options parameter will be an
        // object. Otherwise, the options parameter will be a string with the unparsed command line options.
        const valid = (typeof commandLineOptions === 'object');

        if (valid) {
            // The command line options were parsed successfully.
            this._commandLineOptions = commandLineOptions;
        } else {
            // The command line options were not parsed successfully. In this case, the options should be reset on the
            // command object itself. This is just the way Commander works.
            this._commandLineOptions = command;

            // Provide a meesage to indicate that there was an invalid argument on the command line.
            this.errorMessage(i18n.__('cli_invalid_arguments', {arguments: commandLineOptions}));

            // Reset the command line options.
            this.resetCommandLineOptions();
        }
        return valid;
    }

    /**
     * Get the value of the command line option with the given name.
     *
     * @param {string} name The name of the command line option.
     *
     * @returns {string} The value of the command line option with the given name, or null.
     */
    getCommandLineOption (name) {
        return this._commandLineOptions[name];
    }

    /**
     * Set the command line option with the given name to the specified value.
     *
     * @param {string} name The name of the command line option.
     * @param {object} value The value of the command line option.
     */
    setCommandLineOption (name, value) {
        this._commandLineOptions[name] = value;
    }

    /**
     * Reset the command line options for this command.
     *
     * NOTE: This is used to reset the values when the command is invoked by the mocha testing. Normally the process
     * ends after the command is executed and so these values go away. But when running the tests, the process isn't
     * terminated and these values need to be reset.
     */
    resetCommandLineOptions () {
        this.setCommandLineOption("dir", undefined);
        this.setCommandLineOption("url", undefined);
        this.setCommandLineOption("user", undefined);
        this.setCommandLineOption("password", undefined);
        this.setCommandLineOption("verbose", undefined);
        this.setCommandLineOption("ignoreTimestamps", undefined);
        this.setCommandLineOption("allAuthoring", undefined);
    }

    /**
     * Display the given message to the console.
     *
     * @param {string} message The message to be displayed to the console.
     */
    static displayToConsole (message) {
        console.log(message); // NOSONAR
    };

    /**
     * Display the given initialization errors.
     *
     * @param {Array} errors The errors to be displayed.
     */
    displayInitializationErrors (errors) {
        // Combine the errors into a single message.
        let message;
        errors.forEach(function (error, index) {
            if (index === 0) {
                message = error.message;
            } else {
                message = message + "\n\n" + error.message;
            }
        });

        this.errorMessage(message);
    }

    /**
     * Display an error message.
     *
     * @param {string} message The message to be displayed.
     */
    errorMessage (message) {
        // Display the specified error message.
        this.getProgram().errorMessage(message);

        // Set the exit code for the process, so that a parent process can determine success.
        process.exitCode = this.CLI_ERROR_EXIT_CODE;
    }

    /**
     * Display a warning message.
     *
     * @param {string} message The message to be displayed.
     */
    warningMessage (message) {
        // Display the specified warning message.
        this.getProgram().warningMessage(message);
    }

    /**
     * Display a success message.
     *
     * @param {string} message The message to be displayed.
     */
    successMessage (message) {
        // Display the specified success message.
        this.getProgram().successMessage(message);
    }

    /**
     * Determine how many artifact type options were specified. If none, then set the default artifact type option.
     *
     * @param {Array} [defaultArtifactTypes] The artifact types to use if no artifact types have been specified.
     */
    handleArtifactTypes (defaultArtifactTypes) {
        // If all-Authoring was specified, set all authoring artifact types.
        if (this.getCommandLineOption("allAuthoring")) {
            this.setCommandLineOption("types", true);
            this.setCommandLineOption("assets", true);
            this.setCommandLineOption("webassets", true);
            this.setCommandLineOption("layouts", true);
            this.setCommandLineOption("layoutMappings", true);
            this.setCommandLineOption("content", true);
            this.setCommandLineOption("categories", true);
            this.setCommandLineOption("renditions", true);
            this.setCommandLineOption("imageProfiles", true);
        }

        // Determine the number of artifact types that have been set.
        // If no object types were specified, set the default object type(s).
        if (this.getCommandLineOption("types")) {
            this._optionArtifactCount++;
        }
        if (this.getCommandLineOption("assets")) {
            this._optionArtifactCount++;
        }
        if (this.getCommandLineOption("webassets")) {
            this._optionArtifactCount++;
        }
        if (this.getCommandLineOption("layouts")) {
            this._optionArtifactCount++;
        }
        if (this.getCommandLineOption("layoutMappings")) {
            this._optionArtifactCount++;
        }
        if (this.getCommandLineOption("content")) {
            this._optionArtifactCount++;
        }
        if (this.getCommandLineOption("categories")) {
            this._optionArtifactCount++;
        }
        if (this.getCommandLineOption("renditions")) {
            this._optionArtifactCount++;
        }
        if (this.getCommandLineOption("publishingSources")) {
            this._optionArtifactCount++;
        }
        if (this.getCommandLineOption("publishingProfiles")) {
            this._optionArtifactCount++;
        }
        if (this.getCommandLineOption("publishingSiteRevisions")) {
            this._optionArtifactCount++;
        }
        if (this.getCommandLineOption("imageProfiles")) {
            this._optionArtifactCount++;
        }

        // If no object types were specified, set the default object type(s).
        if (this._optionArtifactCount === 0 && defaultArtifactTypes) {
            // Set the command line option for each of the default artifact types.
            const self = this;
            defaultArtifactTypes.forEach(function (type) {
                self.setCommandLineOption(type, true);
                self._optionArtifactCount++;
            });
        }
    }

    /**
     * Handle the "dir" option specified on the command line.
     *
     * @param {Object} context The API context associated with this command.
     *
     * @returns {boolean} A value of true if the specified dir option is valid, otherwise false to indicate that command
     *          execution should not continue.
     */
    handleDirOption (context) {
        const dir = this.getCommandLineOption("dir");

        // If a "dir" option was not specified on the command line, use the current NodeJS working directory.
        if (!dir) {
            this.setApiOption("workingDir", process.cwd());
            return true;
        }

        // A "dir" option was specified on the command line, so handle it accordingly.
        try {
            if (this._createDir) {
                // Make sure the specified directory can be created.
                fs.mkdirSync(dir);
            } else {
                // Make sure the specified directory exists.
                fs.statSync(dir).isDirectory();
            }
        } catch (err) {
            if (this._createDir) {
                if (err.code !== "EEXIST") {
                    // Display an error message to indicate that the specified directory could not be created.
                    this.errorMessage(i18n.__('cli_could_not_create_dir', {error_code: err.code, dir: dir}));

                    // Reset the command line options.
                    this.resetCommandLineOptions();

                    // Return a value of false to indicate that command execution should not continue.
                    return false;
                }
            } else {
                // Display an error message to indicate that the specified directory does not exist.
                this.errorMessage(i18n.__('cli_dir_does_not_exist', {error_code: err.code, dir: dir}));

                // Reset the command line options.
                this.resetCommandLineOptions();

                // Return a value of false to indicate that command execution should not continue.
                return false;
            }
        }

        // Set the option for the working directory.
        this.setApiOption("workingDir", dir);

        // Use any options that are defined in that directory.
        options.extendOptionsFromDirectory(context, dir);

        return true;
    }

    /**
     * Handle any errors that occurred during the initialization process.
     *
     * @param {Object} context The API context associated with this command.
     *
     * @returns {boolean} A value of true if the initialization process was successful, otherwise false to indicate that
     *          command execution should not continue.
     */
    handleInitialization (context) {
        const errors = ToolsApi.getInitializationErrors(context);

        if (errors && errors.length > 0) {
            // There were errors during the initialization process.
            this.displayInitializationErrors(errors);

            // Reset the command line options.
            this.resetCommandLineOptions();

            // Return a value of false to indicate that command execution should not continue.
            return false;
        } else {
            // No errors occurred during the initialization process.
            return true;
        }
    }

    /**
     * Handle the url option. It can be specified as a command line option or user option ("x-ibm-dx-tenant-base-url").
     * If the url is not specified by either of these methods, a prompt will be displayed to enter the value.
     *
     * @param {Object} context The API context associated with this init command.
     *
     * @returns {Q.Promise} A promise that is resolved when the url has been specified.
     */
    handleUrlOption (context) {
        // FUTURE   When we remove support for using the "dx-api-gateway" fallback option, we will always prompt for the
        // FUTURE   "x-ibm-dx-tenant-base-url" option (if it has not been specified/configured.) Until then, we will not
        // FUTURE   prompt for the "x-ibm-dx-tenant-base-url" option if the "x-ibm-dx-tenant-id" option has been defined.
        const defer = Q.defer();
        let schemaInput;

        // Get the value of the command line option.
        let url = this.getCommandLineOption("url");
        if (!url) {
            // Get the value of the user option.
            url  = options.getProperty(context, "x-ibm-dx-tenant-base-url");
            if (!url && !options.getProperty(context, "x-ibm-dx-tenant-id")) {
                // Define the schema used to prompt for the url value.
                schemaInput =
                    {
                        url:
                            {
                                description: i18n.__("cli_base_url"),
                                required: true
                            }
                    };
            }
        }

        if (schemaInput) {
            // Prompt for the url.
            prompt.message = '';
            prompt.delimiter = ' ';
            prompt.start();
            const schemaProps = {properties: schemaInput};
            const self = this;
            prompt.get(schemaProps, function (err, result) {
                if (err) {
                    defer.reject(err);
                } else if (result.url && utils.isValidApiUrl(result.url)) {
                    // The specified url is valid, so set the appropriate API option and resolve the promise.
                    self.setApiOption("x-ibm-dx-tenant-base-url", result.url);
                    defer.resolve();
                } else {
                    // Reject the promise to indicate that command execution should not continue.
                    defer.reject(new Error(i18n.__("cli_invalid_url_option")));
                }
            });
        } else {
            if (!url) {
                // FUTURE When we remove support for using the "dx-api-gateway" option as a fallback, remove this case.
                // A prompt was not displayed and a base URL was not specified. Assume fallback to "dx-api-gateway".
                defer.resolve();
            } else {
                // A base URL was specified, either on the command line or in an options file.
                if (utils.isValidApiUrl(url)) {
                    // The url is valid, so set the appropriate API option and resolve the promise.
                    this.setApiOption("x-ibm-dx-tenant-base-url", url);
                    defer.resolve();
                } else {
                    // Reject the promise to indicate that command execution should not continue.
                    defer.reject(new Error(i18n.__("cli_invalid_url_option")));
                }
            }
        }

        return defer.promise;
    }

    /**
     * Handle the authentication options. These can be specified as command line options, user property (username), or
     * environment variable (password). If either value is missing, the user will be prompted for the missing value(s).
     *
     * @param {Object} context The API context associated with this init command.
     *
     * @returns {Q.Promise} A promise that is resolved when the username and password have been specified.
     */
    handleAuthenticationOptions (context) {
        const defer = Q.defer();
        let schemaInput;

        // Get the user name.
        let username = this.getCommandLineOption("user");
        if (username) {
            // The user name was specified on the command line.
            this.setApiOption("username", username);
        } else {
            username  = options.getProperty(context, 'username');
            if (username) {
                // The user name was specified in the user properties.
                this.setApiOption("username", username);
            } else {
                // The user name will be prompted for.
                schemaInput =
                {
                    username:
                    {
                        description: i18n.__('cli_base_user_name'),
                        required: true
                    }
                };
            }
        }

        // Get the password.
        let password = this.getCommandLineOption("password");
        if (password) {
            // The password was specified on the command line.
            this.setApiOption("password", password);
        }
        else if (process.env.WCHTOOLS_PASSWORD) {
            // The password was specified in an environment variable.
            password = process.env.WCHTOOLS_PASSWORD;
            this.setApiOption("password", password);
        } else if (schemaInput) {
            // The user name and password will be prompted for.
            schemaInput.password =
            {
                description: i18n.__('cli_base_password'),
                hidden: true,
                required: true
            };
        } else {
            // The password will be prompted for.
            schemaInput =
            {
                password:
                {
                    description: i18n.__('cli_base_password'),
                    hidden: true,
                    required: true
                }
            };
        }

        if (schemaInput) {
            // Prompt for the user name and/or password.
            prompt.message = '';
            prompt.delimiter = ' ';
            prompt.start();
            const schemaProps = {properties: schemaInput};
            const self = this;
            prompt.get(schemaProps, function (err, result) {
                if (err) {
                    // FUTURE How do we get an error, and should we reject if we do?
                    console.warn(err.message);
                    defer.resolve();
                } else {
                    if (result.username) {
                        // Add the specified user name to the API options.
                        username = result.username;
                        self.setApiOption("username", username);
                    }
                    if (result.password) {
                        // Add the specified password to the API options.
                        password = result.password;
                        self.setApiOption("password", password);
                    }

                    // The user name and password have been provided, so resolve the promise.
                    defer.resolve();
                }
            });
        } else {
            // Did not need to prompt for user name and password, so resolve the promise.
            defer.resolve();
        }

        return defer.promise;
    }

    /**
     * Handle the path option specified on the command line.
     *
     * @returns {boolean} A value of true if the specified path option is valid, otherwise false to indicate that
     *          command execution should not continue.
     */
    handlePathOption () {
        if (this.getCommandLineOption("path")) {
            // Verify that "path" is only used with the "webassets" option.
            if (this.getCommandLineOption("webassets")) {
                this.setApiOption("filterPath", this.getCommandLineOption("path"));
            } else {
                this.errorMessage(i18n.__('cli_invalid_path_option'));
                this.resetCommandLineOptions();
                return false;
            }
        }

        return true;
    }

    getLogConfig () {
        // Set up logging for the CLI in the directory where the files exist, and then get the logger.
        const fileAppender = {
            type: 'file',
            filename: './' + utils.ProductAbrev + '-cli.log',
            category: cliLog,
            maxLogSize: 30480,
            backups: 3
        };
        const consoleAppender = {
            type: 'console',
            category: cliLog
        };

        const appenders = [fileAppender];
        if (this.getCommandLineOption("verbose")) {
            appenders.push(consoleAppender);
        }
        return {
            appenders: appenders
        };
    }
    /**
     * Get the logger to be used by this command.
     *
     * @returns {object} The logger to be used by this command.
     */
    getLogger () {
        if (!this._logger) {
            const logConfig = this.getLogConfig();
            this._logger = utils.getLogger(cliLog, logConfig);
            this._logger.setLevel('INFO');
        }
        return this._logger;
    }
}

module.exports = BaseCommand;
