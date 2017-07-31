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
/**
 * Base class for API unit tests.
 */
"use strict";

// Use the chai assertion framework.
const chai = require("chai");

// Use the chai-as-promised promise-assertion extension.
const chaiAsPromised = require("chai-as-promised");

// Use the sinon spy/stub/mock framework.
require("sinon");

// Use the sinon spy/stub/mock framework.
const Q = require("q");

// Use the sinon-as-promised extension.
require("sinon-as-promised")(Q.Promise);

// Use the sinon-chai extension.
const sinonChai = require("sinon-chai");

// Tell chai that it should be using chai-as-promised and sinon-chai.
chai.use(chaiAsPromised);
chai.use(sinonChai);

const path  = require("path");
// Now that chai is using chai-as-promised, expose the new expect function.
global.expect = chai.expect;
let authorApiPath = path.dirname(__filename);
authorApiPath = path.normalize(authorApiPath + path.sep + '../../../');

// Create a default API context to be used for unit tests.
const events = require("events");
const ToolsApi = require("../../../wchToolsApi.js");
const options = ToolsApi.getOptions();
const toolsApi = new ToolsApi({eventEmitter: new events.EventEmitter()});
const defaultContext = toolsApi.getContext();

class UnitTest {
    // The default API context to be used for unit tests.
    static get DEFAULT_API_CONTEXT () { return defaultContext; };

    // File and directory constants used by all unit tests.
    static get API_PATH () { return authorApiPath; };
    static get VALID_RESOURCES_DIRECTORY () { return "test/unit/resources/valid" + path.sep; }; // Relative to root.
    static get INVALID_RESOURCES_DIRECTORY () { return "test/unit/resources/invalid" + path.sep; }; // Relative to root.

    // Dummy values to be used when real values are not required.
    static get DUMMY_DIR () { return authorApiPath + "test/unit/dummy" + path.sep; };
    static get DUMMY_ID () { return "test"; };
    static get DUMMY_NAME () { return "test"; };
    static get DUMMY_PATH () { return "test"; };
    static get DUMMY_METADATA () { return {"id": "xxx", "path": "test1"}; };
    static get DUMMY_OPTIONS () { return {}; };

    constructor () {
        // Array of mocks, stubs, and spies that should be restored when a test completes.
        this.testDoublesToRestore = [];
    }

    /**
     * Add a test double used by this unit test, that will need to be restored when the test is complete.
     */
    addTestDouble (testDouble) {
        this.testDoublesToRestore.push(testDouble);
    }

    /**
     * Restore any test doubles used by this unit test.
     */
    restoreTestDoubles () {
        this.testDoublesToRestore.forEach(function (object) {
            object.restore();
        });

        // Initialize the array for the next test.
        this.testDoublesToRestore = [];
    }

    /**
     * Restore options to the initial state.
     *
     * @param {Object} context The current API context.
     */
    static restoreOptions (context) {
        options.initialize(context);
    }

    /**
     * Determine whether the specified arrays contain the same strings, regardless of order.
     *
     * NOTE: This utility function may work for arrays that contain other atomic types, but may not work for arrays that
     * contain objects or other arrays.
     *
     * @param {Array} array1 - One of the arrays of strings to be compared.
     * @param {Array} array2 - The other array of strings to be compared.
     *
     * @return {boolean} Whether the specified arrays contain the same strings, regardless of order.
     */
    static stringArraysEqual (array1, array2) {
        // If the lengths aren't equal, the arrays aren't equal.
        if (array1.length !== array2.length) {
            return false;
        }

        // Verify that all elements in array 1 exist in array 2.
        for (let i = 0; i < array1.length; i++) {
            if (array2.indexOf(array1[i]) === -1) {
                return false;
            }
        }

        // Verify that all strings in array 2 exist in array 1. This second test is necessary in case array 1 has duplicates
        // that are not duplicated in array 2. For example, if array1=["a", "a"] & array2=["a", "b"], the first test passes.
        for (let i = 0; i < array2.length; i++) {
            if (array1.indexOf(array2[i]) === -1) {
                return false;
            }
        }

        // All of the equality tests passed.
        return true;
    }

    /**
     * Get the JSON object representing the file at the specified path.
     *
     * @param {String} path - File path to a JSON file. If the path is relative, it must be relative to this test file.
     *
     * @returns {Object} The JSON object representing the file at the specified path.
     */
    static getJsonObject (path) {
        return require(path);
    }
}

module.exports = UnitTest;
