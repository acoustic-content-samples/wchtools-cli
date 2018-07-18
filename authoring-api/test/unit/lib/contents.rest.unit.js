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
 * Unit tests for the ContentsREST object.
 */
"use strict";

// Require the super classes for this class.
const UnitTest = require("./base.unit.js");
const ContentsUnitTest = require("./contents.unit.js");
const BaseRestUnitTest = require("./base.rest.unit.js");

// Require the local module being tested.
const restApi = require(UnitTest.API_PATH + "lib/contentREST.js").instance;
const options = require(UnitTest.API_PATH + "lib/utils/options.js");
// Get the "lookup" URI for content.
const lookupUri =  options.getProperty(UnitTest.DEFAULT_API_CONTEXT, "content", "uri");
const path1 = ContentsUnitTest.VALID_CONTENTS_DIRECTORY + ContentsUnitTest.VALID_CONTENT_1;
const path2 = ContentsUnitTest.VALID_CONTENTS_DIRECTORY + ContentsUnitTest.VALID_CONTENT_2;

// The default API context used for unit tests.
const context = UnitTest.DEFAULT_API_CONTEXT;

class ContentsRestUnitTest extends BaseRestUnitTest {
    constructor() {
        super();
    }
    run(){
        super.run(restApi, lookupUri, "content", path1, path2);
        this.testGetUpdateRequestOptions(restApi);
    }

    testGetUpdateRequestOptions (restApi) {

        describe("getUpdateRequestOptions", function() {

            it("should succeed with valid options", function (done) {
                UnitTest.restoreOptions(context);
                const opts = {
                    "x-ibm-dx-tenant-base-url": "url-1",
                    "x-ibm-dx-request-id": "test-request-id-suffix",
                    "x-ibm-dx-foo": "foo",
                    "x-ibm-dx-bar": 1,
                    "publish-now": true
                };

                // Call the method being tested.
                let error;
                restApi.getUpdateRequestOptions(context, opts)
                    .then(function (requestOptions) {
                        // Verify that the options contain the expected values.
                        expect(requestOptions.uri).to.contain("url-1");
                        expect(requestOptions.headers["x-ibm-dx-tenant-base-url"]).to.be.undefined;
                        expect(requestOptions.headers["x-ibm-dx-request-id"]).to.contain("test-request-id-suffix");
                        expect(requestOptions.headers["x-ibm-dx-foo"]).to.equal("foo");
                        expect(requestOptions.headers["x-ibm-dx-bar"]).to.be.undefined;
                        expect(requestOptions.headers["User-Agent"]).to.not.be.undefined;
                        expect(requestOptions.headers["x-ibm-dx-publish-priority"]).to.exist;
                        expect(requestOptions.maxAttempts).to.not.be.undefined;
                        expect(requestOptions.retryStrategy).to.not.be.undefined;
                        expect(requestOptions.delayStrategy).to.not.be.undefined;
                        expect(requestOptions.instanceId).to.not.be.undefined;
                    })
                    .catch (function (err) {
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

module.exports = ContentsRestUnitTest;
