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

const Q = require("q");
const JSONItemREST = require("./JSONItemREST.js");
const utils = require("./utils/utils.js");
const i18n = utils.getI18N(__dirname, ".json", "en");
const options = require("./utils/options.js");

const singleton = Symbol();
const singletonEnforcer = Symbol();

const PUBLISH_PRIORITY = "x-ibm-dx-publish-priority";
const PUBLISH_PRIORITY_NOW = "now";
const PUBLISH_PRIORITY_NEXT = "next";

class ContentREST extends JSONItemREST {

    constructor(enforcer) {
        if (enforcer !== singletonEnforcer) {
            throw i18n.__("singleton_construct_error", {classname: "ContentREST"});
        }
        super("content", "/authoring/v1/content", undefined, "/views/by-modified");
    }

    static get instance() {
        if (!this[singleton]) {
            this[singleton] = new ContentREST(singletonEnforcer);
        }
        return this[singleton];
    }

    /*
     * Override BaseREST.getUpdateRequestOptions to add x-ibm-dx-publish-priority:now header if specified
     */
    getUpdateRequestOptions (context, opts) {
        return super.getUpdateRequestOptions(context, opts)
            .then((reqOptions) => {
                if (options.getRelevantOption(context, opts, "publish-now")) {
                    reqOptions.headers[PUBLISH_PRIORITY] = PUBLISH_PRIORITY_NOW;
                } else if (options.getRelevantOption(context, opts, "publish-next")) {
                    reqOptions.headers[PUBLISH_PRIORITY] = PUBLISH_PRIORITY_NEXT;
                }
                const deferred = Q.defer();
                deferred.resolve(reqOptions);
                return deferred.promise;
            });
    }

    /*
     * Does this WCH REST API currently support the forceOverride query param?
     */
    supportsForceOverride() {
        return true;
    }


    /*
     * Does this artifact type support tags (eg, to allow setting a tag on a push)
     */
    supportsTags() {
        return true;
    }

    /*
     * Does this artifact type support libraries (eg, to allow associating an item with a library on push)
     */
    supportsLibraries() {
        return true;
    }

}

module.exports = ContentREST;
