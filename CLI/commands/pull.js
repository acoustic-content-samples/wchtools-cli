/*
Copyright IBM Corporation 2016, 2017

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
const prompt = require("prompt");
const Q = require("q");
const ora = require("ora");

const i18n = utils.getI18N(__dirname, ".json", "en");

const PREFIX = "========== ";
const SUFFIX = " ===========";
const PullingTypes = PREFIX + i18n.__('cli_pull_pulling_types') + SUFFIX;
const PullingAssets = PREFIX + i18n.__('cli_pull_pulling_assets') + SUFFIX;
const PullingContentAssets = PREFIX + i18n.__('cli_pull_pulling_content_assets') + SUFFIX;
const PullingWebAssets = PREFIX + i18n.__('cli_pull_pulling_web_assets') + SUFFIX;
const PullingLayouts = PREFIX + i18n.__('cli_pull_pulling_layouts') + SUFFIX;
const PullingLayoutMappings = PREFIX + i18n.__('cli_pull_pulling_layout_mappings') + SUFFIX;
const PullingImageProfiles = PREFIX + i18n.__('cli_pull_pulling_image_profiles') + SUFFIX;
const PullingContents = PREFIX + i18n.__('cli_pull_pulling_content') + SUFFIX;
const PullingCategories = PREFIX + i18n.__('cli_pull_pulling_categories') + SUFFIX;
const PullingRenditions = PREFIX + i18n.__('cli_pull_pulling_renditions') + SUFFIX;
const PullingPublishingProfiles = PREFIX + i18n.__('cli_pull_pulling_profiles') + SUFFIX;
const PullingPublishingSources = PREFIX + i18n.__('cli_pull_pulling_sources') + SUFFIX;
const PullingPublishingSiteRevisions = PREFIX + i18n.__('cli_pull_pulling_site_revisions') + SUFFIX;
const PullingSites = PREFIX + i18n.__('cli_pull_pulling_sites') + SUFFIX;
const PullingPages = PREFIX + i18n.__('cli_pull_pulling_pages') + SUFFIX;

// Define the names of the events emitted by the API during a pull operation.
const EVENT_ITEM_PULLED = "pulled";
const EVENT_ITEM_PULLED_WARNING = "pulled-warning";
const EVENT_ITEM_PULLED_ERROR = "pulled-error";
const EVENT_RESOURCE_PULLED = "resource-pulled";
const EVENT_RESOURCE_PULLED_ERROR = "resource-pulled-error";
const EVENT_ITEM_LOCAL_ONLY = "local-only";
const EVENT_RESOURCE_LOCAL_ONLY = "resource-local-only";

class PullCommand extends BaseCommand {
    /**
     * Create a PullCommand object.
     *
     * @param {object} program A Commander program object.
     */
    constructor (program) {
        super(program);

        // The directory specified by the "dir" command line option should be created.
        this.setCreateDir(true);

        // Only pull modified artifacts by default.
        this._modified = true;
    }

    /**
     * Pull the specified artifacts.
     */
    doPull () {
        // Create the context for pulling the artifacts of each specified type.
        const toolsApi = new ToolsApi({eventEmitter: new events.EventEmitter()});
        const context = toolsApi.getContext();
        const self = this;

        // Handle the cases of either no artifact type options being specified, or the "all" option being specified.
        self.handleArtifactTypes(["webassets"]);

        // Make sure the "dir" option can be handled successfully.
        if (!self.handleDirOption(context)) {
            return;
        }

        // Check to see if the initialization process was successful.
        if (!self.handleInitialization(context)) {
            return;
        }

        // Make sure the url has been specified.
        let error;
        self.handleUrlOption(context)
            .then(function () {
                // Make sure the user name and password have been specified.
                return self.handleAuthenticationOptions(context);
            })
            .then(function () {
                // Login using the current options.
                return login.login(context, self.getApiOptions());
            })
            .then(function () {
                // Start the display of the pulled artifacts.
                self.startDisplay();

                return self.pullArtifacts(context);
            })
            .catch(function (err) {
                // Pass the error through to the endDisplay() method.
                error = err;
            })
            .finally(function () {
                // End the display of the pulled artifacts.
                self.endDisplay(error);

                // Reset the command line options once the command has completed.
                self.resetCommandLineOptions();
            });
    }

    /**
     * Start the display for the pulled artifacts.
     */
    startDisplay () {
        // Display the console message that the list is starting.
        BaseCommand.displayToConsole( i18n.__(this._modified ? 'cli_pull_modified_started' : 'cli_pull_started'));

        // Start the spinner (progress indicator) if we're not doing verbose output.
        if (!this.getCommandLineOption("verbose")) {
            this.spinner = ora();
            this.spinner.start();
        }
    }

    /**
     * End the display for the pulled artifacts.
     *
     * @param err An error to be displayed if the pull operation resulted in an error before it was started.
     */
    endDisplay (err) {
        const logger = this.getLogger();
        logger.info(PREFIX + i18n.__(this._modified ? 'cli_pull_modified_pulling_complete' : 'cli_pull_pulling_complete') + SUFFIX);
        if (this.spinner) {
            this.spinner.stop();
        }

        // FUTURE This is not translation compatible. We need to convert this to a string with substitution parameters.
        let isError = false;
        let logError = true;
        let message = i18n.__(this._modified ? 'cli_pull_modified_complete' : 'cli_pull_complete');
        if (this._artifactsCount > 0) {
            message += " " + i18n.__n('cli_pull_success', this._artifactsCount);
        }
        if (this._artifactsError > 0) {
            message += " " + i18n.__n('cli_pull_errors', this._artifactsError);

            // Set the exit code for the process, to indicate that some artifacts had pull errors.
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
            } else if (this.getCommandLineOption("ignoreTimestamps")) {
                message = i18n.__('cli_pull_complete_ignore_timestamps_nothing_pulled');
            } else {
                message = i18n.__('cli_pull_complete_nothing_pulled');
            }
        }

        // Display the results as success or failure, as determined above.
        if (isError) {
            if (logError) {
                this.getLogger().error(message);
            }
            this.errorMessage(message);
        } else {
            logger.info(message);
            this.successMessage(message);
        }
    }

    /**
     * Pull the artifacts for the types specified on the command line.
     *
     * @param {Object} context The API context associated with this pull command.
     *
     * @return {Q.Promise} A promise that resolves when all artifacts of the specified types have been pulled.
     */
    pullArtifacts (context) {
        const deferred = Q.defer();
        const self = this;

        // Determine whether to continue pulling subsequent artifact types on error.
        const continueOnError = options.getProperty(context, "continueOnError");

        self.readyToPull()
            .then(function () {
                if (self.getCommandLineOption("imageProfiles")) {
                    return self.handlePullPromise(self.pullImageProfiles(context), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("categories")) {
                    return self.handlePullPromise(self.pullCategories(context), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("assets") || self.getCommandLineOption("webassets")) {
                    return self.handlePullPromise(self.pullAssets(context), continueOnError);
                }
            })
            .then(function() {
                if (self.getCommandLineOption("layouts") && !self.isBaseTier(context)) {
                    return self.handlePullPromise(self.pullLayouts(context), continueOnError);
                }
            })
            .then(function() {
                if (self.getCommandLineOption("layoutMappings") && !self.isBaseTier(context)) {
                    return self.handlePullPromise(self.pullLayoutMappings(context), continueOnError);
                }
            })
            .then(function() {
                if (self.getCommandLineOption("renditions")) {
                    return self.handlePullPromise(self.pullRenditions(context), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("types")) {
                    return self.handlePullPromise(self.pullTypes(context), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("content")) {
                    return self.handlePullPromise(self.pullContent(context), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("sites") && !self.isBaseTier(context)) {
                    return self.handlePullPromise(self.pullSites(context), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("pages") && !self.isBaseTier(context)) {
                    return self.handlePullPromise(self.pullPages(context), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("publishingProfiles")) {
                    return self.handlePullPromise(self.pullProfiles(context), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("publishingSiteRevisions")) {
                    return self.handlePullPromise(self.pullSiteRevisions(context), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("publishingSources")) {
                    return self.handlePullPromise(self.pullSources(context), continueOnError);
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
     * Prepare to pull the artifacts.
     *
     * @returns {Q.Promise} A promise that is resolved when the command is ready to pull artifacts.
     */
    readyToPull () {
        const deferred = Q.defer();

        // Set the API option to determine whether to delete local files that do not exist on the content hub.
        this.setApiOption("deletions", this.getCommandLineOption("deletions"));

        // There is currently no condition to wait for.
        deferred.resolve();

        return deferred.promise;
    }

    /**
     * Handle the given pull promise according to whether errors should be returned to the caller.
     *
     * @param {Q.Promise} promise A promise to pull some artifacts.
     * @param {boolean} continueOnError Flag specifying whether to continue pulling subsequent artifact types on error.
     *
     * @returns {Q.Promise} A promise that is resolved when the pull has completed.
     */
    handlePullPromise (promise, continueOnError) {
        const self = this;
        if (continueOnError) {
            // Create a nested promise. Any error thrown by this promise will be logged, but not returned to the caller.
            const deferredPull = Q.defer();
            promise
                .then(function () {
                    deferredPull.resolve();
                })
                .catch(function (err) {
                    const logger = self.getLogger();
                    logger.error(err.message);
                    deferredPull.resolve();
                });
            return deferredPull.promise;
        } else {
            // Any error thrown by this promise will be returned to the caller.
            return promise;
        }
    }

    /**
     *
     * @param {Object} context The API context associated with this pull command.
     * @param {Function} deleteFn
     * @param {Array} items
     * @param {String} promptKey
     * @param {String} successKey
     * @param {String} errorKey
     * @param {Object} opts
     */
    deleteLocalItems (context, deleteFn, items, promptKey, successKey, errorKey, opts) {
        // Delete the local items that do not exist on the server.
        const self = this;
        const logger = self.getLogger();

        if (self.getCommandLineOption("quiet")) {
            // Do not prompt for deletions if the quiet option was specified.
            const promises = [];
            items.forEach(function (item) {
                // Delete each specified item.
                const promise = deleteFn(context, item, opts)
                    .then(function () {
                        const successEntry = i18n.__(item.id ? successKey: "cli_pull_invalid_file_deleted", item);
                        logger.info(successEntry);
                    })
                    .catch(function () {
                        const errorEntry = i18n.__(item.id ? errorKey: "cli_pull_invalid_file_delete_error", item);
                        logger.error(errorEntry);
                    });

                // Add each delete promise to the list.
                promises.push(promise);
            });

            // Return a promise that is resolved when all delete promises have been settled.
            return Q.allSettled(promises);
        } else {
            // Prompt to delete each item that only exists locally.
            const schemaInput = {};
            items.forEach(function (item) {
                // For each matching file, add a confirmation prompt (keyed by the artifact id).
                schemaInput[item.id || item.path] =
                    {
                        description: i18n.__(item.id ? promptKey: "cli_pull_invalid_file_delete_confirm", item),
                        required: true
                    };
            });
            // After all the prompts have been displayed, execute each of the confirmed delete operations.
            const deferred = Q.defer();
            const schemaProps = {properties: schemaInput};
            prompt.message = '';
            prompt.delimiter = ' ';
            prompt.start();
            prompt.get(schemaProps, function (err, result) {
                // Filter out the items that were not confirmed.
                items = items.filter(function (item) {
                    return (result[item.id || item.path] === "y");
                });

                if (items.length > 0) {
                    const promises = [];
                    items.forEach(function (item) {
                        // Delete each specified item.
                        const promise = deleteFn(context, item, opts)
                            .then(function () {
                                const successEntry = i18n.__(item.id ? successKey: "cli_pull_invalid_file_deleted", item);
                                logger.info(successEntry);
                            })
                            .catch(function () {
                                const errorEntry = i18n.__(item.id ? errorKey: "cli_pull_invalid_file_delete_error", item);
                                logger.error(errorEntry);
                            });

                        // Add each delete promise to the list.
                        promises.push(promise);
                    });

                    // Resolve the returned promise when all delete promises have been settled.
                    Q.allSettled(promises)
                        .then(function () {
                            deferred.resolve();
                        });
                } else {
                    deferred.resolve();
                }
            });

            return deferred.promise;
        }
    }

    /**
     * Pull the asset artifacts.
     *
     * @param {Object} context The API context to be used for the pull operation.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pulling the asset artifacts.
     */
    pullAssets (context) {
        const helper = ToolsApi.getAssetsHelper();
        const emitter = context.eventEmitter;
        const self = this;

        if (this.getCommandLineOption("assets") && this.getCommandLineOption("webassets")) {
            this.getLogger().info(PullingAssets);
            this.setApiOption(helper.ASSET_TYPES, helper.ASSET_TYPES_BOTH);
        } else if (this.getCommandLineOption("assets")) {
            this.getLogger().info(PullingContentAssets);
            this.setApiOption(helper.ASSET_TYPES, helper.ASSET_TYPES_CONTENT_ASSETS);
        } else {
            this.getLogger().info(PullingWebAssets);
            this.setApiOption(helper.ASSET_TYPES, helper.ASSET_TYPES_WEB_ASSETS);
        }

        // The API emits an event when an item is pulled, so we log it for the user.
        const assetPulled = function (item) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_pull_asset_pulled_2', item));
        };
        emitter.on(EVENT_ITEM_PULLED, assetPulled);

        // The API emits an event when a resource is pulled, so we log it for the user.
        const resourcePulled = function (item) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_pull_resource_pulled_2', item));
        };
        emitter.on(EVENT_RESOURCE_PULLED, resourcePulled);

        // The API can emit a warning event when an item is pulled, so we log it for the user.
        const assetPulledWarning = function (name) {
            self.getLogger().warn(i18n.__('cli_pull_asset_digest_mismatch', {asset: name}));
            self.warningMessage(i18n.__('cli_pull_asset_digest_mismatch', {asset: name}));
        };
        emitter.on(EVENT_ITEM_PULLED_WARNING, assetPulledWarning);

        // The API emits an event when there is an error pulling an item, so we log it for the user.
        const assetPulledError = function (error, name) {
            self._artifactsError++;
            self.getLogger().error(i18n.__('cli_pull_asset_pull_error', {name: name, message: error.message}));
        };
        emitter.on(EVENT_ITEM_PULLED_ERROR, assetPulledError);

        // The API emits an event when there is an error pulling a resource, so we log it for the user.
        const resourcePulledError = function (error, id) {
            self._artifactsError++;
            self.getLogger().error(i18n.__('cli_pull_resource_pull_error', {id: id, message: error.message}));
        };
        emitter.on(EVENT_RESOURCE_PULLED_ERROR, resourcePulledError);

        // The API emits an event when a local item does not exist on the server, so add it to the list to delete.
        const itemsToDelete = [];
        const itemLocalOnly = function (item) {
            itemsToDelete.push((typeof item === "object") ? item : {path: item});
        };
        emitter.on(EVENT_ITEM_LOCAL_ONLY, itemLocalOnly);

        // The API emits an event when a local resource does not exist on the server, so add it to the list to delete.
        const resourcesToDelete = [];
        const resourceLocalOnly = function (resource) {
            resourcesToDelete.push(resource);
        };
        emitter.on(EVENT_RESOURCE_LOCAL_ONLY, resourceLocalOnly);

        // Get the API options and start the pull operation.
        const apiOptions = this.getApiOptions();
        let assetPromise;
        if (this.getCommandLineOption("ignoreTimestamps") || this.getCommandLineOption("deletions")) {
            // If ignoring timestamps or syncing deletions then pull all items.
            assetPromise = helper.pullAllItems(context, apiOptions);
        } else {
            // The default behavior is to only pull modified items.
            assetPromise = helper.pullModifiedItems(context, apiOptions);
        }

        // Return the promise for the results of the pull operation.
        return assetPromise
            .then(function (items) {
                // Handle any local items that need to be deleted.
                if (itemsToDelete.length > 0) {
                    // Delete the local items that do not exist on the server.
                    const deleteFn = helper.deleteLocalItem.bind(helper);
                    const promptKey = "cli_pull_asset_delete_confirm";
                    const successKey = "cli_pull_asset_deleted";
                    const errorKey = "cli_pull_asset_delete_error";
                    return self.deleteLocalItems(context, deleteFn, itemsToDelete, promptKey, successKey, errorKey, apiOptions)
                        .then(function () {
                            return items;
                        });
                } else {
                    return items;
                }
            })
            .then(function (items) {
                // Handle any local resources that need to be deleted.
                if (resourcesToDelete.length > 0) {
                    // Delete the local resources that do not exist on the server.
                    const deleteFn = helper.deleteLocalResource.bind(helper);
                    const promptKey = "cli_pull_resource_delete_confirm";
                    const successKey = "cli_pull_resource_deleted";
                    const errorKey = "cli_pull_resource_delete_error";
                    return self.deleteLocalItems(context, deleteFn, resourcesToDelete, promptKey, successKey, errorKey, apiOptions)
                        .then(function () {
                            return items;
                        });
                } else {
                    return items;
                }
            })
            .catch(function (err) {
                // If the promise is rejected, it means that an error was encountered before the pull process started,
                // so we need to make sure this error is accounted for.
                self._artifactsError++;
                throw err;
            })
            .finally(function () {
                emitter.removeListener(EVENT_ITEM_PULLED, assetPulled);
                emitter.removeListener(EVENT_ITEM_PULLED_WARNING, assetPulledWarning);
                emitter.removeListener(EVENT_ITEM_PULLED_ERROR, assetPulledError);
                emitter.removeListener(EVENT_RESOURCE_PULLED, resourcePulled);
                emitter.removeListener(EVENT_RESOURCE_PULLED_ERROR, resourcePulledError);
                emitter.removeListener(EVENT_ITEM_LOCAL_ONLY, itemLocalOnly);
                emitter.removeListener(EVENT_RESOURCE_LOCAL_ONLY, resourceLocalOnly);
            });
    }

    /**
     * Pull image profiles
     *
     * @param {Object} context The API context to be used for the pull operation.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pulling the asset artifacts.
     */
    pullImageProfiles (context) {
        const helper = ToolsApi.getImageProfilesHelper();
        const emitter = context.eventEmitter;
        const self = this;

        self.getLogger().info(PullingImageProfiles);

        // The API emits an event when an item is pulled, so we log it for the user.
        const imageProfilePulled = function (item) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_pull_image_profile_pulled_2', item));
        };
        emitter.on(EVENT_ITEM_PULLED, imageProfilePulled);

        // The API emits an event when there is an error pulling an item, so we log it for the user.
        const imageProfilePulledError = function (error, name) {
            self._artifactsError++;
            self.getLogger().error(i18n.__('cli_pull_image_profile_pull_error', {name: name, message: error.message}));
        };
        emitter.on(EVENT_ITEM_PULLED_ERROR, imageProfilePulledError);

        // The API emits an event when a local item does not exist on the server, so add it to the list to delete.
        const itemsToDelete = [];
        const itemLocalOnly = function (item) {
            itemsToDelete.push(item);
        };
        emitter.on(EVENT_ITEM_LOCAL_ONLY, itemLocalOnly);

        // Get the API options and start the pull operation.
        const apiOptions = this.getApiOptions();
        let imageProfilesPromise;
        if (this.getCommandLineOption("ignoreTimestamps") || this.getCommandLineOption("deletions")) {
            // If ignoring timestamps or syncing deletions then pull all items.
            imageProfilesPromise = helper.pullAllItems(context, apiOptions);
        } else {
            // The default behavior is to only pull modified items.
            imageProfilesPromise = helper.pullModifiedItems(context, apiOptions);
        }

        // Return the promise for the results of the pull operation.
        return imageProfilesPromise
            .then(function (items) {
                // Handle any local items that need to be deleted.
                if (itemsToDelete.length > 0) {
                    // Delete the local items that do not exist on the server.
                    const deleteFn = helper.deleteLocalItem.bind(helper);
                    const promptKey = "cli_pull_image_profile_delete_confirm";
                    const successKey = "cli_pull_image_profile_deleted";
                    const errorKey = "cli_pull_image_profile_delete_error";
                    return self.deleteLocalItems(context, deleteFn, itemsToDelete, promptKey, successKey, errorKey, apiOptions)
                        .then(function () {
                            return items;
                        });
                } else {
                    return items;
                }
            })
            .catch(function (err) {
                // If the promise is rejected, it means that an error was encountered before the pull process started,
                // so we need to make sure this error is accounted for.
                self._artifactsError++;
                throw err;
            })
            .finally(function () {
                emitter.removeListener(EVENT_ITEM_PULLED, imageProfilePulled);
                emitter.removeListener(EVENT_ITEM_PULLED_ERROR, imageProfilePulledError);
                emitter.removeListener(EVENT_ITEM_LOCAL_ONLY, itemLocalOnly);
            });
    }

    /**
     * Pull the layout artifacts.
     *
     * @param {Object} context The API context to be used for the pull operation.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pulling the layout artifacts.
     */
    pullLayouts (context) {
        const helper = ToolsApi.getLayoutsHelper();
        const emitter = context.eventEmitter;
        const self = this;

        self.getLogger().info(PullingLayouts);

        // The API emits an event when an item is pulled, so we log it for the user.
        const artifactPulled = function (item) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_pull_layout_pulled_2', item));
        };
        emitter.on(EVENT_ITEM_PULLED, artifactPulled);

        // The API emits an event when there is an error pulling an item, so we log it for the user.
        const artifactPulledError = function (error, name) {
            self._artifactsError++;
            self.getLogger().error(i18n.__('cli_pull_layout_pull_error', {name: name, message: error.message}));
        };
        emitter.on(EVENT_ITEM_PULLED_ERROR, artifactPulledError);

        // The API emits an event when a local item does not exist on the server, so add it to the list to delete.
        const itemsToDelete = [];
        const itemLocalOnly = function (item) {
            itemsToDelete.push(item);
        };
        emitter.on(EVENT_ITEM_LOCAL_ONLY, itemLocalOnly);

        // Get the API options and start the pull operation.
        const apiOptions = this.getApiOptions();
        let artifactPromise;
        if (this.getCommandLineOption("ignoreTimestamps") || this.getCommandLineOption("deletions")) {
            // If ignoring timestamps or syncing deletions then pull all items.
            artifactPromise = helper.pullAllItems(context, apiOptions);
        } else {
            // The default behavior is to only pull modified items.
            artifactPromise = helper.pullModifiedItems(context, apiOptions);
        }

        // Return the promise for the results of the pull operation.
        return artifactPromise
            .then(function (items) {
                // Handle any local items that need to be deleted.
                if (itemsToDelete.length > 0) {
                    // Delete the local items that do not exist on the server.
                    const deleteFn = helper.deleteLocalItem.bind(helper);
                    const promptKey = "cli_pull_layout_delete_confirm";
                    const successKey = "cli_pull_layout_deleted";
                    const errorKey = "cli_pull_layout_delete_error";
                    return self.deleteLocalItems(context, deleteFn, itemsToDelete, promptKey, successKey, errorKey, apiOptions)
                        .then(function () {
                            return items;
                        });
                } else {
                    return items;
                }
            })
            .catch(function (err) {
                // If the promise is rejected, it means that an error was encountered before the pull process started,
                // so we need to make sure this error is accounted for.
                self._artifactsError++;
                throw err;
            })
            .finally(function () {
                emitter.removeListener(EVENT_ITEM_PULLED, artifactPulled);
                emitter.removeListener(EVENT_ITEM_PULLED_ERROR, artifactPulledError);
                emitter.removeListener(EVENT_ITEM_LOCAL_ONLY, itemLocalOnly);
            });
    }

    /**
     * Pull the layout mapping artifacts.
     *
     * @param {Object} context The API context to be used for the pull operation.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pulling the artifacts.
     */
    pullLayoutMappings (context) {
        const helper = ToolsApi.getLayoutMappingsHelper();
        const emitter = context.eventEmitter;
        const self = this;

        self.getLogger().info(PullingLayoutMappings);

        // The API emits an event when an item is pulled, so we log it for the user.
        const artifactPulled = function (item) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_pull_layout_mapping_pulled_2', item));
        };
        emitter.on(EVENT_ITEM_PULLED, artifactPulled);

        // The API emits an event when there is an error pulling an item, so we log it for the user.
        const artifactPulledError = function (error, name) {
            self._artifactsError++;
            self.getLogger().error(i18n.__('cli_pull_layout_mapping_pull_error', {name: name, message: error.message}));
        };
        emitter.on(EVENT_ITEM_PULLED_ERROR, artifactPulledError);

        // The API emits an event when a local item does not exist on the server, so add it to the list to delete.
        const itemsToDelete = [];
        const itemLocalOnly = function (item) {
            itemsToDelete.push(item);
        };
        emitter.on(EVENT_ITEM_LOCAL_ONLY, itemLocalOnly);

        // Get the API options and start the pull operation.
        const apiOptions = this.getApiOptions();
        let artifactPromise;
        if (this.getCommandLineOption("ignoreTimestamps") || this.getCommandLineOption("deletions")) {
            // If ignoring timestamps or syncing deletions then pull all items.
            artifactPromise = helper.pullAllItems(context, apiOptions);
        } else {
            // The default behavior is to only pull modified items.
            artifactPromise = helper.pullModifiedItems(context, apiOptions);
        }

        // Return the promise for the results of the pull operation.
        return artifactPromise
            .then(function (items) {
                // Handle any local items that need to be deleted.
                if (itemsToDelete.length > 0) {
                    // Delete the local items that do not exist on the server.
                    const deleteFn = helper.deleteLocalItem.bind(helper);
                    const promptKey = "cli_pull_layout_mapping_delete_confirm";
                    const successKey = "cli_pull_layout_mapping_deleted";
                    const errorKey = "cli_pull_layout_mapping_delete_error";
                    return self.deleteLocalItems(context, deleteFn, itemsToDelete, promptKey, successKey, errorKey, apiOptions)
                        .then(function () {
                            return items;
                        });
                } else {
                    return items;
                }
            })
            .catch(function (err) {
                // If the promise is rejected, it means that an error was encountered before the pull process started,
                // so we need to make sure this error is accounted for.
                self._artifactsError++;
                throw err;
            })
            .finally(function () {
                emitter.removeListener(EVENT_ITEM_PULLED, artifactPulled);
                emitter.removeListener(EVENT_ITEM_PULLED_ERROR, artifactPulledError);
                emitter.removeListener(EVENT_ITEM_LOCAL_ONLY, itemLocalOnly);
            });
    }

    /**
     * Pull the rendition artifacts.
     *
     * @param {Object} context The API context to be used for the pull operation.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pulling the rendition artifacts.
     */
    pullRenditions (context) {
        const helper = ToolsApi.getRenditionsHelper();
        const emitter = context.eventEmitter;
        const self = this;

        self.getLogger().info(PullingRenditions);

        // The API emits an event when an item is pulled, so we log it for the user.
        const renditionPulled = function (item) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_pull_rendition_pulled_2', item));
        };
        emitter.on(EVENT_ITEM_PULLED, renditionPulled);

        // The API emits an event when there is an error pulling an item, so we log it for the user.
        const renditionPulledError = function (error, name) {
            self._artifactsError++;
            self.getLogger().error(i18n.__('cli_pull_rendition_pull_error', {name: name, message: error.message}));
        };
        emitter.on(EVENT_ITEM_PULLED_ERROR, renditionPulledError);

        // The API emits an event when a local item does not exist on the server, so add it to the list to delete.
        const itemsToDelete = [];
        const itemLocalOnly = function (item) {
            itemsToDelete.push(item);
        };
        emitter.on(EVENT_ITEM_LOCAL_ONLY, itemLocalOnly);

        // Get the API options and start the pull operation.
        const apiOptions = this.getApiOptions();
        let renditionPromise;
        if (this.getCommandLineOption("ignoreTimestamps") || this.getCommandLineOption("deletions")) {
            // If ignoring timestamps or syncing deletions then pull all items.
            renditionPromise = helper.pullAllItems(context, apiOptions);
        } else {
            // The default behavior is to only pull modified items.
            renditionPromise = helper.pullModifiedItems(context, apiOptions);
        }

        // Return the promise for the results of the pull operation.
        return renditionPromise
            .then(function (items) {
                // Handle any local items that need to be deleted.
                if (itemsToDelete.length > 0) {
                    // Delete the local items that do not exist on the server.
                    const deleteFn = helper.deleteLocalItem.bind(helper);
                    const promptKey = "cli_pull_rendition_delete_confirm";
                    const successKey = "cli_pull_rendition_deleted";
                    const errorKey = "cli_pull_rendition_delete_error";
                    return self.deleteLocalItems(context, deleteFn, itemsToDelete, promptKey, successKey, errorKey, apiOptions)
                        .then(function () {
                            return items;
                        });
                } else {
                    return items;
                }
            })
            .catch(function (err) {
                // If the promise is rejected, it means that an error was encountered before the pull process started,
                // so we need to make sure this error is accounted for.
                self._artifactsError++;
                throw err;
            })
            .finally(function () {
                emitter.removeListener(EVENT_ITEM_PULLED, renditionPulled);
                emitter.removeListener(EVENT_ITEM_PULLED_ERROR, renditionPulledError);
                emitter.removeListener(EVENT_ITEM_LOCAL_ONLY, itemLocalOnly);
            });
    }

    /**
     * Pull the category artifacts.
     *
     * @param {Object} context The API context to be used for the pull operation.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pulling the category artifacts.
     */
    pullCategories (context) {
        const helper = ToolsApi.getCategoriesHelper();
        const emitter = context.eventEmitter;
        const self = this;

        self.getLogger().info(PullingCategories);

        // The API emits an event when an item is pulled, so we log it for the user.
        const categoryPulled = function (item) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_pull_cat_pulled_2', item));
        };
        emitter.on(EVENT_ITEM_PULLED, categoryPulled);

        // The API emits an event when there is an error pulling an item, so we log it for the user.
        const categoryPulledError = function (error, name) {
            self._artifactsError++;
            self.getLogger().error(i18n.__('cli_pull_cat_pull_error', {name: name, message: error.message}));
        };
        emitter.on(EVENT_ITEM_PULLED_ERROR, categoryPulledError);

        // The API emits an event when a local item does not exist on the server, so add it to the list to delete.
        const itemsToDelete = [];
        const itemLocalOnly = function (item) {
            itemsToDelete.push(item);
        };
        emitter.on(EVENT_ITEM_LOCAL_ONLY, itemLocalOnly);

        // Get the API options and start the pull operation.
        const apiOptions = this.getApiOptions();
        let categoryPromise;
        if (this.getCommandLineOption("ignoreTimestamps") || this.getCommandLineOption("deletions")) {
            // If ignoring timestamps or syncing deletions then pull all items.
            categoryPromise = helper.pullAllItems(context, apiOptions);
        } else {
            // The default behavior is to only pull modified items.
            categoryPromise = helper.pullModifiedItems(context, apiOptions);
        }

        // Return the promise for the results of the pull operation.
        return categoryPromise
            .then(function (items) {
                // Handle any local items that need to be deleted.
                if (itemsToDelete.length > 0) {
                    // Delete the local items that do not exist on the server.
                    const deleteFn = helper.deleteLocalItem.bind(helper);
                    const promptKey = "cli_pull_cat_delete_confirm";
                    const successKey = "cli_pull_cat_deleted";
                    const errorKey = "cli_pull_cat_delete_error";
                    return self.deleteLocalItems(context, deleteFn, itemsToDelete, promptKey, successKey, errorKey, apiOptions)
                        .then(function () {
                            return items;
                        });
                } else {
                    return items;
                }
            })
            .catch(function (err) {
                // If the promise is rejected, it means that an error was encountered before the pull process started,
                // so we need to make sure this error is accounted for.
                self._artifactsError++;
                throw err;
            })
            .finally(function () {
                emitter.removeListener(EVENT_ITEM_PULLED, categoryPulled);
                emitter.removeListener(EVENT_ITEM_PULLED_ERROR, categoryPulledError);
                emitter.removeListener(EVENT_ITEM_LOCAL_ONLY, itemLocalOnly);
            });
    }

    /**
     * Pull the type artifacts.
     *
     * @param {Object} context The API context to be used for the pull operation.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pulling the type artifacts.
     */
    pullTypes (context) {
        const helper = ToolsApi.getItemTypeHelper();
        const emitter = context.eventEmitter;
        const self = this;

        self.getLogger().info(PullingTypes);

        // The API emits an event when an item is pulled, so we log it for the user.
        const itemTypePulled = function (item) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_pull_type_pulled_2', item));
        };
        emitter.on(EVENT_ITEM_PULLED, itemTypePulled);

        // The API emits an event when there is an error pulling an item, so we log it for the user.
        const itemTypePulledError = function (error, name) {
            self._artifactsError++;
            self.getLogger().error(i18n.__('cli_pull_type_pull_error', {name: name, message: error.message}));
        };
        emitter.on(EVENT_ITEM_PULLED_ERROR, itemTypePulledError);

        // The API emits an event when a local item does not exist on the server, so add it to the list to delete.
        const itemsToDelete = [];
        const itemLocalOnly = function (item) {
            itemsToDelete.push(item);
        };
        emitter.on(EVENT_ITEM_LOCAL_ONLY, itemLocalOnly);

        // Get the API options and start the pull operation.
        const apiOptions = this.getApiOptions();
        let typePromise;
        if (this.getCommandLineOption("ignoreTimestamps") || this.getCommandLineOption("deletions")) {
            // If ignoring timestamps or syncing deletions then pull all items.
            typePromise = helper.pullAllItems(context, apiOptions);
        } else {
            // The default behavior is to only pull modified items.
            typePromise = helper.pullModifiedItems(context, apiOptions);
        }

        // Return the promise for the results of the pull operation.
        return typePromise
            .then(function (items) {
                // Handle any local items that need to be deleted.
                if (itemsToDelete.length > 0) {
                    // Delete the local items that do not exist on the server.
                    const deleteFn = helper.deleteLocalItem.bind(helper);
                    const promptKey = "cli_pull_type_delete_confirm";
                    const successKey = "cli_pull_type_deleted";
                    const errorKey = "cli_pull_type_delete_error";
                    return self.deleteLocalItems(context, deleteFn, itemsToDelete, promptKey, successKey, errorKey, apiOptions)
                        .then(function () {
                            return items;
                        });
                } else {
                    return items;
                }
            })
            .catch(function (err) {
                // If the promise is rejected, it means that an error was encountered before the pull process started,
                // so we need to make sure this error is accounted for.
                self._artifactsError++;
                throw err;
            })
            .finally(function () {
                emitter.removeListener(EVENT_ITEM_PULLED, itemTypePulled);
                emitter.removeListener(EVENT_ITEM_PULLED_ERROR, itemTypePulledError);
                emitter.removeListener(EVENT_ITEM_LOCAL_ONLY, itemLocalOnly);
            });
    }

    /**
     * Pull the content artifacts.
     *
     * @param {Object} context The API context to be used for the pull operation.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pulling the content artifacts.
     */
    pullContent (context) {
        const helper = ToolsApi.getContentHelper();
        const emitter = context.eventEmitter;
        const self = this;

        self.getLogger().info(PullingContents);

        // The API emits an event when an item is pulled, so we log it for the user.
        const contentPulled = function (item) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_pull_content_pulled_2', item));
        };
        emitter.on(EVENT_ITEM_PULLED, contentPulled);

        // The API emits an event when there is an error pulling an item, so we log it for the user.
        const contentPulledError = function (error, name) {
            self._artifactsError++;
            self.getLogger().error(i18n.__('cli_pull_content_pull_error', {name: name, message: error.message}));
        };
        emitter.on(EVENT_ITEM_PULLED_ERROR, contentPulledError);

        // The API emits an event when a local item does not exist on the server, so add it to the list to delete.
        const itemsToDelete = [];
        const itemLocalOnly = function (item) {
            itemsToDelete.push(item);
        };
        emitter.on(EVENT_ITEM_LOCAL_ONLY, itemLocalOnly);

        // Get the API options and start the pull operation.
        const apiOptions = this.getApiOptions();
        let contentPromise;
        if (this.getCommandLineOption("ignoreTimestamps") || this.getCommandLineOption("deletions")) {
            // If ignoring timestamps or syncing deletions then pull all items.
            contentPromise = helper.pullAllItems(context, apiOptions);
        } else {
            // The default behavior is to only pull modified items.
            contentPromise = helper.pullModifiedItems(context, apiOptions);
        }

        // Return the promise for the results of the pull operation.
        return contentPromise
            .then(function (items) {
                // Handle any local items that need to be deleted.
                if (itemsToDelete.length > 0) {
                    // Delete the local items that do not exist on the server.
                    const deleteFn = helper.deleteLocalItem.bind(helper);
                    const promptKey = "cli_pull_content_delete_confirm";
                    const successKey = "cli_pull_content_deleted";
                    const errorKey = "cli_pull_content_delete_error";
                    return self.deleteLocalItems(context, deleteFn, itemsToDelete, promptKey, successKey, errorKey, apiOptions)
                        .then(function () {
                            return items;
                        });
                } else {
                    return items;
                }
            })
            .catch(function (err) {
                // If the promise is rejected, it means that an error was encountered before the pull process started,
                // so we need to make sure this error is accounted for.
                self._artifactsError++;
                throw err;
            })
            .finally(function () {
                emitter.removeListener(EVENT_ITEM_PULLED, contentPulled);
                emitter.removeListener(EVENT_ITEM_PULLED_ERROR, contentPulledError);
                emitter.removeListener(EVENT_ITEM_LOCAL_ONLY, itemLocalOnly);
            });
    }

    /**
     * Pull the site definitions
     *
     * @param {Object} context The API context to be used for the pull operation.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pulling the artifacts.
     */
    pullSites (context) {
        const helper = ToolsApi.getSitesHelper();
        const emitter = context.eventEmitter;
        const self = this;

        self.getLogger().info(PullingSites);

        // The API emits an event when an item is pulled, so we log it for the user.
        const artifactPulled = function (item) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_pull_site_pulled_2', item));
        };
        emitter.on(EVENT_ITEM_PULLED, artifactPulled);

        // The API emits an event when there is an error pulling an item, so we log it for the user.
        const artifactPulledError = function (error, name) {
            self._artifactsError++;
            self.getLogger().error(i18n.__('cli_pull_site_pull_error', {name: name, message: error.message}));
        };
        emitter.on(EVENT_ITEM_PULLED_ERROR, artifactPulledError);

        // The API emits an event when a local item does not exist on the server, so add it to the list to delete.
        const itemsToDelete = [];
        const itemLocalOnly = function (item) {
            itemsToDelete.push(item);
        };
        emitter.on(EVENT_ITEM_LOCAL_ONLY, itemLocalOnly);

        // Get the API options and start the pull operation.
        const apiOptions = this.getApiOptions();
        let artifactPromise;
        if (this.getCommandLineOption("ignoreTimestamps") || this.getCommandLineOption("deletions")) {
            // If ignoring timestamps or syncing deletions then pull all items.
            artifactPromise = helper.pullAllItems(context, apiOptions);
        } else {
            // The default behavior is to only pull modified items.
            artifactPromise = helper.pullModifiedItems(context, apiOptions);
        }

        // Return the promise for the results of the pull operation.
        return artifactPromise
            .then(function (items) {
                // Handle any local items that need to be deleted.
                if (itemsToDelete.length > 0) {
                    // Delete the local items that do not exist on the server.
                    const deleteFn = helper.deleteLocalItem.bind(helper);
                    const promptKey = "cli_pull_site_delete_confirm";
                    const successKey = "cli_pull_site_deleted";
                    const errorKey = "cli_pull_site_delete_error";
                    return self.deleteLocalItems(context, deleteFn, itemsToDelete, promptKey, successKey, errorKey, apiOptions)
                        .then(function () {
                            return items;
                        });
                } else {
                    return items;
                }
            })
            .catch(function (err) {
                // If the promise is rejected, it means that an error was encountered before the pull process started,
                // so we need to make sure this error is accounted for.
                self._artifactsError++;
                throw err;
            })
            .finally(function () {
                emitter.removeListener(EVENT_ITEM_PULLED, artifactPulled);
                emitter.removeListener(EVENT_ITEM_PULLED_ERROR, artifactPulledError);
                emitter.removeListener(EVENT_ITEM_LOCAL_ONLY, itemLocalOnly);
            });
    }


    /**
     * Pull the page definitions for the specified site (default site in mvp)
     *
     * @param {Object} context The API context to be used for the pull operation.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pulling the artifacts.
     */
    pullPages (context) {

        const helper = ToolsApi.getPagesHelper();
        const emitter = context.eventEmitter;
        const self = this;

        self.getLogger().info(PullingPages);

        // The API emits an event when an item is pulled, so we log it for the user.
        const artifactPulled = function (item) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_pull_page_pulled_2', item));
        };
        emitter.on(EVENT_ITEM_PULLED, artifactPulled);

        // The API emits an event when there is an error pulling an item, so we log it for the user.
        const artifactPulledError = function (error, name) {
            self._artifactsError++;
            self.getLogger().error(i18n.__('cli_pull_page_pull_error', {name: name, message: error.message}));
        };
        emitter.on(EVENT_ITEM_PULLED_ERROR, artifactPulledError);

        // The API emits an event when a local item does not exist on the server, so add it to the list to delete.
        const itemsToDelete = [];
        const itemLocalOnly = function (item) {
            // Fix the path to remove the extension, so that the format matches that displayed for pulled pages.
            const extension = helper._fsApi.getExtension();
            if (item.path && item.path.endsWith(extension)) {
                item.name = item.path.substring(0, item.path.length - extension.length);
            }
            itemsToDelete.push(item);
        };
        emitter.on(EVENT_ITEM_LOCAL_ONLY, itemLocalOnly);

        // Get the API options and start the pull operation.
        const apiOptions = this.getApiOptions();
        let artifactPromise;
        if (this.getCommandLineOption("ignoreTimestamps") || this.getCommandLineOption("deletions")) {
            // If ignoring timestamps or syncing deletions then pull all items.
            artifactPromise = helper.pullAllItems(context, apiOptions);
        } else {
            // The default behavior is to only pull modified items.
            artifactPromise = helper.pullModifiedItems(context, apiOptions);
        }

        // Return the promise for the results of the pull operation.
        return artifactPromise
            .then(function (items) {
                // Handle any local items that need to be deleted.
                if (itemsToDelete.length > 0) {
                    // Delete the local items that do not exist on the server.
                    const deleteFn = helper.deleteLocalItem.bind(helper);
                    const promptKey = "cli_pull_page_delete_confirm";
                    const successKey = "cli_pull_page_deleted";
                    const errorKey = "cli_pull_page_delete_error";
                    return self.deleteLocalItems(context, deleteFn, itemsToDelete, promptKey, successKey, errorKey, apiOptions)
                        .then(function () {
                            return items;
                        });
                } else {
                    return items;
                }
            })
            .catch(function (err) {
                // If the promise is rejected, it means that an error was encountered before the pull process started,
                // so we need to make sure this error is accounted for.
                self._artifactsError++;
                throw err;
            })
            .finally(function () {
                emitter.removeListener(EVENT_ITEM_PULLED, artifactPulled);
                emitter.removeListener(EVENT_ITEM_PULLED_ERROR, artifactPulledError);
                emitter.removeListener(EVENT_ITEM_LOCAL_ONLY, itemLocalOnly);
            });
    }

    /**
     * Pull the source artifacts.
     *
     * @param {Object} context The API context to be used for the pull operation.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pulling the source artifacts.
     */
    pullSources (context) {
        const helper = ToolsApi.getPublishingSourcesHelper();
        const emitter = context.eventEmitter;
        const self = this;

        self.getLogger().info(PullingPublishingSources);

        // The API emits an event when an item is pulled, so we log it for the user.
        const sourcePulled = function (name) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_pull_source_pulled', {name: name}));
        };
        emitter.on(EVENT_ITEM_PULLED, sourcePulled);

        // The API emits an event when there is an error pulling an item, so we log it for the user.
        const sourcePulledError = function (error, name) {
            self._artifactsError++;
            self.getLogger().error(i18n.__('cli_pull_source_pull_error', {name: name, message: error.message}));
        };
        emitter.on(EVENT_ITEM_PULLED_ERROR, sourcePulledError);

        // The API emits an event when a local item does not exist on the server, so add it to the list to delete.
        const itemsToDelete = [];
        const itemLocalOnly = function (item) {
            itemsToDelete.push(item);
        };
        emitter.on(EVENT_ITEM_LOCAL_ONLY, itemLocalOnly);

        // Get the API options and start the pull operation.
        const apiOptions = this.getApiOptions();
        let sourcePromise;
        if (this.getCommandLineOption("ignoreTimestamps") || this.getCommandLineOption("deletions")) {
            // If ignoring timestamps or syncing deletions then pull all items.
            sourcePromise = helper.pullAllItems(context, apiOptions);
        } else {
            // The default behavior is to only pull modified items.
            sourcePromise = helper.pullModifiedItems(context, apiOptions);
        }

        // Return the promise for the results of the pull operation.
        return sourcePromise
            .then(function (items) {
                // Handle any local items that need to be deleted.
                if (itemsToDelete.length > 0) {
                    // Delete the local items that do not exist on the server.
                    const deleteFn = helper.deleteLocalItem.bind(helper);
                    const promptKey = "cli_pull_source_delete_confirm";
                    const successKey = "cli_pull_source_deleted";
                    const errorKey = "cli_pull_source_delete_error";
                    return self.deleteLocalItems(context, deleteFn, itemsToDelete, promptKey, successKey, errorKey, apiOptions)
                        .then(function () {
                            return items;
                        });
                } else {
                    return items;
                }
            })
            .catch(function (err) {
                // If the promise is rejected, it means that an error was encountered before the pull process started,
                // so we need to make sure this error is accounted for.
                self._artifactsError++;
                throw err;
            })
            .finally(function () {
                emitter.removeListener(EVENT_ITEM_PULLED, sourcePulled);
                emitter.removeListener(EVENT_ITEM_PULLED_ERROR, sourcePulledError);
                emitter.removeListener(EVENT_ITEM_LOCAL_ONLY, itemLocalOnly);
            });
    }

    /**
     * Pull the publishing profile artifacts.
     *
     * @param {Object} context The API context to be used for the pull operation.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pulling the profile artifacts.
     */
    pullProfiles (context) {
        const helper = ToolsApi.getPublishingProfilesHelper();
        const emitter = context.eventEmitter;
        const self = this;

        self.getLogger().info(PullingPublishingProfiles);

        // The API emits an event when an item is pulled, so we log it for the user.
        const profilePulled = function (name) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_pull_profile_pulled', {name: name}));
        };
        emitter.on(EVENT_ITEM_PULLED, profilePulled);

        // The API emits an event when there is an error pulling an item, so we log it for the user.
        const profilePulledError = function (error, name) {
            self._artifactsError++;
            self.getLogger().error(i18n.__('cli_pull_profile_pull_error', {name: name, message: error.message}));
        };
        emitter.on(EVENT_ITEM_PULLED_ERROR, profilePulledError);

        // The API emits an event when a local item does not exist on the server, so add it to the list to delete.
        const itemsToDelete = [];
        const itemLocalOnly = function (item) {
            itemsToDelete.push(item);
        };
        emitter.on(EVENT_ITEM_LOCAL_ONLY, itemLocalOnly);

        // Get the API options and start the pull operation.
        const apiOptions = this.getApiOptions();
        let profilesPromise;
        if (this.getCommandLineOption("ignoreTimestamps") || this.getCommandLineOption("deletions")) {
            // If ignoring timestamps or syncing deletions then pull all items.
            profilesPromise = helper.pullAllItems(context, apiOptions);
        } else {
            // The default behavior is to only pull modified items.
            profilesPromise = helper.pullModifiedItems(context, apiOptions);
        }

        // Return the promise for the results of the pull operation.
        return profilesPromise
            .then(function (items) {
                // Handle any local items that need to be deleted.
                if (itemsToDelete.length > 0) {
                    // Delete the local items that do not exist on the server.
                    const deleteFn = helper.deleteLocalItem.bind(helper);
                    const promptKey = "cli_pull_profile_delete_confirm";
                    const successKey = "cli_pull_profile_deleted";
                    const errorKey = "cli_pull_profile_delete_error";
                    return self.deleteLocalItems(context, deleteFn, itemsToDelete, promptKey, successKey, errorKey, apiOptions)
                        .then(function () {
                            return items;
                        });
                } else {
                    return items;
                }
            })
            .catch(function (err) {
                // If the promise is rejected, it means that an error was encountered before the pull process started,
                // so we need to make sure this error is accounted for.
                self._artifactsError++;
                throw err;
            })
            .finally(function () {
                emitter.removeListener(EVENT_ITEM_PULLED, profilePulled);
                emitter.removeListener(EVENT_ITEM_PULLED_ERROR, profilePulledError);
                emitter.removeListener(EVENT_ITEM_LOCAL_ONLY, itemLocalOnly);
            });
    }

    /**
     * Pull the publishing site revision artifacts.
     *
     * @param {Object} context The API context to be used for the pull operation.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pulling the site revision artifacts.
     */
    pullSiteRevisions (context) {
        const helper = ToolsApi.getPublishingSiteRevisionsHelper();
        const emitter = context.eventEmitter;
        const self = this;

        self.getLogger().info(PullingPublishingSiteRevisions);

        // The API emits an event when an item is pulled, so we log it for the user.
        const siteRevisionPulled = function (name) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_pull_site_revision_pulled', {name: name}));
        };
        emitter.on(EVENT_ITEM_PULLED, siteRevisionPulled);

        // The API emits an event when there is an error pulling an item, so we log it for the user.
        const siteRevisionPulledError = function (error, name) {
            self._artifactsError++;
            self.getLogger().error(i18n.__('cli_pull_site_revision_pull_error', {name: name, message: error.message}));
        };
        emitter.on(EVENT_ITEM_PULLED_ERROR, siteRevisionPulledError);

        // The API emits an event when a local item does not exist on the server, so add it to the list to delete.
        const itemsToDelete = [];
        const itemLocalOnly = function (item) {
            itemsToDelete.push(item);
        };
        emitter.on(EVENT_ITEM_LOCAL_ONLY, itemLocalOnly);

        // Get the API options and start the pull operation.
        const apiOptions = this.getApiOptions();
        let artifactPromise;
        if (this.getCommandLineOption("ignoreTimestamps") || this.getCommandLineOption("deletions")) {
            // If ignoring timestamps or syncing deletions then pull all items.
            artifactPromise = helper.pullAllItems(context, apiOptions);
        } else {
            // The default behavior is to only pull modified items.
            artifactPromise = helper.pullModifiedItems(context, apiOptions);
        }

        // Return the promise for the results of the pull operation.
        return artifactPromise
            .then(function (items) {
                // Handle any local items that need to be deleted.
                if (itemsToDelete.length > 0) {
                    // Delete the local items that do not exist on the server.
                    const deleteFn = helper.deleteLocalItem.bind(helper);
                    const promptKey = "cli_pull_site_revision_delete_confirm";
                    const successKey = "cli_pull_site_revision_deleted";
                    const errorKey = "cli_pull_site_revision_delete_error";
                    return self.deleteLocalItems(context, deleteFn, itemsToDelete, promptKey, successKey, errorKey, apiOptions)
                        .then(function () {
                            return items;
                        });
                } else {
                    return items;
                }
            })
            .catch(function (err) {
                // If the promise is rejected, it means that an error was encountered before the pull process started,
                // so we need to make sure this error is accounted for.
                self._artifactsError++;
                throw err;
            })
            .finally(function () {
                emitter.removeListener(EVENT_ITEM_PULLED, siteRevisionPulled);
                emitter.removeListener(EVENT_ITEM_PULLED_ERROR, siteRevisionPulledError);
                emitter.removeListener(EVENT_ITEM_LOCAL_ONLY, itemLocalOnly);
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
        this.setCommandLineOption("sites", undefined);
        this.setCommandLineOption("pages", undefined);
        this.setCommandLineOption("deletions", undefined);
        this.setCommandLineOption("quiet", undefined);
        super.resetCommandLineOptions();
    }
}

function pullCommand (program) {
    program
        .command('pull')
        .description(i18n.__('cli_pull_description'))
        .option('-t --types',            i18n.__('cli_pull_opt_types'))
        .option('-a --assets',           i18n.__('cli_pull_opt_assets'))
        .option('-w --webassets',        i18n.__('cli_pull_opt_web_assets'))
        .option('-l --layouts',          i18n.__('cli_pull_opt_layouts'))
        .option('-m --layout-mappings',  i18n.__('cli_pull_opt_layout_mappings'))
        .option('-i --image-profiles',   i18n.__('cli_pull_opt_image_profiles'))
        .option('-c --content',          i18n.__('cli_pull_opt_content'))
        .option('-C --categories',       i18n.__('cli_pull_opt_categories'))
        .option('-r --renditions',       i18n.__('cli_pull_opt_renditions'))
        .option('-s --sites',            i18n.__('cli_pull_opt_sites'))
        .option('-p --pages',            i18n.__('cli_pull_opt_pages'))
        .option('-A --all-authoring',    i18n.__('cli_pull_opt_all'))
        .option('-P --publishing-profiles',i18n.__('cli_pull_opt_profiles'))
        .option('-R --publishing-site-revisions',i18n.__('cli_pull_opt_site_revisions'))
        .option('-S --publishing-sources',i18n.__('cli_pull_opt_sources'))
        .option('-v --verbose',          i18n.__('cli_opt_verbose'))
        .option('-I --ignore-timestamps',i18n.__('cli_pull_opt_ignore_timestamps'))
        .option('--deletions',           i18n.__('cli_pull_opt_deletions'))
        .option('-q --quiet',            i18n.__('cli_pull_opt_quiet'))
        .option('--dir <dir>',           i18n.__('cli_pull_opt_dir'))
        .option('--user <user>',         i18n.__('cli_opt_user_name'))
        .option('--password <password>', i18n.__('cli_opt_password'))
        .option('--url <url>',           i18n.__('cli_opt_url', {"product_name": utils.ProductName}))
        .action(function (commandLineOptions) {
            const command = new PullCommand(program);
            if (command.setCommandLineOptions(commandLineOptions, this)) {
                if (command.getCommandLineOption("ignoreTimestamps") || command.getCommandLineOption("deletions")) {
                    command._modified = false;
                }
                command.doPull();
            }
        });
}

module.exports = pullCommand;
