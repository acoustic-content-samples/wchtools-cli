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

const singleton = Symbol();
const singletonEnforcer = Symbol();

class EdgeConfigREST extends BaseREST {

    constructor(enforcer) {
        if (enforcer !== singletonEnforcer) {
            throw i18n.__("singleton_construct_error", {classname: "EdgeConfigREST"});
        }
        super("edgeconfig", "/publishing/v1/edge/cache/invalidate", undefined, undefined);
    }

    static get instance() {
        if (!this[singleton]) {
            this[singleton] = new EdgeConfigREST(singletonEnforcer);
        }
        return this[singleton];
    }

    clearCache(context, opts) {
        const restObject = this;
        const deferred = Q.defer();
        this.getRequestOptions(context, opts)
            .then(function (requestOptions) {
                utils.logDebugInfo(context, "Clearing cache with request options: ", undefined, requestOptions);
                request.post(requestOptions, function (err, res, body) {
                    const response = res || {};
                    if (err || response.statusCode < 200 || response.statusCode > 299) {
                        err = utils.getError(err, body, response, requestOptions);
                        BaseREST.logRetryInfo(context, requestOptions, response.attempts, err);
                        // log the error.
                        utils.logErrors(context, restObject.getServiceName(), err);
                        deferred.reject(err);
                    } else {
                        BaseREST.logRetryInfo(context, requestOptions, response.attempts);
                        utils.logDebugInfo(context, "Cache clear: " + restObject.getServiceName(), response);
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

module.exports = EdgeConfigREST;
