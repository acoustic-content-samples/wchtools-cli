/*
Copyright IBM Corporation 2016, 2017

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
const Q = require("q");
const events = require("events");
const AssetsREST = require("./lib/assetsREST.js");
const assetsREST = AssetsREST.instance;
const AssetsFS = require("./lib/assetsFS.js");
const assetsFS = AssetsFS.instance;
const options = require("./lib/utils/options.js");
const StatusTracker = require("./lib/utils/statusTracker.js");
const utils = require("./lib/utils/utils.js");
const path = require("path");
const logger = utils.getLogger(utils.apisLog);
const hashes = require("./lib/utils/hashes.js");
const i18n = utils.getI18N(__dirname, ".json", "en");

/**
 * Flag used to determine whether to wait for the file stream to be closed before settling the promise to push an asset.
 *
 * @type Boolean
 *
 * @private
 */
const WAIT_FOR_CLOSE = process.env.WCHTOOLS_WAIT_FOR_CLOSE || false;

/**
 * Validate the specified file path to avoid bug #71 in mkdirp, which can result in an infinite loop on Windows.
 *
 * Note: This validation could be removed once the mkdirp issue has been addressed.
 *
 * @param {String} path - The file path to be validated.
 *
 * @return {Boolean} A return value of true indicates the specified file path is valid.
 *
 * @private
 */
const isValidWindowsPathname = function (path) {
    return (path && !utils.isInvalidPath(path) && !path.includes("http:") && !path.includes("https:"));
};

const singleton = Symbol();
const singletonEnforcer = Symbol();

/**
 * High-level functionality for managing assets on the local file system and through the Content Hub API.
 */
/**
 * Helper class for asset artifacts.
 *
 * Note: A helper object provides access to both the REST API and the local file system for a single artifact type.
 *
 * @class AssetsHelper
 */
class AssetsHelper {
    /**
     * The constructor for an assets helper object.
     *
     * @constructs AssetsHelper
     */
    constructor (enforcer) {
        if (enforcer !== singletonEnforcer) {
            throw i18n.__("singleton_construct_error", {classname: "AssetsHelper"});
        }

        /**
         * @member {AssetsREST} _restApi - The REST API object managed by this helper.
         */
        this._restApi = assetsREST;

        /**
         * @member {AssetsFS} _fsApi - The FS object managed by this helper.
         */
        this._fsApi = assetsFS;

        /**
         * @member {String} _artifactName - The name of the "artifact type" managed by this helper.
         */
        this._artifactName = "assets";

        /**
         * @member {StatusTracker} _statusTracker - The object used to track the status of artifacts for this helper.
         */
        this._statusTracker = new StatusTracker();

        /**
         * @member {events.EventEmitter} _eventEmitter - The object used to emit events for this helper.
         */
        this._eventEmitter = new events.EventEmitter();

        /**
         * @member {String} NEW - State flag indicating that an item is new.
         */
        this.NEW = hashes.NEW;

        /**
         * @member {String} MODIFIED - State flag indicating that an item has been modified.
         */
        this.MODIFIED = hashes.MODIFIED;

        /**
         * @member {String} DELETED - State flag indicating that an item has been deleted.
         */
        this.DELETED = hashes.DELETED;

        /**
         * @member {Number} ASSET_TYPES_WEB_ASSETS - Constant indicating an asset type of web assets.
         */
        this.ASSET_TYPES_WEB_ASSETS = AssetsFS.ASSET_TYPES_WEB_ASSETS;

        /**
         * @member {Number} ASSET_TYPES_CONTENT_ASSETS - Constant indicating an asset type of content assets.
         */
        this.ASSET_TYPES_CONTENT_ASSETS = AssetsFS.ASSET_TYPES_CONTENT_ASSETS;

        /**
         * @member {Number} ASSET_TYPES_BOTH - Constant indicating an asset type of both web and content assets.
         */
        this.ASSET_TYPES_BOTH = AssetsFS.ASSET_TYPES_BOTH;

        /**
         * @member {String} ASSET_TYPES - Options key for indicating an asset type.
         */
        this.ASSET_TYPES = AssetsFS.ASSET_TYPES;
    }

    static get instance() {
        if (!this[singleton]) {
            this[singleton] = new AssetsHelper(singletonEnforcer);
        }
        return this[singleton];
    }

    /**
     * Get the event emitter associated with the Assets Helper.
     *
     * @returns {Object} The event emitter associated with the Assets Helper.
     */
    getEventEmitter () {
        return this._eventEmitter;
    }

    /**
     * Get the name of the virtual folder used to store assets.
     *
     * @returns {String} The name of the virtual folder used to store assets.
     */
    getAssetFolderName () {
        return this._fsApi.getFolderName();
    }

    /**
     * Determines if the artifact directory exists locally.
     *
     * @returns {boolean}
     */
    doesDirectoryExist (opts) {
        const dir = this._fsApi.getAssetsPath(opts);
        return fs.existsSync(dir);
    }

    /**
     * Close the given stream.
     *
     * @param {Readable} stream - The stream to be closed.
     * @param {Q.Deferred} [deferred] - The deferred to be resolved when the stream is closed.
     *
     * @private
     */
    _closeStream (stream, deferred) {
        if (stream) {
            try {
                // Calling resume causes the stream to read fully to the end.
                stream.resume();
            } catch (err) {
                logger.debug(i18n.__("close_stream_failed"), err);
            }

            if (deferred) {
                // Resolve the deferred if the stream still hasn't closed in a reasonable amount of time.
                setTimeout(function () {
                    deferred.resolve(i18n.__("timed_out_closing_read_stream"));
                }, 10000);
            }
        }
    }

    /**
     * Set the options to be used as global options for this helper.
     *
     * Note: This method should only be called from the wchToolsApi getter for this helper.
     *
     * @param {Object} opts - The options to be used as global options for this helper.
     */
    initGlobalOptions (opts) {
        if (opts) {
            options.setGlobalOptions(opts);
        }
    }

    /**
     * Pull the specified asset from the content hub.
     *
     * @param {Object} asset - The asset to be pulled,
     * @param {Object} opts - The options to be used for the pull operation.
     *
     * @returns {Q.Promise} A promise for the pulled asset.
     *
     * @private
     */
    _pullAsset (asset, opts) {
        // Verify the pathname.
        if (!isValidWindowsPathname(asset.path) || asset.path === hashes.FILENAME || asset.path === "/" + hashes.FILENAME) {
            const deferred = Q.defer();
            deferred.reject(new Error(i18n.__("invalid_path", {path: asset.path})));
            return deferred.promise;
        } else {
            // Get the local file stream to be written.
            const helper = this;
            return helper._fsApi.getItemWriteStream(asset.path, opts)
                .then(function (stream) {
                    // Download the specified asset contents and write them to the given stream.
                    return helper._restApi.pullItem(asset, stream, opts)
                        .then(function (asset) {
                            const basePath = helper._fsApi.getAssetsPath(opts);
                            const filePath = helper._fsApi.getPath(asset.path, opts);

                            const md5 = hashes.generateMD5Hash(filePath);
                            if (!hashes.compareMD5Hashes(md5, asset.digest)) {
                                const err = i18n.__("digest_mismatch", {cli_digest: md5, asset: asset.path, server_digest: asset.digest});
                                logger.error(err);
                                throw new Error(err);
                            }
                            hashes.updateHashes(basePath, filePath, asset, opts);

                            // Notify any listeners that the asset at the given path was pulled.
                            helper.getEventEmitter().emit("pulled", asset.path);

                            // The specified asset exists both remotely and locally.
                            helper.addRemoteStatus(asset.path);
                            helper.addLocalStatus(asset.path);

                            // Save the asset metadata for content resources.
                            let result = asset;
                            if (helper._fsApi.isContentResource(asset)) {
                                result = helper._fsApi.saveItem(asset, opts);
                            }
                            return result;
                        });
                });
        }
    }

    /**
     * Pull the chunk of assets retrieved by the given function.
     *
     * @param {Function} listFn - A function that returns a promise for a chunk of remote assets to be pulled.
     * @param {Object} opts - The options to be used for the pull operations.
     *
     * @returns {Q.Promise} A promise for information about the assets that were pulled.
     *
     * @private
     */
    _pullItemsChunk (listFn, opts) {
        // Get the next "chunk" of assets metadata from the content hub.
        const helper = this;
        return listFn(opts)
            .then(function (assetList) {
                const listLength = assetList.length;

                // Filter the asset list based on the type of assets specified by the options.
                if (opts && opts[helper.ASSET_TYPES] === helper.ASSET_TYPES_WEB_ASSETS) {
                    // Filter out any content assets.
                    assetList = assetList.filter(function (asset) {
                        if (!helper._fsApi.isContentResource(asset)) {
                            return asset;
                        }
                    });
                } else if (opts && opts[helper.ASSET_TYPES] === helper.ASSET_TYPES_CONTENT_ASSETS) {
                    // Filter out any web assets.
                    assetList = assetList.filter(function (asset) {
                        if (helper._fsApi.isContentResource(asset)) {
                            return asset;
                        }
                    });
                }

                // Throttle the number of assets to be pulled concurrently, using the currently configured limit.
                const concurrentLimit = options.getRelevantOption(opts, "concurrent-limit", "assets", "concurrent-limit");
                const results = utils.throttledAll(assetList.map(function (asset) {
                    // Return a function that returns a promise for each asset being pulled.
                    return function () {
                        return helper._pullAsset(asset, opts);
                    };
                }), concurrentLimit);

                // Return the promise to pull all of the specified assets.
                return results
                    .then(function (promises) {
                        // Return a list of results - asset metadata for a fulfilled promise, error for a rejected promise.
                        const assets = [];
                        promises.forEach(function (promise, index) {
                            if (promise.state === "fulfilled") {
                                const asset = promise.value;
                                assets.push(asset);
                            }
                            else {
                                const error = promise.reason;
                                assets.push(error);
                                helper.getEventEmitter().emit("pulled-error", error, assetList[index].path);
                            }
                        });

                        // Return the number of assets processed (either success or failure) and an array of pulled assets.
                        return {length: listLength, assets: assets};
                    });
            });
    }

    /**
     * Recursive function to pull subsequent chunks of assets retrieved by the given function.
     *
     * @param {Function} listFn - A function that returns a promise for a chunk of remote assets to be pulled.
     * @param {Q.Deferred} deferred - A deferred that will be resolved with *all* assets pulled.
     * @param {Array} results - The accumulated results.
     * @param {Object} pullInfo - The number of assets processed (either success or failure) and an array of pulled assets.
     * @param {Object} opts - The options to be used for the pull operations.
     *
     * @private
     */
    _recursePull (listFn, deferred, results, pullInfo, opts) {
        // If a results array is specified, accumulate the assets pulled.
        if (results) {
            results = results.concat(pullInfo.assets);
        } else {
            results = pullInfo.assets;
        }

        const currentChunkSize = pullInfo.length;
        const maxChunkSize = options.getRelevantOption(opts, "limit", "assets", "limit");
        if (currentChunkSize === 0 || currentChunkSize < maxChunkSize) {
            // The current chunk is a partial chunk, so there are no more assets to be retrieved. Resolve the promise
            // with the accumulated results.
            deferred.resolve(results);
        } else {
            // The current chunk is a full chunk, so there may be more assets to retrieve.
            if (opts) {
                // Clone the opts before modifying them, so that the original opts are not affected.
                opts = utils.clone(opts);
            } else {
                opts = {};
            }

            // Increase the offset so that the next chunk of assets will be retrieved.
            const offset = options.getRelevantOption(opts, "offset", "assets", "offset");
            opts.offset = offset +  maxChunkSize;

            // Pull the next chunk of assets from the content hub.
            const helper = this;
            helper._pullItemsChunk(listFn, opts)
                .then(function (pullInfo) {
                    helper._recursePull(listFn, deferred, results, pullInfo, opts);
                });
        }
    }

    /**
     * Pull the asset with the specified path from the content hub.
     *
     * @param {String} path - The path of the asset to be pulled.
     * @param {Object} opts - The options to be used for the pull operation.
     *
     * @returns {Q.Promise} A promise for the asset that was pulled.
     */
    pullItem (path, opts) {
        // The content hub assets API does not support retrieving an item by path. So in order to pull a specific item,
        // get the items from the content hub one chunk at a time, and look for an asset with the specified path.
        const helper = this;
        return this._restApi.getItems(opts)
            .then(function (assets) {
                // Find the asset with the specified path.
                return helper._findItemByPath(assets, path, opts);
            })
            .then(function (asset) {
                // The asset with the specified path was found, so pull it.
                logger.trace("Pull found asset: " + path);
                return helper._pullAsset(asset, opts);
            })
            .catch(function (err) {
                // The asset with the specified name was not found.
                logger.trace("Pull could not find asset: " + path);
                throw err;
            });
    }

    /**
     * Pull all assets from the content hub.
     *
     * @param {Object} opts - The options to be used for the pull operations.
     *
     * @returns {Q.Promise} A promise for the assets that were pulled.
     */
    pullAllItems (opts) {
        const deferred = Q.defer();

        // Keep track of how many assets were not pulled.
        let errorCount = 0;
        const assetPulledError = function (/*error, name*/) {
            errorCount++;
        };
        this.getEventEmitter().on("pulled-error", assetPulledError);

        // Use AssetsREST.getItems() as the list function, so that all assets will be pulled.
        const listFn = this._restApi.getItems.bind(this._restApi);
        const helper = this;
        helper._pullItemsChunk(listFn, opts)
            .then(function (pullInfo) {
                // There are no results initially, so just pass null for the results. The accumulated array of asset
                // metadata for all pulled items will be available when "deferred" has been resolved.
                helper._recursePull(listFn, deferred, null, pullInfo, opts);
            })
            .catch(function (err) {
                // There was a fatal issue, beyond a failure to pull one or more items.
                deferred.reject(err);
            });

        // Handle any necessary actions once the pull operations have completed.
        deferred.promise
            .then(function (/*results*/) {
                if (errorCount === 0) {
                    // Only update the last pull timestamp if there were no pull errors.
                    helper._setLastPullTimestamps(opts);
                }
            });

        return deferred.promise;
    }

    /**
     * Pull all assets that have been modified on the content hub since the last pull.
     *
     * @param {Object} opts - The options to be used for the pull operations.
     *
     * @returns {Q.Promise} A promise for the assets that were pulled.
     */
    pullModifiedItems (opts) {
        const deferred = Q.defer();

        // Keep track of how many assets were not pulled.
        let errorCount = 0;
        const assetPulledError = function (/*error, name*/) {
            errorCount++;
        };
        this.getEventEmitter().on("pulled-error", assetPulledError);

        // Use getModifiedRemoteItems() as the list function, so that only new and modified assets will be pulled.
        const listFn = this.getModifiedRemoteItems.bind(this, [this.NEW, this.MODIFIED]);
        const helper = this;
        helper._pullItemsChunk(listFn, opts)
            .then(function (pullInfo) {
                // There are no results initially, so just pass null for the results. The accumulated array of asset
                // metadata for all pulled items will be available when "deferred" has been resolved.
                helper._recursePull(listFn, deferred, null, pullInfo, opts);
            })
            .catch(function (err) {
                // There was a fatal issue, beyond a failure to pull one or more items.
                deferred.reject(err);
            });

        // Handle any necessary actions once the pull operations have completed.
        deferred.promise
            .then(function (/*results*/) {
                if (errorCount === 0) {
                    // Only update the last pull timestamp if there were no pull errors.
                    helper._setLastPullTimestamps(opts);
                }
            });

        return deferred.promise;
    }

    /**
     * Push the items with the given paths.
     *
     * @param {Array} paths - The paths of the items to be pushed.
     * @param {Object} opts - The options to be used for the push operations.
     *
     * @returns {Q.Promise} A promise for the items that were pushed.
     *
     * @protected
     */
    _pushNameList (paths, opts) {
        const helper = this;

        // Throttle the number of assets to be pushed concurrently, using the currently configured limit.
        const concurrentLimit = options.getRelevantOption(opts, "concurrent-limit", "assets", "concurrent-limit");
        const results = utils.throttledAll(paths.map(function (name) {
            return function () {
                return helper.pushItem(name, opts);
            };
        }), concurrentLimit);

        // Return the promise to push all of the specified assets.
        let errorCount = 0;
        return results
            .then(function (promises) {
                // Keep track of the assets that were successfully pushed, and emit a "pushed-error" event for the others.
                const assets = [];
                promises.forEach(function (promise, index) {
                    if (promise.state === "fulfilled") {
                        logger.trace("Pushed: " + JSON.stringify(promise.value));
                        assets.push(promise.value);
                    }
                    else {

                        // Rejected promises are logged by throttledAll(), so just emit the error event.
                        helper.getEventEmitter().emit("pushed-error", promise.reason, paths[index]);
                        errorCount++;
                    }
                });
                return assets;
            })
            .then(function (assets) {
                // Keep track of the timestamp of this operation, but only if there were no errors.
                if (errorCount === 0) {
                    helper._setLastPushTimestamps(opts);
                }
                return assets;
            });
    }

    /**
     * Push the asset with the specified path to the content hub.
     *
     * @param {String} path - The path of the asset to be pushed.
     * @param {Object} opts - The options to be used for the push operation.
     *
     * @returns {Q.Promise} A promise for the metadata of the asset that was pushed.
     */
    pushItem (path, opts) {
        const deferred = Q.defer();

        // Begin the push process by determining the content length of the specified local file.
        const helper = this;
        helper._fsApi.getContentLength(path, opts)
            .then(function (length) {
                // Get the resource ID and the MD5 hash for the specified local asset file from the local hashes.
                const assetFile = helper._fsApi.getPath(path, opts);
                const assetHashes = hashes.getHashesForFile(helper._fsApi.getAssetsPath(opts), assetFile, opts);
                const isContentResource = helper._fsApi.isContentResource(path);
                let resourceId;
                let resourceMd5 = assetHashes ? assetHashes.md5 : undefined;

                // In order to push the asset to the content hub, open a read stream for the asset file.
                let streamOpened;
                if (isContentResource && fs.existsSync(helper._fsApi.getMetadataPath(path, opts))) {
                    // There is a metadata file for the content asset, so start by reading the metadata file.
                    streamOpened = helper._fsApi.getItem(path, opts)
                        .then(function (asset) {
                            // Get the resource ID and the MD5 hash if they aren't already defined.
                            resourceId = resourceId || asset.resource;
                            resourceMd5 = resourceMd5 || hashes.generateMD5Hash(assetFile);

                            // Create a clone of the original options, and keep track of the asset metadata.
                            opts = opts ? utils.clone(opts) : {};
                            opts.asset = asset;

                            // Open a read stream for the actual asset file (not the metadata file).
                            return helper._fsApi.getItemReadStream(path, opts);
                        })
                        .catch(function (err) {
                            // Reject the top-level promise.
                            deferred.reject(err);
                        });
                } else {
                    // There is no metadata file, so open a read stream for the asset file.
                    streamOpened = helper._fsApi.getItemReadStream(path, opts);
                }

                streamOpened
                    .then(function (readStream) {
                        // Create a promise that will be resolved when the read stream is closed.
                        const streamClosed = Q.defer();
                        readStream.on("close", function () {
                            streamClosed.resolve(path);
                        });

                        // Register that the asset file exists locally.
                        helper.addLocalStatus(path);

                        // Determine how to set replaceContentReource - if the saved md5 doesn't match the md5 of the resource
                        const replaceContentResource = (resourceMd5 !== hashes.generateMD5Hash(assetFile));
                        // Push the asset to the content hub.
                        helper._restApi.pushItem(isContentResource, replaceContentResource, resourceId, resourceMd5, path, readStream, length, opts)
                            .then(function (asset) {
                                // The push succeeded so emit a "pushed" event.
                                helper.getEventEmitter().emit("pushed", path);

                                // Register that the asset exists remotely.
                                helper.addRemoteStatus(path);

                                // Save the asset metadata to a local file.
                                if (isContentResource) {
                                    // Don't wait for the metadata to be saved, and don't reject the push if the save fails.
                                    helper._fsApi.saveItem(asset, opts);
                                }

                                // Once the metadata file has been saved, resolve the top-level promise.
                                if (WAIT_FOR_CLOSE) {
                                    // Also wait for the stream to close before resolving the top-level promise.
                                    streamClosed.promise
                                        .then(function () {
                                            deferred.resolve(asset);
                                        });
                                } else {
                                    deferred.resolve(asset);
                                }

                                // Update the hashes for the pushed asset.
                                const assetPath = helper._fsApi.getPath(asset.path, opts);
                                hashes.updateHashes(helper._fsApi.getAssetsPath(opts), assetPath, asset, opts);
                            })
                            .catch(function (err) {
                                // Failed to push the asset file, so explicitly close the read stream.
                                helper._closeStream(readStream, streamClosed);

                                // Reject the top-level promise.
                                if (WAIT_FOR_CLOSE) {
                                    // Also wait for the stream to close before rejecting the top-level promise.
                                    streamClosed.promise
                                        .then(function () {
                                            deferred.reject(err);
                                        });
                                } else {
                                    deferred.reject(err);
                                }
                            });
                    })
                    .catch(function (err) {
                        // Failed getting the read stream, so just reject the top-level promise.
                        deferred.reject(err);
                    });
            })
            .catch(function (err) {
                // Reject the top-level promise.
                deferred.reject(err);
            });

        return deferred.promise;
    }

    /**
     * Push local assets to the content hub.
     *
     * @param {Object} opts - The options to be used for the push operation.
     *
     * @returns {Q.Promise} A promise for the list of assets that were successfully pushed.
     */
    pushAllItems (opts) {
        // Get the list of local assets, based on the specified options.
        const helper = this;
        return helper.listLocalItemNames(opts)
            .then(function (names){
                // Push the assets in the list.
                return helper._pushNameList(names, opts);
            });
    }

    /**
     * Push modified local assets to the content hub.
     *
     * @param {Object} opts - The options to be used for the push operation.
     *
     * @returns {Q.Promise} A promise for the list of modified assets that were successfully pushed.
     */
    pushModifiedItems (opts) {
        // Get the list of modified local assets, based on the specified options.
        const helper = this;
        return helper.listModifiedLocalItemNames([this.NEW, this.MODIFIED], opts)
            .then(function (names){
                // Push the assets in the list.
                return helper._pushNameList(names, opts);
            });
    }

    /**
     * List the chunk of assets retrieved by the given function.
     *
     * @param {Function} listFn - A function that returns a promise for a chunk of remote assets to be listed.
     * @param {Object} opts - The options to be used for the list operations.
     *
     * @returns {Q.Promise} A promise for information about the assets that were listed.
     *
     * @private
     */
    _listAssetChunk (listFn, opts) {
        // Get the next "chunk" of assets metadata.
        const helper = this;
        return listFn(opts)
            .then(function (assetList) {
                const chunkLength = assetList.length;

                // If web assets only, filter out the content assets.
                if (opts && opts[helper.ASSET_TYPES] === helper.ASSET_TYPES_WEB_ASSETS) {
                    assetList = assetList
                        .filter(function (asset) {
                            if (!helper._fsApi.isContentResource(asset)) {
                                return asset;
                            }
                        });
                }

                // If content assets only, filter out the web assets.
                if (opts && opts[helper.ASSET_TYPES] === helper.ASSET_TYPES_CONTENT_ASSETS) {
                    assetList = assetList
                        .filter(function (asset) {
                            if (helper._fsApi.isContentResource(asset))
                                return asset;
                        });
                }

                return {length: chunkLength, assets: assetList};
            });
    }

    /**
     * Recursive function to list subsequent chunks of assets retrieved by the given function.
     *
     * @param {Function} listFn - A function that returns a promise for a chunk of remote assets to be listed.
     * @param {Q.Deferred} deferred - A deferred that will be resolved with *all* assets listed.
     * @param {Array} results - The accumulated results.
     * @param {Object} listInfo - The number of assets listed and an array of listed assets.
     * @param {Object} opts - The options to be used for the list operations.
     *
     * @private
     */
    _recurseList (listFn, deferred, results, listInfo, opts) {
        // If a results array is specified, accumulate the assets listed.
        if (results) {
            results = results.concat(listInfo.assets);
        } else {
            results = listInfo.assets;
        }

        const currentChunkSize = listInfo.length;
        const maxChunkSize = options.getRelevantOption(opts, "limit", "assets", "limit");
        if (currentChunkSize === 0 || currentChunkSize < maxChunkSize) {
            // The current chunk is a partial chunk, so there are no more assets to be retrieved. Resolve the promise
            // with the accumulated results.
            deferred.resolve(results);
        } else {
            // The current chunk is a full chunk, so there may be more assets to retrieve.
            if (opts) {
                // Clone the opts before modifying them, so that the original opts are not affected.
                opts = utils.clone(opts);
            } else {
                opts = {};
            }

            // Increase the offset so that the next chunk of assets will be retrieved.
            const offset = options.getRelevantOption(opts, "offset", "assets", "offset");
            opts.offset = offset +  maxChunkSize;

            // List the next chunk of assets from the content hub.
            const helper = this;
            helper._listAssetChunk(listFn, opts)
                .then(function (listInfo) {
                    helper._recurseList(listFn, deferred, results, listInfo, opts);
                });
        }
    }

    /**
     * Get a list of the names of all remote assets.
     *
     * @param {Object} opts - The options to be used for this operation.
     *
     * @returns {Q.Promise} - A promise for an array of the names of all remote assets.
     */
    listRemoteItemNames (opts) {
        // Create the deferred to be used for recursively retrieving assets.
        const deferred = Q.defer();

        // Recursively call AssetsREST.getItems() to retrieve all of the remote assets.
        const listFn = this._restApi.getItems.bind(this._restApi);

        // Get the first chunk of remote assets, and then recursively retrieve any additional chunks.
        const helper = this;
        helper._listAssetChunk(listFn, opts)
            .then(function (listInfo) {
                // Pass a value of null for results to indicate that we retrieved the first chunk. The deferred will be
                // resolved when all chunks have been retrieved. However, the retrieval process will never reject the
                // deferred, so we have to handle that explicitly.
                helper._recurseList(listFn, deferred, null, listInfo, opts);
            })
            .catch(function (err) {
                // If the list function's promise is rejected, propogate that to the deferred that was returned.
                deferred.reject(err);
            });

        // Return the deferred promise chain.
        return deferred.promise
            .then(function (assets) {
                // Turn the retrieved list of assets (metadata) into a list of asset path values.
                return assets.map(function (asset) {
                    return utils.getRelativePath(helper._fsApi.getAssetsPath(opts), helper._fsApi.getPath(asset.path, opts));
                });
            });
    }

    /**
     * Get a list of the assets that have been modified on the content hub.
     *
     * @param {Array} flags - An array of the state (NEW, DELETED, MODIFIED) of the assets to be included in the list.
     * @param {Object} opts - The options to be used for this operation.
     *
     * @returns {Q.Promise} - A promise for a list of the assets that have been modified on the content hub.
     */
    getModifiedRemoteItems (flags, opts) {
        // Get the local directory to use for comparison, based on the specified options.
        const dir = this._fsApi.getAssetsPath(opts);

        // Recursively call AssetsREST.getModifiedItems() to retrieve the remote assets modified since the last pull.
        const helper = this;
        return helper._restApi.getModifiedItems(helper._getTimestamp(helper._getLastPullTimestamps(opts), opts), opts)
            .then(function (items) {
                // Return a promise for the filtered list of remote modified assets.
                return items.filter(function (item) {
                    try {
                        // Determine whether the remote asset was modified, based on the specified flags.
                        const itemPath = helper._fsApi.getPath(item.path, opts);
                        return hashes.isRemoteModified(flags, item, dir, itemPath, opts);
                    } catch (err) {
                        utils.logErrors(i18n.__("error_filtering_remote_items"), err);
                    }
                });
            });
    }

    /**
     * Get a list of the names of all remote assets that have been modified.
     *
     * @param {Array} flags - An array of the state (NEW, DELETED, MODIFIED) of the assets to be included in the list.
     * @param {Object} opts - The options to be used for this operation.
     *
     * @returns {Q.Promise} - A promise for an array of the names of all remote assets that were modified since being
     *                        pushed/pulled.
     */
    listModifiedRemoteItemNames (flags, opts) {
        const deferred = Q.defer();

        // Use getModifiedRemoteItems() as the list function, so that only modified assets will be pulled.
        const helper = this;
        const listFn = helper.getModifiedRemoteItems.bind(this, flags);
        helper._listAssetChunk(listFn, opts)
            .then(function (listInfo) {
                // There are no results initially, so just pass null for the results. The accumulated array of asset
                // metadata for all listed items will be available when "deferred" has been resolved.
                helper._recurseList(listFn, deferred, null, listInfo, opts);
            })
            .catch(function (err) {
                // There was an error listing the assets.
                deferred.reject(err);
            });

        return deferred.promise
            .then(function (items) {
                // The list results contain the relative path of each modified asset.
                const results = items.map(function (item) {
                    return utils.getRelativePath(helper._fsApi.getAssetsPath(opts), helper._fsApi.getPath(item.path, opts));
                });

                // Add the deleted assets if the flag was specified.
                if (flags.indexOf(helper.DELETED) !== -1) {
                    return helper.listRemoteDeletedNames(opts)
                        .then(function (itemNames) {
                            itemNames.forEach(function (itemName) {
                                results.push(itemName);
                            });
                            return results;
                        });
                } else {
                    return results;
                }
            });
    }

    /**
     * Get a list of the names of all remote assets that have been deleted from the content hub.
     *
     * @param {Object} opts - The options to be used for the list operation.
     *
     * @returns {Q.Promise} - A promise for the names of all remote assets that have been deleted from the content hub.
     */
    listRemoteDeletedNames (opts) {
        const deferred = Q.defer();

        // Get the list of all remote assets.
        const helper = this;
        helper.listRemoteItemNames(opts)
            .then(function (remoteItemPaths) {
                // Get the list of local assets that are known to have existed on the server.
                const dir = helper._fsApi.getAssetsPath(opts);
                const localItemPaths = hashes.listFiles(dir, opts);

                // The deleted assets are the ones that exist in the local list but not in the remote list.
                const deletedNames = localItemPaths
                    .filter(function (path) {
                        return (remoteItemPaths.indexOf(path) === -1);
                    });

                // Resolve with the list of deleted assets.
                deferred.resolve(deletedNames);
            })
            .catch(function (err) {
                // There was an error listing the assets.
                deferred.reject(err);
            });

        return deferred.promise;
    }

    /**
     * Get a list of local asset names, based on the specified options.
     *
     * @param {Object} opts - The options to be used for the list operation.
     *
     * @returns {Q.Promise} A promise for a list of local asset names, based on the specified options.
     */
    listLocalItemNames (opts) {
        // Get the list of asset paths on the local file system.
        const helper = this;
        return this._fsApi.listNames(null, opts)
            .then(function (paths) {
                // Add the local status for each asset and return the original list of paths.
                paths.forEach(function (path) {
                    helper.addLocalStatus(path);
                });
                return paths;
            });
    }

    /**
     * Get a list of modified local asset paths, based on the specified options.
     *
     * @param {Array} flags - An array of the state (NEW, DELETED, MODIFIED) of the assets to be included in the list.
     * @param {Object} opts - The options to be used for the list operation.
     *
     * @returns {Q.Promise} A promise for a list of modified local asset paths, based on the specified options.
     */
    listModifiedLocalItemNames (flags, opts) {
        // Get the list of local asset paths.
        const dir = this._fsApi.getAssetsPath(opts);

        const helper = this;
        return helper._fsApi.listNames(null, opts)
            .then(function (assetPaths) {
                // Filter the list so that it only contains modified asset paths.
                const results = assetPaths
                    .filter(function (assetPath) {
                        const path = helper._fsApi.getPath(assetPath, opts);
                        return hashes.isLocalModified(flags, dir, path, opts);
                    });

                // Add the deleted asset paths if the flag was specified.
                if (flags.indexOf(helper.DELETED) !== -1) {
                    return helper.listLocalDeletedNames(opts)
                        .then(function (assetPaths) {
                            assetPaths.forEach(function (assetPath) {
                                results.push(assetPath);
                            });
                            return results;
                        });
                } else {
                    return results;
                }
            });
    }

    /**
     * Get a list of the names of all local assets that have been deleted.
     *
     * @param {Object} opts - The options to be used for the list operation.
     *
     * @returns {Q.Promise} - A promise for the names of all local assets that have been deleted.
     */
    listLocalDeletedNames (opts) {
        const deferred = Q.defer();

        // Get the list of local asset paths.
        const dir = this._fsApi.getAssetsPath(opts);
        const localAssetPaths = hashes.listFiles(dir, opts);

        // Get the list of deleted local assets.
        const deletedAssetPaths = localAssetPaths
            .filter(function (path) {
                // An asset is considered to be deleted if it's stat cannot be retrieved.
                let stat;
                try {
                    stat = fs.statSync(dir + path);
                } catch (ignore) {
                    // Ignore this error and assume the asset is deleted.
                }
                return !stat;
            });

        // Resolve with the list of deleted asset paths.
        deferred.resolve(deletedAssetPaths);

        return deferred.promise;
    }

    /**
     * Delete the asset with the specified path on the content hub.
     *
     * @param {String} path - An asset path on the content hub.
     * @param {Object} opts - The options to be used for the delete operation.
     *
     * @returns {Q.Promise} A promise that is resolved with a message describing the delete action.
     */
    deleteRemoteItem (path, opts) {
        const helper = this;
        return helper._restApi.getItems(opts)
            .then(function (assets) {
                // Find the specified remote asset.
                return helper._findItemByPath(assets, path, opts);
            })
            .then(function (asset) {
                // The asset was found, so delete it using its ID.
                logger.trace("deleteRemoteItem found asset id: " + asset.id);
                return helper._restApi.deleteItem(asset, opts);
            })
            .then(function (message) {
                // The delete was successful, so resolve the promise with the message returned from the REST service.
                helper._statusTracker.removeStatus(path, StatusTracker.EXISTS_REMOTELY);
                return message;
            });
    }

    /**
     * Find the asset with the given path on the content hub.
     *
     * Note: The asset metadata will be retrieved from the REST service in chunks until the specified asset is found.
     *
     * @param {Array} assets An array of asset metadata objects that have been retrieved from the REST service.
     * @param {String} path The path of the asset to be found.
     * @param {Object} opts The options for the REST service requests.
     *
     * @returns {Q.Promise} A promise for the asset with the given path on the content hub.
     *
     * @private
     */
    _findItemByPath (assets, path, opts) {
        // Find the asset with the specified path in the given array of assets.
        const asset = assets && assets.find(function (asset) {
                // Determine whether the path of the current asset matches the specified path.
                return asset.path === path || asset.path === "/" + path;
            });

        const deferred = Q.defer();
        if (asset) {
            // The asset was found so resolve the promise with that asset.
            deferred.resolve(asset);
        } else {
            // The specified asset was not found.
            const currentChunkSize = assets.length;
            const maxChunkSize = options.getRelevantOption(opts, "limit", "assets", "limit");

            if (currentChunkSize === 0 || currentChunkSize < maxChunkSize) {
                // The current chunk is a partial chunk, so there are no more assets to be retrieved. Reject the promise
                // with an appropriate error.
                deferred.reject(new Error(i18n.__("remote_asset_not_found") + path));
            } else {
                // The current chunk is a full chunk, so there may be more assets to retrieve.
                if (opts) {
                    // Clone the opts before modifying them, so that the original opts are not affected.
                    opts = utils.clone(opts);
                } else {
                    opts = {};
                }

                // Increase the offset so that the next chunk of assets will be retrieved.
                const offset = options.getRelevantOption(opts, "offset", "assets", "offset");
                opts.offset = offset + maxChunkSize;

                // Retrieve the next chunk of assets from the REST service.
                const helper = this;
                helper._restApi.getItems(opts)
                    .then(function (items) {
                        // Recursive call to find the specified asset in the newly retrieved chunk.
                        return helper._findItemByPath(items, path, opts);
                    })
                    .then (function (asset) {
                        // The asset was found, so resolve the promise with it.
                        deferred.resolve(asset);
                    })
                    .catch(function (err) {
                        // There was a problem retrieving the next chunk of assets. Reject the promise with the given error.
                        deferred.reject(err);
                    });
            }
        }

        return deferred.promise;
    }

    /**
     * Returns the last pull timestamps, converting from a single timestamp to the new multi-value timestamp format if needed.
     *
     * @param opts
     *
     * @returns {{webAssets: String | Date, contentAssets: String | Date}}
     */
    _getLastPullTimestamps (opts) {
        const dir = this._fsApi.getAssetsPath(opts);
        const timestamps = hashes.getLastPullTimestamp(dir, opts);
        // create the timestamps object now
        // we use the webAssets and contentAssets children of the timestamps read from .wchtoolshashes if they exist (new format)
        // otherwise fall back to copying the old format (a single timestamp) into each field
        return {
            webAssets: (timestamps ? (timestamps.webAssets ? timestamps.webAssets : (timestamps.contentAssets ? undefined : timestamps)) : undefined),
            contentAssets: (timestamps ? (timestamps.contentAssets ? timestamps.contentAssets : (timestamps.webAssets ? undefined : timestamps)) : undefined)
        };
    }

    /**
     * Returns the last push timestamps, converting from a single timestap to the new multi-value timestamp format if needed.
     *
     * @param opts
     *
     * @returns {{webAssets: String | Date, contentAssets: String | Date}}
     */
    _getLastPushTimestamps (opts) {
        const dir = this._fsApi.getAssetsPath(opts);
        const timestamps = hashes.getLastPushTimestamp(dir, opts);
        // create the timestamps object now
        // we use the webAssets and contentAssets children of the timestamps read from .wchtoolshashes if they exist (new format)
        // otherwise fall back to copying the old format (a single timestamp) into each field
        return {
            webAssets: (timestamps ? (timestamps.webAssets ? timestamps.webAssets : (timestamps.contentAssets ? undefined : timestamps)) : undefined),
            contentAssets: (timestamps ? (timestamps.contentAssets ? timestamps.contentAssets : (timestamps.webAssets ? undefined : timestamps)) : undefined)
        };
    }

    /**
     * Sets the last pull timestamps.
     *
     * @param opts
     */
    _setLastPullTimestamps(opts) {
        const timestamps = this._getLastPullTimestamps(opts);
        if (opts && opts[this.ASSET_TYPES] === this.ASSET_TYPES_WEB_ASSETS) {
            timestamps.webAssets = new Date();
        } else if (opts && opts[this.ASSET_TYPES] === this.ASSET_TYPES_CONTENT_ASSETS) {
            timestamps.contentAssets = new Date();
        } else {
            timestamps.webAssets = timestamps.contentAssets = new Date();
        }
        hashes.setLastPullTimestamp(this._fsApi.getAssetsPath(opts), timestamps, opts);
    }

    /**
     * Sets the last push timestamps.
     *
     * @param opts
     */
    _setLastPushTimestamps (opts) {
        const timestamps = this._getLastPushTimestamps(opts);
        if (opts && opts[this.ASSET_TYPES] === this.ASSET_TYPES_WEB_ASSETS) {
            timestamps.webAssets = new Date();
        } else if (opts && opts[this.ASSET_TYPES] === this.ASSET_TYPES_CONTENT_ASSETS) {
            timestamps.contentAssets = new Date();
        } else {
            timestamps.webAssets = timestamps.contentAssets = new Date();
        }
        hashes.setLastPushTimestamp(this._fsApi.getAssetsPath(opts), timestamps, opts);
    }

    _getTimestamp (timestamps, opts) {
        const webAssetTimestamp = timestamps.webAssets;
        const contentAssetTimestamp = timestamps.contentAssets;
        let timestamp;
        if (opts && opts[this.ASSET_TYPES] === this.ASSET_TYPES_WEB_ASSETS) {
            timestamp = webAssetTimestamp;
        } else if (opts && opts[this.ASSET_TYPES] === this.ASSET_TYPES_CONTENT_ASSETS) {
            timestamp = contentAssetTimestamp;
        } else {
            // calculate the min of both timestamps
            const webAssetDate = new Date(webAssetTimestamp);
            const contentAssetDate = new Date(contentAssetTimestamp);
            if (webAssetDate.valueOf() < contentAssetDate.valueOf()) {
                timestamp = webAssetTimestamp;
            } else {
                timestamp = contentAssetTimestamp;
            }
        }
        return timestamp;
    }

    /**
     * Register the specified asset as being available remotely.
     *
     * @param {Object} asset - An asset that exists remotely.
     *
     * @returns {Object} The asset passed in.
     *
     * @private
     */
    addRemoteStatus (asset) {
        this._statusTracker.addStatus(asset, StatusTracker.EXISTS_REMOTELY);
        return asset;
    }

    /**
     * Register the specified asset as being available locally.
     *
     * @param {Object} asset - An asset that exists locally.
     *
     * @returns {Object} The asset passed in.
     *
     * @private
     */
    addLocalStatus (asset) {
        this._statusTracker.addStatus(asset, StatusTracker.EXISTS_LOCALLY);
        return asset;
    }

    /**
     * Determine whether an asset with the specified path exists on the local file system.
     *
     * @param {String} path - An asset path on the local file system.
     *
     * @returns {Boolean} A return value of true indicates that an asset with the specified path exists on the local file system.
     */
    existsLocally (path) {
        return this._statusTracker.existsLocally({name: path});
    }

    /**
     * Determine whether an asset with the specified path exists on the content hub.
     *
     * @param {String} path - An asset path on the content hub.
     *
     * @returns {Boolean} A return value of true indicates that an asset with the specified path exists on the content hub.
     */
    existsRemotely (path) {
        return this._statusTracker.existsRemotely({name: path});
    }

    /**
     * Reset the helper to its original state.
     *
     * Note: This is mostly useful for testing, so that each test can be sure of the helper's initial state.
     */
    reset () {
        this._statusTracker = new StatusTracker();
        this._eventEmitter = new events.EventEmitter();
    }
}

// Export the AssetsHelper class.
module.exports = AssetsHelper;
