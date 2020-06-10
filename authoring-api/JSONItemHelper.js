/*
Copyright 2017 IBM Corporation

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

const BaseHelper = require("./baseHelper.js");
const Q = require("q");
const fs = require("fs");
const options = require("./lib/utils/options.js");
const utils = require("./lib/utils/utils.js");
const hashes = require("./lib/utils/hashes.js");
const manifests = require("./lib/utils/manifests.js");
const i18n = utils.getI18N(__dirname, ".json", "en");

/**
 * Helper class for artifacts that are JSON objects.
 *
 * Note: A helper object provides access to both the REST API and the local file system for a single artifact type.
 *
 * @class JSONItemHelper
 */
class JSONItemHelper extends BaseHelper {
    /**
     * The constructor for a helper that manages JSON artifacts.
     *
     * @constructs JSONItemHelper
     *
     * @param {BaseREST} restApi - The REST API object managed by this helper.
     * @param {BaseFS} fsApi - The FS object managed by this helper.
     * @param {String} artifactName - The name of the "artifact type" managed by this helper.
     * @param {String} [classification] - Optional classification of the artifact type - defaults to artifactName
     */
    constructor (restApi, fsApi, artifactName, classification) {
        super(restApi, fsApi, artifactName, classification);
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
     * Get the specified item on the remote content hub.
     *
     * @param {Object} context The API context to be used by the get operation.
     * @param {String} id The id of the item to retrieve
     * @param {Object} opts - The options to be used to get the items.
     *
     * @returns {Q.Promise} A promise to get the items on the remote content hub.
     *
     * @resolves {Array} The items on the remote content hub.
     */
    getRemoteItem (context, id, opts) {
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
        let errorInfo = name;
        return helper._fsApi.getItem(context, name, opts)
            .then(function (item) {
                errorInfo = item;
                // Check whether the item should be uploaded.
                if (helper.canPushItem(item)) {
                    // Save the original file name, in case the result of the push is saved to a file with a different name.
                    return helper._uploadItem(context, item, utils.cloneOpts(opts, {originalPushFileName: name}));
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
                        emitter.emit("pushed-error", err, {
                            id: errorInfo["id"],
                            name: errorInfo["name"],
                            path: (errorInfo["path"] || name["path"] || name)
                        });
                    }
                }
                throw err;
            });
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
        // Get the names (actually the proxy items) from the current manifest and push them to the content hub.
        const helper = this;
        return helper.getManifestItems(context, opts)
            .then(function (items) {
                return helper._pushNameList(context, items, opts);
            });
    }

    /**
     * Push all items from the local file system to the remote content hub.
     *
     * Note: The remote items will be created if they do not exist, otherwise the remote items will be updated.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} opts - The options to be used for the push operation.
     *
     * @returns {Q.Promise} A promise to push the local items to the remote content hub.
     *
     * @resolves {Array} The items that were pushed.
     */
    pushAllItems (context, opts) {
        // Return the promise to get the list of local item names and push those items to the content hub.
        const helper = this;
        return helper._listLocalItemNames(context, opts)
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
     * @param {Object} opts - The options to be used for the push operation.
     *
     * @returns {Q.Promise} A promise to push the modified local items to the remote content hub.
     *
     * @resolves {Array} The modified items that were pushed.
     */
    pushModifiedItems (context, opts) {
        // Return the promise to to get the list of modified local item names and push those items to the content hub.
        const helper = this;
        return helper._listModifiedLocalItemNames(context, [helper.NEW, helper.MODIFIED], opts)
            .then(function (names) {
                return helper._pushNameList(context, names, opts);
            });
    }

    makeEmittedObject(context, item, opts) {
        return {id: item.id, name: item.name, path: item.path};
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
        return helper.getRemoteItem(context, id, opts)
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
                        emitter.emit("pulled", helper.makeEmittedObject(context, item, opts));
                        emitter.emit("post-process", item);
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
                return helper._pullItemList(context, items, opts);
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
        // Keep track of the error count.
        context.pullErrorCount = 0;

        const deletions = options.getRelevantOption(context, opts, "deletions");
        let allFSItems;
        if (deletions) {
            allFSItems = this._listLocalItemNames(context, opts);
        }

        // Get the timestamp to set before we call the REST API.
        const timestamp = new Date().toISOString();

        // Pull a "chunk" of remote items and and then recursively pull any remaining chunks.
        const helper = this;
        const listFn = helper._getRemoteListFunction(context, opts);
        const handleChunkFn = helper._pullItemsChunk.bind(helper);

        // After the promise has been resolved, update the last pull timestamp.
        return helper.recursiveGetItems(context, listFn, handleChunkFn, opts)
            .then(function (items) {
                const filterPath = options.getRelevantOption(context, opts, "filterPath");

                // Only update the last pull timestamp if there were no errors and items are not being filtered by path.
                if ((context.pullErrorCount === 0) && !filterPath) {
                    helper._setLastPullTimestamps(context, timestamp, opts);
                }
                const emitter = helper.getEventEmitter(context);
                if (deletions && emitter) {
                    return allFSItems.then(function (values) {
                        const pulledIDs = items.map(function (item) {
                            return item.id;
                        });
                        values.forEach(function (item) {
                            if (pulledIDs.indexOf(item.id) === -1) {
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
     * Returns a function to be used for the list remote items functionality. The returned function should accept a single opts argument.
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} opts The options to be used for the pull operations.
     * @return the function to call to list remote items.
     * @private
     */
    _getRemoteListFunction (context, opts) {
        // Use getRemoteItems() as the list function, so that all artifacts will be pulled.
        return this.getRemoteItems.bind(this, context);
    }

    /**
     * Given an array of items, filter those that are modified based on the flags.
     * @param context
     * @param items
     * @param flags
     * @param opts
     * @private
     */
    _filterRemoteModified (context, items, flags, opts) {
        const helper = this;
        const dir = helper._fsApi.getPath(context, opts);
        return items.filter(function (item) {
            try {
                const itemPath = helper._fsApi.getItemPath(context, item, opts);
                return hashes.isRemoteModified(context, flags, item, dir, itemPath, undefined, opts);
            } catch (err) {
                utils.logErrors(context, i18n.__("error_filtering_remote_items"), err);
            }
        });
    }

    /**
     * Returns a function to be used for the modified list remote items functionality. The returned function should accept a single opts argument.
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} opts The options to be used for the pull operations.
     * @return the function to call to list modified remote items.
     * @private
     */
    _getRemoteModifiedListFunction (context, flags, opts) {
        // Use getModifiedRemoteItems() as the list function, so that all modified artifacts will be pulled.
        return this.getModifiedRemoteItems.bind(this, context, flags);
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
        // Keep track of the error count.
        context.pullErrorCount = 0;

        // Get the timestamp to set before we call the REST API.
        const timestamp = new Date().toISOString();

        // Pull a "chunk" of modified remote items and and then recursively pull any remaining chunks.
        const helper = this;
        const listFn = helper._getRemoteModifiedListFunction(context, [helper.NEW, helper.MODIFIED], opts);
        const handleChunkFn = helper._pullItemsChunk.bind(helper);

        // After the promise has been resolved, update the last pull timestamp.
        return helper.recursiveGetItems(context, listFn, handleChunkFn, opts)
            .then(function (items) {
                const filterPath = options.getRelevantOption(context, opts, "filterPath");

                // Only update the last pull timestamp if there were no errors and items are not being filtered by path.
                if ((context.pullErrorCount === 0) && !filterPath) {
                    helper._setLastPullTimestamps(context, timestamp, opts);
                }
                return items;
            })
            .finally(function () {
                delete context.pullErrorCount;
            });
    }

    /**
     * Get the timestamp for the last "similar" pull operation.
     *
     * @example "2017-01-16T22:30:05.928Z"
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} opts The API options to be used for this operation.
     *
     * @returns {Object} The timestamp for the last "similar" pull operation, or undefined.
     */
    getLastPullTimestamp(context, opts) {
        const timestamps = this._getLastPullTimestamps(context, opts);

        const readyOnly = options.getRelevantOption(context, opts, "filterReady");
        const draftOnly = options.getRelevantOption(context, opts, "filterDraft");
        if (readyOnly) {
            // A ready-only pull operation will use the ready timestamp.
            return timestamps["ready"];
        } else if (draftOnly) {
            // A draft-only pull operation will use the draft timestamp.
            return timestamps["draft"];
        } else {
            // A ready-and-draft pull operation will use the older timestamp to make sure all modified items are pulled.
            return utils.getOldestTimestamp([timestamps["draft"], timestamps["ready"]]);
        }
    }

    /**
     * Get the timestamp data for the last pull operation, converting to the new draft/ready format if needed.
     *
     * @example {"draft": "2017-01-16T22:30:05.928Z", "ready": "2017-01-16T22:30:05.928Z"}
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} opts The API options to be used for this operation.
     *
     * @returns {Object} The last pull timestamp data.
     */
    _getLastPullTimestamps(context, opts) {
        const dir = this._fsApi.getDir(context, opts);
        const timestamps = hashes.getLastPullTimestamp(context, dir, opts);

        if (typeof timestamps === "string") {
            // Convert from a single timestamp value to the new draft/ready format.
            return {"draft": timestamps, "ready": timestamps};
        } else {
            // Return the existing data, or an empty object if there is no existing data.
            return timestamps || {};
        }
    }

    /**
     * Set the timestamp data for the last pull operation.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Date} timestamp The current timestamp to be used.
     * @param {Object} opts The API options to be used for this operation.
     */
    _setLastPullTimestamps(context, timestamp, opts) {
        const pullTimestamps = this._getLastPullTimestamps(context, opts);

        // Store separate pull timestamps for draft and ready.
        const readyOnly = options.getRelevantOption(context, opts, "filterReady");
        const draftOnly = options.getRelevantOption(context, opts, "filterDraft");
        if (!draftOnly) {
            // Store the ready timestamp if the operation is not draft only.
            pullTimestamps["ready"] = timestamp;
        }
        if (!readyOnly) {
            // Store the draft timestamp if the operation is not ready only.
            pullTimestamps["draft"] = timestamp;
        }

        const dir = this._fsApi.getDir(context, opts);
        hashes.setLastPullTimestamp(context, dir, pullTimestamps, opts);
    }

    /**
     * Updates the manifest with results of a list operation.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} itemList The list of items to be added to the manifest.
     * @param {Object} opts - The options to be used for the list operation.
     */
    _updateManifest (context, itemList, opts) {
        const helper = this;
        const manifestList = itemList.filter(function (item) {
            return helper.canPullItem(item);
        });
        manifests.updateManifestSection(context, helper.getArtifactName(), manifestList, opts);
    }

    /**
     * Updates the deletions manifest with results of a list operation.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} itemList The list of items to be added to the deletions manifest.
     * @param {Object} opts - The options to be used for the list operation.
     */
    _updateDeletionsManifest (context, itemList, opts) {
        const helper = this;
        const manifestList = itemList.filter(function (item) {
            return helper.canPullItem(item);
        });
        manifests.updateDeletionsManifestSection(context, helper.getArtifactName(), manifestList, opts);
    }

    /**
     * Lists all local items.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} opts - The options to be used for the push operation.
     *
     * @returns {Q.Promise} - A promise that resolves with an array of the names of
     *                      all items that exist on the file system.
     */
    _listLocalItemNames (context, opts) {
        const readyOnly = options.getRelevantOption(context, opts, "filterReady");
        const draftOnly = options.getRelevantOption(context, opts, "filterDraft");
        const helper = this;

        if (readyOnly || draftOnly) {
            // Make sure the proxy items contain the status.
            opts = utils.cloneOpts(opts);
            if (!opts["additionalItemProperties"]) {
                opts["additionalItemProperties"] = [];
            }
            opts["additionalItemProperties"].push("status");
        }

        return this._fsApi.listNames(context, opts)
            .then(function (itemList) {
                // Filter the item list based on the ready and draft options.
                if (readyOnly) {
                    // Filter out any items that are not ready.
                    itemList = itemList.filter(function (item) {
                        return (helper.getStatus(context, item, opts) === "ready");
                    });
                } else if (draftOnly) {
                    // Filter out any items that are not draft.
                    itemList = itemList.filter(function (item) {
                        return (helper.getStatus(context, item, opts) === "draft");
                    });
                }

                return itemList;
            });
    }

    /**
     * Lists all local items.
     * This function serves as an entry point for the list command and should not be internally called otherwise.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} opts - The options to be used for the push operation.
     *
     * @returns {Q.Promise} - A promise that resolves with an array of the names of
     *                      all items that exist on the file system.
     */
    listLocalItemNames (context, opts) {
        const helper = this;
        return this._listLocalItemNames(context, opts)
            .then(function (itemList) {
                helper._updateManifest(context, itemList, opts);
                return itemList;
            });
    }

    /**
     * Get an array of names for all items on the file system which have been modified since being pushed/pulled.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Array} flags An array of the state (NEW, DELETED, MODIFIED) of the items to be included in the list.
     * @param {Object} opts The options to be used for the push operation.
     *
     * @returns {Q.Promise} A promise that resolves with an array of names for all items on the file system which have
     *                      been modified since being pushed/pulled.
     */
    _listModifiedLocalItemNames (context, flags, opts) {
        const helper = this;
        const fsObject = this._fsApi;

        const readyOnly = options.getRelevantOption(context, opts, "filterReady");
        const draftOnly = options.getRelevantOption(context, opts, "filterDraft");

        if (readyOnly || draftOnly) {
            // Make sure the proxy items contain the status.
            opts = utils.cloneOpts(opts);
            if (!opts["additionalItemProperties"]) {
                opts["additionalItemProperties"] = [];
            }
            opts["additionalItemProperties"].push("status");
        }

        const dir = fsObject.getPath(context, opts);
        return fsObject.listNames(context, opts)
            .then(function (itemNames) {
                // Filter the item list based on the ready and draft options.
                if (readyOnly) {
                    // Filter out any items that are not ready.
                    itemNames = itemNames.filter(function (item) {
                        return (helper.getStatus(context, item, opts) === "ready");
                    });
                } else if (draftOnly) {
                    // Filter out any items that are not draft.
                    itemNames = itemNames.filter(function (item) {
                        return (helper.getStatus(context, item, opts) === "draft");
                    });
                }

                const results = itemNames.filter(function (itemName) {
                    if (itemName.id) {
                        const itemPath = fsObject.getItemPath(context, itemName, opts);
                        return hashes.isLocalModified(context, flags, dir, itemPath, undefined, opts);
                    } else {
                        helper.getLogger(context).info(i18n.__("file_skipped" , {path: itemName.path}));
                        return false;
                    }
                });
                if (flags.indexOf(helper.DELETED) !== -1) {
                    return helper.listLocalDeletedNames(context, opts)
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
     * Get an array of names for all items on the file system which have been modified since being pushed/pulled.
     * This function serves as an entry point for the list command and should not be internally called otherwise.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Array} flags An array of the state (NEW, DELETED, MODIFIED) of the items to be included in the list.
     * @param {Object} opts The options to be used for the push operation.
     *
     * @returns {Q.Promise} A promise that resolves with an array of names for all items on the file system which have
     *                      been modified since being pushed/pulled.
     */
    listModifiedLocalItemNames (context, flags, opts) {
        const helper = this;
        return this._listModifiedLocalItemNames(context, flags, opts)
            .then(function(itemList) {
                helper._updateManifest(context, itemList, opts);
                return itemList;
            });
    }

    listLocalDeletedNames (context, opts) {
        const fsObject = this._fsApi;
        const deferred = Q.defer();
        const dir = fsObject.getPath(context, opts);
        const extension = fsObject.getExtension();
        const readyOnly = options.getRelevantOption(context, opts, "filterReady");
        const draftOnly = options.getRelevantOption(context, opts, "filterDraft");
        deferred.resolve(hashes.listFiles(context, dir, opts)
            .filter(function (item) {
                let stat = undefined;
                try {
                    stat = fs.statSync(dir + item.path);
                } catch (ignore) {
                    // ignore this error we're testing to see if a file exists
                }
                return !stat;
            })
            .filter(function (item) {
                // Filter the item list based on the ready and draft options.
                const draft = item.id && (item.id.indexOf(":") >= 0);
                if ((readyOnly && draft) || (draftOnly && !draft)) {
                    // Filter out any items that do not match the specified option.
                    return false;
                } else {
                    return true;
                }
            })
            .filter(function (item) {
                return item.path.endsWith(extension);
            })
            .map(function (item) {
                return {
                    id: item.id,
                    path: item.path.replace(extension, "")
                };
            }));
        return deferred.promise;
    }

    _makeListItemResult (context, item, opts) {
        return {
            id: item.id,
            name: item.name
        };
    }

    /**
     * Get a list of the names of all remote items.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} opts - The options to be used for this operation.
     *
     * @returns {Q.Promise} - A promise for an array of the names of all remote items.
     */
    _listRemoteItemNames (context, opts) {
        // Recursively call restApi.getItems() to retrieve all of the remote items.
        const helper = this;
        const listFn = helper._getRemoteListFunction(context, opts);
        const handleChunkFn = helper._listItemChunk.bind(helper);

        // Get the first chunk of remote items, and then recursively retrieve any additional chunks.
        return helper.recursiveGetItems(context, listFn, handleChunkFn, opts)
            .then(function (items) {
                // Turn the resulting list of items (metadata) into a list of item names.
                return items.map(function (item) {
                    return helper._makeListItemResult(context, item, opts);
                });
            });
    }

    /**
     * Get a list of the names of all remote items.
     * This function serves as an entry point for the list command and should not be internally called otherwise.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} opts - The options to be used for this operation.
     *
     * @returns {Q.Promise} - A promise for an array of the names of all remote items.
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
        return helper._restApi.getModifiedItems(context, helper.getLastPullTimestamp(context, opts), opts)
            .then(function (items) {
                return helper._filterRemoteModified(context, items, flags, opts);
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
    _listModifiedRemoteItemNames (context, flags, opts) {
        const helper = this;
        const listFn = helper._getRemoteModifiedListFunction(context, flags, opts);
        const handleChunkFn = helper._listItemChunk.bind(helper);

        return helper.recursiveGetItems(context, listFn, handleChunkFn, opts)
            .then(function (items) {
                const results = items.map(function (item) {
                    return helper._makeListItemResult(context, item, opts);
                });
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
     * Get a list of the names of all remote items that have been modified.
     * This function serves as an entry point for the list command and should not be internally called otherwise.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Array} flags - An array of the state (NEW, DELETED, MODIFIED) of the items to be included in the list.
     * @param {Object} opts - The options to be used for this operation.
     *
     * @returns {Q.Promise} - A promise for an array of the names of all remote items that were modified since being
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

        this._listRemoteItemNames(context, opts)
            .then(function (remoteItems) {
                deferred.resolve(
                    hashes.listFiles(context, dir, opts)
                        .filter(function (item) {
                            return item.path.endsWith(extension);
                        })
                        .map(function (item) {
                            return {
                                id: item.id,
                                path: item.path.replace(extension, "")
                            };
                        })
                        .filter(function (item) {
                            return (remoteItems.indexOf(item.path) === -1);
                        })
                );
            })
            .catch(function (err) {
                deferred.reject(err);
            });

        return deferred.promise;
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

    addIgnoreKeys (ignoreKeys, segments) {
        const segment = segments.splice(0, 1)[0];
        if (segments.length > 0) {
            if (!ignoreKeys[segment]) {
                ignoreKeys[segment] = {};
            }
            this.addIgnoreKeys(ignoreKeys[segment], segments);
        } else {
            ignoreKeys[segment] = undefined;
        }
    }

    /**
     * Return a set of extra keys to be ignored for this artifact type.  This should be used to return a list
     * of synthetic fields per artifact type.
     *
     * @return {Array} the names of the JSON elements to be ignored.
     */
    getExtraIgnoreKeys() {
        return [];
    }

    /**
     * Return the keys that can be ignored as they can contain unimportant differences in artifacts of this type.
     *
     * @returns {Object} the ignore keys for this artifact type.
     */
    getIgnoreKeys () {
        const ignoreKeys = {};
        ["rev",
            "created", "creator", "creatorId",
            "lastModified", "lastModifier", "lastModifierId",
            "systemModified",
            "links", "types", "categories", "publishing", "hierarchicalPath"
        ].forEach(function (key) {
            ignoreKeys[key] = undefined;
        });
        const self = this;
        self.getExtraIgnoreKeys().forEach(function (key) {
            self.addIgnoreKeys(ignoreKeys, key.split("/"));
        });
        return ignoreKeys;
    }

    /**
     * Determine whether a push conflict between the provided localItem and remoteItem can be ignored.
     *
     * @param context The API context to be used for this operation.
     * @param localItem The local item being pushed.
     * @param remoteItem The remote item.
     * @param opts The options for this operation.
     * @returns {boolean}
     */
    canIgnoreConflict (context, localItem, remoteItem, opts) {
        const diffs = utils.compare(localItem, remoteItem, this.getIgnoreKeys());
        return (diffs.added.length === 0 && diffs.removed.length === 0 && diffs.changed.length === 0);
    }

    /**
     * Executes a compare operation between two local directories, two tenants, or a local directory and a tenant.
     *
     * @param context The API context to be used for this operation.
     * @param opts The options for this operation.
     *
     * @returns {*}
     */
    compare (context, target, source, opts) {
        const self = this;

        const targetIsUrl = utils.isValidApiUrl(target);
        const sourceIsUrl = utils.isValidApiUrl(source);

        const targetOpts = utils.cloneOpts(opts);
        const sourceOpts = utils.cloneOpts(opts);

        let targetListFunction;
        let targetGetItemFunction;
        if (targetIsUrl) {
            targetOpts["x-ibm-dx-tenant-base-url"] = target;
            if (context.readManifest) {
                targetListFunction = self.getManifestItems.bind(self);
            } else {
                targetListFunction = self._wrapRemoteListFunction.bind(self, self._listRemoteItemNames.bind(self));
            }
            targetGetItemFunction = self._wrapRemoteItemFunction.bind(self, function (context, item, opts) {
                return self.getRemoteItem(context, item.id, opts);
            });
        } else {
            targetOpts.workingDir = target;
            if (context.readManifest) {
                targetListFunction = self.getManifestItems.bind(self);
            } else {
                targetListFunction = self._wrapLocalListFunction.bind(self, self._listLocalItemNames.bind(self));
            }
            targetGetItemFunction = self._wrapLocalItemFunction.bind(self, self.getLocalItem.bind(self));
        }

        let sourceListFunction;
        let sourceGetItemFunction;
        if (sourceIsUrl) {
            sourceOpts["x-ibm-dx-tenant-base-url"] = source;
            if (context.readManifest) {
                sourceListFunction = self.getManifestItems.bind(self);
            } else {
                sourceListFunction = self._wrapRemoteListFunction.bind(self, self._listRemoteItemNames.bind(self));
            }
            sourceGetItemFunction = self._wrapRemoteItemFunction.bind(self, function (context, item, opts) {
                return self.getRemoteItem(context, item.id, opts);
            });
        } else {
            sourceOpts.workingDir = source;
            if (context.readManifest) {
                sourceListFunction = self.getManifestItems.bind(self);
            } else {
                sourceListFunction = self._wrapLocalListFunction.bind(self, self._listLocalItemNames.bind(self));
            }
            sourceGetItemFunction = self._wrapLocalItemFunction.bind(self, self.getLocalItem.bind(self));
        }

        const emitter = self.getEventEmitter(context);

        const diffItems = {
            diffCount: 0,
            totalCount: 0
        };

        const handleRemovedItem = function (context, item, opts) {
            // Add the item to the deletions manifest.
            self._updateDeletionsManifest(context, [item], opts);

            // Increment both the total items counter and diff counter.
            diffItems.totalCount++;
            diffItems.diffCount++;

            // Emit a "removed" event for the target item.
            if (emitter) {
                emitter.emit("removed", {artifactName: self.getArtifactName(), item: item});
            }
        };

        const handleAddedItem = function (context, item, opts) {
            // Add the item to the manifest.
            self._updateManifest(context, [item], opts);

            // Increment both the total items counter and diff counter.
            diffItems.totalCount++;
            diffItems.diffCount++;

            // Emit an "added" event for the source item.
            if (emitter) {
                emitter.emit("added", {artifactName: self.getArtifactName(), item: item});
            }
        };

        const handleDifferentItem = function (context, object, diffs, opts) {
            self._updateManifest(context, [object], opts);

            // Increment both the total items counter and diff counter.
            diffItems.totalCount++;
            diffItems.diffCount++;

            // Emit a "diff" event for the source item.
            if (emitter) {
                const item = self.makeEmittedObject(context, object, opts);
                emitter.emit("diff", {artifactName: self.getArtifactName(), item: item, diffs: diffs});
            }
        };

        const handleEqualItem = function (context, object, opts) {
            // Increment the total items counter.
            diffItems.totalCount++;
        };

        const handleMissingItem = function (context, object, opts) {
            // Don't count the missing items, since no comparison was done.
        };

        return targetListFunction(context, targetOpts)
            .then(function (unfilteredTargetItems) {
                const targetItems = unfilteredTargetItems.filter(function (item) {
                    return self.canCompareItem(item, targetOpts);
                });
                return sourceListFunction(context, sourceOpts)
                    .then(function (unfilteredSourceItems) {
                        const sourceItems = unfilteredSourceItems.filter(function (item) {
                            return self.canCompareItem(item, sourceOpts);
                        });

                        const targetIds = targetItems.map(function (item) {
                            return item.id;
                        });

                        const sourceIds = sourceItems.map(function (item) {
                            return item.id;
                        });

                        const promises = [];
                        targetItems.forEach(function (targetItem) {
                            if (sourceIds.indexOf(targetItem.id) === -1) {
                                // The target id exists but the source id does not. The item has been removed.
                                handleRemovedItem(context, targetItem, opts);
                            }
                        });

                        const ignoreKeys = self.getIgnoreKeys();
                        sourceItems.forEach(function (sourceItem) {
                            if (targetIds.indexOf(sourceItem.id) === -1) {
                                // The source id exists but the target id does not. The item has been added.
                                handleAddedItem(context, sourceItem, opts);
                            } else {
                                // Both the source and target ids exist, so get the complete objects for comparison.
                                const deferredCompare = Q.defer();
                                promises.push(deferredCompare.promise);

                                targetGetItemFunction(context, sourceItem, targetOpts)
                                    .then(function (targetObject) {
                                        sourceGetItemFunction(context, sourceItem, sourceOpts)
                                            .then(function (sourceObject) {
                                                if (targetObject && sourceObject) {
                                                    // Both the target and source objects exist. Compare them.
                                                    const diffs = utils.compare(sourceObject, targetObject, ignoreKeys);
                                                    if (diffs.added.length > 0 || diffs.changed.length > 0 || diffs.removed.length > 0) {
                                                        // The objects are different.
                                                        handleDifferentItem(context, sourceObject, diffs, opts);
                                                    } else {
                                                        // The objects are equal.
                                                        handleEqualItem(context, sourceObject, opts);
                                                    }
                                                } else if (targetObject) {
                                                    // The object exists in target but not source. It has been removed.
                                                    handleRemovedItem(context, targetObject, opts);
                                                } else if (sourceObject) {
                                                    // The object exists in source but not target. It has been added.
                                                    handleAddedItem(context, sourceObject, opts);
                                                } else {
                                                    // Neither the target nor source object exists. It is missing.
                                                    handleMissingItem(context, sourceItem, opts);
                                                }

                                                deferredCompare.resolve(true);
                                            })
                                            .catch(function (err) {
                                                deferredCompare.reject(err);
                                            });
                                    })
                                    .catch(function (err) {
                                        deferredCompare.reject(err);
                                    });
                            }
                        });

                        return Q.allSettled(promises)
                            .then(function () {
                                return diffItems;
                            });
                    });
            });
    }

    /**
     * Completes the push operation for the provided item.
     *
     * @param context The API context to be used for this operation.
     * @param item The item that was pushed.
     * @param opts The options for this operation.
     *
     * @returns {*}
     *
     * @private
     */
    _pushComplete (context, item, opts) {
        const emitter = this.getEventEmitter(context);
        if (emitter) {
            emitter.emit("pushed", this.makeEmittedObject(context, item, opts));
        }
        const rewriteOnPush = options.getRelevantOption(context, opts, "rewriteOnPush");
        if (rewriteOnPush) {
            return this._fsApi.saveItem(context, item, opts);
        } else {
            return item;
        }
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
                return helper._pushComplete(context, item, opts);
            })
            .catch(function (err) {
                const name = opts.originalPushFileName || helper.getName(item);
                const heading = logError + JSON.stringify(name);

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
                    const ignoreConflict = Q.defer();
                    let remoteItemPromise;
                    // Ignore a conflict (409) if the contents only differ in unimportant ways.
                    if (isUpdate && err.statusCode === 409) {
                        remoteItemPromise = helper.getRemoteItem(context, item.id, opts);
                        remoteItemPromise
                            .then(function (remoteItem) {
                                ignoreConflict.resolve(helper.canIgnoreConflict(context, item, remoteItem, opts));
                            })
                            .catch(function (remoteItemErr) {
                                ignoreConflict.reject(err);
                            });
                    } else {
                        ignoreConflict.resolve(false);
                    }

                    return ignoreConflict.promise.then(function (canIgnore) {
                        if (canIgnore) {
                            utils.logWarnings(context, i18n.__("push_warning_ignore_conflict", {name: item.name}));

                            return helper._pushComplete(context, item, opts);
                        } else {
                            const emitter = helper.getEventEmitter(context);
                            if (emitter) {
                                emitter.emit("pushed-error", err, {id: item.id, name: item.name, path: (item.path || name.path || name)});
                            }
                            err.emitted = true;
                            utils.logErrors(context, heading, err);
                            const saveFileOnConflict = options.getRelevantOption(context, opts, "saveFileOnConflict");
                            if (saveFileOnConflict && isUpdate && err.statusCode === 409) {
                                if (!remoteItemPromise) {
                                    remoteItemPromise = helper.getRemoteItem(context, item.id, opts);
                                }
                                return remoteItemPromise
                                    .then(function (item) {
                                        return helper._fsApi.saveItem(context, item, utils.cloneOpts(opts, {conflict: true}));
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
        const concurrentLimit = options.getRelevantOption(context, opts, "concurrent-limit", helper.getArtifactName());
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
                        const itemCount = helper.getRetryPushProperty(context, BaseHelper.RETRY_PUSH_ITEM_COUNT);
                        if (retryItems.length < itemCount) {
                            // At least one push operation was successful, so proceed with the retry.
                            const names = [];
                            retryItems.forEach(function (item) {
                                // Add each retry item to the list of items to be pushed.
                                const name = item[BaseHelper.RETRY_PUSH_ITEM_NAME];
                                names.push(name);

                                // Log a warning that the push of this item will be retried.
                                const error = item[BaseHelper.RETRY_PUSH_ITEM_ERROR];
                                utils.logRetryInfo(context, i18n.__("pushed_item_retry", {
                                    name: name.id || name,
                                    message: error.log ? error.log : error.message
                                }));
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
            .then(function (itemList) {
                helper._updateManifest(context, itemList, opts);
                return itemList;
            })
            .finally(function () {
                // Once the promise has been settled, remove the retry push state from the context.
                delete context.retryPush;
                delete context.filterRetryPush;
            });
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
                return helper.pullItem(context, item.id, opts);
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
     * Filter the given list of items before completing the pull operation.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Array} itemList The items to be pulled.
     * @param {Object} opts The options to be used for this operations.
     *
     * @returns {Array} The filtered list of items.
     *
     * @protected
     */
    _pullFilter (context, itemList, opts) {
        // Filter the item list based on the ready and draft options.
        const readyOnly = options.getRelevantOption(context, opts, "filterReady");
        const draftOnly = options.getRelevantOption(context, opts, "filterDraft");
        const helper = this;
        if (readyOnly) {
            // Filter out any items that are not ready.
            itemList = itemList.filter(function (item) {
                return (helper.getStatus(context, item, opts) === "ready");
            });
        } else if (draftOnly) {
            // Filter out any items that are not draft.
            itemList = itemList.filter(function (item) {
                return (helper.getStatus(context, item, opts) === "draft");
            });
        }

        // Filter the list to exclude any items that should not be saved to file.
        itemList = itemList.filter(function (item) {
            const canPullItem = helper.canPullItem(item);
            if (!canPullItem) {
                // This item cannot be pulled, so add a log entry.
                helper.getLogger(context).info(i18n.__("cannot_pull_item", {name: helper.getName(item)}));
            }

            return canPullItem;
        });

        return itemList;
    }

    _pullItemsChunk (context, listFn, opts) {
        let items = [];
        const deferred = Q.defer();
        const helper = this;
        listFn(opts)
            .then(function (itemList) {
                // Keep track of the original number of items in the chunk.
                const chunkSize = itemList.length;

                // Filter the items before saving them to the local file system.
                itemList = helper._pullFilter(context, itemList, opts);

                const promises = itemList.map(function (item) {
                    // make the emitted object before calling saveItem which prunes important data from the object!
                    const obj = helper.makeEmittedObject(context, item, opts);
                    return helper._fsApi.saveItem(context, item, opts)
                        .then(function () {
                            const emitter = helper.getEventEmitter(context);
                            if (emitter) {
                                emitter.emit("pulled", obj);
                            }
                            return item;
                        });
                });
                return Q.allSettled(promises)
                    .then(function (promises) {
                        items = [];
                        const manifestList = [];
                        promises.forEach(function (promise, index) {
                            if (promise.state === "fulfilled") {
                                items.push(promise.value);
                                manifestList.push(promise.value);
                            } else {
                                items.push(promise.reason);
                                const emitter = helper.getEventEmitter(context);
                                if (emitter) {
                                    emitter.emit("pulled-error", promise.reason, itemList[index].id);
                                }
                                context.pullErrorCount++;
                            }
                        });

                        // Append the resulting itemList to the manifest if writing/updating a manifest.
                        helper._updateManifest(context, manifestList, opts);

                        deferred.resolve({length: chunkSize, items: items});
                    });
            })
            .catch(function (err) {
                deferred.reject(err);
            });
        return deferred.promise;
    }
}

/**
 * Export the JSONItemHelper class.
 */
module.exports = JSONItemHelper;
