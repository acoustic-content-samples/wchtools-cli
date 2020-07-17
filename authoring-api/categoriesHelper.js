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

const JSONItemHelper = require("./JSONItemHelper.js");
const JSONItemFS = require("./lib/categoriesFS");
const Q = require("q");
const rest = require("./lib/categoriesREST").instance;
const fS = require("./lib/categoriesFS").instance;
const options = require("./lib/utils/options.js");
const utils = require("./lib/utils/utils.js");
const i18n = utils.getI18N(__dirname, ".json", "en");

const singleton = Symbol();
const singletonEnforcer = Symbol();

class CategoriesHelper extends JSONItemHelper {
    /**
     * The constructor for a CategoriesHelper object. This constructor implements a singleton pattern, and will fail if
     * called directly. The static instance property can be used to get the singleton instance.
     *
     * @param {Symbol} enforcer - A Symbol that must match a local Symbol to create the new object.
     */
    constructor (enforcer) {
        if (enforcer !== singletonEnforcer) {
            throw i18n.__("singleton_construct_error", {classname: "CategoriesHelper"});
        }
        super(rest, fS, "categories");
    }

    /**
     * The instance property can be used to to get the singleton instance for this class.
     */
    static get instance() {
        if (!this[singleton]) {
            this[singleton] = new CategoriesHelper(singletonEnforcer);
        }
        return this[singleton];
    }

    /**
     * Determine whether the given item can be compared.
     *
     * @param {Object} item The item to be compared.
     * @param {Object} opts - The options to be used for the compare operation.
     *
     * @returns {Boolean} A return value of true indicates that the item can be compared. A return value of false
     *                    indicates that the item cannot be compared.
     *
     * @override
     */
    canCompareItem(item, opts) {
        let retVal = super.canCompareItem(item, opts);
        if (retVal) {
            // Do not include system categories in the compare.
            retVal = (item && item["permanent"] !== true);
        }

        return retVal;
    }

    /**
     * Determine whether the given item can be pulled.
     *
     * @param {Object} item The item to be pulled.
     * @param {Object} context The API context to be used by the pull operation.
     * @param {Object} opts The options to be used to pull the items.
     *
     * @returns {Boolean} A return value of true indicates that the item can be pulled. A return value of false
     *                    indicates that the item cannot be pulled.
     *
     * @override
     */
    canPullItem (item, context, opts) {
        let retVal = super.canPullItem(item, context, opts);
        if (retVal) {
            // Don't pull system categories unless the system option was specified. This is a special case
            // for categories, which used the "permanent" property before the "isSystem" property was added.
            retVal = ((item["permanent"] !== true) || (options.getRelevantOption(context, opts, "allowSystemArtifacts") === true));
        }

        return retVal;
    }

    /**
     *  Determine whether the given item can be pushed.
     *
     *  @param {Object} item The item to be pushed.
     *
     *  @returns {Boolean} A return value of true indicates that the item can be pushed. A return value of false
     *                     indicates that the item cannot be pushed.
     *
     *  @override
     */
    canPushItem (item) {
        // Don't push system categories.
        return (item && item["permanent"] !== true);
    }

    /**
     * Determine whether the given item can be deleted.
     *
     * @param {Object} item The item to be deleted.
     * @param {Object} isDeleteAll Flag that indicates whether the item will be deleted during a delete all operation.
     * @param {Object} opts - The options to be used for the delete operation.
     *
     * @returns {Boolean} A return value of true indicates that the item can be deleted. A return value of false
     *                    indicates that the item cannot be deleted.
     *
     * @override
     */
    canDeleteItem (item, isDeleteAll, opts) {
        // Don't delete system categories.
        return super.canDeleteItem(item, isDeleteAll, opts) && item["permanent"] !== true;
    }

    _makeListItemResult (context, item, opts) {
        // Override _makeListItemResult so we can add the permanent field to perform filtering in the methods above.
        return {
            id: item.id,
            name: item.name,
            permanent: item.permanent
        };
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

        // Enable the local file cache so that the categories being pushed are only read once.
        JSONItemFS.setCacheEnabled(context, true, opts);

        return Q.all(names.map(function (name) {
            return helper.getLocalItem(context, name, opts);
        }))
            .then(function (items) {
                // Sort categories/taxonomies by hierarchy -- parents before children.
                items.sort(function (a, b) {
                    const alen = a.ancestorIds ? a.ancestorIds.length : 0;
                    const blen = b.ancestorIds ? b.ancestorIds.length : 0;
                    return alen - blen;
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

        // A reference error has a response code of 400, and an error code that is known or in the range 6000 - 7000.
        if (error && error["response"] && (error["response"]["statusCode"] === 400)) {
            const responseBody = error["response"]["body"];
            if (responseBody && responseBody["errors"] && responseBody["errors"].length > 0) {
                // The response has returned one or more errors. If any of these is a reference error, then return true.
                // That means we will retry the push again, even though any non-reference errors might not benefit from
                // the retry. This shouldn't be an issue though, because if the retry does not push at least one item, a
                // subsequent retry will not be attempted.
                retVal = responseBody["errors"].some(function (error) {
                    let code = error["code"];

                    // The "code" property is supposed to be a number.
                    if (typeof code === "string") {
                        code = parseInt(code);
                    }
                    const contentRefNotFound = (code === 2004); // The parent category was not found.
                    const generalRefNotFound = (code >= 6000 && code < 7000);
                    return (contentRefNotFound || generalRefNotFound);
                });
            }
        }

        return retVal;
    }
}

/**
 * Export the CategoriesHelper class.
 */
module.exports = CategoriesHelper;
