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
 * Unit tests for the REST object.
 */
"use strict";

// Require the super classes for this class.
const UnitTest = require("./base.unit.js");

// Require the node modules used in this test file.
const fs = require("fs");
const diff = require("diff");
const sinon = require("sinon");

// Require the local modules that will be stubbed, mocked, and spied.
const utils = require(UnitTest.API_PATH + "lib/utils/utils.js");
const request = utils.getRequestWrapper();

// The default API context used for unit tests.
const context = UnitTest.DEFAULT_API_CONTEXT;

class BaseRestUnitTest extends UnitTest {
    constructor() {
        super();
    }

    run (restApi, lookupUri, restName, itemPath1, itemPath2) {
        const self = this;
        describe("Unit tests for Rest " + restName, function() {
            // Initialize common resourses before running the unit tests.
            before(function (done) {
                UnitTest.restoreOptions(context);

                // Signal that the cleanup is complete.
                done();
            });

            // Cleanup common resources consumed by a test.
            afterEach(function (done) {
                // Restore any stubs and spies used for the test.
                self.restoreTestDoubles();

                // Signal that the cleanup is complete.
                done();
            });

            // Run each of the tests defined in this class.
            self.testSingleton(restApi, lookupUri, restName, itemPath1, itemPath2);
            self.testGetRequestOptions(restApi);
            self.testGetModifiedItemsFail(restApi, lookupUri, restName, itemPath1, itemPath2);
            self.testGetModifiedItemsSuccess(restApi, lookupUri, restName, itemPath1, itemPath2);
            self.testGetItemsFail(restApi, lookupUri, restName, itemPath1, itemPath2);
            self.testGetItemsSuccess(restApi, lookupUri, restName, itemPath1, itemPath2);
            self.testGetItem(restApi, lookupUri, restName, itemPath1, itemPath2);
            self.testGetItemByPath(restApi, lookupUri, restName, itemPath1, itemPath2);
            self.testDeleteItem(restApi, lookupUri, restName, itemPath1, itemPath2);
            self.testUpdateItem(restApi, lookupUri, restName, itemPath1, itemPath2);
            self.testCreateItem(restApi, lookupUri, restName, itemPath1, itemPath2);
        });
    }

    testSingleton (restApi, lookupUri, restName, itemPath1, itemPath2) {
        describe("is a singleton", function () {
            it("should fail if try to create a rest Type", function (done) {
                let error;
                try {
                    const api = new restApi.constructor();
                    if (api) {
                        error = "The constructor should have failed.";
                    } else {
                        error = "The constructor should have thrown an error.";
                    }
                } catch (e) {
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
                const stub = sinon.stub(restApi, "getRequestURI");

                // The second GET request is to retrieve the items, but returns an error.
                const URI_ERROR = "Error getting the request URI.";
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

            it("should succeed with valid options", function (done) {
                const opts = {
                    "x-ibm-dx-tenant-base-url": "url-1",
                    "x-ibm-dx-request-id": "test-request-id-suffix",
                    "x-ibm-dx-foo": "foo",
                    "x-ibm-dx-bar": 1,
                };

                // Call the method being tested.
                let error;
                restApi.getRequestOptions(context, opts)
                    .then(function (requestOptions) {
                        // Verify that the options contain the expected values.
                        expect(requestOptions.uri).to.contain("url-1");
                        expect(requestOptions.headers["x-ibm-dx-tenant-base-url"]).to.be.undefined;
                        expect(requestOptions.headers["x-ibm-dx-request-id"]).to.contain("test-request-id-suffix");
                        expect(requestOptions.headers["x-ibm-dx-foo"]).to.equal("foo");
                        expect(requestOptions.headers["x-ibm-dx-bar"]).to.be.undefined;
                        expect(requestOptions.headers["User-Agent"]).to.not.be.undefined;
                        expect(requestOptions.maxAttempts).to.not.be.undefined;
                        expect(requestOptions.retryStrategy).to.not.be.undefined;
                        expect(requestOptions.delayStrategy).to.not.be.undefined;
                        expect(requestOptions.instanceId).to.not.be.undefined;
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

    testGetModifiedItemsFail (restApi, lookupUri, restName, itemPath1, itemPath2) {
        const self = this;

        describe("getModifiedItemsFail", function() {
            it("should fail when getting items the fails with an error", function (done) {
                // Create a stub for the GET requests.
                const stub = sinon.stub(request, "get");

                // The second GET request is to retrieve the items, but returns an error.
                const GET_ERROR = "Error getting the items.";
                const err = new Error(GET_ERROR);
                const res = {};
                const body = null;
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                restApi.getModifiedItems(context, null, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once with the lookup URI and once with the URI.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[0].uri).to.contain("http");
                        expect(stub.firstCall.args[0].json).to.equal(true);

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.equal(GET_ERROR);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when getting the items fails with an error response code", function (done) {
                // Create a stub for the GET requests.
                const stub = sinon.stub(request, "get");

                // The second GET request is to retrieve the items, but returns an error.
                const URI_ERROR = "Error getting the items.";
                const err = null;
                const res = {"statusCode": 407};
                const body = URI_ERROR;
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                restApi.getModifiedItems(context, null, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once with the lookup URI and once with the URI.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[0].uri).to.contain("http");
                        expect(stub.firstCall.args[0].json).to.equal(true);

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.equal(URI_ERROR);
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

    testGetModifiedItemsSuccess (restApi, lookupUri, restName, itemPath1, itemPath2) {
        const self = this;

        describe("getModifiedItemsSuccess", function() {
            it("should succeed when getting valid modified items", function (done) {
                // Create a stub for GET requests
                const stub = sinon.stub(request, "get");

                // The first GET request is to retrieve the lookup URI.
                const err = null;
                const res = {"statusCode": 200};

                // The second GET request is to retrieve the items metadata.
                const item1 = UnitTest.getJsonObject(itemPath1);
                const item2 = UnitTest.getJsonObject(itemPath2);
                const body = {"items": [item1, item2]};
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                restApi.getModifiedItems(context, "some timestamp", UnitTest.DUMMY_OPTIONS)
                    .then(function (items) {
                        // Verify that the stub was called twice, first with the lookup URI and then with the URI.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[0].uri).to.contain("http");
                        expect(stub.firstCall.args[0].json).to.equal(true);

                        // Verify that the REST API returned the expected values.
                        expect(diff.diffJson(item1, items[0])).to.have.lengthOf(1);
                        expect(diff.diffJson(item2, items[1])).to.have.lengthOf(1);
                    })
                    .catch(function (err) {
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

    testGetItemsFail (restApi, lookupUri, restName, itemPath1, itemPath2) {
        const self = this;

        describe("getItemsFail", function() {
            it("should fail when getting request options fails with an error", function (done) {
                // Create a stub for the GET requests.
                const stub = sinon.stub(restApi, "getRequestOptions");

                // The call tp getRequestOptions rejects with an error.
                const GET_ERROR = "Error getting the options.";
                stub.onCall(0).rejects(new Error(GET_ERROR));

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                restApi.getItems(context, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once.
                        expect(stub).to.have.been.calledOnce;

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.equal(GET_ERROR);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when getting items fails with an error", function (done) {
                // Create a stub for the GET requests.
                const stub = sinon.stub(request, "get");

                // The GET request is to retrieve the items, but returns an error.
                const GET_ERROR = "Error getting the items.";
                const err = new Error(GET_ERROR);
                const res = null;
                const body = null;
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                restApi.getItems(context, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once with the lookup URI and once with the URI.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[0].uri).to.contain("http");
                        expect(stub.firstCall.args[0].json).to.equal(true);

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.equal(GET_ERROR);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when getting the items fails with an error response code", function (done) {
                // Create a stub for the GET requests.
                const stub = sinon.stub(request, "get");

                // The second GET request is to retrieve the items, but returns an error.
                const GET_ERROR = "Error getting the items.";
                const err = null;
                const res = {"statusCode": 407};
                const body = GET_ERROR;
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                restApi.getItems(context, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once with the lookup URI and once with the URI.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[0].uri).to.contain("http");
                        expect(stub.firstCall.args[0].json).to.equal(true);

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.equal(GET_ERROR);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when the request is retried the maximum number of times", function (done) {
                // Create a stub for the underlying GET requests.
                const stub = sinon.stub(request.Request, "request");

                // The GET request is to retrieve the items, but returns an error.
                const REQUEST_ERROR = "Error getting the items.";
                const err = new Error(REQUEST_ERROR);
                const body = null;
                stub.onCall(0).yields(err, {"statusCode": 429}, body);
                stub.onCall(1).yields(err, {"statusCode": 500}, body);
                stub.onCall(2).yields(err, {"statusCode": 502}, body);
                stub.onCall(3).yields(err, {"statusCode": 503}, body);
                stub.onCall(4).yields(err, {"statusCode": 504}, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested, using short delay value so the unit test doesn't timeout..
                let error;
                const opts = {retryMinTimeout: 10, retryMaxTimeout: 100, siteId: "foo"};
                restApi.getItems(context, opts)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once with the lookup URI and once with the asset URI.
                        expect(stub).to.have.callCount(5);
                        expect(stub.firstCall.args[0].uri).to.contain(restApi.getUriPath(context, opts));
                        expect(stub.firstCall.args[0].json).to.equal(true);

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.contain("technical difficulties");
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when the request fails with a retriable error, but maxAttempts is 1", function (done) {
                // Create a stub for the underlying GET requests.
                const stub = sinon.stub(request.Request, "request");

                // The GET request is to retrieve the items, but returns an error.
                const REQUEST_ERROR = "Error getting the items.";
                const err = new Error(REQUEST_ERROR);
                const body = null;
                stub.yields(err, {"statusCode": 500}, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested, using short delay value so the unit test doesn't timeout..
                let error;
                const opts = {retryMaxAttempts: 1, retryMinTimeout: 10, retryMaxTimeout: 100, siteId: "foo"};
                restApi.getItems(context, opts)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once with the lookup URI and once with the asset URI.
                        expect(stub).to.have.callCount(1);
                        expect(stub.firstCall.args[0].uri).to.contain(restApi.getUriPath(context, opts));
                        expect(stub.firstCall.args[0].json).to.equal(true);

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.contain("technical difficulties");
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when the request is retried then fails", function (done) {
                // Create a stub for the underlying GET requests.
                const stub = sinon.stub(request.Request, "request");

                // The GET request is to retrieve the items, but returns an error.
                const REQUEST_ERROR = "Error getting the items.";
                const err = new Error(REQUEST_ERROR);
                const body = null;
                stub.onCall(0).yields(err, {"statusCode": 403}, body);
                stub.onCall(1).yields(err, {"statusCode": 400}, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested, using short delay value so the unit test doesn't timeout..
                let error;
                const opts = {retryMinTimeout: 10, retryMaxTimeout: 100, siteId: "foo"};
                restApi.getItems(context, opts)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once with the lookup URI and once with the asset URI.
                        expect(stub).to.have.callCount(2);
                        expect(stub.firstCall.args[0].uri).to.contain(restApi.getUriPath(context, opts));
                        expect(stub.firstCall.args[0].json).to.equal(true);

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when the request is retried then fails with 403 responses", function (done) {
                // Create a stub for the underlying GET requests.
                const stub = sinon.stub(request.Request, "request");

                // The GET request is to retrieve the items, but returns an error.
                const REQUEST_ERROR = "Error getting the items.";
                const err = new Error(REQUEST_ERROR);
                const body = null;
                stub.onCall(0).yields(err, {"statusCode": 403, "body": {"errors": [{"code": 3192}]}}, body);
                stub.onCall(1).yields(err, {"statusCode": 403, "body": {"errors": [{"code": 3193}]}}, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested, using short delay value so the unit test doesn't timeout..
                let error;
                const opts = {retryMinTimeout: 10, retryMaxTimeout: 100, siteId: "foo"};
                restApi.getItems(context, opts)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once with the lookup URI and once with the asset URI.
                        expect(stub).to.have.callCount(2);
                        expect(stub.firstCall.args[0].uri).to.contain(restApi.getUriPath(context, opts));
                        expect(stub.firstCall.args[0].json).to.equal(true);

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        
            it("should succeed when the request is retried then succeeds", function (done) {
                // Create a stub for the underlying GET requests.
                const stub = sinon.stub(request.Request, "request");

                // The GET request is to retrieve the assets, but returns an error.
                const REQUEST_ERROR = "Error getting the assets.";
                const err = new Error(REQUEST_ERROR);
                const body = [];
                stub.onCall(0).yields(err, {"statusCode": 429}, body);
                stub.onCall(1).yields(null, {"statusCode": 200}, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested, using short delay value so the unit test doesn't timeout..
                let error;
                const opts = {retryMinTimeout: 10, retryMaxTimeout: 100, siteId: "foo"};
                restApi.getItems(context, opts)
                    .then(function () {
                        // Verify that the stub was called once with the lookup URI and once with the asset URI.
                        expect(stub).to.have.callCount(2);
                        expect(stub.firstCall.args[0].uri).to.contain(restApi.getUriPath(context, opts));
                        expect(stub.firstCall.args[0].json).to.equal(true);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when the request is retried the maximum number of times with custom status codes", function (done) {
                // Create a stub for the underlying GET requests.
                const stub = sinon.stub(request.Request, "request");

                // The GET request is to retrieve the assets, but returns an error.
                const REQUEST_ERROR = "Error getting the assets.";
                const err = new Error(REQUEST_ERROR);
                const body = null;
                const otherCodes = [491, 492, 493, 494, 495];
                stub.onCall(0).yields(err, {"statusCode": otherCodes[0]}, body);
                stub.onCall(1).yields(err, {"statusCode": otherCodes[1]}, body);
                stub.onCall(2).yields(err, {"statusCode": otherCodes[2]}, body);
                stub.onCall(3).yields(err, {"statusCode": otherCodes[3]}, body);
                stub.onCall(4).yields(err, {"statusCode": otherCodes[4]}, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested, using short delay value so the unit test doesn't timeout..
                let error;
                const opts = {retryMinTimeout: 10, retryMaxTimeout: 100, retryFactor: 0, retryRandomize: true, retryStatusCodes: otherCodes, siteId: "foo"};
                restApi.getItems(context, opts)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once with the lookup URI and once with the asset URI.
                        expect(stub).to.have.callCount(5);
                        expect(stub.firstCall.args[0].uri).to.contain(restApi.getUriPath(context, opts));
                        expect(stub.firstCall.args[0].json).to.equal(true);

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.contain(REQUEST_ERROR);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail without retry when the error contains no status code", function (done) {
                // Create a stub for the underlying GET requests.
                const stub = sinon.stub(request.Request, "request");

                // The GET request is to retrieve the assets, but returns an error but no status code.
                const REQUEST_ERROR = "Error getting the assets.";
                const err = new Error(REQUEST_ERROR);
                const res = {};
                const body = null;
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested, using short delay value so the unit test doesn't timeout..
                let error;
                const opts = {retryMinTimeout: 10, retryMaxTimeout: 100, siteId: "foo"};
                restApi.getItems(context, opts)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once with the lookup URI and once with the asset URI.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[0].uri).to.contain(restApi.getUriPath(context, opts));
                        expect(stub.firstCall.args[0].json).to.equal(true);

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.contain(REQUEST_ERROR);
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

    testGetItemsSuccess (restApi, lookupUri, restName, itemPath1, itemPath2) {
        const self = this;
      
        describe("getItemsSucceed", function() {
            it("should succeed when getting valid items", function (done) {
                // Create a stub for GET requests
                const stub = sinon.stub(request, "get");

                // The first GET request is to retrieve the lookup URI.
                const err = null;
                const res = {"statusCode": 200};

                // The second GET request is to retrieve the items metadata.
                const item1 = UnitTest.getJsonObject(itemPath1);
                const item2 = UnitTest.getJsonObject(itemPath2);
                const body = {"items": [item1, item2]};
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                restApi.getItems(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (items) {
                        // Verify that the stub was called twice, first with the lookup URI and then with the URI.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[0].uri).to.contain("http");
                        expect(stub.firstCall.args[0].json).to.equal(true);

                        // Verify that the REST API returned the expected values.
                        expect(diff.diffJson(item1, items[0])).to.have.lengthOf(1);
                        expect(diff.diffJson(item2, items[1])).to.have.lengthOf(1);
                    })
                    .catch(function (err) {
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

    testGetItem (restApi, lookupUri, restName, itemPath1, itemPath2) {
        const self = this;
        describe("getItem", function() {
            it("should fail when the specified item does not exist", function (done) {
                const CANNOTFIND_ERROR = "cannot find item.";
                const stub = sinon.stub(request, "get");
                const err = new Error(CANNOTFIND_ERROR);
                const res = null;
                const body = null;
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                restApi.getItem(context, UnitTest.DUMMY_ID, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the item should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.contain(CANNOTFIND_ERROR);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when getting the request options fails", function (done) {
                const OPTIONS_ERROR = "cannot get the request options";
                const stub = sinon.stub(restApi, "getRequestOptions");
                stub.onCall(0).rejects(OPTIONS_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                restApi.getItem(context, UnitTest.DUMMY_ID, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the item should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.contain(OPTIONS_ERROR);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when the specified item does not exist, but noErrorLog is specified", function (done) {
                const CANNOTFIND_ERROR = "cannot find item.";
                const stub = sinon.stub(request, "get");
                const err = new Error(CANNOTFIND_ERROR);
                const res = null;
                const body = null;
                stub.onCall(0).yields(err, res, body);

                // Create a spy for utils.logErrors to make sure it is not called.
                const spy = sinon.spy(utils, "logErrors");

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);
                self.addTestDouble(spy);

                // Call the method being tested.
                let error;
                restApi.getItem(context, itemPath1, {noErrorLog: "true"})
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the item should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called and the spy was not.
                        expect(stub).to.have.been.calledOnce;
                        expect(spy).to.not.have.been.called;

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.contain(CANNOTFIND_ERROR);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when getting a valid resource", function (done) {
                // Read the contents of a test file.
                const item =  UnitTest.getJsonObject(itemPath1);

                // Create a request.get stub that returns the item content in the body.
                const stub = sinon.stub(request, "get");
                const err = null;
                const res = {statusCode: 200};
                const body = item;
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                restApi.getItem(context, item.id, UnitTest.DUMMY_OPTIONS)
                    .then(function (content) {
                        // Verify that the item stub was called once with the expected value.
                        expect(stub).to.have.been.calledOnce;

                        // Verify that the REST API returned the expected value.
                        expect(diff.diffJson(item, content)).to.have.lengthOf(1);
                    })
                    .catch(function (err) {
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

    testGetItemByPath (restApi, lookupUri, restName, itemPath1, itemPath2) {
        const self = this;
        describe("getItemByPath", function() {
            it("should fail when the specified item does not exist", function (done) {
                const CANNOTFIND_ERROR = "cannot find item.";
                const stub = sinon.stub(request, "get");
                const err = new Error(CANNOTFIND_ERROR);
                const res = null;
                const body = null;
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                restApi.getItemByPath(context, itemPath1, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the item should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        if (restApi.supportsItemByPath()) {
                            expect(err.message).to.contain(CANNOTFIND_ERROR);
                        } else {
                            expect(err.message).to.contain("does not support the by-path endpoint");
                        }
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when the specified item does not exist, but noErrorLog is specified", function (done) {
                const CANNOTFIND_ERROR = "cannot find item.";
                const stub = sinon.stub(request, "get");
                const err = new Error(CANNOTFIND_ERROR);
                const res = null;
                const body = null;
                stub.onCall(0).yields(err, res, body);

                // Create a spy for utils.logErrors to make sure it is not called.
                const spy = sinon.spy(utils, "logErrors");

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);
                self.addTestDouble(spy);

                // Call the method being tested.
                let error;
                restApi.getItemByPath(context, itemPath1, {noErrorLog: "true"})
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the item should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called and the spy was not.
                        if (restApi.supportsItemByPath()) {
                            expect(stub).to.have.been.calledOnce;
                            expect(spy).to.not.have.been.called;
                        }

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        if (restApi.supportsItemByPath()) {
                            expect(err.message).to.contain(CANNOTFIND_ERROR);
                        } else {
                            expect(err.message).to.contain("does not support the by-path endpoint");
                        }
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when getting the request options fails", function (done) {
                const OPTIONS_ERROR = "cannot get the request options";
                const stub = sinon.stub(restApi, "getRequestOptions");
                stub.onCall(0).rejects(OPTIONS_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                restApi.getItemByPath(context, itemPath1, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the item should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        if (restApi.supportsItemByPath()) {
                            expect(err.message).to.contain(OPTIONS_ERROR);
                        } else {
                            expect(err.message).to.contain("does not support the by-path endpoint");
                        }
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when getting a valid resource", function (done) {
                if (restApi.supportsItemByPath()) {
                    // Read the contents of a test file.
                    const item =  UnitTest.getJsonObject(itemPath1);

                    // Create a request.get stub that returns the item content in the body.
                    const stub = sinon.stub(request, "get");
                    const err = null;
                    const res = {statusCode: 200};
                    const body = item;
                    stub.onCall(0).yields(err, res, body);

                    // The stub should be restored when the test is complete.
                    self.addTestDouble(stub);

                    // Call the method being tested.
                    let error;
                    restApi.getItemByPath(context, itemPath1, UnitTest.DUMMY_OPTIONS)
                        .then(function (content) {
                            // Verify that the item stub was called once with the expected value.
                            expect(stub).to.have.been.calledOnce;

                            // Verify that the REST API returned the expected value.
                            expect(diff.diffJson(item, content)).to.have.lengthOf(1);
                        })
                        .catch(function (err) {
                            // NOTE: A failed expectation from above will be handled here.
                            // Pass the error to the "done" function to indicate a failed test.
                            error = err;
                        })
                        .finally(function () {
                            // Call mocha's done function to indicate that the test is over.
                            done(error);
                        });
                } else {
                    // No-op since the REST api for this service does not support the by-path endpoint.
                    done();
                }
            });
        });
    }

    testDeleteItem (restApi, lookupUri, restName, itemPath1, itemPath2) {
        const self = this;
        describe("deleteItem", function() {
            it("should fail when getting the request options fails", function (done) {
                const OPTIONS_ERROR = "cannot get the request options";
                const stub = sinon.stub(restApi, "getRequestOptions");
                stub.onCall(0).rejects(OPTIONS_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                restApi.deleteItem(context, {id: UnitTest.DUMMY_ID})
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the item should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.contain(OPTIONS_ERROR);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when deleting the item fails", function (done) {
                // Create a stub for the DELETE request which returns an error.
                const _ERROR = "Error deleting the item.";
                const stubDelete = sinon.stub(request, "del");
                const err = new Error(_ERROR);
                const res = null;
                const body = null;
                stubDelete.yields(err, res, body);

                // Provide a filterRetryDelete method that returns true.
                context.filterRetryDelete = function () {
                    return true;
                };

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubDelete);

                // Call the method being tested.
                let error;
                restApi.deleteItem(context, {id: UnitTest.DUMMY_ID})
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the item should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the delete stub was called once with a URI that contains the specified ID.
                        expect(stubDelete).to.have.been.calledOnce;
                        expect(stubDelete.firstCall.args[0].uri).to.contain(UnitTest.DUMMY_ID);

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.contain(_ERROR);
                        expect(err.retry).to.equal(true);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Remove the filterRetryDelete method we added.
                        delete context.filterRetryDelete;

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when deleting a valid item specifies a body message", function (done) {
                // Create a stub for the DELETE request to delete the specified item.
                const DELETE_MESSAGE = "The item was deleted.";
                const stubDelete = sinon.stub(request, "del");
                const err = null;
                const res = {"statusCode": 200};
                const body = DELETE_MESSAGE;
                stubDelete.yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubDelete);

                // Call the method being tested.
                let error;
                restApi.deleteItem(context, {id:UnitTest.DUMMY_ID})
                    .then(function (message) {
                        // Verify that the delete stub was called once with a URI that contains the specified ID.
                        expect(stubDelete).to.have.been.calledOnce;
                        expect(stubDelete.firstCall.args[0].uri).to.contain(UnitTest.DUMMY_ID);

                        // Verify that the REST API returned the expected value.
                        expect(message).to.equal(DELETE_MESSAGE);
                    })
                    .catch(function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when deleting a valid item specifies no body message", function (done) {
                // Create a stub for the DELETE request to delete the specified item.
                const stubDelete = sinon.stub(request, "del");
                const err = null;
                const res = {"statusCode": 204};
                const body = null;
                stubDelete.yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubDelete);

                // Call the method being tested.
                let error;
                restApi.deleteItem(context, {id: UnitTest.DUMMY_ID})
                    .then(function (message) {
                        // Verify that the delete stub was called once with a URI that contains the specified ID.
                        expect(stubDelete).to.have.been.calledOnce;
                        expect(stubDelete.firstCall.args[0].uri).to.contain(UnitTest.DUMMY_ID);

                        // Verify that the REST API returned the expected value.
                        expect(message).to.contain(UnitTest.DUMMY_ID);
                    })
                    .catch(function (err) {
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

    testUpdateItem (restApi, lookupUri, restName, itemPath1, itemPath2) {
        const self = this;

        describe("updateItem", function() {
            it("should fail when getting the request options fails", function (done) {
                const OPTIONS_ERROR = "cannot get the request options";
                const stub = sinon.stub(restApi, "getUpdateRequestOptions");
                stub.onCall(0).rejects(OPTIONS_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                restApi.updateItem(context, {id: UnitTest.DUMMY_ID})
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the item should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.contain(OPTIONS_ERROR);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when updating item fails with an error", function (done) {
                // Create a stub for the requests.
                const stub2 = sinon.stub(request, "put");

                // The second GET request is to retrieve the items, but returns an error.
                const UPDATE_ERROR = "Error updating the item.";
                const err = new Error(UPDATE_ERROR);
                const res = null;
                const body = null;
                stub2.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub2);

                // Call the method being tested.
                let error;
                restApi.updateItem(context, {"id":"123"})
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        expect(stub2).to.have.been.calledOnce;

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.equal(UPDATE_ERROR);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when createOnly and updating an item fails with a non-conflict error", function (done) {
                // Create a stub for the POST request.
                const stubPost = sinon.stub(request, "post");
                const CREATE_ERROR = "Error creating the item.";
                const err = new Error(CREATE_ERROR);
                const res = {"statusCode": 400};
                const body = null;
                stubPost.onCall(0).yields(err, res, body);

                // Create a spy for a PUT request, which should never be called for createOnly mode.
                const spyPut = sinon.spy(request, "put");

                // Create a stub for restApi.isCreateOnlyMode() to always return true.
                const stubOnly = sinon.stub(restApi, "isCreateOnlyMode");
                stubOnly.returns(true);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubPost);
                self.addTestDouble(spyPut);
                self.addTestDouble(stubOnly);

                // Call the method being tested.
                let error;
                restApi.updateItem(context, {"id":"123"}, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify thqat the POST stub was called once and thge PUT stub was not called.
                        expect(stubPost).to.have.been.calledOnce;
                        expect(spyPut).to.not.have.been.called;

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.equal(CREATE_ERROR);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when createOnly and updating an item fails with a conflict", function (done) {
                // Create a stub for the POST request.
                const stubPost = sinon.stub(request, "post");
                const item1 = UnitTest.getJsonObject(itemPath1);
                const CREATE_ERROR = "Error creating the item.";
                const err = new Error(CREATE_ERROR);
                const res = {"statusCode": 409};
                const body = null;
                stubPost.onCall(0).yields(err, res, body);

                // Create a spy for a PUT request, which should never be called for createOnly mode.
                const spyPut = sinon.spy(request, "put");

                // Create a stub for restApi.isCreateOnlyMode() to always return true.
                const stubOnly = sinon.stub(restApi, "isCreateOnlyMode");
                stubOnly.returns(true);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubPost);
                self.addTestDouble(spyPut);
                self.addTestDouble(stubOnly);

                // Call the method being tested.
                let error;
                restApi.updateItem(context, item1, UnitTest.DUMMY_OPTIONS)
                    .then(function (item) {
                        // Verify thqat the POST stub was called once and thge PUT stub was not called.
                        expect(stubPost).to.have.been.calledOnce;
                        expect(spyPut).to.not.have.been.called;

                        // Verify that the REST API returned the expected values.
                        expect(diff.diffJson(item1, item)).to.have.lengthOf(1);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when createOnly and creating item succeeds", function (done) {
                // Create a stub for the POST request to return a conflict error.
                const stubPost = sinon.stub(request, "post");
                const item1 = UnitTest.getJsonObject(itemPath1);
                const err = null;
                const res = {"statusCode": 201};
                const body = item1;
                stubPost.onCall(0).yields(err, res, body);

                // Create a spy for a PUT request, which should never be called for createOnly mode.
                const spyPut = sinon.spy(request, "put");

                // Create a stub for restApi.isCreateOnlyMode() to always return true.
                const stubOnly = sinon.stub(restApi, "isCreateOnlyMode");
                stubOnly.returns(true);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubPost);
                self.addTestDouble(spyPut);
                self.addTestDouble(stubOnly);

                // Call the method being tested.
                let error;
                restApi.updateItem(context, item1, UnitTest.DUMMY_OPTIONS)
                    .then(function (item) {
                        // Verify thqat the POST stub was called once and thge PUT stub was not called.
                        expect(stubPost).to.have.been.calledOnce;
                        expect(spyPut).to.not.have.been.called;

                        // Verify that the REST API returned the expected values.
                        expect(diff.diffJson(item1, item)).to.have.lengthOf(1);
                    })
                    .catch(function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when updating the item fails but can be retried", function (done) {
                // Create a stub for the PUT request to return a conflict error.
                const stubPut = sinon.stub(request, "put");
                const UPDATE_ERROR = "Error updating the item, expected by unit test.";
                const err = new Error(UPDATE_ERROR);
                const res = {"statusCode": 400};
                const body = null;
                stubPut.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubPut);

                // Add a retry filter that always returns true.
                context.filterRetryPush = function () {return true;};

                // Call the method being tested.
                let error;
                restApi.updateItem(context, {"id":"123"}, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        expect(stubPut).to.have.been.calledOnce;

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.equal(UPDATE_ERROR);
                        expect(err.retry).to.equal(true);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Delete the filter that we added to the context.
                        delete context.filterRetryPush;

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when updating an item fails with a not found error and the create also fails", function (done) {
                // Create a stub for the PUT request.
                const stubPut = sinon.stub(request, "put");
                const UPDATE_ERROR = "Error updating the item.";
                let err = new Error(UPDATE_ERROR);
                let res = {"statusCode": 404};
                let body = null;
                stubPut.onCall(0).yields(err, res, body);

                // Create a stub for the POST request.
                const stubPost = sinon.stub(request, "post");
                const CREATE_ERROR = "Error creating the item.";
                err = new Error(CREATE_ERROR);
                res = {"statusCode": 400};
                body = null;
                stubPost.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubPost);
                self.addTestDouble(stubPut);

                // Call the method being tested.
                let error;
                restApi.updateItem(context, {"id":"123"}, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify thqat the POST stub was called once and thge PUT stub was not called.
                        expect(stubPost).to.have.been.calledOnce;
                        expect(stubPut).to.have.been.calledOnce;

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.equal(CREATE_ERROR);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when updating an item fails with a not found error and the create succeeds", function (done) {
                // Create a stub for the PUT request.
                const stubPut = sinon.stub(request, "put");
                const UPDATE_ERROR = "Error updating the item.";
                let err = new Error(UPDATE_ERROR);
                let res = {"statusCode": 404};
                let body = null;
                stubPut.onCall(0).yields(err, res, body);

                // Create a stub for the POST request to return a conflict error.
                const stubPost = sinon.stub(request, "post");
                const item1 = UnitTest.getJsonObject(itemPath1);
                err = null;
                res = {"statusCode": 201};
                body = item1;
                stubPost.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubPost);
                self.addTestDouble(stubPut);

                // Call the method being tested.
                let error;
                restApi.updateItem(context, item1, UnitTest.DUMMY_OPTIONS)
                    .then(function (item) {
                        // Verify thqat the PUT anbd POST stubs were called once.
                        expect(stubPost).to.have.been.calledOnce;
                        expect(stubPut).to.have.been.calledOnce;

                        // Verify that the REST API returned the expected values.
                        expect(diff.diffJson(item1, item)).to.have.lengthOf(1);
                    })
                    .catch(function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when updating the item fails with an error response code", function (done) {
                // Create a stub for the GET requests.
                const stub2 = sinon.stub(request, "put");

                // The second GET request is to retrieve the items, but returns an error.
                const UPDATE_ERROR = "Error updating the item.";
                const err = null;
                const res = {"statusCode": 407};
                const body = UPDATE_ERROR;
                stub2.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub2);

                // Call the method being tested.
                let error;
                restApi.updateItem(context, {"id":"123"})
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        expect(stub2).to.have.been.calledOnce;

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.equal(UPDATE_ERROR);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when updating valid items", function (done) {
                const err = null;
                const res = {"statusCode": 200};
                // The second GET request is to retrieve the items metadata.
                const stub2 = sinon.stub(request, "put");
                const item1 = UnitTest.getJsonObject(itemPath1);
                const body = item1;
                stub2.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub2);

                // Call the method being tested.
                let error;
                restApi.updateItem(context, item1)
                    .then(function (item) {
                        expect(stub2).to.have.been.calledOnce;

                        // Verify that the REST API returned the expected values.
                        expect(diff.diffJson(item1, item)).to.have.lengthOf(1);
                    })
                    .catch(function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should include forceOverride in update URL if force-override option passed", function (done) {
                const err = null;
                const res = {"statusCode": 200};
                // The second GET request is to retrieve the items metadata.
                const stub = sinon.stub(request, "put");
                const item1 = UnitTest.getJsonObject(itemPath1);
                const body = null;
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                const stubOverride = sinon.stub(restApi, "supportsForceOverride");
                stubOverride.returns(true);
                self.addTestDouble(stubOverride);

                // Call the method being tested.
                let error;
                restApi.updateItem(context, item1, {"force-override": true})
                    .then(function (/*item*/) {
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[0].uri).to.contain("forceOverride=true");
                    })
                    .catch(function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });


            it("should NOT include forceOverride in update URL if this rest API doesn't support override", function (done) {
                const err = null;
                const res = {"statusCode": 200};
                // The second GET request is to retrieve the items metadata.
                const stub = sinon.stub(request, "put");
                const item1 = UnitTest.getJsonObject(itemPath1);
                const body = item1;
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                const stubOverride = sinon.stub(restApi, "supportsForceOverride");
                stubOverride.returns(false);
                self.addTestDouble(stubOverride);

                // Call the method being tested.
                let error;
                restApi.updateItem(context, item1, {"force-override": true})
                    .then(function (/*item*/) {
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[0].uri).to.not.contain("forceOverride=true");
                    })
                    .catch(function (err) {
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

    testCreateItem (restApi, lookupUri, restName, itemPath1, itemPath2) {
        const self = this;

        // Execute several failure cases to test the various ways the server might return an error. Subsequent tests do
        // not need to repeat the test matrix, they can just execute one of these tests to verify an error is returned.
        describe("createItem", function() {
            it("should fail when getting the request options fails", function (done) {
                const OPTIONS_ERROR = "cannot get the request options";
                const stub = sinon.stub(restApi, "getUpdateRequestOptions");
                stub.rejects(OPTIONS_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                restApi.createItem(context, {id: UnitTest.DUMMY_ID})
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the item should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.contain(OPTIONS_ERROR);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when creating item fails with an error", function (done) {
                // Create a stub for the requests.
                const stub2 = sinon.stub(request, "post");

                // The second GET request is to retrieve the items, but returns an error.
                const CREATE_ERROR = "Error creating the item.";
                const err = new Error(CREATE_ERROR);
                const res = null;
                const body = null;
                stub2.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub2);

                // Call the method being tested.
                let error;
                restApi.createItem(context, {"id":"123"}, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        expect(stub2).to.have.been.calledOnce;

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.equal(CREATE_ERROR);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when creating the item fails with an error response code", function (done) {
                // Create a stub for the GET requests.
                const stub2 = sinon.stub(request, "post");

                // The second GET request is to retrieve the items, but returns an error.
                const UPDATE_ERROR = "Error creating the item.";
                const err = null;
                const res = {"statusCode": 407};
                const body = UPDATE_ERROR;
                stub2.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub2);

                // Call the method being tested.
                let error;
                restApi.createItem(context, {"id":"123"}, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        expect(stub2).to.have.been.calledOnce;

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.equal(UPDATE_ERROR);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when creating the item fails but can be retried", function (done) {
                // Create a stub for the POST request to return a conflict error.
                const stubPost = sinon.stub(request, "post");
                const UPDATE_ERROR = "Error creating the item, expected by unit test.";
                const err = new Error(UPDATE_ERROR);
                const res = {"statusCode": 400};
                const body = null;
                stubPost.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubPost);

                // Add a retry filter that always returns true.
                context.filterRetryPush = function () {return true;};

                // Call the method being tested.
                let error;
                restApi.createItem(context, {"id":"123"}, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        expect(stubPost).to.have.been.calledOnce;

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.equal(UPDATE_ERROR);
                        expect(err.retry).to.equal(true);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Delete the filter that we added to the context.
                        delete context.filterRetryPush;

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when creating valid items", function (done) {
                // Create a stub for the POST request to return a conflict error.
                const err = null;
                const res = {"statusCode": 200};
                // The second GET request is to retrieve the items metadata.
                const stub2 = sinon.stub(request, "post");
                const item1 = UnitTest.getJsonObject(itemPath1);
                const body = item1;
                stub2.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub2);

                // Call the method being tested.
                let error;
                restApi.createItem(context, item1, UnitTest.DUMMY_OPTIONS)
                    .then(function (item) {
                        expect(stub2).to.have.been.calledOnce;

                        // Verify that the REST API returned the expected values.
                        expect(diff.diffJson(item1, item)).to.have.lengthOf(1);
                    })
                    .catch(function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when createOnly and item already exists", function (done) {
                // Create a stub for the POST request to return a conflict error.
                const stubPost = sinon.stub(request, "post");
                const item1 = UnitTest.getJsonObject(itemPath1);
                const err = null;
                const res = {"statusCode": 409};
                const body = item1;
                stubPost.onCall(0).yields(err, res, body);

                // Create a stub for restApi.isCreateOnlyMode() to always return true.
                const stubOnly = sinon.stub(restApi, "isCreateOnlyMode");
                stubOnly.returns(true);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubPost);
                self.addTestDouble(stubOnly);

                // Call the method being tested.
                let error;
                restApi.createItem(context, item1, UnitTest.DUMMY_OPTIONS)
                    .then(function (item) {
                        expect(stubPost).to.have.been.calledOnce;

                        // Verify that the REST API returned the expected values.
                        expect(diff.diffJson(item1, item)).to.have.lengthOf(1);
                    })
                    .catch(function (err) {
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

module.exports = BaseRestUnitTest;
