/*
Copyright IBM Corporation 2016,2017

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
const options = ToolsApi.getOptions();
const login = ToolsApi.getLogin();
const events = require("events");
const Q = require("q");
const ora = require("ora");

const i18n = utils.getI18N(__dirname, ".json", "en");

const PREFIX = "========== ";
const SUFFIX = " ===========";
const PushingTypes =                PREFIX + i18n.__('cli_push_pushing_types') + SUFFIX;
const PushingAssets =               PREFIX + i18n.__('cli_push_pushing_assets') + SUFFIX;
const PushingLayouts =              PREFIX + i18n.__('cli_push_pushing_layouts') + SUFFIX;
const PushingLayoutMappings =       PREFIX + i18n.__('cli_push_pushing_layout_mappings') + SUFFIX;
const PushingContentAssets =        PREFIX + i18n.__('cli_push_pushing_content_assets') + SUFFIX;
const PushingWebAssets =            PREFIX + i18n.__('cli_push_pushing_web_assets') + SUFFIX;
const PushingContentItems =         PREFIX + i18n.__('cli_push_pushing_content') + SUFFIX;
const PushingCategories =           PREFIX + i18n.__('cli_push_pushing_categories') + SUFFIX;
const PushingPublishingSources =    PREFIX + i18n.__('cli_push_pushing_sources') + SUFFIX;
const PushingPublishingProfiles =   PREFIX + i18n.__('cli_push_pushing_profiles') + SUFFIX;
const PushingPublishingSiteRevisions = PREFIX + i18n.__('cli_push_pushing_site_revisions') + SUFFIX;
const PushingImageProfiles =        PREFIX + i18n.__('cli_push_pushing_image_profiles') + SUFFIX;
const PushingRenditions =           PREFIX + i18n.__('cli_push_pushing_renditions') + SUFFIX;
const PushingSites =                PREFIX + i18n.__('cli_push_pushing_sites') + SUFFIX;
const PushingPages =                PREFIX + i18n.__('cli_push_pushing_pages') + SUFFIX;

class PushCommand extends BaseCommand {
    /**
     * Create a PushCommand object.
     *
     * @param {object} program A Commander program object.
     */
    constructor (program) {
        super(program);

        // Only pull modified artifacts by default.
        this._modified = true;

        // Keep track of the number of directories that exist.
        this._directoriesCount = 0;
    }

    /**
     * Push the specified artifacts.
     */
    doPush () {
        // Create the context for pushing the artifacts of each specified type.
        const toolsApi = new ToolsApi({eventEmitter: new events.EventEmitter()});
        const context = toolsApi.getContext();
        const self = this;

        // Handle the cases of either no artifact type options being specified, or the "all" option being specified.
        self.handleArtifactTypes(["webassets"]);

        // Make sure the "named", "dir" and "path" options can be handled successfully.
        if (!self.handleNamedOption() || !self.handleDirOption(context) || !self.handlePathOption()) {
            return;
        }

        // Check to see if the initialization process was successful.
        if (!self.handleInitialization(context)) {
            return;
        }

        // Make sure the url has been specified.
        self.handleUrlOption(context)
            .then(function() {
                // Make sure the user name and password have been specified.
                return self.handleAuthenticationOptions(context);
            })
            .then(function() {
                // Login using the current options.
                return login.login(context, self.getApiOptions());
            })
            .then(function () {
                // Start the display of the pushed artifacts.
                self.startDisplay();

                return self.pushArtifacts(context);
            })
            .then(function () {
                // End the display of the pushed artifacts.
                self.endDisplay();
            })
            .catch(function (err) {
                // End the display of the pushed artifacts.
                self.endDisplay(err);
            })
            .finally(function () {
                // Reset the command line options once the command has completed.
                self.resetCommandLineOptions();
            });
    };

    /**
     * Start the display for the pushed artifacts.
     */
    startDisplay () {
        // Display the console message that the list is starting.
        BaseCommand.displayToConsole(i18n.__(this._modified ? 'cli_push_modified_started' : 'cli_push_started'));

        // Start the spinner (progress indicator) if we're not doing verbose output.
        if (!this.getCommandLineOption("verbose")) {
            this.spinner = ora();
            this.spinner.start();
        }
    }

    /**
     * End the display for the pushed artifacts.
     *
     * @param err An error to be displayed if the pull operation resulted in an error before it was started.
     */
    endDisplay (err) {
        const logger = this.getLogger();
        logger.info(i18n.__(this._modified ? 'cli_push_modified_pushing_complete' : 'cli_push_pushing_complete'));
        if (this.spinner) {
            this.spinner.stop();
        }

        let isError = false;
        let logError = true;
        let message = i18n.__(this._modified ? 'cli_push_modified_complete' : 'cli_push_complete');
        if (this._artifactsCount > 0) {
            message += " " + i18n.__n('cli_push_success', this._artifactsCount);
        }
        if (this._artifactsError > 0) {
            message += " " + i18n.__n('cli_push_errors', this._artifactsError);

            // Set the exit code for the process, to indicate that some artifacts had push errors.
            process.exitCode = this.CLI_ERROR_EXIT_CODE;

            if (this._artifactsCount === 0) {
                // No artifacts were pulled and there were errors, so report the results as failure.
                isError = true;
            }
        }
        if ((this._artifactsCount > 0 || this._artifactsError > 0) && !this.getCommandLineOption("verbose")) {
            message += " " + i18n.__('cli_log_non_verbose');
        }
        if (this._artifactsCount === 0 && this._artifactsError === 0) {
            if (err) {
                // The error pased in has already been logged, but still needs to be displayed to the console.
                message = err.message;
                isError = true;
                logError = false;
            } else if (this._directoriesCount === 0) {
                message = i18n.__('cli_push_no_directories_exist');
                isError = true;
            } else if (this.getCommandLineOption("ignoreTimestamps")) {
                message = i18n.__('cli_push_complete_ignore_timestamps_nothing_pushed');
            } else {
                message = i18n.__('cli_push_complete_nothing_pushed');
            }
        }

        // Display the results as success or failure, as determined above.
        if (isError) {
            if (logError) {
                this.getLogger().error(message);
            }
            this.errorMessage(message);
        } else {
            this.getLogger().info(message);
            this.successMessage(message);
        }
    }

    /**
     * Push the artifacts for the types specified on the command line.
     *
     * @param {Object} context The API context associated with this push command.
     *
     * @return {Q.Promise} A promise that resolves when all artifacts of the specified types have been pushed.
     */
    pushArtifacts (context) {
        const deferred = Q.defer();
        const self = this;

        // Determine whether to continue pushing subsequent artifact types on error.
        const continueOnError = options.getProperty(context, "continueOnError");

        if (self.getCommandLineOption("forceOverride")) {
            self.setApiOption("force-override", true);
        }

        self.readyToPush()
            .then(function () {
                if (self.getCommandLineOption("imageProfiles")) {
                    return self.handlePushPromise(self.pushImageProfiles(context), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("categories")) {
                    return self.handlePushPromise(self.pushCategories(context), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("assets") || self.getCommandLineOption("webassets")) {
                    return self.handlePushPromise(self.pushAssets(context), continueOnError);
                }
            })
            .then(function() {
                if (self.getCommandLineOption("renditions")) {
                    return self.handlePushPromise(self.pushRenditions(context), continueOnError);
                }
            })
            .then(function() {
                if (self.getCommandLineOption("layouts")) {
                    return self.handlePushPromise(self.pushLayouts(context), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("types")) {
                    return self.handlePushPromise(self.pushTypes(context), continueOnError);
                }
            })
            .then(function() {
                if (self.getCommandLineOption("layoutMappings")) {
                    return self.handlePushPromise(self.pushLayoutMappings(context), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("content")) {
                    return self.handlePushPromise(self.pushContent(context), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("sites")) {
                    return self.handlePushPromise(self.pushSites(context), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("pages")) {
                    return self.handlePushPromise(self.pushPages(context), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("publishingSources")) {
                    return self.handlePushPromise(self.pushSources(context), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("publishingProfiles")) {
                    return self.handlePushPromise(self.pushProfiles(context), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("publishingSiteRevisions")) {
                    return self.handlePushPromise(self.pushSiteRevisions(context), continueOnError);
                }
            })
            .then(function () {
                deferred.resolve();
            })
            .catch(function (err) {
                self.getLogger().error(err.message);
                deferred.reject(err);
            });

        return deferred.promise;
    }

    /**
     * Prepare to push the artifacts.
     *
     * @returns {Q.Promise} A promise that is resolved when the command is ready to push artifacts.
     */
    readyToPush () {
        const deferred = Q.defer();

        // There is currently no condition to wait for.
        deferred.resolve();

        return deferred.promise;
    }

    /**
     * Handle the given push promise according to whether errors should be returned to the caller.
     *
     * @param {Q.Promise} promise A promise to push some artifacts.
     * @param {boolean} continueOnError Flag specifying whether to continue pulling subsequent artifact types on error.
     *
     * @returns {Q.Promise} A promise that is resolved when the push has completed.
     */
    handlePushPromise (promise, continueOnError) {
        const self = this;
        if (continueOnError) {
            // Create a nested promise. Any error thrown by this promise will be logged, but not returned to the caller.
            const deferredPush = Q.defer();
            promise
                .then(function () {
                    deferredPush.resolve();
                })
                .catch(function (err) {
                    const logger = self.getLogger();
                    logger.error(err.message);
                    deferredPush.resolve();
                });
            return deferredPush.promise;
        } else {
            // Any error thrown by this promise will be returned to the caller.
            return promise;
        }
    }

    /**
     * Push the asset artifacts.
     *
     * @param {Object} context The API context to be used for the push operation.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pushing the asset artifacts.
     */
    pushAssets (context) {
        const helper = ToolsApi.getAssetsHelper();
        const emitter = context.eventEmitter;
        const self = this;

        if (this.getCommandLineOption("assets") && this.getCommandLineOption("webassets")) {
            this.getLogger().info(PushingAssets);
            this.setApiOption(helper.ASSET_TYPES, helper.ASSET_TYPES_BOTH);
        }  else if (this.getCommandLineOption("assets")) {
            this.getLogger().info(PushingContentAssets);
            this.setApiOption(helper.ASSET_TYPES, helper.ASSET_TYPES_CONTENT_ASSETS);
        } else {
            this.getLogger().info(PushingWebAssets);
            this.setApiOption(helper.ASSET_TYPES, helper.ASSET_TYPES_WEB_ASSETS);
        }

        // The api emits an event when an item is pushed, so we log it for the user.
        const assetPushed = function (name) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_push_asset_pushed', {name: name}));
        };
        emitter.on("pushed", assetPushed);
        const resourcePushed = function (name) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_push_resource_pushed', {name: name}));
        };
        emitter.on("resource-pushed", resourcePushed);

        // The api emits an event when there is a push error, so we log it for the user.
        const assetPushedError = function (error, path) {
            self._artifactsError++;
            self.getLogger().error(i18n.__('cli_push_asset_push_error', {name: path, message: error.message}));
        };
        emitter.on("pushed-error", assetPushedError);
        const resourcePushedError = function (error, path) {
            self._artifactsError++;
            self.getLogger().error(i18n.__('cli_push_resource_push_error', {name: path, message: error.message}));
        };
        emitter.on("resource-pushed-error", resourcePushedError);

        // If a name is specified, push the named asset.
        // If ignore-timestamps is specified then push all assets.
        // Otherwise only push modified assets (which is the default behavior).
        const apiOptions = this.getApiOptions();

        if (helper.doesDirectoryExist(context, apiOptions)) {
            this._directoriesCount++;
        }

        let assetsPromise;
        if (this.getCommandLineOption("named")) {
            assetsPromise = helper.pushItem(context, this.getCommandLineOption("named"), apiOptions);
        } else if (this.getCommandLineOption("ignoreTimestamps")) {
            assetsPromise = helper.pushAllItems(context, apiOptions);
        } else {
            assetsPromise = helper.pushModifiedItems(context, apiOptions);
        }

        // Return the promise for the results of the action.
        return assetsPromise
            .catch(function (err) {
                // If the promise is rejected, it means that an error was encountered before the pull process started,
                // so we need to make sure this error is accounted for.
                self._artifactsError++;
                throw err;
            })
            .finally(function () {
                emitter.removeListener("pushed", assetPushed);
                emitter.removeListener("resource-pushed", resourcePushed);
                emitter.removeListener("pushed-error", assetPushedError);
                emitter.removeListener("resource-pushed-error", resourcePushedError);
            });
    }

    /**
     * Push image profile artifacts.
     *
     * @param {Object} context The API context to be used for the push operation.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pushing the artifacts.
     */
    pushImageProfiles (context) {
        const helper = ToolsApi.getImageProfilesHelper();
        const emitter = context.eventEmitter;
        const self = this;

        self.getLogger().info(PushingImageProfiles);

        // The api emits an event when an item is pushed, so we log it for the user.
        const imageProfilePushed = function (name) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_push_image_profile_pushed', {name: name}));
        };
        emitter.on("pushed", imageProfilePushed);

        // The api emits an event when there is a push error, so we log it for the user.
        const imageProfilePushedError = function (error, name) {
            self._artifactsError++;
            self.getLogger().error(i18n.__('cli_push_image_profile_push_error', {name: name, message: error.message}));
        };
        emitter.on("pushed-error", imageProfilePushedError);

        // If a name is specified, push the named asset.
        // If ignoretimestamps is specified then push all image profiles.
        // Otherwise only push modified image profiles(which is the default behavior).
        const apiOptions = this.getApiOptions();

        if (helper.doesDirectoryExist(context, apiOptions)) {
            this._directoriesCount++;
        }

        let imageProfilesPromise;
        if (this.getCommandLineOption("named")) {
            imageProfilesPromise = helper.pushItem(context, this.getCommandLineOption("named"), apiOptions);
        } else if (this.getCommandLineOption("ignoreTimestamps")) {
            imageProfilesPromise = helper.pushAllItems(context, apiOptions);
        } else {
            imageProfilesPromise = helper.pushModifiedItems(context, apiOptions);
        }

        // Return the promise for the results of the action.
        return imageProfilesPromise
            .catch(function (err) {
                // If the promise is rejected, it means that an error was encountered before the pull process started,
                // so we need to make sure this error is accounted for.
                self._artifactsError++;
                throw err;
            })
            .finally(function () {
                emitter.removeListener("pushed", imageProfilePushed);
                emitter.removeListener("pushed-error", imageProfilePushedError);
            });
    }

    /**
     * Push layouts
     *
     * @param {Object} context The API context to be used for the push operation.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pushing the artifacts.
     */
    pushLayouts (context) {
        const helper = ToolsApi.getLayoutsHelper();
        const emitter = context.eventEmitter;
        const self = this;

        self.getLogger().info(PushingLayouts);

        // The api emits an event when an item is pushed, so we log it for the user.
        const layoutPushed = function (name) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_push_layout_pushed', {name: name}));
        };
        emitter.on("pushed", layoutPushed);

        // The api emits an event when there is a push error, so we log it for the user.
        const layoutPushedError = function (error, name) {
            self._artifactsError++;
            self.getLogger().error(i18n.__('cli_push_layout_push_error', {name: name, message: error.message}));
        };
        emitter.on("pushed-error", layoutPushedError);

        // If a name is specified, push the named layout.
        // If ignore-timestamps is specified then push all artifacts of this type
        // Otherwise only push modified artifacts (which is the default behavior).
        const apiOptions = this.getApiOptions();

        if (helper.doesDirectoryExist(context, apiOptions)) {
            this._directoriesCount++;
        }

        let artifactsPromise;
        if (this.getCommandLineOption("named")) {
            artifactsPromise = helper.pushItem(context, this.getCommandLineOption("named"), apiOptions);
        } else if (this.getCommandLineOption("ignoreTimestamps")) {
            artifactsPromise = helper.pushAllItems(context, apiOptions);
        } else {
            artifactsPromise = helper.pushModifiedItems(context, apiOptions);
        }

        // Return the promise for the results of the action.
        return artifactsPromise
            .catch(function (err) {
                // If the promise is rejected, it means that an error was encountered before the pull process started,
                // so we need to make sure this error is accounted for.
                self._artifactsError++;
                throw err;
            })
            .finally(function () {
                emitter.removeListener("pushed", layoutPushed);
                emitter.removeListener("pushed-error", layoutPushedError);
            });
    }

    /**
     * Push layout mappings
     *
     * @param {Object} context The API context to be used for the push operation.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pushing the artifacts.
     */
    pushLayoutMappings (context) {
        const helper = ToolsApi.getLayoutMappingsHelper();
        const emitter = context.eventEmitter;
        const self = this;

        self.getLogger().info(PushingLayoutMappings);

        // The api emits an event when an item is pushed, so we log it for the user.
        const artifactPushed = function (name) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_push_layout_mapping_pushed', {name: name}));
        };
        emitter.on("pushed", artifactPushed);

        // The api emits an event when there is a push error, so we log it for the user.
        const artifactPushedError = function (error, name) {
            self._artifactsError++;
            self.getLogger().error(i18n.__('cli_push_layout_mapping_push_error', {name: name, message: error.message}));
        };
        emitter.on("pushed-error", artifactPushedError);

        // If a name is specified, push the named artifact
        // If ignore-timestamps is specified then push all artifacts of this type
        // Otherwise only push modified artifacts (which is the default behavior).
        const apiOptions = this.getApiOptions();

        if (helper.doesDirectoryExist(context, apiOptions)) {
            this._directoriesCount++;
        }

        let artifactsPromise;
        if (this.getCommandLineOption("named")) {
            artifactsPromise = helper.pushItem(context, this.getCommandLineOption("named"), apiOptions);
        } else if (this.getCommandLineOption("ignoreTimestamps")) {
            artifactsPromise = helper.pushAllItems(context, apiOptions);
        } else {
            artifactsPromise = helper.pushModifiedItems(context, apiOptions);
        }

        // Return the promise for the results of the action.
        return artifactsPromise
            .catch(function (err) {
                // If the promise is rejected, it means that an error was encountered before the pull process started,
                // so we need to make sure this error is accounted for.
                self._artifactsError++;
                throw err;
            })
            .finally(function () {
                emitter.removeListener("pushed", artifactPushed);
                emitter.removeListener("pushed-error", artifactPushedError);
            });
    }

    /**
     * Push rendition artifacts.
     *
     * @param {Object} context The API context to be used for the push operation.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pushing the artifacts.
     */
    pushRenditions (context) {
        const helper = ToolsApi.getRenditionsHelper();
        const emitter = context.eventEmitter;
        const self = this;

        self.getLogger().info(PushingRenditions);

        // The api emits an event when an item is pushed, so we log it for the user.
        const renditionPushed = function (name) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_push_rendition_pushed', {name: name}));
        };
        emitter.on("pushed", renditionPushed);

        // The api emits an event when there is a push error, so we log it for the user.
        const renditionPushedError = function (error, name) {
            self._artifactsError++;
            self.getLogger().error(i18n.__('cli_push_rendition_push_error', {name: name, message: error.message}));
        };
        emitter.on("pushed-error", renditionPushedError);

        // If a name is specified, push the named rendition.
        // If ignore-timestamps is specified then push all assets.
        // Otherwise only push modified renditions (which is the default behavior).
        const apiOptions = this.getApiOptions();

        if (helper.doesDirectoryExist(context, apiOptions)) {
            this._directoriesCount++;
        }

        let renditionsPromise;
        if (this.getCommandLineOption("named")) {
            renditionsPromise = helper.pushItem(context, this.getCommandLineOption("named"), apiOptions);
        } else if (this.getCommandLineOption("ignoreTimestamps")) {
            renditionsPromise = helper.pushAllItems(context, apiOptions);
        } else {
            renditionsPromise = helper.pushModifiedItems(context, apiOptions);
        }

        // Return the promise for the results of the action.
        return renditionsPromise
            .catch(function (err) {
                // If the promise is rejected, it means that an error was encountered before the pull process started,
                // so we need to make sure this error is accounted for.
                self._artifactsError++;
                throw err;
            })
            .finally(function () {
                emitter.removeListener("pushed", renditionPushed);
                emitter.removeListener("pushed-error", renditionPushedError);
            });
    }

    /**
     * Push the category artifacts.
     *
     * @param {Object} context The API context to be used for the push operation.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pushing the category artifacts.
     */
    pushCategories (context) {
        const helper = ToolsApi.getCategoriesHelper();
        const emitter = context.eventEmitter;
        const self = this;

        self.getLogger().info(PushingCategories);

        // The api emits an event when an item is pushed, so we log it for the user.
        const categoryPushed = function (name) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_push_cat_pushed', {name: name}));
        };
        emitter.on("pushed", categoryPushed);

        // The api emits an event when there is a push error, so we log it for the user.
        const categoryPushedError = function (error, name) {
            self._artifactsError++;
            self.getLogger().error(i18n.__('cli_push_cat_push_error', {name: name, message: error.message}));
        };
        emitter.on("pushed-error", categoryPushedError);

        // If a name is specified, push the named category.
        // If Ignore-timestamps is specified then push all categories.
        // Otherwise only push modified categories (which is the default behavior).
        const apiOptions = this.getApiOptions();

        if (helper.doesDirectoryExist(context, apiOptions)) {
            this._directoriesCount++;
        }

        let categoriesPromise;
        if (this.getCommandLineOption("named")) {
            categoriesPromise = helper.pushItem(context, this.getCommandLineOption("named"), apiOptions);
        } else if (this.getCommandLineOption("ignoreTimestamps")) {
            categoriesPromise = helper.pushAllItems(context, apiOptions);
        } else {
            categoriesPromise = helper.pushModifiedItems(context, apiOptions);
        }

        // Return the promise for the results of the action.
        return categoriesPromise
            .catch(function (err) {
                // If the promise is rejected, it means that an error was encountered before the pull process started,
                // so we need to make sure this error is accounted for.
                self._artifactsError++;
                throw err;
            })
            .finally(function () {
                emitter.removeListener("pushed", categoryPushed);
                emitter.removeListener("pushed-error", categoryPushedError);
            });
    }

    /**
     * Push the type artifacts.
     *
     * @param {Object} context The API context to be used for the push operation.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pushing the type artifacts.
     */
    pushTypes (context) {
        const helper = ToolsApi.getItemTypeHelper();
        const emitter = context.eventEmitter;
        const self = this;

        self.getLogger().info(PushingTypes);

        // The api emits an event when an item is pushed, so we log it for the user.
        const itemTypePushed = function (name) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_push_type_pushed', {name: name}));
        };
        emitter.on("pushed", itemTypePushed);

        // The api emits an event when there is a push error, so we log it for the user.
        const itemTypePushedError = function (error, name) {
            self._artifactsError++;
            self.getLogger().error(i18n.__('cli_push_type_push_error', {name: name, message: error.message}));
        };
        emitter.on("pushed-error", itemTypePushedError);

        // If a name is specified, push the named type.
        // If Ignore-timestamps is specified then push all types.
        // Otherwise only push modified types (which is the default behavior).
        const apiOptions = this.getApiOptions();

        if (helper.doesDirectoryExist(context, apiOptions)) {
            this._directoriesCount++;
        }

        let typePromise;
        if (this.getCommandLineOption("named")) {
            typePromise = helper.pushItem(context, this.getCommandLineOption("named"), apiOptions);
        } else if (this.getCommandLineOption("ignoreTimestamps")) {
            typePromise = helper.pushAllItems(context, apiOptions);
        } else {
            typePromise = helper.pushModifiedItems(context, apiOptions);
        }

        // Return the promise for the results of the action.
        return typePromise
            .catch(function (err) {
                // If the promise is rejected, it means that an error was encountered before the pull process started,
                // so we need to make sure this error is accounted for.
                self._artifactsError++;
                throw err;
            })
            .finally(function () {
                emitter.removeListener("pushed", itemTypePushed);
                emitter.removeListener("pushed-error", itemTypePushedError);
            });
    }

    /**
     * Push the content artifacts.
     *
     * @param {Object} context The API context to be used for the push operation.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pushing the content artifacts.
     */
    pushContent (context) {
        const helper = ToolsApi.getContentHelper();
        const emitter = context.eventEmitter;
        const self = this;

        self.getLogger().info(PushingContentItems);

        // The api emits an event when an item is pushed, so we log it for the user.
        const contentPushed = function (name) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_push_content_pushed', {name: name}));
        };
        emitter.on("pushed", contentPushed);

        // The api emits an event when there is a push error, so we log it for the user.
        const contentPushedError = function (error, name) {
            self._artifactsError++;
            self.getLogger().error(i18n.__('cli_push_content_push_error', {name: name, message: error.message}));
        };
        emitter.on("pushed-error", contentPushedError);

        // If a name is specified, push the named content.
        // If Ignore-timestamps is specified then push all content.
        // Otherwise only push modified content (which is the default behavior).
        const apiOptions = this.getApiOptions();

        if (helper.doesDirectoryExist(context, apiOptions)) {
            this._directoriesCount++;
        }

        let contentsPromise;
        if (this.getCommandLineOption("named")) {
            contentsPromise = helper.pushItem(context, this.getCommandLineOption("named"), apiOptions);
        } else if (this.getCommandLineOption("ignoreTimestamps")) {
            contentsPromise = helper.pushAllItems(context, apiOptions);
        } else {
            contentsPromise = helper.pushModifiedItems(context, apiOptions);
        }

        // Return the promise for the results of the action.
        return contentsPromise
            .catch(function (err) {
                // If the promise is rejected, it means that an error was encountered before the pull process started,
                // so we need to make sure this error is accounted for.
                self._artifactsError++;
                throw err;
            })
            .finally(function () {
                emitter.removeListener("pushed", contentPushed);
                emitter.removeListener("pushed-error", contentPushedError);
            });
    }

    /**
     * Push the page definitions
     *
     * @param {Object} context The API context to be used for the push operation.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pushing the artifacts.
     */
    pushPages (context) {
        const helper = ToolsApi.getPagesHelper();
        const emitter = context.eventEmitter;
        const self = this;

        self.getLogger().info(PushingPages);

        // The api emits an event when an item is pushed, so we log it for the user.
        const artifactPushed = function (name) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_push_page_pushed', {name: name}));
        };
        emitter.on("pushed", artifactPushed);

        // The api emits an event when there is a push error, so we log it for the user.
        const artifactPushedError = function (error, name) {
            self._artifactsError++;
            self.getLogger().error(i18n.__('cli_push_page_push_error', {name: name, message: error.message}));
        };
        emitter.on("pushed-error", artifactPushedError);

        // If a name is specified, push the named content.
        // If Ignore-timestamps is specified then push all content.
        // Otherwise only push modified content (which is the default behavior).
        const apiOptions = this.getApiOptions();

        if (helper.doesDirectoryExist(context, apiOptions)) {
            this._directoriesCount++;
        }

        let artifactsPromise;
        if (this.getCommandLineOption("named")) {
            artifactsPromise = helper.pushItem(context, this.getCommandLineOption("named"), apiOptions);
        } else if (this.getCommandLineOption("ignoreTimestamps")) {
            artifactsPromise = helper.pushAllItems(context, apiOptions);
        } else {
            artifactsPromise = helper.pushModifiedItems(context, apiOptions);
        }

        // Return the promise for the results of the action.
        return artifactsPromise
            .catch(function (err) {
                // If the promise is rejected, it means that an error was encountered before the pull process started,
                // so we need to make sure this error is accounted for.
                self._artifactsError++;
                throw err;
            })
            .finally(function () {
                emitter.removeListener("pushed", artifactPushed);
                emitter.removeListener("pushed-error", artifactPushedError);
            });
    }

    /**
     * Push the site definitions
     *
     * @param {Object} context The API context to be used for the push operation.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pushing the artifacts.
     */
    pushSites (context) {
        const helper = ToolsApi.getSitesHelper();
        const emitter = context.eventEmitter;
        const self = this;

        self.getLogger().info(PushingSites);

        // The api emits an event when an item is pushed, so we log it for the user.
        const artifactPushed = function (name) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_push_site_pushed', {name: name}));
        };
        emitter.on("pushed", artifactPushed);

        // The api emits an event when there is a push error, so we log it for the user.
        const artifactPushedError = function (error, name) {
            self._artifactsError++;
            self.getLogger().error(i18n.__('cli_push_site_push_error', {name: name, message: error.message}));
        };
        emitter.on("pushed-error", artifactPushedError);

        // If a name is specified, push the named content.
        // If Ignore-timestamps is specified then push all content.
        // Otherwise only push modified content (which is the default behavior).
        const apiOptions = this.getApiOptions();

        if (helper.doesDirectoryExist(context, apiOptions)) {
            this._directoriesCount++;
        }

        let artifactsPromise;
        if (this.getCommandLineOption("named")) {
            artifactsPromise = helper.pushItem(context, this.getCommandLineOption("named"), apiOptions);
        } else if (this.getCommandLineOption("ignoreTimestamps")) {
            artifactsPromise = helper.pushAllItems(context, apiOptions);
        } else {
            artifactsPromise = helper.pushModifiedItems(context, apiOptions);
        }

        // Return the promise for the results of the action.
        return artifactsPromise
            .catch(function (err) {
                // If the promise is rejected, it means that an error was encountered before the pull process started,
                // so we need to make sure this error is accounted for.
                self._artifactsError++;
                throw err;
            })
            .finally(function () {
                emitter.removeListener("pushed", artifactPushed);
                emitter.removeListener("pushed-error", artifactPushedError);
            });
    }

    /**
     * Push the (publishing) source artifacts.
     *
     * @param {Object} context The API context to be used for the push operation.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pushing the source artifacts.
     */
    pushSources (context) {
        const helper = ToolsApi.getPublishingSourcesHelper();
        const emitter = context.eventEmitter;
        const self = this;

        self.getLogger().info(PushingPublishingSources);

        // The api emits an event when an item is pushed, so we log it for the user.
        const sourcePushed = function (name) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_push_source_pushed', {name: name}));
        };
        emitter.on("pushed", sourcePushed);

        // The api emits an event when there is a push error, so we log it for the user.
        const sourcePushedError = function (error, name) {
            self._artifactsError++;
            self.getLogger().error(i18n.__('cli_push_source_push_error', {name: name, message: error.message}));
        };
        emitter.on("pushed-error", sourcePushedError);

        // If a name is specified, push the named source.
        // If Ignore-timestamps is specified then push all sources. Otherwise only
        // push modified sources (which is the default behavior).
        const apiOptions = this.getApiOptions();

        if (helper.doesDirectoryExist(context, apiOptions)) {
            this._directoriesCount++;
        }

        let sourcesPromise;
        if (this.getCommandLineOption("named")) {
            sourcesPromise = helper.pushItem(context, this.getCommandLineOption("named"), apiOptions);
        } else if (this.getCommandLineOption("ignoreTimestamps")) {
            sourcesPromise = helper.pushAllItems(context, apiOptions);
        } else {
            sourcesPromise = helper.pushModifiedItems(context, apiOptions);
        }

        // Return the promise for the results of the action.
        return sourcesPromise
            .catch(function (err) {
                // If the promise is rejected, it means that an error was encountered before the pull process started,
                // so we need to make sure this error is accounted for.
                self._artifactsError++;
                throw err;
            })
            .finally(function () {
                emitter.removeListener("pushed", sourcePushed);
                emitter.removeListener("pushed-error", sourcePushedError);
            });
    }

    /**
     * Push the (publishing) profile artifacts.
     *
     * @param {Object} context The API context to be used for the push operation.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pushing the profile artifacts.
     */
    pushProfiles (context) {
        const helper = ToolsApi.getPublishingProfilesHelper();
        const emitter = context.eventEmitter;
        const self = this;

        self.getLogger().info(PushingPublishingProfiles);

        // The api emits an event when an item is pushed, so we log it for the user.
        const profilePushed = function (name) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_push_profile_pushed', {name: name}));
        };
        emitter.on("pushed", profilePushed);

        // The api emits an event when there is a push error, so we log it for the user.
        const profilePushedError = function (error, name) {
            self._artifactsError++;
            self.getLogger().error(i18n.__('cli_push_profile_push_error', {name: name, message: error.message}));
        };
        emitter.on("pushed-error", profilePushedError);

        // If a name is specified, push the named profile.
        // If Ignore-timestamps is specified then push all profiles. Otherwise only
        // push modified profiles (which is the default behavior).
        const apiOptions = this.getApiOptions();

        if (helper.doesDirectoryExist(context, apiOptions)) {
            this._directoriesCount++;
        }

        let profilesPromise;
        if (this.getCommandLineOption("named")) {
            profilesPromise = helper.pushItem(context, this.getCommandLineOption("named"), apiOptions);
        } else if (this.getCommandLineOption("ignoreTimestamps")) {
            profilesPromise = helper.pushAllItems(context, apiOptions);
        } else {
            profilesPromise = helper.pushModifiedItems(context, apiOptions);
        }

        // Return the promise for the results of the action.
        return profilesPromise
            .catch(function (err) {
                // If the promise is rejected, it means that an error was encountered before the pull process started,
                // so we need to make sure this error is accounted for.
                self._artifactsError++;
                throw err;
            })
            .finally(function () {
                emitter.removeListener("pushed", profilePushed);
                emitter.removeListener("pushed-error", profilePushedError);
            });
    }

    /**
     * Push the (publishing) site revision artifacts.
     *
     * @param {Object} context The API context to be used for the push operation.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pushing the site revision artifacts.
     */
    pushSiteRevisions (context) {
        const helper = ToolsApi.getPublishingSiteRevisionsHelper();
        const emitter = context.eventEmitter;
        const self = this;

        self.getLogger().info(PushingPublishingSiteRevisions);

        // The api emits an event when an item is pushed, so we log it for the user.
        const siteRevisionPushed = function (name) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_push_site_revision_pushed', {name: name}));
        };
        emitter.on("pushed", siteRevisionPushed);

        // The api emits an event when there is a push error, so we log it for the user.
        const siteRevisionPushedError = function (error, name) {
            self._artifactsError++;
            self.getLogger().error(i18n.__('cli_push_site_revision_push_error', {name: name, message: error.message}));
        };
        emitter.on("pushed-error", siteRevisionPushedError);

        // If a name is specified, push the named profile.
        // If Ignore-timestamps is specified then push all profiles. Otherwise only
        // push modified profiles (which is the default behavior).
        const apiOptions = this.getApiOptions();

        if (helper.doesDirectoryExist(context, apiOptions)) {
            this._directoriesCount++;
        }

        let artifactPromise;
        if (this.getCommandLineOption("named")) {
            artifactPromise = helper.pushItem(context, this.getCommandLineOption("named"), apiOptions);
        } else if (this.getCommandLineOption("ignoreTimestamps")) {
            artifactPromise = helper.pushAllItems(context, apiOptions);
        } else {
            artifactPromise = helper.pushModifiedItems(context, apiOptions);
        }

        // Return the promise for the results of the action.
        return artifactPromise
            .catch(function (err) {
                // If the promise is rejected, it means that an error was encountered before the pull process started,
                // so we need to make sure this error is accounted for.
                self._artifactsError++;
                throw err;
            })
            .finally(function () {
                emitter.removeListener("pushed", siteRevisionPushed);
                emitter.removeListener("pushed-error", siteRevisionPushedError);
            });
    }

    /**
     * Handle the "named" option specified on the command line.
     *
     * @returns {boolean} A value of true if the use of the "named" option is valid, otherwise false to indicate that
     *          command execution should not continue.
     */
    handleNamedOption () {
        if (this.getCommandLineOption("named") && this.getCommandLineOption("ignoreTimestamps")) {
            this.errorMessage(i18n.__('cli_push_name_and_ignore_timestamps'));
            this.resetCommandLineOptions();
            return false;
        }

        if (this.getCommandLineOption("named") && this.getCommandLineOption("path")) {
            this.errorMessage(i18n.__('cli_push_name_and_path'));
            this.resetCommandLineOptions();
            return false;
        }

        if (this.getCommandLineOption("named") && this.getOptionArtifactCount() !== 1) {
            this.errorMessage(i18n.__('cli_push_name_one_type'));
            this.resetCommandLineOptions();
            return false;
        }

        return true;
    }

    /**
     * Reset the command line options for this command.
     *
     * NOTE: This is used to reset the values when the command is invoked by the mocha testing. Normally the process
     * ends after the command is executed and so these values go away. But when running the tests, the process isn't
     * terminated and these values need to be reset.
     */
    resetCommandLineOptions () {
        this.setCommandLineOption("types", undefined);
        this.setCommandLineOption("assets", undefined);
        this.setCommandLineOption("webassets", undefined);
        this.setCommandLineOption("layouts", undefined);
        this.setCommandLineOption("layoutMappings", undefined);
        this.setCommandLineOption("imageProfiles", undefined);
        this.setCommandLineOption("content", undefined);
        this.setCommandLineOption("categories", undefined);
        this.setCommandLineOption("renditions", undefined);
        this.setCommandLineOption("publishingSources", undefined);
        this.setCommandLineOption("publishingProfiles", undefined);
        this.setCommandLineOption("publishingSiteRevisions", undefined);
        this.setCommandLineOption("named", undefined);
        this.setCommandLineOption("path", undefined);
        this.setCommandLineOption("sites", undefined);
        this.setCommandLineOption("pages", undefined);

        super.resetCommandLineOptions();
    }
}

function pushCommand (program) {
    program
        .command('push')
        .description(i18n.__('cli_push_description'))
        .option('-t --types',            i18n.__('cli_push_opt_types'))
        .option('-a --assets',           i18n.__('cli_push_opt_assets'))
        .option('-w --webassets',        i18n.__('cli_push_opt_web_assets'))
        .option('-l --layouts',          i18n.__('cli_push_opt_layouts'))
        .option('-m --layout-mappings',  i18n.__('cli_push_opt_layout_mappings'))
        .option('-i --image-profiles',   i18n.__('cli_push_opt_image_profiles'))
        .option('-c --content',          i18n.__('cli_push_opt_content'))
        .option('-C --categories',       i18n.__('cli_push_opt_categories'))
        .option('-r --renditions',       i18n.__('cli_push_opt_renditions'))
        .option('-s --sites',            i18n.__('cli_push_opt_sites'))
        .option('-p --pages',            i18n.__('cli_push_opt_pages'))
        .option('-P --publishing-profiles',i18n.__('cli_push_opt_profiles'))
        .option('-R --publishing-site-revisions',i18n.__('cli_push_opt_site_revisions'))
        .option('-S --publishing-sources',i18n.__('cli_push_opt_sources'))
        .option('-v --verbose',          i18n.__('cli_opt_verbose'))
        .option('-I --ignore-timestamps',i18n.__('cli_push_opt_ignore_timestamps'))
        .option('-A --all-authoring',    i18n.__('cli_push_opt_all'))
        .option('-f --force-override',   i18n.__('cli_push_opt_force_override'))
        .option('--named <named>',       i18n.__('cli_push_opt_named'))
        .option('--path <path>',         i18n.__('cli_push_opt_path'))
        .option('--dir <dir>',           i18n.__('cli_push_opt_dir'))
        .option('--user <user>',         i18n.__('cli_opt_user_name'))
        .option('--password <password>', i18n.__('cli_opt_password'))
        .option('--url <url>',           i18n.__('cli_opt_url', {"product_name": utils.ProductName}))
        .action(function (commandLineOptions) {
            const command = new PushCommand(program);
            if (command.setCommandLineOptions(commandLineOptions, this)) {
                if(command.getCommandLineOption("ignoreTimestamps"))
                    command._modified = false;
                command.doPush();
            }
        });
}

module.exports = pushCommand;
