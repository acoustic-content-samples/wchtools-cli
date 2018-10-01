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
 * Unit tests for the assetsREST object.
 */
"use strict";

// Require the super classes for this class.
const UnitTest = require("./base.unit.js");
const AssetsUnitTest = require("./assets.unit.js");

// Require the node modules used in this test file.
const fs = require("fs");
const Stream = require("stream");
const diff = require("diff");
const sinon = require("sinon");

// Require the local modules that will be stubbed, mocked, and spied.
const utils = require(UnitTest.API_PATH + "lib/utils/utils.js");
const request = utils.getRequestWrapper();

// Require the local module being tested.
const AssetsREST = require(UnitTest.API_PATH + "lib/assetsREST.js");
const assetsREST = AssetsREST.instance;

const DUMMY_HTML_FILE_NAME = "dummy.html";
const DUMMY_MD5_HASH = "1234567890";
const DUMMY_REQUEST_OPTIONS = {"x-ibm-dx-tenant-base-url": "dummy-url"};
const DUMMY_PUBLISH_NOW_REQUEST_OPTIONS = {"x-ibm-dx-tenant-base-url": "dummy-url", "publish-now":true};

// The default API context used for unit tests.
const context = UnitTest.DEFAULT_API_CONTEXT;

class AssetsRestUnitTest extends AssetsUnitTest {
    constructor() {
        super();
    }

    run () {
        const self = this;
        describe("Unit tests for assetsREST.js", function() {
            // Cleanup common resourses consumed by a test.
            afterEach(function (done) {
                // Restore any stubs and spies used for the test.
                self.restoreTestDoubles();

                // Signal that the cleanup is complete.
                done();
            });

            // Run each of the tests defined in this class.
            self.testSingleton();
            self.testGetResourceHeaders();
            self.testGetDownloadRequestOptions();
            self.testGetResourceListRequestOptions();
            self.testGetAssetUpdateRequestOptions();
            self.testGetResourcePOSTOptions();
            self.testGetResourcePUTOptions();
            self.testGetItems();
            self.testGetResourceList();
            self.testExtractFilename();
            self.testPushItem();
            self.testPullItem();
            self.testDeleteItem();
        });
    }

    testSingleton () {
        describe("Constructor", function () {
            it("should fail if try to construct an assetsREST directly", function (done) {
                let error;
                try {
                    const api = new AssetsREST();
                    if (api) {
                        error = "The constructor should have failed.";
                    } else {
                        error = "The constructor should have thrown an error.";
                    }
                } catch (e) {
                    expect(e).to.equal("An instance of singleton class " + assetsREST.constructor.name + " cannot be constructed");
                }

                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
        });
    }

    testGetResourceHeaders () {
        describe("getResourceHeaders", function () {
            it("should succeed when a name is specified", function (done) {
                let error = undefined;
                try {
                    const headers = AssetsREST.getResourceHeaders(context, "dummy.jpg");
                    expect(headers).to.exist;
                    expect(headers["Accept"]).to.equal("application/json");
                    expect(headers["Accept-Language"]).to.contain("en");
                    expect(headers["Content-Type"]).to.equal("image/jpeg");
                    expect(headers["Connection"]).to.equal("keep-alive");
                } catch (err) {
                    error = err;
                } finally {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
            });

            it("should succeed when no name is specified", function (done) {
                let error = undefined;
                try {
                    const headers = AssetsREST.getResourceHeaders(context);
                    expect(headers).to.exist;
                    expect(headers["Accept"]).to.equal("application/json");
                    expect(headers["Accept-Language"]).to.contain("en");
                    expect(headers["Content-Type"]).to.equal("text/plain");
                    expect(headers["Connection"]).to.equal("keep-alive");
                } catch (err) {
                    error = err;
                } finally {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
            });
        });
    }

    testGetDownloadRequestOptions () {
        const self = this;

        describe("getDownloadRequestOptions", function () {
            it("should succeed with valid options", function (done) {
                let error;
                assetsREST.getDownloadRequestOptions(context, DUMMY_REQUEST_OPTIONS)
                    .then(function (requestOptions) {
                        expect(requestOptions).to.exist;
                        expect(requestOptions.uri).to.contain(DUMMY_REQUEST_OPTIONS["x-ibm-dx-tenant-base-url"]);
                        expect(requestOptions.uri).to.contain("/authoring/v1/resources");
                        expect(requestOptions.headers).to.exist;
                        expect(requestOptions.headers["Accept"]).to.equal("*/*");
                        expect(requestOptions.headers["Accept-Language"]).to.contain("en");
                        expect(requestOptions.headers["Connection"]).to.equal("keep-alive");
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed with a generic URI if a tenant-base-uri is not defined", function (done) {
                // Create a stub for the AssetsREST.getRequestURI method to return a known URI.
                const stub = sinon.stub(assetsREST, "getRequestURI");
                stub.resolves(UnitTest.DUMMY_URI);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested, passing an empty context (no tenant-base-uri property).
                let error;
                assetsREST.getDownloadRequestOptions({})
                    .then(function (requestOptions) {
                        expect(requestOptions).to.exist;
                        expect(requestOptions.uri).to.contain(UnitTest.DUMMY_URI);
                        expect(requestOptions.uri).to.contain("/authoring/v1/resources");
                        expect(requestOptions.headers).to.exist;
                        expect(requestOptions.headers["Accept"]).to.equal("*/*");
                        expect(requestOptions.headers["Accept-Language"]).to.contain("en");
                        expect(requestOptions.headers["Connection"]).to.equal("keep-alive");
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when getting the URI fails", function (done) {
                // Create a stub for AssetsREST.getRequestURI to return an error.
                const ASSETS_URI_ERROR = "Error getting the assets URI.";
                const stub = sinon.stub(assetsREST, "getRequestURI");
                stub.rejects(ASSETS_URI_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsREST.getDownloadRequestOptions(context, DUMMY_REQUEST_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once.
                        expect(stub).to.have.been.calledOnce;

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.equal(ASSETS_URI_ERROR);
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

    testGetResourceListRequestOptions () {
        const self = this;

        describe("getResourceListRequestOptions", function () {
            it("should succeed with valid options", function (done) {
                let error;
                assetsREST.getResourceListRequestOptions(context, DUMMY_REQUEST_OPTIONS)
                    .then(function (requestOptions) {
                        expect(requestOptions).to.exist;
                        expect(requestOptions.uri).to.contain(DUMMY_REQUEST_OPTIONS["x-ibm-dx-tenant-base-url"]);
                        expect(requestOptions.uri).to.contain("/authoring/v1/resources/views/by-created");
                        expect(requestOptions.headers).to.exist;
                        expect(requestOptions.headers["Accept"]).to.equal("application/json");
                        expect(requestOptions.headers["Accept-Language"]).to.contain("en");
                        expect(requestOptions.headers["Connection"]).to.equal("keep-alive");
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed with a generic URI if a tenant-base-uri is not defined", function (done) {
                // Create a stub for the AssetsREST.getRequestURI method to return a known URI.
                const stub = sinon.stub(assetsREST, "getRequestURI");
                stub.resolves(UnitTest.DUMMY_URI);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested, passing an empty context (no tenant-base-uri property).
                let error;
                assetsREST.getResourceListRequestOptions({})
                    .then(function (requestOptions) {
                        expect(requestOptions).to.exist;
                        expect(requestOptions.uri).to.contain(UnitTest.DUMMY_URI);
                        expect(requestOptions.uri).to.contain("/authoring/v1/resources/views/by-created");
                        expect(requestOptions.headers).to.exist;
                        expect(requestOptions.headers["Accept"]).to.equal("application/json");
                        expect(requestOptions.headers["Accept-Language"]).to.contain("en");
                        expect(requestOptions.headers["Connection"]).to.equal("keep-alive");
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when getting the URI fails", function (done) {
                // Create a stub for AssetsREST.getRequestURI to return an error.
                const ASSETS_URI_ERROR = "Error getting the assets URI.";
                const stub = sinon.stub(assetsREST, "getRequestURI");
                stub.rejects(ASSETS_URI_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsREST.getResourceListRequestOptions(context, DUMMY_REQUEST_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the resource list request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once.
                        expect(stub).to.have.been.calledOnce;

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.equal(ASSETS_URI_ERROR);
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

    testGetAssetUpdateRequestOptions () {
        const self = this;

        describe("getAssetUpdateRequestOptions", function () {
            it("should succeed with a valid ID and options", function (done) {
                let error;
                assetsREST.getAssetUpdateRequestOptions(context, UnitTest.DUMMY_ID, DUMMY_PUBLISH_NOW_REQUEST_OPTIONS)
                    .then(function (requestOptions) {
                        expect(requestOptions).to.exist;
                        expect(requestOptions.uri).to.contain("/authoring/v1/assets");
                        expect(requestOptions.uri).to.contain(DUMMY_REQUEST_OPTIONS["x-ibm-dx-tenant-base-url"]);
                        expect(requestOptions.headers).to.exist;
                        expect(requestOptions.headers["Accept"]).to.equal("application/json");
                        expect(requestOptions.headers["Accept-Language"]).to.contain("en");
                        expect(requestOptions.headers["Content-Type"]).to.equal("application/json");
                        expect(requestOptions.headers["Connection"]).to.equal("keep-alive");
                        expect(requestOptions.headers["x-ibm-dx-publish-priority"]).to.exist;
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when getting the URI fails", function (done) {
                // Create a stub for AssetsREST.getRequestURI to return an error.
                const ASSETS_URI_ERROR = "Error getting the assets URI.";
                const stub = sinon.stub(assetsREST, "getRequestURI");
                stub.rejects(ASSETS_URI_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsREST.getAssetUpdateRequestOptions(context, UnitTest.DUMMY_ID, DUMMY_REQUEST_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once.
                        expect(stub).to.have.been.calledOnce;

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.equal(ASSETS_URI_ERROR);
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

    testGetResourcePOSTOptions () {
        const self = this;

        describe("getResourcePOSTOptions", function () {
            it("should succeed with a valid name and options", function (done) {
                let error;
                assetsREST.getResourcePOSTOptions(context, DUMMY_HTML_FILE_NAME, DUMMY_REQUEST_OPTIONS)
                    .then(function (requestOptions) {
                        expect(requestOptions).to.exist;
                        expect(requestOptions.uri).to.contain("/authoring/v1/resources");
                        expect(requestOptions.uri).to.contain(DUMMY_REQUEST_OPTIONS["x-ibm-dx-tenant-base-url"]);
                        expect(requestOptions.uri).to.contain(DUMMY_HTML_FILE_NAME);
                        expect(requestOptions.headers).to.exist;
                        expect(requestOptions.headers["Accept"]).to.equal("application/json");
                        expect(requestOptions.headers["Accept-Language"]).to.contain("en");
                        expect(requestOptions.headers["Content-Type"]).to.equal("text/html");
                        expect(requestOptions.headers["Connection"]).to.equal("keep-alive");
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed with a generic URI if a tenant-base-uri is not defined", function (done) {
                // Create a stub for the AssetsREST.getRequestURI method to return a known URI.
                const stub = sinon.stub(assetsREST, "getRequestURI");
                stub.resolves(UnitTest.DUMMY_URI);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested, passing an empty context (no tenant-base-uri property).
                let error;
                assetsREST.getResourcePOSTOptions({}, DUMMY_HTML_FILE_NAME)
                    .then(function (requestOptions) {
                        expect(requestOptions).to.exist;
                        expect(requestOptions.uri).to.contain("/authoring/v1/resources");
                        expect(requestOptions.uri).to.contain(UnitTest.DUMMY_URI);
                        expect(requestOptions.uri).to.contain(DUMMY_HTML_FILE_NAME);
                        expect(requestOptions.headers).to.exist;
                        expect(requestOptions.headers["Accept"]).to.equal("application/json");
                        expect(requestOptions.headers["Accept-Language"]).to.contain("en");
                        expect(requestOptions.headers["Content-Type"]).to.equal("text/html");
                        expect(requestOptions.headers["Connection"]).to.equal("keep-alive");
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when getting the URI fails", function (done) {
                // Create a stub for AssetsREST.getRequestURI to return an error.
                const ASSETS_URI_ERROR = "Error getting the assets URI.";
                const stub = sinon.stub(assetsREST, "getRequestURI");
                stub.rejects(ASSETS_URI_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsREST.getResourcePOSTOptions(context, DUMMY_HTML_FILE_NAME, DUMMY_REQUEST_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once.
                        expect(stub).to.have.been.calledOnce;

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.equal(ASSETS_URI_ERROR);
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

    testGetResourcePUTOptions () {
        const self = this;

        describe("getResourcePUTOptions", function () {
            it("should succeed with all parameters specified", function (done) {
                let error;
                assetsREST.getResourcePUTOptions(context, UnitTest.DUMMY_ID, DUMMY_MD5_HASH, DUMMY_HTML_FILE_NAME, DUMMY_REQUEST_OPTIONS)
                    .then(function (requestOptions) {
                        expect(requestOptions).to.exist;
                        expect(requestOptions.uri).to.contain("/authoring/v1/resources");
                        expect(requestOptions.uri).to.contain(DUMMY_REQUEST_OPTIONS["x-ibm-dx-tenant-base-url"]);
                        expect(requestOptions.uri).to.contain(UnitTest.DUMMY_ID);
                        expect(requestOptions.uri).to.contain(DUMMY_HTML_FILE_NAME);
                        expect(requestOptions.uri).to.contain(DUMMY_MD5_HASH);
                        expect(requestOptions.headers).to.exist;
                        expect(requestOptions.headers["Accept"]).to.equal("application/json");
                        expect(requestOptions.headers["Accept-Language"]).to.contain("en");
                        expect(requestOptions.headers["Content-Type"]).to.equal("text/html");
                        expect(requestOptions.headers["Connection"]).to.equal("keep-alive");
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed with a generic URI if a tenant-base-uri is not defined", function (done) {
                // Create a stub for the AssetsREST.getRequestURI method to return a known URI.
                const stub = sinon.stub(assetsREST, "getRequestURI");
                stub.resolves(UnitTest.DUMMY_URI);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested, passing an empty context (no tenant-base-uri property).
                let error;
                assetsREST.getResourcePUTOptions({}, UnitTest.DUMMY_ID, DUMMY_MD5_HASH, DUMMY_HTML_FILE_NAME)
                    .then(function (requestOptions) {
                        expect(requestOptions).to.exist;
                        expect(requestOptions.uri).to.contain("/authoring/v1/resources");
                        expect(requestOptions.uri).to.contain(UnitTest.DUMMY_URI);
                        expect(requestOptions.uri).to.contain(UnitTest.DUMMY_ID);
                        expect(requestOptions.uri).to.contain(DUMMY_HTML_FILE_NAME);
                        expect(requestOptions.uri).to.contain(DUMMY_MD5_HASH);
                        expect(requestOptions.headers).to.exist;
                        expect(requestOptions.headers["Accept"]).to.equal("application/json");
                        expect(requestOptions.headers["Accept-Language"]).to.contain("en");
                        expect(requestOptions.headers["Content-Type"]).to.equal("text/html");
                        expect(requestOptions.headers["Connection"]).to.equal("keep-alive");
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed with no ID or MD5 parameters specified", function (done) {
                let error;
                assetsREST.getResourcePUTOptions(context, null, null, DUMMY_HTML_FILE_NAME, DUMMY_REQUEST_OPTIONS)
                    .then(function (requestOptions) {
                        expect(requestOptions).to.exist;
                        expect(requestOptions.uri).to.contain("/authoring/v1/resources");
                        expect(requestOptions.uri).to.contain(DUMMY_REQUEST_OPTIONS["x-ibm-dx-tenant-base-url"]);
                        expect(requestOptions.uri).to.contain(DUMMY_HTML_FILE_NAME);
                        expect(requestOptions.headers).to.exist;
                        expect(requestOptions.headers["Accept"]).to.equal("application/json");
                        expect(requestOptions.headers["Accept-Language"]).to.contain("en");
                        expect(requestOptions.headers["Content-Type"]).to.equal("text/html");
                        expect(requestOptions.headers["Connection"]).to.equal("keep-alive");
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when getting the URI fails", function (done) {
                // Create a stub for AssetsREST.getRequestURI to return an error.
                const ASSETS_URI_ERROR = "Error getting the assets URI.";
                const stub = sinon.stub(assetsREST, "getRequestURI");
                stub.rejects(ASSETS_URI_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsREST.getResourcePUTOptions(context, UnitTest.DUMMY_ID, DUMMY_MD5_HASH, DUMMY_HTML_FILE_NAME, DUMMY_REQUEST_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once.
                        expect(stub).to.have.been.calledOnce;

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.equal(ASSETS_URI_ERROR);
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

    testGetItems () {
        const self = this;

        // Execute several failure cases to test the various ways the server might return an error. Subsequent tests do
        // not need to repeat the test matrix, they can just execute one of these tests to verify an error is returned.
        describe("getItems", function() {
            it("should fail when getting the assets fails with an error", function (done) {
                // Create a stub for the GET requests.
                const stub = sinon.stub(request, "get");
                const GET_ERROR = "Error getting the assets.";
                const err = new Error(GET_ERROR);
                const res = {};
                const body = null;
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsREST.getItems(context, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once with the asset URI.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[0].uri).to.contain("/authoring/v1/assets");
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

            it("should fail when getting the assets fails with an error response code", function (done) {
                // Create a stub for the GET requests.
                const stub = sinon.stub(request, "get");

                // The GET request is to retrieve the assets, but returns an error.
                const GET_ERROR = "Error getting the assets.";
                const err = null;
                const res = {"statusCode": 407};
                const body = GET_ERROR;
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsREST.getItems(context, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once with the lookup URI and once with the asset URI.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[0].uri).to.contain("/authoring/v1/assets");
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

                // The GET request is to retrieve the assets, but returns an error.
                const REQUEST_ERROR = "Error getting the assets.";
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
                assetsREST.getItems(context, {retryMinTimeout: 10, retryMaxTimeout: 100})
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once with the lookup URI and once with the asset URI.
                        expect(stub).to.have.callCount(5);
                        expect(stub.firstCall.args[0].uri).to.contain("/authoring/v1/assets");
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

                // The GET request is to retrieve the assets, but returns an error.
                const REQUEST_ERROR = "Error getting the assets.";
                const err = new Error(REQUEST_ERROR);
                const body = null;
                stub.onCall(0).yields(err, {"statusCode": 500}, body);
                stub.onCall(1).yields(err, {"statusCode": 400}, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested, using short delay value so the unit test doesn't timeout..
                let error;
                assetsREST.getItems(context, {retryMinTimeout: 10, retryMaxTimeout: 100})
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once with the lookup URI and once with the asset URI.
                        expect(stub).to.have.callCount(2);
                        expect(stub.firstCall.args[0].uri).to.contain("/authoring/v1/assets");
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

            it("should succeed when the request is retried then succeeds", function (done) {
                // Create a stub for the underlying GET requests.
                const stub = sinon.stub(request.Request, "request");

                // The GET request is to retrieve the assets, but returns an error.
                const REQUEST_ERROR = "Error getting the assets.";
                const err = new Error(REQUEST_ERROR);
                const body = {};
                stub.onCall(0).yields(err, {"statusCode": 429}, body);
                stub.onCall(1).yields(null, {"statusCode": 200}, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested, using short delay value so the unit test doesn't timeout..
                let error;
                assetsREST.getItems(context, {retryMinTimeout: 10, retryMaxTimeout: 100})
                    .then(function () {
                        // Verify that the stub was called once with the lookup URI and once with the asset URI.
                        expect(stub).to.have.callCount(2);
                        expect(stub.firstCall.args[0].uri).to.contain("/authoring/v1/assets");
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
                assetsREST.getItems(context, {retryMinTimeout: 10, retryMaxTimeout: 100, retryFactor: 0, retryRandomize: true, retryStatusCodes: otherCodes})
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once with the lookup URI and once with the asset URI.
                        expect(stub).to.have.callCount(5);
                        expect(stub.firstCall.args[0].uri).to.contain("/authoring/v1/assets");
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
                assetsREST.getItems(context, {retryMinTimeout: 10, retryMaxTimeout: 100})
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once with the lookup URI and once with the asset URI.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[0].uri).to.contain("/authoring/v1/assets");
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

            it("should succeed when getting valid assets", function (done) {
                // Create a stub for GET requests
                const stub = sinon.stub(request, "get");

                // The first GET request is to retrieve the assets lookup URI.
                const err = null;
                const res = {"statusCode": 200};

                // The second GET request is to retrieve the assets metadata.
                const assetMetadataPath1 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JPG_1;
                const assetMetadataPath2 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_GIF_1;
                const assetMetadataPath3 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_PNG_1;
                const assetMetadataPath4 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CSS_1;
                const assetMetadataPath5 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JAR_1;
                const assetMetadata1 = UnitTest.getJsonObject(assetMetadataPath1);
                const assetMetadata2 = UnitTest.getJsonObject(assetMetadataPath2);
                const assetMetadata3 = UnitTest.getJsonObject(assetMetadataPath3);
                const assetMetadata4 = UnitTest.getJsonObject(assetMetadataPath4);
                const assetMetadata5 = UnitTest.getJsonObject(assetMetadataPath5);
                const body = {"items": [assetMetadata1, assetMetadata2, assetMetadata3, assetMetadata4, assetMetadata5]};
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsREST.getItems(context, {offset: 10, limit:5})
                    .then(function (assets) {
                        // Verify that the stub was called twice, first with the lookup URI and then with the asset URI.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[0].uri).to.contain("/authoring/v1/assets");

                        // Verify that the specified offset and limit are reflected in the URI.
                        expect(stub.firstCall.args[0].uri).to.match(/.*offset=10.*/);
                        expect(stub.firstCall.args[0].uri).to.match(/.*limit=5.*/);

                        // Verify that the REST API returned the expected values.
                        expect(diff.diffJson(assetMetadata1, assets[0])).to.have.lengthOf(1);
                        expect(diff.diffJson(assetMetadata2, assets[1])).to.have.lengthOf(1);
                        expect(diff.diffJson(assetMetadata3, assets[2])).to.have.lengthOf(1);
                        expect(diff.diffJson(assetMetadata4, assets[3])).to.have.lengthOf(1);
                        expect(diff.diffJson(assetMetadata5, assets[4])).to.have.lengthOf(1);
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

    testGetResourceList () {
        const self = this;

        describe("getResourceList", function() {
            it("should fail when getting request options fails with an error", function (done) {
                // Create a stub for getting the request options that rejects with an error.
                const stub = sinon.stub(assetsREST, "getResourceListRequestOptions");
                const GET_ERROR = "Error getting the options.";
                stub.onCall(0).rejects(new Error(GET_ERROR));

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsREST.getResourceList(context, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the resource list should have been rejected.");
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

            it("should fail when getting the resources fails with an error", function (done) {
                // Create a stub for the GET requests.
                 const stub = sinon.stub(request, "get");
                const GET_ERROR = "Error getting the resources.";
                const err = new Error(GET_ERROR);
                const res = null;
                const body = null;
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsREST.getResourceList(context, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the resource list should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once with the asset URI.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[0].uri).to.contain("/authoring/v1/resources/views/by-created");

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

            it("should fail when getting the assets fails with an error response code", function (done) {
                // Create a stub for the GET requests.
                const stub = sinon.stub(request, "get");

                // The GET request is to retrieve the assets, but returns an error.
                const GET_ERROR = "Error getting the assets.";
                const err = null;
                const res = {"statusCode": 407};
                const body = GET_ERROR;
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsREST.getResourceList(context, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset resource list should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once with the lookup URI and once with the asset URI.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[0].uri).to.contain("/authoring/v1/resources/views/by-created");

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

            it("should succeed when getting valid resources - body string", function (done) {
                // Create a stub for GET requests
                const stub = sinon.stub(request, "get");

                // The first GET request is to retrieve the assets lookup URI.
                const err = null;
                const res = {"statusCode": 200};

                // The GET request is to retrieve the assets metadata.
                const resourceMetadataPath1 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JPG_1;
                const resourceMetadataPath2 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_GIF_1;
                const resourceMetadataPath3 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_PNG_1;
                const resourceMetadataPath4 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CSS_1;
                const resourceMetadataPath5 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JAR_1;
                const resourceMetadataString1 = fs.readFileSync(resourceMetadataPath1 + ".json");
                const resourceMetadataString2 = fs.readFileSync(resourceMetadataPath2 + ".json");
                const resourceMetadataString3 = fs.readFileSync(resourceMetadataPath3 + ".json");
                const resourceMetadataString4 = fs.readFileSync(resourceMetadataPath4 + ".json");
                const resourceMetadataString5 = fs.readFileSync(resourceMetadataPath5 + ".json");
                const body = '[' + resourceMetadataString1 + ', ' + resourceMetadataString2 + ', ' +
                    resourceMetadataString3 + ', ' + resourceMetadataString4 + ', ' + resourceMetadataString5 + ']';
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsREST.getResourceList(context, {offset: 10, limit:5})
                    .then(function (resources) {
                        // Verify that the stub was called twice, first with the lookup URI and then with the asset URI.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[0].uri).to.contain("/authoring/v1/resources/views/by-created");

                        // Verify that the specified offset and limit are reflected in the URI.
                        expect(stub.firstCall.args[0].uri).to.match(/.*offset=10.*/);
                        expect(stub.firstCall.args[0].uri).to.match(/.*limit=5.*/);

                        // Verify that the REST API returned the expected values.
                        expect(diff.diffJson(JSON.parse(resourceMetadataString1), resources[0])).to.have.lengthOf(1);
                        expect(diff.diffJson(JSON.parse(resourceMetadataString2), resources[1])).to.have.lengthOf(1);
                        expect(diff.diffJson(JSON.parse(resourceMetadataString3), resources[2])).to.have.lengthOf(1);
                        expect(diff.diffJson(JSON.parse(resourceMetadataString4), resources[3])).to.have.lengthOf(1);
                        expect(diff.diffJson(JSON.parse(resourceMetadataString5), resources[4])).to.have.lengthOf(1);
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

            it("should succeed when getting valid resources - body string with items", function (done) {
                // Create a stub for GET requests
                const stub = sinon.stub(request, "get");

                // The first GET request is to retrieve the assets lookup URI.
                const err = null;
                const res = {"statusCode": 200};

                // The GET request is to retrieve the assets metadata.
                const resourceMetadataPath1 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JPG_1;
                const resourceMetadataPath2 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_GIF_1;
                const resourceMetadataPath3 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_PNG_1;
                const resourceMetadataPath4 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CSS_1;
                const resourceMetadataPath5 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JAR_1;
                const resourceMetadataString1 = fs.readFileSync(resourceMetadataPath1 + ".json");
                const resourceMetadataString2 = fs.readFileSync(resourceMetadataPath2 + ".json");
                const resourceMetadataString3 = fs.readFileSync(resourceMetadataPath3 + ".json");
                const resourceMetadataString4 = fs.readFileSync(resourceMetadataPath4 + ".json");
                const resourceMetadataString5 = fs.readFileSync(resourceMetadataPath5 + ".json");
                const body = '{"items": [' + resourceMetadataString1 + ', ' + resourceMetadataString2 + ', ' +
                    resourceMetadataString3 + ', ' + resourceMetadataString4 + ', ' + resourceMetadataString5 + ']}';
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsREST.getResourceList(context, {offset: 10, limit:5})
                    .then(function (resources) {
                        // Verify that the stub was called twice, first with the lookup URI and then with the asset URI.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[0].uri).to.contain("/authoring/v1/resources/views/by-created");

                        // Verify that the specified offset and limit are reflected in the URI.
                        expect(stub.firstCall.args[0].uri).to.match(/.*offset=10.*/);
                        expect(stub.firstCall.args[0].uri).to.match(/.*limit=5.*/);

                        // Verify that the REST API returned the expected values.
                        expect(diff.diffJson(JSON.parse(resourceMetadataString1), resources[0])).to.have.lengthOf(1);
                        expect(diff.diffJson(JSON.parse(resourceMetadataString2), resources[1])).to.have.lengthOf(1);
                        expect(diff.diffJson(JSON.parse(resourceMetadataString3), resources[2])).to.have.lengthOf(1);
                        expect(diff.diffJson(JSON.parse(resourceMetadataString4), resources[3])).to.have.lengthOf(1);
                        expect(diff.diffJson(JSON.parse(resourceMetadataString5), resources[4])).to.have.lengthOf(1);
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

            it("should succeed when getting valid resources - body object", function (done) {
                // Create a stub for GET requests
                const stub = sinon.stub(request, "get");

                // The first GET request is to retrieve the assets lookup URI.
                const err = null;
                const res = {"statusCode": 200};

                // The GET request is to retrieve the assets metadata.
                const resourceMetadataPath1 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JPG_1;
                const resourceMetadataPath2 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_GIF_1;
                const resourceMetadataPath3 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_PNG_1;
                const resourceMetadataPath4 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CSS_1;
                const resourceMetadataPath5 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JAR_1;
                const resourceMetadata1 = UnitTest.getJsonObject(resourceMetadataPath1);
                const resourceMetadata2 = UnitTest.getJsonObject(resourceMetadataPath2);
                const resourceMetadata3 = UnitTest.getJsonObject(resourceMetadataPath3);
                const resourceMetadata4 = UnitTest.getJsonObject(resourceMetadataPath4);
                const resourceMetadata5 = UnitTest.getJsonObject(resourceMetadataPath5);
                const body = [resourceMetadata1, resourceMetadata2, resourceMetadata3, resourceMetadata4, resourceMetadata5];
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsREST.getResourceList(context, {offset: 10, limit:5})
                    .then(function (resources) {
                        // Verify that the stub was called twice, first with the lookup URI and then with the asset URI.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[0].uri).to.contain("/authoring/v1/resources/views/by-created");

                        // Verify that the specified offset and limit are reflected in the URI.
                        expect(stub.firstCall.args[0].uri).to.match(/.*offset=10.*/);
                        expect(stub.firstCall.args[0].uri).to.match(/.*limit=5.*/);

                        // Verify that the REST API returned the expected values.
                        expect(diff.diffJson(resourceMetadata1, resources[0])).to.have.lengthOf(1);
                        expect(diff.diffJson(resourceMetadata2, resources[1])).to.have.lengthOf(1);
                        expect(diff.diffJson(resourceMetadata3, resources[2])).to.have.lengthOf(1);
                        expect(diff.diffJson(resourceMetadata4, resources[3])).to.have.lengthOf(1);
                        expect(diff.diffJson(resourceMetadata5, resources[4])).to.have.lengthOf(1);
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

            it("should succeed when getting valid resources - empty body", function (done) {
                // Create a stub for GET requests
                const stub = sinon.stub(request, "get");

                // The first GET request is to retrieve the assets lookup URI.
                const err = null;
                const res = {"statusCode": 200};
                const body = null;
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsREST.getResourceList(context, {offset: 10, limit:5})
                    .then(function (resources) {
                        // Verify that the stub was called twice, first with the lookup URI and then with the asset URI.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[0].uri).to.contain("/authoring/v1/resources/views/by-created");

                        // Verify that the specified offset and limit are reflected in the URI.
                        expect(stub.firstCall.args[0].uri).to.match(/.*offset=10.*/);
                        expect(stub.firstCall.args[0].uri).to.match(/.*limit=5.*/);

                        // Verify that the REST API returned the expected values.
                        expect(resources).to.exist;
                        expect(resources).to.have.lengthOf(0);
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

    testExtractFilename () {
        describe("_extractFilename", function() {
            it("should return undefined when header value is not specified", function (done) {
                let error = undefined;
                try {
                    const filename = assetsREST._extractFilename();
                    expect(filename).to.not.exist;
                } catch (err) {
                    error = err;
                } finally {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
            });

            it("should return undefined when the header value specified does not contain an expected token", function (done) {
                let error = undefined;
                try {
                    const filename = assetsREST._extractFilename("attachment; foobar=somefile.txt");
                    expect(filename).to.not.exist;
                } catch (err) {
                    error = err;
                } finally {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
            });

            it("should return the filename specified in the header value - filename*", function (done) {
                let error = undefined;
                try {
                    const filename = assetsREST._extractFilename("attachment; filename*=UTF-8''Na%C3%AFve%20file.txt");
                    expect(filename).to.equal("Na%C3%AFve%20file.txt");
                } catch (err) {
                    error = err;
                } finally {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
            });

            it("should return the filename specified in the header value - filename", function (done) {
                let error = undefined;
                try {
                    const filename = assetsREST._extractFilename("attachment; filename=somefile.txt");
                    expect(filename).to.equal("somefile.txt");
                } catch (err) {
                    error = err;
                } finally {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
            });
        });
    }

    testPushItem () {
        const self = this;
        describe("pushItem", function() {
            it("should fail when posting to the resources URI fails with an Error response - retry", function (done) {
                // Create a stub for the POST request which returns an error.
                const ASSET_ERROR = "Error pushing the asset.";
                const stubPost = sinon.stub(request, "post");
                const err = new Error(ASSET_ERROR);
                const res = null;
                const body = null;
                stubPost.yields(err, res, body);

                const stubHead = sinon.stub(request, "head");
                stubHead.yields(undefined, { statusCode: 404 }, null);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubPost);
                self.addTestDouble(stubHead);

                // Add a retry filter (that always returns true) to the context.
                context.filterRetryPush = function () {return true;};

                // Call the method being tested.
                let error;
                assetsREST.pushItem(context, false, false, false, undefined, undefined, AssetsUnitTest.ASSET_HBS_1, AssetsUnitTest.DUMMY_STREAM, 0)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset should have been rejected.");
                    })
                    .catch(function (err) {
                        expect(stubHead).to.have.callCount(0);

                        // Verify that the post stub was called with a resource URI.
                        expect(stubPost).to.have.been.calledOnce;
                        expect(stubPost.firstCall.args[0].uri).to.contain("/authoring/v1/resources");

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.contain(ASSET_ERROR);
                        expect(err.log).to.contain(ASSET_ERROR);
                        expect(err.retry).to.equal(true);
                    })
                    .catch(function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        delete context.filterRetryPush;

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when posting to the resources URI fails with an Error response - no retry", function (done) {
                // Create a stub for the POST request which returns an error.
                const ASSET_ERROR = "Error pushing the asset.";
                const stubPost = sinon.stub(request, "post");
                const err = new Error(ASSET_ERROR);
                const res = null;
                const body = null;
                stubPost.yields(err, res, body);

                const stubHead = sinon.stub(request, "head");
                stubHead.yields(undefined, { statusCode: 404 }, null);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubPost);
                self.addTestDouble(stubHead);

                // Add a retry filter (that always returns false) to the context.
                context.filterRetryPush = function () {return false;};

                // Call the method being tested.
                let error;
                assetsREST.pushItem(context, false, false, false, undefined, undefined, AssetsUnitTest.ASSET_HBS_1, AssetsUnitTest.DUMMY_STREAM, 0)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset should have been rejected.");
                    })
                    .catch(function (err) {
                        expect(stubHead).to.have.callCount(0);

                        // Verify that the post stub was called with a resource URI.
                        expect(stubPost).to.have.been.calledOnce;
                        expect(stubPost.firstCall.args[0].uri).to.contain("/authoring/v1/resources");

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.contain(ASSET_ERROR);
                        expect(err.log).to.contain(ASSET_ERROR);
                        expect(err.retry).to.not.exist;
                    })
                    .catch(function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        delete context.filterRetryPush;

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when posting to the assets URI fails with an error", function (done) {
                // Create a stub for the POST requests.
                const stubPost = sinon.stub(request, "post");

                // The first POST request specifies the resource URI and returns a promise for the asset metadata.
                const assetMetadataPath = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JPG_1;
                const assetMetadata = UnitTest.getJsonObject(assetMetadataPath);
                let err = null;
                let res = {"statusCode": 200};
                let body = '{"id": "' + assetMetadata.resource + '"}';
                stubPost.onCall(0).yields(err, res, body);
                stubPost.onCall(0).returns(AssetsUnitTest.DUMMY_WRITE_STREAM);

                // The second POST request specifies the asset URI and returns an error.
                const ASSET_ERROR = "Error pushing the asset.";
                err = new Error(ASSET_ERROR);
                res = null;
                body = null;
                stubPost.onCall(1).yields(err, res, body);

                const stubHead = sinon.stub(request, "head");
                stubHead.yields(undefined, { statusCode: 404 }, null);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubPost);
                self.addTestDouble(stubHead);

                // Call the method being tested.
                let error;
                assetsREST.pushItem(context, false, false, false, undefined, undefined, AssetsUnitTest.ASSET_JPG_1.slice(1), AssetsUnitTest.DUMMY_STREAM, 0)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset should have been rejected.");
                    })
                    .catch(function (err) {
                        expect(stubHead).to.have.callCount(0);

                        // Verify that the post stub was called twice.
                        expect(stubPost).to.have.been.calledTwice;

                        // Verify that the first post was called with a resource URI and the specified body.
                        expect(stubPost.firstCall.args[0].uri).to.contain("/authoring/v1/resources");

                        // Verify that the second post was called with an asset URI and the expected body, which
                        // includes the new asset metadata id and a modified path.
                        expect(stubPost.secondCall.args[0].uri).to.contain("/authoring/v1/assets");
                        expect(stubPost.secondCall.args[0].body.resource).to.equal(assetMetadata.resource);
                        expect(stubPost.secondCall.args[0].body.path).to.equal(AssetsUnitTest.ASSET_JPG_1);

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.contain(ASSET_ERROR);
                        expect(err.log).to.contain(ASSET_ERROR);
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

            it("should succeed for createOnly when posting to the resources URI fails with a conflict", function (done) {
                // Create a readable stream of the asset content to pass to the method being tested.
                const assetPath = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_JPG_1;
                const assetContent = fs.readFileSync(assetPath);
                const assetStream = new Stream.Readable();
                assetStream.push(assetContent);
                assetStream.push(null);

                // Create spies to watch the pipe process.
                const spyPipe = sinon.spy();
                const spyData = sinon.spy();
                const spyEnd = sinon.spy();
                const spyFinish = sinon.spy();

                // Catch the data that is being piped from the input stream to the post request.
                const requestContentArray = [];
                let requestContentBuffer;
                assetStream.on("data", function (data) {
                    requestContentArray.push(data);
                });
                assetStream.on("data", spyData);
                assetStream.on("end", function () {
                    requestContentBuffer = Buffer.concat(requestContentArray);
                });
                assetStream.on("end", spyEnd);

                // Create a writable stream to receive the content being sent to the post request.
                const requestStream = new Stream.Writable();
                requestStream.on("pipe", spyPipe);
                requestStream.on("finish", spyFinish);

                // Create a stub for the POST requests.
                const stubPut = sinon.stub(request, "put");
                const stubPost = sinon.stub(request, "post");

                // The first PUT request specifies the resource URI and returns a promise for the asset metadata.
                const assetMetadataPath = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JPG_1;
                const assetMetadata = UnitTest.getJsonObject(assetMetadataPath);
                let err = null;
                let res = {"statusCode": 409};
                let body = null;
                stubPut.onCall(0).returns(requestStream);
                stubPut.onCall(0).yieldsAsync(err, res, body);

                // The second POST request specifies the asset URI and returns the asset metadata.
                err = null;
                res = {"statusCode": 200};
                body = assetMetadata;
                stubPost.onCall(0).yields(err, res, body);

                const stubHead = sinon.stub(request, "head");
                stubHead.yields(undefined, { statusCode: 404 }, null);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubPut);
                self.addTestDouble(stubPost);
                self.addTestDouble(stubHead);

                // Call the method being tested.
                let error;
                const opts = {"asset": {"id": "test", "rev": "test", "resource": assetMetadata.resource, "path": "/" + AssetsUnitTest.ASSET_JPG_1}, createOnly: true};
                assetsREST.pushItem(context, false, false, false, assetMetadata.resource, undefined, "/" + AssetsUnitTest.ASSET_JPG_1, assetStream, assetContent.length, opts)
                    .then(function (asset) {
                        expect(stubHead).to.have.callCount(1);

                        // Verify that the put and post stubs were called once.
                        expect(stubPut).to.have.been.calledOnce;
                        expect(stubPost).to.have.been.calledOnce;

                        // Verify that the first post was called with a resource URI.
                        expect(stubPut.firstCall.args[0].uri).to.contain("/authoring/v1/resources");

                        // Verify that the expected content was sent to the first post.
                        expect(Buffer.compare(requestContentBuffer, assetContent)).to.equal(0);

                        // Verify that the pipe process occurred in the order expected.
                        expect(spyData).to.have.been.calledBefore(spyPipe);
                        expect(spyPipe).to.have.been.calledBefore(spyEnd);
                        expect(spyEnd).to.have.been.calledBefore(spyFinish);

                        // Verify that the second post was called with an asset URI and the expected body, which
                        // includes the new asset metadata id and a modified path.
                        expect(stubPost.firstCall.args[0].uri).to.contain("/authoring/v1/assets");
                        expect(stubPost.firstCall.args[0].body.resource).to.equal(assetMetadata.resource);
                        expect(stubPost.firstCall.args[0].body.path).to.equal("/" + AssetsUnitTest.ASSET_JPG_1);

                        // Verify that the expected value is returned.
                        expect(diff.diffJson(asset, assetMetadata)).to.have.lengthOf(1);
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

            it("should succeed for createOnly when posting to the assets URI fails with a conflict", function (done) {
                // Create a stub for the POST requests.
                const stubPost = sinon.stub(request, "post");

                // The first POST request specifies the resource URI and returns a promise for the asset metadata.
                const assetMetadataPath = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JPG_1;
                const assetMetadata = UnitTest.getJsonObject(assetMetadataPath);
                let err = null;
                let res = {"statusCode": 200};
                let body = '{"id": "' + assetMetadata.resource + '"}';
                stubPost.onCall(0).yields(err, res, body);
                stubPost.onCall(0).returns(AssetsUnitTest.DUMMY_WRITE_STREAM);

                // The second POST request specifies the asset URI and returns an error.
                const ASSET_ERROR = "The asset already exists, as expected by unit test.";
                err = new Error(ASSET_ERROR);
                res = {"statusCode": 409};
                body = null;
                stubPost.onCall(1).yields(err, res, body);

                const stubHead = sinon.stub(request, "head");
                stubHead.yields(undefined, { statusCode: 404 }, null);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubPost);
                self.addTestDouble(stubHead);

                // Call the method being tested, passing the createOnly option.
                let error;
                assetsREST.pushItem(context, false, false, false, undefined, undefined, "\\" + AssetsUnitTest.ASSET_JPG_1, AssetsUnitTest.DUMMY_STREAM, 0, {createOnly: true})
                    .then(function () {
                        expect(stubHead).to.have.callCount(0);

                        // Verify that the post stub was called twice.
                        expect(stubPost).to.have.been.calledTwice;

                        // Verify that the first post was called with a resource URI and the specified body.
                        expect(stubPost.firstCall.args[0].uri).to.contain("/authoring/v1/resources");

                        // Verify that the second post was called with an asset URI and the expected body, which
                        // includes the new asset metadata id and a modified path.
                        expect(stubPost.secondCall.args[0].uri).to.contain("/authoring/v1/assets");
                        expect(stubPost.secondCall.args[0].body.resource).to.equal(assetMetadata.resource);
                        expect(stubPost.secondCall.args[0].body.path).to.equal("/" + AssetsUnitTest.ASSET_JPG_1);
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

            it("should succeed when pushing a valid resource", function (done) {
                // Create a readable stream of the asset content to pass to the method being tested.
                const assetPath = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_JPG_1;
                const assetContent = fs.readFileSync(assetPath);
                const assetStream = new Stream.Readable();
                assetStream.push(assetContent);
                assetStream.push(null);

                // Create spies to watch the pipe process.
                const spyPipe = sinon.spy();
                const spyData = sinon.spy();
                const spyEnd = sinon.spy();
                const spyFinish = sinon.spy();

                // Catch the data that is being piped from the input stream to the post request.
                const requestContentArray = [];
                let requestContentBuffer;
                assetStream.on("data", function (data) {
                    requestContentArray.push(data);
                });
                assetStream.on("data", spyData);
                assetStream.on("end", function () {
                    requestContentBuffer = Buffer.concat(requestContentArray);
                });
                assetStream.on("end", spyEnd);

                // Create a writable stream to receive the content being sent to the post request.
                const requestStream = new Stream.Writable();
                requestStream.on("pipe", spyPipe);
                requestStream.on("finish", spyFinish);

                // Create a stub for the POST requests.
                const stubPost = sinon.stub(request, "post");

                // The first POST request specifies the resource URI and returns a promise for the resource metadata.
                const assetMetadataPath = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JPG_1;
                const assetMetadata = UnitTest.getJsonObject(assetMetadataPath);
                let err = null;
                let res = {"statusCode": 200};
                let body = '{"id": "' + assetMetadata.resource + '"}';
                stubPost.onCall(0).returns(requestStream);
                stubPost.onCall(0).yieldsAsync(err, res, body);

                // The second POST request specifies the asset URI and returns the asset metadata.
                err = null;
                res = {"statusCode": 200};
                body = assetMetadata;
                stubPost.onCall(1).yields(err, res, body);

                const stubHead = sinon.stub(request, "head");
                stubHead.yields(undefined, { statusCode: 404 }, null);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubPost);
                self.addTestDouble(stubHead);

                // Call the method being tested.
                let error;
                assetsREST.pushItem(context, false, false, false, undefined, undefined, "/" + AssetsUnitTest.ASSET_JPG_1, assetStream, assetContent.length, DUMMY_PUBLISH_NOW_REQUEST_OPTIONS)
                    .then(function (asset) {
                        expect(stubHead).to.have.callCount(0);

                        // Verify that the post stub was called twice.
                        expect(stubPost).to.have.been.calledTwice;

                        // Verify that the first post was called with a resource URI.
                        expect(stubPost.firstCall.args[0].uri).to.contain("/authoring/v1/resources");

                        // Verify that the expected content was sent to the first post.
                        expect(Buffer.compare(requestContentBuffer, assetContent)).to.equal(0);

                        // Verify that the pipe process occurred in the order expected.
                        expect(spyData).to.have.been.calledBefore(spyPipe);
                        expect(spyPipe).to.have.been.calledBefore(spyEnd);
                        expect(spyEnd).to.have.been.calledBefore(spyFinish);

                        // Verify that the second post was called with an asset URI and the expected body, which
                        // includes the new asset metadata id and a modified path.
                        expect(stubPost.secondCall.args[0].uri).to.contain("/authoring/v1/assets");
                        expect(stubPost.secondCall.args[0].body.resource).to.equal(assetMetadata.resource);
                        expect(stubPost.secondCall.args[0].body.path).to.equal("/" + AssetsUnitTest.ASSET_JPG_1);
                        expect(stubPost.secondCall.args[0].headers).to.exist;
                        expect(stubPost.secondCall.args[0].headers["x-ibm-dx-publish-priority"]).to.exist;

                        // Verify that the expected value is returned.
                        expect(diff.diffJson(asset, assetMetadata)).to.have.lengthOf(1);
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

            it("should succeed when pushing a valid resource", function (done) {
                // Create a readable stream of the asset content to pass to the method being tested.
                const assetPath = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_JPG_1;
                const assetContent = fs.readFileSync(assetPath);
                const assetStream = new Stream.Readable();
                assetStream.push(assetContent);
                assetStream.push(null);

                // Create spies to watch the pipe process.
                const spyPipe = sinon.spy();
                const spyData = sinon.spy();
                const spyEnd = sinon.spy();
                const spyFinish = sinon.spy();

                // Catch the data that is being piped from the input stream to the post request.
                const requestContentArray = [];
                let requestContentBuffer;
                assetStream.on("data", function (data) {
                    requestContentArray.push(data);
                });
                assetStream.on("data", spyData);
                assetStream.on("end", function () {
                    requestContentBuffer = Buffer.concat(requestContentArray);
                });
                assetStream.on("end", spyEnd);

                // Create a writable stream to receive the content being sent to the post request.
                const requestStream = new Stream.Writable();
                requestStream.on("pipe", spyPipe);
                requestStream.on("finish", spyFinish);

                // Create a stub for the PUT requests.
                const stubPut = sinon.stub(request, "put");

                // The first POST request specifies the resource URI and returns a promise for the resource metadata.
                const assetMetadataPath = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JPG_1;
                const assetMetadata = UnitTest.getJsonObject(assetMetadataPath);
                const err = null;
                const res = {"statusCode": 200};
                const body = assetMetadata;
                stubPut.onCall(0).returns(requestStream);
                stubPut.onCall(0).yieldsAsync(err, res, body);

                const stubHead = sinon.stub(request, "head");
                stubHead.yields(undefined, { statusCode: 404 }, null);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubPut);
                self.addTestDouble(stubHead);

                // Call the method being tested.
                let error;
                assetsREST.pushItem(context, true, true, false, UnitTest.DUMMY_ID, undefined, "/" + AssetsUnitTest.ASSET_JPG_1, assetStream, assetContent.length)
                    .then(function (asset) {
                        expect(stubHead).to.have.callCount(1);

                        // Verify that the put stub was called twice.
                        expect(stubPut).to.have.been.calledOnce;

                        // Verify that the first post was called with a resource URI.
                        expect(stubPut.firstCall.args[0].uri).to.contain("/authoring/v1/resources");

                        // Verify that the expected content was sent to the first post.
                        expect(Buffer.compare(requestContentBuffer, assetContent)).to.equal(0);

                        // Verify that the pipe process occurred in the order expected.
                        expect(spyData).to.have.been.calledBefore(spyPipe);
                        expect(spyPipe).to.have.been.calledBefore(spyEnd);
                        expect(spyEnd).to.have.been.calledBefore(spyFinish);

                        // Verify that the expected value is returned.
                        expect(diff.diffJson(asset, assetMetadata)).to.have.lengthOf(1);
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

            it("should succeed when pushing an updated web application asset", function (done) {
                // Create a readable stream of the asset content to pass to the method being tested.
                const assetPath = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_JPG_1;
                const assetContent = fs.readFileSync(assetPath);
                const assetStream = new Stream.Readable();
                assetStream.push(assetContent);
                assetStream.push(null);

                // Create spies to watch the pipe process.
                const spyPipe = sinon.spy();
                const spyData = sinon.spy();
                const spyEnd = sinon.spy();
                const spyFinish = sinon.spy();

                // Catch the data that is being piped from the input stream to the put request.
                const requestContentArray = [];
                let requestContentBuffer;
                assetStream.on("data", function (data) {
                    requestContentArray.push(data);
                });
                assetStream.on("data", spyData);
                assetStream.on("end", function () {
                    requestContentBuffer = Buffer.concat(requestContentArray);
                });
                assetStream.on("end", spyEnd);

                // Create a writable stream to receive the content being sent to the post request.
                const requestStream = new Stream.Writable();
                requestStream.on("pipe", spyPipe);
                requestStream.on("finish", spyFinish);

                // Create stubs for the PUT and POST requests.
                const stubPut = sinon.stub(request, "put");
                const stubPost = sinon.stub(request, "post");

                // The PUT request specifies the resource URI and returns a promise for the asset metadata.
                const assetMetadataPath = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JPG_1;
                const assetMetadata = UnitTest.getJsonObject(assetMetadataPath);
                let err = null;
                let res = {"statusCode": 200};
                let body = '{"id": "' + assetMetadata.resource + '"}';
                stubPut.returns(requestStream);
                stubPut.yieldsAsync(err, res, body);

                // The POST request specifies the asset URI and returns the asset metadata.
                err = null;
                res = {"statusCode": 200};
                body = assetMetadata;
                stubPost.yields(err, res, body);

                const stubHead = sinon.stub(request, "head");
                stubHead.yields(undefined, { statusCode: 404 }, null);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubPut);
                self.addTestDouble(stubPost);
                self.addTestDouble(stubHead);

                // Call the method being tested.
                let error;
                assetsREST.pushItem(context, false, true, false, UnitTest.DUMMY_ID, DUMMY_MD5_HASH, AssetsUnitTest.ASSET_JPG_1, assetStream, assetContent.length)
                    .then(function (asset) {
                        expect(stubHead).to.have.callCount(1);

                        // Verify that the put stub was called once and the post stub was called once.
                        expect(stubPut).to.have.been.calledOnce;
                        expect(stubPost).to.have.been.calledOnce;

                        // Verify that put was called with a resource URI.
                        expect(stubPut.args[0][0].uri).to.contain("/authoring/v1/resources");

                        // Verify that the expected content was sent to the put.
                        expect(Buffer.compare(requestContentBuffer, assetContent)).to.equal(0);

                        // Verify that the pipe process occurred in the order expected.
                        expect(spyData).to.have.been.calledBefore(spyPipe);
                        expect(spyPipe).to.have.been.calledBefore(spyEnd);
                        expect(spyEnd).to.have.been.calledBefore(spyFinish);

                        // Verify that the post was called with an asset URI and the expected body, which
                        // includes the new asset metadata id and a modified path.
                        expect(stubPost.args[0][0].uri).to.contain("/authoring/v1/assets");
                        expect(stubPost.args[0][0].body.resource).to.equal(UnitTest.DUMMY_ID);
                        expect(stubPost.args[0][0].body.path).to.equal(AssetsUnitTest.ASSET_JPG_1);

                        // Verify that the expected value is returned.
                        expect(diff.diffJson(asset, assetMetadata)).to.have.lengthOf(1);
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

            it("should succeed when pushing an updated (managed) asset containing no rev value", function (done) {
                // Create a readable stream of the asset content to pass to the method being tested.
                const assetPath = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_JPG_1;
                const assetContent = fs.readFileSync(assetPath);
                const assetStream = new Stream.Readable();
                assetStream.push(assetContent);
                assetStream.push(null);

                // Create spies to watch the pipe process.
                const spyPipe = sinon.spy();
                const spyData = sinon.spy();
                const spyEnd = sinon.spy();
                const spyFinish = sinon.spy();

                // Catch the data that is being piped from the input stream to the put request.
                const requestContentArray = [];
                let requestContentBuffer;
                assetStream.on("data", function (data) {
                    requestContentArray.push(data);
                });
                assetStream.on("data", spyData);
                assetStream.on("end", function () {
                    requestContentBuffer = Buffer.concat(requestContentArray);
                });
                assetStream.on("end", spyEnd);

                // Create a writable stream to receive the content being sent to the post request.
                const requestStream = new Stream.Writable();
                requestStream.on("pipe", spyPipe);
                requestStream.on("finish", spyFinish);

                // Create stubs for the PUT and POST requests.
                const stubPut = sinon.stub(request, "put");
                const stubPost = sinon.stub(request, "post");

                // The PUT request specifies the resource URI and returns a promise for the resource metadata.
                const assetMetadataPath = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JPG_1;
                const assetMetadata = UnitTest.getJsonObject(assetMetadataPath);
                let err = null;
                let res = {"statusCode": 200};
                let body = '{"id": "' + assetMetadata.resource + '"}';
                stubPut.returns(requestStream);
                stubPut.yieldsAsync(err, res, body);

                // The POST request specifies the asset update URI and returns the asset metadata.
                err = null;
                res = {"statusCode": 200};
                body = assetMetadata;
                stubPost.yieldsAsync(err, res, body);

                const stubHead = sinon.stub(request, "head");
                stubHead.yields(undefined, { statusCode: 404 }, null);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubPut);
                self.addTestDouble(stubPost);
                self.addTestDouble(stubHead);

                // Call the method being tested.
                let error;
                const opts = {"asset": {"id": "test"}, "force-override": true};
                assetsREST.pushItem(context, false, true, false, UnitTest.DUMMY_ID, DUMMY_MD5_HASH, AssetsUnitTest.ASSET_JPG_1, assetStream, assetContent.length, opts)
                    .then(function (asset) {
                        expect(stubHead).to.have.callCount(1);

                        // Verify that the stubs were each called once.
                        expect(stubPut).to.have.been.calledOnce;
                        expect(stubPost).to.have.been.calledOnce;

                        // Verify that the put was called with a resource URI.
                        expect(stubPut.args[0][0].uri).to.contain("/authoring/v1/resources");

                        // Verify that the expected content was sent to the first put.
                        expect(Buffer.compare(requestContentBuffer, assetContent)).to.equal(0);

                        // Verify that the pipe process occurred in the order expected.
                        expect(spyData).to.have.been.calledBefore(spyPipe);
                        expect(spyPipe).to.have.been.calledBefore(spyEnd);
                        expect(spyEnd).to.have.been.calledBefore(spyFinish);

                        // Verify that the post was called with an asset URI that includes a forceOverride element
                        // and the expected body, which includes the new asset metadata id and a modified path.
                        expect(stubPost.args[0][0].uri).to.contain("/authoring/v1/assets");
                        expect(stubPost.args[0][0].body.resource).to.equal(UnitTest.DUMMY_ID);

                        // Verify that the expected value is returned.
                        expect(diff.diffJson(asset, assetMetadata)).to.have.lengthOf(1);
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

            it("should succeed when pushing an updated (managed) asset containing a rev value", function (done) {
                // Create a readable stream of the asset content to pass to the method being tested.
                const assetPath = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_JPG_1;
                const assetContent = fs.readFileSync(assetPath);
                const assetStream = new Stream.Readable();
                assetStream.push(assetContent);
                assetStream.push(null);

                // Create spies to watch the pipe process.
                const spyPipe = sinon.spy();
                const spyData = sinon.spy();
                const spyEnd = sinon.spy();
                const spyFinish = sinon.spy();

                // Catch the data that is being piped from the input stream to the put request.
                const requestContentArray = [];
                let requestContentBuffer;
                assetStream.on("data", function (data) {
                    requestContentArray.push(data);
                });
                assetStream.on("data", spyData);
                assetStream.on("end", function () {
                    requestContentBuffer = Buffer.concat(requestContentArray);
                });
                assetStream.on("end", spyEnd);

                // Create a writable stream to receive the content being sent to the post request.
                const requestStream = new Stream.Writable();
                requestStream.on("pipe", spyPipe);
                requestStream.on("finish", spyFinish);

                // Create stubs for the PUT and POST requests.
                const stubPut = sinon.stub(request, "put");

                // The first PUT request specifies the resource URI and returns a promise for the asset metadata.
                const assetMetadataPath = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JPG_1;
                const assetMetadata = UnitTest.getJsonObject(assetMetadataPath);
                let err = null;
                let res = {"statusCode": 200};
                let body = '{"id": "' + assetMetadata.resource + '"}';
                stubPut.onCall(0).returns(requestStream);
                stubPut.onCall(0).yieldsAsync(err, res, body);

                // The second PUT request specifies the asset update URI and returns the asset metadata.
                err = null;
                res = null;
                body = assetMetadata;
                stubPut.onCall(1).yieldsAsync(err, res, body);

                const stubHead = sinon.stub(request, "head");
                stubHead.yields(undefined, { statusCode: 404 }, null);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubPut);
                self.addTestDouble(stubHead);

                // Call the method being tested.
                let error;
                const opts = {"asset": {"id": "test", "rev": "test"}, "force-override": true};
                assetsREST.pushItem(context, false, true, false, UnitTest.DUMMY_ID, DUMMY_MD5_HASH, AssetsUnitTest.ASSET_JPG_1, assetStream, assetContent.length, opts)
                    .then(function (asset) {
                        expect(stubHead).to.have.callCount(1);

                        // Verify that the put stub was called twice.
                        expect(stubPut).to.have.been.calledTwice;

                        // Verify that the first put was called with a resource URI.
                        expect(stubPut.args[0][0].uri).to.contain("/authoring/v1/resources");

                        // Verify that the expected content was sent to the first put.
                        expect(Buffer.compare(requestContentBuffer, assetContent)).to.equal(0);

                        // Verify that the pipe process occurred in the order expected.
                        expect(spyData).to.have.been.calledBefore(spyPipe);
                        expect(spyPipe).to.have.been.calledBefore(spyEnd);
                        expect(spyEnd).to.have.been.calledBefore(spyFinish);

                        // Verify that the second put was called with an asset URI that includes a forceOverride element
                        // and the expected body, which includes the new asset metadata id and a modified path.
                        expect(stubPut.args[1][0].uri).to.contain("/authoring/v1/assets");
                        expect(stubPut.args[1][0].uri).to.contain("forceOverride=true");
                        expect(stubPut.args[1][0].body.resource).to.equal(UnitTest.DUMMY_ID);

                        // Verify that the expected value is returned.
                        expect(diff.diffJson(asset, assetMetadata)).to.have.lengthOf(1);
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

            it("should succeed when pushing an updated (managed) asset's metadata is not found", function (done) {
                // Create a readable stream of the asset content to pass to the method being tested.
                const assetPath = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_JPG_1;
                const assetContent = fs.readFileSync(assetPath);
                const assetStream = new Stream.Readable();
                assetStream.push(assetContent);
                assetStream.push(null);

                // Create spies to watch the pipe process.
                const spyPipe = sinon.spy();
                const spyData = sinon.spy();
                const spyEnd = sinon.spy();
                const spyFinish = sinon.spy();

                // Catch the data that is being piped from the input stream to the put request.
                const requestContentArray = [];
                let requestContentBuffer;
                assetStream.on("data", function (data) {
                    requestContentArray.push(data);
                });
                assetStream.on("data", spyData);
                assetStream.on("end", function () {
                    requestContentBuffer = Buffer.concat(requestContentArray);
                });
                assetStream.on("end", spyEnd);

                // Create a writable stream to receive the content being sent to the post request.
                const requestStream = new Stream.Writable();
                requestStream.on("pipe", spyPipe);
                requestStream.on("finish", spyFinish);

                // Create stubs for the PUT and POST requests.
                const stubPut = sinon.stub(request, "put");
                const stubPost = sinon.stub(request, "post");

                // The first PUT request specifies the resource URI and returns a promise for the asset metadata.
                const assetMetadataPath = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JPG_1;
                const assetMetadata = UnitTest.getJsonObject(assetMetadataPath);
                let err = null;
                let res = {"statusCode": 200};
                let body = '{"id": "' + assetMetadata.resource + '"}';
                stubPut.onCall(0).returns(requestStream);
                stubPut.onCall(0).yieldsAsync(err, res, body);

                // The second PUT request specifies the asset update URI and returns a not found error.
                err = null;
                res = {"statusCode": 404};
                body = null;
                stubPut.onCall(1).yieldsAsync(err, res, body);

                // The POST request specifies the asset create URI and returns the asset metadata.
                err = null;
                res = {"statusCode": 201};
                body = assetMetadata;
                stubPost.yieldsAsync(err, res, body);

                const stubHead = sinon.stub(request, "head");
                stubHead.yields(undefined, { statusCode: 404 }, null);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubPut);
                self.addTestDouble(stubPost);
                self.addTestDouble(stubHead);

                // Call the method being tested.
                let error;
                const opts = {"asset": {"id": "test", "rev": "test"}, "force-override": true};
                assetsREST.pushItem(context, false, true, false, UnitTest.DUMMY_ID, DUMMY_MD5_HASH, AssetsUnitTest.ASSET_JPG_1, assetStream, assetContent.length, opts)
                    .then(function (asset) {
                        expect(stubHead).to.have.callCount(1);

                        // Verify that the put stub was called twice.
                        expect(stubPut).to.have.been.calledTwice;

                        // Verify that the first put was called with a resource URI.
                        expect(stubPut.args[0][0].uri).to.contain("/authoring/v1/resources");

                        // Verify that the expected content was sent to the first put.
                        expect(Buffer.compare(requestContentBuffer, assetContent)).to.equal(0);

                        // Verify that the pipe process occurred in the order expected.
                        expect(spyData).to.have.been.calledBefore(spyPipe);
                        expect(spyPipe).to.have.been.calledBefore(spyEnd);
                        expect(spyEnd).to.have.been.calledBefore(spyFinish);

                        // Verify that the second put was called with an asset URI that includes a forceOverride element
                        // and the expected body, which includes the new asset metadata id and a modified path.
                        expect(stubPut.args[1][0].uri).to.contain("/authoring/v1/assets");
                        expect(stubPut.args[1][0].uri).to.contain("forceOverride=true");
                        expect(stubPut.args[1][0].body.resource).to.equal(UnitTest.DUMMY_ID);

                        // Verify that the expected value is returned.
                        expect(diff.diffJson(asset, assetMetadata)).to.have.lengthOf(1);
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

            it("should fail when pushing an updated (managed) asset's metadata fails", function (done) {
                // Create a readable stream of the asset content to pass to the method being tested.
                const assetPath = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_JPG_1;
                const assetContent = fs.readFileSync(assetPath);
                const assetStream = new Stream.Readable();
                assetStream.push(assetContent);
                assetStream.push(null);

                // Create spies to watch the pipe process.
                const spyPipe = sinon.spy();
                const spyData = sinon.spy();
                const spyEnd = sinon.spy();
                const spyFinish = sinon.spy();

                // Catch the data that is being piped from the input stream to the put request.
                const requestContentArray = [];
                let requestContentBuffer;
                assetStream.on("data", function (data) {
                    requestContentArray.push(data);
                });
                assetStream.on("data", spyData);
                assetStream.on("end", function () {
                    requestContentBuffer = Buffer.concat(requestContentArray);
                });
                assetStream.on("end", spyEnd);

                // Create a writable stream to receive the content being sent to the post request.
                const requestStream = new Stream.Writable();
                requestStream.on("pipe", spyPipe);
                requestStream.on("finish", spyFinish);

                // Create stubs for the PUT and POST requests.
                const stubPut = sinon.stub(request, "put");

                // The first PUT request specifies the resource URI and returns a promise for the asset metadata.
                const assetMetadataPath = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JPG_1;
                const assetMetadata = UnitTest.getJsonObject(assetMetadataPath);
                let err = null;
                let res = {"statusCode": 200};
                let body = '{"id": "' + assetMetadata.resource + '"}';
                stubPut.onCall(0).returns(requestStream);
                stubPut.onCall(0).yieldsAsync(err, res, body);

                // The second PUT request specifies the asset update URI and returns the asset metadata.
                const RESOURCE_ERROR = "The resource put request failed, as expected by unit test.";
                err = new Error(RESOURCE_ERROR);
                res = {"statusCode": 500};
                body = null;
                stubPut.onCall(1).yieldsAsync(err, res, body);

                const stubHead = sinon.stub(request, "head");
                stubHead.yields(undefined, { statusCode: 404 }, null);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubPut);
                self.addTestDouble(stubHead);

                // Call the method being tested.
                let error;
                const opts = {"asset": {"id": "test", "rev": "test"}, "force-override": true};
                assetsREST.pushItem(context, false, true, false, UnitTest.DUMMY_ID, DUMMY_MD5_HASH, AssetsUnitTest.ASSET_JPG_1, assetStream, assetContent.length, opts)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset should have been rejected.");
                    })
                    .catch(function (err) {
                        expect(stubHead).to.have.callCount(1);

                        // Verify that the put stub was called twice.
                        expect(stubPut).to.have.been.calledTwice;

                        // Verify that the first put was called with a resource URI.
                        expect(stubPut.args[0][0].uri).to.contain("/authoring/v1/resources");

                        // Verify that the expected content was sent to the first put.
                        expect(Buffer.compare(requestContentBuffer, assetContent)).to.equal(0);

                        // Verify that the pipe process occurred in the order expected.
                        expect(spyData).to.have.been.calledBefore(spyPipe);
                        expect(spyPipe).to.have.been.calledBefore(spyEnd);
                        expect(spyEnd).to.have.been.calledBefore(spyFinish);

                        // Verify that the second put was called with an asset URI that includes a forceOverride element
                        // and the expected body, which includes the new asset metadata id and a modified path.
                        expect(stubPut.args[1][0].uri).to.contain("/authoring/v1/assets");
                        expect(stubPut.args[1][0].uri).to.contain("forceOverride=true");
                        expect(stubPut.args[1][0].body.resource).to.equal(UnitTest.DUMMY_ID);

                        // Verify that the expected error is returned.
                        expect(err.message).to.contain("technical difficulties");
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

    testPullItem () {
        const self = this;

        describe("pullItem", function() {
            it("should fail when getting the asset fails with an error response code", function (done) {
                // Create a stub for GET request to retrieve the asset file stream.
                const stub = sinon.stub(request, "get");
                const responseStream = new Stream.PassThrough();
                stub.returns(responseStream);

                // Emit the test events to the stream (after the stub has returned the stream to method being tested.)
                setTimeout(function () {
                    responseStream.emit("response", {"statusCode": 404});
                    responseStream.emit("end", {"statusCode": 404});
                }, 0);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                const asset = {path: "test.txt", resource:  AssetsUnitTest.ASSET_JPG_3};
                assetsREST.pullItem(context, asset, AssetsUnitTest.DUMMY_WRITE_STREAM)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once with the lookup URI and once with the generated URI.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[0].uri).to.contain("/authoring/v1/resources/"+ AssetsUnitTest.ASSET_JPG_3);

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.contain("Cannot get asset");
                        expect(err.message).to.contain("404");
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when getting the asset fails with an error event", function (done) {
                // Create a stub for GET request to retrieve the asset file stream.
                const stub = sinon.stub(request, "get");
                const responseStream = new Stream.PassThrough();
                stub.returns(responseStream);

                // Emit the test events to the stream (after the stub has returned the stream to method being tested.)
                const ASSET_ERROR = "There was an error while retrieving the response data.";
                setTimeout(function () {
                    responseStream.emit("error", new Error(ASSET_ERROR));
                }, 0);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                const asset = {path: "test.txt", resource: AssetsUnitTest.ASSET_JPG_3};
                assetsREST.pullItem(context, asset, AssetsUnitTest.DUMMY_WRITE_STREAM)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once with the lookup URI and once with the generated URI.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[0].uri).to.contain("/authoring/v1/resources/"+ AssetsUnitTest.ASSET_JPG_3);

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.contain(ASSET_ERROR);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when getting the request URI fails", function (done) {
                // Create a stub for assetsREST.getDownloadRequestOptions to return an error.
                const ASSET_ERROR = "There was an error getting the request URI.";
                const stub = sinon.stub(assetsREST, "getDownloadRequestOptions");
                stub.rejects(ASSET_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                const asset = {path: "test.txt", resource: AssetsUnitTest.ASSET_JPG_3};
                assetsREST.pullItem(context, asset, AssetsUnitTest.DUMMY_WRITE_STREAM)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once with the lookup URI and once with the generated URI.
                        expect(stub).to.have.been.calledOnce;

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.contain(ASSET_ERROR);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when pulling a valid resource", function (done) {
                // Create a stub for GET request to retrieve the asset file stream.
                const stub = sinon.stub(request, "get");
                const content1 = "Some contents of the downloaded file.\n";
                const content2 = "More contents of the downloaded file.\n";
                const content3 = "The rest of the contents of the downloaded file.";
                const responseStream = new Stream.PassThrough();
                stub.returns(responseStream);

                // Create a passthrough stream to be passed to the method being tested.
                const fileStream = new Stream.PassThrough();

                // Capture the data written to the pass through stream so that we can inspect it later.
                const savedContent = [];
                fileStream.on("data", function (data) {
                    savedContent.push(data);
                });

                // Emit the test events to the stream (after the stub has returned the stream to method being tested.)
                setTimeout(function () {
                    responseStream.emit("response", {"statusCode": 200, "headers": {"content-disposition": "foo", "content-type": "bar"}});
                    responseStream.emit("data", content1);
                    responseStream.emit("data", content2);
                    responseStream.emit("data", content3);
                    responseStream.emit("end");
                }, 0);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                const asset = {path: AssetsUnitTest.ASSET_JPG_3, resource: AssetsUnitTest.ASSET_JPG_3};
                assetsREST.pullItem(context, asset, fileStream, {"returnDisposition": true})
                    .then(function (asset) {
                        // Verify that the stub was called once with the lookup URI and once with the generated URI.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[0].uri).to.contain("/authoring/v1/resources/"+ AssetsUnitTest.ASSET_JPG_3);

                        // Verify that the expected value was written to the stream.
                        expect(savedContent.toString()).to.contain(content1);
                        expect(savedContent.toString()).to.contain(content2);
                        expect(savedContent.toString()).to.contain(content3);

                        // Verify that the FS API returned the expected value.
                        expect(asset.path).to.contain(AssetsUnitTest.ASSET_JPG_3);
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

    testDeleteItem () {
        const self = this;
        describe("deleteItem", function() {
            it("should fail when deleting the asset fails", function (done) {
                // Create a stub for the DELETE request which returns an error.
                const ASSET_ERROR = "Error deleting the asset.";
                const stubDelete = sinon.stub(request, "del");
                const err = new Error(ASSET_ERROR);
                const res = {"statusCode": 403};
                const body = null;
                stubDelete.yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubDelete);

                // Call the method being tested.
                let error;
                assetsREST.deleteItem(context, UnitTest.DUMMY_METADATA)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the delete stub was called once with a URI that contains the specified ID.
                        expect(stubDelete).to.have.been.calledOnce;
                        expect(stubDelete.firstCall.args[0].uri).to.contain(UnitTest.DUMMY_METADATA.id);

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.contain(ASSET_ERROR);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when deleting a valid asset specifies a body message", function (done) {
                // Create a stub for the DELETE request to delete the specified asset.
                const DELETE_MESSAGE = "The asset was deleted.";
                const stubDelete = sinon.stub(request, "del");
                const err = null;
                const res = {"statusCode": 200};
                const body = DELETE_MESSAGE;
                stubDelete.yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubDelete);

                // Call the method being tested.
                let error;
                assetsREST.deleteItem(context, UnitTest.DUMMY_METADATA)
                    .then(function (message) {
                        // Verify that the delete stub was called once with a URI that contains the specified ID.
                        expect(stubDelete).to.have.been.calledOnce;
                        expect(stubDelete.firstCall.args[0].uri).to.contain(UnitTest.DUMMY_METADATA.id);

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

            it("should succeed when deleting a valid asset specifies no body message", function (done) {
                // Create a stub for the DELETE request to delete the specified asset.
                const stubDelete = sinon.stub(request, "del");
                const err = null;
                const res = {"statusCode": 204};
                const body = null;
                stubDelete.yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubDelete);

                // Call the method being tested.
                let error;
                assetsREST.deleteItem(context, UnitTest.DUMMY_METADATA)
                    .then(function (message) {
                        // Verify that the delete stub was called once with a URI that contains the specified ID.
                        expect(stubDelete).to.have.been.calledOnce;
                        expect(stubDelete.firstCall.args[0].uri).to.contain(UnitTest.DUMMY_METADATA.id);

                        // Verify that the REST API returned the expected value.
                        expect(message).to.contain(UnitTest.DUMMY_METADATA.id);
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

module.exports = AssetsRestUnitTest;
