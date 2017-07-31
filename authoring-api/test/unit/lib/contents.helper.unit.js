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
 * Unit tests for the contentsHelper object.
 */
"use strict";

// Require the super classes for this class.
const UnitTest = require("./base.unit.js");
const ContentsUnitTest = require("./contents.unit.js");
const BaseHelperUnit = require("./base.helper.unit.js");
const diff = require("diff");
const sinon = require("sinon");

// Require the local module being tested.
const restApi = require(UnitTest.API_PATH + "lib/contentREST.js").instance;
const fsApi = require(UnitTest.API_PATH + "lib/contentFS.js").instance;
const helper = require(UnitTest.API_PATH + "contentHelper.js").instance;
const path1 = ContentsUnitTest.VALID_CONTENTS_DIRECTORY + ContentsUnitTest.VALID_CONTENT_1;
const path2 = ContentsUnitTest.VALID_CONTENTS_DIRECTORY + ContentsUnitTest.VALID_CONTENT_2;
const badPath = ContentsUnitTest.INVALID_CONTENTS_DIRECTORY + ContentsUnitTest.INVALID_CONTENT_BAD_NAME;

// The default API context used for unit tests.
const context = UnitTest.DEFAULT_API_CONTEXT;

class ContentsHelperUnitTest extends BaseHelperUnit {
    constructor() {
        super();
    }
    run(){
        super.run(restApi, fsApi, helper,  path1, path2, badPath);
    }

    runAdditionalTests (restApi, fsApi, helper, path1, path2, badPath) {
        this.testFilterRetryPushContent(helper);
        this.testPushAllContent(fsApi, helper, path1, path2);
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

            it("should return true with a specific error.", function (done) {
                // Call the method being tested.
                let error;
                try {
                    // Create an error that will cause the item to be retried.
                    const PUSH_ERROR = "There was a push error - expected by the unit test.";
                    const pushError = new Error(PUSH_ERROR);
                    pushError.response = {"statusCode": 400, "body": {"errors": [{"code": 2012}]}};
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

    testPushAllContent (fsApi, helper, path1, path2) {
        const self = this;
        describe("pushAllItems", function () {
            it("should succeed when getting the local items succeeds.", function (done) {
                // The contents of the test item metadata files.
                const itemMetadata1 = UnitTest.getJsonObject(path1);
                const itemMetadata2 = UnitTest.getJsonObject(path2);

                // Create a helper.listNames stub that returns a list of items.
                const stubList = sinon.stub(fsApi, "listNames");
                stubList.resolves([helper.getName(itemMetadata1), helper.getName(itemMetadata2)]);

                // Create an error that will cause the item to be retried.
                const PUSH_ERROR = "There was a push error - expected by the unit test.";
                const pushError = new Error(PUSH_ERROR);
                pushError.response = {"statusCode": 400, "body": {"errors": [{"code": 6000}]}};
                pushError.retry = true;

                // Create a helper.pushItem stub that return an item.
                const stubPush = sinon.stub(helper, "pushItem");
                stubPush.onCall(0).resolves(itemMetadata1);
                stubPush.onCall(1).rejects(pushError);
                stubPush.onCall(2).resolves(itemMetadata2);

                const stubRetry = sinon.stub(helper, "getRetryPushProperty");
                stubRetry.onCall(0).returns([{"name": helper.getName(itemMetadata2), "error": pushError, "heading": "foo"}]);
                stubRetry.onCall(1).returns(2);
                stubRetry.onCall(2).returns([]);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubList);
                self.addTestDouble(stubPush);
                self.addTestDouble(stubRetry);

                // Call the method being tested.
                let error;
                helper.pushAllItems(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (items) {
                        // Verify that the stubs were called the expected number of times.
                        expect(stubList).to.have.been.calledOnce;
                        expect(stubPush).to.have.been.calledThrice;

                        // Verify that pushItem method was called with the expected values.
                        expect(diff.diffJson(stubPush.args[0][1], helper.getName(itemMetadata1))).to.have.lengthOf(1);
                        expect(diff.diffJson(stubPush.args[1][1], helper.getName(itemMetadata2))).to.have.lengthOf(1);
                        expect(diff.diffJson(stubPush.args[2][1], helper.getName(itemMetadata2))).to.have.lengthOf(1);

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

module.exports = ContentsHelperUnitTest;
