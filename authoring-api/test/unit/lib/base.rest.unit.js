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
const options = require(UnitTest.API_PATH + "lib/utils/options.js");

// Require the local modules that will be stubbed, mocked, and spied.
const utils = require(UnitTest.API_PATH + "lib/utils/utils.js");
const request = utils.getRequestWrapper();

class BaseRestUnitTest extends UnitTest {
    constructor() {
        super();
    }

    run (restApi, lookupUri, restName, itemPath1, itemPath2) {
        const self = this;
        describe("Unit tests for Rest " + restName, function() {
            // Initialize common resources before running the unit tests.
            before(function (done) {
                // Reset the state of the REST API.
                restApi.reset();

                // Signal that the cleanup is complete.
                done();
            });

            // Cleanup common resources consumed by a test.
            afterEach(function (done) {
                // Restore any stubs and spies used for the test.
                self.restoreTestDoubles();

                // Reset the state of the REST API.
                restApi.reset();

                // Signal that the cleanup is complete.
                done();
            });

            // Run each of the tests defined in this class.
            self.testSingleton(restApi, lookupUri, restName, itemPath1, itemPath2);
            self.testGetModifiedItems(restApi, lookupUri, restName, itemPath1, itemPath2);
            self.testGetItems(restApi, lookupUri, restName, itemPath1, itemPath2);
            self.testGetItem(restApi, lookupUri, restName, itemPath1, itemPath2);
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

    testGetModifiedItems (restApi, lookupUri, restName, itemPath1, itemPath2) {
        const self = this;

        describe("getModifiedItems", function() {
            it("should fail when getting items the fails with an error", function (done) {
                // Create a stub for the GET requests.
                const stub = sinon.stub(request, "get");

                // The second GET request is to retrieve the items, but returns an error.
                const URI_ERROR = "Error getting the items.";
                const err = new Error(URI_ERROR);
                const res = null;
                const body = null;
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                restApi.getModifiedItems(null, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the request URI should have been rejected.");
                    })
                    .catch(function (err) {
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
                restApi.getModifiedItems(null, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the request URI should have been rejected.");
                    })
                    .catch(function (err) {
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
                restApi.getModifiedItems("some timestamp", UnitTest.DUMMY_OPTIONS)
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

    testGetItems (restApi, lookupUri, restName, itemPath1, itemPath2) {
        const self = this;

        describe("getItems", function() {
            it("should fail when getting items the fails with an error", function (done) {
                // Create a stub for the GET requests.
                const stub = sinon.stub(request, "get");

                // The second GET request is to retrieve the items, but returns an error.
                const URI_ERROR = "Error getting the items.";
                const err = new Error(URI_ERROR);
                const res = null;
                const body = null;
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                restApi.getItems(UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the request URI should have been rejected.");
                    })
                    .catch(function (err) {
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
                restApi.getItems(UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the request URI should have been rejected.");
                    })
                    .catch(function (err) {
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
                restApi.getItems(UnitTest.DUMMY_OPTIONS)
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
                restApi.getItem(UnitTest.DUMMY_ID, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the item should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.contain(CANNOTFIND_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when getting a valid resource", function (done) {
                // Read the contents of a test file.
                const item =  UnitTest.getJsonObject(itemPath1);
                // Create an REST.getItem stub that returns a promise for the item content.
                const stubItem = sinon.stub(restApi, "getItem");
                stubItem.resolves(item);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubItem);

                // Call the method being tested.
                let error;
                restApi.getItem(item.id, UnitTest.DUMMY_OPTIONS)
                    .then(function (rContent) {
                        // Verify that the item stub was called once with the expected value.
                        expect(stubItem).to.have.been.calledOnce;

                        // Verify that the REST API returned the expected value.
                        expect(diff.diffJson(item, rContent)).to.have.lengthOf(1);
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

    testDeleteItem (restApi, lookupUri, restName, itemPath1, itemPath2) {
        const self = this;
        describe("deleteItem", function() {
            it("should fail when deleting the item fails", function (done) {
                // Create a stub for the DELETE request which returns an error.
                const _ERROR = "Error deleting the item.";
                const stubDelete = sinon.stub(request, "del");
                const err = new Error(_ERROR);
                const res = {"statusCode": 403};
                const body = null;
                stubDelete.yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubDelete);

                // Call the method being tested.
                let error;
                restApi.deleteItem({id: UnitTest.DUMMY_ID})
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the item should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the delete stub was called once with a URI that contains the specified ID.
                            expect(stubDelete).to.have.been.calledOnce;
                            expect(stubDelete.firstCall.args[0].uri).to.contain(UnitTest.DUMMY_ID);

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.contain(_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
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
                restApi.deleteItem({id:UnitTest.DUMMY_ID})
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
                restApi.deleteItem({id: UnitTest.DUMMY_ID})
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

        // Execute several failure cases to test the various ways the server might return an error. Subsequent tests do
        // not need to repeat the test matrix, they can just execute one of these tests to verify an error is returned.
        describe("updateItem", function() {
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
                restApi.updateItem({"id":"123"})
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            expect(stub2).to.have.been.calledOnce;

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.equal(UPDATE_ERROR);
                        } catch (err) {
                            error = err;
                        }
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
                restApi.updateItem({"id":"123"})
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            expect(stub2).to.have.been.calledOnce;

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.equal(UPDATE_ERROR);
                        } catch (err) {
                            error = err;
                        }
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
                restApi.updateItem(item1)
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
                let body = item1;
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                const stubOverride = sinon.stub(restApi, "supportsForceOverride");
                stubOverride.returns(true);
                self.addTestDouble(stubOverride);

                // Call the method being tested.
                let error;
                restApi.updateItem(item1, {"force-override": true})
                    .then(function (item) {
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
                let body = item1;
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                const stubOverride = sinon.stub(restApi, "supportsForceOverride");
                stubOverride.returns(false);
                self.addTestDouble(stubOverride);

                // Call the method being tested.
                let error;
                restApi.updateItem(item1, {"force-override": true})
                    .then(function (item) {
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

                const getStub = sinon.stub(request, "get");
                getStub.onCall(0).yields(new Error("expected: Item not found"), null, null);
                self.addTestDouble(getStub);

                // Call the method being tested.
                let error;
                restApi.createItem({"id":"123"})
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            expect(stub2).to.have.been.calledOnce;

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.equal(CREATE_ERROR);
                        } catch (err) {
                            error = err;
                        }
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

                const getStub = sinon.stub(request, "get");
                getStub.onCall(0).yields(new Error("expected: Item not found"), null, null);
                self.addTestDouble(getStub);

                // Call the method being tested.
                let error;
                restApi.createItem({"id":"123"})
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            expect(stub2).to.have.been.calledOnce;

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.equal(UPDATE_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when creating valid items", function (done) {
                const err = null;
                const res = {"statusCode": 200};
                // The second GET request is to retrieve the items metadata.
                const stub2 = sinon.stub(request, "post");
                const item1 = UnitTest.getJsonObject(itemPath1);
                const body = item1;
                stub2.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub2);

                const getStub = sinon.stub(request, "get");
                getStub.onCall(0).yields(new Error("expected: Item not found"), null, null);
                self.addTestDouble(getStub);

                // Call the method being tested.
                let error;
                restApi.createItem(item1)
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
        });
    }
}

module.exports = BaseRestUnitTest;
