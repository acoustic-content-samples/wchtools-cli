/*
Copyright IBM Corporation 2016, 2017, 2018

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
const manifests = ToolsApi.getManifests();
const login = ToolsApi.getLogin();
const fs  = require('fs');
const i18n = utils.getI18N(__dirname, ".json", "en");
const prompt = require("prompt");
const Q = require("q");
const ProductVersion = require("../package.json").version;
const creds = require("@ibm-wch-sdk/cli-credentials");
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
     * Determine whether debug mode is enabled for this command.
     *
     * @returns {Boolean} A return value of true indicates that debug mode is enabled for this command. A return value
     *          of false indicates that debug mode is not enabled for this command.
     */
    isDebugEnabled () {
        return this.getProgram().debug === true;
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
        if (value === undefined) {
            delete this._apiOptions[name];
        } else {
            this._apiOptions[name] = value;
        }
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

            // Provide a message to indicate that there was an invalid option on the command line.
            this.errorMessage(i18n.__('cli_invalid_arguments', {options: commandLineOptions}));

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
        this.setCommandLineOption("ready", undefined);
        this.setCommandLineOption("draft", undefined);
        this.setCommandLineOption("siteContext", undefined);
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
    }

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
     * Display a debug message.
     *
     * @param {string} message The message to be displayed.
     */
    debugMessage (message) {
        // Display the specified debug message.
        this.getProgram().debugMessage(message);
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
     * Initialize manifest handling for the command.
     *
     * @param {Object} context The API context associated with this command.
     *
     * @returns {Q.Promise} A promise that is resolved if the manifests are properly initialized, and rejected to indicate that
     *          command execution should not continue.
     */
    handleManifestOptions (context) {
        const deferred = Q.defer();
        const opts = this.getApiOptions();

        let manifest = this.getCommandLineOption("manifest");
        const serverManifest = this.getCommandLineOption("serverManifest");

        if (manifest && serverManifest) {
            // Both manifest and serverManifest cannot be supplied.
            deferred.reject(new Error(i18n.__("cli_manifest_and_server_manifest")));
        } else {
            // Copy the serverManifest option to manifest.
            if (serverManifest) {
                this.setCommandLineOption("manifest", serverManifest);
                this.setCommandLineOption("serverManifest", undefined);
                manifest = serverManifest;
                context.serverManifest = true;
            }

            // Clear out any existing manifest settings.
            manifests.resetManifests(context, opts);

            const writeManifest = this.getCommandLineOption("writeManifest");
            const writeDeletionsManifest = this.getCommandLineOption("writeDeletionsManifest");

            if (manifest || writeManifest || writeDeletionsManifest) {
                // A manifest option was specified for this operation, so initialize the manifest settings.
                manifests.initializeManifests(context, manifest, writeManifest, writeDeletionsManifest, opts).then(function () {
                    // Make sure the manifest is compatible with the tenant tier.
                    if (options.getProperty(context, "tier") === "Base") {
                        // A manifest used with a base tier tenant cannot have sites, pages, layouts, or layout-mappings.
                        const incompatibleSections = ["sites", "pages", "layouts", "layout-mappings"];

                        // The manifest is incompatible if it contains a section for an incompatible artifact type.
                        const incompatible = incompatibleSections.some(function (section) {
                            return manifests.getManifestSection(context, section, opts);
                        });

                        if (incompatible) {
                            // Display an error message to indicate that the specified manifest is incompatible.
                            deferred.reject(new Error(i18n.__('cli_manifest_not_compatible', {name: manifest})));
                        } else {
                            deferred.resolve();
                        }
                    } else {
                        deferred.resolve();
                    }
                }).catch(function (err) {
                    // Display an error message to indicate that the specified manifest is not valid.
                    deferred.reject(err);
                });
            } else {
                deferred.resolve();
            }
        }

        return deferred.promise;
    }

    /**
     * Get an array of the manifest's site items to use for this command.
     *
     * @param {Object} context The API context associated with this command.
     *
     * @returns {Array} An array of the manifest's site items to use for this command.
     */
    getManifestSiteItems(context) {
        const sitesSection = manifests.getManifestSites(context, this.getApiOptions());
        if (sitesSection) {
            // The sites section has a property for each site, keyed by the site id.
            const siteIds = Object.keys(sitesSection);
            if (siteIds && siteIds.length > 0) {
                return siteIds.map(function (id) {
                    // Create a proxy item for the array, to prune the pages property.
                    const item = sitesSection[id];

                    return {
                        id: item.id,
                        name: item.name,
                        contextRoot: item.contextRoot,
                        status: item.status
                    };
                });
            }
        }

        // If there are no sites in the manifest, return an empty array.
        return [];
    }

    /**
     * Determine how many artifact type options were specified. If none, then set the default artifact type option.
     *
     * @param {Object} context The API context associated with this command.
     * @param {Array} [defaultArtifactTypes] The artifact types to use if no artifact types have been specified.
     *
     * @returns {Q.Promise} Resolve if the artifact types were initialized, otherwise reject to indicate that
     *          command execution should not continue.
     */
    handleArtifactTypes (context, defaultArtifactTypes) {
        const deferred = Q.defer();
        let result = true;
        let errorMessage;

        const opts = this.getApiOptions();
        const manifest = this.getCommandLineOption("manifest");

        // If a manifest was specified, then the artifact types are defined by the manifest.
        if (manifest) {
            // Note that "sites" must be declared before "pages" in order for the subsequent logic to work correctly.
            const artifactTypes = [
                {option: "types", section: "types"},
                {option: "assets", section: "assets"},
                {option: "webassets", section: "assets"},
                {option: "layouts", section: "layouts"},
                {option: "layoutMappings", section: "layout-mappings"},
                {option: "content", section: "content"},
                {option: "defaultContent", section: "default-content"},
                {option: "categories", section: "categories"},
                {option: "renditions", section: "renditions"},
                {option: "imageProfiles", section: "image-profiles"},
                {option: "sites", section: "sites"},
                {option: "pages", section: "pages"},
                {option: "publishingProfiles", section: "publishing-profiles"},
                {option: "publishingSiteRevisions", section: "site-revisions"},
                {option: "publishingSources", section: "publishing-sources"}
            ];

            const self = this;
            // Determine if any artifact type args were explicitly specified.
            let artifactTypeArg = false;
            artifactTypes.forEach(function (artifactType) {
                if (self.getCommandLineOption(artifactType.option)) {
                    artifactTypeArg = true;
                    self._optionArtifactCount++;
                }
            });

            // Set any artifact types that exist in the manifest.
            let siteItems;
            artifactTypes.forEach(function (artifactType) {
                let hasSection = false;

                // Sites and pages are handled separately so that a page section can be found for each site.
                if (artifactType.section === "sites") {
                    siteItems = self.getManifestSiteItems(context);
                    if (siteItems.length > 0) {
                        hasSection = true;
                    }
                } else if (artifactType.section === "pages") {
                    // Iterate over the site items to see if any have a pages section.
                    hasSection = siteItems && siteItems.some(function (siteItem) {
                        // Set the siteItem property so the manifest logic knows which site to use.
                        return manifests.getManifestSection(context, "pages", utils.cloneOpts(opts, {siteItem: siteItem}));
                    });
                } else if (manifests.getManifestSection(context, artifactType.section, opts)) {
                    hasSection = true;
                }

                if (!artifactTypeArg && hasSection) {
                    // Set the command line option for this type, and increment the counter.
                    self.setCommandLineOption(artifactType.option, true);
                    self._optionArtifactCount++;
                } else if (artifactTypeArg && self.getCommandLineOption(artifactType.option) && !hasSection) {
                    // Remove any explicitly specified argument if the manifest doesn't contain that artifact type.
                    self.setCommandLineOption(artifactType.option, undefined);
                    self._optionArtifactCount--;
                }
            });

            // Make sure there were artifacts in the manifest.
            if (self._optionArtifactCount === 0) {
                // Display an error message to indicate that the specified manifest did not contain any artifacts.
                errorMessage = i18n.__('cli_manifest_no_artifacts', {name: manifest});
                result = false;
            }
        } else {
            // If all-Authoring was specified, set all authoring artifact types.
            if (this.getCommandLineOption("allAuthoring")) {
                this.setCommandLineOption("types", true);
                this.setCommandLineOption("assets", true);
                this.setCommandLineOption("webassets", true);
                this.setCommandLineOption("layouts", true);
                this.setCommandLineOption("layoutMappings", true);
                this.setCommandLineOption("content", true);
                this.setCommandLineOption("defaultContent", true);
                this.setCommandLineOption("categories", true);
                this.setCommandLineOption("renditions", true);
                this.setCommandLineOption("imageProfiles", true);
                this.setCommandLineOption("sites", true);
                this.setCommandLineOption("pages", true);
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
            if (this.getCommandLineOption("defaultContent")) {
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
            if (this.getCommandLineOption("publishingSiteRevisions")) {
                this._optionArtifactCount++;
            }
            if (this.getCommandLineOption("imageProfiles")) {
                this._optionArtifactCount++;
            }
            if (this.getCommandLineOption("sites")) {
                this._optionArtifactCount++;
            }
            if (this.getCommandLineOption("pages")) {
                this._optionArtifactCount++;
            }

            // If no object types were specified, set the default object type(s).
            if (this._optionArtifactCount === 0 && defaultArtifactTypes) {
                // Output a debug message to indicate that no artifact types were specified.
                if (this.isDebugEnabled()) {
                    this.debugMessage("No artifact types were specified. The default types will be used.");
                }

                // Set the command line option for each of the default artifact types.
                const self = this;
                defaultArtifactTypes.forEach(function (type) {
                    self.setCommandLineOption(type, true);
                    self._optionArtifactCount++;
                });
            }
        }

        if (result) {
            deferred.resolve();
        } else {
            deferred.reject(new Error(errorMessage));
        }

        return deferred.promise;
    }

    /**
     * Handle the "dir" option specified on the command line.
     *
     * @param {Object} context The API context associated with this command.
     *
     * @returns {Q.Promise} Resolve if the specified dir option is valid, otherwise reject to indicate that command
     *          execution should not continue.
     */
    handleDirOption (context) {
        const deferred = Q.defer();
        const dir = this.getCommandLineOption("dir");

        // If a "dir" option was not specified on the command line, use the current NodeJS working directory.
        if (!dir) {
            this.setApiOption("workingDir", process.cwd());
            deferred.resolve();
            return deferred.promise;
        }

        // A "dir" option was specified on the command line, so handle it accordingly.
        try {
            if (this._createDir) {
                // Make sure the specified directory can be created.
                fs.mkdirSync(dir);
            } else {
                // Make sure the specified directory exists.
                if (!fs.statSync(dir).isDirectory()) {
                    const err = new Error(i18n.__('cli_dir_is_not_a_directory', {dir: dir}));
                    err.code = "ENOTDIR";
                    throw err;
                }
            }
        } catch (err) {
            if (this._createDir) {
                if (err.code !== "EEXIST") {
                    // Display an error message to indicate that the specified directory could not be created.
                    deferred.reject(new Error(i18n.__('cli_could_not_create_dir', {error_code: err.code, dir: dir})));
                    return deferred.promise;
                }
            } else {
                // Display an error message to indicate that the specified directory does not exist.
                deferred.reject(new Error(i18n.__('cli_dir_does_not_exist', {error_code: err.code, dir: dir})));
                return deferred.promise;
            }
        }

        // Set the option for the working directory.
        this.setApiOption("workingDir", dir);

        // Use any options that are defined in that directory.
        options.extendOptionsFromDirectory(context, dir);

        deferred.resolve();
        return deferred.promise;
    }

    /**
     * Handle any errors that occurred during the initialization process.
     *
     * @param {Object} context The API context associated with this command.
     *
     * @returns {Q.Promise} A promise that is resolved if the initialization process was successful, or rejected to indicate that
     *          command execution should not continue.
     */
    handleInitialization (context) {
        const deferred = Q.defer();
        const errors = ToolsApi.getInitializationErrors(context);

        if (errors && errors.length > 0) {
            // There were errors during the initialization process.
            this.displayInitializationErrors(errors);

            // Reset the command line options.
            this.resetCommandLineOptions();

            // Reject the promise to indicate that command execution should not continue.
            deferred.reject();
        } else {
            // No errors occurred during the initialization process.
            deferred.resolve();
        }
        return deferred.promise;
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
        const self = this;
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
        } else if (process.env.WCHTOOLS_PASSWORD) {
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
                    description: i18n.__('cli_base_password_for_user', {"username": username}),
                    hidden: true,
                    required: true
                }
            };
        }

        const keystoreDeferred = Q.defer();
        // If we don't have a password, try the OS keystore.
        if (schemaInput && schemaInput.password) {
            const baseUrl = options.getRelevantOption(context, this.getApiOptions(), "x-ibm-dx-tenant-base-url");
            creds.wchGetCredentials(baseUrl)
                .then(function (osCredentials) {
                    if (osCredentials && osCredentials.username && osCredentials.password) {
                        self.getLogger().info(i18n.__("cli_found_credentials", {"url": baseUrl, "username": osCredentials.username}));
                        // Use the credentials from the OS keystore if a username wasn't specified
                        // or the username specified matches the username retrieved from the OS keystore.
                        if (!username || username === osCredentials.username) {
                            self.setApiOption("username", osCredentials.username);
                            self.setApiOption("password", osCredentials.password);
                            // Reset the schemaInput since we don't need to prompt now.
                            schemaInput = undefined;
                        }
                    }
                    keystoreDeferred.resolve();
                })
                .catch(function (err) {
                    self.getLogger().warn(i18n.__("cli_error_loading_credentials", {"url": baseUrl, "err": err.message}));
                    keystoreDeferred.resolve();
                });
        } else {
            keystoreDeferred.resolve();
        }

        keystoreDeferred.promise.then(function () {
            if (schemaInput) {
                // Prompt for the user name and/or password.
                prompt.message = '';
                prompt.delimiter = ' ';
                prompt.start();
                const schemaProps = {properties: schemaInput};
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
        });

        return defer.promise;
    }

    /**
     * Handle the login to the WCH tenant.
     *
     * @param {Object} context The API context associated with this list command.
     * @param {Object} apiOptions - Optional API settings.
     *
     * @returns {Q.Promise} A promise to be fulfilled with the name of the logged in user.
     */
    handleLogin (context, apiOptions) {
        const self = this;
        return login.login(context, apiOptions)
            .then(function (loginResult) {
                self.getLogger().info(i18n.__("cli_login_successful", {"url": loginResult["x-ibm-dx-tenant-base-url"], "username": loginResult.username}));
                return loginResult;
            });
    }

    /**
     * Handle the path option specified on the command line.
     *
     * @returns {Q.Promise} Resolve if the specified path option is valid, otherwise reject to indicate that
     *          command execution should not continue.
     */
    handlePathOption () {
        const deferred = Q.defer();
        if (this.getCommandLineOption("path")) {
            // Verify that "path" is only used with artifact types that support a path.
            if (this.getCommandLineOption("webassets") || this.getCommandLineOption("assets") || this.getCommandLineOption("types") || this.getCommandLineOption("layouts") || this.getCommandLineOption("layoutMappings") || this.getCommandLineOption("pages")) {
                this.setApiOption("filterPath", this.getCommandLineOption("path"));
                deferred.resolve();
            } else {
                deferred.reject(new Error(i18n.__('cli_invalid_path_option')));
            }
        } else {
            deferred.resolve();
        }

        return deferred.promise;
    }

    /**
     * Handle the site-context option specified on the command line.
     *
     * @returns {Q.Promise} Resolve if the specified site-context option is valid, otherwise reject to indicate that
     *          command execution should not continue.
     */
    handleSiteContextOption() {
        const deferred = Q.defer();
        if (this.getCommandLineOption("siteContext")) {
            // Verify that "siteContext" is only used with artifact types that support a site.
            if (this.getCommandLineOption("sites") || this.getCommandLineOption("pages")) {
                this.setApiOption("filterSite", this.getCommandLineOption("siteContext"));
                deferred.resolve();
            } else {
                deferred.reject(new Error(i18n.__('cli_invalid_siteContext_option')));
            }
        } else {
            deferred.resolve();
        }

        return deferred.promise;
    }

    /**
     * Handle the ready and draft options specified on the command line.
     *
     * @returns {Q.Promise} Resolve if the specified ready and draft options are valid, otherwise reject to
     *          indicate that command execution should not continue.
     */
    handleReadyDraftOptions () {
        const deferred = Q.defer();
        const ready = this.getCommandLineOption("ready");
        const draft = this.getCommandLineOption("draft");
        const manifest = this.getCommandLineOption("manifest");
        if (ready) {
            if (manifest) {
                // Cannot specify both the "ready" and "manifest" options.
                const errorMessage = i18n.__('cli_ready_and_manifest_options');
                deferred.reject(new Error(errorMessage));
            } else {
                if (!draft) {
                    // Ready was specified, draft was not.
                    this.setApiOption("filterReady", true);
                }

                // Note: If both ready and draft were specified, no filtering is required.
                deferred.resolve();
            }
        } else if (draft) {
            if (manifest) {
                // Cannot specify both the "draft" and "manifest" options.
                const errorMessage = i18n.__('cli_draft_and_manifest_options');
                deferred.reject(new Error(errorMessage));
            } else {
                // Draft was specified, ready was not.
                this.setApiOption("filterDraft", true);
                deferred.resolve();
            }
        } else {
            // If neither ready nor draft is specified, default to ready.
            this.setApiOption("filterReady", true);
            deferred.resolve();
        }

        return deferred.promise;
    }

    /**
     * Determine whether this command should include ready sites.
     *
     * @returns {Boolean} A return value of true indicates that this command should include ready sites. A return value
     *                    of false indicates that this command should not include ready sites.
     */
    includeReadySites() {
        let retVal = false;
        if (this.getCommandLineOption("ready") || !this.getCommandLineOption("draft")) {
            // Include ready sites by default.
            retVal = true;
        }
        return retVal;
    }

    /**
     * Determine whether this command should include draft sites.
     *
     * @returns {Boolean} A return value of true indicates that this command should include draft sites. A return value
     *                    of false indicates that this command should not include draft sites.
     */
    includeDraftSites() {
        let retVal = false;
        if (this.getCommandLineOption("draft")) {
            // Only include draft sites if the draft option has been specified.
            retVal = true;
        }
        return retVal;
    }

    /**
     * Filter the list of sites to be used for this command, if necessary.
     *
     * @param {Object} context The API context associated with this command.
     * @param {Object} opts The API options associated with this command.
     */
    filterSiteList(context, opts) {
        // Use the context root specified by the "site-context" option to filter the site list.
        const filterSite = options.getRelevantOption(context, opts, "filterSite");
        if (filterSite && context.siteList) {
            context.siteList = context.siteList.filter(function (site) {
                if (filterSite === "default") {
                    // The default site (or any draft of the default site) is specified using the special value "default".
                    return (site.id === "default") || (site.id.indexOf("default:") === 0);
                } else {
                    // A non-default site must have a contextRoot value that matches the site-context option.
                    return (site.contextRoot === filterSite);
                }
            });
        }
    }

    /**
     * Initialize the list of sites to be used for this command, if necessary.
     *
     * @param {Object} context The API context associated with this command.
     * @param {Boolean} remote A flag that indicates whether to retrieve the remote sites or the local sites.
     * @param {Object} opts The API options associated with this command.
     *
     * @returns {Q.Promise} A promise that will be resolved once the sites have been initialized.
     */
    initSites (context, remote, opts) {
        const deferred = Q.defer();
        const self = this;

        // Only initialize the sites if the tenant supports sites, and the sites or pages option was specified.
        if (!this.isBaseTier(context) && (this.getCommandLineOption("sites") || this.getCommandLineOption("pages"))) {
            if (this.getCommandLineOption("manifest")) {
                // Use the sites defined by the manifest.
                const sites = self.getManifestSiteItems(context);
                const readySites = [];
                const draftSites = [];
                const sitesHelper = ToolsApi.getSitesHelper();
                sites.forEach(function (site) {
                    // Add the site to the ready or draft list.
                    const status = sitesHelper.getStatus(context, site, opts);
                    if (status === "draft") {
                        // The draft site should be handled by this command.
                        draftSites.push(site);
                    } else {
                        // The ready site should be handled by this command.
                        readySites.push(site);
                    }
                });

                // Create a list of ready and draft sites, in the order required by this command.
                context.siteList = self.createSiteList(readySites, draftSites);

                // Filter the sites list
                self.filterSiteList(context, opts);

                // The site list has been set synchronously, so go ahead and resolve the promise.
                deferred.resolve();
            } else {
                // Determine which sites to use for this command (draft, ready, or both).
                const includeReadySites = this.includeReadySites();
                const includeDraftSites = this.includeDraftSites();

                // Get all sites, either local or remote.
                const getSites = remote ? ToolsApi.getRemoteSites : ToolsApi.getLocalSites;
                getSites(context, opts)
                    .then(function (sites) {
                        // Add any existing sites to be used for this command to the context site list.
                        const readySites = [];
                        const draftSites = [];
                        if (sites && sites.length > 0) {
                            const sitesHelper = ToolsApi.getSitesHelper();
                            sites.forEach(function (site) {
                                // Create separate lists of ready sites and draft sites. Note
                                // that a site with no status property is considered "ready".
                                const status = sitesHelper.getStatus(context, site, opts);
                                if (includeReadySites && (status === "ready")) {
                                    // The ready site should be handled by this command.
                                    readySites.push(site);
                                } else if (includeDraftSites && (status === "draft")) {
                                    // The draft site should be handled by this command.
                                    draftSites.push(site);
                                }
                            });
                        } else {
                            // There are no site artifacts in the list. This situation can occur if 1) the sites API
                            // returned an empty list of sites, or 2) there are no local site artifacts.
                            if (remote) {
                                // The sites API returned an empty list of sites. This will happen for older versions of
                                // the sites API that do not support multisites. In that case, it's reasonable to assume
                                // that there is a single "default" site.
                                // FUTURE This logic is only used for compatibility, and can be removed at some point.
                                readySites.push({id: "default"});
                            } else {
                                // There are no local site artifacts. An older tooling version may have pulled pages but
                                // may not have pulled sites. Newer multisite versions of tooling will always pull sites
                                // when pages are pulled, which should mostly avoid the case of no local site artifacts.
                                // For compatibility with local artifacts pulled by older versions of tooling, fall back
                                // to using the default site.
                                if (includeReadySites) {
                                    readySites.push({id: "default"});
                                }
                            }
                        }

                        // Create a list of ready and draft site ids, in the order required by this command.
                        context.siteList = self.createSiteList(readySites, draftSites);

                        // Filter the sites list
                        self.filterSiteList(context, opts);

                        deferred.resolve();
                    })
                    .catch(function (err) {
                        deferred.reject(err);
                    });
            }
        } else {
            // Sites are not required for this command, so just return a resolved promise.
            context.siteList = [];
            deferred.resolve();
        }

        return deferred.promise;
    }

    /**
     * Create a site list to be used for this command, based on the given lists of ready and draft sites.
     *
     * @param {Array} readySites The list of ready sites to be used for this command.
     * @param {Array} draftSites The list of draft sites to be used for this command.
     *
     * @return {Array} A site list to be used for this command.
     */
    createSiteList(readySites, draftSites) {
        // By default, handle the ready sites before the draft sites.
        return readySites.concat(draftSites);
    }

    /**
     * Reset the list of sites to be used for this command.
     *
     * @param {Object} context The API context associated with this command.
     */
    resetSites (context) {
        delete context.siteList;
    }

    /**
     * Write the output manifests if they have been specified for the command.
     */
    saveManifests (context) {
        // Save the results to a manifest, if one was specified.
        const savedManifest = ToolsApi.getManifests().saveManifest(context, this.getApiOptions());
        if (savedManifest) {
            this.getLogger().info(i18n.__("cli_manifest_saved", {"filename": savedManifest}));
        }

        // Save the deletions to a deletions manifest, if one was specified.
        const savedDeletionsManifest = ToolsApi.getManifests().saveDeletionsManifest(context, this.getApiOptions());
        if (savedDeletionsManifest) {
            this.getLogger().info(i18n.__("cli_deletions_manifest_saved", {"filename": savedDeletionsManifest}));
        }
    }

    generateVerboseOutput () {
        return this.getCommandLineOption("verbose");
    }

    getLogConfig () {
        const maxLogSize = utils.getEnvNumericValue('WCHTOOLS_LOG_MAX_SIZE');
        const maxBackups = utils.getEnvNumericValue('WCHTOOLS_LOG_MAX_BACKUPS');
        // Set up logging for the CLI in the directory where the files exist, and then get the logger.
        const fileAppender = {
            type: 'file',
            filename: './' + utils.ProductAbrev + '-cli.log',
            category: cliLog,
            maxLogSize: maxLogSize,
            backups: maxBackups
        };
        // Configure a console appender to output to the console.
        const consoleAppender = {
            type: 'console',
            category: cliLog
        };
        // Disable log4js colors for the console appender if not running in a TTY process.
        if (!process.stdout.isTTY) {
            consoleAppender.layout = {
                type: 'basic'
            };
        }
        // Create a log level filter appender to filter output sent to the log file.
        const fileFilterAppender = {
            type: 'logLevelFilter',
            level: process.env.WCHTOOLS_LOG_LEVEL || 'INFO',
            appender: 'cliLog'
        };
        // Create a log level filter appender to filter output sent to the console.
        const consoleFilterAppender = {
            type: 'logLevelFilter',
            level: 'INFO',
            appender: 'cliOut'
        };

        // Configure the logging, we need an appenders object and a categories object.
        const appenders = {};
        const categories = {};
        // Add the fileAppender using the name 'cliLog' and the fileFilterAppender using 'cliLogFilter'.
        appenders.cliLog = fileAppender;
        appenders.cliLogFilter = fileFilterAppender;
        // Set the categories to use the cliLogFilter appender.
        categories.default = { appenders: ['cliLogFilter'] };
        categories[cliLog] = { appenders: ['cliLogFilter'] };
        // Set the level for the categories to 'ALL' so the filters can be applied.
        categories.default.level = 'ALL';
        categories[cliLog].level = 'ALL';
        if (this.generateVerboseOutput()) {
            // The user has requested verbose output, add the consoleAppender using the name 'cliOut' and the consoleFilterAppender using 'cliOutFilter'.
            appenders.cliOut = consoleAppender;
            appenders.cliOutFilter = consoleFilterAppender;
            // Add the cliOutFilter appender to the categories.
            categories.default.appenders.push('cliOutFilter');
            categories[cliLog].appenders.push('cliOutFilter');
        }
        return {
            appenders: appenders,
            categories: categories
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
        }
        return this._logger;
    }

    /**
     * Is base tier if context has tier === "Base"
     */
     isBaseTier(context) {
         return (context.tier === "Base");
     }
}

module.exports = BaseCommand;
