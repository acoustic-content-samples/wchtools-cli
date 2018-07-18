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
const rest = require("./lib/contentREST").instance;
const fS = require("./lib/contentFS").instance;
const utils = require("./lib/utils/utils.js");
const i18n = utils.getI18N(__dirname, ".json", "en");

const singleton = Symbol();
const singletonEnforcer = Symbol();

class ContentHelper extends JSONItemHelper {
    constructor (enforcer) {
        if (enforcer !== singletonEnforcer) {
            throw i18n.__("singleton_construct_error", {classname: "ContentHelper"});
        }
        super(rest, fS, "content");
    }

    static get instance() {
        if (!this[singleton]) {
            this[singleton] = new ContentHelper(singletonEnforcer);
        }
        return this[singleton];
    }

    getName (item){
        return item.id;
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
     * Determine whether the given error indicates that the push should be retried.
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
                    const contentRefNotFound = (error["code"] === 2012);
                    const generalRefNotFound = (error["code"] >= 6000 && error["code"] < 7000);
                    return (contentRefNotFound || generalRefNotFound);
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

        // A reference error has a response code of 400 and an error code equal to 3008, or in the range 6000 - 7000.
        if (error && error["response"] && (error["response"]["statusCode"] === 400)) {
            const responseBody = error["response"]["body"];
            if (responseBody && responseBody["errors"] && responseBody["errors"].length > 0) {
                // The response has returned one or more errors. If any of these is a reference error, then return true.
                // That means we'll retry the delete again, even though any non-reference errors might not benefit from
                // the retry. This shouldn't be an issue though, because if the retry does not delete at least one item,
                // a subsequent retry will not be attempted.
                retVal = responseBody["errors"].some(function (error) {
                    const ecode = error["code"];
                    const contentRefNotFound = (ecode === 3008) || (ecode === 3004);
                    const generalRefNotFound = (ecode >= 6000 && ecode < 7000);
                    return (contentRefNotFound || generalRefNotFound);
                });
            }
        }

        return retVal;
    }

    /**
     * Determine whether the helper supports deleting items by id.
     * @override
     */
    supportsDeleteById() {
        return true;
    }

    /**
     * Return a set of extra keys to be ignored for this artifact type.  This should be used to return a list
     * of synthetic fields per artifact type.
     *
     * @return {Array} the names of the JSON elements to be ignored.
     */
    getExtraIgnoreKeys() {
        return ["type", "thumbnail/url",
            "elements/*/asset/resourceUri", "elements/*/asset/fileSize", "elements/*/asset/fileName", "elements/*/asset/mediaType",
            "elements/*/categories",
            "elements/*/value/name", "elements/*/value/creatorId", "elements/*/value/typeId", "elements/*/value/status",
            "elements/*/values/*/name", "elements/*/values/*/creatorId", "elements/*/values/*/typeId", "elements/*/values/*/status"];
    }
}
module.exports = ContentHelper;
