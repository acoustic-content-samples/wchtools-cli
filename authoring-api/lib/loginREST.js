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

// Require the modules used by this component.
const Q = require("q");
const options = require("./utils/options.js");
const utils = require("./utils/utils.js");

// Get the utility modules used by this component.
const request = utils.getRequestWrapper();
const logger = utils.getLogger(utils.apisLog);
const i18n = utils.getI18N(__dirname + "/nls", ".json", "en");

// Define the symbols used by the singleton logic.
const singleton = Symbol();
const singletonEnforcer = Symbol();

const uriPath = "/login/v1/basicauth";

// Local function to determine whether to reject on login error.
const rejectOnError = function () {
    // The default behavior ist to reject the login promise on login error.
    let retVal = true;

    // Reject by default but allow for success on login error, for testing purposes.
    if (process.env.LOGIN_REJECT_ON_ERROR === "false") {
        retVal = false;
    }

    return retVal;
};

class LoginREST {
    /**
     * Constructor. Create a LoginREST object.
     *
     * @param {Symbol} enforcer - A symbol that must match the pre-defined symbol.
     */
    constructor (enforcer) {
        if (enforcer !== singletonEnforcer) {
            throw i18n.__("singleton_construct_error", {classname: "LoginREST"});
        }

        this._serviceName = "login";
        this._tenant_id = process.env.TENANT_ID;  // Allow explicit tenant id for testing
    }

    /**
     * Get the singleton instance for this class.
     *
     * @returns {LoginREST} The singleton instance for this class.
     */
    static get instance () {
        if (!this[singleton]) {
            this[singleton] = new LoginREST(singletonEnforcer);
        }
        return this[singleton];
    }

    /**
     * Get the request headers to be used for logging in.
     *
     * @param {Object} opts - Optional API settings.
     *
     * @returns {Object} The request headers to be used for logging in.
     */
    _getHeaders (opts) {
        const hdrs = {
            "Connection": "keep-alive"
        };
        // Allow for explicit tenant id set in dynamic or persistent config options
        if (!this._tenant_id)
            this._tenant_id = options.getRelevantOption(opts, "x-ibm-dx-tenant-id");
        if (this._tenant_id) {
            hdrs["x-ibm-dx-tenant-id"] = this._tenant_id;
        }
        return hdrs;
    }

    /**
     * Get the request options to be used for logging in.
     *
     * @param {Object} opts - Optional API settings.
     *
     * @returns {Object} The request options to be used for logging in.
     */
    _getRequestOptions (opts) {
        const baseUrl = options.getRelevantOption(opts, "x-ibm-dx-tenant-base-url");
        const api_gateway = options.getRelevantOption(opts, "dx-api-gateway");

        // FUTURE We expect at least one of these should exist before getting here. If neither exists, the error from
        // FUTURE the login request is "Invalid URI null/login/v1/basicauth". This isn't very useful. It would be more
        // FUTURE useful to throw an Error from here and catch it before login. Or at least add an error to the log.

        return {
            uri: (baseUrl || api_gateway) + uriPath,
            headers: this._getHeaders(opts),
            auth: {
                "user": opts.username,
                "pass": opts.password,
                "sendImmediately": true
            },
            followRedirect: false
        };
    }

    /**
     * Login using the specified options.
     *
     * @param {Object} opts - Optional API settings.
     *
     * @returns {Q.Promise} A promise to be fulfilled with the name of the logged in user.
     */
    login (opts) {
        const deferred = Q.defer();
        const requestOptions = this._getRequestOptions(opts);
        const response = { "username": opts.username };
        request.get(requestOptions, function (err, res, body) {
            if (err || (res && (res.statusCode !== 200) && (res.statusCode !== 302))) {
                // An error was returned, or at least an unexpected response code.
                if (!err && body && body.includes("FBTBLU101E")) {
                    err = new Error(body);
                } else {
                    requestOptions.auth.pass='****';
                    err = utils.getError(err, body, res, requestOptions);
                }
                utils.logErrors("LoginREST.login.error", err);
                if (rejectOnError()) {
                    deferred.reject(err);
                } else {
                    deferred.resolve(response);
                }
            } else if (res.headers && res.headers["set-cookie"] && res.headers["x-ibm-dx-tenant-id"]) {
                // The login succeeded.
                const tenant = res.headers["x-ibm-dx-tenant-id"];
                const baseUrl = res.headers["x-ibm-dx-tenant-base-url"];
                if (tenant || baseUrl) {
                    const existingBaseUrl = options.getProperty("x-ibm-dx-tenant-base-url");

                    // Resolve the promise with the tenant and baseUrl values from the login response.
                    response["x-ibm-dx-tenant-id"] = tenant;
                    response["x-ibm-dx-tenant-base-url"] = existingBaseUrl || baseUrl;
                    response["base-url-from-login-response"] = baseUrl;

                    // Keep track of the returned values, but do not overwrite an existing base URL.
                    const opt = {};
                    opt["x-ibm-dx-tenant-id"] = tenant;
                    if (!existingBaseUrl) {
                        opt["x-ibm-dx-tenant-base-url"] = baseUrl;
                    }
                    logger.debug("LoginREST.login.resolve: Setting runtime user option for tenant based on login response: " + JSON.stringify(opt));
                    options.setOptions(opt);
                }
                logger.debug("LoginREST.login.resolve: cookie" + res.headers["set-cookie"]);
                deferred.resolve(response);
            } else {
                // The login did not return the expected authentication token or tenant id.
                requestOptions.auth.pass='****';
                err = utils.getError(err, body, res, requestOptions);

                // Log the actual error that was returned from the service.
                const message = i18n.__("login_missing_authn");
                utils.logErrors(message, err);

                // Reject the promise, if allowed.
                if (rejectOnError()) {
                    deferred.reject(new Error(message));
                } else {
                    deferred.resolve(response);
                }
            }
        });

        return deferred.promise;
    }

    /**
     * Remove any local values that may have been set previously.
     */
    reset () {
        this._tenant_id = process.env.TENANT_ID;
    }
}

// Export the class definition.
module.exports = LoginREST;
