/*
Copyright IBM Corporation 2016,2017

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
 * Unit tests for the TypesREST object.
 */
"use strict";

// Require the node modules used in this test file.
const sinon = require("sinon");

// Require the super classes for this class.
const UnitTest = require("./base.unit.js");
const PagesUnitTest = require("./pages.unit.js");
const BaseRestUnit = require("./base.rest.unit.js");

// Require the local module being tested.
const restApi = require(UnitTest.API_PATH + "lib/pagesREST.js").instance;
const options = require(UnitTest.API_PATH + "lib/utils/options.js");

// Get the "lookup" URI for types
const lookupUri =  options.getProperty(UnitTest.DEFAULT_API_CONTEXT, "pages", "uri");
const path1 = PagesUnitTest.VALID_PAGES_DIRECTORY + PagesUnitTest.VALID_PAGE_1;
const path2 = PagesUnitTest.VALID_PAGES_DIRECTORY + PagesUnitTest.VALID_PAGE_2;

// Require the local modules that will be stubbed, mocked, and spied.
const utils = require(UnitTest.API_PATH + "lib/utils/utils.js");
const request = utils.getRequestWrapper();

// The default API context used for unit tests.
const context = UnitTest.DEFAULT_API_CONTEXT;

class PagesRestUnitTest extends BaseRestUnit {
    constructor () {
        super();
    }

    run () {
        super.run(restApi, lookupUri, "pages", path1, path2);
        this.testDeleteItemWithContent(restApi, lookupUri, "pages", path1, path2);
    }

    testUpdateItem (restApi, lookupUri, restName, itemPath1, itemPath2) {
        const self = this;

        super.testUpdateItem(restApi, lookupUri, restName, itemPath1, itemPath2);

        describe("updateItem", function () {
            it("should succeed with a hierarchicalPath even if the service doesn't return one", function (done) {
                const updateItem = {id: UnitTest.DUMMY_ID, hierarchicalPath: "foo"};
                const stubUpdate = sinon.stub(restApi.__proto__.__proto__, "updateItem");
                stubUpdate.resolves({id: updateItem.id});

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubUpdate);

                // Call the method being tested.
                let error;
                restApi.updateItem(context, updateItem, UnitTest.DUMMY_OPTIONS)
                    .then(function (item) {
                        // Verify that the updateItem method is resolved with the expected values.
                        expect(item["id"]).to.equal(updateItem["id"]);
                        expect(item["hierarchicalPath"]).to.equal(updateItem["hierarchicalPath"]);

                        // Verify that the stub was called once with the specified value.
                        expect(stubUpdate).to.have.been.calledOnce;
                        expect(stubUpdate.args[0][1]["hierarchicalPath"]).to.equal(updateItem["hierarchicalPath"]);
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

        super.testCreateItem(restApi, lookupUri, restName, itemPath1, itemPath2);

        describe("createItem", function () {
            it("should succeed with a hierarchicalPath even if the service doesn't return one", function (done) {
                const createItem = {id: UnitTest.DUMMY_ID, hierarchicalPath: "foo"};
                const stubCreate = sinon.stub(restApi.__proto__.__proto__, "createItem");
                stubCreate.resolves({id: createItem.id});

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubCreate);

                // Call the method being tested.
                let error;
                restApi.createItem(context, createItem, UnitTest.DUMMY_OPTIONS)
                    .then(function (item) {
                        // Verify that the createItem method is resolved with the expected values.
                        expect(item["id"]).to.equal(createItem["id"]);
                        expect(item["hierarchicalPath"]).to.equal(createItem["hierarchicalPath"]);

                        // Verify that the stub was called once with the specified value.
                        expect(stubCreate).to.have.been.calledOnce;
                        expect(stubCreate.args[0][1]["hierarchicalPath"]).to.equal(createItem["hierarchicalPath"]);
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

    testDeleteItemWithContent (restApi, lookupUri, restName, itemPath1, itemPath2) {
        const self = this;

        describe("deletePageWithContent", function () {

            afterEach(function (done) {
                // Restore any stubs and spies used for the test.
                self.restoreTestDoubles();

                // Signal that the cleanup is complete.
                done();
            });

            it("should succeed with delete-content query parameter", function (done) {

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
                restApi.deleteItem(context, {id:UnitTest.DUMMY_ID}, {"delete-content":true})
                    .then(function (message) {
                        // Verify that the delete stub was called once with a URI that contains the specified ID.
                        expect(stubDelete).to.have.been.calledOnce;
                        expect(stubDelete.firstCall.args[0].uri).to.contain(UnitTest.DUMMY_ID);
                        expect(stubDelete.firstCall.args[0].uri).to.contain("?delete-content=true");
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

        });
    }
}

module.exports = PagesRestUnitTest;
