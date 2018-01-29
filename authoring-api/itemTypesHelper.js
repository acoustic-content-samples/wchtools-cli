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

const JSONPathBasedItemHelper = require("./JSONPathBasedItemHelper.js");
const rest = require("./lib/itemTypesREST").instance;
const fS = require("./lib/itemTypesFS").instance;
const utils = require("./lib/utils/utils.js");
const i18n = utils.getI18N(__dirname, ".json", "en");

const singleton = Symbol();
const singletonEnforcer = Symbol();

class ItemTypesHelper extends JSONPathBasedItemHelper {
    /**
     * The constructor for an ItemTypesHelper object. This constructor implements a singleton pattern, and will fail if
     * called directly. The static instance property can be used to get the singleton instance.
     *
     * @param {Symbol} enforcer - A Symbol that must match a local Symbol to create the new object.
     */
    constructor (enforcer) {
        if (enforcer !== singletonEnforcer) {
            throw i18n.__("singleton_construct_error", {classname: "ItemTypesHelper"});
        }
        super(rest, fS, "types", "content-type");
    }

    /**
     * The instance property can be used to to get the singleton instance for this class.
     */
    static get instance() {
        if (!this[singleton]) {
            this[singleton] = new ItemTypesHelper(singletonEnforcer);
        }
        return this[singleton];
    }

    /**
     * Get the name to be displayed for the given item.
     *
     * @param {Object} item - The item for which to get the name.
     *
     * @returns {String} The name to be displayed for the given item.
     *
     * @override
     */
    getPathName (item) {
        if (item.path) {
            // Use the "path" property by default.
            return item.path;
        }

        // Fallback to the "name" property for "old" Type artifacts that do not have a path.
        return item.name;
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

        // Use a clone of the opts object to store the local file path map, so that it goes away after the call.
        return super.pullAllItems(context, utils.cloneOpts(opts, {"localFilePathMap": map}));
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

        // Use a clone of the opts object to store the local file path map, so that it goes away after the call.
        return super.pullModifiedItems(context, utils.cloneOpts(opts, {"localFilePathMap": map}));
    }

    /**
     * Determine whether retry push is enabled.
     *
     * @returns {Boolean} A return value of true indicates that retry push is enabled.
     *
     * @override
     */
    isRetryPushEnabled () {
        return true;
    }

    /**
     * Determine whether retry push is enabled.
     *
     * @param {Object} context The current context to be used by the API.
     * @param {Error} error The error returned from the failed push operation.
     *
     * @returns {Boolean} A return value of true indicates that the push should be retried.
     *
     * @override
     */
    filterRetryPush (context, error) {
        let retVal = false;
        // A reference error has a response code of 400 and an error code equal to 2012, or in the range 6000 - 7000.
        if (error && error["response"] && (error["response"]["statusCode"] === 400)) {
            const responseBody = error["response"]["body"];

            if (responseBody && responseBody["errors"] && responseBody["errors"].length > 0) {
                // The response has returned one or more errors. If any of these is a reference error, then return true.
                // That means we will retry the push again, even though any non-reference errors might not benefit from
                // the retry. This shouldn't be an issue though, because if the retry does not push at least one item, a
                // subsequent retry will not be attempted.
                retVal = responseBody["errors"].some(function (error) {
                    const typeRefNotFound = (error["code"] === 2504); // Referenced type not available yet?
                    return typeRefNotFound;
                });
            }
        }

        return retVal;
    }

    /**
     * Determine whether retry delete is enabled.
     *
     * @returns {Boolean} A return value of true indicates that retry delete is enabled.
     *
     * @override
     */
    isRetryDeleteEnabled () {
        return true;
    }

    /**
     * Determine whether the given error indicates that the delete should be retried.
     *
     * @param {Object} context The current context to be used by the API.
     * @param {Error} error The error returned from the failed delete operation.
     *
     * @returns {Boolean} A return value of true indicates that the delete should be retried.
     *
     * @override
     */
    filterRetryDelete (context, error) {
        let retVal = false;

        // A reference error has a response code of 400 and an error code equal to 2503, or in the range 6000 - 7000.
        if (error && error["response"] && (error["response"]["statusCode"] === 400)) {
            const responseBody = error["response"]["body"];
            if (responseBody && responseBody["errors"] && responseBody["errors"].length > 0) {
                // The response has returned one or more errors. If any of these is a reference error, then return true.
                // That means we'll retry the delete again, even though any non-reference errors might not benefit from
                // the retry. This shouldn't be an issue though, because if the retry does not delete at least one item,
                // a subsequent retry will not be attempted.
                retVal = responseBody["errors"].some(function (error) {
                    const contentRefNotFound = (error["code"] === 2503);
                    const generalRefNotFound = (error["code"] >= 6000 && error["code"] < 7000);
                    return (contentRefNotFound || generalRefNotFound);
                });
            }
        }

        return retVal;
    }

    /**
     * Determine whether the helper supports deleting items by id.
     *
     * @return {Boolean} A return value of true indicates that the helper supports deleting items by id.
     *
     * @override
     */
    supportsDeleteById() {
        return true;
    }
}

/**
 * Export the ItemTypesHelper class.
 */
module.exports = ItemTypesHelper;
