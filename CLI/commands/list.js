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
const login = ToolsApi.getLogin();
const options = ToolsApi.getOptions();
const Q = require("q");

const i18n = utils.getI18N(__dirname, ".json", "en");

const PREFIX = "========== ";
const SUFFIX = " ===========";
const ListTypes =                PREFIX + i18n.__('cli_listing_types') + SUFFIX;
const ListAssets =               PREFIX + i18n.__('cli_listing_assets') + SUFFIX;
const ListContentItems =         PREFIX + i18n.__('cli_listing_content') + SUFFIX;
const ListCategories =           PREFIX + i18n.__('cli_listing_categories') + SUFFIX;
const ListImageProfiles =        PREFIX + i18n.__('cli_listing_image_profiles') + SUFFIX;
const ListLayouts =              PREFIX + i18n.__('cli_listing_layouts') + SUFFIX;
const ListLayoutMappings =       PREFIX + i18n.__('cli_listing_layout_mappings') + SUFFIX;
const ListRenditions =           PREFIX + i18n.__('cli_listing_renditions') + SUFFIX;
const ListPublishingSiteRevisions = PREFIX + i18n.__('cli_listing_site_revisions') + SUFFIX;
const ListSites =                   PREFIX + i18n.__('cli_listing_sites') + SUFFIX;

class ListCommand extends BaseCommand {
    /**
     * Create a ListCommand object.
     *
     * @param {object} program A Commander program object.
     */
    constructor (program) {
        super(program);
    }

    static _getPagesDisplayHeader(siteItem) {
        const contextName = ToolsApi.getSitesHelper().getSiteContextName(siteItem);
        return PREFIX + i18n.__('cli_listing_pages_for_site', {id: contextName}) + SUFFIX;
    }

    _calculateTabs (maxLength, str) {
        const TAB_LENGTH = 1;
        const SEPARATOR_SPACES = 3;
        let tabs = '';
        for (let i = 0; i <= Math.trunc(maxLength / TAB_LENGTH) - Math.trunc(str.length / TAB_LENGTH) + SEPARATOR_SPACES - 1; i++) {
            tabs += ' ';
        }
        return tabs;
    }

    handleManifestOptions (context) {
        const result = super.handleManifestOptions(context);

        // The manifest created from a list command should not be limited to modified items.
        if (this.getCommandLineOption("writeManifest")) {
            this.setCommandLineOption("ignoreTimestamps", true);
        }
        return result;
    }

    /**
     * List the specified artifacts.
     */
    doList () {
        // Create the context for listing the artifacts of each specified type.
        const toolsApi = new ToolsApi();
        const context = toolsApi.getContext();
        const self = this;

        // Make sure the "dir" option can be handled successfully.
        self.handleDirOption(context)
            .then(function () {
                // Make sure the url has been specified, if login is required for this list command.
                return self.handleUrlOption(context)
            })
            .then(function () {
                // Make sure the user name and password have been specified, if login is required for this list command.
                return self.handleAuthenticationOptions(context);
            })
            .then(function () {
                // Login using the current options, if login is required for this list command.
                return self.handleLogin(context, self.getApiOptions());
            })
            .then(function() {
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
                // Handle the ready and draft options.
                return self.handleReadyDraftOptions();
            })
            .then(function () {
                // Check to see if the initialization process was successful.
                return self.handleInitialization(context);
            })
            .then(function () {
                // Initialize the list of sites to be used for this command, if necessary.
                const remote = Boolean(self.getCommandLineOption("server"));
                return self.initSites(context, remote, self.getApiOptions());
            })
            .then(function () {
                // List the modified and new artifacts by default.
                if (!self.getCommandLineOption("new") && !self.getCommandLineOption("mod") && !self.getCommandLineOption("del")) {
                    self.setCommandLineOption("mod", true);
                    self.setCommandLineOption("new", true);
                }

                // Start the display of the list.
                self.startDisplay();

                return self.listArtifacts(context);
            })
            .then(function (results) {
                // Stop the command line spinner before displaying any output.
                if (self.spinner) {
                    self.spinner.stop();
                }

                // Display the list of artifacts for each of the specified types.
                let artifactsCount = 0;
                results.forEach(function (result) {
                    const isError = (result instanceof Error);
                    const isString = (typeof result === "string");
                    if (isError || isString) {
                        const msg = isError ? result.heading + ' ' + result.message : result;
                        self.getLogger().info(msg);
                    }
                    else {
                        // Display a message for the current type.
                        const msg = result.type;
                        self.getLogger().info(msg);

                        // Display (or log) the list of items for the current type.
                        const items = result.value;
                        let maxId = 0;
                        let maxName = 0;
                        let maxPath = 0;
                        let maxContextRoot = 0;
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
                            if (item.contextRoot) {
                                maxContextRoot = Math.max(maxContextRoot, item.contextRoot.length);
                            }
                        });
                        let headingMsg = "";
                        let headingDivider = "";
                        if (maxId > 0) {
                            const ID_HEADING = i18n.__('cli_list_id_heading');
                            maxId = Math.max(maxId, ID_HEADING.length);
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
                            maxName = Math.max(maxName, NAME_HEADING.length);
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
                            maxPath = Math.max(maxPath, PATH_HEADING.length);
                            headingMsg += PATH_HEADING;
                            headingMsg += self._calculateTabs(maxPath, PATH_HEADING);
                            let dividerSegment = "";
                            for (let i = 0; i < maxPath; i++) {
                                dividerSegment += "-";
                            }
                            headingDivider += dividerSegment;
                            headingDivider += self._calculateTabs(maxPath, dividerSegment);
                        }
                        if (maxContextRoot > 0) {
                            const CONTEXT_ROOT_HEADING = i18n.__('cli_list_context_root_heading');
                            maxContextRoot = Math.max(maxContextRoot, CONTEXT_ROOT_HEADING.length);
                            headingMsg += CONTEXT_ROOT_HEADING;
                            for (let i = 0; i < maxContextRoot; i++) {
                                headingDivider += "-";
                            }
                        }
                        const logger = self.getLogger();
                        logger.info(headingMsg);
                        logger.info(headingDivider);

                        items.forEach(function (item) {
                            artifactsCount++;
                            let msg = item;
                            if (item.id || item.name || item.path || item.contextRoot) {
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
                                    msg += self._calculateTabs(maxPath, item.path);
                                }
                                if (item.contextRoot) {
                                    msg += item.contextRoot;
                                }
                            }
                            const logger = self.getLogger();
                            logger.info(msg);
                        });
                    }
                });

                // End the display of the list.
                self.endDisplay(artifactsCount);

                // Save the results to a manifest, if one was specified.
                try {
                    // Save the manifests.
                    self.saveManifests(context);
                } catch (err) {
                    // Log the error that occurred while saving the manifest, but do not fail the list operation.
                    self.getLogger().error(i18n.__("cli_save_manifest_failure", {"err": err.message}));
                }
            })
            .catch(function (err) {
                // Stop the command line spinner before displaying any output.
                if (self.spinner) {
                    self.spinner.stop();
                }

                self.errorMessage(err.message);
            })
            .finally(function () {
                // Reset the list of sites used for this command.
                self.resetSites(context);

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
        // Display the console message that the list is starting.
        BaseCommand.displayToConsole(i18n.__("cli_list_started"));

        // Start the spinner (progress indicator) if we're not doing output.
        if (this.getCommandLineOption("quiet")) {
            // Start the command line spinner, which gives the user some visual feedback that the command is running.
            this.spinner = this.getProgram().getSpinner();
            this.spinner.start();
        }

        const logger = this.getLogger();
        logger.info(i18n.__("cli_list_started"));
    }

    /**
     * End the display for the list of artifacts.
     *
     * @param {number} count The total number of artifacts that were listed.
     */
    endDisplay (count) {
        // Display the console message that the list is complete.
        this.successMessage(i18n.__("cli_listing_complete", {count: count}));

        const logger = this.getLogger();
        logger.info(i18n.__("cli_listing_complete", {count: count}));
    }

    /**
     * Prepare to list the artifacts.
     *
     * @returns {Q.Promise} A promise that is resolved when the command is ready to list artifacts.
     */
    readyToList () {
        const deferred = Q.defer();

        // There is currently no condition to wait for.
        deferred.resolve();

        return deferred.promise;
    }

    /**
     * Handle the given list promise according to whether the results or an error should be added to the results.
     *
     * @param {Q.Promise} promise A promise to list some artifacts.
     * @param {Array} results The accumulated list results.
     *
     * @returns {Q.Promise} A promise that is resolved when the list has completed.
     */
    handleListPromise (promise, results) {
        const deferredPush = Q.defer();
        promise
            .then(function (listResults) {
                results.push(listResults);
                deferredPush.resolve();
            })
            .catch(function (err) {
                results.push(err);
                deferredPush.resolve();
            });
        return deferredPush.promise;
    }

    /**
     * List the artifacts for the types specified on the command line.
     *
     * @param {Object} context The API context associated with this list command.
     *
     * @return {Q.Promise} A promise that resolves when all artifacts of the specified types have been listed.
     */
    listArtifacts (context) {
        const deferred = Q.defer();
        const self = this;

        // Keep track of the results so we can finish the command after all promises are resolved.
        const results = [];

        self.readyToList()
            .then(function () {
                if (self.getCommandLineOption("imageProfiles")) {
                    return self.handleListPromise(self.listImageProfiles(context), results);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("categories")) {
                    return self.handleListPromise(self.listCategories(context), results);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("assets") || self.getCommandLineOption("webassets")) {
                    return self.handleListPromise(self.listAssets(context), results);
                }
            })
            .then(function() {
                if (self.getCommandLineOption("layouts") && !self.isBaseTier(context)) {
                    return self.handleListPromise(self.listLayouts(context), results);
                }
            })
            .then(function() {
                if (self.getCommandLineOption("layoutMappings") && !self.isBaseTier(context)) {
                    return self.handleListPromise(self.listLayoutMappings(context), results);
                }
            })
            .then(function() {
                if (self.getCommandLineOption("renditions")) {
                    return self.handleListPromise(self.listRenditions(context), results);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("types")) {
                    return self.handleListPromise(self.listTypes(context), results);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("content")) {
                    return self.handleListPromise(self.listContent(context), results);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("sites") && !self.isBaseTier(context)) {
                    return self.handleListPromise(self.listSites(context), results);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("pages") && !self.isBaseTier(context)) {
                    // Get the list of site items to use for listing pages.
                    const siteItems = context.siteList;

                    // Local function to recursively list pages for one site at a time.
                    let index = 0;
                    const listPagesBySite = function (context) {
                        if (index < siteItems.length) {
                            return self.handleListPromise(self.listPages(context, siteItems[index++]), results)
                                .then(function () {
                                    // List pages for the next site after the previous site is complete.
                                    return listPagesBySite(context);
                                });
                        }
                    };

                    return listPagesBySite(context);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("publishingSiteRevisions")) {
                    return self.handleListPromise(self.listSiteRevisions(context), results);
                }
            })
            .then(function () {
                deferred.resolve(results);
            })
            .catch(function (err) {
                self.getLogger().error(err.message);
                deferred.reject(err);
            });

        return deferred.promise;
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
     * List the page node artifacts for a specified site
     *
     * @param {Object} context The API context associated with this list command.
     * @param {String} siteItem The site containing the pages being listed.
     *
     * @returns {Q.Promise} A promise that is resolved with the specified list
     */
    listPages(context, siteItem) {
        const helper = ToolsApi.getPagesHelper();
        const opts = utils.cloneOpts(this.getApiOptions(), {siteItem: siteItem});
        const listFunction = this.getListFunction(helper, context);
        const listPromise = listFunction(opts);
        const deferred = Q.defer();

        listPromise
            .then(function (result) {
                const displayHeader = ListCommand._getPagesDisplayHeader(siteItem);
                deferred.resolve({"type": displayHeader, "value": result});
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

    generateVerboseOutput () {
        return !this.getCommandLineOption("quiet");
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
        this.setCommandLineOption("writeManifest", undefined);

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
        .option('-R --publishing-site-revisions',i18n.__('cli_list_opt_site_revisions'))
        .option('-q --quiet',            i18n.__('cli_list_opt_quiet'))
        .option('-I --ignore-timestamps',i18n.__('cli_list_opt_ignore_timestamps'))
        .option('-A --all-authoring',    i18n.__('cli_list_opt_all'))
        .option('--write-manifest <manifest>',   i18n.__('cli_list_opt_write_manifest'))
        .option('--ready',               i18n.__('cli_list_opt_ready'))
        .option('--draft', i18n.__('cli_list_opt_draft'))
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
