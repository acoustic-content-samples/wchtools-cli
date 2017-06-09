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

const BaseHelper = require("./baseHelper.js");
const rest = require("./lib/categoriesREST").instance;
const fS = require("./lib/categoriesFS").instance;
const utils = require("./lib/utils/utils.js");
const logger = utils.getLogger(utils.apisLog);
const i18n = utils.getI18N(__dirname, ".json", "en");

const singleton = Symbol();
const singletonEnforcer = Symbol();

class CategoriesHelper extends BaseHelper {
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
     * Create the given item in the local file system.
     *
     * @param {Object} category - The metadata of the local item to be created.
     * @param {Object} opts - The options to be used for the create operation.
     *
     * @returns {Q.Promise} A promise for the item to be created.
     */
    createLocalItem (category, opts) {
        const helper = this;
        logger.trace('enter createLocalItem' + category.toString());
        return this._fsApi.newItem(category, opts)
            .then(function (item) {
                return helper._addLocalStatus(item);
            })
            .catch(function (err) {
                utils.logErrors( i18n.__("create_local_item_error"), err);
                throw err;
            });
    }

    /**
     *  Determine whether the given item can be pulled.
     *
     *  @param {Object} item The item to be pulled.
     *
     *  @returns {Boolean} A return value of true indicates that the item can be pulled. A return value of false
     *                     indicates that the item cannot be pulled.
     *
     *  @override
     */
    canPullItem (item) {
        // Don't pull system categories.
        return (item && item["permanent"] !== true);
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
     * Push the items with the given names one at a time.
     *
     * @param {Array} names - The names of the items to be pushed.
     * @param {Object} opts - The options to be used for the push operations.
     *
     * @returns {Promise} A promise for the items that were pushed.
     *
     * @private
     */
    _pushNameListSerial(names, opts) {
        // Clone the options so that the original options are not affected.
        const cOpts = utils.cloneOpts(opts);

        // Set the concurrent limit to 1 to force serialized updates for dependency ordering.
        cOpts["concurrent-limit"] = 1;

        // Call the super class method to do the push.
        return super._pushNameList(names, cOpts);
    }

    /**
     * Push the items with the given names.
     *
     * @param {Array} names - The names of the items to be pushed.
     * @param {Object} opts - The options to be used for the push operations.
     *
     * @returns {Promise} A promise for the items that were pushed.
     *
     * @protected
     */
    _pushNameList(names, opts) {
        const helper = this;
        return Promise.all(names.map(function (name) {
            return helper.getLocalItem(name, opts);
        }))
            .then(function (items) {
                // Sort categories/taxonomies by hierarchy.
                items.sort(function (a, b) {
                    const alen = a.ancestorIds ? a.ancestorIds.length : 0;
                    const blen = b.ancestorIds ? b.ancestorIds.length : 0;
                    return alen - blen;
                });

                // Push the sorted categories one at a time.
                names = items.map(function (item) {
                    return helper.getName(item);
                });
                return helper._pushNameListSerial(names, opts);
            });
    }
}

/**
 * Export the CategoriesHelper class.
 */
module.exports = CategoriesHelper;
