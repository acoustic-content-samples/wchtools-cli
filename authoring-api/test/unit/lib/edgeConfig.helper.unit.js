/*
Copyright 2018 IBM Corporation

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
 * Unit tests for the EdgeConfigHelper object.
 */
"use strict";

// Require the super classes for this class.
const UnitTest = require("./base.unit.js");
const EdgeConfigUnitTest = require("./edgeConfig.unit.js");

// Require the node modules used in this test file.
const fs = require("fs");
const stream = require("stream");
const diff = require("diff");
const sinon = require("sinon");

// Require the local modules that will be stubbed, mocked, and spied.
const EdgeConfigREST = require(UnitTest.API_PATH + "lib/edgeConfigREST.js").instance;

// Require the local module being tested.
const EdgeConfigHelper = require(UnitTest.API_PATH + "edgeConfigHelper.js").instance;

// The default API context used for unit tests.
const context = UnitTest.DEFAULT_API_CONTEXT;

class EdgeConfigHelperUnitTest extends EdgeConfigUnitTest {

    constructor () {
        super();
    }

    run () {
        const self = this;
        describe("Unit tests for EdgeConfigHelper.js", function () {
            // Initialize common resourses before running the unit tests.
            before(function (done) {
                // Signal that the cleanup is complete.
                done();
            });

            // Cleanup common resourses consumed by a test.
            afterEach(function (done) {
                // Restore any stubs and spies used for the test.
                self.restoreTestDoubles();

                // Signal that the cleanup is complete.
                done();
            });

            // Run each of the tests defined in this class.
            self.testSingleton();
            self.testClearCache();
        });
    }

    testSingleton () {
        describe("is a singleton", function () {
            it("should fail if try to create a helper Type", function (done) {
                let error;
                try {
                    const newHelper = new EdgeConfigHelper.constructor();
                    if (newHelper) {
                        error = "The constructor should have failed.";
                    } else {
                        error = "The constructor should have thrown an error.";
                    }
                } catch (e){
                    expect(e).to.equal("An instance of singleton class EdgeConfigHelper cannot be constructed");
                }

                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
        });
    }

    testClearCache() {
        const self = this;
        describe("getEdgeConfig", function () {
            it("should fail when there is an error clearing the cache.", function (done) {
                // Create an assetsREST.getItems stub that returns an error.
                const JOBS_ERROR = "There was an error clearing the cache.";
                const stub = sinon.stub(EdgeConfigREST, "clearCache");
                stub.rejects(JOBS_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                EdgeConfigHelper.clearCache(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (/*jobs*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the clear cache call should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once.
                            expect(stub).to.be.calledOnce;

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.equal(JOBS_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when clearing cache succeeds.", function (done) {
                // Read the contents of five test asset metadata files.

                // Create an edgeConfigREST.clearCache stub that returns a promise for the cache clear.
                const stub = sinon.stub(EdgeConfigREST, "clearCache");
                stub.resolves({"id":"1234"});

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                EdgeConfigHelper.clearCache(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (msg) {
                        // Verify that the stub was called once and that the helper returned the expected values.
                        expect(stub).to.have.been.calledOnce;
                        expect(msg).to.not.be.empty;
                    })
                    .catch (function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }
}

module.exports = EdgeConfigHelperUnitTest;
