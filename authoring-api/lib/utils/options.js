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

// The default options file will always be read.
const optionsFileName = ".wchtoolsoptions";
const defaultOptionsFile = path.resolve(__dirname + "./../../" + optionsFileName);

// The test options file will be read if it exists, otherwise the user options file will be read.
const localOptionsFile = process.cwd() + path.sep + optionsFileName;
const userOptionsFile = utils.getUserHome() + path.sep + optionsFileName;

// global options are stored here
const gOpts = "gOpts";

// Accumulate any errors that occur during initialization.
let init_errors = [];

// The dynamic (modifed) options in memory, which should always be a "superset" (or rather a "super-nested-table")
// of the default options, the user options, and any other options files or values that have been applied.
let dynamicOptions;

/**
 * Get the specified nested property from the given options object.
 *
 * Example: nestedProperty({ a: { b: { c: "foo" }}}, ["a", "b", "c"]) => "foo"
 *
 * @param {Object} obj The options object containing the nested property.
 * @param {Array} properties An array of property names specifying the nested property to retrieve.
 *
 * @return {Object} The specified nested property from the given options object, or null if the nested property is not found.
 */
function _getNestedProperty (obj, properties) {
    let result = obj;
    properties = properties || [];

    for (let i = 0; i < properties.length; i++) {
        if (typeof result[properties[i]] !== "undefined" && result[properties[i]] !== null) {
            result = result[properties[i]];
        } else {
            result = null;
            break;
        }
    }
    return result;
}

const options = {
    /**
     * Returns a deep copy of the value of the options property specified by the
     * arguments.
     *
     * Ex. usage: getProperty("types", "uri")
     */
    getProperty: function () {
        // The built-in arguments array is used for processing arguments
        const result = _getNestedProperty(dynamicOptions, arguments);
        if (result !== null && typeof result !== "undefined") {
            return utils.clone(result);
        } else {
            return null;
        }
    },

    /**
     * Read the given options file.
     *
     * @returns {Object} An object with the properties in the given file, or an empty object if the file could not be read.
     *
     * @private
     */
    readOptionsFile: function (filename) {
        try {
            // Read the contents of the options file and create a JSON object.
            return JSON.parse(fs.readFileSync(filename).toString());
        } catch (err) {
            // Log the initialization error and add it to the array.
            const message = i18n.__("error_options_file", {"filename": filename, "error": err.message});
            utils.logErrors(message, err);
            init_errors.push(new Error(message));
            return {};
        }
    },

    /**
     * Update the current options with the given values, and persist to file if specified.
     *
     * @param {Object} options Object containing the new options values.
     * @param {Boolean} [persist] A value of true indicates that the updated options should be synchronously written to
     *                      the user's options file. Any other value indicates that the updated options should not be
     *                      written to the user's options file.
     * @param {String} [directory] The directory where the options file should be saved.
     *
     * @return {String|undefined} The path of the options file, if the options were persisted.
     */
    setOptions: function (options, persist, directory) {
        // No need to update if no options were specified.
        if (!options) {
            return;
        }

        // Update the in-memory options.
        deepExtend(dynamicOptions, options);

        // Write the updated options to the user's options file, if specified.
        if (typeof persist === "boolean" && persist) {
            let optionsFilePath;
            if (!directory) {
                // Use the options file in the user home directory
                optionsFilePath = userOptionsFile;
            } else if (directory === ".") {
                // Use the options file in the current working directory
                optionsFilePath = localOptionsFile;
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
                contents = this.readOptionsFile(optionsFilePath);
                deepExtend(contents, options);
            } else {
                // The options file doesn't already exist, so just use the new options.
                contents = options;
            }

            // Write the options to the appropriate file.
            fs.writeFileSync(optionsFilePath, JSON.stringify(contents, null, "  "));

            // Return the path of the options file that was updated.
            return optionsFilePath;
        }
    },

    /**
     * Updates the global options in memory without modifying the user's options file.
     *
     * @param opts - Object containing the optional settings for the api
     */
    setGlobalOptions: function (opts) {
        if (typeof opts === "undefined") {
            return;
        }
        let glOpts = this.getProperty(gOpts);
        if (!glOpts) {
            glOpts = opts;
        } else {
            deepExtend(glOpts, opts);
        }
        this.setOptions({gOpts: glOpts});
    },

    /**
     * Get the most relevant value for the specified option name based on the current, gloabl and specified options.
     *
     * @param opts - The options specified for the API call.
     * @param optionName - The name of the option.
     * @param serviceName - optional service name.
     *
     * @return {*} The most relevant value for the specified option name, or null.
     */
    getRelevantOption: function (opts, optionName, serviceName) {
        let rVal;

        // Get the value defined by the current options.
        if (serviceName) {
            rVal = this.getProperty(serviceName, optionName);
        } else {
            rVal = this.getProperty(optionName);
        }

        // Get the value defined by the global options.
        const glOpts = this.getProperty(gOpts);
        if (glOpts) {
            const result = glOpts[optionName];
            if (result !== null && typeof result !== "undefined") {
                rVal = result;
            }
        }

        // Get the value defined by the options specified for the API call.
        if (opts) {
            const result = opts[optionName];
            if (result !== null && typeof result !== "undefined") {
                rVal = result;
            }
        }

        // Return the most relevant value.
        return rVal;
    },

    /**
     * Get an array of initialization errors, or an empty array if there were no initialization errors.
     *
     * @returns {Array} An array of initialization errors, or an empty array if there were no initialization errors.
     */
    getInitializationErrors: function () {
        return init_errors;
    },

    /**
     * Extend the dynamic options using the values from the given options file.
     *
     * @param {String} filename The name of the file containing option values.
     */
    extendOptionsFromFile: function (filename) {
        if (fs.existsSync(filename)) {
            // Read the contents of the options file and extend the dynamic options.
            const newOptions = this.readOptionsFile(filename);
            deepExtend(dynamicOptions, newOptions);
        }
    },

    /**
     * Extend the dynamic options using the values from the options file in the given directory.
     *
     * @param {String} dirname The name of the directory containing the options file.
     */
    extendOptionsFromDirectory: function (dirname) {
        let filename;

        if (dirname.endsWith("/") || dirname.endsWith("\\")) {
            // Use the options file in the specified directory
            filename = dirname + optionsFileName;
        } else {
            // Use the options file in the specified directory
            filename = dirname + path.sep + optionsFileName;
        }

        this.extendOptionsFromFile(filename);
    },

    /**
     * Removes any non-persistent changes from memory (ie any changes that were
     * not saved to the user-options file.
     *
     * @throws SyntaxError if the options file is not valid json.
     */
    resetState: function () {
        init_errors = [];
        this.initialize();
    },

    /**
     * Initialize the dynamic options.
     *
     * @private
     */
    initialize: function () {
        // Start with an empty object and add the specified options to it.
        dynamicOptions = {};

        // The default options are defined in a file included with the API package.
        this.extendOptionsFromFile(defaultOptionsFile);

        // FUTURE This logic to rename or delete old files should be removed after a period of time.
        // FUTURE Also need to remove related unit tests. Target removal date: 7/1/2017.
        try {
            let userOptionsFileExists = fs.existsSync(userOptionsFile);

            let oldUserOptionsFile = utils.getUserHome() + path.sep + ".wchtoolsuseroptions";
            if (fs.existsSync(oldUserOptionsFile)) {
                if (userOptionsFileExists) {
                    // The user options file already exists, so just delete the old file.
                    fs.unlinkSync(oldUserOptionsFile);
                } else {
                    // The user options file doesn't exist, so rename the old file.
                    fs.renameSync(oldUserOptionsFile, userOptionsFile);
                    userOptionsFileExists = true;
                }
            }

            oldUserOptionsFile = utils.getUserHome() + path.sep + "dx_user_options.json";
            if (fs.existsSync(oldUserOptionsFile)) {
                if (userOptionsFileExists) {
                    // The user options file already exists, so just delete the old file.
                    fs.unlinkSync(oldUserOptionsFile);
                } else {
                    // The user options file doesn't exist, so rename the old file.
                    fs.renameSync(oldUserOptionsFile, userOptionsFile);
                }
            }
        } catch (e) {
            // It's possible that the current process does not have permission to modify or delete files in the user home
            // directory. If this is the case, just continue on without using the old files.
        }

        // The user options are defined in a file in the user's home directory.
        this.extendOptionsFromFile(userOptionsFile);

        // The local options are defined in a file in the current working directory.
        this.extendOptionsFromFile(localOptionsFile);
    }
};

// Call the initialize() method so that the options object is initialized on the first require.
try {
    options.initialize();
} catch (e) {
    //console.log(e.toString())
}

module.exports = options;
