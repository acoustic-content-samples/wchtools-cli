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
const options = ToolsApi.getOptions();
const utils = ToolsApi.getUtils();
const login = ToolsApi.getLogin();
const events = require("events");
const i18n = utils.getI18N(__dirname, ".json", "en");
const prompt = require("prompt");
const Q = require("q");
const ora = require("ora");

const PREFIX = "========== ";
const SUFFIX = " ===========";

class DeleteCommand extends BaseCommand {
    /**
     * Create a DeleteCommand object.
     *
     * @param {object} program A Commander program object.
     */
    constructor (program) {
        super(program);
    }

    /**
     * Delete the specified artifact(s).
     */
    doDelete () {
        // Create the context for deleting the specified artifact(s).
        const toolsApi = new ToolsApi({eventEmitter: new events.EventEmitter()});
        const context = toolsApi.getContext();

        // Make sure the artifact type options are valid.
        this.handleArtifactTypes();

        const webassets = this.getCommandLineOption("webassets");
        const assets = this.getCommandLineOption("assets");
        const content = this.getCommandLineOption("content");
        const types = this.getCommandLineOption("types");
        const layouts = this.getCommandLineOption("layouts");
        const layoutMappings = this.getCommandLineOption("layoutMappings");
        const pages = this.getCommandLineOption("pages");
        const id = this.getCommandLineOption("id");
        const path = this.getCommandLineOption("path");
        const named = this.getCommandLineOption("named");
        const tag = this.getCommandLineOption("tag");
        const byTypeName = this.getCommandLineOption("byTypeName");
        const recursive = this.getCommandLineOption("recursive");
        const all = this.getCommandLineOption("all");
        const allAuthoring = this.getCommandLineOption("allAuthoring");
        const pageContent = this.getCommandLineOption("pageContent");
        let helper;

        // Handle the various validation checks.
        if (all) {
            if (this.getOptionArtifactCount() === 0) {
                // Delete all requires at least one artifact type to be specified.
                this.errorMessage(i18n.__("cli_delete_all_no_type"));
                this.resetCommandLineOptions();
                return;
            } else if (this.getCommandLineOption("preview")) {
                // Delete all does not support preview.
                this.errorMessage(i18n.__("cli_delete_all_no_preview"));
                this.resetCommandLineOptions();
                return;
            }
        } else {
            if (this._optionArtifactCount > 1) {
                // Attempting to delete multiple artifact types.
                this.errorMessage(i18n.__('cli_delete_only_one_type'));
                this.resetCommandLineOptions();
                return;
            } else if (webassets) {
                helper = ToolsApi.getAssetsHelper();
                this.setApiOption(helper.ASSET_TYPES, helper.ASSET_TYPES_WEB_ASSETS);
            } else if (assets) {
                helper = ToolsApi.getAssetsHelper();
                this.setApiOption(helper.ASSET_TYPES, helper.ASSET_TYPES_CONTENT_ASSETS);
            } else if (layouts) {
                helper = ToolsApi.getLayoutsHelper();
            } else if (layoutMappings) {
                helper = ToolsApi.getLayoutMappingsHelper();
            } else if (content) {
                helper = ToolsApi.getContentHelper();
            } else if (pages) {
                helper = ToolsApi.getPagesHelper();
            } else if (types) {
                helper = ToolsApi.getItemTypeHelper();
            }

            if (!helper) {
                // Must specify one of the supported artifact types.
                this.errorMessage(i18n.__('cli_delete_no_type'));
                this.resetCommandLineOptions();
                return;
            }

            // Make sure the id or path option (or the deprecated named option) has been specified correctly.
            if (content && !(id || named || byTypeName || tag)) {
                this.errorMessage(i18n.__('cli_delete_requires_id_name_bytypename'));
                this.resetCommandLineOptions();
                return;
            } else if (types && !(id || named || tag)) {
                this.errorMessage(i18n.__('cli_delete_requires_id_name'));
                this.resetCommandLineOptions();
                return;
            } else if (webassets && !(path || named)) {
                this.errorMessage(i18n.__('cli_delete_path_required'));
                this.resetCommandLineOptions();
                return;
            } else if (assets && ! (path || named || tag)) {
                this.errorMessage(i18n.__('cli_delete_path_tag_required'));
                this.resetCommandLineOptions();
                return;
            } else if ((layouts || layoutMappings || pages) && !(id || path)) {
                this.errorMessage(i18n.__('cli_delete_no_id_or_path'));
                this.resetCommandLineOptions();
                return;
            } else if (id && path) {
                this.errorMessage(i18n.__('cli_delete_both_id_and_path'));
                this.resetCommandLineOptions();
                return;
            } else if (id && !helper.supportsDeleteById()) {
                this.errorMessage(i18n.__('cli_delete_by_id_not_supported'));
                this.resetCommandLineOptions();
                return;
            } else if (path && !helper.supportsDeleteByPath() && !helper.supportsDeleteByPathRecursive()) {
                this.errorMessage(i18n.__('cli_delete_by_path_not_supported'));
                this.resetCommandLineOptions();
                return;
            } else if (recursive && !helper.supportsDeleteByPathRecursive()) {
                this.errorMessage(i18n.__('cli_delete_recursive_not_supported'));
                this.resetCommandLineOptions();
                return;
            } else if (pageContent && !pages) {
                this.errorMessage(i18n.__('cli_delete_page_content_req_pages'));
                this.resetCommandLineOptions();
                return;
            }
        }

        // If --page-content specified with -p --pages then set flag to delete
        // page content too.  Note needed with -A --all which deletes content anyway.
        if (pages && pageContent && !(allAuthoring && all)) {
            this.setApiOption("delete-content", true);
        }

        // Make sure the "dir" option can be handled successfully.
        if (!this.handleDirOption(context)) {
            return;
        }

        // Check to see if the initialization process was successful.
        if (!this.handleInitialization(context)) {
            return;
        }

        // Make sure the url option has been specified.
        const self = this;
        const logger = self.getLogger();
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
                if (all) {
                    // Handle delete all first, since multiple artifact types can be specified.
                    return self.deleteAll(context);
                } else if (layouts || layoutMappings || pages) {
                    // The valid options for layouts and layout mappings are id and path.
                    if (id) {
                        return self.deleteById(helper, context, id);
                    } else {
                        return self.deleteByPath(helper, context, path, (pages ? "hierarchicalPath" : "path"));
                    }
                } else if (webassets || assets) {
                    // The tag option is valid for assets. The path and named options are valid for both assets and web assets.
                    if (assets && tag) {
                        return self.deleteBySearch(helper, context, "tags", tag);
                    } else {
                        return self.deleteByPathSearch(helper, context, path || named);
                    }
                } else {
                    // The typeName option is valid for content. The id, named, and tag options are valid for both content and types.
                    if (content && byTypeName) {
                        return self.deleteBySearch(helper, context, "type", byTypeName);
                    } else if (id) {
                        return self.deleteById(helper, context, id);
                    } else if (named) {
                        return self.deleteBySearch(helper, context, "name", named);
                    } else {
                        return self.deleteBySearch(helper, context, "tags", tag);
                    }
                }
            })
            .catch(function (err) {
                // Don't log an error whose "noLog" property has been set.
                if (!err["noLog"]) {
                    logger.error(i18n.__("cli_delete_error", {"err": err.toString()}));
                }
                self.errorMessage(err.message);
            })
            .finally(function () {
                self.resetCommandLineOptions();
            });
    }

    /**
     * Deletes artifacts by id.
     *
     * @param {Object} helper The helper for the artifact type.
     * @param {Object} context The API context associated with this delete command.
     * @param {String} id The id of the artifact to delete.
     */
    deleteById (helper, context, id) {
        const item = {
            id: id
        };
        return this.deleteMatchingItems(helper, context, [item], "id", undefined, this.getApiOptions());
    }

    /**
     * Deletes artifacts by path.
     *
     * @param {Object} helper The helper for the artifact type.
     * @param {Object} context The API context associated with this delete command.
     * @param {String} path The path of the artifact to delete.
     */
    deleteByPath (helper, context, path, displayField) {
        const self = this;
        const opts = this.getApiOptions();

        return helper.getRemoteItemByPath(context, path, opts)
            .then(function (item) {
                return self.deleteMatchingItems(helper, context, [item], displayField, path, opts);
            });
    }

    /**
     * Deletes artifacts based on path search results.
     *
     * @param {Object} helper The helper for the artifact type.
     * @param {Object} context The API context associated with this delete command.
     * @param {String} path The path to delete.
     */
    deleteByPathSearch (helper, context, path) {
        const self = this;
        const opts = this.getApiOptions();

        // For each artifact returned, we only need the path and ID values.
        const searchOptions = {"fl": ["path", "id"]};

        const recursive = this.getCommandLineOption("recursive");

        // Get the specified search results.
        return helper.searchRemote(context, searchOptions, opts, path, recursive)
            .then(function (searchResults) {
                return self.deleteMatchingItems(helper, context, searchResults, "path", path, opts);
            });
    }

    /**
     * Deletes artifacts based on search results.
     *
     * @param {Object} helper The helper for the artifact type.
     * @param {Object} context The API context associated with this delete command.
     * @param {String} searchField
     * @param {String} searchKey
     */
    deleteBySearch (helper, context, searchField, searchKey ) {
        const self = this;
        const opts = this.getApiOptions();

        // For each artifact returned, we only need the path and ID values.
        const searchOptions = {"fq": [ searchField +":(\"" + searchKey + "\")"]};

        // Get the specified search results.
        return helper.searchRemote(context, searchOptions, opts)
            .then(function (searchResults) {
                return self.deleteMatchingItems(helper, context, searchResults, "name", searchKey, opts);
            });
    }

    /**
     * Deletes (or previews) the matching items.
     *
     * @param {Object} helper The helper for the artifact type to delete.
     * @param {Object} context The API context associated with this delete command.
     * @param {Array} items Array of items to be deleted.
     * @param {String} displayField The name of the field to display for the items being deleted.
     * @param {String} searchKey The path of the items to be deleted.
     * @param {Object} opts The API options to be used for the delete operation.
     */
    deleteMatchingItems (helper, context, items, displayField, searchKey, opts) {
        const self = this;
        const logger = self.getLogger();

        const recursive = this.getCommandLineOption("recursive");

        if (!items || items.length === 0) {
            // --------------------------------------------------------
            // The specified path did not match any existing artifacts.
            // --------------------------------------------------------
            self.errorMessage(i18n.__('cli_delete_no_match'));
        } else if (self.getCommandLineOption("preview")) {
            // ------------------------------------------------------------
            // Preview the matching artifacts that would have been deleted.
            // ------------------------------------------------------------
            self.successMessage(i18n.__('cli_delete_preview'));
            items.forEach(function (item) {
                BaseCommand.displayToConsole(item[displayField]);
            });
        } else if (!recursive && items.length === 1) {
            // -------------------------------------------------------
            // Delete the single artifact that was specified via path.
            // -------------------------------------------------------
            const item = items[0];
            logger.info(i18n.__("cli_deleting_artifact", {"name": item[displayField]}));
            return helper.deleteRemoteItem(context, item, opts)
                .then(function () {
                    self.successMessage(i18n.__('cli_delete_success', {name: item[displayField]}));
                })
                .catch(function (err) {
                    logger.error(err);
                    self.errorMessage(i18n.__("cli_delete_failure", {"name": item[displayField], "err": err.message}));
                });
        } else if (self.getCommandLineOption("quiet")) {
            // --------------------------------------------
            // Delete matching artifacts without prompting.
            // --------------------------------------------
            logger.info(i18n.__("cli_deleting_artifacts", {"searchkey": searchKey}));
            return self.deleteItems(helper, context, items, opts);
        } else {
            // -----------------------------------------
            // Delete matching artifacts with prompting.
            // -----------------------------------------
            logger.info(i18n.__("cli_deleting_artifacts", {"searchkey": searchKey}));

            // Display a prompt for each matching artifact, so the user can decide which ones should be deleted.
            const schemaInput = {};
            items.forEach(function (item) {
                // For each matching file, add a confirmation prompt (keyed by the artifact id).
                schemaInput[item.id] =
                    {
                        description: i18n.__("cli_delete_confirm", {"path": item[displayField]}),
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
                // Display a blank line to separate the prompt output from the delete output.
                BaseCommand.displayToConsole("");

                // Filter out the items that were not confirmed.
                items = items.filter(function (item) {
                    return (result[item.id] === "y");
                });

                if (items.length > 0) {
                    self.deleteItems(helper, context, items, opts)
                        .then(function () {
                            deferred.resolve();
                        })
                        .catch(function (err) {
                            deferred.reject(err);
                        });
                } else {
                    self.successMessage(i18n.__("cli_delete_none_confirmed"));
                    deferred.resolve();
                }
            });

            return deferred.promise;
        }
    }

    /**
     * Delete the specified items.
     *
     * @param {Object} helper The helper to use for deleting items.
     * @param {Object} context The API context associated with this delete command.
     * @param {Array} items The list of items to be deleted.
     * @param {Object} opts The API options to be used for the delete operations.
     *
     * @returns {Q.Promise} A promise that the specified delete operations have been completed.
     */
    deleteItems (helper, context, items, opts) {
        // Throttle the delete operations to the configured concurrency limit.
        const self = this;
        const logger = self.getLogger();

        // Start the spinner (progress indicator) if we're not doing verbose output.
        if (!self.getCommandLineOption("verbose")) {
            self.spinner = ora();
            self.spinner.start();
        }

        const concurrentLimit = options.getRelevantOption(context, opts, "concurrent-limit", helper._artifactName);
        return utils.throttledAll(context, items.map(function (item) {
            // For each item, return a function that returns a promise.
            return function () {
                // Delete the specified item and display a success or failure message.
                return helper.deleteRemoteItem(context, item, opts)
                    .then(function (message) {
                        // Track the number of successful delete operations.
                        self._artifactsCount++;

                        // Add a debug entry for the server-generated message. (Not displayed in verbose mode.)
                        logger.debug(message);

                        // Add an info entry for the localized success message. (Displayed in verbose mode.)
                        logger.info(i18n.__('cli_delete_success', {"name": item.path || item.name}));
                    })
                    .catch(function (err) {
                        // Track the number of failed delete operations.
                        self._artifactsError++;

                        // Add an error entry for the localized failure message. (Displayed in verbose mode.)
                        logger.error(i18n.__("cli_delete_failure", {"name": item.path, "err": err.message}));
                    });
            }
        }), concurrentLimit)
            .then(function () {
                // Stop the spinner if it's being displayed.
                if (self.spinner) {
                    self.spinner.stop();
                }

                // Construct the message that all delete operations have been completed.
                let message = i18n.__("cli_delete_complete");
                if (self._artifactsCount > 0) {
                    // Include the number of successful delete operations.
                    message += " " + i18n.__n('cli_delete_summary_success', self._artifactsCount);
                }
                if (self._artifactsError > 0) {
                    // Include the number of failed delete operations.
                    message += " " + i18n.__n('cli_delete_summary_errors', self._artifactsError);

                    // Set the exit code for the process, to indicate that some artifacts had push errors.
                    process.exitCode = self.CLI_ERROR_EXIT_CODE;
                }
                if (!self.getCommandLineOption("verbose")) {
                    // Include blurb about looking in the log file for additional information.
                    message += " " + i18n.__('cli_log_non_verbose');
                }

                logger.info(message);
                self.successMessage(message);
            })
            .catch(function (err) {
                if (self.spinner) {
                    self.spinner.stop();
                }

                // Handle the error in the caller.
                throw(err);
            });
    }

    /**
     * Start the display when deleting all artifacts.
     */
    startDeleteAllDisplay () {
        const deferred = Q.defer();

        const self = this;
        if (this.getCommandLineOption("quiet")) {
            // Display the console message that the delete all process is starting.
            BaseCommand.displayToConsole(i18n.__("cli_delete_all_started"));

            // Quiet mode, so don't prompt or display the spinner.
            deferred.resolve();
        } else {
            // Prompt for confirmation.
            const schemaInput =
            {
                confirm:
                {
                    description: i18n.__("cli_delete_confirm_all"),
                    required: true
                }
            };
            const schemaProps = {properties: schemaInput};
            prompt.message = '';
            prompt.delimiter = ' ';
            prompt.start();
            prompt.get(schemaProps, function (err, result) {
                if (result["confirm"] === "y"){
                    // Display the console message that the delete all process is starting.
                    BaseCommand.displayToConsole(i18n.__("cli_delete_all_started"));

                    // Start the command line spinner to give the user visual feedback when not displaying verbose output.
                    if (!self.getCommandLineOption("verbose")) {
                        self.spinner = ora();
                        self.spinner.start();
                    }

                    deferred.resolve();
                } else {
                    const error = new Error(i18n.__("cli_delete_confirm_no"));

                    // This error should not be logged, since the command was cancelled before it started.
                    error["noLog"] = true;

                    deferred.reject(error);
                }
            });
        }

        return deferred.promise;
    }

    /**
     * Display final information when the for delete all process has completed.
     */
    endDeleteAllDisplay () {
        // Turn off the spinner that we started in startDeleteAllDisplay().
        if (this.spinner) {
            this.spinner.stop();
        }

        let message;
        if (this._artifactsCount === 0 && this._artifactsError === 0) {
            message = i18n.__('cli_delete_all_complete_nothing_deleted');
        } else {
            message = i18n.__('cli_delete_all_completed');
            if (this._artifactsCount > 0) {
                message += " " + i18n.__n('cli_delete_summary_success', this._artifactsCount);
            }
            if (this._artifactsError > 0) {
                message += " " + i18n.__n('cli_delete_summary_errors', this._artifactsError);

                // Set the exit code for the process, to indicate that some artifacts had delete errors.
                process.exitCode = this.CLI_ERROR_EXIT_CODE;
            }
            if ((this._artifactsCount > 0 || this._artifactsError > 0) && !this.getCommandLineOption("verbose")) {
                message += " " + i18n.__('cli_log_non_verbose');
            }
        }

        // Display the results as a success message.
        this.getLogger().info(message);
        this.successMessage(message);
    }

    /**
     * Delete all artifacts of the specified type(s).
     *
     * @param {Object} context The API context associated with this delete command.
     *
     * @return {Q.Promise} A promise to delete all artifacts of the specified type(s).
     */
    deleteAll (context) {
        const deferred = Q.defer();
        const self = this;

        // Determine whether to continue pushing subsequent artifact types on error.
        const continueOnError = options.getProperty(context, "continueOnError");

        self.startDeleteAllDisplay()
            .then(function () {
                if (self.getCommandLineOption("pages")) {
                    return self.handleDeleteAllPromise(self.deleteAllPages(context), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("content")) {
                    return self.handleDeleteAllPromise(self.deleteAllContent(context), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("layoutMappings")) {
                    return self.handleDeleteAllPromise(self.deleteAllLayoutMappings(context), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("types")) {
                    return self.handleDeleteAllPromise(self.deleteAllTypes(context), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("layouts")) {
                    return self.handleDeleteAllPromise(self.deleteAllLayouts(context), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("categories")) {
                    return self.handleDeleteAllPromise(self.deleteAllCategories(context), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("assets") || self.getCommandLineOption("webassets")) {
                    return self.handleDeleteAllPromise(self.deleteAllAssets(context), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("imageProfiles")) {
                    return self.handleDeleteAllPromise(self.deleteAllImageProfiles(context), continueOnError);
                }
            })
            .then(function () {
                self.handleRenditions(context);
            })
            .then(function () {
                self.endDeleteAllDisplay();
                deferred.resolve();
            })
            .catch(function (err) {
                deferred.reject(err);
            });

        return deferred.promise;
    }

    /**
     * Handle the given delete all promise according to whether errors should be returned to the caller.
     *
     * @param {Q.Promise} promise A promise to delete all artifacts of a single type.
     * @param {boolean} continueOnError Flag specifying whether to continue deleting subsequent artifact types on error.
     *
     * @returns {Q.Promise} A promise that is resolved when the delete has completed.
     */
    handleDeleteAllPromise (promise, continueOnError) {
        const self = this;
        if (continueOnError) {
            // Create a nested promise. Any error thrown by this promise will be logged, but not returned to the caller.
            const deferredDelete = Q.defer();
            promise
                .then(function () {
                    deferredDelete.resolve();
                })
                .catch(function (err) {
                    const logger = self.getLogger();
                    logger.error(err.message);
                    deferredDelete.resolve();
                });
            return deferredDelete.promise;
        } else {
            // Any error thrown by this promise will be returned to the caller.
            return promise;
        }
    }

    /**
     * Delete all "Asset" artifacts.
     *
     * @param {Object} context The API context associated with this delete command.
     *
     * @returns {Q.Promise} A promise that is resolved when all asset artifacts are deleted.
     */
    deleteAllAssets (context) {
        const helper = ToolsApi.getAssetsHelper();
        const webassets = this.getCommandLineOption("webassets");
        const assets = this.getCommandLineOption("assets");
        const both = webassets && assets;
        let messageKey;

        if (both) {
            this.setApiOption(helper.ASSET_TYPES, helper.ASSET_TYPES_BOTH);
            messageKey = "cli_deleting_all_assets";
        } else if (assets) {
            this.setApiOption(helper.ASSET_TYPES, helper.ASSET_TYPES_CONTENT_ASSETS);
            messageKey = "cli_deleting_all_content_assets";
        } else {
            this.setApiOption(helper.ASSET_TYPES, helper.ASSET_TYPES_WEB_ASSETS);
            messageKey = "cli_deleting_all_web_assets";
        }

        return this.deleteAllItems(context, helper, messageKey, "path");
    }

    /**
     * Delete all "Image Profile" artifacts.
     *
     * @param {Object} context The API context associated with this delete command.
     *
     * @returns {Q.Promise} A promise that is resolved when all image profile artifacts are deleted.
     */
    deleteAllImageProfiles (context) {
        const helper = ToolsApi.getImageProfilesHelper();

        return this.deleteAllItems(context, helper, "cli_deleting_all_image_profiles", "name");
    }

    /**
     * Delete all "Layout" artifacts.
     *
     * @param {Object} context The API context associated with this delete command.
     *
     * @returns {Q.Promise} A promise that is resolved when all layout artifacts are deleted.
     */
    deleteAllLayouts (context) {
        if (options.getProperty(context, "tier") === "Base") {
            // Layouts are not available in a Base tenant, so just return a resolved promise.
            return Q.resolve();
        } else {
            const helper = ToolsApi.getLayoutsHelper();

            return this.deleteAllItems(context, helper, "cli_deleting_all_layouts", "name");
        }
    }

    /**
     * Delete all "Layout Mapping" artifacts.
     *
     * @param {Object} context The API context associated with this delete command.
     *
     * @returns {Q.Promise} A promise that is resolved when all layout mappings artifacts are deleted.
     */
    deleteAllLayoutMappings (context) {
        if (options.getProperty(context, "tier") === "Base") {
            // Layout Mappings are not available in a Base tenant, so just return a resolved promise.
            return Q.resolve();
        } else {
            const helper = ToolsApi.getLayoutMappingsHelper();

            return this.deleteAllItems(context, helper, "cli_deleting_all_layout_mappings", "name");
        }
    }

    /**
     * Delete all "Category" artifacts.
     *
     * @param {Object} context The API context associated with this delete command.
     *
     * @returns {Q.Promise} A promise that is resolved when all category artifacts are deleted.
     */
    deleteAllCategories (context) {
        const helper = ToolsApi.getCategoriesHelper();

        return this.deleteAllItems(context, helper, "cli_deleting_all_categories", "name");
    }

    /**
     * Delete all "Type" artifacts.
     *
     * @param {Object} context The API context associated with this delete command.
     *
     * @returns {Q.Promise} A promise that is resolved when all type artifacts are deleted.
     */
    deleteAllTypes (context) {
        const helper = ToolsApi.getItemTypeHelper();

        return this.deleteAllItems(context, helper, "cli_delete_all_types", "name");
    }

    /**
     * Delete all "Content" artifacts.
     *
     * @param {Object} context The API context associated with this delete command.
     *
     * @returns {Q.Promise} A promise that is resolved when all content artifacts are deleted.
     */
    deleteAllContent (context) {
        const helper = ToolsApi.getContentHelper();

        return this.deleteAllItems(context, helper, "cli_deleting_all_content", "name");
    }


    /**
     * Delete all "Page" artifacts for a specified site (default only in mvp)
     *
     * @param {Object} context The API context associated with this delete command.
     *
     * @returns {Q.Promise} A promise that is resolved when all page artifacts are deleted.
     */
    deleteAllPages (context) {
        if (options.getProperty(context, "tier") === "Base") {
            // Pages are not available in a Base tenant, so just return a resolved promise.
            return Q.resolve();
        } else {
            const helper = ToolsApi.getPagesHelper();

            return this.deleteAllItems(context, helper, "cli_deleting_all_pages", "hierarchicalPath");
        }
    }

    deleteAllItems (context, helper, messageKey, displayField) {
        const self = this;
        const logger = self.getLogger();
        const emitter = context.eventEmitter;

        // Add a banner for the type of artifacts being deleted.
        logger.info(PREFIX + i18n.__(messageKey) + SUFFIX);

        // The api emits an event when an item is deleted, so we log it for the user.
        const itemDeleted = function (item) {
            self._artifactsCount++;
            logger.info(i18n.__("cli_delete_all_item_success", {name: item[displayField]}));
        };
        emitter.on("deleted", itemDeleted);

        // The api emits an event when there is a delete error, so we log it for the user.
        const itemDeletedError = function (error, item) {
            self._artifactsError++;
            logger.error(i18n.__("cli_delete_all_item_failure", {name: item[displayField], err: error.message}));
        };
        emitter.on("deleted-error", itemDeletedError);

        return helper.deleteRemoteItems(context, this.getApiOptions())
            .catch(function (err) {
                // If the promise is rejected, it means that an error was encountered before the delete process started,
                // so we need to make sure this error is accounted for.
                self._artifactsError++;
                throw err;
            })
            .finally(function () {
                emitter.removeListener("deleted", itemDeleted);
                emitter.removeListener("deleted-error", itemDeletedError);
            });
    }

    /**
     *
     * @param context
     */
    handleRenditions (context) {
        const deferred = Q.defer();

        // Check to see if there are any remaining renditions.
        const helper = ToolsApi.getRenditionsHelper();
        const opts = utils.cloneOpts(this.getApiOptions(), {limit: 1});
        helper.getRemoteItems(context, opts)
            .then(function (items) {
                if (!items || items.length === 0) {
                    // There are no remaining renditions, so remove the hashes.
                    helper.removeAllHashes(context, opts);
                }
            })
            .finally(function () {
                // Resolve the promise whether getRemoteItems() succeeded or failed.
                deferred.resolve();
            });

        return deferred.promise;
    }

    /**
     * Reset the command line options for this command.
     *
     * NOTE: This is used to reset the values when the command is invoked by the mocha testing. Normally the Commander
     * process ends after the command is executed and so these values go away. But when running the tests, the process
     * isn't terminated and these values need to be reset.
     */
    resetCommandLineOptions () {
        this.setCommandLineOption("webassets", undefined);
        this.setCommandLineOption("assets", undefined);
        this.setCommandLineOption("layouts",  undefined);
        this.setCommandLineOption("layoutMappings", undefined);
        this.setCommandLineOption("content", undefined);
        this.setCommandLineOption("imageProfiles", undefined);
        this.setCommandLineOption("types", undefined);
        this.setCommandLineOption("categories", undefined);
        this.setCommandLineOption("pages", undefined);
        this.setCommandLineOption("all", undefined);
        this.setCommandLineOption("id", undefined);
        this.setCommandLineOption("byTypeName", undefined);
        this.setCommandLineOption("named", undefined);
        this.setCommandLineOption("path", undefined);
        this.setCommandLineOption("tag", undefined);
        this.setCommandLineOption("recursive", undefined);
        this.setCommandLineOption("preview", undefined);
        this.setCommandLineOption("quiet", undefined);
        this.setCommandLineOption("pageContent", undefined);
        this.setCommandLineOption("allAuthoring", undefined);

        super.resetCommandLineOptions();
    }
}

function deleteCommand (program) {
    program
        .command('delete')
        .description(i18n.__('cli_delete_description'))
        .option('-a --assets',           i18n.__('cli_delete_opt_assets'))
        .option('-w --webassets',        i18n.__('cli_delete_opt_web_assets'))
        .option('-l --layouts',          i18n.__('cli_delete_opt_layouts'))
        .option('-m --layout-mappings',  i18n.__('cli_delete_opt_layout_mappings'))
        .option('-c --content',          i18n.__('cli_delete_opt_content'))
        .option('-t --types',            i18n.__('cli_delete_opt_types'))
        .option('-i --image-profiles',   i18n.__('cli_delete_opt_image_profiles'))
        .option('-C --categories',       i18n.__('cli_delete_opt_categories'))
        .option('-p --pages',            i18n.__('cli_delete_opt_pages'))
        .option('--page-content',        i18n.__('cli_delete_opt_page_content'))
        .option('-A --all-authoring',    i18n.__('cli_delete_opt_all'))
        .option('-v --verbose',          i18n.__('cli_opt_verbose'))
        .option('--all',                 i18n.__('cli_delete_opt_all_artifacts'))
        .option('--id <id>',             i18n.__('cli_delete_opt_id'))
        .option('--path <path>',         i18n.__('cli_delete_opt_path'))
        .option('-n --named <name>',     i18n.__('cli_delete_opt_name'))
        .option('-T --tag <tag>',        i18n.__('cli_delete_opt_tag'))
        .option('--by-type-name <name>', i18n.__('cli_delete_opt_by_type_name'))
        .option('-r --recursive',        i18n.__('cli_delete_opt_recursive'))
        .option('-P --preview',          i18n.__('cli_delete_opt_preview'))
        .option('-q --quiet',            i18n.__('cli_delete_opt_quiet'))
        .option('--dir <dir>',           i18n.__('cli_delete_opt_dir', {"product_name": utils.ProductName}))
        .option('--user <user>',         i18n.__('cli_opt_user_name'))
        .option('--password <password>', i18n.__('cli_opt_password'))
        .option('--url <url>',           i18n.__('cli_opt_url', {"product_name": utils.ProductName}))
        .action(function (commandLineOptions) {
            const command = new DeleteCommand(program);
            if (command.setCommandLineOptions(commandLineOptions, this)) {
                command.doDelete();
            }
        });
}

module.exports = deleteCommand;
