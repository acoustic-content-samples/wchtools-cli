/*
Copyright IBM Corporation 2017

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
 * Unit tests for the publishingSiteRevisionsREST object.
 */
"use strict";

// Require the super classes for this class.
const UnitTest = require("./base.unit.js");
const PublishingSiteRevisionsUnitTest = require("./publishingSiteRevisions.unit.js");
const BaseRestUnit = require("./base.rest.unit.js");

const fs = require("fs");
const diff = require("diff");
const sinon = require("sinon");

// Require the local modules that will be stubbed, mocked, and spied.
const utils = require(UnitTest.API_PATH + "lib/utils/utils.js");
const request = utils.getRequestWrapper();

// The default API context used for unit tests.
const context = UnitTest.DEFAULT_API_CONTEXT;

// Require the local module being tested.
const restApi = require(UnitTest.API_PATH + "lib/publishingSiteRevisionsREST.js").instance;
const options = require(UnitTest.API_PATH + "lib/utils/options.js");
// Get the "lookup" URI for site-revisions.
const lookupUri =  options.getProperty(UnitTest.DEFAULT_API_CONTEXT, "site-revisions", "uri");
const path1 = PublishingSiteRevisionsUnitTest.VALID_PUBLISHING_SITEREVISIONS_DIRECTORY + PublishingSiteRevisionsUnitTest.VALID_PUBLISHING_SITEREVISION_1;
const path2 = PublishingSiteRevisionsUnitTest.VALID_PUBLISHING_SITEREVISIONS_DIRECTORY + PublishingSiteRevisionsUnitTest.VALID_PUBLISHING_SITEREVISION_2;

class PublishingSiteRevisionsRestUnitTest extends BaseRestUnit {
    constructor() {
        super();
    }
    run(){
        super.run(restApi, lookupUri, "publishing site revisions", path1, path2);
    }

    testGetModifiedItemsSuccess (restApi, lookupUri, restName, itemPath1, itemPath2) {
        const self = this;

        describe("getModifiedItems", function() {
            it("should succeed when getting valid items", function (done) {
                // Create a stub for GET requests
                const stub = sinon.stub(request, "get");

                // The first GET request is to retrieve the lookup URI.
                const err = null;
                const res = {"statusCode": 200};

                // The second GET request is to retrieve the items metadata.
                const item1 = UnitTest.getJsonObject(itemPath1);
                const body = {"items": [item1]};
                stub.onCall(0).yields(err, res, item1);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                restApi.getModifiedItems(context, "some timestamp", UnitTest.DUMMY_OPTIONS)
                    .then(function (items) {
                        // Verify that the stub was called twice, first with the lookup URI and then with the URI.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[0].uri).to.contain("http");
                        expect(stub.firstCall.args[0].json).to.equal(true);

                        expect(diff.diffJson(item1, items[0])).to.have.lengthOf(1);
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

    testGetItemsSuccess (restApi, lookupUri, restName, itemPath1, itemPath2) {
        const self = this;

        describe("getItemsSuccess", function() {
            it("should succeed when getting valid items", function (done) {
                // Create a stub for GET requests
                const stub = sinon.stub(request, "get");

                // The first GET request is to retrieve the lookup URI.
                const err = null;
                const res = {"statusCode": 200};

                // The second GET request is to retrieve the items metadata.
                const item1 = UnitTest.getJsonObject(itemPath1);
                stub.onCall(0).yields(err, res, item1);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                restApi.getItems(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (items) {
                        // Verify that the stub was called twice, first with the lookup URI and then with the URI.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[0].uri).to.contain("http");
                        expect(stub.firstCall.args[0].json).to.equal(true);

                        // Verify that the REST API returned the expected values.
                        expect(diff.diffJson(item1, items[0])).to.have.lengthOf(1);
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

module.exports = PublishingSiteRevisionsRestUnitTest;
