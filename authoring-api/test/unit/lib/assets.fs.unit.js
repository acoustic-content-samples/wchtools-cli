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
const options = require(UnitTest.API_PATH + "lib/utils/options.js");
const requireSubvert = require('require-subvert')(__dirname);
const sinon = require("sinon");
const utils = require(UnitTest.API_PATH + "lib/utils/utils.js");
const hashes = require(UnitTest.API_PATH + "lib/utils/hashes.js");

// Require the local modules that will be stubbed, mocked, and spied.
const fs = require("fs");
const recursive = require('recursive-readdir');
const mkdirp = require('mkdirp');

// Require the local module being tested.
const AssetsFS = require(UnitTest.API_PATH + "lib/assetsFS.js");
let assetsFS = AssetsFS.instance;

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

class AssetsFsUnitTest extends AssetsUnitTest {
    constructor() {
        super();
    }

    run () {
        const self = this;
        describe("Unit tests for assetsFS.js", function () {
            let stubSync;

            // Initialize common resourses before running the unit tests.
            before(function (done) {
                // Create stub for mkdirp.sync so that we don't create any directories.
                stubSync = sinon.stub(mkdirp, "sync");
                stubSync.returns(null);

                // Reset the state of the FS API.
                assetsFS.reset();

                // Signal that the cleanup is complete.
                done();
            });

            // Cleanup common resourses consumed by each test.
            afterEach(function (done) {
                // Restore any stubs and spies used for the test.
                self.restoreTestDoubles();

                // Reset the state of the FS API.
                assetsFS.reset();

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
            self.testGetPath();
            self.testGetItem();
            self.testSaveItem();
            self.testGetItemReadStream();
            self.testGetItemWriteStream();
            self.testListNames();
            self.testGetFileStats();
            self.testGetContentLength();
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

    testGetPath () {
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
                // Before setting the new working directory, the asset path should not contain that directory.
                expect(assetsFS.getPath(UnitTest.DUMMY_NAME)).to.not.contain(UnitTest.DUMMY_DIR);

                // Set the new working directory, and initialize assetsFS with the new options.
                options.setGlobalOptions({"workingDir": UnitTest.DUMMY_DIR});

                // After setting the new working directory, the asset path should contain that directory.
                expect(assetsFS.getPath(UnitTest.DUMMY_NAME)).to.contain(UnitTest.DUMMY_DIR);

                done();
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
                assetsFS.getItem(AssetsUnitTest.ASSET_CSS_1, UnitTest.DUMMY_OPTIONS)
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
                assetsFS.getItem(AssetsUnitTest.ASSET_CSS_1, UnitTest.DUMMY_OPTIONS)
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

            it("should succeed if parsing the file contents succeeds", function (done) {
                // Create a stub for fs.readFile to return a valid JSON string.
                const stub = sinon.stub(fs, "readFile");
                stub.yields(null, '{"json": "closing-curly-bracket"}');

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsFS.getItem(AssetsUnitTest.ASSET_CSS_1, UnitTest.DUMMY_OPTIONS)
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
                assetsFS.saveItem(UnitTest.DUMMY_METADATA, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for saving the asset item should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once with the specified asset path.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.args[0][0]).to.contain(assetsFS.getFolderName());

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
                assetsFS.saveItem(UnitTest.DUMMY_METADATA, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset item should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stubs were called once with the specified asset path.
                            expect(stubDir).to.have.been.calledOnce;
                            expect(stub.args[0][0]).to.contain(assetsFS.getFolderName());
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
                assetsFS.saveItem(UnitTest.DUMMY_METADATA, UnitTest.DUMMY_OPTIONS)
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
                assetsFS.getItemReadStream(AssetsUnitTest.ASSET_CSS_1, UnitTest.DUMMY_OPTIONS)
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
                assetsFS.getItemReadStream(AssetsUnitTest.ASSET_CSS_1, UnitTest.DUMMY_OPTIONS)
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
        assetsFS.getItemWriteStream(UnitTest.DUMMY_NAME, UnitTest.DUMMY_OPTIONS)
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
        assetsFS.getItemWriteStream(AssetsUnitTest.ASSET_GIF_1, UnitTest.DUMMY_OPTIONS)
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
        assetsFS.getItemWriteStream(AssetsUnitTest.ASSET_CSS_1, UnitTest.DUMMY_OPTIONS)
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
            it("should fail when getting the asset names fails", function (done) {
                self.listNamesError(done);
            });

            it("should succeed when getting asset names", function (done) {
                self.listNamesSuccess(done);
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

    listNamesError (done) {
        // Create a stub for fs.existsSync that will return true.
        const stubExists = sinon.stub(fs, "existsSync");
        stubExists.withArgs(assetsFS.getAssetsPath(UnitTest.DUMMY_OPTIONS)).returns(true);

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
        assetsFS.listNames(null, UnitTest.DUMMY_OPTIONS)
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

    listNamesSuccess (done) {
        // Set the current working directory to the "valid resources" directory.
        options.setGlobalOptions({"workingDir": UnitTest.VALID_RESOURCES_DIRECTORY});

        // Create a stub for fs.existsSync that will return true.
        const stubExists = sinon.stub(fs, "existsSync");
        stubExists.withArgs(assetsFS.getAssetsPath(UnitTest.VALID_RESOURCES_DIRECTORY)).returns(true);

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
        assetsFS.listNames(null, UnitTest.DUMMY_OPTIONS)
            .then(function (paths) {
                // Verify that the get stub was called once with the lookup URI.
                expect(stub).to.have.been.calledOnce;

                // Verify that the expected values are returned.
                expect(paths).to.have.lengthOf(3);
                expect(paths[0]).to.be.oneOf([AssetsUnitTest.ASSET_JPG_1, AssetsUnitTest.ASSET_CSS_1, AssetsUnitTest.ASSET_CSS_2]);
                expect(paths[1]).to.be.oneOf([AssetsUnitTest.ASSET_JPG_1, AssetsUnitTest.ASSET_CSS_1, AssetsUnitTest.ASSET_CSS_2]);
                expect(paths[2]).to.be.oneOf([AssetsUnitTest.ASSET_JPG_1, AssetsUnitTest.ASSET_CSS_1, AssetsUnitTest.ASSET_CSS_2]);
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
                UnitTest.restoreOptions();

                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
    }

    listNamesFilterWebAssetsSuccess (done) {
        // Set the current working directory to the "valid resources" directory.
        options.setGlobalOptions({"workingDir": UnitTest.VALID_RESOURCES_DIRECTORY});

        // Create a stub for fs.existsSync that will return true.
        const stubExists = sinon.stub(fs, "existsSync");
        stubExists.withArgs(assetsFS.getAssetsPath(UnitTest.VALID_RESOURCES_DIRECTORY)).returns(true);

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
            AssetsUnitTest.VALID_ASSETS_DIRECTORY + "/" + hashes.FILENAME
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
        assetsFS.listNames(filter, {'assetTypes': AssetsFS.ASSET_TYPES_WEB_ASSETS})
            .then(function (paths) {
                // Verify that the get stub was called once with the lookup URI.
                expect(stub).to.have.been.calledOnce;

                // Verify that the expected values are returned.
                expect(paths).to.have.lengthOf(3);
                expect(paths[0]).to.be.oneOf([AssetsUnitTest.ASSET_JPG_1, AssetsUnitTest.ASSET_CSS_1, AssetsUnitTest.ASSET_CSS_2]);
                expect(paths[1]).to.be.oneOf([AssetsUnitTest.ASSET_JPG_1, AssetsUnitTest.ASSET_CSS_1, AssetsUnitTest.ASSET_CSS_2]);
                expect(paths[2]).to.be.oneOf([AssetsUnitTest.ASSET_JPG_1, AssetsUnitTest.ASSET_CSS_1, AssetsUnitTest.ASSET_CSS_2]);
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
                UnitTest.restoreOptions();

                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
    }

    listNamesFilterContentAssetsSuccess (done) {
        // Set the current working directory to the "valid resources" directory.
        options.setGlobalOptions({"workingDir": UnitTest.VALID_RESOURCES_DIRECTORY});

        // Create a stub for fs.existsSync that will return true.
        const stubExists = sinon.stub(fs, "existsSync");
        stubExists.withArgs(assetsFS.getAssetsPath(UnitTest.VALID_RESOURCES_DIRECTORY)).returns(true);

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
        assetsFS.listNames(filter, {'assetTypes': AssetsFS.ASSET_TYPES_CONTENT_ASSETS})
            .then(function (paths) {
                // Verify that the get stub was called once with the lookup URI.
                expect(stub).to.have.been.calledOnce;

                // Verify that the expected values are returned.
                expect(paths).to.have.lengthOf(1);
                expect(paths[0]).to.contain("dxdam/foo.bar");
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
                UnitTest.restoreOptions();

                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
    }

    listNamesFilterPathSuccess (done) {
        // Set the current working directory to the "valid resources" directory.
        options.setGlobalOptions({"workingDir": UnitTest.VALID_RESOURCES_DIRECTORY});

        // Create a stub for fs.existsSync that will return true.
        const stubExists = sinon.stub(fs, "existsSync");
        stubExists.withArgs(assetsFS.getAssetsPath(UnitTest.VALID_RESOURCES_DIRECTORY)).returns(true);

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
        assetsFS.listNames(filter, {"filterPath": "/test_1"})
            .then(function (paths) {
                // Verify that the get stub was called once with the lookup URI.
                expect(stub).to.have.been.calledOnce;

                // Verify that the expected values are returned.
                expect(paths).to.have.lengthOf(3);
                expect(paths[0]).to.be.oneOf([AssetsUnitTest.ASSET_JPG_1, AssetsUnitTest.ASSET_CSS_1, AssetsUnitTest.ASSET_CSS_2]);
                expect(paths[1]).to.be.oneOf([AssetsUnitTest.ASSET_JPG_1, AssetsUnitTest.ASSET_CSS_1, AssetsUnitTest.ASSET_CSS_2]);
                expect(paths[2]).to.be.oneOf([AssetsUnitTest.ASSET_JPG_1, AssetsUnitTest.ASSET_CSS_1, AssetsUnitTest.ASSET_CSS_2]);
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
                UnitTest.restoreOptions();

                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
    }

    listNamesDifferentFilterPathSuccess (done) {
        // Set the current working directory to the "valid resources" directory.
        options.setGlobalOptions({"workingDir": UnitTest.VALID_RESOURCES_DIRECTORY});

        // Create a stub for fs.existsSync that will return true.
        const stubExists = sinon.stub(fs, "existsSync");
        stubExists.withArgs(assetsFS.getAssetsPath(UnitTest.VALID_RESOURCES_DIRECTORY)).returns(true);

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
        assetsFS.listNames(filter, {"filterPath": "test_1/"})
            .then(function (paths) {
                // Verify that the get stub was called once with the lookup URI.
                expect(stub).to.have.been.calledOnce;

                // Verify that the expected values are returned.
                expect(paths).to.have.lengthOf(3);
                expect(paths[0]).to.be.oneOf([AssetsUnitTest.ASSET_JPG_1, AssetsUnitTest.ASSET_CSS_1, AssetsUnitTest.ASSET_CSS_2]);
                expect(paths[1]).to.be.oneOf([AssetsUnitTest.ASSET_JPG_1, AssetsUnitTest.ASSET_CSS_1, AssetsUnitTest.ASSET_CSS_2]);
                expect(paths[2]).to.be.oneOf([AssetsUnitTest.ASSET_JPG_1, AssetsUnitTest.ASSET_CSS_1, AssetsUnitTest.ASSET_CSS_2]);
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
                UnitTest.restoreOptions();

                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
    }

    listNamesDefaultFilterAdditiveSuccess (done) {
        // Set the current working directory to the "valid resources" directory.
        options.setGlobalOptions({"workingDir": UnitTest.VALID_RESOURCES_DIRECTORY});

        // Create a stub for fs.existsSync that will return true for the specified working directory and false for the assets ignore file.
        const stubExists = sinon.stub(fs, "existsSync");
        stubExists.withArgs(assetsFS.getAssetsPath()).returns(true);
        stubExists.withArgs(assetsFS.getAssetsPath() + ".wchtoolsignore").returns(false);

        this.addTestDouble(stubExists);

        // Create a stub for fs.readFileSync that will return ignore rules for the default ignore file.
        const originalReadFileSync = fs.readFileSync;
        const stubRead = sinon.stub(fs, "readFileSync", function (filename, options) {
            if (filename === UnitTest.API_PATH + "lib" + path.sep + ".wchtoolsignore") {
                return "*.jpg";
            } else {
                // Return the contents of the specified file.
                return originalReadFileSync.call(fs, filename, options);
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
        assetsFS.listNames(null, {"is_ignore_additive": true})
            .then(function (paths) {
                // Verify that the get stub was called once with the lookup URI.
                expect(stub).to.have.been.calledOnce;
                expect(stub.firstCall.args[0]).to.equal(assetsFS.getAssetsPath());

                // Verify that the expected values are returned.
                expect(paths).to.have.lengthOf(2);
                expect(paths[0]).to.be.oneOf([AssetsUnitTest.ASSET_CSS_1, AssetsUnitTest.ASSET_HTML_1]);
                expect(paths[1]).to.be.oneOf([AssetsUnitTest.ASSET_CSS_1, AssetsUnitTest.ASSET_HTML_1]);
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
                UnitTest.restoreOptions();

                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
    }

    listNamesDefaultFilterNotAdditiveSuccess (done) {
        // Set the current working directory to the "valid resources" directory.
        options.setGlobalOptions({"workingDir": UnitTest.VALID_RESOURCES_DIRECTORY});

        // Create a stub for fs.existsSync that will return true for the specified working directory and false for the assets ignore file.
        const stubExists = sinon.stub(fs, "existsSync");
        stubExists.withArgs(assetsFS.getAssetsPath()).returns(true);
        stubExists.withArgs(assetsFS.getAssetsPath() + ".wchtoolsignore").returns(false);

        this.addTestDouble(stubExists);

        // Create a stub for fs.readFileSync that will return ignore rules for the default ignore file.
        const originalReadFileSync = fs.readFileSync;
        const stubRead = sinon.stub(fs, "readFileSync", function (filename, options) {
            if (filename === UnitTest.API_PATH + "lib" + path.sep + ".wchtoolsignore") {
                return "*.jpg";
            } else {
                // Return the contents of the specified file.
                return originalReadFileSync.call(fs, filename, options);
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
        assetsFS.listNames(null, {"is_ignore_additive": false})
            .then(function (paths) {
                // Verify that the get stub was called once with the lookup URI.
                expect(stub).to.have.been.calledOnce;
                expect(stub.firstCall.args[0]).to.equal(assetsFS.getAssetsPath());

                // Verify that the expected values are returned.
                expect(paths).to.have.lengthOf(2);
                expect(paths[0]).to.be.oneOf([AssetsUnitTest.ASSET_CSS_1, AssetsUnitTest.ASSET_HTML_1]);
                expect(paths[1]).to.be.oneOf([AssetsUnitTest.ASSET_CSS_1, AssetsUnitTest.ASSET_HTML_1]);
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
                UnitTest.restoreOptions();

                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
    }

    listNamesAssetsFilterAdditiveSuccess (done) {
        // Set the current working directory to the "valid resources" directory.
        options.setGlobalOptions({"workingDir": UnitTest.VALID_RESOURCES_DIRECTORY});

        // Create a stub for fs.existsSync that will return true for the specified working directory and false for the assets ignore file.
        const stubExists = sinon.stub(fs, "existsSync");
        stubExists.withArgs(assetsFS.getAssetsPath()).returns(true);
        stubExists.withArgs(assetsFS.getAssetsPath() + ".wchtoolsignore").returns(true);

        this.addTestDouble(stubExists);

        // Create a stub for fs.readFileSync that will return ignore rules for the two ignore files.
        const originalReadFileSync = fs.readFileSync;
        const stubRead = sinon.stub(fs, "readFileSync", function (filename, options) {
            if (filename === UnitTest.API_PATH + "lib" + path.sep + ".wchtoolsignore") {
                return "*.jpg";
            } else if (filename === assetsFS.getAssetsPath() + ".wchtoolsignore") {
                return "*.css";
            } else {
                // Return the contents of the specified file.
                return originalReadFileSync.call(fs, filename, options);
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
        assetsFS.listNames(null, {"is_ignore_additive": true})
            .then(function (paths) {
                // Verify that the get stub was called once with the lookup URI.
                expect(stub).to.have.been.calledOnce;
                expect(stub.firstCall.args[0]).to.equal(assetsFS.getAssetsPath());

                // Verify that the expected values are returned.
                expect(paths).to.have.lengthOf(1);
                expect(paths[0]).to.equal(AssetsUnitTest.ASSET_HTML_1);
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
                UnitTest.restoreOptions();

                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
    }

    listNamesAssetsFilterNotAdditiveSuccess (done) {
        // Set the current working directory to the "valid resources" directory.
        options.setGlobalOptions({"workingDir": UnitTest.VALID_RESOURCES_DIRECTORY});

        // Create a stub for fs.existsSync that will return true for the specified working directory and false for the assets ignore file.
        const stubExists = sinon.stub(fs, "existsSync");
        stubExists.withArgs(assetsFS.getAssetsPath()).returns(true);
        stubExists.withArgs(assetsFS.getAssetsPath() + ".wchtoolsignore").returns(true);

        this.addTestDouble(stubExists);

        // Create a stub for fs.readFileSync that will return ignore rules for the two ignore files.
        const originalReadFileSync = fs.readFileSync;
        const stubRead = sinon.stub(fs, "readFileSync", function (filename, options) {
            if (filename === UnitTest.API_PATH + "lib" + path.sep + ".wchtoolsignore") {
                return "*.jpg";
            } else if (filename === assetsFS.getAssetsPath() + ".wchtoolsignore") {
                return "*.css";
            } else {
                // Return the contents of the specified file.
                return originalReadFileSync.call(fs, filename, options);
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
        assetsFS.listNames(null, {"is_ignore_additive": false})
            .then(function (paths) {
                // Verify that the get stub was called once with the lookup URI.
                expect(stub).to.have.been.calledOnce;
                expect(stub.firstCall.args[0]).to.equal(assetsFS.getAssetsPath());

                // Verify that the expected values are returned.
                expect(paths).to.have.lengthOf(2);
                expect(paths[0]).to.be.oneOf([AssetsUnitTest.ASSET_JPG_1, AssetsUnitTest.ASSET_HTML_1]);
                expect(paths[1]).to.be.oneOf([AssetsUnitTest.ASSET_JPG_1, AssetsUnitTest.ASSET_HTML_1]);
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
                UnitTest.restoreOptions();

                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
    }

    listNamesAssetsFilterAdditiveDefaultSuccess (done) {
        // Set the current working directory to the "valid resources" directory.
        options.setGlobalOptions({"workingDir": UnitTest.VALID_RESOURCES_DIRECTORY});

        // Create a stub for fs.existsSync that will return true for the specified working directory and false for the assets ignore file.
        const stubExists = sinon.stub(fs, "existsSync");
        stubExists.withArgs(assetsFS.getAssetsPath()).returns(true);
        stubExists.withArgs(assetsFS.getAssetsPath() + ".wchtoolsignore").returns(true);

        this.addTestDouble(stubExists);

        // Create a stub for fs.readFileSync that will return ignore rules for the two ignore files.
        const originalReadFileSync = fs.readFileSync;
        const stubRead = sinon.stub(fs, "readFileSync", function (filename, options) {
            if (filename === UnitTest.API_PATH + "lib" + path.sep + ".wchtoolsignore") {
                return "*.jpg";
            } else if (filename === assetsFS.getAssetsPath() + ".wchtoolsignore") {
                return "*.css";
            } else {
                // Return the contents of the specified file.
                return originalReadFileSync.call(fs, filename, options);
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
        assetsFS.listNames()
            .then(function (paths) {
                // Verify that the get stub was called once with the lookup URI.
                expect(stub).to.have.been.calledOnce;
                expect(stub.firstCall.args[0]).to.equal(assetsFS.getAssetsPath());

                // Verify that the expected values are returned.
                expect(paths).to.have.lengthOf(1);
                expect(paths[0]).to.equal(AssetsUnitTest.ASSET_HTML_1);
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
                UnitTest.restoreOptions();

                // Call mocha's done function to indicate that the test is over.
                done(error);
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
                assetsFS.getFileStats(AssetsUnitTest.ASSET_JAR_1)
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
                assetsFS.getFileStats(AssetsUnitTest.ASSET_PNG_1)
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
                assetsFS.getContentLength(AssetsUnitTest.ASSET_JAR_1, UnitTest.DUMMY_OPTIONS)
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
                // Create a stub for assetsFS.getFileStats to return values.
                const stub = sinon.stub(assetsFS, "getFileStats");
                stub.resolves({"size": 128});

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsFS.getContentLength(AssetsUnitTest.ASSET_JAR_1, UnitTest.DUMMY_OPTIONS)
                    .then(function (size) {
                        // Verify that the stub was called once with the specified path.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.args[0][0]).to.contain(AssetsUnitTest.ASSET_JAR_1);

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
