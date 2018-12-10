/*
Copyright IBM Corporation 2016,2017,2018

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
const PushingDefaultContent =       PREFIX + i18n.__('cli_push_pushing_default_content') + SUFFIX;
const PushingCategories =           PREFIX + i18n.__('cli_push_pushing_categories') + SUFFIX;
const PushingPublishingSiteRevisions = PREFIX + i18n.__('cli_push_pushing_site_revisions') + SUFFIX;
const PushingImageProfiles =        PREFIX + i18n.__('cli_push_pushing_image_profiles') + SUFFIX;
const PushingRenditions =           PREFIX + i18n.__('cli_push_pushing_renditions') + SUFFIX;
const PushingSites =                PREFIX + i18n.__('cli_push_pushing_sites') + SUFFIX;

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

    static _getPagesDisplayHeader(siteItem) {
        const contextName = ToolsApi.getSitesHelper().getSiteContextName(siteItem);
        return PREFIX + i18n.__('cli_push_pushing_pages_for_site', {id: contextName}) + SUFFIX;
    }

    /**
     * Push the specified artifacts.
     */
    doPush () {
        // Create the context for pushing the artifacts of each specified type.
        const toolsApi = new ToolsApi({eventEmitter: new events.EventEmitter()});
        const context = toolsApi.getContext();
        const self = this;

        // Make sure the "dir" option can be handled successfully.
        let error;
        self.handleDirOption(context)
            .then(function() {
                // Make sure the url has been specified.
                return self.handleUrlOption(context);
            })
            .then(function() {
                // Make sure the user name and password have been specified.
                return self.handleAuthenticationOptions(context);
            })
            .then(function() {
                // Login using the current options.
                return login.login(context, self.getApiOptions());
            })
            .then(function () {
                // Handle the manifest options.
                return self.handleManifestOptions(context);
            })
            .then(function () {
                // Handle the cases of no artifact types, "all" authoring types, and using a manifest.
                return self.handleArtifactTypes(context, ["webassets"]);
            })
            .then(function () {
                // Make sure the "named" option can be handled successfully.
                return self.handleNamedOption();
            })
            .then(function () {
                // Make sure the "path" option can be handled successfully.
                return self.handlePathOption();
            })
            .then(function () {
                // Handle the site-context option.
                return self.handleSiteContextOption();
            })
            .then(function () {
                // Handle the ready and draft options.
                return self.handleReadyDraftOptions();
            })
            .then(function () {
                // Check to see if the initialization process was successful.
                return self.handleInitialization(context);
            })
            .then(function () {
                // Initialize the list of local sites to be used for this command, if necessary.
                return self.initSites(context, false, self.getApiOptions());
            })
            .then(function () {
                // Start the display of the pushed artifacts.
                self.startDisplay();

                return self.pushArtifacts(context);
            })
            .catch(function (err) {
                error = err;
            })
            .finally(function () {
                // End the display of the pushed artifacts.
                self.checkWarnAboutSchedule(context, self.getApiOptions())
                .then(warnAboutSchedule =>{
                    self.endDisplay(error, warnAboutSchedule);

                    if (!error) {
                        // Save the results to a manifest, if one was specified.
                        try {
                            // Save the manifests.
                            self.saveManifests(context);
                        } catch (err) {
                            // Log the error that occurred while saving the manifest, but do not fail the push operation.
                            self.getLogger().error(i18n.__("cli_save_manifest_failure", {"err": err.message}));
                        }
                    }

                    // Reset the list of sites used for this command.
                    self.resetSites(context);

                    // Reset the command line options once the command has completed.
                    self.resetCommandLineOptions();
                })
                .catch(error => {
                    self.getLogger().error(error);
                });
            });
    };

    /**
     * Start the display for the pushed artifacts.
     */
    startDisplay () {
        // Display the console message that the list is starting.
        const manifest = this.getCommandLineOption("manifest");
        if (manifest) {
            BaseCommand.displayToConsole(i18n.__('cli_push_manifest_started', {name: manifest}));
        } else if (this._modified) {
            BaseCommand.displayToConsole(i18n.__('cli_push_modified_started'));
        } else {
            BaseCommand.displayToConsole(i18n.__('cli_push_started'));
        }

        // Start the spinner (progress indicator) if we're not doing verbose output.
        if (!this.getCommandLineOption("verbose")) {
            this.spinner = this.getProgram().getSpinner();
            this.spinner.start();
        }
    }

    /*
     * On a push completion, if schedule(s) exist and --publish-now not specified,
     * and ready items are being pushed (thus user may expect immediate publish)
     * then warn the user in the completion message that what they pushed may be
     * waiting on the next scheduled publish
     *
     * @return a promise that resolved to either the next publishing schedule if ready items are going to wait on it, or null
     */
    checkWarnAboutSchedule(context, opts) {
        const deferred = Q.defer();
        if (this._artifactsCount > 0 && !options.getRelevantOption(context, opts, "publish-now") && !options.getRelevantOption(context, opts, "filterDraft")) {
            ToolsApi.getPublishingNextSchedulesHelper().getNextSchedules(context, opts)
                .then(items => {
                    if (items && items.length && items.length>0) {
                        const date = new Date(items[0].releaseDate);
                        deferred.resolve(date.toString());
                    } else {
                        deferred.resolve(null);
                    }
                })
                .catch(err => {
                    this.warningMessage(i18n.__("cli_push_warn_schedule_lookup", {"message": err.message}));
                    deferred.resolve(null);
                });
        } else {
            deferred.resolve(null);
        }

        return deferred.promise;
    }

    /**
     * End the display for the pushed artifacts.
     *
     * @param err An error to be displayed if the pull operation resulted in an error before it was started.
     * @param warnAboutSchedule is set to the next publish date, if a publishing schedule exists and ready items were pushed without --publish-now
     */
    endDisplay (err, warnAboutSchedule) {
        let message;
        const logger = this.getLogger();
        const manifest = this.getCommandLineOption("manifest");
        if (manifest) {
            message = i18n.__('cli_push_manifest_pushing_complete', {name: manifest})
        } else if (this._modified) {
            message = i18n.__('cli_push_modified_pushing_complete');
        } else {
            message = i18n.__('cli_push_pushing_complete');
        }
        logger.info(message);

        if (this.spinner) {
            this.spinner.stop();
        }

        let isError = false;
        let logError = true;
        if (manifest) {
            message = i18n.__('cli_push_manifest_complete', {name: manifest})
        } else if (this._modified) {
            message = i18n.__('cli_push_modified_complete');
        } else {
            message = i18n.__('cli_push_complete');
        }
        if (this._artifactsCount > 0) {
            message += " " + i18n.__n('cli_push_success', this._artifactsCount);
        }
        if (this._artifactsError > 0) {
            message += " " + i18n.__n('cli_push_errors', this._artifactsError);

            // Set the exit code for the process, to indicate that some artifacts had push errors.
            process.exitCode = this.CLI_ERROR_EXIT_CODE;

            if (this._artifactsCount === 0) {
                // No artifacts were pushed and there were errors, so report the results as failure.
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

        if (this._artifactsCount > 0 && warnAboutSchedule) {
            this.warningMessage(i18n.__('cli_push_warn_schedule', {publishNow: "--publish-now", publishDateTime: warnAboutSchedule}));
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
        if (self.getCommandLineOption("createOnly")) {
            self.setApiOption("createOnly", true);
        }
        if (self.getCommandLineOption("publishNow")) {
            self.setApiOption("publish-now", true);
        }
        const setTagVal = self.getCommandLineOption("setTag");
        if (setTagVal) {
            self.setApiOption("setTag", setTagVal);
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
                if (self.getCommandLineOption("defaultContent")) {
                    return self.handlePushPromise(self.pushDefaultContent(context), continueOnError);
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
                    // Get the list of sites to use for pushing pages.
                    const siteItems = context.siteList;

                    // Local function to recursively push pages for one site at a time.
                    let index = 0;
                    const pushPagesBySite = function (context) {
                        if (index < siteItems.length) {
                            return self.handlePushPromise(self.pushPages(context, siteItems[index++]), continueOnError)
                                .then(function () {
                                    return pushPagesBySite(context);
                                });
                        }
                    };

                    return pushPagesBySite(context);
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
        const assetPushed = function (item) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_push_asset_pushed_2', item));
        };
        emitter.on("pushed", assetPushed);
        const resourcePushed = function (item) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_push_resource_pushed_2', item));
        };
        emitter.on("resource-pushed", resourcePushed);

        // The api emits an event when there is a push error, so we log it for the user.
        const assetPushedError = function (error, info) {
            // Set the artifactErrorHandled property of the error. If the push fails, this property can be checked to
            // determine whether the push operation failed because of this same error.
            error.artifactErrorHandled = true;

            // Increment the error count and log the error.
            self._artifactsError++;
            if (typeof info === "object") {
                self.getLogger().error(i18n.__('cli_push_asset_item_error', {id: info.id, name: info.name, path: info.path, message: error.message}));
            } else {
                self.getLogger().error(i18n.__('cli_push_asset_push_error', {name: info, message: error.message}));
            }
        };
        emitter.on("pushed-error", assetPushedError);
        const resourcePushedError = function (error, info) {
            // Set the artifactErrorHandled property of the error. If the push fails, this property can be checked to
            // determine whether the push operation failed because of this same error.
            error.artifactErrorHandled = true;

            // Increment the error count and log the error.
            self._artifactsError++;
            if (typeof info === "object") {
                self.getLogger().error(i18n.__('cli_push_resource_item_error', {id: info.id, name: info.name, path: info.path, message: error.message}));
            } else {
                self.getLogger().error(i18n.__('cli_push_resource_push_error', {name: info, message: error.message}));
            }
        };
        emitter.on("resource-pushed-error", resourcePushedError);

        // If a name is specified, push the named asset.
        // If ignore-timestamps is specified then push all assets.
        // Otherwise only push modified assets (which is the default behavior).
        const apiOptions = this.getApiOptions();

        if (helper.doesDirectoryExist(context, apiOptions)) {
            this._directoriesCount++;
        }

        // Return the promise for the results of the push operation.
        return this.pushItems(context, helper, apiOptions)
            .catch(function (err) {
                // If the promise is rejected, it may mean that an error was encountered before the pull process was
                // started. However, it may also mean that a single item was being pushed and the error was emitted and
                // handled above. If it wasn't already handled, we need to make sure to count the error and rethrow it.
                if (!err.artifactErrorHandled) {
                    self._artifactsError++;
                    throw err;
                }
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
        const imageProfilePushed = function (item) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_push_image_profile_pushed_2', item));
        };
        emitter.on("pushed", imageProfilePushed);

        // The api emits an event when there is a push error, so we log it for the user.
        const imageProfilePushedError = function (error, info) {
            // Set the artifactErrorHandled property of the error. If the push fails, this property can be checked to
            // determine whether the push operation failed because of this same error.
            error.artifactErrorHandled = true;

            // Increment the error count and log the error.
            self._artifactsError++;
            if (typeof info === "object") {
                self.getLogger().error(i18n.__('cli_push_image_profile_item_error', {id: info.id, name: info.name, path: info.path, message: error.message}));
            } else {
                self.getLogger().error(i18n.__('cli_push_image_profile_push_error', {name: info, message: error.message}));
            }
        };
        emitter.on("pushed-error", imageProfilePushedError);

        // If a name is specified, push the named asset.
        // If ignoretimestamps is specified then push all image profiles.
        // Otherwise only push modified image profiles(which is the default behavior).
        const apiOptions = this.getApiOptions();

        if (helper.doesDirectoryExist(context, apiOptions)) {
            this._directoriesCount++;
        }

        // Return the promise for the results of the push operation.
        return this.pushItems(context, helper, apiOptions)
            .catch(function (err) {
                // If the promise is rejected, it may mean that an error was encountered before the pull process was
                // started. However, it may also mean that a single item was being pushed and the error was emitted and
                // handled above. If it wasn't already handled, we need to make sure to count the error and rethrow it.
                if (!err.artifactErrorHandled) {
                    self._artifactsError++;
                    throw err;
                }
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
        const layoutPushed = function (item) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_push_layout_pushed_2', item));
        };
        emitter.on("pushed", layoutPushed);

        // The api emits an event when there is a push error, so we log it for the user.
        const layoutPushedError = function (error, info) {
            // Set the artifactErrorHandled property of the error. If the push fails, this property can be checked to
            // determine whether the push operation failed because of this same error.
            error.artifactErrorHandled = true;

            // Increment the error count and log the error.
            self._artifactsError++;
            if (typeof info === "object") {
                self.getLogger().error(i18n.__('cli_push_layout_item_error', {id: info.id, name: info.name, path: info.path, message: error.message}));
            } else {
                self.getLogger().error(i18n.__('cli_push_layout_push_error', {name: info, message: error.message}));
            }
        };
        emitter.on("pushed-error", layoutPushedError);

        // If a name is specified, push the named layout.
        // If ignore-timestamps is specified then push all artifacts of this type
        // Otherwise only push modified artifacts (which is the default behavior).
        const apiOptions = this.getApiOptions();

        if (helper.doesDirectoryExist(context, apiOptions)) {
            this._directoriesCount++;
        }

        // Return the promise for the results of the push operation.
        return this.pushItems(context, helper, apiOptions)
            .catch(function (err) {
                // If the promise is rejected, it may mean that an error was encountered before the pull process was
                // started. However, it may also mean that a single item was being pushed and the error was emitted and
                // handled above. If it wasn't already handled, we need to make sure to count the error and rethrow it.
                if (!err.artifactErrorHandled) {
                    self._artifactsError++;
                    throw err;
                }
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
        const artifactPushed = function (item) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_push_layout_mapping_pushed_2', item));
        };
        emitter.on("pushed", artifactPushed);

        // The api emits an event when there is a push error, so we log it for the user.
        const artifactPushedError = function (error, info) {
            // Set the artifactErrorHandled property of the error. If the push fails, this property can be checked to
            // determine whether the push operation failed because of this same error.
            error.artifactErrorHandled = true;

            // Increment the error count and log the error.
            self._artifactsError++;
            if (typeof info === "object") {
                self.getLogger().error(i18n.__('cli_push_layout_mapping_item_error', {id: info.id, name: info.name, path: info.path, message: error.message}));
            } else {
                self.getLogger().error(i18n.__('cli_push_layout_mapping_push_error', {name: info, message: error.message}));
            }
        };
        emitter.on("pushed-error", artifactPushedError);

        // If a name is specified, push the named artifact
        // If ignore-timestamps is specified then push all artifacts of this type
        // Otherwise only push modified artifacts (which is the default behavior).
        const apiOptions = this.getApiOptions();

        if (helper.doesDirectoryExist(context, apiOptions)) {
            this._directoriesCount++;
        }

        // Return the promise for the results of the push operation.
        return this.pushItems(context, helper, apiOptions)
            .catch(function (err) {
                // If the promise is rejected, it may mean that an error was encountered before the pull process was
                // started. However, it may also mean that a single item was being pushed and the error was emitted and
                // handled above. If it wasn't already handled, we need to make sure to count the error and rethrow it.
                if (!err.artifactErrorHandled) {
                    self._artifactsError++;
                    throw err;
                }
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
        const renditionPushed = function (item) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_push_rendition_pushed_2', item));
        };
        emitter.on("pushed", renditionPushed);

        // The api emits an event when there is a push error, so we log it for the user.
        const renditionPushedError = function (error, info) {
            // Set the artifactErrorHandled property of the error. If the push fails, this property can be checked to
            // determine whether the push operation failed because of this same error.
            error.artifactErrorHandled = true;

            // Increment the error count and log the error.
            self._artifactsError++;
            if (typeof info === "object") {
                self.getLogger().error(i18n.__('cli_push_rendition_item_error', {id: info.id, name: info.name, path: info.path, message: error.message}));
            } else {
                self.getLogger().error(i18n.__('cli_push_rendition_push_error', {name: info, message: error.message}));
            }
        };
        emitter.on("pushed-error", renditionPushedError);

        // If a name is specified, push the named rendition.
        // If ignore-timestamps is specified then push all assets.
        // Otherwise only push modified renditions (which is the default behavior).
        const apiOptions = this.getApiOptions();

        if (helper.doesDirectoryExist(context, apiOptions)) {
            this._directoriesCount++;
        }

        // Return the promise for the results of the push operation.
        return this.pushItems(context, helper, apiOptions)
            .catch(function (err) {
                // If the promise is rejected, it may mean that an error was encountered before the pull process was
                // started. However, it may also mean that a single item was being pushed and the error was emitted and
                // handled above. If it wasn't already handled, we need to make sure to count the error and rethrow it.
                if (!err.artifactErrorHandled) {
                    self._artifactsError++;
                    throw err;
                }
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
        const categoryPushed = function (item) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_push_cat_pushed_2', item));
        };
        emitter.on("pushed", categoryPushed);

        // The api emits an event when there is a push error, so we log it for the user.
        const categoryPushedError = function (error, info) {
            // Set the artifactErrorHandled property of the error. If the push fails, this property can be checked to
            // determine whether the push operation failed because of this same error.
            error.artifactErrorHandled = true;

            // Increment the error count and log the error.
            self._artifactsError++;
            if (typeof info === "object") {
                self.getLogger().error(i18n.__('cli_push_cat_item_error', {id: info.id, name: info.name, path: info.path, message: error.message}));
            } else {
                self.getLogger().error(i18n.__('cli_push_cat_push_error', {name: info, message: error.message}));
            }
        };
        emitter.on("pushed-error", categoryPushedError);

        // If a name is specified, push the named category.
        // If Ignore-timestamps is specified then push all categories.
        // Otherwise only push modified categories (which is the default behavior).
        const apiOptions = this.getApiOptions();

        if (helper.doesDirectoryExist(context, apiOptions)) {
            this._directoriesCount++;
        }

        // Return the promise for the results of the push operation.
        return this.pushItems(context, helper, apiOptions)
            .catch(function (err) {
                // If the promise is rejected, it may mean that an error was encountered before the pull process was
                // started. However, it may also mean that a single item was being pushed and the error was emitted and
                // handled above. If it wasn't already handled, we need to make sure to count the error and rethrow it.
                if (!err.artifactErrorHandled) {
                    self._artifactsError++;
                    throw err;
                }
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
        const itemTypePushed = function (item) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_push_type_pushed_2', item));
        };
        emitter.on("pushed", itemTypePushed);

        // The api emits an event when there is a push error, so we log it for the user.
        const itemTypePushedError = function (error, info) {
            // Set the artifactErrorHandled property of the error. If the push fails, this property can be checked to
            // determine whether the push operation failed because of this same error.
            error.artifactErrorHandled = true;

            // Increment the error count and log the error.
            self._artifactsError++;
            if (typeof info === "object") {
                self.getLogger().error(i18n.__('cli_push_type_item_error', {id: info.id, name: info.name, path: info.path, message: error.message}));
            } else {
                self.getLogger().error(i18n.__('cli_push_type_push_error', {name: info, message: error.message}));
            }
        };
        emitter.on("pushed-error", itemTypePushedError);

        // If a name is specified, push the named type.
        // If Ignore-timestamps is specified then push all types.
        // Otherwise only push modified types (which is the default behavior).
        const apiOptions = this.getApiOptions();

        if (helper.doesDirectoryExist(context, apiOptions)) {
            this._directoriesCount++;
        }

        // Return the promise for the results of the push operation.
        return this.pushItems(context, helper, apiOptions)
            .catch(function (err) {
                // If the promise is rejected, it may mean that an error was encountered before the pull process was
                // started. However, it may also mean that a single item was being pushed and the error was emitted and
                // handled above. If it wasn't already handled, we need to make sure to count the error and rethrow it.
                if (!err.artifactErrorHandled) {
                    self._artifactsError++;
                    throw err;
                }
            })
            .finally(function () {
                emitter.removeListener("pushed", itemTypePushed);
                emitter.removeListener("pushed-error", itemTypePushedError);
            });
    }

    /**
     * Push the default-content artifacts.
     *
     * @param {Object} context The API context to be used for the push operation.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pushing the default-content artifacts.
     */
    pushDefaultContent (context) {
        const helper = ToolsApi.getDefaultContentHelper();
        const emitter = context.eventEmitter;
        const self = this;

        self.getLogger().info(PushingDefaultContent);

        // The api emits an event when an item is pushed, so we log it for the user.
        const contentPushed = function (item) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_push_default_content_pushed_2', item));
        };
        emitter.on("pushed", contentPushed);

        // The api emits an event when there is a push error, so we log it for the user.
        const contentPushedError = function (error, info) {
            // Set the artifactErrorHandled property of the error. If the push fails, this property can be checked to
            // determine whether the push operation failed because of this same error.
            error.artifactErrorHandled = true;

            // Increment the error count and log the error.
            self._artifactsError++;
            if (typeof info === "object") {
                self.getLogger().error(i18n.__('cli_push_default_content_item_error', {id: info.id, name: info.name, path: info.path, message: error.message}));
            } else {
                self.getLogger().error(i18n.__('cli_push_default_content_push_error', {name: info, message: error.message}));
            }
        };
        emitter.on("pushed-error", contentPushedError);

        // If a name is specified, push the named default-content.
        // If Ignore-timestamps is specified then push all default-content.
        // Otherwise only push modified default-content (which is the default behavior).
        const apiOptions = this.getApiOptions();

        if (helper.doesDirectoryExist(context, apiOptions)) {
            this._directoriesCount++;
        }

        // Return the promise for the results of the push operation.
        return this.pushItems(context, helper, apiOptions)
            .catch(function (err) {
                // If the promise is rejected, it means that an error was encountered before the pull process started,
                // so we need to make sure this error is accounted for.
                if (!err.artifactErrorHandled) {
                    self._artifactsError++;
                    throw err;
                }
            })
            .finally(function () {
                emitter.removeListener("pushed", contentPushed);
                emitter.removeListener("pushed-error", contentPushedError);
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
        const contentPushed = function (item) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_push_content_pushed_2', item));
        };
        emitter.on("pushed", contentPushed);

        // The api emits an event when there is a push error, so we log it for the user.
        const contentPushedError = function (error, info) {
            // Set the artifactErrorHandled property of the error. If the push fails, this property can be checked to
            // determine whether the push operation failed because of this same error.
            error.artifactErrorHandled = true;

            // Increment the error count and log the error.
            self._artifactsError++;
            if (typeof info === "object") {
                self.getLogger().error(i18n.__('cli_push_content_item_error', {id: info.id, name: info.name, path: info.path, message: error.message}));
            } else {
                self.getLogger().error(i18n.__('cli_push_content_push_error', {name: info, message: error.message}));
            }
        };
        emitter.on("pushed-error", contentPushedError);

        // If a name is specified, push the named content.
        // If Ignore-timestamps is specified then push all content.
        // Otherwise only push modified content (which is the default behavior).
        const apiOptions = this.getApiOptions();

        if (helper.doesDirectoryExist(context, apiOptions)) {
            this._directoriesCount++;
        }

        // Return the promise for the results of the push operation.
        return this.pushItems(context, helper, apiOptions)
            .catch(function (err) {
                // If the promise is rejected, it may mean that an error was encountered before the pull process was
                // started. However, it may also mean that a single item was being pushed and the error was emitted and
                // handled above. If it wasn't already handled, we need to make sure to count the error and rethrow it.
                if (!err.artifactErrorHandled) {
                    self._artifactsError++;
                    throw err;
                }
            })
            .finally(function () {
                emitter.removeListener("pushed", contentPushed);
                emitter.removeListener("pushed-error", contentPushedError);
            });
    }

    /**
     * Push the pages for the specified site.
     *
     * @param {Object} context The API context to be used for the push operation.
     * @param {String} siteItem The site containing the pages being pushed.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pushing the artifacts.
     */
    pushPages(context, siteItem) {
        const helper = ToolsApi.getPagesHelper();
        const emitter = context.eventEmitter;
        const opts = utils.cloneOpts(this.getApiOptions(), {siteItem: siteItem});
        const self = this;

        const displayHeader = PushCommand._getPagesDisplayHeader(siteItem);
        self.getLogger().info(displayHeader);

        // The api emits an event when an item is pushed, so we log it for the user.
        const artifactPushed = function (item) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_push_page_pushed_2', item));
        };
        emitter.on("pushed", artifactPushed);

        // The api emits an event when there is a push error, so we log it for the user.
        const artifactPushedError = function (error, info) {
            // Set the artifactErrorHandled property of the error. If the push fails, this property can be checked to
            // determine whether the push operation failed because of this same error.
            error.artifactErrorHandled = true;

            // Increment the error count and log the error.
            self._artifactsError++;
            if (typeof info === "object") {
                self.getLogger().error(i18n.__('cli_push_page_item_error', {id: info.id, name: info.name, path: info.path, message: error.message}));
            } else {
                self.getLogger().error(i18n.__('cli_push_page_push_error', {name: info, message: error.message}));
            }
        };
        emitter.on("pushed-error", artifactPushedError);

        if (helper.doesDirectoryExist(context, opts)) {
            this._directoriesCount++;
        }

        // Return the promise for the results of the push operation.
        return this.pushItems(context, helper, opts)
            .catch(function (err) {
                // If the promise is rejected, it may mean that an error was encountered before the pull process was
                // started. However, it may also mean that a single item was being pushed and the error was emitted and
                // handled above. If it wasn't already handled, we need to make sure to count the error and rethrow it.
                if (!err.artifactErrorHandled) {
                    self._artifactsError++;
                    throw err;
                }
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
        const artifactPushed = function (item) {
            self._artifactsCount++;
            if (item.contextRoot) {
                if (item.status === "draft") {
                    self.getLogger().info(i18n.__('cli_push_draft_site_pushed', item));
                } else {
                    self.getLogger().info(i18n.__('cli_push_site_pushed', item));
                }
            } else {
                if (item.status === "draft") {
                    self.getLogger().info(i18n.__('cli_push_draft_site_pushed_2', item));
                } else {
                    self.getLogger().info(i18n.__('cli_push_site_pushed_2', item));
                }
            }
        };
        emitter.on("pushed", artifactPushed);

        // The api emits an event when there is a push error, so we log it for the user.
        const artifactPushedError = function (error, info) {
            // Set the artifactErrorHandled property of the error. If the push fails, this property can be checked to
            // determine whether the push operation failed because of this same error.
            error.artifactErrorHandled = true;

            // Increment the error count and log the error.
            self._artifactsError++;
            if (typeof info === "object") {
                self.getLogger().error(i18n.__('cli_push_site_item_error', {id: info.id, name: info.name, path: info.path, message: error.message}));
            } else {
                self.getLogger().error(i18n.__('cli_push_site_push_error', {name: info, message: error.message}));
            }
        };
        emitter.on("pushed-error", artifactPushedError);

        // If a name is specified, push the named content.
        // If Ignore-timestamps is specified then push all content.
        // Otherwise only push modified content (which is the default behavior).
        const apiOptions = this.getApiOptions();

        if (helper.doesDirectoryExist(context, apiOptions)) {
            this._directoriesCount++;
        }

        // Return the promise for the results of the push operation.
        return this.pushItems(context, helper, apiOptions)
            .catch(function (err) {
                // If the promise is rejected, it may mean that an error was encountered before the pull process was
                // started. However, it may also mean that a single item was being pushed and the error was emitted and
                // handled above. If it wasn't already handled, we need to make sure to count the error and rethrow it.
                if (!err.artifactErrorHandled) {
                    self._artifactsError++;
                    throw err;
                }
            })
            .finally(function () {
                emitter.removeListener("pushed", artifactPushed);
                emitter.removeListener("pushed-error", artifactPushedError);
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
        const siteRevisionPushed = function (item) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_push_site_revision_pushed', {name: item.name[i18n.locale] || item.name["en"], id: item.id}));
        };
        emitter.on("pushed", siteRevisionPushed);

        // The api emits an event when there is a push error, so we log it for the user.
        const siteRevisionPushedError = function (error, name) {
            // Set the artifactErrorHandled property of the error. If the push fails, this property can be checked to
            // determine whether the push operation failed because of this same error.
            error.artifactErrorHandled = true;

            // Increment the error count and log the error.
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

        // Return the promise for the results of the push operation.
        return this.pushItems(context, helper, apiOptions)
            .catch(function (err) {
                // If the promise is rejected, it may mean that an error was encountered before the pull process was
                // started. However, it may also mean that a single item was being pushed and the error was emitted and
                // handled above. If it wasn't already handled, we need to make sure to count the error and rethrow it.
                if (!err.artifactErrorHandled) {
                    self._artifactsError++;
                    throw err;
                }
            })
            .finally(function () {
                emitter.removeListener("pushed", siteRevisionPushed);
                emitter.removeListener("pushed-error", siteRevisionPushedError);
            });
    }

    /**
     * Push items with the given helper, based on the command line options.
     *
     * @param {Object} context The API context to be used for the push operation.
     * @param {Object} helper The helper to be used for the push operation.
     * @param {Object} opts - The options to be used for the push operation.
     *
     * @return {Q.Promise} A promise to push items using the given helper.
     */
    pushItems (context, helper, opts) {
        if (this.getCommandLineOption("manifest")) {
            // If a manifest was specified then push the items from that manifest.
            return helper.pushManifestItems(context, opts);
        } else if (this.getCommandLineOption("named")) {
            return helper.pushItem(context, this.getCommandLineOption("named"), opts);
        } else if (this.getCommandLineOption("ignoreTimestamps")) {
            return helper.pushAllItems(context, opts);
        } else {
            return helper.pushModifiedItems(context, opts);
        }
    }

    /**
     * Handle the "named" option specified on the command line.
     *
     * @returns {Q.Promise} Resolve if the use of the "named" option is valid, reject to indicate that
     *          command execution should not continue.
     */
    handleNamedOption () {
        const deferred = Q.defer();
        if (this.getCommandLineOption("named")) {
            if (this.getCommandLineOption("ignoreTimestamps")) {
                deferred.reject(new Error(i18n.__('cli_push_name_and_ignore_timestamps')));
                return deferred.promise;
            }

            if (this.getCommandLineOption("path")) {
                deferred.reject(new Error(i18n.__('cli_push_name_and_path')));
                return deferred.promise;
            }

            if (this.getCommandLineOption("pages")) {
                // For backward compatibility, pushing a named page uses the "default" site if no site was specified.
                if (!this.getCommandLineOption("siteContext")) {
                    // The "site-context" option was not specified, so use "default".
                    this.setCommandLineOption("siteContext", "default");
                }
            } else if (this.getCommandLineOption("ready")) {
                // The ready option is only valid with the named option for pages.
                deferred.reject(new Error(i18n.__('cli_push_name_and_ready')));
                return deferred.promise;
            } else if (this.getCommandLineOption("draft")) {
                // The draft option is only valid with the named option for pages.
                deferred.reject(new Error(i18n.__('cli_push_name_and_draft')));
                return deferred.promise;
            }

            if (this.getOptionArtifactCount() !== 1) {
                deferred.reject(new Error(i18n.__('cli_push_name_one_type')));
                return deferred.promise;
            }
        }

        deferred.resolve();
        return deferred.promise;
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
        this.setCommandLineOption("defaultContent", undefined);
        this.setCommandLineOption("categories", undefined);
        this.setCommandLineOption("renditions", undefined);
        this.setCommandLineOption("publishingSiteRevisions", undefined);
        this.setCommandLineOption("named", undefined);
        this.setCommandLineOption("path", undefined);
        this.setCommandLineOption("sites", undefined);
        this.setCommandLineOption("pages", undefined);
        this.setCommandLineOption("createOnly", undefined);
        this.setCommandLineOption("manifest", undefined);
        this.setCommandLineOption("serverManifest", undefined);
        this.setCommandLineOption("writeManifest", undefined);
        this.setCommandLineOption("publishNow", undefined);
        this.setCommandLineOption("setTag", undefined);
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
        .option('-D --default-content',  i18n.__('cli_push_opt_default_content'))
        .option('-C --categories',       i18n.__('cli_push_opt_categories'))
        .option('-r --renditions',       i18n.__('cli_push_opt_renditions'))
        .option('-s --sites',            i18n.__('cli_push_opt_sites'))
        .option('-p --pages',            i18n.__('cli_push_opt_pages'))
        .option('-R --publishing-site-revisions',i18n.__('cli_push_opt_site_revisions'))
        .option('-v --verbose',          i18n.__('cli_opt_verbose'))
        .option('-I --ignore-timestamps',i18n.__('cli_push_opt_ignore_timestamps'))
        .option('-A --all-authoring',    i18n.__('cli_push_opt_all'))
        .option('-f --force-override',   i18n.__('cli_push_opt_force_override'))
        .option('--publish-now',         i18n.__('cli_push_opt_publish_now'))
        .option('--create-only',         i18n.__('cli_push_opt_create_only'))
        .option('--ready',               i18n.__('cli_push_opt_ready'))
        .option('--draft', i18n.__('cli_push_opt_draft'))
        .option('--site-context <contextRoot>', i18n.__('cli_push_opt_siteContext'))
        .option('--named <named>',       i18n.__('cli_push_opt_named'))
        .option('--path <path>',         i18n.__('cli_push_opt_path'))
        .option('--manifest <manifest>', i18n.__('cli_push_opt_use_manifest'))
        .option('--server-manifest <manifest>', i18n.__('cli_push_opt_use_server_manifest'))
        .option('--write-manifest <manifest>', i18n.__('cli_push_opt_write_manifest'))
        .option('--dir <dir>',           i18n.__('cli_push_opt_dir'))
        .option('--set-tag <tag>',       i18n.__('cli_push_opt_set_tag'))
        .option('--user <user>',         i18n.__('cli_opt_user_name'))
        .option('--password <password>', i18n.__('cli_opt_password'))
        .option('--url <url>',           i18n.__('cli_opt_url', {"product_name": utils.ProductName}))
        .action(function (commandLineOptions) {
            const command = new PushCommand(program);
            if (command.setCommandLineOptions(commandLineOptions, this)) {
                if(command.getCommandLineOption("ignoreTimestamps") || command.getCommandLineOption("manifest"))
                    command._modified = false;
                command.doPush();
            }
        });
}

module.exports = pushCommand;
