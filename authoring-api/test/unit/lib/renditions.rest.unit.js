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

// Require the node modules used in this test file.
const utils = require(UnitTest.API_PATH + "lib/utils/utils.js");
const request = utils.getRequestWrapper();
const diff = require("diff");
const sinon = require("sinon");

// Require the local module being tested.
const restApi = require(UnitTest.API_PATH + "lib/renditionsREST.js").instance;

// Get the "lookup" URI for renditions
const options = require(UnitTest.API_PATH + "lib/utils/options.js");
const lookupUri =  options.getProperty(UnitTest.DEFAULT_API_CONTEXT, "renditions", "uri");
const path1 = RenditionsUnitTest.VALID_RENDITIONS_DIRECTORY + RenditionsUnitTest.VALID_RENDITION_1;
const path2 = RenditionsUnitTest.VALID_RENDITIONS_DIRECTORY + RenditionsUnitTest.VALID_RENDITION_2;

// The default API context used for unit tests.
const context = UnitTest.DEFAULT_API_CONTEXT;

class RenditionsRestUnitTest extends BaseRestUnit {
    constructor () {
        super();
    }

    run () {
        super.run(restApi, lookupUri, "renditions", path1, path2);
    }

    //  when we add a create test to the base rest this should call that update for these just call create
    testUpdateItem (restApi, lookupUri, restName, itemPath1, itemPath2) {
        const self = this;

        describe("updateItem", function () {
            it("should call create", function (done) {
                // Create a stub for the createItem method.
                const updateItem = {id: UnitTest.DUMMY_ID};
                const stubCreate = sinon.stub(restApi, "createItem");
                stubCreate.resolves(updateItem);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubCreate);

                // Call the method being tested.
                let error;
                restApi.updateItem(context, updateItem, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // Verify that the stub was called once with the specified value.
                        expect(stubCreate).to.have.been.calledOnce;
                        expect(stubCreate.args[0][1]["id"]).to.equal(UnitTest.DUMMY_ID);
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

    testCreateItem (restApi, lookupUri, restName, itemPath1, itemPath2) {
        const self = this;

        it("should fail when getting an item fails with a not found error and the create also fails", function (done) {
            // Create a stub for the GET request.
            const stubGet = sinon.stub(request, "get");
            const GET_ERROR = "Error getting the item.";
            let err = new Error(GET_ERROR);
            let res = {"statusCode": 404};
            let body = null;
            stubGet.onCall(0).yields(err, res, body);

            // Create a stub for the POST request.
            const stubPost = sinon.stub(request, "post");
            const CREATE_ERROR = "Error creating the item.";
            err = new Error(CREATE_ERROR);
            res = {"statusCode": 400};
            body = null;
            stubPost.onCall(0).yields(err, res, body);

            // The stub should be restored when the test is complete.
            self.addTestDouble(stubPost);
            self.addTestDouble(stubGet);

            // Call the method being tested.
            let error;
            restApi.createItem(context, {"id":"123"}, UnitTest.DUMMY_OPTIONS)
                .then(function () {
                    // This is not expected. Pass the error to the "done" function to indicate a failed test.
                    error = new Error("The promise for the request URI should have been rejected.");
                })
                .catch(function (err) {
                    // Verify thqat the POST stub was called once and thge PUT stub was not called.
                    expect(stubPost).to.have.been.calledOnce;
                    expect(stubGet).to.have.been.calledOnce;

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

        it("should succeed when getting an item fails with a not found error and the create succeeds", function (done) {
            // Create a stub for the GET request.
            const stubGet = sinon.stub(request, "get");
            const GET_ERROR = "Error getting the item.";
            let err = new Error(GET_ERROR);
            let res = {"statusCode": 404};
            let body = null;
            stubGet.onCall(0).yields(err, res, body);

            // Create a stub for the POST request to return a conflict error.
            const stubPost = sinon.stub(request, "post");
            const item1 = UnitTest.getJsonObject(itemPath1);
            err = null;
            res = {"statusCode": 201};
            body = item1;
            stubPost.onCall(0).yields(err, res, body);

            // The stub should be restored when the test is complete.
            self.addTestDouble(stubPost);
            self.addTestDouble(stubGet);

            // Call the method being tested.
            let error;
            restApi.updateItem(context, item1, UnitTest.DUMMY_OPTIONS)
                .then(function (item) {
                    // Verify thqat the PUT anbd POST stubs were called once.
                    expect(stubPost).to.have.been.calledOnce;
                    expect(stubGet).to.have.been.calledOnce;

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

        describe("createItem", function () {
            it("should succeed if the item already exists", function (done) {
                const createItem = {id: UnitTest.DUMMY_ID};
                const stubGet = sinon.stub(restApi, "getItem");
                stubGet.resolves(createItem);

                const spyPost = sinon.spy(request, "post");

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(spyPost);

                // Call the method being tested.
                let error;
                restApi.createItem(context, createItem, UnitTest.DUMMY_OPTIONS)
                    .then(function (item) {
                        // Verify that the createItem method is resolved with the existing item.
                        expect(item["id"]).to.equal(createItem["id"]);

                        // Verify that the stub was called once with the specified value.
                        expect(stubGet).to.have.been.calledOnce;
                        expect(stubGet.args[0][1]).to.equal(createItem["id"]);

                        // Verify that the post stub was not called.
                        expect(spyPost).to.not.have.been.called;
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

    testDeleteItem (restApi, lookupUri, restName, itemPath1, itemPath2) {
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

            it("should fail calling delete with no opts", function (done) {
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
}

module.exports = RenditionsRestUnitTest;
