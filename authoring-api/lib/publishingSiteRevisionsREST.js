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

const singleton = Symbol();
const singletonEnforcer = Symbol();

const DEFAULT = "default";

class PublishingSiteRevisionsREST extends JSONItemREST {

    constructor(enforcer) {
        if (enforcer !== singletonEnforcer) {
            throw i18n.__("singleton_construct_error", {classname: "PublishingSiteRevisionsREST"});
        }
        super("site-revisions", "/publishing/v1/site-revisions", undefined, undefined);
    }

    static get instance() {
        if (!this[singleton]) {
            this[singleton] = new PublishingSiteRevisionsREST(singletonEnforcer);
        }
        return this[singleton];
    }

    /**
     * getItems - overridden to hardcode a single default site revision until more than one revision is supported
     * @param context
     * @param opts
     * @returns {Q.Promise}
     */
    getItems (context, opts) {
        const deferred = Q.defer();
        this.getItem(context, DEFAULT, opts)
            .then(function (item) {
                deferred.resolve([item]);
            })
            .catch(function (err) {
                deferred.reject(err);
            });
        return deferred.promise;
    }
}

module.exports = PublishingSiteRevisionsREST;
