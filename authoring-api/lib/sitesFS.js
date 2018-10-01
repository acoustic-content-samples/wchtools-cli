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
const JSONItemFS = require("./JSONItemFS.js");
const fs = require("fs");
const utils = require("./utils/utils.js");
const i18n = utils.getI18N(__dirname, ".json", "en");

const singleton = Symbol();
const singletonEnforcer = Symbol();

class SitesFS extends JSONItemFS {
    constructor(enforcer) {
        if (enforcer !== singletonEnforcer)
            throw i18n.__("singleton_construct_error", {classname: "SitesFS"});

        super("sites", "sites", ".json");
    }

    static get instance() {
        if (!this[singleton]) {
            this[singleton] = new SitesFS(singletonEnforcer);
        }
        return this[singleton];
    }

    /**
     * Returns the file name to use for the provided item.
     *
     * @param {Object} item the item to get the filename for
     *
     * @returns {String} the file name to use for the provided item
     */
    getFileName(item) {
        return SitesFS.getSiteContextName(item);
    }

    /**
     * Get the context name to use for the given site.
     *
     * @param {Object} site The site for which to get the context name.
     *
     * @returns {String} The context name to use for the given site.
     */
    static getSiteContextName(site) {
        if (site) {
            let filename;
            if (site["contextRoot"] && site["contextRoot"] !== "/") {
                // Use the context root as the default context name.
                filename = site["contextRoot"];

                // A draft site can have the same contextRoot as its corresponding ready site.
                if (BaseFS.getStatus(site) === "draft") {
                    // Differentiate the file name of the draft site by adding a suffix.
                    const projectId = site["projectId"];
                    const suffix = "_wchdraft" + (projectId ? "_" + projectId : "");
                    filename += suffix;
                }
            } else if (site.id === "default:draft") {
                // Handle the special case of the default draft site.
                filename = "default_wchdraft";
            } else {
                // The context root cannot be used for the context name, so fall back to using the id.
                filename = site.id;
            }
            return BaseFS.getValidFileName(filename);
        }
    }

    /**
     * Determine whether the list of artifacts for this type should always include a path value.
     *
     * @param {Object} context The API context to be used by the get operation.
     * @param {Object} opts Any override options to be used for this operation.
     *
     * @returns {Boolean} A return value of true indicates that a path value should always be included.
     *
     * @protected
     */
    alwaysListPath(context, opts) {
        return true;
    }

    /**
     * Delete the outdated artifact from the local file system when an artifact has been renamed.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {String} oldFilePath The id of the artifact.
     * @param {String} newFilePath The (possibly new) filepath of the artifact.
     * @param {Object} opts Any override options to be used for this operation.
     *
     * @protected
     */
    deleteRenamedFile(context, oldFilePath, newFilePath, opts) {
        // Rename the site pages folder before renaming the artifact file.
        const extension = this.getExtension();
        if (oldFilePath.endsWith(extension) && newFilePath.endsWith(extension)) {
            const oldFolderPath = oldFilePath.substring(0, oldFilePath.length - extension.length);
            const newFolderPath = newFilePath.substring(0, newFilePath.length - extension.length);

            // Only rename the pages folder if the old folder exists and the new folder does not.
            if (fs.existsSync(oldFolderPath) && fs.statSync(oldFolderPath).isDirectory() && !fs.existsSync(newFolderPath)) {
                fs.renameSync(oldFolderPath, newFolderPath);
            }
        }

        // Call the super method to delete the old artifact file from the local file system.
        super.deleteRenamedFile(context, oldFilePath, newFilePath, opts);
    }

    /**
     * @param {Object} context The API context to be used by the get operation.
     * @param {Object} opts Any override options to be used for this operation.
     *
     * @returns {Q.Promise} A promise that resolves with the list of all items stored in the working dir.
     *                      There is no guarantee that the names refer to a valid file.
     */
    listNames(context, opts) {
        const self = this;

        // Each site in the resulting list should include the contextRoot property.
        opts = utils.cloneOpts(opts);
        if (!opts["additionalItemProperties"]) {
            opts["additionalItemProperties"] = [];
        }
        opts["additionalItemProperties"].push("contextRoot");
        opts["additionalItemProperties"].push("status");

        return super.listNames(context, opts)
            .then(function (items) {
                // Check each site item to see if the contextRoot may have been changed. If so, the site artifact file
                // and corresponding pages folder will need to be renamed to match the new context root value.
                items.forEach(function (item) {
                    if (item.path && item.contextRoot && item.contextRoot !== "/") {
                        const filename = self.getFileName(item);
                        if (item.path !== filename) {
                            // The current file name does not match the file name expected for the context root.
                            const sitesPath = self.getPath(context, opts);
                            const sitesExtension = self.getExtension();
                            const existingFileName = sitesPath + item.path + sitesExtension;
                            const newFileName = sitesPath + filename + sitesExtension;
                            const existingFolderName = sitesPath + item.path;
                            const newFolderName = sitesPath + filename;

                            // Rename the site artifact file.
                            if (fs.existsSync(existingFileName)) {
                                fs.renameSync(existingFileName, newFileName);
                            }

                            // Rename the site pages folder.
                            if (fs.existsSync(existingFolderName)) {
                                fs.renameSync(existingFolderName, newFolderName);
                            }
                        }
                    }
                });

                return items;
            });
    }
}

module.exports = SitesFS;
