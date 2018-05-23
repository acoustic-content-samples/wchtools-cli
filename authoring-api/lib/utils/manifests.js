/*
Copyright IBM Corporation 2018

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
const path = require("path");
const mkdirp = require("mkdirp");
const utils = require("./utils.js");
const options = require("./options.js");
const BufferStream = require("./bufferstream.js");
const AssetsREST = require("../assetsREST.js").instance;
const i18n = utils.getI18N(__dirname, ".json", "en");

const MANIFEST_FILE_SPACING = "  ";
const ASSETS_ARTIFACT_TYPE = "assets";
const PAGES_ARTIFACT_TYPE = "pages";
const SITES_ARTIFACT_TYPE = "sites";
const SITE_ID_KEY = "siteId";
const DEFAULT_SITE_ID = "default";
const MANIFEST_MODE_APPEND = "append";
const MANIFEST_MODE_REPLACE = "replace";
const READ_MANIFEST_FILE_KEY = "readManifestFile";
const WRITE_MANIFEST_FILE_KEY = "writeManifestFile";
const DELETIONS_MANIFEST_FILE_KEY = "deletionsManifestFile";
const MANIFEST_FILE_EXTENSION = ".json";

/**
 * Initializes the manifest properties using the supplied read and write manifest filenames.
 *
 * @param context The context object for the operation.
 * @param readManifest The filename to use for the read manifest, or undefined.
 * @param writeManifest The filename to use for the write manifest, or undefined.
 * @param deletionsManifest The filename to use for the deletions manifest, or undefined.
 * @param opts The options object for the operation.
 *
 * @return {Q.Promise} A Promise that resolves if the manifests were initialized successfully and is rejected if there
 *                     was a problem with the manifest, and the current operation should not continue.
 */
function initializeManifests (context, readManifest, writeManifest, deletionsManifest, opts) {
    const deferred = Q.defer();
    let result = true;

    if (readManifest) {
        context.readManifestFile = readManifest;

        if (!context.readManifest) {
            const readFilename = options.getRelevantOption(context, opts, READ_MANIFEST_FILE_KEY);
            const manifestPath = _getManifestFullPath(context, readFilename, opts);
            const serverManifest = options.getRelevantOption(context, opts, "serverManifest");
            if (!serverManifest) {
                try {
                    if (fs.existsSync(manifestPath)) {
                        context.readManifest = _readManifest(context, manifestPath, opts);
                    } else {
                        context.logger.error(i18n.__('error_manifest_file_does_not_exist', {filename: readFilename}));
                        result = false;
                        deferred.reject(new Error(i18n.__('error_manifest_file_does_not_exist', {filename: readFilename})));
                    }
                } catch (err) {
                    context.logger.error(i18n.__('error_manifest_file_read', {filename: readManifest, error: err}));
                    result = false;
                    deferred.reject(err);
                }
            } else {
                result = false;
                _pullManifest(context, manifestPath, opts).then(function (manifest) {
                    context.readManifest = manifest;
                    deferred.resolve(true);
                }).catch(function (err) {
                    context.logger.error(i18n.__('error_manifest_file_does_not_exist', {filename: readFilename}));
                    result = false;
                    deferred.reject(err);
                });
            }
        }
    }

    if (writeManifest) {
        context.writeManifestFile = writeManifest;

        if (!context.writeManifest) {
            try {
                const writeFilename = options.getRelevantOption(context, opts, WRITE_MANIFEST_FILE_KEY);
                const manifestPath = _getManifestFullPath(context, writeFilename, opts);
                if (fs.existsSync(manifestPath)) {
                    context.writeManifest = _readManifest(context, manifestPath, opts);
                }
                context.writeManifestMode = MANIFEST_MODE_APPEND;
            } catch (err) {
                context.logger.error(i18n.__('error_manifest_file_read', {filename: writeManifest, error: err}));
                result = false;
                deferred.reject(err);
            }
        }
    }

    if (deletionsManifest) {
        context.deletionsManifestFile = deletionsManifest;

        if (!context.deletionsManifest) {
            try {
                const deletionsFilename = options.getRelevantOption(context, opts, DELETIONS_MANIFEST_FILE_KEY);
                const manifestPath = _getManifestFullPath(context, deletionsFilename, opts);
                if (fs.existsSync(manifestPath)) {
                    context.deletionsManifest = _readManifest(context, manifestPath, opts);
                }
                context.deletionsManifestMode = MANIFEST_MODE_APPEND;
            } catch (err) {
                context.logger.error(i18n.__('error_manifest_file_read', {filename: deletionsManifest, error: err}));
                result = false;
                deferred.reject(err);
            }
        }
    }

    if (result) {
        deferred.resolve(result);
    }
    return deferred.promise;
}

/**
 * Resets the manifest functions and removes all manifest information from the context.
 *
 * @param context The context object for the operation.
 * @param opts The options object for the operation.
 */
function resetManifests (context, opts) {
    delete context.readManifestFile;
    delete context.writeManifestFile;
    delete context.deletionsManifestFile;
    delete context.readManifest;
    delete context.writeManifest;
    delete context.deletionsManifest;
}

/**
 * Returns the asset path to for the manifest.
 *
 * @param context The context object for the operation.
 * @param filename The manifest filename.
 * @param opts The options object for the operation.
 * @returns {*} The asset path to the manifest file.
 */
function getManifestPath (context, filename, opts) {
    let manifestPath = path.sep + "dxconfig" + path.sep + "manifests" + path.sep + filename;
    if (!manifestPath.endsWith(MANIFEST_FILE_EXTENSION)) {
        manifestPath += MANIFEST_FILE_EXTENSION;
    }
    return manifestPath;
}

/**
 * Returns the path to the assets directory where the current process should look.
 * @param context The context object for the operation.
 * @param opts The options object for the operation.
 * @returns {string} The path to the assets directory.
 * @private
 */
function _getAssetsDir (context, opts) {
    const workingDir = options.getRelevantOption(context, opts, "workingDir") || process.cwd();
    const assetsDir = workingDir + path.sep + "assets";
    return assetsDir;
}

/**
 * Returns the path to the specified manifest file.  Automatically appends the .json manifest suffix.
 * Prepends the assets/dxconfig/manifests directory relative to the current working directory for the process if
 * the provided filename does not contain a '/' (all platforms) or '\' (win32).
 *
 * @param context The context object for the operation.
 * @param filename The manifest filename.
 * @param opts The options object for the operation.
 * @returns {*} The path to the manifest file.
 * @private
 */
function _getManifestFullPath (context, filename, opts) {
    let manifestPath = filename;
    if (filename.indexOf("/") === -1 && (process.platform !== 'win32' || filename.indexOf("\\") === -1)) {
        manifestPath = _getAssetsDir(context, opts) + getManifestPath(context, filename, opts);
    } else if (!manifestPath.endsWith(MANIFEST_FILE_EXTENSION)) {
        manifestPath += MANIFEST_FILE_EXTENSION;
    }
    context.logger.debug("_getManifestFullPath: ", manifestPath);
    return manifestPath;
}

/**
 * Reads the specified read manifest (via the init function) from disk.
 *
 * @param context The context object for the operation.
 * @param manifestPath The filename for the manifest file.
 * @param opts The options object for the operation.
 * @returns {{}} The manifest data.
 * @private
 */
function _readManifest (context, manifestPath, opts) {
    const contents = fs.readFileSync(manifestPath);
    return JSON.parse(contents);
}

function _pullManifest (context, manifestPath, opts) {
    const deferred = Q.defer();
    let assetPath = path.sep + path.relative(_getAssetsDir(context, opts), manifestPath);
    assetPath = assetPath.replace(/\\/g, '/');
    AssetsREST.getItemByPath(context, assetPath, opts)
        .then(function (asset) {
            const manifestResource = {
                id: asset.id,
                resource: asset.resource,
                path: assetPath
            };
            const bstr = new BufferStream();
            const pullResponse = AssetsREST.pullItem(context, manifestResource, bstr, opts);
            pullResponse.then(function (assetMetadata) {
                const manifestJSON = JSON.parse(bstr.getBuffer());
                deferred.resolve(manifestJSON);
            }).catch(function (err) {
                deferred.reject(err);
            });
        }).catch(function (err) {
            deferred.reject(err);
        });

    return deferred.promise;
}

/**
 * Returns a section of the in-memory manifest from the context.  Handles returning the
 * nested pages section of the current site (specified via siteId).
 *
 * @param context The context object for the operation.
 * @param manifestRoot The root object of the manifest.
 * @param artifactName The artifact name for which to obtain the manifest data.
 * @param okToCreate Flag indicating if the requested section should be created if it doesn't exist.
 * @param opts The options object for the operation.
 * @returns {*} The manifest data for the specified artifact type.
 * @private
 */
function _getManifestSection (context, manifestRoot, artifactName, okToCreate, opts) {
    let root = manifestRoot || {};
    if (artifactName === PAGES_ARTIFACT_TYPE) {
        const sitesSection = _getManifestSection(context, root, SITES_ARTIFACT_TYPE, okToCreate, opts);

        // There won't be a pages section if there isn't a sites section.
        if (!sitesSection) {
            return;
        }

        const siteId = options.getRelevantOption(context, opts, SITE_ID_KEY) || DEFAULT_SITE_ID;
        if (!sitesSection[siteId] && okToCreate) {
            sitesSection[siteId] = {};
        }
        root = sitesSection[siteId] || {};
    }
    if (!root[artifactName] && okToCreate) {
        root[artifactName] = {};
    }
    const section = root[artifactName];
    return section;
}

/**
 * Returns a section of the in-memory manifest from the context.
 *
 * @param context The context object for the operation.
 * @param artifactName The artifact name for which to obtain the manifest data.
 * @param opts The options object for the operation.
 * @returns {*} The manifest data for the specified artifact type.
 */
function getManifestSection (context, artifactName, opts) {
    return _getManifestSection(context, context.readManifest, artifactName, false, opts);
}

/**
 * Appends the provided itemList to the appropriate section of the manifest.
 *
 * @param context The context object for the operation.
 * @param manifest The manifest being updated.
 * @param artifactName The artifact name specifying the manifest section to append to.
 * @param itemList The array of item objects (should contain id, name, path) to append to the manifest.
 * @param opts The options object for the operation.
 */
function appendManifestSection (context, manifest, artifactName, itemList, opts) {
    if (itemList) {
        const section = _getManifestSection(context, manifest, artifactName, true, opts);

        itemList.forEach(function (item) {
            let keyField = "id";
            if (artifactName === ASSETS_ARTIFACT_TYPE) {
                keyField = "path";
            }
            if (item[keyField]) {
                section[item[keyField]] = { id: item.id, name: item.name, path: item.path || item.hierarchicalPath };
            } else {
                context.logger.debug("skipping item with no key field", keyField, item);
            }
        });
    }
}

/**
 * Replaces the specified manifest section with the provided itemList.  Other sections of the manifest are unchanged.
 *
 * @param context The context object for the operation.
 * @param manifest The manifest being updated.
 * @param artifactName The artifact name specifying the manifest section to replace.
 * @param itemList The array of item objects (should contain id, name, path) to write to the manifest.
 * @param opts The options object for the operation.
 */
function replaceManifestSection (context, manifest, artifactName, itemList, opts) {
    // Delete the specified section of the manifest.
    const section = _getManifestSection(context, manifest, artifactName, false, opts);
    if (section) {
        Object.keys(section).forEach(function (key) {
            delete section[key];
        });
    }
    // Now call append to insert the appropriate items.
    appendManifestSection(context, manifest, artifactName, itemList, opts);
}

/**
 * Updates the specified manifest section with the provided itemList.  Other sections of the manifest are unchanged.
 * The manifest section is either replaced or appended to based on the internal manifest mode flag.
 *
 * @param context The context object for the operation.
 * @param artifactName The artifact name specifying the manifest section to update.
 * @param itemList The array of item objects (should contain id, name, path) to write to the manifest.
 * @param opts The options object for the operation.
 */
function updateManifestSection (context, artifactName, itemList, opts) {
    if (context.writeManifestFile) {
        if (!context.writeManifest) {
            context.writeManifest = {};
        }

        if (context.writeManifestMode === MANIFEST_MODE_APPEND) {
            appendManifestSection(context, context.writeManifest, artifactName, itemList, opts);
        } else {
            replaceManifestSection(context, context.writeManifest, artifactName, itemList, opts);
        }
    }
}

/**
 * Updates the specified deletions manifest section with the provided itemList.  Other sections of the manifest are
 * unchanged. The manifest section is either replaced or appended to based on the internal manifest mode flag.
 *
 * @param context The context object for the operation.
 * @param artifactName The artifact name specifying the manifest section to update.
 * @param itemList The array of item objects (should contain id, name, path) to write to the deletions manifest.
 * @param opts The options object for the operation.
 */
function updateDeletionsManifestSection (context, artifactName, itemList, opts) {
    if (context.deletionsManifestFile) {
        if (!context.deletionsManifest) {
            context.deletionsManifest = {};
        }

        if (context.deletionsManifestMode === MANIFEST_MODE_APPEND) {
            appendManifestSection(context, context.deletionsManifest, artifactName, itemList, opts);
        } else {
            replaceManifestSection(context, context.deletionsManifest, artifactName, itemList, opts);
        }
    }
}

/**
 * Saves the current in-memory manifest to the provided (at init time) manifest filename.
 *
 * @param context The context object for the operation.
 * @param opts The options object for the operation.
 */
function saveManifest (context, opts) {
    const writeFilename = options.getRelevantOption(context, opts, WRITE_MANIFEST_FILE_KEY);
    if (writeFilename) {
        try {
            const contents = JSON.stringify(context.writeManifest || {}, null, MANIFEST_FILE_SPACING);
            const manifestPath = _getManifestFullPath(context, writeFilename, opts);
            const dir = path.dirname(manifestPath);
            if (!fs.existsSync(dir)) {
                mkdirp.sync(dir);
            }
            fs.writeFileSync(manifestPath, contents);
        } catch (err) {
            context.logger.error(i18n.__('error_manifest_file_write', {filename: writeFilename, error: err}));
        }
    }
}

/**
 * Saves the current in-memory deletions manifest to the provided (at init time) manifest filename.
 *
 * @param context The context object for the operation.
 * @param opts The options object for the operation.
 */
function saveDeletionsManifest (context, opts) {
    const deletionsFilename = options.getRelevantOption(context, opts, DELETIONS_MANIFEST_FILE_KEY);
    if (deletionsFilename) {
        try {
            const contents = JSON.stringify(context.deletionsManifest || {}, null, MANIFEST_FILE_SPACING);
            const manifestPath = _getManifestFullPath(context, deletionsFilename, opts);
            const dir = path.dirname(manifestPath);
            if (!fs.existsSync(dir)) {
                mkdirp.sync(dir);
            }
            fs.writeFileSync(manifestPath, contents);
        } catch (err) {
            context.logger.error(i18n.__('error_manifest_file_write', {filename: deletionsFilename, error: err}));
        }
    }
}

const manifests = {
    initializeManifests: initializeManifests,
    resetManifests: resetManifests,
    getManifestPath: getManifestPath,
    getManifestSection: getManifestSection,
    updateManifestSection: updateManifestSection,
    updateDeletionsManifestSection: updateDeletionsManifestSection,
    saveManifest: saveManifest,
    saveDeletionsManifest: saveDeletionsManifest
};

module.exports = manifests;
