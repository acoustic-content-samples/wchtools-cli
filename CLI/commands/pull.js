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

const BaseCommand = require("../lib/baseCommand");

const dxAuthoring = require("dxauthoringapi");
const utils = dxAuthoring.utils;
const login = dxAuthoring.login;
const Q = require("q");
const ora = require("ora");

const i18n = utils.getI18N(__dirname, ".json", "en");

const PREFIX = "========== ";
const SUFFIX = " ===========";
const PullingTypes =                PREFIX + i18n.__('cli_pull_pulling_types') + SUFFIX;
const PullingPresentations =        PREFIX + i18n.__('cli_pull_pulling_presentations') + SUFFIX;
const PullingAssets =               PREFIX + i18n.__('cli_pull_pulling_assets') + SUFFIX;
const PullingContentAssets =        PREFIX + i18n.__('cli_pull_pulling_content_assets') + SUFFIX;
const PullingWebAssets =            PREFIX + i18n.__('cli_pull_pulling_web_assets') + SUFFIX;
const PullingImageProfiles =        PREFIX + i18n.__('cli_pull_pulling_image_profiles') + SUFFIX;
const PullingContents =             PREFIX + i18n.__('cli_pull_pulling_content') + SUFFIX;
const PullingCategories =           PREFIX + i18n.__('cli_pull_pulling_categories') + SUFFIX;
const PullingRenditions =           PREFIX + i18n.__('cli_pull_pulling_renditions') + SUFFIX;
const PullingPublishingSources =    PREFIX + i18n.__('cli_pull_pulling_sources') + SUFFIX;

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
        this._modified = true;
    }

    /**
     * Pull the specified artifacts.
     */
    doPull (continueOnError) {
        const self = this;
        self._continueOnError = continueOnError;

        // Handle the cases of either no artifact type options being specified, or the "all" option being specified.
        self.handleArtifactTypes();

        // Make sure the "path", "dir", and authentication options can be handled successfully.
        if (!self.handleDirOption()) {
            return;
        }

        // Make sure the user name and password have been specified.
        self.handleAuthenticationOptions().then(function() {
            // Login using the current options.
            const apiOptions = self.getApiOptions();
            login.login(apiOptions)
                .then(function (/*results*/) {
                    // Start the display of the pulled artifacts.
                    self.startDisplay();

                    self.pullArtifacts()
                        .then(function (/*results*/) {
                            // End the display of the pulled artifacts.
                            self.endDisplay();

                            // Reset the command line options once the command has completed.
                            self.resetCommandLineOptions();

                            // Handle any necessary cleanup.
                            self.handleCleanup();
                        });
                })
                .catch(function (err) {
                    self.errorMessage(err.message);
                    // Reset the command line options once the command has completed.
                    self.resetCommandLineOptions();

                    // Handle any necessary cleanup.
                    self.handleCleanup();
                });
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
     */
    endDisplay () {
        const logger = this.getLogger();
        logger.info(PREFIX + i18n.__(this._modified ? 'cli_pull_modified_pulling_complete' : 'cli_pull_pulling_complete') + SUFFIX);
        if (this.spinner) {
            this.spinner.stop();
        }

        // TODO This is not translation compatible. We need to convert this to a string with substitution parameters.
        let message = i18n.__(this._modified ? 'cli_pull_modified_complete' : 'cli_pull_complete');
        if (this._artifactsCount > 0) {
            message += " " + i18n.__n('cli_pull_success', this._artifactsCount);
        }
        if (this._artifactsError > 0) {
            message += " " + i18n.__n('cli_pull_errors', this._artifactsError);
        }
        if ((this._artifactsCount > 0 || this._artifactsError > 0) && !this.getCommandLineOption("verbose")) {
            message += " " + i18n.__('cli_log_non_verbose');
        }
        if (this._artifactsCount === 0 && this._artifactsError === 0) {
            if (this.getCommandLineOption("IgnoreTimestamps")) {
                message = i18n.__('cli_pull_complete_ignore_timestamps_nothing_pulled');
            } else {
                message = i18n.__('cli_pull_complete_nothing_pulled');
            }
        }

        this.successMessage(message);
    }

    /**
     * Pull the artifacts for the types specified on the command line.
     *
     * @return {Q.Promise} A promise that resolves when all artifacts of the specified types have been pulled.
     */
    pullArtifacts () {
        const deferred = Q.defer();
        const self = this;

        self.readyToPull()
            .then(function () {
                if (self.getCommandLineOption("imageProfiles")) {
                    return self.handlePullPromise(self.pullImageProfiles());
                }
            })
            .then(function () {
                if (self.getCommandLineOption("Categories")) {
                    return self.handlePullPromise(self.pullCategories());
                }
            })
            .then(function () {
                if (self.getCommandLineOption("assets") || self.getCommandLineOption("webassets")) {
                    return self.handlePullPromise(self.pullAssets());
                }
            })
            .then(function() {
                if (self.getCommandLineOption("renditions")) {
                    return self.handlePullPromise(self.pullRenditions());
                }
            })
            .then(function () {
                if (self.getCommandLineOption("presentations")) {
                    return self.handlePullPromise(self.pullPresentations());
                }
            })
            .then(function () {
                if (self.getCommandLineOption("types")) {
                    return self.handlePullPromise(self.pullTypes());
                }
            })
            .then(function () {
                if (self.getCommandLineOption("content")) {
                    return self.handlePullPromise(self.pullContent());
                }
            })
            .then(function () {
                if (self.getCommandLineOption("sources")) {
                    return self.handlePullPromise(self.pullSources());
                }
            })
            .then(function () {
                deferred.resolve();
            })
            .catch(function (err) {
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

        if (this.getOptionArtifactCount() > 0) {
            deferred.resolve();
        } else {
            deferred.reject("At least one artifact type must be specified.");
        }

        return deferred.promise;
    }

    /**
     * Handle the given pull promise according to whether errors should be returned to the caller.
     *
     * @param {Q.Promise} promise A promise to pull some artifacts.
     *
     * @returns {Q.Promise} A promise that is resolved when the pull has completed.
     */
    handlePullPromise (promise) {
        const self = this;
        if (self._continueOnError) {
            // Create a nested promise. Any error thrown by this promise will be logged, but not returned to the caller.
            const deferredPull = Q.defer();
            promise
                .then(function () {
                    deferredPull.resolve();
                })
                .catch(function (err) {
                    const logger = self.getLogger();
                    logger.info(err.message);
                    deferredPull.resolve();
                });
            return deferredPull.promise;
        } else {
            // Any error thrown by this promise will be returned to the caller.
            return promise;
        }
    }

    /**
     * Pull the asset artifacts.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pulling the asset artifacts.
     */
    pullAssets () {
        const helper = dxAuthoring.getAssetsHelper();
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

        // The authoring api emits an event when an item is pulled, so we log it for the user.
        const assetPulled = function (name) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_pull_asset_pulled', {name: name}));
        };

        helper.getEventEmitter().on("pulled", assetPulled);

        // The authoring api emits an event when there is a pull error, so we log it for the user.
        const assetPulledError = function (error, name) {
            self._artifactsError++;
            self.getLogger().info(i18n.__('cli_pull_asset_pull_error', {name: name, message: error.message}));
        };
        helper.getEventEmitter().on("pulled-error", assetPulledError);

        // Cleanup function to remove the event listeners.
        this.addCleanup(function () {
            helper.getEventEmitter().removeListener("pulled", assetPulled);
            helper.getEventEmitter().removeListener("pulled-error", assetPulledError);
        });

        // If a name is set, pull the named asset.
        // If Ignore-timestampsis set then pull all assets. Otherwise only pull
        // modified assets (which is the default behavior).
        const apiOptions = this.getApiOptions();
        let assetPromise;
        if (this.getCommandLineOption("id")) { // FUTURE Do we really support the "id" option?
            assetPromise = helper.pullItem(this.getCommandLineOption("id"), apiOptions);
        } else if (this.getCommandLineOption("IgnoreTimestamps")) {
            assetPromise = helper.pullAllItems(apiOptions);
        } else {
            assetPromise = helper.pullModifiedItems(apiOptions);
        }

        // Return the promise for the results of the action.
        return assetPromise;
    }

    /**
     * Pull image profiles
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pulling the asset artifacts.
     */
    pullImageProfiles () {
        const helper = dxAuthoring.getImageProfilesHelper();
        const self = this;

        self.getLogger().info(PullingImageProfiles);

        // The authoring api emits an event when an item is pulled, so we log it for the user.
        const imageProfilePulled = function (name) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_pull_image_profile_pulled', {name: name}));
        };
        helper.getEventEmitter().on("pulled", imageProfilePulled);

        // The authoring api emits an event when there is a pull error, so we log it for the user.
        const imageProfilePulledError = function (error, name) {
            self._artifactsError++;
            self.getLogger().info(i18n.__('cli_pull_image_profile_pull_error', {name: name, message: error.message}));
        };
        helper.getEventEmitter().on("pulled-error", imageProfilePulledError);

        // Cleanup function to remove the event listeners.
        this.addCleanup(function () {
            helper.getEventEmitter().removeListener("pulled", imageProfilePulled);
            helper.getEventEmitter().removeListener("pulled-error", imageProfilePulledError);
        });

        // If a name is set, pull the named asset.
        // If Ignore-timestamps is set then pull all assets. Otherwise only pull
        // modified assets (which is the default behavior).
        const apiOptions = this.getApiOptions();
        let imageProfilesPromise;
        if (this.getCommandLineOption("id")) { // FUTURE Do we really support the "id" option?
            imageProfilesPromise = helper.pullItem(this.getCommandLineOption("id"), apiOptions);
        } else if (this.getCommandLineOption("IgnoreTimestamps")) {
            imageProfilesPromise = helper.pullAllItems(apiOptions);
        } else {
            imageProfilesPromise = helper.pullModifiedItems(apiOptions);
        }

        // Return the promise for the results of the action.
        return imageProfilesPromise;
    }

    /**
     * Pull the presentation artifacts.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pulling the presentation artifacts.
     */
    pullPresentations () {
        const helper = dxAuthoring.getPresentationsHelper();
        const self = this;

        self.getLogger().info(PullingPresentations);

        // The authoring api emits an event when an item is pulled, so we log it for the user.
        const presentationPulled = function (name) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_pull_presentation_pulled', {name: name}));
        };
        helper.getEventEmitter().on("pulled", presentationPulled);

        // The authoring api emits an event when there is a pull error, so we log it for the user.
        const presentationPulledError = function (error, name) {
            self._artifactsError++;
            self.getLogger().info(i18n.__('cli_pull_presentation_pull_error', {name: name, message: error.message}));
        };
        helper.getEventEmitter().on("pulled-error", presentationPulledError);

        // Cleanup function to remove the event listeners.
        this.addCleanup(function () {
            helper.getEventEmitter().removeListener("pulled", presentationPulled);
            helper.getEventEmitter().removeListener("pulled-error", presentationPulledError);
        });

        // If a name is set, pull the named presentation.
        // If Ignore-timestamps is set then pull all presentations. Otherwise
        // only pull modified presentations (which is the default behavior).
        const apiOptions = this.getApiOptions();
        let presentationPromise;
        if (this.getCommandLineOption("id")) { // FUTURE Do we really support the "id" option?
            presentationPromise = helper.pullItem(this.getCommandLineOption("id"), apiOptions);
        } else if (this.getCommandLineOption("IgnoreTimestamps")) {
            presentationPromise = helper.pullAllItems(apiOptions);
        } else {
            presentationPromise = helper.pullModifiedItems(apiOptions);
        }

        // Return the promise for the results of the action.
        return presentationPromise;
    }

    /**
     * Pull the rendition artifacts.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pulling the rendition artifacts.
     */
    pullRenditions () {
        const helper = dxAuthoring.getRenditionsHelper();
        const self = this;

        self.getLogger().info(PullingRenditions);

        // The authoring api emits an event when an item is pulled, so we log it for the user.
        const renditionPulled = function (name) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_pull_rendition_pulled', {name: name}));
        };
        helper.getEventEmitter().on("pulled", renditionPulled);

        // The authoring api emits an event when there is a pull error, so we log it for the user.
        const renditionPulledError = function (error, name) {
            self._artifactsError++;
            self.getLogger().info(i18n.__('cli_pull_rendition_pull_error', {name: name, message: error.message}));
        };
        helper.getEventEmitter().on("pulled-error", renditionPulledError);

        // Cleanup function to remove the event listeners.
        this.addCleanup(function () {
            helper.getEventEmitter().removeListener("pulled", renditionPulled);
            helper.getEventEmitter().removeListener("pulled-error", renditionPulledError);
        });

        // If a name is set, pull the named category.
        // If Ignore-timestamps is set then pull all categories. Otherwise only
        // pull modified categories (which is the default behavior).
        const apiOptions = this.getApiOptions();
        let renditionPromise;
        if (this.getCommandLineOption("id")) { // FUTURE Do we really support the "id" option?
            renditionPromise = helper.pullItem(this.getCommandLineOption("id"), apiOptions);
        } else if (this.getCommandLineOption("IgnoreTimestamps")) {
            renditionPromise = helper.pullAllItems(apiOptions);
        } else {
            renditionPromise = helper.pullModifiedItems(apiOptions);
        }

        // Return the promise for the results of the action.
        return renditionPromise;
    }

    /**
     * Pull the category artifacts.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pulling the category artifacts.
     */
    pullCategories () {
        const helper = dxAuthoring.getCategoriesHelper();
        const self = this;

        self.getLogger().info(PullingCategories);

        // The authoring api emits an event when an item is pulled, so we log it for the user.
        const categoryPulled = function (name) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_pull_cat_pulled', {name: name}));
        };
        helper.getEventEmitter().on("pulled", categoryPulled);

        // The authoring api emits an event when there is a pull error, so we log it for the user.
        const categoryPulledError = function (error, name) {
            self._artifactsError++;
            self.getLogger().info(i18n.__('cli_pull_cat_pull_error', {name: name, message: error.message}));
        };
        helper.getEventEmitter().on("pulled-error", categoryPulledError);

        // Cleanup function to remove the event listeners.
        this.addCleanup(function () {
            helper.getEventEmitter().removeListener("pulled", categoryPulled);
            helper.getEventEmitter().removeListener("pulled-error", categoryPulledError);
        });

        // If a name is set, pull the named category.
        // If Ignore-timestamps is set then pull all categories. Otherwise only
        // pull modified categories (which is the default behavior).
        const apiOptions = this.getApiOptions();
        let categoryPromise;
        if (this.getCommandLineOption("id")) { // FUTURE Do we really support the "id" option?
            categoryPromise = helper.pullItem(this.getCommandLineOption("id"), apiOptions);
        } else if (this.getCommandLineOption("IgnoreTimestamps")) {
            categoryPromise = helper.pullAllItems(apiOptions);
        } else {
            categoryPromise = helper.pullModifiedItems(apiOptions);
        }

        // Return the promise for the results of the action.
        return categoryPromise;
    }

    /**
     * Pull the type artifacts.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pulling the type artifacts.
     */
    pullTypes () {
        const helper = dxAuthoring.getItemTypeHelper();
        const self = this;

        self.getLogger().info(PullingTypes);

        // The authoring api emits an event when an item is pulled, so we log it for the user.
        const itemTypePulled = function (name) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_pull_type_pulled', {name: name}));
        };
        helper.getEventEmitter().on("pulled", itemTypePulled);

        // The authoring api emits an event when there is a pull error, so we log it for the user.
        const itemTypePulledError = function (error, name) {
            self._artifactsError++;
            self.getLogger().info(i18n.__('cli_pull_type_pull_error', {name: name, message: error.message}));
        };
        helper.getEventEmitter().on("pulled-error", itemTypePulledError);

        // Cleanup function to remove the event listeners.
        this.addCleanup(function () {
            helper.getEventEmitter().removeListener("pulled", itemTypePulled);
            helper.getEventEmitter().removeListener("pulled-error", itemTypePulledError);
        });

        // If a name is set, pull the named type.
        // If Ignore-timestamps is set then pull all types. Otherwise only pull
        // modified types (which is the default behavior).
        const apiOptions = this.getApiOptions();
        let typePromise;
        if (this.getCommandLineOption("id")) { // FUTURE Do we really support the "id" option?
            typePromise = helper.pullItem(this.getCommandLineOption("id"), apiOptions);
        } else if (this.getCommandLineOption("IgnoreTimestamps")) {
            typePromise = helper.pullAllItems(apiOptions);
        } else {
            typePromise = helper.pullModifiedItems(apiOptions);
        }

        // Return the promise for the results of the action.
        return typePromise;
    }

    /**
     * Pull the content artifacts.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pulling the content artifacts.
     */
    pullContent () {
        const helper = dxAuthoring.getContentHelper();
        const self = this;

        self.getLogger().info(PullingContents);

        // The authoring api emits an event when an item is pulled, so we log it for the user.
        const contentPulled = function (name) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_pull_content_pulled', {name: name}));
        };
        helper.getEventEmitter().on("pulled", contentPulled);

        // The authoring api emits an event when there is a pull error, so we log it for the user.
        const contentPulledError = function (error, name) {
            self._artifactsError++;
            self.getLogger().info(i18n.__('cli_pull_content_pull_error', {name: name, message: error.message}));
        };
        helper.getEventEmitter().on("pulled-error", contentPulledError);

        // Cleanup function to remove the event listeners.
        this.addCleanup(function () {
            helper.getEventEmitter().removeListener("pulled", contentPulled);
            helper.getEventEmitter().removeListener("pulled-error", contentPulledError);
        });

        // If a name is set, pull the named content.
        // If Ignore-timestamps is set then pull all content. Otherwise only pull
        // modified content (which is the default behavior).
        const apiOptions = this.getApiOptions();
        let contentPromise;
        if (this.getCommandLineOption("id")) { // FUTURE Do we really support the "id" option?
            contentPromise = helper.pullItem(this.getCommandLineOption("id"), apiOptions);
        } else if (this.getCommandLineOption("IgnoreTimestamps")) {
            contentPromise = helper.pullAllItems(apiOptions);
        } else {
            contentPromise = helper.pullModifiedItems(apiOptions);
        }

        // Return the promise for the results of the action.
        return contentPromise;
    }

    /**
     * Pull the source artifacts.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pulling the source artifacts.
     */
    pullSources () {
        const helper = dxAuthoring.getPublishingSourcesHelper();
        const self = this;

        self.getLogger().info(PullingPublishingSources);

        // The authoring api emits an event when an item is pulled, so we log it for the user.
        const sourcePulled = function (name) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_pull_source_pulled', {name: name}));
        };
        helper.getEventEmitter().on("pulled", sourcePulled);

        // The authoring api emits an event when there is a pull error, so we log it for the user.
        const sourcePulledError = function (error, name) {
            self._artifactsError++;
            self.getLogger().info(i18n.__('cli_pull_source_pull_error', {name: name, message: error.message}));
        };
        helper.getEventEmitter().on("pulled-error", sourcePulledError);

        // Cleanup function to remove the event listeners.
        this.addCleanup(function () {
            helper.getEventEmitter().removeListener("pulled", sourcePulled);
            helper.getEventEmitter().removeListener("pulled-error", sourcePulledError);
        });

        // If a name is set, pull the named source.
        // If Ignore-timestamps is set then pull all sources. Otherwise only pull
        // modified sources (which is the default behavior).
        const apiOptions = this.getApiOptions();
        let sourcePromise;
        if (this.getCommandLineOption("id")) { // FUTURE Do we really support the "id" option?
            sourcePromise = helper.pullItem(this.getCommandLineOption("id"), apiOptions);
        } else if (this.getCommandLineOption("IgnoreTimestamps")) {
            sourcePromise = helper.pullAllItems(apiOptions);
        } else {
            sourcePromise = helper.pullModifiedItems(apiOptions);
        }

        // Return the promise for the results of the action.
        return sourcePromise;
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
        this.setCommandLineOption("presentations", undefined);
        this.setCommandLineOption("assets", undefined);
        this.setCommandLineOption("webassets", undefined);
        this.setCommandLineOption("imageProfiles", undefined);
        this.setCommandLineOption("content", undefined);
        this.setCommandLineOption("Categories", undefined);
        this.setCommandLineOption("renditions", undefined);
        this.setCommandLineOption("sources", undefined);

        super.resetCommandLineOptions();
    }
}

function pullCommand (program) {
    program
        .command('pull')
        .description(i18n.__('cli_pull_description'))
        .option('-t --types',            i18n.__('cli_pull_opt_types'))
        .option('-p --presentations',    i18n.__('cli_pull_opt_presentations'))
        .option('-a --assets',           i18n.__('cli_pull_opt_assets'))
        .option('-w --webassets',        i18n.__('cli_pull_opt_web_assets'))
        .option('-i --image-profiles',   i18n.__('cli_pull_opt_image_profiles'))
        .option('-c --content',          i18n.__('cli_pull_opt_content'))
        .option('-C --Categories',       i18n.__('cli_pull_opt_categories'))
        .option('-r --renditions',       i18n.__('cli_pull_opt_renditions'))
        .option('-s --sources',          i18n.__('cli_pull_opt_sources'))
        .option('-v --verbose',          i18n.__('cli_opt_verbose'))
        .option('-I --Ignore-timestamps',i18n.__('cli_pull_opt_ignore_timestamps'))
        .option('-A --All-authoring',    i18n.__('cli_pull_opt_all'))
        .option('--dir <dir>',           i18n.__('cli_pull_opt_dir'))
        .option('--user <user>',         i18n.__('cli_opt_user_name'))
        .option('--password <password>', i18n.__('cli_opt_password'))
        .action(function (options) {
            const command = new PullCommand(program);
            if (command.setCommandLineOptions(options, this)) {
                if (command.getCommandLineOption("IgnoreTimestamps")) {
                    command._modified = false;
                }
                command.doPull(true);
            }
        });
}

module.exports = pullCommand;
