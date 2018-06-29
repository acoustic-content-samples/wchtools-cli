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
 * Unit tests for the assetsFS object.
 */
"use strict";

// Require the super classes for this class.
const UnitTest = require("./base.unit.js");
const AssetsUnitTest = require("./assets.unit.js");

// Require the node modules used in this test file.
const stream = require("stream");
const diff = require("diff");
const path = require("path");
const ignore = require('ignore');
const requireSubvert = require('require-subvert')(__dirname);
const sinon = require("sinon");

// Require the local modules that will be stubbed, mocked, and spied.
const fs = require("fs");
const mkdirp = require('mkdirp');

// Require the local module being tested.
const AssetsFS = require(UnitTest.API_PATH + "lib/assetsFS.js");
let assetsFS = AssetsFS.instance;

// The default API context used for unit tests.
const context = UnitTest.DEFAULT_API_CONTEXT;

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

let stubSync;

class AssetsFsUnitTest extends AssetsUnitTest {
    constructor() {
        super();
    }

    run () {
        const self = this;

        describe("Unit tests for assets FS", function () {
            // Initialize common resourses before running the unit tests.
            before(function (done) {
                // Create stub for mkdirp.sync so that we don't create any directories.
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
                // Restore any stubs and spies used for the test suite.
                stubSync.restore();

                // Signal that the cleanup is complete.
                done();
            });

            // Run each of the tests defined in this class.
            self.testSingleton();
            self.testGetDir();
            self.testGetContentResourceDir();
            self.testGetAssetPath();
            self.testGetPath();
            self.testGetResourcePath();
            self.testGetRawResourcePath();
            self.testRenameResource();
            self.testGetItem();
            self.testSaveItem();
            self.testDeleteAsset();
            self.testDeleteMetadata();
            self.testDeleteResource();
            self.testGetItemReadStream();
            self.testGetResourceReadStream();
            self.testGetItemWriteStream();
            self.testListNames();
            self.testListResourceNames();
            self.testGetFileStats();
            self.testGetResourceFileStats();
            self.testGetContentLength();
            self.testGetResourceContentLength();
        });
    }

    testSingleton () {
        describe("Constructor", function () {
            it("should fail if try to construct an assetsREST directly", function (done) {
                let error;
                try {
                    const api = new AssetsFS();
                    if (api) {
                        error = "The constructor should have failed.";
                    } else {
                        error = "The constructor should have thrown an error.";
                    }
                } catch (e) {
                    expect(e).to.equal("An instance of singleton class " + assetsFS.constructor.name + " cannot be constructed");
                }

                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
        });
    }

    testGetDir () {
        const self = this;

        describe("getDir", function () {
            it("should create the directory if it doesn't exist", function (done) {
                // Create a stub for the fs.existsSync function.
                const stub = sinon.stub(fs, "existsSync");
                stub.returns(false);
                self.addTestDouble(stub);

                // Get the current call count of the mkdirp stub.
                const count = stubSync.callCount;

                let error;
                try {
                    // Call the method being tested and verify that mkdirp was called.
                    assetsFS.getDir(context);
                    expect(stubSync.callCount).equal(count + 1);
                } catch (err) {
                    error = err;
                } finally {
                    done(error);
                }
            });

            it("should not create the directory if it already exists", function (done) {
                // Create a stub for the fs.existsSync function.
                const stub = sinon.stub(fs, "existsSync");
                stub.returns(true);
                self.addTestDouble(stub);

                // Get the current call count of the mkdirp stub.
                const count = stubSync.callCount;

                let error;
                try {
                    // Call the method being tested and verify that mkdirp was called.
                    assetsFS.getDir(context);
                    expect(stubSync.callCount).equal(count);
                } catch (err) {
                    error = err;
                } finally {
                    done(error);
                }
            });
        });
    }

    testGetContentResourceDir () {
        const self = this;

        describe("getContentResourceDir", function () {
            it("should create the directory if it doesn't exist", function (done) {
                // Create a stub for the fs.existsSync function.
                const stub = sinon.stub(fs, "existsSync");
                stub.returns(false);
                self.addTestDouble(stub);

                // Get the current call count of the mkdirp stub.
                const count = stubSync.callCount;

                let error;
                try {
                    // Call the method being tested and verify that mkdirp was called.
                    assetsFS.getContentResourceDir(context);
                    expect(stubSync.callCount).equal(count + 1);
                } catch (err) {
                    error = err;
                } finally {
                    done(error);
                }
            });

            it("should not create the directory if it already exists", function (done) {
                // Create a stub for the fs.existsSync function.
                const stub = sinon.stub(fs, "existsSync");
                stub.returns(true);
                self.addTestDouble(stub);

                // Get the current call count of the mkdirp stub.
                const count = stubSync.callCount;

                let error;
                try {
                    // Call the method being tested and verify that mkdirp was called.
                    assetsFS.getContentResourceDir(context);
                    expect(stubSync.callCount).equal(count);
                } catch (err) {
                    error = err;
                } finally {
                    done(error);
                }
            });
        });
    }

    testGetAssetPath () {
        describe("getAssetPath", function () {
            it("should not append the draft suffix if the asset is not a draft", function (done) {
                let error;
                try {
                    // Call the method being tested and verify the result.
                    const path = assetsFS.getAssetPath({path: "a"});
                    expect(path).to.equal("a");
                } catch (err) {
                    error = err;
                } finally {
                    done(error);
                }
            });

            it("should append the draft suffix", function (done) {
                let error;
                try {
                    // Call the method being tested and verify the result.
                    const path = assetsFS.getAssetPath({path: "a", status: "draft"});
                    expect(path).to.equal("a_wchdraft");
                } catch (err) {
                    error = err;
                } finally {
                    done(error);
                }
            });

            it("should insert the draft suffix", function (done) {
                let error;
                try {
                    // Call the method being tested and verify the result.
                    const path = assetsFS.getAssetPath({path: "a.b", status: "draft"});
                    expect(path).to.equal("a_wchdraft.b");
                } catch (err) {
                    error = err;
                } finally {
                    done(error);
                }
            });

            it("should append the draft and project suffix", function (done) {
                let error;
                try {
                    // Call the method being tested and verify the result.
                    const path = assetsFS.getAssetPath({path: "a", status: "draft", projectId: "foo"});
                    expect(path).to.equal("a_wchdraft_foo");
                } catch (err) {
                    error = err;
                } finally {
                    done(error);
                }
            });

            it("should insert the draft and project suffix", function (done) {
                let error;
                try {
                    // Call the method being tested and verify the result.
                    const path = assetsFS.getAssetPath({path: "a.b", status: "draft", projectId: "foo"});
                    expect(path).to.equal("a_wchdraft_foo.b");
                } catch (err) {
                    error = err;
                } finally {
                    done(error);
                }
            });
        });
    }

    testGetPath () {
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
                const folderName = assetsFS.getFolderName(context);
                let path = assetsFS.getPath(context);

                // Before setting the new working directory, the asset path should not contain that directory.
                expect(path).to.not.contain(UnitTest.DUMMY_DIR);
                expect(path).to.contain(folderName);

                // If the working dir is set in the opts object, then the item path should contain that directory.
                path = assetsFS.getPath(context, {"workingDir": UnitTest.DUMMY_DIR});
                expect(path).to.contain(UnitTest.DUMMY_DIR);
                expect(path).to.contain(folderName);

                // If the working dir is set in the opts object, then the item path should contain that directory.
                path = assetsFS.getPath(context, {"noVirtualFolder": true});
                expect(path).to.not.contain(folderName);

                done();
            });
        });
    }

    testGetResourcePath () {
        describe("getResourcePath", function () {
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
                // Before setting the new working directory, the resource path should not contain that directory.
                let path = assetsFS.getResourcePath(context, UnitTest.DUMMY_NAME);
                expect(path).to.contain(assetsFS.getResourcesPath(context));
                expect(path).to.not.contain(UnitTest.DUMMY_DIR);
                expect(path).to.contain(UnitTest.DUMMY_NAME);

                // If the working dir is set in the opts object, then the resource path should contain that directory.
                path = assetsFS.getResourcePath(context, UnitTest.DUMMY_NAME, {"workingDir": UnitTest.DUMMY_DIR});
                expect(path).to.contain(assetsFS.getResourcesPath(context, {"workingDir": UnitTest.DUMMY_DIR}));
                expect(path).to.contain(UnitTest.DUMMY_DIR);
                expect(path).to.contain(UnitTest.DUMMY_NAME);

                // Make sure "noVirtualFolder" has no effect, since resources cannot be pushed or pulled explicitly.
                path = assetsFS.getResourcePath(context, UnitTest.DUMMY_NAME, {"noVirtualFolder": true});
                expect(path).to.contain(assetsFS.getResourcesPath(context), {"noVirtualFolder": true});
                expect(path).to.contain(UnitTest.DUMMY_NAME);

                done();
            });
        });
    }

    testGetRawResourcePath () {
        describe("getRawResourcePath", function () {
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

            it("should succeed whether setting a new working directory or not", function (done) {
                // Before setting the new working directory, the raw resource path should not contain that directory.
                let path = assetsFS.getRawResourcePath(context, UnitTest.DUMMY_ID, UnitTest.DUMMY_NAME);
                expect(path).to.contain(assetsFS.getResourcesPath(context));
                expect(path).to.not.contain(UnitTest.DUMMY_DIR);
                expect(path).to.contain(UnitTest.DUMMY_ID);
                expect(path).to.contain(UnitTest.DUMMY_NAME);

                // If the working dir is set in the opts object, then the raw resource path should contain that directory.
                path = assetsFS.getRawResourcePath(context, UnitTest.DUMMY_ID, UnitTest.DUMMY_NAME, {"workingDir": UnitTest.DUMMY_DIR});
                expect(path).to.contain(assetsFS.getResourcesPath(context, {"workingDir": UnitTest.DUMMY_DIR}));
                expect(path).to.contain(UnitTest.DUMMY_DIR);
                expect(path).to.contain(UnitTest.DUMMY_ID);
                expect(path).to.contain(UnitTest.DUMMY_NAME);

                done();
            });
        });
    }

    testRenameResource () {
        const self = this;

        describe("renameResource", function () {
            it("should create the new resource folder and rename the file", function (done) {
                // Create a stub for fs.renameSync so that the file is not actually renamed.
                const stubRename = sinon.stub(fs, "renameSync");

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubRename);

                let error;
                try {
                    // Call the method being tested.
                    assetsFS.renameResource(context, UnitTest.DUMMY_ID, UnitTest.DUMMY_NAME, {"workingDir": UnitTest.DUMMY_DIR});

                    // Verify that mkdirp was called with the expected value.
                    const resourcesPath = assetsFS.getResourcesPath(context, {"workingDir": UnitTest.DUMMY_DIR});
                    expect(stubSync.lastCall.args[0]).to.contain(resourcesPath);
                    expect(stubSync.lastCall.args[0]).to.contain(UnitTest.DUMMY_ID);

                    // Verify that rename was called with the expected value.
                    expect(stubRename.args[0][0]).to.contain(resourcesPath);
                    expect(stubRename.args[0][0]).to.contain(UnitTest.DUMMY_ID);
                    expect(stubRename.args[0][1]).to.contain(resourcesPath);
                    expect(stubRename.args[0][1]).to.contain(UnitTest.DUMMY_ID);
                    expect(stubRename.args[0][1]).to.contain(UnitTest.DUMMY_NAME);
                } catch (err) {
                    error = err;
                } finally {
                    done(error);
                }
            });
        });
    }

    testGetItem () {
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
                assetsFS.getItem(context, AssetsUnitTest.ASSET_CSS_1, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset item should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once with the specified asset path.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[0]).to.contain(AssetsUnitTest.ASSET_CSS_1);

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

            it("should fail if parsing the file contents fails", function (done) {
                // Create a stub for fs.readFile to return an invalid JSON string.
                const stub = sinon.stub(fs, "readFile");
                stub.yields(null, '{"json": "no-closing-curly-bracket"');

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsFS.getItem(context, AssetsUnitTest.ASSET_CSS_1, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset item should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once with the specified asset path.
                            expect(stub).to.have.been.calledOnce;
                            expect(stub.firstCall.args[0]).to.contain(AssetsUnitTest.ASSET_CSS_1);

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

            it("should fail if parsing the file throws an error", function (done) {
                // Create a stub for fs.readFile to return a valid JSON string.
                const stubRead = sinon.stub(fs, "readFile");
                stubRead.yields(null, '{"json": "closing-curly-bracket"}');

                // Create a stub for JSON.parse to return a valid JSON string.
                const JSON_ERROR = "JSON parse error - expected by unit test.";
                const stubParse = sinon.stub(JSON, "parse");
                stubParse.throws(new Error(JSON_ERROR));

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubRead);
                self.addTestDouble(stubParse);

                // Call the method being tested.
                let error;
                assetsFS.getItem(context, AssetsUnitTest.ASSET_CSS_1, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset item should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stubs were called once with the expected values.
                        expect(stubRead).to.have.been.calledOnce;
                        expect(stubRead.firstCall.args[0]).to.contain(AssetsUnitTest.ASSET_CSS_1);
                        expect(stubParse).to.have.been.calledOnce;

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.contain(JSON_ERROR);
                    })
                    .catch(function (err) {
                        error = err;
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
                assetsFS.getItem(context, AssetsUnitTest.ASSET_CSS_1, UnitTest.DUMMY_OPTIONS)
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
        });
    }

    testSaveItem () {
        const self = this;

        describe("saveItem", function () {
            it("should fail if creating the directory fails", function (done) {
                // Create a stub for mkdirp.mkdirp to return an error.
                const ASSET_ERROR = "Error creating the directory.";
                const stub = sinon.stub(mkdirp, "mkdirp");
                stub.yields(new Error(ASSET_ERROR));

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsFS.saveItem(context, UnitTest.DUMMY_METADATA, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for saving the asset item should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once with the specified asset path.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.args[0][0]).to.contain(assetsFS.getFolderName(context));

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

            it("should fail if writing the file contents fails", function (done) {
                // Create a stub for mkdirp.mkdirp to return without creating the directory.
                const stubDir = sinon.stub(mkdirp, "mkdirp");
                stubDir.yields();

                // Create a stub for fs.writeFileSync to return an error.
                const ASSET_ERROR = "Error writing the file contents.";
                const stub = sinon.stub(fs, "writeFileSync");
                stub.throws(new Error(ASSET_ERROR));

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubDir);
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsFS.saveItem(context, UnitTest.DUMMY_METADATA, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset item should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stubs were called once with the specified asset path.
                            expect(stubDir).to.have.been.calledOnce;
                            expect(stubDir.args[0][0]).to.contain(assetsFS.getFolderName(context));
                            expect(stub).to.have.been.calledOnce;
                            expect(stub.args[0][0]).to.contain(UnitTest.DUMMY_METADATA.path);

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.equal(ASSET_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed if writing the file contents succeeds", function (done) {
                // Create a stub for mkdirp.mkdirp to return without creating the directory.
                const stubDir = sinon.stub(mkdirp, "mkdirp");
                stubDir.yields();

                // Create a stub for fs.writeFileSync.
                const stub = sinon.stub(fs, "writeFileSync");

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubDir);
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsFS.saveItem(context, UnitTest.DUMMY_METADATA, UnitTest.DUMMY_OPTIONS)
                    .then(function (item) {
                        // The stubs should have been called once.
                        expect(stubDir).to.have.been.calledOnce;
                        expect(stub).to.have.been.calledOnce;

                        // Verify that the expected item was returned.
                        expect(item.id).to.equal(UnitTest.DUMMY_METADATA.id);
                        expect(item.path).to.equal(UnitTest.DUMMY_METADATA.path);
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

    testDeleteAsset () {
        const self = this;

        describe("deleteAsset", function () {
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
                assetsFS.deleteAsset(context, UnitTest.DUMMY_PATH, UnitTest.DUMMY_OPTIONS)
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
                assetsFS.deleteAsset(context, UnitTest.DUMMY_PATH, UnitTest.DUMMY_OPTIONS)
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
                assetsFS.deleteAsset(context, UnitTest.DUMMY_PATH, UnitTest.DUMMY_OPTIONS)
                    .then(function (filepath) {
                        // The stubs should have been called once.
                        expect(stubExists).to.have.been.calledOnce;
                        expect(stubDelete).to.have.been.calledOnce;

                        // Verify that the expected file path was returned.
                        expect(filepath).to.contain(assetsFS.getAssetsPath(context, UnitTest.DUMMY_OPTIONS));
                        expect(filepath).to.contain(UnitTest.DUMMY_PATH);
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

    testDeleteMetadata () {
        const self = this;

        describe("deleteMetadata", function () {
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
                assetsFS.deleteMetadata(context, UnitTest.DUMMY_PATH, UnitTest.DUMMY_OPTIONS)
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
                assetsFS.deleteMetadata(context, UnitTest.DUMMY_PATH, UnitTest.DUMMY_OPTIONS)
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
                assetsFS.deleteMetadata(context, UnitTest.DUMMY_PATH, UnitTest.DUMMY_OPTIONS)
                    .then(function (filepath) {
                        // The stubs should have been called once.
                        expect(stubExists).to.have.been.calledOnce;
                        expect(stubDelete).to.have.been.calledOnce;

                        // Verify that the expected file path was returned.
                        expect(filepath).to.contain(assetsFS.getMetadataPath(context, UnitTest.DUMMY_PATH, UnitTest.DUMMY_OPTIONS));
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

    testDeleteResource () {
        const self = this;

        describe("deleteResource", function () {
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
                assetsFS.deleteResource(context, UnitTest.DUMMY_PATH, UnitTest.DUMMY_OPTIONS)
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
                assetsFS.deleteResource(context, UnitTest.DUMMY_PATH, UnitTest.DUMMY_OPTIONS)
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
                assetsFS.deleteResource(context, UnitTest.DUMMY_PATH, UnitTest.DUMMY_OPTIONS)
                    .then(function (filepath) {
                        // The stubs should have been called once.
                        expect(stubExists).to.have.been.calledOnce;
                        expect(stubDelete).to.have.been.calledOnce;

                        // Verify that the expected file path was returned.
                        expect(filepath).to.contain(assetsFS.getResourcePath(context, UnitTest.DUMMY_PATH, UnitTest.DUMMY_OPTIONS));
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

    testGetItemReadStream () {
        const self = this;

        describe("getItemReadStream", function () {
            it("should fail when creating the asset stream fails", function (done) {
                // Create a stub for fs.createReadStream to return a stream.
                const ASSET_ERROR = "Error creating the asset read stream.";
                const stub = sinon.stub(fs, "createReadStream");
                stub.throws(new Error(ASSET_ERROR));

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsFS.getItemReadStream(context, AssetsUnitTest.ASSET_CSS_1, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset stream should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once with the specified asset path.
                            expect(stub).to.have.been.calledOnce;
                            expect(stub.firstCall.args[0]).to.contain(AssetsUnitTest.ASSET_CSS_1);

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.equal(ASSET_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when getting the stream for a valid asset", function (done) {
                // Create a stub for fs.createReadStream to return a stream.
                const stub = sinon.stub(fs, "createReadStream");
                const assetStream = new stream.Readable();
                const ASSET_CONTENT = "Contents of the asset file.";
                assetStream.push(ASSET_CONTENT);
                assetStream.push(null);
                stub.returns(assetStream);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsFS.getItemReadStream(context, AssetsUnitTest.ASSET_CSS_1, UnitTest.DUMMY_OPTIONS)
                    .then(function (stream) {
                        // Verify that the stub was called once with the specified path.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.args[0][0]).to.contain(AssetsUnitTest.ASSET_CSS_1);

                        // Verify that the FS API returned the expected stream.
                        stream.setEncoding("utf-8");
                        const content = stream.read(1024);
                        expect(content).to.equal(ASSET_CONTENT);
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

    testGetResourceReadStream () {
        const self = this;

        describe("getResourceReadStream", function () {
            it("should fail when creating the resource stream fails", function (done) {
                // Create a stub for fs.createReadStream to return an error.
                const RESOURCE_ERROR = "Error creating the resource read stream.";
                const stub = sinon.stub(fs, "createReadStream");
                stub.throws(new Error(RESOURCE_ERROR));

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsFS.getResourceReadStream(context, AssetsUnitTest.ASSET_CSS_1, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the resource stream should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once with the specified resource path.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[0]).to.contain(AssetsUnitTest.ASSET_CSS_1);

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.equal(RESOURCE_ERROR);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when getting the stream for a valid resource", function (done) {
                // Create a stub for fs.createReadStream to return a stream.
                const stub = sinon.stub(fs, "createReadStream");
                const resourceStream = new stream.Readable();
                const RESOURCE_CONTENT = "Contents of the resource file.";
                resourceStream.push(RESOURCE_CONTENT);
                resourceStream.push(null);
                stub.returns(resourceStream);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsFS.getResourceReadStream(context, AssetsUnitTest.ASSET_CSS_1, UnitTest.DUMMY_OPTIONS)
                    .then(function (stream) {
                        // Verify that the stub was called once with the specified path.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.args[0][0]).to.contain(AssetsUnitTest.ASSET_CSS_1);

                        // Verify that the FS API returned the expected stream.
                        stream.setEncoding("utf-8");
                        const content = stream.read(1024);
                        expect(content).to.equal(RESOURCE_CONTENT);
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

    testGetItemWriteStream () {
        const self = this;
        describe("getItemWriteStream", function () {
            it("should fail when creating the new asset directory fails", function (done) {
                self.getItemWriteStreamCreateDirectoryError(done);
            });

            it("should fail when creating the asset stream fails", function (done) {
                self.getItemWriteStreamCreateStreamError(done);
            });

            it("should succeed when getting the stream for a valid asset", function (done) {
                self.getItemWriteStreamSuccess(done);
            });
        });
    }

    getItemWriteStreamCreateDirectoryError (done) {
        // Create a stub for mkdirp.mkdirp to return an error.
        const DIR_ERROR = "Error creating the new asset directory.";
        const stub = sinon.stub(mkdirp, "mkdirp");
        const err = new Error(DIR_ERROR);
        stub.yields(err);

        // The stub should be restored when the test is complete.
        this.addTestDouble(stub);

        // Call the method being tested.
        let error;
        assetsFS.getItemWriteStream(context, UnitTest.DUMMY_NAME, UnitTest.DUMMY_OPTIONS)
            .then(function () {
                // This is not expected. Pass the error to the "done" function to indicate a failed test.
                error = new Error("The promise for the asset stream should have been rejected.");
            })
            .catch(function (err) {
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

    getItemWriteStreamCreateStreamError (done) {
        // Create a stub for mkdirp.mkdirp that just continues on without an error.
        const stubDir = sinon.stub(mkdirp, "mkdirp");
        stubDir.yields();

        // Create a stub for fs.createWriteStream to return an error.
        const ASSET_ERROR = "Error creating the new asset stream.";
        const stubFile = sinon.stub(fs, "createWriteStream");
        const err = new Error(ASSET_ERROR);
        stubFile.throws(err);

        // The stubs should be restored when the test is complete.
        this.addTestDouble(stubDir);
        this.addTestDouble(stubFile);

        // Call the method being tested.
        let error;
        assetsFS.getItemWriteStream(context, AssetsUnitTest.ASSET_GIF_1, UnitTest.DUMMY_OPTIONS)
            .then(function () {
                // This is not expected. Pass the error to the "done" function to indicate a failed test.
                error = new Error("The promise for the asset stream should have been rejected.");
            })
            .catch(function (err) {
                try {
                    // Verify that each stub was called once.
                    expect(stubDir).to.have.been.calledOnce;
                    expect(stubFile).to.have.been.calledOnce;

                    // Verify that the file stub was called with the expected values.
                    expect(stubFile.args[0][0]).to.contain(AssetsUnitTest.ASSET_GIF_1);

                    // Verify that the expected error is returned.
                    expect(err.name).to.equal("Error");
                    expect(err.message).to.equal(ASSET_ERROR);
                } catch (err) {
                    error = err;
                }
            })
            .finally(function () {
                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
    }

    getItemWriteStreamSuccess (done) {
        // Create a stub for mkdirp.mkdirp that just continues on without an error.
        const stubDir = sinon.stub(mkdirp, "mkdirp");
        stubDir.yields();

        // Create a stub for fs.createWriteStream that returns a passthrough stream.
        const stubFile = sinon.stub(fs, "createWriteStream");
        const fileStream = new stream.Writable();
        stubFile.returns(fileStream);

        // The stubs should be restored when the test is complete.
        this.addTestDouble(stubDir);
        this.addTestDouble(stubFile);

        // Call the method being tested.
        let error;
        assetsFS.getItemWriteStream(context, AssetsUnitTest.ASSET_CSS_1, UnitTest.DUMMY_OPTIONS)
            .then(function (stream) {
                // Verify that each stub was called once with the specified path.
                expect(stubDir).to.have.been.calledOnce;
                expect(stubFile).to.have.been.calledOnce;
                expect(stubFile.args[0][0]).to.contain(AssetsUnitTest.ASSET_CSS_1);

                // Verify that the expected stream was returned.
                expect(stream.write).to.be.ok;
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
    }

    testListNames () {
        const self = this;
        describe("listNames", function () {
            it("should succeed when the assets folder doesn't exist", function (done) {
                self.listNamesNoFolder(done);
            });

            it("should fail when getting the asset names fails", function (done) {
                self.listNamesError(done);
            });

            it("should fail when reading an asset file fails", function (done) {
                self.listNamesReadError(done);
            });

            it("should succeed when getting asset names", function (done) {
                self.listNamesSuccess(done);
            });

            it("should succeed when getting asset names with additional properties", function (done) {
                self.listNamesAdditionalPropertiesSuccess(done);
            });

            it("should succeed when getting filtered web asset names", function (done) {
                self.listNamesFilterWebAssetsSuccess(done);
            });

            it("should succeed when getting filtered content asset names", function (done) {
                self.listNamesFilterContentAssetsSuccess(done);
            });

            it("should succeed when using a filter path", function (done) {
                self.listNamesFilterPathSuccess(done);
            });

            it("should succeed when using a different filter path", function (done) {
                self.listNamesDifferentFilterPathSuccess(done);
            });

            it("should succeed when getting web asset names using the default filter as additive", function (done) {
                self.listNamesDefaultFilterAdditiveSuccess(done);
            });

            it("should succeed when getting web asset names using the default filter not additive", function (done) {
                self.listNamesDefaultFilterNotAdditiveSuccess(done);
            });

            it("should succeed when getting web asset names using the assets filter as additive", function (done) {
                self.listNamesAssetsFilterAdditiveSuccess(done);
            });

            it("should succeed when getting web asset names using the assets filter not additive", function (done) {
                self.listNamesAssetsFilterNotAdditiveSuccess(done);
            });

            it("should succeed when getting web asset names using the assets filter default additive", function (done) {
                self.listNamesAssetsFilterAdditiveDefaultSuccess(done);
            });
        });
    }

    listNamesNoFolder (done) {
        // Create a stub for fs.existsSync that will return false.
        const stubExists = sinon.stub(fs, "existsSync");
        stubExists.returns(false);

        this.addTestDouble(stubExists);

        // Call the method being tested.
        let error;
        assetsFS.listNames(context, null, UnitTest.DUMMY_OPTIONS)
            .then(function (paths) {
                // Verify that the stub was called once.
                expect(stubExists).to.have.been.calledOnce;

                // Verify that the expected values are returned.
                expect(paths).to.have.lengthOf(0);
            })
            .catch(function (err) {
                error = err;
            })
            .finally(function () {
                // Reload assetsFS, so that it gets the original version of recursive.
                assetsFS = require(UnitTest.API_PATH + "lib/assetsFS.js").instance;

                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
    }

    listNamesError (done) {
        const opts = UnitTest.DUMMY_OPTIONS;

        // Create a stub for fs.existsSync that will return true.
        const stubExists = sinon.stub(fs, "existsSync");
        stubExists.withArgs(assetsFS.getAssetsPath(context, opts)).returns(true);

        this.addTestDouble(stubExists);

        // Create a stub that will return an error from the recursive function.
        const ASSETS_ERROR = "Error getting the asset names.";
        const stubReaddir = sinon.stub();
        const err = new Error(ASSETS_ERROR);
        const files = null;
        stubReaddir.yields(err, files);

        // Subvert the "recursive-readdir" module with the specified stub.
        // noinspection JSUnresolvedFunction
        requireSubvert.subvert("recursive-readdir", stubReaddir);

        // Reload assetsFS, so that it gets the subverted version of the recursive function.
        // noinspection JSUnresolvedFunction
        assetsFS = requireSubvert.require(UnitTest.API_PATH + "lib/assetsFS.js").instance;

        // Call the method being tested.
        let error;
        assetsFS.listNames(context, null, opts)
            .then(function () {
                // This is not expected. Pass the error to the "done" function to indicate a failed test.
                error = new Error("The promise for the asset names should have been rejected.");
            })
            .catch(function (err) {
                try {
                    // Verify that the stub was called once.
                    expect(stubReaddir).to.have.been.calledOnce;

                    // Verify that the expected error is returned.
                    expect(err.name).to.equal("Error");
                    expect(err.message).to.equal(ASSETS_ERROR);
                } catch (err) {
                    error = err;
                }
            })
            .finally(function () {
                // Restore the subverted functions.
                // noinspection JSUnresolvedFunction
                requireSubvert.cleanUp();

                // Reload assetsFS, so that it gets the original version of recursive.
                assetsFS = require(UnitTest.API_PATH + "lib/assetsFS.js").instance;

                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
    }

    listNamesReadError (done) {
        const opts = {"workingDir": UnitTest.API_PATH + UnitTest.VALID_RESOURCES_DIRECTORY};

        // Create a stub for fs.existsSync that will return true.
        const stubExists = sinon.stub(fs, "existsSync");
        stubExists.withArgs(assetsFS.getAssetsPath(context, opts)).returns(true);

        // Create a stub that will return a list of asset names from the recursive function.
        const stubReaddir = sinon.stub();
        const err = null;
        const assetPaths = [
            UnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_1,
            UnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_2,
            UnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_3
        ];
        stubReaddir.yields(err, assetPaths);

        // Subvert the "recursive-readdir" module with the specified stub.
        // noinspection JSUnresolvedFunction
        requireSubvert.subvert("recursive-readdir", stubReaddir);

        // Reload assetsFS, so that it gets the subverted version of the recursive function.
        // noinspection JSUnresolvedFunction
        assetsFS = requireSubvert.require(UnitTest.API_PATH + "lib/assetsFS.js").instance;

        // Create a stub for fs.readFileSync that will return metadata for the filtered file.
        const originalReadFileSync = fs.readFileSync;
        const stubRead = sinon.stub(fs, "readFileSync", function (filename, readOptions) {
            if (filename.endsWith(assetsFS.getExtension())) {
                throw(new Error("Error reading file, as expected by unit test."));
            } else {
                // Return the contents of the specified file.
                return originalReadFileSync.call(fs, filename, readOptions);
            }
        });

        this.addTestDouble(stubExists);
        this.addTestDouble(stubRead);

        // Call the method being tested.
        let error;
        assetsFS.listNames(context, null, opts)
            .then(function (paths) {
                // Verify that the expected values are returned.
                expect(paths).to.have.lengthOf(3);
                expect(paths[0].path).to.be.oneOf([AssetsUnitTest.ASSET_JPG_1, AssetsUnitTest.ASSET_CSS_1, AssetsUnitTest.ASSET_CSS_2]);
                expect(paths[1].path).to.be.oneOf([AssetsUnitTest.ASSET_JPG_1, AssetsUnitTest.ASSET_CSS_1, AssetsUnitTest.ASSET_CSS_2]);
                expect(paths[2].path).to.be.oneOf([AssetsUnitTest.ASSET_JPG_1, AssetsUnitTest.ASSET_CSS_1, AssetsUnitTest.ASSET_CSS_2]);
            })
            .finally(function () {
                // Restore the subverted functions.
                // noinspection JSUnresolvedFunction
                requireSubvert.cleanUp();

                // Reload assetsFS, so that it gets the original version of recursive.
                assetsFS = require(UnitTest.API_PATH + "lib/assetsFS.js").instance;

                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
    }

    listNamesSuccess (done) {
        const opts = {"workingDir": UnitTest.VALID_RESOURCES_DIRECTORY};

        // Create a stub for fs.existsSync that will return true.
        const stubExists = sinon.stub(fs, "existsSync");
        stubExists.withArgs(assetsFS.getAssetsPath(context, opts)).returns(true);

        this.addTestDouble(stubExists);

        // Create a stub that will return a list of asset names from the recursive function.
        const stub = sinon.stub();
        const err = null;
        const assetPaths = [
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_JPG_1,
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CSS_1,
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CSS_2
        ];
        stub.yields(err, assetPaths);

        // Subvert the "recursive-readdir" module with the specified stub.
        // noinspection JSUnresolvedFunction
        requireSubvert.subvert("recursive-readdir", stub);

        // Reload assetsFS, so that it gets the subverted version of the recursive function.
        // noinspection JSUnresolvedFunction
        assetsFS = requireSubvert.require(UnitTest.API_PATH + "lib/assetsFS.js").instance;

        // Call the method being tested.
        let error;
        assetsFS.listNames(context, null, opts)
            .then(function (paths) {
                // Verify that the get stub was called once with the lookup URI.
                expect(stub).to.have.been.calledOnce;

                // Verify that the expected values are returned.
                expect(paths).to.have.lengthOf(3);
                expect(paths[0].path).to.be.oneOf([AssetsUnitTest.ASSET_JPG_1, AssetsUnitTest.ASSET_CSS_1, AssetsUnitTest.ASSET_CSS_2]);
                expect(paths[1].path).to.be.oneOf([AssetsUnitTest.ASSET_JPG_1, AssetsUnitTest.ASSET_CSS_1, AssetsUnitTest.ASSET_CSS_2]);
                expect(paths[2].path).to.be.oneOf([AssetsUnitTest.ASSET_JPG_1, AssetsUnitTest.ASSET_CSS_1, AssetsUnitTest.ASSET_CSS_2]);
            })
            .catch(function (err) {
                // NOTE: A failed expectation from above will be handled here.
                // Pass the error to the "done" function to indicate a failed test.
                error = err;
            })
            .finally(function () {
                // Restore the subverted functions.
                // noinspection JSUnresolvedFunction
                requireSubvert.cleanUp();

                // Reload assetsFS, so that it gets the original version of recursive.
                assetsFS = require(UnitTest.API_PATH + "lib/assetsFS.js").instance;

                // Restore the default options.
                UnitTest.restoreOptions(context);

                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
    }

    listNamesAdditionalPropertiesSuccess (done) {
        const opts = {"workingDir": UnitTest.API_PATH + UnitTest.VALID_RESOURCES_DIRECTORY, "additionalItemProperties": ["rev"]};

        // Create a stub for fs.existsSync that will return true.
        const stubExists = sinon.stub(fs, "existsSync");
        stubExists.withArgs(assetsFS.getAssetsPath(context, opts)).returns(true);

        this.addTestDouble(stubExists);

        // Create a stub that will return a list of asset names from the recursive function.
        const stub = sinon.stub();
        const err = null;
        const assetPaths = [
            UnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_1,
            UnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_2,
            UnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_3
        ];
        stub.yields(err, assetPaths);

        // Subvert the "recursive-readdir" module with the specified stub.
        // noinspection JSUnresolvedFunction
        requireSubvert.subvert("recursive-readdir", stub);

        // Reload assetsFS, so that it gets the subverted version of the recursive function.
        // noinspection JSUnresolvedFunction
        assetsFS = requireSubvert.require(UnitTest.API_PATH + "lib/assetsFS.js").instance;

        // Call the method being tested.
        let error;
        assetsFS.listNames(context, null, opts)
            .then(function (paths) {
                // Verify that the get stub was called once with the lookup URI.
                expect(stub).to.have.been.calledOnce;

                // Verify that the expected values are returned.
                expect(paths).to.have.lengthOf(3);
                expect(paths[0].path).to.be.oneOf([AssetsUnitTest.ASSET_CONTENT_JPG_1, AssetsUnitTest.ASSET_CONTENT_JPG_2, AssetsUnitTest.ASSET_CONTENT_JPG_3]);
                expect(paths[1].path).to.be.oneOf([AssetsUnitTest.ASSET_CONTENT_JPG_1, AssetsUnitTest.ASSET_CONTENT_JPG_2, AssetsUnitTest.ASSET_CONTENT_JPG_3]);
                expect(paths[2].path).to.be.oneOf([AssetsUnitTest.ASSET_CONTENT_JPG_1, AssetsUnitTest.ASSET_CONTENT_JPG_2, AssetsUnitTest.ASSET_CONTENT_JPG_3]);
            })
            .catch(function (err) {
                // NOTE: A failed expectation from above will be handled here.
                // Pass the error to the "done" function to indicate a failed test.
                error = err;
            })
            .finally(function () {
                // Restore the subverted functions.
                // noinspection JSUnresolvedFunction
                requireSubvert.cleanUp();

                // Reload assetsFS, so that it gets the original version of recursive.
                assetsFS = require(UnitTest.API_PATH + "lib/assetsFS.js").instance;

                // Restore the default options.
                UnitTest.restoreOptions(context);

                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
    }

    listNamesFilterWebAssetsSuccess (done) {
        const opts = {"workingDir": UnitTest.VALID_RESOURCES_DIRECTORY, 'assetTypes': AssetsFS.ASSET_TYPES_WEB_ASSETS};

        // Create a stub for fs.existsSync that will return true.
        const stubExists = sinon.stub(fs, "existsSync");
        stubExists.withArgs(assetsFS.getAssetsPath(context, opts)).returns(true);

        this.addTestDouble(stubExists);

        // Create a stub that will return a list of asset names from the recursive function.
        const stub = sinon.stub();
        const err = null;
        const assetPaths = [
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_JPG_1,
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + "/foo/bar/a.exclude",
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CSS_1,
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + "/foo/bar/x.remove",
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CSS_2,
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + "/dxdam/foo.bar",
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + "/" + ".wchtoolshashes"
        ];
        stub.yields(err, assetPaths);

        // Subvert the "recursive-readdir" module with the specified stub.
        // noinspection JSUnresolvedFunction
        requireSubvert.subvert("recursive-readdir", stub);

        // Reload assetsFS, so that it gets the subverted version of the recursive function.
        // noinspection JSUnresolvedFunction
        assetsFS = requireSubvert.require(UnitTest.API_PATH + "lib/assetsFS.js").instance;

        // Create a filter for *.remove and *.exclude files.
        //noinspection JSUnresolvedFunction
        const ig = ignore().add("*.remove\n*.exclude");
        //noinspection JSUnresolvedFunction
        const filter = ig.createFilter();

        // Call the method being tested.
        let error;
        assetsFS.listNames(context, filter, opts)
            .then(function (paths) {
                // Verify that the get stub was called once with the lookup URI.
                expect(stub).to.have.been.calledOnce;

                // Verify that the expected values are returned.
                expect(paths).to.have.lengthOf(3);
                expect(paths[0].path).to.be.oneOf([AssetsUnitTest.ASSET_JPG_1, AssetsUnitTest.ASSET_CSS_1, AssetsUnitTest.ASSET_CSS_2]);
                expect(paths[1].path).to.be.oneOf([AssetsUnitTest.ASSET_JPG_1, AssetsUnitTest.ASSET_CSS_1, AssetsUnitTest.ASSET_CSS_2]);
                expect(paths[2].path).to.be.oneOf([AssetsUnitTest.ASSET_JPG_1, AssetsUnitTest.ASSET_CSS_1, AssetsUnitTest.ASSET_CSS_2]);
            })
            .catch(function (err) {
                // NOTE: A failed expectation from above will be handled here.
                // Pass the error to the "done" function to indicate a failed test.
                error = err;
            })
            .finally(function () {
                // Restore the subverted functions.
                // noinspection JSUnresolvedFunction
                requireSubvert.cleanUp();

                // Reload assetsFS, so that it gets the original version of recursive.
                assetsFS = require(UnitTest.API_PATH + "lib/assetsFS.js").instance;

                // Restore the default options.
                UnitTest.restoreOptions(context);

                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
    }

    listNamesFilterContentAssetsSuccess (done) {
        const opts = {"workingDir": UnitTest.VALID_RESOURCES_DIRECTORY, "assetTypes": AssetsFS.ASSET_TYPES_CONTENT_ASSETS};

        // Create a stub for fs.existsSync that will return true.
        const stubExists = sinon.stub(fs, "existsSync");
        stubExists.withArgs(assetsFS.getAssetsPath(context, opts)).returns(true);

        this.addTestDouble(stubExists);

        // Create a stub that will return a list of asset names from the recursive function.
        const stub = sinon.stub();
        const err = null;
        const assetPaths = [
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_JPG_1,
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + "/foo/bar/a.exclude",
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CSS_1,
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + "/foo/bar/x.remove",
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CSS_2,
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + "/dxdam/foo.bar"
        ];
        stub.yields(err, assetPaths);

        // Subvert the "recursive-readdir" module with the specified stub.
        requireSubvert.subvert("recursive-readdir", stub);

        // Reload assetsFS, so that it gets the subverted version of the recursive function.
        assetsFS = requireSubvert.require(UnitTest.API_PATH + "lib/assetsFS.js").instance;

        // Create a stub for fs.readFileSync that will return metadata for the filtered file.
        const originalReadFileSync = fs.readFileSync;
        const stubRead = sinon.stub(fs, "readFileSync", function (filename, readOptions) {
            if (filename.endsWith(assetsFS.getExtension())) {
                return "{\"id\": \"foo\"}";
            } else {
                // Return the contents of the specified file.
                return originalReadFileSync.call(fs, filename, readOptions);
            }
        });
        this.addTestDouble(stubRead);

        // Create a filter for *.remove and *.exclude files.
        const ig = ignore().add("*.remove\n*.exclude");
        const filter = ig.createFilter();

        // Call the method being tested.
        let error;
        assetsFS.listNames(context, filter, opts)
            .then(function (paths) {
                // Verify that the get stub was called once with the lookup URI.
                expect(stub).to.have.been.calledOnce;

                // Verify that the expected values are returned.
                expect(paths).to.have.lengthOf(1);
                expect(paths[0].path).to.contain("dxdam/foo.bar");
            })
            .catch(function (err) {
                // NOTE: A failed expectation from above will be handled here.
                // Pass the error to the "done" function to indicate a failed test.
                error = err;
            })
            .finally(function () {
                // Restore the subverted functions.
                // noinspection JSUnresolvedFunction
                requireSubvert.cleanUp();

                // Reload assetsFS, so that it gets the original version of recursive.
                assetsFS = require(UnitTest.API_PATH + "lib/assetsFS.js").instance;

                // Restore the default options.
                UnitTest.restoreOptions(context);

                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
    }

    listNamesFilterPathSuccess (done) {
        const opts = {"workingDir": UnitTest.VALID_RESOURCES_DIRECTORY, "filterPath": "/test_1"};

        // Create a stub for fs.existsSync that will return true.
        const stubExists = sinon.stub(fs, "existsSync");
        stubExists.withArgs(assetsFS.getAssetsPath(context, opts)).returns(true);

        this.addTestDouble(stubExists);

        // Create a stub that will return a list of asset names from the recursive function.
        const stub = sinon.stub();
        const err = null;
        const assetPaths = [
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_JPG_1,
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + "foo/bar/a.exclude",
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CSS_1,
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + "foo/bar/x.remove",
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CSS_2,
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + "dxdam/foo.bar"
        ];
        stub.yields(err, assetPaths);

        // Subvert the "recursive-readdir" module with the specified stub.
        // noinspection JSUnresolvedFunction
        requireSubvert.subvert("recursive-readdir", stub);

        // Reload assetsFS, so that it gets the subverted version of the recursive function.
        // noinspection JSUnresolvedFunction
        assetsFS = requireSubvert.require(UnitTest.API_PATH + "lib/assetsFS.js").instance;

        // Create a filter for *.remove and *.exclude files.
        //noinspection JSUnresolvedFunction
        const ig = ignore().add("*.remove\n*.exclude");
        //noinspection JSUnresolvedFunction
        const filter = ig.createFilter();

        // Call the method being tested.
        let error;
        assetsFS.listNames(context, filter, opts)
            .then(function (paths) {
                // Verify that the get stub was called once with the lookup URI.
                expect(stub).to.have.been.calledOnce;

                // Verify that the expected values are returned.
                expect(paths).to.have.lengthOf(3);
                expect(paths[0].path).to.be.oneOf([AssetsUnitTest.ASSET_JPG_1, AssetsUnitTest.ASSET_CSS_1, AssetsUnitTest.ASSET_CSS_2]);
                expect(paths[1].path).to.be.oneOf([AssetsUnitTest.ASSET_JPG_1, AssetsUnitTest.ASSET_CSS_1, AssetsUnitTest.ASSET_CSS_2]);
                expect(paths[2].path).to.be.oneOf([AssetsUnitTest.ASSET_JPG_1, AssetsUnitTest.ASSET_CSS_1, AssetsUnitTest.ASSET_CSS_2]);
            })
            .catch(function (err) {
                // NOTE: A failed expectation from above will be handled here.
                // Pass the error to the "done" function to indicate a failed test.
                error = err;
            })
            .finally(function () {
                // Restore the subverted functions.
                // noinspection JSUnresolvedFunction
                requireSubvert.cleanUp();

                // Reload assetsFS, so that it gets the original version of recursive.
                assetsFS = require(UnitTest.API_PATH + "lib/assetsFS.js").instance;

                // Restore the default options.
                UnitTest.restoreOptions(context);

                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
    }

    listNamesDifferentFilterPathSuccess (done) {
        const opts = {"workingDir": UnitTest.VALID_RESOURCES_DIRECTORY, "filterPath": "test_1/"};

        // Create a stub for fs.existsSync that will return true.
        const stubExists = sinon.stub(fs, "existsSync");
        stubExists.withArgs(assetsFS.getAssetsPath(context, opts)).returns(true);

        this.addTestDouble(stubExists);

        // Create a stub that will return a list of asset names from the recursive function.
        const stub = sinon.stub();
        const err = null;
        const assetPaths = [
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_JPG_1,
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + "foo/bar/a.exclude",
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CSS_1,
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + "foo/bar/x.remove",
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CSS_2,
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + "dxdam/foo.bar"
        ];
        stub.yields(err, assetPaths);

        // Subvert the "recursive-readdir" module with the specified stub.
        // noinspection JSUnresolvedFunction
        requireSubvert.subvert("recursive-readdir", stub);

        // Reload assetsFS, so that it gets the subverted version of the recursive function.
        // noinspection JSUnresolvedFunction
        assetsFS = requireSubvert.require(UnitTest.API_PATH + "lib/assetsFS.js").instance;

        // Create a filter for *.remove and *.exclude files.
        //noinspection JSUnresolvedFunction
        const ig = ignore().add("*.remove\n*.exclude");
        //noinspection JSUnresolvedFunction
        const filter = ig.createFilter();

        // Call the method being tested.
        let error;
        assetsFS.listNames(context, filter, opts)
            .then(function (paths) {
                // Verify that the get stub was called once with the lookup URI.
                expect(stub).to.have.been.calledOnce;

                // Verify that the expected values are returned.
                expect(paths).to.have.lengthOf(3);
                expect(paths[0].path).to.be.oneOf([AssetsUnitTest.ASSET_JPG_1, AssetsUnitTest.ASSET_CSS_1, AssetsUnitTest.ASSET_CSS_2]);
                expect(paths[1].path).to.be.oneOf([AssetsUnitTest.ASSET_JPG_1, AssetsUnitTest.ASSET_CSS_1, AssetsUnitTest.ASSET_CSS_2]);
                expect(paths[2].path).to.be.oneOf([AssetsUnitTest.ASSET_JPG_1, AssetsUnitTest.ASSET_CSS_1, AssetsUnitTest.ASSET_CSS_2]);
            })
            .catch(function (err) {
                // NOTE: A failed expectation from above will be handled here.
                // Pass the error to the "done" function to indicate a failed test.
                error = err;
            })
            .finally(function () {
                // Restore the subverted functions.
                // noinspection JSUnresolvedFunction
                requireSubvert.cleanUp();

                // Reload assetsFS, so that it gets the original version of recursive.
                assetsFS = require(UnitTest.API_PATH + "lib/assetsFS.js").instance;

                // Restore the default options.
                UnitTest.restoreOptions(context);

                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
    }

    listNamesDefaultFilterAdditiveSuccess (done) {
        const opts = {"workingDir": UnitTest.VALID_RESOURCES_DIRECTORY, "is_ignore_additive": true};

        // Create a stub for fs.existsSync that will return true for the specified working directory and false for the assets ignore file.
        const stubExists = sinon.stub(fs, "existsSync");
        stubExists.withArgs(assetsFS.getAssetsPath(context, opts)).returns(true);
        stubExists.withArgs(assetsFS.getAssetsPath(context, opts) + ".wchtoolsignore").returns(false);

        this.addTestDouble(stubExists);

        // Create a stub for fs.readFileSync that will return ignore rules for the default ignore file.
        const originalReadFileSync = fs.readFileSync;
        const stubRead = sinon.stub(fs, "readFileSync", function (filename, readOptions) {
            if (filename === UnitTest.API_PATH + "lib" + path.sep + ".wchtoolsignore") {
                return "*.jpg";
            } else {
                // Return the contents of the specified file.
                return originalReadFileSync.call(fs, filename, readOptions);
            }
        });

        this.addTestDouble(stubRead);

        // Create a stub that will return a list of asset names from the recursive function.
        const stub = sinon.stub();
        const err = null;
        const assetPaths = [
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_JPG_1,
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CSS_1,
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_HTML_1
        ];
        stub.yields(err, assetPaths);

        // Subvert the "recursive-readdir" module with the specified stub.
        // noinspection JSUnresolvedFunction
        requireSubvert.subvert("recursive-readdir", stub);

        // Reload assetsFS, so that it gets the subverted version of the recursive function.
        // noinspection JSUnresolvedFunction
        assetsFS = requireSubvert.require(UnitTest.API_PATH + "lib/assetsFS.js").instance;

        // Call the method being tested.
        let error;
        assetsFS.listNames(context, null, opts)
            .then(function (paths) {
                // Verify that the get stub was called once with the lookup URI.
                expect(stub).to.have.been.calledOnce;
                expect(stub.firstCall.args[0]).to.equal(assetsFS.getAssetsPath(context, opts));

                // Verify that the expected values are returned.
                expect(paths).to.have.lengthOf(2);
                expect(paths[0].path).to.be.oneOf([AssetsUnitTest.ASSET_CSS_1, AssetsUnitTest.ASSET_HTML_1]);
                expect(paths[1].path).to.be.oneOf([AssetsUnitTest.ASSET_CSS_1, AssetsUnitTest.ASSET_HTML_1]);
            })
            .catch(function (err) {
                // NOTE: A failed expectation from above will be handled here.
                // Pass the error to the "done" function to indicate a failed test.
                error = err;
            })
            .finally(function () {
                // Restore the subverted functions.
                // noinspection JSUnresolvedFunction
                requireSubvert.cleanUp();

                // Reload assetsFS, so that it gets the original version of recursive.
                assetsFS = require(UnitTest.API_PATH + "lib/assetsFS.js").instance;

                // Restore the default options.
                UnitTest.restoreOptions(context);

                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
    }

    listNamesDefaultFilterNotAdditiveSuccess (done) {
        const opts = {"workingDir": UnitTest.VALID_RESOURCES_DIRECTORY, "is_ignore_additive": false};

        // Create a stub for fs.existsSync that will return true for the specified working directory and false for the assets ignore file.
        const stubExists = sinon.stub(fs, "existsSync");
        stubExists.withArgs(assetsFS.getAssetsPath(context, opts)).returns(true);
        stubExists.withArgs(assetsFS.getAssetsPath(context, opts) + ".wchtoolsignore").returns(false);

        this.addTestDouble(stubExists);

        // Create a stub for fs.readFileSync that will return ignore rules for the default ignore file.
        const originalReadFileSync = fs.readFileSync;
        const stubRead = sinon.stub(fs, "readFileSync", function (filename, readOptions) {
            if (filename === UnitTest.API_PATH + "lib" + path.sep + ".wchtoolsignore") {
                return "*.jpg";
            } else {
                // Return the contents of the specified file.
                return originalReadFileSync.call(fs, filename, readOptions);
            }
        });

        this.addTestDouble(stubRead);

        // Create a stub that will return a list of asset names from the recursive function.
        const stub = sinon.stub();
        const err = null;
        const assetPaths = [
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_JPG_1,
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CSS_1,
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_HTML_1
        ];
        stub.yields(err, assetPaths);

        // Subvert the "recursive-readdir" module with the specified stub.
        // noinspection JSUnresolvedFunction
        requireSubvert.subvert("recursive-readdir", stub);

        // Reload assetsFS, so that it gets the subverted version of the recursive function.
        // noinspection JSUnresolvedFunction
        assetsFS = requireSubvert.require(UnitTest.API_PATH + "lib/assetsFS.js").instance;

        // Call the method being tested.
        let error;
        assetsFS.listNames(context, null, opts)
            .then(function (paths) {
                // Verify that the get stub was called once with the lookup URI.
                expect(stub).to.have.been.calledOnce;
                expect(stub.firstCall.args[0]).to.equal(assetsFS.getAssetsPath(context, opts));

                // Verify that the expected values are returned.
                expect(paths).to.have.lengthOf(2);
                expect(paths[0].path).to.be.oneOf([AssetsUnitTest.ASSET_CSS_1, AssetsUnitTest.ASSET_HTML_1]);
                expect(paths[1].path).to.be.oneOf([AssetsUnitTest.ASSET_CSS_1, AssetsUnitTest.ASSET_HTML_1]);
            })
            .catch(function (err) {
                // NOTE: A failed expectation from above will be handled here.
                // Pass the error to the "done" function to indicate a failed test.
                error = err;
            })
            .finally(function () {
                // Restore the subverted functions.
                // noinspection JSUnresolvedFunction
                requireSubvert.cleanUp();

                // Reload assetsFS, so that it gets the original version of recursive.
                assetsFS = require(UnitTest.API_PATH + "lib/assetsFS.js").instance;

                // Restore the default options.
                UnitTest.restoreOptions(context);

                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
    }

    listNamesAssetsFilterAdditiveSuccess (done) {
        const opts = {"workingDir": UnitTest.VALID_RESOURCES_DIRECTORY, "is_ignore_additive": true};

        // Create a stub for fs.existsSync that will return true for the specified working directory and false for the assets ignore file.
        const stubExists = sinon.stub(fs, "existsSync");
        stubExists.withArgs(assetsFS.getAssetsPath(context, opts)).returns(true);
        stubExists.withArgs(assetsFS.getAssetsPath(context, opts) + ".wchtoolsignore").returns(true);

        this.addTestDouble(stubExists);

        // Create a stub for fs.readFileSync that will return ignore rules for the two ignore files.
        const originalReadFileSync = fs.readFileSync;
        const stubRead = sinon.stub(fs, "readFileSync", function (filename, readOptions) {
            if (filename === UnitTest.API_PATH + "lib" + path.sep + ".wchtoolsignore") {
                return "*.jpg";
            } else if (filename === assetsFS.getAssetsPath(context, opts) + ".wchtoolsignore") {
                return "*.css";
            } else {
                // Return the contents of the specified file.
                return originalReadFileSync.call(fs, filename, readOptions);
            }
        });

        this.addTestDouble(stubRead);

        // Create a stub that will return a list of asset names from the recursive function.
        const stub = sinon.stub();
        const err = null;
        const assetPaths = [
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_JPG_1,
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CSS_1,
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_HTML_1
        ];
        stub.yields(err, assetPaths);

        // Subvert the "recursive-readdir" module with the specified stub.
        // noinspection JSUnresolvedFunction
        requireSubvert.subvert("recursive-readdir", stub);

        // Reload assetsFS, so that it gets the subverted version of the recursive function.
        // noinspection JSUnresolvedFunction
        assetsFS = requireSubvert.require(UnitTest.API_PATH + "lib/assetsFS.js").instance;

        // Call the method being tested.
        let error;
        assetsFS.listNames(context, null, opts)
            .then(function (paths) {
                // Verify that the get stub was called once with the lookup URI.
                expect(stub).to.have.been.calledOnce;
                expect(stub.firstCall.args[0]).to.equal(assetsFS.getAssetsPath(context, opts));

                // Verify that the expected values are returned.
                expect(paths).to.have.lengthOf(1);
                expect(paths[0].path).to.equal(AssetsUnitTest.ASSET_HTML_1);
            })
            .catch(function (err) {
                // NOTE: A failed expectation from above will be handled here.
                // Pass the error to the "done" function to indicate a failed test.
                error = err;
            })
            .finally(function () {
                // Restore the subverted functions.
                // noinspection JSUnresolvedFunction
                requireSubvert.cleanUp();

                // Reload assetsFS, so that it gets the original version of recursive.
                assetsFS = require(UnitTest.API_PATH + "lib/assetsFS.js").instance;

                // Restore the default options.
                UnitTest.restoreOptions(context);

                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
    }

    listNamesAssetsFilterNotAdditiveSuccess (done) {
        const opts = {"workingDir": UnitTest.VALID_RESOURCES_DIRECTORY, "is_ignore_additive": false};

        // Create a stub for fs.existsSync that will return true for the specified working directory and false for the assets ignore file.
        const stubExists = sinon.stub(fs, "existsSync");
        stubExists.withArgs(assetsFS.getAssetsPath(context, opts)).returns(true);
        stubExists.withArgs(assetsFS.getAssetsPath(context, opts) + ".wchtoolsignore").returns(true);

        this.addTestDouble(stubExists);

        // Create a stub for fs.readFileSync that will return ignore rules for the two ignore files.
        const originalReadFileSync = fs.readFileSync;
        const stubRead = sinon.stub(fs, "readFileSync", function (filename, readOptions) {
            if (filename === UnitTest.API_PATH + "lib" + path.sep + ".wchtoolsignore") {
                return "*.jpg";
            } else if (filename === assetsFS.getAssetsPath(context, opts) + ".wchtoolsignore") {
                return "*.css";
            } else {
                // Return the contents of the specified file.
                return originalReadFileSync.call(fs, filename, readOptions);
            }
        });

        this.addTestDouble(stubRead);

        // Create a stub that will return a list of asset names from the recursive function.
        const stub = sinon.stub();
        const err = null;
        const assetPaths = [
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_JPG_1,
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CSS_1,
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_HTML_1
        ];
        stub.yields(err, assetPaths);

        // Subvert the "recursive-readdir" module with the specified stub.
        // noinspection JSUnresolvedFunction
        requireSubvert.subvert("recursive-readdir", stub);

        // Reload assetsFS, so that it gets the subverted version of the recursive function.
        // noinspection JSUnresolvedFunction
        assetsFS = requireSubvert.require(UnitTest.API_PATH + "lib/assetsFS.js").instance;

        // Call the method being tested.
        let error;
        assetsFS.listNames(context, null, opts)
            .then(function (paths) {
                // Verify that the get stub was called once with the lookup URI.
                expect(stub).to.have.been.calledOnce;
                expect(stub.firstCall.args[0]).to.equal(assetsFS.getAssetsPath(context, opts));

                // Verify that the expected values are returned.
                expect(paths).to.have.lengthOf(2);
                expect(paths[0].path).to.be.oneOf([AssetsUnitTest.ASSET_JPG_1, AssetsUnitTest.ASSET_HTML_1]);
                expect(paths[1].path).to.be.oneOf([AssetsUnitTest.ASSET_JPG_1, AssetsUnitTest.ASSET_HTML_1]);
            })
            .catch(function (err) {
                // NOTE: A failed expectation from above will be handled here.
                // Pass the error to the "done" function to indicate a failed test.
                error = err;
            })
            .finally(function () {
                // Restore the subverted functions.
                // noinspection JSUnresolvedFunction
                requireSubvert.cleanUp();

                // Reload assetsFS, so that it gets the original version of recursive.
                assetsFS = require(UnitTest.API_PATH + "lib/assetsFS.js").instance;

                // Restore the default options.
                UnitTest.restoreOptions(context);

                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
    }

    listNamesAssetsFilterAdditiveDefaultSuccess (done) {
        const opts = {"workingDir": UnitTest.VALID_RESOURCES_DIRECTORY};

        // Create a stub for fs.existsSync that will return true for the specified working directory and false for the assets ignore file.
        const stubExists = sinon.stub(fs, "existsSync");
        stubExists.withArgs(assetsFS.getAssetsPath(context, opts)).returns(true);
        stubExists.withArgs(assetsFS.getAssetsPath(context, opts) + ".wchtoolsignore").returns(true);

        this.addTestDouble(stubExists);

        // Create a stub for fs.readFileSync that will return ignore rules for the two ignore files.
        const originalReadFileSync = fs.readFileSync;
        const stubRead = sinon.stub(fs, "readFileSync", function (filename, readOptions) {
            if (filename === UnitTest.API_PATH + "lib" + path.sep + ".wchtoolsignore") {
                return "*.jpg";
            } else if (filename === assetsFS.getAssetsPath(context, opts) + ".wchtoolsignore") {
                return "*.css";
            } else {
                // Return the contents of the specified file.
                return originalReadFileSync.call(fs, filename, readOptions);
            }
        });

        this.addTestDouble(stubRead);

        // Create a stub that will return a list of asset names from the recursive function.
        const stub = sinon.stub();
        const err = null;
        const assetPaths = [
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_JPG_1,
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CSS_1,
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_HTML_1
        ];
        stub.yields(err, assetPaths);

        // Subvert the "recursive-readdir" module with the specified stub.
        // noinspection JSUnresolvedFunction
        requireSubvert.subvert("recursive-readdir", stub);

        // Reload assetsFS, so that it gets the subverted version of the recursive function.
        // noinspection JSUnresolvedFunction
        assetsFS = requireSubvert.require(UnitTest.API_PATH + "lib/assetsFS.js").instance;

        // Call the method being tested.
        let error;
        assetsFS.listNames(context, null, opts)
            .then(function (paths) {
                // Verify that the get stub was called once with the lookup URI.
                expect(stub).to.have.been.calledOnce;
                expect(stub.firstCall.args[0]).to.equal(assetsFS.getAssetsPath(context, opts));

                // Verify that the expected values are returned.
                expect(paths).to.have.lengthOf(1);
                expect(paths[0].path).to.equal(AssetsUnitTest.ASSET_HTML_1);
            })
            .catch(function (err) {
                // NOTE: A failed expectation from above will be handled here.
                // Pass the error to the "done" function to indicate a failed test.
                error = err;
            })
            .finally(function () {
                // Restore the subverted functions.
                // noinspection JSUnresolvedFunction
                requireSubvert.cleanUp();

                // Reload assetsFS, so that it gets the original version of recursive.
                assetsFS = require(UnitTest.API_PATH + "lib/assetsFS.js").instance;

                // Restore the default options.
                UnitTest.restoreOptions(context);

                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
    }

    testListResourceNames () {
        const self = this;

        describe("listResourceNames", function () {
            it("should succeed when the resource directory does not exist", function (done) {
                // Create a stub for fs.existsSync that will return true.
                const stubExists = sinon.stub(fs, "existsSync");
                stubExists.withArgs(assetsFS.getResourcesPath(context)).returns(false);

                self.addTestDouble(stubExists);

                // Call the method being tested.
                let error;
                assetsFS.listResourceNames(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (names) {
                        // Verify that the stub was called once.
                        expect(stubExists).to.have.been.calledOnce;

                        // Verify that the expected error is returned.
                        expect(names).to.be.an("Array");
                        expect(names).to.have.lengthOf(0);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Restore the subverted functions.
                        // noinspection JSUnresolvedFunction
                        requireSubvert.cleanUp();

                        // Reload assetsFS, so that it gets the original version of recursive.
                        assetsFS = require(UnitTest.API_PATH + "lib/assetsFS.js").instance;

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when getting resource directory contents fails", function (done) {
                const opts = UnitTest.DUMMY_OPTIONS;

                // Create a stub for fs.existsSync that will return true.
                const stubExists = sinon.stub(fs, "existsSync");
                stubExists.withArgs(assetsFS.getResourcesPath(context, opts)).returns(true);

                self.addTestDouble(stubExists);

                // Create a stub that will return an error from the recursive function.
                const RESOURCES_ERROR = "Error getting the asset names.";
                const stubReaddir = sinon.stub();
                stubReaddir.yields(new Error(RESOURCES_ERROR), null);

                // Subvert the "recursive-readdir" module with the specified stub.
                // noinspection JSUnresolvedFunction
                requireSubvert.subvert("recursive-readdir", stubReaddir);

                // Reload assetsFS, so that it gets the subverted version of the recursive function.
                // noinspection JSUnresolvedFunction
                assetsFS = requireSubvert.require(UnitTest.API_PATH + "lib/assetsFS.js").instance;

                // Call the method being tested.
                let error;
                assetsFS.listResourceNames(context, opts)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the resource names should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once.
                        expect(stubReaddir).to.have.been.calledOnce;

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.equal(RESOURCES_ERROR);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Restore the subverted functions.
                        // noinspection JSUnresolvedFunction
                        requireSubvert.cleanUp();

                        // Reload assetsFS, so that it gets the original version of recursive.
                        assetsFS = require(UnitTest.API_PATH + "lib/assetsFS.js").instance;

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when getting resource directory contents succeeds", function (done) {
                const opts = {"workingDir": UnitTest.VALID_RESOURCES_DIRECTORY};

                // Create a stub for fs.existsSync that will return true.
                const stubExists = sinon.stub(fs, "existsSync");
                stubExists.withArgs(assetsFS.getResourcesPath(context, opts)).returns(true);

                self.addTestDouble(stubExists);

                // Create a stub that will return a list of asset names from the recursive function.
                const stub = sinon.stub();
                const err = null;
                const resourcePaths = [
                    AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_JPG_1,
                    AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CSS_1,
                    AssetsUnitTest.VALID_ASSETS_DIRECTORY + "/" + ".wchtoolshashes"
                ];
                stub.yields(err, resourcePaths);

                // Subvert the "recursive-readdir" module with the specified stub.
                // noinspection JSUnresolvedFunction
                requireSubvert.subvert("recursive-readdir", stub);

                // Reload assetsFS, so that it gets the subverted version of the recursive function.
                // noinspection JSUnresolvedFunction
                assetsFS = requireSubvert.require(UnitTest.API_PATH + "lib/assetsFS.js").instance;

                // Call the method being tested.
                let error;
                assetsFS.listResourceNames(context, opts)
                    .then(function (resources) {
                        // Verify that the get stub was called once with the lookup URI.
                        expect(stub).to.have.been.calledOnce;

                        // Verify that the expected values are returned.
                        expect(resources).to.have.lengthOf(2);
                        expect(resources[0].path).to.be.oneOf(["/../assets" + AssetsUnitTest.ASSET_JPG_1, "/../assets" + AssetsUnitTest.ASSET_CSS_1]);
                        expect(resources[1].path).to.be.oneOf(["/../assets" + AssetsUnitTest.ASSET_JPG_1, "/../assets" + AssetsUnitTest.ASSET_CSS_1]);
                    })
                    .catch(function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the subverted functions.
                        // noinspection JSUnresolvedFunction
                        requireSubvert.cleanUp();

                        // Reload assetsFS, so that it gets the original version of recursive.
                        assetsFS = require(UnitTest.API_PATH + "lib/assetsFS.js").instance;

                        // Restore the default options.
                        UnitTest.restoreOptions(context);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testGetFileStats () {
        const self = this;

        describe("getFileStats", function () {
            it("should fail when getting stats fails", function (done) {
                // Create a stub for fs.stat to return an error.
                const ASSET_ERROR = "Error getting the asset stats.";
                const stub = sinon.stub(fs, "stat");
                const err = new Error(ASSET_ERROR);
                const stats = null;
                stub.yields(err, stats);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsFS.getFileStats(context, AssetsUnitTest.ASSET_JAR_1)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset stats should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once with the specified URI.
                            expect(stub).to.have.been.calledOnce;
                            expect(stub.args[0][0]).to.contain(AssetsUnitTest.ASSET_JAR_1);

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.equal(ASSET_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when getting stats for a valid asset", function (done) {
                // Create a stub for fs.stat to return a stats object.
                const stub = sinon.stub(fs, "stat");
                const err = null;
                stub.yields(err, DUMMY_STAT);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsFS.getFileStats(context, AssetsUnitTest.ASSET_PNG_1)
                    .then(function (stats) {
                        // Verify that the stub was called once with the specified path.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.args[0][0]).to.contain(AssetsUnitTest.ASSET_PNG_1);

                        // Verify that the REST API returned the expected values.
                        expect(diff.diffJson(stats, DUMMY_STAT)).to.have.lengthOf(1);
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

    testGetResourceFileStats () {
        const self = this;

        describe("getResourceFileStats", function () {
            it("should fail when getting stats fails", function (done) {
                // Create a stub for fs.stat to return an error.
                const RESOURCE_ERROR = "Error getting the resource stats.";
                const stub = sinon.stub(fs, "stat");
                const err = new Error(RESOURCE_ERROR);
                const stats = null;
                stub.yields(err, stats);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsFS.getResourceFileStats(context, AssetsUnitTest.ASSET_JAR_1)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the resource stats should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once with the specified URI.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.args[0][0]).to.contain(AssetsUnitTest.ASSET_JAR_1);

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.equal(RESOURCE_ERROR);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when getting stats for a valid resource", function (done) {
                // Create a stub for fs.stat to return a stats object.
                const stub = sinon.stub(fs, "stat");
                const err = null;
                stub.yields(err, DUMMY_STAT);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsFS.getResourceFileStats(context, AssetsUnitTest.ASSET_PNG_1)
                    .then(function (stats) {
                        // Verify that the stub was called once with the specified path.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.args[0][0]).to.contain(AssetsUnitTest.ASSET_PNG_1);

                        // Verify that the REST API returned the expected values.
                        expect(diff.diffJson(stats, DUMMY_STAT)).to.have.lengthOf(1);
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

    testGetContentLength () {
        const self = this;

        describe("getContentLength", function () {
            it("should fail when getting stats fails", function (done) {
                // Create a stub for assetsFS.getFileStats to return an error.
                const ASSET_ERROR = "Error getting the asset stats.";
                const stub = sinon.stub(assetsFS, "getFileStats");
                stub.rejects(ASSET_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsFS.getContentLength(context, AssetsUnitTest.ASSET_JAR_1, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset stats should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once with the specified URI.
                            expect(stub).to.have.been.calledOnce;
                            expect(stub.args[0][1]).to.contain(AssetsUnitTest.ASSET_JAR_1);

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.equal(ASSET_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when getting stats for a valid asset", function (done) {
                // Create a stub for assetsFS.getFileStats to return values.
                const stub = sinon.stub(assetsFS, "getFileStats");
                stub.resolves({"size": 128});

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsFS.getContentLength(context, AssetsUnitTest.ASSET_JAR_1, UnitTest.DUMMY_OPTIONS)
                    .then(function (size) {
                        // Verify that the stub was called once with the specified path.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.args[0][1]).to.contain(AssetsUnitTest.ASSET_JAR_1);

                        // Verify that the expected value was returned.
                        expect(size).to.equal(128);
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

    testGetResourceContentLength () {
        const self = this;

        describe("getResourceContentLength", function () {
            it("should fail when getting stats fails", function (done) {
                // Create a stub for assetsFS.getResourceFileStats to return an error.
                const RESOURCE_ERROR = "Error getting the resource stats.";
                const stub = sinon.stub(assetsFS, "getResourceFileStats");
                stub.rejects(RESOURCE_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsFS.getResourceContentLength(context, AssetsUnitTest.ASSET_JAR_1, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the resource stats should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once with the specified URI.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.args[0][1]).to.contain(AssetsUnitTest.ASSET_JAR_1);

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.equal(RESOURCE_ERROR);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when getting stats for a valid resource", function (done) {
                // Create a stub for assetsFS.getResourceFileStats to return values.
                const stub = sinon.stub(assetsFS, "getResourceFileStats");
                stub.resolves({"size": 128});

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsFS.getResourceContentLength(context, AssetsUnitTest.ASSET_JAR_1, UnitTest.DUMMY_OPTIONS)
                    .then(function (size) {
                        // Verify that the stub was called once with the specified path.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.args[0][1]).to.contain(AssetsUnitTest.ASSET_JAR_1);

                        // Verify that the expected value was returned.
                        expect(size).to.equal(128);
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

module.exports = AssetsFsUnitTest;
