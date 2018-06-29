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
const JSONItemREST = require("./JSONItemREST.js");
const Q = require("q");
const utils = require("./utils/utils.js");
const request = utils.getRequestWrapper();
const i18n = utils.getI18N(__dirname, ".json", "en");

const singleton = Symbol();
const singletonEnforcer = Symbol();

class PublishingJobsREST extends JSONItemREST {

    constructor(enforcer) {
        if (enforcer !== singletonEnforcer) {
            throw i18n.__("singleton_construct_error", {classname: "PublishingJobsREST"});
        }
        super("publishing", "/publishing/v1/jobs", undefined, undefined);
    }

    static get instance() {
        if (!this[singleton]) {
            this[singleton] = new PublishingJobsREST(singletonEnforcer);
        }
        return this[singleton];
    }

    createPublishingJob(context, jobParameters, opts) {
        return this.createItem(context, jobParameters, opts);
    }

    getPublishingJobs(context, opts) {
        return this.getItems(context, opts);
    }

    getPublishingJob(context, id, opts) {
        return this.getItem(context, id, opts);
    }

    getPublishingJobStatus (context, id, opts) {
        const restObject = this;
        const deferred = Q.defer();
        this.getRequestOptions(context, opts)
            .then(function (requestOptions) {
                requestOptions.uri = requestOptions.uri + "/" + id + "/status";
                request.get(requestOptions, function (err, res, body) {
                    const response = res || {};
                    if (err || response.statusCode !== 200) { //NOSONAR
                        err = utils.getError(err, body, response, requestOptions);
                        BaseREST.logRetryInfo(context, requestOptions, response.attempts, err);

                        // special case where we ar just seeing if the item does exist and if not it's not an error
                        if(!opts || opts.noErrorLog !== "true")
                            utils.logErrors(context, i18n.__("getPublishingJobStatus_error", {service_name: restObject.getServiceName()}), err);
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

    deletePublishingJob (context, id, opts) {
        return this.deleteItem(context, {"id": id}, opts);
    }

    cancelPublishingJob (context, id, opts) {
        const deferred = Q.defer();
        const restObject = this;
        this.getUpdateRequestOptions(context, opts)
            .then(function(requestOptions) {
                requestOptions.uri = requestOptions.uri + "/" + id + "/cancel";
                utils.logDebugInfo(context, 'Canceling publishing job ' + restObject.getServiceName(),undefined,requestOptions);
                request.put(requestOptions, function (err, res, body) {
                    const response = res || {};
                    if (err || response.statusCode < 200 || response.statusCode > 299) {
                        err = utils.getError(err, body, response, requestOptions);
                        BaseREST.logRetryInfo(context, requestOptions, response.attempts, err);
                        utils.logErrors(context, i18n.__("error_cancelling_job" , {id: id}), err);
                        deferred.reject(err);
                    } else {
                        BaseREST.logRetryInfo(context, requestOptions, response.attempts);
                        utils.logDebugInfo(context, 'Canceling publishing job ' + restObject.getServiceName(), response);
                        deferred.resolve(body);
                    }
                });
            })
            .catch(function (err){
                deferred.reject(err);
            });

        return deferred.promise;
    }
}

module.exports = PublishingJobsREST;
