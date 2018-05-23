/*
Copyright 2018 IBM Corporation

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
"use strict";

const expect = require("chai").expect;
const sinon = require("sinon");
const fs = require('fs');
const mkdirp = require("mkdirp");
const options = require("../../lib/utils/options.js");
const manifests = require("../../lib/utils/manifests.js");
const BaseUnit = require("./lib/base.unit.js");
const assetsREST = require(BaseUnit.API_PATH + "lib/assetsREST.js").instance;

const TEST_MANIFEST_CONTENTS = '{"artifactType":{"an-id": {"id": "an-id", "name": "a-name", "path": "a-path"}}}';
const ASSETS_MANIFEST_CONTENTS = '{"assets":{"asset-path": {"id": "asset-id", "name": "asset-name", "path": "asset-path"}}}';
const SITES_MANIFEST_CONTENTS = '{"sites":{"default": {"id": "default", "name": "default"}}}';
const PAGES_MANIFEST_CONTENTS = '{"sites":{"default": {"id": "default", "name": "default", "pages": {"id1": {"id": "id1", "name": "name1", "path": "path1"}, "id2": {"id": "id2", "name": "name2", "path": "path2"}}}, "non-default": {"id": "non-default", "name": "non-default", "pages": {"id1": {"id": "id1", "name": "name1", "path": "path1"}, "id2": {"id": "id2", "name": "name2", "path": "path2"}}}}}';

describe("manifests", function () {
    const context = BaseUnit.DEFAULT_API_CONTEXT;

    describe("initializeManifests", function () {
        let opts = {};

        afterEach(function (done) {
            // Reset the manifest settings after each test.
            manifests.resetManifests(context);

            // Clear the options after each test.
            opts = {};

            done();
        });

        it("should return true if no manifests are specified", function (done) {
            let error;
            manifests.initializeManifests(context, null, null, null, opts)
                .then(function (result) {
                    expect(result).to.be.true;
                })
                .catch(function (err) {
                    error = err;
                })
                .finally(function () {
                    done(error);
                });
        });

        it("should return true if context already has a read manifest", function (done) {
            // Create an fs.existsSync spy to verify that it's not called.
            const existsSpy = sinon.spy(fs, "existsSync");

            // Set the read manifest to a dummy value.
            context.readManifest = {};

            let error;
            manifests.initializeManifests(context, "foo", null, null, opts)
                .then(function (result) {
                    expect(existsSpy).to.not.have.been.called;
                    expect(result).to.be.true;
                })
                .catch(function (err) {
                    error = err;
                })
                .finally(function () {
                    existsSpy.restore();

                    done(error);
                });
        });

        it("should return true if context already has a write manifest", function (done) {
            // Create an fs.existsSync spy to verify that it's not called.
            const existsSpy = sinon.spy(fs, "existsSync");

            // Set the read manifest to a dummy value.
            context.writeManifest = {};

            let error;
            manifests.initializeManifests(context, null, "foo", null, opts)
                .then(function (result) {
                    expect(existsSpy).to.not.have.been.called;
                    expect(result).to.be.true;
                })
                .catch(function (err) {
                    error = err;
                })
                .finally(function () {
                    existsSpy.restore();

                    done(error);
                });
        });

        it("should return true if context already has a deletions manifest", function (done) {
            // Create an fs.existsSync spy to verify that it's not called.
            const existsSpy = sinon.spy(fs, "existsSync");

            // Set the read manifest to a dummy value.
            context.deletionsManifest = {};

            let error;
            manifests.initializeManifests(context, null, null, "foo", opts)
                .then(function (result) {
                    expect(existsSpy).to.not.have.been.called;
                    expect(result).to.be.true;
                })
                .catch(function (err) {
                    error = err;
                })
                .finally(function () {
                    existsSpy.restore();

                    done(error);
                });
        });

        it("should return false when specified read manifest is missing", function (done) {
            // Create an fs.existsSync stub to return false.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(false);

            // Create a context.logger.error stub to verify the error message.
            const errorStub = sinon.stub(context.logger, "error");

            let error;
            manifests.initializeManifests(context, "foo", null, null, opts)
                .then(function (result) {
                    // This is not expected. Pass the error to the "done" function to indicate a failed test.
                    error = new Error("The promise for initializing the manifest should have been rejected.");
                })
                .catch(function (err) {
                    const filename = options.getRelevantOption(context, opts, "readManifestFile");

                    expect(filename).to.equal("foo");
                    expect(existsStub.args[0][0].endsWith("foo.json")).to.equal(true);
                    expect(errorStub.args[0][0]).to.contain("Manifest file");
                    expect(errorStub.args[0][0]).to.contain("foo");
                    expect(errorStub.args[0][0]).to.contain("does not exist");
                })
                .catch(function (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                })
                .finally(function () {
                    existsStub.restore();
                    errorStub.restore();

                    done(error);
                });
        });

        it("should return true when specified write manifest is missing", function (done) {
            // Create an fs.existsSync stub to return false.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(false);

            let error;
            manifests.initializeManifests(context, null, "foo", null, opts)
                .then(function (result) {
                    const filename = options.getRelevantOption(context, opts, "writeManifestFile");

                    expect(filename).to.equal("foo");
                    expect(existsStub.args[0][0].endsWith("foo.json")).to.equal(true);
                    expect(result).to.be.true;
                })
                .catch(function (err) {
                    error = err;
                })
                .finally(function () {
                    existsStub.restore();

                    done(error);
                });
        });

        it("should return true when specified deletions manifest is missing", function (done) {
            // Create an fs.existsSync stub to return false.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(false);

            let error;
            manifests.initializeManifests(context, null, null, "foo", opts)
                .then(function (result) {
                    const filename = options.getRelevantOption(context, opts, "deletionsManifestFile");

                    expect(filename).to.equal("foo");
                    expect(existsStub.args[0][0].endsWith("foo.json")).to.equal(true);
                    expect(result).to.be.true;
                })
                .catch(function (err) {
                    error = err;
                })
                .finally(function () {
                    existsStub.restore();

                    done(error);
                });
        });

        it("should reject when specified read manifest is invalid", function (done) {
            // Create an fs.existsSync stub to return true.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to throw an error.
            const MANIFEST_ERROR = "Manifest read error, expected by unit test.";
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.throws(MANIFEST_ERROR);

            // Create a context.logger.error stub to verify the error message.
            const errorStub = sinon.stub(context.logger, "error");

            let error;
            manifests.initializeManifests(context, "foo", null, null, opts)
                .then(function (result) {
                    // This is not expected. Pass the error to the "done" function to indicate a failed test.
                    error = new Error("The promise for initializing the manifest should have been rejected.");
                })
                .catch(function (err) {
                    const filename = options.getRelevantOption(context, opts, "readManifestFile");

                    expect(filename).to.equal("foo");
                    expect(existsStub.args[0][0].endsWith("foo.json")).to.equal(true);
                    expect(errorStub.args[0][0]).to.contain("Error reading manifest file");
                    expect(errorStub.args[0][0]).to.contain("foo");
                    expect(errorStub.args[0][0]).to.contain(MANIFEST_ERROR);
                })
                .catch(function (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                })
                .finally(function () {
                    existsStub.restore();
                    readStub.restore();
                    errorStub.restore();

                    done(error);
                });
        });

        it("should return false when specified write manifest is invalid", function (done) {
            // Create an fs.existsSync stub to return true.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to throw an error.
            const MANIFEST_ERROR = "Manifest read error, expected by unit test.";
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.throws(MANIFEST_ERROR);

            // Create a context.logger.error stub to verify the error message.
            const errorStub = sinon.stub(context.logger, "error");

            let error;
            manifests.initializeManifests(context, null, "foo", null, opts)
                .then(function (result) {
                    // This is not expected. Pass the error to the "done" function to indicate a failed test.
                    error = new Error("The promise for initializing the manifest should have been rejected.");
                })
                .catch(function (err) {
                    const filename = options.getRelevantOption(context, opts, "writeManifestFile");

                    expect(filename).to.equal("foo");
                    expect(existsStub.args[0][0].endsWith("foo.json")).to.equal(true);
                    expect(errorStub.args[0][0]).to.contain("Error reading manifest file");
                    expect(errorStub.args[0][0]).to.contain("foo");
                    expect(errorStub.args[0][0]).to.contain(MANIFEST_ERROR);
                })
                .catch(function (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                })
                .finally(function () {
                    existsStub.restore();
                    readStub.restore();
                    errorStub.restore();

                    done(error);
                });
        });

        it("should return false when specified deletions manifest is invalid", function (done) {
            // Create an fs.existsSync stub to return true.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to throw an error.
            const MANIFEST_ERROR = "Manifest read error, expected by unit test.";
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.throws(MANIFEST_ERROR);

            // Create a context.logger.error stub to verify the error message.
            const errorStub = sinon.stub(context.logger, "error");

            let error;
            manifests.initializeManifests(context, null, null, "foo", opts)
                .then(function (result) {
                    // This is not expected. Pass the error to the "done" function to indicate a failed test.
                    error = new Error("The promise for initializing the manifest should have been rejected.");
                })
                .catch(function (err) {
                    const filename = options.getRelevantOption(context, opts, "deletionsManifestFile");

                    expect(filename).to.equal("foo");
                    expect(existsStub.args[0][0].endsWith("foo.json")).to.equal(true);
                    expect(errorStub.args[0][0]).to.contain("Error reading manifest file");
                    expect(errorStub.args[0][0]).to.contain("foo");
                    expect(errorStub.args[0][0]).to.contain(MANIFEST_ERROR);
                })
                .catch(function (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                })
                .finally(function () {
                    existsStub.restore();
                    readStub.restore();
                    errorStub.restore();

                    done(error);
                });
        });

        it("should return true when valid read manifest is specified", function (done) {
            // Create an fs.existsSync stub to return true.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to return the manifest contents.
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.returns(TEST_MANIFEST_CONTENTS);

            let error;
            manifests.initializeManifests(context, "foo.json", null, null, opts)
                .then(function (result) {
                    const filename = options.getRelevantOption(context, opts, "readManifestFile");
                    const manifest = options.getRelevantOption(context, opts, "readManifest");

                    expect(filename).to.equal("foo.json");
                    expect(existsStub.args[0][0].endsWith("foo.json")).to.equal(true);
                    expect(manifest["artifactType"]["an-id"].id).to.equal("an-id");
                    expect(result).to.be.true;
                })
                .catch(function (err) {
                    error = err;
                })
                .finally(function () {
                    existsStub.restore();
                    readStub.restore();

                    done(error);
                });
        });

        it("should return true when valid write manifest is specified", function (done) {
            // Create an fs.existsSync stub to return true.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to return the manifest contents.
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.returns(TEST_MANIFEST_CONTENTS);

            let error;
            manifests.initializeManifests(context, null, "/foo.json", null, opts)
                .then(function (result) {
                    const filename = options.getRelevantOption(context, opts, "writeManifestFile");
                    const manifest = options.getRelevantOption(context, opts, "writeManifest");

                    expect(filename).to.equal("/foo.json");
                    expect(existsStub.args[0][0].endsWith("foo.json")).to.equal(true);
                    expect(manifest["artifactType"]["an-id"].path).to.equal("a-path");
                })
                .catch(function (err) {
                    error = err;
                })
                .finally(function () {
                    existsStub.restore();
                    readStub.restore();

                    done(error);
                });
        });

        it("should return true when valid deletions manifest is specified", function (done) {
            // Create an fs.existsSync stub to return true.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to return the manifest contents.
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.returns(TEST_MANIFEST_CONTENTS);

            let error;
            manifests.initializeManifests(context, null, null, "/foo.json", opts)
                .then(function (result) {
                    const filename = options.getRelevantOption(context, opts, "deletionsManifestFile");
                    const manifest = options.getRelevantOption(context, opts, "deletionsManifest");

                    expect(filename).to.equal("/foo.json");
                    expect(existsStub.args[0][0].endsWith("foo.json")).to.equal(true);
                    expect(manifest["artifactType"]["an-id"].path).to.equal("a-path");
                })
                .catch(function (err) {
                    error = err;
                })
                .finally(function () {
                    existsStub.restore();
                    readStub.restore();

                    done(error);
                });
        });
    });

    describe("getManifestSection", function () {
        let opts = {};

        afterEach(function (done) {
            // Reset the manifest settings after each test.
            manifests.resetManifests(context);

            // Clear the options after each test.
            opts = {};

            done();
        });

        it("should return undefined if manifests not initialized", function (done) {
            let error;
            try {
                const section = manifests.getManifestSection(context, "artifactType", opts);

                expect(section).to.not.exist;
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });

        it("should return undefined if section doesn't exist", function (done) {
            // Create an fs.existsSync stub to return true.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to return the manifest contents.
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.returns(TEST_MANIFEST_CONTENTS);

            let error;
            manifests.initializeManifests(context, "foo", null, null, opts)
                .then(function (result) {
                    const section = manifests.getManifestSection(context, "ack", opts);

                    expect(section).to.not.exist;
                })
                .catch(function (err) {
                    error = err;
                })
                .finally(function () {
                    existsStub.restore();
                    readStub.restore();

                    done(error);
                });
        });

        it("should return an existing section", function (done) {
            // Create an fs.existsSync stub to return true.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to return the manifest contents.
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.returns(TEST_MANIFEST_CONTENTS);

            let error;
            manifests.initializeManifests(context, "foo", null, null, opts)
                .then(function (result) {
                    const section = manifests.getManifestSection(context, "artifactType", opts);

                    expect(section["an-id"].path).to.equal("a-path");
                })
                .catch(function (err) {
                    error = err;
                })
                .finally(function () {
                    existsStub.restore();
                    readStub.restore();

                    done(error);
                });
        });

        it("should return an undefined pages section if no sites section", function (done) {
            // Create an fs.existsSync stub to return true.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to return the manifest contents.
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.returns(TEST_MANIFEST_CONTENTS);

            let error;
            manifests.initializeManifests(context, "foo", null, null, opts)
                .then(function (result) {
                    const section = manifests.getManifestSection(context, "pages", opts);

                    expect(section).to.not.exist;
                })
                .catch(function (err) {
                    error = err;
                })
                .finally(function () {
                    existsStub.restore();
                    readStub.restore();

                    done(error);
                });
        });

        it("should return an undefined pages section if only sites section", function (done) {
            // Create an fs.existsSync stub to return true.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to return the manifest contents.
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.returns(SITES_MANIFEST_CONTENTS);

            let error;
            manifests.initializeManifests(context, "foo", null, null, opts)
                .then(function (result) {
                    const section = manifests.getManifestSection(context, "pages", opts);

                    expect(section).to.not.exist;
                })
                .catch(function (err) {
                    error = err;
                })
                .finally(function () {
                    existsStub.restore();
                    readStub.restore();

                    done(error);
                });
        });

        it("should return an undefined pages section if specified site section doesn't exist", function (done) {
            // Create an fs.existsSync stub to return true.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to return the manifest contents.
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.returns(SITES_MANIFEST_CONTENTS);

            // Specify a non-default site id.
            opts.siteId = "non-default";

            let error;
            manifests.initializeManifests(context, "foo", null, null, opts)
                .then(function (result) {
                    const section = manifests.getManifestSection(context, "pages", opts);

                    expect(section).to.not.exist;
                })
                .catch (function (err) {
                    error = err;
                })
                .finally(function () {
                    existsStub.restore();
                    readStub.restore();

                    done(error);
                });
        });

        it("should return the pages section from the default site section", function (done) {
            // Create an fs.existsSync stub to return true.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to return the manifest contents.
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.returns(PAGES_MANIFEST_CONTENTS);

            let error;
            manifests.initializeManifests(context, "foo", null, null, opts)
                .then(function (result) {
                    const section = manifests.getManifestSection(context, "pages", opts);

                    expect(section["id1"].id).to.equal("id1");
                    expect(section["id2"].id).to.equal("id2");
                })
                .catch(function (err) {
                    error = err;
                })
                .finally(function () {
                    existsStub.restore();
                    readStub.restore();

                    done(error);
                });
        });

        it("should return the pages section from a non-default site section", function (done) {
            // Create an fs.existsSync stub to return true.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to return the manifest contents.
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.returns(PAGES_MANIFEST_CONTENTS);

            // Specify a non-default site id.
            opts.siteId = "non-default";

            let error;
            manifests.initializeManifests(context, "foo", null, null, opts)
                .then(function (result) {
                    const section = manifests.getManifestSection(context, "pages", opts);

                    expect(section["id1"].id).to.equal("id1");
                    expect(section["id2"].id).to.equal("id2");
                })
                .catch(function (err) {
                    error = err;
                })
                .finally(function () {
                    existsStub.restore();
                    readStub.restore();

                    done(error);
                });
        });
    });

    describe("updateManifestSection", function () {
        let opts = {};

        afterEach(function (done) {
            // Reset the manifest settings after each test.
            manifests.resetManifests(context);

            // Clear the options after each test.
            opts = {};

            done();
        });

        it("should not append or replace if manifests not initialized", function (done) {
            let error;
            try {
                manifests.updateManifestSection(context, "foo", [], opts);

                expect(context.writeManifest).to.not.exist;
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });

        it("should append if manifest write mode is append", function (done) {
            // Create an fs.existsSync stub to return true.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to return the manifest contents.
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.returns(TEST_MANIFEST_CONTENTS);

            let error;
            manifests.initializeManifests(context, null, "foo", null, opts)
                .then(function (result) {

                    // Force the manifests to use append mode.
                    context.writeManifestMode = "append";
                    manifests.updateManifestSection(context, "artifactType", [{id: "xxx", name: "yyy", path: "zzz"}], opts);

                    expect(context.writeManifest).to.exist;
                    expect(context.writeManifest["artifactType"]).to.exist;
                    expect(context.writeManifest["artifactType"]["an-id"]).to.exist;
                    expect(context.writeManifest["artifactType"]["xxx"]).to.exist;
                })
                .catch(function (err) {
                    error = err;
                })
                .finally(function () {
                    existsStub.restore();
                    readStub.restore();

                    done(error);
                });
        });

        it("should replace if manifest write mode is replace", function (done) {
            // Create an fs.existsSync stub to return true.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to return the manifest contents.
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.returns(TEST_MANIFEST_CONTENTS);

            let error;
            manifests.initializeManifests(context, null, "foo", null, opts)
                .then(function (result) {
                    // Force the manifests to use append mode.
                    context.writeManifestMode = "replace";
                    manifests.updateManifestSection(context, "artifactType", [{id: "xxx", name: "yyy", path: "zzz"}], opts);

                    expect(context.writeManifest).to.exist;
                    expect(context.writeManifest["artifactType"]).to.exist;
                    expect(context.writeManifest["artifactType"]["an-id"]).to.not.exist;
                    expect(context.writeManifest["artifactType"]["xxx"]).to.exist;
                })
                .catch(function (err) {
                    error = err;
                })
                .finally(function () {
                    existsStub.restore();
                    readStub.restore();

                    done(error);
                });
        });

        it("default behavior should append the specified item to an existing section", function (done) {
            // Create an fs.existsSync stub to return true.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to return the manifest contents.
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.returns(TEST_MANIFEST_CONTENTS);

            let error;
            manifests.initializeManifests(context, null, "foo", null, opts)
                .then(function (result) {
                    let manifest = options.getRelevantOption(context, opts, "writeManifest");

                    expect(manifest["artifactType"]["an-id"].path).to.equal("a-path");
                    expect(manifest["artifactType"]["id1"]).to.not.exist;

                    manifests.updateManifestSection(context, "artifactType", [{"id": "id1", "name": "name1", "path": "path1"}], opts);

                    manifest = options.getRelevantOption(context, opts, "writeManifest");
                    expect(manifest["artifactType"]["an-id"].path).to.equal("a-path");
                    expect(manifest["artifactType"]["id1"].path).to.equal("path1");
                })
                .catch(function (err) {
                    error = err;
                })
                .finally(function () {
                    existsStub.restore();
                    readStub.restore();

                    done(error);
                });
        });

        it("should add section with the specified item if section did not already exist", function (done) {
            // Create an fs.existsSync stub to return true.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to return the manifest contents.
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.returns(TEST_MANIFEST_CONTENTS);

            let error;
            manifests.initializeManifests(context, null, "foo", null, opts)
                .then(function (result) {
                    let manifest = options.getRelevantOption(context, opts, "writeManifest");

                    expect(manifest["artifactType"]["an-id"].path).to.equal("a-path");
                    expect(manifest["aDifferentArtifactType"]).to.not.exist;

                    manifests.updateManifestSection(context, "aDifferentArtifactType", [{"id": "id1", "name": "name1", "path": "path1"}], opts);

                    manifest = options.getRelevantOption(context, opts, "writeManifest");
                    expect(manifest["artifactType"]["an-id"].path).to.equal("a-path");
                    expect(manifest["aDifferentArtifactType"]["id1"].path).to.equal("path1");
                })
                .catch(function (err) {
                    error = err;
                })
                .finally(function () {
                    existsStub.restore();
                    readStub.restore();

                    done(error);
                });
        });

        it("should add section with the specified item if manifest is empty", function (done) {
            // Create an fs.existsSync stub to return true.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(false);

            let error;
            manifests.initializeManifests(context, null, "foo", null, opts)
                .then(function (result) {
                    let manifest = options.getRelevantOption(context, opts, "writeManifest");

                    expect(manifest).to.not.exist;

                    manifests.updateManifestSection(context, "aDifferentArtifactType", [{"id": "id1", "name": "name1", "path": "path1"}], opts);

                    manifest = options.getRelevantOption(context, opts, "writeManifest");
                    expect(manifest["artifactType"]).to.not.exist;
                    expect(manifest["aDifferentArtifactType"]["id1"].path).to.equal("path1");
                })
                .catch(function (err) {
                    error = err;
                })
                .finally(function () {
                    existsStub.restore();

                    done(error);
                });
        });

        it("should append the specified asset item to an existing assets section", function (done) {
            // Create an fs.existsSync stub to return true.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to return the manifest contents.
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.returns(ASSETS_MANIFEST_CONTENTS);

            let error;
            manifests.initializeManifests(context, null, "foo", null, opts)
                .then(function (result) {
                    let manifest = options.getRelevantOption(context, opts, "writeManifest");

                    expect(manifest["assets"]["asset-path"].name).to.equal("asset-name");
                    expect(manifest["assets"]["asset-path-2"]).to.not.exist;

                    manifests.updateManifestSection(context, "assets", [{"id": "asset-id-2", "name": "asset-name-2", "path": "asset-path-2"}], opts);

                    manifest = options.getRelevantOption(context, opts, "writeManifest");
                    expect(manifest["assets"]["asset-path"].name).to.equal("asset-name");
                    expect(manifest["assets"]["asset-path-2"].name).to.equal("asset-name-2");
                })
                .catch(function (err) {
                    error = err;
                })
                .finally(function () {
                    existsStub.restore();
                    readStub.restore();

                    done(error);
                });
        });

        it("should append the specified page item to an existing pages section", function (done) {
            // Create an fs.existsSync stub to return true.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to return the manifest contents.
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.returns(PAGES_MANIFEST_CONTENTS);

            let error;
            manifests.initializeManifests(context, null, "foo", null, opts)
                .then(function (result) {
                    let manifest = options.getRelevantOption(context, opts, "writeManifest");

                    expect(manifest["sites"]["default"]["pages"]["id1"].path).to.equal("path1");
                    expect(manifest["sites"]["default"]["pages"]["id3"]).to.not.exist;

                    manifests.updateManifestSection(context, "pages", [{"id": "id3", "name": "name3", "hierarchicalPath": "path3"}], opts);

                    manifest = options.getRelevantOption(context, opts, "writeManifest");
                    expect(manifest["sites"]["default"]["pages"]["id1"].path).to.equal("path1");
                    expect(manifest["sites"]["default"]["pages"]["id3"].path).to.equal("path3");
                })
                .catch(function (err) {
                    error = err;
                })
                .finally(function () {
                    existsStub.restore();
                    readStub.restore();

                    done(error);
                });
        });

        it("should not append the specified item if the key field is not specified", function (done) {
            // Create an fs.existsSync stub to return true.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to return the manifest contents.
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.returns(TEST_MANIFEST_CONTENTS);

            let error;
            manifests.initializeManifests(context, null, "foo", null, opts)
                .then(function (result) {
                    let manifest = options.getRelevantOption(context, opts, "writeManifest");

                    expect(manifest["artifactType"]["an-id"].path).to.equal("a-path");
                    expect(manifest["artifactType"]["id1"]).to.not.exist;

                    manifests.updateManifestSection(context, "artifactType", [{"foo": "id1", "name": "name1", "path": "path1"}], opts);

                    manifest = options.getRelevantOption(context, opts, "writeManifest");
                    expect(manifest["artifactType"]["an-id"].path).to.equal("a-path");
                    expect(manifest["artifactType"]["id1"]).to.not.exist;
                })
                .catch(function (err) {
                    error = err;
                })
                .finally(function () {
                    existsStub.restore();
                    readStub.restore();

                    done(error);
                });
        });
    });

    describe("updateDeletionsManifestSection", function () {
        let opts = {};

        afterEach(function (done) {
            // Reset the manifest settings after each test.
            manifests.resetManifests(context);

            // Clear the options after each test.
            opts = {};

            done();
        });

        it("should not append or replace if manifests not initialized", function (done) {
            let error;
            try {
                manifests.updateDeletionsManifestSection(context, "foo", [], opts);

                expect(context.deletionsManifest).to.not.exist;
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });

        it("should append if deletions manifest write mode is append", function (done) {
            // Create an fs.existsSync stub to return true.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to return the manifest contents.
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.returns(TEST_MANIFEST_CONTENTS);

            let error;
            manifests.initializeManifests(context, null, null, "foo", opts)
                .then(function (result) {
                    // Force the manifests to use append mode.
                    context.deletionsManifestMode = "append";
                    manifests.updateDeletionsManifestSection(context, "artifactType", [{id: "xxx", name: "yyy", path: "zzz"}], opts);

                    expect(context.deletionsManifest).to.exist;
                    expect(context.deletionsManifest["artifactType"]).to.exist;
                    expect(context.deletionsManifest["artifactType"]["an-id"]).to.exist;
                    expect(context.deletionsManifest["artifactType"]["xxx"]).to.exist;
                })
                .catch(function (err) {
                    error = err;
                })
                .finally(function () {
                    existsStub.restore();
                    readStub.restore();

                    done(error);
                });
        });

        it("should replace if deletions manifest write mode is replace", function (done) {
            // Create an fs.existsSync stub to return true.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to return the manifest contents.
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.returns(TEST_MANIFEST_CONTENTS);

            let error;
            manifests.initializeManifests(context, null, null, "foo", opts)
                .then(function (result) {
                    // Force the manifests to use append mode.
                    context.deletionsManifestMode = "replace";
                    manifests.updateDeletionsManifestSection(context, "artifactType", [{id: "xxx", name: "yyy", path: "zzz"}], opts);

                    expect(context.deletionsManifest).to.exist;
                    expect(context.deletionsManifest["artifactType"]).to.exist;
                    expect(context.deletionsManifest["artifactType"]["an-id"]).to.not.exist;
                    expect(context.deletionsManifest["artifactType"]["xxx"]).to.exist;
                })
                .catch(function (err) {
                    error = err;
                })
                .finally(function () {
                    existsStub.restore();
                    readStub.restore();

                    done(error);
                });
        });

        it("default behavior should append the specified item to an existing section", function (done) {
            // Create an fs.existsSync stub to return true.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to return the manifest contents.
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.returns(TEST_MANIFEST_CONTENTS);

            let error;
            manifests.initializeManifests(context, null, null, "foo", opts)
                .then(function (result) {
                    let manifest = options.getRelevantOption(context, opts, "deletionsManifest");

                    expect(manifest["artifactType"]["an-id"].path).to.equal("a-path");
                    expect(manifest["artifactType"]["id1"]).to.not.exist;

                    manifests.updateDeletionsManifestSection(context, "artifactType", [{"id": "id1", "name": "name1", "path": "path1"}], opts);

                    manifest = options.getRelevantOption(context, opts, "deletionsManifest");
                    expect(manifest["artifactType"]["an-id"].path).to.equal("a-path");
                    expect(manifest["artifactType"]["id1"].path).to.equal("path1");
                })
                .catch(function (err) {
                    error = err;
                })
                .finally(function () {
                    existsStub.restore();
                    readStub.restore();

                    done(error);
                });
        });

        it("should add section with the specified item if section did not already exist", function (done) {
            // Create an fs.existsSync stub to return true.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to return the manifest contents.
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.returns(TEST_MANIFEST_CONTENTS);

            let error;
            manifests.initializeManifests(context, null, null, "foo", opts)
                .then(function (result) {
                    let manifest = options.getRelevantOption(context, opts, "deletionsManifest");

                    expect(manifest["artifactType"]["an-id"].path).to.equal("a-path");
                    expect(manifest["aDifferentArtifactType"]).to.not.exist;

                    manifests.updateDeletionsManifestSection(context, "aDifferentArtifactType", [{"id": "id1", "name": "name1", "path": "path1"}], opts);

                    manifest = options.getRelevantOption(context, opts, "deletionsManifest");
                    expect(manifest["artifactType"]["an-id"].path).to.equal("a-path");
                    expect(manifest["aDifferentArtifactType"]["id1"].path).to.equal("path1");
                })
                .catch(function (err) {
                    error = err;
                })
                .finally(function () {
                    existsStub.restore();
                    readStub.restore();

                    done(error);
                });
        });

        it("should add section with the specified item if deletions manifest is empty", function (done) {
            // Create an fs.existsSync stub to return true.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(false);

            let error;
            manifests.initializeManifests(context, null, null, "foo", opts)
                .then(function (result) {
                    let manifest = options.getRelevantOption(context, opts, "deletionsManifest");

                    expect(manifest).to.not.exist;

                    manifests.updateDeletionsManifestSection(context, "aDifferentArtifactType", [{"id": "id1", "name": "name1", "path": "path1"}], opts);

                    manifest = options.getRelevantOption(context, opts, "deletionsManifest");
                    expect(manifest["artifactType"]).to.not.exist;
                    expect(manifest["aDifferentArtifactType"]["id1"].path).to.equal("path1");
                })
                .catch(function (err) {
                    error = err;
                })
                .finally(function () {
                    existsStub.restore();

                    done(error);
                });
        });

        it("should append the specified asset item to an existing assets section", function (done) {
            // Create an fs.existsSync stub to return true.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to return the manifest contents.
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.returns(ASSETS_MANIFEST_CONTENTS);

            let error;
            manifests.initializeManifests(context, null, null, "foo", opts)
                .then(function (result) {
                    let manifest = options.getRelevantOption(context, opts, "deletionsManifest");

                    expect(manifest["assets"]["asset-path"].name).to.equal("asset-name");
                    expect(manifest["assets"]["asset-path-2"]).to.not.exist;

                    manifests.updateDeletionsManifestSection(context, "assets", [{"id": "asset-id-2", "name": "asset-name-2", "path": "asset-path-2"}], opts);

                    manifest = options.getRelevantOption(context, opts, "deletionsManifest");
                    expect(manifest["assets"]["asset-path"].name).to.equal("asset-name");
                    expect(manifest["assets"]["asset-path-2"].name).to.equal("asset-name-2");
                })
                .catch(function (err) {
                    error = err;
                })
                .finally(function () {
                    existsStub.restore();
                    readStub.restore();

                    done(error);
                });
        });

        it("should append the specified page item to an existing pages section", function (done) {
            // Create an fs.existsSync stub to return true.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to return the manifest contents.
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.returns(PAGES_MANIFEST_CONTENTS);

            let error;
            manifests.initializeManifests(context, null, null, "foo", opts)
                .then(function (result) {
                    let manifest = options.getRelevantOption(context, opts, "deletionsManifest");

                    expect(manifest["sites"]["default"]["pages"]["id1"].path).to.equal("path1");
                    expect(manifest["sites"]["default"]["pages"]["id3"]).to.not.exist;

                    manifests.updateDeletionsManifestSection(context, "pages", [{"id": "id3", "name": "name3", "hierarchicalPath": "path3"}], opts);

                    manifest = options.getRelevantOption(context, opts, "deletionsManifest");
                    expect(manifest["sites"]["default"]["pages"]["id1"].path).to.equal("path1");
                    expect(manifest["sites"]["default"]["pages"]["id3"].path).to.equal("path3");
                })
                .catch(function (err) {
                    error = err;
                })
                .finally(function () {
                    existsStub.restore();
                    readStub.restore();

                    done(error);
                });
        });

        it("should not append the specified item if the key field is not specified", function (done) {
            // Create an fs.existsSync stub to return true.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to return the manifest contents.
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.returns(TEST_MANIFEST_CONTENTS);

            let error;
            manifests.initializeManifests(context, null, null, "foo", opts)
                .then(function (result) {
                    let manifest = options.getRelevantOption(context, opts, "deletionsManifest");

                    expect(manifest["artifactType"]["an-id"].path).to.equal("a-path");
                    expect(manifest["artifactType"]["id1"]).to.not.exist;

                    manifests.updateDeletionsManifestSection(context, "artifactType", [{"foo": "id1", "name": "name1", "path": "path1"}], opts);

                    manifest = options.getRelevantOption(context, opts, "deletionsManifest");
                    expect(manifest["artifactType"]["an-id"].path).to.equal("a-path");
                    expect(manifest["artifactType"]["id1"]).to.not.exist;
                })
                .catch(function (err) {
                    error = err;
                })
                .finally(function () {
                    existsStub.restore();
                    readStub.restore();

                    done(error);
                });
        });
    });

    describe("saveManifest", function () {
        let opts = {};

        afterEach(function (done) {
            // Reset the manifest settings after each test.
            manifests.resetManifests(context);

            // Clear the options after each test.
            opts = {};

            done();
        });

        it("should not save if manifests not initialized", function (done) {
            // Create an fs.existsSync spy to verify it was not called.
            const existsSpy = sinon.spy(fs, "existsSync");

            // Create a mkdirp.sync spy to verify it was not called.
            const mkdirSpy = sinon.spy(mkdirp, "sync");

            // Create an fs.writeFileSync spy to verify it was not called.
            const writeSpy = sinon.spy(fs, "writeFileSync");

            let error;
            try {
                manifests.saveManifest(context, opts);

                expect(existsSpy).to.not.have.been.called;
                expect(mkdirSpy).to.not.have.been.called;
                expect(writeSpy).to.not.have.been.called;
            } catch (err) {
                error = err;
            } finally {
                existsSpy.restore();
                mkdirSpy.restore();
                writeSpy.restore();

                done(error);
            }
        });

        it("should save if manifests initialized, save to new manifest", function (done) {
            // Create an fs.existsSync stub to return false for initialization and for save.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(false);

            // Create an fs.readFileSync spy to verify it was not called.
            const readSpy = sinon.spy(fs, "readFileSync");

            // Create a mkdirp.sync stub.
            const mkdirStub = sinon.stub(mkdirp, "sync");

            // Create an fs.writeFileSync stub.
            const writeStub = sinon.stub(fs, "writeFileSync");

            let error;
            manifests.initializeManifests(context, null, "foo", null, opts)
                .then(function (result) {
                    manifests.saveManifest(context, opts);

                    expect(existsStub).to.have.been.calledTwice;
                    expect(readSpy).to.not.have.been.calledOnce;
                    expect(mkdirStub).to.have.been.calledOnce;
                    expect(writeStub).to.have.been.calledOnce;
                    expect(writeStub.args[0][0].endsWith("foo.json"));
                })
                .catch(function (err) {
                    error = err;
                })
                .finally(function () {
                    existsStub.restore();
                    readSpy.restore();
                    mkdirStub.restore();
                    writeStub.restore();

                    done(error);
                });
        });

        it("should save if manifests initialized, save to existing manifest", function (done) {
            // Create an fs.existsSync stub to return true for initialization and for save.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to return the manifest contents.
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.returns(TEST_MANIFEST_CONTENTS);

            // Create a mkdirp.sync stub.
            const mkdirStub = sinon.stub(mkdirp, "sync");

            // Create an fs.writeFileSync stub.
            const writeStub = sinon.stub(fs, "writeFileSync");

            let error;
            manifests.initializeManifests(context, null, "foo", null, opts)
                .then(function (result) {
                    manifests.saveManifest(context, opts);

                    expect(existsStub).to.have.been.calledTwice;
                    expect(readStub).to.have.been.calledOnce;
                    expect(mkdirStub).to.not.have.been.called;
                    expect(writeStub).to.have.been.calledOnce;
                    expect(writeStub.args[0][0].endsWith("foo.json"));
                })
                .catch(function (err) {
                    error = err;
                })
                .finally(function () {
                    existsStub.restore();
                    readStub.restore();
                    mkdirStub.restore();
                    writeStub.restore();

                    done(error);
                });
        });

        it("should log an error if save fails", function (done) {
            // Create an fs.existsSync stub to return true for initialization and for save.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to return the manifest contents.
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.returns(TEST_MANIFEST_CONTENTS);

            // Create a mkdirp.sync stub.
            const mkdirStub = sinon.stub(mkdirp, "sync");

            // Create an fs.writeFileSync stub.
            const WRITE_ERROR = "Error writing manifest, expected by unit test.";
            const writeStub = sinon.stub(fs, "writeFileSync");
            writeStub.throws(WRITE_ERROR);

            // Create a context.logger.error stub to verify the error message.
            const errorStub = sinon.stub(context.logger, "error");

            let error;
            manifests.initializeManifests(context, null, "foo", null, opts)
                .then(function (result) {
                    manifests.saveManifest(context, opts);

                    expect(existsStub).to.have.been.calledTwice;
                    expect(readStub).to.have.been.calledOnce;
                    expect(mkdirStub).to.not.have.been.called;
                    expect(writeStub).to.have.been.calledOnce;
                    expect(writeStub.args[0][0].endsWith("foo.json"));
                    expect(errorStub).to.have.been.calledOnce;
                    expect(errorStub.args[0][0]).to.contain("Error writing manifest file");
                    expect(errorStub.args[0][0]).to.contain("foo");
                    expect(errorStub.args[0][0]).to.contain(WRITE_ERROR);
                })
                .catch(function (err) {
                    error = err;
                })
                .finally(function () {
                    existsStub.restore();
                    readStub.restore();
                    mkdirStub.restore();
                    writeStub.restore();
                    errorStub.restore();

                    done(error);
                });
        });
    });

    describe("saveDeletionsManifest", function () {
        let opts = {};

        afterEach(function (done) {
            // Reset the manifest settings after each test.
            manifests.resetManifests(context);

            // Clear the options after each test.
            opts = {};

            done();
        });

        it("should not save if manifests not initialized", function (done) {
            // Create an fs.existsSync spy to verify it was not called.
            const existsSpy = sinon.spy(fs, "existsSync");

            // Create a mkdirp.sync spy to verify it was not called.
            const mkdirSpy = sinon.spy(mkdirp, "sync");

            // Create an fs.writeFileSync spy to verify it was not called.
            const writeSpy = sinon.spy(fs, "writeFileSync");

            let error;
            try {
                manifests.saveDeletionsManifest(context, opts);

                expect(existsSpy).to.not.have.been.called;
                expect(mkdirSpy).to.not.have.been.called;
                expect(writeSpy).to.not.have.been.called;
            } catch (err) {
                error = err;
            } finally {
                existsSpy.restore();
                mkdirSpy.restore();
                writeSpy.restore();

                done(error);
            }
        });

        it("should save if manifests initialized, save to new deletions manifest", function (done) {
            // Create an fs.existsSync stub to return false for initialization and for save.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(false);

            // Create an fs.readFileSync spy to verify it was not called.
            const readSpy = sinon.spy(fs, "readFileSync");

            // Create a mkdirp.sync stub.
            const mkdirStub = sinon.stub(mkdirp, "sync");

            // Create an fs.writeFileSync stub.
            const writeStub = sinon.stub(fs, "writeFileSync");

            let error;
            manifests.initializeManifests(context, null, null, "foo", opts)
                .then(function (result) {
                    manifests.saveDeletionsManifest(context, opts);

                    expect(existsStub).to.have.been.calledTwice;
                    expect(readSpy).to.not.have.been.calledOnce;
                    expect(mkdirStub).to.have.been.calledOnce;
                    expect(writeStub).to.have.been.calledOnce;
                    expect(writeStub.args[0][0].endsWith("foo.json"));
                })
                .catch(function (err) {
                    error = err;
                })
                .finally(function () {
                    existsStub.restore();
                    readSpy.restore();
                    mkdirStub.restore();
                    writeStub.restore();

                    done(error);
                });
        });

        it("should save if manifests initialized, save to existing deletions manifest", function (done) {
            // Create an fs.existsSync stub to return true for initialization and for save.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to return the manifest contents.
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.returns(TEST_MANIFEST_CONTENTS);

            // Create a mkdirp.sync stub.
            const mkdirStub = sinon.stub(mkdirp, "sync");

            // Create an fs.writeFileSync stub.
            const writeStub = sinon.stub(fs, "writeFileSync");

            let error;
            manifests.initializeManifests(context, null, null, "foo", opts)
                .then(function (result) {
                    manifests.saveDeletionsManifest(context, opts);

                    expect(existsStub).to.have.been.calledTwice;
                    expect(readStub).to.have.been.calledOnce;
                    expect(mkdirStub).to.not.have.been.called;
                    expect(writeStub).to.have.been.calledOnce;
                    expect(writeStub.args[0][0].endsWith("foo.json"));
                })
                .catch(function (err) {
                    error = err;
                })
                .finally(function () {
                    existsStub.restore();
                    readStub.restore();
                    mkdirStub.restore();
                    writeStub.restore();

                    done(error);
                });
        });

        it("should log an error if save to deletions manifest fails", function (done) {
            // Create an fs.existsSync stub to return true for initialization and for save.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to return the manifest contents.
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.returns(TEST_MANIFEST_CONTENTS);

            // Create a mkdirp.sync stub.
            const mkdirStub = sinon.stub(mkdirp, "sync");

            // Create an fs.writeFileSync stub.
            const WRITE_ERROR = "Error writing deletions manifest, expected by unit test.";
            const writeStub = sinon.stub(fs, "writeFileSync");
            writeStub.throws(WRITE_ERROR);

            // Create a context.logger.error stub to verify the error message.
            const errorStub = sinon.stub(context.logger, "error");

            let error;
            manifests.initializeManifests(context, null, null, "foo", opts)
                .then(function (result) {
                    manifests.saveDeletionsManifest(context, opts);

                    expect(existsStub).to.have.been.calledTwice;
                    expect(readStub).to.have.been.calledOnce;
                    expect(mkdirStub).to.not.have.been.called;
                    expect(writeStub).to.have.been.calledOnce;
                    expect(writeStub.args[0][0].endsWith("foo.json"));
                    expect(errorStub).to.have.been.calledOnce;
                    expect(errorStub.args[0][0]).to.contain("Error writing manifest file");
                    expect(errorStub.args[0][0]).to.contain("foo");
                    expect(errorStub.args[0][0]).to.contain(WRITE_ERROR);
                })
                .catch(function (err) {
                    error = err;
                })
                .finally(function () {
                    existsStub.restore();
                    readStub.restore();
                    mkdirStub.restore();
                    writeStub.restore();
                    errorStub.restore();

                    done(error);
                });
        });
    });
});
