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
 * Unit tests for the categoriesHelper object.
 */
"use strict";

// Require the super classes for this class.
const UnitTest = require("./base.unit.js");
const CategoriesUnitTest = require("./categories.unit.js");
const BaseHelperUnitTest = require("./base.helper.unit.js");
const diff = require("diff");
const sinon = require("sinon");

// Require the local module being tested.
const restApi = require(UnitTest.API_PATH + "lib/categoriesREST.js").instance;
const fsApi = require(UnitTest.API_PATH + "lib/categoriesFS.js").instance;
const helper = require(UnitTest.API_PATH + "categoriesHelper.js").instance;
const path1 = CategoriesUnitTest.VALID_CATEGORIES_DIRECTORY + CategoriesUnitTest.VALID_CATEGORY_1;
const path2 = CategoriesUnitTest.VALID_CATEGORIES_DIRECTORY + CategoriesUnitTest.VALID_CATEGORY_2;
const systemPath = CategoriesUnitTest.VALID_CATEGORIES_DIRECTORY + CategoriesUnitTest.VALID_SYSTEM_CATEGORY_1;
const nonSystemPath1 = CategoriesUnitTest.VALID_CATEGORIES_DIRECTORY + CategoriesUnitTest.VALID_NON_SYSTEM_CATEGORY_1;
const nonSystemPath2 = CategoriesUnitTest.VALID_CATEGORIES_DIRECTORY + CategoriesUnitTest.VALID_NON_SYSTEM_CATEGORY_2;
const badPath = CategoriesUnitTest.INVALID_CATEGORIES_DIRECTORY + CategoriesUnitTest.INVALID_CATEGORY_BAD_NAME;

// The default API context used for unit tests.
const context = UnitTest.DEFAULT_API_CONTEXT;

class CategoriesHelperUnitTest extends BaseHelperUnitTest {
    constructor() {
        super();
    }

    run(){
        super.run(restApi, fsApi, helper,  path1, path2, badPath);
    }

    runAdditionalTests (restApi, fsApi, helper, path1, path2/*, badPath, type, itemMetadata1, itemMetadata2, badMetadata*/) {
        this.testCanPushItem(helper);
        this.testCanPullItem(helper);
        this.testFilterRetryPushContent(helper);
        this.testPushModifiedCategories(helper, path1, path2);
        this.testCompare(restApi, fsApi, helper, UnitTest.API_PATH + UnitTest.COMPARE_RESOURCES_DIRECTORY_1, UnitTest.API_PATH + UnitTest.COMPARE_RESOURCES_DIRECTORY_2);
    }

    testCanPushItem (helper) {
        describe("canPushItem", function () {
            it("should return false for a system category.", function (done) {
                // The contents of the test item metadata file.
                const itemMetadata = UnitTest.getJsonObject(systemPath);

                // Call the method being tested.
                let error;
                try {
                    expect(helper.canPushItem(itemMetadata)).to.equal(false);
                } catch (err) {
                    error = err;
                } finally {
                    done(error);
                }
            });

            it("should return true for a non-system category.", function (done) {
                // The contents of the test item metadata files.
                const itemMetadata = UnitTest.getJsonObject(nonSystemPath1);

                // Call the method being tested.
                let error;
                try {
                    expect(helper.canPushItem(itemMetadata)).to.equal(true);
                } catch (err) {
                    error = err;
                } finally {
                    done(error);
                }
            });
        });
    }

    testCanPullItem (helper) {
        describe("canPullItem", function () {
            it("should return false for a system category.", function (done) {
                // The contents of the test item metadata file.
                const itemMetadata = UnitTest.getJsonObject(systemPath);

                // Call the method being tested.
                let error;
                try {
                    expect(helper.canPullItem(itemMetadata)).to.equal(false);
                } catch (err) {
                    error = err;
                } finally {
                    done(error);
                }
            });

            it("should return true for a non-system category.", function (done) {
                // The contents of the test item metadata files.
                const itemMetadata = UnitTest.getJsonObject(nonSystemPath1);

                // Call the method being tested.
                let error;
                try {
                    expect(helper.canPullItem(itemMetadata)).to.equal(true);
                } catch (err) {
                    error = err;
                } finally {
                    done(error);
                }
            });
        });
    }

    testFilterRetryPushContent (helper) {
        describe("filterRetryPush", function () {
            it("should return false with no error.", function (done) {
                // Call the method being tested.
                let error;
                try {
                    expect(helper.filterRetryPush(context)).to.equal(false);
                } catch (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                } finally {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
            });

            it("should return false with no error response body.", function (done) {
                // Call the method being tested.
                let error;
                try {
                    const PUSH_ERROR = "There was a push error - expected by the unit test.";
                    const pushError = new Error(PUSH_ERROR);
                    pushError.response = {"statusCode": 400};
                    expect(helper.filterRetryPush(context, pushError)).to.equal(false);
                } catch (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                } finally {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
            });

            it("should return false with the wrong error code.", function (done) {
                // Call the method being tested.
                let error;
                try {
                    const PUSH_ERROR = "There was a push error - expected by the unit test.";
                    const pushError = new Error(PUSH_ERROR);
                    pushError.response = {"statusCode": 400, "body": {"errors": [{"code": 7000}]}};
                    expect(helper.filterRetryPush(context, pushError)).to.equal(false);
                } catch (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                } finally {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
            });

            it("should return true with a specific error code (number).", function (done) {
                // Call the method being tested.
                let error;
                try {
                    // Create an error that will cause the item to be retried.
                    const PUSH_ERROR = "There was a push error - expected by the unit test.";
                    const pushError = new Error(PUSH_ERROR);
                    pushError.response = {"statusCode": 400, "body": {"errors": [{"code": 2004}]}};
                    expect(helper.filterRetryPush(context, pushError)).to.equal(true);
                } catch (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                } finally {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
            });

            it("should return true with a specific error code (string).", function (done) {
                // Call the method being tested.
                let error;
                try {
                    // Create an error that will cause the item to be retried.
                    const PUSH_ERROR = "There was a push error - expected by the unit test.";
                    const pushError = new Error(PUSH_ERROR);
                    pushError.response = {"statusCode": 400, "body": {"errors": [{"code": "2004"}]}};
                    expect(helper.filterRetryPush(context, pushError)).to.equal(true);
                } catch (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                } finally {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
            });
        });
    }

    testPushModifiedCategories (helper, path1, path2) {
        const self = this;
        describe("pushModifiedItems", function () {
            it("should succeed when pushing system categories.", function (done) {
                // The contents of the test item metadata files.
                const itemMetadata1 = UnitTest.getJsonObject(systemPath);
                const itemMetadata2 = UnitTest.getJsonObject(nonSystemPath1);
                const itemMetadata3 = UnitTest.getJsonObject(nonSystemPath2);

                // Create a helper._listModifiedLocalItemNames stub that returns a list of items.
                const stubList = sinon.stub(helper, "_listModifiedLocalItemNames");
                stubList.resolves([helper.getName(itemMetadata1), helper.getName(itemMetadata2), helper.getName(itemMetadata3)]);

                const stubGetLocalItem = sinon.stub(helper, "getLocalItem");
                stubGetLocalItem.onCall(0).resolves(itemMetadata1);
                stubGetLocalItem.onCall(1).resolves(itemMetadata2);
                stubGetLocalItem.onCall(2).resolves(itemMetadata3);

                // Create a helper.pushItem stub that return an item.
                const stubPush = sinon.stub(helper, "pushItem");
                stubPush.onCall(0).resolves(undefined);
                stubPush.onCall(1).resolves(itemMetadata2);
                stubPush.onCall(2).resolves(itemMetadata3);

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stubList);
                self.addTestDouble(stubPush);
                self.addTestDouble(stubGetLocalItem);

                // Call the method being tested.
                let error;
                helper.pushModifiedItems(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (items) {
                        // Verify that the stubs were called the expected number of times.
                        expect(stubList).to.have.been.calledOnce;
                        expect(stubPush).to.have.been.calledThrice;

                        // Verify that pushItem method was called with the expected values.
                        expect(diff.diffJson(stubPush.args[0][1], helper.getName(itemMetadata1))).to.have.lengthOf(1);
                        expect(diff.diffJson(stubPush.args[1][1], helper.getName(itemMetadata2))).to.have.lengthOf(1);
                        expect(diff.diffJson(stubPush.args[2][1], helper.getName(itemMetadata3))).to.have.lengthOf(1);

                        // Verify that the expected values were returned.
                        expect(diff.diffJson(items[0], itemMetadata2)).to.have.lengthOf(1);
                        expect(diff.diffJson(items[1], itemMetadata3)).to.have.lengthOf(1);
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

            it("should succeed when pushing categories with ancestors.", function (done) {
                // The contents of the test item metadata files.
                const itemMetadata1 = UnitTest.getJsonObject(path1);
                const itemMetadata2 = UnitTest.getJsonObject(path2);

                // Add ancestor IDs to the category metadata.
                itemMetadata1["ancestorIds"] = ["040e272a2bdb3f225a4176681251d5f8", "another-id"];
                itemMetadata2["ancestorIds"] = ["another-id"];

                // Create a helper._listModifiedLocalItemNames stub that returns a list of items.
                const stubList = sinon.stub(helper, "_listModifiedLocalItemNames");
                stubList.resolves([helper.getName(itemMetadata1), helper.getName(itemMetadata2)]);

                // Create a helper.pushItem stub that return an item.
                const stubPush = sinon.stub(helper, "pushItem");
                stubPush.onCall(0).resolves(itemMetadata1);
                stubPush.onCall(1).resolves(itemMetadata2);

                const stubGetLocalItem = sinon.stub(helper, "getLocalItem");
                stubGetLocalItem.onCall(0).resolves(itemMetadata1);
                stubGetLocalItem.onCall(1).resolves(itemMetadata2);

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stubList);
                self.addTestDouble(stubPush);
                self.addTestDouble(stubGetLocalItem);

                // Call the method being tested.
                let error;
                helper.pushModifiedItems(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (items) {
                        // Verify that the stubs were called the expected number of times.
                        expect(stubList).to.have.been.calledOnce;
                        expect(stubPush).to.have.been.calledTwice;

                        // Verify that pushItem method was called with the expected values.
                        expect(diff.diffJson(stubPush.args[0][1], helper.getName(itemMetadata1))).to.have.lengthOf(1);
                        expect(diff.diffJson(stubPush.args[1][1], helper.getName(itemMetadata2))).to.have.lengthOf(1);

                        // Verify that the expected values were returned.
                        expect(diff.diffJson(items[0], itemMetadata1)).to.have.lengthOf(1);
                        expect(diff.diffJson(items[1], itemMetadata2)).to.have.lengthOf(1);
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

module.exports = CategoriesHelperUnitTest;
