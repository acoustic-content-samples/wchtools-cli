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

const fs = require('fs');
const path = require('path');
const log4js = require('log4js');
const oslocale = require("os-locale");
const logLevel = process.env.WCHTOOLS_LOG_LEVEL || 'WARN';

const Q = require("q");
const async = require("async");

const ProductName = "IBM Watson Content Hub";
const ProductAbrev = "wchtools";
const ProductVersion = require("../../package.json").version;
const userAgent = ProductAbrev + "/" + ProductVersion;

const i18nModule = require("i18n-2");
const i18n = getI18N(__dirname, ".json", "en");
const vPath = new RegExp('[?<>*|"]');
const loggers = [];
let httplang;

// Enable the request module cookie jar so cookies can be shared across response, request with this request wrapper
const requestWrapper = require("requestretry").defaults({jar: true});

/**
 * Get the object that is used to localize strings.
 *
 * @param directory the directory that the search for the nls directory starts from, it looks up the tree for the nls directory
 * @param extension the extension of the file with localizations. Default to .json if not passed
 * @param defaultLocale the local to use as a default. en is used if not set
 *
 * @returns {Object}
 */
function getI18N (directory, extension, defaultLocale) {
    let dir = directory;
    while (dir && !fs.existsSync(dir + "/nls")) {
        const parent = path.dirname(dir);
        dir = (dir !== parent) ? parent : undefined;
    }

    if (dir) {
        dir = dir + "/nls";
        directory = dir;
    }

    extension = extension || ".json";
    defaultLocale = defaultLocale || "en";
    const locales = getLocales(directory, extension, defaultLocale);

    let defaultData;
    const i18n = new i18nModule({
        locales: locales,
        directory: directory,
        extension: extension,
        defaultLocale: defaultLocale,
        devMode: false,
        parse: function (data) {
            const localeData = JSON.parse(data);
            // the first locale to be parsed should be the default locale from the locales list in the config passed to i18n-2 above
            if (!defaultData) {
                defaultData = localeData;
            } else {
                // for subsequent locales, iterate the set of keys in the default locale and add missing messages
                Object.keys(defaultData).forEach(function (key) {
                    // if the locale doesn't contain a message that is in the default locale, add it here now
                    if (!localeData[key]) {
                        localeData[key] = defaultData[key];
                    }
                });
            }
            return localeData;
        }
    });

    // use os-locale to determine the locale
    let locale = oslocale.sync();
    if (locale && locales.indexOf(locale) === -1) {
        locale = locale.split('.')[0];
        if (locales.indexOf(locale) === -1) {
            locale = locale.split('_')[0];
            if (locales.indexOf(locale) === -1) {
                locale = defaultLocale;
            }
        }
    }
    i18n.setLocale(locale || defaultLocale);
    return i18n;
}

/**
 * Enumerates the set of nls resources contained in the specified directory and returns a list of supported locales.
 *
 * @param directory the directory to scan
 * @param extension the extension for nls resource files
 * @param defaultLocale the default locale
 *
 * @returns {Array} A list of supported locales.
 */
function getLocales (directory, extension, defaultLocale) {
    const files = fs.readdirSync(directory);
    const locales = files.map(function (file) {
        let locale;
        // filter out hidden files & only look at files with the desired extension
        if (!file.match(/^\./) && file.endsWith(extension)) {
            locale = file.substring(0, file.length - extension.length);
        }
        return locale;
    }).filter(function (locale) {
        // remove the default locale so we can add it to the beginning; also drop any undefined entries in the array
        return (locale !== defaultLocale) ? locale : undefined;
    });
    // add the default locale to the beginning of the array
    locales.unshift(defaultLocale);
    return locales;
}

/**
 * Returns the http header language string for the system.
 */
function getHTTPLanguage () {
    if (!httplang) {
        let locale = oslocale.sync();
        if (locale) {
            // replace all '_' chars with '-'
            locale = locale.replace(/_/g, '-');
        }
        httplang = locale;
    }
    return httplang;
}

/**
 * Determine whether the specified URL is valid for accessing the WCH API.
 *
 * @param url The URL to be validated.
 *
 * @returns {boolean} A value of true if the specified URL is valid, otherwise false.
 */
function isValidApiUrl(url) {
    let valid = false;
    if (url) {
        // Javascript does not natively support validation of URL syntax. It appears that URL validation is typically
        // accomplished using regular expression matching. Unfortunately, this can result in the occasional validation
        // mistake. There are regular expressions available for testing URLs to varying degrees of complexity. One of
        // the simpler ones I found is the following regular expression.
        //
        // "^https?://(www\\.)?([-a-z0-9]{1,63}\\.)*?[a-z0-9][-a-z0-9]{0,61}[a-z0-9]\\.[a-z]{2,6}(/[-\\w@\\+\\.~#\\?&/=%]*)?$"
        //
        // This tests for a "generic" (non-internationalized) URL with an "http" or "https" protocol. For now however,
        // we will use a simpler test, looking only for the "http" or "https" protocol, and the "/api" component.
        const uriRegExp = new RegExp("^https?://.+/api.*", "i");

        valid = uriRegExp.test(url);
    }
    return valid;
}

/**
 * uses a regexp to check a path to be valid
 * @param path path to be checked
 * @returns {boolean} true if path is invalid
 */
function isInvalidPath (path) {
    return vPath.test(path);
}

/**
 * Get the path of the API log file.
 *
 * @returns {String} The path of the API log file.
 */
function getApiLogPath () {
    return process.cwd() + '/' + ProductAbrev + '-api.log';
}

/**
 * Get the Error object based on the specified values. The returned Error object may contain the response, statusCode,
 * and log properties, which can be used to determine 1) how to respond to the error, and 2) what should be logged.
 *
 * @param {Error} err The error object, if available.
 * @param {Object} body The response body, used for errors returned from the WCH API.
 * @param {Object} response The reponse object, used for the status code and message.
 * @param {Object} requestOptions The initial request options, used for logging.
 *
 * @returns {Error} An error based on the given information.
 */
function getError (err, body, response, requestOptions) {
    try {
        const error = getBaseError(err, body, response);

        // Set error values based on the response.
        if (response && response.statusCode) {
            error.response = response;
            error.statusCode = response.statusCode;
            if (response.statusCode === 408) {
                error.message = i18n.__("service_unavailable") + i18n.__("please_try", {log_dir: getApiLogPath()});
            } else if (response.statusCode === 409) {
                error.message = i18n.__("conflict") + ' : ' + error.message;
            } else if (response.statusCode >= 500) {
                error.message = i18n.__("service_error") + i18n.__("please_try", {log_dir: getApiLogPath()});
            }
        }

        // The log entry will contain the error message.
        error.log = "Error Message: " + error.message;

        // The log entry will contain the request options if they exist.
        try {
            // Make sure the returned error never contains a user password.
            if (requestOptions && requestOptions.auth && requestOptions.auth.pass !== "****") {
                requestOptions = clone(requestOptions);
                requestOptions.auth.pass = "****";
            }

            error.log += " Request Options: " + JSON.stringify(requestOptions);
        } catch (e) {
            //do nothing
        }

        // The log entry will contain the response body if it exists.
        try {
            error.log += " Body: " + JSON.stringify(body);
        } catch (e) {
            //do nothing
        }

        // The log entry will contain the response if it exists.
        try {
            error.log += " Response: " + JSON.stringify(response);
        } catch (e) {
            //do nothing
        }

        return error;
    }
    catch (e) {
        return e;
    }
}

/**
 *  A helper function that finds the correct Error info from the inputs. First error found
 * @param err the error object if there was one
 * @param body the body of the response that is checked for error info
 * @param resp the response object is checked for status messages
 * @returns {Error} first error found
 */
function getBaseError (err, body, resp) {
    return getErrorFromErr(err) || getErrorFromBody(body) || getErrorFromResponse(resp) || new Error(i18n.__("unknown_error"));
}

/**
 * get the Error from the error object if there is one
 * @param error error object returned from the request
 * @returns {Error} an error if one is found
 */
function getErrorFromErr (error) {
    if (error && error.code && (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET')) {
        error.message = i18n.__("service_unavailable");
    }
    return error;
}

/**
 * get the Error from the body if there is one
 * @param body the body of the response from the request
 * @returns {Error} an error if one is found
 */
function getErrorFromBody (body) {
    let err;
    if (body) {
        if (typeof body === "string") {
            try {
                body = JSON.parse(body);
            }
            catch (e) {
                return new Error(body);
            }
        }
        if (body.moreInformation) {
            err = new Error(body.moreInformation);
        } else if (body.message) {
            err = new Error(body.message);
        } else if (body.error) {
            err = body.error;
        } else if (body.errors) {
            let messages = '';
            if (Array.isArray(body.errors)) {
                body.errors.forEach(function (error, index) {
                    messages += error.message;
                    if (index < body.errors.length - 1) {
                        // Add a separator if this is not the last error in the array.
                        messages += ' ; ';
                    }
                });
            } else {
                messages += (body.errors.message) ? body.errors.message : JSON.stringify(body.errors);
            }
            err = new Error(messages);
        }
    }
    return err;
}

/**
 *  get the Error from the response if there is one
 * @param response the response from the request
 * @returns {Error} an error if one is found
 */
function getErrorFromResponse (response) {
    let err;
    if (response && response.statusMessage && response.statusCode) {
        err = new Error(i18n.__("service_response_error", {code: response.statusCode, message: response.statusMessage}));
    }
    return err;
}

const apisLog = ProductAbrev + " " + ProductVersion;
let apisLogConfig;

// Only log to the console if we are running the tests on the jenkins server
const buildTag = process.env.BUILD_TAG;
if (buildTag && buildTag.indexOf('jenkins') !== -1) {
    apisLogConfig = {
        appenders: [
            {
                type: 'console',
                category: apisLog
            },
            {
                type: 'file',
                filename: getApiLogPath(),
                category: apisLog,
                maxLogSize: 500480,
                backups: 5
            }
        ],
        replaceConsole: false,
        levels: {
            "[all]": logLevel
        }
    };
} else {
    apisLogConfig = {
        appenders: [
            {
                type: 'file',
                filename: getApiLogPath(),
                category: apisLog,
                maxLogSize: 500480,
                backups: 5
            }
        ],
        replaceConsole: false,
        levels: {
            "[all]": logLevel
        }
    };
}

/**
 * Log the specified error and heading using the logger specified by the context.
 *
 * Note: The error object is marked as logged, so that it will only be logged once.
 *
 * @param {Object} context The current API context.
 * @param {String} heading The text used to describe the error.
 * @param {Error} error The error to be logged.
 */
function logErrors (context, heading, error) {
    try {
        if (error instanceof Error) {
            // Only log a given error once.
            if (!error.isLogged) {
                error.heading = heading;
                context.logger.error(heading + (error.log ? error.log : error.toString()));
                error.isLogged = true;
            }
        } else {
            // Not sure what this error is, so just log it as a string.
            context.logger.error(error.toString());
        }
    }
    catch (e) {
        // do nothing
    }
}

/**
 * Log the specified warning using the logger specified by the context.
 *
 * @param {Object} context The current API context.
 * @param {String} warning The warning to be logged.
 */
function logWarnings (context, warning) {
    try {
        context.logger.warn(warning);
    }
    catch (e) {
        // do nothing
    }
}

/**
 * Log the specified info using the logger specified by the context.
 *
 * @param {Object} context The current API context.
 * @param {String} info The information to be logged.
 */
function logInfo (context, info) {
    try {
        context.logger.info(info);
    } catch (e) {
        // do nothing
    }
}

/**
 * Log the specified debug info using the logger specified by the context.
 *
 * @param {Object} context The current API context.
 * @param info a sting of info you want logged as debug information
 * @param response an optional parameter if you want the response object logged for debug
 * @param requestOptions an optional parameter if you want the request object logged for debug
 */
function logDebugInfo (context, info, response, requestOptions) {
    try {
        if (context.logger.isLevelEnabled('DEBUG')) {
            if (requestOptions instanceof Object) {
                info += " Request Options: " + JSON.stringify(requestOptions);
            }
            if (response instanceof Object) {
                info += " Response: " + JSON.stringify(response);
            }
        }
    } catch (e) {
        // do nothing
    } finally {
        context.logger.debug(info);
    }
}

/**
 * Clone the opts object so you can add an option without affecting the shared object.
 *
 * @param {Object} opts The opts object to be cloned.
 *
 * @returns {Object} The cloned opts object.
 */
function cloneOpts (opts) {
    return opts ? clone(opts) : {};
}

/**
 * fast way to clone a json object
 * @param obj
 */
function clone (obj) {
    if (typeof obj === "object") {
        // fastest way to clone objects (that don't contain functions)
        return JSON.parse(JSON.stringify(obj));
    } else {
        return obj;
    }
}

/**
 * helper to call the path normalize function so not all files would need their own include of path
 * @param filePath path to normalize
 */
function pathNormalize (filePath) {
    return path.normalize(filePath);
}

/**
 * get the user home directory for Windows, Linus or mac
 * @returns {*}
 */
function getUserHome () {
    return process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'];
}

/**
 * Get the logger with the specified name.
 *
 * Note: If there is no logger with the specified name, use the given config to create a new logger.
 *
 * @param {String} name The name of the logger.
 * @param {Object} [config] The configuration to be used to create a new logger.
 *
 * @returns (Object) The logger with the specified name, or null.
 */
function getLogger (name, config) {
    if (!loggers[name]) {
        if (apisLog === name) {
            configLogger(apisLogConfig);
        } else if (config) {
            configLogger(config);
        } else {
            return null;
        }
        loggers[name] = log4js.getLogger(name)
    }
    return loggers[name];
}

/**
 * Set the logging level for the logger with the specified name.
 *
 * @param {String} name The name of the logger.
 * @param {String} level The logging level. (TRACE, DEBUG, INFO, WARN, ERROR, FATAL)
 */
function setLoggerLevel (name, level) {
    getLogger(name).setLevel(level);
}

const log4jsConfig = {appenders: [], replaceConsole: false, levels: {"[all]": logLevel}};

function configLogger (config) {
    config.appenders.forEach(function (appenderConfig) {
        log4jsConfig.appenders.push(appenderConfig);
    });
    log4js.configure(log4jsConfig);
}

/**
 * Like Q.allSettled, but with a concurrency limit.
 *
 * @param {Object} context The current API context.
 * @param {Array} promiseFns - An array of functions that return a promise.
 * @param {Number} limit - If not provided, it defaults to promises.length.
 *
 * @returns {Q.Promise} a promise for an array of the promises as returned from promiseFns.
 */
function throttledAll (context, promiseFns, limit) {
    const deferred = Q.defer();
    const promises = [];

    limit = limit || promiseFns.length;

    // Wrap the promises in callbacks
    const callbacks = promiseFns.map(function (promiseFn) {
        return function (done) {
            try {
                const promise = promiseFn();
                promises.push(promise);

                // Bind the first argument (error) to null
                promise
                    .then(done.bind(null, null))
                    .catch(function (error) {
                        // Wrap this in try/finally to ensure done always gets invoked.
                        try {
                            // Any errors thrown while handling the promise functions should be logged as a debug entry, so
                            // that developers can verify the behavior of the throttling process. However, the actual error
                            // logging is the responsibility of the promise functions themselves.
                            if (context.logger.isDebugEnabled()) {
                                const message = i18n.__("operation_failed");
                                if (error instanceof Error) {
                                    logDebugInfo(context, message + error.message);
                                } else if (typeof error === "object") {
                                    logDebugInfo(context, message + JSON.stringify(error));
                                } else {
                                    logDebugInfo(context, message + error.toString());
                                }
                            }
                        } finally {
                            // Call done() with null, to allow the rest of the parallel tasks to complete.
                            done(null);
                        }
                    });
            } catch (error) {
                // Call done() with an error, to stop the rest of the parallel tasks from completing.
                done(error);
            }
        };
    });

    // Execute the callbacks in parallel (with a limit)
    async.parallelLimit(callbacks, limit, function (err, results) {
        if (err) {
            logErrors(context, i18n.__("async_parallel_limit_error"), err);
            deferred.reject(err);
        } else {
            logDebugInfo(context, i18n.__("async_parallel_limit_results") + results);
            // resolve the deferred object with the array of promise states
            Q.allSettled(promises)
                .then(function (results) {
                    deferred.resolve(results);
                });
        }
    });

    return deferred.promise;
}

/**
 * This is used to get the request wrapper that has the cookie jar for authentication
 * @returns {*}
 */
function getRequestWrapper () {
    return requestWrapper;
}

/**
 * This is used to get a relative pathe even if the path has \ or / in them
 * @param dir
 * @param file
 * @returns {string}
 */
function getRelativePath (dir, file) {
    // always use / as the path separator char
    return "/" + path.relative(dir, file).replace(/\\/g, '/');
}

/**
 * Replace all of the original string's occurrences of the find string with the replace string.
 *
 * @param original - The string being processed.
 * @param find - The substring that will be replaced by the "replace" string.
 * @param replace - The substring that will replace the "find" string.
 *
 * @returns {String} The original string after all occurrences of the find string have been replaced.
 */
function replaceAll (original, find, replace) {
    // Make sure the find string is escaped, so that it can be safely used in a regular expression.
    find = find.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");

    // Call replace with a global regular expression, which causes all occurrences to be replaced.
    return original.replace(new RegExp(find, 'g'), replace);
}

/**
 * Remove any calculated values, so that the utils object is reset to the initial state.
 */
function reset () {
    // Remove any calculated values.
    httplang = null;
    while (loggers.length > 0) {
        loggers.pop();
    }
}

/**
 * Return the User-Agent for use in HTTP request headers
 */
function getUserAgent() {
    return userAgent;
}

const utils = {
    ProductName: ProductName,
    ProductAbrev: ProductAbrev,
    apisLog: apisLog,
    apisLogConfig: apisLogConfig,
    isValidApiUrl: isValidApiUrl,
    isInvalidPath: isInvalidPath,
    getError: getError,
    getApiLogPath: getApiLogPath,
    cloneOpts: cloneOpts,
    clone: clone,
    pathNormalize: pathNormalize,
    getUserHome: getUserHome,
    getLogger: getLogger,
    setLoggerLevel: setLoggerLevel,
    configLogger: configLogger,
    logErrors: logErrors,
    logWarnings: logWarnings,
    logInfo: logInfo,
    logDebugInfo: logDebugInfo,
    throttledAll: throttledAll,
    getI18N: getI18N,
    getRequestWrapper: getRequestWrapper,
    getRelativePath: getRelativePath,
    getHTTPLanguage: getHTTPLanguage,
    replaceAll: replaceAll,
    reset: reset,
    getUserAgent: getUserAgent
};

module.exports = utils;
