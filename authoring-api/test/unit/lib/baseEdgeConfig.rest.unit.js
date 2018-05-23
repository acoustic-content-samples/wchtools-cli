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
 * Unit tests for the REST object.
 */
"use strict";

// Require the super classes for this class.
const UnitTest = require("./base.unit.js");
const BaseRestUnitTest = require("./base.rest.unit.js");

// Require the node modules used in this test file.
const fs = require("fs");
const stream = require("stream");
const diff = require("diff");
const sinon = require("sinon");

// Require the local modules that will be stubbed, mocked, and spied.
const utils = require(UnitTest.API_PATH + "lib/utils/utils.js");
const request = utils.getRequestWrapper();

// The default API context used for unit tests.
const context = UnitTest.DEFAULT_API_CONTEXT;

class BaseEdgeConfigRestUnitTest extends BaseRestUnitTest {
    constructor() {
        super();
    }

    run (restApi, lookupUri, restName) {
        const self = this;
        describe("Unit tests for Rest " + restName, function() {
            // Cleanup common resources consumed by a test.
            afterEach(function (done) {
                // Restore any stubs and spies used for the test.
                self.restoreTestDoubles();

                // Signal that the cleanup is complete.
                done();
            });

            // Run each of the tests defined in this class.
            self.testSingleton(restApi, lookupUri,restName);
            self.testGetRequestOptions(restApi);
            self.testClearCache(restApi, lookupUri,restName);
        });
    }

    testSingleton (restApi, lookupUri,restName) {
        describe("is a singleton", function () {
            it("should fail if try to create a rest Type", function (done) {
                let error;
                try {
                    // The constructor should fail, so we do not expect the assignment to occur.
                    error = new restApi.constructor();
                }
                catch (e) {
                    expect(e).to.equal("An instance of singleton class " + restApi.constructor.name + " cannot be constructed");
                }
                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
        });
    }

    testGetRequestOptions (restApi) {
        const self = this;

        describe("getRequestOptions", function() {
            it("should fail if getting the request URI fails", function (done) {
                // Create a stub for getRequestURI.
                const stub = sinon.stub(restApi, "getRequestOptions");

                // The second GET request is to retrieve the items, but returns an error.
                const URI_ERROR = "Error getting the request Options.";
                const err = new Error(URI_ERROR);
                stub.rejects(err);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                restApi.getRequestOptions(context, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once.
                        expect(stub).to.have.been.calledOnce;

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.equal(URI_ERROR);
                    })
                    .catch (function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testClearCache (restApi, lookupUri,restName) {
        const self = this;

        // Execute several failure cases to test the various ways the server might return an error. Subsequent tests do
        // not need to repeat the test matrix, they can just execute one of these tests to verify an error is returned.
        describe("rest clear cache invalidate test", function() {
            it("should fail when calling the invalidate cache API fails with an error", function (done) {
                // Create a stub for the GET requests.
                const stub = sinon.stub(request, "post");
                // The second GET request is to retrieve the items, but returns an error.
                const URI_ERROR = "Error invalidating the cache.";
                const err = new Error(URI_ERROR);
                const res = {};
                const body = null;
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                restApi.clearCache(context, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the request URI should have been rejected.");
                    })
                    .catch (function (err) {
                        try {
                            // Verify that the stub was called once with the lookup URI and once with the URI.
                            expect(stub).to.have.been.calledOnce;
                            expect(stub.firstCall.args[0].json).to.equal(true);

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.equal(URI_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when clearing the cache fails with an error response code", function (done) {
                // Create a stub for the GET requests.
                const stub = sinon.stub(request, "post");
                // The second GET request is to retrieve the items, but returns an error.
                const URI_ERROR = "HTTP Error clearing the cache.";
                const err = null;
                const res = {"statusCode": 407};
                const body = URI_ERROR;
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                restApi.clearCache(context, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the request URI should have been rejected.");
                    })
                    .catch (function (err) {
                        try {
                            // Verify that the stub was called once with the lookup URI and once with the URI.
                            expect(stub).to.have.been.calledOnce;
                            expect(stub.firstCall.args[0].uri).to.contain("http");
                            expect(stub.firstCall.args[0].json).to.equal(true);

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.equal(URI_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when clearing the cache fails with a 429 response code", function (done) {
                // Create a stub for the GET requests.
                const stub = sinon.stub(request, "post");
                // The second GET request is to retrieve the items, but returns an error.
                const URI_ERROR = "HTTP Error clearing the cache.";
                const err = null;
                const res = {"statusCode": 429};
                const body = URI_ERROR;
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                restApi.clearCache(context, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the request URI should have been rejected.");
                    })
                    .catch (function (err) {
                        try {
                            // Verify that the stub was called once with the lookup URI and once with the URI.
                            expect(stub).to.have.been.calledOnce;
                            expect(stub.firstCall.args[0].uri).to.contain("http");
                            expect(stub.firstCall.args[0].json).to.equal(true);

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.equal(URI_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when invalidating the cache succeeds", function (done) {
                // Create a stub for GET requests
                const stub = sinon.stub(request, "post");
                const err = null;
                const res = {"statusCode": 200};
                const body = {"id": "1234"};
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                restApi.clearCache(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (msg) {
                        // Verify that the stub was called twice, first with the lookup URI and then with the URI.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[0].uri).to.contain("http")
                        expect(stub.firstCall.args[0].json).to.equal(true);
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

module.exports = BaseEdgeConfigRestUnitTest;
