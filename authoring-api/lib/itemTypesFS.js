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

const BaseFS = require("./BaseFS.js");
const JSONPathBasedItemFS = require("./JSONPathBasedItemFS.js");
const utils = require("./utils/utils.js");
const i18n = utils.getI18N(__dirname, ".json", "en");

const singleton = Symbol();
const singletonEnforcer = Symbol();

const OLD_ARTIFACT_FILE_EXTENSION = "_tmd.json";

class ItemTypesFS extends JSONPathBasedItemFS {

    constructor(enforcer) {
        if (enforcer !== singletonEnforcer) {
            throw i18n.__("singleton_construct_error", {classname: "ItemTypesFS"});
        }
        super("types", "types", ".json");
    }

    static get instance() {
        if (!this[singleton]) {
            this[singleton] = new ItemTypesFS(singletonEnforcer);
        }
        return this[singleton];
    }

    /**
     * Get the file name to use for the provided item.
     *
     * @param {Object} item the item to get the filename for
     *
     * @returns {String} the file name to use for the provided item
     *
     * @override
     */
    getFileName (item) {
        if (item) {
            if (!item.path && item.name) {
                // Special case for handling an "old" Type artifact for which we need to generate a path from the name.
                return item.name.replace(/ /g, "-")
                    .replace(/:/g, "%3A")
                    .replace(/</g, "%3C")
                    .replace(/>/g, "%3E")
                    .replace(/"/g, "%22")
                    .replace(/\|/g, "%7C")
                    .replace(/\?/g, "%3F")
                    .replace(/\*/g, "%2A");
            } else {
                return super.getFileName(item);
            }
        }
    }

    /*
     * Set the mutable path value.
     *
     * @param {Object} item The item with a mutable path.
     * @param {String} path The path to be set.
     *
     * @protected
     */
    setMutablePath(item, path) {
        // The "path" property should not be added for "old" Type artifacts.
        const isOldArtifact = path.endsWith(item.id + OLD_ARTIFACT_FILE_EXTENSION);
        if (!isOldArtifact) {
            super.setMutablePath(item, path);
        }
    }
}

module.exports = ItemTypesFS;
