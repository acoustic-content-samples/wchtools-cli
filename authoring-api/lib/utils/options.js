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

const deepExtend = require("deep-extend");
const fs = require("fs");
const path = require("path");
const utils = require("./utils.js");
const i18n = utils.getI18N(__dirname, ".json", "en");

// The name used for an options file.
const optionsFileName = ".wchtoolsoptions";

/**
 * Get the specified nested property from the given options object.
 *
 * Example: For an object equal to {"a": {"b": {"c": "foo" }}}, calling
 *          _getNestedProperty(object, ["a", "b", "c"]) would return "foo"
 *          _getNestedProperty(object, ["a", "b") would return {"c": "foo"}
 *          _getNestedProperty(object, ["a", "b", "c", "d"]) would return null
 *
 * @param {Object} obj The options object containing the nested property.
 * @param {Array} propertyNames An array of property names specifying the nested property to retrieve.
 *
 * @return {Object} The specified nested property from the given options object, or null if the nested property is not found.
 */
function _getNestedProperty (obj, propertyNames) {
    let result = obj;
    propertyNames = propertyNames || [];

    for (let i = 0; i < propertyNames.length; i++) {
        if (typeof result[propertyNames[i]] !== "undefined" && result[propertyNames[i]] !== null) {
            result = result[propertyNames[i]];
        } else {
            result = null;
            break;
        }
    }
    return result;
}

const options = {
    /**
     * Get the value of the specified property at the nested location defined by the specified property names.
     *
     * Usage: options.getProperty(context, "types", "limit")
     *
     * @param {Object} obj The options object containing the property.
     * @param {...String} properties A variable number (0..n) of property names
     *
     * @returns {Object} The value of the specified property.
     *
     * @public
     */
    getProperty: function (obj, properties) {
        // The built-in arguments array (shifted to account for the options object) is the array of nested property names.
        const propertyNames = Array.from(arguments);
        propertyNames.shift();

        // Get the specified property from the given options object.
        const result = _getNestedProperty(obj, propertyNames);

        // Return null for any null or undefined value. Note that an empty string will be returned as a distinct value.
        if (typeof result === "undefined") {
            return null;
        } else {
            return result;
        }
    },

    /**
     * Read the given options file.
     *
     * @param {Object} context The current API context.
     * @param {String} filename The options file to read.
     *
     * @returns {Object} An object with the properties in the given file, or an empty object if the file could not be read.
     *
     * @private
     */
    readOptionsFile: function (context, filename) {
        try {
            // Read the contents of the options file and create a JSON object.
            return JSON.parse(fs.readFileSync(filename).toString());
        } catch (err) {
            // Log the initialization error and add it to the array on the context.
            const message = i18n.__("error_options_file", {"filename": filename, "error": err.message});
            utils.logErrors(context, message, err);
            context["initErrors"] = context["initErrors"] || [];
            context["initErrors"].push(new Error(message));
            return {};
        }
    },

    /**
     * Update the context with the given options, and persist to file if specified.
     *
     * @param {Object} context The current API context.
     * @param {Object} newOptions Object containing the new options values.
     * @param {Boolean} [persist] A value of true indicates that the updated options should be synchronously written to
     *                            the options file. Any other value indicates that the updated options should not be
     *                            written to the options file.
     * @param {String} [directory] The directory where the options file should be saved. A value of "." can be used for
     *                             the wroking directory. If a value is not specified, the user home directory is used.
     *
     * @return {String|undefined} The path of the options file, if the options were persisted.
     *
     * @public
     */
    setOptions: function (context, newOptions, persist, directory) {
        // No need to update if no options were specified.
        if (newOptions) {
            // Update the in-memory options.
            deepExtend(context, newOptions);

            // Write the updated options to the user's options file, if specified.
            if (persist === true) {
                let optionsFilePath;
                if (!directory) {
                    // Use the options file in the user home directory
                    optionsFilePath = utils.getUserHome() + path.sep + optionsFileName;
                } else if (directory === ".") {
                    // Use the options file in the current working directory
                    optionsFilePath = process.cwd() + path.sep + optionsFileName;
                } else if (directory.endsWith("/") || directory.endsWith("\\")) {
                    // Use the options file in the specified directory
                    optionsFilePath = directory + optionsFileName;
                } else {
                    // Use the options file in the specified directory
                    optionsFilePath = directory + path.sep + optionsFileName;
                }

                // Determine the contents of the options file to be written
                let contents;
                if (fs.existsSync(optionsFilePath)) {
                    // The options file already exists, so extend the existing options in that file with the new options.
                    contents = this.readOptionsFile(context, optionsFilePath);
                    deepExtend(contents, newOptions);
                } else {
                    // The options file doesn't already exist, so just use the new options.
                    contents = newOptions;
                }

                // Write the options to the appropriate file.
                fs.writeFileSync(optionsFilePath, JSON.stringify(contents, null, "  "));

                // Return the path of the options file that was updated.
                return optionsFilePath;
            }
        }
    },

    /**
     * Get the most relevant value for the specified option name based on the current, gloabl and specified options.
     *
     * @param {Object} context The current API context.
     * @param {Object} opts The options specified for the API call.
     * @param {String} optionName The name of the option.
     * @param {String} [serviceName] The service name.
     *
     * @return {*} The most relevant value for the specified option name, or null.
     *
     * @public
     */
    getRelevantOption: function (context, opts, optionName, serviceName) {
        let retVal;

        // Get the value defined by the context.
        if (serviceName) {
            // Service-specific value takes precedence if a service name is specified.
            retVal = this.getProperty(context, serviceName, optionName);
        }
        if (retVal === null || typeof retVal === "undefined") {
            // Get the top-level property if there is no service-specific value.
            retVal = this.getProperty(context, optionName);
        }

        // Get the override value defined by the opts object.
        if (opts) {
            const result = opts[optionName];
            if (result !== null && typeof result !== "undefined") {
                retVal = result;
            }
        }

        // Return the most relevant value.
        return retVal;
    },

    /**
     * Returns the set of property keys contained in the global and specified options.
     *
     * @param {Object} context The current API context.
     * @param {Object} [opts] The options specified for the API call.
     *
     * @return {*} The set of property keys contained in the global and specified options.
     *
     * @public
     */
    getPropertyKeys: function(context, opts) {
        const keys = Object.keys(context);
        if (opts) {
            Object.keys(opts).forEach(function (key) {
                if (keys.indexOf(key) === -1) {
                    keys.push(key);
                }
            });
        }
        return keys;
    },

    /**
     * Get an array of initialization errors, or an empty array if there were no initialization errors.
     *
     * @returns {Array} An array of initialization errors, or an empty array if there were no initialization errors.
     *
     * @public
     */
    getInitializationErrors: function (context) {
        return context["initErrors"] || [];
    },

    /**
     * Extend the dynamic options using the values from the given options file.
     *
     * @param {Object} context The current API context.
     * @param {String} filename The name of the file containing option values.
     *
     * @private
     */
    extendOptionsFromFile: function (context, filename) {
        if (fs.existsSync(filename)) {
            // Read the contents of the options file and extend the dynamic options.
            const newOptions = this.readOptionsFile(context, filename);
            deepExtend(context, newOptions);
        }
    },

    /**
     * Extend the dynamic options using the values from the options file in the given directory.
     *
     * @param {Object} context The current API context.
     * @param {String} dirname The name of the directory containing the options file.
     *
     * @public
     */
    extendOptionsFromDirectory: function (context, dirname) {
        let filename;

        if (dirname.endsWith("/") || dirname.endsWith("\\")) {
            // Use the options file in the specified directory
            filename = dirname + optionsFileName;
        } else {
            // Use the options file in the specified directory
            filename = dirname + path.sep + optionsFileName;
        }

        this.extendOptionsFromFile(context, filename);
    },

    /**
     * Initialize the options for the specified context..
     *
     * @param {Object} context The current API context.
     *
     * @public
     */
    initialize: function (context) {
        // The default options are defined in a file included with the API package.
        const defaultOptionsFile = path.resolve(__dirname + "./../../" + optionsFileName);
        this.extendOptionsFromFile(context, defaultOptionsFile);

        // The user options are defined in a file in the user's home directory.
        const userOptionsFile = utils.getUserHome() + path.sep + optionsFileName;
        this.extendOptionsFromFile(context, userOptionsFile);

        // The local options are defined in a file in the current working directory.
        const localOptionsFile = process.cwd() + path.sep + optionsFileName;
        this.extendOptionsFromFile(context, localOptionsFile);
    }
};

module.exports = options;
