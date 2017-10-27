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
const rest = require("./lib/imageProfilesREST").instance;
const fS = require("./lib/imageProfilesFS").instance;
const utils = require("./lib/utils/utils.js");
const i18n = utils.getI18N(__dirname, ".json", "en");

const singleton = Symbol();
const singletonEnforcer = Symbol();

class ImageProfilesHelper extends JSONItemHelper {
    /**
     * The constructor for an ImageProfilesHelper object. This constructor implements a singleton pattern, and will fail
     * if called directly. The static instance property can be used to get the singleton instance.
     *
     * @param {Symbol} enforcer - A Symbol that must match a local Symbol to create the new object.
     */
    constructor (enforcer) {
        if (enforcer !== singletonEnforcer) {
            throw i18n.__("singleton_construct_error", {classname: "ImageProfilesHelper"});
        }
        super(rest, fS, "image-profiles");
    }

    /**
     * The instance property can be used to to get the singleton instance for this class.
     */
    static get instance() {
        if (!this[singleton]) {
            this[singleton] = new ImageProfilesHelper(singletonEnforcer);
        }
        return this[singleton];
    }
}

/**
 * Export the ImageProfilesHelper class.
 */
module.exports = ImageProfilesHelper;
