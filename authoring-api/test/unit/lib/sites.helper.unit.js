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
 * Unit tests for the SitesHelper object.
 */
"use strict";

// Require the super classes for this class.
const UnitTest = require("./base.unit.js");
const SitesUnitTest = require("./sites.unit.js");
const BaseHelperUnitTest = require("./base.helper.unit.js");

// Require the node modules used in this test file.
const diff = require("diff");
const sinon = require("sinon");

// The default API context used for unit tests.
const context = UnitTest.DEFAULT_API_CONTEXT;

// Require the local module being tested.
const restApi = require(UnitTest.API_PATH + "lib/sitesREST.js").instance;
const fsApi = require(UnitTest.API_PATH + "lib/sitesFS.js").instance;
const helper = require(UnitTest.API_PATH + "sitesHelper.js").instance;
const path1 = SitesUnitTest.VALID_SITES_DIRECTORY + SitesUnitTest.VALID_SITE_1;
const path2 = SitesUnitTest.VALID_SITES_DIRECTORY + SitesUnitTest.VALID_SITE_2;
const badPath = SitesUnitTest.INVALID_SITES_DIRECTORY + SitesUnitTest.INVALID_SITE_BAD_NAME;

class SitesHelperUnitTest extends BaseHelperUnitTest {
    constructor() {
        super();
    }

    run () {
        super.run(restApi, fsApi, helper, path1, path2, badPath);
    }

    testDeleteRemoteReadyDraftItems (restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata) {
        // Pages handle ready and draft filtering differently than other artifact types.
    }

    runAdditionalTests (restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata) {
        const self = this;
        describe("_pushNameList", function () {
            it("should sort the local items, ready items followed by draft items.", function (done) {
                const metadataDraft1 = {id: "site1:draft", name: "draft1", status: "draft", contextRoot: "foo"};
                const nameDraft1 = "foo_wchdraft";
                const metadataDraft2 = {id: "site2:draft", name: "draft2", status: "draft", contextRoot: "bar"};
                const nameDraft2 = "bar_wchdraft";
                const metadataDraft3 = {id: "site3:draft", name: "draft3", status: "draft", contextRoot: "draft3"};
                const nameDraft3 = "draft3_wchdraft";
                const metadataDraft4 = {id: "site4:draft", name: "draft4", status: "draft"};
                const nameDraft4 = "site4_sep_draft_wchdraft";
                const metadataReady1 = {id: "site1", name: "ready1", status: "ready", contextRoot: "foo"};
                const nameReady1 = "foo";
                const metadataReady2 = {id: "site2", name: "ready2", status: "ready", contextRoot: "bar"};
                const nameReady2 = "bar";
                const metadataReady3 = {id: "site3", name: "ready3", status: "ready", contextRoot: "ready3"};
                const nameReady3 = "ready3";
                const metadataReady4 = {id: "site4", name: "ready4", status: "ready"};
                const nameReady4 = "site4";
                const names = [nameDraft4, nameReady4, nameDraft3, nameReady3, nameDraft2, nameDraft1, nameReady2, nameReady1];

                // Create a helper.listNames stub that returns a list of items.
                const stubGet = sinon.stub(helper, "getLocalItem");
                stubGet.withArgs(sinon.match.any, nameDraft1).resolves(metadataDraft1);
                stubGet.withArgs(sinon.match.any, nameDraft2).resolves(metadataDraft2);
                stubGet.withArgs(sinon.match.any, nameDraft3).resolves(metadataDraft3);
                stubGet.withArgs(sinon.match.any, nameDraft4).resolves(metadataDraft4);
                stubGet.withArgs(sinon.match.any, nameReady1).resolves(metadataReady1);
                stubGet.withArgs(sinon.match.any, nameReady2).resolves(metadataReady2);
                stubGet.withArgs(sinon.match.any, nameReady3).resolves(metadataReady3);
                stubGet.withArgs(sinon.match.any, nameReady4).resolves(metadataReady4);

                // Create a helper.pushItem stub that return an item.
                const stubPush = sinon.stub(helper, "pushItem");
                stubPush.withArgs(sinon.match.any, nameDraft1).resolves(metadataDraft1);
                stubPush.withArgs(sinon.match.any, nameDraft2).resolves(metadataDraft2);
                stubPush.withArgs(sinon.match.any, nameDraft3).resolves(metadataDraft3);
                stubPush.withArgs(sinon.match.any, nameDraft4).resolves(metadataDraft4);
                stubPush.withArgs(sinon.match.any, nameReady1).resolves(metadataReady1);
                stubPush.withArgs(sinon.match.any, nameReady2).resolves(metadataReady2);
                stubPush.withArgs(sinon.match.any, nameReady3).resolves(metadataReady3);
                stubPush.withArgs(sinon.match.any, nameReady4).resolves(metadataReady4);

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubPush);

                // Call the method being tested.
                let error;
                helper._pushNameList(context, names, UnitTest.DUMMY_OPTIONS)
                    .then(function (items) {
                        // Verify that the stubs were called the expected number of times.
                        expect(stubGet).to.have.callCount(8);
                        expect(stubPush).to.have.callCount(8);

                        // Verify that pushItem method was called with items in the expected order.
                        expect(stubPush.args[0][1]).to.equal(nameReady1);
                        expect(stubPush.args[1][1]).to.equal(nameReady2);
                        expect(stubPush.args[2][1]).to.equal(nameReady3);
                        expect(stubPush.args[3][1]).to.equal(nameReady4);
                        expect(stubPush.args[4][1]).to.equal(nameDraft1);
                        expect(stubPush.args[5][1]).to.equal(nameDraft2);
                        expect(stubPush.args[6][1]).to.equal(nameDraft3);
                        expect(stubPush.args[7][1]).to.equal(nameDraft4);

                        // Verify that the expected values were returned.
                        expect(items).to.have.lengthOf(8);
                        expect(diff.diffJson(items[0], metadataReady1)).to.have.lengthOf(1);
                        expect(diff.diffJson(items[1], metadataReady2)).to.have.lengthOf(1);
                        expect(diff.diffJson(items[2], metadataReady3)).to.have.lengthOf(1);
                        expect(diff.diffJson(items[3], metadataReady4)).to.have.lengthOf(1);
                        expect(diff.diffJson(items[4], metadataDraft1)).to.have.lengthOf(1);
                        expect(diff.diffJson(items[5], metadataDraft2)).to.have.lengthOf(1);
                        expect(diff.diffJson(items[6], metadataDraft3)).to.have.lengthOf(1);
                        expect(diff.diffJson(items[7], metadataDraft4)).to.have.lengthOf(1);
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

        describe("_pushNameList", function () {
            it("should sort the local items, ready items followed by draft items.", function (done) {
                const metadataDraft1 = {id: "site1:draft", name: "draft1", status: "draft", contextRoot: "foo"};
                const nameDraft1 = "foo_wchdraft";
                const metadataDraft2 = {id: "site2:draft", name: "draft2", status: "draft", contextRoot: "bar"};
                const nameDraft2 = "bar_wchdraft";
                const metadataDraft3 = {id: "site3:draft", name: "draft3", status: "draft", contextRoot: "draft3"};
                const nameDraft3 = "draft3_wchdraft";
                const metadataDraft4 = {id: "site4:draft", name: "draft4", status: "draft"};
                const nameDraft4 = "site4_sep_draft_wchdraft";
                const metadataReady1 = {id: "site1", name: "ready1", status: "ready", contextRoot: "foo"};
                const nameReady1 = "foo";
                const metadataReady2 = {id: "site2", name: "ready2", status: "ready", contextRoot: "bar"};
                const nameReady2 = "bar";
                const metadataReady3 = {id: "site3", name: "ready3", status: "ready", contextRoot: "ready3"};
                const nameReady3 = "ready3";
                const metadataReady4 = {id: "site4", name: "ready4", status: "ready"};
                const nameReady4 = "site4";
                const names = [nameDraft4, nameReady4, nameDraft3, nameReady3, nameDraft2, nameDraft1, nameReady2, nameReady1];

                // Create a helper.listNames stub that returns a list of items.
                const stubGet = sinon.stub(helper, "getLocalItem");
                stubGet.withArgs(sinon.match.any, nameDraft1).resolves(metadataDraft1);
                stubGet.withArgs(sinon.match.any, nameDraft2).resolves(metadataDraft2);
                stubGet.withArgs(sinon.match.any, nameDraft3).resolves(metadataDraft3);
                stubGet.withArgs(sinon.match.any, nameDraft4).resolves(metadataDraft4);
                stubGet.withArgs(sinon.match.any, nameReady1).resolves(metadataReady1);
                stubGet.withArgs(sinon.match.any, nameReady2).resolves(metadataReady2);
                stubGet.withArgs(sinon.match.any, nameReady3).resolves(metadataReady3);
                stubGet.withArgs(sinon.match.any, nameReady4).resolves(metadataReady4);

                // Create a helper.pushItem stub that return an item.
                const stubPush = sinon.stub(helper, "pushItem");
                stubPush.withArgs(sinon.match.any, nameDraft1).resolves(metadataDraft1);
                stubPush.withArgs(sinon.match.any, nameDraft2).resolves(metadataDraft2);
                stubPush.withArgs(sinon.match.any, nameDraft3).resolves(metadataDraft3);
                stubPush.withArgs(sinon.match.any, nameDraft4).resolves(metadataDraft4);
                stubPush.withArgs(sinon.match.any, nameReady1).resolves(metadataReady1);
                stubPush.withArgs(sinon.match.any, nameReady2).resolves(metadataReady2);
                stubPush.withArgs(sinon.match.any, nameReady3).resolves(metadataReady3);
                stubPush.withArgs(sinon.match.any, nameReady4).resolves(metadataReady4);

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubPush);

                // Call the method being tested.
                let error;
                helper._pushNameList(context, names, UnitTest.DUMMY_OPTIONS)
                    .then(function (items) {
                        // Verify that the stubs were called the expected number of times.
                        expect(stubGet).to.have.callCount(8);
                        expect(stubPush).to.have.callCount(8);

                        // Verify that pushItem method was called with items in the expected order.
                        expect(stubPush.args[0][1]).to.equal(nameReady1);
                        expect(stubPush.args[1][1]).to.equal(nameReady2);
                        expect(stubPush.args[2][1]).to.equal(nameReady3);
                        expect(stubPush.args[3][1]).to.equal(nameReady4);
                        expect(stubPush.args[4][1]).to.equal(nameDraft1);
                        expect(stubPush.args[5][1]).to.equal(nameDraft2);
                        expect(stubPush.args[6][1]).to.equal(nameDraft3);
                        expect(stubPush.args[7][1]).to.equal(nameDraft4);

                        // Verify that the expected values were returned.
                        expect(items).to.have.lengthOf(8);
                        expect(diff.diffJson(items[0], metadataReady1)).to.have.lengthOf(1);
                        expect(diff.diffJson(items[1], metadataReady2)).to.have.lengthOf(1);
                        expect(diff.diffJson(items[2], metadataReady3)).to.have.lengthOf(1);
                        expect(diff.diffJson(items[3], metadataReady4)).to.have.lengthOf(1);
                        expect(diff.diffJson(items[4], metadataDraft1)).to.have.lengthOf(1);
                        expect(diff.diffJson(items[5], metadataDraft2)).to.have.lengthOf(1);
                        expect(diff.diffJson(items[6], metadataDraft3)).to.have.lengthOf(1);
                        expect(diff.diffJson(items[7], metadataDraft4)).to.have.lengthOf(1);
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

module.exports = SitesHelperUnitTest;
