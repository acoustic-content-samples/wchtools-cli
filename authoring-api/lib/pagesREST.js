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

const JSONPathBasedItemREST = require("./JSONPathBasedItemREST.js");
const utils = require("./utils/utils.js");
const i18n = utils.getI18N(__dirname, ".json", "en");

const singleton = Symbol();
const singletonEnforcer = Symbol();

class PagesREST extends JSONPathBasedItemREST {

    constructor(enforcer) {
        if (enforcer !== singletonEnforcer)
            throw i18n.__("singleton_construct_error", {classname: "PagesREST"});

        // The uriPath is passed as "" because it always needs to be calculated dynamically in the getUriPath() method.
        super("pages", "", "/views/by-modified", "/views/by-modified");
    }

    static get instance() {
        if (!this[singleton]) {
            this[singleton] = new PagesREST(singletonEnforcer);
        }
        return this[singleton];
    }

    getUriPath (context, opts) {
        let siteId = "default";
        if (opts && opts.siteId) {
            siteId = opts.siteId;
        }
        return "/authoring/v1/sites/" + siteId + "/pages";
    }

    /*
     * Does this WCH REST API currently support the forceOverride query param on Update/PUT?
     */
    supportsForceOverride() {
        return true;
    }

    /*
     * Does this WCH REST API currently support the forceOverride query param on Create/POST?
     */
    supportsForceOverrideOnCreate () {
        return true;
    }

    /*
     * Return the item by-path query param (default == path)
     */
    getItemByPathQueryParameterName() {
        return "hierarchicalPath";
    }

    /*
     * Ask the authoring API to return the specified artifact by path
     */
    getItemByPath (context, path, opts) {
        // Page path is dynamically constructed from page names, so would never
        // have a .json suffix. Strip off the .json suffix if there.
        if (path && path.endsWith(".json"))
          path = path.replace(".json", "");
        return super.getItemByPath(context, path, opts);
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
     * Override _getItem so we can add the pages specific query param
     */
    _getItem(context, id, queryParams, opts) {
        if (!queryParams) {
            queryParams = {};
        }
        queryParams.include = "hierarchicalPath";
        return super._getItem(context, id, queryParams, opts);
    }

    /*
     * Overrideable method for delete URI for the REST object
     * @param {string} uri
     * @return {string} uri, optionally modified, with query parameters
     *
     * @override
     */
    getDeleteUri( uri, opts ) {
        if (opts && opts["delete-content"] ) {
            return uri + "?delete-content=true";
        } else {
            return uri;
        }
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
