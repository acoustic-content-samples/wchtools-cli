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
 * Unit tests for the presentationsHelper object.
 *
 * NOTE: The StatusTracker and EventEmitter objects used by the presentationsHelper object
 * are used to execute some of the tests, so the provided functionality is not stubbed out.
 */
"use strict";

// Require the super classes for this class.
const UnitTest = require("./base.unit.js");
const PresentationsUnitTest = require("./presentations.unit.js");
const BaseHelperUnitTest = require("./base.helper.unit.js");
const sinon = require("sinon");

// Require the local module being tested.
const restApi = require(UnitTest.API_PATH + "lib/presentationsREST.js").instance;
const fsApi = require(UnitTest.API_PATH + "lib/presentationsFS.js").instance;
const helper = require(UnitTest.API_PATH + "presentationsHelper.js").instance;
const path1 = PresentationsUnitTest.VALID_PRESENTATIONS_DIRECTORY + PresentationsUnitTest.VALID_PRESENTATION_1;
const path2 = PresentationsUnitTest.VALID_PRESENTATIONS_DIRECTORY + PresentationsUnitTest.VALID_PRESENTATION_2;
const badPath = PresentationsUnitTest.INVALID_PRESENTATIONS_DIRECTORY + PresentationsUnitTest.INVALID_PRESENTATION_BAD_NAME;

class PresentationsHelperUnitTest extends BaseHelperUnitTest {
    constructor() {
        super();
    }

    run () {
        super.run(restApi, fsApi, helper, path1, path2, badPath);
    }

    runAdditionalTests (restApi, fsApi, helper, path1, path2, badPath/*, type, itemMetadata1, itemMetadata2, badMetadata*/) {
        this.testCreateLocalItem(restApi, fsApi, helper, path1, path2, badPath);
    }

    testCreateLocalItem (restApi, fsApi, helper, path1, path2,badPath) {
        const self = this;
        describe("create local presentation", function () {
            it("should create a local presentation", function (done) {
                const stub = sinon.stub(fsApi, "newItem");
                const presentation = {"name": "testCreateLocal", "template": "/html/template.hbs"};
                stub.resolves(presentation);
                self.addTestDouble(stub);

                let error;
                helper.createLocalItem(presentation)
                    .then(function(p) {
                        expect(p).to.not.be.empty;
                        expect(p.name).to.equal(presentation.name);
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

            it("should handle failed local presentation", function (done) {
                const stub = sinon.stub(fsApi, "newItem");
                const ITEM_ERROR = "There was an error creating the local presentation.";
                stub.rejects(ITEM_ERROR);
                self.addTestDouble(stub);

                let error;
                helper.createLocalItem({"BAD":"STUFF"})
                    .then(function (/*items*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for createLocalItem should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once.
                            expect(stub).to.be.calledOnce;

                            // Verify that the expected error is returned.
                            expect(err.message).to.equal(ITEM_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });

            });
        });
    }
}

module.exports = PresentationsHelperUnitTest;
