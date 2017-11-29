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
 * Unit tests for the TypesREST object.
 */
"use strict";

// Require the super classes for this class.
const UnitTest = require("./base.unit.js");
const TypesUnitTest = require("./types.unit.js");
const BaseHelperUnit = require("./base.helper.unit.js");

// Require the local module being tested.
const restApi = require(UnitTest.API_PATH + "lib/itemTypesREST.js").instance;
const fsApi = require(UnitTest.API_PATH + "lib/itemTypesFS.js").instance;
const helper = require(UnitTest.API_PATH + "itemTypesHelper.js").instance;
const path1 = TypesUnitTest.VALID_TYPES_DIRECTORY + TypesUnitTest.VALID_TYPE_1;
const path2 = TypesUnitTest.VALID_TYPES_DIRECTORY + TypesUnitTest.VALID_TYPE_2;
const badPath = TypesUnitTest.INVALID_TYPES_DIRECTORY + TypesUnitTest.INVALID_TYPE_BAD_NAME;

class TypesHelperUnitTest extends BaseHelperUnit {
    constructor() {
        super();
    }

    run(){
        super.run(restApi, fsApi,helper,  path1, path2, badPath );
    }

    runAdditionalTests (restApi, fsApi, helper, path1, path2, badPath) {
        this.testFilterRetryPushContent(helper);
        this.testFilterRetryDeleteContent(helper);
        this.testSearchRemote(restApi, helper, path1, path2, badPath);
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
                    pushError.response = {"statusCode": 400, "body": {"errors": [{"code": 2504}]}};
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

    testFilterRetryDeleteContent (helper) {
        describe("filterRetryDelete", function () {
            it("should return false with no error.", function (done) {
                // Call the method being tested.
                let error;
                try {
                    expect(helper.filterRetryDelete(context)).to.equal(false);
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
                    const DELETE_ERROR = "There was a delete error - expected by the unit test.";
                    const deleteError = new Error(DELETE_ERROR);
                    deleteError.response = {"statusCode": 400};
                    expect(helper.filterRetryDelete(context, deleteError)).to.equal(false);
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
                    const DELETE_ERROR = "There was a delete error - expected by the unit test.";
                    const deleteError = new Error(DELETE_ERROR);
                    deleteError.response = {"statusCode": 400, "body": {"errors": [{"code": 7000}]}};
                    expect(helper.filterRetryDelete(context, deleteError)).to.equal(false);
                } catch (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                } finally {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
            });

            it("should return true with error 3004.", function (done) {
                // Call the method being tested.
                let error;
                try {
                    // Create an error that will cause the item to be retried.
                    const DELETE_ERROR = "There was a delete error - expected by the unit test.";
                    const deleteError = new Error(DELETE_ERROR);
                    deleteError.response = {"statusCode": 400, "body": {"errors": [{"code": 2503}]}};
                    expect(helper.filterRetryDelete(context, deleteError)).to.equal(true);
                } catch (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                } finally {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
            });

            it("should return true with an error between 6000 and 7000.", function (done) {
                // Call the method being tested.
                let error;
                try {
                    // Create an error that will cause the item to be retried.
                    const DELETE_ERROR = "There was a delete error - expected by the unit test.";
                    const deleteError = new Error(DELETE_ERROR);
                    deleteError.response = {"statusCode": 400, "body": {"errors": [{"code": 6500}]}};
                    expect(helper.filterRetryDelete(context, deleteError)).to.equal(true);
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
}

module.exports = TypesHelperUnitTest;
