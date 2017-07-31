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
const fs = require("fs");
const mkdirp = require("mkdirp");
const path = require("path");
const Q = require("q");
const hashes = require("./utils/hashes.js");
const utils = require("./utils/utils.js");
const i18n = utils.getI18N(__dirname, ".json", "en");
const CONFLICT_EXTENSION = '.conflict';

class JSONItemFS extends BaseFS {

    constructor(serviceName, folderName, extension) {
        super(serviceName, folderName, extension);
    }

    /**
     * Returns the file name to use for the provided item.
     * @param item the item to get the filename for
     * @returns {string} the file name to use for the provided item
     */
    getFileName(item) {
        if(item.id)
            return item.id;
        return item.name;
    }

    /**
     * Get the file system path to the specified item.
     *
     * @param {Object | String} item The name of the item or the item object.
     *
     * @returns {String} The file system path to the specified item.
     */
    getItemPath(context, item, opts) {
        let name;
        if (typeof item === "string") {
            name = item;
        } else if (typeof item === "object") {
            name = this.getFileName(item);
        }
        return this.getPath(context, opts) + name + this.getExtension();
    }

    /**
     *
     * @param context
     * @param name
     * @param opts
     *
     * @private
     */
    handleRename(context, name, opts) {
        // if the file is already an id based file nothing to do
        if (!fs.existsSync(name) && opts && opts.originalPushFileName) {
            const oldName = this.getPath(context, opts) + opts.originalPushFileName + this.getExtension();
            if (fs.existsSync(oldName)) {
                fs.unlinkSync(oldName);
                utils.logWarnings(context, i18n.__("deleted_original_file", {old_name: oldName, new_name: name}));
            }
        }
    }

    // TEMPORARY workaround for bug #71 in mkdirp which goes into infinite loop on bad windows pathname
    // Find a better mkdirp and a better path checker to use first, and then remove this workaround
    static isBadWindowsPathname(path){
        return (!path || utils.isInvalidPath(path) || path.includes("http:") || path.includes("https:"));
    }

    /**
     * Optionally prune fields out of the item that we don't want stored on disk
     * @param {Object} item
     * @param {Object} opts
     */
     pruneItem(item, opts) {
         // Base class doesn't prune anything yet, but subclasses likely do.
     }

    /**
     * Locally saves the given item according to the config settings. The item will
     * be saved according to its name property.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} item - The object to save.
     * @param {Object} opts -
     */
    saveItem(context, item, opts) {
        const fsObject = this;
        let filepath = this.getItemPath(context, item, opts);
        this.handleRename(context, filepath, opts);
        if (opts && opts.conflict) {
            filepath += CONFLICT_EXTENSION;
        }
        const dir = path.dirname(filepath);
        context.logger.trace("Saving item [" + this._serviceName + "] to: " + filepath);
        if (JSONItemFS.isBadWindowsPathname(filepath)) {
            const deferred = Q.defer();
            deferred.reject(new Error(i18n.__("invalid_path", {path: filepath})));
            return deferred.promise;
        }
        else {
            return Q.Promise(function (resolve, reject) {
                mkdirp.mkdirp(dir, function (err) {
                    if (err) {
                        // Reject the promise if an error occurs when creating a directory.
                        utils.logErrors(context, i18n.__("save_item_write_failed_bad_path", {path: filepath}), err);
                        reject(err);
                    } else {
                        try {
                            fsObject.pruneItem(item, opts);
                            fs.writeFileSync(filepath, JSON.stringify(item, null, "  "));
                            if (opts && !opts.conflict) {
                                hashes.updateHashes(context, fsObject.getPath(context, opts), filepath, item, opts);
                            }
                            return resolve(item);
                        } catch (err) {
                            utils.logErrors(context, i18n.__("save_item_write_failed", {path: filepath}), err);
                            reject(err);
                        }
                    }
                });
            });
        }
    }

    /**
     * @returns {Q.Promise} a promise that resolves with the list of all items stored
     *                    in the working dir.
     *                    There is no guarantee that the names refer to a valid file.
     *
     * @param {Object} context The API context to be used by the get operation.
     */
    listNames(context, opts) {
        const fsObject = this;
        return Q.Promise(function (resolve, reject) {
            const path = fsObject.getPath(context, opts);
            if (fs.existsSync(path)) {
                fs.readdir(path, function (err, files) {
                    if (err) {
                        reject(err);
                    } else {
                        const extension = fsObject.getExtension();
                        const names = files.filter(function (file) {
                            return file.endsWith(extension);
                        }).map(function (file) {
                            return file.replace(extension, "");
                        });
                        resolve(names);
                    }
                });
            } else {
                // Silently return an empty array.
                resolve([]);
            }
        });
    }

    /**
     * @returns {Q.Promise} - a promise that resolves with a list of all items stored
     *                      in the working directory.
     */
    getItems(context, opts) {
        const fsObject = this;
        return this.listNames(context, opts)
            .then(function (names) {
                const promises = names.map(function (name) {
                    return fsObject.getItem(context, name, opts)
                        .catch(function (err) {
                            utils.logErrors(context, i18n.__("error_fs_get_item"), err);
                        });
                });
                return Q.all(promises);
            })
            .then(function (names) {
                // filter out any undefined values due to errors
                names = names.filter(function (n) {
                    return n;
                });
                return names;
            });
    }

    /**
     * Gets the item with the given name from the local filesystem
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {string} name - The name of the item
     * @param {Object} opts The options to be used for this operation.
     *
     * @returns {Q.Promise} A promise that resolves with the requested item. The promise
     *                    will reject if the item doesn't exist.
     */
    getItem(context, name, opts) {
        const deferred = Q.defer();
        fs.readFile(this.getItemPath(context, name, opts), function (err, body) {
            if (err) {
                utils.logErrors(context, i18n.__("error_fs_get_item"), err);
                deferred.reject(err);
            } else {
                try {
                    const item = JSON.parse(body.toString());
                    deferred.resolve(item);
                } catch (error) {
                    const msg = i18n.__("error_parsing_item", {name: name, message: error.message});
                    utils.logErrors(context, msg, error);
                    deferred.reject((error instanceof SyntaxError) ? new SyntaxError(msg) : new Error(msg));
                }
            }
        });
        return deferred.promise;
    }

}

module.exports = JSONItemFS;
