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

const JSONItemREST = require("./JSONItemREST.js");
const utils = require("./utils/utils.js");
const i18n = utils.getI18N(__dirname, ".json", "en");

const singleton = Symbol();
const singletonEnforcer = Symbol();

class SitesREST extends JSONItemREST {

    constructor(enforcer) {
        if (enforcer !== singletonEnforcer)
            throw i18n.__("singleton_construct_error", {classname: "SitesREST"});

        super("sites", "/authoring/v1/sites", undefined, undefined);
    }

    static get instance() {
        if (!this[singleton]) {
            this[singleton] = new SitesREST(singletonEnforcer);
        }
        return this[singleton];
    }

    /*
     * Does this WCH REST API currently support the forceOverride query param?
     */
    supportsForceOverride() {
        return true;
    }

    /*
     * Determine whether push operations should default to creating a new item instead of updating an existing item.
     *
     * @param {Object} context The API context to be used for the current request.
     * @param {Object} opts The override options specified for the current request.
     *
     * @returns {Boolean} A return value of true indicates that push operations should default to creating a new item.
     *          A return value of false indicates that push operations should default to updating an existing item.
     *
     * @override
     */
    isCreateOnlyMode (context, opts) {
        // The sites API does not currently support creating new items (POST).
        return false;
    }
}

module.exports = SitesREST;
