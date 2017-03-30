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

const Q = require("q");
const BaseREST = require("./BaseREST.js");
const singleton = Symbol();
const singletonEnforcer = Symbol();
const utils = require("./utils/utils.js");
const request = utils.getRequestWrapper();

const i18n = utils.getI18N(__dirname, ".json", "en");

class PublishingJobsREST extends BaseREST {

    constructor(enforcer) {
        if (enforcer !== singletonEnforcer)
            throw i18n.__("singleton_construct_error", {classname: "PublishingJobsREST"});

        super("publishing", "/publishing/v1/jobs", undefined, undefined);
    }

    static get instance() {
        if (!this[singleton]) {
            this[singleton] = new PublishingJobsREST(singletonEnforcer);
        }
        return this[singleton];
    }

    createPublishingJob(jobParameters, opts) {
        return this.createItem(jobParameters, opts);
    }

    getPublishingJobs(opts) {
        return this.getItems(opts);
    }

    getPublishingJob(id, opts) {
        return this.getItem(id, opts);
    }

    getPublishingJobStatus (id, opts) {
        const restObject = this;
        const deferred = Q.defer();
        this.getRequestOptions(opts)
            .then(function (requestOptions) {
                requestOptions.uri = requestOptions.uri + "/" + id + "/status";
                request.get(requestOptions, function (err, res, body) {
                    if ((err) || (res && res.statusCode != 200)) { //NOSONAR
                        err = utils.getError(err, body, res, requestOptions);
                        // special case where we ar just seeing if the item does exist and if not it's not an error
                        if(!opts || opts.noErrorLog !== "true")
                            utils.logErrors(i18n.__("getPublishingJobStatus_error", {service_name: restObject.getServiceName()}), err);
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

    deletePublishingJob(id, opts) {
        return this.deleteItem({"id": id}, opts);
    }

    cancelPublishingJob(id, opts) {
        const deferred = Q.defer();
        const restObject = this;
        this.getRequestOptions(opts).then(function(requestOptions) {
            requestOptions.uri = requestOptions.uri + "/" + id + "/cancel";
            utils.logDebugInfo('Canceling publishing job ' + restObject.getServiceName(),undefined,requestOptions);
            request.put(requestOptions, function(err, res, body) {
                if ((err) || (res && (res.statusCode < 200 || res.statusCode > 299))) {
                    err = utils.getError(err, body, res, requestOptions);
                    utils.logErrors(i18n.__("error_cancelling_job" , {id: id}), err);
                    deferred.reject(err);
                } else {
                    utils.logDebugInfo('Canceling publishing job ' + restObject.getServiceName(),  res);
                    deferred.resolve(body);
                }
            });
        },function (err){
            deferred.reject(err);
        });
        return deferred.promise;
    }

}

module.exports = PublishingJobsREST;
