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

const BaseREST = require("./BaseREST.js");
const Q = require("q");
const utils = require("./utils/utils.js");
const request = utils.getRequestWrapper();
const mime = require('mime-types');
const path = require('path');
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
            utils.logErrors(i18n.__("create_asset_metadata_error"), err);
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
     *
     * @returns {AssetsREST} The singleton instance for this class.
     */
    static get instance () {
        if (!this[singleton]) {
            this[singleton] = new AssetsREST(singletonEnforcer);
        }
        return this[singleton];
    }

    static getResourceHeaders (name) {
        const mtype = mime.lookup(name) || "text/plain";
        const headers = {
            "Accept": "application/json",
            "Accept-Language": utils.getHTTPLanguage(),
            "Content-Type": mtype,
            "Connection": "keep-alive",
            "User-Agent": utils.getUserAgent()
        };

        return headers;
    }

    getDownloadRequestOptions (opts) {
        const deferred = Q.defer();
        const headers = {
            "Accept": "*/*",
            "Accept-Language": utils.getHTTPLanguage(),
            "Connection": "keep-alive",
            "User-Agent": utils.getUserAgent()
        };

        this.getRequestURI(opts)
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
        const headers = BaseREST.getHeaders();

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

    getResourcePOSTOptions (name, opts) {
        const deferred = Q.defer();
        const headers = AssetsREST.getResourceHeaders(name);
        const fname = path.basename(name);

        this.getRequestURI(opts)
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
        const headers = AssetsREST.getResourceHeaders(name);
        const fname = path.basename(name);

        this.getRequestURI(opts)
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
     * @param {Object} [opts]
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
                        utils.logErrors('AssetsRest.pullItem finish: ', utils.getError(error, undefined, sResponse, reqOptions));
                        deferred.reject(error);
                    } else {
                        deferred.resolve(asset);
                    }
                });

                // Handle an "error" event on the response stream
                responseStream.on("error", function (err) {
                    utils.logErrors('AssetsREST.pullItem error: ', utils.getError(err, undefined, sResponse, reqOptions));
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
     * @param isContentResource - flag indicating if the resource is a content resource
     * @param replaceContentResource - flag indicating if a content resource should be replaced
     * @param resourceId
     * @param resourceMd5
     * @param {String} pathname - Full asset path, including file extension.
     * @param {Object} stream - A read stream for the data of the asset.
     * @param length
     * @param opts
     */
    pushItem (isContentResource, replaceContentResource, resourceId, resourceMd5, pathname, stream, length, opts) {
        const restObject = this;
        //  if nothing to push then succeed
        if (pathname.startsWith("\\")) {
            pathname = "/" + pathname.slice(1);
        } else if (!pathname.startsWith("/")) {
            pathname = "/" + pathname;
        }

        // A web asset always uses POST to create a new resource, content assets only POST if replaceContentResource is true or there is no resourceId.
        const resourceRequestOptions = isContentResource && !replaceContentResource && resourceId ? this.getResourcePUTOptions(resourceId, resourceMd5, pathname, opts) : this.getResourcePOSTOptions(pathname, opts);
        // Asset creation requires two steps.  POST/PUT the binary to resource service followed by pushing asset metadata to the asset service
        const deferred = Q.defer();
        resourceRequestOptions
            .then(function (reqOptions) {
                reqOptions.headers["Content-Length"] = length;
                const resourceRequestCallback = function (err, res, body) {
                    if (err || (res && res.statusCode >= 400)) {
                        err = utils.getError(err, body, res, reqOptions);
                        utils.logErrors("AssetsRest.pushItem resourceRequestCallback: ", err);
                        deferred.reject(err);
                    } else {
                        // to replace the underlying resource, we need to parse the result body to get the new resource ID.
                        const resourceMetadata = isContentResource && !replaceContentResource && resourceId ? { id: resourceId } : JSON.parse(body);
                        // iff an asset object is passed in then attempt update it with the same asset id (Carlos Asset)
                        if (opts && opts.asset) {
                            const asset = opts.asset;
                            restObject.getAssetUpdateRequestOptions(asset.id, opts)
                                .then(function (reqOptions) {
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
                                                utils.logErrors("AssetsREST.pushItem put: ", err);
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
                            // Creating new asset metadata defn for Fernando web asset
                            restObject.getRequestOptions(opts)
                                .then(function (reqOptions) {
                                    reqOptions.body = {resource: resourceMetadata.id, path: pathname};
                                    postAssetMetadata(reqOptions, deferred);
                                });
                        }
                    }
                };

                // A web asset always uses POST to create a new resource, content assets only POST if replaceContentResource is true or there is no resourceId.
                //noinspection JSUnresolvedFunction
                stream.pipe(isContentResource && !replaceContentResource && resourceId ? request.put(reqOptions, resourceRequestCallback) : request.post(reqOptions, resourceRequestCallback));
            })
            .catch (function (err) {
                deferred.reject(err);
            });

        return deferred.promise;
    }
}

// Export the class definition.
module.exports = AssetsREST;
