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
    }

    getServiceName () {
        return this._serviceName;
    }

    getUriPath () {
        return this._uriPath;
    }

    static getHeaders (context, opts) {
        const hdrs = {
            "Accept": "application/json",
            "Accept-Language": utils.getHTTPLanguage(),
            "Connection": "keep-alive",
            "User-Agent": utils.getUserAgent()
        };

        return this.addHeaderOverrides(context, hdrs, opts);
    }

    static getUpdateHeaders (context, opts) {
        const hdrs = BaseREST.getHeaders(context, opts);
        hdrs["Content-Type"] = "application/json";
        return hdrs;
    }

    static addHeaderOverrides(context, hdrs, opts) {
        options.getPropertyKeys(context, opts).forEach(function (key) {
            const value = options.getRelevantOption(context, opts, key);
            if (key === "x-ibm-dx-request-id") {
                if (!context.BaseRESTRequestCount) {
                    context.BaseRESTRequestCount = 0;
                }
                const requestId = value + "-" + (++context.BaseRESTRequestCount).toString(16);
                hdrs[key] = requestId;
                utils.logDebugInfo(context, 'addHeaderOverrides request id:' + requestId);
            } else if (key.startsWith("x-ibm-dx-") && key !== "x-ibm-dx-tenant-base-url") {
                if (value && typeof value === "string") {
                    hdrs[key] = value;
                } else {
                    // Log a warning since the passed for the header value is not a string.
                    utils.logWarnings(context, i18n.__("header_value_not_string", {header: key}));
                }
            }
        });
        return hdrs;
    }

    getRequestURI (context, opts) {
        // Promise based to allow for lookup of URI if necdessary going forward
        const deferred = Q.defer();
        let baseUrl = options.getRelevantOption(context, opts, "x-ibm-dx-tenant-base-url", this.getServiceName());

        /*istanbul ignore next*/
        if (!baseUrl) {
            // FUTURE This fallback code will eventually be obsolete.
            const gateway = options.getRelevantOption(context, opts, "dx-api-gateway");
            const tenantId = options.getRelevantOption(context, opts, "x-ibm-dx-tenant-id");
            baseUrl = gateway + "/" + tenantId;
        }
        deferred.resolve(baseUrl);

        return deferred.promise;
    }

    /**
     * Add the retry options for this service to the given request options.
     *
     * @param {Object} context The API context to be used for the current request.
     * @param {Object} requestOptions The request options to be used for the current request.
     * @param {Object} opts The override options specified for the current request.
     *
     * @returns {Object} The given request options with the retry options for this artifact type.
     *
     * @protected
     */
    addRetryOptions (context, requestOptions, opts) {
        // Each of the retry options can be specified per service.
        const serviceName = this.getServiceName();

        // Get the retry options defined on the context or overridden on the opts.
        const maxAttempts = options.getRelevantOption(context, opts, "retryMaxAttempts", serviceName);
        const minTimeout = options.getRelevantOption(context, opts, "retryMinTimeout", serviceName);
        const maxTimeout = options.getRelevantOption(context, opts, "retryMaxTimeout", serviceName);
        const factor = options.getRelevantOption(context, opts, "retryFactor", serviceName);
        const randomize = (options.getRelevantOption(context, opts, "retryRandomize", serviceName) === true);

        /**
         * Determine whether the given error and response values indicate that the current request should be retried.
         *
         * @param {Error} err The error that occurred for the current request.
         * @param {Object} response The response received from the server.
         * @param {Object} body The response body received from the server.
         *
         * @returns {Boolean} A return value of true indicates that the request should be retried. A return value of false
         *                    indicates that the request should not be retried.
         */
        const retryStrategy = function (err, response, body) {
            let retVal = false;

            // Only determine whether to retry if there can be more than one attempt.
            if (maxAttempts > 1) {
                // Get the error into the standard format.
                const error = utils.getError(err, body, response, requestOptions);

                if (utils.retryNetworkErrors(err) ) {
                    retVal = true;
                } else if (error.statusCode) {
                    // Determine whether the request should be retried, based on the status code for the error.
                    switch (error.statusCode) {
                        // 403 Forbidden - Handle the special case that sometimes occurs during authorization. In general we
                        // wouldn't retry on this error, but if it happens during authorization, a retry frequently succeeds.
                        case 403: {
                            retVal = true;
                            // For a 403, don't bother retrying if the error code is 3193 (operation not allowed based on tenant tier).
                            if (response && response.body && response.body.errors && response.body.errors.length > 0) {
                                response.body.errors.forEach(function (e) {
                                    if (e.code === 3193) {
                                        retVal = false;
                                    }
                                });
                            }
                            break;
                        }
                        // 429 Too Many Requests - The user has sent too many requests in a given amount of time ("rate limiting").
                        case 429:
                        // 500 Internal Server Error - The server has encountered a situation it doesn't know how to handle.
                        case 500:
                        // 502 Bad Gateway - The server is working as a gateway and got an invalid response needed to handle the request.
                        case 502:
                        // 503 Service Unavailable - The server is not ready to handle the request. It could be down for maintenance or just overloaded.
                        case 503:
                        // 504 Gateway Timeout - The server is acting as a gateway and cannot get a response in time.
                        case 504: {
                            retVal = true;
                            break;
                        }
                        default: {
                            // Look for any other status codes that should be retried for this service.
                            const otherCodes = options.getRelevantOption(context, opts, "retryStatusCodes", serviceName);
                            retVal = otherCodes && (otherCodes.length > 0) && (otherCodes.indexOf(error.statusCode) !== -1);
                        }
                    }
                }

                // Add a log warning for the retry.
                if (retVal) {
                    utils.logWarnings(context, i18n.__("retry_failed_request", {id: requestOptions.instanceId, message: error.original_message || error.log}));
                }
            }

            return retVal;
        };

        /**
         * Determine how long to wait until the next retry attempt for the current request.
         *
         * @param {Error} err The error that occurred for the current request.
         * @param {Object} response The response received from the server.
         * @param {Object} body The response body received from the server.
         *
         * @returns {Number} The number of milliseconds to wait until the next retry attempt for the current request.
         */
        const delayStrategy = function (err, response, body) {
            // The delay is set to the minimum timeout by default.
            let delay = minTimeout;

            // If the delay is being randomized, multiply by a random factor between 1 and 2.
            if (randomize === true) {
                const randomnessFactor = 1.0 + Math.random();
                delay = randomnessFactor * delay;
            }

            // Use an exponential backoff strategy if a factor has been defined
            // Fallback to calculating delay based on 1 attempt if no response provided due to socket error
            const attempt = response ? response.attempts : ((err && err.attempts) ? err.attempts : 1);
            if (factor !== 0) {
                const backoffFactor = Math.pow(factor, attempt - 1);
                delay = backoffFactor * delay;
            }

            // Make sure the delay is not longer than the maximum timeout.
            delay = Math.min(delay, maxTimeout);

            // Add a debug entry to the log for the delay that was calculated.
            utils.logDebugInfo(context, i18n.__("retry_next_attempt", {id: requestOptions.instanceId, attempt: attempt, delay: delay}));

            return delay;
        };

        // Add the necessary retry options.
        requestOptions.maxAttempts = maxAttempts;
        requestOptions.retryStrategy = retryStrategy;
        requestOptions.delayStrategy = delayStrategy;

        // Add a somewhat unique ID (between 0 and 1000000) so that log entries can be correlated.
        requestOptions.instanceId = Math.floor(Math.random() * 1000001);

        return requestOptions;
    }

    static logRetryInfo (context, requestOptions, attempts, err) {
        if (err) {
            // The request failed, check to see if there were any retries.
            if (attempts >= requestOptions.maxAttempts) {
                // Add a log entry if the request failed after the maximum number of retries.
                utils.logInfo(context, i18n.__("retry_max_attempts", {id: requestOptions.instanceId}));
            } else if (attempts > 1) {
                // Add a log entry if the request failed after less than the maximum number of retries.
                utils.logInfo(context, i18n.__("retry_failed_retry", {
                    id: requestOptions.instanceId,
                    attempt: attempts,
                    message: err.message
                }));
            }
        } else {
            // The request succeeded, check to see if there were any retries.
            if (attempts > 1) {
                // Add a log entry if the request suceeded after retry.
                utils.logInfo(context, i18n.__("retry_success", {id: requestOptions.instanceId, attempt: attempts}));
            }
        }
    }

    _getRequestOptions (context, headers, opts) {
        const restObject = this;
        const deferred = Q.defer();

        this.getRequestURI(context, opts)
            .then(function (uri) {
                // Resolve the promise with the standard request options and the retry options.
                const requestOptions = {
                    uri: uri + restObject.getUriPath(),
                    json: true,
                    headers: headers
                };
                deferred.resolve(restObject.addRetryOptions(context, requestOptions, opts));
            })
            .catch(function (err) {
                deferred.reject(err);
            });
        return deferred.promise;
    }

    getRequestOptions (context, opts) {
        const headers = BaseREST.getHeaders(context, opts);
        return this._getRequestOptions(context, headers, opts);
    }

    getUpdateRequestOptions (context, opts) {
        const headers = BaseREST.getUpdateHeaders(context, opts);
        return this._getRequestOptions(context, headers, opts);
    }

    supportsByModified () {
        return this._modifiedUriSuffix !== undefined;
    }

    getModifiedItems (context, lastPullTimestamp, opts) {
        if (this.supportsByModified()) {
            const params = {};
            if (lastPullTimestamp) {
                params.start = lastPullTimestamp;
            }
            return this._getItems(context, this._modifiedUriSuffix, params, opts);
        } else {
            return this.getItems(context, opts);
        }
    }

    /**
     *
     * @param context
     * @param opts
     * @returns {Q.Promise}
     */
    getItems (context, opts) {
        return this._getItems(context, this._allUriSuffix, undefined, opts);
    }

    _getItems (context, uriSuffix, queryParams, opts) {
        const restObject = this;
        const deferred = Q.defer();
        const offset = options.getRelevantOption(context, opts, "offset", this.getServiceName());
        const limit = options.getRelevantOption(context, opts, "limit", this.getServiceName());
        this.getRequestOptions(context, opts)
            .then(function (requestOptions) {
                requestOptions.uri = requestOptions.uri + (uriSuffix || "") + "?offset=" + offset + "&limit=" + limit;
                if (queryParams) {
                    Object.keys(queryParams).forEach(function (key) {
                        requestOptions.uri = requestOptions.uri + "&" + key + "=" + queryParams[key];
                    });
                }
                request.get(requestOptions, function (err, res, body) {
                    const response = res || {};
                    if (err || response.statusCode !== 200) {
                        err = utils.getError(err, body, response, requestOptions);
                        BaseREST.logRetryInfo(context, requestOptions, response.attempts, err);
                        utils.logErrors(context, i18n.__("get_items_error", {service_name: restObject.getServiceName()}), err);
                        deferred.reject(err);
                    } else if (body && body.items) {
                        BaseREST.logRetryInfo(context, requestOptions, response.attempts);
                        deferred.resolve(body.items);
                    } else {
                        BaseREST.logRetryInfo(context, requestOptions, response.attempts);
                        deferred.resolve(body);
                    }
                });
            })
            .catch(function (err) {
                deferred.reject(err);
            });

        return deferred.promise;
    }

    getItem (context, id, opts) {
        const restObject = this;
        const deferred = Q.defer();
        this.getRequestOptions(context, opts)
            .then(function (requestOptions) {
                requestOptions.uri = requestOptions.uri + "/" + id;
                request.get(requestOptions, function (err, res, body) {
                    const response = res || {};
                    if (err || response.statusCode !== 200) {
                        err = utils.getError(err, body, response, requestOptions);
                        BaseREST.logRetryInfo(context, requestOptions, response.attempts, err);

                        // special case where we ar just seeing if the item does exisit and if not it's not an error
                        if (!opts || opts.noErrorLog !== "true") {
                            utils.logErrors(context, i18n.__("get_item_error", {service_name: restObject.getServiceName()}), err);
                        }
                        deferred.reject(err);
                    } else {
                        BaseREST.logRetryInfo(context, requestOptions, response.attempts);
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

    /*
     * Return the item by-path query param (default == path)
     */
    getItemByPathQueryParameterName() {
        return "path";
    }

    /*
     * Ask the authoring API to return the specified artifact by path
     */
    getItemByPath (context, path, opts) {
        const deferred = Q.defer();
        const serviceName = this.getServiceName();
        const self = this;
        if (this.supportsItemByPath()) {
            this.getRequestOptions(context, opts)
                .then(function (requestOptions) {
                    requestOptions.uri = requestOptions.uri + "/by-path?" + self.getItemByPathQueryParameterName() + "=" + path + "&include=" + self.getItemByPathQueryParameterName();
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

    /*
     * Determine whether push operations should default to creating a new item instead of updating an existing item.
     *
     * @param {Object} context The API context to be used for the current request.
     * @param {Object} opts The override options specified for the current request.
     *
     * @returns {Boolean} A return value of true indicates that push operations should default to creating a new item.
     *          A return value of false indicates that push operations should default to updating an existing item.
     *
     * @protected
     */
    isCreateOnlyMode (context, opts) {
        return options.getRelevantOption(context, opts, "createOnly") === true;
    }

    /*
     * Does this WCH REST API currently support the forceOverride query param?
     */
    supportsForceOverride () {
        return false;
    }

    /*
     * Overrideable method for delete URI for the REST object
     * @param {string} uri
     * @return {string} uri, optionally modified, with query parameters
     */
    getDeleteUri( uri, opts ) {
        return uri;
    }

    /**
     * Delete the given item.
     *
     * @param {Object} context - The API context to be used for the delete operation.
     * @param {Object} item The item to be deleted.
     * @param {Object} [opts] The options to be used for the delete operation.
     *
     * @return {Q.Promise} A promise to delete the given item.
     */
    deleteItem (context, item, opts) {
        const restObject = this;
        const deferred = Q.defer();
        this.getRequestOptions(context, opts)
            .then(function (requestOptions) {
                requestOptions.uri = restObject.getDeleteUri(requestOptions.uri + "/" + item.id, opts);
                utils.logDebugInfo(context, 'delete item:' + restObject.getServiceName(), undefined, requestOptions);

                // del ==> delete
                request.del(requestOptions, function (err, res, body) {
                    const response = res || {};
                    if (err || response.statusCode < 200 || response.statusCode > 299) {
                        err = utils.getError(err, body, response, requestOptions);
                        BaseREST.logRetryInfo(context, requestOptions, response.attempts, err);

                        // Check to see if this operation should be retried.
                        if (context.filterRetryDelete && context.filterRetryDelete(context, err)) {
                            // The operation will be retried, so do not log the error yet.
                            err.retry = true;
                        } else {
                            // The operation will not be retried, so log the error.
                            utils.logErrors(context, i18n.__("delete_item_error", {service_name: restObject.getServiceName()}), err);
                        }
                        deferred.reject(err);
                    } else {
                        BaseREST.logRetryInfo(context, requestOptions, response.attempts);
                        if (response.statusCode === 204 && (!body)) {
                            body = i18n.__("deleted_item", {id: item.id});
                        }
                        response["body"] = body;
                        utils.logDebugInfo(context, 'delete ' + restObject.getServiceName(), response);
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
