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
const ignore = require("ignore");
const ignoreFile = ".dxToolsignore";
const BaseFS = require("./BaseFS.js");
const i18n = utils.getI18N(__dirname, ".json", "en");

const singleton = Symbol();
const singletonEnforcer = Symbol();

const CONTENT_RESOURCE_DIRECTORY = "dxdam";
const ASSET_METADATA_SUFFIX = "_amd.json";

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
     * Get the virtual folder for storing web assets.
     *
     * @param {Object} opts The options to be used.
     *
     * @return {String} The virtual folder for storing web assets.
     */
    getDir (opts) {
        // All virtual folders are within the defined working directory.
        let assetsDir = BaseFS.getWorkingDir(opts);

        // Add the virtual folder, unless the "noVirtualFolder" option is specified. (This option is useful when the
        // working directory is used to store only assets, in which case a virtual assets folder is not necessary.)
        if (!opts || !opts.noVirtualFolder) {
            assetsDir += this.getFolderName() + path.sep;
        }

        // Createe the folder to be used for storing web assets, if it doesn't exist.
        if (!fs.existsSync(assetsDir)) {
            mkdirp.sync(assetsDir);
        }

        return assetsDir;
    }

    /**
     * Get the virtual folder for storing content assets.
     *
     * Note: The path defined for content assets always begins with a special folder used for content assets.
     *
     * @param {Object} opts The options to be used.
     *
     * @return {String} The virtual folder for storing content assets.
     */
    getContentResourceDir (opts) {
        const assetDir = this.getDir(opts);
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
     * @param {Object} opts The options to be used.
     *
     * @returns {Object} The default ignore filter.
     */
    getDefaultIgnoreFilter (opts) {
        const assetsDir = this.getDir(opts);

        // Look for an "ignore" file (defines which files do not belong to the content hub.)
        let ig;
        if (fs.existsSync(assetsDir + ignoreFile)) {
            // First priority is an ignore file that exists in the assets virtual folder.
            ig = ignore().add(fs.readFileSync(assetsDir + ignoreFile).toString());
        } else {
            // Otherwise use the standard ignore file stored in the same location as this JavaScript file.
            ig = ignore().add(fs.readFileSync(path.dirname(__filename) + path.sep + ignoreFile).toString());
        }

        // Return a filter created from the ignore file.
        return ig.createFilter();
    }

    isContentResource (item) {
        let itemPath = item;
        if (typeof itemPath === "object") {
            itemPath = item.path;
        }
        const i = itemPath.indexOf(CONTENT_RESOURCE_DIRECTORY);
        return (i === 0 || i === 1);
    }

    getPath (name, opts) {
        return this.getDir(opts) + name;
    }

    getMetadataPath (name, opts) {
        if (this.isContentResource(name)) {
            // make sure teh resource directory is created and append the name that includes the path including dxdam */
            return this.getContentResourceDir(opts) + name + this.getExtension();
        }
        return this.getPath(name, opts);
    }

    /**
     * Get the item with the given path on the local filesystem
     *
     * @param {String} path - The path of the item.
     * @param {Object} opts The options to be used.
     *
     * @returns {Q.Promise} A promise that resolves to the item with the given path on the local filesystem.
     */
    getItem (path, opts) {
        const deferred = Q.defer();

        fs.readFile(this.getMetadataPath(path, opts), function (err, body) {
            if (err) {
                utils.logErrors("",err);
                deferred.reject(err);
            } else {
                try {
                    const item = JSON.parse(body.toString());
                    deferred.resolve(item);
                } catch (e) {
                    utils.logErrors(i18n.__("error_parsing_item", {name: path, message: e.message, body: body.toString()}), e);
                    deferred.reject(e);
                }
            }
        });

        return deferred.promise;
    }

    /**
     * Locally saves the given asset according to the config settings. An asset will
     * be saved according to its name.
     *
     * @param {Object} asset - An object that follows the schema for assets.
     * @param {Object} opts
     */
    saveItem (asset, opts) {
        const filepath = this.getMetadataPath(asset.path, opts);
        const dir = path.dirname(filepath);
        return Q.Promise(function (resolve, reject) {
            mkdirp.mkdirp(dir, function (err) {
                if (err) {
                    // Reject the promise if an error occurs when creating a directory.
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
     * Gets a read stream for an asset that is stored locally on the file system
     */
    getItemReadStream (name, opts) {
        const deferred = Q.defer();

        try {
            const stream = fs.createReadStream(this.getPath(name, opts));
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
    getItemWriteStream (name, opts) {
        const deferred = Q.defer();

        // Get the file path for the specified file, creating the working directory if necessary.
        const filepath = this.getPath(name, opts);

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
     * Get a filtered list of file names from the local file system.
     *
     * @param {Object} filter - A filter for the local files.
     * @param {Object} opts - The options to be used for the list operation.
     *
     * @returns {Q.Promise} A promise for a filtered list of file names from the local file system.
     */
    listNames (filter, opts) {
        const deferred = Q.defer();
        const assetDir = this.getDir(opts);

        if (!filter) {
            filter = this.getDefaultIgnoreFilter(opts);
        }

        recursive(assetDir, function (err, files) {
            if (err) {
                deferred.reject(err);
            } else {
                files = files.map(function (file) {
                    return utils.getRelativePath(assetDir, file);
                });

                // this does the ignore for the file on the relative path
                files = files.filter(filter)
                    .map(function (file) {
                        return file;
                    });

                // if web assets only filter out the dxdam resources
                if (opts && opts[ASSET_TYPES] === ASSET_TYPES_WEB_ASSETS) {
                    files = files.filter(function (path) {
                        if (!path.startsWith(CONTENT_RESOURCE_DIRECTORY)) {
                            return path;
                        }
                    })
                    .map(function (file) {
                        return file;
                    });
                }

                // if content assets only filter out the non dxdam resources
                if (opts && opts[ASSET_TYPES] === ASSET_TYPES_CONTENT_ASSETS) {
                    files = files.filter(function(path) {
                        if (path.startsWith(CONTENT_RESOURCE_DIRECTORY)) {
                            return path;
                        }
                    })
                    .map(function (file) {
                        return file;
                    });
                }

                files = files.filter(function (path) {
                    if (!path.endsWith(ASSET_METADATA_SUFFIX) && path !== ".dxhashes") {
                        return path;
                    }
                })
                .map(function (file) {
                    return file;
                });

                if (opts && opts.filterPath !== undefined) {
                    // make sure filter path is correct format
                    let filterPath = opts.filterPath.replace(/\\/g, '/');
                    if (filterPath.indexOf('/') === 0) {
                        filterPath = filterPath.slice(1);
                    }
                    if (!filterPath.endsWith('/')) {
                        filterPath = filterPath + '/';
                    }
                    files = files.filter(function (path){
                        if (path.indexOf(filterPath) === 0) {
                            return path;
                        }
                    })
                    .map(function (file) {
                        return file;
                    });
                }
                deferred.resolve(files);
            }
        });

        return deferred.promise;
    }

    getFileStats (name, opts) {
        const deferred = Q.defer();

        fs.stat(this.getPath(name, opts), function (err, stats) {
            if (err) {
                deferred.reject(err);
            } else {
                // Resolve with no name, this file was not modified since last change
                deferred.resolve(stats);
            }
        });
        return deferred.promise;
    }

    getContentLength (name, opts) {
        const deferred = Q.defer();
        this.getFileStats(name, opts)
            .then(function (stats) {
                deferred.resolve(stats.size);
            })
            .catch(function (err) {
                deferred.reject(err);
            });
        return deferred.promise;
    }
}

module.exports = AssetsFS;
