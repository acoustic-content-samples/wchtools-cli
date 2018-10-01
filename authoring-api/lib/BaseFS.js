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
const path = require("path");
const mkdirp = require("mkdirp");
const options = require("./utils/options.js");
const utils = require("./utils/utils.js");

class BaseFS {
    constructor (serviceName, folderName, extension) {
        this._serviceName = serviceName;
        this._folderName = folderName;
        this._extension = extension;
    }

    getServiceName () {
        return this._serviceName;
    }

    /**
     * Get the folder name for storing local artifacts based on the given options.
     *
     * @param {Object} context The API context to be used by the file operation.
     * @param {Object} [opts] Any override options to be used for this operation.
     *
     * @return {String} The folder name for storing local artifacts based on the given options.
     */
    getFolderName (context, opts) {
        return this._folderName;
    }

    getExtension () {
        return this._extension;
    }

    /**
     * Get the status of the given item.
     *
     * @param {Object} item The item for which to get the status.
     *
     * @returns {String} "ready" or "draft".
     *
     * @protected
     */
    static getStatus(item) {
        if (item && item.status && item.status === "draft") {
            return "draft";
        } else {
            return "ready";
        }
    }

    /**
     * Get a file name that is valid on all platforms.
     *
     * @param {String} value The property value to be used as a relative file name. This value could be an id, a name,
     *                       a path, etc.
     *
     * @returns {String} A file name that is valid on all platforms.
     */
    static getValidFileName (value) {
        // For now, only replace colon characters with an identifier. This is necessary because WCH ids can contain a
        // colon character to denote a change set. If we want to get more aggressive in the future, we could use the
        // regular expression /[<>"|?*]/g to replace ALL other characters that are invalid in Windows -or- Linux file
        // paths.
        return value && value.replace(/[:]/g, "_sep_");
    }

    /**
     * Get the path to the working directory based on the given options.
     *
     * @param {Object} context The API context to be used by the file operation.
     * @param {Object} opts Any override options to be used for this operation.
     */
    static getWorkingDir (context, opts) {
        const workingDir = options.getRelevantOption(context, opts, "workingDir") || process.cwd();

        return workingDir + path.sep;
    }

    /**
     * Returns the path to the item directory based on the given options, but does not create it.
     *
     * @param {Object} context The API context to be used by the file operation.
     * @param {Object} opts Any override options to be used for this operation.
     */
    getPath (context, opts) {
        return BaseFS.getWorkingDir(context, opts) + this.getFolderName(context, opts) + path.sep;
    }

    /**
     * Returns the path to the item directory based on the given options, and creates it if necessary.
     */
    getDir (context, opts) {
        const dir = this.getPath(context, opts);
        if (!fs.existsSync(dir)) {
            mkdirp.sync(dir);
        }
        return dir;
    }
}

module.exports = BaseFS;
