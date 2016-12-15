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
const Q = require("q");
const events = require("events");
const assetsREST = require("./lib/assetsREST.js").instance;
const AssetsFS = require("./lib/assetsFS.js");
const assetsFS = AssetsFS.instance;
const options = require("./lib/utils/options.js");
const StatusTracker = require("./lib/utils/statusTracker.js");
const utils = require("./lib/utils/utils.js");
const path = require("path");
const logger = utils.getLogger(utils.apisLog);
const hashes = require("./lib/utils/hashes.js");
const i18n = utils.getI18N(__dirname, ".json", "en");

// Define the constants for differentiating between web assets and content assets.
const ASSET_TYPES_WEB_ASSETS = AssetsFS.ASSET_TYPES_WEB_ASSETS;
const ASSET_TYPES_CONTENT_ASSETS = AssetsFS.ASSET_TYPES_CONTENT_ASSETS;
const ASSET_TYPES_BOTH = AssetsFS.ASSET_TYPES_BOTH;
const ASSET_TYPES = AssetsFS.ASSET_TYPES;

/**
 * Flag used to determine whether to wait for the file stream to be closed before settling the promise to push an asset.
 *
 * @type Boolean
 *
 * @private
 */
const WAIT_FOR_CLOSE = process.env.WCHTOOLS_WAIT_FOR_CLOSE || false;

/**
 * A utility object used to keep track of whether files exist locally and/or remotely.
 *
 * @type Object
 *
 * @private
 */
let statusTracker = new StatusTracker();

/**
 * An event emitter that can be used to listen for success and failure events when pushing and pulling assets.
 *
 * @type Object
 *
 * @private
 */
let eventEmitter = new events.EventEmitter();

/**
 * Register the specified asset as being available remotely.
 *
 * @param {Object} asset - An asset that exists remotely.
 *
 * @returns {Object} The asset passed in.
 *
 * @private
 */
const addRemoteStatus = function (asset) {
    statusTracker.addStatus(asset, StatusTracker.EXISTS_REMOTELY);
    return asset;
};

/**
 * Register the specified asset as being available locally.
 *
 * @param {Object} asset - An asset that exists locally.
 *
 * @returns {Object} The asset passed in.
 *
 * @private
 */
const addLocalStatus = function (asset) {
    statusTracker.addStatus(asset, StatusTracker.EXISTS_LOCALLY);
    return asset;
};

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
const findItemByPath = function (assets, path, opts){
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
            assetsREST.getItems(opts)
                .then(function (items) {
                    // Recursive call to find the specified asset in the newly retrieved chunk.
                    return findItemByPath(items, path, opts);
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
};

/**
 * Push the specified assets to the content hub.
 *
 * @param {Array} assetPaths - An array of local file path values for the assets to be pushed.
 * @param {Object} opts The options to be used for the push operations.
 *
 * @returns {Q.Promise} A promise for the list of assets that were successfully pushed.
 *
 * @private
 */
const pushAssets = function (assetPaths, opts) {
    // Throttle the number of assets to be pushed concurrently, using the currently configured limit.
    const concurrentLimit = options.getRelevantOption(opts, "concurrent-limit", "assets", "concurrent-limit");
    const results = utils.throttledAll(assetPaths.map(function (name) {
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
            promises.forEach(function (promise) {
                if (promise.state === "fulfilled") {
                    logger.trace("Pushed: " + JSON.stringify(promise.value));
                    assets.push(promise.value);
                }
                else {

                    // Rejected promises are logged by throttledAll(), so just emit the error event.
                    eventEmitter.emit("pushed-error", promise.reason);
                    errorCount++;
                }
            });
            return assets;
        })
        .then(function (assets) {
            // Keep track of the timestamp of this operation, but only if there were no errors.
            if (errorCount === 0) {
                hashes.setLastPushTimestamp(assetsFS.getDir(opts), new Date(), opts);
            }
            return assets;
        });
};

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
const pullAsset = function (asset, opts) {
    // Verify the pathname.
    if (!isValidWindowsPathname(asset.path) || asset.path === ".dxhashes" || asset.path === "/.dxhashes") {
        const deferred = Q.defer();
        deferred.reject(new Error(i18n.__("invalid_path", {path: asset.path})));
        return deferred.promise;
    } else {
        // Get the local file stream to be written.
        return assetsFS.getItemWriteStream(asset.path, opts)
            .then(function (stream) {
                // Download the specified asset contents and write them to the given stream.
                return assetsREST.pullItem(asset, stream, opts)
                    .then(function (asset) {
                        const basePath = assetsFS.getDir(opts);
                        const filePath = assetsFS.getPath(asset.path, opts);
                        hashes.updateHashes(basePath, filePath, asset, opts);

                        // Notify any listeners that the asset at the given path was pulled.
                        eventEmitter.emit("pulled", asset.path);

                        // The specified asset exists both remotely and locally.
                        addRemoteStatus(asset.path);
                        addLocalStatus(asset.path);

                        // Save the asset metadata for content resources.
                        let result = asset;
                        if (assetsFS.isContentResource(asset)) {
                            result = assetsFS.saveItem(asset, opts);
                        }
                        return result;
                    });
            });
    }
};

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
const pullAssetChunk = function (listFn, opts) {
    // Get the next "chunk" of assets metadata from the content hub.
    return listFn(opts)
        .then(function (assetList) {
            const listLength = assetList.length;

            // Filter the asset list based on the type of assets specified by the options.
            if (opts && opts[ASSET_TYPES] === ASSET_TYPES_WEB_ASSETS) {
                // Filter out any content assets.
                assetList = assetList.filter(function (asset) {
                    if (!assetsFS.isContentResource(asset)) {
                        return asset;
                    }
                });
            } else if (opts && opts[ASSET_TYPES] === ASSET_TYPES_CONTENT_ASSETS) {
                // Filter out any web assets.
                assetList = assetList.filter(function (asset) {
                    if (assetsFS.isContentResource(asset)) {
                        return asset;
                    }
                });
            }

            // Throttle the number of assets to be pulled concurrently, using the currently configured limit.
            const concurrentLimit = options.getRelevantOption(opts, "concurrent-limit", "assets", "concurrent-limit");
            const results = utils.throttledAll(assetList.map(function (asset) {
                // Return a function that returns a promise for each asset being pulled.
                return function () {
                    return pullAsset(asset, opts);
                };
            }), concurrentLimit);

            // Return the promise to pull all of the specified assets.
            return results
                .then(function (promises) {
                    // Return a list of results - asset metadata for a fulfilled promise, error for a rejected promise.
                    const assets = [];
                    promises.forEach(function (promise) {
                        if (promise.state === "fulfilled") {
                            const asset = promise.value;
                            assets.push(asset);
                        }
                        else {
                            const error = promise.reason;
                            assets.push(error);
                            eventEmitter.emit("pulled-error", error);
                        }
                    });

                    // Return the number of assets processed (either success or failure) and an array of pulled assets.
                    return {length: listLength, assets: assets};
                });
        });
};

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
const recursePull = function (listFn, deferred, results, pullInfo, opts) {
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
        pullAssetChunk(listFn, opts)
            .then(function (pullInfo) {
                recursePull(listFn, deferred, results, pullInfo, opts);
            });
    }
};

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
const listAssetChunk = function (listFn, opts) {
    // Get the next "chunk" of assets metadata.
    return listFn(opts)
        .then(function (assetList) {
            const chunkLength = assetList.length;

            // If web assets only, filter out the content assets.
            if (opts && opts[ASSET_TYPES] === ASSET_TYPES_WEB_ASSETS) {
                assetList = assetList
                    .filter(function (asset) {
                        if (!assetsFS.isContentResource(asset)) {
                            return asset;
                        }
                    });
            }

            // If content assets only, filter out the web assets.
            if (opts && opts[ASSET_TYPES] === ASSET_TYPES_CONTENT_ASSETS) {
                assetList = assetList
                    .filter(function (asset) {
                        if (assetsFS.isContentResource(asset))
                            return asset;
                    });
            }

            return {length: chunkLength, assets: assetList};
        });
};

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
const recurseList = function (listFn, deferred, results, listInfo, opts) {
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
        listAssetChunk(listFn, opts)
            .then(function (listInfo) {
                recurseList(listFn, deferred, results, listInfo, opts);
            });
    }
};

/**
 * Close the given stream.
 *
 * @param {Readable} stream - The stream to be closed.
 * @param {Q.Deferred} [deferred] - The deferred to be resolved when the stream is closed.
 *
 * @private
 */
const closeStream = function (stream, deferred) {
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
};

/**
 * High-level functionality for managing assets on the local file system and through the Content Hub API.
 */
const helper = {
    // Constants used to differentiate between web assets and content assets.
    ASSET_TYPES_WEB_ASSETS: ASSET_TYPES_WEB_ASSETS,
    ASSET_TYPES_CONTENT_ASSETS: ASSET_TYPES_CONTENT_ASSETS,
    ASSET_TYPES_BOTH: ASSET_TYPES_BOTH,
    ASSET_TYPES: ASSET_TYPES,

    // Constants used to differentiate between different changed states.
    NEW: hashes.NEW,
    MODIFIED: hashes.MODIFIED,
    DELETED: hashes.DELETED,

    /**
     * Get the event emitter associated with the Assets Helper.
     *
     * @returns {Object} The event emitter associated with the Assets Helper.
     */
    getEventEmitter: function () {
        return eventEmitter;
    },

    /**
     * Get the name of the virtual folder used to store assets.
     *
     * @returns {String} The name of the virtual folder used to store assets.
     */
    getAssetFolderName: function () {
        return assetsFS.getFolderName();
    },

    /**
     * Set the options to be used as global options for this helper.
     *
     * Note: This method should only be called from the dxAuthoring getter for this helper.
     *
     * @param {Object} opts - The options to be used as global options for this helper.
     */
    initGlobalOptions: function (opts) {
        if (opts) {
            options.setGlobalOptions(opts);
        }
    },

    /**
     * Pull the asset with the specified path from the content hub.
     *
     * @param {String} path - The path of the asset to be pulled.
     * @param {Object} opts - The options to be used for the pull operation.
     *
     * @returns {Q.Promise} A promise for the asset that was pulled.
     */
    pullItem: function (path, opts) {
        // The content hub assets API does not support retrieving an item by path. So in order to pull a specific item,
        // get the items from the content hub one chunk at a time, and look for an asset with the specified path.
        return assetsREST.getItems(opts)
            .then(function (assets) {
                // Find the asset with the specified path.
                return findItemByPath(assets, path, opts);
            })
            .then(function (asset) {
                // The asset with the specified path was found, so pull it.
                logger.trace("Pull found asset: " + path);
                return pullAsset(asset, opts);
            })
            .catch(function (err) {
                // The asset with the specified name was not found.
                logger.trace("Pull could not find asset: " + path);
                throw err;
            });
    },

    /**
     * Pull all assets from the content hub.
     *
     * @param {Object} opts - The options to be used for the pull operations.
     *
     * @returns {Q.Promise} A promise for the assets that were pulled.
     */
    pullAllItems: function (opts) {
        const deferred = Q.defer();

        // Keep track of how many assets were not pulled.
        let errorCount = 0;
        const assetPulledError = function (/*error, name*/) {
            errorCount++;
        };
        helper.getEventEmitter().on("pulled-error", assetPulledError);

        // Use assetsREST.getItems() as the list function, so that all assets will be pulled.
        const listFn = assetsREST.getItems.bind(assetsREST);
        pullAssetChunk(listFn, opts)
            .then(function (pullInfo) {
                // There are no results initially, so just pass null for the results. The accumulated array of asset
                // metadata for all pulled items will be available when "deferred" has been resolved.
                recursePull(listFn, deferred, null, pullInfo, opts);
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
                    hashes.setLastPullTimestamp(assetsFS.getDir(opts), new Date(), opts);
                }
            });

        return deferred.promise;
    },

    /**
     * Pull all assets that have been modified on the content hub since the last pull.
     *
     * @param {Object} opts - The options to be used for the pull operations.
     *
     * @returns {Q.Promise} A promise for the assets that were pulled.
     */
    pullModifiedItems: function (opts) {
        const deferred = Q.defer();

        // Keep track of how many assets were not pulled.
        let errorCount = 0;
        const assetPulledError = function (/*error, name*/) {
            errorCount++;
        };
        helper.getEventEmitter().on("pulled-error", assetPulledError);

        // Use getModifiedRemoteItems() as the list function, so that only new and modified assets will be pulled.
        const listFn = helper.getModifiedRemoteItems.bind(helper, [helper.NEW, helper.MODIFIED]);
        pullAssetChunk(listFn, opts)
            .then(function (pullInfo) {
                // There are no results initially, so just pass null for the results. The accumulated array of asset
                // metadata for all pulled items will be available when "deferred" has been resolved.
                recursePull(listFn, deferred, null, pullInfo, opts);
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
                    hashes.setLastPullTimestamp(assetsFS.getDir(opts), new Date(), opts);
                }
            });

        return deferred.promise;
    },

    /**
     * Push the asset with the specified path to the content hub.
     *
     * @param {String} path - The path of the asset to be pushed.
     * @param {Object} opts - The options to be used for the push operation.
     *
     * @returns {Q.Promise} A promise for the metadata of the asset that was pushed.
     */
    pushItem: function (path, opts) {
        const deferred = Q.defer();

        // Begin the push process by determining the content length of the specified local file.
        assetsFS.getContentLength(path, opts)
            .then(function (length) {
                // Get the resource ID and the MD5 hash for the specified local asset file from the local hashes.
                const assetFile = assetsFS.getPath(path, opts);
                const assetHashes = hashes.getHashesForFile(assetsFS.getDir(opts), assetFile, opts);
                let resourceId = assetHashes ? assetHashes.resource : undefined;
                let resourceMd5 = assetHashes ? assetHashes.md5 : undefined;

                // In order to push the asset to the content hub, open a read stream for the asset file.
                let streamOpened;
                if (assetsFS.isContentResource(path) && fs.existsSync(assetsFS.getMetadataPath(path, opts))) {
                    // There is a metadata file for the content asset, so start by reading the metadata file.
                    streamOpened = assetsFS.getItem(path, opts)
                        .then(function (asset) {
                            // Get the resource ID and the MD5 hash if they aren't already defined.
                            resourceId = resourceId || asset.resource;
                            resourceMd5 = resourceMd5 || hashes.generateMD5Hash(assetFile);

                            // Create a clone of the original options, and keep track of the asset metadata.
                            opts = opts ? utils.clone(opts) : {};
                            opts.asset = asset;

                            // Open a read stream for the actual asset file (not the metadata file).
                            return assetsFS.getItemReadStream(path, opts);
                        })
                        .catch(function (err) {
                            // Reject the top-level promise.
                            deferred.reject(err);
                        });
                } else {
                    // There is no metadata file, so open a read stream for the asset file.
                    streamOpened = assetsFS.getItemReadStream(path, opts);
                }

                streamOpened
                    .then(function (readStream) {
                        // Create a promise that will be resolved when the read stream is closed.
                        const streamClosed = Q.defer();
                        readStream.on("close", function () {
                            streamClosed.resolve(path);
                        });

                        // Register that the asset file exists locally.
                        addLocalStatus(path);

                        // Push the asset to the content hub.
                        assetsREST.pushItem(resourceId, resourceMd5, path, readStream, length, opts)
                            .then(function (asset) {
                                // The push succeeded so emit a "pushed" event.
                                eventEmitter.emit("pushed", path);

                                // Register that the asset exists remotely.
                                addRemoteStatus(path);

                                // Save the asset metadata to a local file.
                                if (assetsFS.isContentResource(path)) {
                                    // Don't wait for the metadata to be saved, and don't reject the push if the save fails.
                                    assetsFS.saveItem(asset, opts);
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
                                const assetPath = assetsFS.getPath(asset.path, opts);
                                hashes.updateHashes(assetsFS.getDir(opts), assetPath, asset, opts);
                            })
                            .catch(function (err) {
                                // Failed to push the asset file, so explicitly close the read stream.
                                closeStream(readStream, streamClosed);

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
    },

    /**
     * Push local assets to the content hub.
     *
     * @param {Object} opts - The options to be used for the push operation.
     *
     * @returns {Q.Promise} A promise for the list of assets that were successfully pushed.
     */
    pushAllItems: function (opts) {
        // Get the list of local assets, based on the specified options.
        return helper.listLocalItemNames(opts)
            .then(function (names){
                // Push the assets in the list.
                return pushAssets(names, opts);
            });
    },

    /**
     * Push modified local assets to the content hub.
     *
     * @param {Object} opts - The options to be used for the push operation.
     *
     * @returns {Q.Promise} A promise for the list of modified assets that were successfully pushed.
     */
    pushModifiedItems: function (opts) {
        // Get the list of modified local assets, based on the specified options.
        return helper.listModifiedLocalItemNames([helper.NEW, helper.MODIFIED], opts)
            .then(function (names){
                // Push the assets in the list.
                return pushAssets(names, opts);
            });
    },

    /**
     * Get a list of the names of all remote assets.
     *
     * @param {Object} opts - The options to be used for this operation.
     *
     * @returns {Q.Promise} - A promise for an array of the names of all remote assets.
     */
    listRemoteItemNames: function (opts) {
        // Create the deferred to be used for recursively retrieving assets.
        const deferred = Q.defer();

        // Recursively call assetsREST.getItems() to retrieve all of the remote assets.
        const listFn = assetsREST.getItems.bind(assetsREST);

        // Get the first chunk of remote assets, and then recursively retrieve any additional chunks.
        listAssetChunk(listFn, opts)
            .then(function (listInfo) {
                // Pass a value of null for results to indicate that we retrieved the first chunk. The deferred will be
                // resolved when all chunks have been retrieved. However, the retrieval process will never reject the
                // deferred, so we have to handle that explicitly.
                recurseList(listFn, deferred, null, listInfo, opts);
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
                    return utils.getRelativePath(assetsFS.getDir(opts), assetsFS.getPath(asset.path, opts));
                });
            });
    },

    /**
     * Get a list of the assets that have been modified on the content hub.
     *
     * @param {Array} flags - An array of the state (NEW, DELETED, MODIFIED) of the assets to be included in the list.
     * @param {Object} opts - The options to be used for this operation.
     *
     * @returns {Q.Promise} - A promise for a list of the assets that have been modified on the content hub.
     */
    getModifiedRemoteItems: function (flags, opts) {
        // Get the local directory to use for comparison, based on the specified options.
        const dir = assetsFS.getDir(opts);

        // Recursively call assetsREST.getModifiedItems() to retrieve the remote assets modified since the last pull.
        return assetsREST.getModifiedItems(hashes.getLastPullTimestamp(dir, opts), opts)
            .then(function (items) {
                // Return a promise for the filtered list of remote modified assets.
                return items.filter(function (item) {
                    try {
                        // Determine whether the remote asset was modified, based on the specified flags.
                        const itemPath = assetsFS.getPath(item.path, opts);
                        return hashes.isRemoteModified(flags, item, dir, itemPath, opts);
                    } catch (err) {
                        utils.logErrors(i18n.__("error_filtering_remote_items"), err);
                    }
                });
            });
    },

    /**
     * Get a list of the names of all remote assets that have been modified.
     *
     * @param {Array} flags - An array of the state (NEW, DELETED, MODIFIED) of the assets to be included in the list.
     * @param {Object} opts - The options to be used for this operation.
     *
     * @returns {Q.Promise} - A promise for an array of the names of all remote assets that were modified since being
     *                        pushed/pulled.
     */
    listModifiedRemoteItemNames: function (flags, opts) {
        const deferred = Q.defer();

        // Use getModifiedRemoteItems() as the list function, so that only modified assets will be pulled.
        const listFn = helper.getModifiedRemoteItems.bind(helper, flags);
        listAssetChunk(listFn, opts)
            .then(function (listInfo) {
                // There are no results initially, so just pass null for the results. The accumulated array of asset
                // metadata for all listed items will be available when "deferred" has been resolved.
                recurseList(listFn, deferred, null, listInfo, opts);
            })
            .catch(function (err) {
                // There was an error listing the assets.
                deferred.reject(err);
            });

        return deferred.promise
            .then(function (items) {
                // The list results contain the relative path of each modified asset.
                const results = items.map(function (item) {
                    return utils.getRelativePath(assetsFS.getDir(opts), assetsFS.getPath(item.path, opts));
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
    },

    /**
     * Get a list of the names of all remote assets that have been deleted from the content hub.
     *
     * @param {Object} opts - The options to be used for the list operation.
     *
     * @returns {Q.Promise} - A promise for the names of all remote assets that have been deleted from the content hub.
     */
    listRemoteDeletedNames: function (opts) {
        const deferred = Q.defer();

        // Get the list of all remote assets.
        helper.listRemoteItemNames(opts)
            .then(function (remoteItemPaths) {
                // Get the list of local assets that are known to have existed on the server.
                const dir = assetsFS.getDir(opts);
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
    },

    /**
     * Get a list of local asset names, based on the specified options.
     *
     * @param {Object} opts - The options to be used for the list operation.
     *
     * @returns {Q.Promise} A promise for a list of local asset names, based on the specified options.
     */
    listLocalItemNames: function (opts) {
        // Get the list of asset paths on the local file system.
        return assetsFS.listNames(null, opts)
            .then(function (paths) {
                // Add the local status for each asset and return the original list of paths.
                paths.forEach(function (path) {
                    addLocalStatus(path);
                });
                return paths;
            });
    },

    /**
     * Get a list of modified local asset paths, based on the specified options.
     *
     * @param {Array} flags - An array of the state (NEW, DELETED, MODIFIED) of the assets to be included in the list.
     * @param {Object} opts - The options to be used for the list operation.
     *
     * @returns {Q.Promise} A promise for a list of modified local asset paths, based on the specified options.
     */
    listModifiedLocalItemNames: function (flags, opts) {
        // Get the list of local asset paths.
        const dir = assetsFS.getDir(opts);
        return assetsFS.listNames(null, opts)
            .then(function (assetPaths) {
                // Filter the list so that it only contains modified asset paths.
                const results = assetPaths
                    .filter(function (assetPath) {
                        const path = assetsFS.getPath(assetPath, opts);
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
    },

    /**
     * Get a list of the names of all local assets that have been deleted.
     *
     * @param {Object} opts - The options to be used for the list operation.
     *
     * @returns {Q.Promise} - A promise for the names of all local assets that have been deleted.
     */
    listLocalDeletedNames: function (opts) {
        const deferred = Q.defer();

        // Get the list of local asset paths.
        const dir = assetsFS.getDir(opts);
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
    },

    /**
     * Delete the asset with the specified path on the content hub.
     *
     * @param {String} path - An asset path on the content hub.
     * @param {Object} opts - The options to be used for the delete operation.
     *
     * @returns {Q.Promise} A promise that is resolved with a message describing the delete action.
     */
    deleteRemoteItem: function (path, opts) {
        return assetsREST.getItems(opts)
            .then(function (assets) {
                // Find the specified remote asset.
                return findItemByPath(assets, path, opts);
            })
            .then(function (asset) {
                // The asset was found, so delete it using its ID.
                logger.trace("deleteRemoteAssetsByPath found asset id: " + asset.id);
                return assetsREST.deleteItem(asset.id, opts);
            })
            .then(function (message) {
                // The delete was successful, so resolve the promise with the message returned from the REST service.
                statusTracker.removeStatus(path, StatusTracker.EXISTS_REMOTELY);
                return message;
            });
    },

    /**
     * Determine whether an asset with the specified path exists on the local file system.
     *
     * @param {String} path - An asset path on the local file system.
     *
     * @returns {Boolean} A return value of true indicates that an asset with the specified path exists on the local file system.
     */
    existsLocally: function (path) {
        return statusTracker.existsLocally({name: path});
    },

    /**
     * Determine whether an asset with the specified path exists on the content hub.
     *
     * @param {String} path - An asset path on the content hub.
     *
     * @returns {Boolean} A return value of true indicates that an asset with the specified path exists on the content hub.
     */
    existsRemotely: function (path) {
        return statusTracker.existsRemotely({name: path});
    },

    /**
     * Reset the helper to its original state.
     *
     * Note: This is mostly useful for testing, so that each test can be sure of the helper's initial state.
     */
    reset: function () {
        statusTracker = new StatusTracker();
        eventEmitter = new events.EventEmitter();
    }
};

module.exports = helper;
