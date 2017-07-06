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
const utils = require("./utils/utils.js");
const request = utils.getRequestWrapper();
const options = require("./utils/options.js");
const i18n = utils.getI18N(__dirname, ".json", "en");

class BaseREST {
    constructor (serviceName, uriPath, allUriSuffix, modifiedUriSuffix) {
        this._serviceName = serviceName;
        this._uriPath = uriPath;
        this._allUriSuffix = allUriSuffix;
        this._modifiedUriSuffix = modifiedUriSuffix;

        this.reset();
    }

    reset () {
        this._uri = undefined;
    }

    getServiceName () {
        return this._serviceName;
    }

    getUriPath () {
        return this._uriPath;
    }

    static getHeaders () {
        return {
            "Accept": "application/json",
            "Accept-Language": utils.getHTTPLanguage(),
            "Content-Type": "application/json",
            "Connection": "keep-alive",
            "User-Agent": utils.getUserAgent()
        };
    }

    getRequestURI (opts) {
        // Promise based to allow for lookup of URI if necdessary going forward
        const deferred = Q.defer();

        if (!this._uri) {
            const baseUrl = options.getRelevantOption(opts, "x-ibm-dx-tenant-base-url");

            /*istanbul ignore next*/
            if (baseUrl) {
                this._uri = baseUrl;
            } else {
                // FUTURE This fallback code will eventually be obsolete.
                const gateway = options.getRelevantOption(opts, "dx-api-gateway");
                const tenantId = options.getRelevantOption(opts, "x-ibm-dx-tenant-id");
                this._uri = gateway + "/" + tenantId;
            }
        }
        deferred.resolve(this._uri);

        return deferred.promise;
    }

    getRequestOptions (opts) {
        const restObject = this;
        const deferred = Q.defer();
        const headers = BaseREST.getHeaders();

        this.getRequestURI(opts)
            .then(function (uri) {
                deferred.resolve({
                    uri: uri + restObject.getUriPath(),
                    json: true,
                    headers: headers
                });
            })
            .catch(function (err) {
                deferred.reject(err);
            });
        return deferred.promise;
    }

    getModifiedItems (lastPullTimestamp, opts) {
        const params = {};
        if (lastPullTimestamp) {
            params.start = lastPullTimestamp;
        }
        return this._getItems(this._modifiedUriSuffix, params, opts);
    }

    /**
     *
     * @param opts
     * @returns {Q.Promise}
     */
    getItems (opts) {
        return this._getItems(this._allUriSuffix, undefined, opts);
    }

    _getItems (uriSuffix, queryParams, opts) {
        const restObject = this;
        const deferred = Q.defer();
        const offset = options.getRelevantOption(opts, "offset", this.getServiceName());
        const limit = options.getRelevantOption(opts, "limit", this.getServiceName());
        this.getRequestOptions(opts)
            .then(function (requestOptions) {
                requestOptions.uri = requestOptions.uri + (uriSuffix || "") + "?offset=" + offset + "&limit=" + limit;
                if (queryParams) {
                    Object.keys(queryParams).forEach(function (key) {
                        requestOptions.uri = requestOptions.uri + "&" + key + "=" + queryParams[key];
                    });
                }
                request.get(requestOptions, function (err, res, body) {
                    if ((err) || (res && res.statusCode !== 200)) {
                        err = utils.getError(err, body, res, requestOptions);
                        utils.logErrors(i18n.__("get_items_error" , {service_name: restObject.getServiceName()}),err);
                        deferred.reject(err);
                    } else {
                        deferred.resolve(body.items);
                    }
                });
            })
            .catch(function (err) {
                deferred.reject(err);
            });

        return deferred.promise;
    }

    getItem (id, opts) {
        const restObject = this;
        const deferred = Q.defer();
        this.getRequestOptions(opts)
            .then(function (requestOptions) {
                requestOptions.uri = requestOptions.uri + "/" + id;
                request.get(requestOptions, function (err, res, body) {
                    if ((err) || (res && res.statusCode !== 200)) {
                        err = utils.getError(err, body, res, requestOptions);
                        // special case where we ar just seeing if the item does exisit and if not it's not an error
                        if(!opts || opts.noErrorLog !== "true")
                            utils.logErrors(i18n.__("get_item_error", {service_name: restObject.getServiceName()}), err);
                        deferred.reject(err);
                    } else {
                        deferred.resolve(body);
                    }
                });
            })
            .catch(function (err) {
                deferred.reject(err);
            });
        return deferred.promise;
    }

    /*
     * Does this WCH REST API currently support the by-path end point?
     */
    supportsItemByPath () {
        return false;
    }

    getItemByPath (path, opts) {
        const deferred = Q.defer();
        const serviceName = this.getServiceName();
        if (this.supportsItemByPath()) {
            this.getRequestOptions(opts)
                .then(function (requestOptions) {
                    requestOptions.uri = requestOptions.uri + "/by-path?path=" + path;
                    request.get(requestOptions, function (err, res, body) {
                        if ((err) || (res && res.statusCode !== 200)) {
                            err = utils.getError(err, body, res, requestOptions);
                            // special case where we are just seeing if the item does exisit and if not it's not an error
                            if (!opts || opts.noErrorLog !== "true") {
                                utils.logErrors(i18n.__("get_item_error", {"service_name": serviceName}), err);
                            }
                            deferred.reject(err);
                        } else {
                            deferred.resolve(body);
                        }
                    });
                })
                .catch(function (err) {
                    deferred.reject(err);
                });
        } else {
            // This is a programming error, no need to translate.
            deferred.reject(new Error(i18n.__("error_unsupported_endpoint", {"service_name": serviceName, "endpoint": "by-path"})));
        }
        return deferred.promise;
    }

    createItem (item, opts) {
        const restObject = this;
        const deferred = Q.defer();
        this.getRequestOptions(opts)
            .then(function (requestOptions) {
                requestOptions.body = item;
                utils.logDebugInfo("Creating item with request options: ",undefined, requestOptions);
                request.post(requestOptions, function (err, res, body) {
                    if ((err) || (res && (res.statusCode < 200 || res.statusCode > 299))) {
                        err = utils.getError(err, body, res, requestOptions);

                        // Check to see if this operation should be retried.
                        if (opts && opts.filterRetryPush && opts.filterRetryPush(err)) {
                            // The operation will be retried, so do not log the error yet.
                            err.retry = true;
                        } else {
                            // The operation will not be retried, so log the error.
                            utils.logErrors(i18n.__("create_item_error", {service_name: restObject.getServiceName()}), err);
                        }
                        deferred.reject(err);
                    } else {
                        utils.logDebugInfo('create item:' + restObject.getServiceName(),  res);
                        deferred.resolve(body);
                    }
                });
            })
            .catch(function (err) {
                deferred.reject(err);
            });
        return deferred.promise;
    }

    /*
     * Does this WCH REST API currently support the forceOverride query param?
     */
    supportsForceOverride () {
        return false;
    }

    updateItem (item, opts) {
        const deferred = Q.defer();
        const restObject = this;
        this.getRequestOptions(opts)
            .then(function (requestOptions) {
                requestOptions.uri = requestOptions.uri + "/" + item.id;
                if (restObject.supportsForceOverride() && options.getRelevantOption(opts, "force-override")) {
                    requestOptions.uri += "?forceOverride=true";
                }
                requestOptions.body = item;
                utils.logDebugInfo("Updating item with request options: ",undefined, requestOptions);
                request.put(requestOptions, function (err, res, body) {
                    if (res && res.statusCode === 404) {
                        deferred.resolve(restObject.createItem(item, opts));
                    } else if ((err) || (res && (res.statusCode < 200 || res.statusCode > 299))) {
                        err = utils.getError(err, body, res, requestOptions);

                        // Check to see if this operation should be retried.
                        if (opts && opts.filterRetryPush && opts.filterRetryPush(err)) {
                            // The operation will be retried, so do not log the error yet.
                            err.retry = true;
                        } else {
                            // The operation will not be retried, so log the error.
                            utils.logErrors(i18n.__("update_item_error", {service_name: restObject.getServiceName()}), err);
                        }
                        deferred.reject(err);
                    } else {
                        utils.logDebugInfo('update item:' + restObject.getServiceName(),  res);
                        if (body)
                            deferred.resolve(body);
                        else
                            deferred.resolve(item);
                    }
                });
            })
            .catch(function (err) {
                deferred.reject(err);
            });
        return deferred.promise;
    }

    /**
     * Delete the given item.
     *
     * @param {Object} item The item to be deleted.
     * @param {Object} [opts] The options to be used for the delete request.
     *
     * @return {Q.Promise} A promise to delete the given item.
     */
    deleteItem (item, opts) {
        const restObject = this;
        const deferred = Q.defer();
        this.getRequestOptions(opts)
            .then(function (requestOptions) {
                requestOptions.uri = requestOptions.uri + "/" + item.id;
                utils.logDebugInfo('delete item:' + restObject.getServiceName(),undefined,requestOptions);

                // del ==> delete
                return request.del(requestOptions, function (err, res, body) {
                    if ((err) || (res && (res.statusCode < 200 || res.statusCode > 299))) {
                        err = utils.getError(err, body, res, requestOptions);
                        utils.logErrors(i18n.__("delete_item_error", {service_name: restObject.getServiceName()}), err);
                        deferred.reject(err);
                    } else {
                        if (res.statusCode === 204 && (!body)) {
                            body = i18n.__("deleted_item", {id: item.id});
                        }
                        res["body"] = body;
                        utils.logDebugInfo('delete ' + restObject.getServiceName(), res);
                        deferred.resolve(body);
                    }
                });
            })
            .catch(function (err) {
                deferred.reject(err);
            });
        return deferred.promise;
    }
}

module.exports = BaseREST;
