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
 * Unit tests for the SitesFS object.
 */
"use strict";

// Require the super classes for this class.
const UnitTest = require("./base.unit.js");
const SitesUnitTest = require("./sites.unit.js");
const BaseFsUnit = require("./base.fs.unit.js");
const JSONItemFS = require(UnitTest.API_PATH + "lib/JSONItemFS.js");

// Require the node modules used in this test file.
const fs = require("fs");
const sinon = require("sinon");

// Require the local module being tested.
const fsApi = require(UnitTest.API_PATH + "lib/sitesFS.js").instance;

// The default API context used for unit tests.
const context = UnitTest.DEFAULT_API_CONTEXT;

class SitesFsUnitTest extends BaseFsUnit {
    constructor () {
        super();
    }

    run () {
        super.run(fsApi, SitesUnitTest.VALID_SITE_1, SitesUnitTest.VALID_SITE_2);
    }

    testGetItemPath(fsApi, itemName1, itemName2) {
        describe("getItemPath", function () {
            it("should succeed with various inputs", function (done) {
                // Should return undefined for an undefined input item.
                expect(fsApi.getItemPath(context, undefined)).to.not.exist;

                // Should return undefined for an empty input item.
                expect(fsApi.getItemPath(context, {})).to.not.exist;

                // Verify the expected path for the default site.
                const extension = fsApi.getExtension();
                let itemPath = fsApi.getItemPath(context, {"id": "default", "name": "foo", "status": "ready"});
                expect(itemPath.endsWith("default" + extension)).to.equal(true);

                // Verify the expected path for the default draft site.
                itemPath = fsApi.getItemPath(context, {"id": "default:draft", "name": "foo", "status": "draft"});
                expect(itemPath.endsWith("default_wchdraft" + extension)).to.equal(true);

                // Verify the expected path for a non-default ready site.
                itemPath = fsApi.getItemPath(context, {
                    "id": "foo",
                    "name": "bar",
                    "contextRoot": "some-other-value",
                    "status": "ready"
                });
                expect(itemPath.endsWith("some-other-value" + extension)).to.equal(true);

                // Verify the expected path for a non-default draft site.
                itemPath = fsApi.getItemPath(context, {
                    "id": "foo",
                    "name": "bar",
                    "contextRoot": "some-other-value",
                    "status": "draft"
                });
                expect(itemPath.endsWith("some-other-value_wchdraft" + extension)).to.equal(true);

                // Verify the expected path for a non-default draft site in a project.
                itemPath = fsApi.getItemPath(context, {
                    "id": "foo",
                    "name": "bar",
                    "contextRoot": "some-other-value",
                    "status": "draft",
                    "projectId": "project-id"
                });
                expect(itemPath.endsWith("some-other-value_wchdraft_project-id" + extension)).to.equal(true);

                done();
            });
        });
    }

    // Override the base FS test to cover the renaming logic for sites.
    listNamesSuccess(fsApi, itemName1, itemName2, done) {
        // Create a stub for super.listNames to resolve with known values.
        const stubSuper = sinon.stub(JSONItemFS.prototype, "listNames");
        stubSuper.resolves([{id: "default", path: "default", status: "ready"},
            {id: "foo:draft", path: "foo_wchdraft", contextRoot: "foo", status: "draft"},
            {id: "bar:draft", path: "bar", contextRoot: "bar", status: "draft"},
            {id: "ack", path: "ack_wchdraft", contextRoot: "ack", status: "ready"}]);

        // Create a spy for fsApi.getFileName to verify it is called the expected number of times.
        const spyFileName = sinon.spy(fsApi, "getFileName");

        // Create a spy for fsApi.getPath to verify it is called the expected number of times.
        const spyPath = sinon.spy(fsApi, "getPath");

        // Create a stub for fs.existsSync that will return false the first two times and true the next two times.
        const stubExists = sinon.stub(fs, "existsSync");
        stubExists.onCall(0).returns(false);
        stubExists.onCall(1).returns(false);
        stubExists.onCall(2).returns(true);
        stubExists.onCall(3).returns(true);

        // Create a stub for fs.renameSync to keep it from being called.
        const stubRename = sinon.stub(fs, "renameSync");

        this.addTestDouble(stubSuper);
        this.addTestDouble(spyFileName);
        this.addTestDouble(spyPath);
        this.addTestDouble(stubExists);
        this.addTestDouble(stubRename);

        // Call the method being tested.
        let error;

        // Set the current working directory to the "valid resources" directory.
        fsApi.listNames(context, {"workingDir": UnitTest.API_PATH + UnitTest.VALID_RESOURCES_DIRECTORY})
            .then(function (items) {
                // Verify that the filename spy was called three times (not for the first item).
                expect(spyFileName).to.have.been.calledThrice;

                // Verify that the path spy was called twice (for the third and fourth items).
                expect(spyPath).to.have.been.calledTwice;

                // Verify that the rename stub was called twice (for the fourth item).
                expect(stubRename).to.have.been.calledTwice;

                // Verify that the expected values are returned.
                expect(items).to.have.lengthOf(4);
                expect(items[0].id).to.equal("default");
                expect(items[1].id).to.equal("foo:draft");
                expect(items[2].id).to.equal("bar:draft");
                expect(items[3].id).to.equal("ack");
            })
            .catch(function (err) {
                // NOTE: A failed expectation from above will be handled here.
                // Pass the error to the "done" function to indicate a failed test.
                error = err;
            })
            .finally(function () {
                // noinspection JSUnresolvedFunction
                // Restore the default options.
                UnitTest.restoreOptions(context);

                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
    }
}

module.exports = SitesFsUnitTest;
