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
                    // Filter the list of sites to only include those in the context site list.
                    results = results.filter(function (site) {
                        return site.id && context.siteList.indexOf(site.id) !== -1;
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
                        return site.id && context.siteList.indexOf(site.id) !== -1;
                    });
                }
                return results;
            });
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
                        return site.id && context.siteList.indexOf(site.id) !== -1;
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
                        return site.id && context.siteList.indexOf(site.id) !== -1;
                    });
                }
                return results;
            });
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
                    const aStatus = a.siteStatus || "ready";
                    const bStatus = b.siteStatus || "ready";
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

                // Push the sorted categories one at a time.
                names = items.map(function (item) {
                    return helper.getName(item);
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
