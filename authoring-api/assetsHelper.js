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
const AssetsREST = require("./lib/assetsREST.js");
const assetsREST = AssetsREST.instance;
const SearchREST = require("./lib/authoringSearchREST.js");
const searchREST = SearchREST.instance;
const AssetsFS = require("./lib/assetsFS.js");
const assetsFS = AssetsFS.instance;
const options = require("./lib/utils/options.js");
const utils = require("./lib/utils/utils.js");
const path = require("path");
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

    static get instance () {
        if (!this[singleton]) {
            this[singleton] = new AssetsHelper(singletonEnforcer);
        }
        return this[singleton];
    }

    /**
     * Get the event emitter used by the Assets Helper.
     *
     * @param {Object} context The current context to be used by the API.
     *
     * @returns {Object} The event emitter used by the Assets Helper.
     */
    getEventEmitter (context) {
        return context.eventEmitter;
    }

    /**
     * Get the logger used by the Assets Helper.
     *
     * @param {Object} context The current context to be used by the API.
     *
     * @returns {Object} The logger used by the Assets Helper.
     */
    getLogger (context) {
        return context.logger;
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
    doesDirectoryExist (context, opts) {
        const dir = this._fsApi.getAssetsPath(context, opts);
        return fs.existsSync(dir);
    }

    /**
     * Close the given stream.
     *
     * @param {Object} context The current context to be used by the API.
     * @param {Readable} stream - The stream to be closed.
     * @param {Q.Deferred} [deferred] - The deferred to be resolved when the stream is closed.
     *
     * @private
     */
    _closeStream (context, stream, deferred) {
        if (stream) {
            try {
                // Calling resume causes the stream to read fully to the end.
                stream.resume();
            } catch (err) {
                const logger = this.getLogger(context);
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
     * Pull the specified asset from the content hub.
     *
     * @param {Object} context - The context to be used for the push operation.
     * @param {Object} asset - The asset to be pulled,
     * @param {Object} opts - The options to be used for the pull operation.
     *
     * @returns {Q.Promise} A promise for the pulled asset.
     *
     * @private
     */
    _pullAsset (context, asset, opts) {
        const helper = this;
        const assetPath = helper._fsApi.getAssetPath(asset);
        // Verify the pathname.
        if (!isValidWindowsPathname(assetPath) || hashes.isHashesFile(assetPath)) {
            const deferred = Q.defer();
            deferred.reject(new Error(i18n.__("invalid_path", {path: assetPath})));
            return deferred.promise;
        } else {
            // Get the local file stream to be written.
            return helper._fsApi.getItemWriteStream(context, assetPath, opts)
                .then(function (stream) {
                    // Download the specified asset contents and write them to the given stream.
                    return helper._restApi.pullItem(context, asset, stream, opts)
                        .then(function (asset) {
                            const basePath = helper._fsApi.getAssetsPath(context, opts);
                            const filePath = helper._fsApi.getPath(context, assetPath, opts);

                            const md5 = hashes.generateMD5Hash(filePath);
                            if (!hashes.compareMD5Hashes(md5, asset.digest)) {
                                const err = i18n.__("digest_mismatch", {cli_digest: md5, asset: assetPath, server_digest: asset.digest});
                                const logger = this.getLogger(context);
                                logger.error(err);
                                throw new Error(err);
                            }
                            hashes.updateHashes(context, basePath, filePath, asset, opts);

                            // Notify any listeners that the asset at the given path was pulled.
                            const emitter = helper.getEventEmitter(context);
                            if (emitter) {
                                emitter.emit("pulled", assetPath);
                            }

                            // Save the asset metadata for content resources.
                            let result = asset;
                            if (helper._fsApi.isContentResource(asset)) {
                                result = helper._fsApi.saveItem(context, asset, opts);
                            }
                            return result;
                        });
                });
        }
    }

    /**
     * Pull the chunk of assets retrieved by the given function.
     *
     * @param {Object} context - The context to be used for the push operation.
     * @param {Function} listFn - A function that returns a promise for a chunk of remote assets to be pulled.
     * @param {Object} opts - The options to be used for the pull operations.
     *
     * @returns {Q.Promise} A promise for information about the assets that were pulled.
     *
     * @private
     */
    _pullItemsChunk (context, listFn, opts) {
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
                const concurrentLimit = options.getRelevantOption(context, opts, "concurrent-limit", helper._artifactName);
                const results = utils.throttledAll(context, assetList.map(function (asset) {
                    // Return a function that returns a promise for each asset being pulled.
                    return function () {
                        return helper._pullAsset(context, asset, opts);
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
                                const emitter = helper.getEventEmitter(context);
                                if (emitter) {
                                    emitter.emit("pulled-error", error, helper._fsApi.getAssetPath(assetList[index]));
                                }
                                context.pullErrorCount++;
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
     * @param {Object} context - The context to be used for the push operation.
     * @param {Function} listFn - A function that returns a promise for a chunk of remote assets to be pulled.
     * @param {Q.Deferred} deferred - A deferred that will be resolved with *all* assets pulled.
     * @param {Array} results - The accumulated results.
     * @param {Object} pullInfo - The number of assets processed (either success or failure) and an array of pulled assets.
     * @param {Object} opts - The options to be used for the pull operations.
     *
     * @private
     */
    _recursePull (context, listFn, deferred, results, pullInfo, opts) {
        // If a results array is specified, accumulate the assets pulled.
        if (results) {
            results = results.concat(pullInfo.assets);
        } else {
            results = pullInfo.assets;
        }

        const currentChunkSize = pullInfo.length;
        const maxChunkSize = options.getRelevantOption(context, opts, "limit", this._artifactName);
        if (currentChunkSize === 0 || currentChunkSize < maxChunkSize) {
            // The current chunk is a partial chunk, so there are no more assets to be retrieved. Resolve the promise
            // with the accumulated results.
            deferred.resolve(results);
        } else {
            // The current chunk is a full chunk, so there may be more assets to retrieve.
            const helper = this;

            // Increase the offset so that the next chunk of assets will be retrieved.
            const offset = options.getRelevantOption(context, opts, "offset", helper._artifactName);
            opts = utils.cloneOpts(opts);
            opts.offset = offset +  maxChunkSize;

            // Pull the next chunk of assets from the content hub.
            helper._pullItemsChunk(context, listFn, opts)
                .then(function (pullInfo) {
                    helper._recursePull(context, listFn, deferred, results, pullInfo, opts);
                });
        }
    }

    /**
     * Get the items on the remote content hub.
     *
     * @param {Object} context The API context to be used by the get operation.
     * @param {Object} opts - The options to be used to get the items.
     *
     * @returns {Q.Promise} A promise to get the items on the remote content hub.
     *
     * @resolves {Array} The items on the remote content hub.
     */
    getRemoteItems (context, opts) {
        // Return the REST object's promise to get the remote items.
        return this._restApi.getItems(context, opts);
    }
    
    /**
     * Pull the asset with the specified path from the content hub.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {String} path - The path of the asset to be pulled.
     * @param {Object} opts - The options to be used for the pull operation.
     *
     * @returns {Q.Promise} A promise for the asset that was pulled.
     */
    pullItem (context, path, opts) {
        // The content hub assets API does not support retrieving an item by path. So in order to pull a specific item,
        // get the items from the content hub one chunk at a time, and look for an asset with the specified path.
        const helper = this;
        return this._restApi.getItems(context, opts)
            .then(function (assets) {
                // Find the asset with the specified path.
                return helper._findItemByPath(context, assets, path, opts);
            })
            .then(function (asset) {
                // The asset with the specified path was found, so pull it.
                const logger = helper.getLogger(context);
                logger.trace("Pull found asset: " + path);
                return helper._pullAsset(context, asset, opts);
            })
            .catch(function (err) {
                // The asset with the specified name was not found.
                const logger = helper.getLogger(context);
                logger.trace("Pull could not find asset: " + path);
                throw err;
            });
    }

    /**
     * Pull all assets from the content hub.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} opts - The options to be used for the pull operations.
     *
     * @returns {Q.Promise} A promise for the assets that were pulled.
     */
    pullAllItems (context, opts) {
        const deferred = Q.defer();

        // Use AssetsREST.getItems() as the list function, so that all assets will be pulled.
        const listFn = this._restApi.getItems.bind(this._restApi, context);
        const helper = this;

        // Keep track of the error count.
        context.pullErrorCount = 0;

        helper._pullItemsChunk(context, listFn, opts)
            .then(function (pullInfo) {
                // There are no results initially, so just pass null for the results. The accumulated array of asset
                // metadata for all pulled items will be available when "deferred" has been resolved.
                helper._recursePull(context, listFn, deferred, null, pullInfo, opts);
            })
            .catch(function (err) {
                // There was a fatal issue, beyond a failure to pull one or more items.
                deferred.reject(err);
            });

        // Handle any necessary actions once the pull operations have completed.
        return deferred.promise
            .then(function (items) {
                if (context.pullErrorCount === 0) {
                    // Only update the last pull timestamp if there were no pull errors.
                    helper._setLastPullTimestamps(context, opts);
                }
                return items;
            })
            .finally(function () {
                delete context.pullErrorCount;
            });
    }

    /**
     * Pull all assets that have been modified on the content hub since the last pull.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} opts - The options to be used for the pull operations.
     *
     * @returns {Q.Promise} A promise for the assets that were pulled.
     */
    pullModifiedItems (context, opts) {
        const deferred = Q.defer();

        // Use getModifiedRemoteItems() as the list function, so that only new and modified assets will be pulled.
        const listFn = this.getModifiedRemoteItems.bind(this, context, [this.NEW, this.MODIFIED]);
        const helper = this;

        // Keep track of the error count.
        context.pullErrorCount = 0;

        helper._pullItemsChunk(context, listFn, opts)
            .then(function (pullInfo) {
                // There are no results initially, so just pass null for the results. The accumulated array of asset
                // metadata for all pulled items will be available when "deferred" has been resolved.
                helper._recursePull(context, listFn, deferred, null, pullInfo, opts);
            })
            .catch(function (err) {
                // There was a fatal issue, beyond a failure to pull one or more items.
                deferred.reject(err);
            });

        // Handle any necessary actions once the pull operations have completed.
        return deferred.promise
            .then(function (items) {
                if (context.pullErrorCount === 0) {
                    // Only update the last pull timestamp if there were no pull errors.
                    helper._setLastPullTimestamps(context, opts);
                }
                return items;
            })
            .finally(function () {
                delete context.pullErrorCount;
            });
    }

    /**
     * Push the items with the given paths.
     *
     * @param {Object} context - The context to be used for the push operation.
     * @param {Array} paths - The paths of the items to be pushed.
     * @param {Object} opts - The options to be used for the push operations.
     *
     * @returns {Q.Promise} A promise for the items that were pushed.
     *
     * @protected
     */
    _pushNameList (context, paths, opts) {
        const helper = this;

        // Push ready assets and draft assets in separate batches.
        const drafts = [];
        paths = paths.filter(function (path) {
            if (helper._fsApi.isDraftAsset(path)) {
                drafts.push(path);
            } else {
                return path;
            }
        });

        // Throttle the number of assets to be pushed concurrently, using the currently configured limit.
        const concurrentLimit = options.getRelevantOption(context, opts, "concurrent-limit", helper._artifactName);
        const readyResults = utils.throttledAll(context, paths.map(function (name) {
            return function () {
                return helper.pushItem(context, name, opts);
            };
        }), concurrentLimit);

        let results = readyResults;
        if (drafts.length > 0) {
            // Wait for the ready assets to be done, then push the batch of draft assets.
            const deferred = Q.defer();
            results = deferred.promise;
            readyResults.then(function (readyPromises) {
                const draftResults = utils.throttledAll(context, drafts.map(function (name) {
                    return function () {
                        return helper.pushItem(context, name, opts);
                    };
                }), concurrentLimit);
                draftResults.then(function (draftPromises) {
                    deferred.resolve(readyPromises.concat(draftPromises));
                });
            });
        }

        // Return the promise to push all of the specified assets.
        let errorCount = 0;
        return results
            .then(function (promises) {
                // Keep track of the assets that were successfully pushed, and emit a "pushed-error" event for the others.
                const assets = [];
                promises.forEach(function (promise) {
                    if (promise.state === "fulfilled") {
                        assets.push(promise.value);
                    }
                    else {
                        // Rejected promises are logged by throttledAll(), so just determine the error count.
                        errorCount++;
                    }
                });
                return assets;
            })
            .then(function (assets) {
                // Keep track of the timestamp of this operation, but only if there were no errors.
                if (errorCount === 0) {
                    helper._setLastPushTimestamps(context, opts);
                }
                return assets;
            });
    }

    /**
     * Push the asset with the specified path to the content hub.
     *
     * @param {Object} context - The context to be used for the push operation.
     * @param {String} path - The path of the asset to be pushed.
     * @param {Object} opts - The options to be used for the push operation.
     *
     * @returns {Q.Promise} A promise for the metadata of the asset that was pushed.
     */
    pushItem (context, path, opts) {
        const deferred = Q.defer();

        // Begin the push process by determining the content length of the specified local file.
        const helper = this;
        helper._fsApi.getContentLength(context, path, opts)
            .then(function (length) {
                // Get the resource ID and the MD5 hash for the specified local asset file from the local hashes.
                const assetFile = helper._fsApi.getPath(context, path, opts);
                const assetHashesMD5 = hashes.getMD5ForFile(context, helper._fsApi.getAssetsPath(context, opts), assetFile, opts);
                const isContentResource = helper._fsApi.isContentResource(path);
                let resourceId;
                let resourceMd5 = assetHashesMD5;

                // In order to push the asset to the content hub, open a read stream for the asset file.
                let streamOpened;
                if (isContentResource && fs.existsSync(helper._fsApi.getMetadataPath(context, path, opts))) {
                    // There is a metadata file for the content asset, so start by reading the metadata file.
                    streamOpened = helper._fsApi.getItem(context, path, opts)
                        .then(function (asset) {
                            // Get the resource ID and the MD5 hash if they aren't already defined.
                            resourceId = resourceId || asset.resource;
                            resourceMd5 = resourceMd5 || hashes.generateMD5Hash(assetFile);

                            // Keep track of the asset metadata.
                            opts = utils.cloneOpts(opts);
                            opts.asset = asset;

                            // Open a read stream for the actual asset file (not the metadata file).
                            return helper._fsApi.getItemReadStream(context, path, opts);
                        })
                        .catch(function (err) {
                            // Reject the top-level promise.
                            deferred.reject(err);
                        });
                } else {
                    // There is no metadata file, so open a read stream for the asset file.
                    streamOpened = helper._fsApi.getItemReadStream(context, path, opts);
                }

                streamOpened
                    .then(function (readStream) {
                        // Create a promise that will be resolved when the read stream is closed.
                        const streamClosed = Q.defer();
                        readStream.on("close", function () {
                            streamClosed.resolve(path);
                        });

                        // Determine how to set replaceContentReource - if the saved md5 doesn't match the md5 of the resource
                        const replaceContentResource = (resourceMd5 !== hashes.generateMD5Hash(assetFile));

                        // Push the asset to the content hub.
                        helper._restApi.pushItem(context, isContentResource, replaceContentResource, resourceId, resourceMd5, path, readStream, length, opts)
                            .then(function (asset) {
                                // Save the asset metadata to a local file.
                                const rewriteOnPush = options.getRelevantOption(context, opts, "rewriteOnPush");
                                if (isContentResource && rewriteOnPush) {
                                    // Don't wait for the metadata to be saved, and don't reject the push if the save fails.
                                    helper._fsApi.saveItem(context, asset, opts);
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
                                const assetPath = helper._fsApi.getPath(context, helper._fsApi.getAssetPath(asset), opts);
                                hashes.updateHashes(context, helper._fsApi.getAssetsPath(context, opts), assetPath, asset, opts);

                                // The push succeeded so emit a "pushed" event.
                                const emitter = helper.getEventEmitter(context);
                                if (emitter) {
                                    emitter.emit("pushed", path);
                                }
                            })
                            .catch(function (err) {
                                // Failed to push the asset file, so explicitly close the read stream.
                                helper._closeStream(context, readStream, streamClosed);

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

                                // The push failed so emit a "pushed-error" event.
                                const emitter = helper.getEventEmitter(context);
                                if (emitter) {
                                    emitter.emit("pushed-error", err, path);
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
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} opts - The options to be used for the push operation.
     *
     * @returns {Q.Promise} A promise for the list of assets that were successfully pushed.
     */
    pushAllItems (context, opts) {
        // Get the list of local assets, based on the specified options.
        const helper = this;
        return helper.listLocalItemNames(context, opts)
            .then(function (names){
                // Push the assets in the list.
                return helper._pushNameList(context, names, opts);
            });
    }

    /**
     * Push modified local assets to the content hub.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} opts - The options to be used for the push operation.
     *
     * @returns {Q.Promise} A promise for the list of modified assets that were successfully pushed.
     */
    pushModifiedItems (context, opts) {
        // Get the list of modified local assets, based on the specified options.
        const helper = this;
        return helper.listModifiedLocalItemNames(context, [this.NEW, this.MODIFIED], opts)
            .then(function (names){
                // Push the assets in the list.
                return helper._pushNameList(context, names, opts);
            });
    }

    /**
     * List the chunk of assets retrieved by the given function.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Function} listFn - A function that returns a promise for a chunk of remote assets to be listed.
     * @param {Object} opts - The options to be used for the list operations.
     *
     * @returns {Q.Promise} A promise for information about the assets that were listed.
     *
     * @private
     */
    _listAssetChunk (context, listFn, opts) {
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
     * @param {Object} context The API context to be used for this operation.
     * @param {Function} listFn - A function that returns a promise for a chunk of remote assets to be listed.
     * @param {Q.Deferred} deferred - A deferred that will be resolved with *all* assets listed.
     * @param {Array} results - The accumulated results.
     * @param {Object} listInfo - The number of assets listed and an array of listed assets.
     * @param {Object} opts - The options to be used for the list operations.
     *
     * @private
     */
    _recurseList (context, listFn, deferred, results, listInfo, opts) {
        // If a results array is specified, accumulate the assets listed.
        if (results) {
            results = results.concat(listInfo.assets);
        } else {
            results = listInfo.assets;
        }

        const currentChunkSize = listInfo.length;
        const maxChunkSize = options.getRelevantOption(context, opts, "limit", this._artifactName);
        if (currentChunkSize === 0 || currentChunkSize < maxChunkSize) {
            // The current chunk is a partial chunk, so there are no more assets to be retrieved. Resolve the promise
            // with the accumulated results.
            deferred.resolve(results);
        } else {
            // The current chunk is a full chunk, so there may be more assets to retrieve.
            const helper = this;

            // Increase the offset so that the next chunk of assets will be retrieved.
            const offset = options.getRelevantOption(context, opts, "offset", helper._artifactName);
            opts = utils.cloneOpts(opts);
            opts.offset = offset +  maxChunkSize;

            // List the next chunk of assets from the content hub.
            helper._listAssetChunk(context, listFn, opts)
                .then(function (listInfo) {
                    helper._recurseList(context, listFn, deferred, results, listInfo, opts);
                });
        }
    }

    /**
     * Determine whether the helper supports deleting items by id.
     */
    supportsDeleteById () {
        return false;
    }

    /**
     * Determine whether the helper supports deleting items by path.
     */
    supportsDeleteByPath () {
        return false;
    }

    /**
     * Determine whether the helper supports deleting items recursively by path.
     */
    supportsDeleteByPathRecursive () {
        return true;
    }

    searchRemote (context, path, recursive, searchOptions, opts) {
        const deferred = Q.defer();

        if (!searchOptions) {
            searchOptions = {};
        }
        if (!searchOptions["q"]) {
            searchOptions["q"] = "*:*";
        }
        if (!searchOptions["fl"]) {
            searchOptions["fl"] = [];
        } else if (!Array.isArray(searchOptions["fl"])) {
            searchOptions["fl"] = [searchOptions["fl"]];
        }
        if (searchOptions["fl"].length === 0) {
            searchOptions["fl"].push("*");
        } else {
            // always make sure id, path and document are present in the results
            if (searchOptions["fl"].indexOf("id") === -1) {
                searchOptions["fl"].push("id");
            }
            if (searchOptions["fl"].indexOf("path") === -1) {
                searchOptions["fl"].push("path");
            }
            if (searchOptions["fl"].indexOf("document") === -1) {
                searchOptions["fl"].push("document");
            }
        }
        if (!searchOptions["fq"]) {
            searchOptions["fq"] = [];
        } else if (!Array.isArray(searchOptions["fq"])) {
            searchOptions["fq"] = [searchOptions["fq"]];
        }
        searchOptions["fq"].push("classification:asset");
        if (opts && opts[this.ASSET_TYPES] === this.ASSET_TYPES_WEB_ASSETS) {
            searchOptions["fq"].push("isManaged:false");
        } else if (opts && opts[this.ASSET_TYPES] === this.ASSET_TYPES_CONTENT_ASSETS) {
            searchOptions["fq"].push("isManaged:true");
        }
        if (path.charAt(0) !== '/') {
            path = "/" + path;
        }
        // '/' needs to be escaped with \\/ in the search path
        let searchPath = path.replace(/\//g, "\\/");
        // always make sure the search path terminates with '*' so we can do our own additional filtering with the recursive flag later
        if (!searchPath.endsWith('*')) {
            searchPath += "*";
        }
        searchOptions["fq"].push("path:" + searchPath);

        // define a list function to work with the _listAssetChunk/_recurseList methods for handling paging
        const listFn = function(opts) {
            const listFnDeferred = Q.defer();
            searchREST.search(context, searchOptions, opts)
                .then(function (results) {
                    if (!results.documents) {
                        results.documents = [];
                    }
                    listFnDeferred.resolve(results.documents.map(function (result) {
                        return JSON.parse(result.document);
                    }));
                })
                .catch(function (err) {
                    listFnDeferred.reject(err);
                });
            return listFnDeferred.promise;
        };

        // get the offset/limit for the search service from the configured options
        const searchServiceName = searchREST.getServiceName();
        const offset = options.getRelevantOption(context, opts, "offset", searchServiceName);
        const limit = options.getRelevantOption(context, opts, "limit",  searchServiceName);

        // set the search service's offset/limit values on a clone of the opts
        opts = utils.cloneOpts(opts);
        opts.offset = offset;
        opts.limit = limit;

        // Get the first chunk of search results, and then recursively retrieve any additional chunks.
        const helper = this;
        helper._listAssetChunk(context, listFn, opts)
            .then(function (listInfo) {
                // Pass a value of null for results to indicate that we retrieved the first chunk. The deferred will be
                // resolved when all chunks have been retrieved. However, the retrieval process will never reject the
                // deferred, so we have to handle that explicitly.
                helper._recurseList(context, listFn, deferred, null, listInfo, opts);
            })
            .catch(function (err) {
                // If the list function's promise is rejected, propogate that to the deferred that was returned.
                deferred.reject(err);
            });

        return deferred.promise.then(function (results) {
            // strip off any trailing '*' from the user provided path; we'll examine the remaining path independently
            const searchPath = path.endsWith('*') ? path.substring(0, path.length - 1) : path;
            // construct a regular expression replacing '*' with an expression to match any character except a path separator ('/')
            // replace '.' with an expression that explicitly matches '.'
            const regex = searchPath.replace(/\*/g, "(\[^\\/\]*)").replace(/\./g, "\[.\]");

            // filter the search results based on the path searched for and the recursive flag
            return results.filter(function (result) {
                let keepResult = false;
                const assetPath = helper._fsApi.getAssetPath(result);
                const match = assetPath.match(regex);
                // make sure the regex matches - the search will return case-insensitive results
                if (match && match.length === 1) {
                    // get the remaining path after the portion that was matched
                    const subPath = assetPath.substring(match[0].length);

                    // find the index of the first '/' in the sub path
                    const slashIndex = subPath.indexOf('/');
                    if (recursive) {
                        if (path.endsWith('*')) {
                            // recursive search and user's search path end with '*' matches everything
                            keepResult = true;
                        } else {
                            // matches a descendant (recursive) of a fully specified folder (subPath must start with '/') or a single file exactly (subPath length must be 0)
                            keepResult = (slashIndex === 0 || subPath.length === 0);
                        }
                    } else {
                        // find the position of the next folder separator character
                        const nextSlashIndex = subPath.indexOf('/', slashIndex + 1);
                        if (path.endsWith('*')) {
                            // matches an immediate child of a fully specified folder (subPath must start with '/' and subPath must not contain any additional '/' chars)
                            keepResult = ((slashIndex === 0 && nextSlashIndex === -1) || slashIndex === -1);
                        } else {
                            // matches an immediate child of a fully specified folder (subPath must start with '/' and subPath must not contain any additional '/' chars) or a single file exactly (subPath length must be 0)
                            keepResult = ((slashIndex === 0 && nextSlashIndex === -1) || subPath.length === 0);
                        }
                    }
                }
                return keepResult;
            });
        });
    }

    /**
     * Get a list of the names of all remote assets.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} opts - The options to be used for this operation.
     *
     * @returns {Q.Promise} - A promise for an array of the names of all remote assets.
     */
    listRemoteItemNames (context, opts) {
        // Create the deferred to be used for recursively retrieving assets.
        const deferred = Q.defer();

        // Recursively call AssetsREST.getItems() to retrieve all of the remote assets.
        const listFn = this._restApi.getItems.bind(this._restApi, context);

        // Get the first chunk of remote assets, and then recursively retrieve any additional chunks.
        const helper = this;
        helper._listAssetChunk(context, listFn, opts)
            .then(function (listInfo) {
                // Pass a value of null for results to indicate that we retrieved the first chunk. The deferred will be
                // resolved when all chunks have been retrieved. However, the retrieval process will never reject the
                // deferred, so we have to handle that explicitly.
                helper._recurseList(context, listFn, deferred, null, listInfo, opts);
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
                    return helper._fsApi.getAssetPath(asset);
                });
            });
    }

    /**
     * Get a list of the assets that have been modified on the content hub.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Array} flags - An array of the state (NEW, DELETED, MODIFIED) of the assets to be included in the list.
     * @param {Object} opts - The options to be used for this operation.
     *
     * @returns {Q.Promise} - A promise for a list of the assets that have been modified on the content hub.
     */
    getModifiedRemoteItems (context, flags, opts) {
        // Get the local directory to use for comparison, based on the specified options.
        const dir = this._fsApi.getAssetsPath(context, opts);

        // Recursively call AssetsREST.getModifiedItems() to retrieve the remote assets modified since the last pull.
        const helper = this;
        const lastPullTimestamps = helper._getLastPullTimestamps(context, opts);
        const lastPullTimestamp = helper._getTimestamp(lastPullTimestamps, opts);
        return helper._restApi.getModifiedItems(context, lastPullTimestamp, opts)
            .then(function (items) {
                // Return a promise for the filtered list of remote modified assets.
                return items.filter(function (item) {
                    try {
                        // Determine whether the remote asset was modified, based on the specified flags.
                        const itemPath = helper._fsApi.getPath(context, helper._fsApi.getAssetPath(item), opts);
                        return hashes.isRemoteModified(context, flags, item, dir, itemPath, opts);
                    } catch (err) {
                        utils.logErrors(context, i18n.__("error_filtering_remote_items"), err);
                    }
                });
            });
    }

    /**
     * Get a list of the names of all remote assets that have been modified.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Array} flags - An array of the state (NEW, DELETED, MODIFIED) of the assets to be included in the list.
     * @param {Object} opts - The options to be used for this operation.
     *
     * @returns {Q.Promise} - A promise for an array of the names of all remote assets that were modified since being
     *                        pushed/pulled.
     */
    listModifiedRemoteItemNames (context, flags, opts) {
        const deferred = Q.defer();

        // Use getModifiedRemoteItems() as the list function, so that only modified assets will be pulled.
        const helper = this;
        const listFn = helper.getModifiedRemoteItems.bind(this, context, flags);
        helper._listAssetChunk(context, listFn, opts)
            .then(function (listInfo) {
                // There are no results initially, so just pass null for the results. The accumulated array of asset
                // metadata for all listed items will be available when "deferred" has been resolved.
                helper._recurseList(context, listFn, deferred, null, listInfo, opts);
            })
            .catch(function (err) {
                // There was an error listing the assets.
                deferred.reject(err);
            });

        return deferred.promise
            .then(function (items) {
                // The list results contain the path of each modified asset.
                const results = items.map(function (item) {
                    return helper._fsApi.getAssetPath(item);
                });

                // Add the deleted assets if the flag was specified.
                if (flags.indexOf(helper.DELETED) !== -1) {
                    return helper.listRemoteDeletedNames(context, opts)
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
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} opts - The options to be used for the list operation.
     *
     * @returns {Q.Promise} - A promise for the names of all remote assets that have been deleted from the content hub.
     */
    listRemoteDeletedNames (context, opts) {
        const deferred = Q.defer();

        // Get the list of all remote assets.
        const helper = this;
        helper.listRemoteItemNames(context, opts)
            .then(function (remoteItemPaths) {
                // Get the list of local assets that are known to have existed on the server.
                const dir = helper._fsApi.getAssetsPath(context, opts);
                const localItemPaths = hashes.listFiles(context, dir, opts);

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
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} opts - The options to be used for the list operation.
     *
     * @returns {Q.Promise} A promise for a list of local asset names, based on the specified options.
     */
    listLocalItemNames (context, opts) {
        // Get the list of asset paths on the local file system.
        return this._fsApi.listNames(context, null, opts);
    }

    /**
     * Get a list of modified local asset paths, based on the specified options.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Array} flags - An array of the state (NEW, DELETED, MODIFIED) of the assets to be included in the list.
     * @param {Object} opts - The options to be used for the list operation.
     *
     * @returns {Q.Promise} A promise for a list of modified local asset paths, based on the specified options.
     */
    listModifiedLocalItemNames (context, flags, opts) {
        // Get the list of local asset paths.
        const dir = this._fsApi.getAssetsPath(context, opts);

        const helper = this;
        return helper._fsApi.listNames(context, null, opts)
            .then(function (assetPaths) {
                // Filter the list so that it only contains modified asset paths.
                const results = assetPaths
                    .filter(function (assetPath) {
                        const path = helper._fsApi.getPath(context, assetPath, opts);
                        return hashes.isLocalModified(context, flags, dir, path, opts);
                    });

                // Add the deleted asset paths if the flag was specified.
                if (flags.indexOf(helper.DELETED) !== -1) {
                    return helper.listLocalDeletedNames(context, opts)
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
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} opts - The options to be used for the list operation.
     *
     * @returns {Q.Promise} - A promise for the names of all local assets that have been deleted.
     */
    listLocalDeletedNames (context, opts) {
        const deferred = Q.defer();

        // Get the list of local asset paths.
        const dir = this._fsApi.getAssetsPath(context, opts);
        const localAssetPaths = hashes.listFiles(context, dir, opts);

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
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} asset - An asset on the content hub.
     * @param {Object} opts - The options to be used for the delete operation.
     *
     * @returns {Q.Promise} A promise that is resolved with a message describing the delete action.
     */
    deleteRemoteItem (context, asset, opts) {
        const helper = this;
        return helper._restApi.deleteItem(context, asset, opts)
            .then(function (message) {
                // The delete was successful, so update the hashes.
                const basePath = helper._fsApi.getAssetsPath(context, opts);
                hashes.removeHashes(context, basePath, [asset.id], opts);

                // Resolve the promise with the message returned from the REST service.
                return message;
            })
    }

    /**
     * Find the asset with the given path on the content hub.
     *
     * Note: The asset metadata will be retrieved from the REST service in chunks until the specified asset is found.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Array} assets An array of asset metadata objects that have been retrieved from the REST service.
     * @param {String} path The path of the asset to be found.
     * @param {Object} opts The options for the REST service requests.
     *
     * @returns {Q.Promise} A promise for the asset with the given path on the content hub.
     *
     * @private
     */
    _findItemByPath (context, assets, path, opts) {
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
            const maxChunkSize = options.getRelevantOption(context, opts, "limit", this._artifactName);

            if (currentChunkSize === 0 || currentChunkSize < maxChunkSize) {
                // The current chunk is a partial chunk, so there are no more assets to be retrieved. Reject the promise
                // with an appropriate error.
                deferred.reject(new Error(i18n.__("remote_asset_not_found") + path));
            } else {
                // The current chunk is a full chunk, so there may be more assets to retrieve.
                const helper = this;

                // Increase the offset so that the next chunk of assets will be retrieved.
                const offset = options.getRelevantOption(context, opts, "offset", this._artifactName);
                opts = utils.cloneOpts(opts);
                opts.offset = offset + maxChunkSize;

                // Retrieve the next chunk of assets from the REST service.
                helper._restApi.getItems(context, opts)
                    .then(function (items) {
                        // Recursive call to find the specified asset in the newly retrieved chunk.
                        return helper._findItemByPath(context, items, path, opts);
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
     * @param {Object} context The API context to be used for this operation.
     * @param opts
     *
     * @returns {{webAssets: String | Date, contentAssets: String | Date}}
     */
    _getLastPullTimestamps (context, opts) {
        const dir = this._fsApi.getAssetsPath(context, opts);
        const timestamps = hashes.getLastPullTimestamp(context, dir, opts);
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
     * @param {Object} context The API context to be used for this operation.
     * @param opts
     *
     * @returns {{webAssets: String | Date, contentAssets: String | Date}}
     */
    _getLastPushTimestamps (context, opts) {
        const dir = this._fsApi.getAssetsPath(context, opts);
        const timestamps = hashes.getLastPushTimestamp(context, dir, opts);
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
     * @param {Object} context The API context to be used for this operation.
     * @param opts
     */
    _setLastPullTimestamps (context, opts) {
        const timestamps = this._getLastPullTimestamps(context, opts);
        if (opts && opts[this.ASSET_TYPES] === this.ASSET_TYPES_WEB_ASSETS) {
            timestamps.webAssets = new Date();
        } else if (opts && opts[this.ASSET_TYPES] === this.ASSET_TYPES_CONTENT_ASSETS) {
            timestamps.contentAssets = new Date();
        } else {
            timestamps.webAssets = timestamps.contentAssets = new Date();
        }
        hashes.setLastPullTimestamp(context, this._fsApi.getAssetsPath(context, opts), timestamps, opts);
    }

    /**
     * Sets the last push timestamps.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param opts
     */
    _setLastPushTimestamps (context, opts) {
        const timestamps = this._getLastPushTimestamps(context, opts);
        if (opts && opts[this.ASSET_TYPES] === this.ASSET_TYPES_WEB_ASSETS) {
            timestamps.webAssets = new Date();
        } else if (opts && opts[this.ASSET_TYPES] === this.ASSET_TYPES_CONTENT_ASSETS) {
            timestamps.contentAssets = new Date();
        } else {
            timestamps.webAssets = timestamps.contentAssets = new Date();
        }
        hashes.setLastPushTimestamp(context, this._fsApi.getAssetsPath(context, opts), timestamps, opts);
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
     * Reset the helper to its original state.
     *
     * Note: This is mostly useful for testing, so that each test can be sure of the helper's initial state.
     */
    reset () {
    }
}

// Export the AssetsHelper class.
module.exports = AssetsHelper;
