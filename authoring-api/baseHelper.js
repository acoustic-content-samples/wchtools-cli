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
const options = require("./lib/utils/options.js");
const utils = require("./lib/utils/utils.js");
const hashes = require("./lib/utils/hashes.js");
const i18n = utils.getI18N(__dirname, ".json", "en");
const SearchREST = require("./lib/authoringSearchREST.js");
const searchREST = SearchREST.instance;

/**
 * Base class for API helper objects.
 *
 * Note: A helper object provides access to both the REST API and the local file system for a single artifact type.
 *
 * @class BaseHelper
 */
class BaseHelper {
    /**
     * Name of a retry property (Number) that specifies how many items were attempted for the current push operation.
     */
    static get RETRY_PUSH_ITEM_COUNT () { return "itemCount"; };

    /**
     * Name of a retry property (Array) that contains the items whose push operation failed and will be retried.
     */
    static get RETRY_PUSH_ITEMS () { return "items"; };

    /**
     * Name of an item property (String) that contains the name of the item whose push operation will be retried.
     */
    static get RETRY_PUSH_ITEM_NAME () { return "name"; };

    /**
     * Name of an item property (Error) that contains the error for the failed push operation.
     */
    static get RETRY_PUSH_ITEM_ERROR () { return "error"; };

    /**
     * Name of an item property (String) that contains the heading for the failed push operation.
     */
    static get RETRY_PUSH_ITEM_HEADING () { return "heading"; };

    /**
     * Name of an item property (String) that contains the delay for the retried push operation.
     */
    static get RETRY_PUSH_ITEM_DELAY () { return "delay"; };

    /**
     * Name of a retry property (Array) that contains the items whose delete operation failed and will be retried.
     */
    static get RETRY_DELETE_ITEMS () { return "items"; };

    /**
     * Name of an item property (String) that contains the item whose delete operation will be retried.
     */
    static get RETRY_DELETE_ITEM () { return "item"; };

    /**
     * Name of an item property (Error) that contains the error for the failed delete operation.
     */
    static get RETRY_DELETE_ITEM_ERROR () { return "error"; };

    /**
     * Name of an item property (String) that contains the heading for the failed delete operation.
     */
    static get RETRY_DELETE_ITEM_HEADING () { return "heading"; };

    /**
     * The base constructor for a helper object.
     *
     * @constructs BaseHelper
     *
     * @param {BaseREST} restApi - The REST API object managed by this helper.
     * @param {BaseFS} fsApi - The FS object managed by this helper.
     * @param {String} artifactName - The name of the "artifact type" managed by this helper.
     * @param {String} classification - Optional classification of the artifact type - defaults to artifactName
     */
    constructor (restApi, fsApi, artifactName, classification) {
        /**
         * @member {BaseREST} _restApi - The REST API object managed by this helper.
         */
        this._restApi = restApi;

        /**
         * @member {BaseFS} _fsApi - The FS object managed by this helper.
         */
        this._fsApi = fsApi;

        /**
         * @member {String} _artifactName - The name of the "artifact type" managed by this helper.
         */
        this._artifactName = artifactName;

        /**
         * @member {String} _classification - The classification of the "artifact type" managed by this helper.
         */
        this._classification = classification || artifactName;

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
    }

    /**
     * Get the event emitter associated with this helper.
     *
     * @param {Object} context The current context to be used by the API.
     *
     * @returns {Object} The event emitter used by the Assets Helper.
     */
    getEventEmitter (context) {
        return context.eventEmitter;
    }

    /**
     * Get the logger used by this helper.
     *
     * @param {Object} context The current context to be used by the API.
     *
     * @returns {Object} The logger used by this helper.
     */
    getLogger (context) {
        return context.logger;
    }

    /**
     * Get the name of the virtual folder used by this helper.
     *
     * @returns {String} The name of the virtual folder used by this helper.
     */
    getVirtualFolderName (opts) {
        // The "noVirtualFolder" option can be used to store artifacts directly in the specified working folder.
        if (opts && opts.noVirtualFolder) {
            return "";
        }
        return this._fsApi.getFolderName();
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
     * Delete the specified local item.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} item The item to be deleted.
     * @param {Object} opts The options to be used for the delete operation.
     *
     * @returns {Q.Promise} A promise for the deleted item.
     */
    deleteLocalItem (context, item, opts) {
        const helper = this;

        // Delete the specified item from the local file system.
        return helper._fsApi.deleteItem(context, item, opts)
            .then(function (filepath) {
                if (filepath) {
                    // The delete was successful, so remove the hashes information for the item.
                    const basePath = helper._fsApi.getPath(context, opts);
                    hashes.removeHashes(context, basePath, [item.id], opts);

                    // Remove any empty parent folders that were created for the item.
                    utils.removeEmptyParentDirectories(basePath, filepath)
                }

                return item;
            });
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
        const helper = this;
        return helper._restApi.deleteItem(context, item, opts)
            .then(function () {
                // The delete was successful, so update the hashes.
                const basePath = helper._fsApi.getPath(context, opts);
                hashes.removeHashes(context, basePath, [item.id], opts);

                return item;
            })
            .catch(function (err) {
                // Determine whether the delete of this item should be retried.
                if (err.retry) {
                    // Add a retry entry to the helper.
                    const retryProperties = {};
                    const serviceName = helper._restApi.getServiceName();
                    const heading = i18n.__("delete_item_error", {service_name: serviceName}) + helper.getName(item);
                    retryProperties[BaseHelper.RETRY_DELETE_ITEM] = item;
                    retryProperties[BaseHelper.RETRY_DELETE_ITEM_ERROR] = err;
                    retryProperties[BaseHelper.RETRY_DELETE_ITEM_HEADING] = heading;
                    helper.addRetryDeleteProperties(context, retryProperties);
                }

                // Rethrow the error to propogate it back to the caller.
                throw(err);
            });
    }

    /**
     * Delete the items on the remote content hub.
     *
     * @param {Object} context The API context to be used by the delete operation.
     * @param {Object} opts The options to be used to delete the items.
     *
     * @returns {Q.Promise} A promise to delete the items on the remote content hub.
     *
     * @resolves When all items have been deleted or resulted in an error.
     * @rejects {Error} An error that occurred during the delete. Note that errors occurring during the delete of an
     *                  individual item do not cause the promise to be rejected.
     */
    deleteRemoteItems (context, opts) {
        // Create a deferred object to control the timing of this operation.
        const deferred = Q.defer();
        const self = this;

        // Retry is only available if it is enabled for this helper.
        if (self.isRetryDeleteEnabled()) {
            // Initialize the retry state on the context.
            context.retryDelete = {};
            self.initializeRetryDelete(context);

            // Add the filter for determining whether a failed delete should be retried.
            context.filterRetryDelete = self.filterRetryDelete.bind(self);
        }

        // Delete a "chunk" of remote items and then recursively delete any remaining chunks.
        const listFn = self.getRemoteItems.bind(self, context);
        self._deleteItemsChunk(context, listFn, opts)
            .then(function (deleteInfo) {
                // Need to adjust the offset because getRemoteItems() is affected by deleting items.
                deleteInfo.adjustOffset = true;

                // Start with an empty array that will accumulate deleted items.
                return self._recurseDelete(context, listFn, [], deleteInfo, opts);
            })
            .then(function (deletedItems) {
                // Recursive function for handling retries.
                const retryDeleteItems = function (items) {
                    // Check to see if a retry is required.
                    const retryItems = self.getRetryDeleteProperty(context, BaseHelper.RETRY_DELETE_ITEMS);
                    if (retryItems && retryItems.length > 0) {
                        // There are items to retry, so check to see whether any delete operations were successful.
                        if (items.length > 0) {
                            // There was at least one successful delete during the current cycle, so proceed with the retry.
                            const itemsToDelete = [];
                            retryItems.forEach(function (retryItem) {
                                // Add each retry item to the list of items to be deleted.
                                const item = retryItem[BaseHelper.RETRY_DELETE_ITEM];
                                itemsToDelete.push(item);

                                // Log a warning that the delete of this item will be retried.
                                const error = retryItem[BaseHelper.RETRY_DELETE_ITEM_ERROR];
                                const name = self.getName(item);
                                utils.logWarnings(context, i18n.__("deleted_item_retry", {name: name, message: error.log ? error.log : error.message}));
                            });

                            // Initialize the retry values and then retry the delete of the items in the list.
                            self.initializeRetryDelete(context);

                            // List function for getting the items to be retried.
                            const limit = options.getRelevantOption(context, opts, "limit", self._artifactName);
                            const getRetryChunk = function (context, opts) {
                                const deferredChunk = Q.defer();
                                const offset = options.getRelevantOption(context, opts, "offset", self._artifactName);

                                if (offset >= itemsToDelete.length) {
                                    // Past the end of the array.
                                    deferredChunk.resolve([]);
                                } else {
                                    // Before the end of the array
                                    deferredChunk.resolve(itemsToDelete.slice(offset, offset + limit));
                                }

                                return deferredChunk.promise;
                            };

                            // Retry the delete of the items in the list.
                            const listFn = getRetryChunk.bind(self, context);
                            self._deleteItemsChunk(context, listFn, opts)
                                .then(function (deleteInfo) {
                                    // Do not adjust the offset, the list function is not affected when deleting items.
                                    deleteInfo.adjustOffset = false;

                                    // Start over with an empty array so we can tell if additional items were deleted.
                                    return self._recurseDelete(context, listFn, [], deleteInfo, opts);
                                })
                                .then(function (items) {
                                    // Add the items that were deleted on retry to the list of deleted items.
                                    deletedItems = deletedItems.concat(items);

                                    // Recursive call to continue retry handling.
                                    retryDeleteItems(items);
                                })
                                .catch(function (err) {
                                    deferred.reject(err);
                                });
                        } else {
                            // There were no successful deletes during the current cycle, so do not retry again.
                            retryItems.forEach(function (retryItem) {
                                // Emit a "deleted-error" event and log the error for each undeleted item.
                                const item = retryItem[BaseHelper.RETRY_DELETE_ITEM];
                                const error = retryItem[BaseHelper.RETRY_DELETE_ITEM_ERROR];
                                const heading = retryItem[BaseHelper.RETRY_DELETE_ITEM_HEADING];
                                delete error.retry;

                                const emitter = self.getEventEmitter(context);
                                if (emitter) {
                                    emitter.emit("deleted-error", error, item);
                                }
                                utils.logErrors(context, heading, error);
                            });

                            // Resolve the promise now that there are no more items to delete.
                            deferred.resolve(deletedItems);
                        }
                    } else {
                        // There were no items to retry, so resolve the promise.
                        deferred.resolve(deletedItems);
                    }
                };

                // Start the recursive retry handling.
                retryDeleteItems(deletedItems);
            })
            .catch(function (err) {
                deferred.reject(err);
            });

        return deferred.promise
            .finally(function () {
                // Once the promise has been settled, remove the retry delete state from the context.
                delete context.retryDelete;
                delete context.filterRetryDelete;
            });
    }

    /**
     * Delete the remote items returned from the given list function.
     *
     * @param {Object} context The API context to be used by the delete operation.
     * @param {Function} listFn A function that returns a promise for a chunk of items to be deleted.
     * @param {Object} opts The options to be used to delete the items.
     *
     * @returns {Q.Promise} A promise to delete the items on the remote content hub.
     *
     * @resolves {Array} Information about the deleted chunk -- number of items processed and array of deleted items.
     * @rejects {Error} An error that occurred during the delete. Note that errors occurring during the delete of an
     *                  individual item do not cause the promise to be rejected.
     */
    _deleteItemsChunk (context, listFn, opts) {
        const deferred = Q.defer();
        const self = this;
        const emitter = self.getEventEmitter(context);
        const concurrentLimit = options.getRelevantOption(context, opts, "concurrent-limit", self._artifactName);

        listFn(opts)
            .then(function (items) {
                // Keep track of the original number of items in the chunk.
                const chunkSize = items.length;

                // Filter the list of remote items to remove any that should not be deleted.
                items = items.filter(function (item) {
                    return self.canDeleteItem(item, true, opts);
                });

                // Delete the items remaining in the list.
                const functions = items.map(function (item) {
                    return function () {
                        return self.deleteRemoteItem(context, item, opts)
                            .then(function () {
                                // Emit a "deleted" event so that listeners know the item was deleted.
                                if (emitter) {
                                    emitter.emit("deleted", item);
                                }

                                return item;
                            })
                            .catch(function (err) {
                                if (emitter) {
                                    // If the item no longer exists, assume it was deleted automatically.
                                    if (err.statusCode === 404) {
                                        // Emit a "deleted" event so that listeners know the item was deleted.
                                        emitter.emit("deleted", item);
                                    }
                                    else if (!err.retry) {
                                        // Emit a "deleted-error" event so that listeners know the item was not deleted.
                                        emitter.emit("deleted-error", err, item);
                                    }
                                }

                                throw err;
                            });
                    };
                });

                return utils.throttledAll(context, functions, concurrentLimit)
                    .then(function (promises) {
                        // Get the list of items that were successfully deleted.
                        const items = [];
                        promises.forEach(function (promise) {
                            if (promise.state === "fulfilled") {
                                const item = promise.value;
                                items.push(item);
                            }
                        });

                        // Resolve with the number of items in the chunk and an array of deleted items.
                        deferred.resolve({chunkSize: chunkSize, items: items});
                    });
            })
            .catch(function (err) {
                deferred.reject(err);
            });

        // Return the promise that will eventually be resolved in the deleteItems function.
        return deferred.promise;
    }

    /**
     * Recursive function to delete subsequent chunks of items retrieved by the given function.
     *
     * @param {Object} context - The context to be used for the delete operation.
     * @param {Function} listFn - A function that returns a promise for a chunk of remote items to be deleted.
     * @param {Array} results - The accumulated set of deleted items.
     * @param {Object} deleteInfo - The number of items processed (either success or failure) and an array of deleted items.
     * @param {Object} opts - The options to be used for the delete operations.
     *
     * @returns {Q.Promise} A promise that will be resolved with *all* assets deleted.
     *
     * @private
     */
    _recurseDelete (context, listFn, results, deleteInfo, opts) {
        const deferred  = Q.defer();

        // Keep track of the deleted items passed in.
        results = results.concat(deleteInfo.items);

        // Determine whether this is the last chunk to be deleted.
        const currentChunkSize = deleteInfo.chunkSize;
        const maxChunkSize = options.getRelevantOption(context, opts, "limit", this._artifactName);
        if (currentChunkSize === 0 || currentChunkSize < maxChunkSize) {
            // The current chunk is a partial chunk, so there are no more items to be retrieved. Resolve the promise.
            deferred.resolve(results);
        } else {
            // The current chunk is a full chunk, so there may be more items to retrieve.
            const self = this;

            // Increase the offset so that the next chunk of items will be retrieved.
            const offset = options.getRelevantOption(context, opts, "offset", self._artifactName);
            opts = utils.cloneOpts(opts, {offset: offset + maxChunkSize});

            // Adjust the offset by the number of items deleted, if necessary.
            const adjustOffset = deleteInfo.adjustOffset;
            if (adjustOffset) {
                opts.offset -= deleteInfo.items.length;
            }

            // Delete the next chunk of items.
            self._deleteItemsChunk(context, listFn, opts)
                .then(function (deleteInfo) {
                    deleteInfo.adjustOffset = adjustOffset;
                    return self._recurseDelete(context, listFn, results, deleteInfo, opts)
                        .then(function (results) {
                            deferred.resolve(results);
                        });
                })
                .catch(function (err) {
                    deferred.reject(err)
                });
        }

        return deferred.promise;
    }

    /**
     *  Determine whether the given item can be deleted.
     *
     *  @param {Object} item The item to be deleted.
     *  @param {Object} isDeleteAll Flag that indicates whether the item will be deleted during a delete all operation.
     *  @param {Object} opts - The options to be used for the delete operation.
     *
     *  @returns {Boolean} A return value of true indicates that the item can be deleted. A return value of false
     *                     indicates that the item cannot be deleted.
     */
    canDeleteItem (item, isDeleteAll, opts) {
        return (item && typeof item === "object");
    }

    /**
     * Initialize any values used to retry items that failed to push.
     *
     * @param {Object} context The current context to be used by the API.
     * @param {Array} [names] A list of item names being pushed.
     */
    initializeRetryPush (context, names) {
        this.setRetryPushProperty(context, BaseHelper.RETRY_PUSH_ITEM_COUNT, names ? names.length : 0);
        this.setRetryPushProperty(context, BaseHelper.RETRY_PUSH_ITEMS, []);
    }

    /**
     * Get the value of the specified retry push property.
     *
     * @param {Object} context The current context to be used by the API.
     * @param {String} name The name of the property.
     *
     * @returns {*} The value of the specified retry push property, or null if the property is not defined.
     */
    getRetryPushProperty (context, name) {
        return (context.retryPush && context.retryPush[name]) || null;
    }

    /**
     * Set the value of the specified retry push property.
     *
     * @param {Object} context The current context to be used by the API.
     * @param {String} name The name of the property.
     * @param {*} value The value of the specified property.
     */
    setRetryPushProperty (context, name, value) {
        if (!context.retryPush) {
            context.retryPush = {};
        }
        context.retryPush[name] = value;
    }

    /**
     * Determine whether retry push is enabled.
     *
     * @returns {Boolean} A return value of true indicates that retry push is enabled.
     */
    isRetryPushEnabled () {
        return false;
    }

    /**
     * Determine whether the given error indicates that the push should be retried.
     *
     * @param {Object} context The current context to be used by the API.
     * @param {Error} error The error returned from the failed push operation.
     *
     * @returns {Boolean} A return value of true indicates that the push should be retried.
     */
    filterRetryPush (context, error) {
        // Log a warning to indicate that this method should be overridden by the helper class that enabled retry push.
        // This warning is meant to be read by WCH developers, so it is not translated.
        utils.logWarnings(context, this.constructor.name + ".filterRetryPush should be overridden to handle error: " + error);
        return false;
    }

    /**
     * Add the properties for an item that should have its push operation retried.
     *
     * @param {Object} context The current context to be used by the API.
     * @param {Object} properties The properties of the push to be retried.
     */
    addRetryPushProperties (context, properties) {
        const items = this.getRetryPushProperty(context, BaseHelper.RETRY_PUSH_ITEMS);
        if (items) {
            // The list already exists, so add the specified properties to it.
            items.push(properties);
        } else {
            // The list does not exist, so create a new list containing the specified properties and add it.
            this.setRetryPushProperty(context, BaseHelper.RETRY_PUSH_ITEMS, [properties]);
        }
    }

    /**
     * Initialize any values used to retry items that failed to delete.
     *
     * @param {Object} context The current context to be used by the API.
     */
    initializeRetryDelete (context) {
        this.setRetryDeleteProperty(context, BaseHelper.RETRY_DELETE_ITEMS, []);
    }

    /**
     * Get the value of the specified retry delete property.
     *
     * @param {Object} context The current context to be used by the API.
     * @param {String} name The name of the property.
     *
     * @returns {*} The value of the specified retry delete property, or null if the property is not defined.
     */
    getRetryDeleteProperty (context, name) {
        return (context.retryDelete && context.retryDelete[name]) || null;
    }

    /**
     * Set the value of the specified retry delete property.
     *
     * @param {Object} context The current context to be used by the API.
     * @param {String} name The name of the property.
     * @param {*} value The value of the specified property.
     */
    setRetryDeleteProperty (context, name, value) {
        if (!context.retryDelete) {
            context.retryDelete = {};
        }
        context.retryDelete[name] = value;
    }

    /**
     * Determine whether retry delete is enabled.
     *
     * @returns {Boolean} A return value of true indicates that retry delete is enabled.
     */
    isRetryDeleteEnabled () {
        return false;
    }

    /**
     * Determine whether the given error indicates that the delete should be retried.
     *
     * @param {Object} context The current context to be used by the API.
     * @param {Error} error The error returned from the failed delete operation.
     *
     * @returns {Boolean} A return value of true indicates that the delete should be retried.
     */
    filterRetryDelete (context, error) {
        // Log a warning to indicate that this method should be overridden by the helper class that enabled retry delete.
        // This warning is meant to be read by WCH developers, so it is not translated.
        utils.logWarnings(context, this.constructor.name + ".filterRetryDelete should be overridden to handle error: " + error);
        return false;
    }

    /**
     * Add the properties for an item that should have its delete operation retried.
     *
     * @param {Object} context The current context to be used by the API.
     * @param {Object} properties The properties of the delete to be retried.
     */
    addRetryDeleteProperties (context, properties) {
        const items = this.getRetryDeleteProperty(context, BaseHelper.RETRY_DELETE_ITEMS);
        if (items) {
            // The list already exists, so add the specified properties to it.
            items.push(properties);
        } else {
            // The list does not exist, so create a new list containing the specified properties and add it.
            this.setRetryDeleteProperty(context, BaseHelper.RETRY_DELETE_ITEMS, [properties]);
        }
    }

    /**
     * Determine whether the helper supports deleting items by id.
     */
    supportsDeleteById() {
        return false;
    }

    /**
     * Determine whether the helper supports deleting items by path.
     */
    supportsDeleteByPath() {
        return false;
    }

    /**
     * Determine whether the helper supports deleting items recursively by path.
     */
    supportsDeleteByPathRecursive() {
        return false;
    }

    /**
     * Protected helper method for iterating over chunks of results
     */
    _listItemChunk (context, listFn, opts) {
        // Get the next "chunk".
        return listFn(opts)
            .then(function (itemList) {
                return {length: itemList.length, items: itemList};
            });
    };

    /**
     * Execute a remote authoring search with the specified search options.
     */
    searchRemote (context, searchOptions, opts) {
        const deferred = Q.defer();

        if (!searchOptions) {
            searchOptions = {};
        }
        if (!searchOptions["q"]) {
            searchOptions["q"] = "*:*";
        }
        if (!searchOptions["fl"]) {
            searchOptions["fl"] = ["name", "id"];
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
            if (searchOptions["fl"].indexOf("name") === -1) {
                searchOptions["fl"].push("name");
            }
        }
        if (!searchOptions["fq"]) {
            searchOptions["fq"] = [];
        } else if (!Array.isArray(searchOptions["fq"])) {
            searchOptions["fq"] = [searchOptions["fq"]];
        }

        if (this._classification) {
            const ccl = "classification:"+this._classification;
            searchOptions["fq"].push(ccl);
        }

        // define a list function to work with the _listAssetChunk/_recurseList methods for handling paging
        const listFn = function(opts) {
            const listFnDeferred = Q.defer();
            searchREST.search(context, searchOptions, opts)
                .then(function (results) {
                    if (!results.documents) {
                        results.documents = [];
                    }
                    listFnDeferred.resolve(results.documents.map(function (result) {
                        return result;
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
                // Pass a value of null for results to indicate that we retrieved the first chunk. The deferred will be
                // resolved when all chunks have been retrieved. However, the retrieval process will never reject the
                // deferred, so we have to handle that explicitly.
                helper._recurseList(context, listFn, deferred, [], listInfo, opts);
            })
            .catch(function (err) {
                // If the list function's promise is rejected, propogate that to the deferred that was returned.
                deferred.reject(err);
            });

        return deferred.promise;
    }
}

/**
 * Export the BaseHelper class.
 */
module.exports = BaseHelper;
