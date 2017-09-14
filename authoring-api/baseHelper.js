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

const Q = require("q");
const fs = require("fs");
const options = require("./lib/utils/options.js");
const utils = require("./lib/utils/utils.js");
const hashes = require("./lib/utils/hashes.js");
const i18n = utils.getI18N(__dirname, ".json", "en");

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
     * The base constructor for a helper object.
     *
     * @constructs BaseHelper
     *
     * @param {BaseREST} restApi - The REST API object managed by this helper.
     * @param {BaseFS} fsApi - The FS object managed by this helper.
     * @param {String} artifactName - The name of the "artifact type" managed by this helper.
     */
    constructor (restApi, fsApi, artifactName) {
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
     * Determines if the artifact directory exists locally.
     *
     * @returns {boolean}
     */
    doesDirectoryExist(context, opts) {
        const dir = this._fsApi.getPath(context, opts);
        return fs.existsSync(dir);
    }

    /**
     * Get the name to be displayed for the given item.
     *
     * @param {Object} item - The item for which to get the name.
     *
     * @returns {String} The name to be displayed for the given item.
     */
    getName (item) {
        // Display the ID of the artifact, or the name if the ID doesn't exist.
        if (item.id) {
            return item.id;
        }
        return item.name;
    }

    /**
     * Get the name to be displayed for the given item.
     * Path by default, fallback to id then name
     *
     * Don't fallback to getName since that may have been overwritten to call
     * this method, which could then cause infinite recursion
     *
     * @param {Object} item - The item for which to get the name.
     *
     * @returns {String} The name to be displayed for the given item.
     */
    getPathName (item) {
        if (item.path)
            return item.path;
        else if (item.hierarchicalPath)
            return item.hierarchicalPath;
        else if (item.id) {
            return item.id;
        }
        return item.name;
    }

    /**
     * Get the item on the local file system with the given name.
     *
     * @param {Object} context The API context to be used by the get operation.
     * @param {String} name - The name of the item.
     * @param {Object} opts - The options to be used to get the item.
     *
     * @returns {Q.Promise} A promise to get the item on the local file system with the given name.
     *
     * @resolves {Object} The item on the local file system with the given name.
     */
    getLocalItem (context, name, opts) {
        // Return the FS object's promise to get the local item with the given name.
        return this._fsApi.getItem(context, name, opts);
    }

    /**
     * Get the items on the local file system.
     *
     * @param {Object} context The API context to be used by the get operation.
     * @param {Object} opts - The options to be used to get the items.
     *
     * @returns {Q.Promise} A promise to get the items on the local file system.
     *
     * @resolves {Array} The items on the local file system.
     */
    getLocalItems (context, opts) {
        // Return the FS object's promise to get the local items.
        return this._fsApi.getItems(context, opts);
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
     * Get the specified item on the remote content hub.
     *
     * @param {Object} context The API context to be used by the get operation.
     * @param {Object} id     The id of the item to retrieve
     * @param {Object} opts - The options to be used to get the items.
     *
     * @returns {Q.Promise} A promise to get the items on the remote content hub.
     *
     * @resolves {Array} The items on the remote content hub.
     */
    getRemoteItem(context, id, opts) {
        // Return the REST object's promise to get the remote item.
        return this._restApi.getItem(context, id, opts);
    }


    /**
     * Create the given item on the remote content hub.
     *
     * @param {Object} context The API context to be used by the create operation.
     * @param {Object} item - The item to be created.
     * @param {Object} opts - The options to be used for the create operation.
     *
     * @returns {Q.Promise} A promise to create the given item on the remote content hub.
     *
     * @resolves {Object} The item that was created.
     */
    createRemoteItem (context, item, opts) {
        // Return the REST object's promise to create the remote item.
        return this._restApi.createItem(context, item, opts);
    }

    /**
     * Initialize any values used to retry items that failed to push.
     *
     * @param {Object} context The current context to be used by the API.
     * @param {Array} names A list of item names being pushed.
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
     * Determine whether retry push is enabled.
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
     * Push the local item with the given name to the remote content hub.
     *
     * Note: The remote item will be created if it does not exist, otherwise the remote item will be updated.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {String} name - The name of the item to be pushed.
     * @param {Object} opts - The options to be used for the push operation.
     *
     * @returns {Q.Promise} A promise to push the local item with the given name to the remote content hub.
     *
     * @resolves {Object} The item that was pushed.
     */
    pushItem (context, name, opts) {
        // Return the promise to to get the local item and upload it to the content hub.
        const helper = this;
        return helper._fsApi.getItem(context, name, opts)
            .then(function (item) {
                // Save the original file name, in case the result of the push is saved to a file with a different name.
                opts = utils.cloneOpts(opts);
                opts.originalPushFileName = name;

                // Check whether the item should be uploaded.
                if (helper.canPushItem(item)) {
                    return helper._uploadItem(context, item, opts);
                } else {
                    // This really shouldn't happen. But if we try to push an item that can't be pushed, add a log entry.
                    helper.getLogger(context).info(i18n.__("cannot_push_item" , {name: name}));
                }
            })
            .catch(function (err) {
                // Only emit the error event if it hasn't already been emitted and we won't be doing a retry.
                if (!err.emitted && !err.retry) {
                    const emitter = helper.getEventEmitter(context);
                    if (emitter) {
                        emitter.emit("pushed-error", err, name);
                    }
                }
                throw err;
            });
    }

    /**
     * Push all items from the local file system to the remote content hub.
     *
     * Note: The remote items will be created if they do not exist, otherwise the remote items will be updated.
     *
     * @param {Object} context The API context to be used for this operation.
     *
     * @returns {Q.Promise} A promise to push the local items to the remote content hub.
     *
     * @resolves {Array} The items that were pushed.
     */
    pushAllItems (context, opts) {
        // Return the promise to to get the list of local item names and push those items to the content hub.
        const helper = this;
        return helper._fsApi.listNames(context, opts)
            .then(function (names) {
                return helper._pushNameList(context, names, opts);
            });
    }

    /**
     * Push any modified items from the local file system to the remote content hub.
     *
     * Note: The remote items will be created if they do not exist, otherwise the remote items will be updated.
     *
     * @param {Object} context The API context to be used for this operation.
     *
     * @returns {Q.Promise} A promise to push the modified local items to the remote content hub.
     *
     * @resolves {Array} The modified items that were pushed.
     */
    pushModifiedItems (context, opts) {
        // Return the promise to to get the list of modified local item names and push those items to the content hub.
        const helper = this;
        return helper.listModifiedLocalItemNames(context, [helper.NEW, helper.MODIFIED], opts)
            .then(function (names) {
                return helper._pushNameList(context, names, opts);
            });
    }

    /**
     * Pull the item with the given id from the remote content hub to the local file system.
     *
     * Note: The local item will be created if it does not exist, otherwise the local item will be overwritten.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {String} id - The ID of the item to be pulled.
     * @param {Object} opts - The options to be used for the pull operation.
     *
     * @returns {Q.Promise} A promise to pull the remote item to the local file system.
     *
     * @resolves {Array} The item that was pulled.
     */
    pullItem (context, id, opts) {
        // Return the promise to get the remote item and save it on the local file system.
        const helper = this;
        return helper._restApi.getItem(context, id, opts)
            .then(function (item) {
                // Check whether the item should be saved to file.
                if (helper.canPullItem(item)) {
                    return helper._fsApi.saveItem(context, item, opts);
                } else {
                    // If the item returned by the service cannot be pulled, add a log entry.
                    helper.getLogger(context).info(i18n.__("cannot_pull_item" , {name: helper.getName(item)}));
                }
            })
            .then(function (item) {
                if (item) {
                    // Use the event emitter to indicate that the item was successfully pulled.
                    const emitter = helper.getEventEmitter(context);
                    if (emitter) {
                        emitter.emit("pulled", helper.getName(item));
                    }
                }

                return item;
            })
            .catch(function (err) {
                // Use the event emitter to indicate that there was an error pulling the item.
                const emitter = helper.getEventEmitter(context);
                if (emitter) {
                    emitter.emit("pulled-error", err, id);
                }
                throw err;
            });
    }

    /**
     * Pull all items from the remote content hub to the local file system.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} opts The options to be used for the pull operations.
     *
     * @returns {Q.Promise} A promise to pull the remote items to the local file system.
     *
     * @resolves {Array} The items that were pulled.
     */
    pullAllItems (context, opts) {
        // Create a deferred object to control the timing of this operation.
        const deferred = Q.defer();

        // Keep track of the error count.
        context.pullErrorCount = 0;

        // Pull a "chunk" of remote items and and then recursively pull any remaining chunks.
        const helper = this;
        const listFn = helper.getRemoteItems.bind(helper, context);
        helper._pullItemsChunk(context, listFn, opts)
            .then(function (items) {
                // The deferred will get resolved when all chunks have been pulled.
                helper._recursePull(context, listFn, deferred, [], items, opts);
            })
            .catch(function (err) {
                deferred.reject(err);
            });

        // After the promise has been resolved, update the last pull timestamp (but only if there were no errors.)
        return deferred.promise
            .then(function (items) {
                if (context.pullErrorCount === 0) {
                    hashes.setLastPullTimestamp(context, helper._fsApi.getDir(context, opts), new Date(), opts);
                }
                return items;
            })
            .finally(function () {
                delete context.pullErrorCount;
            });
    }

    /**
     * Pull any modified items from the remote content hub to the local file system.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} opts - The options to be used for the pull operations.
     *
     * @returns {Q.Promise} A promise to pull the modified remote items to the local file system.
     *
     * @resolves {Array} The modified items that were pulled.
     */
    pullModifiedItems (context, opts) {
        // Create a deferred object to control the timing of this operation.
        const deferred = Q.defer();

        // Keep track of the error count.
        context.pullErrorCount = 0;

        // Pull a "chunk" of modified remote items and and then recursively pull any remaining chunks.
        const helper = this;
        const listFn = helper.getModifiedRemoteItems.bind(helper, context, [helper.NEW, helper.MODIFIED]);
        helper._pullItemsChunk(context, listFn, opts)
            .then(function (items) {
                // The deferred will get resolved when all chunks have been pulled.
                helper._recursePull(context, listFn, deferred, [], items, opts);
            })
            .catch(function (err) {
                deferred.reject(err);
            });

        // After the promise has been resolved, update the last pull timestamp (but only if there were no errors.)
        return deferred.promise
            .then(function (items) {
                if (context.pullErrorCount === 0) {
                    hashes.setLastPullTimestamp(context, helper._fsApi.getDir(context, opts), new Date(), opts);
                }
                return items;
            })
            .finally(function () {
                delete context.pullErrorCount;
            });
    }

    /**
     * @param {Object} context The API context to be used for this operation.
     *
     * @returns {Q.Promise} - A promise that resolves with an array of the names of
     *                      all items that exist on the file system.
     */
    listLocalItemNames (context, opts) {
        return this._fsApi.listNames(context, opts);
    }

    /**
     * @param {Object} context The API context to be used for this operation.
     *
     * @returns {Q.Promise} - A promise that resolves with an array of the names of all items that exist on the file
     *                        system which have been modified since being pushed/pulled.
     */
    listModifiedLocalItemNames (context, flags, opts) {
        const helper = this;
        const fsObject = this._fsApi;
        const dir = fsObject.getPath(context, opts);
        return fsObject.listNames(context, opts)
            .then(function (itemNames) {
                const results = itemNames.filter(function (itemName) {
                    const itemPath = fsObject.getItemPath(context, itemName, opts);
                    return hashes.isLocalModified(context, flags, dir, itemPath, opts);
                });
                if (flags.indexOf(helper.DELETED) !== -1) {
                    return helper.listLocalDeletedNames(context, opts)
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

    listLocalDeletedNames (context, opts) {
        const fsObject = this._fsApi;
        const deferred = Q.defer();
        const dir = fsObject.getPath(context, opts);
        const extension = fsObject.getExtension();
        deferred.resolve(hashes.listFiles(context, dir, opts)
            .filter(function (path) {
                let stat = undefined;
                try {
                    stat = fs.statSync(dir + path);
                } catch (ignore) {
                    // ignore this error we're testing to see if a file exists
                }
                return !stat;
            })
            .filter(function (file) {
                return file.endsWith(extension);
            })
            .map(function (file) {
                return file.replace(extension, "");
            }));
        return deferred.promise;
    }

    /**
     * Get a list of the names of all remote items.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} opts - The options to be used for this operation.
     *
     * @returns {Q.Promise} - A promise for an array of the names of all remote items.
     */
    listRemoteItemNames (context, opts) {
        // Create the deferred to be used for recursively retrieving items.
        const deferred = Q.defer();

        // Recursively call restApi.getItems() to retrieve all of the remote items.
        const listFn = this._restApi.getItems.bind(this._restApi, context);

        // Get the first chunk of remote items, and then recursively retrieve any additional chunks.
        const helper = this;
        helper._listItemChunk(context, listFn, opts)
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
            .then(function (items) {
                // Turn the resulting list of items (metadata) into a list of item names.
                return items.map(function (item) {
                    return helper.getName(item);
                });
            });
    }

    /**
     * Get a list of the items that have been modified.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Array} flags - An array of the state (NEW, DELETED, MODIFIED) of the items to be included in the list.
     * @param {Object} opts - The options to be used for this operation.
     *
     * @returns {Q.Promise} - A promise for an array of all remote items that were modified since being pushed/pulled.
     */
    getModifiedRemoteItems (context, flags, opts) {
        const helper = this;
        const dir = helper._fsApi.getPath(context, opts);
        return helper._restApi.getModifiedItems(context, hashes.getLastPullTimestamp(context, dir, opts), opts)
            .then(function (items) {
                const results = items.filter(function (item) {
                    try {
                        const itemPath = helper._fsApi.getItemPath(context, item, opts);
                        return hashes.isRemoteModified(context, flags, item, dir, itemPath, opts);
                    } catch (err) {
                        utils.logErrors(context, i18n.__("error_filtering_remote_items"), err);
                    }
                });
                return results;
            });
    }

    /**
     * Get a list of the names of all remote items that have been modified.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Array} flags - An array of the state (NEW, DELETED, MODIFIED) of the items to be included in the list.
     * @param {Object} opts - The options to be used for this operation.
     *
     * @returns {Q.Promise} - A promise for an array of the names of all remote items that were modified since being
     *                        pushed/pulled.
     */
    listModifiedRemoteItemNames (context, flags, opts) {
        const deferred = Q.defer();
        const results = null;
        const helper = this;
        const listFn = helper.getModifiedRemoteItems.bind(helper, context, flags);
        helper._listItemChunk(context, listFn, opts)
            .then(function (listInfo) {
                helper._recurseList(context, listFn, deferred, results, listInfo, opts);
            })
            .catch(function (err) {
                deferred.reject(err);
            });

        return deferred.promise
            .then(function (items) {
                const results = items.map(function (item) {
                    return helper.getName(item);
                });
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
     * Get a list of the names of all remote items that have been deleted.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} opts - The options to be used for this operation.
     *
     * @returns {Q.Promise} - A promise for an array of the names of all remote items that were deleted since being
     *                        pushed/pulled.
     */
    listRemoteDeletedNames (context, opts) {
        const deferred = Q.defer();
        const dir = this._fsApi.getDir(context, opts);
        const extension = this._fsApi.getExtension();

        this.listRemoteItemNames(context, opts)
            .then(function (remoteItemNames) {
                deferred.resolve(
                    hashes.listFiles(context, dir, opts)
                        .filter(function (file) {
                            return file.endsWith(extension);
                        })
                        .map(function (file) {
                            return file.replace(extension, "");
                        })
                        .filter(function (path) {
                            return (remoteItemNames.indexOf(path) === -1);
                        })
                );
            })
            .catch(function (err) {
                deferred.reject(err);
            });

        return deferred.promise;
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
     * Gets a remote item by path.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {String} path The path of the item to find.
     * @param {Object} opts The options to be used for the operation.
     *
     * @returns {Q.Promise} A promise for the item to find.
     */
    getRemoteItemByPath (context, path, opts) {
        return this._restApi.getItemByPath(context, path, opts);
    }

    /**
     * Delete the specified remote item.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {String} item - The item to be deleted.
     * @param {Object} opts - The options to be used for the delete operation.
     *
     * @returns {Q.Promise} A promise for the deleted item.
     */
    deleteRemoteItem (context, item, opts) {
        // This function exists mostly for testing purposes
        const helper = this;
        return helper._restApi.deleteItem(context, item, opts)
            .then(function () {
                return item;
            });
    }

    /**
     *  Determine whether the given item can be pulled.
     *
     *  @param {Object} item The item to be pulled.
     *
     *  @returns {Boolean} A return value of true indicates that the item can be pulled. A return value of false
     *                     indicates that the item cannot be pulled.
     */
    canPullItem (item) {
        return (item && typeof item === "object");
    }

    /**
     *  Determine whether the given item can be pushed.
     *
     *  @param {Object} item The item to be pushed.
     *
     *  @returns {Boolean} A return value of true indicates that the item can be pushed. A return value of false
     *                     indicates that the item cannot be pushed.
     */
    canPushItem (item) {
        return (item && typeof item === "object");
    }

    reset () {
    }

    /**
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} item
     * @param {Object} opts
     *
     * @returns {Q.Promise}
     *
     * @private
     */
    _uploadItem (context, item, opts) {
        let promise;
        let logError;

        const isUpdate = item.id && item.rev;
        if (isUpdate) {
            promise = this._restApi.updateItem(context, item, opts);
            logError = i18n.__("push_error_updating_item");
        } else {
            // No ID, so it has to be created
            promise = this._restApi.createItem(context, item, opts);
            logError = i18n.__("push_error_creating_item");
        }

        const helper = this;
        return promise
            .then(function (item) {
                const emitter = helper.getEventEmitter(context);
                if (emitter) {
                    emitter.emit("pushed", helper.getName(item));
                }
                const rewriteOnPush = options.getRelevantOption(context, opts, "rewriteOnPush");
                if (rewriteOnPush) {
                    return helper._fsApi.saveItem(context, item, opts);
                } else {
                    return item;
                }
            })
            .catch(function (err) {
                const name = helper.getName(item);
                const heading = logError + name;

                // Determine whether the push of this item should be retried.
                if (err.retry) {
                    // Add a retry entry to the helper.
                    const retryProperties = {};
                    retryProperties[BaseHelper.RETRY_PUSH_ITEM_NAME] = name;
                    retryProperties[BaseHelper.RETRY_PUSH_ITEM_ERROR] = err;
                    retryProperties[BaseHelper.RETRY_PUSH_ITEM_HEADING] = heading;
                    helper.addRetryPushProperties(context, retryProperties);

                    // Rethrow the error to propogate it back to the caller. Otherwise the caller won't know to retry.
                    throw(err);
                } else {
                    const emitter = helper.getEventEmitter(context);
                    if (emitter) {
                        emitter.emit("pushed-error", err, name);
                    }
                    err.emitted = true;
                    utils.logErrors(context, heading, err);
                    const saveFileOnConflict = options.getRelevantOption(context, opts, "saveFileOnConflict");
                    if (saveFileOnConflict && isUpdate && err.statusCode === 409) {
                        return helper._restApi.getItem(context, item.id, opts)
                            .then(function (item) {
                                const cOpts = utils.cloneOpts(opts);
                                cOpts.conflict = true;
                                return helper._fsApi.saveItem(context, item, cOpts);
                            })
                            .catch(function (error) {
                                // Log a warning if there was an error getting the conflicting item or saving it.
                                utils.logWarnings(context, error.toString());
                            })
                            .finally(function () {
                                // throw the original err for conflict
                                throw(err);
                            });
                    } else {
                        throw(err);
                    }
                }
            });
    }

    /**
     * Push the items with the given names.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Array} names - The names of the items to be pushed.
     * @param {Object} opts - The options to be used for the push operations.
     *
     * @returns {Q.Promise} A promise for the items that were pushed.
     *
     * @protected
     */
    _pushNameList (context, names, opts) {
        const deferred = Q.defer();

        const helper = this;
        const concurrentLimit = options.getRelevantOption(context, opts, "concurrent-limit", helper._artifactName);
        const pushedItems = [];
        const pushItems = function (names, opts) {
            const results = utils.throttledAll(context, names.map(function (name) {
                return function () {
                    return helper.pushItem(context, name, opts);
                };
            }), concurrentLimit);

            results
                .then(function (promises) {
                    promises
                        .filter(function (promise) {
                            return (promise.state === 'fulfilled');
                        })
                        .forEach(function (promise) {
                            if (promise.value) {
                                pushedItems.push(promise.value);
                            }
                        });

                    // Check to see if a retry is required.
                    const retryItems = helper.getRetryPushProperty(context, BaseHelper.RETRY_PUSH_ITEMS);
                    if (retryItems && retryItems.length > 0) {
                        // There are items to retry, so check to see whether any push operations were successful.
                        const itemCount = helper.getRetryPushProperty(context, BaseHelper.RETRY_PUSH_ITEM_COUNT) || 0;
                        if (retryItems.length < itemCount) {
                            // At least one push operation was successful, so proceed with the retry.
                            const names = [];
                            retryItems.forEach(function (item) {
                                // Add each retry item to the list of items to be pushed.
                                const name = item[BaseHelper.RETRY_PUSH_ITEM_NAME];
                                names.push(name);

                                // Log a warning that the push of this item will be retried.
                                const error = item[BaseHelper.RETRY_PUSH_ITEM_ERROR];
                                utils.logWarnings(context, i18n.__("pushed_item_retry" , {name: name, message: error.log ? error.log : error.message}));
                            });

                            // Initialize the retry values and then push the items in the list.
                            helper.initializeRetryPush(context, names);
                            pushItems(names, opts);
                        } else {
                            // There were no successful push operations, so do not retry again.
                            retryItems.forEach(function (item) {
                                // Emit a "pushed-error" event for each unpushed item, and log the error.
                                const name = item[BaseHelper.RETRY_PUSH_ITEM_NAME];
                                const error = item[BaseHelper.RETRY_PUSH_ITEM_ERROR];
                                const heading = item[BaseHelper.RETRY_PUSH_ITEM_HEADING];
                                delete error.retry;

                                const emitter = helper.getEventEmitter(context);
                                if (emitter) {
                                    emitter.emit("pushed-error", error, name);
                                }
                                utils.logErrors(context, heading, error);
                            });

                            // Resolve the promise with the list of any items that were successfully pushed.
                            deferred.resolve(pushedItems);
                        }
                    } else {
                        // There were no items to retry, so resolve the promise with the list pushed items.
                        deferred.resolve(pushedItems);
                    }
                });
        };

        // Retry is only available if it is enabled for this helper.
        if (this.isRetryPushEnabled()) {
            // Initialize the retry state on the context.
            context.retryPush = {};
            helper.initializeRetryPush(context, names);

            // Add the filter for determining whether a failed push should be retried.
            context.filterRetryPush = this.filterRetryPush.bind(this);
        }

        // Push the items in the list.
        pushItems(names, opts);

        // Return the promise that will eventually be resolved in the pushItems function.
        return deferred.promise
            .finally(function () {
                // Once the promise has been settled, remove the retry push state from the context.
                delete context.retryPush;
                delete context.filterRetryPush;
            });
    }

    _pullItemsChunk (context, listFn, opts) {
        let items = [];
        const deferred = Q.defer();
        const helper = this;
        listFn(opts)
            .then(function (itemList) {
                // Filter the list to exclude any items that should not be saved to file.
                itemList = itemList.filter(function (item) {
                    const canPullItem = helper.canPullItem(item);
                    if (!canPullItem) {
                        // This item cannot be pulled, so add a log entry.
                        helper.getLogger(context).info(i18n.__("cannot_pull_item", {name: helper.getName(item)}));
                    }

                    return canPullItem;
                });

                const promises = itemList.map(function (item) {
                    const name = helper.getName(item);

                    return helper._fsApi.saveItem(context, item, opts)
                        .then(function () {
                            const emitter = helper.getEventEmitter(context);
                            if (emitter) {
                                emitter.emit("pulled", name);
                            }
                            return item;
                        });
                });
                return Q.allSettled(promises)
                    .then(function (promises) {
                        items = [];
                        promises.forEach(function (promise, index) {
                            if (promise.state === "fulfilled") {
                                items.push(promise.value);
                            }
                            else {
                                items.push(promise.reason);
                                const emitter = helper.getEventEmitter(context);
                                if (emitter) {
                                    emitter.emit("pulled-error", promise.reason, itemList[index].id);
                                }
                                context.pullErrorCount++;
                            }
                        });
                        deferred.resolve(items);
                    });
            })
            .catch(function (err) {
                deferred.reject(err);
            });
        return deferred.promise;
    }

    _recursePull (context, listFn, deferred, allItems, items, opts) {
        const helper = this;
        //append the results from the previous chunk to the allItems array
        allItems.push.apply(allItems, items);
        const iLen = items.length;
        const limit = options.getRelevantOption(context, opts, "limit", helper._artifactName);
        //test to see if we got less than the full chunk size
        if (iLen === 0 || iLen < limit) {
            //resolve the deferred with the allItems array
            deferred.resolve(allItems);
        } else {
            //get the next chunk
            const offset = options.getRelevantOption(context, opts, "offset", helper._artifactName);
            opts = utils.cloneOpts(opts);
            opts.offset = offset + limit;
            this._pullItemsChunk(context, listFn, opts)
                .then(function (items) {
                    helper._recursePull(context, listFn, deferred, allItems, items, opts);
                })
                .catch(function (err) {
                    deferred.reject(err);
                });
        }
    }

    _listItemChunk (context, listFn, opts) {
        // Get the next "chunk".
        return listFn(opts)
            .then(function (itemList) {
                return {length: itemList.length, items: itemList};
            });
    };

    _recurseList (context, listFn, deferred, results, listInfo, opts) {
        // If a results array is specified, accumulate the items listed.
        if (results) {
            results = results.concat(listInfo.items);
        } else {
            results = listInfo.items;
        }

        const iLen = listInfo.length;
        const limit = options.getRelevantOption(context, opts, "limit", this._artifactName);
        if (iLen === 0 || iLen < limit) {
            deferred.resolve(results);
        } else {
            const offset = options.getRelevantOption(context, opts, "offset", this._artifactName);
            opts = utils.cloneOpts(opts);
            opts.offset = offset +  limit;
            const helper = this;
            helper._listItemChunk(context, listFn, opts)
                .then(function (listInfo) {
                    helper._recurseList(context, listFn, deferred, results, listInfo, opts);
                });
        }
    };
}

/**
 * Export the BaseHelper class.
 */
module.exports = BaseHelper;
