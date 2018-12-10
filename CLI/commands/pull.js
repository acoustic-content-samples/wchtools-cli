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

const BaseCommand = require("../lib/baseCommand");

const ToolsApi = require("wchtools-api");
const utils = ToolsApi.getUtils();
const options = ToolsApi.getOptions();
const login = ToolsApi.getLogin();
const events = require("events");
const fs = require("fs");
const rimraf = require("rimraf");
const prompt = require("prompt");
const Q = require("q");

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
const PullingContent = PREFIX + i18n.__('cli_pull_pulling_content') + SUFFIX;
const PullingDefaultContent = PREFIX + i18n.__('cli_pull_pulling_default_content') + SUFFIX;
const PullingCategories = PREFIX + i18n.__('cli_pull_pulling_categories') + SUFFIX;
const PullingRenditions = PREFIX + i18n.__('cli_pull_pulling_renditions') + SUFFIX;
const PullingPublishingSiteRevisions = PREFIX + i18n.__('cli_pull_pulling_site_revisions') + SUFFIX;
const PullingSites = PREFIX + i18n.__('cli_pull_pulling_sites') + SUFFIX;

// Define the names of the events emitted by the API during a pull operation.
const EVENT_ITEM_PULLED = "pulled";
const EVENT_ITEM_PULLED_WARNING = "pulled-warning";
const EVENT_ITEM_PULLED_ERROR = "pulled-error";
const EVENT_RESOURCE_PULLED = "resource-pulled";
const EVENT_RESOURCE_PULLED_ERROR = "resource-pulled-error";
const EVENT_ITEM_LOCAL_ONLY = "local-only";
const EVENT_RESOURCE_LOCAL_ONLY = "resource-local-only";
const EVENT_POST_PROCESS = "post-process";

// Embedded inline renditions have a special id format
const EMBEDDED_RENDITION_ID = /r=.*&a=.*/;

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

    static _getPagesDisplayHeader(siteItem) {
        const contextName = ToolsApi.getSitesHelper().getSiteContextName(siteItem);
        return PREFIX + i18n.__('cli_pull_pulling_pages_for_site', {id: contextName}) + SUFFIX;
    }

    /**
     * Pull the specified artifacts.
     */
    doPull () {
        // Create the context for pulling the artifacts of each specified type.
        const toolsApi = new ToolsApi({eventEmitter: new events.EventEmitter()});
        const context = toolsApi.getContext();
        const self = this;

        if (!self.validateOptions()) {
            self.resetCommandLineOptions();
            return;
        }

        // Handle the various validation checks.
        if ((this.getCommandLineOption("manifest") || this.getCommandLineOption("serverManifest")) && this.getCommandLineOption("deletions")) {
            // Pull by manifest is not compatible with pulling deletions.
            this.errorMessage(i18n.__("cli_pull_manifest_and_deletions"));
            this.resetCommandLineOptions();
            return;
        }

        if (this.getCommandLineOption("writeDeletionsManifest") && !this.getCommandLineOption("deletions")) {
            // A deletions manifest can only be written when pulling deletions.
            this.errorMessage(i18n.__("cli_write_deletions_manifest_and_deletions"));
            this.resetCommandLineOptions();
            return;
        }

        // Make sure the "dir" option can be handled successfully.
        let error;
        self.handleDirOption(context)
            .then(function () {
                // Make sure the url has been specified.
                return self.handleUrlOption(context);
            })
            .then(function () {
                // Make sure the user name and password have been specified.
                return self.handleAuthenticationOptions(context);
            })
            .then(function () {
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
                // Initialize the list of remote sites to be used for this command, if necessary.
                return self.initSites(context, true, self.getApiOptions());
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

                if (!error) {
                    try {
                        // Save the manifests.
                        self.saveManifests(context);
                    } catch (err) {
                        // Log the error that occurred while saving the manifest, but do not fail the pull operation.
                        self.getLogger().error(i18n.__("cli_save_manifest_failure", {"err": err.message}));
                    }
                }

                // Reset the list of sites used for this command.
                self.resetSites(context);

                // Reset the command line options once the command has completed.
                self.resetCommandLineOptions();
            });
    }

    /**
     * Start the display for the pulled artifacts.
     */
    startDisplay () {
        // Display the console message that the list is starting.
        const manifest = this.getCommandLineOption("manifest");
        if (manifest) {
            BaseCommand.displayToConsole(i18n.__('cli_pull_manifest_started', {name: manifest}));
        } else if (this._modified) {
            BaseCommand.displayToConsole(i18n.__('cli_pull_modified_started'));
        } else {
            BaseCommand.displayToConsole(i18n.__('cli_pull_started'));
        }

        // Start the spinner (progress indicator) if we're not doing verbose output.
        if (!this.getCommandLineOption("verbose")) {
            this.spinner = this.getProgram().getSpinner();
            this.spinner.start();
        }
    }

    /**
     * End the display for the pulled artifacts.
     *
     * @param err An error to be displayed if the pull operation resulted in an error before it was started.
     */
    endDisplay (err) {
        let message;
        const logger = this.getLogger();
        const manifest = this.getCommandLineOption("manifest");
        if (manifest) {
            message = i18n.__('cli_pull_manifest_pulling_complete', {name: manifest})
        } else if (this._modified) {
            message = i18n.__('cli_pull_modified_pulling_complete');
        } else {
            message = i18n.__('cli_pull_pulling_complete');
        }
        logger.info(PREFIX + message + SUFFIX);

        if (this.spinner) {
            this.spinner.stop();
        }

        let isError = false;
        let logError = true;
        if (manifest) {
            message = i18n.__('cli_pull_manifest_complete', {name: manifest})
        } else if (this._modified) {
            message = i18n.__('cli_pull_modified_complete');
        } else {
            message = i18n.__('cli_pull_complete');
        }
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
     * Determine whether certain combinations of options are incompatible, and if so log an error
     * @return {boolean}
     */
    validateOptions() {
        const self = this;
        let valid = true;
        if (self.getCommandLineOption("byTypeName")) {
            self._modified = false;
            if (self.getCommandLineOption("deletions")) {
                self.errorMessage(i18n.__('cli_pull_opt_bytype_deletions'));
                valid = false;
            } else if (!(self.getCommandLineOption("allAuthoring") ||
                       ( self.getCommandLineOption("types") &&
                           self.getCommandLineOption("content") &&
                           self.getCommandLineOption("assets") &&
                         self.getCommandLineOption("renditions")) ) ) {
                self.errorMessage(i18n.__('cli_pull_opt_by_type_all'));
                valid = false;
            } else if ( self.getCommandLineOption("categories") ||
                        self.getCommandLineOption("pages") ||
                        self.getCommandLineOption("sites") ||
                        self.getCommandLineOption("publishingSiteRevisions") ||
                        self.getCommandLineOption("layouts") ||
                        self.getCommandLineOption("mappings") ||
                        self.getCommandLineOption("imageProfiles")) {
                self.errorMessage(i18n.__('cli_pull_opt_bytype_artifacts'));
                valid = false;
            }
        }
        return valid;
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
        const byTypeName = this.getCommandLineOption("byTypeName");

        if (byTypeName) {
            return self.pullByType(context, byTypeName);
        }

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
                if (self.getCommandLineOption("defaultContent")) {
                    return self.handlePullPromise(self.pullDefaultContent(context), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("content")) {
                    return self.handlePullPromise(self.pullContent(context), continueOnError);
                }
            })
            .then(function () {
                // Note that if we are pulling pages, we also need to pull the sites artifacts.
                if ((self.getCommandLineOption("sites") || self.getCommandLineOption("pages")) && !self.isBaseTier(context)) {
                    return self.handlePullPromise(self.pullSites(context), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("pages") && !self.isBaseTier(context)) {
                    // Get the list of site items to use for pulling pages.
                    const siteItems = context.siteList;

                    // Local function to recursively pull pages for one site at a time.
                    let index = 0;
                    const pullPagesBySite = function (context) {
                        if (index < siteItems.length) {
                            return self.handlePullPromise(self.pullPages(context, siteItems[index++]), continueOnError)
                                .then(function () {
                                    return pullPagesBySite(context);
                                });
                        }
                    };

                    return pullPagesBySite(context);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("publishingSiteRevisions")) {
                    return self.handlePullPromise(self.pullSiteRevisions(context), continueOnError);
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

    /*
     * Remove all event listeners (eg, to replace with new ones with different output strings)
     */
    clearEventListeners(emitter){
        emitter.removeAllListeners(EVENT_ITEM_PULLED);
        emitter.removeAllListeners(EVENT_ITEM_PULLED_ERROR);
        emitter.removeAllListeners(EVENT_POST_PROCESS);
    }

    setupEventListeners() {
        const self = this;
        self.itemTypePulled = function (item) {
            self._artifactsCount++;
            item.path = item.path || "/"+item.name+".json";
            self.getLogger().info(i18n.__('cli_pull_type_pulled_path_2', item));
        };
        self.contentPulled = function (item) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_pull_content_pulled_2', item));
        };
        self.assetPulled = function (item) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_pull_asset_pulled_2', item));
        };
        self.renditionPulled = function (item) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_pull_rendition_pulled_2', item));
        };
        self.itemTypePulledError = function (error, name) {
            self._artifactsError++;
            self.getLogger().error(i18n.__('cli_pull_type_pull_error', {name: name, message: error.message}));
        };
        self.contentPulledError = function (error, name) {
            self._artifactsError++;
            self.getLogger().error(i18n.__('cli_pull_content_pull_error', {name: name, message: error.message}));
        };
        self.assetPulledError = function (error, name) {
            self._artifactsError++;
            self.getLogger().error(i18n.__('cli_pull_asset_pull_error', {name: name, message: error.message}));
        };
        self.renditionPulledError = function(error, name) {
            self._artifactsError++;
            self.getLogger().error(i18n.__('cli_pull_rendition_pull_error', {name: name, message: error.message}));
        }
    }

    /*
     * Pull specified type, content directly associated with that type, assets directly referenced by that content
     */
    pullByType (context, typeName) {
        const deferred = Q.defer();
        const typeHelper = ToolsApi.getItemTypeHelper();
        const contentHelper = ToolsApi.getContentHelper();
        const emitter = context.eventEmitter;
        const self = this;
        self.setupEventListeners();

        // Start the spinner (progress indicator) if we're not doing verbose output.
        if (!self.getCommandLineOption("verbose")) {
            self.spinner = this.getProgram().getSpinner();
            self.spinner.start();
        }

        const assets = new Set([]);
        const renditions = new Set([]);
        let imageElements = [];
        let references=[];  // For now, we only care if there are "any" references - future, we may walk them too
        const postProcessTypes = function(item) {
            if (item && item.elements) {
                imageElements = item.elements.filter((elem)=>(elem.elementType==='image' || elem.elementType==='video'));
                references = item.elements.filter((elem)=>(elem.elementType==='reference'));
            }
            if (item && item.thumbnail && item.thumbnail.id) {
                assets.add(item.thumbnail.id);
            }
            if (references.length>0){
              self.getLogger().warn(i18n.__('cli_pull_type_references', {name: item.name}));
            }
        };

        const postProcessContent = function(item) {
            if (item && item.elements) {
                imageElements.forEach(elem => {
                    const e = item.elements[elem.key];
                    if (e.asset && e.asset.id) {
                        assets.add(e.asset.id);
                    }
                    if (e.renditions) {
                        const renditionKeys = Object.getOwnPropertyNames(e.renditions);
                        renditionKeys.forEach(function (renditionKey) {
                            const r = e.renditions[renditionKey].renditionId;
                            if (r && !EMBEDDED_RENDITION_ID.test(r)){
                                renditions.add(r);
                            }
                        });
                    }
                    if (e.thumbnail && e.thumbnail.renditionId && !EMBEDDED_RENDITION_ID.test(e.thumbnail.renditionId)) {
                        renditions.add(e.thumbnail.renditionId);
                    }
                })
            }
        };

        // Search for the type by the specified type name (unfortunately, "could" be more than one,
        // even though it's not recommended to have more than one type with same name, it's not prevented)
        let searchOptions = {"fq": [ "classification:content-type", "name:(\"" + typeName + "\")"], "fl":"id"};

        // Fetch the specified type (future - see if type by name endpoint is more efficient than search?)
        emitter.on(EVENT_ITEM_PULLED, self.itemTypePulled);
        emitter.on(EVENT_ITEM_PULLED_ERROR, self.itemTypePulledError);
        emitter.on(EVENT_POST_PROCESS, postProcessTypes);
        self.getLogger().info(PullingTypes);
        typeHelper.searchRemote(context, searchOptions, self.getApiOptions())
            .then(function (searchResults) {
                return self.pullMatchingItems(typeHelper, context, searchResults, self.getApiOptions());
            })
            .then(()=> {
                // Swap content emitter for type emitter
                this.clearEventListeners(emitter);
                emitter.on(EVENT_ITEM_PULLED, self.contentPulled);
                emitter.on(EVENT_ITEM_PULLED_ERROR, self.contentPulledError);
                emitter.on("post-process", postProcessContent);
                // Search for content by this type and pull any that is found
                self.getLogger().info(PullingContent);
                searchOptions = {"fq": ["type:(\"" + typeName + "\")"], "fl":"id,document"};
                return contentHelper.searchRemote(context, searchOptions, self.getApiOptions())
            })
            .then(function (searchResults) {
                return self.pullMatchingItems(contentHelper, context, searchResults, self.getApiOptions());
            })
            .then(function(){
                self.clearEventListeners(emitter);
                emitter.on(EVENT_ITEM_PULLED, self.assetPulled);
                emitter.on(EVENT_ITEM_PULLED_ERROR, self.assetPulledError);
                self.getLogger().info(PullingAssets);
                return self.pullMatchingItems(ToolsApi.getAssetsHelper(), context, Array.from(assets), self.getApiOptions() );
            })
            .then(function(){
                self.clearEventListeners(emitter);
                emitter.on(EVENT_ITEM_PULLED, self.renditionPulled);
                emitter.on(EVENT_ITEM_PULLED_ERROR, self.renditionPulledError);
                self.getLogger().info(PullingRenditions);
                return self.pullMatchingItems(ToolsApi.getRenditionsHelper(), context, Array.from(renditions), self.getApiOptions() );
            })
            .then(()=>{
                deferred.resolve();
            })
            .catch(function (err) {
                // An error was encountered before the pull process started, so make sure this error is accounted for.
                self._artifactsError++;
                deferred.reject(err);
            })
            .finally(function () {
                self.clearEventListeners(emitter);
                // Stop the spinner if it's being displayed.
                if (self.spinner) {
                    self.spinner.stop();
                }
            });
            return deferred.promise;
    }

    /**
     * Pull the specified items.
     *
     * @param {Object} helper The helper to use for pulling items.
     * @param {Object} context The API context associated with this command.
     * @param {Array} items The list of items to be processed.
     * @param {Object} opts The API options to be used for the operations.
     *
     * @returns {Q.Promise} A promise that the specified operations have been completed.
     */
    pullMatchingItems (helper, context, items, opts) {
        // Throttle the delete operations to the configured concurrency limit.
        const self = this;
        const logger = self.getLogger();

        const concurrentLimit = options.getRelevantOption(context, opts, "concurrent-limit", helper._artifactName);
        return utils.throttledAll(context, items.map(function (item) {
            // For each item, return a function that returns a promise.
            return function () {
                // Delete the specified item and display a success or failure message.
                return helper.pullItem(context, item.id || item, opts)
                    .then(function (message) {
                        // Add a debug entry for the server-generated message. (Not displayed in verbose mode.)
                        logger.debug(message);
                    })
                    .catch(function (err) {
                        // Add an error entry for the localized failure message. (Displayed in verbose mode.)
                        logger.error(i18n.__("cli_pull_failure", {"artifacttype": helper.getArtifactName(),  "name": item.name || item.id || item, "err": err.message}));
                    });
            }
        }), concurrentLimit);
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
     * Delete the specified local items using the specified delete function.
     *
     * @param {Object} context The API context associated with this pull command.
     * @param {Function} deleteFn The function to use when deleting a local item.
     * @param {Array} items The items to be deleted.
     * @param {String} promptKey The key for the prompt string to use for each item.
     * @param {String} successKey The key for the string to display when an item is successfully deleted.
     * @param {String} errorKey The key for the string to display when an item cannot be deleted.
     * @param {Object} opts The opts associated with this pull command.
     *
     * @return {Q.Promise} A promise that resolves with the list of deleted items.
     */
    deleteLocalItems (context, deleteFn, items, promptKey, successKey, errorKey, opts) {
        // Delete the local items that do not exist on the server.
        const self = this;
        const logger = self.getLogger();
        const deletedItems = [];

        if (self.getCommandLineOption("quiet")) {
            // Do not prompt for deletions if the quiet option was specified.
            const promises = [];
            items.forEach(function (item) {
                // Delete each specified item.
                const promise = deleteFn(context, item, opts)
                    .then(function () {
                        const successEntry = i18n.__(item.id ? successKey : "cli_pull_invalid_file_deleted", item);
                        logger.info(successEntry);
                        deletedItems.push(item);
                    })
                    .catch(function (err) {
                        const errorEntry = i18n.__(item.id ? errorKey : "cli_pull_invalid_file_delete_error", {path: item.path, message: err.message});
                        logger.error(errorEntry);
                    });

                // Add each delete promise to the list.
                promises.push(promise);
            });

            // Return a promise that is resolved when all delete promises have been settled.
            return Q.allSettled(promises)
                .then(function () {
                    // Resolve the promise with the list of deleted items.
                    return deletedItems;
                });
        } else {
            // Prompt to delete each item that only exists locally.
            const schemaInput = {};
            items.forEach(function (item) {
                // For each matching file, add a confirmation prompt (keyed by the artifact id).
                schemaInput[item.id || item.path] =
                    {
                        description: i18n.__(item.id ? promptKey : "cli_pull_invalid_file_delete_confirm", item),
                        required: true
                    };
            });

            // Stop the spinner if it's being displayed.
            if (self.spinner) {
                self.spinner.stop();
            }

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
                                const successEntry = i18n.__(item.id ? successKey : "cli_pull_invalid_file_deleted", item);
                                logger.info(successEntry);
                                deletedItems.push(item);
                            })
                            .catch(function (err) {
                                const errorEntry = i18n.__(item.id ? errorKey : "cli_pull_invalid_file_delete_error", {path: item.path, message: err.message});
                                logger.error(errorEntry);
                            });

                        // Add each delete promise to the list.
                        promises.push(promise);
                    });

                    // Resolve the returned promise when all delete promises have been settled.
                    Q.allSettled(promises)
                        .then(function () {
                            // Resolve the promise with the list of deleted items.
                            deferred.resolve(deletedItems);
                        });
                } else {
                    // Return the empty list.
                    deferred.resolve(deletedItems);
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
            let canDelete = true;
            // If we're writing a manifest, we don't want to delete it.
            if (context.writeManifestFile) {
                const manifestPath = ToolsApi.getManifests().getManifestPath(context, context.writeManifestFile, self.getApiOptions());
                if (manifestPath === item.path) {
                    canDelete = false;
                }
            }
            // If we're writing a deletions manifest, we don't want to delete it.
            if (context.deletionsManifestFile) {
                const manifestPath = ToolsApi.getManifests().getManifestPath(context, context.deletionsManifestFile, self.getApiOptions());
                if (manifestPath === item.path) {
                    canDelete = false;
                }
            }
            if (canDelete) {
                itemsToDelete.push(item);
            }
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

        // Return the promise for the results of the pull operation.
        return this.pullItems(context, helper, apiOptions)
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

        // Return the promise for the results of the pull operation.
        return this.pullItems(context, helper, apiOptions)
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

        // Return the promise for the results of the pull operation.
        return this.pullItems(context, helper, apiOptions)
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

        // Return the promise for the results of the pull operation.
        return this.pullItems(context, helper, apiOptions)
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

        // Return the promise for the results of the pull operation.
        return this.pullItems(context, helper, apiOptions)
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

        // Return the promise for the results of the pull operation.
        return this.pullItems(context, helper, apiOptions)
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
            if (item.path) {
                // Handle the normal case of a Type that has a defined path.
                self.getLogger().info(i18n.__('cli_pull_type_pulled_path_2', item));
            } else {
                // Handle the case of an "old" Type artifact that does not have a path.
                self.getLogger().info(i18n.__('cli_pull_type_pulled_2', item));
            }
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

        // Return the promise for the results of the pull operation.
        return this.pullItems(context, helper, apiOptions)
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
     * Pull the default-content artifacts.
     *
     * @param {Object} context The API context to be used for the pull operation.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pulling the default-content artifacts.
     */
    pullDefaultContent (context) {
        const helper = ToolsApi.getDefaultContentHelper();
        const emitter = context.eventEmitter;
        const self = this;

        self.getLogger().info(PullingDefaultContent);

        // The API emits an event when an item is pulled, so we log it for the user.
        const contentPulled = function (item) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_pull_default_content_pulled_2', item));
        };
        emitter.on(EVENT_ITEM_PULLED, contentPulled);

        // The API emits an event when there is an error pulling an item, so we log it for the user.
        const contentPulledError = function (error, name) {
            self._artifactsError++;
            self.getLogger().error(i18n.__('cli_pull_default_content_pull_error', {name: name, message: error.message}));
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

        // Return the promise for the results of the pull operation.
        return this.pullItems(context, helper, apiOptions)
            .then(function (items) {
                // Handle any local items that need to be deleted.
                if (itemsToDelete.length > 0) {
                    // Delete the local items that do not exist on the server.
                    const deleteFn = helper.deleteLocalItem.bind(helper);
                    const promptKey = "cli_pull_default_content_delete_confirm";
                    const successKey = "cli_pull_default_content_deleted";
                    const errorKey = "cli_pull_default_content_delete_error";
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

        self.getLogger().info(PullingContent);

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

        // Return the promise for the results of the pull operation.
        return this.pullItems(context, helper, apiOptions)
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
            if (item.contextRoot) {
                if (item.status === "draft") {
                    self.getLogger().info(i18n.__('cli_pull_draft_site_pulled', item));
                } else {
                    self.getLogger().info(i18n.__('cli_pull_site_pulled', item));
                }
            } else {
                if (item.status === "draft") {
                    self.getLogger().info(i18n.__('cli_pull_draft_site_pulled_2', item));
                } else {
                    self.getLogger().info(i18n.__('cli_pull_site_pulled_2', item));
                }
            }
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

        // Return the promise for the results of the pull operation.
        return this.pullItems(context, helper, apiOptions)
            .then(function (items) {
                // Handle any local items that need to be deleted.
                if (itemsToDelete.length > 0) {
                    // Delete the local items that do not exist on the server.
                    const deleteFn = helper.deleteLocalItem.bind(helper);
                    const promptKey = "cli_pull_site_delete_confirm";
                    const successKey = "cli_pull_site_deleted";
                    const errorKey = "cli_pull_site_delete_error";
                    return self.deleteLocalItems(context, deleteFn, itemsToDelete, promptKey, successKey, errorKey, apiOptions)
                        .then(function (deletedItems) {
                            // Delete the pages folder for each site that was deleted. This is done here instead of the
                            // pullPages method for two reasons. 1) The pullPages method is only called for the sites in
                            // the context site list. However, a site being deleted will not be contained in the context
                            // site list for this pull operation, because the site does not exist on the server. 2) This
                            // pull operation may not be pulling pages, but the pages folder should still be deleted for
                            // any site that is being deleted.
                            deletedItems.forEach(function (site) {
                                const siteContextName = helper.getSiteContextName(site);
                                const folderName = helper._fsApi.getPath(context, apiOptions) + siteContextName;

                                if (fs.existsSync(folderName)) {
                                    try {
                                        // Delete the specified folder.
                                        rimraf.sync(folderName);

                                        // Add a log entry for the deleted foldr.
                                        const successMessage = i18n.__("cli_pull_site_folder_deleted", {folder: siteContextName});
                                        self.getLogger().info(successMessage);
                                    } catch (err) {
                                        const errorMessage = i18n.__("cli_pull_site_folder_delete_error", {
                                            folder: siteContextName,
                                            message: err.message
                                        });
                                        self.getLogger().error(errorMessage);
                                    }
                                }
                            });

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
     * Pull the pages for the specified site.
     *
     * @param {Object} context The API context to be used for the pull operation.
     * @param {String} siteItem The site for which to pull pages.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pulling the artifacts.
     */
    pullPages(context, siteItem) {
        const helper = ToolsApi.getPagesHelper();
        const emitter = context.eventEmitter;
        const opts = utils.cloneOpts(this.getApiOptions(), {siteItem: siteItem});
        const self = this;

        const displayHeader = PullCommand._getPagesDisplayHeader(siteItem);
        self.getLogger().info(displayHeader);

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

        // Return the promise for the results of the pull operation.
        return this.pullItems(context, helper, opts)
            .then(function (items) {
                // Handle any local items that need to be deleted.
                if (itemsToDelete.length > 0) {
                    // Delete the local items that do not exist on the server.
                    const deleteFn = helper.deleteLocalItem.bind(helper);
                    const promptKey = "cli_pull_page_delete_confirm";
                    const successKey = "cli_pull_page_deleted";
                    const errorKey = "cli_pull_page_delete_error";
                    return self.deleteLocalItems(context, deleteFn, itemsToDelete, promptKey, successKey, errorKey, opts)
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
        const siteRevisionPulled = function (item) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_pull_site_revision_pulled', {name: item.name[i18n.locale] || item.name["en"], id: item.id}));
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

        // Return the promise for the results of the pull operation.
        return this.pullItems(context, helper, apiOptions)
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
     * Pull items with the given helper, based on the command line options.
     *
     * @param {Object} context The API context to be used for the pull operation.
     * @param {Object} helper The helper to be used for the pull operation.
     * @param {Object} opts - The options to be used for the pull operation.
     *
     * @return {Q.Promise} A promise that is resolved with the results of pulling the artifacts.
     */
    pullItems (context, helper, opts) {
        if (this.getCommandLineOption("manifest")) {
            // If a manifest was specified then pull the items from that manifest.
            return helper.pullManifestItems(context, opts);
        } else if (this.getCommandLineOption("ignoreTimestamps") || this.getCommandLineOption("deletions")) {
            // If ignoring timestamps or syncing deletions then pull all items.
            return helper.pullAllItems(context, opts);
        } else {
            // The default behavior is to only pull modified items.
            return helper.pullModifiedItems(context, opts);
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
        this.setCommandLineOption("sites", undefined);
        this.setCommandLineOption("pages", undefined);
        this.setCommandLineOption("deletions", undefined);
        this.setCommandLineOption("quiet", undefined);
        this.setCommandLineOption("byTypeName", undefined);
        this.setCommandLineOption("path", undefined);
        this.setCommandLineOption("manifest", undefined);
        this.setCommandLineOption("serverManifest", undefined);
        this.setCommandLineOption("writeManifest", undefined);
        this.setCommandLineOption("writeDeletionsManifest", undefined);
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
        .option('-D --default-content',  i18n.__('cli_pull_opt_default_content'))
        .option('-C --categories',       i18n.__('cli_pull_opt_categories'))
        .option('-r --renditions',       i18n.__('cli_pull_opt_renditions'))
        .option('-s --sites',            i18n.__('cli_pull_opt_sites'))
        .option('-p --pages',            i18n.__('cli_pull_opt_pages'))
        .option('-A --all-authoring',    i18n.__('cli_pull_opt_all'))
        .option('-R --publishing-site-revisions',i18n.__('cli_pull_opt_site_revisions'))
        .option('-v --verbose',          i18n.__('cli_opt_verbose'))
        .option('-I --ignore-timestamps',i18n.__('cli_pull_opt_ignore_timestamps'))
        .option('--by-type-name <name>', i18n.__('cli_pull_opt_by_type_name'))
        .option('--deletions',           i18n.__('cli_pull_opt_deletions'))
        .option('-q --quiet',            i18n.__('cli_pull_opt_quiet'))
        .option('--site-context <contextRoot>', i18n.__('cli_pull_opt_siteContext'))
        .option('--path <path>',         i18n.__('cli_pull_opt_path'))
        .option('--manifest <manifest>', i18n.__('cli_pull_opt_use_manifest'))
        .option('--server-manifest <manifest>', i18n.__('cli_pull_opt_use_server_manifest'))
        .option('--write-manifest <manifest>',i18n.__('cli_pull_opt_write_manifest'))
        .option('--write-deletions-manifest <manifest>',i18n.__('cli_pull_opt_write_deletions_manifest'))
        .option('--ready',               i18n.__('cli_pull_opt_ready'))
        .option('--draft', i18n.__('cli_pull_opt_draft'))
        .option('--dir <dir>',           i18n.__('cli_pull_opt_dir'))
        .option('--user <user>',         i18n.__('cli_opt_user_name'))
        .option('--password <password>', i18n.__('cli_opt_password'))
        .option('--url <url>',           i18n.__('cli_opt_url', {"product_name": utils.ProductName}))
        .action(function (commandLineOptions) {
            const command = new PullCommand(program);
            if (command.setCommandLineOptions(commandLineOptions, this)) {
                if (command.getCommandLineOption("ignoreTimestamps") || command.getCommandLineOption("manifest") || command.getCommandLineOption("deletions")) {
                    command._modified = false;
                }
                command.doPull();
            }
        });
}

module.exports = pullCommand;
