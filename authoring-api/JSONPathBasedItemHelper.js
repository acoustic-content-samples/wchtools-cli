/*
Copyright 2017 IBM Corporation

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

/**
 * Helper class for artifacts that are JSON path-based objects.
 *
 * Note: A helper object provides access to both the REST API and the local file system for a single artifact type.
 *
 * @class JSONPathBasedItemHelper
 */
class JSONPathBasedItemHelper extends JSONItemHelper {
    /**
     * The constructor for a helper that manages JSON path-based artifacts.
     *
     * @constructs JSONPathBasedItemHelper
     *
     * @param {BaseREST} restApi - The REST API object managed by this helper.
     * @param {BaseFS} fsApi - The FS object managed by this helper.
     * @param {String} artifactName - The name of the "artifact type" managed by this helper.
     * @param {String} [classification] - Optional classification of the artifact type - defaults to artifactName
     */
    constructor (restApi, fsApi, artifactName, classification) {
        super(restApi, fsApi, artifactName, classification);
    }

    makeEmittedObject(context, item, opts) {
        return {id: item.id, name: this.getPathName(item), path: item.path};
    }

    _makeListItemResult (context, item, opts) {
        const result = super._makeListItemResult(context, item, opts);
        if (item.path) {
            result.path = item.path;
        } else if (item.hierarchicalPath) {
            result.path = item.hierarchicalPath;
        }
        return result;
    }
}

/**
 * Export the JSONPathBasedItemHelper class.
 */
module.exports = JSONPathBasedItemHelper;
