/*
Copyright 2017 IBM Corporation

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

const options = require("./lib/utils/options.js");
const utils = require("./lib/utils/utils.js");
const SearchREST = require("./lib/authoringSearchREST.js");
const searchREST = SearchREST.instance;

/**
 * Helper class for artifacts that are JSON path-based objects.
 *
 * Note: A helper object provides access to both the REST API and the local file system for a single artifact type.
 *
 * @class JSONPathBasedItemHelper
 */
class JSONPathBasedItemHelper extends JSONItemHelper {
    /**
     * The constructor for a helper that manages JSON path-based artifacts.
     *
     * @constructs JSONPathBasedItemHelper
     *
     * @param {BaseREST} restApi - The REST API object managed by this helper.
     * @param {BaseFS} fsApi - The FS object managed by this helper.
     * @param {String} artifactName - The name of the "artifact type" managed by this helper.
     * @param {String} [classification] - Optional classification of the artifact type - defaults to artifactName
     */
    constructor (restApi, fsApi, artifactName, classification) {
        super(restApi, fsApi, artifactName, classification);
    }

    makeEmittedObject(context, item, opts) {
        return {id: item.id, name: this.getPathName(item), path: item.path};
    }

    _makeListItemResult (context, item, opts) {
        const result = super._makeListItemResult(context, item, opts);
        if (item.path) {
            result.path = item.path;
        } else if (item.hierarchicalPath) {
            result.path = item.hierarchicalPath;
        }
        return result;
    }

    /**
     * Filter the given list of items using the given path.
     *
     * @param {Array} itemList The items to be listed.
     * @param {String} filterPath The path regex used to filter items.
     *
     * @returns {Array} The filtered list of items.
     *
     * @protected
     */
    _filterItemsByPath(itemList, filterPath) {
        return itemList.filter(function (item) {
            return (item.path && item.path.match(filterPath));
        });
    }

    /**
     * Filter the given list of items before completing the list operation.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Array} itemList The items to be listed.
     * @param {Object} opts The options to be used for this operations.
     *
     * @returns {Array} The filtered list of items.
     *
     * @protected
     */
    _listFilter (context, itemList, opts) {
        // Let the super class filter the list first.
        itemList = super._listFilter(context, itemList, opts);

        // Filter the item list based on the path.
        let filterPath = options.getRelevantOption(context, opts, "filterPath");
        if (filterPath) {
            filterPath = utils.formatFilterPath(filterPath);
            itemList = this._filterItemsByPath(itemList, filterPath);
        }

        return itemList;
    }

    /**
     * Filter the given list of items before completing the pull operation.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Array} itemList The items to be pulled.
     * @param {Object} opts The options to be used for this operations.
     *
     * @returns {Array} The filtered list of items.
     *
     * @protected
     */
    _pullFilter (context, itemList, opts) {
        // Let the super class filter the list first.
        itemList = super._pullFilter(context, itemList, opts);

        // Filter the item list based on the path.
        let filterPath = options.getRelevantOption(context, opts, "filterPath");
        if (filterPath) {
            filterPath = utils.formatFilterPath(filterPath);
            itemList = this._filterItemsByPath(itemList, filterPath);
        }

        return itemList;
    }

    _getRemoteListOpts (context, opts) {
        const filterPath = options.getRelevantOption(context, opts, "filterPath");
        if (this.supportsSearchByPath() && filterPath) {
            // get the offset/limit for the search service from the configured options
            const searchServiceName = searchREST.getServiceName();
            const offset = options.getRelevantOption(context, opts, "offset", searchServiceName) || 0;
            const limit = options.getRelevantOption(context, opts, "limit",  searchServiceName);

            // set the search service's offset/limit values on a clone of the opts
            opts = utils.cloneOpts(opts, {offset: offset, limit: limit, useNextLinks: false});
        }
        return opts;
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
    pullAllItems (context, opts) {
        // Create a local file path map to be used for cleaning up old files after the pull.
        const map = this._fsApi.createLocalFilePathMap(context, opts);
        if (map) {
            // Use a clone of the opts object to store the local file path map, so that it goes away after the call.
            opts = utils.cloneOpts(opts, {"localFilePathMap": map});
        }
        opts = this._getRemoteListOpts(context, opts);

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
    pullModifiedItems (context, opts) {
        // Create a local file path map to be used for cleaning up old files after the pull.
        const map = this._fsApi.createLocalFilePathMap(context, opts);
        if (map) {
            // Use a clone of the opts object to store the local file path map, so that it goes away after the call.
            opts = utils.cloneOpts(opts, {"localFilePathMap": map});
        }
        opts = this._getRemoteListOpts(context, opts);

        return super.pullModifiedItems(context, opts);
    }

    _listRemoteItemNames (context, opts) {
        opts = this._getRemoteListOpts(context, opts);

        return super._listRemoteItemNames(context, opts);
    }

    _listModifiedRemoteItemNames (context, flags, opts) {
        opts = this._getRemoteListOpts(context, opts);

        return super._listModifiedRemoteItemNames(context, flags, opts);
    }

    /**
     * Determine whether the helper supports searching by path.
     */
    supportsSearchByPath () {
        return true;
    }

    /**
     * Returns a function to be used for the list remote items functionality. The returned function should accept a single opts argument.
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} opts The options to be used for the pull operations.
     * @return the function to call to list remote items.
     * @private
     */
    _getRemoteListFunction (context, opts) {
        let listFn;
        const filterPath = options.getRelevantOption(context, opts, "filterPath");
        if (this.supportsSearchByPath() && filterPath) {
            // Use _searchByPath as the list function, so that all artifacts matching the search will be pulled.
            listFn = this._searchByPath.bind(this, context, undefined, filterPath);
        } else {
            listFn = super._getRemoteListFunction(context, opts);
        }
        return listFn;
    }

    /**
     * Returns a function to be used for the modified list remote items functionality. The returned function should accept a single opts argument.
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} opts The options to be used for the pull operations.
     * @return the function to call to list modified remote items.
     * @private
     */
    _getRemoteModifiedListFunction (context, flags, opts) {
        const helper = this;

        let listFn;
        const filterPath = options.getRelevantOption(context, opts, "filterPath");
        if (this.supportsSearchByPath() && filterPath) {
            // Use _searchByPath as the list function, so that all artifacts matching the search will be pulled.
            listFn = function (opts) {
                const timestamp = helper.getLastPullTimestamp(context, opts);
                const searchOptions = {};
                if (timestamp) {
                    const expr = "lastModified:[" + timestamp + " TO *]";
                    searchOptions.fq = [expr];
                }
                return helper._searchByPath(context, searchOptions, filterPath, opts)
                    .then(function (items) {
                        return helper._filterRemoteModified(context, items, flags, opts);
                    });
            };
        } else {
            listFn = super._getRemoteModifiedListFunction(context, flags, opts);
        }
        return listFn;
    }
}

/**
 * Export the JSONPathBasedItemHelper class.
 */
module.exports = JSONPathBasedItemHelper;
