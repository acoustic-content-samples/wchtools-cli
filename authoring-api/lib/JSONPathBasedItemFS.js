/*
Copyright IBM Corporation 2017

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

const JSONItemFS = require("./JSONItemFS.js");
const fs = require("fs");
const Q = require("q");
const utils = require("./utils/utils.js");
const i18n = utils.getI18N(__dirname, ".json", "en");
const recursiveReadDir = require("recursive-readdir");

const singleton = Symbol();
const singletonEnforcer = Symbol();

class JSONPathBasedItemFS extends JSONItemFS {

    constructor(serviceName, folderName, extension) {
        super(serviceName, folderName, extension);
    }

    /**
     * Gets the item with the given path from the local filesystem
     * Rely on JSONItemFS.getItem, BUT add the path field back in after reading
     * from disk so that it will be saved in authoring service with the path val.
     *
     * @param {string} name - The name of the item
     * @returns {Q.Promise} A promise that resolves with the requested item. The promise
     *                    will reject if the item doesn't exist.
     */
    getItem(name, opts) {
        return super.getItem(name, opts)
            .then(function(item) {
                item.path = name;
                return item;
            });
    }

    /**
     * Optionally prune fields out of the item that we don't want stored on disk
     * @param {Object} item
     * @param {Object} opts
     */
     pruneItem(item, opts) {
         if (item) {
             delete item.created;
             delete item.creator;
             delete item.creatorId;
             delete item.lastModifier;
             delete item.lastModifierId;
             delete item.lastModified;
             delete item.path;
         }
     }

    /**
     * Returns the file system path to the provided item named by arg.
     * Unlike id based items, if item.path exists use it, otherwise build path from name.
     * @param arg can be a string with the name of the item or an item object
     * @returns {string} the file system path to the provided item named by arg
     */
    getItemPath(item, opts) {
        let relpath;
        if (typeof item === "string") {
            relpath = item;
        } else if (typeof item === "object") {
            relpath = item.path || "/" + item.name + this.getExtension();
        }
        let abspath = this.getPath(opts) + relpath;
        return abspath;
    }

    /**
     * @returns {Promise} a promise that resolves with the list of all items stored
     *                    in the working dir.
     *                    There is no guarantee that the names refer to a valid file.
     */
    listNames(opts) {
        const fsObject = this;
        const artifactDir = this.getPath(opts);
        return Q.Promise(function(resolve, reject) {
            const path = fsObject.getPath(opts);
            if (fs.existsSync(path)) {
                recursiveReadDir(path, function(err, files) {
                    if (err) {
                        reject(err);
                    } else {
                        const extension = fsObject.getExtension();
                        const names = files.filter(function(file) {
                            return file.endsWith(extension);
                        }).map(function(file) {
                            return utils.getRelativePath(artifactDir, file);
                        });;
                        resolve(names);
                    }
                });
            } else {
                // Silently return an empty array.
                resolve([]);
            }
        });
    }


}

module.exports = JSONPathBasedItemFS;
