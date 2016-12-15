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

const fs = require('fs');
const path = require('path');
const log4js = require('log4js');
const oslocale = require("os-locale");
const logLevel = process.env.WCHTOOLS_LOG_LEVEL || 'ERROR';

const Q = require("q");
const async = require("async");

const ProductName = "IBM Watson Content Hub";
const ProductAbrev = "wchtools";
const ProductVersion = require("../../package.json").version;

const i18nModule = require("i18n-2");
const i18n = getI18N(__dirname, ".json", "en");
const vPath = new RegExp('[?<>*|"]');
const loggers = [];
// Enable the request module cookie jar so cookies can be shared across response, request with this request wrapper
const requestWrapper = require("request").defaults({jar: true});
let httplang;

/**
 * get the object that is used to localize string
 * @param directory the directory that the search for the nls directory starts from, it looks up the tree for the nls directory
 * @param extension the extension of the file with localizations. Default to .json if not passed
 * @param defaultLocale the local to use as a default. en is used if not set
 * @returns {*|exports|module.exports}
 */
function getI18N(directory, extension, defaultLocale) {

    let dir = directory;
    while (dir && !fs.existsSync(dir + "/nls")) {
        const parent = path.dirname(dir);
        dir = (dir !== parent) ? parent : undefined;
    }
    if (dir) {
        dir = dir + "/nls";
//         getLogger(apisLog).info("found nls directory for path: " + directory + " at: " + dir);
        directory = dir;
    } else {
//         getLogger(apisLog).warn("no nls directory found for path: " + directory);
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
    if (locale) {
        if (locales.indexOf(locale) === -1) {
            locale = locale.split('.')[0];
            if (locales.indexOf(locale) === -1) {
                locale = locale.split('_')[0];
                if (locales.indexOf(locale) === -1) {
                    locale = undefined;
                }
            }
        }
    }
    i18n.setLocale(locale || defaultLocale);
    return i18n;
}

/**
 * Enumerates the set of nls resources contained in the specified directory and
 * returns a list of supported locales.
 * @param directory the directory to scan
 * @param extension the extension for nls resource files
 * @param defaultLocale the default locale
 * @returns {Array.<string>} list of supported locales
 */
function getLocales(directory, extension, defaultLocale) {
    var files = fs.readdirSync(directory);
    var locales = files.map(function (file) {
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
 * Returns the http header language string for the supplied locale string.
 * @param locale
 */
function getHTTPLanguage() {
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
 * uses a regexp to check a path to be valid
 * @param path path to be checked
 * @returns {boolean} true if path is valid
 */
function isInvalidPath(path) {
    return vPath.test(path);
}

/**
 * Get the directory that the log file should be created in.  currently uses cwd but could be user home
 * @returns {string} the directory the log file is found in
 */
function getApiLogDir() {
    return process.cwd() + '/' + ProductAbrev + '-api.log';
}

/**
 * This function is used to set up the Error object that we log and return to the user
 * it adds a .log member to the Error which has all the info that we want logged
 * all parameters can be undefined
 * @param err the error object if it is available
 * @param body  the body of the response. used to get the errors passed from the services
 * @param response used to get amy response codes or status messages
 * @param requestOptions used to log the initial request info including the request id
 */
function getError(err, body, response, requestOptions) {
    try {
        const error = getBaseError(err, body, response);
        error.log = "Error Message: " + error.message;
        if (response && response.statusMessage && response.statusCode) {
            if (response.statusCode >= 500 && response.statusCode <= 599) {
                error.message = i18n.__("service_error") + i18n.__("please_try", {log_dir: getApiLogDir()});
            }
            else if (response.statusCode === 408) {
                error.message = i18n.__("service_unavailable") + i18n.__("please_try", {log_dir: getApiLogDir()});
            }
            else if (response.statusCode === 409) {
                error.message = i18n.__("conflict") + ' : ' + error.message;
            }
        }
        try {
            const rOpts = JSON.stringify(requestOptions);
            error.log += " Request Options: " + rOpts;
        } catch (e) {
            //do nothing
        }
        try {
            const jBody = JSON.stringify(body);
            error.log += " Body: " + jBody;
        } catch (e) {
            //do nothing
        }
        try {
            const jResponse = JSON.stringify(response);
            error.statusCode = response.statusCode;
            error.log += " Response: " + jResponse;
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
 * @returns {*|Error} first error found
 */
function getBaseError(err, body, resp) {
    return getErrorFromErr(err) || getErrorFromBody(body) || getErrorFromResponse(resp) || new Error(i18n.__("unknown_error"));
}

/**
 * get the Error from the error object if there is one
 * @param error error object returned from the request
 * @returns {*} an error if one is found
 */
function getErrorFromErr(error) {
    if (error && error.code && (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET'))
        error.message = i18n.__("service_unavailable");
    return error;
}

/**
 * get the Error from the body if there is one
 * @param body the body of the response from the request
 * @returns {*} an error if one is found
 */
function getErrorFromBody(body) {
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
            body.errors.forEach(function (error) {
                messages += error.message + ': '
            });
            err = new Error(messages);
        }
    }
    return err;
}

/**
 *  get the Error from the response if there is one
 * @param response the response from the request
 * @returns {*} an error if one is found
 */
function getErrorFromResponse(response) {
    let err;
    if (response && response.statusMessage && response.statusCode) {
        err = new Error(i18n.__("service_response_error", {code: response.statusCode, message: response.statusMessage}));
    }
    return err;
}

/**
 * the logs errors using the api log it marks the error object as logged and will only log an error once
 * @param heading text you want to label the error with
 * @param error the error that you want logged
 */
function logErrors(heading, error) {
    try {
        if (error instanceof Error && !error.isLogged) {
            error.heading = heading;
            getLogger(apisLog).error(heading + (error.log ? error.log : error.toString()));
            error.isLogged = true;
        }
        else
            getLogger(apisLog).error(error.toString());
    }
    catch (e) {
        // do nothing
    }
}

/**
 * the logs warnings using the api log
 * @param warning text you want to log as a warning
 */
function logWarnings(warning) {
    try {
        getLogger(apisLog).warn(warning);
    }
    catch (e) {
        // do nothing
    }
}

/**
 * the logs debug info using the api log it marks the error object as logged and will only log an error once
 * @param info a sting of info you want logged as debug information
 * @param response an optional parameter if you want the response object logged for debug
 * @param requestOptions an optional parameter if you want the request object logged for debug
 */
function logDebugInfo(info, response, requestOptions) {
    try {
        const logger = getLogger(apisLog);
        if (logger.isLevelEnabled('DEBUG')) {
            if (requestOptions instanceof Object) {
                try {
                    info += " Request Options: " + JSON.stringify(requestOptions);
                } catch (e) {
                    //do nothing
                }
            }
            if (response instanceof Object) {
                try {
                    info += " Response: " + JSON.stringify(response);
                } catch (e) {
                    //do nothing
                }

            }
            logger.debug(info);
        }
    }
    catch (e) {
        // do nothing
    }
}

/**
 * quick way to clone the opts object so you can add an option without affecting what was passed in
 * @param opts an opts object that is used through out the authoring api or undefined
 * @returns {{}} the cloned opts object
 */
function cloneOpts(opts) {
    let cOpts = {};
    if (opts)
        cOpts = this.clone(opts);
    return cOpts;
}

/**
 * fast way to clone a json object
 * @param obj
 */
function clone(obj) {
    // fastest way to clone objects (that don't contain functions)
    return JSON.parse(JSON.stringify(obj));
}

/**
 * helper to call the path normalize function so not all files would need their own include of path
 * @param filePath path to normalize
 */
function pathNormalize(filePath) {
    return path.normalize(filePath);
}

/**
 * get the user home directory for Windows, Linus or mac
 * @returns {*}
 */
function getUserHome() {
    return process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'];
}

/**
 *  get the logger by name
 *  currently we only have the apiLogger but we could add different ones in the future api-debug?
 *  @param (name) name of the logger
 *  @param (config) if not the apiLogger the configuration for the logger of this name
 *  @returns (logger) the logger function for this log
 */
function getLogger(name, config) {
    if (!loggers[name]) {
        if (apisLog === name)
            configLogger(apisLogConfig);
        else
            configLogger(config);
        loggers[name] = log4js.getLogger(name)
    }
    return loggers[name];
}
/**
 * Set the logging level for the named logger
 * @param name the name of the logger to get
 * @param level the level of logging (TRACE,DEBUG,INFO,WARN,ERROR,FATAL)
 */
function setLoggerLevel(name, level) {
    getLogger(name).setLevel(level);
}

const log4jsConfig = {appenders: [], replaceConsole: false, levels: {"[all]": logLevel}};

function configLogger(config) {
    config.appenders.forEach(function (appenderConfig) {
        log4jsConfig.appenders.push(appenderConfig);
    });
    log4js.configure(log4jsConfig);
}

const apisLog = ProductAbrev + " " + ProductVersion;
let apisLogConfig;
// only log to the console if we are running the tests which are run of the jenkins server from the prod-tool directory
if (process.cwd().indexOf('prod-tools') !== -1)
    apisLogConfig = {
        appenders: [
            {
                type: 'console',
                category: apisLog
            },
            {
                type: 'file',
                filename: getApiLogDir(),
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
else
    apisLogConfig = {
        appenders: [
            {
                type: 'file',
                filename: getApiLogDir(),
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

/**
 * Like Q.allSettled, but with a concurrency limit.
 *
 * @param {Object} promiseFns - An array of functions that return a promise.
 * @param limit - If not provided, it defaults to promises.length.
 * @returns a promise for an array of the promises as returned from promiseFns.
 */
function throttledAll(promiseFns, limit) {

    const logger = getLogger(apisLog);

    limit = limit || promiseFns.length;
    const deferred = Q.defer();

    const promises = [];

    // Wrap the promises in callbacks
    const callbacks = promiseFns.map(function (promiseFn) {
        return function (done) {
            try {
                const promise = promiseFn();
                promises.push(promise);
                // Bind the first argument (error) to null
                promise.then(done.bind(null, null)).catch(function (e) {
                    const errMessage = i18n.__("operation_failed");
                    if (e instanceof Error) {
                        logger.error(errMessage, e.toString());
                    } else if (typeof e === "object") {
                        logger.error(errMessage, JSON.stringify(e));
                    } else
                        logger.error(errMessage, e.toString());
                    // call done with null to allow the rest of the parallel tasks to complete
                    done(null);
                });
            } catch (e) {
                done(e);
            }
        };
    });
    // Execute the callbacks in parallel (with a limit)
    async.parallelLimit(callbacks, limit, function (err, results) {
        if (err) {
            logger.error(i18n.__("async_parallel_limit_error"), err.toString());
            deferred.reject(err);
        } else {
            logger.info(i18n.__("async_parallel_limit_results"), results);
            // resolve the deferred object with the array of promise states
            Q.allSettled(promises).then(function (results) {
                deferred.resolve(results);
            });
        }
    });

    return deferred.promise;
}

/**
 * This is used to get teh request wrapper that has the cookie jar for authentication
 * @returns {*}
 */
function getRequestWrapper() {
    return requestWrapper;
}

/**
 * This is used to get a relative pathe even if the path has \ or / in them
 * @param dir
 * @param file
 * @returns {string}
 */
function getRelativePath(dir, file) {
    // always use / as the path separator char
    return path.relative(dir, file).replace(/\\/g, '/');
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
function replaceAll(original, find, replace) {
    // Make sure the find string is escaped, so that it can be safely used in a regular expression.
    find = find.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");

    // Call replace with a global regular expression, which causes all occurrences to be replaced.
    return original.replace(new RegExp(find, 'g'), replace);
}

const utils = {
    ProductName: ProductName,
    ProductAbrev: ProductAbrev,
    apisLog: apisLog,
    apisLogConfig: apisLogConfig,
    isInvalidPath: isInvalidPath,
    getError: getError,
    getApiLogDir: getApiLogDir,
    clone: clone,
    cloneOpts: cloneOpts,
    pathNormalize: pathNormalize,
    getUserHome: getUserHome,
    getLogger: getLogger,
    setLoggerLevel: setLoggerLevel,
    configLogger: configLogger,
    logErrors: logErrors,
    logWarnings: logWarnings,
    logDebugInfo: logDebugInfo,
    throttledAll: throttledAll,
    getI18N: getI18N,
    getRequestWrapper: getRequestWrapper,
    getRelativePath: getRelativePath,
    getHTTPLanguage: getHTTPLanguage,
    replaceAll: replaceAll
};

module.exports = utils;
