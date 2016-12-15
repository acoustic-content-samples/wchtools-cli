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
const options = require(UnitTest.AUTHORING_API_PATH + "lib/utils/options.js");

// Require the local modules that will be stubbed, mocked, and spied.
const mkdirp = require('mkdirp');

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


class BaseFsApiUnitTest extends UnitTest {
    constructor() {
        super();
    }

    run (fsApi, fsName,itemName1, itemName2) {
        const self = this;
        describe("Unit tests for FS " +fsName, function () {
            let stubSync;

            // Initialize common resources before running the unit tests.
            before(function (done) {
                // Create a stub for the mkdirp.sync() function, so that we don't create any directories.
                stubSync = sinon.stub(mkdirp, "sync");
                stubSync.returns(null);

                // Reset the state of the FS API.
                fsApi.reset();

                // Signal that the cleanup is complete.
                done();
            });

            // Cleanup common resourses consumed by each test.
            afterEach(function (done) {
                // Restore any stubs and spies used for the test.
                self.restoreTestDoubles();

                // Reset the state of the FS API.
                fsApi.reset();

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
            self.testSingleton(fsApi, fsName,itemName1, itemName2);
            self.testNewItem(fsApi, fsName,itemName1, itemName2);
            self.testGetItem(fsApi, fsName,itemName1, itemName2);
            self.testGetFileStats(fsApi, fsName,itemName1, itemName2);
            self.testGetPath(fsApi, fsName,itemName1, itemName2);
            self.testSaveItem(fsApi, fsName,itemName1, itemName2);
            self.testListNames(fsApi, fsName,itemName1, itemName2);
        });
    }

    testSingleton (fsApi, fsName,itemName1, itemName2) {
        describe("is a singleton", function () {
            it("should fail if try to create a fsAPI Type", function (done) {
                BaseFsApiUnitTest.singletonCreate(fsApi, fsName,itemName1, itemName2,done);
            });
        });
    }

    static singletonCreate (fsApi, fsName,itemName1, itemName2, done) {
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

    testNewItem (fsApi, fsName,itemName1, itemName2) {
        const self = this;
        describe("Test new item", function () {
            it("should fail if name doesn't exist", function(done) {
                self.newItemNameDoesNotExist(fsApi, fsName,itemName1, itemName2 , done);
            });
            it("should fail presentations if template isn't specified", function(done) {
                self.newItemTemplateNotSpecified(fsApi, fsName,itemName1, itemName2 , done);
            });
            it("should fail presentations if template doesn't exist", function(done) {
                self.newItemTemplateDoesNotExist(fsApi, fsName,itemName1, itemName2 , done);
            });
            it("should fail if save item fails", function(done) {
                self.newItemSaveError(fsApi, fsName,itemName1, itemName2 , done);
            });
            it("should pass if item saves", function(done) {
                self.newItemSuccess(fsApi, fsName,itemName1, itemName2 , done);
            });
        });
    }

    newItemNameDoesNotExist (fsApi, fsName,itemName1, itemName2, done) {
        let error;
        if (fsApi.newItem) {
            fsApi.newItem({})
                .then(function (/*item*/) {
                    // This is not expected. Pass the error to the "done" function to indicate a failed test.
                    error = new Error("The promise for the item should have been rejected.");
                })
                .catch(function (err) {
                    try {
                        // Verify that the expected error is returned.
                        expect(err.message).to.contain("Name");
                    } catch (err) {
                        error = err;
                    }
                })
                .finally(function () {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                });
        } else {
            // Call mocha's done function to indicate that the test is over.
            // noinspection JSUnusedAssignment
            done(error);
        }
    }

    newItemTemplateNotSpecified (fsApi, fsName,itemName1, itemName2, done) {
        let error;
        if (fsApi.newItem  && fsName === 'presentationsFS') {
            fsApi.newItem({name: 'foo'})
                .then(function (/*item*/) {
                    // This is not expected. Pass the error to the "done" function to indicate a failed test.
                    error = new Error("The promise for the item should have been rejected.");
                })
                .catch(function (err) {
                    try {
                        // Verify that the expected error is returned.
                        expect(err.message).to.contain("Template");
                    } catch (err) {
                        error = err;
                    }
                })
                .finally(function () {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                });
        } else {
            // Call mocha's done function to indicate that the test is over.
            // noinspection JSUnusedAssignment
            done(error);
        }
    }

    newItemTemplateDoesNotExist (fsApi, fsName,itemName1, itemName2, done) {
        let error;
        if (fsApi.newItem) {
            const stub = sinon.stub(fs, "stat");
            const err = null;

            stub.yields(err, DUMMY_STAT);
            this.addTestDouble(stub);
            fsApi.newItem({name: 'foo', template: 'bar'})
                .then(function (/*item*/) {
                    // This is not expected. Pass the error to the "done" function to indicate a failed test.
                    error = new Error("The promise for the item should have been rejected.");
                })
                .catch(function (err) {
                    try {
                        // Verify that the expected error is returned.
                        expect(err.message).to.contain("exists");
                    } catch (err) {
                        error = err;
                    }
                })
                .finally(function () {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                });
        }
        else {
            // Call mocha's done function to indicate that the test is over.
            // noinspection JSUnusedAssignment
            done(error);
        }
    }

    newItemSaveError (fsApi, fsName,itemName1, itemName2, done) {
        let error;
        if (fsApi.newItem) {
            const stub = sinon.stub(fsApi, "saveItem");
            stub.rejects(new Error('fail'));

            // The stub should be restored when the test is complete.
            this.addTestDouble(stub);

            fsApi.newItem({name: 'foo', template: 'bar'})
                .then(function (/*item*/) {
                    // This is not expected. Pass the error to the "done" function to indicate a failed test.
                    error = new Error("The promise for the item should have been rejected.");
                })
                .catch(function (err) {
                    try {
                        // Verify that the expected error is returned.
                        expect(err.message).to.contain("fail");
                    } catch (err) {
                        error = err;
                    }
                })
                .finally(function () {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                });
        }
        else {
            // Call mocha's done function to indicate that the test is over.
            // noinspection JSUnusedAssignment
            done(error);
        }
    }

    newItemSuccess (fsApi, fsName,itemName1, itemName2, done) {
        let error;
        if (fsApi.newItem) {
            const stub = sinon.stub(fsApi, "saveItem");
            stub.resolves({});

            // The stub should be restored when the test is complete.
            this.addTestDouble(stub);
            fsApi.newItem({name: 'foo', template: 'bar'})
                .then(function (item) {
                    expect(item).to.be.an.instanceof(Object);
                })
                .catch(function (err) {
                    error = err;
                })
                .finally(function () {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                });
        }
        else {
            // Call mocha's done function to indicate that the test is over.
            // noinspection JSUnusedAssignment
            done(error);
        }
    }

    testGetItem (fsApi, fsName,itemName1, itemName2) {
        const self = this;
        describe("getItem", function () {
            it("should fail when the item readfile emits an error event", function (done) {
                self.getItemErrorEvent(fsApi, fsName,itemName1, itemName2 , done);
            });
        });
    }

    getItemErrorEvent (fsApi, fsName,itemName1, itemName2, done) {
        // Create a stub for fs.readFile to return an error.
        const stub = sinon.stub(fs, "readFile");
        const ITEM_ERROR = "Error reading the item.";
        const err = new Error(ITEM_ERROR);
        stub.yields(err);

        // The stub should be restored when the test is complete.
        this.addTestDouble(stub);

        // Call the method being tested.
        let error;
        fsApi.getItem("foo", UnitTest.DUMMY_OPTIONS)
            .then(function () {
                // This is not expected. Pass the error to the "done" function to indicate a failed test.
                error = new Error("The promise for the item should have been rejected.");
            })
            .catch (function (err) {
                try {
                    // Verify that the stub was called once with the lookup URI.
                    expect(stub).to.have.been.calledOnce;
                    expect(stub.firstCall.args[0]).to.contain("foo");

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
    }

    testGetFileStats (fsApi, fsName,itemName1, itemName2) {
        const self = this;

        describe("getFileStats", function () {
            it("should fail when getting stats the fails with an error", function (done) {
                self.getFileStatsError(fsApi, fsName,itemName1, itemName2 , done);
            });

            it("should succeed when getting stats for a valid item", function (done) {
                self.getFileStatsSuccess(fsApi, fsName,itemName1, itemName2 , done);
            });
        });
    }

    getFileStatsError (fsApi, fsName,itemName1, itemName2, done) {
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
        fsApi.getFileStats(itemName1)
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

    getFileStatsSuccess (fsApi, fsName,itemName1, itemName2, done) {
        // Create a stub for fs.stat to return a stats object.
        const stub = sinon.stub(fs, "stat");
        const err = null;

        stub.yields(err, DUMMY_STAT);

        // The stub should be restored when the test is complete.
        this.addTestDouble(stub);

        // Call the method being tested.
        let error;
        fsApi.getFileStats(itemName1)
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

    testGetPath (fsApi, fsName,itemName1, itemName2) {
        const self = this;
        describe("getPath", function () {
            // Restore options before running the unit tests.
            before(function (done) {
                UnitTest.restoreOptions();

                // Signal that the cleanup is complete.
                done();
            });

            // Restore options after running the unit tests.
            after(function (done) {
                UnitTest.restoreOptions();

                // Signal that the cleanup is complete.
                done();
            });

            it("should succeed when setting a new working directory", function (done) {
                self.getPathSuccess(fsApi, fsName,itemName1, itemName2 , done);
            });
        });
    }

    getPathSuccess (fsApi, fsName,itemName1, itemName2, done) {
        // Create a stub for fs.existsSync to return true (so that no directories are created).
        const stub = sinon.stub(fs, "existsSync");
        stub.returns(true);

        // The stub should be restored when the test is complete.
        this.addTestDouble(stub);

        // Before setting the new working directory, the item path should not contain that directory.
        expect(fsApi.getItemPath(UnitTest.DUMMY_NAME)).to.not.contain(UnitTest.DUMMY_DIR);

        // Set the new working directory.
        options.setGlobalOptions({"workingDir": UnitTest.DUMMY_DIR});

        // After setting the new working directory, the item path should contain that directory.
        expect(fsApi.getItemPath(UnitTest.DUMMY_NAME)).to.contain(UnitTest.DUMMY_DIR);

        // Verify that the stub was called twice.
        expect(stub).to.have.been.calledTwice;

        done();
    }

    testSaveItem (fsApi, fsName,itemName1, itemName2) {
        const self = this;
        describe("pushItem", function() {
            it("should fail when creating the new item directory fails", function (done) {
                self.saveItemDirectoryError(fsApi, fsName,itemName1, itemName2 , done);
            });

            it("should fail when saving the new item file fails", function (done) {
                self.saveItemFileError(fsApi, fsName,itemName1, itemName2 , done);
            });

            it("should succeed when saving the new item file succeeds", function (done) {
                self.saveItemSuccess(fsApi, fsName,itemName1, itemName2 , done);
            });
        });
    }

    saveItemDirectoryError (fsApi, fsName,itemName1, itemName2, done) {
        // Create a stub for mkdirp.mkdirp to return an error.
        const DIR_ERROR = "Error creating the new item directory.";
        const stub = sinon.stub(mkdirp, "mkdirp");
        const err = new Error(DIR_ERROR);
        stub.yields(err);

        // The stub should be restored when the test is complete.
        this.addTestDouble(stub);

        // Call the method being tested.
        let error;
        fsApi.saveItem(UnitTest.DUMMY_NAME, UnitTest.DUMMY_OPTIONS)
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

    saveItemFileError (fsApi, fsName,itemName1, itemName2, done) {
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
        fsApi.saveItem(UnitTest.DUMMY_NAME, UnitTest.DUMMY_OPTIONS)
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

    saveItemSuccess (fsApi, fsName,itemName1, itemName2, done) {
        // Create a stub for mkdirp.mkdirp that just continues on without an error.
        const stubDir = sinon.stub(mkdirp, "mkdirp");
        stubDir.yields();

        // Create a stub for fs.writeFileSync that just continues on without an error.
        const stubFile = sinon.stub(fs, "writeFileSync");

        // The stubs should be restored when the test is complete.
        this.addTestDouble(stubDir);
        this.addTestDouble(stubFile);

        // Call the method being tested.
        let error;
        fsApi.saveItem(itemName1, UnitTest.DUMMY_OPTIONS)
            .then(function (content) {
                // Verify that the stubs were each called once.
                expect(stubDir).to.have.been.calledOnce;
                expect(stubFile).to.have.been.calledOnce;

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

    testListNames (fsApi, fsName,itemName1, itemName2) {
        const self = this;
        describe("listNames", function () {
            it("should fail when getting the item names fails", function (done) {
                self.listNamesReadError(fsApi, fsName,itemName1, itemName2 , done);
            });

            it("should succeed when getting item names", function (done) {
                self.listNamesSuccess(fsApi, fsName,itemName1, itemName2 , done);
            });
        });
    }

    listNamesReadError (fsApi, fsName,itemName1, itemName2, done) {
        // Create a stub for fs.readdir that will return an error.
        const stub = sinon.stub(fs, "readdir");
        const ITEM_ERROR = "Error reading the item.";
        const err = new Error(ITEM_ERROR);
        stub.yields(err);

        // The stub should be restored when the test is complete.
        this.addTestDouble(stub);

        // Call the method being tested.
        let error;
        fsApi.listNames(UnitTest.DUMMY_OPTIONS)
            .then(function (/*names*/) {
                // This is not expected. Pass the error to the "done" function to indicate a failed test.
                error = new Error("The promise for the item names should have been rejected.");
            })
            .catch (function (err) {
                try {
                    // Verify that the stub was called once.
                    expect(stub).to.have.been.calledOnce;

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

    listNamesSuccess (fsApi, fsName,itemName1, itemName2, done) {
        // Set the current working directory to the "valid resources" directory.
        options.setGlobalOptions({"workingDir":UnitTest.AUTHORING_API_PATH + UnitTest.VALID_RESOURCES_DIRECTORY});

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
        fsApi.listNames(UnitTest.DUMMY_OPTIONS)
            .then(function (paths) {
                // Verify that the get stub was called once with the lookup URI.
                expect(stub).to.have.been.calledOnce;

                // Verify that the expected values are returned.
                expect(paths).to.have.lengthOf(2);
                expect(itemName1).to.contains(paths[0]);
                expect(itemName2).to.contains(paths[1]);
            })
            .catch (function (err) {
                // NOTE: A failed expectation from above will be handled here.
                // Pass the error to the "done" function to indicate a failed test.
                error = err;
            })
            .finally(function () {
                // noinspection JSUnresolvedFunction
                // Restore the default options.
                UnitTest.restoreOptions();

                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
    }
}

module.exports = BaseFsApiUnitTest;
