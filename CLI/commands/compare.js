/*
Copyright IBM Corporation 2018

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
const events = require("events");
const Q = require("q");
const ora = require("ora");
const fs = require("fs");

const i18n = utils.getI18N(__dirname, ".json", "en");

const PREFIX = "========== ";
const SUFFIX = " ===========";
const CompareTypes =                PREFIX + i18n.__('cli_compare_types') + SUFFIX;
const CompareAssets =               PREFIX + i18n.__('cli_compare_assets') + SUFFIX;
const CompareResources =            PREFIX + i18n.__('cli_compare_resources') + SUFFIX;
const CompareContentItems =         PREFIX + i18n.__('cli_compare_content') + SUFFIX;
const CompareDefaultContent =       PREFIX + i18n.__('cli_compare_default_content') + SUFFIX;
const CompareCategories =           PREFIX + i18n.__('cli_compare_categories') + SUFFIX;
const CompareImageProfiles =        PREFIX + i18n.__('cli_compare_image_profiles') + SUFFIX;
const CompareLayouts =              PREFIX + i18n.__('cli_compare_layouts') + SUFFIX;
const CompareLayoutMappings =       PREFIX + i18n.__('cli_compare_layout_mappings') + SUFFIX;
const CompareRenditions =           PREFIX + i18n.__('cli_compare_renditions') + SUFFIX;
const ComparePublishingSiteRevisions = PREFIX + i18n.__('cli_compare_site_revisions') + SUFFIX;
const CompareSites =                   PREFIX + i18n.__('cli_compare_sites') + SUFFIX;

// Define the names of the events emitted by the API during a compare operation.
const EVENT_ITEM_DIFF = "diff";
const EVENT_ITEM_ADDED = "added";
const EVENT_ITEM_REMOVED = "removed";

class CompareCommand extends BaseCommand {
    /**
     * Create a CompareCommand object.
     *
     * @param {object} program A Commander program object.
     */
    constructor (program) {
        super(program);
    }

    static _getPagesDisplayHeader(siteItem) {
        const contextName = ToolsApi.getSitesHelper().getSiteContextName(siteItem);
        return PREFIX + i18n.__('cli_compare_pages_for_site', {id: contextName}) + SUFFIX;
    }

    handleTargetSourceOptions (context) {
        const deferred = Q.defer();
        const source = this.getSource();
        const target = this.getTarget();
        if (!source || !target) {
            deferred.reject(new Error(i18n.__("cli_compare_source_target_required")));
        } else {
            let workingDir;
            if (!utils.isValidApiUrl(source)) {
                try {
                    // Make sure the specified directory exists.
                    if (!fs.statSync(source).isDirectory()) {
                        throw new Error(i18n.__('cli_dir_is_not_a_directory', {dir: source}));
                    }

                    workingDir = source;
                } catch (err) {
                    // Display an error message to indicate that the specified directory does not exist.
                    deferred.reject(new Error(i18n.__('cli_dir_does_not_exist', {error_code: err.code, dir: source})));
                    return deferred.promise;
                }
            }
            if (!utils.isValidApiUrl(target)) {
                try {
                    // Make sure the specified directory exists.
                    if (!fs.statSync(target).isDirectory()) {
                        throw new Error(i18n.__('cli_dir_is_not_a_directory', {dir: target}));
                    }
                } catch (err) {
                    // Display an error message to indicate that the specified directory does not exist.
                    deferred.reject(new Error(i18n.__('cli_dir_does_not_exist', {error_code: err.code, dir: target})));
                    return deferred.promise;
                }
            }

            // Set the working dir from the source or target dir.
            if (!workingDir) {
                // Use the current working directory.
                this.setApiOption("workingDir", process.cwd());
            } else {
                // Set the option for the working directory.
                this.setApiOption("workingDir", workingDir);

                // Use any options that are defined in that directory.
                options.extendOptionsFromDirectory(context, workingDir);
            }
            deferred.resolve(true);
        }
        return deferred.promise;
    }

    /**
     * Initialize the list of sites to be used for this command, if necessary.
     *
     * @param {Object} context The API context associated with this command.
     *
     * @returns {Q.Promise} A promise that will be resolved once the sites have been initialized.
     */
    initSitesForCompare (context) {
        const self = this;
        const helper = ToolsApi.getSitesHelper();

        // Create ready and draft site lists to store the sites from both the source and target.
        const readySites = [];
        const draftSites = [];

        // Obtain the list of sites for the source.
        const remote = utils.isValidApiUrl(self.getSource());
        const sourceOpts = utils.cloneOpts(self.getApiOptions());
        if (remote) {
            sourceOpts["x-ibm-dx-tenant-base-url"] = self.getSource();
        } else {
            sourceOpts["workingDir"] = self.getSource();
        }
        return self.initSites(context, remote, sourceOpts)
            .then(function () {
                // Add each source site to one of the combined site lists.
                context.siteList.forEach(function (siteItem) {
                    if (helper.getStatus(context, siteItem, self.getApiOptions()) === "draft") {
                        draftSites.push(siteItem);
                    } else {
                        readySites.push(siteItem);
                    }
                });

                // Delete the context site list, so that the target site list isn't filtered using the source site list.
                delete context.siteList;

                // Obtain the list of sites for the target.
                const remote = utils.isValidApiUrl(self.getTarget());
                const targetOpts = utils.cloneOpts(self.getApiOptions());
                if (remote) {
                    targetOpts["x-ibm-dx-tenant-base-url"] = self.getTarget();
                } else {
                    targetOpts["workingDir"] = self.getTarget();
                }
                return self.initSites(context, remote, targetOpts);
            })
            .then(function () {
                // Add each target site to one of the combined site lists.
                context.siteList.forEach(function (siteItem) {
                    if (helper.getStatus(context, siteItem, self.getApiOptions()) === "draft") {
                        // Determine whether the draft target site already exists in the combined draft sites list.
                        const exists = draftSites.some(function (site) {
                            return site.id === siteItem.id
                        });

                        // Add the draft target site to the combined draft site list if it isn't already there.
                        if (!exists) {
                            draftSites.push(siteItem);
                        }
                    } else {
                        // Determine whether the ready target site already exists in the combined ready sites list.
                        const exists = readySites.some(function (site) {
                            return site.id === siteItem.id
                        });

                        // Add the ready target site to the combined ready site list if it isn't already there.
                        if (!exists) {
                            readySites.push(siteItem);
                        }
                    }
                });

                // Set the context site list to the combined list of source and target sites.
                context.siteList = self.createSiteList(readySites, draftSites);
            });
    }

    /**
     * Compare the specified artifacts.
     */
    doCompare () {
        // Create the context for comparing the artifacts of each specified type.
        const toolsApi = new ToolsApi({eventEmitter: new events.EventEmitter()});
        const context = toolsApi.getContext();
        const self = this;

        // Make sure the "target" and "source" options can be handled successfully.
        self.handleTargetSourceOptions(context)
            .then(function () {
                // Make sure the user name and password have been specified, if login is required for this compare command.
                return self.handleAuthenticationOptions(context);
            })
            .then(function () {
                // Login using the current options, if login is required for this compare command.
                return self.handleLogin(context, self.getApiOptions());
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
                // Initialize the list of sites to be used for this command, if necessary.
                return self.initSitesForCompare(context);
            })
            .then(function () {
                // Start the display of the diffs.
                self.startDisplay();

                // Initialize the total count to 0.
                self._totalCount = 0;
                // Initialize the count of differences to 0.
                self._diffCount = 0;

                return self.compareArtifacts(context);
            })
            .then(function (results) {
                // Stop the command line spinner before displaying any output.
                if (self.spinner) {
                    self.spinner.stop();
                }

                // End the display of the compare.
                self.endDisplay();

                try {
                    // Save the manifests.
                    self.saveManifests(context);
                } catch (err) {
                    // Log the error that occurred while saving the manifest, but do not fail the compare operation.
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
     * Determine whether a login is required to execute this compare command.
     *
     * @returns {Boolean} A return value of true indicates that a login is required to execute this compare command. A
     *          return value of false indicates that a login is not required to execute this compare command.
     *
     * @private
     */
    isLoginRequired () {
        return (utils.isValidApiUrl(this.getSource()) || utils.isValidApiUrl(this.getTarget()));
    }

    /**
     * Returns the target directory or API URL for the operation.
     *
     * @returns {string} The source directory or API URL for the operation.
     *
     * @private
     */
    getTarget() {
        return this.getCommandLineOption("target");
    }

    /**
     * Returns the source directory or API URL for the operation.
     *
     * @returns {string} The source directory or API URL for the operation.
     *
     * @private
     */
    getSource() {
        return this.getCommandLineOption("source");
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
     * @param {Object} context The API context associated with this compare command.
     * @param {Object} apiOptions - Optional API settings.
     *
     * @returns {Q.Promise} A promise to be fulfilled with the name of the logged in user.
     */
    handleLogin (context, apiOptions) {
        const deferred = Q.defer();
        if (this.isLoginRequired()) {
            const loginPromises = [];
            if (utils.isValidApiUrl(this.getSource())) {
                const loginPromise = login.login(context, utils.cloneOpts(apiOptions, {"x-ibm-dx-tenant-base-url": this.getSource()}));
                loginPromises.push(loginPromise);
            }
            if (utils.isValidApiUrl(this.getTarget())) {
                const loginPromise = login.login(context, utils.cloneOpts(apiOptions, {"x-ibm-dx-tenant-base-url": this.getTarget()}));
                loginPromises.push(loginPromise);
            }
            Q.all(loginPromises).then(function () {
                deferred.resolve();
            }).catch(function (err) {
                deferred.reject(err);
            });
        } else {
            // A login is not required, so just return a resolved promise.
            deferred.resolve();
        }
        return deferred.promise;
    }

    /**
     * Start the display for the compare of artifacts.
     */
    startDisplay () {
        // Display the console message that the compare is starting.
        BaseCommand.displayToConsole(i18n.__("cli_compare_started"));

        // Start the spinner (progress indicator) if we're not doing output.
        if (!this.getCommandLineOption("verbose")) {
            // Start the command line spinner, which gives the user some visual feedback that the command is running.
            this.spinner = ora();
            this.spinner.start();
        }

        const logger = this.getLogger();
        logger.info(i18n.__("cli_compare_started"));
    }

    /**
     * End the display for the compare of artifacts.
     */
    endDisplay () {
        // Display the console message that the compare is complete.
        this.successMessage(i18n.__("cli_compare_complete", {count: this._totalCount, diffCount: this._diffCount}));

        const logger = this.getLogger();
        logger.info(i18n.__("cli_compare_complete", {count: this._totalCount, diffCount: this._diffCount}));
    }

    /**
     * Prepare to compare the artifacts.
     *
     * @returns {Q.Promise} A promise that is resolved when the command is ready to compare artifacts.
     */
    readyToCompare () {
        const deferred = Q.defer();

        // There is currently no condition to wait for.
        deferred.resolve();

        return deferred.promise;
    }

    /**
     * Handle the given compare promise according to whether the results or an error should be added to the results.
     *
     * @param {Q.Promise} artifactResults A promise to list some artifacts.
     * @param {Array} results The accumulated list results.
     *
     * @returns {Q.Promise} A promise that is resolved when the compare has completed.
     */
    handleComparePromise (artifactResults, results) {
        const self = this;
        const deferredCompare = Q.defer();
        artifactResults
            .then(function (compareResults) {
                results.push(compareResults);
                deferredCompare.resolve();
                self._diffCount += compareResults.value.diffCount;
                self._totalCount += compareResults.value.totalCount;
            })
            .catch(function (err) {
                results.push(err);
                deferredCompare.resolve();
            });
        return deferredCompare.promise;
    }

    /**
     * Compare the artifacts for the types specified on the command line.
     *
     * @param {Object} context The API context associated with this compare command.
     *
     * @return {Q.Promise} A promise that resolves when all artifacts of the specified types have been compared.
     */
    compareArtifacts (context) {
        const deferred = Q.defer();
        const self = this;

        // Keep track of the results so we can finish the command after all promises are resolved.
        const results = [];

        self.readyToCompare()
            .then(function () {
                if (self.getCommandLineOption("imageProfiles")) {
                    return self.handleComparePromise(self.compareImageProfiles(context), results);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("categories")) {
                    return self.handleComparePromise(self.compareCategories(context), results);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("assets") || self.getCommandLineOption("webassets")) {
                    return self.handleComparePromise(self.compareAssets(context), results);
                }
            })
            .then(function() {
                if (self.getCommandLineOption("layouts") && !self.isBaseTier(context)) {
                    return self.handleComparePromise(self.compareLayouts(context), results);
                }
            })
            .then(function() {
                if (self.getCommandLineOption("layoutMappings") && !self.isBaseTier(context)) {
                    return self.handleComparePromise(self.compareLayoutMappings(context), results);
                }
            })
            .then(function() {
                if (self.getCommandLineOption("renditions")) {
                    return self.handleComparePromise(self.compareRenditions(context), results);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("types")) {
                    return self.handleComparePromise(self.compareTypes(context), results);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("defaultContent")) {
                    return self.handleComparePromise(self.compareDefaultContent(context), results);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("content")) {
                    return self.handleComparePromise(self.compareContent(context), results);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("sites") && !self.isBaseTier(context)) {
                    return self.handleComparePromise(self.compareSites(context), results);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("pages") && !self.isBaseTier(context)) {
                    // Get the list of site ids to use for comparing pages.
                    const siteItems = context.siteList;

                    // Local function to recursively compare pages for one site at a time.
                    let index = 0;
                    const comparePagesBySite = function (context) {
                        if (index < siteItems.length) {
                            return self.handleComparePromise(self.comparePages(context, siteItems[index++]), results)
                                .then(function () {
                                    // Compare pages for the next site after the previous site is complete.
                                    return comparePagesBySite(context);
                                });
                        }
                    };

                    return comparePagesBySite(context);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("publishingSiteRevisions")) {
                    return self.handleComparePromise(self.compareSiteRevisions(context), results);
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
     * Converts an array containing the hierarchical path to a node in a JSON document into its string form
     * delimited by "/".
     *
     * @param node an array of JSON element names representing the path to a node in a JSON document.
     * @return {String} the string form of the provided node object.
     */
    getNodeString (node) {
        let result = undefined;
        node.forEach(function (element) {
            if (!result) {
                result = element;
            } else {
                result += "/" + element;
            }
        });
        return result;
    }

    /**
     * Registers the event emitter listeners for difference events.
     */
    registerEmitterListeners (context) {
        const serviceToMessageKey = {
            "types": "type",
            "assets": "asset",
            "resources": "resource",
            "layouts": "layout",
            "layout-mappings": "layout_mapping",
            "image-profiles": "image_profile",
            "content": "content",
            "categories": "category",
            "renditions": "rendition",
            "site-revisions": "site_revision",
            "sites": "site",
            "pages": "page"
        };

        const emitter = context.eventEmitter;
        const self = this;
        const verbose = this.getCommandLineOption("verbose");

        // The API emits an event when an item is different, so we display it for the user.
        const artifactDiff = function (diff) {
            let messageKey;
            let message;
            if (diff.artifactName === "sites") {
                messageKey = "cli_compare_site_diff";
                message = i18n.__(messageKey, {contextName: ToolsApi.getSitesHelper().getSiteContextName(diff.item)});
            } else {
                messageKey = "cli_compare_" + serviceToMessageKey[diff.artifactName] + "_diff";
                message = i18n.__(messageKey, {id: diff.item.path || diff.item.name || diff.item.id});
            }
            self.getLogger().info(message);
            if (verbose) {
                if (diff.diffs) {
                    const diffStrings = [];

                    if (diff.diffs.added) {
                        diff.diffs.added.forEach(function (added) {
                            diffStrings.push("+ " + self.getNodeString(added.node));
                            diffStrings.push("< " + added.value1);
                        });
                    }
                    if (diff.diffs.removed) {
                        diff.diffs.removed.forEach(function (removed) {
                            diffStrings.push("- " + self.getNodeString(removed.node));
                            diffStrings.push("< " + removed.value2);
                        });
                    }
                    if (diff.diffs.changed) {
                        diff.diffs.changed.forEach(function (changed) {
                            diffStrings.push("! " + self.getNodeString(changed.node));
                            diffStrings.push("< " + changed.value1);
                            diffStrings.push("> " + changed.value2);
                        });
                    }
                    diffStrings.forEach(function (diffString) {
                        BaseCommand.displayToConsole(diffString);
                    });
                }
            }
        };
        emitter.on(EVENT_ITEM_DIFF, artifactDiff);

        // The API emits an event when an item is added, so we display it for the user.
        const artifactAdded = function (diff) {
            let messageKey;
            let message;
            if (diff.artifactName === "sites") {
                messageKey = "cli_compare_site_added";
                message = i18n.__(messageKey, {contextName: ToolsApi.getSitesHelper().getSiteContextName(diff.item)});
            } else {
                messageKey = "cli_compare_" + serviceToMessageKey[diff.artifactName] + "_added";
                message = i18n.__(messageKey, {id: diff.item.path || diff.item.name || diff.item.id});
            }
            self.getLogger().info(message);
        };
        emitter.on(EVENT_ITEM_ADDED, artifactAdded);

        // The API emits an event when an item is removed, so we display it for the user.
        const artifactRemoved = function (diff) {
            let messageKey;
            let message;
            if (diff.artifactName === "sites") {
                messageKey = "cli_compare_site_removed";
                message = i18n.__(messageKey, {contextName: ToolsApi.getSitesHelper().getSiteContextName(diff.item)});
            } else {
                messageKey = "cli_compare_" + serviceToMessageKey[diff.artifactName] + "_removed";
                message = i18n.__(messageKey, {id: diff.item.path || diff.item.name || diff.item.id});
            }



            self.getLogger().info(message);
        };
        emitter.on(EVENT_ITEM_REMOVED, artifactRemoved);
    }

    /**
     * Remove all event listeners.
     */
    clearEventListeners (context) {
        const emitter = context.eventEmitter;
        emitter.removeAllListeners(EVENT_ITEM_DIFF);
        emitter.removeAllListeners(EVENT_ITEM_ADDED);
        emitter.removeAllListeners(EVENT_ITEM_REMOVED);
    }

    /**
     * Compare a set of artifacts.
     *
     * @param {Object} context The API context associated with this compare command.
     * @param {Object} helper The Helper object for this compare.
     * @param {String} headingMessage The message to use for the heading of this section.
     * @param {Object} opts The options for this action.
     *
     * @returns {Q.Promise} A promise that is resolved with the compare result for the specified artifacts.
     */
    compareArtifactsImpl (context, helper, headingMessage, opts) {
        const self = this;

        this.registerEmitterListeners(context);

        const target = this.getTarget();
        const source = this.getSource();

        self.getLogger().info(headingMessage);
        const deferred = Q.defer();

        let returnValue;
        helper.compare(context, target, source, opts)
            .then(function (result) {
                // Save the return value here.
                returnValue = {"type": headingMessage, "value": result};
            })
            .catch(function (err) {
                // Log the error.
                self.getLogger().error(err.message);

                // Display the error message that the compare failed.
                self.getLogger().info(err.message);
                deferred.reject(err);
            })
            .finally(function () {
                self.clearEventListeners(context);

                // Now resolve the deferred with the return value after the event listeners have been cleared.
                if (returnValue) {
                    deferred.resolve(returnValue);
                }
            });

        return deferred.promise;
    }

    /**
     * Compare the "asset" artifacts.
     *
     * @param {Object} context The API context associated with this compare command.
     *
     * @returns {Q.Promise} A promise that is resolved with the specified list of "asset" artifacts.
     */
    compareAssets (context) {
        const helper = ToolsApi.getAssetsHelper();
        const opts = this.getApiOptions();
        if (this.getCommandLineOption("assets") && this.getCommandLineOption("webassets")) {
            this.setApiOption(helper.ASSET_TYPES, helper.ASSET_TYPES_BOTH);
        } else if (this.getCommandLineOption("assets")) {
            this.setApiOption(helper.ASSET_TYPES, helper.ASSET_TYPES_CONTENT_ASSETS);
        } else {
            this.setApiOption(helper.ASSET_TYPES, helper.ASSET_TYPES_WEB_ASSETS);
        }
        return this.compareArtifactsImpl(context, helper, CompareAssets, opts);
    }

    /**
     * Compare the "image profile" artifacts.
     *
     * @param {Object} context The API context associated with this compare command.
     *
     * @returns {Q.Promise} A promise that is resolved with the specified list of "image profile" artifacts.
     */
    compareImageProfiles (context) {
        const helper = ToolsApi.getImageProfilesHelper();
        const opts = this.getApiOptions();
        return this.compareArtifactsImpl(context, helper, CompareImageProfiles, opts);
    }

    /**
     * Compare the layouts artifacts.
     *
     * @param {Object} context The API context associated with this compare command.
     *
     * @returns {Q.Promise} A promise that is resolved with the specified list of layouts artifacts.
     */
    compareLayouts (context) {
        const helper = ToolsApi.getLayoutsHelper();
        const opts = this.getApiOptions();
        return this.compareArtifactsImpl(context, helper, CompareLayouts, opts);
    }

    /**
     * Compare the layout mapping artifacts.
     *
     * @param {Object} context The API context associated with this compare command.
     *
     * @returns {Q.Promise} A promise that is resolved with the specified list of layout mappings artifacts.
     */
    compareLayoutMappings (context) {
        const helper = ToolsApi.getLayoutMappingsHelper();
        const opts = this.getApiOptions();
        return this.compareArtifactsImpl(context, helper, CompareLayoutMappings, opts);
    }

    /**
     * Compare the "category" artifacts.
     *
     * @param {Object} context The API context associated with this compare command.
     *
     * @returns {Q.Promise} A promise that is resolved with the specified list of "category" artifacts.
     */
    compareCategories (context) {
        const helper = ToolsApi.getCategoriesHelper();
        const opts = this.getApiOptions();
        return this.compareArtifactsImpl(context, helper, CompareCategories, opts);
    }

    /**
     * Compare the "rendition" artifacts.
     *
     * @param {Object} context The API context associated with this compare command.
     *
     * @returns {Q.Promise} A promise that is resolved with the specified list of "rendition" artifacts.
     */
    compareRenditions (context) {
        const helper = ToolsApi.getRenditionsHelper();
        const opts = this.getApiOptions();
        return this.compareArtifactsImpl(context, helper, CompareRenditions, opts);
    }

    /**
     * Compare the "type" artifacts.
     *
     * @param {Object} context The API context associated with this compare command.
     *
     * @returns {Q.Promise} A promise that is resolved with the specified list of "type" artifacts.
     */
    compareTypes (context) {
        const helper = ToolsApi.getItemTypeHelper();
        const opts = this.getApiOptions();
        return this.compareArtifactsImpl(context, helper, CompareTypes, opts);
    }

    /**
     * Compare the "default-content" artifacts.
     *
     * @param {Object} context The API context associated with this compare command.
     *
     * @returns {Q.Promise} A promise that is resolved with the specified list of "default-content" artifacts.
     */
    compareDefaultContent (context) {
        const helper = ToolsApi.getDefaultContentHelper();
        const opts = this.getApiOptions();
        return this.compareArtifactsImpl(context, helper, CompareDefaultContent, opts);
    }

    /**
     * Compare the "content" artifacts.
     *
     * @param {Object} context The API context associated with this compare command.
     *
     * @returns {Q.Promise} A promise that is resolved with the specified list of "content" artifacts.
     */
    compareContent (context) {
        const helper = ToolsApi.getContentHelper();
        const opts = this.getApiOptions();
        return this.compareArtifactsImpl(context, helper, CompareContentItems, opts);
    }

    /**
     * Compare the "sites" artifacts.
     *
     * @param {Object} context The API context associated with this compare command.
     *
     * @returns {Q.Promise} A promise that is resolved with the specified list
     */
    compareSites (context) {
        const helper = ToolsApi.getSitesHelper();
        const opts = this.getApiOptions();
        return this.compareArtifactsImpl(context, helper, CompareSites, opts);
    }


    /**
     * Compare the page node artifacts for a specified site
     *
     * @param {Object} context The API context associated with this compare command.
     * @param {String} siteItem The site containing the pages being compared.
     *
     * @returns {Q.Promise} A promise that is resolved with the specified list
     */
    comparePages(context, siteItem) {
        const helper = ToolsApi.getPagesHelper();
        const opts = utils.cloneOpts(this.getApiOptions(), {siteItem: siteItem});
        const displayHeader = CompareCommand._getPagesDisplayHeader(siteItem);
        return this.compareArtifactsImpl(context, helper, displayHeader, opts);
    }

    /**
     * Compare the "publishing site revision" artifacts.
     *
     * @param {Object} context The API context associated with this compare command.
     *
     * @returns {Q.Promise} A promise that is resolved with the specified list of "publishing site revision" artifacts.
     */
    compareSiteRevisions (context) {
        const helper = ToolsApi.getPublishingSiteRevisionsHelper();
        const opts = this.getApiOptions();
        return this.compareArtifactsImpl(context, helper, ComparePublishingSiteRevisions, opts);
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
        this.setCommandLineOption("publishingSiteRevisions", undefined);
        this.setCommandLineOption("renditions", undefined);
        this.setCommandLineOption("sites", undefined);
        this.setCommandLineOption("pages", undefined);
        this.setCommandLineOption("verbose", undefined);
        this.setCommandLineOption("manifest", undefined);
        this.setCommandLineOption("filterDeletions", undefined);
        this.setCommandLineOption("writeManifest", undefined);
        this.setCommandLineOption("writeDeletionsManifest", undefined);
        this.setCommandLineOption("source", undefined);
        this.setCommandLineOption("target", undefined);

        super.resetCommandLineOptions();
    }
}

function compareCommand (program) {
    program
        .command('compare')
        .description(i18n.__('cli_compare_description'))
        .option('-t --types',            i18n.__('cli_compare_opt_types'))
        .option('-a --assets',           i18n.__('cli_compare_opt_assets'))
        .option('-w --webassets',        i18n.__('cli_compare_opt_web_assets'))
        .option('-l --layouts',          i18n.__('cli_compare_opt_layouts'))
        .option('-m --layout-mappings',  i18n.__('cli_compare_opt_layout_mappings'))
        .option('-i --image-profiles',   i18n.__('cli_compare_opt_image_profiles'))
        .option('-c --content',          i18n.__('cli_compare_opt_content'))
        .option('-D --default-content',  i18n.__('cli_compare_opt_default_content'))
        .option('-C --categories',       i18n.__('cli_compare_opt_categories'))
        .option('-r --renditions',       i18n.__('cli_compare_opt_renditions'))
        .option('-s --sites',            i18n.__('cli_compare_opt_sites'))
        .option('-p --pages',            i18n.__('cli_compare_opt_pages'))
        .option('-R --publishing-site-revisions',i18n.__('cli_compare_opt_site_revisions'))
        .option('-v --verbose',          i18n.__('cli_compare_opt_verbose'))
        .option('-A --all-authoring',    i18n.__('cli_compare_opt_all'))
        .option('--ready', i18n.__('cli_compare_opt_ready'))
        .option('--draft', i18n.__('cli_compare_opt_draft'))
        .option('--site-context <contextRoot>', i18n.__('cli_compare_opt_siteContext'))
        .option('--manifest <manifest>', i18n.__('cli_compare_opt_use_manifest'))
        .option('--filter-deletions <manifest>', i18n.__('cli_compare_opt_filter_deletions'))
        .option('--write-manifest <manifest>',   i18n.__('cli_compare_opt_write_manifest'))
        .option('--write-deletions-manifest <manifest>',   i18n.__('cli_compare_opt_write_deletions_manifest'))
        .option('--source <dir>',        i18n.__('cli_compare_opt_source'))
        .option('--target <dir>',        i18n.__('cli_compare_opt_target'))
        .option('--user <user>',         i18n.__('cli_opt_user_name'))
        .option('--password <password>', i18n.__('cli_opt_password'))
        .action(function (commandLineOptions) {
            const command = new CompareCommand(program);
            if (command.setCommandLineOptions(commandLineOptions, this)) {
                command.doCompare();
            }
        });
}

module.exports = compareCommand;
