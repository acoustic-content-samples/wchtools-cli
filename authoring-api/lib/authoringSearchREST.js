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

const Q = require("q");
const BaseREST = require("./BaseREST.js");
const singleton = Symbol();
const singletonEnforcer = Symbol();
const utils = require("./utils/utils.js");
const options = require("./utils/options.js");
const request = utils.getRequestWrapper();
const querystring = require("querystring");

const i18n = utils.getI18N(__dirname, ".json", "en");

class AuthoringSearchREST extends BaseREST {

    constructor (enforcer) {
        if (enforcer !== singletonEnforcer) {
            throw i18n.__("singleton_construct_error", {classname: "AuthoringSearchREST"});
        }
        super("authoring-search", "/authoring/v1/search", undefined, undefined);
    }

    static get instance () {
        if (!this[singleton]) {
            this[singleton] = new AuthoringSearchREST(singletonEnforcer);
        }
        return this[singleton];
    }

    /**
     * Execute the specified search query
     *
     * @param {Object} context The API context to be used by the search operation.
     * @param {Object} searchQuery - valid authoring search query with pre-encoded query param values
     * @param {Object} [opts]
     *
     * @return {Q.Promise} A promise for the metadata of the matching assets.
     */
    searchQuery (context, searchQuery, opts) {
        const restObject = this;
        const deferred = Q.defer();
        this.getRequestOptions(context, opts)
            .then(function (requestOptions) {
                requestOptions.uri = requestOptions.uri + "?" + searchQuery;
                request.get(requestOptions, function (err, res, body) {
                    const response = res || {};
                    if (err || response.statusCode !== 200) {
                        err = utils.getError(err, body, response, requestOptions);
                        BaseREST.logRetryInfo(context, requestOptions, response.attempts, err);
                        utils.logErrors(context, i18n.__("authoring_search_error", {service_name: restObject.getServiceName()}), err);
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

    /**
     * Execute the specified search, using the search parameters passed in the parameters object.
     * @param {Object} parameters - search parameters
     * The parameters object can contain the following members:
     *   q: string
     *   qf: string or array of strings
     *   fl: string or array of strings
     *   fq: string or array of strings
     *
     * @param {Object} context The API context to be used by the search operation.
     * @param {Object} [opts]
     *
     * @return {Q.Promise} A promise for the metadata of the matching assets.
     */
    search (context, parameters, opts) {
        let searchQuery = "";
        if (parameters["q"]) {
            searchQuery += "q=" + parameters["q"];
        } else {
            throw new Error("query field 'q' is required");
        }
        let qfa = parameters["qf"];
        if (qfa && !Array.isArray(qfa)) {
            qfa = [qfa];
        }
        if (qfa && Array.isArray(qfa) && qfa.length > 0) {
            qfa.forEach(function (qf) {
                searchQuery += "&qf=" + qf;
            });
        }
        let fla = parameters["fl"];
        if (fla && !Array.isArray(fla)) {
            fla = [fla];
        }
        if (fla && Array.isArray(fla) && fla.length > 0) {
            fla.forEach(function (fl) {
                searchQuery += "&fl=" + fl;
            });
        }
        let fqa = parameters["fq"];
        if (fqa && !Array.isArray(fqa)) {
            fqa = [fqa];
        }
        if (fqa && Array.isArray(fqa) && fqa.length > 0) {
            fqa.forEach(function (fq) {
                // Prefix some special characters with a backslash so they are interpreted properly by search.
                fq = fq.replace(/[ "^~{}[\]()]/g, "\\$&");
                searchQuery += "&fq=" + querystring.escape(fq);
            });
        }

        const offset = options.getRelevantOption(context, opts, "offset", this.getServiceName()) || 0;
        searchQuery += "&start=" + offset;
        const limit = options.getRelevantOption(context, opts, "limit",  this.getServiceName());
        searchQuery += "&rows=" + limit;

        return this.searchQuery(context, searchQuery, opts);
    }
}

module.exports = AuthoringSearchREST;
