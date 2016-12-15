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

const BaseREST = require("./BaseREST.js");
const Q = require("q");
const utils = require("./utils/utils.js");
const request = utils.getRequestWrapper();
const mime = require('mime-types');
const path = require('path');
const options = require("./utils/options.js");
const querystring = require("querystring");
const logger = utils.getLogger(utils.apisLog);
const i18n = utils.getI18N(__dirname, ".json", "en");

const singleton = Symbol();
const singletonEnforcer = Symbol();

/*
 * local utility method to do the asset metadata POST, called from multiple places in pushItem
 */
function postAssetMetadata(reqOptions, deferred) {
    request.post(reqOptions, function (err, res, body) {
        if (err || (res && res.statusCode >= 400)) {
            err = utils.getError(err, body, res, reqOptions);
            utils.logErrors("AssetRest:asset metadata creation error", err);
            deferred.reject(err);
        } else {
            deferred.resolve(body);
        }
    });
}

/**
 * REST object for managing assets on the remote content hub.
 *
 * @class AssetsREST
 *
 * @extends BaseREST
 */
class AssetsREST extends BaseREST {
    /**
     * The constructor for an AssetsREST object. This constructor implements a singleton pattern, and will fail if
     * called directly. The static instance property can be used to get the singleton instance.
     *
     * @constructs AssetsREST
     *
     * @param {Symbol} enforcer - A Symbol that must match a local Symbol to create the new object.
     */
    constructor (enforcer) {
        if (enforcer !== singletonEnforcer) {
            throw i18n.__("singleton_construct_error", {classname: "AssetsREST"});
        }

        super("assets", "/authoring/v1/assets", undefined, "/views/by-modified");
    }

    /**
     * The instance property can be used to to get the singleton instance for this class.
     */
    static get instance () {
        if (!this[singleton]) {
            this[singleton] = new AssetsREST(singletonEnforcer);
        }
        return this[singleton];
    }

    reset () {
        super.reset();
        this._resourcesUri = options.getProperty("dx-api-gateway");
        this._initializedResources = false;
    }

    getResourceRequestURI (opts) {
        // Promise based to allow for lookup of URI if necessary in the future.
        const deferred = Q.defer();

        if (this._initializedResources) {
            deferred.resolve(this._resourcesUri);
        } else {
            const baseUrl = options.getRelevantOption(opts, "x-ibm-dx-tenant-base-url");
            if (baseUrl) {
                this._resourcesUri = baseUrl;
            } else {
                const tenantId = options.getRelevantOption(opts, "x-ibm-dx-tenant-id");
                this._resourcesUri = this._resourcesUri + "/" + tenantId;
            }
            this._initializedResources = true;
            deferred.resolve(this._resourcesUri);
        }

        return deferred.promise;
    }

    getDownloadRequestOptions (opts) {
        const deferred = Q.defer();
        const headers = {
            "Accept": "*/*",
            "Accept-Language": utils.getHTTPLanguage(),
            "Connection": "keep-alive",
        };

        this.getResourceRequestURI(opts)
            .then(function (uri) {
                deferred.resolve({
                    uri: uri + "/authoring/v1/resources",
                    headers: headers
                });
            })
            .catch(function (err) {
                deferred.reject(err);
            });

        return deferred.promise;
    }

    getAssetUpdateRequestOptions (id, opts) {
        const deferred = Q.defer();
        const headers = {
            "Accept": "application/json",
            "Accept-Language": utils.getHTTPLanguage(),
            "Content-Type": "application/json",
            "Connection": "keep-alive",
        };

        this.getRequestURI(opts)
            .then(function (uri) {
                deferred.resolve({
                    uri: uri + "/authoring/v1/assets/" + id,
                    headers: headers,
                    json: true
                });
            })
            .catch(function (err) {
                deferred.reject(err);
            });

        return deferred.promise;
    }

    getResourceHeaders (name, opts) {
        const mtype = mime.lookup(name) || "text/plain";
        const headers = {
            "Accept": "application/json",
            "Accept-Language": utils.getHTTPLanguage(),
            "Content-Type": mtype,
            "Connection": "keep-alive",
        };

        return headers;
    }

    getResourcePOSTOptions (name, opts) {
        const deferred = Q.defer();
        const headers = this.getResourceHeaders(name, opts);
        const fname = path.basename(name);

        this.getResourceRequestURI(opts)
            .then(function (uri) {
                deferred.resolve({
                    uri: uri + "/authoring/v1/resources?name=" + querystring.escape(fname),
                    headers: headers
                });
            })
            .catch(function (err) {
                deferred.reject(err);
            });

        return deferred.promise;
    }

    getResourcePUTOptions (resourceId, resourceMd5, name, opts) {
        const deferred = Q.defer();
        const headers = this.getResourceHeaders(name, opts);
        const fname = path.basename(name);

        this.getResourceRequestURI(opts)
            .then(function (uri) {
                const uriIdPath = resourceId ? "/" + resourceId : "";
                const paramMd5 = resourceMd5 ? "&md5=" + querystring.escape(resourceMd5) : "";
                deferred.resolve({
                    uri: uri + "/authoring/v1/resources" + uriIdPath + "?name=" + querystring.escape(fname) + paramMd5,
                    headers: headers
                });
            })
            .catch(function (err) {
                deferred.reject(err);
            });

        return deferred.promise;
    }

    /**
     * Download the specified asset and save it to the given stream.
     *
     * @param {Object} asset - metadata for the asset to be downloaded
     * @param {Object} stream - stream used to save the asset contents
     * @param {Object} opts
     *
     * @return {Q.Promise} A promise for the metadata of the pulled asset.
     */
    pullItem (asset, stream, opts) {
        const deferred = Q.defer();

        // Initialize the request options.
        this.getDownloadRequestOptions(opts)
            .then(function (reqOptions) {
                reqOptions.uri = reqOptions.uri + "/" + asset.resource;

                // Make the request and pipe the response to the specified stream.
                const responseStream = request.get(reqOptions);
                responseStream.pipe(stream);

                // Check the "response" event to make sure the response was successful.
                let error;
                let sResponse;
                responseStream.on("response", function (response) {
                    sResponse = response;
                    const code = response.statusCode;
                    if (code >= 400) {
                        error = new Error(i18n.__("cannot_get_asset", {path: asset.path, code: code}));
                    }
                });

                // Wait for the writable stream to "finish" before the promise is settled.
                stream.on("finish", function () {
                    if (error) {
                        utils.logErrors('AssetRest finish', utils.getError(error, undefined, sResponse, reqOptions));
                        deferred.reject(error);
                    } else {
                        deferred.resolve(asset);
                    }
                });

                // Handle an "error" event on the response stream
                responseStream.on("error", function (err) {
                    utils.logErrors('assetRest handle error ', utils.getError(err, undefined, sResponse, reqOptions));
                    // set the error object which will get handled via the writable stream finish event.
                    error = err;
                    // If there was an error reading the response, the writable stream must be ended manually.
                    stream.end();
                });
            })
            .catch (function (err) {
                deferred.reject(err);
            });

        return deferred.promise;
    }

    /**
     * Push the specified asset.
     *
     * @param {String} pathname - Full asset path, including file extension.
     * @param {Stream.Readable} stream - A read stream for the data of the asset.
     */
    pushItem (resourceId, resourceMd5, pathname, stream, length, opts) {
        const restObject = this;
        //  if nothing to push then succeed
        if (pathname.startsWith("\\")) {
            pathname = "/" + pathname.slice(1);
        } else if (!pathname.startsWith("/")) {
            pathname = "/" + pathname;
        }

        const resourceRequestOptions = resourceId ? this.getResourcePUTOptions(resourceId, resourceMd5, pathname, opts) : this.getResourcePOSTOptions(pathname, opts);

        // Asset creation requires two steps.  POST/PUT the binary to resource service followed by pushing asset metadata to the asset service
        const deferred = Q.defer();
        resourceRequestOptions
            .then(function (reqOptions) {
                reqOptions.headers["Content-Length"] = length;
                const resourceRequestCallback = function (err, res, body) {
                    if (err || (res && res.statusCode >= 400)) {
                        err = utils.getError(err, body, res, reqOptions);
                        utils.logErrors("AssetRest:resourceRequest", err);
                        deferred.reject(err);
                    } else {
                        const resourceMetadata = resourceId ? { id: resourceId } : JSON.parse(body);
                        // iff an asset object is passed in then attempt update it with the same asset id (Carlos Asset)
                        if (opts && opts.asset) {
                            const asset = opts.asset;
                            restObject.getAssetUpdateRequestOptions(asset.id, opts)
                                .then(function(reqOptions) {
                                    asset.resource = resourceMetadata.id;
                                    delete asset.mediaType;
                                    delete asset.filename;
                                    reqOptions.body = asset;
                                    if (asset.id && asset.rev) {
                                        request.put(reqOptions, function (err, res, body) {
                                            if (res && res.statusCode === 404) {
                                                // We may be pushing an existing asset defn to a new tenant DB, so create the asset defn instead
                                                reqOptions.uri = reqOptions.uri.substring(0, reqOptions.uri.lastIndexOf('/'));
                                                delete reqOptions.body.rev;
                                                postAssetMetadata(reqOptions, deferred);
                                            } else if (err || (res && res.statusCode >= 400)) {
                                                err = utils.getError(err, body, res, reqOptions);
                                                utils.logErrors("AssetRest:put", err);
                                                deferred.reject(err);
                                            } else {
                                                deferred.resolve(body);
                                            }
                                        });
                                    } else {
                                        postAssetMetadata(reqOptions, deferred);
                                    }
                                });
                        } else {
                            // Creating new asset metadata defn for Fernando asset
                            restObject.getRequestOptions(opts)
                                .then(function (reqOptions) {
                                    reqOptions.body = {resource: resourceMetadata.id, path: pathname};
                                    postAssetMetadata(reqOptions, deferred);
                                });
                        }
                    }
                };

                // if we have an existing id, call PUT otherwise call POST to create a new one
                //noinspection JSUnresolvedFunction
                stream.pipe(resourceId ? request.put(reqOptions, resourceRequestCallback) : request.post(reqOptions, resourceRequestCallback));
            })
            .catch (function (err) {
                deferred.reject(err);
            });

        return deferred.promise;
    }

    /**
     * Delete Asset by id
     *  @param {String} id - id of the asset being deleted
     */
    deleteItem (id, opts) {
        const deferred = Q.defer();
        this.getRequestOptions(opts)
            .then(function (reqOptions) {
                reqOptions.uri = reqOptions.uri + "/" + id;

                request.del(reqOptions, function (err, response, body) {
                    if (err || (response && response.statusCode >= 400)) {
                        err = utils.getError(err, body, response, reqOptions);
                        utils.logErrors('assetRest: delete _error', err);
                        deferred.reject(err);
                    } else {
                        if ((response && response.statusCode === 204) && (!body)) {
                            body = i18n.__("deleted_asset", {id: id});
                        }
                        logger.trace("Delete asset by id received the following response: " + body);
                        deferred.resolve(body);
                    }
                });
            })
            .catch (function (err) {
                deferred.reject(err);
            });
        return deferred.promise;
    }

}

// Export the class definition.
module.exports = AssetsREST;
