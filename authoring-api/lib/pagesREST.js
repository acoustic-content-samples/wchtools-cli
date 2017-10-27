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

class PagesREST extends JSONItemREST {

    constructor(enforcer) {
        if (enforcer !== singletonEnforcer)
            throw i18n.__("singleton_construct_error", {classname: "PagesREST"});

        // TODO the "default" in the following endpoint needs to be dynamic and
        // passed in based on which site you're pulling page definitions for.
        // For Aug mvp there is one site, "default" so this will work temporarily
        // but we should make this dynamic asap so this code will work when WCH
        // allows more than one site (each of which will have a page hierarchy)
        super("pages", "/authoring/v1/sites/default/pages", "/views/by-modified", "/views/by-modified");
    }

    static get instance() {
        if (!this[singleton]) {
            this[singleton] = new PagesREST(singletonEnforcer);
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
     * Override _getItems so we can add the pages specific query param
     */
    _getItems (context, uriSuffix, queryParams, opts) {
        if (!queryParams) {
            queryParams = {};
        }
        queryParams.include="hierarchicalPath";
        return super._getItems(context, uriSuffix, queryParams, opts);
    }

    /*
     * Override createItem so we can add the hierarchical path.
     */
    createItem (context, item, opts) {
        const hierarchicalPath = item.hierarchicalPath;
        return super.createItem(context, item, opts)
            .then(function (item) {
                // If the created item does not specify the hierarchical path, use the local path.
                if (hierarchicalPath && !item.hierarchicalPath) {
                    item.hierarchicalPath = hierarchicalPath;
                }
                return item;
            });
    }

    /*
     * Override createItem so we can add the hierarchical path.
     */
    updateItem (context, item, opts) {
        const hierarchicalPath = item.hierarchicalPath;
        return super.updateItem(context, item, opts)
            .then(function (item) {
                // If the updated item does not specify the hierarchical path, use the local path.
                if (hierarchicalPath && !item.hierarchicalPath) {
                    item.hierarchicalPath = hierarchicalPath;
                }
                return item;
            });
    }
}

module.exports = PagesREST;
