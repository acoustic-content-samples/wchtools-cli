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
const BaseHelper = require("./baseHelper.js");
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
const manifests = require("./lib/utils/manifests.js");
const i18n = utils.getI18N(__dirname, ".json", "en");

/**
 * Flag used to determine whether to wait for the file stream to be closed before settling the promise to push an asset.
 *
 * @type Boolean
 *
 * @private
 */
const WAIT_FOR_CLOSE = process.env.WCHTOOLS_WAIT_FOR_CLOSE || false;

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
class AssetsHelper extends BaseHelper {
    /**
     * The constructor for an assets helper object.
     *
     * @constructs AssetsHelper
     */
    constructor (enforcer) {
        if (enforcer !== singletonEnforcer) {
            throw i18n.__("singleton_construct_error", {classname: "AssetsHelper"});
        }

        super(assetsREST, assetsFS, "assets", "asset");

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
     * Get the name to be displayed for the given item.
     *
     * @param {Object} item - The item for which to get the name.
     *
     * @returns {String} The name to be displayed for the given item.
     *
     * @override
     */
    getName (item) {
        // Display the asset path.
        return item.path;
    }

    /**
     * Updates the manifest with results of an asset operation.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} itemList The list of items to be added to the manifest.
     * @param {Object} opts - The options to be used for the list operation.
     */
    _updateManifest (context, itemList, opts) {
        const manifestList = itemList.filter(function (item) {
            return (item && item.path && item.path !== "/robots.txt" && item.path !== "/sitemap.xml");
        });
        manifests.updateManifestSection(context, this.getArtifactName(), manifestList, opts);
    }

    /**
     * Updates the deletions manifest with results of an asset operation.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} itemList The list of items to be added to the deletions manifest.
     * @param {Object} opts - The options to be used for the list operation.
     */
    _updateDeletionsManifest (context, itemList, opts) {
        const manifestList = itemList.filter(function (item) {
            return (item && item.path && item.path !== "/robots.txt" && item.path !== "/sitemap.xml");
        });
        manifests.updateDeletionsManifestSection(context, this.getArtifactName(), manifestList, opts);
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
        if (!utils.isValidFilePath(assetPath) || hashes.isHashesFile(assetPath)) {
            const deferred = Q.defer();
            deferred.reject(new Error(i18n.__("invalid_path", {path: assetPath})));
            return deferred.promise;
        } else {
            // Get the local file stream to be written.
            return helper._fsApi.getItemWriteStream(context, assetPath, opts)
                .then(function (stream) {
                    let md5Promise;
                    stream.on("pipe", function (src) {
                        md5Promise = hashes.generateMD5HashFromStream(src);
                    });

                    // Download the specified asset contents and write them to the given stream.
                    return helper._restApi.pullItem(context, asset, stream, opts)
                        .then(function (asset) {
                            return md5Promise.then(function (md5) {
                                const basePath = helper._fsApi.getAssetsPath(context, opts);
                                const filePath = helper._fsApi.getPath(context, opts) + assetPath;

                                if (!hashes.compareMD5Hashes(md5, asset.digest)) {
                                    const err = i18n.__("digest_mismatch", {cli_digest: md5, asset: assetPath, server_digest: asset.digest});
                                    const logger = helper.getLogger(context);
                                    logger.error(err);
                                    throw new Error(err);
                                }

                                // Notify any listeners that the asset at the given path was pulled.
                                const emitter = helper.getEventEmitter(context);
                                if (emitter) {
                                    emitter.emit("pulled", {id: asset.id, path: assetPath});
                                }

                                // Save the asset metadata for content resources.
                                const result = Q.defer();
                                if (helper._fsApi.isContentResource(asset)) {
                                    try {
                                        result.resolve(helper._fsApi.saveItem(context, asset, opts));
                                    } catch (err) {
                                        result.reject(err);
                                    }
                                } else {
                                    result.resolve(asset);
                                }
                                return result.promise.finally(function (value) {
                                    const metadataPath = helper._fsApi.isContentResource(asset) ? helper._fsApi.getMetadataPath(context, assetPath, opts) : undefined;
                                    hashes.updateHashes(context, basePath, metadataPath, asset, filePath, md5, opts);
                                    return value;
                                });
                            });
                        });
                });
        }
    }

    /**
     * Get the given items from the content hub.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Array} items - The items to be retrieved.
     * @param {Object} opts - The options to be used for this operations.
     *
     * @returns {Q.Promise} A promise for the items that were retrieved.
     *
     * @protected
     */
    _getRemoteItemList (context, items, opts) {
        const deferred = Q.defer();
        const helper = this;

        // Create an array of functions, one function for each item being retrieved.
        const functions = items.map(function (item) {
            return function () {
                return helper._restApi.getItemByPath(context, item.path, opts);
            };
        });

        // Get the items in the list, throttling the concurrent requests to the defined limit for this artifact type.
        const concurrentLimit = options.getRelevantOption(context, opts, "concurrent-limit", helper.getArtifactName());
        utils.throttledAll(context, functions, concurrentLimit)
            .then(function (promises) {
                const retrievedItems = [];
                promises.forEach(function (promise) {
                    if ((promise.state === 'fulfilled') && promise.value) {
                        retrievedItems.push(promise.value);
                    }
                });

                // Resolve the promise with the list of retrieved items.
                deferred.resolve(retrievedItems);
            });

        // Return the promise that will eventually be resolved with the retrieved items.
        return deferred.promise;
    }

    /**
     * Pull the given items.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Array} items - The items to be pulled.
     * @param {Object} opts - The options to be used for this operations.
     *
     * @returns {Q.Promise} A promise for the items that were pulled.
     *
     * @protected
     */
    _pullItemList (context, items, opts) {
        const deferred = Q.defer();
        const helper = this;

        // Create an array of functions, one function for each item being pulled.
        const functions = items.map(function (item) {
            return function () {
                return helper._pullAsset(context, item, opts);
            };
        });

        // Pull the items in the list, throttling the concurrent requests to the defined limit for this artifact type.
        const concurrentLimit = options.getRelevantOption(context, opts, "concurrent-limit", helper.getArtifactName());
        utils.throttledAll(context, functions, concurrentLimit)
            .then(function (promises) {
                const pulledItems = [];
                promises.forEach(function (promise) {
                    if ((promise.state === 'fulfilled') && promise.value) {
                        pulledItems.push(promise.value);
                    }
                });

                // Resolve the promise with the list of pulled items.
                deferred.resolve(pulledItems);
            });

        // Return the promise that will eventually be resolved with the pulled items.
        return deferred.promise;
    }

    /**
     * Filter the given list of assets before completing the pull operation.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Array} assetList The assets to be pulled.
     * @param {Object} opts The options to be used for this operations.
     *
     * @returns {Array} The filtered list of assets.
     *
     * @protected
     */
    _pullFilter (context, assetList, opts) {
        const helper = this;

        // Filter the asset list based on the ready and draft options.
        const readyOnly = options.getRelevantOption(context, opts, "filterReady");
        const draftOnly = options.getRelevantOption(context, opts, "filterDraft");
        if (readyOnly) {
            // Filter out any assets that are not ready.
            assetList = assetList.filter(function (asset) {
                return (!asset.status || asset.status === "ready");
            });
        } else if (draftOnly) {
            // Filter out any assets that are not draft.
            assetList = assetList.filter(function (asset) {
                return (asset.status === "draft");
            });
        }

        // Filter the asset list based on the type of assets specified by the options.
        if (opts && opts[helper.ASSET_TYPES] === helper.ASSET_TYPES_WEB_ASSETS) {
            // Filter out any content assets.
            assetList = assetList.filter(function (asset) {
                return (!helper._fsApi.isContentResource(asset));
            });
        } else if (opts && opts[helper.ASSET_TYPES] === helper.ASSET_TYPES_CONTENT_ASSETS) {
            // Filter out any web assets.
            assetList = assetList.filter(function (asset) {
                return (helper._fsApi.isContentResource(asset));
            });
        }

        // Filter the asset list based on the path.
        let filterPath = options.getRelevantOption(context, opts, "filterPath");
        if (filterPath) {
            filterPath = utils.formatFilterPath(filterPath);
            assetList = assetList.filter(function (asset) {
                return (asset.path && asset.path.indexOf(filterPath) === 0);
            });
        }

        return assetList;
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

                // Filter the assets before saving them to the local file system.
                assetList = helper._pullFilter(context, assetList, opts);

                // Throttle the number of assets to be pulled concurrently, using the currently configured limit.
                const concurrentLimit = options.getRelevantOption(context, opts, "concurrent-limit", helper.getArtifactName());
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
                        const manifestList = [];
                        promises.forEach(function (promise, index) {
                            if (promise.state === "fulfilled") {
                                const asset = promise.value;
                                assets.push(asset);
                                manifestList.push(assetList[index]);
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

                        // Append the resulting assets to the manifest if writing/updating a manifest.
                        helper._updateManifest(context, manifestList, opts);

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
        results = results.concat(pullInfo.assets);

        const currentChunkSize = pullInfo.length;
        const maxChunkSize = options.getRelevantOption(context, opts, "limit", this.getArtifactName());
        if (currentChunkSize === 0 || currentChunkSize < maxChunkSize) {
            // The current chunk is a partial chunk, so there are no more assets to be retrieved. Resolve the promise
            // with the accumulated results.
            deferred.resolve(results);
        } else {
            // The current chunk is a full chunk, so there may be more assets to retrieve.
            const helper = this;

            // Increase the offset so that the next chunk of assets will be retrieved.
            const offset = options.getRelevantOption(context, opts, "offset", helper.getArtifactName());
            opts = utils.cloneOpts(opts, {offset: offset + maxChunkSize});

            // Pull the next chunk of assets from the content hub.
            helper._pullItemsChunk(context, listFn, opts)
                .then(function (pullInfo) {
                    helper._recursePull(context, listFn, deferred, results, pullInfo, opts);
                });
        }
    }

    /**
     * Pull the asset with the specified id from the content hub.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {String} id - The ID of the item to be pulled.
     * @param {Object} opts - The options to be used for the pull operation.
     *
     * @returns {Q.Promise} A promise for the asset that was pulled.
     */
    pullItem (context, id, opts) {
        const helper = this;
        return this._restApi.getItem(context, id, opts)
            .then(function (asset) {
                // The asset with the specified id was found, so pull it.
                const logger = helper.getLogger(context);
                logger.trace("Pull found asset by id: " + id + " path found: " + asset.path);
                return helper._pullAsset(context, asset, opts);
            })
            .catch(function (err) {
                // The asset with the specified name was not found.
                const logger = helper.getLogger(context);
                logger.trace("Pull could not find asset: " + id);
                throw err;
            });
    }

    /**
     * Pull the asset with the specified path from the content hub.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {String} assetPath - The path of the asset to be pulled.
     * @param {Object} opts - The options to be used for the pull operation.
     *
     * @returns {Q.Promise} A promise for the asset that was pulled.
     */
    pullItemByPath (context, assetPath, opts) {
        // The content hub assets API does not support retrieving an item by path. So in order to pull a specific item,
        // get the items from the content hub one chunk at a time, and look for an asset with the specified path.
        const helper = this;
        return this._restApi.getItems(context, opts)
            .then(function (assets) {
                // Find the asset with the specified path.
                return helper._findItemByPath(context, assets, assetPath, opts);
            })
            .then(function (asset) {
                // The asset with the specified path was found, so pull it.
                const logger = helper.getLogger(context);
                logger.trace("Pull found asset: " + assetPath);
                return helper._pullAsset(context, asset, opts);
            })
            .catch(function (err) {
                // The asset with the specified name was not found.
                const logger = helper.getLogger(context);
                logger.trace("Pull could not find asset: " + assetPath);
                throw err;
            });
    }

    _pullResource (context, resource, opts) {
        const helper = this;
        const basePath = helper._fsApi.getResourcesPath(context, opts);
        // Get the local file stream to be written.
        return helper._fsApi.getResourceWriteStream(context, resource.id, opts)
            .then(function (stream) {
                let md5Promise;
                stream.on("pipe", function (src) {
                    md5Promise = hashes.generateMD5HashFromStream(src);
                });

                // Construct a fake "asset" to pass to the pullItem method.  We just need the resource id and path.
                const asset = {
                    id: resource.id,
                    resource: resource.id,
                    path: helper._fsApi.getResourcePath(context, resource.id, opts)
                };
                // Specify in the opts that we need the resource filename returned.
                // Download the specified resource contents and write them to the given stream.
                return helper._restApi.pullItem(context, asset, stream, utils.cloneOpts(opts, {returnDisposition: true}))
                    .then(function (asset) {
                        helper._fsApi.renameResource(context, resource.id, asset.disposition, opts);
                        const newname = helper._fsApi.getRawResourcePath(context, resource.id, asset.disposition, opts);
                        const relative = utils.getRelativePath(basePath, newname);
                        md5Promise.then(function (md5) {
                            hashes.updateResourceHashes(context, basePath, newname, asset, md5, opts);
                        });

                        // Notify any listeners that the resource at the given path was pulled.
                        const emitter = helper.getEventEmitter(context);
                        if (emitter) {
                            emitter.emit("resource-pulled", {"path":relative, "id":resource.id});
                        }
                        return asset;
                    });
            });
    }

    /**
     * Pull the chunk of resources retrieved by the given function.
     *
     * @param {Object} context - The context to be used for the pull operation.
     * @param {Function} listFn - A function that returns a promise for a chunk of remote resources to be pulled.
     * @param {Object} opts - The options to be used for the pull operations.
     *
     * @returns {Q.Promise} A promise for information about the resources that were pulled.
     *
     * @private
     */
    _pullResourcesChunk (context, listFn, opts) {
        // Get the next "chunk" of resource ids from the content hub.
        const helper = this;
        return listFn(opts)
            .then(function (resourceList) {
                const listLength = resourceList.length;

                resourceList = resourceList.filter(function (resource) {
                    // Filter the list of resources and return only those that aren't pulled for assets.
                    const basePath = helper._fsApi.getResourcesPath(context, opts);
                    const resourcePath = hashes.getPathForResource(context, basePath, resource.id, opts);
                    if (!resourcePath) {
                        return resource;
                    }
                });

                // Throttle the number of resources to be pulled concurrently, using the currently configured limit.
                const concurrentLimit = options.getRelevantOption(context, opts, "concurrent-limit", "resources");
                const results = utils.throttledAll(context, resourceList.map(function (resource) {
                    // Return a function that returns a promise for each resource being pulled.
                    return function () {
                        return helper._pullResource(context, resource, opts);
                    };
                }), concurrentLimit);

                // Return the promise to pull all of the specified resources.
                return results
                    .then(function (promises) {
                        // Return a list of results - resource id for a fulfilled promise, error for a rejected promise.
                        const resources = [];
                        promises.forEach(function (promise, index) {
                            if (promise.state === "fulfilled") {
                                const resource = promise.value;
                                resources.push(resource);
                            }
                            else {
                                const error = promise.reason;
                                resources.push(error);
                                const emitter = helper.getEventEmitter(context);
                                if (emitter) {
                                    emitter.emit("resource-pulled-error", error, resourceList[index].id);
                                }
                                context.pullErrorCount++;
                            }
                        });

                        // Return the number of resources processed (either success or failure) and an array of pulled resources.
                        return {length: listLength, resources: resources};
                    });
            });
    }

    /**
     * Recursive function to pull subsequent chunks of resources retrieved by the given function.
     *
     * @param {Object} context - The context to be used for the pull operation.
     * @param {Function} listFn - A function that returns a promise for a chunk of remote resources to be pulled.
     * @param {Q.Deferred} deferred - A deferred that will be resolved with *all* resources pulled.
     * @param {Array} results - The accumulated results.
     * @param {Object} pullInfo - The number of resources processed (either success or failure) and an array of pulled resources.
     * @param {Object} opts - The options to be used for the pull operations.
     *
     * @private
     */
    _recurseResourcesPull (context, listFn, deferred, results, pullInfo, opts) {
        // If a results array is specified, accumulate the resources pulled.
        results = results.concat(pullInfo.resources);

        const currentChunkSize = pullInfo.length;
        const maxChunkSize = options.getRelevantOption(context, opts, "limit", "resources");
        if (currentChunkSize === 0 || currentChunkSize < maxChunkSize) {
            // The current chunk is a partial chunk, so there are no more resources to be retrieved. Resolve the promise
            // with the accumulated results.
            deferred.resolve(results);
        } else {
            // The current chunk is a full chunk, so there may be more resources to retrieve.
            const helper = this;

            // Increase the offset so that the next chunk of resources will be retrieved.
            const offset = options.getRelevantOption(context, opts, "offset", "resources");
            opts = utils.cloneOpts(opts, {offset: offset + maxChunkSize});

            // Pull the next chunk of resources from the content hub.
            helper._pullResourcesChunk(context, listFn, opts)
                .then(function (pullInfo) {
                    helper._recurseResourcesPull(context, listFn, deferred, results, pullInfo, opts);
                });
        }
    }

    pullResources (context, opts) {
        const deferred = Q.defer();
        const helper = this;
        const emitter = helper.getEventEmitter(context);
        let allFSResources;

        // If we're only pulling (Fernando) web assets, don't bother pulling resources without asset references.
        // If the noVirtualFolder option has been specified, we can't pull resources without asset references.
        if (opts && (opts[helper.ASSET_TYPES] === helper.ASSET_TYPES_WEB_ASSETS || opts.noVirtualFolder)) {
            deferred.resolve();
        } else {
            // The mechanism for handling deletions is to emit a "resource-local-only" event for each local item to be
            // deleted. Because of this, deletions should only be calculated if there is an emitter to use for the event.
            if (emitter && options.getRelevantOption(context, opts, "deletions")) {
                allFSResources = this.listLocalResourceNames(context, opts);
            }

            const listFn = this._restApi.getResourceList.bind(this._restApi, context);
            helper._pullResourcesChunk(context, listFn, opts)
                .then(function (pullInfo) {
                    // There are no results initially, so just pass an empty array. The accumulated array of
                    // resources for all pulled items will be available when "deferred" has been resolved.
                    helper._recurseResourcesPull(context, listFn, deferred, [], pullInfo, opts);
                })
                .catch(function (err) {
                    // There was a fatal issue, beyond a failure to pull one or more items.
                    deferred.reject(err);
                });
        }

        return deferred.promise
            .then(function (resources) {
                if (allFSResources) {
                    return allFSResources
                        .then(function (values) {
                            const pulledPaths = resources.map(function (resource) {
                                return resource.path;
                            });
                            values.forEach(function (resource) {
                                if (pulledPaths.indexOf(resource.path) === -1) {
                                    emitter.emit("resource-local-only", resource);
                                }
                            });
                            return resources;
                        });
                } else {
                    return resources;
                }
            });
    }

    /**
     * Get the items from the current manifest.
     *
     * @param {Object} context The API context to be used by the operation.
     * @param {Object} opts - The options to be used to get the items.
     *
     * @returns {Q.Promise} A promise to get the items from the current manifest.
     *
     * @resolves {Array} The items from the current manifest, or an empty array.
     */
    getManifestItems (context, opts) {
        const self = this;
        const items = [];
        const section = manifests.getManifestSection(context, this.getArtifactName(), opts);

        if (section) {
            // The section has a property for each item, the key is the item id.
            const keys = Object.keys(section);

            // Add an item for each id in the section.
            keys.forEach(function (key) {
                // Make sure the item is valid (contains at least a path).
                if (section[key].path) {
                    // Clone the item, so that the original is not modified.
                    let item = utils.clone(section[key]);
                    if (opts && opts[self.ASSET_TYPES] === self.ASSET_TYPES_WEB_ASSETS) {
                        // Filter out any content assets.
                        if (self._fsApi.isContentResource(item)) {
                            item = undefined;
                        }
                    } else if (opts && opts[self.ASSET_TYPES] === self.ASSET_TYPES_CONTENT_ASSETS) {
                        // Filter out any web assets.
                        if (!self._fsApi.isContentResource(item)) {
                            item = undefined;
                        }
                    }
                    if (item) {
                        items.push(item);
                    }
                }
            });
        }

        // Return a promise resolved with the manifest items for this helper, if there are any.
        return Q(items);
    }

    /**
     * Pull the items in the current manifest from the remote content hub to the local file system.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} opts The options to be used for the pull operations.
     *
     * @returns {Q.Promise} A promise to pull the remote items to the local file system.
     *
     * @resolves {Array} The items that were pulled.
     */
    pullManifestItems (context, opts) {
        // Get the names (actually the proxy items) from the current manifest and pull them from the content hub.
        const helper = this;
        return helper.getManifestItems(context, opts)
            .then(function (items) {
                // Get the asset metadata for the items in the manifest.
                return helper._getRemoteItemList(context, items, opts);
            })
            .then(function (items) {
                // Pull the asset resources for the items in the manifest.
                return helper._pullItemList(context, items, opts);
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
        const helper = this;

        // The mechanism for handling deletions is to emit a "local-only" event for each local item to be deleted.
        // Because of this, deletions should only be calculated if there is an emitter to use for the event.
        let allFSItems;
        const emitter = helper.getEventEmitter(context);
        if (emitter && options.getRelevantOption(context, opts, "deletions")) {
            allFSItems = this._listLocalItemNames(context, opts);
        }

        // Use AssetsREST.getItems() as the list function, so that all assets will be pulled.
        const listFn = helper._restApi.getItems.bind(helper._restApi, context);

        // Keep track of the error count.
        context.pullErrorCount = 0;

        // Get the timestamp to set before we call the REST API.
        const timestamp = new Date();

        helper._pullItemsChunk(context, listFn, opts)
            .then(function (pullInfo) {
                // There are no results initially, so just pass an empty array. The accumulated array of asset
                // metadata for all pulled items will be available when "deferred" has been resolved.
                helper._recursePull(context, listFn, deferred, [], pullInfo, opts);
            })
            .catch(function (err) {
                // There was a fatal issue, beyond a failure to pull one or more items.
                deferred.reject(err);
            });

        // Handle any necessary actions once the pull operations have completed.
        return deferred.promise
            .then(function (items) {
                if (options.getRelevantOption(context, opts, "disablePushPullResources") === true) {
                    return items;
                } else {
                    return helper.pullResources(context, opts)
                        .then(function () {
                            return items;
                        });
                }
            })
            .then(function (items) {
                const readyOnly = options.getRelevantOption(context, opts, "filterReady");
                const draftOnly = options.getRelevantOption(context, opts, "filterDraft");
                const filterPath = options.getRelevantOption(context, opts, "filterPath");
                if ((context.pullErrorCount === 0) && !readyOnly && !draftOnly && !filterPath) {
                    // Only update the last pull timestamp if there was no filtering and no pull errors.
                    helper._setLastPullTimestamps(context, timestamp, opts);
                }
                if (allFSItems) {
                    return allFSItems.then(function (values) {
                        const pulledPaths = items.map(function (item) {
                            return helper._fsApi.getAssetPath(item);
                        });
                        values.forEach(function (item) {
                            if (pulledPaths.indexOf(item.path) === -1) {
                                emitter.emit("local-only", item);
                            }
                        });
                        return items;
                    });
                } else {
                    return items;
                }
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

        // Get the timestamp to set before we call the REST API.
        const timestamp = new Date();

        helper._pullItemsChunk(context, listFn, opts)
            .then(function (pullInfo) {
                // There are no results initially, so just pass an empty array. The accumulated array of asset
                // metadata for all pulled items will be available when "deferred" has been resolved.
                helper._recursePull(context, listFn, deferred, [], pullInfo, opts);
            })
            .catch(function (err) {
                // There was a fatal issue, beyond a failure to pull one or more items.
                deferred.reject(err);
            });

        // Handle any necessary actions once the pull operations have completed.
        return deferred.promise
            .then(function (items) {
                if (options.getRelevantOption(context, opts, "disablePushPullResources") === true) {
                    return items;
                } else {
                    return helper.pullResources(context, opts)
                        .then(function () {
                            return items;
                        });
                }
            })
            .then(function (items) {
                const readyOnly = options.getRelevantOption(context, opts, "filterReady");
                const draftOnly = options.getRelevantOption(context, opts, "filterDraft");
                const filterPath = options.getRelevantOption(context, opts, "filterPath");
                if ((context.pullErrorCount === 0) && !readyOnly && !draftOnly && !filterPath) {
                    // Only update the last pull timestamp if there was no filtering and no pull errors.
                    helper._setLastPullTimestamps(context, timestamp, opts);
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

        // If retry is enabled for this helper, handle any necessary setup.
        if (this.isRetryPushEnabled()) {
            // Initialize the retry state on the context.
            context.retryPush = {};
            helper.initializeRetryPush(context, paths);

            // Add the filter for determining whether a failed push should be retried.
            context.filterRetryPush = this.filterRetryPush.bind(this);
        }

        // Push ready assets and draft assets in separate batches.
        const drafts = [];
        paths = paths.filter(function (path) {
            if (helper._fsApi.isDraftAsset(path)) {
                // Add the draft asset to the drafts array, and allow it to be filtered from the paths array.
                drafts.push(path);
                return false;
            } else {
                // Keep the ready asset in the paths array.
                return true;
            }
        });

        // Get the timestamp to set before we call the REST API.
        const timestamp = new Date();

        let readyResults;
        const concurrentLimit = options.getRelevantOption(context, opts, "concurrent-limit", helper.getArtifactName());
        const readyOnly = options.getRelevantOption(context, opts, "filterReady");
        const draftOnly = options.getRelevantOption(context, opts, "filterDraft");

        // Push the ready assets, unless only draft assets should be pushed.
        if (!draftOnly) {
            // Throttle the number of assets to be pushed concurrently, using the currently configured limit.
            readyResults = utils.throttledAll(context, paths.map(function (name) {
                return function () {
                    return helper.pushItem(context, name, opts);
                };
            }), concurrentLimit);
        } else {
            // Not pushing ready assets, so return a resolved promise.
            readyResults = Q([]);
        }

        let results;

        // Push the draft assets if there are any, unless only ready assets should be pushed.
        if (drafts.length > 0 && !readyOnly) {
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
        } else {
            results = readyResults;
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
                helper._updateManifest(context, assets, opts);
                // Keep track of the timestamp of this operation, but only if there was no filtering and no errors.
                const filterPath = options.getRelevantOption(context, opts, "filterPath");
                if ((errorCount === 0) && !readyOnly && !draftOnly && !filterPath) {
                    helper._setLastPushTimestamps(context, timestamp, opts);
                }
                return assets;
            })
            .finally(function () {
                // Once the promise has been settled, remove the retry push state from the context.
                delete context.retryPush;
                delete context.filterRetryPush;
            });
    }

    /**
     * Get the retry information for the asset with the specified path.
     *
     * @param {Object} context - The context to be used for the push operation.
     * @param {String} assetPath - The attempt number of the current attempt.
     * @param {Object} opts - The options to be used for the push operation.
     *
     * @returns {Object} The retry information for the asset with the specified path.
     */
    _getRetryItem (context, assetPath, opts) {
        let retryItem;
        const retryItems = this.getRetryPushProperty(context, BaseHelper.RETRY_PUSH_ITEMS);
        if (retryItems) {
            retryItem = retryItems.find(function (item) {
                return item[BaseHelper.RETRY_PUSH_ITEM_NAME] === assetPath;
            });
        }

        if (retryItem) {
            // The retry item already exists, so increment the retry count.
            retryItem[BaseHelper.RETRY_PUSH_ITEM_COUNT] += 1;
        } else {
            // The retry item doesn't exist, so add a new retry item for this asset.
            retryItem = {};
            retryItem[BaseHelper.RETRY_PUSH_ITEM_NAME] = assetPath;
            retryItem[BaseHelper.RETRY_PUSH_ITEM_COUNT] = 1;
            this.addRetryPushProperties(context, retryItem);
        }

        // Determine whether this asset has reached the attempt limit.
        const maxAttempts = options.getRelevantOption(context, opts, "retryMaxAttempts");
        if (retryItem[BaseHelper.RETRY_PUSH_ITEM_COUNT] >= maxAttempts) {
            // This asset has reached the attempt limit, so don't return a retry item.
            retryItem = null;
        } else {
            const serviceName = this._restApi.getServiceName();
            const minTimeout = options.getRelevantOption(context, opts, "retryMinTimeout", serviceName);
            const maxTimeout = options.getRelevantOption(context, opts, "retryMaxTimeout", serviceName);
            const factor = options.getRelevantOption(context, opts, "retryFactor", serviceName);
            const randomize = (options.getRelevantOption(context, opts, "retryRandomize", serviceName) === true);

            // The delay is set to the minimum timeout by default.
            let delay = minTimeout;

            // If the delay is being randomized, multiply by a random factor between 1 and 2.
            if (randomize === true) {
                const randomnessFactor = 1.0 + Math.random();
                delay = randomnessFactor * delay;
            }

            // Use an exponential backoff strategy if a factor has been defined.
            if (factor !== 0) {
                const backoffFactor = Math.pow(factor, retryItem[BaseHelper.RETRY_PUSH_ITEM_COUNT] - 1);
                delay = backoffFactor * delay;
            }

            // Make sure the delay is not longer than the maximum timeout.
            retryItem[BaseHelper.RETRY_PUSH_ITEM_DELAY] = Math.min(delay, maxTimeout);
        }

        return retryItem;
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
        let errorInfo = path;
        helper._fsApi.getContentLength(context, path, opts)
            .then(function (length) {
                // Get the resource ID and the MD5 hash for the specified local asset file from the local hashes.
                const assetFile = helper._fsApi.getPath(context, opts) + path;
                let assetHashesResourceMD5 = hashes.getResourceMD5ForFile(context, helper._fsApi.getAssetsPath(context, opts), assetFile, opts);
                const isContentResource = helper._fsApi.isContentResource(path);
                if (!assetHashesResourceMD5 && isContentResource) {
                    // the asset is a content resource, try the lookup in hashes using the metadata path
                    const mdFile = helper._fsApi.getMetadataPath(context, path, opts);
                    assetHashesResourceMD5 = hashes.getResourceMD5ForFile(context, helper._fsApi.getAssetsPath(context, opts), mdFile, opts);
                }
                let resourceId;
                let resourceMd5 = isContentResource ? assetHashesResourceMD5 : undefined;
                hashes.generateMD5HashAndID(helper._fsApi.getAssetsPath(context, opts), assetFile).then(function (hashAndID) {
                    // In order to push the asset to the content hub, open a read stream for the asset file.
                    let streamOpened;
                    if (isContentResource && fs.existsSync(helper._fsApi.getMetadataPath(context, path, opts))) {
                        // There is a metadata file for the content asset, so start by reading the metadata file.
                        streamOpened = helper._fsApi.getItem(context, path, opts)
                            .then(function (asset) {
                                // Get the resource ID and the MD5 hash if they aren't already defined.
                                resourceId = asset.resource;
                                resourceMd5 = resourceMd5 || hashAndID.md5;

                                // Keep track of the asset metadata.
                                opts = utils.cloneOpts(opts, {asset: asset});

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
                        resourceMd5 = resourceMd5 || hashAndID.md5;
                        // Use the resources's MD5 hash (with path name) as the resourceId.
                        resourceId = resourceMd5 ? hashAndID.id : undefined;
                    }

                    streamOpened
                        .then(function (readStream) {
                            // Create a promise that will be resolved when the read stream is closed.
                            const streamClosed = Q.defer();
                            readStream.on("close", function () {
                                streamClosed.resolve(path);
                            });

                            // Determine how to set replaceContentReource - if the saved md5 doesn't match the md5 of the resource
                            const replaceContentResource = isContentResource && (resourceMd5 !== hashAndID.md5);

                        // Push the asset to the content hub.
                        helper._restApi.pushItem(context, false, isContentResource, replaceContentResource, resourceId, resourceMd5, path, readStream, length, opts)
                            .then(function (asset) {
                                errorInfo = {id: asset.id, path: path};

                                // Save the asset metadata to a local file.
                                const done = Q.defer();
                                const rewriteOnPush = options.getRelevantOption(context, opts, "rewriteOnPush");
                                if (isContentResource && rewriteOnPush) {
                                    // Wait for the metadata to be saved, and don't reject the push if the save fails.
                                    try {
                                        done.resolve(helper._fsApi.saveItem(context, asset, opts));
                                    } catch (err) {
                                        done.resolve(err);
                                    }
                                } else {
                                    done.resolve(asset);
                                }

                                    // Update the hashes for the pushed asset.
                                    const assetPath = helper._fsApi.getPath(context, opts) + helper._fsApi.getAssetPath(asset);
                                    const metadataPath = isContentResource ? helper._fsApi.getMetadataPath(context, helper._fsApi.getAssetPath(asset), opts) : undefined;
                                    done.promise.finally(function () {
                                        hashes.updateHashes(context, helper._fsApi.getAssetsPath(context, opts), metadataPath, asset, assetPath, hashAndID.md5, opts);

                                        // Once the metadata file has been saved, resolve the top-level promise.
                                        /* istanbul ignore next */
                                        if (WAIT_FOR_CLOSE) {
                                            // Also wait for the stream to close before resolving the top-level promise.
                                            streamClosed.promise
                                                .then(function () {
                                                    deferred.resolve(asset);
                                                });
                                        } else {
                                            deferred.resolve(asset);
                                        }
                                    });

                                    // The push succeeded so emit a "pushed" event.
                                    const emitter = helper.getEventEmitter(context);
                                    if (emitter) {
                                        emitter.emit("pushed", {id: asset.id, path: path});
                                    }
                                })
                                .catch(function (err) {
                                    // Failed to push the asset file, so explicitly close the read stream.
                                    helper._closeStream(context, readStream, streamClosed);

                                    // Get the retry item for this asset, if one exists.
                                    const retryItem = err.retry && helper._getRetryItem(context, path, opts);

                                    // Retry the push of this asset if we have a retry item.
                                    if (retryItem) {
                                        // Log a warning that the push of this item will be retried.
                                        utils.logWarnings(context, i18n.__("pushed_item_retry", {name: path, message: err.log ? err.log : err.message}));

                                        // Retry the push after the calculated delay.
                                        setTimeout(function () {
                                            helper.pushItem(context, path, opts)
                                                .then(function (asset) {
                                                    deferred.resolve(asset);
                                                })
                                                .catch(function (err) {
                                                    deferred.reject(err);
                                                });
                                        }, retryItem[BaseHelper.RETRY_PUSH_ITEM_DELAY]);
                                    } else {
                                        // The push will not be retried, reject the promise and emit a "pushed-error" event.
                                        /* istanbul ignore next */
                                        if (WAIT_FOR_CLOSE) {
                                            // Also wait for the stream to close before rejecting the top-level promise.
                                            streamClosed.promise
                                                .then(function () {
                                                    deferred.reject(err);
                                                });
                                        } else {
                                            deferred.reject(err);
                                        }

                                        const emitter = helper.getEventEmitter(context);
                                        if (emitter) {
                                            emitter.emit("pushed-error", err, errorInfo);
                                        }
                                    }
                                });
                        })
                        .catch(function (err) {
                            // Failed getting the read stream, so just reject the top-level promise.
                            deferred.reject(err);
                        });
                })
                .catch(function (err) {
                    // Failed getting MD5 hash and ID for the resource.
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
     * Push the resource with the specified path to the content hub.
     *
     * @param {Object} context - The context to be used for the push operation.
     * @param {String} resourcePath - The path of the resource to be pushed.
     * @param {Object} opts - The options to be used for the push operation.
     *
     * @returns {Q.Promise} A promise for the metadata of the resource that was pushed.
     */
    _pushResource (context, resourcePath, opts) {
        const deferred = Q.defer();

        // Begin the push process by determining the content length of the specified local file.
        const helper = this;
        let errorInfo = resourcePath;
        helper._fsApi.getResourceContentLength(context, resourcePath, opts)
            .then(function (length) {

                // In order to push the resource to the content hub, open a read stream for the resource file.
                helper._fsApi.getResourceReadStream(context, resourcePath, opts)
                    .then(function (readStream) {
                        // Create a promise that will be resolved when the read stream is closed.
                        const streamClosed = Q.defer();
                        readStream.on("close", function () {
                            streamClosed.resolve(resourcePath);
                        });

                        hashes.generateMD5Hash(helper._fsApi.getResourcePath(context, resourcePath, opts)).then(function (resourceMd5) {
                            // For the resourceId, use the directory name (original ID) that was pulled.
                            const resourceId = path.basename(path.dirname(resourcePath));

                        // Push the resource to the content hub.
                        helper._restApi.pushItem(context, true, true, false, resourceId, resourceMd5, resourcePath, readStream, length, opts)
                            .then(function (resource) {
                                errorInfo = {id: resource.id || resourceId, path: resourcePath};

                                // Once the resource file has been saved, resolve the top-level promise.
                                /* istanbul ignore next */
                                if (WAIT_FOR_CLOSE) {
                                    // Also wait for the stream to close before resolving the top-level promise.
                                    streamClosed.promise
                                        .then(function () {
                                            deferred.resolve(resource);
                                        });
                                } else {
                                    deferred.resolve(resource);
                                }

                                // The push succeeded so emit a "resource-pushed" event.
                                const emitter = helper.getEventEmitter(context);
                                if (emitter) {
                                    emitter.emit("resource-pushed", {id: resource.id || resourceId, path: resourcePath});
                                }
                            })
                            .catch(function (err) {
                                // Failed to push the resource file, so explicitly close the read stream.
                                helper._closeStream(context, readStream, streamClosed);

                                    // Get the retry item for this asset, if one exists.
                                    const retryItem = err.retry && helper._getRetryItem(context, resourcePath, opts);

                                    // Retry the push of this asset if we have a retry item.
                                    if (retryItem) {
                                        // Log a warning that the push of this item will be retried.
                                        utils.logWarnings(context, i18n.__("pushed_item_retry", {name: resourcePath, message: err.log ? err.log : err.message}));

                                        // Retry the push after the calculated delay.
                                        setTimeout(function () {
                                            helper._pushResource(context, resourcePath, opts)
                                                .then(function (asset) {
                                                    deferred.resolve(asset);
                                                })
                                                .catch(function (err) {
                                                    deferred.reject(err);
                                                });
                                        }, retryItem[BaseHelper.RETRY_PUSH_ITEM_DELAY]);
                                    } else {
                                        // Reject the top-level promise.
                                        /* istanbul ignore next */
                                        if (WAIT_FOR_CLOSE) {
                                            // Also wait for the stream to close before rejecting the top-level promise.
                                            streamClosed.promise
                                                .then(function () {
                                                    deferred.reject(err);
                                                });
                                        } else {
                                            deferred.reject(err);
                                        }

                                        // The push failed so emit a "resource-pushed-error" event.
                                        const emitter = helper.getEventEmitter(context);
                                        if (emitter) {
                                            emitter.emit("resource-pushed-error", err, errorInfo);
                                        }
                                    }
                                });
                        })
                        .catch(function (err) {
                            // Failed getting the MD5 for the resource.
                            deferred.reject(err);
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

    _pushResourceList (context, paths, opts) {
        const helper = this;

        // If retry is enabled for this helper, handle any necessary setup.
        if (helper.isRetryPushEnabled()) {
            // Initialize the retry state on the context.
            context.retryPush = {};
            helper.initializeRetryPush(context, paths);

            // Add the filter for determining whether a failed push should be retried.
            context.filterRetryPush = helper.filterRetryPush.bind(this);
        }

        // Get the timestamp to set before we call the REST API.
        const timestamp = new Date();

        // Throttle the number of resources to be pushed concurrently, using the currently configured limit.
        const concurrentLimit = options.getRelevantOption(context, opts, "concurrent-limit", helper.getArtifactName());
        const results = utils.throttledAll(context, paths.map(function (path) {
            return function () {
                return helper._pushResource(context, path.path, opts);
            };
        }), concurrentLimit);

        // Return the promise to push all of the specified resources.
        let errorCount = 0;
        return results
            .then(function (promises) {
                // Keep track of the resources that were successfully pushed, and emit a "pushed-error" event for the others.
                const resources = [];
                promises.forEach(function (promise) {
                    if (promise.state === "fulfilled") {
                        resources.push(promise.value);
                    }
                    else {
                        // Rejected promises are logged by throttledAll(), so just determine the error count.
                        errorCount++;
                    }
                });
                return resources;
            })
            .then(function (resources) {
                // Keep track of the timestamp of this operation, but only if there were no errors.
                if (errorCount === 0) {
                    hashes.setLastPushTimestamp(context, helper._fsApi.getResourcesPath(context, opts), timestamp, opts);
                }
                return resources;
            })
            .finally(function () {
                // Once the promise has been settled, remove the retry push state from the context.
                delete context.retryPush;
                delete context.filterRetryPush;
            });
    }

    pushAllResources (context, opts) {
        // If we're only pushing (Fernando) web assets, don't bother pushing resources without asset references.
        // If the noVirtualFolder option has been specified, we can't push resources without asset references.
        if (opts && (opts[this.ASSET_TYPES] === this.ASSET_TYPES_WEB_ASSETS || opts.noVirtualFolder)) {
            // Just return a resolved promise.
            return Q();
        } else {
            const helper = this;
            return helper.listLocalResourceNames(context, opts)
                .then(function (resources) {
                    return helper._pushResourceList(context, resources, opts);
                });
        }
    }

    pushModifiedResources (context, opts) {
        // If we're only pushing (Fernando) web assets, don't bother pushing resources without asset references.
        // If the noVirtualFolder option has been specified, we can't push resources without asset references.
        if (opts && (opts[this.ASSET_TYPES] === this.ASSET_TYPES_WEB_ASSETS || opts.noVirtualFolder)) {
            // Just return a resolved promise.
            return Q();
        } else {
            const helper = this;
            return helper.listModifiedLocalResourceNames(context, [this.NEW, this.MODIFIED], opts)
                .then(function (resources) {
                    return helper._pushResourceList(context, resources, opts);
                });
        }
    }

    /**
     * Push the items in the current manifest from the local file system to the remote content hub.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} opts The options to be used for the push operations.
     *
     * @returns {Q.Promise} A promise to push the local items to the remote content hub.
     *
     * @resolves {Array} The items that were pushed.
     */
    pushManifestItems (context, opts) {
        // Get the items from the current manifest and push them to the content hub.
        const helper = this;
        return helper.getManifestItems(context, opts)
            .then(function (assets) {
                // Push each asset in the manifest, using the path property.
                return helper._pushNameList(context, assets.map(asset => asset.path), opts);
            });
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
        return helper._listLocalItemNames(context, opts)
            .then(function (names) {
                // Push the assets in the list.
                return helper._pushNameList(context, names.map(function (item) {
                    return item.path;
                }), opts);
            })
            .then(function (results) {
                if (options.getRelevantOption(context, opts, "disablePushPullResources") === true) {
                    return results;
                } else {
                    return helper.pushAllResources(context, opts)
                        .then(function (resourceResults) {
                            return results;
                        });
                }
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
        return helper._listModifiedLocalItemNames(context, [this.NEW, this.MODIFIED], opts)
            .then(function (names){
                // Push the assets in the list.
                return helper._pushNameList(context, names.map(function (item) {
                    return item.path;
                }), opts);
            })
            .then(function (results) {
                if (options.getRelevantOption(context, opts, "disablePushPullResources") === true) {
                    return results;
                } else {
                    return helper.pushModifiedResources(context, opts)
                        .then(function (resourceResults) {
                            return results;
                        })
                }
            });
    }

    /**
     * Determine whether retry push is enabled.
     *
     * @returns {Boolean} A return value of true indicates that retry push is enabled.
     *
     * @override
     */
    isRetryPushEnabled () {
        return true;
    }

    /**
     * Determine whether the push that failed with the given error should be retried.
     *
     * @param {Object} context The current context to be used by the API.
     * @param {Error} error The error returned from the failed push operation.
     * @param {Object} opts - The options to be used for the push operation.
     *
     * @returns {Boolean} A return value of true indicates that the push should be retried.
     *
     * @override
     */
    filterRetryPush (context, error, opts) {
        let retVal = false;

        if (utils.retryNetworkErrors(error) ) {
            retVal = true;
        } else if (error.statusCode) {
            // Determine whether the request should be retried, based on the status code for the error.
            switch (error.statusCode) {
                // 403 Forbidden - Handle the special case that sometimes occurs during authorization. In general we
                // wouldn't retry on this error, but if it happens during authorization, a retry frequently succeeds.
                case 403: {
                    retVal = true;
                    // For a 403, don't bother retrying if the error code is 3193 (operation not allowed based on tenant tier).
                    const response = error.response;
                    if (response && response.body && response.body.errors && response.body.errors.length > 0) {
                        response.body.errors.forEach(function (e) {
                            if (e.code === 3193) {
                                retVal = false;
                            }
                        });
                    }
                    break;
                }
                // 429 Too Many Requests - The user has sent too many requests in a given amount of time ("rate limiting").
                case 429:
                // 500 Internal Server Error - The server has encountered a situation it doesn't know how to handle.
                case 500:
                // 502 Bad Gateway - The server is working as a gateway and got an invalid response needed to handle the request.
                case 502:
                // 503 Service Unavailable - The server is not ready to handle the request. It could be down for maintenance or just overloaded.
                case 503:
                // 504 Gateway Timeout - The server is acting as a gateway and cannot get a response in time.
                case 504: {
                    retVal = true;
                    break;
                }
                default: {
                    // Look for any other status codes that should be retried for this service.
                    const otherCodes = options.getRelevantOption(context, opts, "retryStatusCodes", this._restApi.getServiceName());
                    retVal = otherCodes && (otherCodes.length > 0) && (otherCodes.indexOf(error.statusCode) !== -1);
                }
            }
        }

        return retVal;
    }

    /**
     * Determine whether retry delete is enabled.
     *
     * @returns {Boolean} A return value of true indicates that retry delete is enabled.
     *
     * @override
     */
    isRetryDeleteEnabled () {
        return true;
    }

    /**
     * Determine whether the given error indicates that the delete should be retried.
     *
     * @param {Object} context The current context to be used by the API.
     * @param {Error} error The error returned from the failed delete operation.
     *
     * @returns {Boolean} A return value of true indicates that the delete should be retried.
     *
     * @override
     */
    filterRetryDelete (context, error) {
        let retVal = false;
        // A reference error has a response code of 400 and an error code equal to 3008, or in the range 6000 - 7000.
        if (error && error["response"] && (error["response"]["statusCode"] === 400)) {
            const responseBody = error["response"]["body"];
            if (responseBody && responseBody["errors"] && responseBody["errors"].length > 0) {
                // The response has returned one or more errors. If any of these is a reference error, then return true.
                // That means we'll retry the delete again, even though any non-reference errors might not benefit from
                // the retry. This shouldn't be an issue though, because if the retry does not delete at least one item,
                // a subsequent retry will not be attempted.
                retVal = responseBody["errors"].some(function (error) {
                    const ecode = error["code"];
                    const assetRefNotFound = (ecode === 3008);
                    const generalRefNotFound = (ecode >= 6000 && ecode < 7000);
                    return (assetRefNotFound || generalRefNotFound);
                });
            }
        }
        return retVal;
    }

    /**
     * Filter the given list of assets before completing the list operation.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Array} assetList The assets to be listed.
     * @param {Object} opts The options to be used for this operations.
     *
     * @returns {Array} The filtered list of assets.
     *
     * @protected
     */
    _listFilter (context, assetList, opts) {
        const helper = this;

        // Filter the asset list based on the ready and draft options.
        const readyOnly = options.getRelevantOption(context, opts, "filterReady");
        const draftOnly = options.getRelevantOption(context, opts, "filterDraft");
        if (readyOnly) {
            // Filter out any assets that are not ready.
            assetList = assetList.filter(function (asset) {
                return (!asset.status || asset.status === "ready");
            });
        } else if (draftOnly) {
            // Filter out any assets that are not draft.
            assetList = assetList.filter(function (asset) {
                return (asset.status === "draft");
            });
        }

        // If web assets only, filter out the content assets.
        if (opts && opts[helper.ASSET_TYPES] === helper.ASSET_TYPES_WEB_ASSETS) {
            assetList = assetList.filter(function (asset) {
                return (!helper._fsApi.isContentResource(asset));
            });
        }

        // If content assets only, filter out the web assets.
        if (opts && opts[helper.ASSET_TYPES] === helper.ASSET_TYPES_CONTENT_ASSETS) {
            assetList = assetList.filter(function (asset) {
                return (helper._fsApi.isContentResource(asset));
            });
        }

        // Get the path used to filter artifacts.
        let filterPath = options.getRelevantOption(context, opts, "filterPath");
        if (filterPath) {
            filterPath = utils.formatFilterPath(filterPath);
            assetList = assetList.filter(function (asset) {
                return (asset.path && asset.path.indexOf(filterPath) === 0);
            });
        }

        return assetList;
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
    _listItemChunk (context, listFn, opts) {
        // Get the next "chunk" of assets metadata.
        const helper = this;
        return listFn(opts)
            .then(function (assetList) {
                const chunkLength = assetList.length;

                // Filter the assets before listing them.
                assetList = helper._listFilter(context, assetList, opts);

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
        // Add the assets listed in the most recent chunk to the existing results.
        results = results.concat(listInfo.assets);

        const currentChunkSize = listInfo.length;
        const maxChunkSize = options.getRelevantOption(context, opts, "limit", this.getArtifactName());
        if (currentChunkSize === 0 || currentChunkSize < maxChunkSize) {
            // The current chunk is a partial chunk, so there are no more assets to be retrieved. Resolve the promise
            // with the accumulated results.
            deferred.resolve(results);
        } else {
            // The current chunk is a full chunk, so there may be more assets to retrieve.
            const helper = this;

            // Increase the offset so that the next chunk of assets will be retrieved.
            const offset = options.getRelevantOption(context, opts, "offset", helper.getArtifactName());
            opts = utils.cloneOpts(opts, {offset: offset + maxChunkSize});

            // List the next chunk of assets from the content hub.
            helper._listItemChunk(context, listFn, opts)
                .then(function (listInfo) {
                    helper._recurseList(context, listFn, deferred, results, listInfo, opts);
                });
        }
    }

    /**
     * Determine whether the helper supports deleting items recursively by path.
     */
    supportsDeleteByPathRecursive () {
        return true;
    }

    searchRemote (context, searchOptions, opts, path, recursive) {
        const deferred = Q.defer();

        if (!path) {
            searchOptions["fl"] = ["name", "id", "path"];
            return super.searchRemote(context, searchOptions, opts);
        }

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

        // define a list function to work with the _listItemChunk/_recurseList methods for handling paging
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
        opts = utils.cloneOpts(opts, {offset: offset, limit: limit});

        // Get the first chunk of search results, and then recursively retrieve any additional chunks.
        const helper = this;
        helper._listItemChunk(context, listFn, opts)
            .then(function (listInfo) {
                // Pass an empty array for results to indicate that we retrieved the first chunk. The deferred will be
                // resolved when all chunks have been retrieved. However, the retrieval process will never reject the
                // deferred, so we have to handle that explicitly.
                helper._recurseList(context, listFn, deferred, [], listInfo, opts);
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
    _listRemoteItemNames (context, opts) {
        // Create the deferred to be used for recursively retrieving assets.
        const deferred = Q.defer();

        // Recursively call AssetsREST.getItems() to retrieve all of the remote assets.
        const listFn = this._restApi.getItems.bind(this._restApi, context);

        // Get the first chunk of remote assets, and then recursively retrieve any additional chunks.
        const helper = this;
        helper._listItemChunk(context, listFn, opts)
            .then(function (listInfo) {
                // Pass an empty array for results to indicate that we retrieved the first chunk. The deferred will be
                // resolved when all chunks have been retrieved. However, the retrieval process will never reject the
                // deferred, so we have to handle that explicitly.
                helper._recurseList(context, listFn, deferred, [], listInfo, opts);
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
                    return {
                        path: helper._fsApi.getAssetPath(asset),
                        name: asset.name,
                        id: asset.id
                    };
                });
            });
    }

    /**
     * Get a list of the names of all remote assets.
     * This function serves as an entry point for the list command and should not be internally called otherwise.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} opts - The options to be used for this operation.
     *
     * @returns {Q.Promise} - A promise for an array of the names of all remote assets.
     */
    listRemoteItemNames (context, opts) {
        const helper = this;
        return this._listRemoteItemNames(context, opts)
            .then(function(itemList) {
                helper._updateManifest(context, itemList, opts);
                return itemList;
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
                        const metadataPath = helper._fsApi.getMetadataPath(context, helper._fsApi.getAssetPath(item), opts);
                        const itemPath = helper._fsApi.getPath(context, opts) + helper._fsApi.getAssetPath(item);
                        return hashes.isRemoteModified(context, flags, item, dir, metadataPath, itemPath, opts);
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
    _listModifiedRemoteItemNames (context, flags, opts) {
        const deferred = Q.defer();

        // Use getModifiedRemoteItems() as the list function, so that only modified assets will be pulled.
        const helper = this;
        const listFn = helper.getModifiedRemoteItems.bind(this, context, flags);
        helper._listItemChunk(context, listFn, opts)
            .then(function (listInfo) {
                // There are no results initially, so just pass an empty array for the results. The accumulated array of
                // asset metadata for all listed items will be available when "deferred" has been resolved.
                helper._recurseList(context, listFn, deferred, [], listInfo, opts);
            })
            .catch(function (err) {
                // There was an error listing the assets.
                deferred.reject(err);
            });

        return deferred.promise
            .then(function (items) {
                // The list results contain the path of each modified asset.
                const results = items.map(function (item) {
                    return {
                        path: helper._fsApi.getAssetPath(item),
                        id: item.id
                    };
                });

                // Add the deleted assets if the flag was specified.
                if (flags.indexOf(helper.DELETED) !== -1) {
                    return helper.listRemoteDeletedNames(context, opts)
                        .then(function (items) {
                            items.forEach(function (item) {
                                results.push(item);
                            });
                            return results;
                        });
                } else {
                    return results;
                }
            });
    }

    /**
     * Get a list of the names of all remote assets that have been modified.
     * This function serves as an entry point for the list command and should not be internally called otherwise.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Array} flags - An array of the state (NEW, DELETED, MODIFIED) of the assets to be included in the list.
     * @param {Object} opts - The options to be used for this operation.
     *
     * @returns {Q.Promise} - A promise for an array of the names of all remote assets that were modified since being
     *                        pushed/pulled.
     */
    listModifiedRemoteItemNames (context, flags, opts) {
        const helper = this;
        return this._listModifiedRemoteItemNames(context, flags, opts)
            .then(function(itemList) {
                helper._updateManifest(context, itemList, opts);
                return itemList;
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
        helper._listRemoteItemNames(context, opts)
            .then(function (remoteItems) {
                // Get the list of local assets that are known to have existed on the server.
                const dir = helper._fsApi.getAssetsPath(context, opts);
                const localItems = hashes.listFiles(context, dir, opts);

                const remotePaths = remoteItems.map(function (item) {
                    return item.path;
                });
                // The deleted assets are the ones that exist in the local list but not in the remote list.
                const deletedNames = localItems
                    .filter(function (item) {
                        return (remotePaths.indexOf(item.path) === -1);
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
    _listLocalItemNames (context, opts) {
        const readyOnly = options.getRelevantOption(context, opts, "filterReady");
        const draftOnly = options.getRelevantOption(context, opts, "filterDraft");

        if (readyOnly || draftOnly) {
            // Make sure the proxy items contain the status (only exists on content assets).
            opts = utils.cloneOpts(opts, {"additionalItemProperties": ["status"]});
        }

        return this._fsApi.listNames(context, null, opts)
            .then(function (assets) {
                // Filter the asset list based on the ready and draft options.
                if (readyOnly) {
                    // Filter out any assets that are draft.
                    assets = assets.filter(function (asset) {
                        return (!asset.status || asset.status === "ready");
                    });
                } else if (draftOnly) {
                    // Filter out any assets that are not draft.
                    assets = assets.filter(function (asset) {
                        return (asset.status === "draft");
                    });
                }

                return assets;
            });
    }

    /**
     * Get a list of local asset names, based on the specified options.
     * This function serves as an entry point for the list command and should not be internally called otherwise.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} opts - The options to be used for the list operation.
     *
     * @returns {Q.Promise} A promise for a list of local asset names, based on the specified options.
     */
    listLocalItemNames (context, opts) {
        const helper = this;
        return this._listLocalItemNames(context, opts)
            .then(function(itemList) {
                helper._updateManifest(context, itemList, opts);
                return itemList;
            });
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
    _listModifiedLocalItemNames (context, flags, opts) {
        // Get the list of local asset paths.
        const dir = this._fsApi.getAssetsPath(context, opts);

        const readyOnly = options.getRelevantOption(context, opts, "filterReady");
        const draftOnly = options.getRelevantOption(context, opts, "filterDraft");

        if (readyOnly || draftOnly) {
            // Make sure the proxy items contain the status (only exists on content assets).
            opts = utils.cloneOpts(opts, {"additionalItemProperties": ["status"]});
        }

        const helper = this;
        return helper._fsApi.listNames(context, null, opts)
            .then(function (assets) {
                // Filter the list so that it only contains modified asset paths.
                assets = assets.filter(function (asset) {
                        const metadataPath = helper._fsApi.getMetadataPath(context, asset.path, opts);
                        const path = helper._fsApi.getPath(context, opts) + asset.path;
                        return hashes.isLocalModified(context, flags, dir, metadataPath, path, opts);
                    });

                // Filter the asset list based on the ready and draft options.
                if (readyOnly) {
                    // Filter out any assets that are draft.
                    assets = assets.filter(function (asset) {
                        return (!asset.status || asset.status === "ready");
                    });
                } else if (draftOnly) {
                    // Filter out any assets that are not draft.
                    assets = assets.filter(function (asset) {
                        return (asset.status === "draft");
                    });
                }

                // Add the deleted asset paths if the flag was specified.
                if (flags.indexOf(helper.DELETED) !== -1) {
                    return helper.listLocalDeletedNames(context, opts)
                        .then(function (deletedAssets) {
                            deletedAssets.forEach(function (asset) {
                                assets.push(asset);
                            });
                            return assets;
                        });
                } else {
                    return assets;
                }
            });
    }

    /**
     * Get a list of modified local asset paths, based on the specified options.
     * This function serves as an entry point for the list command and should not be internally called otherwise.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Array} flags - An array of the state (NEW, DELETED, MODIFIED) of the assets to be included in the list.
     * @param {Object} opts - The options to be used for the list operation.
     *
     * @returns {Q.Promise} A promise for a list of modified local asset paths, based on the specified options.
     */
    listModifiedLocalItemNames (context, flags, opts) {
        const helper = this;
        return this._listModifiedLocalItemNames(context, flags, opts)
            .then(function(itemList) {
                helper._updateManifest(context, itemList, opts);
                return itemList;
            });
    }

    /**
     * Get a list of local resource names, based on the specified options.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} opts - The options to be used for the list operation.
     *
     * @returns {Q.Promise} A promise for a list of local resource names, based on the specified options.
     */
    listLocalResourceNames (context, opts) {
        // Get the list of resource paths on the local file system.
        return this._fsApi.listResourceNames(context, opts);
    }

    /**
     * Get a list of modified local resource paths, based on the specified options.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Array} flags - An array of the state (NEW, DELETED, MODIFIED) of the resources to be included in the list.
     * @param {Object} opts - The options to be used for the list operation.
     *
     * @returns {Q.Promise} A promise for a list of modified local resource paths, based on the specified options.
     */
    listModifiedLocalResourceNames (context, flags, opts) {
        // Get the list of local resource paths.
        const dir = this._fsApi.getResourcesPath(context, opts);

        const helper = this;
        return helper._fsApi.listResourceNames(context, opts)
            .then(function (resources) {
                // Filter the list so that it only contains modified resource paths.
                const results = resources
                    .filter(function (resource) {
                        const path = helper._fsApi.getResourcePath(context, resource.path, opts);
                        return hashes.isLocalModified(context, flags, dir, undefined, path, opts);
                    });

                return results;
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
        const localAssets = hashes.listFiles(context, dir, opts);

        const readyOnly = options.getRelevantOption(context, opts, "filterReady");
        const draftOnly = options.getRelevantOption(context, opts, "filterDraft");

        // Get the list of deleted local assets.
        const deletedAssetPaths = localAssets
            .filter(function (asset) {
                // An asset is considered to be deleted if it's stat cannot be retrieved.
                let stat;
                try {
                    stat = fs.statSync(dir + asset.path);
                } catch (ignore) {
                    // Ignore this error and assume the asset is deleted.
                }
                return !stat;
            })
            .filter(function (asset) {
                // Filter the item list based on the ready and draft options.
                const draft = asset.id && (asset.id.indexOf(":") >= 0);
                if ((readyOnly && draft) || (draftOnly && !draft)) {
                    // Filter out any items that do not match the specified option.
                    return false;
                } else {
                    return true;
                }
            });

        // Resolve with the list of deleted asset paths.
        deferred.resolve(deletedAssetPaths);

        return deferred.promise;
    }

    /**
     * Delete the specified local item.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} item The asset to be deleted.
     * @param {Object} opts The options to be used for the delete operation.
     *
     * @returns {Q.Promise} A promise to delete the item.
     */
    deleteLocalItem (context, item, opts) {
        const helper = this;

        // Add the item to the deletions manifest, if one was specified.
        this._updateDeletionsManifest(context, [item], opts);

        // Delete the specified item from the local file system.
        return helper._fsApi.deleteAsset(context, item.path, opts)
            .then(function (filepath) {
                if (filepath) {
                    // The delete was successful, so remove the hashes information for the item.
                    const basePath = helper._fsApi.getPath(context, opts);
                    hashes.removeHashesByPath(context, basePath, item.path, opts);

                    // Delete the metadata if this is a managed asset.
                    if (helper._fsApi.isContentResource(item.path)) {
                        // Delete the metadata file.
                        return helper._fsApi.deleteMetadata(context, item.path, opts)
                            .then(function () {
                                // Remove any empty parent folders that were created for the managed asset.
                                utils.removeEmptyParentDirectories(basePath, filepath)
                            });
                    } else {
                        // Remove any empty parent folders for the deleted web asset.
                        utils.removeEmptyParentDirectories(basePath, filepath)
                    }
                }
            });
    }

    /**
     * Delete the specified local resource.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} resource The resource to be deleted.
     * @param {Object} opts - The options to be used for the delete operation.
     *
     * @returns {Q.Promise} A promise for the deleted resource.
     */
    deleteLocalResource (context, resource, opts) {
        const helper = this;

        // Delete the specified resource from the local file system.
        return helper._fsApi.deleteResource(context, resource.path, opts)
            .then(function (filepath) {
                if (filepath) {
                    // The delete was successful, so remove the hashes information for the item.
                    const basePath = helper._fsApi.getResourcesPath(context, opts);
                    hashes.removeHashesByPath(context, basePath, resource.path, opts);

                    // Remove any empty parent folders.
                    utils.removeEmptyParentDirectories(basePath, filepath)
                }
            });
    }

    /**
     * Determine whether the given item can be deleted.
     *
     * @param {Object} item The item to be deleted.
     * @param {Object} isDeleteAll Flag that indicates whether the item will be deleted during a delete all operation.
     * @param {Object} opts - The options to be used for the delete operation.
     *
     * @returns {Boolean} A return value of true indicates that the item can be deleted. A return value of false
     *                    indicates that the item cannot be deleted.
     *
     * @override
     */
    canDeleteItem (item, isDeleteAll, opts) {
        if (isDeleteAll) {
            if (opts && opts[this.ASSET_TYPES] === this.ASSET_TYPES_WEB_ASSETS) {
                // Filter out any content assets.
                return !this._fsApi.isContentResource(item);
            } else if (opts && opts[this.ASSET_TYPES] === this.ASSET_TYPES_CONTENT_ASSETS) {
                // Filter out any web assets.
                return this._fsApi.isContentResource(item);
            }
        }

        return super.canDeleteItem(item, isDeleteAll, opts);
    }

    /**
     * Delete the specified remote item.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} item The item to be deleted.
     * @param {Object} opts The options to be used for the delete operation.
     *
     * @returns {Q.Promise} A promise for the deleted item.
     */
    deleteRemoteItem (context, item, opts) {
        const deferred = Q.defer();
        if (item && !item.id && item.path) {
            this._restApi.getItemByPath(context, item.path, opts)
                .then(function (newItem) {
                    deferred.resolve(newItem);
                })
                .catch(function (err) {
                    deferred.reject(err);
                });
        } else {
            deferred.resolve(item);
        }

        const superDeleteRemoteItem = super.deleteRemoteItem.bind(this);
        return deferred.promise.then(function (itemToDelete) {
            return superDeleteRemoteItem(context, itemToDelete, opts);
        });
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
            const maxChunkSize = options.getRelevantOption(context, opts, "limit", this.getArtifactName());

            if (currentChunkSize === 0 || currentChunkSize < maxChunkSize) {
                // The current chunk is a partial chunk, so there are no more assets to be retrieved. Reject the promise
                // with an appropriate error.
                deferred.reject(new Error(i18n.__("remote_asset_not_found") + path));
            } else {
                // The current chunk is a full chunk, so there may be more assets to retrieve.
                const helper = this;

                // Increase the offset so that the next chunk of assets will be retrieved.
                const offset = options.getRelevantOption(context, opts, "offset", this.getArtifactName());
                opts = utils.cloneOpts(opts, {offset: offset + maxChunkSize});

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
    _setLastPullTimestamps (context, timestamp, opts) {
        const timestamps = this._getLastPullTimestamps(context, opts);
        if (opts && opts[this.ASSET_TYPES] === this.ASSET_TYPES_WEB_ASSETS) {
            timestamps.webAssets = timestamp;
        } else if (opts && opts[this.ASSET_TYPES] === this.ASSET_TYPES_CONTENT_ASSETS) {
            timestamps.contentAssets = timestamp;
        } else {
            timestamps.webAssets = timestamps.contentAssets = timestamp;
        }
        hashes.setLastPullTimestamp(context, this._fsApi.getAssetsPath(context, opts), timestamps, opts);
    }

    /**
     * Sets the last push timestamps.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param opts
     */
    _setLastPushTimestamps (context, timestamp, opts) {
        const timestamps = this._getLastPushTimestamps(context, opts);
        if (opts && opts[this.ASSET_TYPES] === this.ASSET_TYPES_WEB_ASSETS) {
            timestamps.webAssets = timestamp;
        } else if (opts && opts[this.ASSET_TYPES] === this.ASSET_TYPES_CONTENT_ASSETS) {
            timestamps.contentAssets = timestamp;
        } else {
            timestamps.webAssets = timestamps.contentAssets = timestamp;
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
}

// Export the AssetsHelper class.
module.exports = AssetsHelper;
