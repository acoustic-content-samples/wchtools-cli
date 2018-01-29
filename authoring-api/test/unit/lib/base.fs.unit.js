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
 * Unit tests for the FS object.
 */
"use strict";

// Require the super classes for this class.
const UnitTest = require("./base.unit.js");

// Require the node modules used in this test file.
const fs = require("fs");
const diff = require("diff");
const sinon = require("sinon");

// Require the local modules that will be stubbed, mocked, and spied.
const mkdirp = require('mkdirp');
const hashes = require(UnitTest.API_PATH + "lib/utils/hashes.js");
const JSONItemFS = require(UnitTest.API_PATH + "lib/JSONItemFS.js");

// Test "stats" data.
const DUMMY_DATE = new Date("Mon, 10 Oct 2011 23:24:11 GMT");
const DUMMY_STAT = {
    dev: 2114,
    ino: 48064969,
    mode: 33188,
    nlink: 1,
    uid: 85,
    gid: 100,
    rdev: 0,
    size: 527,
    blksize: 4096,
    blocks: 8,
    atime: DUMMY_DATE,
    mtime: DUMMY_DATE,
    ctime: DUMMY_DATE,
    birthtime: DUMMY_DATE
};

// The default API context used for unit tests.
const context = UnitTest.DEFAULT_API_CONTEXT;

class BaseFsApiUnitTest extends UnitTest {
    constructor() {
        super();
    }

    run (fsApi, itemName1, itemName2) {
        const self = this;
        describe("Unit tests for " + fsApi.getServiceName() + "FS " , function () {
            let stubSync;

            // Initialize common resources before running the unit tests.
            before(function (done) {
                // Create a stub for the mkdirp.sync() function, so that we don't create any directories.
                stubSync = sinon.stub(mkdirp, "sync");
                stubSync.returns(null);

                // Signal that the cleanup is complete.
                done();
            });

            // Cleanup common resourses consumed by each test.
            afterEach(function (done) {
                // Restore any stubs and spies used for the test.
                self.restoreTestDoubles();

                // Signal that the cleanup is complete.
                done();
            });

            // Cleanup common resourses consumed by the test suite.
            after(function (done) {
                // Restore the mkdirp.sync() function.
                stubSync.restore();

                // Signal that the cleanup is complete.
                done();
            });

            // Run each of the tests defined in this class.
            self.testSingleton(fsApi, itemName1, itemName2);
            self.testGetItem(fsApi, itemName1, itemName2);
            self.testGetFileStats(fsApi, itemName1, itemName2);
            self.testGetPath(fsApi, itemName1, itemName2);
            self.testGetItemPath(fsApi, itemName1, itemName2);
            self.testHandleRename(fsApi, itemName1, itemName2);
            self.testSaveItem(fsApi, itemName1, itemName2);
            self.testDeleteItem(fsApi);
            self.testListNames(fsApi, itemName1, itemName2);
            self.testGetItems(fsApi, itemName1, itemName2);
        });
    }

    testSingleton (fsApi, itemName1, itemName2) {
        describe("is a singleton", function () {
            it("should fail if try to create a fsAPI Type", function (done) {
                BaseFsApiUnitTest.singletonCreate(fsApi, itemName1, itemName2, done);
            });
        });
    }

    static singletonCreate (fsApi, itemName1, itemName2, done) {
        let error;
        try {
            const api = new fsApi.constructor();
            if (api) {
                error = "The constructor should have failed.";
            } else {
                error = "The constructor should have thrown an error.";
            }
        } catch (e) {
            expect(e).to.equal("An instance of singleton class " + fsApi.constructor.name + " cannot be constructed");
        }
        // Call mocha's done function to indicate that the test is over.
        done(error);
    }

    testGetItem (fsApi, itemName1, itemName2) {
        const self = this;

        describe("getItem", function () {
            it("should fail if reading the metadata file fails", function (done) {
                // Create a stub for fs.readFile to return an error.
                const ASSET_ERROR = "Error reading the metadata file.";
                const stub = sinon.stub(fs, "readFile");
                stub.yields(new Error(ASSET_ERROR));

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                fsApi.getItem(context, itemName1, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset item should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once with the specified asset path.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[0]).to.contain(itemName1);

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.equal(ASSET_ERROR);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail if the file has no contents", function (done) {
                // Create a stub for fs.readFile to return an invalid JSON string.
                const stub = sinon.stub(fs, "readFile");
                stub.yields(null, null);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                fsApi.getItem(context, itemName2, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset item should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once with the specified asset path.
                            expect(stub).to.have.been.calledOnce;
                            expect(stub.firstCall.args[0]).to.contain(itemName2);

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.contain("Error parsing item");
                            expect(err.message).to.contain("null");
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail if parsing the file contents fails", function (done) {
                // Create a stub for fs.readFile to return an invalid JSON string.
                const stub = sinon.stub(fs, "readFile");
                stub.yields(null, '{"json": "no-closing-curly-bracket"');

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                fsApi.getItem(context, itemName2, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset item should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once with the specified asset path.
                            expect(stub).to.have.been.calledOnce;
                            expect(stub.firstCall.args[0]).to.contain(itemName2);

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("SyntaxError");
                            expect(err.message).to.contain("Unexpected end of");
                            expect(err.message).to.contain("input");
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed if parsing the file contents succeeds", function (done) {
                // Create a stub for fs.readFile to return a valid JSON string.
                const stub = sinon.stub(fs, "readFile");
                stub.yields(null, '{"json": "closing-curly-bracket"}');

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                fsApi.getItem(context, {name: itemName1, id: itemName1, path: itemName1}, UnitTest.DUMMY_OPTIONS)
                    .then(function (item) {
                        // The stub should have been called once.
                        expect(stub).to.have.been.calledOnce;

                        // Verify that the expected item was returned.
                        expect(item.json).to.equal("closing-curly-bracket");
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should cache items when enabled", function (done) {
                // Create a stub that will read an item from a file.
                const stubRead = sinon.stub(fs, "readFile");
                stubRead.yields(null, '{"id": "' + UnitTest.DUMMY_ID + '", "name": "' + itemName1 + '"}');

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubRead);

                // Enable the item cache.
                JSONItemFS.setCacheEnabled(context, true, UnitTest.DUMMY_OPTIONS);

                // Call the method being tested.
                let error;
                fsApi.getItem(context, itemName1, UnitTest.DUMMY_OPTIONS)
                    .then(function (item) {
                        // Verify that the read stub was called once and the expected item was returned.
                        expect(stubRead).to.have.been.calledOnce;
                        expect(item["id"]).to.equal(UnitTest.DUMMY_ID);

                        // Call the method being tested again.
                        return fsApi.getItem(context, itemName1, UnitTest.DUMMY_OPTIONS);
                    })
                    .then(function (item) {
                        // Verify that the read stub was not called again, but the item was returned from the cache.
                        expect(stubRead).to.have.been.calledOnce;
                        expect(item["id"]).to.equal(UnitTest.DUMMY_ID);

                        // Disable the item cache.
                        JSONItemFS.setCacheEnabled(context, false, UnitTest.DUMMY_OPTIONS);

                        // Call the method being tested again.
                        return fsApi.getItem(context, itemName1, UnitTest.DUMMY_OPTIONS);
                    })
                    .then(function (item) {
                        // Verify that the read stub was called again, and the expected item was returned.
                        expect(stubRead).to.have.been.calledTwice;
                        expect(item["id"]).to.equal(UnitTest.DUMMY_ID);
                    })
                    .catch (function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Disable the item cache.
                        JSONItemFS.setCacheEnabled(context, false, UnitTest.DUMMY_OPTIONS);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testGetFileStats (fsApi, itemName1, itemName2) {
        const self = this;

        describe("getFileStats", function () {
            it("should fail when getting stats the fails with an error", function (done) {
                self.getFileStatsError(fsApi, itemName1, itemName2 , done);
            });

            it("should succeed when getting stats for a valid item", function (done) {
                self.getFileStatsSuccess(fsApi, itemName1, itemName2 , done);
            });
        });
    }

    getFileStatsError (fsApi, itemName1, itemName2, done) {
        // Create a stub for fs.stat to return an error.
        const ITEM_ERROR = "Error getting the item stats.";
        const stub = sinon.stub(fs, "stat");
        const err = new Error(ITEM_ERROR);
        const stats = null;
        stub.yields(err, stats);

        // The stub should be restored when the test is complete.
        this.addTestDouble(stub);

        // Call the method being tested.
        let error;
        fsApi.getFileStats(context, itemName1)
            .then(function () {
                // This is not expected. Pass the error to the "done" function to indicate a failed test.
                error = new Error("The promise for the item stats should have been rejected.");
            })
            .catch(function (err) {
                try {
                    // Verify that the stub was called once with the specified URI.
                    expect(stub).to.have.been.calledOnce;
                    expect(stub.args[0][0]).to.contain(itemName1);

                    // Verify that the expected error is returned.
                    expect(err.name).to.equal("Error");
                    expect(err.message).to.equal(ITEM_ERROR);
                } catch (err) {
                    error = err;
                }
            })
            .finally(function () {
                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
    }

    getFileStatsSuccess (fsApi, itemName1, itemName2, done) {
        // Create a stub for fs.stat to return a stats object.
        const stub = sinon.stub(fs, "stat");
        const err = null;

        stub.yields(err, DUMMY_STAT);

        // The stub should be restored when the test is complete.
        this.addTestDouble(stub);

        // Call the method being tested.
        let error;
        fsApi.getFileStats(context, itemName1)
            .then(function (stats) {
                // Verify that the stub was called once with the specified path.
                expect(stub).to.have.been.calledOnce;
                expect(stub.args[0][0]).to.contain(itemName1);

                // Verify that the REST API returned the expected values.
                expect(diff.diffJson(stats, DUMMY_STAT)).to.have.lengthOf(1);
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
    };

    testGetPath (fsApi, itemName1, itemName2) {
        describe("getPath", function () {
            // Restore options before running the unit tests.
            before(function (done) {
                UnitTest.restoreOptions(context);

                // Signal that the cleanup is complete.
                done();
            });

            // Restore options after running the unit tests.
            after(function (done) {
                UnitTest.restoreOptions(context);

                // Signal that the cleanup is complete.
                done();
            });

            it("should succeed when setting a new working directory", function (done) {
                // Before setting the new working directory, the item path should not contain that directory.
                expect(fsApi.getItemPath(context, UnitTest.DUMMY_NAME)).to.not.contain(UnitTest.DUMMY_DIR);

                // If the working dir is set in the opts object, then the item path should contain that directory.
                expect(fsApi.getItemPath(context, UnitTest.DUMMY_NAME, {"workingDir": UnitTest.DUMMY_DIR})).to.contain(UnitTest.DUMMY_DIR);

                done();
            });
        });
    }

    testGetItemPath (fsApi, itemName1, itemName2) {
        describe("getItemPath", function () {
            it("should succeed with various inputs", function (done) {
                // Should return undefined for an undefined input item.
                expect(fsApi.getItemPath(context, undefined)).to.not.exist;

                // Should return undefined for an empty input item.
                expect(fsApi.getItemPath(context, {})).to.not.exist;

                // If id is the only input property and a path is returned, that path should contain the id property.
                const extension = fsApi.getExtension();
                let itemPath = fsApi.getItemPath(context, {"id": UnitTest.DUMMY_ID});
                if (itemPath) {
                    expect(itemPath).to.contain(UnitTest.DUMMY_ID);
                    expect(itemPath).to.contain(extension);
                }

                // If name is the only input property and a path is returned, that path should contain the name property.
                itemPath = fsApi.getItemPath(context, {"name": UnitTest.DUMMY_NAME});
                if (itemPath) {
                    expect(itemPath).to.contain(UnitTest.DUMMY_NAME);
                    expect(itemPath).to.contain(extension);
                }

                // If path is the only input property and a path is returned, that path should contain the path property.
                itemPath = fsApi.getItemPath(context, {"path": UnitTest.DUMMY_PATH});
                if (itemPath) {
                    expect(itemPath).to.contain(UnitTest.DUMMY_PATH);
                    expect(itemPath).to.contain(extension);
                }

                done();
            });
        });
    }

    testHandleRename (fsApi, itemName1, itemName2) {
        const self = this;
        describe("handleRename", function() {
            it("should not delete old file if no original push file name", function (done) {
                self.handleRenameNoPushFileName(fsApi, itemName1, itemName2 , done);
            });

            it("should not delete old file if new file exists", function (done) {
                self.handleRenameNewFileExists(fsApi, itemName1, itemName2 , done);
            });

            it("should not delete old file if old file does not exist", function (done) {
                self.handleRenameNoOldFile(fsApi, itemName1, itemName2 , done);
            });

            it("should delete old file if all conditions met", function (done) {
                self.handleRenameDeleteOldFile(fsApi, itemName1, itemName2 , done);
            });
        });
    }

    handleRenameNoPushFileName (fsApi, itemName1, itemName2, done) {
        // Create a spy for fs.existsSync to verify that it was not called.
        const spy = sinon.spy(fs, "existsSync");

        // The spy should be restored when the test is complete.
        this.addTestDouble(spy);

        // Call the method being tested.
        let error;
        try {
            fsApi.handleRename(context, UnitTest.DUMMY_ID, UnitTest.DUMMY_NAME, {originalPushFileName: ""});

            expect(spy).to.not.have.been.called;
        } catch (err) {
            // This is not expected. Pass the error to the "done" function to indicate a failed test.
            error = err;
        } finally {
            // Call mocha's done function to indicate that the test is over.
            done(error);
        }
    }

    handleRenameNewFileExists (fsApi, itemName1, itemName2, done) {
        // Create a stub for fs.existsSync that will return true.
        const stub = sinon.stub(fs, "existsSync");
        stub.returns(true);

        // Create a spy for fs.unlinkSync to verify that it was not called.
        const spy = sinon.spy(fs, "unlinkSync");

        // The stub and spy should be restored when the test is complete.
        this.addTestDouble(stub);
        this.addTestDouble(spy);

        // Call the method being tested.
        let error;
        try {
            fsApi.handleRename(context, UnitTest.DUMMY_ID, UnitTest.DUMMY_NAME, {originalPushFileName: "foo"});

            expect(stub).to.have.been.calledOnce;
            expect(spy).to.not.have.been.called;
        } catch (err) {
            // This is not expected. Pass the error to the "done" function to indicate a failed test.
            error = err;
        } finally {
            // Call mocha's done function to indicate that the test is over.
            done(error);
        }
    }

    handleRenameNoOldFile (fsApi, itemName1, itemName2, done) {
        // Create a stub for fs.existsSync that will return false.
        const stub = sinon.stub(fs, "existsSync");
        stub.onFirstCall().returns(false);
        stub.onSecondCall().returns(false);

        // Create a spy for fs.unlinkSync to verify that it was not called.
        const spy = sinon.spy(fs, "unlinkSync");

        // The stub and spy should be restored when the test is complete.
        this.addTestDouble(stub);
        this.addTestDouble(spy);

        // Call the method being tested.
        let error;
        try {
            fsApi.handleRename(context, UnitTest.DUMMY_ID, UnitTest.DUMMY_NAME, {originalPushFileName: UnitTest.DUMMY_NAME});

            expect(stub).to.have.been.calledTwice;
            expect(spy).to.not.have.been.called;
        } catch (err) {
            // This is not expected. Pass the error to the "done" function to indicate a failed test.
            error = err;
        } finally {
            // Call mocha's done function to indicate that the test is over.
            done(error);
        }
    }

    handleRenameDeleteOldFile (fsApi, itemName1, itemName2, done) {
        // Create a stub for fs.existsSync that will return false for the new file and true for the old file.
        const stubExists = sinon.stub(fs, "existsSync");
        stubExists.onFirstCall().returns(false);
        stubExists.onSecondCall().returns(true);

        // Create a stub for fs.unlinkSync to do nothing.
        const stubUnlink = sinon.stub(fs, "unlinkSync");

        // The stubs should be restored when the test is complete.
        this.addTestDouble(stubExists);
        this.addTestDouble(stubUnlink);

        // Call the method being tested.
        let error;
        try {
            fsApi.handleRename(context, UnitTest.DUMMY_ID, UnitTest.DUMMY_NAME, {originalPushFileName: UnitTest.DUMMY_NAME});

            expect(stubExists).to.have.been.calledTwice;
            expect(stubUnlink).to.have.been.calledOnce;
        } catch (err) {
            // This is not expected. Pass the error to the "done" function to indicate a failed test.
            error = err;
        } finally {
            // Call mocha's done function to indicate that the test is over.
            done(error);
        }
    }

    testSaveItem (fsApi, itemName1, itemName2) {
        const self = this;
        describe("saveItem", function() {
            it("should fail when the filename is invalid", function (done) {
                self.saveItemBadFileName(fsApi, itemName1, itemName2 , done);
            });

            it("should fail when creating the new item directory fails", function (done) {
                self.saveItemDirectoryError(fsApi, itemName1, itemName2 , done);
            });

            it("should fail when saving the new item file fails", function (done) {
                self.saveItemFileError(fsApi, itemName1, itemName2 , done);
            });

            it("should succeed when the new item has a conflict", function (done) {
                self.saveItemConflict(fsApi, itemName1, itemName2 , done);
            });

            it("should succeed when saving the new item file succeeds", function (done) {
                self.saveItemSuccess(fsApi, itemName1, itemName2 , done);
            });
        });
    }

    saveItemBadFileName (fsApi, itemName1, itemName2, done) {
        // Call the method being tested.
        let error;
        const INVALID_NAME = "http://foo.com/bar";
        fsApi.saveItem(context, INVALID_NAME, UnitTest.DUMMY_OPTIONS)
            .then(function () {
                // This is not expected. Pass the error to the "done" function to indicate a failed test.
                error = new Error("The promise for the saved item should have been rejected.");
            })
            .catch (function (err) {
                try {
                    // Verify that the expected error is returned.
                    expect(err.name).to.equal("Error");
                    expect(err.message).to.contain(INVALID_NAME);
                } catch (err) {
                    error = err;
                }
            })
            .finally(function () {
                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
    }

    saveItemDirectoryError (fsApi, itemName1, itemName2, done) {
        // Create a stub for mkdirp.mkdirp to return an error.
        const DIR_ERROR = "Error creating the new item directory.";
        const stub = sinon.stub(mkdirp, "mkdirp");
        const err = new Error(DIR_ERROR);
        stub.yields(err);

        // The stub should be restored when the test is complete.
        this.addTestDouble(stub);

        // Call the method being tested.
        let error;
        fsApi.saveItem(context, UnitTest.DUMMY_NAME, UnitTest.DUMMY_OPTIONS)
            .then(function () {
                // This is not expected. Pass the error to the "done" function to indicate a failed test.
                error = new Error("The promise for the saved item should have been rejected.");
            })
            .catch (function (err) {
                try {
                    // Verify that the stub was called once.
                    expect(stub).to.have.been.calledOnce;

                    // Verify that the expected error is returned.
                    expect(err.name).to.equal("Error");
                    expect(err.message).to.equal(DIR_ERROR);
                } catch (err) {
                    error = err;
                }
            })
            .finally(function () {
                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
    }

    saveItemFileError (fsApi, itemName1, itemName2, done) {
        // Create a stub for mkdirp.mkdirp that just continues on without an error.
        const stubDir = sinon.stub(mkdirp, "mkdirp");
        stubDir.yields();

        // Create a stub for fs.writeFileSync to return an error.
        const ITEM_ERROR = "Error creating the new item file.";
        const stubFile = sinon.stub(fs, "writeFileSync");
        const err = new Error(ITEM_ERROR);
        stubFile.throws(err);

        // The stubs should be restored when the test is complete.
        this.addTestDouble(stubDir);
        this.addTestDouble(stubFile);

        // Call the method being tested.
        let error;
        fsApi.saveItem(context, UnitTest.DUMMY_NAME, UnitTest.DUMMY_OPTIONS)
            .then(function () {
                // This is not expected. Pass the error to the "done" function to indicate a failed test.
                error = new Error("The promise for the saved item should have been rejected.");
            })
            .catch (function (err) {
                try {
                    // Verify that each stub was called once.
                    expect(stubDir).to.have.been.calledOnce;
                    expect(stubFile).to.have.been.calledOnce;

                    // Verify that the expected error is returned.
                    expect(err.name).to.equal("Error");
                    expect(err.message).to.equal(ITEM_ERROR);
                } catch (err) {
                    error = err;
                }
            })
            .finally(function () {
                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
    }

    saveItemConflict (fsApi, itemName1, itemName2, done) {
        // Create a stub for mkdirp.mkdirp that just continues on without an error.
        const stubDir = sinon.stub(mkdirp, "mkdirp");
        stubDir.yields();

        // Create a stub for fs.writeFileSync that just continues on without an error.
        const stubFile = sinon.stub(fs, "writeFileSync");

        // Create a stub for hashes.updateHashes that just continues on without an error.
        const stubHashes = sinon.stub(hashes, "updateHashes");

        // The stubs should be restored when the test is complete.
        this.addTestDouble(stubDir);
        this.addTestDouble(stubFile);
        this.addTestDouble(stubHashes);

        // Call the method being tested.
        let error;
        fsApi.saveItem(context, {id: "test", name: itemName1}, {"conflict": true})
            .then(function (content) {
                // Verify that the stubs were each called as expected.
                expect(stubDir).to.have.been.calledOnce;
                expect(stubFile).to.have.been.calledOnce;
                expect(stubHashes).to.not.have.been.called;

                // Verify that the expected values are returned.
                expect(content.name).to.equal(itemName1);
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
    }

    saveItemSuccess (fsApi, itemName1, itemName2, done) {
        // Create a stub for mkdirp.mkdirp that just continues on without an error.
        const stubDir = sinon.stub(mkdirp, "mkdirp");
        stubDir.yields();

        // Create a stub for fs.writeFileSync that just continues on without an error.
        const stubFile = sinon.stub(fs, "writeFileSync");

        // Create a stub for hashes.updateHashes that just continues on without an error.
        const stubHashes = sinon.stub(hashes, "updateHashes");

        // The stubs should be restored when the test is complete.
        this.addTestDouble(stubDir);
        this.addTestDouble(stubFile);
        this.addTestDouble(stubHashes);

        // Call the method being tested.
        let error;
        fsApi.saveItem(context, itemName1, UnitTest.DUMMY_OPTIONS)
            .then(function (content) {
                // Verify that the stubs were each called once.
                expect(stubDir).to.have.been.calledOnce;
                expect(stubFile).to.have.been.calledOnce;
                expect(stubHashes).to.have.been.calledOnce;

                // Verify that the expected values are returned.
                expect(content).to.equal(itemName1);
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
    }

    testDeleteItem (fsApi) {
        const self = this;

        describe("deleteItem", function () {
            it("should succeed if the path does not exist", function (done) {
                // Create a stub for fs.existsSync to return false.
                const stub = sinon.stub(fs, "existsSync");
                stub.returns(false);

                // Create a spy for fs.unlink to verify that it was not called.
                const spy = sinon.spy(fs, "unlink");

                // The stub and spy  should be restored when the test is complete.
                self.addTestDouble(stub);
                self.addTestDouble(spy);

                // Call the method being tested.
                let error;
                fsApi.deleteItem(context, UnitTest.DUMMY_PATH, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // Verify that the stub was called once with the specified asset path.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.args[0][0]).to.contain(UnitTest.DUMMY_PATH);

                        // Verify that the unlink spy was not called.
                        expect(spy).to.not.have.been.called;
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail if deleting the file fails", function (done) {
                // Create a stub for fs.existsSync to return true.
                const stubExists = sinon.stub(fs, "existsSync");
                stubExists.returns(true);

                // Create a stub for fs.unlink to return an error.
                const DELETE_ERROR = "There was an error deleting the file, as expected by a unit test."
                const stubDelete = sinon.stub(fs, "unlink");
                stubDelete.yields(new Error(DELETE_ERROR));

                // The stub and spy  should be restored when the test is complete.
                self.addTestDouble(stubExists);
                self.addTestDouble(stubDelete);

                // Call the method being tested.
                let error;
                fsApi.deleteItem(context, UnitTest.DUMMY_PATH, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset item should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stubs were called once with the specified asset path.
                        expect(stubExists).to.have.been.calledOnce;
                        expect(stubExists.args[0][0]).to.contain(UnitTest.DUMMY_PATH);
                        expect(stubDelete).to.have.been.calledOnce;
                        expect(stubDelete.args[0][0]).to.contain(UnitTest.DUMMY_PATH);

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.equal(DELETE_ERROR);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed if deleting the file succeeds", function (done) {
                // Create a stub for fs.existsSync to return true.
                const stubExists = sinon.stub(fs, "existsSync");
                stubExists.returns(true);

                // Create a stub for fs.unlink to return success.
                const stubDelete = sinon.stub(fs, "unlink");
                stubDelete.yields(undefined);

                // The stub and spy  should be restored when the test is complete.
                self.addTestDouble(stubExists);
                self.addTestDouble(stubDelete);

                // Call the method being tested.
                let error;
                fsApi.deleteItem(context, UnitTest.DUMMY_PATH, UnitTest.DUMMY_OPTIONS)
                    .then(function (filepath) {
                        // The stubs should have been called once.
                        expect(stubExists).to.have.been.calledOnce;
                        expect(stubDelete).to.have.been.calledOnce;

                        // Verify that the expected file path was returned.
                        expect(filepath).to.contain(fsApi.getItemPath(context, UnitTest.DUMMY_PATH, UnitTest.DUMMY_OPTIONS));
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testListNames (fsApi, itemName1, itemName2) {
        const self = this;
        describe("listNames", function () {
            it("should fail when the path doesn't exist", function (done) {
                self.listNamesPathNotFound(fsApi, itemName1, itemName2 , done);
            });

            it("should fail when getting the item names fails", function (done) {
                self.listNamesReadError(fsApi, itemName1, itemName2 , done);
            });

            it("should succeed when getting item names", function (done) {
                self.listNamesSuccess(fsApi, itemName1, itemName2 , done);
            });
        });
    }

    listNamesPathNotFound (fsApi, itemName1, itemName2, done) {
        // Create a stub for fs.existsSync that will return false.
        const stubExists = sinon.stub(fs, "existsSync");
        stubExists.returns(false);

        // The stub should be restored when the test is complete.
        this.addTestDouble(stubExists);

        // Call the method being tested.
        let error;
        fsApi.listNames(context, UnitTest.DUMMY_OPTIONS)
            .then(function (paths) {
                // Verify that the stub was called once.
                expect(stubExists).to.have.been.calledOnce;

                // Verify that the expected values are returned.
                expect(paths).to.have.lengthOf(0);
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

    listNamesReadError (fsApi, itemName1, itemName2, done) {
        // Create a stub for fs.existsSync that will return true.
        const stubExists = sinon.stub(fs, "existsSync");
        stubExists.returns(true);
        // Create a stub for fs.readdir that will return an error.
        const stubReaddir = sinon.stub(fs, "readdir");
        const ITEM_ERROR = "Error reading the item.";
        const err = new Error(ITEM_ERROR);
        stubReaddir.yields(err);

        // The stub should be restored when the test is complete.
        this.addTestDouble(stubExists);
        this.addTestDouble(stubReaddir);

        // Call the method being tested.
        let error;
        fsApi.listNames(context, UnitTest.DUMMY_OPTIONS)
            .then(function (/*names*/) {
                // This is not expected. Pass the error to the "done" function to indicate a failed test.
                error = new Error("The promise for the item names should have been rejected.");
            })
            .catch (function (err) {
                try {
                    // Verify that the stub was called once.
                    expect(stubExists).to.have.been.calledOnce;
                    expect(stubReaddir).to.have.been.calledOnce;

                    // Verify that the expected error is returned.
                    expect(err.name).to.equal("Error");
                    expect(err.message).to.equal(ITEM_ERROR);
                } catch (err) {
                    error = err;
                }
            })
            .finally(function () {
                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
    }

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
            .then(function (paths) {
                // Verify that the get stub was called once with the lookup URI.
                expect(stub).to.have.been.calledOnce;

                // Verify that the expected values are returned.
                expect(paths).to.have.lengthOf(2);
                if (paths[0].path) {
                    expect(itemName1).to.contains(paths[0].path);
                } else {
                    expect(itemName1).to.contains(paths[0].id);
                }
                if (paths[1].path) {
                    expect(itemName2).to.contains(paths[1].path);
                } else {
                    expect(itemName2).to.contains(paths[1].id);
                }
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

    testGetItems (fsApi, itemName1, itemName2) {
        const self = this;
        describe("getItems", function () {
            it("should succeed when getting item names", function (done) {
                // Create a stub that will return a list of item names from listNames.
                const stubList = sinon.stub(fsApi, "listNames");
                stubList.resolves([itemName1, itemName2]);

                const stubGet = sinon.stub(fsApi, "getItem");
                const GET_ERROR = "There was an error getting the local item.";
                stubGet.onFirstCall().resolves(UnitTest.DUMMY_METADATA);
                stubGet.onSecondCall().rejects(GET_ERROR);

                self.addTestDouble(stubList);
                self.addTestDouble(stubGet);

                // Call the method being tested.
                let error;
                fsApi.getItems(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (items) {
                        // Verify that the list stub was called once and the get stub was called twice.
                        expect(stubList).to.have.been.calledOnce;
                        expect(stubGet).to.have.been.calledTwice;

                        // Verify that the expected number of items was returned.
                        expect(items).to.have.lengthOf(1);
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
            });

            it("should succeed when getting item names", function (done) {
                // Create a stub that will return a list of item names from listNames.
                const stubList = sinon.stub(fsApi, "listNames");
                stubList.resolves([itemName1, itemName2]);

                const stubGet = sinon.stub(fsApi, "getItem");
                stubGet.resolves(UnitTest.DUMMY_METADATA);

                self.addTestDouble(stubList);
                self.addTestDouble(stubGet);

                // Call the method being tested.
                let error;
                fsApi.getItems(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (items) {
                        // Verify that the list stub was called once and the get stub was called twice.
                        expect(stubList).to.have.been.calledOnce;
                        expect(stubGet).to.have.been.calledTwice;

                        // Verify that the expected number of items was returned.
                        expect(items).to.have.lengthOf(2);
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
            });
        });
    }
}

module.exports = BaseFsApiUnitTest;
