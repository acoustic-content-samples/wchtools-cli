/*
Copyright 2017 IBM Corporation

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
const PagesUnitTest = require("./pages.unit.js");
const BaseFsUnit = require("./base.fs.unit.js");

// Require the node modules used in this test file.
const fs = require("fs");
const path = require("path");
const requireSubvert = require('require-subvert')(__dirname);
const sinon = require("sinon");
const utils = require(UnitTest.API_PATH + "lib/utils/utils.js");
const hashes = require(UnitTest.API_PATH + "lib/utils/hashes.js");
const JSONItemFS = require(UnitTest.API_PATH + "lib/JSONItemFS.js");

// Require the local module being tested.
const fsApi = require(UnitTest.API_PATH + "lib/pagesFS.js").instance;

// The default API context used for unit tests.
const context = UnitTest.DEFAULT_API_CONTEXT;

class PagesFsUnitTest extends BaseFsUnit {
    constructor() {
        super();
    }

    run() {
        super.run(fsApi, PagesUnitTest.VALID_PAGE_1, PagesUnitTest.VALID_PAGE_2 );
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
                expect(items[0].name).to.not.exist;
                expect(items[0].id).to.not.exist;
                expect(items[1].path).to.be.oneOf([itemName1, itemName2]);
                expect(items[1].name).to.not.exist;
                expect(items[1].id).to.not.exist;
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

    // Override the base FS test to handle the difference between names (pages return a path instead of a name).
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
                expect(items[0].name).to.be.oneOf(["Help", "About"]);
                expect(items[1].name).to.be.oneOf(["Help", "About"]);
                expect(items[0].id).to.exist;
                expect(items[1].id).to.exist;
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

    // Override the base FS test to handle the difference between names (pages return a path instead of a name).
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
        fsApi.listNames(context, {"workingDir": UnitTest.API_PATH + UnitTest.VALID_RESOURCES_DIRECTORY, "additionalItemProperties": ["contentId"]})
            .then(function (items) {
                // Verify that the get stub was called once with the lookup URI.
                expect(stub).to.have.been.calledOnce;

                // Verify that the expected values are returned.
                expect(items).to.have.lengthOf(2);
                expect(items[0].path).to.be.oneOf([itemName1, itemName2]);
                expect(items[1].path).to.be.oneOf([itemName1, itemName2]);
                expect(items[0].name).to.be.oneOf(["Help", "About"]);
                expect(items[1].name).to.be.oneOf(["Help", "About"]);
                expect(items[0].id).to.exist;
                expect(items[1].id).to.exist;
                expect(items[0]["contentId"]).to.exist;
                expect(items[1]["contentId"]).to.exist;
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
        const metadataPath1 = UnitTest.API_PATH + UnitTest.VALID_RESOURCES_DIRECTORY + "sites/default/bar/foo1.json";
        const metadataPath2 = UnitTest.API_PATH + UnitTest.VALID_RESOURCES_DIRECTORY + "sites/default/bar/foo2.json";
        const metadataPath3 = UnitTest.API_PATH + UnitTest.VALID_RESOURCES_DIRECTORY + "sites/default/foo/bar1.json";
        const metadataPath4 = UnitTest.API_PATH + UnitTest.VALID_RESOURCES_DIRECTORY + "sites/default/foo/bar2.json";
        stubDir.yields(err, [metadataPath1, metadataPath2, metadataPath3, metadataPath4]);

        // Subvert the "recursive-readdir" module with the specified stub.
        requireSubvert.subvert("recursive-readdir", stubDir);

        // Reload JSONPathBasedItemFS and pagesFS, so that fsApi gets will use the subverted recursive-readdir.
        requireSubvert.require(UnitTest.API_PATH + "lib/JSONPathBasedItemFS.js");
        fsApi = requireSubvert.require(UnitTest.API_PATH + "lib/pagesFS.js").instance;

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

                // Reload JSONPathBasedItemFS and pagesFS, so that fsApi gets the original recursive-readdir.
                require(UnitTest.API_PATH + "lib/JSONPathBasedItemFS.js");
                fsApi = require(UnitTest.API_PATH + "lib/pagesFS.js").instance;

                // Restore the default options.
                UnitTest.restoreOptions(context);

                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
    }

    // Override the base FS test to do tests for renaming pages.
    testHandleRename (fsApi, itemName1, itemName2) {
        const self = this;
        describe("PagesFS.handleRename", function() {
            it("should not delete old file if old file does not exist", function (done) {
                self.handleRename_NoOldPageFile(fsApi, itemName1, itemName2 , done);
            });

            it("should not delete old page file if new file exists", function (done) {
                self.handleRename_NewPageFileExists(fsApi, itemName1, itemName2 , done);
            });

            it("should delete old file if all conditions met", function (done) {
                self.handleRename_DeleteOldPageFile_FromRootFolder(fsApi, itemName1, itemName2 , done);
            });

            it("should delete old file but not parent", function (done) {
                self.handleRename_DeleteOldPageFile_FromPageFolder_NotEmpty(fsApi, itemName1, itemName2 , done);
            });

            it("should delete old file but error deleting parent", function (done) {
                self.handleRename_DeleteOldPageFile_FromPageFolder_Empty_Error(fsApi, itemName1, itemName2 , done);
            });

            it("should delete old file and parent", function (done) {
                self.handleRename_DeleteOldPageFile_FromPageFolder_Empty(fsApi, itemName1, itemName2 , done);
            });

            it("should delete old file but error renaming old folder", function (done) {
                self.handleRename_DeleteOldPageFile_RenameOldPageFolder_Error(fsApi, itemName1, itemName2 , done);
            });

            it("should delete old file and rename old folder", function (done) {
                self.handleRename_DeleteOldPageFile_RenameOldPageFolder(fsApi, itemName1, itemName2 , done);
            });

            it("should delete old file but error moving old folder files", function (done) {
                self.handleRename_DeleteOldPageFile_MoveOldChildPages_Error(fsApi, itemName1, itemName2 , done);
            });

            it("should delete old file and move old folder files", function (done) {
                self.handleRename_DeleteOldPageFile_MoveOldChildPages(fsApi, itemName1, itemName2 , done);
            });

            it("should get all descendent files", function (done) {
                self.getDescendentFilePaths_All(fsApi, itemName1, itemName2 , done);
            });

            it("should get the *.json descendent files", function (done) {
                self.getDescendentFilePaths_Json(fsApi, itemName1, itemName2 , done);
            });
        });
    }

    handleRename_NoOldPageFile (fsApi, itemName1, itemName2, done) {
        // Create a stub for hashes.getItemPath that will return a file path.
        const stubPath = sinon.stub(hashes, "getFilePath");
        stubPath.returns(UnitTest.DUMMY_PATH);

        // Create a stub for fs.existsSync that will return false for the old file.
        const stubExists = sinon.stub(fs, "existsSync");
        stubExists.onFirstCall().returns(false);

        // Create a stub for super.handleRename that will keep it from being called.
        const stubSuper = sinon.stub(JSONItemFS.prototype, "handleRename");

        // Create a spy for fs.unlinkSync to verify that it was not called.
        const spy = sinon.spy(fs, "unlinkSync");

        // The stubs and spy should be restored when the test is complete.
        this.addTestDouble(stubPath);
        this.addTestDouble(stubExists);
        this.addTestDouble(stubSuper);
        this.addTestDouble(spy);

        // Call the method being tested.
        let error;
        try {
            fsApi.handleRename(context, UnitTest.DUMMY_ID, UnitTest.DUMMY_NAME, {originalPushFileName: UnitTest.DUMMY_NAME});

            expect(stubPath).to.have.been.calledOnce;
            expect(stubExists).to.have.been.calledOnce;
            expect(stubSuper).to.have.been.calledOnce;
            expect(spy).to.not.have.been.called;
        } catch (err) {
            // This is not expected. Pass the error to the "done" function to indicate a failed test.
            error = err;
        } finally {
            // Call mocha's done function to indicate that the test is over.
            done(error);
        }
    }

    handleRename_NewPageFileExists (fsApi, itemName1, itemName2, done) {
        // Create a stub for hashes.getItemPath that will return a file path.
        const stubPath = sinon.stub(hashes, "getFilePath");
        stubPath.returns(UnitTest.DUMMY_PATH);

        // Create a stub for fs.existsSync that will return true for the old file and true for the new file.
        const stubExists = sinon.stub(fs, "existsSync");
        stubExists.onFirstCall().returns(true);
        stubExists.onSecondCall().returns(true);

        // Create a stub for super.handleRename that will keep it from being called.
        const stubSuper = sinon.stub(JSONItemFS.prototype, "handleRename");

        // Create a spy for fs.unlinkSync to verify that it was not called.
        const spy = sinon.spy(fs, "unlinkSync");

        // The stub and spy should be restored when the test is complete.
        this.addTestDouble(stubPath);
        this.addTestDouble(stubExists);
        this.addTestDouble(stubSuper);
        this.addTestDouble(spy);

        // Call the method being tested.
        let error;
        try {
            fsApi.handleRename(context, UnitTest.DUMMY_ID, UnitTest.DUMMY_NAME, UnitTest.DUMMY_OPTIONS);

            expect(stubPath).to.have.been.calledOnce;
            expect(stubExists).to.have.been.calledTwice;
            expect(stubSuper).to.have.been.calledOnce;
            expect(spy).to.not.have.been.called;
        } catch (err) {
            // This is not expected. Pass the error to the "done" function to indicate a failed test.
            error = err;
        } finally {
            // Call mocha's done function to indicate that the test is over.
            done(error);
        }
    }

    handleRename_DeleteOldPageFile_FromRootFolder (fsApi, itemName1, itemName2, done) {
        // Create a stub for hashes.getItemPath that will return a file path.
        const stubPath = sinon.stub(hashes, "getFilePath");
        stubPath.returns(UnitTest.DUMMY_PATH);

        // Create a stub for fs.existsSync that will return true for the old file, false for the new file, and false for
        // the old folder.
        const stubExists = sinon.stub(fs, "existsSync");
        stubExists.onFirstCall().returns(true);
        stubExists.onSecondCall().returns(false);
        stubExists.onThirdCall().returns(false);

        // Create a stub for fs.unlinkSync to do nothing.
        const stubUnlink = sinon.stub(fs, "unlinkSync");

        // Create a stub for path.dirname to return the base path.
        const basePath = fsApi.getPath(context, {});
        const stubDir = sinon.stub(path, "dirname");
        stubDir.returns(basePath);

        // The stubs should be restored when the test is complete.
        this.addTestDouble(stubPath);
        this.addTestDouble(stubExists);
        this.addTestDouble(stubUnlink);
        this.addTestDouble(stubDir);

        // Call the method being tested.
        let error;
        try {
            fsApi.handleRename(context, UnitTest.DUMMY_ID, UnitTest.DUMMY_NAME, {originalPushFileName: UnitTest.DUMMY_NAME});

            expect(stubPath).to.have.been.calledOnce;
            expect(stubExists).to.have.been.calledThrice;
            expect(stubUnlink).to.have.been.calledOnce;
            expect(stubDir).to.have.been.calledOnce;
        } catch (err) {
            // This is not expected. Pass the error to the "done" function to indicate a failed test.
            error = err;
        } finally {
            // Call mocha's done function to indicate that the test is over.
            done(error);
        }
    }

    handleRename_DeleteOldPageFile_FromPageFolder_NotEmpty (fsApi, itemName1, itemName2, done) {
        // Create a stub for hashes.getItemPath that will return a file path.
        const stubPath = sinon.stub(hashes, "getFilePath");
        stubPath.returns(UnitTest.DUMMY_PATH);

        // Create a stub for fs.existsSync that will return true for the old file, false for the new file, and false for
        // the old folder.
        const stubExists = sinon.stub(fs, "existsSync");
        stubExists.onFirstCall().returns(true);
        stubExists.onSecondCall().returns(false);
        stubExists.onThirdCall().returns(false);

        // Create a stub for fs.unlinkSync to do nothing.
        const stubUnlink = sinon.stub(fs, "unlinkSync");

        // Create a stub for fs.readdirSync to return files.
        const stubRead = sinon.stub(fs, "readdirSync");
        stubRead.returns(["1", "2", "3"]);

        // Create a spy for fs.rmdirSync to make sure it is not called.
        const spyRemove = sinon.spy(fs, "rmdirSync");

        // The stubs should be restored when the test is complete.
        this.addTestDouble(stubPath);
        this.addTestDouble(stubExists);
        this.addTestDouble(stubUnlink);
        this.addTestDouble(stubRead);
        this.addTestDouble(spyRemove);

        // Call the method being tested.
        let error;
        try {
            fsApi.handleRename(context, UnitTest.DUMMY_ID, UnitTest.DUMMY_NAME, {originalPushFileName: UnitTest.DUMMY_NAME});

            expect(stubPath).to.have.been.calledOnce;
            expect(stubExists).to.have.been.calledThrice;
            expect(stubUnlink).to.have.been.calledOnce;
            expect(stubRead).to.have.been.calledOnce;
            expect(spyRemove).to.not.have.been.called;
        } catch (err) {
            // This is not expected. Pass the error to the "done" function to indicate a failed test.
            error = err;
        } finally {
            // Call mocha's done function to indicate that the test is over.
            done(error);
        }
    }

    handleRename_DeleteOldPageFile_FromPageFolder_Empty_Error (fsApi, itemName1, itemName2, done) {
        // Create a stub for hashes.getItemPath that will return a file path.
        const stubPath = sinon.stub(hashes, "getFilePath");
        stubPath.returns(UnitTest.DUMMY_PATH);

        // Create a stub for fs.existsSync that will return true for the old file, false for the new file, and false for
        // the old folder.
        const stubExists = sinon.stub(fs, "existsSync");
        stubExists.onFirstCall().returns(true);
        stubExists.onSecondCall().returns(false);
        stubExists.onThirdCall().returns(false);

        // Create a stub for fs.unlinkSync to do nothing.
        const stubUnlink = sinon.stub(fs, "unlinkSync");

        // Create a stub for fs.readdirSync to return no files.
        const stubRead = sinon.stub(fs, "readdirSync");
        stubRead.returns([]);

        // Create a stub for fs.rmdirSync to return an error.
        const REMOVE_ERROR = "Error removing directory, expected by unit test.";
        const stubRemove = sinon.stub(fs, "rmdirSync");
        stubRemove.throws(new Error(REMOVE_ERROR));

        // The stubs should be restored when the test is complete.
        this.addTestDouble(stubPath);
        this.addTestDouble(stubExists);
        this.addTestDouble(stubUnlink);
        this.addTestDouble(stubRead);
        this.addTestDouble(stubRemove);

        // Call the method being tested.
        let error;
        try {
            fsApi.handleRename(context, UnitTest.DUMMY_ID, UnitTest.DUMMY_NAME, {originalPushFileName: UnitTest.DUMMY_NAME});

            expect(stubPath).to.have.been.calledOnce;
            expect(stubExists).to.have.been.calledThrice;
            expect(stubUnlink).to.have.been.calledOnce;
            expect(stubRead).to.have.been.calledOnce;
            expect(stubRemove).to.have.been.calledOnce;
        } catch (err) {
            // This is not expected. Pass the error to the "done" function to indicate a failed test.
            error = err;
        } finally {
            // Call mocha's done function to indicate that the test is over.
            done(error);
        }
    }

    handleRename_DeleteOldPageFile_FromPageFolder_Empty (fsApi, itemName1, itemName2, done) {
        // Create a stub for hashes.getItemPath that will return a file path.
        const stubPath = sinon.stub(hashes, "getFilePath");
        stubPath.returns(UnitTest.DUMMY_PATH);

        // Create a stub for fs.existsSync that will return true for the old file, false for the new file, and false for
        // the old folder.
        const stubExists = sinon.stub(fs, "existsSync");
        stubExists.onFirstCall().returns(true);
        stubExists.onSecondCall().returns(false);
        stubExists.onThirdCall().returns(false);

        // Create a stub for fs.unlinkSync to do nothing.
        const stubUnlink = sinon.stub(fs, "unlinkSync");

        // Create a stub for fs.readdirSync to return no files.
        const stubRead = sinon.stub(fs, "readdirSync");
        stubRead.returns([]);

        // Create a stub for fs.rmdirSync that does nothing.
        const stubRemove = sinon.stub(fs, "rmdirSync");

        // The stubs should be restored when the test is complete.
        this.addTestDouble(stubPath);
        this.addTestDouble(stubExists);
        this.addTestDouble(stubUnlink);
        this.addTestDouble(stubRead);
        this.addTestDouble(stubRemove);

        // Call the method being tested.
        let error;
        try {
            fsApi.handleRename(context, UnitTest.DUMMY_ID, UnitTest.DUMMY_NAME, {originalPushFileName: UnitTest.DUMMY_NAME});

            expect(stubPath).to.have.been.calledOnce;
            expect(stubExists).to.have.been.calledThrice;
            expect(stubUnlink).to.have.been.calledOnce;
            expect(stubRead).to.have.been.calledOnce;
            expect(stubRemove).to.have.been.calledOnce;
        } catch (err) {
            // This is not expected. Pass the error to the "done" function to indicate a failed test.
            error = err;
        } finally {
            // Call mocha's done function to indicate that the test is over.
            done(error);
        }
    }

    handleRename_DeleteOldPageFile_RenameOldPageFolder_Error (fsApi, itemName1, itemName2, done) {
        // Create a stub for hashes.getItemPath that will return a file path.
        const stubPath = sinon.stub(hashes, "getFilePath");
        stubPath.returns(UnitTest.DUMMY_PATH);

        // Create a stub for fs.existsSync that will return true for the old file, false for the new file, true for the
        // old folder, and false for the new folder.
        const stubExists = sinon.stub(fs, "existsSync");
        stubExists.onFirstCall().returns(true);
        stubExists.onSecondCall().returns(false);
        stubExists.onThirdCall().returns(true);
        stubExists.onCall(4).returns(false);

        // Create a stub for fs.unlinkSync to do nothing.
        const stubUnlink = sinon.stub(fs, "unlinkSync");

        // Create a stub for fs.renameSync to do nothing.
        const RENAME_ERROR = "Error renaming folder, expected by unit test.";
        const stubRename = sinon.stub(fs, "renameSync");
        stubRename.throws(new Error(RENAME_ERROR));

        // The stubs should be restored when the test is complete.
        this.addTestDouble(stubPath);
        this.addTestDouble(stubExists);
        this.addTestDouble(stubUnlink);
        this.addTestDouble(stubRename);

        // Call the method being tested.
        let error;
        try {
            fsApi.handleRename(context, UnitTest.DUMMY_ID, UnitTest.DUMMY_NAME, {originalPushFileName: UnitTest.DUMMY_NAME});

            expect(stubPath).to.have.been.calledOnce;
            expect(stubExists).to.have.callCount(4);
            expect(stubUnlink).to.have.been.calledOnce;
            expect(stubRename).to.have.been.calledOnce;
        } catch (err) {
            // This is not expected. Pass the error to the "done" function to indicate a failed test.
            error = err;
        } finally {
            // Call mocha's done function to indicate that the test is over.
            done(error);
        }
    }

    handleRename_DeleteOldPageFile_RenameOldPageFolder (fsApi, itemName1, itemName2, done) {
        // Create a stub for hashes.getItemPath that will return a file path.
        const stubPath = sinon.stub(hashes, "getFilePath");
        stubPath.returns(UnitTest.DUMMY_PATH);

        // Create a stub for fs.existsSync that will return true for the old file, false for the new file, true for the
        // old folder, and false for the new folder.
        const stubExists = sinon.stub(fs, "existsSync");
        stubExists.onFirstCall().returns(true);
        stubExists.onSecondCall().returns(false);
        stubExists.onThirdCall().returns(true);
        stubExists.onCall(4).returns(false);

        // Create a stub for fs.unlinkSync to do nothing.
        const stubUnlink = sinon.stub(fs, "unlinkSync");

        // Create a stub for fs.renameSync to do nothing.
        const stubRename = sinon.stub(fs, "renameSync");

        // Create a stub for JSONItemFS.getDescendentFilePaths to return a file.
        const stubPaths = sinon.stub(JSONItemFS.prototype, "getDescendentFilePaths");
        stubPaths.returns(["1"]);

        // Create a stub for fs.readFileSync to exercise the getDescendentFilePaths method.
        const stubRead = sinon.stub(fs, "readFileSync");
        stubRead.returns('{"id": "test"}');

        // Create a stub for hashes.setFilePath to do nothing.
        const stubHashes = sinon.stub(hashes, "setFilePath");

        // The stubs should be restored when the test is complete.
        this.addTestDouble(stubPath);
        this.addTestDouble(stubExists);
        this.addTestDouble(stubUnlink);
        this.addTestDouble(stubRename);
        this.addTestDouble(stubPaths);
        this.addTestDouble(stubRead);
        this.addTestDouble(stubHashes);

        // Call the method being tested.
        let error;
        try {
            fsApi.handleRename(context, UnitTest.DUMMY_ID, UnitTest.DUMMY_NAME, {originalPushFileName: UnitTest.DUMMY_NAME});

            expect(stubPath).to.have.been.calledOnce;
            expect(stubExists).to.have.callCount(4);
            expect(stubUnlink).to.have.been.calledOnce;
            expect(stubRename).to.have.been.calledOnce;
            expect(stubPaths).to.have.been.calledOnce;
            expect(stubRead).to.have.been.calledOnce;
            expect(stubHashes).to.have.been.calledOnce;
        } catch (err) {
            // This is not expected. Pass the error to the "done" function to indicate a failed test.
            error = err;
        } finally {
            // Call mocha's done function to indicate that the test is over.
            done(error);
        }
    }

    handleRename_DeleteOldPageFile_MoveOldChildPages_Error (fsApi, itemName1, itemName2, done) {
        // Create a stub for hashes.getItemPath that will return a file path.
        const stubPath = sinon.stub(hashes, "getFilePath");
        stubPath.returns(UnitTest.DUMMY_PATH);

        // Create a stub for fs.existsSync that will return true for the old file, false for the new file, true for the
        // old folder, and true for the new folder. Then true for the first child and false for the second child.
        const stubExists = sinon.stub(fs, "existsSync");
        stubExists.onFirstCall().returns(true);
        stubExists.onSecondCall().returns(false);
        stubExists.onThirdCall().returns(true);
        stubExists.onCall(3).returns(true);
        stubExists.onCall(4).returns(true);
        stubExists.onCall(5).returns(false);

        // Create a stub for fs.unlinkSync to do nothing.
        const DELETE_ERROR = "Error deleting file, expected by unit test.";
        const stubUnlink = sinon.stub(fs, "unlinkSync");
        stubUnlink.onFirstCall().returns(undefined);
        stubUnlink.onSecondCall().throws(new Error(DELETE_ERROR));

        // Create a stub for JSONItemFS.getDescendentFilePaths to return files.
        const stubPaths = sinon.stub(JSONItemFS.prototype, "getDescendentFilePaths");
        stubPaths.returns(["1", "2"]);

        // The stubs should be restored when the test is complete.
        this.addTestDouble(stubPath);
        this.addTestDouble(stubExists);
        this.addTestDouble(stubUnlink);
        this.addTestDouble(stubPaths);

        // Call the method being tested.
        let error;
        try {
            fsApi.handleRename(context, UnitTest.DUMMY_ID, UnitTest.DUMMY_NAME, {originalPushFileName: UnitTest.DUMMY_NAME});

            expect(stubPath).to.have.been.calledOnce;
            expect(stubExists).to.have.callCount(6);
            expect(stubUnlink).to.have.been.calledTwice;
            expect(stubPaths).to.have.been.calledOnce;
        } catch (err) {
            // This is not expected. Pass the error to the "done" function to indicate a failed test.
            error = err;
        } finally {
            // Call mocha's done function to indicate that the test is over.
            done(error);
        }
    }

    handleRename_DeleteOldPageFile_MoveOldChildPages (fsApi, itemName1, itemName2, done) {
        // Create a stub for hashes.getItemPath that will return a file path.
        const stubPath = sinon.stub(hashes, "getFilePath");
        stubPath.returns(UnitTest.DUMMY_PATH);

        // Create a stub for fs.existsSync that will return true for the old file, false for the new file, true for the
        // old folder, and true for the new folder. Then true for the first child and false for the second child.
        const stubExists = sinon.stub(fs, "existsSync");
        stubExists.onFirstCall().returns(true);
        stubExists.onSecondCall().returns(false);
        stubExists.onThirdCall().returns(true);
        stubExists.onCall(3).returns(true);
        stubExists.onCall(4).returns(true);
        stubExists.onCall(5).returns(false);

        // Create a stub for fs.unlinkSync to do nothing.
        const stubUnlink = sinon.stub(fs, "unlinkSync");

        // Create a stub for fs.renameSync to do nothing.
        const stubRename = sinon.stub(fs, "renameSync");

        // Create a stub for JSONItemFS.getDescendentFilePaths to return files.
        const stubPaths = sinon.stub(JSONItemFS.prototype, "getDescendentFilePaths");
        stubPaths.returns(["1", "2"]);

        // Create a stub for fs.readFileSync to exercise the getDescendentFilePaths method.
        const stubRead = sinon.stub(fs, "readFileSync");
        stubRead.returns('{"id": "test"}');

        // Create a stub for hashes.setFilePath to do nothing.
        const stubHashes = sinon.stub(hashes, "setFilePath");

        // Create a stub for fs.rmdirSync to do nothing.
        const stubRemove = sinon.stub(fs, "rmdirSync");

        // The stubs should be restored when the test is complete.
        this.addTestDouble(stubPath);
        this.addTestDouble(stubExists);
        this.addTestDouble(stubUnlink);
        this.addTestDouble(stubRename);
        this.addTestDouble(stubPaths);
        this.addTestDouble(stubRead);
        this.addTestDouble(stubHashes);
        this.addTestDouble(stubRemove);

        // Call the method being tested.
        let error;
        try {
            fsApi.handleRename(context, UnitTest.DUMMY_ID, UnitTest.DUMMY_NAME, {originalPushFileName: UnitTest.DUMMY_NAME});

            expect(stubPath).to.have.been.calledOnce;
            expect(stubExists).to.have.callCount(6);
            expect(stubUnlink).to.have.been.calledTwice;
            expect(stubRename).to.have.been.calledOnce;
            expect(stubPaths).to.have.been.calledOnce;
            expect(stubRead).to.have.been.calledOnce;
            expect(stubHashes).to.have.been.calledOnce;
            expect(stubRemove).to.have.been.calledOnce;
        } catch (err) {
            // This is not expected. Pass the error to the "done" function to indicate a failed test.
            error = err;
        } finally {
            // Call mocha's done function to indicate that the test is over.
            done(error);
        }
    }

    getDescendentFilePaths_All (fsApi, itemName1, itemName2, done) {
        // Use the directory of test resources for assets, since it has a known hierarchy.
        const directory = UnitTest.API_PATH + UnitTest.VALID_RESOURCES_DIRECTORY + "/assets";

        // Call the method being tested.
        let error;
        try {
            let paths = fsApi.getDescendentFilePaths(directory);

            // Get the relative paths.
            paths = paths.map(function (filePath) {
                return utils.getRelativePath(directory, filePath);
            });

            // Filter out any files or folders that start with a dot.
            paths = paths.filter(function (filePath) {
                return !filePath.startsWith("/.");
            });

            // Verify the number of files found and spot check the results.
            expect(paths).to.have.lengthOf(31);
            expect(paths).to.contain("/dxdam/87/87268612-232e-4554-922d-d49e9b2deee7/MB1FishingHoleSunset.jpg");
            expect(paths).to.contain("/dxdam/87/87268612-232e-4554-922d-d49e9b2deee7/MB1FishingHoleSunset.jpg_amd.json");
            expect(paths).to.contain("/test.hbs");
            expect(paths).to.contain("/test2.hbs");
            expect(paths).to.contain("/test_1/images/banner1.jpg");
            expect(paths).to.contain("/test_1/images/shoppingcart.png");
            expect(paths).to.contain("/test_2/hello.html");
        } catch (err) {
            error = err;
        } finally {
            done(error);
        }
    }

    getDescendentFilePaths_Json (fsApi, itemName1, itemName2, done) {
        // Use the directory of test resources for assets, since it has a known hierarchy.
        const directory = UnitTest.API_PATH + UnitTest.VALID_RESOURCES_DIRECTORY + "/assets";

        // Call the method being tested.
        let error;
        try {
            let paths = fsApi.getDescendentFilePaths(directory, fsApi.getExtension());

            // Get the relative paths.
            paths = paths.map(function (filePath) {
                return utils.getRelativePath(directory, filePath);
            });

            // Filter out any files or folders that start with a dot.
            paths = paths.filter(function (filePath) {
                return !filePath.startsWith("/.");
            });

            // Verify the number of files found and spot check the results.
            expect(paths).to.have.lengthOf(8);
            expect(paths).to.contain("/dxdam/87/87268612-232e-4554-922d-d49e9b2deee7/MB1FishingHoleSunset.jpg_amd.json");
            expect(paths).to.contain("/dxdam/94/94a5f59a-e52e-44a7-a0b3-fe6470bf7dae/MB1OceanClouds.jpg_amd.json");
            expect(paths).to.contain("/dxdam/db/db31d977-ed0e-4995-92b9-6d8c7c104f43/MBImpossibleCompositeSunset.jpg_amd.json");
            expect(paths).to.contain("/dxdam/f1/f18b7033-108f-47d3-869b-b3d98ed18f83/MB1SmallsFallsME.jpg_amd.json");
        } catch (err) {
            error = err;
        } finally {
            done(error);
        }
    }
}

module.exports = PagesFsUnitTest;
