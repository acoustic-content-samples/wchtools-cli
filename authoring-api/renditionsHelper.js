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
const rest = require("./lib/renditionsREST").instance;
const fS = require("./lib/renditionsFS").instance;
const utils = require("./lib/utils/utils.js");
const hashes = require("./lib/utils/hashes.js");
const i18n = utils.getI18N(__dirname, ".json", "en");
const Q = require("q");

const singleton = Symbol();
const singletonEnforcer = Symbol();

class RenditionsHelper extends JSONItemHelper {
    /**
     * The constructor for a RenditionsHelper object. This constructor implements a singleton pattern, and will fail if
     * called directly. The static instance property can be used to get the singleton instance.
     *
     * @param {Symbol} enforcer - A Symbol that must match a local Symbol to create the new object.
     */
    constructor (enforcer) {
        if (enforcer !== singletonEnforcer) {
            throw i18n.__("singleton_construct_error", {classname: "RenditionsHelper"});
        }
        super(rest, fS, "renditions");
    }

    /**
     * The instance property can be used to to get the singleton instance for this class.
     */
    static get instance() {
        if (!this[singleton]) {
            this[singleton] = new RenditionsHelper(singletonEnforcer);
        }
        return this[singleton];
    }

    /**
     * Delete the specified remote item.
     *
     * @param {Object} context The current context to be used by the API.
     * @param {Object} item - The item to be deleted.
     * @param {Object} opts - The options to be used for the delete operation.
     *
     * @returns {Q.Promise} A rejected promise indicating that renditions cannot be deleted.
     *
     * @override
     */
    deleteRemoteItem(context, item, opts) {
        const message = i18n.__("delete_rendition_error", {"id": item.id, "opts": JSON.stringify(opts ? opts : {})});
        return Q.reject(new Error(message));
    }

    /**
     * Delete the items on the remote content hub.
     *
     * @param {Object} context The API context to be used by the delete operation.
     * @param {Object} opts The options to be used to delete the items.
     *
     * @returns {Q.Promise} A promise to delete the items on the remote content hub.
     *
     * @override
     */
    deleteRemoteItems(context, opts) {
        const message = i18n.__("delete_renditions_error");
        return Q.reject(new Error(message));
    }

    /**
     * Remove all renditions hash information.
     *
     * @param {Object} context The current context to be used by the API.
     * @param {Object} opts - The options to be used for this operation.
     */
    removeAllHashes(context, opts) {
        const basePath = this._fsApi.getPath(context, opts);
        hashes.removeAllHashes(context, basePath, opts);
    }
}

/**
 * Export the RenditionsHelper class.
 */
module.exports = RenditionsHelper;
