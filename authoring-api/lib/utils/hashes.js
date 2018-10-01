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

const Q = require("q");
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const utils = require("./utils.js");
const options = require("./options.js");
const mkdirp = require("mkdirp");
const i18n = utils.getI18N(__dirname, ".json", "en");

const NEW = "new";
const MODIFIED = "mod";
const DELETED = "del";

const OLD_FILENAME = ".dxhashes";
const FILENAME = ".wchtoolshashes";

const HASH_ALGORITHM = "md5";
const HASH_ENCODING = "base64";

const HASH_FILE_SPACING = "";
const HASHES_VERSION = "2";

/**
 * Returns true if the supplied pathname is a hashes metadata file.
 *
 * @param {String} filename The name of the file to test.
 *
 * @returns {Boolean} true if the supplied pathname is a hashes metadata file.
 */
function isHashesFile (filename) {
    if (filename) {
        filename = filename.substring(filename.lastIndexOf("/") + 1);
    }
    return (filename === FILENAME) || (filename === OLD_FILENAME);
}

/**
 * Generates the MD5 hash for the contents of the given file.
 *
 * @param {String} filename The name of the file for which an MD5 hash is to be generated.
 *
 * @returns {String} The MD5 hash for the contents of the given file.
 *
 * @private
 */
function generateMD5HashSync (filename) {
    const content = fs.readFileSync(filename); // returns a Buffer
    const hash = crypto.createHash(HASH_ALGORITHM);
    hash.update(content);
    const md5 = hash.digest(HASH_ENCODING); // returns a base-64 encoded string
    return md5;
}

/**
 * Generates the MD5 hash for the contents of the given file.
 *
 * @param {String} filename The name of the file for which an MD5 hash is to be generated.
 *
 * @returns {Promise} A promise for the MD5 hash for the contents of the given file.
 *
 * @private
 */
function generateMD5Hash (filename) {
    const stream = fs.createReadStream(filename);
    const md5Promise = generateMD5HashFromStream(stream);
    return md5Promise;
}

/**
 * Generates both an MD5 hash and a unique ID for the contents of the given file.
 *
 * @param {String} filename The name of the file for which an MD5 hash and unique ID is to be generated.
 *
 * @returns {Object} The MD5 hash and unique ID for the contents of the given file.
 *
 * @private
 */
function generateMD5HashAndID (basePath, filename) {
    const deferred = Q.defer();
    // Get the MD5 hash of the binary content.
    generateMD5Hash(filename).then(function (md5) {
        // Calculate a MD5 hash of the relative filename.
        const hashID = crypto.createHash(HASH_ALGORITHM);
        const relative = path.relative(basePath, filename);
        hashID.update(relative);
        // Concat the MD5 hash of the binary content with the relative filename.
        const id = new Buffer(md5, HASH_ENCODING).toString("hex") + "_" + hashID.digest("hex");
        deferred.resolve({
            md5: md5,
            id: id
        });
    }).catch(function (err) {
        deferred.reject(err);
    });
    return deferred.promise;
}

/**
 * Generates the MD5 hash for the contents of the given read stream.
 *
 * @param {String} readStream The stream for which an MD5 hash is to be generated.
 *
 * @returns {String} The MD5 hash for the contents of the given read stream.
 *
 * @private
 */
function generateMD5HashFromStream (readStream) {
    const deferred = Q.defer();
    const hash = crypto.createHash(HASH_ALGORITHM);

    readStream.on("data", function (data) {
        hash.update(data);
    });
    readStream.on("end", function () {
        deferred.resolve(hash.digest(HASH_ENCODING));
    });
    readStream.on("error", function (err) {
        deferred.reject(err);
    });

    return deferred.promise;
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
function compareMD5Hashes (hash1, hash2) {
    return (hash1 && hash2) &&
            ((hash1 === hash2) ||
            Buffer.compare(new Buffer(hash1, HASH_ENCODING), new Buffer(hash2, HASH_ENCODING)) === 0);
}

function normalizePath (basePath) {
    basePath = path.normalize(basePath);
    if (!basePath.endsWith(path.sep)) {
        basePath += path.sep;
    }
    return basePath;
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
function getHashesFilename (basePath) {
    const filename = normalizePath(basePath) + FILENAME;
    if (!fs.existsSync(filename)) {
        const oldFilename = normalizePath(basePath) + OLD_FILENAME;
        if (fs.existsSync(oldFilename)) {
            fs.renameSync(oldFilename, filename);
        }
    }
    return filename;
}

/**
 * Get the tenant ID specified by the given options.
 *
 * @param {Object} context The current API context.
 * @param {Object} opts The options object that specifies which tenant is being used.
 *
 * @returns {String} The tenant ID specified by the given options (may be undefined).
 *
 * @private
 */
function getTenantID (context, opts) {
    return options.getRelevantOption(context, opts, "x-ibm-dx-tenant-id");
}

/**
 * Get the base URL specified by the given options.
 *
 * @param {Object} context The current API context.
 * @param {Object} opts The options object that specifies which tenant is being used.
 *
 * @returns {String} The base URL specified by the given options (may be undefined).
 *
 * @private
 */
function getBaseUrl (context, opts) {
    return options.getRelevantOption(context, opts, "x-ibm-dx-tenant-base-url");
}

/**
 * Get the tenant map key specified by the given options.
 *
 * @param {Object} context The current API context.
 * @param {Object} tenantMap The tenant map from a hashes file.
 * @param {Object} opts The options object that specifies which tenant is being used.
 *
 * @returns {String} The tenant map key specified by the given options (may be undefined).
 *
 * @private
 */
function getTenantKey (context, basePath, opts) {
    let tenantKey = getTenantID(context, opts);
    const tenantBaseUrl = getBaseUrl(context, opts);
    if (!tenantKey && tenantBaseUrl) {
        // attempt to find tenantKey from stored mapping of baseUrls to tenantIDs
        basePath = normalizePath(basePath);
        const tenantsMap = context.hashes[basePath];
        Object.keys(tenantsMap).forEach(function (key) {
            const tenant = tenantsMap[key];
            if (tenant && tenant.baseUrls) {
                tenant.baseUrls.forEach(function (baseUrl) {
                    if (baseUrl === tenantBaseUrl) {
                        tenantKey = key;
                    }
                });
            }
        });
    }

    return tenantKey;
}

/**
 * Load the tenant map from the hashes file at the given location.
 *
 * Note: The tenant map contains metadata for multiple tenants, keyed by tenant ID.
 *
 * @param {Object} context The current API context.
 * @param {String} basePath The path where the hashes file is located.
 *
 * @returns {Object} The tenant map from the hashes file at the given location, or an empty object.
 *
 * @private
 */
function loadTenantMap (context, basePath) {
    if (!context.hashes) {
        context.hashes = {};
    }
    basePath = normalizePath(basePath);
    let tenantMap = context.hashes[basePath];
    if (!tenantMap) {
        tenantMap = {};
        const hashesFilename = getHashesFilename(basePath);
        try {
            // Read the tenant map from the hashes file at the specified location, if it exists.
            if (fs.existsSync(hashesFilename)) {
                const contents = fs.readFileSync(hashesFilename);
                tenantMap = JSON.parse(contents);
                // Initialize the update count to 0 and the last update timestamp to now.
                tenantMap.updateCount = 0;
                tenantMap.updateTS = Date.now();
            }
        } catch (err) {
            // Log the error and return an empty tenant map.
            utils.logErrors(context, i18n.__("error_tenant_map"), err);
        }
        context.hashes[basePath] = tenantMap;
    }
    return tenantMap;
}

/**
 * Load the metadata for the specified tenant from the hashes file at the given location.
 *
 * @param {Object} context The current API context.
 * @param {String} basePath The path where the hashes file is located.
 * @param {Object} opts The options object that specifies which tenant is being used.
 *
 * @returns {Object} The metadata for the specified tenant from the hashes file at the given location, or an empty object.
 *
 * @private
 */
function loadHashes (context, basePath, opts) {
    const tenantMap = loadTenantMap(context, basePath);
    return tenantMap[getTenantKey(context, basePath, opts)] || {};
}

/**
 * Updates the provided hashMap to create or append a baseUrls array to the data structure
 * that contains the set of x-ibm-dx-tenant-base-url that have been used for the current
 * x-ibm-dx-tenant-id.
 *
 * @param {Object} context The current API context.
 * @param {Object} hashMap the map to augment with the baseUrls structure
 * @param {Object} opts The options object that specifies the tenant data
 *
 * @return {Object} the modified hashMap
 *
 * @private
 */
function updateBaseUrls (context, hashMap, opts) {
    const baseUrl = getBaseUrl(context, opts);
    if (baseUrl) {
        if (!hashMap.baseUrls) {
            hashMap.baseUrls = [];
        }
        if (hashMap.baseUrls.indexOf(baseUrl) === -1) {
            hashMap.baseUrls.push(baseUrl);
        }
    }
    return hashMap;
}

/**
 * Performs cleanup actions when the process exits.
 * @param context The current API context.
 */
function exitHandler(context) {
    // Iterate each basePath that is in the context.hashes object and save it.
    Object.keys(context.hashes).forEach(function (basePath) {
        try {
            writeHashes(basePath, context.hashes[basePath]);
        } catch (err) {
            // Log the error and return the current state of the tenant map.
            utils.logErrors(context, i18n.__("error_save_hashes"), err);
        }
    });
}

/**
 * Performs a synchronous write of the speficied tenantMap to the hashes file at the specified basePath.
 *
 * @param basePath The path where the hashes file is located.
 * @param tenantMap The tenant map to write.
 */
function writeHashes (basePath, tenantMap) {
    // If the directory doesn't exist, there is nothing to push or pull so don't bother to save the hashes.
    if (fs.existsSync(basePath)) {
        tenantMap.version = HASHES_VERSION;
        const contents = JSON.stringify(tenantMap, null, HASH_FILE_SPACING);

        // Write the modified tenant map to the hashes file.
        const hashesFilename = getHashesFilename(basePath);
        // Write to a temporary file first
        fs.writeFileSync(hashesFilename + ".tmp", contents);
        // Now delete the original hashes file
        if (fs.existsSync(hashesFilename)) {
            fs.unlinkSync(hashesFilename);
        }
        // Finally rename the temporary file to the correct name
        fs.renameSync(hashesFilename + ".tmp", hashesFilename);

        // Reset the update count to 0 and the last update timestamp to now.
        tenantMap.updateCount = 0;
        tenantMap.updateTS = Date.now();
    }
}

/**
 * Save the given tenant metadata to the hashes file at the given location.
 *
 * @param {Object} context The current API context.
 * @param {String} basePath The path where the hashes file is located.
 * @param {Object} hashMap The metadata for the specified tenant.
 * @param {Object} opts The options object that specifies which tenant is being used.
 *
 * @returns {Object} The updated tenant map for the hashes file at the given location, or an empty object.
 *
 * @private
 */
function saveHashes (context, basePath, hashMap, opts) {
    try {
        const tenantMap = loadTenantMap(context, basePath);
        updateBaseUrls(context, hashMap, opts);
        tenantMap[getTenantKey(context, basePath, opts)] = hashMap;

        if (!context.hashesExitSetup) {
            // Increment the max listeners for the process EventEmitter so we aren't warned about a possible leak.
            process.setMaxListeners(process.getMaxListeners() + 1);

            // Cleanup on exit.
            process.on('exit', exitHandler.bind(null, context));

            // Cleanup when Ctrl+C is caught.
            process.on('SIGINT', exitHandler.bind(null, context));

            // Cleanup on uncaught exceptions.
            process.on('uncaughtException', exitHandler.bind(null, context));

            // Set the flag so we only do this once.
            context.hashesExitSetup = true;
        }

        tenantMap.updateCount = tenantMap.updateCount || 0;
        tenantMap.updateTS = tenantMap.updateTS || Date.now();
        tenantMap.updateCount++;
        const hashesWriteThreshold = options.getRelevantOption(context, opts, "hashesWriteThreshold") || 25;
        const hashesWriteMaxTime = options.getRelevantOption(context, opts, "hashesWriteMaxTime") || 60000;
        if (((hashesWriteThreshold === -1) && (hashesWriteMaxTime === -1)) ||
            ((hashesWriteThreshold !== -1) && (tenantMap.updateCount > hashesWriteThreshold)) ||
            ((hashesWriteMaxTime !== -1) && (Date.now() - tenantMap.updateTS > hashesWriteMaxTime))) {
            writeHashes(basePath, tenantMap);
        }

        // Return the tenant map that was written to the hashes file.
        return tenantMap;
    } catch (err) {
        // Log the error, and return the current state of the tenant map.
        utils.logErrors(context, i18n.__("error_save_hashes"), err);
        return loadTenantMap(context, basePath);
    }
}

function updateResourceHashesFromEntry (context, basePath, id, entry, opts) {
    // If the context specifies that hashes should not be used, return an empty tenant map.
    if (!options.getRelevantOption(context, opts, "useHashes")) {
        return {};
    }

    try {
        // Get the existing tenant metadata at the specified location.
        const hashMap = loadHashes(context, basePath, opts);

        // Update the tenant metadata with the new entry.
        hashMap[id] = entry;

        // Save the updated tenant metadata to the hashes file at the specified location, and return the tenant map.
        return saveHashes(context, basePath, hashMap, opts);
    } catch (err) {
        // Log the error and return the current state of the tenant map.
        utils.logErrors(context, i18n.__("error_update_hashes"), err);
        return loadTenantMap(context, basePath);
    }
}

function updateResourceHashes (context, basePath, filePath, resource, md5, opts) {
    // If the context specifies that hashes should not be used, return an empty tenant map.
    if (!options.getRelevantOption(context, opts, "useHashes")) {
        return {};
    }

    try {
        let mtime = undefined;
        try {
            // Get the MD5 hash value and the (local) last modified date for the specified file.
            if (fs.existsSync(filePath)) {
                md5 = md5 || generateMD5HashSync(filePath);
                mtime = fs.statSync(filePath).mtime;
            }
        } catch (ignore) {
            // The specified file does not exist locally or cannot be read.
        }

        // If there is valid metadata for the specified file, save it to the hashes file at the specified location.
        if (resource && resource.id && md5 && mtime) {
            const relative = utils.getRelativePath(basePath, filePath);
            const entry = {
                md5: md5,
                path: relative,
                localLastModified: mtime,
                contentType: resource.contentType
            };

            return updateResourceHashesFromEntry(context, basePath, resource.id, entry, opts);
        } else {
            // The tenant metadata was not updated, so just return the current state of the tenant map.
            return loadTenantMap(context, basePath);
        }
    } catch (err) {
        // Log the error and return the current state of the tenant map.
        utils.logErrors(context, i18n.__("error_update_hashes"), err);
        return loadTenantMap(context, basePath);
    }
}

/**
 * Update the metadata for the given file in the hashes file at the specified location.
 *
 * @param {Object} context The current API context.
 * @param {String} basePath The path where the hashes file is located.
 * @param {String} filePath The local path for the file whose metadata is being updated.
 * @param {Object} item The metadata for the specified file.
 * @param {Object} opts The options object that specifies which tenant is being used.
 *
 * @returns {Object} The updated tenant map for the hashes file at the given location, or an empty object.
 *
 * @public
 */
function updateHashes (context, basePath, filePath, item, resourcePath, resourceMD5, opts) {
    // If the context specifies that hashes should not be used, return an empty tenant map.
    if (!options.getRelevantOption(context, opts, "useHashes")) {
        return {};
    }

    try {
        let md5 = undefined;
        let mtime = undefined;
        let mtimeResource = undefined;
        // special case for web assets with no metadata file and only a resource
        if (!filePath) {
            filePath = resourcePath;
            md5 = resourceMD5;
        }
        try {
            // Get the MD5 hash value and the (local) last modified date for the specified file.
            if (fs.existsSync(filePath)) {
                md5 = generateMD5HashSync(filePath);
                mtime = fs.statSync(filePath).mtime;
            }
        } catch (ignore) {
            // The specified file does not exist locally or cannot be read.
        }
        if (resourcePath) {
            try {
                // Get the MD5 hash value and the (local) last modified date for the specified file.
                if (fs.existsSync(resourcePath)) {
                    resourceMD5 = resourceMD5 || generateMD5HashSync(resourcePath);
                    mtimeResource = fs.statSync(resourcePath).mtime;
                }
            } catch (ignore) {
                // The specified file does not exist locally or cannot be read.
            }
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
                const resourceRelative = utils.getRelativePath(basePath, resourcePath);
                entry.resource = item.resource;
                entry.resourcePath = resourceRelative;
                entry.resourceMD5 = resourceMD5;
                entry.resourceLocalLastModified = mtimeResource;
                if (!opts || !opts.noVirtualFolder) {
                    const resourcesBasePath = basePath + "/../resources";
                    if (!fs.existsSync(resourcesBasePath)) {
                        mkdirp.sync(resourcesBasePath);
                    }
                    const resourceEntry = {
                        md5: resourceMD5,
                        path: "/../assets" + resourceRelative,
                        localLastModified: mtimeResource,
                        contentType: undefined
                    };
                    updateResourceHashesFromEntry(context, resourcesBasePath, item.resource, resourceEntry, opts);
                }
            }

            // Get the existing tenant metadata at the specified location.
            const hashMap = loadHashes(context, basePath, opts);

            // Remove any stale entries for the current tenant (same unique path as the entry being updated).
            Object.keys(hashMap).forEach(function (key) {
                if (hashMap[key].path === relative) {
                    delete hashMap[key];
                }
            });

            // Update the tenant metadata with the new entry.
            hashMap[item.id] = entry;

            // Save the updated tenant metadata to the hashes file at the specified location, and return the tenant map.
            return saveHashes(context, basePath, hashMap, opts);
        } else {
            // The tenant metadata was not updated, so just return the current state of the tenant map.
            return loadTenantMap(context, basePath);
        }
    } catch (err) {
        // Log the error and return the current state of the tenant map.
        utils.logErrors(context, i18n.__("error_update_hashes"), err);
        return loadTenantMap(context, basePath);
    }
}

/**
 * Remove the metadata for the specified ids in the hashes file at the specified location.
 *
 * @param {Object} context The current API context.
 * @param {String} basePath The path where the hashes file is located.
 * @param {Object} ids A list of ids to remove the metadata for.
 * @param {Object} opts The options object that specifies which tenant is being used.
 *
 * @returns {Object} The updated tenant map for the hashes file at the given location, or an empty object.
 *
 * @public
 */
function removeHashes (context, basePath, ids, opts) {
    // If the context specifies that hashes should not be used, return an empty tenant map.
    if (!options.getRelevantOption(context, opts, "useHashes")) {
        return {};
    }

    try {
        if (ids && ids.length > 0) {
            // Get the existing tenant metadata at the specified location.
            const hashMap = loadHashes(context, basePath, opts);

            ids.forEach(function (id) {
                // Get the entry to be removed.
                const entry = hashMap[id];

                if (entry && entry.path) {
                    // Remove all matching entries for the current tenant (same unique path as the entry being removed).
                    Object.keys(hashMap).forEach(function (key) {
                        if (hashMap[key].path === entry.path) {
                            delete hashMap[key];
                        }
                    });
                }
            });

            // Save the updated tenant metadata to the hashes file at the specified location, and return the tenant map.
            return saveHashes(context, basePath, hashMap, opts);
        } else {
            // The tenant metadata was not updated, so just return the current state of the tenant map.
            return loadTenantMap(context, basePath);
        }
    } catch (err) {
        // Log the error and return the current state of the tenant map.
        utils.logErrors(context, i18n.__("error_remove_hashes"), err);
        return loadTenantMap(context, basePath);
    }
}

/**
 * Remove the metadata for the specified path in the hashes file at the specified location.
 *
 * @param {Object} context The current API context.
 * @param {String} basePath The path where the hashes file is located.
 * @param {Object} itemPath The path of the item to remove the metadata for.
 * @param {Object} opts The options object that specifies which tenant is being used.
 *
 * @returns {Object} The updated tenant map for the hashes file at the given location, or an empty object.
 *
 * @public
 */
function removeHashesByPath (context, basePath, itemPath, opts) {
    // If the context specifies that hashes should not be used, return an empty tenant map.
    if (!options.getRelevantOption(context, opts, "useHashes")) {
        return {};
    }

    try {
        if (itemPath) {
            // Get the existing tenant metadata at the specified location.
            const hashMap = loadHashes(context, basePath, opts);

            // Remove all matching entries for the current tenant.
            Object.keys(hashMap).forEach(function (key) {
                if (hashMap[key].path === itemPath) {
                    delete hashMap[key];
                }
            });

            // Save the updated tenant metadata to the hashes file at the specified location, and return the tenant map.
            return saveHashes(context, basePath, hashMap, opts);
        } else {
            // The tenant metadata was not updated, so just return the current state of the tenant map.
            return loadTenantMap(context, basePath);
        }
    } catch (err) {
        // Log the error and return the current state of the tenant map.
        utils.logErrors(context, i18n.__("error_remove_hashes_by_path"), err);
        return loadTenantMap(context, basePath);
    }
}

/**
 * Remove the metadata for the current tenant in the hashes file at the specified location.
 *
 * @param {Object} context The current API context.
 * @param {String} basePath The path where the hashes file is located.
 * @param {Object} opts The options object that specifies which tenant is being used.
 *
 * @returns {Object} The updated tenant map for the hashes file at the given location, or an empty object.
 *
 * @public
 */
function removeAllHashes (context, basePath, opts) {
    // If the context specifies that hashes should not be used, return an empty tenant map.
    if (!options.getRelevantOption(context, opts, "useHashes")) {
        return {};
    }

    try {
        const tenantMap = loadTenantMap(context, basePath);
        const tenantKey = getTenantKey(context, basePath, opts);
        delete tenantMap[tenantKey];
        writeHashes(basePath, tenantMap);
        return tenantMap;
    } catch (err) {
        // Log the error and return the current state of the tenant map.
        utils.logErrors(context, i18n.__("error_remove_all_hashes"), err);
        return loadTenantMap(context, basePath);
    }
}

/**
 * Get the path for the file with the specified id.
 *
 * @param {Object} context The current API context.
 * @param {String} basePath The path where the hashes file is located.
 * @param {String} id The id for which to get the path.
 * @param {Object} opts Any override options to be used for this operation.
 *
 * @returns {Object} The filepath of the file with the specified id, or null if the file does not exist.
 *
 * @public
 */
function getFilePath (context, basePath, id, opts) {
    let retVal = null;

    // Get the existing tenant metadata at the specified location.
    const hashMap = loadHashes(context, basePath, opts);

    // If there is metadata for the given id, return the path value.
    const metadata = hashMap[id];
    if (metadata) {
        retVal = metadata.path;
    }

    return retVal;
}

/**
 * Set the path for the file with the specified id.
 *
 * @param {Object} context The current API context.
 * @param {String} basePath The path where the hashes file is located.
 * @param {String} id The id for which to set the path.
 * @param {String} filePath The new path value.
 * @param {Object} opts Any override options to be used for this operation.
 *
 * @public
 */
function setFilePath (context, basePath, id, filePath, opts) {
    // Get the existing tenant metadata at the specified location.
    const hashMap = loadHashes(context, basePath, opts);

    // If there is metadata for the given id, save the new path value.
    const metadata = hashMap[id];
    if (metadata) {
        metadata.path = filePath;
        saveHashes(context, basePath, hashMap, opts);
    }
}

/**
 * Get the timestamp of the last pull for the specified tenant.
 *
 * @example {"ready": "2017-01-16T22:30:05.928Z"}
 *
 * @param {Object} context The current API context.
 * @param {String} basePath The path where the hashes file is located.
 * @param {Object} opts The options object that specifies which tenant is being used.
 *
 * @returns {String} The timestamp of the last pull for the specified tenant.
 *
 * @public
 */
function getLastPullTimestamp (context, basePath, opts) {
    // If the context specifies that hashes should not be used, return a null timestamp.
    if (!options.getRelevantOption(context, opts, "useHashes")) {
        return null;
    }

    // Get the tenant metadata from the hashes file at the specified location.
    const hashMap = loadHashes(context, basePath, opts);

    // Return the pull timestamp for the tenant.
    return hashMap.lastPullTimestamp;
}

/**
 * Set the timestamp data for the last pull from the specified tenant.
 *
 * @param {Object} context The current API context.
 * @param {String} basePath The path where the hashes file is located.
 * @param {Object} timestamp The timestamp data for the last pull from the specified tenant.
 * @param {Object} opts The options object that specifies which tenant is being used.
 *
 * @returns {Object} The updated tenant map for the hashes file at the given location, or an empty object.
 *
 * @public
 */
function setLastPullTimestamp (context, basePath, timestamp, opts) {
    // If the context specifies that hashes should not be used, return an empty tenant map.
    if (!options.getRelevantOption(context, opts, "useHashes")) {
        return {};
    }

    try {
        // Get the tenant metadata from the hashes file at the specified location.
        const hashMap = loadHashes(context, basePath, opts);

        // Update the tenant metadata with the timestamp value and save it to the hashes file in the specified location.
        hashMap.lastPullTimestamp = timestamp;
        return saveHashes(context, basePath, hashMap, opts);
    } catch (err) {
        // Log the error and return the current state of the tenant map.
        utils.logErrors(context, i18n.__("error_set_last_pull_timestamp"), err);
        return loadTenantMap(context, basePath);
    }
}

/**
 * Get the metadata for the given file from the hashes file at the specified location for the specified tenant.
 *
 * @param {Object} context The current API context.
 * @param {String} basePath The path where the hashes file is located.
 * @param {String} filePath The local path for the file.
 * @param {Object} opts The options object that specifies which tenant is being used.
 *
 * @returns {Object} The metadata for the given file from the hashes file at the specified location for the specified
 *          tenant, or null if the metadata is not found.
 *
 * @private
 */
function getHashesForFile (context, basePath, filePath, opts) {
    // If the context specifies that hashes should not be used, return null.
    if (!options.getRelevantOption(context, opts, "useHashes")) {
        return null;
    }

    try {
        const relative = utils.getRelativePath(basePath, filePath);

        // Get the tenant metadata from the hashes file at the specified location.
        const hashMap = loadHashes(context, basePath, opts);

        // Find the key of the hash map entry containing the metadata for the specified file.
        const fileKey = Object.keys(hashMap)
            .filter(function (key) {
                return (hashMap[key].path === relative) || (hashMap[key].resourcePath === relative);
            })[0];

        // Return the hash map entry containing the metadata for the specified file.
        return hashMap[fileKey];
    } catch (err) {
        // Log the error and return an empty object.
        utils.logErrors(context, i18n.__("error_get_hashes_for_file"), err);
        return null;
    }
}

/**
 * Get the MD5 hash for the given file from the hashes file at the specified location for the specified tenant.
 *
 * @param {Object} context The current API context.
 * @param {String} basePath The path where the hashes file is located.
 * @param {String} filePath The local path for the file.
 * @param {Object} opts The options object that specifies which tenant is being used.
 *
 * @returns {Object} The MD5 hash for the given file from the hashes file at the specified location for the specified
 *          tenant, or null if the metadata is not found.
 *
 * @public
 */
function getMD5ForFile (context, basePath, filePath, opts) {
    const metadata = getHashesForFile(context, basePath, filePath, opts);
    return metadata ? metadata.md5 : undefined;
}

/**
 * Get the MD5 hash for the given resource file from the hashes file at the specified location for the specified tenant.
 *
 * @param {Object} context The current API context.
 * @param {String} basePath The path where the hashes file is located.
 * @param {String} filePath The local path for the file.
 * @param {Object} opts The options object that specifies which tenant is being used.
 *
 * @returns {Object} The MD5 hash for the given resource file from the hashes file at the specified location for the specified
 *          tenant, or null if the metadata is not found.
 *
 * @public
 */
function getResourceMD5ForFile (context, basePath, filePath, opts) {
    const metadata = getHashesForFile(context, basePath, filePath, opts);
    return metadata ? metadata.resourceMD5 : undefined;
}

/**
 * Get the local path for the given resource from the hashes file at the specified location for the specified tenant.
 *
 * @param {Object} context The current API context.
 * @param {String} basePath The path where the hashes file is located.
 * @param {String} id The ID of the resource.
 * @param {Object} opts The options object that specifies which tenant is being used.
 *
 * @returns {Object} The local path for the given resource from the hashes file at the specified location for the specified
 *          tenant, or null if the metadata is not found.
 *
 * @public
 */
function getPathForResource (context, basePath, id, opts) {
    // If the context specifies that hashes should not be used, return null.
    if (!options.getRelevantOption(context, opts, "useHashes")) {
        return null;
    }

    try {
        // Get the tenant metadata from the hashes file at the specified location.
        const hashMap = loadHashes(context, basePath, opts);

        const entry = hashMap[id];

        // Return the hash map entry containing the metadata for the specified file.
        return entry ? entry.path : undefined;
    } catch (err) {
        // Log the error and return an empty object.
        utils.logErrors(context, i18n.__("error_get_hashes_for_file"), err);
        return null;
    }
}

/**
 * Get an array of file paths from the hashes file at the specified location for the specified tenant.
 *
 * @param {Object} context The current API context.
 * @param {String} basePath The path where the hashes file is located.
 * @param {Object} opts The options object that specifies which tenant is being used.
 *
 * @returns {Array} An array of file paths from the hashes file at the specified location for the specified tenant.
 *
 * @public
 */
function listFiles (context, basePath, opts) {
    // If the context specifies that hashes should not be used, return an empty array of files.
    if (!options.getRelevantOption(context, opts, "useHashes")) {
        return [];
    }

    // Get the tenant metadata from the hashes file at the specified location.
    const hashMap = loadHashes(context, basePath, opts);

    // Return an array of file paths.
    return Object.keys(hashMap)
        .filter(function (key){
            // Filter out the timestamp entries.
            return (key !== "lastPullTimestamp" && key !== "lastPushTimestamp" && key !== "baseUrls");
        })
        .map(function (fileKey) {
            // Return the id and file path for each file entry.
            return {
                id: fileKey,
                path: hashMap[fileKey].path
            };
        });
}

/**
 * Determine whether the specified local file is modified (or new).
 *
 * @param {Object} context The current API context.
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
function isLocalModified (context, flags, basePath, metadataPath, resourcePath, opts) {
    // If the context specifies that hashes should not be used, return false.
    if (!options.getRelevantOption(context, opts, "useHashes")) {
        return false;
    }

    const filePath = metadataPath || resourcePath;

    // Check for both new and modified by default.
    flags = flags || [NEW, MODIFIED];
    context.logger.debug("hashes.isLocalModified", flags, filePath);

    // Get the metadata for the given file from the hashes file at the specified location.
    const fileHashes = getHashesForFile(context, basePath, filePath, opts);

    // Get the stat values for the specified file, if it exists.
    let stat;
    try {
        stat = fs.statSync(filePath);
    } catch (err) {
        // The file doesn't exist.
    }
    let statResource;
    if (resourcePath && metadataPath) {
        try {
            statResource = fs.statSync(resourcePath);
        } catch (err) {
            // The file doesn't exist.
        }
    }

    // Determine whether the local file is modified.
    let modified = false;
    if (flags.indexOf(MODIFIED) !== -1) {
        context.logger.debug("hashes.isLocalModified MODIFIED fileHashes", (fileHashes !== undefined));
        context.logger.debug("hashes.isLocalModified MODIFIED fileHashes localLastModified", fileHashes ? Date.parse(fileHashes.localLastModified) : undefined);
        context.logger.debug("hashes.isLocalModified MODIFIED stat.mtime", stat ? stat.mtime.getTime() : undefined);

        // For performance first compare the timestamps. If the timestamps are equal, assume the file is not modified.
        if (fileHashes &&
            ((fileHashes.localLastModified && stat && stat.mtime.getTime() !== Date.parse(fileHashes.localLastModified)) ||
             (fileHashes.resourceLocalLastModified && statResource && statResource.mtime.getTime() !== Date.parse(fileHashes.resourceLocalLastModified)))) {
            // The timestamps don't match so check the md5 hashes.
            const md5 = generateMD5HashSync(filePath);
            context.logger.debug("hashes.isLocalModified MODIFIED fileHashes md5", fileHashes.md5);
            context.logger.debug("hashes.isLocalModified MODIFIED md5", md5);

            if (fileHashes.md5 && md5 !== fileHashes.md5) {
                // The md5 hashes don't match so the file is modified.
                context.logger.debug("hashes.isLocalModified MODIFIED file is modified");
                modified = true;
            } else if (resourcePath && metadataPath) {
                const resourceMD5 = generateMD5HashSync(resourcePath);
                if (fileHashes.resourceMD5 && resourceMD5 !== fileHashes.resourceMD5) {
                    context.logger.debug("hashes.isLocalModified MODIFIED file is modified due to resource MD5");
                    modified = true;
                }
            }
            if (!modified) {
                // The md5 hashes match, but the timestamps did not. Update the timestamp in hashes so that we may not
                // need to generate the md5 hash next time.
                const hashMap = loadHashes(context, basePath, opts);
                Object.keys(hashMap)
                    .forEach(function (key) {
                        // Match on the path field and sanity check that md5 matches.
                        if ((hashMap[key].path === fileHashes.path) && (hashMap[key].md5 === md5)) {
                            hashMap[key].localLastModified = stat.mtime;
                        }
                    });
                saveHashes(context, basePath, hashMap, opts);
            }
        }
    }

    // Determine whether the local file is new.
    if (!modified && flags.indexOf(NEW) !== -1) {
        context.logger.debug("hashes.isLocalModified NEW fileHashes", (fileHashes !== undefined));
        context.logger.debug("hashes.isLocalModified NEW fileHashes localLastModified", fileHashes ? fileHashes.localLastModified : undefined);
        context.logger.debug("hashes.isLocalModified NEW fileHashes md5", fileHashes ? fileHashes.md5 : undefined);

        // The local file is new if it exists but the metadata in the hashes file does not exist.
        if ((stat && (!fileHashes || !fileHashes.localLastModified || !fileHashes.md5)) || (statResource && (!fileHashes || !fileHashes.resourceLocalLastModified || !fileHashes.resourceMD5))) {
            context.logger.debug("hashes.isLocalModified NEW file is new");
            modified = true;
        }
    }

    context.logger.debug("hashes.isLocalModified returning", modified, flags, filePath);

    return modified;
}

/**
 * Determine whether the specified remote file is modified (or new).
 *
 * @param {Object} context The current API context.
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
function isRemoteModified (context, flags, item, basePath, metadataPath, resourcePath, opts) {
    // If the context specifies that hashes should not be used, return false.
    if (!options.getRelevantOption(context, opts, "useHashes")) {
        return false;
    }

    const filePath = metadataPath || resourcePath;

    // Check for both new and modified by default.
    flags = flags || [NEW, MODIFIED];
    context.logger.debug("hashes.isRemoteModified", flags, filePath);

    // Get the metadata for the given file from the hashes file at the specified location.
    const fileHashes = getHashesForFile(context, basePath, filePath, opts);

    // Determine whether the remote file is modified.
    let modified = false;
    if (flags.indexOf(MODIFIED) !== -1) {
        context.logger.debug("hashes.isRemoteModified MODIFIED fileHashes", (fileHashes !== undefined));
        context.logger.debug("hashes.isRemoteModified MODIFIED fileHashes rev", fileHashes ? fileHashes.rev : undefined);
        context.logger.debug("hashes.isRemoteModified MODIFIED rev", item.rev);

        // The remote file is modified if the rev ids don't match.
        if (fileHashes && fileHashes.rev !== item.rev) {
            context.logger.debug("hashes.isRemoteModified MODIFIED file is modified");
            modified = true;
        }
    }

    // Determine whether the remote file is new.
    if (flags.indexOf(NEW) !== -1) {
        context.logger.debug("hashes.isRemoteModified NEW fileHashes", (fileHashes !== undefined));

        // The remote file is new if the file hashes is empty.
        if (!fileHashes) {
            context.logger.debug("hashes.isRemoteModified NEW file is new");
            modified = true;
        }
    }

    context.logger.debug("hashes.isRemoteModified returning", modified, flags, filePath);

    return modified;
}

const hashes = {
    isHashesFile: isHashesFile,
    generateMD5Hash: generateMD5Hash,
    generateMD5HashAndID: generateMD5HashAndID,
    generateMD5HashFromStream: generateMD5HashFromStream,
    compareMD5Hashes: compareMD5Hashes,
    updateResourceHashes: updateResourceHashes,
    updateHashes: updateHashes,
    removeHashes: removeHashes,
    removeHashesByPath: removeHashesByPath,
    removeAllHashes: removeAllHashes,
    getFilePath: getFilePath,
    setFilePath: setFilePath,
    getLastPullTimestamp: getLastPullTimestamp,
    setLastPullTimestamp: setLastPullTimestamp,
    getMD5ForFile: getMD5ForFile,
    getResourceMD5ForFile: getResourceMD5ForFile,
    getPathForResource: getPathForResource,
    listFiles: listFiles,
    isLocalModified: isLocalModified,
    isRemoteModified: isRemoteModified,
    NEW: NEW,
    MODIFIED: MODIFIED,
    DELETED: DELETED
};

module.exports = hashes;
