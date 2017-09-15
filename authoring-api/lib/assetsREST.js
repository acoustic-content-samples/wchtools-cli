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
const options = require("./utils/options.js");
const request = utils.getRequestWrapper();
const mime = require('mime-types');
const path = require('path');
const querystring = require("querystring");
const i18n = utils.getI18N(__dirname, ".json", "en");

const singleton = Symbol();
const singletonEnforcer = Symbol();

/*
 * local utility method to do the asset metadata POST, called from multiple places in pushItem
 */
function postAssetMetadata(context, reqOptions, deferred, createOnly) {
    request.post(reqOptions, function (err, res, body) {
        const response = res || {};
        if (err || response.statusCode >= 400) {
            // A 409 Conflict error means the asset already exists. So for createOnly, we will consider
            // this to be a sucessful push of the asset, otherwise handle the error in the normal way.
            if (createOnly && response.statusCode === 409) {
                BaseREST.logRetryInfo(context, reqOptions, response.attempts);
                deferred.resolve(reqOptions.body);
            } else {
                err = utils.getError(err, body, response, reqOptions);
                BaseREST.logRetryInfo(context, reqOptions, response.attempts, err);
                utils.logErrors(context, i18n.__("create_asset_metadata_error"), err);
                deferred.reject(err);
            }
        } else {
            BaseREST.logRetryInfo(context, reqOptions, response.attempts);
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

    static getResourceHeaders (context, name, opts) {
        const mtype = mime.lookup(name) || "text/plain";
        const headers = {
            "Accept": "application/json",
            "Accept-Language": utils.getHTTPLanguage(),
            "Content-Type": mtype,
            "Connection": "keep-alive",
            "User-Agent": utils.getUserAgent()
        };

        return this.addHeaderOverrides(context, headers, opts);
    }

    getDownloadRequestOptions (context, opts) {
        const deferred = Q.defer();
        const restObject = this;
        const headers = {
            "Accept": "*/*",
            "Accept-Language": utils.getHTTPLanguage(),
            "Connection": "keep-alive",
            "User-Agent": utils.getUserAgent()
        };
        BaseREST.addHeaderOverrides(context, headers, opts);

        this.getRequestURI(context, opts)
            .then(function (uri) {
                uri = options.getRelevantOption(context, opts, "x-ibm-dx-tenant-base-url", "resources") || uri;
                const requestOptions = {
                    uri: uri + "/authoring/v1/resources",
                    headers: headers
                };
                deferred.resolve(restObject.addRetryOptions(context, requestOptions, opts));
            })
            .catch(function (err) {
                deferred.reject(err);
            });

        return deferred.promise;
    }

    getAssetUpdateRequestOptions (context, id, opts) {
        const deferred = Q.defer();
        const restObject = this;
        const headers = BaseREST.getHeaders(context, opts);
        const forceParam = (options.getRelevantOption(context, opts, "force-override")) ? "?forceOverride=true" : "";

        this.getRequestURI(context, opts)
            .then(function (uri) {
                const requestOptions = {
                    uri: uri + "/authoring/v1/assets/" + id + forceParam,
                    headers: headers,
                    json: true
                };
                deferred.resolve(restObject.addRetryOptions(context, requestOptions, opts));
            })
            .catch(function (err) {
                deferred.reject(err);
            });

        return deferred.promise;
    }

    getResourcePOSTOptions (context, name, opts) {
        const deferred = Q.defer();
        const restObject = this;
        const headers = AssetsREST.getResourceHeaders(context, name, opts);
        const fname = path.basename(name);

        this.getRequestURI(context, opts)
            .then(function (uri) {
                uri = options.getRelevantOption(context, opts, "x-ibm-dx-tenant-base-url", "resources") || uri;
                const requestOptions = {
                    uri: uri + "/authoring/v1/resources?name=" + querystring.escape(fname),
                    headers: headers
                };
                deferred.resolve(restObject.addRetryOptions(context, requestOptions, opts));
            })
            .catch(function (err) {
                deferred.reject(err);
            });

        return deferred.promise;
    }

    getResourcePUTOptions (context, resourceId, resourceMd5, name, opts) {
        const deferred = Q.defer();
        const restObject = this;
        const headers = AssetsREST.getResourceHeaders(context, name, opts);
        const fname = path.basename(name);

        this.getRequestURI(context, opts)
            .then(function (uri) {
                uri = options.getRelevantOption(context, opts, "x-ibm-dx-tenant-base-url", "resources") || uri;
                const uriIdPath = resourceId ? "/" + resourceId : "";
                const paramMd5 = resourceMd5 ? "&md5=" + querystring.escape(resourceMd5) : "";
                const requestOptions = {
                    uri: uri + "/authoring/v1/resources" + uriIdPath + "?name=" + querystring.escape(fname) + paramMd5,
                    headers: headers
                };
                deferred.resolve(restObject.addRetryOptions(context, requestOptions, opts));
            })
            .catch(function (err) {
                deferred.reject(err);
            });

        return deferred.promise;
    }

    /**
     * Download the specified asset and save it to the given stream.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} asset - metadata for the asset to be downloaded
     * @param {Object} stream - stream used to save the asset contents
     * @param {Object} [opts]
     *
     * @return {Q.Promise} A promise for the metadata of the pulled asset.
     */
    pullItem (context, asset, stream, opts) {
        const deferred = Q.defer();

        // Initialize the request options.
        this.getDownloadRequestOptions(context, opts)
            .then(function (reqOptions) {
                reqOptions.uri = reqOptions.uri + "/" + asset.resource;
                // Make the request and pipe the response to the specified stream.
                const responseStream = request.get(reqOptions);
                responseStream.pipe(stream);

                // Check the "response" event to make sure the response was successful.
                let error;
                let sResponse = {};
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
                        BaseREST.logRetryInfo(context, reqOptions, sResponse.attempts, error);
                        utils.logErrors(context, 'AssetsRest.pullItem finish: ', utils.getError(error, undefined, sResponse, reqOptions));
                        deferred.reject(error);
                    } else {
                        BaseREST.logRetryInfo(context, reqOptions, sResponse.attempts);
                        deferred.resolve(asset);
                    }
                });

                // Handle an "error" event on the response stream
                responseStream.on("error", function (err) {
                    utils.logErrors(context, 'AssetsREST.pullItem error: ', utils.getError(err, undefined, sResponse, reqOptions));
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
     * @param {Object} context The API context to be used for this operation.
     * @param isContentResource - flag indicating if the resource is a content resource
     * @param replaceContentResource - flag indicating if a content resource should be replaced
     * @param resourceId
     * @param resourceMd5
     * @param {String} pathname - Full asset path, including file extension.
     * @param {Object} stream - A read stream for the data of the asset.
     * @param length
     * @param opts
     */
    pushItem (context, isContentResource, replaceContentResource, resourceId, resourceMd5, pathname, stream, length, opts) {
        const restObject = this;

        // Make sure the path name starts with a leading slash.
        if (pathname.startsWith("\\")) {
            pathname = "/" + pathname.slice(1);
        } else if (!pathname.startsWith("/")) {
            pathname = "/" + pathname;
        }

        // Determine whether to force the asset to be created instead of updated. Note that the resource will be handled
        // in the normal way, because a resource PUT request is used to create a resource with a specific id.
        const createOnly = restObject.isCreateOnlyMode(context, opts);

        // A web asset always uses POST to create a new resource, content assets only POST if replaceContentResource is true or there is no resourceId.
        const updateContentResource = isContentResource && !replaceContentResource && resourceId;

        // Do not retry resource push requests. The stream passed in can only be read for the first request.
        const rOpts = utils.cloneOpts(opts);
        rOpts.retryMaxAttempts = 1;

        const resourceRequestOptions = updateContentResource ? this.getResourcePUTOptions(context, resourceId, resourceMd5, pathname, rOpts) : this.getResourcePOSTOptions(context, pathname, rOpts);

        // Asset creation requires two steps.  POST/PUT the binary to resource service followed by pushing asset metadata to the asset service
        const deferred = Q.defer();
        resourceRequestOptions
            .then(function (reqOptions) {
                reqOptions.headers["Content-Length"] = length;

                const resourceRequestCallback = function (err, res, body) {
                    const response = res || {};
                    let handleError = err || (response.statusCode >= 400);

                    // A 409 Conflict error means the resource already exists. So for createOnly, we will consider this
                    // to be a sucessful push of the specified resource, otherwise handle the error in the normal way.
                    if (createOnly && response.statusCode === 409) {
                        handleError = false;
                    }

                    if (handleError) {
                        err = utils.getError(err, body, response, reqOptions);
                        BaseREST.logRetryInfo(context, reqOptions, response.attempts, err);
                        utils.logErrors(context, "AssetsRest.pushItem resourceRequestCallback: ", err);
                        deferred.reject(err);
                    } else {
                        BaseREST.logRetryInfo(context, reqOptions, response.attempts);

                        // To replace the underlying resource, we need to parse the result body to get the new resource ID.
                        const resourceMetadata = (updateContentResource || !body) ? {id: resourceId} : JSON.parse(body);

                        let doUpdate;
                        let requestBody;
                        if (opts && opts.asset && !createOnly) {
                            // A (managed) asset object was passed in, so use that asset for the update request.
                            requestBody = opts.asset;
                            doUpdate = true;
                        } else {
                            // Construct a minimal asset to be used for the create request.
                            requestBody = {resource: resourceMetadata.id, path: pathname};
                            doUpdate = false;

                            if (opts && opts.asset && opts.asset.id) {
                                // A (managed) asset object was passed in, so use the asset id for the create request.
                                requestBody.id = opts.asset.id;
                            }
                        }

                        if (doUpdate) {
                            restObject.getAssetUpdateRequestOptions(context, requestBody.id, opts)
                                .then(function (reqOptions) {
                                    requestBody.resource = resourceMetadata.id;
                                    delete requestBody.mediaType;
                                    delete requestBody.filename;
                                    reqOptions.body = requestBody;
                                    if (requestBody.id && requestBody.rev) {
                                        request.put(reqOptions, function (err, res, body) {
                                            const response = res || {};
                                            if (response.statusCode === 404) {
                                                // We may be pushing an existing asset defn to a new tenant DB, so create the asset defn instead
                                                reqOptions.uri = reqOptions.uri.substring(0, reqOptions.uri.lastIndexOf('/'));
                                                delete reqOptions.body.rev;
                                                postAssetMetadata(context, reqOptions, deferred, createOnly);
                                            } else if (err || response.statusCode >= 400) {
                                                err = utils.getError(err, body, response, reqOptions);
                                                BaseREST.logRetryInfo(context, reqOptions, response.attempts, err);
                                                utils.logErrors(context, "AssetsREST.pushItem put: ", err);
                                                deferred.reject(err);
                                            } else {
                                                BaseREST.logRetryInfo(context, reqOptions, response.attempts);
                                                deferred.resolve(body);
                                            }
                                        });
                                    } else {
                                        postAssetMetadata(context, reqOptions, deferred, createOnly);
                                    }
                                });
                        } else {
                            // Creating new asset metadata. Fernando web asset or create-only.
                            restObject.getRequestOptions(context, opts)
                                .then(function (reqOptions) {
                                    reqOptions.body = requestBody;
                                    postAssetMetadata(context, reqOptions, deferred, createOnly);
                                });
                        }
                    }
                };

                // A web asset always uses POST to create a new resource, content assets only POST if replaceContentResource is true or there is no resourceId.
                //noinspection JSUnresolvedFunction
                stream.pipe(updateContentResource ? request.put(reqOptions, resourceRequestCallback) : request.post(reqOptions, resourceRequestCallback));
            })
            .catch (function (err) {
                deferred.reject(err);
            });

        return deferred.promise;
    }
}

// Export the class definition.
module.exports = AssetsREST;
