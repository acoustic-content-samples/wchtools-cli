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
            try {
                const result = manifests.initializeManifests(context, null, null, opts);
                expect(result).to.be.true;
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });

        it("should return true if context already has a read manifest", function (done) {
            // Create an fs.existsSync spy to verify that it's not called.
            const existsSpy = sinon.spy(fs, "existsSync");

            let error;
            try {
                // Set the read manifest to a dummy value.
                context.readManifest = {};

                const result = manifests.initializeManifests(context, "foo", null, opts);
                expect(existsSpy).to.not.have.been.called;
                expect(result).to.be.true;
            } catch (err) {
                error = err;
            } finally {
                existsSpy.restore();

                done(error);
            }
        });

        it("should return true if context already has a write manifest", function (done) {
            // Create an fs.existsSync spy to verify that it's not called.
            const existsSpy = sinon.spy(fs, "existsSync");

            let error;
            try {
                // Set the read manifest to a dummy value.
                context.writeManifest = {};

                const result = manifests.initializeManifests(context, null, "foo", opts);
                expect(existsSpy).to.not.have.been.called;
                expect(result).to.be.true;
            } catch (err) {
                error = err;
            } finally {
                existsSpy.restore();

                done(error);
            }
        });

        it("should return false when specified read manifest is missing", function (done) {
            // Create an fs.existsSync stub to return false.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(false);

            // Create a context.logger.error stub to verify the error message.
            const errorStub = sinon.stub(context.logger, "error");

            let error;
            try {
                const result = manifests.initializeManifests(context, "foo", null, opts);
                const filename = options.getRelevantOption(context, opts, "readManifestFile");

                expect(filename).to.equal("foo");
                expect(existsStub.args[0][0].endsWith("foo.json")).to.equal(true);
                expect(errorStub.args[0][0]).to.contain("Manifest file");
                expect(errorStub.args[0][0]).to.contain("foo");
                expect(errorStub.args[0][0]).to.contain("does not exist");
                expect(result).to.be.false;
            } catch (err) {
                error = err;
            } finally {
                existsStub.restore();
                errorStub.restore();

                done(error);
            }
        });

        it("should return true when specified write manifest is missing", function (done) {
            // Create an fs.existsSync stub to return false.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(false);

            let error;
            try {
                const result = manifests.initializeManifests(context, null, "foo", opts);
                const filename = options.getRelevantOption(context, opts, "writeManifestFile");

                expect(filename).to.equal("foo");
                expect(existsStub.args[0][0].endsWith("foo.json")).to.equal(true);
                expect(result).to.be.true;
            } catch (err) {
                error = err;
            } finally {
                existsStub.restore();

                done(error);
            }
        });

        it("should return false when specified read manifest is invalid", function (done) {
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
            try {
                const result = manifests.initializeManifests(context, "foo", null, opts);
                const filename = options.getRelevantOption(context, opts, "readManifestFile");

                expect(filename).to.equal("foo");
                expect(existsStub.args[0][0].endsWith("foo.json")).to.equal(true);
                expect(errorStub.args[0][0]).to.contain("Error reading manifest file");
                expect(errorStub.args[0][0]).to.contain("foo");
                expect(errorStub.args[0][0]).to.contain(MANIFEST_ERROR);
                expect(result).to.be.false;
            } catch (err) {
                error = err;
            } finally {
                existsStub.restore();
                readStub.restore();
                errorStub.restore();

                done(error);
            }
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
            try {
                const result = manifests.initializeManifests(context, null, "foo", opts);
                const filename = options.getRelevantOption(context, opts, "writeManifestFile");

                expect(filename).to.equal("foo");
                expect(existsStub.args[0][0].endsWith("foo.json")).to.equal(true);
                expect(errorStub.args[0][0]).to.contain("Error reading manifest file");
                expect(errorStub.args[0][0]).to.contain("foo");
                expect(errorStub.args[0][0]).to.contain(MANIFEST_ERROR);
                expect(result).to.be.false;
            } catch (err) {
                error = err;
            } finally {
                existsStub.restore();
                readStub.restore();
                errorStub.restore();

                done(error);
            }
        });

        it("should return true when valid read manifest is specified", function (done) {
            // Create an fs.existsSync stub to return true.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to return the manifest contents.
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.returns(TEST_MANIFEST_CONTENTS);

            let error;
            try {
                const result = manifests.initializeManifests(context, "foo.json", null, opts);
                const filename = options.getRelevantOption(context, opts, "readManifestFile");
                const manifest = options.getRelevantOption(context, opts, "readManifest");

                expect(filename).to.equal("foo.json");
                expect(existsStub.args[0][0].endsWith("foo.json")).to.equal(true);
                expect(manifest["artifactType"]["an-id"].id).to.equal("an-id");
                expect(result).to.be.true;
            } catch (err) {
                error = err;
            } finally {
                existsStub.restore();
                readStub.restore();

                done(error);
            }
        });

        it("should return true when valid write manifest is specified", function (done) {
            // Create an fs.existsSync stub to return true.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to return the manifest contents.
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.returns(TEST_MANIFEST_CONTENTS);

            let error;
            try {
                const result = manifests.initializeManifests(context, null, "/foo.json", opts);
                const filename = options.getRelevantOption(context, opts, "writeManifestFile");
                const manifest = options.getRelevantOption(context, opts, "writeManifest");

                expect(filename).to.equal("/foo.json");
                expect(existsStub.args[0][0].endsWith("foo.json")).to.equal(true);
                expect(manifest["artifactType"]["an-id"].path).to.equal("a-path");
                expect(result).to.be.true;
            } catch (err) {
                error = err;
            } finally {
                existsStub.restore();
                readStub.restore();

                done(error);
            }
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

        it("should return undefined if  section doesn't exist", function (done) {
            // Create an fs.existsSync stub to return true.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to return the manifest contents.
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.returns(TEST_MANIFEST_CONTENTS);

            let error;
            try {
                const init = manifests.initializeManifests(context, "foo", null, opts);
                const section = manifests.getManifestSection(context, "ack", opts);

                expect(init).to.be.true;
                expect(section).to.not.exist;
            } catch (err) {
                error = err;
            } finally {
                existsStub.restore();
                readStub.restore();

                done(error);
            }
        });

        it("should return an existing section", function (done) {
            // Create an fs.existsSync stub to return true.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to return the manifest contents.
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.returns(TEST_MANIFEST_CONTENTS);

            let error;
            try {
                const init = manifests.initializeManifests(context, "foo", null, opts);
                const section = manifests.getManifestSection(context, "artifactType", opts);

                expect(init).to.be.true;
                expect(section["an-id"].path).to.equal("a-path");
            } catch (err) {
                error = err;
            } finally {
                existsStub.restore();
                readStub.restore();

                done(error);
            }
        });

        it("should return an undefined pages section if no sites section", function (done) {
            // Create an fs.existsSync stub to return true.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to return the manifest contents.
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.returns(TEST_MANIFEST_CONTENTS);

            let error;
            try {
                const init = manifests.initializeManifests(context, "foo", null, opts);
                const section = manifests.getManifestSection(context, "pages", opts);

                expect(init).to.be.true;
                expect(section).to.not.exist;
            } catch (err) {
                error = err;
            } finally {
                existsStub.restore();
                readStub.restore();

                done(error);
            }
        });

        it("should return an undefined pages section if only sites section", function (done) {
            // Create an fs.existsSync stub to return true.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to return the manifest contents.
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.returns(SITES_MANIFEST_CONTENTS);

            let error;
            try {
                const init = manifests.initializeManifests(context, "foo", null, opts);
                const section = manifests.getManifestSection(context, "pages", opts);

                expect(init).to.be.true;
                expect(section).to.not.exist;
            } catch (err) {
                error = err;
            } finally {
                existsStub.restore();
                readStub.restore();

                done(error);
            }
        });

        it("should return an undefined pages section if specified site section doesn't exist", function (done) {
            // Create an fs.existsSync stub to return true.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to return the manifest contents.
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.returns(SITES_MANIFEST_CONTENTS);

            let error;
            try {
                // Specify a non-default site id.
                opts.siteId = "non-default";

                const init = manifests.initializeManifests(context, "foo", null, opts);
                const section = manifests.getManifestSection(context, "pages", opts);

                expect(init).to.be.true;
                expect(section).to.not.exist;
            } catch (err) {
                error = err;
            } finally {
                existsStub.restore();
                readStub.restore();

                done(error);
            }
        });

        it("should return the pages section from the default site section", function (done) {
            // Create an fs.existsSync stub to return true.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to return the manifest contents.
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.returns(PAGES_MANIFEST_CONTENTS);

            let error;
            try {
                const init = manifests.initializeManifests(context, "foo", null, opts);
                const section = manifests.getManifestSection(context, "pages", opts);

                expect(init).to.be.true;
                expect(section["id1"].id).to.equal("id1");
                expect(section["id2"].id).to.equal("id2");
            } catch (err) {
                error = err;
            } finally {
                existsStub.restore();
                readStub.restore();

                done(error);
            }
        });

        it("should return the pages section from a non-default site section", function (done) {
            // Create an fs.existsSync stub to return true.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to return the manifest contents.
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.returns(PAGES_MANIFEST_CONTENTS);

            let error;
            try {
                // Specify a non-default site id.
                opts.siteId = "non-default";

                const init = manifests.initializeManifests(context, "foo", null, opts);
                const section = manifests.getManifestSection(context, "pages", opts);

                expect(init).to.be.true;
                expect(section["id1"].id).to.equal("id1");
                expect(section["id2"].id).to.equal("id2");
            } catch (err) {
                error = err;
            } finally {
                existsStub.restore();
                readStub.restore();

                done(error);
            }
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
            // Create a manifests.appendManifestSection spy to verify it is not called.
            const appendSpy = sinon.spy(manifests, "appendManifestSection");

            // Create a manifests.replaceManifestSection spy to verify it is not called.
            const replaceSpy = sinon.spy(manifests, "replaceManifestSection");

            let error;
            try {
                manifests.updateManifestSection(context, "foo", [], opts);

                expect(appendSpy).to.not.have.been.called;
                expect(replaceSpy).to.not.have.been.called;
            } catch (err) {
                error = err;
            } finally {
                appendSpy.restore();
                replaceSpy.restore();

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

            // Create a manifests.appendManifestSection stub to verify it was called.
            const appendStub = sinon.stub(manifests, "appendManifestSection");

            // Create a manifests.replaceManifestSection spy to verify it is not called.
            const replaceSpy = sinon.spy(manifests, "replaceManifestSection");

            let error;
            try {
                const init = manifests.initializeManifests(context, null, "foo", opts);

                // Force the manifests to use append mode.
                context.writeManifestMode = "append";
                manifests.updateManifestSection(context, "foo", [], opts);

                expect(init).to.be.true;
                expect(appendStub).to.have.been.called;
                expect(replaceSpy).to.not.have.been.called;
            } catch (err) {
                error = err;
            } finally {
                existsStub.restore();
                readStub.restore();
                appendStub.restore();
                replaceSpy.restore();

                done(error);
            }
        });

        it("should replace if manifest write mode is replace", function (done) {
            // Create an fs.existsSync stub to return true.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to return the manifest contents.
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.returns(TEST_MANIFEST_CONTENTS);

            // Create a manifests.appendManifestSection spy to verify it was called.
            const appendSpy = sinon.spy(manifests, "appendManifestSection");

            // Create a manifests.replaceManifestSection stub to verify it is not called.
            const replaceStub = sinon.stub(manifests, "replaceManifestSection");

            let error;
            try {
                const init = manifests.initializeManifests(context, null, "foo", opts);

                // Force the manifests to use replace mode.
                context.writeManifestMode = "replace";
                manifests.updateManifestSection(context, "foo", [], opts);

                expect(init).to.be.true;
                expect(appendSpy).to.not.have.been.called;
                expect(replaceStub).to.have.been.called;
            } catch (err) {
                error = err;
            } finally {
                existsStub.restore();
                readStub.restore();
                appendSpy.restore();
                replaceStub.restore();

                done(error);
            }
        });
    });

    describe("appendManifestSection", function () {
        let opts = {};

        afterEach(function (done) {
            // Reset the manifest settings after each test.
            manifests.resetManifests(context);

            // Clear the options after each test.
            opts = {};

            done();
        });

        it("should create a skeleton section, if manifests not initialized", function (done) {
            let error;
            try {
                expect(context.writeManifest).to.not.exist;

                manifests.appendManifestSection(context, "artifactType", null, opts);

                expect(context.writeManifest).to.exist;
                expect(context.writeManifest["artifactType"]).to.exist;
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });

        it("should create a section with the specified item, if manifests not initialized", function (done) {
            let error;
            try {
                expect(context.writeManifest).to.not.exist;

                manifests.appendManifestSection(context, "artifactType", [{"id": "id1", "name": "name1", "path": "path1"}], opts);

                expect(context.writeManifest).to.exist;
                expect(context.writeManifest["artifactType"]).to.exist;
                expect(context.writeManifest["artifactType"]["id1"]).to.exist;
                expect(context.writeManifest["artifactType"]["id1"].path).to.equal("path1");
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });

        it("should create a sites section and append the specified item to the pages section, if manifests not initialized", function (done) {
            let error;
            try {
                expect(context.writeManifest).to.not.exist;

                manifests.appendManifestSection(context, "pages", [{"id": "id1", "name": "name1", "hierarchicalPath": "path1"}], opts);

                expect(context.writeManifest).to.exist;
                expect(context.writeManifest["sites"]).to.exist;
                expect(context.writeManifest["sites"]["default"]).to.exist;
                expect(context.writeManifest["sites"]["default"]["pages"]).to.exist;
                expect(context.writeManifest["sites"]["default"]["pages"]["id1"]).to.exist;
                expect(context.writeManifest["sites"]["default"]["pages"]["id1"].path).to.equal("path1");
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });

        it("should append the specified item to an existing section", function (done) {
            // Create an fs.existsSync stub to return true.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to return the manifest contents.
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.returns(TEST_MANIFEST_CONTENTS);

            let error;
            try {
                const init = manifests.initializeManifests(context, null, "foo", opts);
                let manifest = options.getRelevantOption(context, opts, "writeManifest");

                expect(init).to.equal(true);
                expect(manifest["artifactType"]["an-id"].path).to.equal("a-path");
                expect(manifest["artifactType"]["id1"]).to.not.exist;

                manifests.appendManifestSection(context, "artifactType", [{"id": "id1", "name": "name1", "path": "path1"}], opts);

                manifest = options.getRelevantOption(context, opts, "writeManifest");
                expect(manifest["artifactType"]["an-id"].path).to.equal("a-path");
                expect(manifest["artifactType"]["id1"].path).to.equal("path1");
            } catch (err) {
                error = err;
            } finally {
                existsStub.restore();
                readStub.restore();

                done(error);
            }
        });

        it("should append the specified asset item to an existing assets section", function (done) {
            // Create an fs.existsSync stub to return true.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to return the manifest contents.
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.returns(ASSETS_MANIFEST_CONTENTS);

            let error;
            try {
                const init = manifests.initializeManifests(context, null, "foo", opts);
                let manifest = options.getRelevantOption(context, opts, "writeManifest");

                expect(init).to.equal(true);
                expect(manifest["assets"]["asset-path"].name).to.equal("asset-name");
                expect(manifest["assets"]["asset-path-2"]).to.not.exist;

                manifests.appendManifestSection(context, "assets", [{"id": "asset-id-2", "name": "asset-name-2", "path": "asset-path-2"}], opts);

                manifest = options.getRelevantOption(context, opts, "writeManifest");
                expect(manifest["assets"]["asset-path"].name).to.equal("asset-name");
                expect(manifest["assets"]["asset-path-2"].name).to.equal("asset-name-2");
            } catch (err) {
                error = err;
            } finally {
                existsStub.restore();
                readStub.restore();

                done(error);
            }
        });

        it("should append the specified page item to an existing pages section", function (done) {
            // Create an fs.existsSync stub to return true.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to return the manifest contents.
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.returns(PAGES_MANIFEST_CONTENTS);

            let error;
            try {
                const init = manifests.initializeManifests(context, null, "foo", opts);
                let manifest = options.getRelevantOption(context, opts, "writeManifest");

                expect(init).to.equal(true);
                expect(manifest["sites"]["default"]["pages"]["id1"].path).to.equal("path1");
                expect(manifest["sites"]["default"]["pages"]["id3"]).to.not.exist;

                manifests.appendManifestSection(context, "pages", [{"id": "id3", "name": "name3", "hierarchicalPath": "path3"}], opts);

                manifest = options.getRelevantOption(context, opts, "writeManifest");
                expect(manifest["sites"]["default"]["pages"]["id1"].path).to.equal("path1");
                expect(manifest["sites"]["default"]["pages"]["id3"].path).to.equal("path3");
            } catch (err) {
                error = err;
            } finally {
                existsStub.restore();
                readStub.restore();

                done(error);
            }
        });

        it("should not append the specified item if the key field is not specified", function (done) {
            // Create an fs.existsSync stub to return true.
            const existsStub = sinon.stub(fs, "existsSync");
            existsStub.returns(true);

            // Create an fs.readFileSync stub to return the manifest contents.
            const readStub = sinon.stub(fs, "readFileSync");
            readStub.returns(TEST_MANIFEST_CONTENTS);

            let error;
            try {
                const init = manifests.initializeManifests(context, null, "foo", opts);
                let manifest = options.getRelevantOption(context, opts, "writeManifest");

                expect(init).to.equal(true);
                expect(manifest["artifactType"]["an-id"].path).to.equal("a-path");
                expect(manifest["artifactType"]["id1"]).to.not.exist;

                manifests.appendManifestSection(context, "artifactType", [{"foo": "id1", "name": "name1", "path": "path1"}], opts);

                manifest = options.getRelevantOption(context, opts, "writeManifest");
                expect(manifest["artifactType"]["an-id"].path).to.equal("a-path");
                expect(manifest["artifactType"]["id1"]).to.not.exist;
            } catch (err) {
                error = err;
            } finally {
                existsStub.restore();
                readStub.restore();

                done(error);
            }
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
            try {
                const init = manifests.initializeManifests(context, null, "foo", opts);
                manifests.saveManifest(context, opts);

                expect(init).to.be.true;
                expect(existsStub).to.have.been.calledTwice;
                expect(readSpy).to.not.have.been.calledOnce;
                expect(mkdirStub).to.have.been.calledOnce;
                expect(writeStub).to.have.been.calledOnce;
                expect(writeStub.args[0][0].endsWith("foo.json"));
            } catch (err) {
                error = err;
            } finally {
                existsStub.restore();
                readSpy.restore();
                mkdirStub.restore();
                writeStub.restore();

                done(error);
            }
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
            try {
                const init = manifests.initializeManifests(context, null, "foo", opts);
                manifests.saveManifest(context, opts);

                expect(init).to.be.true;
                expect(existsStub).to.have.been.calledTwice;
                expect(readStub).to.have.been.calledOnce;
                expect(mkdirStub).to.not.have.been.called;
                expect(writeStub).to.have.been.calledOnce;
                expect(writeStub.args[0][0].endsWith("foo.json"));
            } catch (err) {
                error = err;
            } finally {
                existsStub.restore();
                readStub.restore();
                mkdirStub.restore();
                writeStub.restore();

                done(error);
            }
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
            try {
                const init = manifests.initializeManifests(context, null, "foo", opts);
                manifests.saveManifest(context, opts);

                expect(init).to.be.true;
                expect(existsStub).to.have.been.calledTwice;
                expect(readStub).to.have.been.calledOnce;
                expect(mkdirStub).to.not.have.been.called;
                expect(writeStub).to.have.been.calledOnce;
                expect(writeStub.args[0][0].endsWith("foo.json"));
                expect(errorStub).to.have.been.calledOnce;
                expect(errorStub.args[0][0]).to.contain("Error writing manifest file");
                expect(errorStub.args[0][0]).to.contain("foo");
                expect(errorStub.args[0][0]).to.contain(WRITE_ERROR);
            } catch (err) {
                error = err;
            } finally {
                existsStub.restore();
                readStub.restore();
                mkdirStub.restore();
                writeStub.restore();
                errorStub.restore();

                done(error);
            }
        });
    });
});
