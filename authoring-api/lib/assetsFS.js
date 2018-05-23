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

const fs = require("fs");
const path = require("path");
const Q = require("q");
const mkdirp = require("mkdirp");
const recursive = require("recursive-readdir");
const utils = require("./utils/utils.js");
const options = require("./utils/options.js");
const hashes = require("./utils/hashes.js");
const ignore = require("ignore");
const ignoreFile = ".wchtoolsignore";
const BaseFS = require("./BaseFS.js");
const i18n = utils.getI18N(__dirname, ".json", "en");

const singleton = Symbol();
const singletonEnforcer = Symbol();

const CONTENT_RESOURCE_DIRECTORY = "dxdam";
const ASSET_METADATA_SUFFIX = "_amd.json";
const DRAFT_SUFFIX = "_wchdraft";

// Define the constants for differentiating between web assets and content assets.
const ASSET_TYPES_WEB_ASSETS = 0;
const ASSET_TYPES_CONTENT_ASSETS = 1;
const ASSET_TYPES_BOTH = 2;
const ASSET_TYPES = 'assetTypes';

/**
 * FS object for managing assets on the local file system.
 *
 * @class AssetsFS
 *
 * @extends BaseFS
 */
class AssetsFS extends BaseFS {
    // Expose the constants for differentiating between web assets and content assets.
    static get ASSET_TYPES_WEB_ASSETS () { return ASSET_TYPES_WEB_ASSETS; };
    static get ASSET_TYPES_CONTENT_ASSETS () { return ASSET_TYPES_CONTENT_ASSETS; };
    static get ASSET_TYPES_BOTH () { return ASSET_TYPES_BOTH; };
    static get ASSET_TYPES () { return ASSET_TYPES; };

    /**
     * The constructor for an AssetsFS object. This constructor implements a singleton pattern, and will fail if called
     * directly. The static instance property can be used to get the singleton instance.
     *
     * @constructs AssetsFS
     *
     * @param {Symbol} enforcer - A Symbol that must match a local Symbol to create the new object.
     */
    constructor (enforcer) {
        if (enforcer !== singletonEnforcer) {
            throw i18n.__("singleton_construct_error", {classname: "AssetsFS"});
        }

        super("assets", "assets", ASSET_METADATA_SUFFIX);
    }

    /**
     * The instance property can be used to to get the singleton instance for this class.
     */
    static get instance () {
        if (!this[singleton]) {
            this[singleton] = new AssetsFS(singletonEnforcer);
        }
        return this[singleton];
    }

    /**
     * Get the path to the virtual folder for storing web assets.  Does not create the directory.
     *
     * @param {Object} context The API context to be used by the get operation.
     * @param {Object} [opts] The options to be used.
     *
     * @return {String} The virtual folder for storing web assets.
     */
    getAssetsPath (context, opts) {
        // All virtual folders are within the defined working directory.
        let assetsDir = BaseFS.getWorkingDir(context, opts);

        // Add the virtual folder, unless the "noVirtualFolder" option is specified. (This option is useful when the
        // working directory is used to store only assets, in which case a virtual assets folder is not necessary.)
        if (!opts || !opts.noVirtualFolder) {
            assetsDir += this.getFolderName(context, opts) + path.sep;
        }

        return assetsDir;
    }

    /**
     * Get the path to the virtual folder for storing resources.  Does not create the directory.
     *
     * @param {Object} context The API context to be used by the get operation.
     * @param {Object} [opts] The options to be used.
     *
     * @return {String} The virtual folder for storing resources.
     */
    getResourcesPath (context, opts) {
        // All virtual folders are within the defined working directory.
        return BaseFS.getWorkingDir(context, opts) + "resources" + path.sep;
    }

    /**
     * Get the virtual folder for storing web assets.
     *
     * @param {Object} context The API context to be used by the get operation.
     * @param {Object} [opts] The options to be used.
     *
     * @return {String} The virtual folder for storing web assets.
     */
    getDir (context, opts) {

        const assetsDir = this.getAssetsPath(context, opts);

        // Create the folder to be used for storing web assets, if it doesn't exist.
        if (!fs.existsSync(assetsDir)) {
            mkdirp.sync(assetsDir);
        }

        return assetsDir;
    }

    /**
     * Get the path to the virtual folder for storing content assets.  Does not create the directory.
     *
     * Note: The path defined for content assets always begins with a special folder used for content assets.
     *
     * @param {Object} context The API context to be used by the get operation.
     * @param {Object} opts The options to be used.
     *
     * @return {String} The virtual folder for storing content assets.
     */
    getContentResourcePath (context, opts) {
        const assetDir = this.getAssetsPath(context, opts);

        // Don't return the special folder - the path value defined in the content asset metadata already includes it.
        return assetDir;
    }

    /**
     * Get the virtual folder for storing content assets.
     *
     * Note: The path defined for content assets always begins with a special folder used for content assets.
     *
     * @param {Object} context The API context to be used by the get operation.
     * @param {Object} [opts] The options to be used.
     *
     * @return {String} The virtual folder for storing content assets.
     */
    getContentResourceDir (context, opts) {
        const assetDir = this.getAssetsPath(context, opts);
        const contentAssetDir = assetDir + CONTENT_RESOURCE_DIRECTORY + path.sep;

        // Make sure the special folder for storing content assets is created.
        if (!fs.existsSync(contentAssetDir)) {
            mkdirp.sync(contentAssetDir);
        }

        // Don't return the special folder - the path value defined in the content asset metadata already includes it.
        return assetDir;
    }

    /**
     * Get the default ignore filter.
     *
     * Note: An ignore filter is used to exclude any files that do not belong to the content hub.
     *
     * @param {Object} context The API context to be used by the get operation.
     * @param {Object} opts The options to be used.
     *
     * @returns {Object} The default ignore filter.
     */
    getDefaultIgnoreFilter (context, opts) {
        // Locations of the "ignore" files (which define the files/folders that will not be stored in the content hub.)
        const defaultIgnoreFile = path.dirname(__filename) + path.sep + ignoreFile;
        const assetsIgnoreFile = this.getAssetsPath(context, opts) + ignoreFile;

        // Determine whether the ignore rules from all ignore files should be added.
        let additive = options.getRelevantOption(context, opts, "is_ignore_additive");

        // If the value is anything other than a boolean value of false, use the default value.
        if (additive !== false) {
            additive = true;
        }

        let ignoreRules;
        if (additive) {
            // Use the default ignore file.
            ignoreRules = ignore().add(fs.readFileSync(defaultIgnoreFile).toString());

            if (fs.existsSync(assetsIgnoreFile)) {
                // Add the ignore file that exists in the assets virtual folder.
                ignoreRules.add(fs.readFileSync(assetsIgnoreFile).toString());
            }
        } else {
            if (fs.existsSync(assetsIgnoreFile)) {
                // Only use the ignore file that exists in the assets virtual folder.
                ignoreRules = ignore().add(fs.readFileSync(assetsIgnoreFile).toString());
            } else {
                // Only use the default ignore file.
                ignoreRules = ignore().add(fs.readFileSync(defaultIgnoreFile).toString());
            }
        }

        // Return a filter created from the ignore file rules.
        return ignoreRules.createFilter();
    }

    isContentResource (item) {
        let itemPath = item;
        if (typeof itemPath === "object") {
            itemPath = item.path;
        }
        const i = itemPath.indexOf(CONTENT_RESOURCE_DIRECTORY);
        return (i === 0 || i === 1);
    }

    /**
     * Returns true if the given path is a path to a draft asset.
     *
     * @param path the path to test
     *
     * @returns {boolean} true if the given path is a path to a draft asset.
     */
    isDraftAsset (path) {
        return (path.indexOf(DRAFT_SUFFIX) !== -1);
    }

    getPath (context, opts) {
        return this.getAssetsPath(context, opts);
    }

    getResourcePath (context, name, opts) {
        return this.getResourcesPath(context, opts) + BaseFS.getValidFileName(name);
    }

    getMetadataPath (context, name, opts) {
        name = BaseFS.getValidFileName(name);
        if (this.isContentResource(name)) {
            // make sure the resource directory is created and append the name that includes the path including dxdam
            return this.getContentResourcePath(context, opts) + name + this.getExtension();
        }
        return this.getPath(context, opts) + name;
    }

    /**
     * Get the path for the given asset.
     *
     * If the asset provided is in draft status, then the _wchdraft suffix is appended.
     *
     * @param {Object} asset the asset
     *
     * @return {String} the path for the provided asset
     */
    getAssetPath(asset) {
        let filepath;
        if (asset.path) {
            filepath = BaseFS.getValidFileName(asset.path);
        }

        if (filepath && asset.status === "draft") {
            const index = filepath.lastIndexOf(".");
            if (index > 0) {
                filepath = filepath.substring(0, index) + DRAFT_SUFFIX + filepath.substring(index);
            } else {
                filepath += DRAFT_SUFFIX;
            }
        }
        return filepath;
    }

    /**
     * Get the item with the given path on the local filesystem
     *
     * @param {Object} context The API context to be used by the get operation.
     * @param {String} path - The path of the item.
     * @param {Object} opts The options to be used.
     *
     * @returns {Q.Promise} A promise that resolves to the item with the given path on the local filesystem.
     *
     * @override
     */
    getItem (context, path, opts) {
        const deferred = Q.defer();

        fs.readFile(this.getMetadataPath(context, path, opts), function (err, body) {
            if (err) {
                utils.logErrors(context, "", err);
                deferred.reject(err);
            } else {
                try {
                    const item = JSON.parse(body.toString());
                    deferred.resolve(item);
                } catch (e) {
                    const msg = i18n.__("error_parsing_item", {name: path, message: e.message});
                    utils.logErrors(context, msg, e);
                    deferred.reject((e instanceof SyntaxError) ? new SyntaxError(msg) : new Error(msg));
                }
            }
        });

        return deferred.promise;
    }

    /**
     * Locally saves the given asset according to the config settings. An asset will
     * be saved according to its name.
     *
     * @param {Object} context The API context to be used by the get operation.
     * @param {Object} asset - An object that follows the schema for assets.
     * @param {Object} opts
     */
    saveItem (context, asset, opts) {
        const filepath = this.getMetadataPath(context, this.getAssetPath(asset), opts);
        const dir = path.dirname(filepath);
        return Q.Promise(function (resolve, reject) {
            mkdirp.mkdirp(dir, function (err) {
                if (err) {
                    // Reject the promise if an error occurs when creating a directory.
                    utils.logErrors(context, i18n.__("save_item_write_failed_bad_path", {path: filepath}), err);
                    reject(err);
                } else {
                    try {
                        fs.writeFileSync(filepath, JSON.stringify(asset, null, "  "));
                        return resolve(asset);
                    } catch (err) {
                        reject(err);
                    }
                }
            });
        });
    }

    /**
     * Delete the specified asset from the local file system.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {String} itemPath The path of the asset to delete.
     * @param {Object} opts Any override options to be used for this operation.
     *
     * @returns {Q.Promise} A promise that resolves with the full path of the deleted asset file, or with no value if
     *                      the file did not exist. If there was an error, the promise rejects with that error.
     */
    deleteAsset (context, itemPath, opts) {
        const deferred = Q.defer();
        const filepath = this.getAssetsPath(context, opts) + BaseFS.getValidFileName(itemPath);

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
     * Delete the specified metadata file from the local file system.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {String} itemPath The path of the item to delete.
     * @param {Object} opts Any override options to be used for this operation.
     *
     * @returns {Q.Promise} A promise that resolves with the full path of the deleted resource file, or with no value if
     *                      the file did not exist. If there was an error, the promise rejects with that error.
     */
    deleteMetadata (context, itemPath, opts) {
        const deferred = Q.defer();
        const filepath = this.getMetadataPath(context, itemPath, opts);

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
     * Delete the specified resource file from the local file system.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {String} resourcePath The path of the resource to delete.
     * @param {Object} opts Any override options to be used for this operation.
     *
     * @returns {Q.Promise} A promise that resolves with the full path of the deleted resource file, or with no value if
     *                      the file did not exist. If there was an error, the promise rejects with that error.
     */
    deleteResource (context, resourcePath, opts) {
        const deferred = Q.defer();
        const filepath = this.getResourcePath(context, resourcePath, opts);

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

    getRawResourcePath (context, id, filename, opts) {
        id = BaseFS.getValidFileName(id);
        return this.getResourcesPath(context, opts) + id.substring(0, 2) + "/" + id + "/" + filename;
    }

    renameResource (context, id, filename, opts) {
        const origName = this.getResourcePath(context, id, opts);
        const newName = this.getRawResourcePath(context, id, filename, opts);
        mkdirp.sync(path.dirname(newName));
        fs.renameSync(origName, newName);
    }

    /**
     * Gets a read stream for an asset that is stored locally on the file system
     */
    getItemReadStream (context, name, opts) {
        const deferred = Q.defer();

        try {
            const stream = fs.createReadStream(this.getPath(context, opts) + name);
            deferred.resolve(stream);
        } catch (err) {
            deferred.reject(err);
        }

        return deferred.promise;
    }

    /**
     * Gets a read stream for a resource that is stored locally on the file system
     */
    getResourceReadStream (context, name, opts) {
        const deferred = Q.defer();

        try {
            const stream = fs.createReadStream(this.getResourcePath(context, name, opts));
            deferred.resolve(stream);
        } catch (err) {
            deferred.reject(err);
        }

        return deferred.promise;
    }

    /**
     * Gets a write stream for an asset that is stored locally on the file system.
     *
     * NOTE: The specified asset may not exist.
     */
    getItemWriteStream (context, name, opts) {
        // Get the file path for the specified file, creating the working directory if necessary.
        const filepath = this.getPath(context, opts) + name;
        return this._getItemWriteStream(context, filepath, opts);
    }

    /**
     * Gets a write stream for an asset that is stored locally on the file system.
     *
     * NOTE: The specified asset may not exist.
     */
    getResourceWriteStream (context, name, opts) {
        // Get the file path for the specified file, creating the working directory if necessary.
        const filepath = this.getResourcesPath(context, opts) + name;
        return this._getItemWriteStream(context, filepath, opts);
    }

    /**
     * Gets a write stream for an asset that is stored locally on the file system.
     *
     * NOTE: The specified asset may not exist.
     */
    _getItemWriteStream (context, filepath, opts) {
        const deferred = Q.defer();

        // Create any directories specified in the file's path.
        mkdirp.mkdirp(path.dirname(filepath), function (err) {
            if (err) {
                // Reject the promise if an error occurs when creating a directory.
                deferred.reject(err);
            } else {
                try {
                    // Resolve the promise with a write stream for the specified local file.
                    const stream = fs.createWriteStream(filepath);
                    deferred.resolve(stream);
                } catch (err) {
                    // Reject the promise if an error occurs when creating the stream.
                    deferred.reject(err);
                }
            }
        });

        return deferred.promise;
    }

    /**
     * Filter the given list of file names before completing the list operation.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Array} files The file names of the assets to be listed.
     * @param {Object} filter - A filter for the local files.
     * @param {Object} opts The options to be used for this operations.
     *
     * @returns {Array} The filtered list of file names.
     *
     * @protected
     */
    _listFilter (context, files, filter, opts) {
        // Filter the assets based on the ignore list.
        files = files.filter(filter);

        // Filter out the asset metadata files and the hashes file.
        files = files.filter(function (path) {
            return (!path.endsWith(ASSET_METADATA_SUFFIX) && !hashes.isHashesFile(path));
        });

        // When only displaying web assets, filter out the content assets.
        if (opts && opts[ASSET_TYPES] === ASSET_TYPES_WEB_ASSETS) {
            files = files.filter(function (path) {
                return (!path.startsWith("/" + CONTENT_RESOURCE_DIRECTORY));
            });
        }

        // When only displaying content assets, filter out the web assets.
        if (opts && opts[ASSET_TYPES] === ASSET_TYPES_CONTENT_ASSETS) {
            files = files.filter(function (path) {
                return (path.startsWith("/" + CONTENT_RESOURCE_DIRECTORY));
            });
        }

        // Filter the asset list based on the specified path.
        let filterPath = options.getRelevantOption(context, opts, "filterPath");
        if (filterPath) {
            filterPath = utils.formatFilterPath(filterPath);
            files = files.filter(function (path) {
                return (path.indexOf(filterPath) === 0);
            });
        }

        return files;
    }

    /**
     * Get a filtered list of file names from the local file system.
     *
     * @param {Object} context The API context to be used by the get operation.
     * @param {Object} filter - A filter for the local files.
     * @param {Object} opts - The options to be used for the list operation.
     *
     * @returns {Q.Promise} A promise for a filtered list of file names from the local file system.
     */
    listNames (context, filter, opts) {
        const fsObject = this;
        const deferred = Q.defer();
        const assetDir = this.getAssetsPath(context, opts);

        if (fs.existsSync(assetDir)) {
            if (!filter) {
                filter = this.getDefaultIgnoreFilter(context, opts);
            }

            recursive(assetDir, function (err, files) {
                if (err) {
                    deferred.reject(err);
                } else {
                    // All filtering is based on relative path.
                    files = files.map(function (file) {
                        return utils.getRelativePath(assetDir, file);
                    });

                    // Filter the assets before listing them.
                    files = fsObject._listFilter(context, files, filter, opts);

                    const items = files.map(function (file) {
                        // For each file name, create a "proxy" item that contains the metadata to be listed.
                        const proxy = {"path": file};

                        // Web assets do not have metadata, so only set additional proxy properties for content assets.
                        if (file.startsWith("/" + CONTENT_RESOURCE_DIRECTORY)) {
                            const metadataPath = fsObject.getMetadataPath(context, file, opts);
                            try {
                                const item = JSON.parse(fs.readFileSync(metadataPath).toString());
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
                                // we couldn't read the metadata file to get the id, log a warning and continue
                                utils.logWarnings(context, err);
                            }
                        }

                        return proxy;
                    });

                    deferred.resolve(items);
                }
            });
        } else {
            // Silently return an empty array.
            deferred.resolve([]);
        }

        return deferred.promise;
    }

    /**
     * Get a filtered list of file names from the local file system.
     *
     * @param {Object} context The API context to be used by the get operation.
     * @param {Object} opts - The options to be used for the list operation.
     *
     * @returns {Q.Promise} A promise for a filtered list of file names from the local file system.
     */
    listResourceNames (context, opts) {
        const deferred = Q.defer();
        const resourcesDir = this.getResourcesPath(context, opts);

        if (fs.existsSync(resourcesDir)) {
            recursive(resourcesDir, function (err, files) {
                if (err) {
                    deferred.reject(err);
                } else {
                    files = files.map(function (file) {
                        return utils.getRelativePath(resourcesDir, file);
                    });

                    files = files.filter(function (path) {
                        return (!hashes.isHashesFile(path));
                    });

                    const items = files.map(function (file) {
                        return {
                            path: file,
                            id: path.basename(path.dirname(file))
                        };
                    });

                    deferred.resolve(items);
                }
            });
        } else {
            // Silently return an empty array.
            deferred.resolve([]);
        }

        return deferred.promise;
    }

    _getFileStats (context, path, opts) {
        const deferred = Q.defer();

        fs.stat(path, function (err, stats) {
            if (err) {
                utils.logErrors(context, i18n.__("error_fs_get_filestats", {"name": path}), err);
                deferred.reject(err);
            } else {
                // Resolve with no name, this file was not modified since last change
                deferred.resolve(stats);
            }
        });
        return deferred.promise;
    }

    getFileStats (context, name, opts) {
        return this._getFileStats(context, this.getPath(context, opts) + name, opts);
    }

    getResourceFileStats (context, name, opts) {
        return this._getFileStats(context, this.getResourcePath(context, name, opts), opts);
    }

    getContentLength (context, name, opts) {
        return this.getFileStats(context, name, opts)
            .then(function (stats) {
                return stats.size;
            });
    }

    getResourceContentLength (context, name, opts) {
        return this.getResourceFileStats(context, name, opts)
            .then(function (stats) {
                return stats.size;
            });
    }
}

module.exports = AssetsFS;
