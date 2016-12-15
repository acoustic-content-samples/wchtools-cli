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
const crypto = require("crypto");
const path = require("path");
const mkdirp = require("mkdirp");
const utils = require("./utils.js");
const logger = utils.getLogger(utils.apisLog);
const options = require("./options.js");
const i18n = utils.getI18N(__dirname, ".json", "en");

const NEW = "new";
const MODIFIED = "mod";
const DELETED = "del";

/**
 * Generates the MD5 hash of the contents of the file named by filename.
 * @param filename the name of the file to generate the MD5 hash for
 * @returns {Buffer|any} the MD5 hash
 */
function generateMD5Hash(filename) {
    const hash = crypto.createHash("md5");
    const content = fs.readFileSync(filename); //returns a Buffer
    hash.update(content);
    const md5 = hash.digest("base64");
    return md5;
}

function getHashesFilename(basePath) {
    return basePath + "/.dxhashes";
}

function getTenant(opts) {
    return options.getRelevantOption(opts, "x-ibm-dx-tenant-id");
}

function loadTenantMap(basePath) {
    let tenantMap = {};
    const hashesFilename = getHashesFilename(basePath);
    try {
        if (fs.existsSync(hashesFilename)) {
            const contents = fs.readFileSync(hashesFilename);
            tenantMap = JSON.parse(contents);
        }
    } catch (err) {
        logger.error(i18n.__("error_tenant_map"), err.toString());
    }
    return tenantMap;
}

function loadHashes(basePath, opts) {
    const tenantMap = loadTenantMap(basePath);
    return tenantMap[getTenant(opts)] || {};
}

function saveHashes(basePath, hashMap, opts) {
    const hashesFilename = getHashesFilename(basePath);
    try {
        const tenantMap = loadTenantMap(basePath);
        tenantMap[getTenant(opts)] = hashMap;
        const contents = JSON.stringify(tenantMap, null, "  ");
        // ensure the directory we're trying to write into exists
        mkdirp.sync(basePath);
        fs.writeFileSync(hashesFilename, contents);
    } catch (err) {
        logger.error(i18n.__("error_save_hashes"), err.toString());
    }
}

function updateHashes(basePath, filePath, item, opts) {
    try {
        let md5 = undefined;
        let mtime = undefined;
        try {
            if (fs.existsSync(filePath)) {
                md5 = generateMD5Hash(filePath);
                mtime = fs.statSync(filePath).mtime;
            }
        } catch (ignore) {
            // file does not exist locally or cannot be read
        }
        if (item && item.id && md5 && mtime) {
            const hashMap = loadHashes(basePath, opts);
            const relative = utils.getRelativePath(basePath, filePath);
            const entry = {
                id: item.id,
                rev: item.rev,
                lastModified: item.lastModified,
                md5: md5,
                path: relative,
                localLastModified: mtime
            };
            // if the item is an asset with a resource reference, save it as well
            if (item.resource) {
                entry.resource = item.resource;
            }
            // remove old references that have the same unique path
            Object.keys(hashMap).forEach(function (entry) {
                if (hashMap[entry].path === relative) {
                    hashMap[entry] = undefined;
                }
            });
            hashMap[item.id] = entry;
            return saveHashes(basePath, hashMap, opts);
        }
    } catch (err) {
        logger.error(i18n.__("error_update_hashes"), err.toString());
    }
}

function getLastPullTimestamp(basePath, opts) {
    const hashMap = loadHashes(basePath, opts);
    return hashMap ? hashMap.lastPullTimestamp : undefined;
}

function setLastPullTimestamp(basePath, timestamp, opts) {
    try {
        const hashMap = loadHashes(basePath, opts);
        hashMap.lastPullTimestamp = timestamp;
        return saveHashes(basePath, hashMap, opts);
    } catch (err) {
        logger.error(i18n.__("error_set_last_pull_timestamp"), err.toString());
    }
}

function getLastPushTimestamp(basePath, opts) {
    const hashMap = loadHashes(basePath, opts);
    return hashMap ? hashMap.lastPushTimestamp : undefined;
}

function setLastPushTimestamp(basePath, timestamp, opts) {
    try {
        const hashMap = loadHashes(basePath, opts);
        hashMap.lastPushTimestamp = timestamp;
        return saveHashes(basePath, hashMap, opts);
    } catch (err) {
        logger.error(i18n.__("error_set_last_push_timestamp"), err.toString());
    }
}

function getHashesForFile(basePath, filePath, opts) {
    const relative = utils.getRelativePath(basePath, filePath);
    try {
        const hashMap = loadHashes(basePath, opts);
        const key = Object.keys(hashMap).filter(function (entry) {
            return (hashMap[entry].path === relative);
        });
        return hashMap[key];
    } catch (err) {
        logger.error(i18n.__("error_get_hashes_for_file"), err.toString());
    }
    return {};
}

function listFiles(basePath, opts) {
    const hashMap = loadHashes(basePath, opts);
    return Object.keys(hashMap).filter(function (entry){
        return (entry !== "lastPullTimestamp" && entry !== "lastPushTimestamp");
    }).map(function (entry) {
        return hashMap[entry].path;
    });
}

function isLocalModified(flags, basePath, filePath, opts) {
    flags = flags || [NEW, MODIFIED];
    logger.debug("hashes.isLocalModified", flags, filePath);
    const stat = fs.statSync(filePath);
    const fileHashes = getHashesForFile(basePath, filePath, opts);
    let modified = false;
    if (flags.indexOf(MODIFIED) !== -1) {
        logger.debug("hashes.isLocalModified MODIFIED fileHashes", (fileHashes !== undefined));
        logger.debug("hashes.isLocalModified MODIFIED fileHashes localLastModified", fileHashes ? Date.parse(fileHashes.localLastModified) : undefined);
        logger.debug("hashes.isLocalModified MODIFIED stat.mtime", stat.mtime.getTime());
        // for performance first compare the timestamps
        if (fileHashes && fileHashes.localLastModified && stat.mtime.getTime() !== Date.parse(fileHashes.localLastModified)) {
            // if timestamps don't match then check the md5 hash
            const md5 = generateMD5Hash(filePath);
            logger.debug("hashes.isLocalModified MODIFIED fileHashes md5", fileHashes.md5);
            logger.debug("hashes.isLocalModified MODIFIED md5", md5);
            if (fileHashes.md5 && md5 !== fileHashes.md5) {
                logger.debug("hashes.isLocalModified MODIFIED file is modified");
                modified = true;
            } else {
                // timestamps did not match, but the md5 does - update the timestamp in hashes to prevent running the md5 checksum next time
                const hashMap = loadHashes(basePath, opts);
                Object.keys(hashMap).forEach(function (entry) {
                    // match on the path field and sanity check that md5 matches
                    if ((hashMap[entry].path === fileHashes.path) && (hashMap[entry].md5 === md5)) {
                        hashMap[entry].localLastModified = stat.mtime;
                    }
                });
                saveHashes(basePath, hashMap, opts);
            }
        }
    }
    if (flags.indexOf(NEW) !== -1) {
        logger.debug("hashes.isLocalModified NEW fileHashes", (fileHashes !== undefined));
        logger.debug("hashes.isLocalModified NEW fileHashes localLastModified", fileHashes ? Date.parse(fileHashes.localLastModified) : undefined);
        logger.debug("hashes.isLocalModified NEW fileHashes md5", fileHashes ? fileHashes.md5 : undefined);
        // local item is new if file hashes is empty or file hashes doesn't have a last modified timestamp or md5 hash
        if (!fileHashes || !fileHashes.localLastModified || !fileHashes.md5) {
            logger.debug("hashes.isLocalModified NEW file is new");
            modified = true;
        }
    }
    logger.debug("hashes.isLocalModified returning", modified, flags, filePath);
    return modified;
}

function isRemoteModified(flags, item, basePath, filePath, opts) {
    flags = flags || [NEW, MODIFIED];
    logger.debug("hashes.isRemoteModified", flags, filePath);
    const fileHashes = getHashesForFile(basePath, filePath, opts);
    let modified = false;
    if (flags.indexOf(MODIFIED) !== -1) {
        logger.debug("hashes.isRemoteModified MODIFIED fileHashes", (fileHashes !== undefined));
        logger.debug("hashes.isRemoteModified MODIFIED fileHashes rev", fileHashes ? fileHashes.rev : undefined);
        logger.debug("hashes.isRemoteModified MODIFIED rev", item.rev);
        // remote item is modified if rev ids don't match
        if (fileHashes && fileHashes.rev !== item.rev) {
            logger.debug("hashes.isRemoteModified MODIFIED file is modified");
            modified = true;
        }
    }
    if (flags.indexOf(NEW) !== -1) {
        logger.debug("hashes.isRemoteModified NEW fileHashes", (fileHashes !== undefined));
        // remote item is new if file hashes is empty
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
    updateHashes: updateHashes,
    getLastPullTimestamp: getLastPullTimestamp,
    setLastPullTimestamp: setLastPullTimestamp,
    getLastPushTimestamp: getLastPushTimestamp,
    setLastPushTimestamp: setLastPushTimestamp,
    getHashesForFile: getHashesForFile,
    listFiles: listFiles,
    isLocalModified: isLocalModified,
    isRemoteModified: isRemoteModified,
    NEW: NEW,
    MODIFIED: MODIFIED,
    DELETED: DELETED
};

module.exports = hashes;
