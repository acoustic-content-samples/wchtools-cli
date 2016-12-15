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
const defaultOptions = require("./../../dx_options.json");

const HOME = utils.getUserHome();
const testOptionsFile = process.cwd() + path.sep + "dx_test_options.json";
const userOptionsFile = HOME + path.sep + "dx_user_options.json";
// global options are stored here
const gOpts = "gOpts";

// The user options stores the persistent options on disk.
// dynamicOptions stores temporarilly modifed options in memory.
// dynamicOptions should always be a "superset" (or "super-nested-table rather")
// of userOptions and defaultOptions.
let userOptions = {};
let dynamicOptions = {};

// Called just before exporting the "options" object"
function _initialize() {

    /* FUTURE - revisit how we handle user config option overrides in a way that
       doesn't prevent us from updating shipped config option values. */
    try {
        // Try to read the Load the user options synchronously
        if(fs.existsSync(testOptionsFile)){
            userOptions = fs.readFileSync(testOptionsFile);
        }
        else
            userOptions = fs.readFileSync(userOptionsFile);
        userOptions = userOptions || "{}";
        userOptions = JSON.parse(userOptions.toString());
    } catch(e) {
        userOptions = defaultOptions;
    }

    checkUserOptions();

    dynamicOptions = {};

    // Added default options to dynamic options
    deepExtend(dynamicOptions, defaultOptions);

    // Add user options to dynamic options
    deepExtend(dynamicOptions, userOptions);

}


// A temporary fix, if the user options is a buffer object, reset it.
// userOptions should never be a buffer.
function checkUserOptions() {
    if (Object.keys(userOptions).length === 2
        && userOptions.type === "Buffer"
        && user.data && user.data.constructor === Array) {
            userOptions = {};
    }
}

/**
 * Typedef of a sandbox object in comments
 * @typedef {Object} Sandbox
 * @param obj
 * @param properties
 */

// FUTURE: watch the user's copy of this file? It's possible that another program
// or the user edits the options file while the program is being run.

// Returns a nested property
// E.g. nestedProperty({ a: { b: { c: "foo" }}}, ["a", "b", "c"]) => "foo"
// Returns null/undefined if no match is found
function _getNestedProperty(obj, properties) {
    let result = obj;
    properties = properties || [];

    for (let i = 0; i < properties.length; i++) {
        if (typeof result[properties[i]] !== "undefined" && result[properties[i]] != null) {
            result = result[properties[i]];
        } else {
            result = null;
            break;
        }
    }
    return result;
}

const options = {
    //------GENERIC FUNCTIONS------//

    /**
     * Returns a deep copy of the value of the options property specified by the
     * arguments.
     *
     * Ex. usage: getProperty("types", "uri")
     */
    getProperty: function() {
        // The built-in arguments array is used for processing arguments
        const result = _getNestedProperty(dynamicOptions, arguments);
        if (result != null && typeof result !== "undefined") {
            return utils.clone(result);
        } else {
            return null;
        }
    },

    /**
     * Returns a deep copy of the value of the user options property specified
     * by the arguments.
     *
     * Ex. usage: getUserProperty("types", "uri")
     */
    getUserProperty: function() {
        const result = _getNestedProperty(userOptions, arguments);

        if (result != null && typeof result !== "undefined") {
            return utils.clone(result);
        } else {
            return result; // It's null or undefined here
        }
    },

    /**
     * Updates the options in memory without modifying the user's options file.
     * @param options - Object containing the optional settings for the api
     * @param persist - if truthy, the changes will synchronously be written
     *                  to the user's options file.
     *                  Defaults to false.
     */
    setOptions: function(options, persist) {
        if (typeof options === "undefined") {
            return;
        }
        if (typeof persist === "undefined") {
            persist = false; // false by default
        }

        deepExtend(dynamicOptions, options);

        if (persist) {
            deepExtend(userOptions, options);
            const contents = JSON.stringify(options, null, "  ");
            fs.writeFileSync(userOptionsFile, contents);
        }
    },
    /**
     * Updates the global options in memory without modifying the user's options file.
     * @param opts - Object containing the optional settings for the api
     */
    setGlobalOptions: function(opts) {
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
     * Gets the most relevant option for a call looking at the default,gloabl and currently passed setting
     * @param opts - the current options set for the current api
     * @param elementName - the name of the value that is needed
     */
    getRelevantOption: function( opts, elementName){
        let rVal;
        // this removes the first 2 args and passes thereat on to get property below.
        const args = Array.prototype.slice.call(arguments).slice(2);


        const glOpts = this.getProperty(gOpts);
        if(args.length >0)
            rVal = this.getProperty(args[0], args[1]);
        else
            rVal = this.getProperty(elementName);
        if(glOpts && glOpts[elementName])
            rVal = glOpts[elementName];
        if(opts  && opts[elementName])
            rVal = opts[elementName];
        return rVal;
    },
    /**
     * Removes any non-persistent changes from memory (ie any changes that were
     * not saved to the user-options file.
     *
     * @throws SyntaxError if the options file is not valid json.
     */
    resetState: _initialize,
    gOpts : "gOpts"
};

try {
    _initialize()
} catch(e) {
    //console.log(e.toString())
}

module.exports = options;
