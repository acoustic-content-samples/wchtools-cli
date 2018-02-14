/*
Copyright IBM Corporation 2017

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
const options = require("./utils/options.js");
const i18n = utils.getI18N(__dirname, ".json", "en");

class JSONItemREST extends BaseREST {
    constructor (serviceName, uriPath, allUriSuffix, modifiedUriSuffix) {
        super(serviceName, uriPath, allUriSuffix, modifiedUriSuffix);
    }

    createItem (context, item, opts) {
        const restObject = this;
        const deferred = Q.defer();
        this.getUpdateRequestOptions(context, opts)
            .then(function (requestOptions) {
                const saveRev = item.rev;
                delete item.rev;
                requestOptions.body = item;
                utils.logDebugInfo(context, "Creating item with request options: ", undefined, requestOptions);
                request.post(requestOptions, function (err, res, body) {
                    const response = res || {};
                    const createOnly = restObject.isCreateOnlyMode(context, opts);
                    if (createOnly && response.statusCode === 409) {
                        // A 409 Conflict error means the item already exists. So for createOnly, consider the create of
                        // the item to be successful, otherwise handle the error in the normal way.
                        BaseREST.logRetryInfo(context, requestOptions, response.attempts);
                        utils.logDebugInfo(context, "Create Only - item already exists: " + JSON.stringify(body));
                        if (saveRev) {
                            item.rev = saveRev;  // Put the rev back so saved file will be same as starting file
                        }
                        deferred.resolve(item);
                    } else if (err || response.statusCode < 200 || response.statusCode > 299) {
                        err = utils.getError(err, body, response, requestOptions);
                        BaseREST.logRetryInfo(context, requestOptions, response.attempts, err);

                        // Check to see if this operation should be retried.
                        if (context.filterRetryPush && context.filterRetryPush(context, err)) {
                            // The operation will be retried, so do not log the error yet.
                            err.retry = true;
                        } else {
                            // The operation will not be retried, so log the error.
                            utils.logErrors(context, i18n.__("create_item_error", {service_name: restObject.getServiceName()}), err);
                        }
                        deferred.reject(err);
                    } else {
                        BaseREST.logRetryInfo(context, requestOptions, response.attempts);
                        utils.logDebugInfo(context, 'create item:' + restObject.getServiceName(), response);
                        deferred.resolve(body);
                    }
                });
            })
            .catch(function (err) {
                deferred.reject(err);
            });
        return deferred.promise;
    }

    updateItem (context, item, opts) {
        const deferred = Q.defer();
        const restObject = this;
        this.getUpdateRequestOptions(context, opts)
            .then(function (requestOptions) {
                requestOptions.uri = requestOptions.uri + "/" + item.id;
                if (restObject.supportsForceOverride() && options.getRelevantOption(context, opts, "force-override")) {
                    requestOptions.uri += "?forceOverride=true";
                }
                requestOptions.body = item;

                // Determine whether to force the item to be created instead of updated.
                const createOnly = restObject.isCreateOnlyMode(context, opts);
                if (createOnly) {
                    restObject.createItem(context, item, opts)
                        .then(function (item) {
                            deferred.resolve(item);
                        })
                        .catch(function (err) {
                            deferred.reject(err);
                        });
                } else {
                    utils.logDebugInfo(context, "Updating item with request options: ",undefined, requestOptions);
                    request.put(requestOptions, function (err, res, body) {
                        const response = res || {};
                        if (response.statusCode === 404) {
                            // The update failed because the item was not found, so create the item instead.
                            restObject.createItem(context, item, opts)
                                .then(function (item) {
                                    deferred.resolve(item);
                                })
                                .catch(function (err) {
                                    deferred.reject(err);
                                });
                        } else if ((err) || response.statusCode < 200 || response.statusCode > 299) {
                            err = utils.getError(err, body, response, requestOptions);
                            BaseREST.logRetryInfo(context, requestOptions, response.attempts, err);

                            // Check to see if this operation should be retried.
                            if (context.filterRetryPush && context.filterRetryPush(context, err)) {
                                // The operation will be retried, so do not log the error yet.
                                err.retry = true;
                            } else {
                                // The operation will not be retried, so log the error.
                                utils.logErrors(context, i18n.__("update_item_error", {service_name: restObject.getServiceName()}), err);
                            }
                            deferred.reject(err);
                        } else {
                            BaseREST.logRetryInfo(context, requestOptions, response.attempts);
                            utils.logDebugInfo(context, 'update item:' + restObject.getServiceName(),  response);
                            if (body) {
                                deferred.resolve(body);
                            } else {
                                deferred.resolve(item);
                            }
                        }
                    });
                }
            })
            .catch(function (err) {
                deferred.reject(err);
            });
        return deferred.promise;
    }
}

module.exports = JSONItemREST;
