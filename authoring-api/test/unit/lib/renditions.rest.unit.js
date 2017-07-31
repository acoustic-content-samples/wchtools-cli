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
 * Unit tests for the RenditionssREST object.
 */
"use strict";

// Require the super classes for this class.
const UnitTest = require("./base.unit.js");
const RenditionsUnitTest = require("./renditions.unit.js");
const BaseRestUnit = require("./base.rest.unit.js");

// Require the local module being tested.
const restApi = require(UnitTest.API_PATH + "lib/renditionsREST.js").instance;
const options = require(UnitTest.API_PATH + "lib/utils/options.js");
// Get the "lookup" URI for renditions
const lookupUri =  options.getProperty(UnitTest.DEFAULT_API_CONTEXT, "renditions", "uri");
const path1 = RenditionsUnitTest.VALID_RENDITIONS_DIRECTORY + RenditionsUnitTest.VALID_RENDITION_1;
const path2 = RenditionsUnitTest.VALID_RENDITIONS_DIRECTORY + RenditionsUnitTest.VALID_RENDITION_2;

// The default API context used for unit tests.
const context = UnitTest.DEFAULT_API_CONTEXT;

class RenditionsRestUnitTest extends BaseRestUnit {
    constructor() {
        super();
    }
    run(){
        super.run(restApi, lookupUri, "renditions", path1, path2);
    }
    //  when we add a create test to the base rest this should call that update for these just call create
    testUpdateItem(restApi, lookupUri, restName, itemPath1, itemPath2){

    }
    testDeleteItem(restApi, lookupUri, restName, itemPath1, itemPath2) {
        describe("deleteItem", function () {
            it("should fail calling delete", function (done) {
                // Call the method being tested.
                let error;
                restApi.deleteItem(context, {id: UnitTest.DUMMY_ID}, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the item should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.contain("Delete");
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }
}

module.exports = RenditionsRestUnitTest;
