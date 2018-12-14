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

const BaseFS = require("./BaseFS.js");
const JSONItemFS = require("./JSONItemFS.js");

const fs = require("fs");
const Q = require("q");
const options = require("./utils/options.js");
const utils = require("./utils/utils.js");
const hashes = require("./utils/hashes.js");
const i18n = utils.getI18N(__dirname, ".json", "en");
const recursiveReadDir = require("recursive-readdir");

class JSONPathBasedItemFS extends JSONItemFS {

    constructor(serviceName, folderName, extension) {
        super(serviceName, folderName, extension);
    }

    /**
     * Gets the item with the given path from the local filesystem
     * Rely on JSONItemFS.getItem, BUT add the path field back in after reading
     * from disk so that it will be saved in authoring service with the path val.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {string} name - The name of the item
     * @param {Object} opts Any override options to be used for this operation.
     *
     * @returns {Q.Promise} A promise that resolves with the requested item. The promise
     *                    will reject if the item doesn't exist.
     */
    getItem(context, name, opts) {
        const fsObject = this;
        return super.getItem(context, name, opts)
            .then(function(item) {
                // Set the path (property to be set is based on class.)
                fsObject.setMutablePath(item, (name && name.path) ? name.path : name);
                return item;
            });
    }

    /*
     * Clear the mutable path value.
     *
     * @param {Object} item The item with a mutable path.
     *
     * @protected
     */
    clearMutablePath(item) {
        delete item.path;
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
        item.path = path;
    }

    /**
     * Prune the item by deleting the properties that should not be stored on disk
     * @param {Object} item The item being pruned.
     * @param {Object} opts Any override options to be used for this operation.
     *
     * @override
     */
     pruneItem(item, opts) {
         delete item.created;
         delete item.creator;
         delete item.creatorId;
         delete item.lastModifier;
         delete item.lastModifierId;
         delete item.lastModified;

         // Clear the path (property to be cleared is based on class.)
         this.clearMutablePath(item);
     }

    /**
     * Returns the file name to use for the provided item.
     *
     * @param {Object} item the item to get the filename for
     *
     * @returns {String} the file name to use for the provided item
     *
     * @override
     */
    getFileName (item) {
        if (item) {
            if (item.path) {
                return BaseFS.getValidFileName(item.path);
            } else if (item.name) {
                return BaseFS.getValidFileName(item.name);
            }
        }
    }

    /**
     * Filter the given list of file names before completing the list operation.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Array} files The file names of the items to be listed.
     * @param {Object} opts The options to be used for this operations.
     *
     * @returns {Array} The filtered list of file names.
     *
     * @protected
     */
    _listFilter (context, files, opts) {
        // Filter out the hashes file and any files that do not have the expected file extension.
        const extension = this.getExtension();
        files = files.filter(function (file) {
            return file.endsWith(extension) && !hashes.isHashesFile(file);
        });

        // Filter the files based on the specified path.
        let filterPath = options.getRelevantOption(context, opts, "filterPath");
        if (filterPath) {
            filterPath = utils.formatFilterPath(filterPath);
            files = files.filter(function (file) {
                return file.match(filterPath);
            });
        }

        return files;
    }

    /**
     * Sort the given list of items before completing the list operation.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Array} items The items to be listed.
     * @param {Object} opts The options to be used for this operations.
     *
     * @returns {Array} The sorted list of items.
     *
     * @protected
     */
    _listSort(context, items, opts) {
        // No default sorting.
        return items;
    }

    /**
     * Get a list of all items stored in the working dir.
     *
     * @param {Object} context The API context to be used by the listt operation.
     * @param {Object} opts Any override options to be used for this operation.
     *
     * @returns {Q.Promise} A promise that resolves with a list of all items stored in the working dir.
     *                      There is no guarantee that the names refer to a valid file.
     */
    listNames(context, opts) {
        const fsObject = this;
        const artifactDir = this.getPath(context, opts);
        return Q.Promise(function(resolve, reject) {
            const path = fsObject.getPath(context, opts);
            if (fs.existsSync(path)) {
                recursiveReadDir(path, function(err, files) {
                    if (err) {
                        reject(err);
                    } else {
                        // All filtering is based on relative path.
                        files = files.map(function (file) {
                            return utils.getRelativePath(artifactDir, file);
                        });

                        // Filter the artifacts contained in the list.
                        files = fsObject._listFilter(context, files, opts);

                        let items = files.map(function (file) {
                            // For each file name, create a "proxy" item that contains the metadata to be listed.
                            const proxy = {path: file};

                            try {
                                const item = JSON.parse(fs.readFileSync(artifactDir + file).toString());
                                proxy.id = item.id;
                                proxy.name = item.name;

                                // Include any additional properties on the proxy item.
                                const additionalProperties = opts["additionalItemProperties"];
                                if (additionalProperties) {
                                    additionalProperties.forEach(function (property) {
                                        if (item[property] || item[property] === 0) {
                                            proxy[property] = item[property];
                                        }
                                    });
                                }
                            } catch (err) {
                                // we couldn't open the file to read the id/name metadata, log a warning and continue
                                utils.logWarnings(context, i18n.__("file_parse_error", {path: file}));
                            }
                            return proxy;
                        });

                        // Sort the artifacts contained in the list.
                        items = fsObject._listSort(context, items, opts);

                        resolve(items);
                    }
                });
            } else {
                // Silently return an empty array.
                resolve([]);
            }
        });
    }
}

module.exports = JSONPathBasedItemFS;
