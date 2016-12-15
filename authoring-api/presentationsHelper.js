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
const rest = require("./lib/presentationsREST").instance;
const fS = require("./lib/presentationsFS").instance;
const utils = require("./lib/utils/utils.js");
const logger = utils.getLogger(utils.apisLog);
const i18n = utils.getI18N(__dirname, ".json", "en");

const singleton = Symbol();
const singletonEnforcer = Symbol();

class PresentationsHelper extends BaseHelper {
    /**
     * The constructor for a PresentationsHelper object. This constructor implements a singleton pattern, and will fail
     * if called directly. The static instance property can be used to get the singleton instance.
     *
     * @param {Symbol} enforcer - A Symbol that must match a local Symbol to create the new object.
     */
    constructor (enforcer) {
        if (enforcer !== singletonEnforcer) {
            throw i18n.__("singleton_construct_error", {classname: "PresentationsHelper"});
        }
        super(rest, fS, "presentations");
    }

    /**
     * The instance property can be used to to get the singleton instance for this class.
     */
    static get instance() {
        if (!this[singleton]) {
            this[singleton] = new PresentationsHelper(singletonEnforcer);
        }
        return this[singleton];
    }

    /**
     * Create the given item in the local file system.
     *
     * @param {Object} presentation - The metadata of the local item to be created.
     * @param {Object} opts - The options to be used for the create operation.
     *
     * @returns {Q.Promise} A promise for the item to be created.
     */
    createLocalItem (presentation, opts) {
        const helper = this;
        logger.trace('enter createLocalItem' + presentation.toString());
        return this._fsApi.newItem(presentation, opts)
            .then(function (item) {
                return helper._addLocalStatus(item);
            })
            .catch(function (err) {
                utils.logErrors(i18n.__("create_local_item_error"), err);
                throw err;
            });
    }
}

/**
 * Export the PresentationsHelper class.
 */
module.exports = PresentationsHelper;
