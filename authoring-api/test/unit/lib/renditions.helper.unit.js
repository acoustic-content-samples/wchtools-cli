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
 * Unit tests for the renditionHelper object.
 */
"use strict";

// Require the super classes for this class.
const UnitTest = require("./base.unit.js");
const RenditionsUnitTest = require("./renditions.unit.js");
const BaseHelperUnitTest = require("./base.helper.unit.js");
const sinon = require("sinon");

// Require the local module being tested.
const restApi = require(UnitTest.API_PATH + "lib/renditionsREST.js").instance;
const fsApi = require(UnitTest.API_PATH + "lib/renditionsFS.js").instance;
const helper = require(UnitTest.API_PATH + "renditionsHelper.js").instance;
const path1 = RenditionsUnitTest.VALID_RENDITIONS_DIRECTORY + RenditionsUnitTest.VALID_RENDITION_1;
const path2 = RenditionsUnitTest.VALID_RENDITIONS_DIRECTORY + RenditionsUnitTest.VALID_RENDITION_2;
const badPath = RenditionsUnitTest.INVALID_RENDITIONS_DIRECTORY + RenditionsUnitTest.INVALID_RENDITION_BAD_NAME;

// The default API context used for unit tests.
const context = UnitTest.DEFAULT_API_CONTEXT;

class RenditionsHelperUnitTest extends BaseHelperUnitTest {
    constructor() {
        super();
    }

    run(){
        super.run(restApi, fsApi,helper,  path1, path2, badPath);
    }

    testDeleteRemoteItem (restApi, fsApi, helper){
        describe("deleteItem", function () {
            it("should fail calling delete", function (done) {
                // Call the method being tested.
                let error;
                helper.deleteRemoteItem(context, UnitTest.DUMMY_METADATA, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the item should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.contain("Delete");
                            expect(err.message).to.contain(UnitTest.DUMMY_METADATA.id);
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

module.exports = RenditionsHelperUnitTest;
