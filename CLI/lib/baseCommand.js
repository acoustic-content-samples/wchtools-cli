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

const dxAuthoring = require("dxauthoringapi");
const utils = dxAuthoring.utils;
const options = dxAuthoring.options;
const fs  = require('fs');
const i18n = utils.getI18N(__dirname, ".json", "en");
const prompt = require("prompt");
const Q = require("q");
const log4js = require('log4js');
const ProductVersion = require("../package.json").version;

class BaseCommand {
    /**
     * Create a BaseCommand object.
     *
     * @param {object} program A Commander program object.
     */
    constructor (program) {
        this._program = program;
        this._apiOptions = {};
        this._createDir = false;
        this._optionArtifactCount = 0;

        // Keep track of the number of artifacts that were successfully pulled, and the number of errors.
        this._artifactsCount = 0;
        this._artifactsError = 0;

        // Keep track of cleanup functions to execute after the command has been completed.
        this._cleanups = [];
        this.cliLog = "cli" + " " + ProductVersion;
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
     * @param {object} options The command line options for this command.
     * @param {object} command The Commander command currently being executed.
     *
     * @returns {boolean} A value of true if the given command line options are valid for this command, otherwise false
     *          to indicate that command execution should not continue.
     */
    setCommandLineOptions (options, command) {
        // If Commander was able to successfully parse the command line options, the options parameter will be an
        // object. Otherwise, the options parameter will be a string with the unparsed command line options.
        const valid = (typeof options === 'object');

        if (valid) {
            // The command line options were parsed successfully.
            this._commandLineOptions = options;
        } else {
            // The command line options were not parsed successfully. In this case, the options should be reset on the
            // command object itself. This is just the way Commander works.
            this._commandLineOptions = command;

            // Provide a meesage to indicate that there was an invalid argument on the command line.
            this.errorMessage(i18n.__('cli_invalid_arguments', {arguments: options}));

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
        if (this._commandLineOptions) {
            return this._commandLineOptions[name];
        }
    }

    /**
     * Set the command line option with the given name to the specified value.
     *
     * @param {string} name The name of the command line option.
     * @param {object} value The value of the command line option.
     */
    setCommandLineOption (name, value) {
        if (this._commandLineOptions) {
            this._commandLineOptions[name] = value;
        }
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
        this.setCommandLineOption("user", undefined);
        this.setCommandLineOption("password", undefined);
        this.setCommandLineOption("verbose", undefined);
        this.setCommandLineOption("IgnoreTimestamps", undefined);
        this.setCommandLineOption("AllAuthoring", undefined);
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
     * Display an error message.
     *
     * @param {string} message The message to be displayed.
     */
    errorMessage (message) {
        this.getProgram().errorMessage(message);
    }

    /**
     * Display a success message.
     *
     * @param {string} message The message to be displayed.
     */
    successMessage (message) {
        this.getProgram().successMessage(message);
    }

    /**
     * Determine how many artifact type options were specified. If none, then set the default artifact type option.
     */
    handleArtifactTypes () {
        // If All-Authoring was specified, set all authoring artifact types.
        if (this.getCommandLineOption("AllAuthoring")) {
            this.setCommandLineOption("types", true);
            this.setCommandLineOption("presentations", true);
            this.setCommandLineOption("assets", true);
            this.setCommandLineOption("webassets", true);
            this.setCommandLineOption("content", true);
            this.setCommandLineOption("Categories", true);
            this.setCommandLineOption("renditions", true);
            this.setCommandLineOption("imageProfiles", true);
        }

        // Determine the number of artifact types that have been set.
        // If no object types were specified, set the default object type(s).
        if (this.getCommandLineOption("types")) {
            this._optionArtifactCount++;
        }
        if (this.getCommandLineOption("presentations")) {
            this._optionArtifactCount++;
        }
        if (this.getCommandLineOption("assets")) {
            this._optionArtifactCount++;
        }
        if (this.getCommandLineOption("webassets")) {
            this._optionArtifactCount++;
        }
        if (this.getCommandLineOption("content")) {
            this._optionArtifactCount++;
        }
        if (this.getCommandLineOption("Categories")) {
            this._optionArtifactCount++;
        }
        if (this.getCommandLineOption("renditions")) {
            this._optionArtifactCount++;
        }
        if (this.getCommandLineOption("sources")) {
            this._optionArtifactCount++;
        }
        if (this.getCommandLineOption("imageProfiles")) {
            this._optionArtifactCount++;
        }

        // If no object types were specified, set the default object type(s).
        if (this._optionArtifactCount === 0) {
            // Handle only assets by default.
            this.setCommandLineOption("webassets", true);
            this._optionArtifactCount = 1;
        }
    }

    /**
     * Handle the "dir" option specified on the command line.
     *
     * @returns {boolean} A value of true if the specified dir option is valid, otherwise false to indicate that command
     *          execution should not continue.
     */
    handleDirOption () {
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

        this.setApiOption("workingDir", dir);
        return true;
    }

    /**
     * Handle the authentication options. These can be specified as command line options, user property (username), or
     * environment variable (password). If either value is missing, the user will be prompted for the missing value(s).
     *
     * @returns {Q.Promise} A promise that is resolved when the username and password have been specified.
     */
    handleAuthenticationOptions () {
        const defer = Q.defer();
        let schemaInput;

        // Get the user name.
        let username = this.getCommandLineOption("user");
        if (username) {
            // The user name was specified on the command line.
            this.setApiOption("username", username);
        } else {
            username  = options.getUserProperty('username');
            if (username) {
                // The user name was specified in the user properties.
                this.setApiOption("username", username);
            } else {
                // The user name will be prompted for.
                schemaInput =
                {
                    username:
                    {
                        description: i18n.__('cli_init_user_name'),
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
                hidden:true,
                required:true
            };
        } else {
            // The password will be prompted for.
            schemaInput =
            {
                password:
                {
                    description: i18n.__('cli_base_password'),
                    hidden:true,
                    required:true
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
            prompt.get(schemaProps, function(err, result) {
                if (err) {
                    // TODO How do we get an error, and should we reject if we do?
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

    getLogConfig() {
        // Set up logging for the CLI in the directory where the files exist, and then get the logger.
        const fileAppender = {
            type: 'file',
            filename: './' + utils.ProductAbrev + '-cli.log',
            category: this.cliLog,
            maxLogSize: 30480,
            backups: 3
        };
        const consoleAppender = {
            type: 'console',
            category: this.cliLog
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
        if(!this.logger){
            const logConfig = this.getLogConfig();
            this.logger = utils.getLogger(this.cliLog, logConfig);
            this.logger.setLevel('INFO');
        }
        return this.logger;
    }
}

module.exports = BaseCommand;
