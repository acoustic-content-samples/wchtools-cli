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

const BaseFS = require("./BaseFS.js");
const JSONPathBasedItemFS = require("./JSONPathBasedItemFS.js");
const fs = require("fs");
const path = require("path");
const recursiveReadDir = require("recursive-readdir");
const utils = require("./utils/utils.js");
const hashes = require("./utils/hashes.js");
const i18n = utils.getI18N(__dirname, ".json", "en");

const singleton = Symbol();
const singletonEnforcer = Symbol();

class PagesFS extends JSONPathBasedItemFS {

    constructor(enforcer) {
        if (enforcer !== singletonEnforcer)
            throw i18n.__("singleton_construct_error", {classname: "PagesFS"});

        // The folderName is passed as "" because it always needs to be calculated dynamically in the getFolderName() method.
        super("pages", "", ".json");
    }

    static get instance() {
        if (!this[singleton]) {
            this[singleton] = new PagesFS(singletonEnforcer);
        }
        return this[singleton];
    }

    /**
     * Get the folder name for storing local artifacts based on the given options.
     *
     * @param {Object} context The API context to be used by the file operation.
     * @param {Object} [opts] Any override options to be used for this operation.
     *
     * @return {String} The folder name for storing local artifacts based on the given options.
     *
     * @override
     */
    getFolderName (context, opts) {
        let siteId = "default";
        if (opts && opts.siteId) {
            siteId = opts.siteId;
        }
        return "sites/" + siteId;
    }

    /**
     * Returns the file name to use for the provided item.
     *
     * @param {Object} item the item to get the filename for
     *
     * @returns {String} the file name to use for the provided item
     *
     * @override
     */
    getFileName (item) {
        if (item && item.hierarchicalPath) {
            return BaseFS.getValidFileName(item.hierarchicalPath);
        } else {
            return super.getFileName(item);
        }
    }

    /**
     * Handle any necessary cleanup of the local file system when an artifact has been renamed.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {String} id The id of the artifact.
     * @param {String} filePath The (possibly new) filepath of the artifact.
     * @param {Object} opts Any override options to be used for this operation.
     *
     * @protected
     * @override
     */
    handleRename(context, id, filePath, opts) {
        // Only handle the case where the old file name exists and the new file name does not exist.
        const oldFilePath = this.getExistingItemPath(context, id, opts);
        const newFilePath = filePath;
        if (oldFilePath && fs.existsSync(oldFilePath) && !fs.existsSync(newFilePath)) {
            // Note: Because this process uses the current state of the local file system to determine the changes to be
            // made to the local file system, all operations in this method must be done synchronously. Otherwise, some
            // other process could call this method for another file, while this process is paused, and that process
            // could change the state of the local file system in a way that invalidates the actions of this process.

            const fsObject = this;
            const basePath = fsObject.getPath(context, opts);

            const removeEmptyParentDirectory = function (filePath) {
                const parentPath = path.dirname(filePath);
                if (parentPath !== basePath) {
                    // The parent folder is not the virtual folder containing site pages, so delete it if empty.
                    const files = fs.readdirSync(parentPath);
                    if (!files || files.length === 0) {
                        // The parent directory is now empty, so delete it.
                        fs.rmdirSync(parentPath);
                    }
                }
            };

            const fixHashesPath = function (filePath) {
                const fileContents = fs.readFileSync(filePath);
                const item = JSON.parse(fileContents.toString());
                const pathRelativeToBase = utils.getRelativePath(basePath, filePath);
                hashes.setFilePath(context, basePath, item.id, pathRelativeToBase, opts);
            };

            // Delete the old json file for the page.
            fs.unlinkSync(oldFilePath);

            // Handle any children of the renamed page.
            const oldFolderPath = oldFilePath.substr(0, oldFilePath.lastIndexOf('.'));
            const newFolderPath = newFilePath.substr(0, newFilePath.lastIndexOf('.'));
            if (fs.existsSync(oldFolderPath)) {
                // The child pages folder exists for the old page name.
                if (fs.existsSync(newFolderPath)) {
                    // The new folder also exists, so move files from the old folder to the new folder.
                    const oldChildPaths = fsObject.getDescendentFilePaths(oldFolderPath, fsObject.getExtension());
                    oldChildPaths.forEach(function (oldChildPath) {
                        try {
                            const relativeChildPath = utils.getRelativePath(oldFolderPath, oldChildPath);
                            const newChildPath = newFolderPath + relativeChildPath;
                            if (fs.existsSync(newChildPath)) {
                                // The new child file already exists, so just delete the old child file.
                                fs.unlinkSync(oldChildPath);
                            } else {
                                // The new child file does not exist, so move the old child file to the new folder.
                                fs.renameSync(oldChildPath, newChildPath);

                                // Fix the hashes for the child page that was moved.
                                fixHashesPath(newChildPath);
                            }
                        } catch (err) {
                            utils.logWarnings(context, err.toString());
                        }
                    });

                    try {
                        // The old folder should be empty now, so delete it.
                        fs.rmdirSync(oldFolderPath);

                        // So the old page file has been deleted, all children of the old page have been moved/deleted,
                        // and the old page folder has been deleted. Now determine whether to also delete parent folder.
                        removeEmptyParentDirectory(oldFilePath);
                    } catch (err) {
                        utils.logWarnings(context, err.toString());
                    }
                } else {
                    try {
                        // The new folder does not exist, so rename the existing folder containing the child pages.
                        fs.renameSync(oldFolderPath, newFolderPath);

                        // Fix the hashes for the child pages.
                        const newChildPaths = fsObject.getDescendentFilePaths(newFolderPath, fsObject.getExtension());
                        newChildPaths.forEach(function (newChildPath) {
                            fixHashesPath(newChildPath);
                        });

                        // So the old page file has been deleted, and the folder has been renamed. Now determine whether
                        // to also delete parent folder.
                        removeEmptyParentDirectory(oldFilePath);
                    } catch (err) {
                        utils.logWarnings(context, err.toString());
                    }
                }
            } else {
                // So the old page file has been deleted. Now determine whether to also delete the parent folder.
                try {
                    removeEmptyParentDirectory(oldFilePath);
                } catch (err) {
                    utils.logWarnings(context, err.toString());
                }
            }
        } else {
            super.handleRename(context, id, filePath, opts);
        }
    }

    /*
     * Clear the mutable path value.
     */
    clearMutablePath(item) {
        delete item.hierarchicalPath;
    }

    /*
     * Set the mutable path value.
     */
    setMutablePath(item, filePath) {
        item.hierarchicalPath = filePath;
    }
}

module.exports = PagesFS;
