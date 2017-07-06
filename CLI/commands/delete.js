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

const toolsApi = require("wchtools-api");
const options = toolsApi.options;
const utils = toolsApi.utils;
const login = toolsApi.login;
const i18n = utils.getI18N(__dirname, ".json", "en");
const prompt = require("prompt");
const Q = require("q");
const ora = require("ora");

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
        let helper;

        // Make sure the artifact type options are valid.
        this.handleArtifactTypes();
        const webassets = this.getCommandLineOption("webassets");
        const layouts = this.getCommandLineOption("layouts");
        const layoutMappings = this.getCommandLineOption("layoutMappings");
        if (this._optionArtifactCount > 1) {
            // Attempting to delete multiple artifact types.
            this.errorMessage(i18n.__('cli_delete_only_one_type'));
            this.resetCommandLineOptions();
            return;
        } else if (webassets) {
            helper = toolsApi.getAssetsHelper(this.getApiOptions());
            this.setApiOption(helper.ASSET_TYPES, helper.ASSET_TYPES_WEB_ASSETS);
        } else if (layouts) {
            helper = toolsApi.getLayoutsHelper(this.getApiOptions());
        } else if (layoutMappings) {
            helper = toolsApi.getLayoutMappingsHelper(this.getApiOptions());
        }

        if (!helper) {
            // Must specify one of the supported artifact types.
            this.errorMessage(i18n.__('cli_delete_no_type'));
            this.resetCommandLineOptions();
            return;
        }

        // Make sure the id or path option (or the deprecated named option) has been specified correctly.
        const id = this.getCommandLineOption("id");
        const path = this.getCommandLineOption("path") || this.getCommandLineOption("named");
        const recursive = this.getCommandLineOption("recursive");

        if (!id && !path) {
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
        }

        // Make sure the "dir" option can be handled successfully.
        if (!this.handleDirOption()) {
            return;
        }

        // Make sure the url option has been specified.
        const self = this;
        const logger = self.getLogger();
        self.handleUrlOption()
            .then(function () {
                // Make sure the user name and password have been specified.
                return self.handleAuthenticationOptions();
            })
            .then(function () {
                // Login using the current options.
                return login.login(self.getApiOptions());
            })
            .then(function () {
                if (layouts || layoutMappings) {
                    if (id) {
                        return self.deleteById(helper, id);
                    } else {
                        return self.deleteByPath(helper, path);
                    }
                } else if (webassets) {
                    return self.deleteBySearch(helper, path);
                }
            })
            .catch(function (err) {
                logger.error(i18n.__("cli_delete_error", {"err": err.toString()}));
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
     * @param {String} id The id of the artifact to delete.
     */
    deleteById (helper, id) {
        const item = {
            id: id
        };
        return this.deleteMatchingItems(helper, [item], "id", undefined, this.getApiOptions());
    }

    /**
     * Deletes artifacts by path.
     *
     * @param {Object} helper The helper for the artifact type.
     * @param {String} path The path of the artifact to delete.
     */
    deleteByPath (helper, path) {
        const self = this;
        const opts = this.getApiOptions();

        return helper.getRemoteItemByPath(path, opts)
            .then(function (item) {
                return self.deleteMatchingItems(helper, [item], "path", path, opts);
            });
    }

    /**
     * Deletes artifacts based on search results.
     *
     * @param {Object} helper The helper for the artifact type.
     * @param {String} path The path to delete.
     */
    deleteBySearch (helper, path) {
        const self = this;
        const opts = this.getApiOptions();

        // For each artifact returned, we only need the path and ID values.
        const searchOptions = {"fl": ["path", "id"]};

        const recursive = this.getCommandLineOption("recursive");

        // Get the specified search results.
        return helper.searchRemote(path, recursive, searchOptions, opts)
            .then(function (searchResults) {
                return self.deleteMatchingItems(helper, searchResults, "path", path, opts);
            });
    }

    /**
     * Deletes (or previews) the matching items.
     *
     * @param {Object} helper The helper for the artifact type to delete.
     * @param {Array} items Array of items to be deleted.
     * @param {String} displayField The name of the field to display for the items being deleted.
     * @param {String} path The path of the items to be deleted.
     * @param {Object} opts The API options to be used for the delete operation.
     */
    deleteMatchingItems (helper, items, displayField, path, opts) {
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
            return helper.deleteRemoteItem(item, opts)
                .then(function (message) {
                    logger.info(message);
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
            logger.info(i18n.__("cli_deleting_web_assets", {"path": path}));
            return self.deleteItems(helper, items, opts);
        } else {
            // -----------------------------------------
            // Delete matching artifacts with prompting.
            // -----------------------------------------
            logger.info(i18n.__("cli_deleting_web_assets", {"path": path}));

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
                    self.deleteItems(helper, items, opts)
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
     * @param {Array} items The list of items to be deleted.
     * @param {Object} opts The API options to be used for the delete operations.
     *
     * @returns {Q.Promise} A promise that the specified delete operations have been completed.
     */
    deleteItems (helper, items, opts) {
        // Throttle the delete operations to the configured concurrency limit.
        const self = this;
        const logger = self.getLogger();

        // Start the spinner (progress indicator) if we're not doing verbose output.
        if (!self.getCommandLineOption("verbose")) {
            self.spinner = ora();
            self.spinner.start();
        }

        const concurrentLimit = options.getRelevantOption(opts, "concurrent-limit", helper._artifactName);
        return utils.throttledAll(items.map(function (item) {
            // For each item, return a function that returns a promise.
            return function () {
                // Delete the specified item and display a success or failure message.
                return helper.deleteRemoteItem(item, opts)
                    .then(function (message) {
                        // Track the number of successful delete operations.
                        self._artifactsCount++;

                        // Add a debug entry for the server-generated message. (Not displayed in verbose mode.)
                        logger.debug(message);

                        // Add an info entry for the localized success message. (Displayed in verbose mode.)
                        logger.info(i18n.__('cli_delete_success', {"name": item.path}));
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
     * Reset the command line options for this command.
     *
     * NOTE: This is used to reset the values when the command is invoked by the mocha testing. Normally the Commander
     * process ends after the command is executed and so these values go away. But when running the tests, the process
     * isn't terminated and these values need to be reset.
     */
    resetCommandLineOptions () {
        this.setCommandLineOption("webassets", undefined);
        this.setCommandLineOption("layouts",  undefined);
        this.setCommandLineOption("layoutMappings", undefined);
        this.setCommandLineOption("id", undefined);
        this.setCommandLineOption("named", undefined);
        this.setCommandLineOption("path", undefined);
        this.setCommandLineOption("recursive", undefined);
        this.setCommandLineOption("preview", undefined);
        this.setCommandLineOption("quiet", undefined);
        super.resetCommandLineOptions();
    }
}

function deleteCommand (program) {
    program
        .command('delete')
        .description(i18n.__('cli_delete_description'))
        .option('-w --webassets',        i18n.__('cli_delete_opt_web_assets'))
        .option('-l --layouts',          i18n.__('cli_delete_opt_layouts'))
        .option('-m --layout-mappings',  i18n.__('cli_delete_opt_layout_mappings'))
        .option('-v --verbose',          i18n.__('cli_opt_verbose'))
        .option('--id <id>',             i18n.__('cli_delete_opt_id'))
        .option('-p --path <path>',      i18n.__('cli_delete_opt_path'))
        .option('-r --recursive',        i18n.__('cli_delete_opt_recursive'))
        .option('-P --preview',          i18n.__('cli_delete_opt_preview'))
        .option('-q --quiet',            i18n.__('cli_delete_opt_quiet'))
        .option('--dir <dir>',           i18n.__('cli_delete_opt_dir', {"product_name": utils.ProductName}))
        .option('--user <user>',         i18n.__('cli_opt_user_name'))
        .option('--password <password>', i18n.__('cli_opt_password'))
        .option('--url <url>',           i18n.__('cli_opt_url', {"product_name": utils.ProductName}))
        .option('--named <path>',        i18n.__('cli_delete_opt_named'))
        .action(function (options) {
            const command = new DeleteCommand(program);
            if (command.setCommandLineOptions(options, this)) {
                command.doDelete();
            }
        });
}

module.exports = deleteCommand;
