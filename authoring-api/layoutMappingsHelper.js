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

const BaseHelper = require("./baseHelper.js");
const rest = require("./lib/layoutMappingsREST").instance;
const fS = require("./lib/layoutMappingsFS").instance;
const utils = require("./lib/utils/utils.js");
const i18n = utils.getI18N(__dirname, ".json", "en");

const singleton = Symbol();
const singletonEnforcer = Symbol();

class LayoutMappingsHelper extends BaseHelper {
    /**
     * The constructor for a LayoutsHelper object. This constructor implements a singleton pattern, and will fail
     * if called directly. The static instance property can be used to get the singleton instance.
     *
     * @param {Symbol} enforcer - A Symbol that must match a local Symbol to create the new object.
     */
    constructor (enforcer) {
        if (enforcer !== singletonEnforcer) {
            throw i18n.__("singleton_construct_error", {classname: "LayoutMappingsHelper"});
        }
        super(rest, fS, "layout-mappings");
    }

    /**
     * The instance property can be used to to get the singleton instance for this class.
     */
    static get instance() {
        if (!this[singleton]) {
            this[singleton] = new LayoutMappingsHelper(singletonEnforcer);
        }
        return this[singleton];
    }

    /**
     * Get the name to be displayed for the given item.  Path by default for layouts and layout mappings.
     *
     * @param {Object} item - The item for which to get the name.
     *
     * @returns {String} The name to be displayed for the given item.
     */
    getName (item) {
        return this.getPathName(item);
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
                    const layoutRefNotFound = (error["code"] === 2504); // Referenced type not available yet?
                    return layoutRefNotFound;
                });
            }
        }

        return retVal;
    }

}

/**
 * Export the LayoutsHelper class.
 */
module.exports = LayoutMappingsHelper;
