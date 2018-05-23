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
 * Unit tests for the ContentsREST object.
 */
"use strict";

// Require the super classes for this class.
const UnitTest = require("./base.unit.js");
const LayoutMappingsUnitTest = require("./layoutMappings.unit.js");
const BaseFsUnit = require("./base.fs.unit.js");

// Require the node modules used in this test file.
const fs = require("fs");
const requireSubvert = require('require-subvert')(__dirname);
const sinon = require("sinon");

// Require the local module being tested.
const fsApi = require(UnitTest.API_PATH + "lib/layoutMappingsFS.js").instance;

// The default API context used for unit tests.
const context = UnitTest.DEFAULT_API_CONTEXT;

class LayoutMappingsFsUnitTest extends BaseFsUnit {
    constructor () {
        super();
    }

    run () {
        super.run(fsApi, LayoutMappingsUnitTest.VALID_LAYOUTMAPPING_1, LayoutMappingsUnitTest.VALID_LAYOUTMAPPING_2);
    }

    // Override the base FS test to handle the difference between reading a single directory and recursive read.
    listNamesReadFileError (fsApi, itemName1, itemName2, done) {
        const FAKE_EXTENSION = ".json";
        const stubGetExtension = sinon.stub(fsApi, "getExtension");
        stubGetExtension.returns(FAKE_EXTENSION);

        const stubRead = sinon.stub(fs, "readFileSync");
        stubRead.throws(new Error("Error reading file, as expected by unit test."));

        this.addTestDouble(stubGetExtension);

        // Call the method being tested.
        let error;

        // Set the current working directory to the "valid resources" directory.
        fsApi.listNames(context, {"workingDir": UnitTest.API_PATH + UnitTest.VALID_RESOURCES_DIRECTORY})
            .then(function (items) {
                // Verify that the expected values are returned.
                expect(items).to.have.lengthOf(2);
                expect(items[0].path).to.be.oneOf([itemName1, itemName2]);
                expect(items[0].id).to.not.exist;
                expect(items[0].name).to.not.exist;
                expect(items[1].path).to.be.oneOf([itemName1, itemName2]);
                expect(items[1].id).to.not.exist;
                expect(items[1].name).to.not.exist;
            })
            .catch (function (err) {
                // NOTE: A failed expectation from above will be handled here.
                // Pass the error to the "done" function to indicate a failed test.
                error = err;
            })
            .finally(function () {
                // Must restore the stubRead stub before calling restoreOptions().
                stubRead.restore();

                // Restore the default options.
                UnitTest.restoreOptions(context);

                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
    }

    // Override the base FS test to handle the difference between names (layout mappings return a path instead of a name).
    listNamesSuccess (fsApi, itemName1, itemName2, done) {
        // Create a stub that will return a list of item names from the recursive function.
        const stub = sinon.stub(fs, "readdir");
        const err = null;
        stub.yields(err, [itemName1, itemName2]);

        const FAKE_EXTENSION = ".json";
        const stubGetExtension = sinon.stub(fsApi, "getExtension");
        stubGetExtension.returns(FAKE_EXTENSION);

        this.addTestDouble(stub);
        this.addTestDouble(stubGetExtension);

        // Call the method being tested.
        let error;

        // Set the current working directory to the "valid resources" directory.
        fsApi.listNames(context, {"workingDir": UnitTest.API_PATH + UnitTest.VALID_RESOURCES_DIRECTORY})
            .then(function (items) {
                // Verify that the get stub was called once with the lookup URI.
                expect(stub).to.have.been.calledOnce;

                // Verify that the expected values are returned.
                expect(items).to.have.lengthOf(2);
                expect(items[0].path).to.be.oneOf([itemName1, itemName2]);
                expect(items[1].path).to.be.oneOf([itemName1, itemName2]);
                expect(items[0].name).to.be.oneOf(["layout mapping 1", "layout mapping 2"]);
                expect(items[1].name).to.be.oneOf(["layout mapping 1", "layout mapping 2"]);
                expect(items[0].id).to.be.oneOf(["layoutmapping1", "layoutmapping2"]);
                expect(items[1].id).to.be.oneOf(["layoutmapping1", "layoutmapping2"]);
            })
            .catch (function (err) {
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

    // Override the base FS test to handle the difference between names (layout mappings return a path instead of a name).
    listNamesAdditionalPropertiesSuccess (fsApi, itemName1, itemName2, done) {
        // Create a stub that will return a list of item names from the recursive function.
        const stub = sinon.stub(fs, "readdir");
        const err = null;
        stub.yields(err, [itemName1, itemName2]);

        const FAKE_EXTENSION = ".json";
        const stubGetExtension = sinon.stub(fsApi, "getExtension");
        stubGetExtension.returns(FAKE_EXTENSION);

        this.addTestDouble(stub);
        this.addTestDouble(stubGetExtension);

        // Call the method being tested.
        let error;

        // Set the current working directory to the "valid resources" directory.
        fsApi.listNames(context, {"workingDir": UnitTest.API_PATH + UnitTest.VALID_RESOURCES_DIRECTORY, "additionalItemProperties": ["mappings"]})
            .then(function (items) {
                // Verify that the get stub was called once with the lookup URI.
                expect(stub).to.have.been.calledOnce;

                // Verify that the expected values are returned.
                expect(items).to.have.lengthOf(2);
                expect(items[0].path).to.be.oneOf([itemName1, itemName2]);
                expect(items[1].path).to.be.oneOf([itemName1, itemName2]);
                expect(items[0].name).to.be.oneOf(["layout mapping 1", "layout mapping 2"]);
                expect(items[1].name).to.be.oneOf(["layout mapping 1", "layout mapping 2"]);
                expect(items[0].id).to.be.oneOf(["layoutmapping1", "layoutmapping2"]);
                expect(items[1].id).to.be.oneOf(["layoutmapping1", "layoutmapping2"]);
                expect(items[0]["mappings"]).to.exist;
                expect(items[1]["mappings"]).to.exist;
            })
            .catch (function (err) {
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

    // Override the base FS test to test list by path.
    listNamesByPath (fsApi, itemName1, itemName2, done) {
        // Create a stub that will return a list of item names from the recursive function.
        const stubDir = sinon.stub();
        const err = null;
        const metadataPath1 = UnitTest.API_PATH + UnitTest.VALID_RESOURCES_DIRECTORY + "layout-mappings/bar/foo1.json";
        const metadataPath2 = UnitTest.API_PATH + UnitTest.VALID_RESOURCES_DIRECTORY + "layout-mappings/bar/foo2.json";
        const metadataPath3 = UnitTest.API_PATH + UnitTest.VALID_RESOURCES_DIRECTORY + "layout-mappings/foo/bar1.json";
        const metadataPath4 = UnitTest.API_PATH + UnitTest.VALID_RESOURCES_DIRECTORY + "layout-mappings/foo/bar2.json";
        stubDir.yields(err, [metadataPath1, metadataPath2, metadataPath3, metadataPath4]);

        // Subvert the "recursive-readdir" module with the specified stub.
        requireSubvert.subvert("recursive-readdir", stubDir);

        // Reload JSONPathBasedItemFS and layoutMappingsFS, so that fsApi gets will use the subverted recursive-readdir.
        requireSubvert.require(UnitTest.API_PATH + "lib/JSONPathBasedItemFS.js");
        fsApi = requireSubvert.require(UnitTest.API_PATH + "lib/layoutMappingsFS.js").instance;

        // Create an fs.readFileSync stub that will return an empty object.
        const stubFile = sinon.stub(fs, "readFileSync");
        stubFile.returns("{}");

        const FAKE_EXTENSION = ".json";
        const stubGetExtension = sinon.stub(fsApi, "getExtension");
        stubGetExtension.returns(FAKE_EXTENSION);

        this.addTestDouble(stubFile);
        this.addTestDouble(stubGetExtension);

        // Call the method being tested.
        let error;

        // Set the current working directory to the "valid resources" directory.
        fsApi.listNames(context, {"workingDir": UnitTest.API_PATH + UnitTest.VALID_RESOURCES_DIRECTORY, filterPath: "foo"})
            .then(function (items) {
                // Verify that the dir stub was called once and the file stub was called twice.
                expect(stubDir).to.have.been.calledOnce;
                expect(stubFile).to.have.been.calledTwice;

                // Verify that the expected values are returned.
                expect(items).to.have.lengthOf(2);
                expect(items[0].path).to.contain("/foo/");
                expect(items[1].path).to.contain("/foo/");
            })
            .catch (function (err) {
                // NOTE: A failed expectation from above will be handled here.
                // Pass the error to the "done" function to indicate a failed test.
                error = err;
            })
            .finally(function () {
                // Restore the subverted functions.
                requireSubvert.cleanUp();

                // Reload JSONPathBasedItemFS and layoutMappingsFS, so that fsApi gets the original recursive-readdir.
                require(UnitTest.API_PATH + "lib/JSONPathBasedItemFS.js");
                fsApi = require(UnitTest.API_PATH + "lib/layoutMappingsFS.js").instance;

                // Restore the default options.
                UnitTest.restoreOptions(context);

                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
    }
}

module.exports = LayoutMappingsFsUnitTest;
