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

const BaseREST = require("./BaseREST.js");
const Q = require("q");
const utils = require("./utils/utils.js");
const options = require("./utils/options.js");
const request = utils.getRequestWrapper();
const i18n = utils.getI18N(__dirname, ".json", "en");

const singleton = Symbol();
const singletonEnforcer = Symbol();

class PublishingNextSchedulesREST extends BaseREST {

    constructor(enforcer) {
        if (enforcer !== singletonEnforcer) {
            throw i18n.__("singleton_construct_error", {classname: "PublishingNextSchedulesREST"});
        }
        super("publishingNextSchedules", "/publishing/v1/nextSchedule", undefined, undefined);
    }

    static get instance() {
        if (!this[singleton]) {
            this[singleton] = new PublishingNextSchedulesREST(singletonEnforcer);
        }
        return this[singleton];
    }

    /*
     * Return next schedules (if any) as array of JSON
     */
    getNextSchedules(context, opts) {
        const restObject = this;
        const deferred = Q.defer();
        this.getRequestOptions(context, opts)
            .then(function (requestOptions) {
                const tenantId = options.getRelevantOption(context, opts, "x-ibm-dx-tenant-id");
                requestOptions.uri = requestOptions.uri + "?deliveryDomainId=default&classification=tenant&docId=" + tenantId;
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

}

module.exports = PublishingNextSchedulesREST;
