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
const hashes = require(UnitTest.API_PATH + "lib/utils/hashes.js");

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
    constructor () {
        super();
    }

    run () {
        super.run(restApi, fsApi, helper,  path1, path2, badPath);
    }

    runAdditionalTests (restApi, fsApi, helper, path1, path2, badPath) {
        this.testRemoveAllHashes(helper);
        this.testCompare(restApi, fsApi, helper, UnitTest.API_PATH + UnitTest.COMPARE_RESOURCES_DIRECTORY_1, UnitTest.API_PATH + UnitTest.COMPARE_RESOURCES_DIRECTORY_2);
    }

    testDeleteRemoteItem (restApi, fsApi, helper){
        describe("deleteRemoteItem", function () {
            it("should fail calling delete", function (done) {
                // Call the method being tested.
                let error;
                helper.deleteRemoteItem(context, UnitTest.DUMMY_METADATA, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the item should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.contain("Delete");
                        expect(err.message).to.contain(UnitTest.DUMMY_METADATA.id);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail calling delete - no options", function (done) {
                // Call the method being tested.
                let error;
                helper.deleteRemoteItem(context, UnitTest.DUMMY_METADATA)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the item should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.contain("Delete");
                        expect(err.message).to.contain(UnitTest.DUMMY_METADATA.id);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testDeleteRemoteItems (restApi, fsApi, helper){
        describe("deleteRemoteItems", function () {
            it("should fail calling delete", function (done) {
                // Call the method being tested.
                let error;
                helper.deleteRemoteItems(context, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the item should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.contain("Delete");
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail calling delete - no options", function (done) {
                // Call the method being tested.
                let error;
                helper.deleteRemoteItems(context)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the item should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.contain("Delete");
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testRemoveAllHashes (helper){
        const self = this;
        describe("removeAllHashes", function () {
            it("should call through to the hashes method", function (done) {
                // Create a stub for the hashes method.
                const stub = sinon.stub(hashes, "removeAllHashes");

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                try {
                    helper.removeAllHashes(context, UnitTest.DUMMY_OPTIONS);

                    // Verify that the stub was called with the expected value.
                    expect(stub).to.have.been.calledOnce;
                    expect(stub.args[0][[1]]).to.contain("renditions");
                } catch (err) {
                    error = err;
                } finally {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
            });
        });
    }
}

module.exports = RenditionsHelperUnitTest;
