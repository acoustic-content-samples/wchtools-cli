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
 * Unit tests for the PagesREST object.
 */
"use strict";

// Require the super classes for this class.
const UnitTest = require("./base.unit.js");
const PagesUnitTest = require("./pages.unit.js");
const BaseHelperUnit = require("./base.helper.unit.js");

// Require the local module being tested.
const restApi = require(UnitTest.API_PATH + "lib/pagesREST.js").instance;
const fsApi = require(UnitTest.API_PATH + "lib/pagesFS.js").instance;
const helper = require(UnitTest.API_PATH + "pagesHelper.js").instance;
const path1 = PagesUnitTest.VALID_PAGES_DIRECTORY + PagesUnitTest.VALID_PAGE_1;
const path2 = PagesUnitTest.VALID_PAGES_DIRECTORY + PagesUnitTest.VALID_PAGE_2;
const badPath = PagesUnitTest.INVALID_PAGES_DIRECTORY + PagesUnitTest.INVALID_PAGE_BAD_NAME;

class PagesHelperUnitTest extends BaseHelperUnit {
    constructor () {
        super();
    }

    run () {
        super.run(restApi, fsApi, helper,  path1, path2, badPath );
    }

    testDeleteRemoteReadyDraftItems (restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata) {
        // Pages handle ready and draft filtering differently than other artifact types.
    }

    runAdditionalTests (restApi, fsApi, helper, path1, path2, badPath) {
        this.testCanDeleteItem(helper);
        this.testCompare(restApi, fsApi, helper, UnitTest.API_PATH + UnitTest.COMPARE_RESOURCES_DIRECTORY_1, UnitTest.API_PATH + UnitTest.COMPARE_RESOURCES_DIRECTORY_2);
    }

    testCanDeleteItem (helper) {
        describe("canDeleteItem", function () {
            it("should return false if deleting all and the page has a parent.", function (done) {
                // Call the method being tested.
                let error;
                try {
                    expect(helper.canDeleteItem({"parentId": "foobar"}, true)).to.equal(false);
                } catch (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                } finally {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
            });

            it("should return true if deleting all and the page does not have a parent.", function (done) {
                // Call the method being tested.
                let error;
                try {
                    expect(helper.canDeleteItem({}, true)).to.equal(true);
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

module.exports = PagesHelperUnitTest;
