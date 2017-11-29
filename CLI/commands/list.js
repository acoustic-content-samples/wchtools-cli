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
const login = ToolsApi.getLogin();
const options = ToolsApi.getOptions();
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
const ListLayouts =              PREFIX + i18n.__('cli_listing_layouts') + SUFFIX;
const ListLayoutMappings =       PREFIX + i18n.__('cli_listing_layout_mappings') + SUFFIX;
const ListRenditions =           PREFIX + i18n.__('cli_listing_renditions') + SUFFIX;
const ListPublishingSiteRevisions = PREFIX + i18n.__('cli_listing_site_revisions') + SUFFIX;
const ListSites =                   PREFIX + i18n.__('cli_listing_sites') + SUFFIX;
const ListPages =                   PREFIX + i18n.__('cli_listing_pages') + SUFFIX;

class ListCommand extends BaseCommand {
    /**
     * Create a ListCommand object.
     *
     * @param {object} program A Commander program object.
     */
    constructor (program) {
        super(program);
    }

    _calculateTabs (maxLength, str) {
        const TAB_LENGTH = 8;
        let tabs = '';
        for (let i = 0; i <= Math.trunc(maxLength / TAB_LENGTH) - Math.trunc(str.length / TAB_LENGTH); i++) {
            tabs += '\t';
        }
        return tabs;
    }

    /**
     * List the specified artifacts.
     */
    doList () {
        // Create the context for listing the artifacts of each specified type.
        const toolsApi = new ToolsApi();
        const context = toolsApi.getContext();

        // Handle the cases of either no artifact type options being specified, or the "all" option being specified.
        const self = this;
        self.handleArtifactTypes(["webassets"]);

        // Make sure the "path" and "dir" options can be handled successfully.
        if (!self.handleDirOption(context) || !self.handlePathOption()) {
            return;
        }

        // Check to see if the initialization process was successful.
        if (!self.handleInitialization(context)) {
            return;
        }

        // Make sure the url has been specified, if login is required for this list command.
        self.handleUrlOption(context)
            .then(function () {
                // Make sure the user name and password have been specified, if login is required for this list command.
                return self.handleAuthenticationOptions(context);
            })
            .then(function () {
                // Login using the current options, if login is required for this list command.
                return self.handleLogin(context, self.getApiOptions());
            })
            .then(function () {
                // List the modified and new artifacts by default.
                if (!self.getCommandLineOption("new") && !self.getCommandLineOption("mod") && !self.getCommandLineOption("del")) {
                    self.setCommandLineOption("mod", true);
                    self.setCommandLineOption("new", true);
                }

                // Start the display of the list.
                self.startDisplay();

                return Q.allSettled(self.listArtifacts(context));
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
                           msg = result.reason.toString();
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
                        const items = result.value.value;
                        let maxId = 0;
                        let maxName = 0;
                        let maxPath = 0;
                        items.forEach(function (item) {
                            if (item.id) {
                                maxId = Math.max(maxId, item.id.length);
                            }
                            if (item.name) {
                                maxName = Math.max(maxName, item.name.length);
                            }
                            if (item.path) {
                                maxPath = Math.max(maxPath, item.path.length);
                            }
                        });
                        let headingMsg = "";
                        let headingDivider = "";
                        if (maxId > 0) {
                            const ID_HEADING = i18n.__('cli_list_id_heading');
                            headingMsg += ID_HEADING;
                            headingMsg += self._calculateTabs(maxId, ID_HEADING);
                            let dividerSegment = "";
                            for (let i = 0; i < maxId; i++) {
                                dividerSegment += "-";
                            }
                            headingDivider += dividerSegment;
                            headingDivider += self._calculateTabs(maxId, dividerSegment);
                        }
                        if (maxName > 0) {
                            const NAME_HEADING = i18n.__('cli_list_name_heading');
                            headingMsg += NAME_HEADING;
                            headingMsg += self._calculateTabs(maxName, NAME_HEADING);
                            let dividerSegment = "";
                            for (let i = 0; i < maxName; i++) {
                                dividerSegment += "-";
                            }
                            headingDivider += dividerSegment;
                            headingDivider += self._calculateTabs(maxName, dividerSegment);
                        }
                        if (maxPath > 0) {
                            const PATH_HEADING = i18n.__('cli_list_path_heading');
                            headingMsg += PATH_HEADING;
                            for (let i = 0; i < maxPath; i++) {
                                headingDivider += "-";
                            }
                        }
                        if (!self.getCommandLineOption("quiet")) {
                            BaseCommand.displayToConsole(headingMsg);
                            BaseCommand.displayToConsole(headingDivider);
                        } else {
                            const logger = self.getLogger();
                            logger.info(headingMsg);
                            logger.info(headingDivider);
                        }
                        items.forEach(function (item) {
                            artifactsCount++;
                            let msg = item;
                            if (item.id || item.name || item.path) {
                                if (item.id) {
                                    msg = item.id;
                                    msg += self._calculateTabs(maxId, item.id);
                                } else {
                                    msg = "";
                                }
                                if (item.name) {
                                    msg += item.name;
                                    msg += self._calculateTabs(maxName, item.name);
                                }
                                if (item.path) {
                                    msg += item.path;
                                }
                            }
                            if (!self.getCommandLineOption("quiet")) {
                                BaseCommand.displayToConsole(msg);
                            } else {
                                const logger = self.getLogger();
                                logger.info(msg);
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
     * @param {Object} context The API context associated with this init command.
     *
     * @returns {Q.Promise} A promise that is resolved when the url has been specified.
     */
    handleUrlOption (context) {
        if (this.isLoginRequired()) {
            // A login is required, so call the super method to handle the url option in the normal way.
            return super.handleUrlOption(context);
        } else {
            // The base URL is used as a key in the hashes file when listing modified local artifacts.
            const baseUrl = options.getRelevantOption(context, this.getApiOptions(), "x-ibm-dx-tenant-base-url");
            const ignoreTimestamps = this.getCommandLineOption("ignoreTimestamps");
            if (!baseUrl && !ignoreTimestamps) {
                // A base URL has not been configured and not ignoring timestamps, so need to get a URL value.
                return super.handleUrlOption(context);
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
     * @param {Object} context The API context associated with this init command.
     *
     * @returns {Q.Promise} A promise that is resolved when the username and password have been specified, if necessary.
     */
    handleAuthenticationOptions (context) {
        if (this.isLoginRequired()) {
            // A login is required, so call the super method to handle the authentication options in the normal way.
            return super.handleAuthenticationOptions(context);
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
     * @param {Object} context The API context associated with this list command.
     * @param {Object} apiOptions - Optional API settings.
     *
     * @returns {Q.Promise} A promise to be fulfilled with the name of the logged in user.
     */
    handleLogin (context, apiOptions) {
        if (this.isLoginRequired()) {
            // A login is required, so use the loginREST object to login in the normal way.
            return login.login(context, apiOptions);
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
     * @param {Object} context The API context associated with this list command.
     *
     * @return {Array} An array of promises, each resolving to the result of listing one type of artifact.
     */
    listArtifacts (context) {
        // Keep track of the different promises so we can finish the command after all promises are resolved.
        const promises = [];

        // Handle the assets option.
        if (this.getCommandLineOption("assets") || this.getCommandLineOption("webassets")) {
            promises.push(this.listAssets(context));
        }

        // Handle the imageProfiles option.
        if (this.getCommandLineOption("imageProfiles")) {
            promises.push(this.listImageProfiles(context));
        }

        // Handle the layouts option.
        if (this.getCommandLineOption("layouts") && !this.isBaseTier(context)) {
            promises.push(this.listLayouts(context));
        }

        // Handle the layout mappings option.
        if (this.getCommandLineOption("layoutMappings") && !this.isBaseTier(context)) {
            promises.push(this.listLayoutMappings(context));
        }

        // Handle the categories option.
        if (this.getCommandLineOption("categories")) {
            promises.push(this.listCategories(context));
        }

        // Handle the renditions option.
        if (this.getCommandLineOption("renditions")) {
            promises.push(this.listRenditions(context));
        }

        if (this.getCommandLineOption("sites") && !this.isBaseTier(context)) {
            promises.push(this.listSites(context));
        }

        if (this.getCommandLineOption("pages") && !this.isBaseTier(context)) {
            promises.push(this.listPages(context));
        }

        // Handle the types option.
        if (this.getCommandLineOption("types")) {
            promises.push(this.listTypes(context));
        }

        // Handle the content option.
        if (this.getCommandLineOption("content")) {
            promises.push(this.listContent(context));
        }

        // Handle the publishing sources option.
        if (this.getCommandLineOption("publishingSources")) {
            promises.push(this.listSources(context));
        }

        // Handle the publishing profiles option.
        if (this.getCommandLineOption("publishingProfiles")) {
            promises.push(this.listProfiles(context));
        }

        // Handle the publishing profiles option.
        if (this.getCommandLineOption("publishingSiteRevisions")) {
            promises.push(this.listSiteRevisions(context));
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
     * @param {BaseHelper} helper The helper used to retrieve items.
     * @param {Object} context The API context associated with this list command.
     *
     * @returns {Function|void|any|(function(this:*))|*} The (bound) function to be called to retrieve a list of items.
     */
    getListFunction (helper, context) {
        // if Ignore-timestamps is specified then list all items, otherwise only list modified items (which is the default behavior)
        // if server is specified then list remote items, otherwise list local items (the default)
        const functionName = "list" +
                             ((this.getCommandLineOption("ignoreTimestamps")) ? "" : "Modified") +
                             ((this.getCommandLineOption("server")) ? "Remote" : "Local") +
                             "ItemNames";
        if (this.getCommandLineOption("ignoreTimestamps")) {
            return helper[functionName].bind(helper, context);
        } else {
            return helper[functionName].bind(helper, context, this.getFlags(helper));
        }
    }

    /**
     * List the "asset" artifacts.
     *
     * @param {Object} context The API context associated with this list command.
     *
     * @returns {Q.Promise} A promise that is resolved with the specified list of "asset" artifacts.
     */
    listAssets (context) {
        const helper = ToolsApi.getAssetsHelper();

        if (this.getCommandLineOption("assets") && this.getCommandLineOption("webassets")) {
            this.setApiOption(helper.ASSET_TYPES, helper.ASSET_TYPES_BOTH);
        } else if (this.getCommandLineOption("assets")) {
            this.setApiOption(helper.ASSET_TYPES, helper.ASSET_TYPES_CONTENT_ASSETS);
        } else {
            this.setApiOption(helper.ASSET_TYPES, helper.ASSET_TYPES_WEB_ASSETS);
        }

        const apiOptions = this.getApiOptions();
        const listFunction = this.getListFunction(helper, context);
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
     * @param {Object} context The API context associated with this list command.
     *
     * @returns {Q.Promise} A promise that is resolved with the specified list of "image profile" artifacts.
     */
    listImageProfiles (context) {
        const helper = ToolsApi.getImageProfilesHelper();
        const apiOptions = this.getApiOptions();
        const listFunction = this.getListFunction(helper, context);
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
     * List the layouts artifacts.
     *
     * @param {Object} context The API context associated with this list command.
     *
     * @returns {Q.Promise} A promise that is resolved with the specified list of layouts artifacts.
     */
    listLayouts (context) {
        const helper = ToolsApi.getLayoutsHelper();
        const apiOptions = this.getApiOptions();
        const listFunction = this.getListFunction(helper, context);
        const layoutsPromise = listFunction(apiOptions);
        const deferred = Q.defer();

        layoutsPromise
            .then(function (result) {
                deferred.resolve({"type": ListLayouts, "value": result});
            })
            .catch(function (err) {
                deferred.reject(err);
            });

        return deferred.promise;
    }

    /**
     * List the layout mapping artifacts.
     *
     * @param {Object} context The API context associated with this list command.
     *
     * @returns {Q.Promise} A promise that is resolved with the specified list of layout mappings artifacts.
     */
    listLayoutMappings (context) {
        const helper = ToolsApi.getLayoutMappingsHelper();
        const apiOptions = this.getApiOptions();
        const listFunction = this.getListFunction(helper, context);
        const layoutMappingsPromise = listFunction(apiOptions);
        const deferred = Q.defer();

        layoutMappingsPromise
            .then(function (result) {
                deferred.resolve({"type": ListLayoutMappings, "value": result});
            })
            .catch(function (err) {
                deferred.reject(err);
            });

        return deferred.promise;
    }

    /**
     * List the "category" artifacts.
     *
     * @param {Object} context The API context associated with this list command.
     *
     * @returns {Q.Promise} A promise that is resolved with the specified list of "category" artifacts.
     */
    listCategories (context) {
        const helper = ToolsApi.getCategoriesHelper();
        const apiOptions = this.getApiOptions();
        const listFunction = this.getListFunction(helper, context);
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
     * @param {Object} context The API context associated with this list command.
     *
     * @returns {Q.Promise} A promise that is resolved with the specified list of "rendition" artifacts.
     */
    listRenditions (context) {
        const helper = ToolsApi.getRenditionsHelper();
        const apiOptions = this.getApiOptions();
        const listFunction = this.getListFunction(helper, context);
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
     * @param {Object} context The API context associated with this list command.
     *
     * @returns {Q.Promise} A promise that is resolved with the specified list of "type" artifacts.
     */
    listTypes (context) {
        const helper = ToolsApi.getItemTypeHelper();
        const apiOptions = this.getApiOptions();
        const listFunction = this.getListFunction(helper, context);
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
     * @param {Object} context The API context associated with this list command.
     *
     * @returns {Q.Promise} A promise that is resolved with the specified list of "content" artifacts.
     */
    listContent (context) {
        const helper = ToolsApi.getContentHelper();
        const apiOptions = this.getApiOptions();
        const listFunction = this.getListFunction(helper, context);
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
     * List the "sites" artifacts.
     *
     * @param {Object} context The API context associated with this list command.
     *
     * @returns {Q.Promise} A promise that is resolved with the specified list
     */
    listSites (context) {
        const helper = ToolsApi.getSitesHelper();
        const apiOptions = this.getApiOptions();
        const listFunction = this.getListFunction(helper, context);
        const listPromise = listFunction(apiOptions);
        const deferred = Q.defer();

        listPromise
            .then(function (result) {
                deferred.resolve({"type": ListSites, "value": result});
            })
            .catch(function (err) {
                deferred.reject(err);
            });

        return deferred.promise;
    }


    /**
     * List the page node artifacts for a specified site (default only in mvp)
     *
     * @param {Object} context The API context associated with this list command.
     *
     * @returns {Q.Promise} A promise that is resolved with the specified list
     */
    listPages (context) {
        const helper = ToolsApi.getPagesHelper();
        const apiOptions = this.getApiOptions();
        const listFunction = this.getListFunction(helper, context);
        const listPromise = listFunction(apiOptions);
        const deferred = Q.defer();

        listPromise
            .then(function (result) {
                deferred.resolve({"type": ListPages, "value": result});
            })
            .catch(function (err) {
                deferred.reject(err);
            });

        return deferred.promise;
    }

    /**
     * List the "publishing source" artifacts.
     *
     * @param {Object} context The API context associated with this list command.
     *
     * @returns {Q.Promise} A promise that is resolved with the specified list of "publishing source" artifacts.
     */
    listSources (context) {
        const helper = ToolsApi.getPublishingSourcesHelper();
        const apiOptions = this.getApiOptions();
        const listFunction = this.getListFunction(helper, context);
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
     * @param {Object} context The API context associated with this list command.
     *
     * @returns {Q.Promise} A promise that is resolved with the specified list of "publishing profile" artifacts.
     */
    listProfiles (context) {
        const helper = ToolsApi.getPublishingProfilesHelper();
        const apiOptions = this.getApiOptions();
        const listFunction = this.getListFunction(helper, context);
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
     * @param {Object} context The API context associated with this list command.
     *
     * @returns {Q.Promise} A promise that is resolved with the specified list of "publishing site revision" artifacts.
     */
    listSiteRevisions (context) {
        const helper = ToolsApi.getPublishingSiteRevisionsHelper();
        const apiOptions = this.getApiOptions();
        const listFunction = this.getListFunction(helper, context);
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
        this.setCommandLineOption("layouts", undefined);
        this.setCommandLineOption("layoutMappings", undefined);
        this.setCommandLineOption("imageProfiles", undefined);
        this.setCommandLineOption("content", undefined);
        this.setCommandLineOption("categories", undefined);
        this.setCommandLineOption("publishingSources", undefined);
        this.setCommandLineOption("publishingProfiles", undefined);
        this.setCommandLineOption("publishingSiteRevisions", undefined);
        this.setCommandLineOption("renditions", undefined);
        this.setCommandLineOption("sites", undefined);
        this.setCommandLineOption("pages", undefined);
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
        .option('-l --layouts',          i18n.__('cli_list_opt_layouts'))
        .option('-m --layout-mappings',  i18n.__('cli_list_opt_layout_mappings'))
        .option('-i --image-profiles',   i18n.__('cli_list_opt_image_profiles'))
        .option('-c --content',          i18n.__('cli_list_opt_content'))
        .option('-C --categories',       i18n.__('cli_list_opt_categories'))
        .option('-r --renditions',       i18n.__('cli_list_opt_renditions'))
        .option('-s --sites',            i18n.__('cli_list_opt_sites'))
        .option('-p --pages',            i18n.__('cli_list_opt_pages'))
        .option('-P --publishing-profiles',i18n.__('cli_list_opt_profiles'))
        .option('-R --publishing-site-revisions',i18n.__('cli_list_opt_site_revisions'))
        .option('-S --publishing-sources',i18n.__('cli_list_opt_sources'))
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
        .action(function (commandLineOptions) {
            const command = new ListCommand(program);
            if (command.setCommandLineOptions(commandLineOptions, this)) {
                command.doList();
            }
        });
}

module.exports = listCommand;
