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
const PushingTypes =                PREFIX + i18n.__('cli_push_pushing_types') + SUFFIX;
const PushingPresentations =        PREFIX + i18n.__('cli_push_pushing_presentations') + SUFFIX;
const PushingAssets =               PREFIX + i18n.__('cli_push_pushing_assets') + SUFFIX;
const PushingContentAssets =        PREFIX + i18n.__('cli_push_pushing_content_assets') + SUFFIX;
const PushingWebAssets =            PREFIX + i18n.__('cli_push_pushing_web_assets') + SUFFIX;
const PushingContentItems =         PREFIX + i18n.__('cli_push_pushing_content') + SUFFIX;
const PushingCategories =           PREFIX + i18n.__('cli_push_pushing_categories') + SUFFIX;
const PushingPublishingSources =    PREFIX + i18n.__('cli_push_pushing_sources') + SUFFIX;
const PushingImageProfiles =        PREFIX + i18n.__('cli_push_pushing_image_profiles') + SUFFIX;
const PushingRenditions =           PREFIX + i18n.__('cli_push_pushing_renditions') + SUFFIX;

class PushCommand extends BaseCommand {
    /**
     * Create a PushCommand object.
     *
     * @param {object} program A Commander program object.
     */
    constructor (program) {
        super(program);
        this._modified = true;
    }

    /**
     * Push the specified artifacts.
     *
     * @param {boolean} continueOnError Whether to continue pushing other artifact types when there is an error.
     */
    doPush (continueOnError) {
        const self = this;
        self._continueOnError = continueOnError;

        // Handle the cases of either no artifact type options being specified, or the "all" option being specified.
        self.handleArtifactTypes();

        // Make sure the "path", "dir", and authentication options can be handled successfully.
        if (!self.handleNamedOption() || !self.handleDirOption() || !self.handlePathOption()) {
            return;
        }

        // Make sure the user name and password have been specified.
        self.handleAuthenticationOptions().then(function() {
            // Login using the current options.
            const apiOptions = self.getApiOptions();
            login.login(apiOptions)
                .then(function (/*results*/) {
                    // Start the display of the pushed artifacts.
                    self.startDisplay();

                    self.pushArtifacts()
                        .then(function (/*results*/) {
                            // End the display of the pushed artifacts.
                            self.endDisplay();

                            // Reset the command line options once the command has completed.
                            self.resetCommandLineOptions();

                            // Handle any necessary cleanup.
                            self.handleCleanup();
                        });
                })
                .catch(function (err) {
                    self.errorMessage(err);
                    // Reset the command line options once the command has completed.
                    self.resetCommandLineOptions();

                    // Handle any necessary cleanup.
                    self.handleCleanup();
                });
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
     */
    endDisplay () {
        const logger = this.getLogger();
        logger.info(i18n.__(this._modified ? 'cli_push_modified_pushing_complete' : 'cli_push_pushing_complete'));
        if (this.spinner) {
            this.spinner.stop();
        }

        let message = i18n.__(this._modified ? 'cli_push_modified_complete' : 'cli_push_complete');
        if (this._artifactsCount > 0) {
            message += " " + i18n.__n('cli_push_success', this._artifactsCount);
        }
        if (this._artifactsError > 0) {
            message += " " + i18n.__n('cli_push_errors', this._artifactsError);
        }
        if ((this._artifactsCount > 0 || this._artifactsError > 0) && !this.getCommandLineOption("verbose")) {
            message += " " + i18n.__('cli_log_non_verbose');
        }
        if (this._artifactsCount === 0 && this._artifactsError === 0) {
            if (this.getCommandLineOption("IgnoreTimestamps")) {
                message = i18n.__('cli_push_complete_ignore_timestamps_nothing_pushed');
            } else {
                message = i18n.__('cli_push_complete_nothing_pushed');
            }
        }

        this.successMessage(message);
    }

    /**
     * Push the artifacts for the types specified on the command line.
     *
     * @return {Q.Promise} A promise that resolves when all artifacts of the specified types have been pushed.
     */
    pushArtifacts () {
        const deferred = Q.defer();
        const self = this;

        self.readyToPush()
            .then(function () {
                if (self.getCommandLineOption("imageProfiles")) {
                    return self.handlePushPromise(self.pushImageProfiles());
                }
            })
            .then(function () {
                if (self.getCommandLineOption("Categories")) {
                    return self.handlePushPromise(self.pushCategories());
                }
            })
            .then(function () {
                if (self.getCommandLineOption("assets") || self.getCommandLineOption("webassets")) {
                    return self.handlePushPromise(self.pushAssets());
                }
            })
            .then(function() {
                if (self.getCommandLineOption("renditions")) {
                    return self.handlePushPromise(self.pushRenditions());
                }
            })
            .then(function () {
                if (self.getCommandLineOption("presentations")) {
                    return self.handlePushPromise(self.pushPresentations());
                }
            })
            .then(function () {
                if (self.getCommandLineOption("types")) {
                    return self.handlePushPromise(self.pushTypes());
                }
            })
            .then(function () {
                if (self.getCommandLineOption("content")) {
                    return self.handlePushPromise(self.pushContent());
                }
            })
            .then(function () {
                if (self.getCommandLineOption("sources")) {
                    return self.handlePushPromise(self.pushSources());
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
     * Prepare to push the artifacts.
     *
     * @returns {Q.Promise} A promise that is resolved when the command is ready to push artifacts.
     */
    readyToPush () {
        const deferred = Q.defer();

        if (this.getOptionArtifactCount() > 0) {
            deferred.resolve();
        } else {
            deferred.reject("At least one artifact type must be specified.");
        }

        return deferred.promise;
    }

    /**
     * Handle the given push promise according to whether errors should be returned to the caller.
     *
     * @param {Q.Promise} promise A promise to push some artifacts.
     *
     * @returns {Q.Promise} A promise that is resolved when the push has completed.
     */
    handlePushPromise (promise) {
        const self = this;
        if (self._continueOnError) {
            // Create a nested promise. Any error thrown by this promise will be logged, but not returned to the caller.
            const deferredPush = Q.defer();
            promise
                .then(function () {
                    deferredPush.resolve();
                })
                .catch(function (err) {
                    const logger = self.getLogger();
                    logger.info(err.message);
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
     * @returns {Q.Promise} A promise that is resolved with the results of pushing the asset artifacts.
     */
    pushAssets () {
        const helper = dxAuthoring.getAssetsHelper();
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

        // The authoring api emits an event when an item is pushed, so we log it for the user.
        const assetPushed = function (name) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_push_asset_pushed', {name: name}));
        };
        helper.getEventEmitter().on("pushed", assetPushed);

        // The authoring api emits an event when there is a push error, so we log it for the user.
        const assetPushedError = function (error, path) {
            self._artifactsError++;
            self.getLogger().info(i18n.__('cli_push_asset_push_error', {name: path, message: error.message}));
        };
        helper.getEventEmitter().on("pushed-error", assetPushedError);

        // Cleanup function to remove the event listeners.
        this.addCleanup(function () {
            helper.getEventEmitter().removeListener("pushed", assetPushed);
            helper.getEventEmitter().removeListener("pushed-error", assetPushedError);
        });

        // If a name is specified, push the named asset.
        // If ignore-timestamps is specified then push all assets.
        // Otherwise only push modified assets (which is the default behavior).
        const apiOptions = this.getApiOptions();
        let assetsPromise;
        if (this.getCommandLineOption("named")) {
            assetsPromise = helper.pushItem(this.getCommandLineOption("named"), apiOptions);
        } else if (this.getCommandLineOption("IgnoreTimestamps")) {
            assetsPromise = helper.pushAllItems(apiOptions);
        } else {
            assetsPromise = helper.pushModifiedItems(apiOptions);
        }

        // Return the promise for the results of the action.
        return assetsPromise;
    }

    /**
     * Push image profile artifacts.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pushing the artifacts.
     */
    pushImageProfiles () {
        const helper = dxAuthoring.getImageProfilesHelper();
        const self = this;

        self.getLogger().info(PushingImageProfiles);

        // The authoring api emits an event when an item is pushed, so we log it for the user.
        const imageProfilePushed = function (name) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_push_image_profile_pushed', {name: name}));
        };
        helper.getEventEmitter().on("pushed", imageProfilePushed);

        // The authoring api emits an event when there is a push error, so we log it for the user.
        const imageProfilePushedError = function (error, name) {
            self._artifactsError++;
            self.getLogger().info(i18n.__('cli_push_image_profile_push_error', {name: name, message: error.message}));
        };
        helper.getEventEmitter().on("pushed-error", imageProfilePushedError);

        // Cleanup function to remove the event listeners.
        this.addCleanup(function () {
            helper.getEventEmitter().removeListener("pushed", imageProfilePushed);
            helper.getEventEmitter().removeListener("pushed-error", imageProfilePushedError);
        });

        // If a name is specified, push the named asset.
        // If ignoretimestamps is specified then push all image profiles.
        // Otherwise only push modified image profiles(which is the default behavior).
        const apiOptions = this.getApiOptions();
        let imageProfilesPromise;
        if (this.getCommandLineOption("named")) {
            imageProfilesPromise = helper.pushItem(this.getCommandLineOption("named"), apiOptions);
        } else if (this.getCommandLineOption("IgnoreTimestamps")) {
            imageProfilesPromise = helper.pushAllItems(apiOptions);
        } else {
            imageProfilesPromise = helper.pushModifiedItems(apiOptions);
        }

        // Return the promise for the results of the action.
        return imageProfilesPromise;
    }

    /**
     * Push rendition artifacts.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pushing the artifacts.
     */
    pushRenditions () {
        const helper = dxAuthoring.getRenditionsHelper();
        const self = this;

        self.getLogger().info(PushingRenditions);

        // The authoring api emits an event when an item is pushed, so we log it for the user.
        const renditionPushed = function (name) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_push_rendition_pushed', {name: name}));
        };
        helper.getEventEmitter().on("pushed", renditionPushed);

        // The authoring api emits an event when there is a push error, so we log it for the user.
        const renditionPushedError = function (error, name) {
            self._artifactsError++;
            self.getLogger().info(i18n.__('cli_push_rendition_push_error', {name: name, message: error.message}));
        };
        helper.getEventEmitter().on("pushed-error", renditionPushedError);

        // Cleanup function to remove the event listeners.
        this.addCleanup(function () {
            helper.getEventEmitter().removeListener("pushed", renditionPushed);
            helper.getEventEmitter().removeListener("pushed-error", renditionPushedError);
        });

        // If a name is specified, push the named rendition.
        // If ignore-timestamps is specified then push all assets.
        // Otherwise only push modified renditions (which is the default behavior).
        const apiOptions = this.getApiOptions();
        let renditionsPromise;
        if (this.getCommandLineOption("named")) {
            renditionsPromise = helper.pushItem(this.getCommandLineOption("named"), apiOptions);
        } else if (this.getCommandLineOption("IgnoreTimestamps")) {
            renditionsPromise = helper.pushAllItems(apiOptions);
        } else {
            renditionsPromise = helper.pushModifiedItems(apiOptions);
        }

        // Return the promise for the results of the action.
        return renditionsPromise;
    }

    /**
     * Push the presentation artifacts.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pushing the presentation artifacts.
     */
    pushPresentations () {
        const helper = dxAuthoring.getPresentationsHelper();
        const self = this;

        self.getLogger().info(PushingPresentations);

        // The authoring api emits an event when an item is pushed, so we log it for the user.
        const presentationPushed = function (name) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_push_presentation_pushed', {name: name}));
        };
        helper.getEventEmitter().on("pushed", presentationPushed);

        // The authoring api emits an event when there is a push error, so we log it for the user.
        const presentationPushedError = function (error, name) {
            self._artifactsError++;
            self.getLogger().info(i18n.__('cli_push_presentation_push_error', {name: name, message: error.message}));
        };
        helper.getEventEmitter().on("pushed-error", presentationPushedError);

        // Cleanup function to remove the event listeners.
        this.addCleanup(function () {
            helper.getEventEmitter().removeListener("pushed", presentationPushed);
            helper.getEventEmitter().removeListener("pushed-error", presentationPushedError);
        });

        // If a name is specified, push the named presentation.
        // If Ignore-timestamps is specified then push all presentations.
        // Otherwise only push modified presentations (which is the default behavior).
        const apiOptions = this.getApiOptions();
        let presentationPromise;
        if (this.getCommandLineOption("named")) {
            presentationPromise = helper.pushItem(this.getCommandLineOption("named"), apiOptions);
        } else if (this.getCommandLineOption("IgnoreTimestamps")) {
            presentationPromise = helper.pushAllItems(apiOptions);
        } else {
            presentationPromise = helper.pushModifiedItems(apiOptions);
        }

        // Return the promise for the results of the action.
        return presentationPromise;
    }

    /**
     * Push the category artifacts.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pushing the category artifacts.
     */
    pushCategories () {
        const helper = dxAuthoring.getCategoriesHelper();
        const self = this;

        self.getLogger().info(PushingCategories);

        // The authoring api emits an event when an item is pushed, so we log it for the user.
        const categoryPushed = function (name) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_push_cat_pushed', {name: name}));
        };
        helper.getEventEmitter().on("pushed", categoryPushed);

        // The authoring api emits an event when there is a push error, so we log it for the user.
        const categoryPushedError = function (error, name) {
            self._artifactsError++;
            self.getLogger().info(i18n.__('cli_push_cat_push_error', {name: name, message: error.message}));
        };
        helper.getEventEmitter().on("pushed-error", categoryPushedError);

        // Cleanup function to remove the event listeners.
        this.addCleanup(function () {
            helper.getEventEmitter().removeListener("pushed", categoryPushed);
            helper.getEventEmitter().removeListener("pushed-error", categoryPushedError);
        });

        // If a name is specified, push the named category.
        // If Ignore-timestamps is specified then push all categories.
        // Otherwise only push modified categories (which is the default behavior).
        const apiOptions = this.getApiOptions();
        let categoriesPromise;
        if (this.getCommandLineOption("named")) {
            categoriesPromise = helper.pushItem(this.getCommandLineOption("named"), apiOptions);
        } else if (this.getCommandLineOption("IgnoreTimestamps")) {
            categoriesPromise = helper.pushAllItems(apiOptions);
        } else {
            categoriesPromise = helper.pushModifiedItems(apiOptions);
        }

        // Return the promise for the results of the action.
        return categoriesPromise;
    }

    /**
     * Push the type artifacts.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pushing the type artifacts.
     */
    pushTypes () {
        const helper = dxAuthoring.getItemTypeHelper();
        const self = this;

        self.getLogger().info(PushingTypes);

        // The authoring api emits an event when an item is pushed, so we log it for the user.
        const itemTypePushed = function (name) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_push_type_pushed', {name: name}));
        };
        helper.getEventEmitter().on("pushed", itemTypePushed);

        // The authoring api emits an event when there is a push error, so we log it for the user.
        const itemTypePushedError = function (error, name) {
            self._artifactsError++;
            self.getLogger().info(i18n.__('cli_push_type_push_error', {name: name, message: error.message}));
        };
        helper.getEventEmitter().on("pushed-error", itemTypePushedError);

        // Cleanup function to remove the event listeners.
        this.addCleanup(function () {
            helper.getEventEmitter().removeListener("pushed", itemTypePushed);
            helper.getEventEmitter().removeListener("pushed-error", itemTypePushedError);
        });

        // If a name is specified, push the named type.
        // If Ignore-timestamps is specified then push all types.
        // Otherwise only push modified types (which is the default behavior).
        const apiOptions = this.getApiOptions();
        let typePromise;
        if (this.getCommandLineOption("named")) {
            typePromise = helper.pushItem(this.getCommandLineOption("named"), apiOptions);
        } else if (this.getCommandLineOption("IgnoreTimestamps")) {
            typePromise = helper.pushAllItems(apiOptions);
        } else {
            typePromise = helper.pushModifiedItems(apiOptions);
        }

        // Return the promise for the results of the action.
        return typePromise;
    }

    /**
     * Push the content artifacts.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pushing the content artifacts.
     */
    pushContent () {
        const helper = dxAuthoring.getContentHelper();
        const self = this;

        self.getLogger().info(PushingContentItems);

        // The authoring api emits an event when an item is pushed, so we log it for the user.
        const contentPushed = function (name) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_push_content_pushed', {name: name}));
        };
        helper.getEventEmitter().on("pushed", contentPushed);

        // The authoring api emits an event when there is a push error, so we log it for the user.
        const contentPushedError = function (error, name) {
            self._artifactsError++;
            self.getLogger().info(i18n.__('cli_push_content_push_error', {name: name, message: error.message}));
        };
        helper.getEventEmitter().on("pushed-error", contentPushedError);

        // Cleanup function to remove the event listeners.
        this.addCleanup(function () {
            helper.getEventEmitter().removeListener("pushed", contentPushed);
            helper.getEventEmitter().removeListener("pushed-error", contentPushedError);
        });

        // If a name is specified, push the named content.
        // If Ignore-timestamps is specified then push all content.
        // Otherwise only push modified content (which is the default behavior).
        const apiOptions = this.getApiOptions();
        let contentsPromise;
        if (this.getCommandLineOption("named")) {
            contentsPromise = helper.pushItem(this.getCommandLineOption("named"), apiOptions);
        } else if (this.getCommandLineOption("IgnoreTimestamps")) {
            contentsPromise = helper.pushAllItems(apiOptions);
        } else {
            contentsPromise = helper.pushModifiedItems(apiOptions);
        }

        // Return the promise for the results of the action.
        return contentsPromise;
    }

    /**
     * Push the (publishing) source artifacts.
     *
     * @returns {Q.Promise} A promise that is resolved with the results of pushing the source artifacts.
     */
    pushSources () {
        const helper = dxAuthoring.getPublishingSourcesHelper();
        const self = this;

        self.getLogger().info(PushingPublishingSources);

        // The authoring api emits an event when an item is pushed, so we log it for the user.
        const sourcePushed = function (name) {
            self._artifactsCount++;
            self.getLogger().info(i18n.__('cli_push_source_pushed', {name: name}));
        };
        helper.getEventEmitter().on("pushed", sourcePushed);

        // The authoring api emits an event when there is a push error, so we log it for the user.
        const sourcePushedError = function (error, name) {
            self._artifactsError++;
            self.getLogger().info(i18n.__('cli_push_source_push_error', {name: name, message: error.message}));
        };
        helper.getEventEmitter().on("pushed-error", sourcePushedError);

        // Cleanup function to remove the event listeners.
        this.addCleanup(function () {
            helper.getEventEmitter().removeListener("pushed", sourcePushed);
            helper.getEventEmitter().removeListener("pushed-error", sourcePushedError);
        });

        // If a name is specified, push the named source.
        // If Ignore-timestamps is specified then push all sources. Otherwise only
        // push modified sources (which is the default behavior).
        const apiOptions = this.getApiOptions();
        let sourcesPromise;
        if (this.getCommandLineOption("named")) {
            sourcesPromise = helper.pushItem(this.getCommandLineOption("named"), apiOptions);
        } else if (this.getCommandLineOption("IgnoreTimestamps")) {
            sourcesPromise = helper.pushAllItems(apiOptions);
        } else {
            sourcesPromise = helper.pushModifiedItems(apiOptions);
        }

        // Return the promise for the results of the action.
        return sourcesPromise;
    }

    /**
     * Handle the "named" option specified on the command line.
     *
     * @returns {boolean} A value of true if the use of the "named" option is valid, otherwise false to indicate that
     *          command execution should not continue.
     */
    handleNamedOption () {
        if (this.getCommandLineOption("named") && this.getCommandLineOption("IgnoreTimestamps")) {
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
        this.setCommandLineOption("presentations", undefined);
        this.setCommandLineOption("assets", undefined);
        this.setCommandLineOption("webassets", undefined);
        this.setCommandLineOption("imageProfiles", undefined);
        this.setCommandLineOption("content", undefined);
        this.setCommandLineOption("Categories", undefined);
        this.setCommandLineOption("renditions", undefined);
        this.setCommandLineOption("sources", undefined);
        this.setCommandLineOption("named", undefined);
        this.setCommandLineOption("path", undefined);

        super.resetCommandLineOptions();
    }
}

function pushCommand (program) {
    program
        .command('push')
        .description(i18n.__('cli_push_description'))
        .option('-t --types',            i18n.__('cli_push_opt_types'))
        .option('-p --presentations',    i18n.__('cli_push_opt_presentations'))
        .option('-a --assets',           i18n.__('cli_push_opt_assets'))
        .option('-w --webassets',        i18n.__('cli_push_opt_web_assets'))
        .option('-i --image-profiles',   i18n.__('cli_push_opt_image_profiles'))
        .option('-c --content',          i18n.__('cli_push_opt_content'))
        .option('-C --Categories',       i18n.__('cli_push_opt_categories'))
        .option('-r --renditions',       i18n.__('cli_push_opt_renditions'))
        .option('-s --sources',          i18n.__('cli_push_opt_sources'))
        .option('-v --verbose',          i18n.__('cli_opt_verbose'))
        .option('-I --Ignore-timestamps',i18n.__('cli_push_opt_ignore_timestamps'))
        .option('-A --All-authoring',    i18n.__('cli_push_opt_all'))
        .option('--named <named>',       i18n.__('cli_push_opt_named'))
        .option('--path <path>',         i18n.__('cli_push_opt_path'))
        .option('--dir <dir>',           i18n.__('cli_push_opt_dir'))
        .option('--user <user>',         i18n.__('cli_opt_user_name'))
        .option('--password <password>', i18n.__('cli_opt_password'))
        .action(function (options) {
            const command = new PushCommand(program);
            if (command.setCommandLineOptions(options, this)) {
                if(command.getCommandLineOption("IgnoreTimestamps"))
                    command._modified = false;
                command.doPush(true);
            }
        });
}

module.exports = pushCommand;
