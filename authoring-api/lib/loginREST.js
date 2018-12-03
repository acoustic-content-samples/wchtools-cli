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

const BaseREST = require("./BaseREST.js");

// Require the modules used by this component.
const Q = require("q");
const options = require("./utils/options.js");
const utils = require("./utils/utils.js");

// Get the utility modules used by this component.
const request = utils.getRequestWrapper();
const i18n = utils.getI18N(__dirname + "/nls", ".json", "en");

// Define the symbols used by the singleton logic.
const singleton = Symbol();
const singletonEnforcer = Symbol();

// FUTURE Need to work on this abstraction. LoginREST extends BaseREST so that it can leverage the addRetryOptions()
// FUTURE method. It does not need the rest of the inherited methods. A lower-level common base class may be preferable.
class LoginREST extends BaseREST {
    /**
     * Constructor. Create a LoginREST object.
     *
     * @param {Symbol} enforcer - A symbol that must match the pre-defined symbol.
     */
    constructor (enforcer) {
        if (enforcer !== singletonEnforcer) {
            throw i18n.__("singleton_construct_error", {classname: "LoginREST"});
        }

        super("login", "/login/v1/basicauth", undefined, undefined);
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
     * @param {Object} context The current API context.
     * @param {Object} opts - Optional API settings.
     *
     * @returns {Object} The request headers to be used for logging in.
     */
    static getHeaders (context, opts) {
        const hdrs = {
            "Connection": "keep-alive",
            "User-Agent": utils.getUserAgent()
        };

        // Allow for explicit tenant id defined by an environment variable.
        if (process.env.TENANT_ID) {
            hdrs["x-ibm-dx-tenant-id"] = process.env.TENANT_ID;
        } else {
            const id = options.getRelevantOption(context, opts, "x-ibm-dx-tenant-id");
            if (id) {
                hdrs["x-ibm-dx-tenant-id"] = id;
            }
        }
        return hdrs;
    }

    /**
     * Get the request options to be used for logging in.
     *
     * @param {Object} context The current API context.
     * @param {Object} opts - Optional API settings.
     *
     * @returns {Object} The request options to be used for logging in.
     */
    getRequestOptions (context, opts) {
        const baseUrl = options.getRelevantOption(context, opts, "x-ibm-dx-tenant-base-url");

        // FUTURE We expect x-ibm-dx-tenant-base-url should exist before getting here. If not, the error from
        // FUTURE the login request is "Invalid URI null/login/v1/basicauth". This isn't very useful. It would be more
        // FUTURE useful to throw an Error from here and catch it before login. Or at least add an error to the log.

        // Resolve the promise with the standard request options and the retry options.
        const requestOptions = {
            uri: this._appendURI(baseUrl, this.getUriPath(context, opts)),
            headers: LoginREST.getHeaders(context, opts),
            auth: {
                "user": opts.username,
                "pass": opts.password,
                "sendImmediately": true
            },
            followRedirect: false
        };

        return this.addRetryOptions(context, requestOptions, opts);
    }

    /**
     * Login using the specified options.
     *
     * @param {Object} context The current API context.
     * @param {Object} opts - Optional API settings.
     *
     * @returns {Q.Promise} A promise to be fulfilled with the name of the logged in user.
     */
    login (context, opts) {
        const deferred = Q.defer();
        const requestOptions = this.getRequestOptions(context, opts);
        const result = {"username": opts.username};
        request.get(requestOptions, function (err, res, body) {
            const response = res || {};
            if (err || (response.statusCode !== 200 && response.statusCode !== 302)) {
                // An error was returned, or at least an unexpected response code.
                if (!err && body && body.includes("FBTBLU101E")) {
                    err = new Error(body);
                } else {
                    err = utils.getError(err, body, response, requestOptions);
                }

                BaseREST.logRetryInfo(context, requestOptions, response.attempts, err);
                utils.logErrors(context, "LoginREST.login", err);
                deferred.reject(err);
            } else if (response.headers && response.headers["set-cookie"] && response.headers["x-ibm-dx-tenant-id"]) {
                // The login succeeded.
                BaseREST.logRetryInfo(context, requestOptions, response.attempts);

                const tenant = response.headers["x-ibm-dx-tenant-id"];
                const baseUrl = response.headers["x-ibm-dx-tenant-base-url"];
                const existingBaseUrl = options.getProperty(context, "x-ibm-dx-tenant-base-url");
                context.logger.debug("LoginREST.login: successful authentication to " + existingBaseUrl + " as " + opts.username);

                // Resolve the promise with the tenant and baseUrl values from the login response.
                result["x-ibm-dx-tenant-id"] = tenant;
                result["x-ibm-dx-tenant-base-url"] = existingBaseUrl || baseUrl;
                result["base-url-from-login-response"] = baseUrl;

                // Add the tenant tier if it's available.
                if (body) {
                    try {
                        // A login response originally contained items for each tenant the specified user had access to.
                        // The response array currently contains only the item for the specific tenant and user.
                        const bodyObject = JSON.parse(body);
                        if (Array.isArray(bodyObject) && bodyObject[0]) {
                            result["tier"] = bodyObject[0].tier;
                        }
                    } catch (err) {
                        // Ignore
                    }
                }

                // Keep track of the returned values, but do not overwrite an existing base URL.
                const loginResults = {"x-ibm-dx-tenant-id": tenant};
                if (!existingBaseUrl) {
                    loginResults["x-ibm-dx-tenant-base-url"] = baseUrl;
                }
                if (result["tier"]) {
                    loginResults["tier"] = result["tier"];
                }
                context.logger.debug("LoginREST.login: Setting tenant options based on login response: " + JSON.stringify(loginResults));
                context.logger.debug("LoginREST.login: cookie " + response.headers["set-cookie"]);
                options.setOptions(context, loginResults);
                deferred.resolve(result);

                // Determine the interval to be used for the relogin timer.
                let interval = options.getRelevantOption(context, opts, "reloginInterval");
                if (typeof interval !== "number") {
                    interval = (11 * 60 + 45) * 60 * 1000;
                }
                context.logger.debug("LoginREST.login: Setting relogin timer to " + interval + "ms.");

                // Create a timer to relogin before the login token expires.
                context.reloginTimer = setInterval(function () {
                    context.logger.debug("LoginREST.login: attempting to relogin");
                    request.get(requestOptions, function (err, res, body) {
                        const response = res || {};
                        if (err || (response.statusCode !== 200 && response.statusCode !== 302)) {
                            // The attempt to relogin failed.
                            context.logger.debug("LoginREST.login: attempt to relogin failed: " + err + " - " + body);
                        } else {
                            // Assume success.
                            context.logger.debug("LoginREST.login: relogin succeeded: " + JSON.stringify(response.headers["set-cookie"]) + " - " + body);
                        }
                    });
                }, interval);

                // Do not keep the event loop running if the timer is the only thing waiting.
                context.reloginTimer.unref();
            } else {
                BaseREST.logRetryInfo(context, requestOptions, res.attempts);

                // The login did not return the expected authentication token or tenant id.
                err = utils.getError(err, body, res, requestOptions);

                // Log the actual error that was returned from the service.
                const message = i18n.__("login_missing_authn");
                utils.logErrors(context, message, err);

                // Reject the promise.
                deferred.reject(new Error(message));
            }
        });

        return deferred.promise;
    }
}

// Export the class definition.
module.exports = LoginREST;
