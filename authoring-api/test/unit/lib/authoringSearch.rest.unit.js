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
 * Unit tests for the PublishingJobsREST object.
 */
"use strict";

// Require the super classes for this class.
const UnitTest = require("./base.unit.js");
const AuthoringSearchUnitTest = require("./authoringSearch.unit.js");
const BaseRestUnitTest = require("./base.rest.unit.js");
const sinon = require("sinon");

// Require the local module being tested.
const restApi = require(UnitTest.API_PATH + "lib/authoringSearchREST.js").instance;
const options = require(UnitTest.API_PATH + "lib/utils/options.js");
const lookupUri =  options.getProperty(UnitTest.DEFAULT_API_CONTEXT, "authoring-search", "uri");

// Require the local modules that will be stubbed, mocked, and spied.
const utils = require(UnitTest.API_PATH + "lib/utils/utils.js");
const request = utils.getRequestWrapper();

class AuthoringSearchRestUnitTest extends BaseRestUnitTest {
    constructor() {
        super();
    }

    run () {
        const self = this;
        const restName = "authoringSearch";

        describe("Unit tests for Rest " + restName, function() {
            // Cleanup common resources consumed by a test.
            afterEach(function (done) {
                // Restore any stubs and spies used for the test.
                self.restoreTestDoubles();

                // Signal that the cleanup is complete.
                done();
            });

            // Run each of the tests defined in this class.
            self.testSingleton(restApi, lookupUri, restName);
            self.testGetRequestOptions(restApi);
            self.testAuthoringSearch(restApi);
        });
    }

    testAuthoringSearch (restApi) {
        const self = this;
        describe("authoringSearch", function() {
            it("should fail with missing q parameter", function (done) {
                let error;
                const searchParameters = {
                    fl: ["id", "name", "path"],
                    fq: ['isManaged:("false")', "path:\\/*"],
                    start: 0,
                    rows: 100
                };

                try {
                    restApi.search(context, searchParameters);

                    // This is not expected. Pass the error to the "done" function to indicate a failed test.
                    error = new Error("The promise should have been rejected.");
                } catch (err) {
                    try {
                        expect(err.message).to.contain("'q' is required");
                    } catch (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    }
                } finally {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
            });

            it("should succeed with valid args", function (done) {
                let error;
                const stub = sinon.stub(restApi, "searchQuery");
                stub.onCall(0).resolves({"got":"something"});
                self.addTestDouble(stub);

                const searchParameters = {
                    q: "*:*",
                    fl: ["id", "name", "path"],
                    fq: ['isManaged:("false")', "path:\\/*"],
                    start: 0,
                    rows: 100
                };

                restApi.search(context, searchParameters)
                    .then(function () {
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[1]).to.contain("q=*:*");
                        expect(stub.firstCall.args[1]).to.contain("fl=path");
                        expect(stub.firstCall.args[1]).to.contain("fq=isManaged");
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

            it("should succeed with valid (non-array) args", function (done) {
                let error;
                const stub = sinon.stub(restApi, "searchQuery");
                stub.onCall(0).resolves({"got":"something"});
                self.addTestDouble(stub);

                const searchParameters = {
                    q: "*:*",
                    qf: "foo",
                    fl: "path",
                    fq: "isManaged:('false')",
                    start: 0,
                    rows: 100
                };

                restApi.search(context, searchParameters)
                    .then(function () {
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[1]).to.contain("q=*:*");
                        expect(stub.firstCall.args[1]).to.contain("fl=path");
                        expect(stub.firstCall.args[1]).to.contain("fq=isManaged");
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


            it("should succeed with minimal args", function (done) {
                let error;
                const stub = sinon.stub(restApi, "searchQuery");
                stub.onCall(0).resolves({"got":"something"});
                self.addTestDouble(stub);

                const searchParameters = {
                    q: "*:*",
                    qf: "foo",
                    start: 0,
                    rows: 100
                };

                restApi.search(context, searchParameters)
                    .then(function () {
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[1]).to.contain("q=*:*");
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

            it("searchQuery should result in the expected call to request", function (done) {
                // Create a stub for GET requests
                const stub = sinon.stub(request, "get");

                // The first GET request is to retrieve the lookup URI.
                const err = null;
                const res = {"statusCode": 200};
                stub.onCall(0).yields(err, res, {"got":"something"});
                self.addTestDouble(stub);

                let error;
                const query = "q=*:*&fq=classification:asset&rows=10&start=0&fl=name,id,path&fq=isManaged:%28%22false%22%29&fq=path:%5C/*";
                restApi.searchQuery(context, query)
                    .then(function (res) {
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[0].uri).to.contain("authoring/v1/search");
                        expect(stub.firstCall.args[0].json).to.equal(true);
                        expect(res).to.not.be.empty;
                        expect(res.got).to.contain("something");
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

            it("should fail when the request fails with an error", function (done) {
                // Create a stub for the GET requests.
                const stub = sinon.stub(request, "get");

                // The second GET request is to retrieve the items, but returns an error.
                const GET_ERROR = "Error during search.";
                const err = new Error(GET_ERROR);
                const res = {};
                const body = null;
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                const query = "q=*:*&fq=classification:asset&rows=10&start=0&fl=name,id,path&fq=isManaged:%28%22false%22%29&fq=path:%5C/*";
                restApi.searchQuery(context, query)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once with the lookup URI and once with the URI.
                            expect(stub).to.have.been.calledOnce;
                            expect(stub.firstCall.args[0].uri).to.contain("authoring/v1/search");
                            expect(stub.firstCall.args[0].json).to.equal(true);

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.equal(GET_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when the request fails with an error and no response", function (done) {
                // Create a stub for the GET requests.
                const stub = sinon.stub(request, "get");

                // The second GET request is to retrieve the items, but returns an error.
                const GET_ERROR = "Error during search.";
                const err = new Error(GET_ERROR);
                const res = null;
                const body = null;
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                const query = "q=*:*&fq=classification:asset&rows=10&start=0&fl=name,id,path&fq=isManaged:%28%22false%22%29&fq=path:%5C/*";
                restApi.searchQuery(context, query)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once with the lookup URI and once with the URI.
                            expect(stub).to.have.been.calledOnce;
                            expect(stub.firstCall.args[0].uri).to.contain("authoring/v1/search");
                            expect(stub.firstCall.args[0].json).to.equal(true);

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.equal(GET_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when the request throws an error", function (done) {
                // Create a stub for the GET request to throw an error.
                const GET_ERROR = "Error during search, expected by unit test.";
                const stub = sinon.stub(request, "get");
                stub.onCall(0).throws(new Error(GET_ERROR));

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                const query = "q=*:*&fq=classification:asset&rows=10&start=0&fl=name,id,path&fq=isManaged:%28%22false%22%29&fq=path:%5C/*";
                restApi.searchQuery(context, query)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once with the lookup URI and once with the URI.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[0].uri).to.contain("authoring/v1/search");
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
        });
    }
}

module.exports = AuthoringSearchRestUnitTest;
