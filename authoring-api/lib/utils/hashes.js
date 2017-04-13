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
const crypto = require("crypto");
const path = require("path");
const utils = require("./utils.js");
const options = require("./options.js");

const logger = utils.getLogger(utils.apisLog);
const i18n = utils.getI18N(__dirname, ".json", "en");

const NEW = "new";
const MODIFIED = "mod";
const DELETED = "del";

const OLD_FILENAME = ".dxhashes";
const FILENAME = ".wchtoolshashes";

/**
 * Generates the MD5 hash for the contents of the given file.
 *
 * @param {String} filename The name of the file for which an MD5 hash is to be generated.
 *
 * @returns {String} The MD5 hash for the contents of the given file.
 *
 * @private
 */
function generateMD5Hash(filename) {
    const hash = crypto.createHash("md5");
    const content = fs.readFileSync(filename); // returns a Buffer
    hash.update(content);
    const md5 = hash.digest("base64"); // returns a base-64 encoded string
    return md5;
}

/**
 * Compare two base64 encoded md5 hashes, decoding first to account for padding differences
 *
 * @param {String} hash1
 * @param {String} hash2
 *
 * @returns {boolean} specifying whether the hashes match
 *
 * @private
 */
function compareMD5Hashes(hash1, hash2) {
    return (hash1 && hash2) &&
            ((hash1 === hash2) ||
            Buffer.compare(new Buffer(hash1, 'base64'), new Buffer(hash2, 'base64')) === 0);
}

/**
 * Get the path for the hashes file at the given path.
 *
 * Note: A hashes file may not exist in this location.
 *
 * @param {String} basePath The path where the hashes file is (may be) located.
 *
 * @returns {String} The path for the hashes file at the given path.
 *
 * @private
 */
function getHashesFilename(basePath) {
    const filename = basePath + "/" + FILENAME;
    if (!fs.existsSync(filename)) {
        const oldFilename = basePath + "/" + OLD_FILENAME;
        if (fs.existsSync(oldFilename)) {
            fs.renameSync(oldFilename, filename);
        }
    }
    return filename;
}

/**
 * Get the tenant ID specified by the given options.
 *
 * @param {Object} opts The options object that specifies which tenant is being used.
 *
 * @returns {String} The tenant ID specified by the given options (may be undefined).
 *
 * @private
 */
function getTenant(opts) {
    return options.getRelevantOption(opts, "x-ibm-dx-tenant-id");
}

/**
 * Load the tenant map from the hashes file at the given location.
 *
 * Note: The tenant map contains metadata for multiple tenants, keyed by tenant ID.
 *
 * @param {String} basePath The path where the hashes file is located.
 *
 * @returns {Object} The tenant map from the hashes file at the given location, or an empty object.
 *
 * @private
 */
function loadTenantMap(basePath) {
    let tenantMap = {};
    const hashesFilename = getHashesFilename(basePath);
    try {
        // Read the tenant map from the hashes file at the specified location, if it exists.
        if (fs.existsSync(hashesFilename)) {
            const contents = fs.readFileSync(hashesFilename);
            tenantMap = JSON.parse(contents);
        }
    } catch (err) {
        // Log the error and return an empty tenant map.
        utils.logErrors(i18n.__("error_tenant_map"), err);
    }
    return tenantMap;
}

/**
 * Load the metadata for the specified tenant from the hashes file at the given location.
 *
 * @param {String} basePath The path where the hashes file is located.
 * @param {Object} opts The options object that specifies which tenant is being used.
 *
 * @returns {Object} The metadata for the specified tenant from the hashes file at the given location, or an empty object.
 *
 * @private
 */
function loadHashes(basePath, opts) {
    const tenantMap = loadTenantMap(basePath);
    return tenantMap[getTenant(opts)] || {};
}

/**
 * Save the given tenant metadata to the hashes file at the given location.
 *
 * @param {String} basePath The path where the hashes file is located.
 * @param {Object} hashMap The metadata for the specified tenant.
 * @param {Object} opts The options object that specifies which tenant is being used.
 *
 * @returns {Object} The updated tenant map for the hashes file at the given location, or an empty object.
 *
 * @private
 */
function saveHashes(basePath, hashMap, opts) {
    const hashesFilename = getHashesFilename(basePath);
    try {
        const tenantMap = loadTenantMap(basePath);
        tenantMap[getTenant(opts)] = hashMap;
        const contents = JSON.stringify(tenantMap, null, "  ");

        // If the directory doesn't exist, there is nothing to push or pull so don't bother to save the hashes.
        if (fs.existsSync(basePath)) {
            // Write the modified tenant map to the hashes file.
            fs.writeFileSync(hashesFilename, contents);
        }

        // Return the tenant map that was written to the hashes file.
        return tenantMap;
    } catch (err) {
        // Log the error, and return the current state of the tenant map.
        utils.logErrors(i18n.__("error_save_hashes"), err);
        return loadTenantMap(basePath);
    }
}

/**
 * Update the metadata for the given file in the hashes file at the specified location.
 *
 * @param {String} basePath The path where the hashes file is located.
 * @param {String} filePath The local path for the file whose metadata is being updated.
 * @param {Object} item The metadata for the specified file.
 * @param {Object} opts The options object that specifies which tenant is being used.
 *
 * @returns {Object} The updated tenant map for the hashes file at the given location, or an empty object.
 *
 * @public
 */
function updateHashes(basePath, filePath, item, opts) {
    try {
        let md5 = undefined;
        let mtime = undefined;
        try {
            // Get the MD5 hash value and the (local) last modified date for the specified file.
            if (fs.existsSync(filePath)) {
                md5 = generateMD5Hash(filePath);
                mtime = fs.statSync(filePath).mtime;
            }
        } catch (ignore) {
            // The specified file does not exist locally or cannot be read.
        }

        // If there is valid metadata for the specified file, save it to the hashes file at the specified location.
        if (item && item.id && md5 && mtime) {
            const relative = utils.getRelativePath(basePath, filePath);
            const entry = {
                id: item.id,
                rev: item.rev,
                lastModified: item.lastModified,
                md5: md5,
                path: relative,
                localLastModified: mtime
            };

            // If the item is an asset with a resource reference, save it as well.
            if (item.resource) {
                entry.resource = item.resource;
            }

            // Get the existing tenant metadata at the specified location.
            const hashMap = loadHashes(basePath, opts);

            // Remove any stale entries for the current tenant (same unique path as the entry being updated).
            Object.keys(hashMap).forEach(function (key) {
                if (hashMap[key].path === relative) {
                    hashMap[key] = undefined;
                }
            });

            // Update the tenant metadata with the new entry.
            hashMap[item.id] = entry;

            // Save the updated tenant metadata to the hashes file at the specified location, and return the tenant map.
            return saveHashes(basePath, hashMap, opts);
        } else {
            // The tenant metadata was not updated, so just return the current state of the tenant map.
            return loadTenantMap(basePath);
        }
    } catch (err) {
        // Log the error and return the current state of the tenant map.
        utils.logErrors(i18n.__("error_update_hashes"), err);
        return loadTenantMap(basePath);
    }
}

/**
 * Get the timestamp of the last pull for the specified tenant.
 *
 * Example: "2017-01-16T22:30:05.928Z"
 *
 * @param {String} basePath The path where the hashes file is located.
 * @param {Object} opts The options object that specifies which tenant is being used.
 *
 * @returns {String} The timestamp of the last pull for the specified tenant.
 *
 * @public
 */
function getLastPullTimestamp(basePath, opts) {
    // Get the tenant metadata from the hashes file at the specified location.
    const hashMap = loadHashes(basePath, opts);

    // Return the pull timestamp for the tenant.
    return hashMap.lastPullTimestamp;
}

/**
 * Set the timestamp of the last pull for the specified tenant.
 *
 * @param {String} basePath The path where the hashes file is located.
 * @param {Date | String} timestamp The timestamp of the last pull for the specified tenant.
 * @param {Object} opts The options object that specifies which tenant is being used.
 *
 * @returns {Object} The updated tenant map for the hashes file at the given location, or an empty object.
 *
 * @public
 */
function setLastPullTimestamp(basePath, timestamp, opts) {
    try {
        // Get the tenant metadata from the hashes file at the specified location.
        const hashMap = loadHashes(basePath, opts);

        // Update the tenant metadata with the timestamp value and save it to the hashes file in the specified location.
        hashMap.lastPullTimestamp = timestamp;
        return saveHashes(basePath, hashMap, opts);
    } catch (err) {
        // Log the error and return the current state of the tenant map.
        utils.logErrors(i18n.__("error_set_last_pull_timestamp"), err);
        return loadTenantMap(basePath);
    }
}

/**
 * Get the timestamp of the last push for the specified tenant.
 *
 * Example: "2017-01-16T22:30:05.928Z"
 *
 * @param {String} basePath The path where the hashes file is located.
 * @param {Object} opts The options object that specifies which tenant is being used.
 *
 * @returns {String} The timestamp of the last push for the specified tenant.
 *
 * @public
 */
function getLastPushTimestamp(basePath, opts) {
    // Get the tenant metadata from the hashes file at the specified location.
    const hashMap = loadHashes(basePath, opts);

    // Return the pull timestamp for the tenant.
    return hashMap.lastPushTimestamp;
}

/**
 * Set the timestamp of the last push for the specified tenant.
 *
 * @param {String} basePath The path where the hashes file is located.
 * @param {Date | String} timestamp The timestamp of the last push for the specified tenant.
 * @param {Object} opts The options object that specifies which tenant is being used.
 *
 * @returns {Object} The updated tenant map for the hashes file at the given location, or an empty object.
 *
 * @public
 */
function setLastPushTimestamp(basePath, timestamp, opts) {
    try {
        // Get the tenant metadata from the hashes file at the specified location.
        const hashMap = loadHashes(basePath, opts);

        // Update the tenant metadata with the timestamp value and save it to the hashes file in the specified location.
        hashMap.lastPushTimestamp = timestamp;
        return saveHashes(basePath, hashMap, opts);
    } catch (err) {
        // Log the error and return the current state of the tenant map.
        utils.logErrors(i18n.__("error_set_last_push_timestamp"), err);
        return loadTenantMap(basePath);
    }
}

/**
 * Get the metadata for the given file from the hashes file at the specified location for the specified tenant.
 *
 * @param {String} basePath The path where the hashes file is located.
 * @param {String} filePath The local path for the file.
 * @param {Object} opts The options object that specifies which tenant is being used.
 *
 * @returns {Object} The metadata for the given file from the hashes file at the specified location for the specified
 *          tenant, or undefined if the metadata is not found.
 *
 * @public
 */
function getHashesForFile(basePath, filePath, opts) {
    const relative = utils.getRelativePath(basePath, filePath);
    try {
        // Get the tenant metadata from the hashes file at the specified location.
        const hashMap = loadHashes(basePath, opts);

        // Find the key of the hash map entry containing the metadata for the specified file.
        const fileKey = Object.keys(hashMap)
            .filter(function (key) {
                return (hashMap[key].path === relative);
            })[0];

        // Return the hash map entry containing the metadata for the specified file.
        return hashMap[fileKey];
    } catch (err) {
        // Log the error and return an empty object.
        utils.logErrors(i18n.__("error_get_hashes_for_file"), err);
    }
}

/**
 * Get an array of file paths from the hashes file at the specified location for the specified tenant.
 *
 * @param {String} basePath The path where the hashes file is located.
 * @param {Object} opts The options object that specifies which tenant is being used.
 *
 * @returns {Array} An array of file paths from the hashes file at the specified location for the specified tenant.
 *
 * @public
 */
function listFiles(basePath, opts) {
    // Get the tenant metadata from the hashes file at the specified location.
    const hashMap = loadHashes(basePath, opts);

    // Return an array of file paths.
    return Object.keys(hashMap)
        .filter(function (key){
            // Filter out the timestamp entries.
            return (key !== "lastPullTimestamp" && key !== "lastPushTimestamp");
        })
        .map(function (fileKey) {
            // Return the file path for each file entry.
            return hashMap[fileKey].path;
        });
}

/**
 * Determine whether the specified local file is modified (or new).
 *
 * @param {Array} flags A set that can include NEW and/or MODIFIED.
 * @param {String} basePath The path where the hashes file is located.
 * @param {String} filePath The local path for the file.
 * @param {Object} opts The options object that specifies which tenant is being used.
 *
 * @returns {Boolean} A return value of true indicates that the specified local file is modified (or new). A return
 *          value of false indicates that the specified local file is not modified (or new).
 *
 * @public
 */
function isLocalModified(flags, basePath, filePath, opts) {
    // Check for both new and modified by default.
    flags = flags || [NEW, MODIFIED];
    logger.debug("hashes.isLocalModified", flags, filePath);

    // Get the metadata for the given file from the hashes file at the specified location.
    const fileHashes = getHashesForFile(basePath, filePath, opts);

    // Get the stat values for the specified file, if it exists.
    let stat;
    try {
        stat = fs.statSync(filePath);
    } catch (err) {
        // The file doesn't exist.
    }

    // Determine whether the local file is modified.
    let modified = false;
    if (flags.indexOf(MODIFIED) !== -1) {
        logger.debug("hashes.isLocalModified MODIFIED fileHashes", (fileHashes !== undefined));
        logger.debug("hashes.isLocalModified MODIFIED fileHashes localLastModified", fileHashes ? Date.parse(fileHashes.localLastModified) : undefined);
        logger.debug("hashes.isLocalModified MODIFIED stat.mtime", stat ? stat.mtime.getTime() : undefined);

        // For performance first compare the timestamps. If the timestamps are equal, assume the file is not modified.
        if (fileHashes && fileHashes.localLastModified && stat && stat.mtime.getTime() !== Date.parse(fileHashes.localLastModified)) {
            // The timestamps don't match so check the md5 hashes.
            const md5 = generateMD5Hash(filePath);
            logger.debug("hashes.isLocalModified MODIFIED fileHashes md5", fileHashes.md5);
            logger.debug("hashes.isLocalModified MODIFIED md5", md5);

            if (fileHashes.md5 && md5 !== fileHashes.md5) {
                // The md5 hashes don't match so the file is modified.
                logger.debug("hashes.isLocalModified MODIFIED file is modified");
                modified = true;
            } else {
                // The md5 hashes match, but the timestamps did not. Update the timestamp in hashes so that we may not
                // need to generate the md5 hash next time.
                const hashMap = loadHashes(basePath, opts);
                Object.keys(hashMap)
                    .forEach(function (key) {
                        // Match on the path field and sanity check that md5 matches.
                        if ((hashMap[key].path === fileHashes.path) && (hashMap[key].md5 === md5)) {
                            hashMap[key].localLastModified = stat.mtime;
                        }
                    });
                saveHashes(basePath, hashMap, opts);
            }
        }
    }

    // Determine whether the local file is new.
    if (flags.indexOf(NEW) !== -1) {
        logger.debug("hashes.isLocalModified NEW fileHashes", (fileHashes !== undefined));
        logger.debug("hashes.isLocalModified NEW fileHashes localLastModified", fileHashes ? fileHashes.localLastModified : undefined);
        logger.debug("hashes.isLocalModified NEW fileHashes md5", fileHashes ? fileHashes.md5 : undefined);

        // The local file is new if it exists but the metadata in the hashes file does not exist.
        if (stat && (!fileHashes || !fileHashes.localLastModified || !fileHashes.md5)) {
            logger.debug("hashes.isLocalModified NEW file is new");
            modified = true;
        }
    }

    logger.debug("hashes.isLocalModified returning", modified, flags, filePath);

    return modified;
}

/**
 * Determine whether the specified remote file is modified (or new).
 *
 * @param {Array} flags A set that can include NEW and/or MODIFIED.
 * @param {Object} item The metadata for the specified file.
 * @param {String} basePath The path where the hashes file is located.
 * @param {String} filePath The local path for the file.
 * @param {Object} opts The options object that specifies which tenant is being used.
 *
 * @returns {Boolean} A return value of true indicates that the specified remote file is modified (or new). A return
 *          value of false indicates that the specified remote file is not modified (or new).
 *
 * @public
 */
function isRemoteModified(flags, item, basePath, filePath, opts) {
    // Check for both new and modified by default.
    flags = flags || [NEW, MODIFIED];
    logger.debug("hashes.isRemoteModified", flags, filePath);

    // Get the metadata for the given file from the hashes file at the specified location.
    const fileHashes = getHashesForFile(basePath, filePath, opts);

    // Determine whether the remote file is modified.
    let modified = false;
    if (flags.indexOf(MODIFIED) !== -1) {
        logger.debug("hashes.isRemoteModified MODIFIED fileHashes", (fileHashes !== undefined));
        logger.debug("hashes.isRemoteModified MODIFIED fileHashes rev", fileHashes ? fileHashes.rev : undefined);
        logger.debug("hashes.isRemoteModified MODIFIED rev", item.rev);

        // The remote file is modified if the rev ids don't match.
        if (fileHashes && fileHashes.rev !== item.rev) {
            logger.debug("hashes.isRemoteModified MODIFIED file is modified");
            modified = true;
        }
    }

    // Determine whether the remote file is new.
    if (flags.indexOf(NEW) !== -1) {
        logger.debug("hashes.isRemoteModified NEW fileHashes", (fileHashes !== undefined));

        // The remote file is new if the file hashes is empty.
        if (!fileHashes) {
            logger.debug("hashes.isRemoteModified NEW file is new");
            modified = true;
        }
    }

    logger.debug("hashes.isRemoteModified returning", modified, flags, filePath);

    return modified;
}

const hashes = {
    generateMD5Hash: generateMD5Hash,
    compareMD5Hashes: compareMD5Hashes,
    updateHashes: updateHashes,
    getLastPullTimestamp: getLastPullTimestamp,
    setLastPullTimestamp: setLastPullTimestamp,
    getLastPushTimestamp: getLastPushTimestamp,
    setLastPushTimestamp: setLastPushTimestamp,
    getHashesForFile: getHashesForFile,
    listFiles: listFiles,
    isLocalModified: isLocalModified,
    isRemoteModified: isRemoteModified,
    FILENAME: FILENAME,
    NEW: NEW,
    MODIFIED: MODIFIED,
    DELETED: DELETED
};

module.exports = hashes;
