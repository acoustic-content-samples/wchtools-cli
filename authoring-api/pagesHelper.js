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

const JSONPathBasedItemHelper = require("./JSONPathBasedItemHelper.js");
const rest = require("./lib/pagesREST").instance;
const fS = require("./lib/pagesFS").instance;
const utils = require("./lib/utils/utils.js");
const i18n = utils.getI18N(__dirname, ".json", "en");

const singleton = Symbol();
const singletonEnforcer = Symbol();

class PagesHelper extends JSONPathBasedItemHelper {
    /**
     * The constructor for an SitesHelper object. This constructor implements a singleton pattern, and will fail if
     * called directly. The static instance property can be used to get the singleton instance.
     *
     * @param {Symbol} enforcer - A Symbol that must match a local Symbol to create the new object.
     */
    constructor (enforcer) {
        if (enforcer !== singletonEnforcer) {
            throw i18n.__("singleton_construct_error", {classname: "PagesHelper"});
        }
        super(rest, fS, "pages");
    }

    /**
     * The instance property can be used to to get the singleton instance for this class.
     */
    static get instance() {
        if (!this[singleton]) {
            this[singleton] = new PagesHelper(singletonEnforcer);
        }
        return this[singleton];
    }

    /**
     * Get the name to be displayed for the given item.  Use path for pages.
     *
     * @param {Object} item - The item for which to get the name.
     *
     * @returns {String} The name to be displayed for the given item.
     */
    getName (item) {
        return this.getPathName(item);
    }

    /**
     * Filter the given list of items using the given path.
     *
     * @param {Array} itemList The items to be listed.
     * @param {String} filterPath The path used to filter items.
     *
     * @returns {Array} The filtered list of items.
     *
     * @protected
     */
    _filterItemsByPath(itemList, filterPath) {
        return itemList.filter(function (item) {
            return (item.hierarchicalPath && item.hierarchicalPath.indexOf(filterPath) === 0);
        });
    }

    /**
     * Get a list of the child pages for the given page.
     *
     * @param {Object} context The API context to be used by the operation.
     * @param {Object} item - The page item.
     * @param {Object} opts - The options to be used by the operation.
     *
     * @returns {Q.Promise} - A promise for a list of the child pages for the given page.
     */
    listRemoteChildPages(context, item, opts) {
        // Get the list of child pages (_listRemoteItemNames avoids saving a manifest).
        return this._listRemoteItemNames(context, utils.cloneOpts(opts, {filterPath: item.hierarchicalPath}));
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
        let retVal = super.canDeleteItem(item, isDeleteAll, opts);
        if (retVal && isDeleteAll && item["status"] !== "draft") {
            // This is a "delete all" operation. Only top-level pages from a ready site should be deleted (child pages
            // will be deleted automatically.) All pages from a draft site should be deleted (cancel the draft.)
            retVal = !item["parentId"];
        }
        return retVal;
    }

    /**
     * Determine whether the given page is a draft page.
     *
     * @param {Object} context The API context to be used by the operation.
     * @param {Object} item - The page item.
     * @param {Object} opts - The options to be used by the operation.
     *
     * @returns {Boolean} A return value of true indicates that the given item is a draft page. A return value of false
     *                    indicates that the given item is not a draft page.
     */
    isDraftPage(context, item, opts) {
        const pageStatus = this.getStatus(context, item, opts);
        const draftType = item["draftType"];

        // A draft page will have a status of "draft" and a draft type of "properties".
        return (pageStatus === "draft" && draftType && draftType.includes && draftType.includes("properties"));
    }

    /**
     * Determine whether the given page is an overlay page.
     *
     * @param {Object} context The API context to be used by the operation.
     * @param {Object} item - The page item.
     * @param {Object} opts - The options to be used by the operation.
     *
     * @returns {Boolean} A return value of true indicates that the given item is an overlay page. A return value of
     *                    false indicates that the given item is not an overlay page.
     */
    isOverlayPage(context, item, opts) {
        const pageStatus = this.getStatus(context, item, opts);

        // An overlay page will have a status of "draft" but is not a draft page.
        return (pageStatus === "draft" && !this.isDraftPage(context, item, opts));
    }

    /**
     * Determine whether the helper supports deleting items by id.
     *
     * @override
     */
    supportsDeleteById() {
        return true;
    }

    /**
     * Determine whether the helper supports deleting items by path.
     *
     * @override
     */
    supportsDeleteByPath() {
        return true;
    }

    /**
     * Get the items from the current manifest.
     *
     * @param {Object} context The API context to be used by the operation.
     * @param {Object} opts - The options to be used to get the items.
     *
     * @returns {Q.Promise} A promise to get the items from the current manifest.
     *
     * @resolves {Array} The items from the current manifest, or an empty array.
     */
    getManifestItems (context, opts) {
        // Sort the manifest items by path length. This guarantees that a parent will be before any of its children.
        return super.getManifestItems(context, opts)
            .then(function (items) {
                return items.sort(function (a, b) {
                    // A parent's path is always shorter than its child's path
                    let alen = 0;
                    let blen = 0;
                    if (a.path) {
                        alen = a.path.length;
                    }
                    if (b.path) {
                        blen = b.path.length;
                    }
                    return alen - blen;
                });
            });
    }
}

/**
 * Export the PagesHelper class.
 */
module.exports = PagesHelper;
