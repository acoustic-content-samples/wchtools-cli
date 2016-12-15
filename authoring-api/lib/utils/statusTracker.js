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

/**
 *  Status flags (not mutually exclusive)
 */
const EXISTS_LOCALLY = 1;
const EXISTS_REMOTELY = 2;

/**
 * A stateful status tracker constructor
 */
class StatusTracker {

    constructor() {
        /**
         * Keeps track of statuses by id/name
         */
        this.statuses = {};
    }

    getKey (obj) {
        let key;
        if (obj) {
            // Check if the object is a string (why does JS have two kinds of strings??)
            if (typeof obj === "string" || obj.constructor === String) {
                key = obj.toString();
            } else {
                key = obj.id || obj.name;
            }
        }
        return key;
    }

    /**
     * Returns the current status of the obj.
     *
     * Statuses are tracked by the following properties: obj.id, obj.name
     * (If no status is found for an object, it will fallback on another property)
     */
    getStatus (obj) {
        let status = undefined;
        const key = this.getKey(obj);
        if (key) {
            status = this.statuses[this.getKey(obj)];
        }
        return status;
    }

    /**
     *  Updates the status of the type with consideration given to any prior status
     *  since status are not mutually exclusive.
     *
     *  This function doesn't modify the given object.
     */
    addStatus (obj, newStatus) {
        const key = this.getKey(obj);
        if (key) {
            const oldStatus = this.statuses[key];
            if (typeof oldStatus === "undefined") {
                this.statuses[key] = [];
            }
            if (this.statuses[key].indexOf(newStatus) === -1) {
                this.statuses[key].push(newStatus);
            }
        }
    }

    removeStatus (obj, statusToRemove) {
        const key = this.getKey(obj);
        if (key) {
            const oldStatus = this.statuses[key];
            if (typeof oldStatus !== "undefined") {
                const index = this.statuses[key].indexOf(statusToRemove);
                if (index !== -1) {
                    this.statuses[key].splice(index, 1);
                }
            }
        }
    }

    /**
     *  Clears all statuses that have been recorded so far
     */
    clearAllStatuses () {
        this.statuses = {};
    }

    /**
     *  Will return true if the type exists locally (may exist remotely too).
     */
    existsLocally (obj) {
        let exists = false;
        const status = this.getStatus(obj);
        if (status && (status.indexOf(EXISTS_LOCALLY) !== -1)) {
            exists = true;
        }
        return exists;
    }

    /**
     *  Will return true if the type exists remotely (may exist locally too).
     */
    existsRemotely (obj) {
        let exists = false;
        const status = this.getStatus(obj);
        if (status && (status.indexOf(EXISTS_REMOTELY) !== -1)) {
            exists = true;
        }
        return exists;
    }

}

module.exports = StatusTracker;
module.exports.EXISTS_LOCALLY = EXISTS_LOCALLY;
module.exports.EXISTS_REMOTELY = EXISTS_REMOTELY;
