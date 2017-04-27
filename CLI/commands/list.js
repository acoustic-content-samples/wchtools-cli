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

const toolsApi = require("wchtools-api");
const utils = toolsApi.utils;
const login = toolsApi.login;
const options = toolsApi.options;
const Q = require("q");
const ora = require("ora");

const i18n = utils.getI18N(__dirname, ".json", "en");

const PREFIX = "========== ";
const SUFFIX = " ===========";
const ListTypes =                PREFIX + i18n.__('cli_listing_types') + SUFFIX;
const ListAssets =               PREFIX + i18n.__('cli_listing_assets') + SUFFIX;
const ListContentItems =         PREFIX + i18n.__('cli_listing_content') + SUFFIX;
const ListCategories =           PREFIX + i18n.__('cli_listing_categories') + SUFFIX;
const ListPublishingProfiles =   PREFIX + i18n.__('cli_listing_profiles') + SUFFIX;
const ListPublishingSources =    PREFIX + i18n.__('cli_listing_sources') + SUFFIX;
const ListImageProfiles =        PREFIX + i18n.__('cli_listing_image_profiles') + SUFFIX;
const ListRenditions =           PREFIX + i18n.__('cli_listing_renditions') + SUFFIX;
const ListPublishingSiteRevisions = PREFIX + i18n.__('cli_listing_site_revisions') + SUFFIX;


class ListCommand extends BaseCommand {
    /**
     * Create a ListCommand object.
     *
     * @param {object} program A Commander program object.
     */
    constructor (program) {
        super(program);
    }

    /**
     * List the specified artifacts.
     */
    doList () {
        // List the artifacts of each specified type.
        const self = this;

        // Handle the cases of either no artifact type options being specified, or the "all" option being specified.
        self.handleArtifactTypes();

        // Make sure the "path" and "dir" options can be handled successfully.
        if (!self.handleDirOption() || !self.handlePathOption()) {
            return;
        }

        // Make sure the url has been specified, if login is required for this list command.
        self.handleUrlOption()
            .then(function () {
                // Make sure the user name and password have been specified, if login is required for this list command.
                return self.handleAuthenticationOptions();
            })
            .then(function () {
                // Login using the current options, if login is required for this list command.
                return self.handleLogin(self.getApiOptions());
            })
            .then(function () {
                // List the modified and new artifacts by default.
                if (!self.getCommandLineOption("new") && !self.getCommandLineOption("mod") && !self.getCommandLineOption("del")) {
                    self.setCommandLineOption("mod", true);
                    self.setCommandLineOption("new", true);
                }

                // Start the display of the list.
                self.startDisplay();

                return Q.allSettled(self.listArtifacts());
            })
            .then(function (results) {
                let artifactsCount = 0;

                // Display the list of artifacts for each of the specified types.
                results.forEach(function (result) {
                    if (result.state === 'rejected') {
                        let msg;
                        if (result.reason instanceof Error) {
                            msg = result.reason.heading + ' ' + result.reason.message;
                        }
                        else {
                           msg =result.reason.toString();
                        }
                        if (!self.getCommandLineOption("quiet")) {
                            BaseCommand.displayToConsole(msg);
                        } else {
                            const logger = self.getLogger();
                            logger.info(msg);
                        }
                    }
                    else {
                        // Display a message for the current type.
                        const msg = result.value.type;
                        if (!self.getCommandLineOption("quiet")) {
                            BaseCommand.displayToConsole(msg);
                        } else {
                            const logger = self.getLogger();
                            logger.info(msg);
                        }

                        // Display (or log) the list of items for the current type.
                        const itemNames = result.value.value;
                        itemNames.forEach(function (itemName) {
                            artifactsCount++;
                            if (!self.getCommandLineOption("quiet")) {
                                BaseCommand.displayToConsole(itemName);
                            } else {
                                const logger = self.getLogger();
                                logger.info(itemName);
                            }
                        });
                    }
                });

                // End the display of the list.
                self.endDisplay(artifactsCount);
            })
            .catch(function (err) {
                self.errorMessage(err.message);
            })
            .finally(function () {
                // Reset the command line options once the command has completed.
                self.resetCommandLineOptions();
            });
    }

    /**
     * Determine whether a login is required to execute this list command.
     *
     * @returns {Boolean} A return value of true indicates that a login is required to execute this list command. A
     *          return value of false indicates that a login is not required to execute this list command.
     *
     * @private
     */
    isLoginRequired () {
        // For now, login is only required if the --server option or the --del option has been specified on the command line.
        let retVal = false;
        const server = this.getCommandLineOption("server");
        const del = this.getCommandLineOption("del");
        if (server || del) {
            retVal = true;
        }
        return retVal;
    }

    /**
     * Handle the url option. It can be specified as a command line option or user option ("x-ibm-dx-tenant-base-url").
     * If the url is not specified by either of these methods, a prompt will be displayed to enter the value.
     *
     * @returns {Q.Promise} A promise that is resolved when the url has been specified.
     */
    handleUrlOption () {
        if (this.isLoginRequired()) {
            // A login is required, so call the super method to handle the url option in the normal way.
            return super.handleUrlOption();
        } else {
            // The base URL is used as a key in the hashes file when listing modified local artifacts.
            const baseUrl = options.getRelevantOption(this.getApiOptions(), "x-ibm-dx-tenant-base-url");
            const ignoreTimestamps = this.getCommandLineOption("ignoreTimestamps");
            if (!baseUrl && !ignoreTimestamps) {
                // A base URL has not been configured and not ignoring timestamps, so need to get a URL value.
                return super.handleUrlOption();
            } else {
                // A login is not required, so just return a resolved promise.
                const deferred = Q.defer();
                deferred.resolve();
                return deferred.promise;
            }
        }
    }

    /**
     * Handle the authentication options. These can be specified as command line options, user property (username), or
     * environment variable (password). If either value is missing, the user will be prompted for the missing value(s).
     *
     * @returns {Q.Promise} A promise that is resolved when the username and password have been specified, if necessary.
     */
    handleAuthenticationOptions () {
        if (this.isLoginRequired()) {
            // A login is required, so call the super method to handle the authentication options in the normal way.
            return super.handleAuthenticationOptions();
        } else {
            // A login is not required, so just return a resolved promise.
            const deferred = Q.defer();
            deferred.resolve();
            return deferred.promise;
        }
    }

    /**
     * Handle the login, if necessary.
     *
     * @param {Object} apiOptions - Optional API settings.
     *
     * @returns {Q.Promise} A promise to be fulfilled with the name of the logged in user.
     */
    handleLogin (apiOptions) {
        if (this.isLoginRequired()) {
            // A login is required, so use the loginREST object to login in the normal way.
            return login.login(apiOptions);
        } else {
            // A login is not required, so just return a resolved promise.
            const deferred = Q.defer();
            deferred.resolve();
            return deferred.promise;
        }
    }

    /**
     * Start the display for the list of artifacts.
     */
    startDisplay () {
        // Start the spinner (progress indicator) if we're not doing output.
        if (!this.getCommandLineOption("quiet")) {
            // Display the console message that the list is starting.
            BaseCommand.displayToConsole(i18n.__("cli_list_started"));

            // Start the command line spinner, which gives the user some visual feedback that the command is running.
            this.spinner = ora();
            this.spinner.start();
        } else {
            const logger = this.getLogger();
            logger.info(i18n.__("cli_list_started"));
        }
    }

    /**
     * End the display for the list of artifacts.
     *
     * @param {number} count The total number of artifacts that were listed.
     */
    endDisplay (count) {
        // Stop the command line spinner.
        if (this.spinner) {
            this.spinner.stop();
        }

        // Display the console message that the list is complete.
        this.successMessage(i18n.__("cli_listing_complete", {count: count}));
        if (this.getCommandLineOption("quiet")) {
            const logger = this.getLogger();
            logger.info(i18n.__("cli_listing_complete", {count: count}));
            this.successMessage(i18n.__("cli_listing_complete", {count: count}));
        }
    }

    /**
     * List the artifacts for the types specified on the command line.
     *
     * @return {Array} An array of promises, each resolving to the result of listing one type of artifact.
     */
    listArtifacts () {
        // Keep track of the different promises so we can finish the command after all promises are resolved.
        const promises = [];

        // Handle the assets option.
        if (this.getCommandLineOption("assets") || this.getCommandLineOption("webassets")) {
            promises.push(this.listAssets());
        }

        // Handle the imageProfiles option.
        if (this.getCommandLineOption("imageProfiles")) {
            promises.push(this.listImageProfiles());
        }

        // Handle the categories option.
        if (this.getCommandLineOption("categories")) {
            promises.push(this.listCategories());
        }

        // Handle the renditions option.
        if (this.getCommandLineOption("renditions")) {
            promises.push(this.listRenditions());
        }

        // Handle the types option.
        if (this.getCommandLineOption("types")) {
            promises.push(this.listTypes());
        }

        // Handle the content option.
        if (this.getCommandLineOption("content")) {
            promises.push(this.listContent());
        }

        // Handle the publishing sources option.
        if (this.getCommandLineOption("publishingSources")) {
            promises.push(this.listSources());
        }

        // Handle the publishing profiles option.
        if (this.getCommandLineOption("publishingProfiles")) {
            promises.push(this.listProfiles());
        }

        // Handle the publishing profiles option.
        if (this.getCommandLineOption("publishingSiteRevisions")) {
            promises.push(this.listSiteRevisions());
        }

        return promises;
    }

    /**
     * Get an array of the "item state" flag values.
     *
     * @param {BaseHelper} helper - The helper used to determine the flag values.
     *
     * @returns {Array} An array of the "item state" flag values.
     */
    getFlags (helper) {
        const flags = [];
        if (this.getCommandLineOption("new")) {
            flags.push(helper.NEW);
        }
        if (this.getCommandLineOption("mod")) {
            flags.push(helper.MODIFIED);
        }
        if (this.getCommandLineOption("del")) {
            flags.push(helper.DELETED);
        }
        return flags;
    }

    /**
     * Get the (bound) function to be called to retrieve a list of items. The name of this function will be one of the
     * following (listed here to accommodate searching for references):
     *
     *      listLocalItemNames
     *      listModifiedLocalItemNames
     *      listRemoteItemNames
     *      listModifiedRemoteItemNames
     *
     * @param helper {BaseHelper} The helper used to retrieve items.
     *
     * @returns {Function|void|any|(function(this:*))|*} The (bound) function to be called to retrieve a list of items.
     */
    getListFunction (helper) {
        // if Ignore-timestamps is specified then list all items, otherwise only list modified items (which is the default behavior)
        // if server is specified then list remote items, otherwise list local items (the default)
        const functionName = "list" +
                             ((this.getCommandLineOption("ignoreTimestamps")) ? "" : "Modified") +
                             ((this.getCommandLineOption("server")) ? "Remote" : "Local") +
                             "ItemNames";
        if (this.getCommandLineOption("ignoreTimestamps")) {
            return helper[functionName].bind(helper);
        } else {
            return helper[functionName].bind(helper, this.getFlags(helper));
        }
    }

    /**
     * List the "asset" artifacts.
     *
     * @returns {Q.Promise} A promise that is resolved with the specified list of "asset" artifacts.
     */
    listAssets () {
        const helper = toolsApi.getAssetsHelper();

        if (this.getCommandLineOption("assets") && this.getCommandLineOption("webassets")) {
            this.setApiOption(helper.ASSET_TYPES, helper.ASSET_TYPES_BOTH);
        } else if (this.getCommandLineOption("assets")) {
            this.setApiOption(helper.ASSET_TYPES, helper.ASSET_TYPES_CONTENT_ASSETS);
        } else {
            this.setApiOption(helper.ASSET_TYPES, helper.ASSET_TYPES_WEB_ASSETS);
        }

        const apiOptions = this.getApiOptions();
        const listFunction = this.getListFunction(helper);
        const assetsPromise = listFunction(apiOptions);
        const deferred = Q.defer();

        assetsPromise
            .then(function (result) {
                deferred.resolve({"type": ListAssets, "value": result});
            })
            .catch(function (err) {
                deferred.reject(err);
            });

        return deferred.promise;
    }

    /**
     * List the "image profile" artifacts.
     *
     * @returns {Q.Promise} A promise that is resolved with the specified list of "image profile" artifacts.
     */
    listImageProfiles () {
        const helper = toolsApi.getImageProfilesHelper();
        const apiOptions = this.getApiOptions();
        const listFunction = this.getListFunction(helper);
        const imageProfilesPromise = listFunction(apiOptions);
        const deferred = Q.defer();

        imageProfilesPromise
            .then(function (result) {
                deferred.resolve({"type": ListImageProfiles, "value": result});
            })
            .catch(function (err) {
                deferred.reject(err);
            });

        return deferred.promise;
    }

    /**
     * List the "category" artifacts.
     *
     * @returns {Q.Promise} A promise that is resolved with the specified list of "category" artifacts.
     */
    listCategories () {
        const helper = toolsApi.getCategoriesHelper();
        const apiOptions = this.getApiOptions();
        const listFunction = this.getListFunction(helper);
        const categoriesPromise = listFunction(apiOptions);
        const deferred = Q.defer();

        categoriesPromise
            .then(function (result) {
                deferred.resolve({"type": ListCategories, "value": result});
            })
            .catch(function (err) {
                deferred.reject(err);
            });

        return deferred.promise;
    }

    /**
     * List the "rendition" artifacts.
     *
     * @returns {Q.Promise} A promise that is resolved with the specified list of "rendition" artifacts.
     */
    listRenditions () {
        const helper = toolsApi.getRenditionsHelper();
        const apiOptions = this.getApiOptions();
        const listFunction = this.getListFunction(helper);
        const renditionsPromise = listFunction(apiOptions);
        const deferred = Q.defer();

        renditionsPromise
            .then(function (result) {
                deferred.resolve({"type": ListRenditions, "value": result});
            })
            .catch(function (err) {
                deferred.reject(err);
            });

        return deferred.promise;
    }

    /**
     * List the "type" artifacts.
     *
     * @returns {Q.Promise} A promise that is resolved with the specified list of "type" artifacts.
     */
    listTypes () {
        const helper = toolsApi.getItemTypeHelper();
        const apiOptions = this.getApiOptions();
        const listFunction = this.getListFunction(helper);
        const typePromise = listFunction(apiOptions);
        const deferred = Q.defer();

        typePromise
            .then(function (result) {
                deferred.resolve({"type": ListTypes, "value": result});
            })
            .catch(function (err) {
                deferred.reject(err);
            });

        return deferred.promise;
    }

    /**
     * List the "content" artifacts.
     *
     * @returns {Q.Promise} A promise that is resolved with the specified list of "content" artifacts.
     */
    listContent () {
        const helper = toolsApi.getContentHelper();
        const apiOptions = this.getApiOptions();
        const listFunction = this.getListFunction(helper);
        const contentsPromise = listFunction(apiOptions);
        const deferred = Q.defer();

        contentsPromise
            .then(function (result) {
                deferred.resolve({"type": ListContentItems, "value": result});
            })
            .catch(function (err) {
                deferred.reject(err);
            });

        return deferred.promise;
    }

    /**
     * List the "publishing source" artifacts.
     *
     * @returns {Q.Promise} A promise that is resolved with the specified list of "publishing source" artifacts.
     */
    listSources () {
        const helper = toolsApi.getPublishingSourcesHelper();
        const apiOptions = this.getApiOptions();
        const listFunction = this.getListFunction(helper);
        const sourcesPromise = listFunction(apiOptions);
        const deferred = Q.defer();

        sourcesPromise
            .then(function (result) {
                deferred.resolve({"type": ListPublishingSources, "value": result});
            })
            .catch(function (err) {
                deferred.reject(err);
            });

        return deferred.promise;
    }

    /**
     * List the "publishing profile" artifacts.
     *
     * @returns {Q.Promise} A promise that is resolved with the specified list of "publishing profile" artifacts.
     */
    listProfiles () {
        const helper = toolsApi.getPublishingProfilesHelper();
        const apiOptions = this.getApiOptions();
        const listFunction = this.getListFunction(helper);
        const profilesPromise = listFunction(apiOptions);
        const deferred = Q.defer();

        profilesPromise
            .then(function (result) {
                deferred.resolve({"type": ListPublishingProfiles, "value": result});
            })
            .catch(function (err) {
                deferred.reject(err);
            });

        return deferred.promise;
    }

    /**
     * List the "publishing site revision" artifacts.
     *
     * @returns {Q.Promise} A promise that is resolved with the specified list of "publishing site revision" artifacts.
     */
    listSiteRevisions () {
        const helper = toolsApi.getPublishingSiteRevisionsHelper();
        const apiOptions = this.getApiOptions();
        const listFunction = this.getListFunction(helper);
        const artifactPromise = listFunction(apiOptions);
        const deferred = Q.defer();

        artifactPromise
            .then(function (result) {
                deferred.resolve({"type": ListPublishingSiteRevisions, "value": result});
            })
            .catch(function (err) {
                deferred.reject(err);
            });

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
        this.setCommandLineOption("imageProfiles", undefined);
        this.setCommandLineOption("content", undefined);
        this.setCommandLineOption("categories", undefined);
        this.setCommandLineOption("publishingSources", undefined);
        this.setCommandLineOption("publishingProfiles", undefined);
        this.setCommandLineOption("publishingSiteRevisions", undefined);
        this.setCommandLineOption("renditions", undefined);
        this.setCommandLineOption("quiet", undefined);
        this.setCommandLineOption("path", undefined);
        this.setCommandLineOption("new", undefined);
        this.setCommandLineOption("del", undefined);
        this.setCommandLineOption("mod", undefined);
        this.setCommandLineOption("server", undefined);

        super.resetCommandLineOptions();
    }
}

function listCommand (program) {
    program
        .command('list')
        .description(i18n.__('cli_list_description'))
        .option('-t --types',            i18n.__('cli_list_opt_types'))
        .option('-a --assets',           i18n.__('cli_list_opt_assets'))
        .option('-w --webassets',        i18n.__('cli_list_opt_web_assets'))
        .option('-i --image-profiles',   i18n.__('cli_list_opt_image_profiles'))
        .option('-c --content',          i18n.__('cli_list_opt_content'))
        .option('-C --categories',       i18n.__('cli_list_opt_categories'))
        .option('-P --publishing-profiles',i18n.__('cli_list_opt_profiles'))
        .option('-R --publishing-site-revisions',i18n.__('cli_list_opt_site_revisions'))
        .option('-s --publishing-sources',i18n.__('cli_list_opt_sources'))
        .option('-r --renditions',       i18n.__('cli_list_opt_renditions'))
        .option('-q --quiet',            i18n.__('cli_list_opt_quiet'))
        .option('-I --ignore-timestamps',i18n.__('cli_list_opt_ignore_timestamps'))
        .option('-A --all-authoring',    i18n.__('cli_list_opt_all'))
        .option('--path <path>',         i18n.__('cli_list_opt_path'))
        .option('--dir <dir>',           i18n.__('cli_list_opt_dir'))
        .option('--user <user>',         i18n.__('cli_opt_user_name'))
        .option('--password <password>', i18n.__('cli_opt_password'))
        .option('--new',                 i18n.__('cli_list_opt_new'))
        .option('--del',                 i18n.__('cli_list_opt_deleted'))
        .option('--mod',                 i18n.__('cli_list_opt_modified'))
        .option('--server',              i18n.__('cli_list_opt_server'))
        .option('--url <url>',           i18n.__('cli_opt_url', {"product_name": utils.ProductName}))
        .action(function (options) {
            const command = new ListCommand(program);
            if (command.setCommandLineOptions(options, this)) {
                command.doList();
            }
        });
}

module.exports = listCommand;
