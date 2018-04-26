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
const options = require("./utils/options.js");
const utils = require("./utils/utils.js");
const i18n = utils.getI18N(__dirname, ".json", "en");
const CONFLICT_EXTENSION = '.conflict';

class JSONItemFS extends BaseFS {
    /**
     * The constructor for a JSONItemFS object.
     *
     * @param {String} serviceName
     * @param {String} folderName
     * @param {String} extension
     *
     * @constructs JSONItemFS
     */
    constructor (serviceName, folderName, extension) {
        super(serviceName, folderName, extension);
    }

    /**
     * Returns the file name to use for the provided item.
     *
     * @param {Object} item the item to get the filename for
     *
     * @returns {String} the file name to use for the provided item
     */
    getFileName (item) {
        if (item) {
            if (item.id) {
                return BaseFS.getValidFileName(item.id);
            } else if (item.name) {
                return BaseFS.getValidFileName(item.name);
            }
        }
    }

    /**
     * Get the file system path to the specified item.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Object | String} item The name of the item or the item object.
     * @param {Object} [opts] Any override options to be used for this operation.
     *
     * @returns {String} The file system path to the specified item.
     */
    getItemPath (context, item, opts) {
        let relativePath;
        if (typeof item === "string") {
            relativePath = item;
        } else {
            relativePath = this.getFileName(item);
        }

        const extension = this.getExtension();
        if (relativePath && !relativePath.endsWith(extension)) {
            relativePath += extension;
        }

        if (relativePath) {
            return this.getPath(context, opts) + relativePath;
        }
    }

    /**
     * Get the hashes value of the local file path for the given id.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {String} id The item id.
     * @param {Object} opts Any override options to be used for this operation.
     *
     * @returns {String} The hashes value of the local file path for the given id, or null if the path is not found.
     */
    getExistingItemPath (context, id, opts) {
        let retVal = null;

        if (id) {
            // Get the exisitng hashes information for the item.
            const basePath = this.getPath(context, opts);
            const filepath = hashes.getFilePath(context, basePath, id, opts);
            if (filepath) {
                retVal = basePath + filepath;
            }
        }

        return retVal;
    }

    /**
     * Get the file paths for the descendents of the folder with the given file path.
     *
     * @param {String} filePath The file path of the folder.
     * @param {String} [extension] The file extension to use for filtering.
     *
     * @return {Array} The file paths for the descendents of the folder with the given file path.
     *
     * @protected
     */
    getDescendentFilePaths (filePath, extension) {
        const retVal = [];

        // The recursive function used to gather the file paths.
        const gatherFilePaths = function (filePath) {
            fs.readdirSync(filePath).forEach(function (file) {
                const childPath = filePath + "/" + file;
                const stat = fs.statSync(childPath);
                if (stat.isDirectory()) {
                    gatherFilePaths(childPath + "/");
                }
                else if (!extension || childPath.endsWith(extension)) {
                    return retVal.push(childPath);
                }
            });
        };

        // Normalize the file path, make sure it ends with a separator, and convert any back slashes to slashes.
        filePath = path.normalize(filePath + "/").replace(/\\/g, "/");

        // Gather file paths starting at the top level.
        gatherFilePaths(filePath);

        // Return the array of descendent file paths.
        return retVal;
    }

    /**
     * Create a map of the local artifact files. The map will contain an array of file paths for each item id.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} opts Any override options to be used for this operation.
     *
     * @return {Object} A map of the local artifact files.
     *
     * @protected
     */
    createLocalFilePathMap (context, opts) {
        const map = {};

        // Only need to create the map if the virtual directory exists.
        const virtualDirectory = this.getPath(context, opts);
        if (fs.existsSync(virtualDirectory)) {
            // Get the extension for artifact files.
            const extension = this.getExtension();

            // Local function to recursively walk a directory and add file paths to a map.
            const addFilesToMap = function (directory, map) {
                // Get the names of the files in the specified directory.
                const files = fs.readdirSync(directory);
                if (files && files.length > 0) {
                    // Process the files in the specified directory.
                    files.forEach(function (fileName) {
                        // Generate the path name for the file.
                        const filePath = path.join(directory, fileName);

                        // Determine whether the file path is a directory or a file.
                        if (fs.statSync(filePath).isDirectory()) {
                            // Make a recursive call for the directory.
                            addFilesToMap(filePath, map);
                        } else if (filePath.endsWith(extension)) {
                            // Add the file to the map.
                            try {
                                // Parse the file to get the id property.
                                const item = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                                if (item && item.id) {
                                    // Add the file path to the array of file paths for this id
                                    const list = map[item.id] || [];
                                    list.push(path.normalize(filePath));
                                    map[item.id] = list;
                                }
                            } catch (err) {
                                // Couldn't read the file, so just ignore it and don't add it to the map.
                            }
                        }
                    });
                }
            };

            // Add the files in the virtual directory to the map.
            addFilesToMap(virtualDirectory, map);
        }

        return map;
    }

    /**
     * Handle any necessary cleanup of the local file system when an artifact has been renamed.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {String} id The id of the artifact.
     * @param {String} filePath The (possibly new) filepath of the artifact.
     * @param {Object} opts Any override options to be used for this operation.
     *
     * @protected
     */
    handleRename (context, id, filePath, opts) {
        // Get the local file path map created for the current operation.
        const localFilePathMap = options.getRelevantOption(context, opts, "localFilePathMap", this.getServiceName());

        // Normalize the file path for comparison and display.
        filePath = path.normalize(filePath);

        const fsObject = this;
        if (localFilePathMap) {
            // Use the local file path map to find and delete other artifact files with the given id.
            const localFilePaths = localFilePathMap[id];
            if (localFilePaths) {
                const virtualDirectory = this.getPath(context, opts);

                // Look at the files contained in the map, and decide which ones to delete.
                localFilePaths.forEach(function (localFilePath) {
                    // Do not delete the specified file, and make sure the file to be deleted still exists.
                    if ((localFilePath !== filePath) && fs.existsSync(localFilePath)) {
                        // Before deleting the local file, verify that it still contains the specified "id" property.
                        // This guards against deleting an artifact that was just saved. For example, if artifact "A"
                        // was renamed to "B", and a new artifact "A" was added. On the next pull, new artifact "A" will
                        // overwrite existing artifact "A". When artifact "B" is pulled, the map will contain artifact
                        // "A" in the map, because the old "A" had the same "id" property as the new "B". But we don't
                        // want to delete "A" now, because the new "A" no longer contains the same id as the new "B".
                        try {
                            // Parse the file to get the id property.
                            const item = JSON.parse(fs.readFileSync(localFilePath, 'utf8'));
                            if (item && (item.id === id)) {
                                // Delete the local file, because it has the same id as the specified file.
                                fs.unlinkSync(localFilePath);
                                utils.logWarnings(context, i18n.__("deleted_original_file", {old_name: localFilePath, new_name: filePath}));

                                // Also delete the parent folder if it is now empty.
                                utils.removeEmptyParentDirectories(virtualDirectory, localFilePath);
                            }
                        } catch (err) {
                            // Couldn't read the file, so just ignore it.
                        }
                    }
                });
            }
        } else if (opts && opts.originalPushFileName && !fs.existsSync(filePath)) {
            // Handle the case of a push where the original file name exists and the new file name does not exist.
            const oldName = fsObject.getItemPath(context, opts.originalPushFileName, opts);
            if (fs.existsSync(oldName)) {
                // Delete the file with the old name. A file with the new name with be subsequently saved.
                fs.unlinkSync(oldName);
                utils.logWarnings(context, i18n.__("deleted_original_file", {old_name: oldName, new_name: filePath}));
            }
        }
    }

    /**
     * Optionally prune fields out of the item that we don't want stored on disk.
     *
     * @param {Object} item
     * @param {Object} opts Any override options to be used for this operation.
     */
     pruneItem (item, opts) {
         // Base class doesn't prune anything yet, but subclasses likely do.
    }

    /**
     * Locally saves the given item according to the config settings. The item will
     * be saved according to its name property.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} item - The object to save.
     * @param {Object} opts Any override options to be used for this operation.
     */
    saveItem (context, item, opts) {
        const fsObject = this;
        const hasConflict = opts && opts.conflict;
        let filepath = this.getItemPath(context, item, opts);
        if (!utils.isValidFilePath(filepath)) {
            const deferred = Q.defer();
            deferred.reject(new Error(i18n.__("invalid_path", {path: filepath})));
            return deferred.promise;
        }
        else {
            const baseFilepath = filepath;
            if (hasConflict) {
                filepath += CONFLICT_EXTENSION;
            }
            const dir = path.dirname(filepath);
            context.logger.trace("Saving item [" + this._serviceName + "] to: " + filepath);
            return Q.Promise(function (resolve, reject) {
                mkdirp.mkdirp(dir, function (err) {
                    if (err) {
                        // Reject the promise if an error occurs when creating a directory.
                        utils.logErrors(context, i18n.__("save_item_write_failed_bad_path", {path: filepath}), err);
                        reject(err);
                    } else {
                        try {
                            // Use the base file path for the rename logic. For example, if the item has been renamed,
                            // we want to delete the outdated artifact file(s) before saving the new artifact file (or
                            // the new conflict file.) But, if the item has not been renamed, we do not want to delete
                            // the existing artifact file when we save a conflict file.
                            fsObject.handleRename(context, item.id, baseFilepath, opts);

                            // Make a copy of the item so we can prune it before saving.
                            const prunedItem = utils.clone(item);
                            fsObject.pruneItem(prunedItem, opts);
                            fs.writeFileSync(filepath, JSON.stringify(prunedItem, null, "  "));
                            if (!hasConflict) {
                                hashes.updateHashes(context, fsObject.getPath(context, opts), filepath, item, undefined, undefined, opts);

                                // Add the item to the cache, if a cache has been enabled.
                                JSONItemFS.addItemToCache(context, filepath, prunedItem, opts);
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
     * Delete the specified item from the local file system.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} item The item to delete.
     * @param {Object} opts Any override options to be used for this operation.
     *
     * @returns {Q.Promise} A promise that resolves with the full path of the deleted item file, or with no value if the
     *                      file did not exist. If there was an error, the promise rejects with that error.
     */
    deleteItem (context, item, opts) {
        const deferred = Q.defer();
        const filepath = this.getItemPath(context, item, opts);

        if (fs.existsSync(filepath)) {
            // Delete the file with the specified path.
            fs.unlink(filepath, function (err) {
                if (err) {
                    deferred.reject(err);
                } else {
                    deferred.resolve(filepath);
                }
            });
        } else {
            deferred.resolve();
        }

        return deferred.promise;
    }

    /**
     * @param {Object} context The API context to be used by the get operation.
     * @param {Object} opts Any override options to be used for this operation.
     *
     * @returns {Q.Promise} A promise that resolves with the list of all items stored in the working dir.
     *                      There is no guarantee that the names refer to a valid file.
     */
    listNames (context, opts) {
        const fsObject = this;
        return Q.Promise(function (resolve, reject) {
            const virtualFolderPath = fsObject.getPath(context, opts);
            if (fs.existsSync(virtualFolderPath)) {
                fs.readdir(virtualFolderPath, function (err, files) {
                    if (err) {
                        reject(err);
                    } else {
                        const extension = fsObject.getExtension();
                        const names = files
                            .filter(function (file) {
                                return file.endsWith(extension);
                            }).map(function (file) {
                                const proxy = {};
                                try {
                                    // Parse the file and get the id and name properties.
                                    const item = JSON.parse(fs.readFileSync(virtualFolderPath + file, 'utf8'));
                                    proxy.id = item.id;
                                    proxy.name = item.name;

                                    // Include any additional properties on the proxy item.
                                    const additionalProperties = opts["additionalItemProperties"];
                                    if (additionalProperties) {
                                        additionalProperties.forEach(function (property) {
                                            if (item[property]) {
                                                proxy[property] = item[property];
                                            }
                                        });
                                    }
                                } catch (err) {
                                    // couldn't read the file to obtain the id/name metadata, log a warning and continue
                                    utils.logWarnings(context, i18n.__("file_parse_error", {path: virtualFolderPath + file}));
                                }

                                let path;
                                if (proxy.id) {
                                    // The file contains the expected metadata, so add a path property.
                                    path = file.replace(extension, "");
                                } else {
                                    // The file does not contain the expected metadata. Leave the id property undefined,
                                    // so that the returned object is known to be invalid. Add a name property that will
                                    // allow the file path to be reconstructed by the getFileName method. And add a path
                                    // property that is the path to the actual file, so it can be displayed correctly.
                                    proxy.name = file.replace(extension, "");
                                    path = file;
                                }

                                // Only include a path property if it is different than the id.
                                if (path !== proxy.id) {
                                    proxy.path = path;
                                }

                                return proxy;
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
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} opts Any override options to be used for this operation.
     *
     * @returns {Q.Promise} - a promise that resolves with a list of all items stored
     *                      in the working directory.
     */
    getItems (context, opts) {
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
     * @param {Object} opts Any override options to be used for this operation.
     *
     * @returns {Q.Promise} A promise that resolves with the requested item. The promise
     *                    will reject if the item doesn't exist.
     *
     * @override
     */
    getItem (context, name, opts) {
        const deferred = Q.defer();
        const filepath = this.getItemPath(context, name, opts);

        // Get the item from the cache, if a cache has been enabled.
        let item = JSONItemFS.getItemFromCache(context, filepath, opts);
        if (item) {
            deferred.resolve(item);
        } else {
            fs.readFile(filepath, function (err, body) {
                if (err) {
                    utils.logErrors(context, i18n.__("error_fs_get_item"), err);
                    deferred.reject(err);
                } else {
                    try {
                        // Add the item to the cache, if a cache has been enabled.
                        item = JSON.parse(body.toString());
                        JSONItemFS.addItemToCache(context, filepath, item, opts);
                        deferred.resolve(item);
                    } catch (error) {
                        const msg = i18n.__("error_parsing_item", {name: name, message: error.message});
                        utils.logErrors(context, msg, error);
                        deferred.reject((error instanceof SyntaxError) ? new SyntaxError(msg) : new Error(msg));
                    }
                }
            });
        }
        return deferred.promise;
    }

    /**
     *
     * @param {Object} context The API context to be used by the file operation.
     * @param name
     * @param opts
     *
     * @returns {Q.Promise}
     */
    getFileStats (context, name, opts) {
        const deferred = Q.defer();

        fs.stat(this.getItemPath(context, name, opts), function (err, stats) {
            if (err) {
                utils.logErrors(context, i18n.__("error_fs_get_filestats", {"name": name}), err);
                deferred.reject(err);
            } else {
                deferred.resolve(stats);
            }
        });

        return deferred.promise;
    }

    /**
     * Get the local file cache.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} opts Any override options to be used for this operation.
     *
     * @returns {Map} The local file cache, or null.
     *
     * @private
     */
    static getLocalCache (context, opts) {
        const cache = options.getRelevantOption(context, opts, "localFileCache");
        if (cache && cache.constructor && cache.constructor.name === "Map") {
            return cache;
        } else {
            return null;
        }
    }

    /**
     * Determine whether the local file cache is enabled.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Boolean} state A value of true indicates that the cache should be enabled. A value of false indicates
     *        that the cache should be disabled.
     * @param {Object} opts Any override options to be used for this operation.
     */
    static setCacheEnabled (context, state, opts) {
        if (JSONItemFS.isCacheEnabled(context, opts) !== state) {
            if (state) {
                context["localFileCache"] = new Map();
            } else {
                delete context["localFileCache"];
            }
        }
    }

    /**
     * Determine whether the local file cache is enabled.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} opts Any override options to be used for this operation.
     *
     * @returns {Boolean} A return value of true indicates that the local file cache is enabled. A return value of false
     *          indicates that the local file cache is disabled.
     */
    static isCacheEnabled (context, opts) {
        const cache = JSONItemFS.getLocalCache(context, opts);
        return (cache !== null);
    }

    /**
     * Add the specified item to the cache using the given filepath.
     *
     * Note: If the cache has not been enabled, no error will be signaled.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {String} filepath The filepath of the item to be added to the cache.
     * @param {Object} item The item to be added to the cache.
     * @param {Object} opts Any override options to be used for this operation.
     */
    static addItemToCache (context, filepath, item, opts) {
        const cache = JSONItemFS.getLocalCache(context, opts);
        if (cache) {
            cache.set(filepath, item);
        }
    }

    /**
     * Get the item for the given filepath from the cache.
     *
     * Note: If the cache has not been enabled, no error will be signaled.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {String} filepath The filepath of the item to get from the cache.
     * @param {Object} opts Any override options to be used for this operation.
     *
     * @returns {Object} The item for the given filepath from the cache.
     */
    static getItemFromCache (context, filepath, opts) {
        const cache = JSONItemFS.getLocalCache(context, opts);
        if (cache) {
            return cache.get(filepath);
        }
    }
}

module.exports = JSONItemFS;
