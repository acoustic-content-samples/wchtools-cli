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

const Q = require("q");
Q.longStackSupport = true;
const itemTypesHelper = require('./itemTypesHelper').instance;
const assetsHelper = require('./assetsHelper.js').instance;
const contentHelper = require('./contentHelper').instance;
const categoriesHelper = require('./categoriesHelper').instance;
const publishingJobsHelper = require('./publishingJobsHelper').instance;
const publishingSourcesHelper = require('./publishingSourcesHelper').instance;
const publishingProfilesHelper = require('./publishingProfilesHelper').instance;
const publishingSiteRevisionsHelper = require('./publishingSiteRevisionsHelper').instance;
const renditionsHelper = require('./renditionsHelper').instance;
const imageProfilesHelper = require('./imageProfilesHelper').instance;
const layoutsHelper = require('./layoutsHelper').instance;
const layoutMappingsHelper = require('./layoutMappingsHelper').instance;
const sitesHelper = require('./sitesHelper').instance;
const pagesHelper = require('./pagesHelper').instance;
const edgeConfigHelper = require('./edgeConfigHelper').instance;
const login = require('./lib/loginREST').instance;
const utils = require('./lib/utils/utils.js');
const options = require('./lib/utils/options.js');
const manifests = require('./lib/utils/manifests.js');
const hashes = require('./lib/utils/hashes.js');
const events = require("events");

class WchToolsApi {
    /**
     * Create an instance of the API. The context from this instance can be used when calling API methods.
     *
     * @param {Object} [contextOptions] The options to be used for the API context.
     * @param {Object} [contextOptions.logger] The logger to be used for API log entries.
     * @param {Object} [contextOptions.eventEmitter] The event emitter to be used for API events.
     * @param {Boolean} [contextOptions.useHashes] Flag for whether the API should use hashes to determine which files have been modified.
     * @param {Boolean} [contextOptions.rewriteOnPush] Flag for whether pushed artifacts should be written back to disk.
     * @param {Boolean} [contextOptions.saveFileOnConflict] Flag for whether a conflict file should be saved.
     * @param {Boolean} [contextOptions.continueOnError] Flag for whether to continue pushing items after encountering an error.
     * @param {Boolean} [contextOptions.urls] Service urls.
     */
    constructor (contextOptions) {
        // The context object contains the options for a specific API instance. These options are initialized using the
        // values defined in the appropriate options files and the specified options. API methods will use the options
        // module to retrieve options from the context object, and the opts parameter can be used to override the
        // options from the context object.
        this.context = {};

        // Initialize the options for the context, based on the values in the options files.
        options.initialize(this.context);

        // Use an empty object if the context options were not specified.
        contextOptions = contextOptions || {};

        // Use hashes to determine which files have been modified, unless the useHashes property is set to false.
        contextOptions.useHashes = (typeof contextOptions.useHashes !== "boolean") || (contextOptions.useHashes === true);

        // Rewrite pushed artifacts, unless the rewriteOnPush property is set to false.
        contextOptions.rewriteOnPush = (typeof contextOptions.rewriteOnPush !== "boolean") || (contextOptions.rewriteOnPush === true);

        // Save a "conflict" file when a pushed artifact produces a conflict error, unless the saveFileOnConflict property is set to false.
        contextOptions.saveFileOnConflict = (typeof contextOptions.saveFileOnConflict !== "boolean") || (contextOptions.saveFileOnConflict === true);

        // Continue pushing items after encountering an error, unless the continueOnError property is set to false.
        contextOptions.continueOnError = (typeof contextOptions.continueOnError !== "boolean") || (contextOptions.continueOnError === true);

        // Use the standard API logger, if a logger was not specified on the context options.
        contextOptions.logger = contextOptions.logger || utils.getLogger(utils.apisLog);

        // Assert that all required APIs on the logger are available
        const loggerFunctions = ["error", "warn", "info", "trace", "debug", "isDebugEnabled"];
        loggerFunctions.forEach(function (name) {
            if (typeof contextOptions.logger[name] !== "function") {
                throw "logger does not implement required function " + name;
            }
        });

        // Set the provided microservice URLs on the options.
        if (contextOptions.urls) {
            const urlOptions = {};
            Object.keys(contextOptions.urls).forEach(function (service) {
                urlOptions[service] = {
                    "x-ibm-dx-tenant-base-url": contextOptions.urls[service]
                };
            });
            options.setOptions(contextOptions, urlOptions);
        }

        // Now set the options on the context.
        options.setOptions(this.context, contextOptions);

        // The event emitter specified on the context options has associated functions, so it needs to be set directly.
        this.context.eventEmitter = contextOptions.eventEmitter;

        // The logger specified on the context options has associated functions, so it needs to be set directly.
        this.context.logger = contextOptions.logger;
    }

    /**
     * Get the context associated with this API instance.
     *
     * @returns {Object} The context associated with this API instance.
     */
    getContext() {
        return this.context;
    }

    getLogger () {
        return options.getProperty(this.context, "logger");
    }

    static getItemTypeHelper () {
        return itemTypesHelper;
    }

    static getAssetsHelper () {
        return assetsHelper;
    }

    static getImageProfilesHelper () {
        return imageProfilesHelper;
    }

    static getRenditionsHelper () {
        return renditionsHelper;
    }

    static getContentHelper () {
        return contentHelper;
    }

    static getCategoriesHelper () {
        return categoriesHelper;
    }

    static getPublishingJobsHelper () {
        return publishingJobsHelper;
    }

    static getPublishingSourcesHelper () {
        return publishingSourcesHelper;
    }

    static getPublishingProfilesHelper () {
        return publishingProfilesHelper;
    }

    static getPublishingSiteRevisionsHelper () {
        return publishingSiteRevisionsHelper;
    }

    static getLayoutsHelper () {
        return layoutsHelper;
    }

    static getLayoutMappingsHelper () {
        return layoutMappingsHelper;
    }

    static getSitesHelper () {
        return sitesHelper;
    }

    static getPagesHelper () {
        return pagesHelper;
    }

    static getEdgeConfigHelper () {
        return edgeConfigHelper;
    }

    static getRemoteSites (context, opts) {
        // Get the remote sites for the specified context.
        return sitesHelper.getRemoteItems(context, opts);
    }

    static getLocalSites (context, opts) {
        // Get the local sites for the specified context.
        return sitesHelper.getLocalItems(context, opts);
    }

    static getInitializationErrors (context) {
        // Return any errors that occurred during initialization of the required modules.
        return options.getInitializationErrors(context);
    }

    static getLogin () {
        return login;
    }

    static getUtils () {
        return utils;
    }

    static getOptions () {
        return options;
    }

    static getManifests () {
        return manifests;
    }

    static getHashes () {
        return hashes;
    }

    pushAllItems (opts) {
        this.context.wchToolsApiPushMethod = "pushAllItems";
        return this.pushItems(opts);
    }

    pushModifiedItems (opts) {
        this.context.wchToolsApiPushMethod = "pushModifiedItems";
        return this.pushItems(opts);
    }

    pushItems (opts) {
        this.getLogger().info("pushItems started");

        const deferred = Q.defer();
        const self = this;

        const pushedItems = [];
        let errors = undefined;

        const pushedListener = function (name) {
            self.getLogger().info("PUSHED: ", name);
            pushedItems.push(name);
        };
        const pushedErrorListener = function (error, name) {
            self.getLogger().info("PUSHED ERROR: ", name, error);
            if (!errors) {
                errors = [];
            }
            errors.push(error);
        };
        if (!this.context.eventEmitter) {
            this.context.eventEmitter = new events.EventEmitter();
        }
        this.context.eventEmitter.on("pushed", pushedListener);
        this.context.eventEmitter.on("pushed-error", pushedErrorListener);

        let siteIds = [];
        WchToolsApi.getLocalSites(this.context, opts)
            .then(function (sites) {
                if (sites) {
                    // Add each local site to the ready list or the draft list.
                    const readySiteIds = [];
                    const draftSiteIds = [];
                    sites.forEach(function (site) {
                        if (site.siteStatus === "draft") {
                            // Add draft site to the draft list.
                            draftSiteIds.push(site.id);
                        } else {
                            // Add ready site to the ready list.
                            readySiteIds.push(site.id);
                        }
                    });

                    // A draft page always refers to a ready page, so push the ready pages before the draft pages.
                    siteIds = readySiteIds.concat(draftSiteIds);
                }
            })
            .then(function () {
                return self.handlePromise(self.pushImageProfiles(opts))
            })
            .then(function () {
                return self.handlePromise(self.pushCategories(opts));
            })
            .then(function () {
                return self.handlePromise(self.pushAssets(opts));
            })
            .then(function () {
                return self.handlePromise(self.pushRenditions(opts));
            })
            .then(function () {
                return self.handlePromise(self.pushLayouts(opts));
            })
            .then(function () {
                return self.handlePromise(self.pushTypes(opts));
            })
            .then(function () {
                return self.handlePromise(self.pushLayoutMappings(opts));
            })
            .then(function () {
                return self.handlePromise(self.pushContent(opts));
            })
            .then(function () {
                return self.handlePromise(self.pushSites(opts));
            })
            .then(function () {
                // Local function to recursively push pages for one site at a time.
                let index = 0;
                const pushPagesBySite = function () {
                    if (index < siteIds.length) {
                        return self.handlePromise(self.pushPages(utils.cloneOpts(opts, {siteId: siteIds[index++]})))
                            .then(function () {
                                return pushPagesBySite();
                            });
                    }
                };

                return pushPagesBySite();
            })
            .then(function () {
                return self.handlePromise(self.pushSources(opts));
            })
            .then(function () {
                return self.handlePromise(self.pushProfiles(opts));
            })
            .then(function () {
                return self.handlePromise(self.pushSiteRevisions(opts));
            })
            .then(function () {
                self.getLogger().info("pushItems complete");
                if (!errors) {
                    deferred.resolve(pushedItems);
                } else {
                    deferred.reject(errors);
                }
            })
            .catch(function (err) {
                self.getLogger().error("pushItems complete with error", err);
                deferred.reject(err);
            })
            .finally(function () {
                self.context.eventEmitter.removeListener("pushed", pushedListener);
                self.context.eventEmitter.removeListener("pushed-error", pushedErrorListener);
            });

        return deferred.promise;
    }

    handlePromise(promise) {
        const self = this;
        if (options.getProperty(self.context, "continueOnError")) {
            // Create a nested promise. Any error thrown by this promise will be logged, but not returned to the caller.
            const deferredPush = Q.defer();
            promise
                .then(function () {
                    deferredPush.resolve();
                })
                .catch(function (err) {
                    const logger = self.getLogger();
                    logger.error(err.message);
                    deferredPush.resolve();
                });
            return deferredPush.promise;
        } else {
            // Any error thrown by this promise will be returned to the caller.
            return promise;
        }
    }

    pushImageProfiles (opts) {
        this.getLogger().info("pushImageProfiles started");
        const helper = WchToolsApi.getImageProfilesHelper();
        const promise = helper[this.context.wchToolsApiPushMethod](this.context, opts);
        this.getLogger().info("pushImageProfiles complete");
        return promise;
    }

    pushCategories (opts) {
        this.getLogger().info("pushCategories started");
        const helper = WchToolsApi.getCategoriesHelper();
        const promise = helper[this.context.wchToolsApiPushMethod](this.context, opts);
        this.getLogger().info("pushCategories complete");
        return promise;
    }

    pushAssets (opts) {
        this.getLogger().info("pushAssets started");
        const helper = WchToolsApi.getAssetsHelper();
        const promise = helper[this.context.wchToolsApiPushMethod](this.context, opts);
        this.getLogger().info("pushAssets complete");
        return promise;
    }

    pushRenditions (opts) {
        this.getLogger().info("pushRenditions started");
        const helper = WchToolsApi.getRenditionsHelper();
        const promise = helper[this.context.wchToolsApiPushMethod](this.context, opts);
        this.getLogger().info("pushRenditions complete");
        return promise;
    }

    pushLayouts (opts) {
        this.getLogger().info("pushLayouts started");
        const helper = WchToolsApi.getLayoutsHelper();
        const promise = helper[this.context.wchToolsApiPushMethod](this.context, opts);
        this.getLogger().info("pushLayouts complete");
        return promise;
    }

    pushTypes (opts) {
        this.getLogger().info("pushTypes started");
        const helper = WchToolsApi.getItemTypeHelper();
        const promise = helper[this.context.wchToolsApiPushMethod](this.context, opts);
        this.getLogger().info("pushTypes complete");
        return promise;
    }

    pushLayoutMappings (opts) {
        this.getLogger().info("pushLayoutMappings started");
        const helper = WchToolsApi.getLayoutMappingsHelper();
        const promise = helper[this.context.wchToolsApiPushMethod](this.context, opts);
        this.getLogger().info("pushLayoutMappings complete");
        return promise;
    }

    pushContent (opts) {
        this.getLogger().info("pushContent started");
        const helper = WchToolsApi.getContentHelper();
        const promise = helper[this.context.wchToolsApiPushMethod](this.context, opts);
        this.getLogger().info("pushContent complete");
        return promise;
    }

    pushSites (opts) {
        this.getLogger().info("pushSites started");
        const helper = WchToolsApi.getSitesHelper();
        const promise = helper[this.context.wchToolsApiPushMethod](this.context, opts);
        this.getLogger().info("pushSites complete");
        return promise;
    }

    pushPages (opts) {
        this.getLogger().info("pushPages started");
        const helper = WchToolsApi.getPagesHelper();
        const promise = helper[this.context.wchToolsApiPushMethod](this.context, opts);
        this.getLogger().info("pushPages complete");
        return promise;
    }

    pushSources (opts) {
        this.getLogger().info("pushSources started");
        const helper = WchToolsApi.getPublishingSourcesHelper();
        const promise = helper[this.context.wchToolsApiPushMethod](this.context, opts);
        this.getLogger().info("pushSources complete");
        return promise;
    }

    pushProfiles (opts) {
        this.getLogger().info("pushProfiles started");
        const helper = WchToolsApi.getPublishingProfilesHelper();
        const promise = helper[this.context.wchToolsApiPushMethod](this.context, opts);
        this.getLogger().info("pushProfiles complete");
        return promise;
    }

    pushSiteRevisions (opts) {
        this.getLogger().info("pushSiteRevisions started");
        const helper = WchToolsApi.getPublishingSiteRevisionsHelper();
        const promise = helper[this.context.wchToolsApiPushMethod](this.context, opts);
        this.getLogger().info("pushSiteRevisions complete");
        return promise;
    }

    deleteAllItems (opts) {
        this.getLogger().info("deleteAllItems started");

        const deferred = Q.defer();
        const self = this;

        const deletedItems = [];
        let errors = undefined;

        const deletedListener = function (name) {
            self.getLogger().info("DELETED: ", name);
            deletedItems.push(name);
        };

        const deleteErrorListener = function (error, name) {
            self.getLogger().info("DELETE ERROR: ", name, error);
            if (!errors) {
                errors = [];
            }
            errors.push(error);
        };

        if (!this.context.eventEmitter) {
            this.context.eventEmitter = new events.EventEmitter();
        }
        this.context.eventEmitter.on("deleted", deletedListener);
        this.context.eventEmitter.on("deleted-error", deleteErrorListener);

        let siteIds = [];
        WchToolsApi.getRemoteSites(this.context, opts)
            .then(function (sites) {
                if (sites) {
                    // Add each remote site to the ready list or the draft list.
                    const readySiteIds = [];
                    const draftSiteIds = [];
                    sites.forEach(function (site) {
                        if (site.siteStatus === "draft") {
                            // Add draft site to the draft list.
                            draftSiteIds.push(site.id);
                        } else {
                            // Add ready site to the ready list.
                            readySiteIds.push(site.id);
                        }
                    });

                    // A ready page cannot be deleted if a draft page refers to it, so draft pages are deleted first.
                    siteIds = draftSiteIds.concat(readySiteIds);
                }
            })
            .then(function () {
                // Local function to recursively delete pages for one site at a time.
                let index = 0;
                const deletePagesBySite = function () {
                    if (index < siteIds.length) {
                        return self.handlePromise(self.deleteAllPages(utils.cloneOpts(opts, {siteId: siteIds[index++]})))
                            .then(function () {
                                return deletePagesBySite();
                            });
                    }
                };

                return deletePagesBySite();
            })
            .then(function () {
                return self.handlePromise(self.deleteAllContent(opts));
            })
            .then(function () {
                return self.handlePromise(self.deleteAllLayoutMappings(opts));
            })
            .then(function () {
                return self.handlePromise(self.deleteAllTypes(opts));
            })
            .then(function () {
                return self.handlePromise(self.deleteAllLayouts(opts));
            })
            .then(function () {
                return self.handlePromise(self.deleteAllCategories(opts));
            })
            .then(function () {
                return self.handlePromise(self.deleteAllAssets(opts));
            })
            .then(function () {
                return self.handlePromise(self.deleteAllImageProfiles(opts));
            })
            .then(function () {
                self.getLogger().info("deleteAllItems complete");
                if (!errors) {
                    deferred.resolve(deletedItems);
                } else {
                    deferred.reject(errors);
                }
            })
            .catch(function (err) {
                self.getLogger().error("deleteAllItems complete with error", err);
                deferred.reject(err);
            })
            .finally(function () {
                self.context.eventEmitter.removeListener("deleted", deletedListener);
                self.context.eventEmitter.removeListener("deleted-error", deleteErrorListener);
            });

        return deferred.promise;
    }

    deleteAllPages (opts) {
        this.getLogger().info("deleteAllPages started");
        const helper = WchToolsApi.getPagesHelper();
        const promise = helper.deleteRemoteItems(this.context, opts);
        this.getLogger().info("deleteAllPages complete");
        return promise;
    }

    deleteAllContent (opts) {
        this.getLogger().info("deleteAllContent started");
        const helper = WchToolsApi.getContentHelper();
        const promise = helper.deleteRemoteItems(this.context, opts);
        this.getLogger().info("deleteAllContent complete");
        return promise;
    }

    deleteAllLayoutMappings (opts) {
        this.getLogger().info("deleteAllLayoutMappings started");
        const helper = WchToolsApi.getLayoutMappingsHelper();
        const promise = helper.deleteRemoteItems(this.context, opts);
        this.getLogger().info("deleteAllLayoutMappings complete");
        return promise;
    }

    deleteAllTypes (opts) {
        this.getLogger().info("deleteAllTypes started");
        const helper = WchToolsApi.getItemTypeHelper();
        const promise = helper.deleteRemoteItems(this.context, opts);
        this.getLogger().info("deleteAllTypes complete");
        return promise;
    }

    deleteAllLayouts (opts) {
        this.getLogger().info("deleteAllLayouts started");
        const helper = WchToolsApi.getLayoutsHelper();
        const promise = helper.deleteRemoteItems(this.context, opts);
        this.getLogger().info("deleteAllLayouts complete");
        return promise;
    }

    deleteAllCategories (opts) {
        this.getLogger().info("deleteAllCategories started");
        const helper = WchToolsApi.getCategoriesHelper();
        const promise = helper.deleteRemoteItems(this.context, opts);
        this.getLogger().info("deleteAllCategories complete");
        return promise;
    }

    deleteAllAssets (opts) {
        this.getLogger().info("deleteAllAssets started");
        const helper = WchToolsApi.getAssetsHelper();
        const promise = helper.deleteRemoteItems(this.context, opts);
        this.getLogger().info("deleteAllAssets complete");
        return promise;
    }

    deleteAllImageProfiles (opts) {
        this.getLogger().info("deleteAllImageProfiles started");
        const helper = WchToolsApi.getImageProfilesHelper();
        const promise = helper.deleteRemoteItems(this.context, opts);
        this.getLogger().info("deleteAllImageProfiles complete");
        return promise;
    }
}

/**
 * Export the WchToolsApi class
 */
module.exports = WchToolsApi;
