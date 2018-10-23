/*
Copyright IBM Corporation 2016, 2017, 2018

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
const hashes = require("./utils/hashes.js");
const request = utils.getRequestWrapper();
const mime = require('mime-types');
const path = require('path');
const querystring = require("querystring");
const i18n = utils.getI18N(__dirname, ".json", "en");

const singleton = Symbol();
const singletonEnforcer = Symbol();

const PUBLISH_PRIORITY = "x-ibm-dx-publish-priority";
const PUBLISH_PRIORITY_NOW = "now";

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
                    uri: restObject._appendURI(uri, "/authoring/v1/resources"),
                    headers: headers
                };
                deferred.resolve(restObject.addRetryOptions(context, requestOptions, opts));
            })
            .catch(function (err) {
                deferred.reject(err);
            });

        return deferred.promise;
    }

    getResourceListRequestOptions (context, opts) {
        const deferred = Q.defer();
        const restObject = this;
        const headers = {
            "Accept": "application/json",
            "Accept-Language": utils.getHTTPLanguage(),
            "Connection": "keep-alive",
            "User-Agent": utils.getUserAgent()
        };
        BaseREST.addHeaderOverrides(context, headers, opts);

        this.getRequestURI(context, opts)
            .then(function (uri) {
                uri = options.getRelevantOption(context, opts, "x-ibm-dx-tenant-base-url", "resources") || uri;
                const requestOptions = {
                    uri: restObject._appendURI(uri, "/authoring/v1/resources/views/by-created"),
                    headers: headers
                };
                deferred.resolve(restObject.addRetryOptions(context, requestOptions, opts));
            })
            .catch(function (err) {
                deferred.reject(err);
            });

        return deferred.promise;
    }

    /*
     * Override BaseREST.getUpdateRequestOptions to add x-ibm-dx-publish-priority:now header if specified
     * 
     * NOTE - this is only used for the Asset POSTing, since Asset PUT needs to determine whether to add forceOverride whereas POST doesn't support that
     */
    getUpdateRequestOptions (context, opts) {
        return super.getUpdateRequestOptions(context, opts)
            .then((reqOptions) => {
                if (options.getRelevantOption(context, opts, "publish-now")) {
                    reqOptions.headers[PUBLISH_PRIORITY] = PUBLISH_PRIORITY_NOW;
                }
                const deferred = Q.defer();
                deferred.resolve(reqOptions);
                return deferred.promise;
            });
    }

    getAssetUpdateRequestOptions (context, id, opts) {
        const deferred = Q.defer();
        const restObject = this;
        const headers = BaseREST.getUpdateHeaders(context, opts);
        const forceParam = (options.getRelevantOption(context, opts, "force-override")) ? "?forceOverride=true" : "";
        if (options.getRelevantOption(context, opts, "publish-now")) {
            headers[PUBLISH_PRIORITY] = PUBLISH_PRIORITY_NOW;
        }

        this.getRequestURI(context, opts)
            .then(function (uri) {
                const requestOptions = {
                    uri: restObject._appendURI(uri, "/authoring/v1/assets/" + id) + forceParam,
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
                    uri: restObject._appendURI(uri, "/authoring/v1/resources") + "?name=" + querystring.escape(fname),
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
                    uri: restObject._appendURI(uri, "/authoring/v1/resources" + uriIdPath) + "?name=" + querystring.escape(fname) + paramMd5,
                    headers: headers
                };
                deferred.resolve(restObject.addRetryOptions(context, requestOptions, opts));
            })
            .catch(function (err) {
                deferred.reject(err);
            });

        return deferred.promise;
    }

    getAssetFindOptions (context, path, opts) {
        const deferred = Q.defer();
        const restObject = this;
        const headers = BaseREST.getHeaders(context, opts);

        this.getRequestURI(context, opts)
            .then(function (uri) {
                const requestOptions = {
                    uri: restObject._appendURI(uri, "/authoring/v1/assets/record") + "?path=" + querystring.escape(path),
                    headers: headers
                };
                deferred.resolve(restObject.addRetryOptions(context, requestOptions, opts));
            })
            .catch(function (err) {
                deferred.reject(err);
            });

        return deferred.promise;
    }

    getResourceList (context, opts) {
        const restObject = this;
        const deferred = Q.defer();
        const offset = options.getRelevantOption(context, opts, "offset", "resources") || 0;
        const limit = options.getRelevantOption(context, opts, "limit", "resources");
        restObject.getResourceListRequestOptions(context, opts)
            .then(function (requestOptions) {
                requestOptions.uri = requestOptions.uri + "?offset=" + offset + "&limit=" + limit;
                request.get(requestOptions, function (err, res, body) {
                    const response = res || {};
                    if (err || response.statusCode !== 200) {
                        err = utils.getError(err, body, response, requestOptions);
                        BaseREST.logRetryInfo(context, requestOptions, response.attempts, err);
                        utils.logErrors(context, i18n.__("get_items_error", {service_name: "resources"}), err);
                        deferred.reject(err);
                    } else if (body) {
                        BaseREST.logRetryInfo(context, requestOptions, response.attempts);
                        try {
                            const parsed = JSON.parse(body);
                            deferred.resolve(parsed.items ? parsed.items : parsed);
                        } catch (err) {
                            deferred.resolve(body);
                        }
                    } else {
                        deferred.resolve([]);
                    }
                });
            })
            .catch(function (err) {
                deferred.reject(err);
            });

        return deferred.promise;
    }

    _extractFilename (header) {
        let filename = undefined;
        if (header) {
            let index = header.indexOf("filename*");
            if (index > 0) {
                filename = header.substring(index + 9);
                filename = filename.substring(filename.indexOf("=") + 1).trim();
                filename = filename.substring(filename.lastIndexOf("'") + 1).trim();
            } else {
                index = header.indexOf("filename");
                if (index > 0) {
                    filename = header.substring(index + 8);
                    filename = filename.substring(filename.indexOf("=") + 1).trim();
                }
            }
        }
        return filename;
    }

    /*
     * Ask the authoring API to return the specified artifact by path
     */
    getItemByPath (context, path, opts) {
        const deferred = Q.defer();
        const serviceName = this.getServiceName();
        this.getAssetFindOptions(context, path, opts)
            .then(function (requestOptions) {
                request.get(requestOptions, function (err, res, body) {
                    const response = res || {};
                    if (err || response.statusCode !== 200) {
                        err = utils.getError(err, body, response, requestOptions);
                        BaseREST.logRetryInfo(context, requestOptions, response.attempts, err);

                        // special case where we are just seeing if the item does exist and if not it's not an error
                        if (!opts || opts.noErrorLog !== "true") {
                            utils.logErrors(context, i18n.__("get_item_error", {"service_name": serviceName}), err);
                        }
                        deferred.reject(err);
                    } else {
                        BaseREST.logRetryInfo(context, requestOptions, response.attempts);
                        deferred.resolve(JSON.parse(body));
                    }
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
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} asset - metadata for the asset to be downloaded
     * @param {Object} stream - stream used to save the asset contents
     * @param {Object} [opts]
     *
     * @return {Q.Promise} A promise for the metadata of the pulled asset.
     */
    pullItem (context, asset, stream, opts) {
        const deferred = Q.defer();

        const restObject = this;
        // Initialize the request options.
        this.getDownloadRequestOptions(context, opts)
            .then(function (reqOptions) {
                reqOptions.uri = restObject._appendURI(reqOptions.uri, asset.resource);
                // Make the request and pipe the response to the specified stream.
                const responseStream = request.get(reqOptions);
                if (opts && opts.returnDisposition) {
                    responseStream.on("response", function (response) {
                        const disposition = response.headers["content-disposition"];
                        asset.disposition = restObject._extractFilename(disposition);
                        asset.contentType = response.headers["content-type"];
                    });
                }
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
     * Returns a resource stream for the provided resource path.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param {Object} resourcePath The path to the resource.
     * @param {Object} opts The options for the operation.
     *
     * @returns {Q.Promise<any>} A promise for the resource stream.
     */
    getResourceStream (context, resourcePath, opts) {
        const deferred = Q.defer();

        const restObject = this;
        // Initialize the request options.
        this.getDownloadRequestOptions(context, opts)
            .then(function (reqOptions) {
                reqOptions.uri = restObject._appendURI(reqOptions.uri, resourcePath);
                // Make the request and return the stream.
                const responseStream = request.get(reqOptions);

                // Check the "response" event to make sure the response was successful.
                responseStream.on("response", function (response) {
                    const code = response.statusCode;
                    if (code >= 400) {
                        const error = new Error(i18n.__("cannot_get_asset", {path: resourcePath, code: code}));
                        deferred.reject(error);
                    } else {
                        deferred.resolve(response);
                    }
                });
            })
            .catch (function (err) {
                deferred.reject(err);
            });

        return deferred.promise;
    }

    /**
     * Return the keys that can be ignored as they can contain unimportant differences in artifacts of this type.
     *
     * @returns {Object} the ignore keys for this artifact type.
     */
    getIgnoreKeys () {
        const ignoreKeys = {};
        ["rev",
            "created", "creator", "creatorId",
            "lastModified", "lastModifier", "lastModifierId",
            "systemModified",
            "links", "types", "categories", "publishing"
        ].forEach(function (key) {
            ignoreKeys[key] = undefined;
        });
        return ignoreKeys;
    }

    canIgnoreConflict (context, asset, remoteAsset, opts) {
        const diffs = utils.compare(asset, remoteAsset, this.getIgnoreKeys());
        return (diffs.added.length === 0 && diffs.removed.length === 0 && diffs.changed.length === 0);
    }

    /*
     * local utility method to do the asset metadata POST, called from multiple places in pushItem
     */
    _postAssetMetadata (context, opts, reqOptions, deferred, createOnly) {
        const restObject = this;
        if (options.getRelevantOption(context, opts, "setTag")) {
            restObject.setTag (context, reqOptions.body, opts);
        }                                
        utils.logDebugInfo(context, "_postAssetMetadata request", undefined, reqOptions);
        request.post(reqOptions, function (err, res, body) {
            const response = res || {};
            if (err || response.statusCode >= 400) {
                const handleError = Q.defer();
                // A 409 Conflict error means the asset already exists. So for createOnly, we will consider
                // this to be a successful push of the asset, otherwise handle the error in the normal way.
                if (createOnly && response.statusCode === 409) {
                    BaseREST.logRetryInfo(context, reqOptions, response.attempts);
                    handleError.resolve(false);
                } else if (response.statusCode === 409) {
                    const asset = reqOptions.body;
                    restObject.getItem(context, asset.id, opts)
                        .then(function (remoteAsset) {
                            handleError.resolve(restObject.canIgnoreConflict(context, asset, remoteAsset, opts));
                        })
                        .catch(function (remoteAssetErr) {
                            handleError.resolve(true);
                        });
                } else {
                    // This is a non-conflict (409) error, just handle it.
                    handleError.resolve(true);
                }
                handleError.promise.then(function (isError) {
                    if (isError) {
                        err = utils.getError(err, body, response, reqOptions);
                        BaseREST.logRetryInfo(context, reqOptions, response.attempts, err);
                        utils.logErrors(context, i18n.__("create_asset_metadata_error"), err);
                        deferred.reject(err);
                    } else {
                        deferred.resolve(reqOptions.body);
                    }
                });
            } else {
                BaseREST.logRetryInfo(context, reqOptions, response.attempts);
                utils.logDebugInfo(context, "_postAssetMetadata response", response, undefined);
                deferred.resolve(body);
            }
        });
    }

    /**
     * Push the specified asset.
     *
     * @param {Object} context The API context to be used for this operation.
     * @param isOrphanedResource - flag indicating if the resource is an orphaned content resource
     * @param isContentResource - flag indicating if the resource is a content resource
     * @param replaceContentResource - flag indicating if a content resource should be replaced
     * @param resourceId
     * @param resourceMd5
     * @param {String} pathname - Full asset path, including file extension.
     * @param {Object} stream - A read stream for the data of the asset.
     * @param length
     * @param opts
     */
    pushItem (context, isOrphanedResource, isContentResource, replaceContentResource, resourceId, resourceMd5, pathname, stream, length, opts) {
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

        // A web asset always uses PUT to update the resource, content assets only POST if replaceContentResource is true or there is no resourceId.
        const updateContentResource = ((isContentResource && !replaceContentResource) || (!isContentResource)) && resourceId;

        // Do not retry resource push requests. The stream passed in can only be read for the first request.
        const rOpts = utils.cloneOpts(opts, {retryMaxAttempts: 1});

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

                        // Check to see if this operation should be retried.
                        if (context.filterRetryPush && context.filterRetryPush(context, err, opts)) {
                            // The operation will be retried, so do not log the error yet.
                            err.retry = true;
                        } else {
                            // The operation will not be retried, so log the error.
                            utils.logErrors(context, "AssetsRest.pushItem resourceRequestCallback: ", err);
                        }
                        deferred.reject(err);
                    } else {
                        BaseREST.logRetryInfo(context, reqOptions, response.attempts);

                        // To replace the underlying resource, we need to parse the result body to get the new resource ID.
                        const resourceMetadata = (updateContentResource || !body) ? {id: resourceId} : JSON.parse(body);

                        let doUpdate;
                        let requestBody;
                        if (opts && opts.asset) {
                            // A (managed) asset object was passed in, so use that asset for the update request.
                            requestBody = opts.asset;

                            // For managed assets, doUpdate is set based on the createOnly flag.
                            doUpdate = !createOnly;
                        } else {
                            // No asset metadata was provided, construct a minimal asset to be used for the create request.
                            requestBody = {resource: resourceMetadata.id, path: pathname};

                            // We always just create new asset metadata for Fernando web assets.
                            doUpdate = false;
                        }

                        if (doUpdate) {
                            requestBody.resource = resourceMetadata.id;
                            delete requestBody.filename;
                            if (requestBody.id && requestBody.rev) {
                                restObject.getAssetUpdateRequestOptions(context, requestBody.id, opts)
                                    .then(function (reqOptions) {
                                        if (options.getRelevantOption(context, opts, "setTag")) {
                                            restObject.setTag (context, requestBody, opts);
                                        }                                
                                        reqOptions.body = requestBody;
                                        request.put(reqOptions, function (err, res, body) {
                                            const response = res || {};
                                            if (response.statusCode === 404) {
                                                // We may be pushing an existing asset defn to a new tenant DB, so create the asset defn instead.
                                                reqOptions = utils.clone(reqOptions);
                                                reqOptions.uri = reqOptions.uri.substring(0, reqOptions.uri.lastIndexOf('/'));
                                                delete reqOptions.body.rev;
                                                restObject._postAssetMetadata(context, opts, reqOptions, deferred, createOnly);
                                            } else if (response.statusCode === 409) {
                                                restObject.getItem(context, requestBody.id, opts)
                                                    .then(function (remoteAsset) {
                                                        if (restObject.canIgnoreConflict(context, requestBody, remoteAsset, opts)) {
                                                            deferred.resolve(requestBody);
                                                        } else {
                                                            err = utils.getError(err, body, response, reqOptions);
                                                            BaseREST.logRetryInfo(context, reqOptions, response.attempts, err);
                                                            utils.logErrors(context, "AssetsREST.pushItem put: ", err);
                                                            deferred.reject(err);
                                                        }
                                                    })
                                                    .catch(function (remoteAssetErr) {
                                                        err = utils.getError(err, body, response, reqOptions);
                                                        BaseREST.logRetryInfo(context, reqOptions, response.attempts, err);
                                                        utils.logErrors(context, "AssetsREST.pushItem put: ", err);
                                                        deferred.reject(err);
                                                    });
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
                                    });
                            } else {
                                restObject.getUpdateRequestOptions(context, opts)
                                    .then(function (reqOptions) {
                                        reqOptions.body = requestBody;
                                        restObject._postAssetMetadata(context, opts, reqOptions, deferred, createOnly);
                                    });
                            }
                        } else if (!isOrphanedResource) {
                            // Creating new asset metadata. Fernando web asset or create-only.
                            restObject.getUpdateRequestOptions(context, opts)
                                .then(function (reqOptions) {
                                    reqOptions.body = requestBody;
                                    restObject._postAssetMetadata(context, opts, reqOptions, deferred, createOnly);
                                });
                        } else {
                            // This is an orphaned resource, there is no content metadata so just resolve
                            deferred.resolve(body);
                        }
                    }
                };

                const headDeferred = Q.defer();
                const headResponsePromise = headDeferred.promise;
                if (updateContentResource) {
                    // Before a PUT, do HEAD request to see if the resource already exists with the same MD5 hash.
                    restObject.getDownloadRequestOptions(context, opts).then(function (headReqOptions) {
                        headReqOptions.uri = restObject._appendURI(headReqOptions.uri, resourceId) + "?bypass-cache=" + Date.now();
                        request.head(headReqOptions, function(headErr, headRes, headBody) {
                            let sendResource = true;
                            if (headErr) {
                                // Ignore an error from the HEAD request and continue assuming we need to push.
                            } else if (headRes && headRes.statusCode && headRes.statusCode === 200 && headRes.headers && headRes.headers.etag) {
                                const etag = headRes.headers.etag.substring(1, headRes.headers.etag.length-1);
                                if (hashes.compareMD5Hashes(resourceMd5, etag)) {
                                    // The hashes are equal, the resource already exists with a matching MD5.
                                    sendResource = false;
                                }
                            }
                            headDeferred.resolve(sendResource);
                        });
                    });
                } else {
                    headDeferred.resolve(true);
                }
                headResponsePromise.then(function (sendResource) {
                    if (sendResource) {
                        // A web asset always uses POST to create a new resource, content assets only POST if replaceContentResource is true or there is no resourceId.
                        //noinspection JSUnresolvedFunction
                        stream.pipe(updateContentResource ? request.put(reqOptions, resourceRequestCallback) : request.post(reqOptions, resourceRequestCallback));
                    } else {
                        // Directly call the callback and send a simple HTTP 200 reply.
                        resourceRequestCallback(undefined, { statusCode: 200 }, {});
                    }
                });
            })
            .catch (function (err) {
                deferred.reject(err);
            });

        return deferred.promise;
    }

    /*
     * Set the specified tag in this item, if not already in the list of tags for the specified item.
     * 
     * End up with a tag entry like this in the asset metadata item:
     * { ...
     *   "tags": {
     *       "values": [
     *           ...
     *           "thetag" 
     *       ] 
     *   }
     * }
     * @param context
     * @param asset metadata item
     * @param opts
     */
    setTag(context, item, opts) {
        const tag = options.getRelevantOption(context, opts, "setTag");
        if (!item.tags) {
            item.tags = { "values": [tag] };
        } else if (!item.tags.values) {
            item.tags.values = [tag];
        } else if (!item.tags.values.includes(tag) && !item.tags.values.includes("user:"+tag)) {
            item.tags.values.push(tag);
        }
    }
}

// Export the class definition.
module.exports = AssetsREST;
