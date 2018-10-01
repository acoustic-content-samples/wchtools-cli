/*
Copyright IBM Corporation 2017

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

const JSONItemHelper = require("./JSONItemHelper.js");
const JSONItemFS = require("./lib/categoriesFS");
const Q = require("q");
const rest = require("./lib/sitesREST").instance;
const SitesFS = require("./lib/sitesFS");
const fS = SitesFS.instance;
const utils = require("./lib/utils/utils.js");
const options = require("./lib/utils/options.js");
const i18n = utils.getI18N(__dirname, ".json", "en");

const singleton = Symbol();
const singletonEnforcer = Symbol();

class SitesHelper extends JSONItemHelper {
    /**
     * The constructor for an SitesHelper object. This constructor implements a singleton pattern, and will fail if
     * called directly. The static instance property can be used to get the singleton instance.
     *
     * @param {Symbol} enforcer - A Symbol that must match a local Symbol to create the new object.
     */
    constructor (enforcer) {
        if (enforcer !== singletonEnforcer) {
            throw i18n.__("singleton_construct_error", {classname: "SitesHelper"});
        }
        super(rest, fS, "sites");
    }

    /**
     * The instance property can be used to to get the singleton instance for this class.
     */
    static get instance() {
        if (!this[singleton]) {
            this[singleton] = new SitesHelper(singletonEnforcer);
        }
        return this[singleton];
    }

    /**
     * Get the context name to use for the given site.
     *
     * @param {Object} siteItem The site for which to get the context name.
     *
     * @returns {String} The context name to use for the given site.
     */
    getSiteContextName(siteItem) {
        return SitesFS.getSiteContextName(siteItem);
    }

    makeEmittedObject(context, item, opts) {
        const result = super.makeEmittedObject(context, item, opts);

        // Add the site's context root and status to the result.
        result.contextRoot = item.contextRoot || "";
        result.status = this.getStatus(context, item, opts);

        return result;
    }

    _makeListItemResult(context, item, opts) {
        const result = super._makeListItemResult(context, item, opts);

        // Add the site's context root and status to the result.
        result.contextRoot = item.contextRoot || "";
        result.status = this.getStatus(context, item, opts);

        return result;
    }

    /**
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} opts - The options to be used for the push operation.
     *
     * @returns {Q.Promise} - A promise that resolves with an array of the names of
     *                      all items that exist on the file system.
     */
    _listLocalItemNames (context, opts) {
        return super._listLocalItemNames(context, opts)
            .then(function (results) {
                if (results && context.siteList) {
                    // This method will typically return a list of local site items which is limited to those sites that
                    // are contained in the context's siteList. For example, when called during a list, push, or compare
                    // of sites, the result should only include those sites that are in the context's siteList. However,
                    // when called during a pull of sites "with deletions", the context siteList will only contain those
                    // sites that exist on the server, but the result of this method must also include any sites that
                    // have been deleted on the server.
                    const deletions = options.getRelevantOption(context, opts, "deletions");
                    results = results.filter(function (site) {
                        // First determine if the site is in the context site list.
                        const inSiteList = context.siteList.some(function (siteItem) {
                            return site.id === siteItem.id;
                        });

                        if (deletions) {
                            // The list of local site items returned from the super method has already been filtered
                            // based on the ready/draft options. Return each of these site items for now.
                            // FUTURE Filter out any site items that don't match the specified site and project options.
                            return true;
                        } else {
                            // Only include the local site if it is in the site list.
                            return inSiteList;
                        }
                    });
                }
                return results;
            });
    }

    /**
     * Get an array of names for all items on the file system which have been modified since being pushed/pulled.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Array} flags An array of the state (NEW, DELETED, MODIFIED) of the items to be included in the list.
     * @param {Object} opts The options to be used for the push operation.
     *
     * @returns {Q.Promise} A promise that resolves with an array of names for all items on the file system which have
     *                      been modified since being pushed/pulled.
     */
    _listModifiedLocalItemNames (context, flags, opts) {
        return super._listModifiedLocalItemNames(context, flags, opts)
            .then(function (results) {
                if (results && context.siteList) {
                    // Filter the list of sites to only include those in the context site list.
                    results = results.filter(function (site) {
                        return context.siteList.some(function (siteItem) {
                            return site.id === siteItem.id;
                        });
                    });
                }
                return results;
            });
    }

    /**
     *  Determine whether the given item can be deleted.
     *
     *  @param {Object} item The item to be deleted.
     *  @param {Object} isDeleteAll Flag that indicates whether the item will be deleted during a delete all operation.
     *  @param {Object} opts - The options to be used for the delete operation.
     *
     *  @returns {Boolean} A return value of true indicates that the item can be deleted. A return value of false
     *                     indicates that the item cannot be deleted.
     */
    canDeleteItem(item, isDeleteAll, opts) {
        // Don't delete the default site.
        return super.canDeleteItem(item, isDeleteAll, opts) && item["id"] !== "default" && item["id"] !== "default:draft";
    }

    /**
     * Get the items on the remote content hub.
     *
     * @param {Object} context The API context to be used by the get operation.
     * @param {Object} opts - The options to be used to get the items.
     *
     * @returns {Q.Promise} A promise to get the items on the remote content hub.
     *
     * @resolves {Array} The items on the remote content hub.
     */
    getRemoteItems (context, opts) {
        return super.getRemoteItems(context, opts)
            .then(function (results) {
                if (results && context.siteList) {
                    // Filter the list of sites to only include those in the context site list.
                    results = results.filter(function (site) {
                        return context.siteList.some(function (siteItem) {
                            return site.id === siteItem.id;
                        });
                    });
                }
                return results;
            });
    }

    /**
     * Get a list of the items that have been modified.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Array} flags - An array of the state (NEW, DELETED, MODIFIED) of the items to be included in the list.
     * @param {Object} opts - The options to be used for this operation.
     *
     * @returns {Q.Promise} - A promise for an array of all remote items that were modified since being pushed/pulled.
     */
    getModifiedRemoteItems (context, flags, opts) {
        return super.getModifiedRemoteItems(context, flags, opts)
            .then(function (results) {
                if (results && context.siteList) {
                    // Filter the list of sites to only include those in the context site list.
                    results = results.filter(function (site) {
                        return context.siteList.some(function (siteItem) {
                            return site.id === siteItem.id;
                        });
                    });
                }
                return results;
            });
    }

    /**
     * Pull all items from the remote content hub to the local file system.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} opts The options to be used for the pull operations.
     *
     * @returns {Q.Promise} A promise to pull the remote items to the local file system.
     *
     * @resolves {Array} The items that were pulled.
     */
    pullAllItems(context, opts) {
        // Create a local file path map to be used for cleaning up old files after the pull.
        const map = this._fsApi.createLocalFilePathMap(context, opts);

        // Use a clone of the opts object to store the local file path map, so that it goes away after the call.
        opts = utils.cloneOpts(opts, {"localFilePathMap": map});

        return super.pullAllItems(context, opts);
    }

    /**
     * Pull any modified items from the remote content hub to the local file system.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} opts - The options to be used for the pull operations.
     *
     * @returns {Q.Promise} A promise to pull the modified remote items to the local file system.
     *
     * @resolves {Array} The modified items that were pulled.
     */
    pullModifiedItems(context, opts) {
        // Create a local file path map to be used for cleaning up old files after the pull.
        const map = this._fsApi.createLocalFilePathMap(context, opts);

        // Use a clone of the opts object to store the local file path map, so that it goes away after the call.
        opts = utils.cloneOpts(opts, {"localFilePathMap": map});

        return super.pullModifiedItems(context, opts);
    }

    /**
     * Push the items with the given names.
     *
     * @param {Object} context The API context to be used by the push operations.
     * @param {Array} names - The names of the items to be pushed.
     * @param {Object} opts - The options to be used for the push operations.
     *
     * @returns {Q.Promise} A promise for the items that were pushed.
     *
     * @override
     * @protected
     */
    _pushNameList(context, names, opts) {
        const helper = this;

        // Bind the super method so that we can call it later.
        const superMethod = super._pushNameList.bind(this);

        // Enable the local file cache so that the sites being pushed are only read once.
        JSONItemFS.setCacheEnabled(context, true, opts);

        return Q.all(names.map(function (name) {
            return helper.getLocalItem(context, name, opts);
        }))
            .then(function (items) {
                // Sort sites by status -- ready before draft.
                items.sort(function (a, b) {
                    const aStatus = helper.getStatus(context, a, opts);
                    const bStatus = helper.getStatus(context, b, opts);
                    if (aStatus === "ready") {
                        if (bStatus === "ready") {
                            // Ready site a goes after ready site b to maintain original order.
                            return 1;
                        } else {
                            // Ready site goes before draft site.
                            return -1;
                        }
                    } else {
                        // Draft site goes to the end, after ready sites and to maintain original order of draft sites.
                        return 1;
                    }
                });

                // Push the sorted sites one at a time.
                names = items.map(function (item) {
                    return SitesFS.getSiteContextName(item);
                });

                // Call the super class method to do the push.
                return superMethod(context, names, opts);
            })
            .finally(function () {
                // Disable the local file cache once the push operation has completed.
                JSONItemFS.setCacheEnabled(context, false, opts);
            });
    }
}

/**
 * Export the SitesHelper class.
 */
module.exports = SitesHelper;
