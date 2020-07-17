/*
Copyright IBM Corporation 2016, 2018

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
 * Unit tests for the assetsHelper object.
 *
 * NOTE: The EventEmitter used by the assetsHelper object is used to execute some of the tests,
 *       so the provided functionality is not stubbed out.
 */
"use strict";

// Require the super classes for this class.
const UnitTest = require("./base.unit.js");
const AssetsUnitTest = require("./assets.unit.js");

// Require the node modules used in this test file.
const events = require("events");
const fs = require("fs");
const mkdirp = require("mkdirp");
const stream = require("stream");
const diff = require("diff");
const sinon = require("sinon");
const Q = require("q");
const options = require(UnitTest.API_PATH + "lib/utils/options.js");
const utils = require(UnitTest.API_PATH + "lib/utils/utils.js");
const hashes = require(UnitTest.API_PATH + "lib/utils/hashes.js");

// Require the local modules that will be stubbed, mocked, and spied.
const assetsFS = require(UnitTest.API_PATH + "lib/assetsFS.js").instance;
const assetsREST = require(UnitTest.API_PATH + "lib/assetsREST.js").instance;
const searchREST = require(UnitTest.API_PATH + "lib/authoringSearchREST.js").instance;

// Require the local module being tested.
const assetsHelper = require(UnitTest.API_PATH + "assetsHelper.js").instance;

// Stub mkdirp to guard against creating an assets directory.
let stubMkdirp;

// Stubs for the hashes methods.
let stubGenerateMD5Hash;
let stubGenerateMD5HashAndID;
let stubGenerateMD5HashFromStream;
let stubUpdateHashes;
let stubUpdateResourceHashes;
let stubGetLastPull;
let stubSetLastPull;
let stubGetMD5ForFile;
let stubGetResourceMD5ForFile;
let stubGetPathForResource;
let stubListFiles;
let stubIsLocalModified;
let stubIsRemoteModified;
let stubcompareMD5Hashes;

// The default API context used for unit tests.
const context = UnitTest.DEFAULT_API_CONTEXT;

class AssetsHelperUnitTest extends AssetsUnitTest {
    constructor () {
        super();
    }

    run () {
        const self = this;
        describe("Unit tests for assetsHelper.js", function () {
            // Initialize common resourses before running any unit tests.
            before(function (done) {
                // Create a mkdirp.sync stub that returns an undefined value.
                stubMkdirp = sinon.stub(mkdirp, "sync");
                stubMkdirp.returns(undefined);

                // Signal that the initialization is complete.
                done();
            });

            // Initialize common resourses before running each unit test.
            beforeEach(function (done) {
                // Stub all public hashes methods so that the unit tests do not create any files or directories. These
                // stubs are created before each test (and restored after each test) to allow for hashes expectations.
                stubGenerateMD5Hash = sinon.stub(hashes, "generateMD5Hash");
                stubGenerateMD5Hash.resolves(undefined);
                self.addTestDouble(stubGenerateMD5Hash);

                stubGenerateMD5HashAndID = sinon.stub(hashes, "generateMD5HashAndID");
                stubGenerateMD5HashAndID.resolves({ md5: undefined, id: undefined });
                self.addTestDouble(stubGenerateMD5HashAndID);

                stubGenerateMD5HashFromStream = sinon.stub(hashes, "generateMD5HashFromStream");
                stubGenerateMD5HashFromStream.resolves(undefined);
                self.addTestDouble(stubGenerateMD5HashFromStream);

                stubUpdateHashes = sinon.stub(hashes, "updateHashes");
                stubUpdateHashes.returns(undefined);
                self.addTestDouble(stubUpdateHashes);

                stubUpdateResourceHashes = sinon.stub(hashes, "updateResourceHashes");
                stubUpdateResourceHashes.returns(undefined);
                self.addTestDouble(stubUpdateResourceHashes);

                stubGetLastPull = sinon.stub(hashes, "getLastPullTimestamp");
                stubGetLastPull.returns(undefined);
                self.addTestDouble(stubGetLastPull);

                stubSetLastPull = sinon.stub(hashes, "setLastPullTimestamp");
                self.addTestDouble(stubSetLastPull);

                stubGetMD5ForFile = sinon.stub(hashes, "getMD5ForFile");
                stubGetMD5ForFile.returns(undefined);
                self.addTestDouble(stubGetMD5ForFile);

                stubGetResourceMD5ForFile = sinon.stub(hashes, "getResourceMD5ForFile");
                stubGetMD5ForFile.returns(undefined);
                self.addTestDouble(stubGetResourceMD5ForFile);

                stubGetPathForResource = sinon.stub(hashes, "getPathForResource");
                stubGetPathForResource.returns(undefined);
                self.addTestDouble(stubGetPathForResource);

                stubListFiles = sinon.stub(hashes, "listFiles");
                stubListFiles.returns([]);
                self.addTestDouble(stubListFiles);

                stubIsLocalModified = sinon.stub(hashes, "isLocalModified");
                stubIsLocalModified.returns(true);
                self.addTestDouble(stubIsLocalModified);

                stubIsRemoteModified = sinon.stub(hashes, "isRemoteModified");
                stubIsRemoteModified.returns(true);
                self.addTestDouble(stubIsRemoteModified);

                stubcompareMD5Hashes = sinon.stub(hashes, "compareMD5Hashes");
                stubcompareMD5Hashes.returns(true);
                self.addTestDouble(stubcompareMD5Hashes);

                // Signal that the initialization is complete.
                done();
            });

            // Cleanup common resourses consumed by a test.
            afterEach(function (done) {
                // Restore any stubs and spies used for the test.
                self.restoreTestDoubles();

                // Reset the state of the options, to remove any values that may have been set during the test.
                options.initialize(context);

                // Signal that the cleanup is complete.
                done();
            });

            // Cleanup common resourses created in the before function.
            after(function (done) {
                stubMkdirp.restore();

                // Signal that the cleanup is complete.
                done();
            });

            // Run each of the tests defined in this class.
            self.testSingleton();
            self.testEventEmitter();
            self.testCloseStream();
            self.testGetName();
            self.testGetVirtualFolderName();
            self.testPullAsset();
            self.testPullAllAssets();
            self.testPullModifiedAssets();
            self.testPullManifestItems();
            self.testPullResources();
            self.testPushAsset();
            self.testPushAllAssets();
            self.testPushModifiedAssets();
            self.testPushAllResources();
            self.testPushModifiedResources();
            self.testListRemoteAssetNames();
            self.testListRemoteDeletedAssetNames();
            self.testListModifiedRemoteAssetNames();
            self.testListLocalAssetNames();
            self.testListLocalModifiedAssetNames();
            self.testListDeletedLocalAssetNames();
            self.testDeleteLocalItem();
            self.testDeleteLocalResource();
            self.testCanDeleteItem();
            self.testfilterRetry();
            self.testDeleteRemoteAsset();
            self.testSearchRemoteAsset();
            self.testTimestamps();
            self.testCompare();
        });
    }

    testSingleton () {
        describe("is a singleton", function () {
            it("should fail if try to create a helper", function (done) {
                let error;
                try {
                    const newHelper = new assetsHelper.constructor();
                    if (newHelper) {
                        error = "The constructor should have failed.";
                    } else {
                        error = "The constructor should have thrown an error.";
                    }
                } catch (e){
                    expect(e).to.equal("An instance of singleton class " + assetsHelper.constructor.name + " cannot be constructed");
                }

                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
        });
    }

    testEventEmitter () {
        describe("event emitter", function () {
            it("should call registered functions when an event is emitted.", function () {
                // Setup several spies to listen for emitted events.
                const spyA1 = sinon.spy();
                const spyA2 = sinon.spy();
                const spyB = sinon.spy();
                const spyC = sinon.spy();

                // Use some events that are just for testing, they don't need to correspond to actual system events.
                const eventEmitter = assetsHelper.getEventEmitter(context);
                eventEmitter.on("A", spyA1);
                eventEmitter.on("A", spyA2);
                eventEmitter.on("B", spyB);
                eventEmitter.on("C", spyC);

                // Emit several of the test events.
                eventEmitter.emit("A", "foo");
                eventEmitter.emit("B", {"foo": "bar"});
                eventEmitter.emit("B", {"foo": "fighters"});
                eventEmitter.emit("C", 1);
                eventEmitter.emit("C", 2);
                eventEmitter.emit("C", 3);

                // Use the spies to test that the event emitter behaved as expected.
                expect(spyA1).to.have.been.calledOnce;
                expect(spyA1.firstCall.args[0]).to.equal("foo");
                expect(spyA2).to.have.been.calledOnce;
                expect(spyA2.firstCall.args[0]).to.equal("foo");
                expect(spyA1).to.have.been.calledBefore(spyA2);

                expect(spyB).to.have.been.calledTwice;
                expect(spyB.firstCall.args[0].foo).to.equal("bar");
                expect(spyB.secondCall.args[0].foo).to.equal("fighters");
                expect(spyB).to.have.been.calledAfter(spyA2);

                expect(spyC).to.have.been.calledThrice;
                expect(spyC.firstCall.args[0]).to.equal(1);
                expect(spyC.secondCall.args[0]).to.equal(2);
                expect(spyC.thirdCall.args[0]).to.equal(3);
                expect(spyC).to.have.been.calledAfter(spyB);

                eventEmitter.removeListener("A", spyA1);
                eventEmitter.removeListener("A", spyA2);
                eventEmitter.removeListener("B", spyB);
                eventEmitter.removeListener("C", spyC);
            });
        });
    }

    testCloseStream () {
        const self = this;

        describe("_closeStream", function () {
            it("should succeed if no stream is specified.", function (done) {
                let error;
                try {
                    assetsHelper._closeStream(context, undefined);
                } catch (err) {
                    error = err;
                } finally {
                    done(error);
                }
            });

            it("should succeed if no promise is specified.", function (done) {
                let error;
                const stream = AssetsUnitTest.DUMMY_STREAM;
                try {
                    assetsHelper._closeStream(context, stream, undefined);
                } catch (err) {
                    error = err;
                } finally {
                    done(error);
                }
            });

            it("should log an error if the stream operation fails.", function (done) {
                let error;
                const stream = AssetsUnitTest.DUMMY_STREAM;

                // Create a stream.resume stub to throw an error.
                const RESUME_ERROR = "There was an error resuming the stream, as expected by a unit test.";
                const stub = sinon.stub(stream, "resume");
                stub.throws(new Error(RESUME_ERROR));

                // Create a logger.debug spy.
                const logger = assetsHelper.getLogger(context);
                const spy = sinon.spy(logger, "debug");

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stub);
                self.addTestDouble(spy);

                try {
                    assetsHelper._closeStream(context, stream, undefined);
                    expect(stub).to.have.been.calledOnce;
                    expect(spy).to.have.been.calledOnce;
                    expect(spy.args[0][1].message).to.equal(RESUME_ERROR)
                } catch (err) {
                    error = err;
                } finally {
                    done(error);
                }
            });
        });
    }

    testGetName () {
        describe("getName", function () {
            it("should return the item path as the name.", function (done) {
                let error;
                try {
                    const item = {"id": UnitTest.DUMMY_ID, "name": UnitTest.DUMMY_NAME, "path": UnitTest.DUMMY_PATH};
                    const name = assetsHelper.getName(item);
                    expect(name).to.equal(UnitTest.DUMMY_PATH);
                } catch (err) {
                    error = err;
                } finally {
                    done(error);
                }
            });
        });
    }

    testGetVirtualFolderName () {
        const self = this;
        describe("getVirtualFolderName", function () {
            it("should get the asset folder name from the FS API.", function () {
                // Create an assetsFS.getFolderName stub that returns the folder name.
                const FAKE_FOLDER_NAME = "Fake name for the assets folder.";
                const stub = sinon.stub(assetsFS, "getFolderName");
                stub.returns(FAKE_FOLDER_NAME);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                const folderName = assetsHelper.getVirtualFolderName(context);

                // Verify that the stub was called and that the helper returned the expected value.
                expect(stub).to.have.been.calledOnce;
                expect(folderName).to.equal(FAKE_FOLDER_NAME);
            });
        });
    }

    testPullAsset () {
        const self = this;
        describe("pullItemByPath", function () {
            it("should fail when getting the items fails.", function (done) {
                // Create an assetsREST.getItems stub that returns an error.
                const stub = sinon.stub(assetsREST, "getItems");
                const ASSET_ERROR = "There was an error getting the remote items.";
                stub.rejects(ASSET_ERROR);

                // Create an assetsFS.getItemWriteStream spy.
                const spy = sinon.spy(assetsFS, "getItemWriteStream");

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stub);
                self.addTestDouble(spy);

                // Call the method being tested.
                let error;
                assetsHelper.pullItemByPath(context, UnitTest.DUMMY_PATH, UnitTest.DUMMY_OPTIONS)
                    .then(function (/*asset*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the pulled asset should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.equal(ASSET_ERROR);

                            // Verify that the stub was called.
                            expect(stub).to.have.been.called;

                            // Verify that the spy was not called.
                            expect(spy).to.not.have.been.called;
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when getting a chunk of items fails.", function (done) {
                // Create an assetsREST.getItems stub that returns an error the second time.
                const stub = sinon.stub(assetsREST, "getItems");
                const assetMetadataPath1 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_GIF_1;
                const assetMetadataPath2 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JPG_1;
                const assetMetadata1 = UnitTest.getJsonObject(assetMetadataPath1);
                const assetMetadata2 = UnitTest.getJsonObject(assetMetadataPath2);
                const ASSET_ERROR = "There was an error getting the remote items.";
                stub.onCall(0).resolves([assetMetadata1, assetMetadata2]);
                stub.onCall(1).rejects(ASSET_ERROR);

                // Create an assetsFS.getItemWriteStream spy.
                const spy = sinon.spy(assetsFS, "getItemWriteStream");

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stub);
                self.addTestDouble(spy);

                // Call the method being tested.
                let error;
                assetsHelper.pullItemByPath(context, UnitTest.DUMMY_PATH, {offset: 0, limit: 2})
                    .then(function (/*asset*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the pulled asset should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.equal(ASSET_ERROR);

                            // Verify that the stub was called.
                            expect(stub).to.have.been.calledTwice;

                            // Verify that the spy was not called.
                            expect(spy).to.not.have.been.called;
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when the specified asset is not found.", function (done) {
                // Read the contents of four valid test asset metadata files.
                const assetMetadataPath1 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_GIF_1;
                const assetMetadataPath2 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JPG_1;
                const assetMetadataPath3 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_PNG_1;
                const assetMetadataPath4 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JAR_1;
                const assetMetadata1 = UnitTest.getJsonObject(assetMetadataPath1);
                const assetMetadata2 = UnitTest.getJsonObject(assetMetadataPath2);
                const assetMetadata3 = UnitTest.getJsonObject(assetMetadataPath3);
                const assetMetadata4 = UnitTest.getJsonObject(assetMetadataPath4);

                // Create an assetsREST.getItems stub that returns a promise for the metadata of the assets.
                const stub = sinon.stub(assetsREST, "getItems");
                stub.resolves([assetMetadata1, assetMetadata2, assetMetadata3]);

                // Create an assetsFS.getItemWriteStream spy.
                const spy = sinon.spy(assetsFS, "getItemWriteStream");

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stub);
                self.addTestDouble(spy);

                // Call the method being tested with an invalid name.
                let error;
                assetsHelper.pullItemByPath(context, assetMetadata4.path, UnitTest.DUMMY_OPTIONS)
                    .then(function (/*asset*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the pulled asset should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.contain("Remote asset not found");

                            // Verify that the stub was called.
                            expect(stub).to.have.been.called;

                            // Verify that the spy was not called.
                            expect(spy).to.not.have.been.called;
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when no path is specified.", function (done) {
                // Read the contents of a test asset metadata file that has no path.
                const assetMetadataPath = AssetsUnitTest.INVALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_INVALID_PATH_1;
                const assetMetadata = UnitTest.getJsonObject(assetMetadataPath);

                // Create an assetsREST.getItems stub that returns a promise for the metadata.
                const stub = sinon.stub(assetsREST, "getItems");
                stub.resolves([assetMetadata]);

                // Create an assetsFS.getItemWriteStream spy.
                const spy = sinon.spy(assetsFS, "getItemWriteStream");

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stub);
                self.addTestDouble(spy);

                // Call the method being tested with an invalid name.
                let error;
                assetsHelper.pullItemByPath(context, assetMetadata.path, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the pulled asset should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");

                        // Verify that the stub was called.
                        expect(stub).to.have.been.called;

                        // Verify that the spy was not called.
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

            it("should fail when a path with invalid characters is specified. " + AssetsUnitTest.INVALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_INVALID_PATH_2, function (done) {
                // Read the contents of an invalid test asset metadata file that has invalid path characters.
                const assetMetadataPath = AssetsUnitTest.INVALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_INVALID_PATH_2;
                const assetMetadata = UnitTest.getJsonObject(assetMetadataPath);

                // Create an assetsREST.getItems stub that returns a promise for the metadata.
                const stub = sinon.stub(assetsREST, "getItems");
                stub.resolves([assetMetadata]);

                // Windows is where we have invalid char issues, so test that path
                const stub2 = sinon.stub(utils, "isWindows");
                stub2.returns(true);

                // Create an assetsFS.getItemWriteStream spy.
                const spy = sinon.spy(assetsFS, "getItemWriteStream");

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stub);
                self.addTestDouble(stub2);
                self.addTestDouble(spy);

                // Call the method being tested with an invalid name.
                let error;
                assetsHelper.pullItemByPath(context, assetMetadata.path, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the pulled asset should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");

                        // Verify that the stub was called.
                        expect(stub).to.have.been.called;

                        // Verify that the spy was not called.
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

            it("should fail when a path containing 'http:' is specified.", function (done) {
                // Read the contents of an invalid test asset metadata file that has a path containing "http:".
                const assetMetadataPath = AssetsUnitTest.INVALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_INVALID_PATH_3;
                const assetMetadata = UnitTest.getJsonObject(assetMetadataPath);

                // Create an assetsREST.getItems stub that returns a promise for the metadata of the assets.
                const stubGet = sinon.stub(assetsREST, "getItems");
                stubGet.resolves([assetMetadata]);

                // Create an assetsFS.getAssetPath stub that returns the invalid path.
                const stubPath = sinon.stub(assetsFS, "getAssetPath");
                stubPath.returns(assetMetadata.path);

                // Create an assetsFS.getItemWriteStream spy.
                const spy = sinon.spy(assetsFS, "getItemWriteStream");

                // The stubs and spy should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubPath);
                self.addTestDouble(spy);

                // Call the method being tested with an invalid name.
                let error;
                assetsHelper.pullItemByPath(context, assetMetadata.path, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the pulled asset should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");

                        // Verify that the stub was called.
                        expect(stubGet).to.have.been.called;

                        // Verify that the spy was not called.
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

            it("should fail when a path containing 'https:' is specified.", function (done) {
                // Read the contents of an invalid test asset metadata file that has a path containing "https:".
                const assetMetadataPath = AssetsUnitTest.INVALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_INVALID_PATH_4;
                const assetMetadata = UnitTest.getJsonObject(assetMetadataPath);

                // Create an assetsREST.getItems stub that returns a promise for the metadata of the assets.
                const stubGet = sinon.stub(assetsREST, "getItems");
                stubGet.resolves([assetMetadata]);

                // Create an assetsFS.getAssetPath stub that returns the invalid path.
                const stubPath = sinon.stub(assetsFS, "getAssetPath");
                stubPath.returns(assetMetadata.path);

                // Create an assetsFS.getItemWriteStream spy.
                const spy = sinon.spy(assetsFS, "getItemWriteStream");

                // The stubs and spy should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubPath);
                self.addTestDouble(spy);

                // Call the method being tested with an invalid name.
                let error;
                assetsHelper.pullItemByPath(context, assetMetadata.path, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the pulled asset should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");

                        // Verify that the stub was called.
                        expect(stubGet).to.have.been.called;

                        // Verify that the spy was not called.
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

            it("should fail if there is an error getting the write stream for the asset.", function (done) {
                // Read the contents of four valid test asset metadata files.
                const assetMetadataPath1 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_GIF_1;
                const assetMetadataPath2 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JPG_1;
                const assetMetadataPath3 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_PNG_1;
                const assetMetadataPath4 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JAR_1;
                const assetMetadata1 = UnitTest.getJsonObject(assetMetadataPath1);
                const assetMetadata2 = UnitTest.getJsonObject(assetMetadataPath2);
                const assetMetadata3 = UnitTest.getJsonObject(assetMetadataPath3);
                const assetMetadata4 = UnitTest.getJsonObject(assetMetadataPath4);

                // Create an assetsREST.getItems stub that returns a promise for the metadata of the assets.
                const stubREST = sinon.stub(assetsREST, "getItems");
                stubREST.resolves([assetMetadata1, assetMetadata2, assetMetadata3, assetMetadata4]);

                // Create an assetsFS.getItemWriteStream stub.
                const stubFS = sinon.stub(assetsFS, "getItemWriteStream");
                const STREAM_ERROR = "There was an error creating the write stream.";
                stubFS.rejects(STREAM_ERROR);

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stubREST);
                self.addTestDouble(stubFS);

                // Call the method being tested with an invalid name.
                let error;
                assetsHelper.pullItemByPath(context, assetMetadata1.path, UnitTest.DUMMY_OPTIONS)
                    .then(function (/*asset*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the pulled asset should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.equal(STREAM_ERROR);

                            // Verify that both stubs were called once, and the FS stub was called with the specified path.
                            expect(stubREST).to.have.been.calledOnce;
                            expect(stubFS).to.have.been.calledOnce;
                            expect(stubFS.args[0][1]).to.equal(assetMetadata1);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail if there is an error pulling the asset.", function (done) {
                // Read the contents of four valid test asset metadata files.
                const assetMetadataPath1 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_GIF_1;
                const assetMetadataPath2 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JPG_1;
                const assetMetadataPath3 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_PNG_1;
                const assetMetadataPath4 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JAR_1;
                const assetMetadata1 = UnitTest.getJsonObject(assetMetadataPath1);
                const assetMetadata2 = UnitTest.getJsonObject(assetMetadataPath2);
                const assetMetadata3 = UnitTest.getJsonObject(assetMetadataPath3);
                const assetMetadata4 = UnitTest.getJsonObject(assetMetadataPath4);

                // Create an assetsREST.getItems stub that returns a promise for the metadata of the assets.
                const stubItems = sinon.stub(assetsREST, "getItems");
                stubItems.resolves([assetMetadata1, assetMetadata2, assetMetadata3, assetMetadata4]);

                // Create an assetsFS.getItemWriteStream stub.
                const stubStream = sinon.stub(assetsFS, "getItemWriteStream");
                const stream = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG = "unique.id";
                stream.tag = STREAM_TAG;
                stubStream.resolves(stream);

                // Create an assetsREST.pullItem stub.
                const stubPull = sinon.stub(assetsREST, "pullItem");
                const ASSET_ERROR = "There was an error pulling the item.";
                stubPull.rejects(ASSET_ERROR);

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stubItems);
                self.addTestDouble(stubStream);
                self.addTestDouble(stubPull);

                // Call the method being tested with an invalid name.
                let error;
                assetsHelper.pullItemByPath(context, assetMetadata2.path, UnitTest.DUMMY_OPTIONS)
                    .then(function (/*asset*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the pulled asset should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.equal(ASSET_ERROR);

                            // Verify that all stubs were called once, and with the expected values.
                            expect(stubItems).to.have.been.calledOnce;
                            expect(stubStream).to.have.been.calledOnce;
                            expect(stubPull).to.have.been.calledOnce;
                            expect(stubStream.args[0][1]).to.equal(assetMetadata2);
                            expect(diff.diffJson(stubPull.args[0][1], assetMetadata2)).to.have.lengthOf(1);
                            expect(stubPull.args[0][2].tag).to.equal(STREAM_TAG);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail if the MD5 comparison fails.", function (done) {
                // Read the contents of four valid test asset metadata files.
                const assetMetadataPath1 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_GIF_1;
                const assetMetadataPath2 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JPG_1;
                const assetMetadataPath3 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_PNG_1;
                const assetMetadataPath4 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JAR_1;
                const assetMetadata1 = UnitTest.getJsonObject(assetMetadataPath1);
                const assetMetadata2 = UnitTest.getJsonObject(assetMetadataPath2);
                const assetMetadata3 = UnitTest.getJsonObject(assetMetadataPath3);
                const assetMetadata4 = UnitTest.getJsonObject(assetMetadataPath4);

                // Create an assetsREST.getItems stub that returns a promise for the metadata of the assets.
                const stubItems = sinon.stub(assetsREST, "getItems");
                stubItems.resolves([assetMetadata1, assetMetadata2, assetMetadata3, assetMetadata4]);

                // Create an assetsFS.getItemWriteStream stub.
                const stubStream = sinon.stub(assetsFS, "getItemWriteStream");
                const stream = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG = "unique.id";
                stream.tag = STREAM_TAG;
                stubStream.resolves(stream);

                // Create an assetsREST.pullItem stub that return asset metadata.
                const stubPull = sinon.stub(assetsREST, "pullItem", function () {
                    stream.emit("pipe");
                    const d = Q.defer();
                    d.resolve(assetMetadata3);
                    return d.promise;
                });

                // Change the MD5 stub to return false.
                stubcompareMD5Hashes.returns(false);

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stubItems);
                self.addTestDouble(stubStream);
                self.addTestDouble(stubPull);

                // Call the method being tested with an invalid name.
                let error;
                assetsHelper.pullItemByPath(context, assetMetadata2.path, UnitTest.DUMMY_OPTIONS)
                    .then(function (/*asset*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the pulled asset should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.contain("does not match server digest");

                            // Verify that all stubs were called once, and with the expected values.
                            expect(stubItems).to.have.been.calledOnce;
                            expect(stubStream).to.have.been.calledOnce;
                            expect(stubPull).to.have.been.calledOnce;
                            expect(stubStream.args[0][1]).to.equal(assetMetadata2);
                            expect(diff.diffJson(stubPull.args[0][1], assetMetadata2)).to.have.lengthOf(1);
                            expect(stubPull.args[0][2].tag).to.equal(STREAM_TAG);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when pulling an asset.", function (done) {
                // Read the contents of four valid test asset metadata files.
                const assetMetadataPath1 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_GIF_1;
                const assetMetadataPath2 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JPG_1;
                const assetMetadataPath3 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_PNG_1;
                const assetMetadataPath4 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JAR_1;
                const assetMetadata1 = UnitTest.getJsonObject(assetMetadataPath1);
                const assetMetadata2 = UnitTest.getJsonObject(assetMetadataPath2);
                const assetMetadata3 = UnitTest.getJsonObject(assetMetadataPath3);
                const assetMetadata4 = UnitTest.getJsonObject(assetMetadataPath4);

                // Create an assetsREST.getItems stub that returns a promise for the metadata of the assets.
                const stubItems = sinon.stub(assetsREST, "getItems");
                stubItems.onCall(0).resolves([assetMetadata1, assetMetadata2]);
                stubItems.onCall(1).resolves([assetMetadata3, assetMetadata4]);
                stubItems.onCall(2).resolves([]);

                // Create an assetsFS.getItemWriteStream stub that returns a stream.
                const stubStream = sinon.stub(assetsFS, "getItemWriteStream");
                const stream = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG = "unique.id";
                stream.tag = STREAM_TAG;
                stubStream.resolves(stream);

                // Create an assetsREST.pullItem stub that return asset metadata.
                const stubPull = sinon.stub(assetsREST, "pullItem", function () {
                    stream.emit("pipe");
                    const d = Q.defer();
                    d.resolve(assetMetadata3);
                    return d.promise;
                });

                // Create an assetsFS.saveItem spy to make sure it doesn't get called.
                const spySave = sinon.spy(assetsFS, "saveItem");

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stubItems);
                self.addTestDouble(stubStream);
                self.addTestDouble(stubPull);
                self.addTestDouble(spySave);

                // Call the method being tested with an invalid name.
                let error;
                assetsHelper.pullItemByPath(context, assetMetadata3.path, {offset: 0, limit: 2})
                    .then(function (asset) {
                        // Verify that the helper returned the expected value.
                        expect(diff.diffJson(asset, assetMetadata3)).to.have.lengthOf(1);

                        // Verify that all stubs were called once, and with the expected values.
                        expect(stubItems).to.have.been.calledTwice;
                        expect(stubStream).to.have.been.calledOnce;
                        expect(stubPull).to.have.been.calledOnce;
                        expect(stubUpdateHashes).to.have.been.calledOnce;
                        expect(stubStream.args[0][1]).to.equal(assetMetadata3);
                        expect(diff.diffJson(stubPull.args[0][1], assetMetadata3)).to.have.lengthOf(1);
                        expect(stubPull.args[0][2].tag).to.equal(STREAM_TAG);
                        expect(diff.diffJson(stubUpdateHashes.args[0][3], assetMetadata3)).to.have.lengthOf(1);

                        // Verify that the spy was not called.
                        expect(spySave).to.not.have.been.called;

                        // Verify that the hashes were called as expected.
                        expect(stubUpdateHashes).to.have.been.calledOnce;
                        expect(stubUpdateHashes.firstCall.args[4]).to.contain(AssetsUnitTest.ASSET_PNG_1);
                        expect(stubUpdateHashes.firstCall.args[3].path).to.contain(AssetsUnitTest.ASSET_PNG_1);
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

            it("should fail when saving a content asset fails.", function (done) {
                // Read the contents of four valid test asset metadata files.
                const assetPath1 = AssetsUnitTest.VALID_CONTENT_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_1;
                const assetPath2 = AssetsUnitTest.VALID_CONTENT_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_2;
                const assetPath3 = AssetsUnitTest.VALID_CONTENT_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_3;
                const assetPath4 = AssetsUnitTest.VALID_CONTENT_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_4;
                const assetMetadata1 = UnitTest.getJsonObject(assetPath1 + assetsFS.getExtension());
                const assetMetadata2 = UnitTest.getJsonObject(assetPath2 + assetsFS.getExtension());
                const assetMetadata3 = UnitTest.getJsonObject(assetPath3 + assetsFS.getExtension());
                const assetMetadata4 = UnitTest.getJsonObject(assetPath4 + assetsFS.getExtension());

                // Create an assetsREST.getItems stub that returns a promise for the metadata of the assets.
                const stubItems = sinon.stub(assetsREST, "getItems");
                stubItems.onCall(0).resolves([assetMetadata1, assetMetadata2]);
                stubItems.onCall(1).resolves([assetMetadata3, assetMetadata4]);
                stubItems.onCall(2).resolves([]);

                // Create an assetsFS.getItemWriteStream stub that returns a stream.
                const stubStream = sinon.stub(assetsFS, "getItemWriteStream");
                const stream = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG = "unique.id";
                stream.tag = STREAM_TAG;
                stubStream.resolves(stream);

                // Create an assetsREST.pullItem stub that returns asset metadata.
                const stubPull = sinon.stub(assetsREST, "pullItem", function () {
                    stream.emit("pipe");
                    const d = Q.defer();
                    d.resolve(assetMetadata3);
                    return d.promise;
                });

                // Remove the emitter from the context to make sure the pull does not fail because of a missing emitter.
                const emitter = assetsHelper.getEventEmitter(context);
                delete context.eventEmitter;

                // Create an assetsFS.saveItem stub that rejects with an error.
                const SAVE_ERROR = "There was an error saving the file, as expected by a unit test.";
                const stubSave = sinon.stub(assetsFS, "saveItem");
                stubSave.throws(new Error(SAVE_ERROR));

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stubItems);
                self.addTestDouble(stubStream);
                self.addTestDouble(stubPull);
                self.addTestDouble(stubSave);

                // Call the method being tested with an invalid name.
                let error;
                assetsHelper.pullItemByPath(context, assetMetadata2.path, UnitTest.DUMMY_OPTIONS)
                    .then(function (/*asset*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the pulled asset should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.equal(SAVE_ERROR);

                        // Verify that all stubs were called once, and with the expected values.
                        expect(stubItems).to.have.been.calledOnce;
                        expect(stubStream).to.have.been.calledOnce;
                        expect(stubPull).to.have.been.calledOnce;
                        expect(stubStream.args[0][1]).to.equal(assetMetadata2);
                        expect(diff.diffJson(stubPull.args[0][1], assetMetadata2)).to.have.lengthOf(1);
                        expect(stubPull.args[0][2].tag).to.equal(STREAM_TAG);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Restore the emitter on the context.
                        context.eventEmitter = emitter;

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when pulling a content asset.", function (done) {
                // Read the contents of four valid test asset metadata files.
                const assetPath1 = AssetsUnitTest.VALID_CONTENT_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_1;
                const assetPath2 = AssetsUnitTest.VALID_CONTENT_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_2;
                const assetPath3 = AssetsUnitTest.VALID_CONTENT_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_3;
                const assetPath4 = AssetsUnitTest.VALID_CONTENT_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_4;
                const assetMetadata1 = UnitTest.getJsonObject(assetPath1 + assetsFS.getExtension());
                const assetMetadata2 = UnitTest.getJsonObject(assetPath2 + assetsFS.getExtension());
                const assetMetadata3 = UnitTest.getJsonObject(assetPath3 + assetsFS.getExtension());
                const assetMetadata4 = UnitTest.getJsonObject(assetPath4 + assetsFS.getExtension());

                // Create an assetsREST.getItems stub that returns a promise for the metadata of the assets.
                const stubItems = sinon.stub(assetsREST, "getItems");
                stubItems.onCall(0).resolves([assetMetadata1, assetMetadata2]);
                stubItems.onCall(1).resolves([assetMetadata3, assetMetadata4]);
                stubItems.onCall(2).resolves([]);

                // Create an assetsFS.getItemWriteStream stub that returns a stream.
                const stubStream = sinon.stub(assetsFS, "getItemWriteStream");
                const stream = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG = "unique.id";
                stream.tag = STREAM_TAG;
                stubStream.resolves(stream);

                // Create an assetsREST.pullItem stub that returns asset metadata.
                const stubPull = sinon.stub(assetsREST, "pullItem", function () {
                    stream.emit("pipe");
                    const d = Q.defer();
                    d.resolve(assetMetadata3);
                    return d.promise;
                });

                // Create an assetsFS.saveItem stub that returns asset metadata.
                const stubSave = sinon.stub(assetsFS, "saveItem");
                stubSave.resolves(assetMetadata3);

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stubItems);
                self.addTestDouble(stubStream);
                self.addTestDouble(stubPull);
                self.addTestDouble(stubSave);

                // Call the method being tested with an invalid name.
                let error;
                assetsHelper.pullItemByPath(context, assetMetadata3.path, {offset: 0, limit: 2})
                    .then(function (asset) {
                        // Verify that the helper returned the expected value.
                        expect(diff.diffJson(asset, assetMetadata3)).to.have.lengthOf(1);

                        // Verify that all stubs were called once, and with the expected values.
                        expect(stubItems).to.have.been.calledTwice;
                        expect(stubStream).to.have.been.calledOnce;
                        expect(stubPull).to.have.been.calledOnce;
                        expect(stubUpdateHashes).to.have.been.calledOnce;
                        expect(stubSave).to.have.been.calledOnce;
                        expect(stubStream.args[0][1]).to.equal(assetMetadata3);
                        expect(diff.diffJson(stubPull.args[0][1], assetMetadata3)).to.have.lengthOf(1);
                        expect(stubPull.args[0][2].tag).to.equal(STREAM_TAG);
                        expect(diff.diffJson(stubUpdateHashes.args[0][3], assetMetadata3)).to.have.lengthOf(1);
                        expect(diff.diffJson(stubSave.args[0][1], assetMetadata3)).to.have.lengthOf(1);

                        // Verify that the hashes were called as expected.
                        expect(stubUpdateHashes).to.have.been.calledOnce;
                        expect(stubUpdateHashes.firstCall.args[2]).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_3);
                        expect(stubUpdateHashes.firstCall.args[3].path).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_3);
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

            it("should succeed when a system asset cannot be pulled.", function (done) {
                // Read the contents of four valid test asset metadata files.
                const assetPath1 = AssetsUnitTest.VALID_CONTENT_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_1;
                const assetPath2 = AssetsUnitTest.VALID_CONTENT_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_2;
                const assetPath3 = AssetsUnitTest.VALID_CONTENT_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_3;
                const assetPath4 = AssetsUnitTest.VALID_CONTENT_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_4;
                const assetMetadata1 = UnitTest.getJsonObject(assetPath1 + assetsFS.getExtension());
                const assetMetadata2 = UnitTest.getJsonObject(assetPath2 + assetsFS.getExtension());
                const assetMetadata3 = UnitTest.getJsonObject(assetPath3 + assetsFS.getExtension());
                const assetMetadata4 = UnitTest.getJsonObject(assetPath4 + assetsFS.getExtension());
                const isSystem3 = assetMetadata3.isSystem;
                assetMetadata3.isSystem = true;

                // Create an assetsREST.getItems stub that returns a promise for the metadata of the assets.
                const stubItems = sinon.stub(assetsREST, "getItems");
                stubItems.onCall(0).resolves([assetMetadata1, assetMetadata2]);
                stubItems.onCall(1).resolves([assetMetadata3, assetMetadata4]);
                stubItems.onCall(2).resolves([]);

                // Create an assetsFS.getItemWriteStream spy to make sure the stream is not created.
                const spyStream = sinon.spy(assetsFS, "getItemWriteStream");

                // Create an assetsREST.pullItem spy to make sure the item is not pulled.
                const spyPull = sinon.spy(assetsREST, "pullItem");

                // Create an assetsFS.saveItem spy to make sure the item is not saved.
                const spySave = sinon.spy(assetsFS, "saveItem");

                // The stub and spies should be restored when the test is complete.
                self.addTestDouble(stubItems);
                self.addTestDouble(spyStream);
                self.addTestDouble(spyPull);
                self.addTestDouble(spySave);

                // Call the method being tested with an invalid name.
                let error;
                assetsHelper.pullItemByPath(context, assetMetadata3.path, {offset: 0, limit: 2})
                    .then(function (asset) {
                        // Verify that the helper returned the expected value.
                        expect(asset).to.be.falsy;

                        // Verify that the stub and spies were called as expected.
                        expect(stubItems).to.have.been.calledTwice;
                        expect(spyStream).to.not.have.been.called;
                        expect(spyPull).to.not.have.been.called;
                        expect(stubUpdateHashes).to.not.have.been.called;
                        expect(spySave).to.not.have.been.called;
                    })
                    .catch(function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        assetMetadata3.isSystem = isSystem3;

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });

        describe("pullItem", function () {
            it("should fail when getting the items fails.", function (done) {
                // Create an assetsREST.getItems stub that returns an error.
                const stub = sinon.stub(assetsREST, "getItem");
                const ASSET_ERROR = "There was an error getting the remote item.";
                stub.rejects(ASSET_ERROR);

                // Create an assetsFS.getItemWriteStream spy.
                const spy = sinon.spy(assetsFS, "getItemWriteStream");

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stub);
                self.addTestDouble(spy);

                // Call the method being tested.
                let error;
                assetsHelper.pullItem(context, UnitTest.DUMMY_ID, UnitTest.DUMMY_OPTIONS)
                    .then(function (/*asset*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the pulled asset should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.equal(ASSET_ERROR);

                            // Verify that the stub was called.
                            expect(stub).to.have.been.called;

                            // Verify that the spy was not called.
                            expect(spy).to.not.have.been.called;
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail if there is an error pulling the asset.", function (done) {
                // Read the contents of four valid test asset metadata files.
                const assetMetadataPath1 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_GIF_1;
                const assetMetadata1 = UnitTest.getJsonObject(assetMetadataPath1);

                // Create an assetsREST.getItems stub that returns a promise for the metadata of the assets.
                const stubItems = sinon.stub(assetsREST, "getItem");
                stubItems.resolves(assetMetadata1);

                // Create an assetsFS.getItemWriteStream stub.
                const stubStream = sinon.stub(assetsFS, "getItemWriteStream");
                const stream = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG = "unique.id";
                stream.tag = STREAM_TAG;
                stubStream.resolves(stream);

                // Create an assetsREST.pullItem stub.
                const stubPull = sinon.stub(assetsREST, "pullItem");
                const ASSET_ERROR = "There was an error pulling the item.";
                stubPull.rejects(ASSET_ERROR);

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stubItems);
                self.addTestDouble(stubStream);
                self.addTestDouble(stubPull);

                // Call the method being tested with an invalid name.
                let error;
                assetsHelper.pullItem(context, assetMetadata1.id, UnitTest.DUMMY_OPTIONS)
                    .then(function (/*asset*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the pulled asset should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.equal(ASSET_ERROR);

                            // Verify that all stubs were called once, and with the expected values.
                            expect(stubItems).to.have.been.calledOnce;
                            expect(stubStream).to.have.been.calledOnce;
                            expect(stubPull).to.have.been.calledOnce;
                            expect(stubPull.args[0][2].tag).to.equal(STREAM_TAG);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when pulling an asset.", function (done) {
                // Read the contents of four valid test asset metadata files.
                const assetMetadataPath1 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_GIF_1;
                const assetMetadata1 = UnitTest.getJsonObject(assetMetadataPath1);

                // Create an assetsREST.getItems stub that returns a promise for the metadata of the assets.
                const stubItems = sinon.stub(assetsREST, "getItem");
                stubItems.resolves(assetMetadata1);

                // Create an assetsFS.getItemWriteStream stub that returns a stream.
                const stubStream = sinon.stub(assetsFS, "getItemWriteStream");
                const stream = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG = "unique.id";
                stream.tag = STREAM_TAG;
                stubStream.resolves(stream);

                // Create an assetsREST.pullItem stub that return asset metadata.
                const stubPull = sinon.stub(assetsREST, "pullItem", function () {
                    stream.emit("pipe");
                    const d = Q.defer();
                    d.resolve(assetMetadata1);
                    return d.promise;
                });

                // Create an assetsFS.saveItem spy to make sure it doesn't get called.
                const spySave = sinon.spy(assetsFS, "saveItem");

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stubItems);
                self.addTestDouble(stubStream);
                self.addTestDouble(stubPull);
                self.addTestDouble(spySave);

                // Call the method being tested with an invalid name.
                let error;
                assetsHelper.pullItem(context, assetMetadata1.id, {offset: 0, limit: 2})
                    .then(function (asset) {
                        // Verify that the helper returned the expected value.
                        expect(diff.diffJson(asset, assetMetadata1)).to.have.lengthOf(1);

                        // Verify that all stubs were called once, and with the expected values.
                        expect(stubItems).to.have.been.calledOnce;
                        expect(stubStream).to.have.been.calledOnce;
                        expect(stubPull).to.have.been.calledOnce;
                        expect(stubUpdateHashes).to.have.been.calledOnce;
                        expect(stubPull.args[0][2].tag).to.equal(STREAM_TAG);

                        // Verify that the spy was not called.
                        expect(spySave).to.not.have.been.called;

                        // Verify that the hashes were called as expected.
                        expect(stubUpdateHashes).to.have.been.calledOnce;
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

            it("should succeed when a system asset is not pulled.", function (done) {
                // Read the contents of four valid test asset metadata files.
                const assetMetadataPath1 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_GIF_1;
                const assetMetadata1 = UnitTest.getJsonObject(assetMetadataPath1);
                const isSystem1 = assetMetadata1.isSystem;
                assetMetadata1.isSystem = true;

                // Create an assetsREST.getItems stub that returns a promise for the metadata of the assets.
                const stubItems = sinon.stub(assetsREST, "getItem");
                stubItems.resolves(assetMetadata1);

                // Create an assetsFS.getItemWriteStream spy to make sure that a stream is not created.
                const spyStream = sinon.spy(assetsFS, "getItemWriteStream");

                // Create an assetsREST.pullItem spoy to make sure that the item is not pulled.
                const spyPull = sinon.spy(assetsREST, "pullItem");

                // Create an assetsFS.saveItem spy to make sure it doesn't get called.
                const spySave = sinon.spy(assetsFS, "saveItem");

                // The stub and spies should be restored when the test is complete.
                self.addTestDouble(stubItems);
                self.addTestDouble(spyStream);
                self.addTestDouble(spyPull);
                self.addTestDouble(spySave);

                // Call the method being tested with an invalid name.
                let error;
                assetsHelper.pullItem(context, assetMetadata1.id, {offset: 0, limit: 2})
                    .then(function (asset) {
                        // Verify that the helper returned the expected value.
                        expect(asset).to.be.falsy;

                        // Verify that the stub was called once, and the spies were not called.
                        expect(stubItems).to.have.been.calledOnce;
                        expect(spyStream).to.not.have.been.called;
                        expect(spyPull).to.not.have.been.called;
                        expect(stubUpdateHashes).to.not.have.been.called;
                        expect(spySave).to.not.have.been.called;
                    })
                    .catch(function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        assetMetadata1.isSystem = isSystem1;

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when pulling a draft asset.", function (done) {
                // Read the contents of a valid test asset metadata file.
                const assetMetadataPath1 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_GIF_1;
                const draftAssetMetadata = utils.clone(UnitTest.getJsonObject(assetMetadataPath1));
                draftAssetMetadata["status"] = "draft";

                // Create an assetsREST.getItem stub that returns a promise for the metadata of the draft asset.
                const stubItems = sinon.stub(assetsREST, "getItem");
                stubItems.resolves(draftAssetMetadata);

                // Create an assetsFS.getItemWriteStream stub that returns a stream.
                const stubStream = sinon.stub(assetsFS, "getItemWriteStream");
                const stream = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG = "unique.id";
                stream.tag = STREAM_TAG;
                stubStream.resolves(stream);

                // Create an assetsREST.pullItem stub that return asset metadata.
                const stubPull = sinon.stub(assetsREST, "pullItem", function () {
                    stream.emit("pipe");
                    const d = Q.defer();
                    d.resolve(draftAssetMetadata);
                    return d.promise;
                });

                // Create an assetsFS.saveItem spy to make sure it doesn't get called.
                const spySave = sinon.spy(assetsFS, "saveItem");

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stubItems);
                self.addTestDouble(stubStream);
                self.addTestDouble(stubPull);
                self.addTestDouble(spySave);

                // Call the method being tested.
                let error;
                assetsHelper.pullItem(context, draftAssetMetadata.id, {offset: 0, limit: 2})
                    .then(function (asset) {
                        // Verify that the helper returned the expected value.
                        expect(diff.diffJson(asset, draftAssetMetadata)).to.have.lengthOf(1);

                        // Verify that all stubs were called once, and with the expected values.
                        expect(stubItems).to.have.been.calledOnce;
                        expect(stubStream).to.have.been.calledOnce;
                        expect(stubPull).to.have.been.calledOnce;
                        expect(stubUpdateHashes).to.have.been.calledOnce;
                        expect(stubStream.args[0][1]).equals(draftAssetMetadata);
                        expect(stubPull.args[0][2].tag).to.equal(STREAM_TAG);

                        // Verify that the spy was not called.
                        expect(spySave).to.not.have.been.called;

                        // Verify that the hashes were called as expected.
                        expect(stubUpdateHashes).to.have.been.calledOnce;
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

            it("should succeed when pulling a draft asset that's in a project.", function (done) {
                // Read the contents of a valid test asset metadata file.
                const assetMetadataPath1 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_GIF_1;
                const draftAssetMetadata = utils.clone(UnitTest.getJsonObject(assetMetadataPath1));
                draftAssetMetadata["status"] = "draft";
                draftAssetMetadata["projectId"] = "flubber123";

                // Create an assetsREST.getItem stub that returns a promise for the metadata of the draft asset.
                const stubItems = sinon.stub(assetsREST, "getItem");
                stubItems.resolves(draftAssetMetadata);

                // Create an assetsFS.getItemWriteStream stub that returns a stream.
                const stubStream = sinon.stub(assetsFS, "getItemWriteStream");
                const stream = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG = "unique.id";
                stream.tag = STREAM_TAG;
                stubStream.resolves(stream);

                // Create an assetsREST.pullItem stub that return asset metadata.
                const stubPull = sinon.stub(assetsREST, "pullItem", function () {
                    stream.emit("pipe");
                    const d = Q.defer();
                    d.resolve(draftAssetMetadata);
                    return d.promise;
                });

                // Create an assetsFS.saveItem spy to make sure it doesn't get called.
                const spySave = sinon.spy(assetsFS, "saveItem");

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stubItems);
                self.addTestDouble(stubStream);
                self.addTestDouble(stubPull);
                self.addTestDouble(spySave);

                // Call the method being tested.
                let error;
                assetsHelper.pullItem(context, draftAssetMetadata.id, {offset: 0, limit: 2})
                    .then(function (asset) {
                        // Verify that the helper returned the expected value.
                        expect(diff.diffJson(asset, draftAssetMetadata)).to.have.lengthOf(1);

                        // Verify that all stubs were called once, and with the expected values.
                        expect(stubItems).to.have.been.calledOnce;
                        expect(stubStream).to.have.been.calledOnce;
                        expect(stubPull).to.have.been.calledOnce;
                        expect(stubUpdateHashes).to.have.been.calledOnce;
                        expect(stubStream.args[0][1]).to.equal(draftAssetMetadata);
                        expect(stubPull.args[0][2].tag).to.equal(STREAM_TAG);

                        // Verify that the spy was not called.
                        expect(spySave).to.not.have.been.called;

                        // Verify that the hashes were called as expected.
                        expect(stubUpdateHashes).to.have.been.calledOnce;
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

    testPullAllAssets () {
        const self = this;
        describe("pullAllAssets", function () {
            it("should fail when there is an error getting remote assets.", function (done) {
                // Create an assetsREST.getItems stub that returns an error.
                const ASSETS_ERROR = "There was an error getting the remote assets.";
                const stub = sinon.stub(assetsREST, "getItems");
                stub.rejects(ASSETS_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsHelper.pullAllItems(context)
                    .then(function (/*assets*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the remote assets should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once.
                            expect(stub).to.be.calledOnce;

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.equal(ASSETS_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when there are no remote assets.", function (done) {
                // Create an assetsREST.getItems stub that returns a promise for the metadata of the assets.
                const stub = sinon.stub(assetsREST, "getItems");
                stub.resolves([]);

                // Create an assetsHelper.pullResources stub that resolves.
                const stubResources = sinon.stub(assetsHelper, "pullResources");
                stubResources.resolves([]);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);
                self.addTestDouble(stubResources);

                // Call the method being tested.
                let error;
                assetsHelper.pullAllItems(context, {offset: 0, limit: 2, disablePushPullResources: false})
                    .then(function (assets) {
                        // Verify that the helper returned the expected values.
                        // Note that pullAllAssets is designed to return a metadata array, but currently it does not.
                        if (assets) {
                            expect(assets).to.have.lengthOf(0);
                        }

                        // Verify that the stub was called once.
                        expect(stub).to.have.been.calledOnce;
                        expect(stubResources).to.have.been.calledOnce;

                        // Verify that the hashes were called as expected.
                        expect(stubSetLastPull).to.have.been.calledOnce;
                        expect(stubUpdateHashes).to.not.have.been.called;
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

            it("should succeed when pulling all assets.", function (done) {
                // Read the contents of five test asset metadata files.
                const assetMetadataPath1 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_HTML_1;
                const assetMetadataPath2 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CSS_1;
                const assetMetadataPath3 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JPG_1;
                const assetMetadataPath4 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_GIF_1;
                const assetMetadataPath5 = AssetsUnitTest.INVALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_INVALID_PATH_2;
                const assetMetadataPath6 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JAR_1;
                const assetMetadata1 = UnitTest.getJsonObject(assetMetadataPath1);
                const assetMetadata2 = UnitTest.getJsonObject(assetMetadataPath2);
                const assetMetadata3 = UnitTest.getJsonObject(assetMetadataPath3);
                const assetMetadata4 = UnitTest.getJsonObject(assetMetadataPath4);
                const assetMetadata5 = UnitTest.getJsonObject(assetMetadataPath5);
                const assetMetadata6 = UnitTest.getJsonObject(assetMetadataPath6);
                const isSystem6 = assetMetadata6.isSystem;
                assetMetadata6.isSystem = true;

                // Create an assetsREST.getItems stub that returns a promise for the metadata of the assets.
                const stubGet = sinon.stub(assetsREST, "getItems", function (context, opts) {
                    if (stubGet.callCount === 1) {
                        opts.nextURI = "off=2";
                        return Q([assetMetadata1, assetMetadata2]);
                    } else if (stubGet.callCount === 2) {
                        opts.nextURI = "off=4";
                        return Q([assetMetadata3, assetMetadata4]);
                    } else if (stubGet.callCount === 3) {
                        opts.nextURI = "off=6";
                        return Q([assetMetadata5, assetMetadata6]);
                    } else {
                        delete opts.nextURI;
                        return Q([]);
                    }
                });

                // Create an assetsHelper.pullResources stub that returns an empty list.
                const stubResources = sinon.stub(assetsHelper, "pullResources");
                stubResources.resolves([]);

                const stubIsWindows = sinon.stub(utils, "isWindows");
                stubIsWindows.returns(true);

                // Create an assetsFS.getItemWriteStream stub that returns a promise for a stream.
                const stubStream = sinon.stub(assetsFS, "getItemWriteStream");
                const stream1 = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG_1 = "unique.id.1";
                stream1.tag = STREAM_TAG_1;
                stubStream.onCall(0).resolves(stream1);
                const stream2 = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG_2 = "unique.id.2";
                stream2.tag = STREAM_TAG_2;
                stubStream.onCall(1).resolves(stream2);
                const stream3 = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG_3 = "unique.id.3";
                stream3.tag = STREAM_TAG_3;
                stubStream.onCall(2).resolves(stream3);
                const stream4 = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG_4 = "unique.id.4";
                stream4.tag = STREAM_TAG_4;
                stubStream.onCall(3).resolves(stream4);

                const emitPipe = function(stream, res) {
                    stream.emit("pipe");
                    const d = Q.defer();
                    d.resolve(res);
                    return d.promise;
                };

                // Create a stub for assetsREST.pullItem that returns a promise for the asset metadata.
                const stubPull = sinon.stub(assetsREST, "pullItem", function () {
                    if (stubPull.callCount === 1) {
                        return emitPipe(stream1, assetMetadata1);
                    } else if (stubPull.callCount === 2) {
                        return emitPipe(stream2, assetMetadata2);
                    } else if (stubPull.callCount === 3) {
                        return emitPipe(stream3, assetMetadata3);
                    } else if (stubPull.callCount === 4) {
                        return emitPipe(stream4, assetMetadata4);
                    }
                });

                // Remove the emitter from the context to make sure the pull does not fail because of a missing emitter.
                const emitter = assetsHelper.getEventEmitter(context);
                delete context.eventEmitter;

                // The stubs and spies should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubResources);
                self.addTestDouble(stubStream);
                self.addTestDouble(stubPull);
                self.addTestDouble(stubIsWindows);

                // Call the method being tested.
                let error;
                assetsHelper.pullAllItems(context, {offset: 0, limit: 2, disablePushPullResources: false})
                    .then(function (assets) {
                        // Verify that the helper returned the expected values.
                        // Note that pullAllAssets is designed to return a metadata array, but currently it does not.
                        if (assets) {
                            expect(assets).to.have.lengthOf(5);
                            expect(assets[0].path).to.equal(assetMetadata1.path);
                            expect(assets[1].path).to.equal(assetMetadata2.path);
                            expect(assets[2].path).to.equal(assetMetadata3.path);
                            expect(assets[3].path).to.equal(assetMetadata4.path);
                            expect(assets[4].name).to.equal("Error");
                            expect(assets[4].message).to.contain("Invalid path");
                            expect(assets[4].message).to.contain(assetMetadata5.path);
                        }

                        // Verify that the get stub was called four times.
                        expect(stubGet).to.have.callCount(4);
                        expect(stubResources).to.have.been.calledOnce;

                        // Verify that the stream stub was called five times, each time with the expected path.
                        expect(stubStream).to.have.callCount(4);
                        expect(stubStream.args[0][1]).to.equal(assetMetadata1);
                        expect(stubStream.args[1][1]).to.equal(assetMetadata2);
                        expect(stubStream.args[2][1]).to.equal(assetMetadata3);
                        expect(stubStream.args[3][1]).to.equal(assetMetadata4);

                        // Verify that the pull stub was called five times, each time with the expected path and stream.
                        expect(stubPull).to.have.callCount(4);
                        expect(stubPull.args[0][1].path).to.equal(assetMetadata1.path);
                        expect(stubPull.args[1][1].path).to.equal(assetMetadata2.path);
                        expect(stubPull.args[2][1].path).to.equal(assetMetadata3.path);
                        expect(stubPull.args[3][1].path).to.equal(assetMetadata4.path);
                        expect(stubPull.args[0][2].tag).to.equal(STREAM_TAG_1);
                        expect(stubPull.args[1][2].tag).to.equal(STREAM_TAG_2);
                        expect(stubPull.args[2][2].tag).to.equal(STREAM_TAG_3);
                        expect(stubPull.args[3][2].tag).to.equal(STREAM_TAG_4);

                        // Verify that the hashes were called as expected.
                        expect(stubSetLastPull).to.not.have.been.called;

                        expect(stubUpdateHashes).to.have.callCount(4);
                        expect(stubUpdateHashes.args[0][4]).to.contain(AssetsUnitTest.ASSET_HTML_1);
                        expect(stubUpdateHashes.args[0][3].path).to.contain(AssetsUnitTest.ASSET_HTML_1);
                        expect(stubUpdateHashes.args[1][4]).to.contain(AssetsUnitTest.ASSET_CSS_1);
                        expect(stubUpdateHashes.args[1][3].path).to.contain(AssetsUnitTest.ASSET_CSS_1);
                        expect(stubUpdateHashes.args[2][4]).to.contain(AssetsUnitTest.ASSET_JPG_1);
                        expect(stubUpdateHashes.args[2][3].path).to.contain(AssetsUnitTest.ASSET_JPG_1);
                        expect(stubUpdateHashes.args[3][4]).to.contain(AssetsUnitTest.ASSET_GIF_1);
                        expect(stubUpdateHashes.args[3][3].path).to.contain(AssetsUnitTest.ASSET_GIF_1);
                    })
                    .catch(function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the emitter on the context.
                        context.eventEmitter = emitter;

                        assetMetadata6.isSystem = isSystem6;

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when pulling all web assets.", function (done) {
                // Read the contents of five test asset metadata files.
                const assetMetadataPath1 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_HTML_1;
                const assetMetadataPath2 = AssetsUnitTest.VALID_CONTENT_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_2;
                const assetMetadataPath3 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JPG_1;
                const assetMetadataPath4 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_GIF_1;
                const assetMetadataPath5 = AssetsUnitTest.INVALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_INVALID_PATH_2;
                const assetMetadataPath6 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JAR_1;
                const assetMetadata1 = UnitTest.getJsonObject(assetMetadataPath1);
                const assetMetadata2 = UnitTest.getJsonObject(assetMetadataPath2 + assetsFS.getExtension());
                const assetMetadata3 = UnitTest.getJsonObject(assetMetadataPath3);
                const assetMetadata4 = UnitTest.getJsonObject(assetMetadataPath4);
                const assetMetadata5 = UnitTest.getJsonObject(assetMetadataPath5);
                const assetMetadata6 = UnitTest.getJsonObject(assetMetadataPath6);

                // Create an assetsREST.getItems stub that returns a promise for the metadata of the assets.
                const stubGet = sinon.stub(assetsREST, "getItems", function (context, opts) {
                    if (stubGet.callCount === 1) {
                        opts.nextURI = "off=2";
                        return Q([assetMetadata1, assetMetadata2]);
                    } else if (stubGet.callCount === 2) {
                        opts.nextURI = "off=4";
                        return Q([assetMetadata3, assetMetadata4]);
                    } else if (stubGet.callCount === 3) {
                        opts.nextURI = "off=6";
                        return Q([assetMetadata5, assetMetadata6]);
                    } else {
                        delete opts.nextURI;
                        return Q([]);
                    }
                });

                // Test the code path for Windows, which is more restrictive on valid filename chars
                const stubIsWindows = sinon.stub(utils, "isWindows");
                stubIsWindows.returns(true);
                self.addTestDouble(stubIsWindows);

                // Create an assetsFS.getItemWriteStream stub that returns a promise for a stream.
                const stubStream = sinon.stub(assetsFS, "getItemWriteStream");
                const stream1 = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG_1 = "unique.id.1";
                stream1.tag = STREAM_TAG_1;
                stubStream.onCall(0).resolves(stream1);
                const stream2 = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG_2 = "unique.id.2";
                stream2.tag = STREAM_TAG_2;
                stubStream.onCall(1).resolves(stream2);
                const stream3 = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG_3 = "unique.id.3";
                stream3.tag = STREAM_TAG_3;
                stubStream.onCall(2).resolves(stream3);
                const stream4 = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG_4 = "unique.id.4";
                stream4.tag = STREAM_TAG_4;
                stubStream.onCall(3).resolves(stream4);

                const emitPipe = function(stream, res) {
                    stream.emit("pipe");
                    const d = Q.defer();
                    d.resolve(res);
                    return d.promise;
                };

                // Create a stub for assetsREST.pullItem that returns a promise for the asset metadata.
                const stubPull = sinon.stub(assetsREST, "pullItem", function () {
                    if (stubPull.callCount === 1) {
                        return emitPipe(stream1, assetMetadata1);
                    } else if (stubPull.callCount === 2) {
                        return emitPipe(stream2, assetMetadata3);
                    } else if (stubPull.callCount === 3) {
                        return emitPipe(stream3, assetMetadata4);
                    } else if (stubPull.callCount === 4) {
                        return emitPipe(stream4, assetMetadata6);
                    }
                });

                // Create an helper.listLocalItemNames stub to return the list of local files.
                const stubList = sinon.stub(assetsHelper, "listLocalItemNames");
                stubList.resolves([assetMetadata1, assetMetadata2, {"id": "foo"}]);

                // Create spies to listen for the "pulled" and "pulled-error" events.
                const emitter = assetsHelper.getEventEmitter(context);
                const spyPull = sinon.spy();
                emitter.on("pulled", spyPull);
                const spyError = sinon.spy();
                emitter.on("pulled-error", spyError);

                // The stubs and spies should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubStream);
                self.addTestDouble(stubPull);
                self.addTestDouble(stubList);

                // Call the method being tested.
                let error;
                assetsHelper.pullAllItems(context, {offset: 0, limit: 2, assetTypes: assetsHelper.ASSET_TYPES_WEB_ASSETS, deletions: true})
                    .then(function (assets) {
                        // Verify that the helper returned the expected values.
                        // Note that pullAllAssets is designed to return a metadata array, but currently it does not.
                        if (assets) {
                            expect(assets).to.have.lengthOf(5);
                            expect(assets[0].path).to.equal(assetMetadata1.path);
                            expect(assets[1].path).to.equal(assetMetadata3.path);
                            expect(assets[2].path).to.equal(assetMetadata4.path);
                            expect(assets[3].name).to.equal("Error");
                            expect(assets[3].message).to.contain("Invalid path");
                            expect(assets[3].message).to.contain(assetMetadata5.path);
                            expect(assets[4].path).to.equal(assetMetadata6.path);
                        }

                        // Verify that the get stub was called four times.
                        expect(stubGet).to.have.callCount(4);

                        // Verify that the stream stub was called four times, each time with the expected path.
                        expect(stubStream).to.have.callCount(4);
                        expect(stubStream.args[0][1]).to.equal(assetMetadata1);
                        expect(stubStream.args[1][1]).to.equal(assetMetadata3);
                        expect(stubStream.args[2][1]).to.equal(assetMetadata4);
                        expect(stubStream.args[3][1]).to.equal(assetMetadata6);

                        // Verify that the pull stub was called four times, each time with the expected path and stream.
                        expect(stubPull).to.have.callCount(4);
                        expect(stubPull.args[0][1].path).to.equal(assetMetadata1.path);
                        expect(stubPull.args[1][1].path).to.equal(assetMetadata3.path);
                        expect(stubPull.args[2][1].path).to.equal(assetMetadata4.path);
                        expect(stubPull.args[3][1].path).to.equal(assetMetadata6.path);
                        expect(stubPull.args[0][2].tag).to.equal(STREAM_TAG_1);
                        expect(stubPull.args[1][2].tag).to.equal(STREAM_TAG_2);
                        expect(stubPull.args[2][2].tag).to.equal(STREAM_TAG_3);
                        expect(stubPull.args[3][2].tag).to.equal(STREAM_TAG_4);

                        // Verify that the spies were called the expected number of times with the expected values.
                        expect(spyPull).to.have.callCount(4);
                        expect(spyPull.args[0][0].path).to.equal(assetMetadata1.path);
                        expect(spyPull.args[1][0].path).to.equal(assetMetadata3.path);
                        expect(spyPull.args[2][0].path).to.equal(assetMetadata4.path);
                        expect(spyPull.args[3][0].path).to.equal(assetMetadata6.path);
                        expect(spyError).to.have.been.calledOnce;
                        expect(spyError.args[0][0].name).to.equal("Error");
                        expect(spyError.args[0][0].message).to.contain("Invalid path");
                        expect(spyError.args[0][0].message).to.contain(assetMetadata5.path);
                        expect(spyError.args[0][1]).to.equal(assetMetadata5.path);

                        // Verify that the hashes were called as expected.
                        expect(stubSetLastPull).to.not.have.been.called;

                        expect(stubUpdateHashes).to.have.callCount(4);
                        expect(stubUpdateHashes.args[0][4]).to.contain(AssetsUnitTest.ASSET_HTML_1);
                        expect(stubUpdateHashes.args[0][3].path).to.contain(AssetsUnitTest.ASSET_HTML_1);
                        expect(stubUpdateHashes.args[1][4]).to.contain(AssetsUnitTest.ASSET_JPG_1);
                        expect(stubUpdateHashes.args[1][3].path).to.contain(AssetsUnitTest.ASSET_JPG_1);
                        expect(stubUpdateHashes.args[2][4]).to.contain(AssetsUnitTest.ASSET_GIF_1);
                        expect(stubUpdateHashes.args[2][3].path).to.contain(AssetsUnitTest.ASSET_GIF_1);
                        expect(stubUpdateHashes.args[3][4]).to.contain(AssetsUnitTest.ASSET_JAR_1);
                        expect(stubUpdateHashes.args[3][3].path).to.contain(AssetsUnitTest.ASSET_JAR_1);
                    })
                    .catch(function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        emitter.removeListener("pulled", spyPull);
                        emitter.removeListener("pulled-error", spyError);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when pulling all content assets.", function (done) {
                // Read the contents of five test asset metadata files.
                const assetMetadataPath1 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_HTML_1;
                const assetMetadataPath2 = AssetsUnitTest.VALID_CONTENT_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_2;
                const assetMetadataPath3 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JPG_1;
                const assetMetadataPath4 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_GIF_1;
                const assetMetadataPath5 = AssetsUnitTest.INVALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_INVALID_PATH_2;
                const assetMetadataPath6 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JAR_1;
                const assetMetadata1 = UnitTest.getJsonObject(assetMetadataPath1);
                const assetMetadata2 = UnitTest.getJsonObject(assetMetadataPath2 + assetsFS.getExtension());
                const assetMetadata3 = UnitTest.getJsonObject(assetMetadataPath3);
                const assetMetadata4 = UnitTest.getJsonObject(assetMetadataPath4);
                const assetMetadata5 = UnitTest.getJsonObject(assetMetadataPath5);
                const assetMetadata6 = UnitTest.getJsonObject(assetMetadataPath6);

                // Create an assetsREST.getItems stub that returns a promise for the metadata of the assets.
                const stubGet = sinon.stub(assetsREST, "getItems", function (context, opts) {
                    if (stubGet.callCount === 1) {
                        opts.nextURI = "off=2";
                        return Q([assetMetadata1, assetMetadata2]);
                    } else if (stubGet.callCount === 2) {
                        opts.nextURI = "off=4";
                        return Q([assetMetadata3, assetMetadata4]);
                    } else if (stubGet.callCount === 3) {
                        opts.nextURI = "off=6";
                        return Q([assetMetadata5, assetMetadata6]);
                    } else {
                        delete opts.nextURI;
                        return Q([]);
                    }
                });

                // Create an assetsHelper.pullResources stub that returns an empty list.
                const stubResources = sinon.stub(assetsHelper, "pullResources");
                stubResources.resolves([]);

                // Create an assetsFS.getItemWriteStream stub that returns a promise for a stream.
                const stubStream = sinon.stub(assetsFS, "getItemWriteStream");
                const stream1 = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG_1 = "unique.id.1";
                stream1.tag = STREAM_TAG_1;
                stubStream.onCall(0).resolves(stream1);

                // Create a stub for assetsREST.pullItem that returns a promise for the asset metadata.
                const stubPull = sinon.stub(assetsREST, "pullItem", function () {
                    stream1.emit("pipe");
                    const d = Q.defer();
                    d.resolve(assetMetadata2);
                    return d.promise;
                });

                // Create an assetsFS.saveItem stub that returns asset metadata.
                const stubSave = sinon.stub(assetsFS, "saveItem");
                stubSave.resolves(assetMetadata2);

                // Create spies to listen for the "pulled" and "pulled-error" events.
                const emitter = assetsHelper.getEventEmitter(context);
                const spyPull = sinon.spy();
                emitter.on("pulled", spyPull);
                const spyError = sinon.spy();
                emitter.on("pulled-error", spyError);

                // The stubs and spies should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubResources);
                self.addTestDouble(stubStream);
                self.addTestDouble(stubPull);
                self.addTestDouble(stubSave);

                // Call the method being tested.
                let error;
                assetsHelper.pullAllItems(context, {offset: 0, limit: 2, assetTypes: assetsHelper.ASSET_TYPES_CONTENT_ASSETS})
                    .then(function (assets) {
                        // Verify that the helper returned the expected values.
                        // Note that pullAllAssets is designed to return a metadata array, but currently it does not.
                        if (assets) {
                            expect(assets).to.have.lengthOf(1);
                            expect(assets[0].path).to.equal(assetMetadata2.path);
                        }

                        // Verify that the get stub was called four times.
                        expect(stubGet).to.have.callCount(4);

                        // Verify that the stream stub was called once with the expected path.
                        expect(stubStream).to.have.been.calledOnce;
                        expect(stubStream.args[0][1]).to.equal(assetMetadata2);

                        // Verify that the pull stub was called once with the expected path and stream.
                        expect(stubPull).to.have.been.calledOnce;
                        expect(stubPull.args[0][1].path).to.equal(assetMetadata2.path);
                        expect(stubPull.args[0][2].tag).to.equal(STREAM_TAG_1);

                        // Verify that the save stub was called once with the expected path.
                        expect(stubSave).to.have.been.calledOnce;
                        expect(stubSave.args[0][1].path).to.equal(assetMetadata2.path);

                        // Verify that the spies were called the expected number of times with the expected values.
                        expect(spyPull).to.have.been.calledOnce;
                        expect(spyPull.args[0][0].path).to.equal(assetMetadata2.path);
                        expect(spyError).to.not.have.been.called;

                        // Verify that the hashes were called as expected.
                        expect(stubSetLastPull).to.have.been.calledOnce;

                        expect(stubUpdateHashes).to.have.callCount(1);
                        expect(stubUpdateHashes.args[0][2]).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_2);
                        expect(stubUpdateHashes.args[0][3].path).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_2);
                    })
                    .catch(function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        emitter.removeListener("pulled", spyPull);
                        emitter.removeListener("pulled-error", spyError);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when pulling only ready content assets.", function (done) {
                // Read the contents of four test asset metadata files.
                const assetMetadataPath1 = AssetsUnitTest.VALID_CONTENT_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_1;
                const assetMetadataPath2 = AssetsUnitTest.VALID_CONTENT_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_1_DRAFT;
                const assetMetadataPath3 = AssetsUnitTest.VALID_CONTENT_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_2;
                const assetMetadataPath4 = AssetsUnitTest.VALID_CONTENT_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_2_DRAFT;
                const assetMetadata1 = UnitTest.getJsonObject(assetMetadataPath1 + assetsFS.getExtension());
                const assetMetadata2 = UnitTest.getJsonObject(assetMetadataPath2 + assetsFS.getExtension());
                const assetMetadata3 = UnitTest.getJsonObject(assetMetadataPath3 + assetsFS.getExtension());
                const assetMetadata4 = UnitTest.getJsonObject(assetMetadataPath4 + assetsFS.getExtension());

                // Create an assetsREST.getItems stub that returns a promise for the metadata of the assets.
                const stubGet = sinon.stub(assetsREST, "getItems");
                stubGet.resolves([assetMetadata1, assetMetadata2, assetMetadata3, assetMetadata4]);

                // Create an assetsHelper.pullResources stub that returns an empty list.
                const stubResources = sinon.stub(assetsHelper, "pullResources");
                stubResources.resolves([]);

                // Create an assetsFS.getItemWriteStream stub that returns a promise for a stream.
                const stubStream = sinon.stub(assetsFS, "getItemWriteStream");
                const stream1 = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG_1 = "unique.id.1";
                stream1.tag = STREAM_TAG_1;
                stubStream.onCall(0).resolves(stream1);
                const stream2 = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG_2 = "unique.id.2";
                stream2.tag = STREAM_TAG_2;
                stubStream.onCall(1).resolves(stream2);

                const emitPipe = function(stream, res) {
                    stream.emit("pipe");
                    const d = Q.defer();
                    d.resolve(res);
                    return d.promise;
                };

                // Create a stub for assetsREST.pullItem that returns a promise for the asset metadata.
                const stubPull = sinon.stub(assetsREST, "pullItem", function () {
                    if (stubPull.callCount === 1) {
                        return emitPipe(stream1, assetMetadata1);
                    } else if (stubPull.callCount === 2) {
                        return emitPipe(stream2, assetMetadata3);
                    }
                });

                // Create an assetsFS.saveItem stub that returns asset metadata.
                const stubSave = sinon.stub(assetsFS, "saveItem");
                stubSave.onCall(0).resolves(assetMetadata1);
                stubSave.onCall(1).resolves(assetMetadata3);

                // Create spies to listen for the "pulled" and "pulled-error" events.
                const emitter = assetsHelper.getEventEmitter(context);
                const spyPull = sinon.spy();
                emitter.on("pulled", spyPull);
                const spyError = sinon.spy();
                emitter.on("pulled-error", spyError);

                // The stubs and spies should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubResources);
                self.addTestDouble(stubStream);
                self.addTestDouble(stubPull);
                self.addTestDouble(stubSave);

                // Call the method being tested.
                let error;
                assetsHelper.pullAllItems(context, {assetTypes: assetsHelper.ASSET_TYPES_CONTENT_ASSETS, filterReady: true})
                    .then(function (assets) {
                        // Verify that the helper returned the expected values.
                        // Note that pullAllAssets is designed to return a metadata array, but currently it does not.
                        if (assets) {
                            expect(assets).to.have.lengthOf(2);
                            expect(assets[0].path).to.equal(assetMetadata1.path);
                            expect(assets[1].path).to.equal(assetMetadata3.path);
                        }

                        // Verify that the get stub was called once.
                        expect(stubGet).to.have.been.calledOnce;

                        // Verify that the stream stub was called twice with the expected path.
                        expect(stubStream).to.have.been.calledTwice;
                        expect(stubStream.args[0][1]).to.equal(assetMetadata1);
                        expect(stubStream.args[1][1]).to.equal(assetMetadata3);

                        // Verify that the pull stub was called twice with the expected path and stream.
                        expect(stubPull).to.have.been.calledTwice;
                        expect(stubPull.args[0][1].path).to.equal(assetMetadata1.path);
                        expect(stubPull.args[0][2].tag).to.equal(STREAM_TAG_1);
                        expect(stubPull.args[1][1].path).to.equal(assetMetadata3.path);
                        expect(stubPull.args[1][2].tag).to.equal(STREAM_TAG_2);

                        // Verify that the save stub was called twice with the expected path.
                        expect(stubSave).to.have.been.calledTwice;
                        expect(stubSave.args[0][1].path).to.equal(assetMetadata1.path);
                        expect(stubSave.args[1][1].path).to.equal(assetMetadata3.path);

                        // Verify that the spies were called the expected number of times with the expected values.
                        expect(spyPull).to.have.been.calledTwice;
                        expect(spyPull.args[0][0].path).to.equal(assetsFS.getAssetPath(assetMetadata1));
                        expect(spyPull.args[1][0].path).to.equal(assetsFS.getAssetPath(assetMetadata3));
                        expect(spyError).to.not.have.been.called;

                        expect(stubSetLastPull).to.have.been.calledOnce;

                        // Verify that the hashes were called as expected.
                        expect(stubUpdateHashes).to.have.callCount(2);
                        expect(stubUpdateHashes.args[0][2]).to.contain(assetsFS.getAssetPath(assetMetadata1));
                        expect(stubUpdateHashes.args[0][3].path).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_1);
                        expect(stubUpdateHashes.args[1][2]).to.contain(assetsFS.getAssetPath(assetMetadata3));
                        expect(stubUpdateHashes.args[1][3].path).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_2);
                    })
                    .catch(function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        emitter.removeListener("pulled", spyPull);
                        emitter.removeListener("pulled-error", spyError);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when pulling only draft content assets.", function (done) {
                // Read the contents of four test asset metadata files.
                const assetMetadataPath1 = AssetsUnitTest.VALID_CONTENT_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_1;
                const assetMetadataPath2 = AssetsUnitTest.VALID_CONTENT_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_1_DRAFT;
                const assetMetadataPath3 = AssetsUnitTest.VALID_CONTENT_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_2;
                const assetMetadataPath4 = AssetsUnitTest.VALID_CONTENT_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_2_DRAFT;
                const assetMetadata1 = UnitTest.getJsonObject(assetMetadataPath1 + assetsFS.getExtension());
                const assetMetadata2 = UnitTest.getJsonObject(assetMetadataPath2 + assetsFS.getExtension());
                const assetMetadata3 = UnitTest.getJsonObject(assetMetadataPath3 + assetsFS.getExtension());
                const assetMetadata4 = UnitTest.getJsonObject(assetMetadataPath4 + assetsFS.getExtension());

                // Create an assetsREST.getItems stub that returns a promise for the metadata of the assets.
                const stubGet = sinon.stub(assetsREST, "getItems");
                stubGet.resolves([assetMetadata1, assetMetadata2, assetMetadata3, assetMetadata4]);

                // Create an assetsHelper.pullResources stub that returns an empty list.
                const stubResources = sinon.stub(assetsHelper, "pullResources");
                stubResources.resolves([]);

                // Create an assetsFS.getItemWriteStream stub that returns a promise for a stream.
                const stubStream = sinon.stub(assetsFS, "getItemWriteStream");
                const stream1 = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG_1 = "unique.id.1";
                stream1.tag = STREAM_TAG_1;
                stubStream.onCall(0).resolves(stream1);
                const stream2 = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG_2 = "unique.id.2";
                stream2.tag = STREAM_TAG_2;
                stubStream.onCall(1).resolves(stream2);

                const emitPipe = function(stream, res) {
                    stream.emit("pipe");
                    const d = Q.defer();
                    d.resolve(res);
                    return d.promise;
                };

                // Create a stub for assetsREST.pullItem that returns a promise for the asset metadata.
                const stubPull = sinon.stub(assetsREST, "pullItem", function () {
                    if (stubPull.callCount === 1) {
                        return emitPipe(stream1, assetMetadata2);
                    } else if (stubPull.callCount === 2) {
                        return emitPipe(stream2, assetMetadata4);
                    }
                });

                // Create an assetsFS.saveItem stub that returns asset metadata.
                const stubSave = sinon.stub(assetsFS, "saveItem");
                stubSave.onCall(0).resolves(assetMetadata2);
                stubSave.onCall(1).resolves(assetMetadata4);

                // Create spies to listen for the "pulled" and "pulled-error" events.
                const emitter = assetsHelper.getEventEmitter(context);
                const spyPull = sinon.spy();
                emitter.on("pulled", spyPull);
                const spyError = sinon.spy();
                emitter.on("pulled-error", spyError);

                // The stubs and spies should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubResources);
                self.addTestDouble(stubStream);
                self.addTestDouble(stubPull);
                self.addTestDouble(stubSave);

                // Call the method being tested.
                let error;
                assetsHelper.pullAllItems(context, {assetTypes: assetsHelper.ASSET_TYPES_CONTENT_ASSETS, filterDraft: true})
                    .then(function (assets) {
                        // Verify that the helper returned the expected values.
                        // Note that pullAllAssets is designed to return a metadata array, but currently it does not.
                        if (assets) {
                            expect(assets).to.have.lengthOf(2);
                            expect(assets[0].path).to.equal(assetMetadata2.path);
                            expect(assets[1].path).to.equal(assetMetadata4.path);
                        }

                        // Verify that the get stub was called once.
                        expect(stubGet).to.have.been.calledOnce;

                        // Verify that the stream stub was called twice with the expected path.
                        expect(stubStream).to.have.been.calledTwice;
                        expect(stubStream.args[0][1]).to.equal(assetMetadata2);
                        expect(stubStream.args[1][1]).to.equal(assetMetadata4);

                        // Verify that the pull stub was called twice with the expected path and stream.
                        expect(stubPull).to.have.been.calledTwice;
                        expect(stubPull.args[0][1].path).to.equal(assetMetadata2.path);
                        expect(stubPull.args[0][2].tag).to.equal(STREAM_TAG_1);
                        expect(stubPull.args[1][1].path).to.equal(assetMetadata4.path);
                        expect(stubPull.args[1][2].tag).to.equal(STREAM_TAG_2);

                        // Verify that the save stub was called twice with the expected path.
                        expect(stubSave).to.have.been.calledTwice;
                        expect(stubSave.args[0][1].path).to.equal(assetMetadata2.path);
                        expect(stubSave.args[1][1].path).to.equal(assetMetadata4.path);

                        // Verify that the spies were called the expected number of times with the expected values.
                        expect(spyPull).to.have.been.calledTwice;
                        expect(spyPull.args[0][0].path).to.equal(assetsFS.getAssetPath(assetMetadata2));
                        expect(spyPull.args[1][0].path).to.equal(assetsFS.getAssetPath(assetMetadata4));
                        expect(spyError).to.not.have.been.called;

                        expect(stubSetLastPull).to.have.been.calledOnce;

                        // Verify that the hashes were called as expected.
                        expect(stubUpdateHashes).to.have.callCount(2);
                        expect(stubUpdateHashes.args[0][2]).to.contain(assetsFS.getAssetPath(assetMetadata2));
                        expect(stubUpdateHashes.args[0][3].path).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_1);
                        expect(stubUpdateHashes.args[1][2]).to.contain(assetsFS.getAssetPath(assetMetadata4));
                        expect(stubUpdateHashes.args[1][3].path).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_2);
                    })
                    .catch(function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        emitter.removeListener("pulled", spyPull);
                        emitter.removeListener("pulled-error", spyError);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when pulling assets by path.", function (done) {
                // Define four simple asset metadata items.
                const assetMetadata1 = {path: "/foo/bar1.json", document: '{"path": "/foo/bar1.json"}'};
                const assetMetadata2 = {path: "/bar/foo1.json", document: '{"path": "/bar/foo1.json"}'};
                const assetMetadata3 = {path: "/foo/bar2.json", document: '{"path": "/foo/bar2.json"}'};
                const assetMetadata4 = {path: "/bar/foo2.json", document: '{"path": "/bar/foo2.json"}'};

                // Create an assetsREST.getItems stub that returns a promise for the metadata of the assets.
                const stubSearch = sinon.stub(searchREST, "search");
                stubSearch.resolves({documents: [assetMetadata1, assetMetadata2, assetMetadata3, assetMetadata4]});

                // Create an assetsHelper.pullResources stub that returns an empty list.
                const stubResources = sinon.stub(assetsHelper, "pullResources");
                stubResources.resolves([]);

                // Create a stub for helper._pullAsset that returns a promise for the asset metadata.
                const stubPull = sinon.stub(assetsHelper, "_pullAsset");
                stubPull.onCall(0).resolves(assetMetadata1);
                stubPull.onCall(1).resolves(assetMetadata3);

                // The stubs and spies should be restored when the test is complete.
                self.addTestDouble(stubSearch);
                self.addTestDouble(stubResources);
                self.addTestDouble(stubPull);

                // Call the method being tested.
                let error;
                assetsHelper.pullAllItems(context, {assetTypes: assetsHelper.ASSET_TYPES_BOTH, filterPath: "foo"})
                    .then(function (assets) {
                        // Verify that the helper returned the expected values.
                        if (assets) {
                            expect(assets).to.have.lengthOf(2);
                            expect(assets[0].path).to.equal(assetMetadata1.path);
                            expect(assets[1].path).to.equal(assetMetadata3.path);
                        }

                        // Verify that the get stub was called once.
                        expect(stubSearch).to.have.been.calledOnce;

                        // Verify that the pull stub was called twice with the expected path and stream.
                        expect(stubPull).to.have.been.calledTwice;
                        expect(stubPull.args[0][1].path).to.equal(assetMetadata1.path);
                        expect(stubPull.args[1][1].path).to.equal(assetMetadata3.path);

                        expect(stubSetLastPull).to.not.have.been.called;
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

    testPullModifiedAssets () {
        const self = this;
        describe("pullModifiedAssets", function () {
            it("should fail when getting the modified items fails.", function (done) {
                // Create an assetsREST.getModifiedItems stub that returns an error.
                const stub = sinon.stub(assetsREST, "getModifiedItems");
                const ASSET_ERROR = "There was an error getting the remote modified items.";
                stub.rejects(ASSET_ERROR);

                // Create an assetsFS.getItemWriteStream spy.
                const spy = sinon.spy(assetsFS, "getItemWriteStream");

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stub);
                self.addTestDouble(spy);

                // Call the method being tested.
                let error;
                assetsHelper.pullModifiedItems(context)
                    .then(function (/*asset*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the pulled modified assets should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.equal(ASSET_ERROR);

                            // Verify that the stub was called.
                            expect(stub).to.have.been.called;

                            // Verify that the spy was not called.
                            expect(spy).to.not.have.been.called;
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when pulling modified web assets with a pull error and a hashes error.", function (done) {
                // Read the contents of six test asset metadata files.
                const assetMetadataPath1 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_HTML_1;
                const assetMetadataPath2 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CSS_1;
                const assetMetadataPath3 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JPG_1;
                const assetMetadataPath4 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_GIF_1;
                const assetMetadataPath5 = AssetsUnitTest.INVALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_INVALID_PATH_2;
                const assetMetadataPath6 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JAR_1;
                const assetMetadata1 = UnitTest.getJsonObject(assetMetadataPath1);
                const assetMetadata2 = UnitTest.getJsonObject(assetMetadataPath2);
                const assetMetadata3 = UnitTest.getJsonObject(assetMetadataPath3);
                const assetMetadata4 = UnitTest.getJsonObject(assetMetadataPath4);
                const assetMetadata5 = UnitTest.getJsonObject(assetMetadataPath5);
                const assetMetadata6 = UnitTest.getJsonObject(assetMetadataPath6);

                // Create an assetsREST.getModifiedItems stub that returns a promise for the metadata of the assets.
                const stubGet = sinon.stub(assetsREST, "getModifiedItems", function (context, timestamp, opts) {
                    if (stubGet.callCount === 1) {
                        opts.nextURI = "off=2";
                        return Q([assetMetadata1, assetMetadata2]);
                    } else if (stubGet.callCount === 2) {
                        opts.nextURI = "off=4";
                        return Q([assetMetadata3, assetMetadata4]);
                    } else if (stubGet.callCount === 3) {
                        opts.nextURI = "off=6";
                        return Q([assetMetadata5, assetMetadata6]);
                    } else {
                        delete opts.nextURI;
                        return Q([]);
                    }
                });

                // Test the code path for Windows, which is more restrictive on valid filename chars
                const stubIsWindows = sinon.stub(utils, "isWindows");
                stubIsWindows.returns(true);
                self.addTestDouble(stubIsWindows);

                // Throw a hashes error on the sixth call, to make sure the helper can handle it.
                const HASHES_ERROR = "Error reading hashes file, expected by unit test.";
                stubIsRemoteModified.onCall(5).throws(new Error(HASHES_ERROR));

                // Create an assetsHelper.pullResources stub that returns an empty list.
                const stubResources = sinon.stub(assetsHelper, "pullResources");
                stubResources.resolves([]);

                // Create an assetsFS.getItemWriteStream stub that returns a promise for a stream.
                const stubStream = sinon.stub(assetsFS, "getItemWriteStream");
                const stream1 = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG_1 = "unique.id.1";
                stream1.tag = STREAM_TAG_1;
                stubStream.onCall(0).resolves(stream1);
                const stream2 = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG_2 = "unique.id.2";
                stream2.tag = STREAM_TAG_2;
                stubStream.onCall(1).resolves(stream2);
                const stream3 = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG_3 = "unique.id.3";
                stream3.tag = STREAM_TAG_3;
                stubStream.onCall(2).resolves(stream3);
                const stream4 = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG_4 = "unique.id.4";
                stream4.tag = STREAM_TAG_4;
                stubStream.onCall(3).resolves(stream4);

                const emitPipe = function(stream, res) {
                    stream.emit("pipe");
                    const d = Q.defer();
                    d.resolve(res);
                    return d.promise;
                };

                // Create a stub for assetsREST.pullItem that returns a promise for the asset metadata.
                const stubPull = sinon.stub(assetsREST, "pullItem", function () {
                    if (stubPull.callCount === 1) {
                        return emitPipe(stream1, assetMetadata1);
                    } else if (stubPull.callCount === 2) {
                        return emitPipe(stream2, assetMetadata2);
                    } else if (stubPull.callCount === 3) {
                        return emitPipe(stream3, assetMetadata3);
                    } else if (stubPull.callCount === 4) {
                        return emitPipe(stream4, assetMetadata4);
                    }
                });

                // Create spies to listen for the "pulled" and "pulled-error" events.
                const emitter = assetsHelper.getEventEmitter(context);
                const spyPull = sinon.spy();
                emitter.on("pulled", spyPull);
                const spyError = sinon.spy();
                emitter.on("pulled-error", spyError);

                // Create a stub for assetsFS.isContentResource that returns false.
                const stubIsContentResource = sinon.stub(assetsFS, "isContentResource");
                stubIsContentResource.returns(false);

                // The stubs and spies should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubStream);
                self.addTestDouble(stubPull);
                self.addTestDouble(stubIsContentResource);
                self.addTestDouble(stubResources);

                // Call the method being tested.
                let error;
                assetsHelper.pullModifiedItems(context, {offset: 0, limit: 2, assetTypes: assetsHelper.ASSET_TYPES_WEB_ASSETS, disablePushPullResources: false})
                    .then(function (assets) {
                        // Verify that the helper returned the expected values.
                        // Note that pullAllAssets is designed to return a metadata array, but currently it does not.
                        if (assets) {
                            expect(assets).to.have.lengthOf(5);
                            expect(assets[0].path).to.equal(assetMetadata1.path);
                            expect(assets[1].path).to.equal(assetMetadata2.path);
                            expect(assets[2].path).to.equal(assetMetadata3.path);
                            expect(assets[3].path).to.equal(assetMetadata4.path);
                            expect(assets[4].name).to.equal("Error");
                            expect(assets[4].message).to.contain("Invalid path");
                            expect(assets[4].message).to.contain(assetMetadata5.path);
                        }

                        // Verify that the get stub was called four times.
                        expect(stubGet).to.have.callCount(3);
                        // TODO This really should be 4. Need to fix filtered item logic in AssetsHelper.getModifiedRemoteItems().

                        // Verify that the stream stub was called five times, each time with the expected path.
                        expect(stubStream).to.have.callCount(4);
                        expect(stubStream.args[0][1]).to.equal(assetMetadata1);
                        expect(stubStream.args[1][1]).to.equal(assetMetadata2);
                        expect(stubStream.args[2][1]).to.equal(assetMetadata3);
                        expect(stubStream.args[3][1]).to.equal(assetMetadata4);

                        // Verify that the pull stub was called five times, each time with the expected path and stream.
                        expect(stubPull).to.have.callCount(4);
                        expect(stubPull.args[0][1].path).to.equal(assetMetadata1.path);
                        expect(stubPull.args[1][1].path).to.equal(assetMetadata2.path);
                        expect(stubPull.args[2][1].path).to.equal(assetMetadata3.path);
                        expect(stubPull.args[3][1].path).to.equal(assetMetadata4.path);
                        expect(stubPull.args[0][2].tag).to.equal(STREAM_TAG_1);
                        expect(stubPull.args[1][2].tag).to.equal(STREAM_TAG_2);
                        expect(stubPull.args[2][2].tag).to.equal(STREAM_TAG_3);
                        expect(stubPull.args[3][2].tag).to.equal(STREAM_TAG_4);

                        // Verify that the spies were called the expected number of times with the expected values.
                        expect(spyPull).to.have.callCount(4);
                        expect(spyPull.args[0][0].path).to.equal(assetMetadata1.path);
                        expect(spyPull.args[1][0].path).to.equal(assetMetadata2.path);
                        expect(spyPull.args[2][0].path).to.equal(assetMetadata3.path);
                        expect(spyPull.args[3][0].path).to.equal(assetMetadata4.path);
                        expect(spyError).to.have.been.calledOnce;
                        expect(spyError.args[0][0].name).to.equal("Error");
                        expect(spyError.args[0][0].message).to.contain("Invalid path");
                        expect(spyError.args[0][0].message).to.contain(assetMetadata5.path);
                        expect(spyError.args[0][1]).to.equal(assetMetadata5.path);

                        // Verify that the hashes were called as expected.
                        expect(stubSetLastPull).to.not.have.been.called;

                        expect(stubUpdateHashes).to.have.callCount(4);
                        expect(stubUpdateHashes.args[0][4]).to.contain(AssetsUnitTest.ASSET_HTML_1);
                        expect(stubUpdateHashes.args[0][3].path).to.contain(AssetsUnitTest.ASSET_HTML_1);
                        expect(stubUpdateHashes.args[1][4]).to.contain(AssetsUnitTest.ASSET_CSS_1);
                        expect(stubUpdateHashes.args[1][3].path).to.contain(AssetsUnitTest.ASSET_CSS_1);
                        expect(stubUpdateHashes.args[2][4]).to.contain(AssetsUnitTest.ASSET_JPG_1);
                        expect(stubUpdateHashes.args[2][3].path).to.contain(AssetsUnitTest.ASSET_JPG_1);
                        expect(stubUpdateHashes.args[3][4]).to.contain(AssetsUnitTest.ASSET_GIF_1);
                        expect(stubUpdateHashes.args[3][3].path).to.contain(AssetsUnitTest.ASSET_GIF_1);
                    })
                    .catch(function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        emitter.removeListener("pulled", spyPull);
                        emitter.removeListener("pulled-error", spyError);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when pulling modified web assets with no pull errors.", function (done) {
                // Read the contents of five test asset metadata files.
                const assetMetadataPath1 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_HTML_1;
                const assetMetadataPath2 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CSS_1;
                const assetMetadataPath3 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JPG_1;
                const assetMetadataPath4 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_GIF_1;
                const assetMetadataPath5 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JAR_1;
                const assetMetadata1 = UnitTest.getJsonObject(assetMetadataPath1);
                const assetMetadata2 = UnitTest.getJsonObject(assetMetadataPath2);
                const assetMetadata3 = UnitTest.getJsonObject(assetMetadataPath3);
                const assetMetadata4 = UnitTest.getJsonObject(assetMetadataPath4);
                const assetMetadata5 = UnitTest.getJsonObject(assetMetadataPath5);

                // Create an assetsREST.getModifiedItems stub that returns a promise for asset metadata.
                const stubGet = sinon.stub(assetsREST, "getModifiedItems", function (context, timestamp, opts) {
                    if (stubGet.callCount === 1) {
                        opts.nextURI = "off=2";
                        return Q([assetMetadata1, assetMetadata2]);
                    } else if (stubGet.callCount === 2) {
                        opts.nextURI = "off=4";
                        return Q([assetMetadata3, assetMetadata4]);
                    } else if (stubGet.callCount === 3) {
                        opts.nextURI = "off=6";
                        return Q([assetMetadata5]);
                    } else {
                        delete opts.nextURI;
                        return Q([]);
                    }
                });

                // Create an assetsFS.getItemWriteStream stub that returns a promise for a stream.
                const stubStream = sinon.stub(assetsFS, "getItemWriteStream");
                const stream1 = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG_1 = "unique.id.1";
                stream1.tag = STREAM_TAG_1;
                stubStream.onCall(0).resolves(stream1);
                const stream2 = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG_2 = "unique.id.2";
                stream2.tag = STREAM_TAG_2;
                stubStream.onCall(1).resolves(stream2);
                const stream3 = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG_3 = "unique.id.3";
                stream3.tag = STREAM_TAG_3;
                stubStream.onCall(2).resolves(stream3);
                const stream4 = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG_4 = "unique.id.4";
                stream4.tag = STREAM_TAG_4;
                stubStream.onCall(3).resolves(stream4);
                const stream5 = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG_5 = "unique.id.5";
                stream5.tag = STREAM_TAG_5;
                stubStream.onCall(4).resolves(stream5);

                const emitPipe = function(stream, res) {
                    stream.emit("pipe");
                    const d = Q.defer();
                    d.resolve(res);
                    return d.promise;
                };

                // Create a stub for assetsREST.pullItem that returns a promise for the asset metadata.
                const stubPull = sinon.stub(assetsREST, "pullItem", function () {
                    if (stubPull.callCount === 1) {
                        return emitPipe(stream1, assetMetadata1);
                    } else if (stubPull.callCount === 2) {
                        return emitPipe(stream2, assetMetadata2);
                    } else if (stubPull.callCount === 3) {
                        return emitPipe(stream3, assetMetadata3);
                    } else if (stubPull.callCount === 4) {
                        return emitPipe(stream4, assetMetadata4);
                    } else if (stubPull.callCount === 5) {
                        return emitPipe(stream5, assetMetadata5);
                    }
                });

                // Create spies to listen for the "pulled" and "pulled-error" events.
                const emitter = assetsHelper.getEventEmitter(context);
                const spyPull = sinon.spy();
                emitter.on("pulled", spyPull);
                const spyError = sinon.spy();
                emitter.on("pulled-error", spyError);

                // Create a stub for assetsFS.isContentResource that returns false.
                const stubIsContentResource = sinon.stub(assetsFS, "isContentResource");
                stubIsContentResource.returns(false);

                // The stubs and spies should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubStream);
                self.addTestDouble(stubPull);
                self.addTestDouble(stubIsContentResource);

                // Call the method being tested.
                let error;
                assetsHelper.pullModifiedItems(context, {offset: 0, limit: 2, assetTypes: assetsHelper.ASSET_TYPES_WEB_ASSETS})
                    .then(function (assets) {
                        // Verify that the helper returned the expected values.
                        // Note that pullAllAssets is designed to return a metadata array, but currently it does not.
                        if (assets) {
                            expect(assets).to.have.lengthOf(5);
                            expect(assets[0].path).to.equal(assetMetadata1.path);
                            expect(assets[1].path).to.equal(assetMetadata2.path);
                            expect(assets[2].path).to.equal(assetMetadata3.path);
                            expect(assets[3].path).to.equal(assetMetadata4.path);
                            expect(assets[4].path).to.equal(assetMetadata5.path);
                        }

                        // Verify that the get stub was called four times.
                        expect(stubGet).to.have.callCount(3);

                        // Verify that the stream stub was called five times, each time with the expected path.
                        expect(stubStream).to.have.callCount(5);
                        expect(stubStream.args[0][1]).to.equal(assetMetadata1);
                        expect(stubStream.args[1][1]).to.equal(assetMetadata2);
                        expect(stubStream.args[2][1]).to.equal(assetMetadata3);
                        expect(stubStream.args[3][1]).to.equal(assetMetadata4);
                        expect(stubStream.args[4][1]).to.equal(assetMetadata5);

                        // Verify that the pull stub was called five times, each time with the expected path and stream.
                        expect(stubPull).to.have.callCount(5);
                        expect(stubPull.args[0][1].path).to.equal(assetMetadata1.path);
                        expect(stubPull.args[1][1].path).to.equal(assetMetadata2.path);
                        expect(stubPull.args[2][1].path).to.equal(assetMetadata3.path);
                        expect(stubPull.args[3][1].path).to.equal(assetMetadata4.path);
                        expect(stubPull.args[4][1].path).to.equal(assetMetadata5.path);
                        expect(stubPull.args[0][2].tag).to.equal(STREAM_TAG_1);
                        expect(stubPull.args[1][2].tag).to.equal(STREAM_TAG_2);
                        expect(stubPull.args[2][2].tag).to.equal(STREAM_TAG_3);
                        expect(stubPull.args[3][2].tag).to.equal(STREAM_TAG_4);
                        expect(stubPull.args[4][2].tag).to.equal(STREAM_TAG_5);

                        // Verify that the spies were called the expected number of times with the expected values.
                        expect(spyPull).to.have.callCount(5);
                        expect(spyPull.args[0][0].path).to.equal(assetMetadata1.path);
                        expect(spyPull.args[1][0].path).to.equal(assetMetadata2.path);
                        expect(spyPull.args[2][0].path).to.equal(assetMetadata3.path);
                        expect(spyPull.args[3][0].path).to.equal(assetMetadata4.path);
                        expect(spyPull.args[4][0].path).to.equal(assetMetadata5.path);
                        expect(spyError).to.not.have.been.called;

                        // Verify that the hashes were called as expected.
                        expect(stubSetLastPull).to.have.been.calledOnce;

                        expect(stubUpdateHashes).to.have.callCount(5);
                        expect(stubUpdateHashes.args[0][4]).to.contain(AssetsUnitTest.ASSET_HTML_1);
                        expect(stubUpdateHashes.args[0][3].path).to.contain(AssetsUnitTest.ASSET_HTML_1);
                        expect(stubUpdateHashes.args[1][4]).to.contain(AssetsUnitTest.ASSET_CSS_1);
                        expect(stubUpdateHashes.args[1][3].path).to.contain(AssetsUnitTest.ASSET_CSS_1);
                        expect(stubUpdateHashes.args[2][4]).to.contain(AssetsUnitTest.ASSET_JPG_1);
                        expect(stubUpdateHashes.args[2][3].path).to.contain(AssetsUnitTest.ASSET_JPG_1);
                        expect(stubUpdateHashes.args[3][4]).to.contain(AssetsUnitTest.ASSET_GIF_1);
                        expect(stubUpdateHashes.args[3][3].path).to.contain(AssetsUnitTest.ASSET_GIF_1);
                        expect(stubUpdateHashes.args[4][4]).to.contain(AssetsUnitTest.ASSET_JAR_1);
                        expect(stubUpdateHashes.args[4][3].path).to.contain(AssetsUnitTest.ASSET_JAR_1);
                    })
                    .catch(function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        emitter.removeListener("pulled", spyPull);
                        emitter.removeListener("pulled-error", spyError);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testPullManifestItems () {
        const self = this;
        describe("pullManifestItems", function () {
            it("should fail when getting the manifest items fails.", function (done) {
                // Create a helper.getManifestItems stub that returns an error.
                const MANIFEST_ERROR = "There was an error getting the manifest items.";
                const stub = sinon.stub(assetsHelper, "getManifestItems");
                stub.rejects(MANIFEST_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsHelper.pullManifestItems(context, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the manifest items should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once.
                            expect(stub).to.be.calledOnce;

                            // Verify that the expected error is returned.
                            expect(err.message).to.contain(MANIFEST_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when getting the remote item metadata fails.", function (done) {
                // Read the contents of five test asset metadata files.
                const assetMetadataPath1 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_HTML_1;
                const assetMetadataPath2 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CSS_1;
                const assetMetadata1 = UnitTest.getJsonObject(assetMetadataPath1);
                const assetMetadata2 = UnitTest.getJsonObject(assetMetadataPath2);

                // Create a helper.getManifestItems stub that returns a promise for the manifest items.
                const stubGet = sinon.stub(assetsHelper, "getManifestItems");
                stubGet.resolves([assetMetadata1, assetMetadata2, UnitTest.DUMMY_METADATA]);

                // Create a helper._getRemoteItemList stub that returns an error.
                const LIST_ERROR = "There was an error getting the remote item metadata.";
                const stubList = sinon.stub(assetsHelper, "_getRemoteItemList");
                stubList.rejects(LIST_ERROR);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubList);

                // Call the method being tested.
                let error;
                assetsHelper.pullManifestItems(context, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the manifest items should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once.
                            expect(stubList).to.be.calledOnce;

                            // Verify that the expected error is returned.
                            expect(err.message).to.contain(LIST_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when pulling the list of items fails.", function (done) {
                // Read the contents of five test asset metadata files.
                const assetMetadataPath1 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_HTML_1;
                const assetMetadataPath2 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CSS_1;
                const assetMetadata1 = UnitTest.getJsonObject(assetMetadataPath1);
                const assetMetadata2 = UnitTest.getJsonObject(assetMetadataPath2);

                // Create a helper.getManifestItems stub that returns a promise for the manifest items.
                const stubGet = sinon.stub(assetsHelper, "getManifestItems");
                stubGet.resolves([assetMetadata1, assetMetadata2, UnitTest.DUMMY_METADATA]);

                // Create a helper._getRemoteItemList stub that returns a promise for the metadata of the items.
                const stubList = sinon.stub(assetsHelper, "_getRemoteItemList");
                stubGet.resolves([assetMetadata1, assetMetadata2, UnitTest.DUMMY_METADATA]);

                // Create a helper._pullItemList stub that returns an error.
                const LIST_ERROR = "There was an error pulling the manifest items.";
                const stubPull = sinon.stub(assetsHelper, "_pullItemList");
                stubPull.rejects(LIST_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubList);
                self.addTestDouble(stubPull);

                // Call the method being tested.
                let error;
                assetsHelper.pullManifestItems(context, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the manifest items should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once.
                            expect(stubList).to.be.calledOnce;

                            // Verify that the expected error is returned.
                            expect(err.message).to.contain(LIST_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when pulling manifest items.", function (done) {
                // Read the contents of five test asset metadata files.
                const assetMetadataPath1 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_HTML_1;
                const assetMetadataPath2 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CSS_1;
                const assetMetadataPath3 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JPG_1;
                const assetMetadata1 = UnitTest.getJsonObject(assetMetadataPath1);
                const assetMetadata2 = UnitTest.getJsonObject(assetMetadataPath2);
                const assetMetadata3 = UnitTest.getJsonObject(assetMetadataPath3);
                const isSystem3 = assetMetadata3.isSystem;
                assetMetadata3.isSystem = true;

                // Create a helper.getManifestItems stub that returns a promise for the manifest items.
                const stubGet = sinon.stub(assetsHelper, "getManifestItems");
                stubGet.resolves([assetMetadata1, assetMetadata2, assetMetadata3, UnitTest.DUMMY_METADATA]);

                // Create a rest.getItem stub that returns a promise for the metadata of an item.
                const GET_ERROR = "There was an error getting a remote item, as expected by a unit test.";
                const stubList = sinon.stub(assetsREST, "getItemByPath");
                stubList.onCall(0).resolves(assetMetadata1);
                stubList.onCall(1).resolves(assetMetadata2);
                stubList.onCall(2).resolves(assetMetadata3);
                stubList.onCall(3).rejects(GET_ERROR);

                // Create a helper._pullAsset stub that returns the meatadata of an item, and an error.
                const LIST_ERROR = "There was an error pulling the manifest items.";
                const stubPull = sinon.stub(assetsHelper, "_pullAsset");
                stubPull.onCall(0).resolves(assetMetadata1);
                stubPull.onCall(1).resolves(assetMetadata2);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubList);
                self.addTestDouble(stubPull);

                // Call the method being tested.
                let error;
                assetsHelper.pullManifestItems(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (items) {
                        // Verify that the results have the expected values.
                        expect(items).to.have.lengthOf(2);
                        expect(items[0].id).to.equal(assetMetadata1.id);
                        expect(items[1].id).to.equal(assetMetadata2.id);

                        // Verify that the get stub was called once.
                        expect(stubGet).to.have.been.calledOnce;
                    })
                    .catch (function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        assetMetadata3.isSystem = isSystem3;

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testPullResources () {
        const self = this;
        describe("pullResources", function () {
            it("should short-circuit when pulling only web assets.", function (done) {
                // Create an assetsREST.getResourceList spy to verify that it is not called.
                const spy = sinon.spy(assetsREST, "getResourceList");

                // The spy should be restored when the test is complete.
                self.addTestDouble(spy);

                // Call the method being tested.
                let error;
                assetsHelper.pullResources(context, {assetTypes: assetsHelper.ASSET_TYPES_WEB_ASSETS})
                    .then(function () {
                        // Verify that the spy was not called.
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

            it("should short-circuit when pulling with no virtual folder.", function (done) {
                // Create an assetsREST.getResourceList spy to verify that it is not called.
                const spy = sinon.spy(assetsREST, "getResourceList");

                // The spy should be restored when the test is complete.
                self.addTestDouble(spy);

                // Call the method being tested.
                let error;
                assetsHelper.pullResources(context, {noVirtualFolder: true})
                    .then(function () {
                        // Verify that the spy was not called.
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

            it("should fail when there is an error getting remote resources.", function (done) {
                // Create an assetsREST.getResourceList stub that returns an error.
                const RESOURCES_ERROR = "There was an error getting the remote resources, as expected by unit test.";
                const stub = sinon.stub(assetsREST, "getResourceList");
                stub.rejects(RESOURCES_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsHelper.pullResources(context)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the remote resources should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once.
                        expect(stub).to.be.calledOnce;

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.equal(RESOURCES_ERROR);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when there are no remote resources.", function (done) {
                // Create an assetsREST.getResourceList stub to return an empty list.
                const stub = sinon.stub(assetsREST, "getResourceList");
                stub.resolves([]);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsHelper.pullResources(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (resources) {
                        // Verify that the stub was called once and returned an empty list.
                        expect(stub).to.have.been.calledOnce;
                        expect(resources).to.be.an("array").that.is.empty;
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when there is one remote resource.", function (done) {
                // Create an assetsREST.getResourceList stub to return a single resource.
                const stubResource = sinon.stub(assetsREST, "getResourceList");
                stubResource.resolves([UnitTest.DUMMY_METADATA]);

                const stubGetFilename = sinon.stub(assetsREST, "getResourceFilename");
                stubGetFilename.resolves("test1");

                // Create an assetsFS.getItemWriteStream stub that returns a promise for a stream.
                const stubStream = sinon.stub(assetsFS, "getResourceWriteStream");
                const stream1 = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG_1 = "unique.id.1";
                stream1.tag = STREAM_TAG_1;
                stubStream.resolves(stream1);

                // Create a stub for assetsREST.pullItem that returns a promise for the resource metadata.
                const stubPull = sinon.stub(assetsREST, "pullItem", function () {
                    stream1.emit("pipe");
                    const resource = utils.cloneOpts(UnitTest.DUMMY_METADATA, {disposition: UnitTest.DUMMY_NAME});
                    return Q(resource);
                });

                // Create a stub for assetsFS.renameResource.
                const stubRename = sinon.stub(assetsFS, "renameResource");

                // Create spies to listen for the "resource-pulled" and "resource-pulled-error" events.
                const emitter = assetsHelper.getEventEmitter(context);
                const spyPull = sinon.spy();
                emitter.on("resource-pulled", spyPull);
                const spyError = sinon.spy();
                emitter.on("resource-pulled-error", spyError);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubResource);
                self.addTestDouble(stubGetFilename);
                self.addTestDouble(stubStream);
                self.addTestDouble(stubPull);
                self.addTestDouble(stubRename);

                // Call the method being tested.
                let error;
                assetsHelper.pullResources(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (resources) {
                        // Verify that the resource stub was called once and returned a single resource.
                        expect(stubResource).to.have.been.calledOnce;
                        expect(resources).to.be.an("array").that.has.lengthOf(1);
                        expect(resources[0].path).to.equal(UnitTest.DUMMY_METADATA.path);

                        // Verify that the pull spy was called once and that the error spy was not called.
                        expect(spyPull).to.have.been.calledOnce;
                        expect(spyError).to.not.have.been.called;

                        // Verify that the hashes were updated during the stream write.
                        expect(stubGenerateMD5HashFromStream).to.have.been.calledOnce;
                        expect(stubUpdateResourceHashes).to.have.been.calledOnce;

                        // Verify that the other stubs were called once with the expected values.
                        expect(stubStream).to.have.been.calledOnce;
                        expect(stubStream.args[0][1]).to.contain(UnitTest.DUMMY_METADATA.id);
                        expect(stubPull).to.have.been.calledOnce;
                        expect(stubPull.args[0][2]["tag"]).to.equal(STREAM_TAG_1);
                        expect(stubRename).to.have.been.calledOnce;
                        expect(stubRename.args[0][1]).to.contain(UnitTest.DUMMY_METADATA.id);
                        expect(stubRename.args[0][2]).to.contain(UnitTest.DUMMY_NAME);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        emitter.removeListener("resource-pulled", spyPull);
                        emitter.removeListener("resource-pulled-error", spyError);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when one remote resource succeeds and one remote resource fails.", function (done) {
                // Create an assetsREST.getResourceList stub to return two resources.
                const stubResource = sinon.stub(assetsREST, "getResourceList");
                stubResource.resolves([UnitTest.DUMMY_METADATA, UnitTest.DUMMY_METADATA]);

                const stubGetFilename = sinon.stub(assetsREST, "getResourceFilename");
                stubGetFilename.resolves("test1");

                // Create an assetsFS.getItemWriteStream stub that returns a promise for a stream.
                const stubStream = sinon.stub(assetsFS, "getResourceWriteStream");
                const stream1 = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG_1 = "unique.id.1";
                stream1.tag = STREAM_TAG_1;
                stubStream.onFirstCall().resolves(stream1);
                const stream2 = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG_2 = "unique.id.2";
                stream2.tag = STREAM_TAG_2;
                stubStream.onSecondCall().resolves(stream2);

                // Create a stub for assetsREST.pullItem that returns a promise for the resource metadata.
                const PULL_ERROR = "There was an error pulling the resource, as expected by a unit test.";
                const stubPull = sinon.stub(assetsREST, "pullItem", function () {
                    if (stubPull.callCount === 1) {
                        stream1.emit("pipe");
                        const resource = utils.cloneOpts(UnitTest.DUMMY_METADATA, {disposition: UnitTest.DUMMY_NAME});
                        return Q(resource);
                    } else if (stubPull.callCount === 2) {
                        return Q.reject(new Error(PULL_ERROR));
                    }
                });

                // Create a stub for assetsFS.renameResource.
                const stubRename = sinon.stub(assetsFS, "renameResource");

                // Create spies to listen for the "resource-pulled" and "resource-pulled-error" events.
                const emitter = assetsHelper.getEventEmitter(context);
                const spyPull = sinon.spy();
                emitter.on("resource-pulled", spyPull);
                const spyError = sinon.spy();
                emitter.on("resource-pulled-error", spyError);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubResource);
                self.addTestDouble(stubGetFilename);
                self.addTestDouble(stubStream);
                self.addTestDouble(stubPull);
                self.addTestDouble(stubRename);

                // Call the method being tested.
                let error;
                assetsHelper.pullResources(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (resources) {
                        // Verify that the resource stub was called once and returned a single resource plus an error.
                        expect(stubResource).to.have.been.calledOnce;
                        expect(resources).to.be.an("array").that.has.lengthOf(2);
                        expect(resources[0].path).to.equal(UnitTest.DUMMY_METADATA.path);
                        expect(resources[1].message).to.equal(PULL_ERROR);

                        // Verify that the pull spy and the error spy were each called once.
                        expect(spyPull).to.have.been.calledOnce;
                        expect(spyError).to.have.been.calledOnce;

                        // Verify that the hashes were updated during the stream write.
                        expect(stubGenerateMD5HashFromStream).to.have.been.calledOnce;
                        expect(stubUpdateResourceHashes).to.have.been.calledOnce;

                        // Verify that the other stubs were called once with the expected values.
                        expect(stubStream).to.have.been.calledTwice;
                        expect(stubStream.args[0][1]).to.contain(UnitTest.DUMMY_METADATA.id);
                        expect(stubStream.args[1][1]).to.contain(UnitTest.DUMMY_METADATA.id);
                        expect(stubPull).to.have.been.calledTwice;
                        expect(stubPull.args[0][2]["tag"]).to.equal(STREAM_TAG_1);
                        expect(stubPull.args[1][2]["tag"]).to.equal(STREAM_TAG_2);
                        expect(stubRename).to.have.been.calledOnce;
                        expect(stubRename.args[0][1]).to.contain(UnitTest.DUMMY_METADATA.id);
                        expect(stubRename.args[0][2]).to.contain(UnitTest.DUMMY_NAME);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        emitter.removeListener("resource-pulled", spyPull);
                        emitter.removeListener("resource-pulled-error", spyError);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when one remote resource succeeds and one remote resource fails (with no emitter).", function (done) {
                // Create an assetsREST.getResourceList stub to return two resaources.
                const stubResource = sinon.stub(assetsREST, "getResourceList");
                stubResource.resolves([UnitTest.DUMMY_METADATA, UnitTest.DUMMY_METADATA]);

                const stubGetFilename = sinon.stub(assetsREST, "getResourceFilename");
                stubGetFilename.resolves("test1");

                // Create an assetsFS.getItemWriteStream stub that returns a promise for a stream.
                const stubStream = sinon.stub(assetsFS, "getResourceWriteStream");
                const stream1 = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG_1 = "unique.id.1";
                stream1.tag = STREAM_TAG_1;
                stubStream.onFirstCall().resolves(stream1);
                const stream2 = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG_2 = "unique.id.2";
                stream2.tag = STREAM_TAG_2;
                stubStream.onSecondCall().resolves(stream2);

                // Create a stub for assetsREST.pullItem that returns a promise for the resource metadata.
                const PULL_ERROR = "There was an error pulling the resource, as expected by a unit test.";
                const stubPull = sinon.stub(assetsREST, "pullItem", function () {
                    if (stubPull.callCount === 1) {
                        stream1.emit("pipe");
                        const resource = utils.cloneOpts(UnitTest.DUMMY_METADATA, {disposition: UnitTest.DUMMY_NAME});
                        return Q(resource);
                    } else if (stubPull.callCount === 2) {
                        return Q.reject(new Error(PULL_ERROR));
                    }
                });

                // Create a stub for assetsFS.renameResource.
                const stubRename = sinon.stub(assetsFS, "renameResource");

                // Create spies to listen for the "resource-pulled" and "resource-pulled-error" events.
                const emitter = assetsHelper.getEventEmitter(context);
                delete context.eventEmitter;
                const spyPull = sinon.spy();
                emitter.on("resource-pulled", spyPull);
                const spyError = sinon.spy();
                emitter.on("resource-pulled-error", spyError);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubResource);
                self.addTestDouble(stubGetFilename);
                self.addTestDouble(stubStream);
                self.addTestDouble(stubPull);
                self.addTestDouble(stubRename);

                // Call the method being tested.
                let error;
                assetsHelper.pullResources(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (resources) {
                        // Verify that the resource stub was called once and returned a single resource plus an error.
                        expect(stubResource).to.have.been.calledOnce;
                        expect(resources).to.be.an("array").that.has.lengthOf(2);
                        expect(resources[0].path).to.equal(UnitTest.DUMMY_METADATA.path);
                        expect(resources[1].message).to.equal(PULL_ERROR);

                        // Verify that the spies were not called (because there's no emitter).
                        expect(spyPull).to.not.have.been.called;
                        expect(spyError).to.not.have.been.called;

                        // Verify that the hashes were updated during the stream write.
                        expect(stubGenerateMD5HashFromStream).to.have.been.calledOnce;
                        expect(stubUpdateResourceHashes).to.have.been.calledOnce;

                        // Verify that the other stubs were called once with the expected values.
                        expect(stubStream).to.have.been.calledTwice;
                        expect(stubStream.args[0][1]).to.contain(UnitTest.DUMMY_METADATA.id);
                        expect(stubStream.args[1][1]).to.contain(UnitTest.DUMMY_METADATA.id);
                        expect(stubPull).to.have.been.calledTwice;
                        expect(stubPull.args[0][2]["tag"]).to.equal(STREAM_TAG_1);
                        expect(stubPull.args[1][2]["tag"]).to.equal(STREAM_TAG_2);
                        expect(stubRename).to.have.been.calledOnce;
                        expect(stubRename.args[0][1]).to.contain(UnitTest.DUMMY_METADATA.id);
                        expect(stubRename.args[0][2]).to.contain(UnitTest.DUMMY_NAME);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        emitter.removeListener("resource-pulled", spyPull);
                        emitter.removeListener("resource-pulled-error", spyError);
                        context.eventEmitter = emitter;

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when remote resources are retrieved in a full chunk.", function (done) {
                // Create an assetsREST.getResourceList stub to return two resources in a full chunk, then an empty chunk.
                const stubResource = sinon.stub(assetsREST, "getResourceList", function (context, opts) {
                    if (stubResource.callCount === 1) {
                        opts.nextURI = "off=2";
                        return Q([UnitTest.DUMMY_METADATA, UnitTest.DUMMY_METADATA]);
                    } else {
                        delete opts.nextURI;
                        return Q([]);
                    }
                });

                const stubGetFilename = sinon.stub(assetsREST, "getResourceFilename");
                stubGetFilename.resolves("test1");

                // Create an assetsFS.getItemWriteStream stub that returns a promise for a stream.
                const stubStream = sinon.stub(assetsFS, "getResourceWriteStream");
                const stream1 = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG_1 = "unique.id.1";
                stream1.tag = STREAM_TAG_1;
                stubStream.onFirstCall().resolves(stream1);
                const stream2 = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG_2 = "unique.id.2";
                stream2.tag = STREAM_TAG_2;
                stubStream.onSecondCall().resolves(stream2);

                // Create a stub for assetsREST.pullItem that returns a promise for the resource metadata.
                const stubPull = sinon.stub(assetsREST, "pullItem", function () {
                    if (stubPull.callCount === 1) {
                        stream1.emit("pipe");
                        const resource = utils.cloneOpts(UnitTest.DUMMY_METADATA, {disposition: UnitTest.DUMMY_NAME});
                        return Q(resource);
                    } else if (stubPull.callCount === 2) {
                        stream2.emit("pipe");
                        const resource = utils.cloneOpts(UnitTest.DUMMY_METADATA, {disposition: UnitTest.DUMMY_NAME + "-2"});
                        return Q(resource);
                    }
                });

                // Create a stub for assetsFS.renameResource.
                const stubRename = sinon.stub(assetsFS, "renameResource");

                // Create spies to listen for the "resource-pulled" and "resource-pulled-error" events.
                const emitter = assetsHelper.getEventEmitter(context);
                const spyPull = sinon.spy();
                emitter.on("resource-pulled", spyPull);
                const spyError = sinon.spy();
                emitter.on("resource-pulled-error", spyError);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubResource);
                self.addTestDouble(stubGetFilename);
                self.addTestDouble(stubStream);
                self.addTestDouble(stubPull);
                self.addTestDouble(stubRename);

                // Call the method being tested.
                let error;
                assetsHelper.pullResources(context, {limit: 2})
                    .then(function (resources) {
                        // Verify that the resource stub was called once and returned a single resource plus an error.
                        expect(stubResource).to.have.been.calledTwice;
                        expect(resources).to.be.an("array").that.has.lengthOf(2);
                        expect(resources[0].path).to.equal(UnitTest.DUMMY_METADATA.path);
                        expect(resources[1].path).to.equal(UnitTest.DUMMY_METADATA.path);

                        // Verify that the pull spy was called twice and the error spy was not called.
                        expect(spyPull).to.have.been.calledTwice;
                        expect(spyError).to.not.have.been.called;

                        // Verify that the hashes were updated during the stream write.
                        expect(stubGenerateMD5HashFromStream).to.have.been.calledTwice;
                        expect(stubUpdateResourceHashes).to.have.been.calledTwice;

                        // Verify that the other stubs were called once with the expected values.
                        expect(stubStream).to.have.been.calledTwice;
                        expect(stubStream.args[0][1]).to.contain(UnitTest.DUMMY_METADATA.id);
                        expect(stubStream.args[1][1]).to.contain(UnitTest.DUMMY_METADATA.id);
                        expect(stubPull).to.have.been.calledTwice;
                        expect(stubPull.args[0][2]["tag"]).to.equal(STREAM_TAG_1);
                        expect(stubPull.args[1][2]["tag"]).to.equal(STREAM_TAG_2);
                        expect(stubRename).to.have.been.calledTwice;
                        expect(stubRename.args[0][1]).to.contain(UnitTest.DUMMY_METADATA.id);
                        expect(stubRename.args[0][2]).to.contain(UnitTest.DUMMY_NAME);
                        expect(stubRename.args[1][1]).to.contain(UnitTest.DUMMY_METADATA.id);
                        expect(stubRename.args[1][2]).to.contain(UnitTest.DUMMY_NAME + "-2");
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        emitter.removeListener("resource-pulled", spyPull);
                        emitter.removeListener("resource-pulled-error", spyError);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when remote resources are retrieved in multiple chunks.", function (done) {
                // Create an assetsREST.getResourceList stub to return three resources in two chunks.
                const stubResource = sinon.stub(assetsREST, "getResourceList", function (context, opts) {
                    if (stubResource.callCount === 1) {
                        opts.nextURI = "off=2";
                        return Q([UnitTest.DUMMY_METADATA, UnitTest.DUMMY_METADATA]);
                    } else {
                        delete opts.nextURI;
                        return Q([{"id": "zzz", "path": "test2"}]);
                    }
                });

                // Change the hashes.getPathForResource stub to return an existing path for the second resource.
                stubGetPathForResource.onSecondCall().returns("some-path");

                const stubGetFilename = sinon.stub(assetsREST, "getResourceFilename");
                stubGetFilename.resolves("test1");

                // Create an assetsFS.getItemWriteStream stub that returns a promise for a stream.
                const stubStream = sinon.stub(assetsFS, "getResourceWriteStream");
                const stream1 = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG_1 = "unique.id.1";
                stream1.tag = STREAM_TAG_1;
                stubStream.onFirstCall().resolves(stream1);
                const stream2 = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG_2 = "unique.id.2";
                stream2.tag = STREAM_TAG_2;
                stubStream.onSecondCall().resolves(stream2);

                // Create a stub for assetsREST.pullItem that returns a promise for the resource metadata.
                const stubPull = sinon.stub(assetsREST, "pullItem", function () {
                    if (stubPull.callCount === 1) {
                        stream1.emit("pipe");
                        const resource = utils.cloneOpts(UnitTest.DUMMY_METADATA, {disposition: UnitTest.DUMMY_NAME});
                        return Q(resource);
                    } else if (stubPull.callCount === 2) {
                        stream2.emit("pipe");
                        const resource = {"id": "zzz", "path": "test2", disposition: UnitTest.DUMMY_NAME + "-2"};
                        return Q(resource);
                    }
                });

                // Create a stub for assetsFS.renameResource.
                const stubRename = sinon.stub(assetsFS, "renameResource");

                // Create spies to listen for the "resource-pulled" and "resource-pulled-error" events.
                const emitter = assetsHelper.getEventEmitter(context);
                const spyPull = sinon.spy();
                emitter.on("resource-pulled", spyPull);
                const spyError = sinon.spy();
                emitter.on("resource-pulled-error", spyError);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubResource);
                self.addTestDouble(stubGetFilename);
                self.addTestDouble(stubStream);
                self.addTestDouble(stubPull);
                self.addTestDouble(stubRename);

                // Call the method being tested.
                let error;
                assetsHelper.pullResources(context, {limit: 2})
                    .then(function (resources) {
                        // Verify that the resource stub was called once and returned a single resource plus an error.
                        expect(stubResource).to.have.been.calledTwice;
                        expect(resources).to.be.an("array").that.has.lengthOf(2);
                        expect(resources[0].path).to.equal(UnitTest.DUMMY_METADATA.path);
                        expect(resources[1].path).to.equal("test2");

                        // Verify that the pull spy was called twice and the error spy was not called.
                        expect(spyPull).to.have.been.calledTwice;
                        expect(spyError).to.not.have.been.called;

                        // Verify that the hashes were updated during the stream write.
                        expect(stubGenerateMD5HashFromStream).to.have.been.calledTwice;
                        expect(stubUpdateResourceHashes).to.have.been.calledTwice;

                        // Verify that the other stubs were called once with the expected values.
                        expect(stubStream).to.have.been.calledTwice;
                        expect(stubStream.args[0][1]).to.contain(UnitTest.DUMMY_METADATA.id);
                        expect(stubStream.args[1][1]).to.contain("zzz");
                        expect(stubPull).to.have.been.calledTwice;
                        expect(stubPull.args[0][2]["tag"]).to.equal(STREAM_TAG_1);
                        expect(stubPull.args[1][2]["tag"]).to.equal(STREAM_TAG_2);
                        expect(stubRename).to.have.been.calledTwice;
                        expect(stubRename.args[0][1]).to.contain(UnitTest.DUMMY_METADATA.id);
                        expect(stubRename.args[0][2]).to.contain(UnitTest.DUMMY_NAME);
                        expect(stubRename.args[1][1]).to.contain("zzz");
                        expect(stubRename.args[1][2]).to.contain(UnitTest.DUMMY_NAME + "-2");
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        emitter.removeListener("resource-pulled", spyPull);
                        emitter.removeListener("resource-pulled-error", spyError);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when one remote resource succeeds and one remote resource fails.", function (done) {
                // Create an assetsREST.getResourceList stub to return two resources.
                const stubResource = sinon.stub(assetsREST, "getResourceList");
                stubResource.resolves([UnitTest.DUMMY_METADATA, UnitTest.DUMMY_METADATA]);

                const stubGetFilename = sinon.stub(assetsREST, "getResourceFilename");
                stubGetFilename.resolves("test1");

                // Create an assetsFS.getItemWriteStream stub that returns a promise for a stream.
                const stubStream = sinon.stub(assetsFS, "getResourceWriteStream");
                const stream1 = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG_1 = "unique.id.1";
                stream1.tag = STREAM_TAG_1;
                stubStream.onFirstCall().resolves(stream1);
                const stream2 = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG_2 = "unique.id.2";
                stream2.tag = STREAM_TAG_2;
                stubStream.onSecondCall().resolves(stream2);

                // Create a stub for assetsREST.pullItem that returns a promise for the resource metadata.
                const PULL_ERROR = "There was an error pulling the resource, as expected by a unit test.";
                const stubPull = sinon.stub(assetsREST, "pullItem", function () {
                    if (stubPull.callCount === 1) {
                        stream1.emit("pipe");
                        const resource = utils.cloneOpts(UnitTest.DUMMY_METADATA, {disposition: UnitTest.DUMMY_NAME});
                        return Q(resource);
                    } else if (stubPull.callCount === 2) {
                        return Q.reject(new Error(PULL_ERROR));
                    }
                });

                // Create a stub for assetsFS.renameResource.
                const stubRename = sinon.stub(assetsFS, "renameResource");

                // Create spies to listen for the "resource-pulled" and "resource-pulled-error" events.
                const emitter = assetsHelper.getEventEmitter(context);
                const spyPull = sinon.spy();
                emitter.on("resource-pulled", spyPull);
                const spyError = sinon.spy();
                emitter.on("resource-pulled-error", spyError);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubResource);
                self.addTestDouble(stubGetFilename);
                self.addTestDouble(stubStream);
                self.addTestDouble(stubPull);
                self.addTestDouble(stubRename);

                // Call the method being tested.
                let error;
                assetsHelper.pullResources(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (resources) {
                        // Verify that the resource stub was called once and returned a single resource plus an error.
                        expect(stubResource).to.have.been.calledOnce;
                        expect(resources).to.be.an("array").that.has.lengthOf(2);
                        expect(resources[0].path).to.equal(UnitTest.DUMMY_METADATA.path);
                        expect(resources[1].message).to.equal(PULL_ERROR);

                        // Verify that the pull spy and the error spy were each called once.
                        expect(spyPull).to.have.been.calledOnce;
                        expect(spyError).to.have.been.calledOnce;

                        // Verify that the hashes were updated during the stream write.
                        expect(stubGenerateMD5HashFromStream).to.have.been.calledOnce;
                        expect(stubUpdateResourceHashes).to.have.been.calledOnce;

                        // Verify that the other stubs were called once with the expected values.
                        expect(stubStream).to.have.been.calledTwice;
                        expect(stubStream.args[0][1]).to.contain(UnitTest.DUMMY_METADATA.id);
                        expect(stubStream.args[1][1]).to.contain(UnitTest.DUMMY_METADATA.id);
                        expect(stubPull).to.have.been.calledTwice;
                        expect(stubPull.args[0][2]["tag"]).to.equal(STREAM_TAG_1);
                        expect(stubPull.args[1][2]["tag"]).to.equal(STREAM_TAG_2);
                        expect(stubRename).to.have.been.calledOnce;
                        expect(stubRename.args[0][1]).to.contain(UnitTest.DUMMY_METADATA.id);
                        expect(stubRename.args[0][2]).to.contain(UnitTest.DUMMY_NAME);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        emitter.removeListener("resource-pulled", spyPull);
                        emitter.removeListener("resource-pulled-error", spyError);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed with deletions when there is one remote resource and two local resources.", function (done) {
                // Create an assetsREST.getResourceList stub to return a single resource.
                const stubResource = sinon.stub(assetsREST, "getResourceList");
                stubResource.resolves([UnitTest.DUMMY_METADATA]);

                const stubGetFilename = sinon.stub(assetsREST, "getResourceFilename");
                stubGetFilename.resolves("test1");

                // Create an assetsFS.getItemWriteStream stub that returns a promise for a stream.
                const stubStream = sinon.stub(assetsFS, "getResourceWriteStream");
                const stream1 = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG_1 = "unique.id.1";
                stream1.tag = STREAM_TAG_1;
                stubStream.resolves(stream1);

                // Create a stub for assetsREST.pullItem that returns a promise for the resource metadata.
                const stubPull = sinon.stub(assetsREST, "pullItem", function () {
                    stream1.emit("pipe");
                    const resource = utils.cloneOpts(UnitTest.DUMMY_METADATA, {disposition: UnitTest.DUMMY_NAME});
                    return Q(resource);
                });

                // Create a stub for assetsFS.renameResource.
                const stubRename = sinon.stub(assetsFS, "renameResource");

                // Create an assetsFS.listLocalResourceNames stub to return two resources.
                const stubLocal = sinon.stub(assetsHelper, "listLocalResourceNames");
                stubLocal.resolves([UnitTest.DUMMY_METADATA, {"id": "zzz", "path": "test2"}]);

                // Create spies to listen for the "resource-pulled" and "resource-pulled-error" events.
                const emitter = assetsHelper.getEventEmitter(context);
                const spyPull = sinon.spy();
                emitter.on("resource-pulled", spyPull);
                const spyError = sinon.spy();
                emitter.on("resource-pulled-error", spyError);
                const spyLocalOnly = sinon.spy();
                emitter.on("resource-local-only", spyLocalOnly);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubResource);
                self.addTestDouble(stubGetFilename);
                self.addTestDouble(stubStream);
                self.addTestDouble(stubPull);
                self.addTestDouble(stubRename);
                self.addTestDouble(stubLocal);

                // Call the method being tested.
                let error;
                assetsHelper.pullResources(context, {deletions: true})
                    .then(function (resources) {
                        // Verify that the resource stub was called once and returned a single resource.
                        expect(stubResource).to.have.been.calledOnce;
                        expect(resources).to.be.an("array").that.has.lengthOf(1);
                        expect(resources[0].path).to.equal(UnitTest.DUMMY_METADATA.path);

                        // Verify that the pull spy was called once and that the error spy was not called.
                        expect(spyPull).to.have.been.calledOnce;
                        expect(spyError).to.not.have.been.called;

                        // Verify that the local-only spy was called once.
                        expect(spyLocalOnly).to.have.been.calledOnce;
                        expect(spyLocalOnly.args[0][0]["path"]).to.equal("test2");

                        // Verify that the hashes were updated during the stream write.
                        expect(stubGenerateMD5HashFromStream).to.have.been.calledOnce;
                        expect(stubUpdateResourceHashes).to.have.been.calledOnce;

                        // Verify that the other stubs were called once with the expected values.
                        expect(stubStream).to.have.been.calledOnce;
                        expect(stubStream.args[0][1]).to.contain(UnitTest.DUMMY_METADATA.id);
                        expect(stubPull).to.have.been.calledOnce;
                        expect(stubPull.args[0][2]["tag"]).to.equal(STREAM_TAG_1);
                        expect(stubRename).to.have.been.calledOnce;
                        expect(stubRename.args[0][1]).to.contain(UnitTest.DUMMY_METADATA.id);
                        expect(stubRename.args[0][2]).to.contain(UnitTest.DUMMY_NAME);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        emitter.removeListener("resource-pulled", spyPull);
                        emitter.removeListener("resource-pulled-error", spyError);
                        emitter.removeListener("resource-local-only", spyLocalOnly);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testPushAsset () {
        const self = this;
        describe("pushItem", function () {
            it("should fail when getting the local asset fails.", function (done) {
                // Create an assetsFS.getItemReadStream stub that returns an error.
                const ASSET_ERROR = "There was an error getting the local asset stream.";
                const stub = sinon.stub(assetsFS, "getItemReadStream");
                stub.rejects(ASSET_ERROR);

                // Create an assetsREST.pushItem spy.
                const spy = sinon.spy(assetsREST, "pushItem");

                // Create a stub for assetsFS.isContentResource that returns false.
                const stubIsContentResource = sinon.stub(assetsFS, "isContentResource");
                stubIsContentResource.returns(false);

                // Create a stub for assetsFS.getContentLength that returns 0.
                const stubContentLength = sinon.stub(assetsFS, "getContentLength");
                stubContentLength.resolves(0);

                // Change the stub for hashes.stubGenerateMD5Hash to return a value.
                stubGenerateMD5Hash.returns("12345678980");

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stub);
                self.addTestDouble(spy);
                self.addTestDouble(stubIsContentResource);
                self.addTestDouble(stubContentLength);

                // Call the method being tested.
                let error;
                assetsHelper.pushItem(context, UnitTest.DUMMY_PATH, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the local asset should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once.
                            expect(stub).to.be.calledOnce;

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.equal(ASSET_ERROR);

                            // Verify that the spy was not called.
                            expect(spy).to.not.have.been.called;
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when putting the remote asset fails.", function (done) {
                // Create an assetsFS.getItemReadStream spy.
                const spyFS = sinon.spy(assetsFS, "getItemReadStream");

                // Create an assetsREST.pushItem stub that returns an error.
                const ASSET_ERROR = "There was an error pushing the asset stream.";
                const stubREST = sinon.stub(assetsREST, "pushItem");
                stubREST.rejects(ASSET_ERROR);

                // Create a stub for assetsFS.isContentResource that returns false.
                const stubIsContentResource = sinon.stub(assetsFS, "isContentResource");
                stubIsContentResource.returns(false);

                // Create a stub for assetsFS.getContentLength that returns 0.
                const stubContentLength = sinon.stub(assetsFS, "getContentLength");
                stubContentLength.resolves(0);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(spyFS);
                self.addTestDouble(stubREST);
                self.addTestDouble(stubIsContentResource);
                self.addTestDouble(stubContentLength);

                // Call the method being tested.
                let error;
                assetsHelper.pushItem(context, AssetsUnitTest.ASSET_HBS_1, {"workingDir": AssetsUnitTest.API_PATH + UnitTest.VALID_RESOURCES_DIRECTORY})
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for pushing the asset should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the FS spy was called once.
                            expect(spyFS).to.be.calledOnce;

                            // Verify that the REST stub was called once.
                            expect(stubREST).to.be.calledOnce;

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


            it("should fail when getting the content length fails.", function (done) {
                // Create a stub for assetsFS.getContentLength that returns 0.
                const stub = sinon.stub(assetsFS, "getContentLength");
                const ASSET_ERROR = "There was an error getting the content length.";
                stub.rejects(ASSET_ERROR);

                // Create an assetsFS.getItemReadStream spy.
                const spy = sinon.spy(assetsFS, "getItemReadStream");

                // The stubs should be restored when the test is complete.
                self.addTestDouble(spy);
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsHelper.pushItem(context, AssetsUnitTest.DUMMY_PATH, AssetsUnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the content length should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once.
                            expect(stub).to.be.calledOnce;

                            // Verify that the spy was not called.
                            expect(spy).to.not.be.called;

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

            it("should succeed when pushing an asset.", function (done) {
                // Read the contents of a test asset file.
                const assetPath = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_HBS_1;
                const assetContent = fs.readFileSync(assetPath);
                const assetMetadataPath = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_HBS_1;
                const assetMetadata = UnitTest.getJsonObject(assetMetadataPath);

                // Create an assetsFS.getItemReadStream stub that returns a promise for the asset stream.
                const stubFS = sinon.stub(assetsFS, "getItemReadStream");
                const assetStream = new stream.Readable();
                assetStream.push(assetContent);
                assetStream.push(null);
                stubFS.resolves(assetStream);

                // Create an assetsREST.pushItem stub that returns a promise for the asset metadata. In this case the
                // stub also emits a stream close event so that subsequent promises will be resolved.
                const stubREST = sinon.stub(assetsREST, "pushItem", function () {
                    assetStream.emit("close");
                    const deferred = Q.defer();
                    deferred.resolve(assetMetadata);
                    return deferred.promise;
                });

                // Create a stub for assetsFS.isContentResource that returns false.
                const stubIsContentResource = sinon.stub(assetsFS, "isContentResource");
                stubIsContentResource.returns(false);

                // Create a stub for assetsFS.getContentLength that returns 0.
                const stubContentLength = sinon.stub(assetsFS, "getContentLength");
                stubContentLength.resolves(0);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubFS);
                self.addTestDouble(stubREST);
                self.addTestDouble(stubIsContentResource);
                self.addTestDouble(stubContentLength);

                // Call the method being tested.
                let error;
                assetsHelper.pushItem(context, AssetsUnitTest.ASSET_HBS_1, UnitTest.DUMMY_OPTIONS)
                    .then(function (asset) {
                        // Verify that the helper returned the expected value.
                        expect(diff.diffJson(assetMetadata, asset)).to.have.lengthOf(1);

                        // Verify that the FS stub was called once with the specified path (before the REST stub).
                        expect(stubFS).to.have.been.calledOnce;
                        expect(stubFS.firstCall.args[1]).to.equal(AssetsUnitTest.ASSET_HBS_1);
                        expect(stubFS).to.have.been.calledBefore(stubREST);

                        // Verify that the REST stub was called once with the specified path and content.
                        expect(stubREST).to.have.been.calledOnce;
                        expect(stubREST.firstCall.args[6]).to.equal(AssetsUnitTest.ASSET_HBS_1);
                        const streamContent = stubREST.firstCall.args[7].read(65536);
                        expect(Buffer.compare(streamContent, assetContent)).to.equal(0);

                        expect(stubUpdateHashes).to.have.been.calledOnce;
                        expect(stubUpdateHashes.args[0][4]).to.contain(AssetsUnitTest.ASSET_HBS_1);
                        expect(stubUpdateHashes.args[0][3].path).to.contain(AssetsUnitTest.ASSET_HBS_1);
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

            it("should succeed when pushing an asset succeeds on retry.", function (done) {
                // Read the contents of a test asset file.
                const assetPath = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_HBS_1;
                const assetContent = fs.readFileSync(assetPath);
                const assetMetadataPath = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_HBS_1;
                const assetMetadata = UnitTest.getJsonObject(assetMetadataPath);

                // Create an assetsFS.getItemReadStream stub that returns a promise for the asset stream.
                const stubFS = sinon.stub(assetsFS, "getItemReadStream");
                const assetStream1 = new stream.Readable();
                assetStream1.tag = 1;
                assetStream1.push(assetContent);
                assetStream1.push(null);
                const assetStream2 = new stream.Readable();
                assetStream2.tag = 2;
                assetStream2.push(assetContent);
                assetStream2.push(null);
                const assetStream3 = new stream.Readable();
                assetStream3.push(assetContent);
                assetStream3.push(null);
                stubFS.onFirstCall().resolves(assetStream1);
                stubFS.onSecondCall().resolves(assetStream2);
                stubFS.onThirdCall().resolves(assetStream3);

                // Create an assetsREST.pushItem stub that fails the first and second times with an error that can be
                // retried. The third time it returns a promise for the asset metadata and emits a stream close event.
                const PUSH_ERROR = "Error pushing an item, as expected by a unit test.";
                const stubREST = sinon.stub(assetsREST, "pushItem", function (context, isRaw, isContentResource, replaceContentResource, resourceId, resourceMd5, pathname, stream, length, opts) {
                    if (stream.tag === 1 || stream.tag === 2) {
                        const error = new Error(PUSH_ERROR);
                        error.retry = true;
                        return Q.reject(error);
                    } else {
                        stream.emit("close");
                        return Q(assetMetadata);
                    }
                });

                // Create a stub for assetsFS.isContentResource that returns false.
                const stubIsContentResource = sinon.stub(assetsFS, "isContentResource");
                stubIsContentResource.returns(false);

                // Create a stub for assetsFS.getContentLength that returns 0.
                const stubContentLength = sinon.stub(assetsFS, "getContentLength");
                stubContentLength.resolves(0);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubFS);
                self.addTestDouble(stubREST);
                self.addTestDouble(stubIsContentResource);
                self.addTestDouble(stubContentLength);

                // Call the method being tested.
                let error;
                assetsHelper.pushItem(context, AssetsUnitTest.ASSET_HBS_1, {retryMaxAttempts: 5, retryMinTimeout: 0, retryMaxTimeout: 10, retryFactor: 1, retryRandomize: false})
                    .then(function (asset) {
                        // Verify that the helper returned the expected value.
                        expect(diff.diffJson(assetMetadata, asset)).to.have.lengthOf(1);

                        // Verify that the FS stub was called three times with the specified path (before the REST stub).
                        expect(stubFS).to.have.been.calledThrice;
                        expect(stubFS.firstCall.args[1]).to.equal(AssetsUnitTest.ASSET_HBS_1);
                        expect(stubFS.secondCall.args[1]).to.equal(AssetsUnitTest.ASSET_HBS_1);
                        expect(stubFS.thirdCall.args[1]).to.equal(AssetsUnitTest.ASSET_HBS_1);
                        expect(stubFS).to.have.been.calledBefore(stubREST);

                        // Verify that the REST stub was called three times with the specified path and content.
                        expect(stubREST).to.have.been.calledThrice;
                        expect(stubREST.firstCall.args[6]).to.equal(AssetsUnitTest.ASSET_HBS_1);
                        expect(stubREST.secondCall.args[6]).to.equal(AssetsUnitTest.ASSET_HBS_1);
                        expect(stubREST.thirdCall.args[6]).to.equal(AssetsUnitTest.ASSET_HBS_1);
                        const streamContent = stubREST.thirdCall.args[7].read(65536);
                        expect(Buffer.compare(streamContent, assetContent)).to.equal(0);

                        expect(stubUpdateHashes).to.have.been.calledOnce;
                        expect(stubUpdateHashes.args[0][4]).to.contain(AssetsUnitTest.ASSET_HBS_1);
                        expect(stubUpdateHashes.args[0][3].path).to.contain(AssetsUnitTest.ASSET_HBS_1);
                    })
                    .catch(function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Re-initialize the retry push properties.
                        assetsHelper.initializeRetryPush(context);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when pushing an asset and retrying the maximum number of times.", function (done) {
                // Read the contents of a test asset file.
                const assetPath = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_HBS_1;
                const assetContent = fs.readFileSync(assetPath);

                // Create an assetsFS.getItemReadStream stub that returns a promise for the asset stream.
                const stubFS = sinon.stub(assetsFS, "getItemReadStream");
                const assetStream1 = new stream.Readable();
                assetStream1.push(assetContent);
                assetStream1.push(null);
                const assetStream2 = new stream.Readable();
                assetStream2.push(assetContent);
                assetStream2.push(null);
                const assetStream3 = new stream.Readable();
                assetStream3.push(assetContent);
                assetStream3.push(null);
                stubFS.onFirstCall().resolves(assetStream1);
                stubFS.onSecondCall().resolves(assetStream2);
                stubFS.onThirdCall().resolves(assetStream3);

                // Create an assetsREST.pushItem stub that fails the first and second times with an error that can be
                // retried. The third time it returns a promise for the asset metadata and emits a stream close event.
                const PUSH_ERROR = "Error pushing an item, as expected by a unit test.";
                const stubREST = sinon.stub(assetsREST, "pushItem", function (context, isRaw, isContentResource, replaceContentResource, resourceId, resourceMd5, pathname, stream, length, opts) {
                    const error = new Error(PUSH_ERROR);
                    error.retry = true;
                    error.log = "The log message for this error: ";
                    return Q.reject(error);
                });

                // Create a stub for assetsFS.isContentResource that returns false.
                const stubIsContentResource = sinon.stub(assetsFS, "isContentResource");
                stubIsContentResource.returns(false);

                // Create a stub for assetsFS.getContentLength that returns 0.
                const stubContentLength = sinon.stub(assetsFS, "getContentLength");
                stubContentLength.resolves(0);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubFS);
                self.addTestDouble(stubREST);
                self.addTestDouble(stubIsContentResource);
                self.addTestDouble(stubContentLength);

                // Call the method being tested.
                let error;
                assetsHelper.pushItem(context, AssetsUnitTest.ASSET_HBS_1, {retryMaxAttempts: 3, retryMinTimeout: 0, retryMaxTimeout: 10, retryFactor: 0, retryRandomize: true})
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for pushing the item should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the helper returned the expected error.
                        expect(err.message).to.equal(PUSH_ERROR);

                        // Verify that the FS stub was called three times with the specified path (before the REST stub).
                        expect(stubFS).to.have.been.calledThrice;
                        expect(stubFS.firstCall.args[1]).to.equal(AssetsUnitTest.ASSET_HBS_1);
                        expect(stubFS.secondCall.args[1]).to.equal(AssetsUnitTest.ASSET_HBS_1);
                        expect(stubFS.thirdCall.args[1]).to.equal(AssetsUnitTest.ASSET_HBS_1);
                        expect(stubFS).to.have.been.calledBefore(stubREST);

                        // Verify that the REST stub was called three times with the specified path and content.
                        expect(stubREST).to.have.been.calledThrice;
                        expect(stubREST.firstCall.args[6]).to.equal(AssetsUnitTest.ASSET_HBS_1);
                        expect(stubREST.secondCall.args[6]).to.equal(AssetsUnitTest.ASSET_HBS_1);
                        expect(stubREST.thirdCall.args[6]).to.equal(AssetsUnitTest.ASSET_HBS_1);
                        const streamContent = stubREST.thirdCall.args[7].read(65536);
                        expect(Buffer.compare(streamContent, assetContent)).to.equal(0);

                        expect(stubUpdateHashes).to.not.have.been.called;
                    })
                    .catch(function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Re-initialize the retry push properties.
                        assetsHelper.initializeRetryPush(context);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when getting a content asset fails.", function (done) {
                // Create an assetsFS.getItem stub that returns an error.
                const stubFS = sinon.stub(assetsFS, "getItem");
                const ASSET_ERROR = "There was an error getting the content asset.";
                stubFS.rejects(ASSET_ERROR);

                // Create a stub for assetsFS.getContentLength that returns 0.
                const stubContentLength = sinon.stub(assetsFS, "getContentLength");
                stubContentLength.resolves(0);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubFS);
                self.addTestDouble(stubContentLength);

                // Call the method being tested.
                let error;
                assetsHelper.pushItem(context, AssetsUnitTest.ASSET_CONTENT_JPG_3, {workingDir: AssetsUnitTest.VALID_WORKING_DIRECTORY})
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for pushing the item should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.equal(ASSET_ERROR);

                            // Verify that the FS stub was called once with the specified path (before the REST stub).
                            expect(stubFS).to.have.been.calledOnce;
                            expect(stubFS.firstCall.args[1]).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_3);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when reading a content asset fails.", function (done) {
                // Create an assetsFS.getItemReadStream stub that returns a promise for the asset stream.
                const stubFS = sinon.stub(assetsFS, "getItemReadStream");
                const ASSET_ERROR = "There was an error pushing the content asset.";
                stubFS.rejects(ASSET_ERROR);

                // Create a stub for assetsFS.getContentLength that returns 0.
                const stubContentLength = sinon.stub(assetsFS, "getContentLength");
                stubContentLength.resolves(0);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubFS);
                self.addTestDouble(stubContentLength);

                // Call the method being tested.
                let error;
                assetsHelper.pushItem(context, AssetsUnitTest.ASSET_CONTENT_JPG_3, {workingDir: AssetsUnitTest.VALID_WORKING_DIRECTORY})
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for pushing the item should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.equal(ASSET_ERROR);

                            // Verify that the FS stub was called once with the specified path (before the REST stub).
                            expect(stubFS).to.have.been.calledOnce;
                            expect(stubFS.firstCall.args[1]).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_3);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when pushing a content asset fails.", function (done) {
                // Read the contents of a test asset file.
                const assetPath = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_3;
                const assetContent = fs.readFileSync(assetPath);

                // Create an assetsFS.getItemReadStream stub that returns a promise for the asset stream.
                const stubFS = sinon.stub(assetsFS, "getItemReadStream");
                const assetStream = new stream.Readable();
                assetStream.push(assetContent);
                assetStream.push(null);
                stubFS.resolves(assetStream);

                // Create an assetsREST.pushItem stub that returns a rejected promise for the asset metadata. In this
                // case the stub also emits a stream close event so that subsequent promises will be resolved.
                const ASSET_ERROR = "There was an error pushing the content asset.";
                const stubREST = sinon.stub(assetsREST, "pushItem", function () {
                    assetStream.emit("close");
                    const deferred = Q.defer();
                    deferred.reject(new Error(ASSET_ERROR));
                    return deferred.promise;
                });

                // Create a stub for assetsFS.getContentLength that returns 0.
                const stubContentLength = sinon.stub(assetsFS, "getContentLength");
                stubContentLength.resolves(0);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubFS);
                self.addTestDouble(stubREST);
                self.addTestDouble(stubContentLength);

                // Call the method being tested.
                let error;
                assetsHelper.pushItem(context, AssetsUnitTest.ASSET_CONTENT_JPG_3, {workingDir: AssetsUnitTest.VALID_WORKING_DIRECTORY})
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for pushing the item should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.equal(ASSET_ERROR);

                            // Verify that the FS stub was called once with the specified path (before the REST stub).
                            expect(stubFS).to.have.been.calledOnce;
                            expect(stubFS.firstCall.args[1]).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_3);
                            expect(stubFS).to.have.been.calledBefore(stubREST);

                            // Verify that the REST stub was called once with the specified path and content.
                            expect(stubREST).to.have.been.calledOnce;
                            expect(stubREST.firstCall.args[6]).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_3);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed even when saving the metadata fails.", function (done) {
                // Read the contents of a test asset file.
                const assetPath = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_3;
                const assetContent = fs.readFileSync(assetPath);
                const assetMetadataPath = AssetsUnitTest.VALID_CONTENT_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_3 + assetsFS.getExtension();
                const assetMetadata = UnitTest.getJsonObject(assetMetadataPath);

                // Create an assetsFS.getItemReadStream stub that returns a promise for the asset stream.
                const stubFS = sinon.stub(assetsFS, "getItemReadStream");
                const assetStream = new stream.Readable();
                assetStream.push(assetContent);
                assetStream.push(null);
                stubFS.resolves(assetStream);

                // Create an assetsREST.pushItem stub that returns a promise for the asset metadata. In this case the
                // stub also emits a stream close event so that subsequent promises will be resolved.
                const stubREST = sinon.stub(assetsREST, "pushItem", function () {
                    assetStream.emit("close");
                    const deferred = Q.defer();
                    deferred.resolve(assetMetadata);
                    return deferred.promise;
                });

                // Create a stub for assetsFS.getContentLength that returns 0.
                const stubContentLength = sinon.stub(assetsFS, "getContentLength");
                stubContentLength.resolves(0);

                // Create an assetsFS.saveItem stub that returns an error.
                const stubSave = sinon.stub(assetsFS, "saveItem");
                const ASSET_ERROR = "There was an error saving the asset metadata.";
                stubSave.throws(new Error(ASSET_ERROR));

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubFS);
                self.addTestDouble(stubREST);
                self.addTestDouble(stubContentLength);
                self.addTestDouble(stubSave);

                // Call the method being tested.
                let error;
                assetsHelper.pushItem(context, AssetsUnitTest.ASSET_CONTENT_JPG_3, {workingDir: AssetsUnitTest.VALID_WORKING_DIRECTORY})
                    .then(function (asset) {
                        // Verify that the helper returned the expected value.
                        expect(diff.diffJson(assetMetadata, asset)).to.have.lengthOf(1);

                        // Verify that the FS stub was called once with the specified path (before the REST stub).
                        expect(stubFS).to.have.been.calledOnce;
                        expect(stubFS.firstCall.args[1]).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_3);
                        expect(stubFS).to.have.been.calledBefore(stubREST);

                        // Verify that the REST stub was called once with the specified path and content.
                        expect(stubREST).to.have.been.calledOnce;
                        expect(stubREST.firstCall.args[6]).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_3);
                        const streamContent = stubREST.firstCall.args[7].read(65536);
                        expect(Buffer.compare(streamContent, assetContent)).to.equal(0);

                        // Verify that the save stub was called once.
                        expect(stubSave).to.have.been.calledOnce;

                        expect(stubUpdateHashes).to.have.been.calledOnce;
                        expect(stubUpdateHashes.args[0][2]).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_3);
                        expect(stubUpdateHashes.args[0][3].path).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_3);
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

            it("should succeed when pushing a content asset.", function (done) {
                // Read the contents of a test asset file.
                const assetPath = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_3;
                const assetContent = fs.readFileSync(assetPath);
                const assetMetadataPath = AssetsUnitTest.VALID_CONTENT_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_3 + assetsFS.getExtension();
                const assetMetadata = UnitTest.getJsonObject(assetMetadataPath);

                // Create an assetsFS.getItemReadStream stub that returns a promise for the asset stream.
                const stubFS = sinon.stub(assetsFS, "getItemReadStream");
                const assetStream = new stream.Readable();
                assetStream.push(assetContent);
                assetStream.push(null);
                stubFS.resolves(assetStream);

                // Create an assetsREST.pushItem stub that returns a promise for the asset metadata. In this case the
                // stub also emits a stream close event so that subsequent promises will be resolved.
                const stubREST = sinon.stub(assetsREST, "pushItem", function () {
                    assetStream.emit("close");
                    const deferred = Q.defer();
                    deferred.resolve(assetMetadata);
                    return deferred.promise;
                });

                // Create a stub for assetsFS.getContentLength that returns 0.
                const stubContentLength = sinon.stub(assetsFS, "getContentLength");
                stubContentLength.resolves(0);

                // Return a reasonable MD5 hash value on the second call to the hashes.getResourceMD5ForFile stub.
                stubGetResourceMD5ForFile.onSecondCall().returns("0B44873CD2F72F88ADC72D4320A977DD");

                // Create an assetsFS.saveItem stub that returns asset metadata.
                const stubSave = sinon.stub(assetsFS, "saveItem");
                stubSave.resolves(assetMetadata);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubFS);
                self.addTestDouble(stubREST);
                self.addTestDouble(stubContentLength);
                self.addTestDouble(stubSave);

                // Call the method being tested.
                let error;
                assetsHelper.pushItem(context, AssetsUnitTest.ASSET_CONTENT_JPG_3, {workingDir: AssetsUnitTest.VALID_WORKING_DIRECTORY})
                    .then(function (asset) {
                        // Verify that the helper returned the expected value.
                        expect(diff.diffJson(assetMetadata, asset)).to.have.lengthOf(1);

                        // Verify that the FS stub was called once with the specified path (before the REST stub).
                        expect(stubFS).to.have.been.calledOnce;
                        expect(stubFS.firstCall.args[1]).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_3);
                        expect(stubFS).to.have.been.calledBefore(stubREST);

                        // Verify that the REST stub was called once with the specified path and content.
                        expect(stubREST).to.have.been.calledOnce;
                        expect(stubREST.firstCall.args[6]).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_3);
                        const streamContent = stubREST.firstCall.args[7].read(65536);
                        expect(Buffer.compare(streamContent, assetContent)).to.equal(0);

                        // Verify that the save stub was called once.
                        expect(stubSave).to.have.been.calledOnce;

                        expect(stubUpdateHashes).to.have.been.calledOnce;
                        expect(stubUpdateHashes.args[0][2]).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_3);
                        expect(stubUpdateHashes.args[0][3].path).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_3);
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

    testPushAllAssets () {
        const self = this;
        describe("pushAllAssets", function () {
            it("should fail when getting the local assets fails.", function (done) {
                // Create an assetsHelper._listLocalItemNames stub that returns an error.
                const ASSET_ERROR = "There was an error getting the local assets.";
                const stub = sinon.stub(assetsHelper, "_listLocalItemNames");
                stub.rejects(ASSET_ERROR);

                // Create an assetsHelper.pushItem spy.
                const spy = sinon.spy(assetsHelper, "pushItem");

                // Create a stub for assetsFS.isContentResource that returns false.
                const stubIsContentResource = sinon.stub(assetsFS, "isContentResource");
                stubIsContentResource.returns(false);

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stub);
                self.addTestDouble(spy);
                self.addTestDouble(stubIsContentResource);

                // Call the method being tested.
                let error;
                assetsHelper.pushAllItems(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (/*assets*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the local assets should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once.
                            expect(stub).to.be.calledOnce;

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.equal(ASSET_ERROR);

                            // Verify that the spy was not called.
                            expect(spy).to.not.have.been.called;
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should report errors when pushing assets fails.", function (done) {
                // Create an assetsHelper._listLocalItemNames stub that returns a promise for the modified names.
                const stubList = sinon.stub(assetsHelper, "_listLocalItemNames");
                stubList.resolves([{id: undefined, path: AssetsUnitTest.ASSET_HTML_1}]);

                // Create an assetsHelper.pushItem stub that returns an error.
                const ASSET_ERROR = "There was an error pushing an asset. This error is expected by the test.";
                const stubPush = sinon.stub(assetsHelper, "pushItem");
                stubPush.rejects(ASSET_ERROR);

                // Create a stub for assetsFS.isContentResource that returns false.
                const stubIsContentResource = sinon.stub(assetsFS, "isContentResource");
                stubIsContentResource.returns(false);

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stubList);
                self.addTestDouble(stubPush);
                self.addTestDouble(stubIsContentResource);

                // Call the method being tested.
                let error;
                assetsHelper.pushAllItems(context)
                    .then(function (assets) {
                        // Verify that no assets were returned.
                        expect(assets).to.have.lengthOf(0);

                        // Verify that the FS stub was called once.
                        expect(stubList).to.be.calledOnce;

                        // Verify that the helper stub was called once.
                        expect(stubPush).to.be.calledOnce;
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

            it("should succeed when pushing all local assets.", function (done) {
                // List of local asset names.
                const assetNames = [
                    {id: undefined, path: AssetsUnitTest.ASSET_HTML_1},
                    {id: undefined, path: AssetsUnitTest.ASSET_CSS_1},
                    {id: undefined, path: AssetsUnitTest.ASSET_HBS_1},
                    {id: undefined, path: AssetsUnitTest.ASSET_GIF_1},
                    {id: undefined, path: AssetsUnitTest.ASSET_JAR_1},
                    {id: undefined, path: AssetsUnitTest.ASSET_CONTENT_JPG_1}
                ];

                // Read the contents of the test asset files.
                const htmlAssetPath = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_HTML_1;
                const htmlContent = fs.readFileSync(htmlAssetPath);
                const htmlMetadataPath = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_HTML_1;
                const htmlMetadata = UnitTest.getJsonObject(htmlMetadataPath);
                const htmlStream = new stream.Readable();
                htmlStream.push(htmlContent);
                htmlStream.push(null);
                const cssAssetPath = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CSS_1;
                const cssContent = fs.readFileSync(cssAssetPath);
                const cssMetadataPath = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CSS_1;
                const cssMetadata = UnitTest.getJsonObject(cssMetadataPath);
                const cssStream = new stream.Readable();
                cssStream.push(cssContent);
                cssStream.push(null);
                const hbsAssetPath = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_HBS_1;
                const hbsContent = fs.readFileSync(hbsAssetPath);
                const hbsStream = new stream.Readable();
                hbsStream.push(hbsContent);
                hbsStream.push(null);
                const gifAssetPath = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_GIF_1;
                const gifContent = fs.readFileSync(gifAssetPath);
                const gifMetadataPath = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_GIF_1;
                const gifMetadata = UnitTest.getJsonObject(gifMetadataPath);
                const gifStream = new stream.Readable();
                gifStream.push(gifContent);
                gifStream.push(null);
                const jarAssetPath = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_JAR_1;
                const jarContent = fs.readFileSync(jarAssetPath);
                const jarMetadataPath = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JAR_1;
                const jarMetadata = UnitTest.getJsonObject(jarMetadataPath);
                const jarStream = new stream.Readable();
                jarStream.push(jarContent);
                jarStream.push(null);
                const jpgAssetPath = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_1;
                const jpgContent = fs.readFileSync(jpgAssetPath);
                const jpgMetadataPath = AssetsUnitTest.VALID_CONTENT_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_1 + assetsFS.getExtension();
                const jpgMetadata = UnitTest.getJsonObject(jpgMetadataPath);
                const jpgStream = new stream.Readable();
                jpgStream.push(jpgContent);
                jpgStream.push(null);

                // Create an assetsFS.listNames stub that returns a promise for names.
                const stubList = sinon.stub(assetsFS, "listNames");
                stubList.resolves(assetNames);

                // Create an assetsHelper.pushAllResources stub that returns an empty list.
                const stubResources = sinon.stub(assetsHelper, "pushAllResources");
                stubResources.resolves([]);

                // Create an assetsFS.getItemReadStream stub that returns a promise for the asset content.
                const stubFS = sinon.stub(assetsFS, "getItemReadStream");
                stubFS.withArgs(sinon.match.any, AssetsUnitTest.ASSET_HTML_1).resolves(htmlStream);
                stubFS.withArgs(sinon.match.any, AssetsUnitTest.ASSET_CSS_1).resolves(cssStream);
                stubFS.withArgs(sinon.match.any, AssetsUnitTest.ASSET_HBS_1).resolves(hbsStream);
                stubFS.withArgs(sinon.match.any, AssetsUnitTest.ASSET_GIF_1).resolves(gifStream);
                stubFS.withArgs(sinon.match.any, AssetsUnitTest.ASSET_JAR_1).resolves(jarStream);
                stubFS.withArgs(sinon.match.any, AssetsUnitTest.ASSET_CONTENT_JPG_1).resolves(jpgStream);

                // Stub assetsREST.getItemByPath to reject with no asset metadata available locally.
                const stubGetItemByPath = sinon.stub(assetsREST, "getItemByPath");
                stubGetItemByPath.rejects();

                // Create an assetsREST.pushItem stub that returns a promise for asset metadata based on the value of
                // the "pathname" parameter. In this case the stub also emits a stream close event so that subsequent
                // promises will be resolved. And in order to test error handling, one of the stub calls will reject.
                const ASSET_ERROR = "There was an error pushing an asset. This error is expected by the test.";
                const stubREST = sinon.stub(assetsREST, "pushItem", function (context, isRaw, isContentResource, replaceContentResource, resourceId, resourceMd5, pathname, stream) {
                    stream.emit("close");
                    const d = Q.defer();
                    if (pathname === AssetsUnitTest.ASSET_HTML_1) {
                        d.resolve(htmlMetadata);
                    } else if (pathname === AssetsUnitTest.ASSET_CSS_1) {
                        d.resolve(cssMetadata);
                    } else if (pathname === AssetsUnitTest.ASSET_HBS_1) {
                        d.reject(new Error(ASSET_ERROR));
                    } else if (pathname === AssetsUnitTest.ASSET_GIF_1) {
                        d.resolve(gifMetadata);
                    } else if (pathname === AssetsUnitTest.ASSET_JAR_1) {
                        d.resolve(jarMetadata);
                    } else if (pathname === AssetsUnitTest.ASSET_CONTENT_JPG_1) {
                        d.resolve(jpgMetadata);
                    }
                    return d.promise;
                });

                // Create an assetsFS.saveItem stub that returns asset metadata.
                const stubSave = sinon.stub(assetsFS, "saveItem");
                stubSave.resolves(jpgMetadata);

                // Create spies to listen for "pushed" and "pushed-error" events.
                const emitter = assetsHelper.getEventEmitter(context);
                delete context.eventEmitter;
                const spyPushed = sinon.spy();
                const spyError = sinon.spy();
                emitter.on("pushed", spyPushed);
                emitter.on("pushed-error", spyError);

                // Create a stub for assetsFS.isContentResource that returns false.
                const stubContentLength = sinon.stub(assetsFS, "getContentLength");
                stubContentLength.resolves(0);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubList);
                self.addTestDouble(stubFS);
                self.addTestDouble(stubGetItemByPath);
                self.addTestDouble(stubREST);
                self.addTestDouble(stubContentLength);
                self.addTestDouble(stubSave);
                self.addTestDouble(stubResources);

                // Call the method being tested.
                let error;
                assetsHelper.pushAllItems(context, {disablePushPullResources: false})
                    .then(function (assets) {
                        // Verify that the helper returned the resolved content, but not the rejected content.
                        expect(assets).to.have.lengthOf(5);
                        expect(diff.diffJson(htmlMetadata, assets[0])).to.have.lengthOf(1);
                        expect(diff.diffJson(cssMetadata, assets[1])).to.have.lengthOf(1);
                        expect(diff.diffJson(gifMetadata, assets[2])).to.have.lengthOf(1);
                        expect(diff.diffJson(jarMetadata, assets[3])).to.have.lengthOf(1);
                        expect(diff.diffJson(jpgMetadata, assets[4])).to.have.lengthOf(1);

                        // Verify that the list stub was called once.
                        expect(stubList).to.have.been.calledOnce;

                        // Verify that the FS stub was called five times, once with each specified paths.
                        expect(stubFS).to.have.callCount(6);
                        expect(stubFS.getCall(0).args[1]).to.equal(AssetsUnitTest.ASSET_HTML_1);
                        expect(stubFS.getCall(1).args[1]).to.equal(AssetsUnitTest.ASSET_CSS_1);
                        expect(stubFS.getCall(2).args[1]).to.equal(AssetsUnitTest.ASSET_HBS_1);
                        expect(stubFS.getCall(3).args[1]).to.equal(AssetsUnitTest.ASSET_GIF_1);
                        expect(stubFS.getCall(4).args[1]).to.equal(AssetsUnitTest.ASSET_JAR_1);
                        expect(stubFS.getCall(5).args[1]).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_1);

                        // Verify that the REST stub was called five times, with the expected args, and after the FS stub.
                        expect(stubREST).to.have.callCount(6);
                        expect(stubREST.getCall(0).args[6]).to.equal(AssetsUnitTest.ASSET_HTML_1);
                        expect(stubREST.getCall(1).args[6]).to.equal(AssetsUnitTest.ASSET_CSS_1);
                        expect(stubREST.getCall(2).args[6]).to.equal(AssetsUnitTest.ASSET_HBS_1);
                        expect(stubREST.getCall(3).args[6]).to.equal(AssetsUnitTest.ASSET_GIF_1);
                        expect(stubREST.getCall(4).args[6]).to.equal(AssetsUnitTest.ASSET_JAR_1);
                        expect(stubREST.getCall(5).args[6]).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_1);
                        let requestContent = stubREST.getCall(0).args[7].read(65536);
                        expect(Buffer.compare(htmlContent, requestContent)).to.equal(0);
                        requestContent = stubREST.getCall(1).args[7].read(65536);
                        expect(Buffer.compare(cssContent, requestContent)).to.equal(0);
                        requestContent = stubREST.getCall(2).args[7].read(65536);
                        expect(Buffer.compare(hbsContent, requestContent)).to.equal(0);
                        requestContent = stubREST.getCall(3).args[7].read(65536);
                        expect(Buffer.compare(gifContent, requestContent)).to.equal(0);
                        requestContent = stubREST.getCall(4).args[7].read(65536);
                        expect(Buffer.compare(jarContent, requestContent)).to.equal(0);
                        requestContent = stubREST.getCall(5).args[7].read(65536);
                        expect(Buffer.compare(jpgContent, requestContent)).to.equal(0);
                        expect(stubREST).to.have.been.calledAfter(stubFS);

                        // Verify that the save stub was called once.
                        expect(stubSave).to.have.been.calledOnce;

                        // Verify that the spies were called as expected.
                        expect(spyPushed).to.not.have.been.called;
                        expect(spyError).to.not.have.been.called;

                        expect(stubUpdateHashes).to.have.callCount(5);
                        expect(stubUpdateHashes.args[0][4]).to.contain(AssetsUnitTest.ASSET_HTML_1);
                        expect(stubUpdateHashes.args[0][3].path).to.contain(AssetsUnitTest.ASSET_HTML_1);
                        expect(stubUpdateHashes.args[1][4]).to.contain(AssetsUnitTest.ASSET_CSS_1);
                        expect(stubUpdateHashes.args[1][3].path).to.contain(AssetsUnitTest.ASSET_CSS_1);
                        expect(stubUpdateHashes.args[2][4]).to.contain(AssetsUnitTest.ASSET_GIF_1);
                        expect(stubUpdateHashes.args[2][3].path).to.contain(AssetsUnitTest.ASSET_GIF_1);
                        expect(stubUpdateHashes.args[3][4]).to.contain(AssetsUnitTest.ASSET_JAR_1);
                        expect(stubUpdateHashes.args[3][3].path).to.contain(AssetsUnitTest.ASSET_JAR_1);
                        expect(stubUpdateHashes.args[4][4]).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_1);
                        expect(stubUpdateHashes.args[4][3].path).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_1);
                    })
                    .catch(function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        emitter.removeListener("pushed", spyPushed);
                        emitter.removeListener("pushed-error", spyError);
                        context.eventEmitter = emitter;

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when pushing all local assets, including drafts.", function (done) {
                // List of local asset names.
                const assetNames = [
                    {id: undefined, path: AssetsUnitTest.ASSET_CONTENT_JPG_1_DRAFT},
                    {id: undefined, path: AssetsUnitTest.ASSET_CONTENT_JPG_1},
                    {id: undefined, path: AssetsUnitTest.ASSET_CONTENT_JPG_2_DRAFT},
                    {id: undefined, path: AssetsUnitTest.ASSET_CONTENT_JPG_2}
                ];

                // Read the contents of the test asset files.
                const path1 = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_1;
                const content1 = fs.readFileSync(path1);
                const metadataPath1 = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_1 + "_amd.json";
                const metadata1 = UnitTest.getJsonObject(metadataPath1);
                const stream1 = new stream.Readable();
                stream1.push(content1);
                stream1.push(null);
                const draftPath1 = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_1_DRAFT;
                const draftContent1 = fs.readFileSync(draftPath1);
                const draftMetadataPath1 = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_1_DRAFT + "_amd.json";
                const draftMetadata1 = UnitTest.getJsonObject(draftMetadataPath1);
                const draftStream1 = new stream.Readable();
                draftStream1.push(draftContent1);
                draftStream1.push(null);

                const path2 = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_2;
                const content2 = fs.readFileSync(path2);
                const metadataPath2 = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_2 + "_amd.json";
                const metadata2 = UnitTest.getJsonObject(metadataPath2);
                const stream2 = new stream.Readable();
                stream2.push(content2);
                stream2.push(null);
                const draftPath2 = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_2_DRAFT;
                const draftContent2 = fs.readFileSync(draftPath2);
                const draftMetadataPath2 = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_2_DRAFT + "_amd.json";
                const draftMetadata2 = UnitTest.getJsonObject(draftMetadataPath2);
                const draftStream2 = new stream.Readable();
                draftStream2.push(draftContent2);
                draftStream2.push(null);

                // Create an assetsFS.listNames stub that returns a promise for names.
                const stubList = sinon.stub(assetsFS, "listNames");
                stubList.resolves(assetNames);

                // Create an assetsFS.getItemReadStream stub that returns a promise for the asset content.
                const stubFS = sinon.stub(assetsFS, "getItemReadStream");
                stubFS.withArgs(sinon.match.any, AssetsUnitTest.ASSET_CONTENT_JPG_1).resolves(stream1);
                stubFS.withArgs(sinon.match.any, AssetsUnitTest.ASSET_CONTENT_JPG_1_DRAFT).resolves(draftStream1);
                stubFS.withArgs(sinon.match.any, AssetsUnitTest.ASSET_CONTENT_JPG_2).resolves(stream2);
                stubFS.withArgs(sinon.match.any, AssetsUnitTest.ASSET_CONTENT_JPG_2_DRAFT).resolves(draftStream2);

                // Stub assetsREST.getItemByPath to reject with no asset metadata available locally.
                const stubGetItemByPath = sinon.stub(assetsREST, "getItemByPath");
                stubGetItemByPath.rejects();

                // Create an assetsREST.pushItem stub that returns a promise for asset metadata based on the value of
                // the "pathname" parameter. In this case the stub also emits a stream close event so that subsequent
                // promises will be resolved.
                const stubREST = sinon.stub(assetsREST, "pushItem", function (context, isRaw, isContentResource, replaceContentResource, resourceId, resourceMd5, pathname, stream, length, opts) {
                    stream.emit("close");
                    const d = Q.defer();
                    if (pathname === AssetsUnitTest.ASSET_CONTENT_JPG_1) {
                        d.resolve(metadata1);
                    } else if (pathname === AssetsUnitTest.ASSET_CONTENT_JPG_1_DRAFT) {
                        d.resolve(draftMetadata1);
                    } else if (pathname === AssetsUnitTest.ASSET_CONTENT_JPG_2) {
                        d.resolve(metadata2);
                    } else if (pathname === AssetsUnitTest.ASSET_CONTENT_JPG_2_DRAFT) {
                        d.resolve(draftMetadata2);
                    }
                    return d.promise;
                });

                // Create an assetsFS.saveItem stub that returns asset metadata.
                const stubSave = sinon.stub(assetsFS, "saveItem", function (context, asset, opts) {
                    return Q(asset);
                });

                // Create spies to listen for "pushed" and "pushed-error" events.
                const emitter = assetsHelper.getEventEmitter(context);
                const spyPushed = sinon.spy();
                const spyError = sinon.spy();
                emitter.on("pushed", spyPushed);
                emitter.on("pushed-error", spyError);

                // Create a stub for assetsFS.getContentLength that returns 0.
                const stubContentLength = sinon.stub(assetsFS, "getContentLength");
                stubContentLength.resolves(0);

                // Create a stub for assetsHelper.isRetryPushEnabled that returns false.
                const stubRetryPush = sinon.stub(assetsHelper, "isRetryPushEnabled");
                stubRetryPush.returns(false);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubList);
                self.addTestDouble(stubFS);
                self.addTestDouble(stubGetItemByPath);
                self.addTestDouble(stubREST);
                self.addTestDouble(stubSave);
                self.addTestDouble(stubContentLength);
                self.addTestDouble(stubRetryPush);

                // Call the method being tested.
                let error;
                assetsHelper.pushAllItems(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (assets) {
                        // Verify that the helper returned the expected content.
                        expect(assets).to.have.lengthOf(4);
                        expect(diff.diffJson(metadata1, assets[0])).to.have.lengthOf(1);
                        expect(diff.diffJson(metadata2, assets[1])).to.have.lengthOf(1);
                        expect(diff.diffJson(draftMetadata1, assets[2])).to.have.lengthOf(1);
                        expect(diff.diffJson(draftMetadata2, assets[3])).to.have.lengthOf(1);

                        // Verify that the list stub was called once.
                        expect(stubList).to.have.been.calledOnce;

                        // Verify that the FS stub was called four times, once with each specified path.
                        expect(stubFS).to.have.callCount(4);
                        expect(stubFS.getCall(0).args[1]).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_1);
                        expect(stubFS.getCall(1).args[1]).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_2);
                        expect(stubFS.getCall(2).args[1]).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_1_DRAFT);
                        expect(stubFS.getCall(3).args[1]).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_2_DRAFT);

                        // Verify that the REST stub was called four times, with the expected args, and after the FS stub.
                        expect(stubREST).to.have.callCount(4);
                        expect(stubREST.getCall(0).args[6]).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_1);
                        expect(stubREST.getCall(1).args[6]).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_2);
                        expect(stubREST.getCall(2).args[6]).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_1_DRAFT);
                        expect(stubREST.getCall(3).args[6]).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_2_DRAFT);
                        let requestContent = stubREST.getCall(0).args[7].read(65536);
                        expect(Buffer.compare(content1, requestContent)).to.equal(0);
                        requestContent = stubREST.getCall(1).args[7].read(65536);
                        expect(Buffer.compare(content2, requestContent)).to.equal(0);
                        requestContent = stubREST.getCall(2).args[7].read(65536);
                        expect(Buffer.compare(draftContent1, requestContent)).to.equal(0);
                        requestContent = stubREST.getCall(3).args[7].read(65536);
                        expect(Buffer.compare(draftContent2, requestContent)).to.equal(0);
                        expect(stubREST).to.have.been.calledAfter(stubFS);

                        // Verify that the save stub was called four times.
                        expect(stubSave).to.have.callCount(4);

                        // Verify that the spies were called as expected.
                        expect(spyPushed).to.have.callCount(4);
                        expect(spyPushed.getCall(0).args[0].path).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_1);
                        expect(spyPushed.getCall(1).args[0].path).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_2);
                        expect(spyPushed.getCall(2).args[0].path).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_1_DRAFT);
                        expect(spyPushed.getCall(3).args[0].path).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_2_DRAFT);
                        expect(spyError).to.not.have.been.called;

                        expect(stubUpdateHashes).to.have.callCount(4);
                        expect(stubUpdateHashes.args[0][4]).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_1);
                        expect(stubUpdateHashes.args[0][3].path).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_1);
                        expect(stubUpdateHashes.args[1][4]).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_2);
                        expect(stubUpdateHashes.args[1][3].path).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_2);
                        expect(stubUpdateHashes.args[2][4]).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_1_DRAFT);
                        expect(stubUpdateHashes.args[2][3].path).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_1);
                        expect(stubUpdateHashes.args[3][4]).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_2_DRAFT);
                        expect(stubUpdateHashes.args[3][3].path).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_2);
                    })
                    .catch(function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        emitter.removeListener("pushed", spyPushed);
                        emitter.removeListener("pushed-error", spyError);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when pushing only ready assets", function (done) {
                // List of local asset names.
                const assetNames = [
                    {id: undefined, path: AssetsUnitTest.ASSET_CONTENT_JPG_1_DRAFT, status: "draft"},
                    {id: undefined, path: AssetsUnitTest.ASSET_CONTENT_JPG_1, status: "ready"},
                    {id: undefined, path: AssetsUnitTest.ASSET_CONTENT_JPG_2_DRAFT, status: "draft"},
                    {id: undefined, path: AssetsUnitTest.ASSET_CONTENT_JPG_2, status: "ready"}
                ];

                // Read the contents of the test asset files.
                const path1 = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_1;
                const content1 = fs.readFileSync(path1);
                const metadataPath1 = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_1 + "_amd.json";
                const metadata1 = UnitTest.getJsonObject(metadataPath1);
                const stream1 = new stream.Readable();
                stream1.push(content1);
                stream1.push(null);
                const draftPath1 = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_1_DRAFT;
                const draftContent1 = fs.readFileSync(draftPath1);
                const draftMetadataPath1 = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_1_DRAFT + "_amd.json";
                const draftMetadata1 = UnitTest.getJsonObject(draftMetadataPath1);
                const draftStream1 = new stream.Readable();
                draftStream1.push(draftContent1);
                draftStream1.push(null);

                const path2 = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_2;
                const content2 = fs.readFileSync(path2);
                const metadataPath2 = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_2 + "_amd.json";
                const metadata2 = UnitTest.getJsonObject(metadataPath2);
                const stream2 = new stream.Readable();
                stream2.push(content2);
                stream2.push(null);
                const draftPath2 = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_2_DRAFT;
                const draftContent2 = fs.readFileSync(draftPath2);
                const draftMetadataPath2 = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_2_DRAFT + "_amd.json";
                const draftMetadata2 = UnitTest.getJsonObject(draftMetadataPath2);
                const draftStream2 = new stream.Readable();
                draftStream2.push(draftContent2);
                draftStream2.push(null);

                // Create an assetsFS.listNames stub that returns a promise for names.
                const stubList = sinon.stub(assetsFS, "listNames");
                stubList.resolves(assetNames);

                // Create an assetsFS.getItemReadStream stub that returns a promise for the asset content.
                const stubFS = sinon.stub(assetsFS, "getItemReadStream");
                stubFS.withArgs(sinon.match.any, AssetsUnitTest.ASSET_CONTENT_JPG_1).resolves(stream1);
                stubFS.withArgs(sinon.match.any, AssetsUnitTest.ASSET_CONTENT_JPG_1_DRAFT).resolves(draftStream1);
                stubFS.withArgs(sinon.match.any, AssetsUnitTest.ASSET_CONTENT_JPG_2).resolves(stream2);
                stubFS.withArgs(sinon.match.any, AssetsUnitTest.ASSET_CONTENT_JPG_2_DRAFT).resolves(draftStream2);

                // Stub assetsREST.getItemByPath to reject with no asset metadata available locally.
                const stubGetItemByPath = sinon.stub(assetsREST, "getItemByPath");
                stubGetItemByPath.rejects();

                // Create an assetsREST.pushItem stub that returns a promise for asset metadata based on the value of
                // the "pathname" parameter. In this case the stub also emits a stream close event so that subsequent
                // promises will be resolved.
                const stubREST = sinon.stub(assetsREST, "pushItem", function (context, isRaw, isContentResource, replaceContentResource, resourceId, resourceMd5, pathname, stream, length, opts) {
                    stream.emit("close");
                    const d = Q.defer();
                    if (pathname === AssetsUnitTest.ASSET_CONTENT_JPG_1) {
                        d.resolve(metadata1);
                    } else if (pathname === AssetsUnitTest.ASSET_CONTENT_JPG_1_DRAFT) {
                        d.resolve(draftMetadata1);
                    } else if (pathname === AssetsUnitTest.ASSET_CONTENT_JPG_2) {
                        d.resolve(metadata2);
                    } else if (pathname === AssetsUnitTest.ASSET_CONTENT_JPG_2_DRAFT) {
                        d.resolve(draftMetadata2);
                    }
                    return d.promise;
                });

                // Create an assetsFS.saveItem stub that returns asset metadata.
                const stubSave = sinon.stub(assetsFS, "saveItem", function (context, asset, opts) {
                    return Q(asset);
                });

                // Create spies to listen for "pushed" and "pushed-error" events.
                const emitter = assetsHelper.getEventEmitter(context);
                const spyPushed = sinon.spy();
                const spyError = sinon.spy();
                emitter.on("pushed", spyPushed);
                emitter.on("pushed-error", spyError);

                // Create a stub for assetsFS.getContentLength that returns 0.
                const stubContentLength = sinon.stub(assetsFS, "getContentLength");
                stubContentLength.resolves(0);

                // Create a stub for assetsHelper.isRetryPushEnabled that returns false.
                const stubRetryPush = sinon.stub(assetsHelper, "isRetryPushEnabled");
                stubRetryPush.returns(false);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubList);
                self.addTestDouble(stubFS);
                self.addTestDouble(stubGetItemByPath);
                self.addTestDouble(stubREST);
                self.addTestDouble(stubSave);
                self.addTestDouble(stubContentLength);
                self.addTestDouble(stubRetryPush);

                // Call the method being tested.
                let error;
                assetsHelper.pushAllItems(context, {filterReady: true})
                    .then(function (assets) {
                        // Verify that the helper returned the expected content.
                        expect(assets).to.have.lengthOf(2);
                        expect(diff.diffJson(metadata1, assets[0])).to.have.lengthOf(1);
                        expect(diff.diffJson(metadata2, assets[1])).to.have.lengthOf(1);

                        // Verify that the list stub was called once.
                        expect(stubList).to.have.been.calledOnce;

                        // Verify that the FS stub was called twice, once with each ready item path.
                        expect(stubFS).to.have.callCount(2);
                        expect(stubFS.getCall(0).args[1]).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_1);
                        expect(stubFS.getCall(1).args[1]).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_2);

                        // Verify that the REST stub was called twice, with the expected args, and after the FS stub.
                        expect(stubREST).to.have.callCount(2);
                        expect(stubREST.getCall(0).args[6]).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_1);
                        expect(stubREST.getCall(1).args[6]).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_2);
                        let requestContent = stubREST.getCall(0).args[7].read(65536);
                        expect(Buffer.compare(content1, requestContent)).to.equal(0);
                        requestContent = stubREST.getCall(1).args[7].read(65536);
                        expect(Buffer.compare(content2, requestContent)).to.equal(0);
                        expect(stubREST).to.have.been.calledAfter(stubFS);

                        // Verify that the save stub was called twice.
                        expect(stubSave).to.have.callCount(2);

                        // Verify that the spies were called as expected.
                        expect(spyPushed).to.have.callCount(2);
                        expect(spyPushed.getCall(0).args[0].path).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_1);
                        expect(spyPushed.getCall(1).args[0].path).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_2);
                        expect(spyError).to.not.have.been.called;

                        // Verify that the hashes were called as expected.
                        expect(stubUpdateHashes).to.have.callCount(2);
                        expect(stubUpdateHashes.args[0][4]).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_1);
                        expect(stubUpdateHashes.args[0][3].path).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_1);
                        expect(stubUpdateHashes.args[1][4]).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_2);
                        expect(stubUpdateHashes.args[1][3].path).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_2);
                    })
                    .catch(function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        emitter.removeListener("pushed", spyPushed);
                        emitter.removeListener("pushed-error", spyError);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when pushing only draft assets.", function (done) {
                // List of local asset names.
                const assetNames = [
                    {id: undefined, path: AssetsUnitTest.ASSET_CONTENT_JPG_1_DRAFT, status: "draft"},
                    {id: undefined, path: AssetsUnitTest.ASSET_CONTENT_JPG_1, status: "ready"},
                    {id: undefined, path: AssetsUnitTest.ASSET_CONTENT_JPG_2_DRAFT, status: "draft"},
                    {id: undefined, path: AssetsUnitTest.ASSET_CONTENT_JPG_2, status: "ready"}
                ];

                // Read the contents of the test asset files.
                const path1 = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_1;
                const content1 = fs.readFileSync(path1);
                const metadataPath1 = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_1 + "_amd.json";
                const metadata1 = UnitTest.getJsonObject(metadataPath1);
                const stream1 = new stream.Readable();
                stream1.push(content1);
                stream1.push(null);
                const draftPath1 = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_1_DRAFT;
                const draftContent1 = fs.readFileSync(draftPath1);
                const draftMetadataPath1 = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_1_DRAFT + "_amd.json";
                const draftMetadata1 = UnitTest.getJsonObject(draftMetadataPath1);
                const draftStream1 = new stream.Readable();
                draftStream1.push(draftContent1);
                draftStream1.push(null);

                const path2 = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_2;
                const content2 = fs.readFileSync(path2);
                const metadataPath2 = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_2 + "_amd.json";
                const metadata2 = UnitTest.getJsonObject(metadataPath2);
                const stream2 = new stream.Readable();
                stream2.push(content2);
                stream2.push(null);
                const draftPath2 = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_2_DRAFT;
                const draftContent2 = fs.readFileSync(draftPath2);
                const draftMetadataPath2 = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_2_DRAFT + "_amd.json";
                const draftMetadata2 = UnitTest.getJsonObject(draftMetadataPath2);
                const draftStream2 = new stream.Readable();
                draftStream2.push(draftContent2);
                draftStream2.push(null);

                // Create an assetsFS.listNames stub that returns a promise for names.
                const stubList = sinon.stub(assetsFS, "listNames");
                stubList.resolves(assetNames);

                // Create an assetsFS.getItemReadStream stub that returns a promise for the asset content.
                const stubFS = sinon.stub(assetsFS, "getItemReadStream");
                stubFS.withArgs(sinon.match.any, AssetsUnitTest.ASSET_CONTENT_JPG_1).resolves(stream1);
                stubFS.withArgs(sinon.match.any, AssetsUnitTest.ASSET_CONTENT_JPG_1_DRAFT).resolves(draftStream1);
                stubFS.withArgs(sinon.match.any, AssetsUnitTest.ASSET_CONTENT_JPG_2).resolves(stream2);
                stubFS.withArgs(sinon.match.any, AssetsUnitTest.ASSET_CONTENT_JPG_2_DRAFT).resolves(draftStream2);

                // Stub assetsREST.getItemByPath to reject with no asset metadata available locally.
                const stubGetItemByPath = sinon.stub(assetsREST, "getItemByPath");
                stubGetItemByPath.rejects();

                // Create an assetsREST.pushItem stub that returns a promise for asset metadata based on the value of
                // the "pathname" parameter. In this case the stub also emits a stream close event so that subsequent
                // promises will be resolved.
                const stubREST = sinon.stub(assetsREST, "pushItem", function (context, isRaw, isContentResource, replaceContentResource, resourceId, resourceMd5, pathname, stream, length, opts) {
                    stream.emit("close");
                    const d = Q.defer();
                    if (pathname === AssetsUnitTest.ASSET_CONTENT_JPG_1) {
                        d.resolve(metadata1);
                    } else if (pathname === AssetsUnitTest.ASSET_CONTENT_JPG_1_DRAFT) {
                        d.resolve(draftMetadata1);
                    } else if (pathname === AssetsUnitTest.ASSET_CONTENT_JPG_2) {
                        d.resolve(metadata2);
                    } else if (pathname === AssetsUnitTest.ASSET_CONTENT_JPG_2_DRAFT) {
                        d.resolve(draftMetadata2);
                    }
                    return d.promise;
                });

                // Create an assetsFS.saveItem stub that returns asset metadata.
                const stubSave = sinon.stub(assetsFS, "saveItem", function (context, asset, opts) {
                    return Q(asset);
                });

                // Create spies to listen for "pushed" and "pushed-error" events.
                const emitter = assetsHelper.getEventEmitter(context);
                const spyPushed = sinon.spy();
                const spyError = sinon.spy();
                emitter.on("pushed", spyPushed);
                emitter.on("pushed-error", spyError);

                // Create a stub for assetsFS.getContentLength that returns 0.
                const stubContentLength = sinon.stub(assetsFS, "getContentLength");
                stubContentLength.resolves(0);

                // Create a stub for assetsHelper.isRetryPushEnabled that returns false.
                const stubRetryPush = sinon.stub(assetsHelper, "isRetryPushEnabled");
                stubRetryPush.returns(false);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubList);
                self.addTestDouble(stubFS);
                self.addTestDouble(stubGetItemByPath);
                self.addTestDouble(stubREST);
                self.addTestDouble(stubSave);
                self.addTestDouble(stubContentLength);
                self.addTestDouble(stubRetryPush);

                // Call the method being tested.
                let error;
                assetsHelper.pushAllItems(context, {filterDraft: true})
                    .then(function (assets) {
                        // Verify that the helper returned the expected content.
                        expect(assets).to.have.lengthOf(2);
                        expect(diff.diffJson(draftMetadata1, assets[0])).to.have.lengthOf(1);
                        expect(diff.diffJson(draftMetadata2, assets[1])).to.have.lengthOf(1);

                        // Verify that the list stub was called once.
                        expect(stubList).to.have.been.calledOnce;

                        // Verify that the FS stub was called twice, once with each specified draft path.
                        expect(stubFS).to.have.callCount(2);
                        expect(stubFS.getCall(0).args[1]).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_1_DRAFT);
                        expect(stubFS.getCall(1).args[1]).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_2_DRAFT);

                        // Verify that the REST stub was called twice, with the expected args, and after the FS stub.
                        expect(stubREST).to.have.callCount(2);
                        expect(stubREST.getCall(0).args[6]).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_1_DRAFT);
                        expect(stubREST.getCall(1).args[6]).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_2_DRAFT);
                        let requestContent = stubREST.getCall(0).args[7].read(65536);
                        expect(Buffer.compare(draftContent1, requestContent)).to.equal(0);
                        requestContent = stubREST.getCall(1).args[7].read(65536);
                        expect(Buffer.compare(draftContent2, requestContent)).to.equal(0);
                        expect(stubREST).to.have.been.calledAfter(stubFS);

                        // Verify that the save stub was called twice.
                        expect(stubSave).to.have.callCount(2);

                        // Verify that the spies were called as expected.
                        expect(spyPushed).to.have.callCount(2);
                        expect(spyPushed.getCall(0).args[0].path).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_1_DRAFT);
                        expect(spyPushed.getCall(1).args[0].path).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_2_DRAFT);
                        expect(spyError).to.not.have.been.called;

                        // Verify that the hashes were called as expected.
                        expect(stubUpdateHashes).to.have.callCount(2);
                        expect(stubUpdateHashes.args[0][4]).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_1_DRAFT);
                        expect(stubUpdateHashes.args[0][3].path).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_1);
                        expect(stubUpdateHashes.args[1][4]).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_2_DRAFT);
                        expect(stubUpdateHashes.args[1][3].path).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_2);
                    })
                    .catch(function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        emitter.removeListener("pushed", spyPushed);
                        emitter.removeListener("pushed-error", spyError);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testPushModifiedAssets () {
        const self = this;
        describe("pushModifiedAssets", function () {
            it("should fail when getting the local assets fails.", function (done) {
                // Create an assetsHelper._listModifiedLocalItemNames stub that returns an error.
                const ASSET_ERROR = "There was an error getting the local modified assets.";
                const stub = sinon.stub(assetsHelper, "_listModifiedLocalItemNames");
                stub.rejects(ASSET_ERROR);

                // Create an assetsHelper.pushItem spy.
                const spy = sinon.spy(assetsHelper, "pushItem");

                // Create an assetsFS.isContentResource stub that returns false.
                const stubIsContentResource = sinon.stub(assetsFS, "isContentResource");
                stubIsContentResource.returns(false);

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stub);
                self.addTestDouble(spy);
                self.addTestDouble(stubIsContentResource);

                // Call the method being tested.
                let error;
                assetsHelper.pushModifiedItems(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (/*assets*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the local modified assets should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once.
                            expect(stub).to.be.calledOnce;

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.equal(ASSET_ERROR);

                            // Verify that the spy was not called.
                            expect(spy).to.not.have.been.called;
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should report errors when pushing a modified asset fails.", function (done) {
                // Create an assetsHelper._listModifiedLocalItemNames stub that returns a promise for the modified names.
                const stubList = sinon.stub(assetsHelper, "_listModifiedLocalItemNames");
                stubList.resolves([{id: undefined, path: AssetsUnitTest.ASSET_HTML_1}]);

                // Create an assetsHelper.pushItem stub that returns an error.
                const ASSET_ERROR = "There was an error pushing an asset. This error is expected by the test.";
                const stubPush = sinon.stub(assetsHelper, "pushItem");
                stubPush.rejects(ASSET_ERROR);

                const stubPushModifiedResources = sinon.stub(assetsHelper, "pushModifiedResources");
                stubPushModifiedResources.resolves([]);

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stubList);
                self.addTestDouble(stubPush);
                self.addTestDouble(stubPushModifiedResources);

                // Call the method being tested.
                let error;
                assetsHelper.pushModifiedItems(context)
                    .then(function (assets) {
                        // Verify that no assets were returned.
                        expect(assets).to.have.lengthOf(0);

                        // Verify that the FS stub was called once.
                        expect(stubList).to.be.calledOnce;

                        // Verify that the helper stub was called once.
                        expect(stubPush).to.be.calledOnce;
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

            it("should succeed when pushing modified local assets.", function (done) {
                // List of modified local asset names.
                const modifiedAssetNames = [
                    {id: undefined, path: AssetsUnitTest.ASSET_HTML_1},
                    {id: undefined, path: AssetsUnitTest.ASSET_CSS_1},
                    {id: undefined, path: AssetsUnitTest.ASSET_HBS_1}
                ];

                // Read the contents of the test asset files.
                const htmlAssetPath = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_HTML_1;
                const htmlContent = fs.readFileSync(htmlAssetPath);
                const htmlMetadataPath = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_HTML_1;
                const htmlMetadata = UnitTest.getJsonObject(htmlMetadataPath);
                const htmlStream = new stream.Readable();
                htmlStream.push(htmlContent);
                htmlStream.push(null);
                const cssAssetPath = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CSS_1;
                const cssContent = fs.readFileSync(cssAssetPath);
                const cssMetadataPath = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CSS_1;
                const cssMetadata = UnitTest.getJsonObject(cssMetadataPath);
                const cssStream = new stream.Readable();
                cssStream.push(cssContent);
                cssStream.push(null);
                const hbsAssetPath = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_HBS_1;
                const hbsContent = fs.readFileSync(hbsAssetPath);
                const hbsStream = new stream.Readable();
                hbsStream.push(hbsContent);
                hbsStream.push(null);

                // Create an assetsHelper.pushModifiedResources stub that returns an empty list.
                const stubResources = sinon.stub(assetsHelper, "pushModifiedResources");
                stubResources.resolves([]);

                // Create an assetsFS.listNames stub that returns a promise for the modified names.
                const stubList = sinon.stub(assetsFS, "listNames");
                stubList.resolves(modifiedAssetNames);

                // Create an assetsFS.getFileStats stub that returns a promise for the local asset file stats.
                const stubStats = sinon.stub(assetsFS, "getFileStats");
                stubStats.withArgs(sinon.match.any, AssetsUnitTest.ASSET_HTML_1).resolves({ctime: "2020-01-01T00:00Z"}); // Modified
                stubStats.withArgs(sinon.match.any, AssetsUnitTest.ASSET_CSS_1).resolves({ctime: "2020-01-01T00:00Z"}); // Modified
                stubStats.withArgs(sinon.match.any, AssetsUnitTest.ASSET_HBS_1).resolves({ctime: "2020-01-01T00:00Z"}); // Modified

                // Create an assetsFS.getItemReadStream stub that returns a promise for the asset content.
                const stubGet = sinon.stub(assetsFS, "getItemReadStream");
                stubGet.withArgs(sinon.match.any, AssetsUnitTest.ASSET_HTML_1).resolves(htmlStream);
                stubGet.withArgs(sinon.match.any, AssetsUnitTest.ASSET_CSS_1).resolves(cssStream);
                stubGet.withArgs(sinon.match.any, AssetsUnitTest.ASSET_HBS_1).resolves(hbsStream);

                // Create an assetsREST.pushItem stub that returns a promise for asset metadata based on the value of
                // the "pathname" parameter. In this case the stub also emits a stream close event so that subsequent
                // promises will be resolved. And in order to test error handling, one of the stub calls will reject.
                const ASSET_ERROR = "There was an error pushing an asset. This error is expected by the test.";
                const stubPush = sinon.stub(assetsREST, "pushItem", function (context, isRaw, isContentResource, replaceContentResource, resourceId, resourceMd5, pathname, stream) {
                    stream.emit("close");
                    const d = Q.defer();
                    if (pathname === AssetsUnitTest.ASSET_HTML_1) {
                        d.resolve(htmlMetadata);
                    } else if (pathname === AssetsUnitTest.ASSET_CSS_1) {
                        d.resolve(cssMetadata);
                    } else if (pathname === AssetsUnitTest.ASSET_HBS_1) {
                        d.reject(new Error(ASSET_ERROR));
                    }
                    return d.promise;
                });

                // Create spies to listen for "pushed" and "pushed-error" events.
                const emitter = assetsHelper.getEventEmitter(context);
                const spySuccess = sinon.spy();
                const spyError = sinon.spy();
                emitter.on("pushed", spySuccess);
                emitter.on("pushed-error", spyError);

                // Create a stub for assetsFS.isContentResource that returns false.
                const stubIsContentResource = sinon.stub(assetsFS, "isContentResource");
                stubIsContentResource.returns(false);

                const stubGetItemByPath = sinon.stub(assetsREST, "getItemByPath");
                stubGetItemByPath.rejects();

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubList);
                self.addTestDouble(stubStats);
                self.addTestDouble(stubGet);
                self.addTestDouble(stubPush);
                self.addTestDouble(stubIsContentResource);
                self.addTestDouble(stubResources);
                self.addTestDouble(stubGetItemByPath);

                // Call the method being tested.
                let error;
                assetsHelper.pushModifiedItems(context, {workingDir: AssetsUnitTest.VALID_WORKING_DIRECTORY, disablePushPullResources: false})
                    .then(function (assets) {
                        // Verify that the helper returned the resolved content, but not the rejected content.
                        expect(assets).to.have.lengthOf(2);

                        // Verify that the list stub was called once.
                        expect(stubList).to.have.been.calledOnce;

                        // Verify that the stats stub was called three times.
                        expect(stubStats).to.have.been.calledThrice;

                        // Verify that the get stub was called three times, once with each specified path.
                        expect(stubGet).to.have.been.calledThrice;
                        expect(stubGet.firstCall.args[1]).to.equal(AssetsUnitTest.ASSET_HTML_1);
                        expect(stubGet.secondCall.args[1]).to.equal(AssetsUnitTest.ASSET_CSS_1);
                        expect(stubGet.thirdCall.args[1]).to.equal(AssetsUnitTest.ASSET_HBS_1);

                        // Verify that the push stub was called three times, once with each specified path and stream.
                        expect(stubPush).to.have.been.calledThrice;
                        expect(stubPush.firstCall.args[6]).to.equal(AssetsUnitTest.ASSET_HTML_1);
                        expect(stubPush.secondCall.args[6]).to.equal(AssetsUnitTest.ASSET_CSS_1);
                        expect(stubPush.thirdCall.args[6]).to.equal(AssetsUnitTest.ASSET_HBS_1);
                        let requestContent = stubPush.firstCall.args[7].read(65536);
                        expect(Buffer.compare(htmlContent, requestContent)).to.equal(0);
                        requestContent = stubPush.secondCall.args[7].read(65536);
                        expect(Buffer.compare(cssContent, requestContent)).to.equal(0);
                        requestContent = stubPush.thirdCall.args[7].read(65536);
                        expect(Buffer.compare(hbsContent, requestContent)).to.equal(0);

                        // Verify that the get and push stubs were called in the order expected.
                        expect(stubPush).to.be.calledAfter(stubGet);

                        // Verify that the spies were called as expected.
                        expect(spySuccess).to.have.been.calledTwice;
                        expect(spySuccess.firstCall.args[0].path).to.equal(AssetsUnitTest.ASSET_HTML_1);
                        expect(spySuccess.secondCall.args[0].path).to.equal(AssetsUnitTest.ASSET_CSS_1);
                        expect(spyError).to.have.been.calledOnce;
                        expect(spyError.firstCall.args[0].message).to.equal(ASSET_ERROR);
                        expect(spyError.firstCall.args[1]).to.equal(AssetsUnitTest.ASSET_HBS_1);

                        expect(stubSetLastPull).to.not.have.been.called;

                        expect(stubUpdateHashes).to.have.been.calledTwice;
                        expect(stubUpdateHashes.firstCall.args[4]).to.contain(AssetsUnitTest.ASSET_HTML_1);
                        expect(stubUpdateHashes.firstCall.args[3].path).to.contain(AssetsUnitTest.ASSET_HTML_1);
                        expect(stubUpdateHashes.secondCall.args[4]).to.contain(AssetsUnitTest.ASSET_CSS_1);
                        expect(stubUpdateHashes.secondCall.args[3].path).to.contain(AssetsUnitTest.ASSET_CSS_1);
                    })
                    .catch(function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        emitter.removeListener("pushed", spySuccess);
                        emitter.removeListener("pushed-error", spyError);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testPushAllResources () {
        const self = this;
        describe("pushAllResources", function () {
            it("should short-circuit when pushing only web assets.", function (done) {
                // Create an assetsFS.listResourceNames spy to verify that it is not called.
                const spy = sinon.spy(assetsFS, "listResourceNames");

                // The spy should be restored when the test is complete.
                self.addTestDouble(spy);

                // Call the method being tested.
                let error;
                assetsHelper.pushAllResources(context, {assetTypes: assetsHelper.ASSET_TYPES_WEB_ASSETS})
                    .then(function () {
                        // Verify that the spy was not called.
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

            it("should short-circuit when pushing with no virtual folder.", function (done) {
                // Create an assetsFS.listResourceNames spy to verify that it is not called.
                const spy = sinon.spy(assetsFS, "listResourceNames");

                // The spy should be restored when the test is complete.
                self.addTestDouble(spy);

                // Call the method being tested.
                let error;
                assetsHelper.pushAllResources(context, {noVirtualFolder: true})
                    .then(function () {
                        // Verify that the spy was not called.
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

            it("should fail when there is an error getting local resources.", function (done) {
                // Create an assetsFS.listResourceNames stub that returns an error.
                const RESOURCES_ERROR = "There was an error getting the local resources, as expected by unit test.";
                const stub = sinon.stub(assetsFS, "listResourceNames");
                stub.rejects(RESOURCES_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsHelper.pushAllResources(context)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the local resources should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once.
                        expect(stub).to.be.calledOnce;

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.equal(RESOURCES_ERROR);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when there is one local resource.", function (done) {
                // Create a stub for assetsFS.getResourceContentLength that returns false.
                const stubContentLength = sinon.stub(assetsFS, "getResourceContentLength");
                stubContentLength.resolves(0);

                // Read the contents of a test resource file.
                const resourcePath = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_HTML_1;
                const resourceContent = fs.readFileSync(resourcePath);
                const resourceMetadataPath = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_HTML_1;
                const resourceMetadata = UnitTest.getJsonObject(resourceMetadataPath);
                const resourceStream = new stream.Readable();
                const STREAM_TAG = "unique.id";
                resourceStream.tag = STREAM_TAG;
                resourceStream.push(resourceContent);
                resourceStream.push(null);

                // Create an assetsFS.listResourceNames stub to return a single resource name.
                const stubResource = sinon.stub(assetsFS, "listResourceNames");
                stubResource.resolves([{"path":resourceMetadata.path,"id":UnitTest.DUMMY_ID}]);

                // Create an assetsFS.getResourceReadStream stub that returns a promise for a stream.
                const stubStream = sinon.stub(assetsFS, "getResourceReadStream");
                stubStream.resolves(resourceStream);

                // Create an assetsREST.pushItem stub that returns a promise for resource metadata. The stub also emits
                // a stream close event so that subsequent promises will be resolved.
                const stubPush = sinon.stub(assetsREST, "pushItem", function (context, isRaw, isContentResource, replaceContentResource, resourceId, resourceMd5, pathname, stream) {
                    stream.emit("close");
                    return Q(resourceMetadata);
                });

                // Create spies to listen for "pushed" and "pushed-error" events.
                const emitter = assetsHelper.getEventEmitter(context);
                const spyPushed = sinon.spy();
                const spyError = sinon.spy();
                emitter.on("resource-pushed", spyPushed);
                emitter.on("resource-pushed-error", spyError);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubResource);
                self.addTestDouble(stubContentLength);
                self.addTestDouble(stubStream);
                self.addTestDouble(stubPush);

                // Call the method being tested.
                let error;
                assetsHelper.pushAllResources(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (resources) {
                        // Verify that the resource stub was called once and returned a single resource.
                        expect(stubResource).to.have.been.calledOnce;
                        expect(resources).to.be.an("array").that.has.lengthOf(1);
                        expect(resources[0].path).to.equal(resourceMetadata.path);

                        // Verify that the push spy was called once and that the error spy was not called.
                        expect(spyPushed).to.have.been.calledOnce;
                        expect(spyError).to.not.have.been.called;

                        // Verify that an MD5 hash was generated.
                        expect(stubGenerateMD5Hash).to.have.been.calledOnce;

                        // Verify that the other stubs were called once with the expected values.
                        expect(stubStream).to.have.been.calledOnce;
                        expect(stubStream.args[0][1]).to.equal(resourceMetadata.path);
                        expect(stubPush).to.have.been.calledOnce;
                        expect(stubPush.args[0][7]["tag"]).to.equal(STREAM_TAG);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        emitter.removeListener("resource-pushed", spyPushed);
                        emitter.removeListener("resource-pushed-error", spyError);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when there is one local resource, even when failing to get that resource's content length.", function (done) {
                // Create an assetsFS.listResourceNames stub to return a single resource name.
                const stubResource = sinon.stub(assetsFS, "listResourceNames");
                stubResource.resolves([{"path":UnitTest.DUMMY_PATH,"id":UnitTest.DUMMY_ID}]);

                // Create a stub for assetsFS.getResourceContentLength that returns false.
                const stubContentLength = sinon.stub(assetsFS, "getResourceContentLength");
                stubContentLength.rejects(new Error("Error getting resource content length, as expected by a unit test."));

                // Create spies to listen for "pushed" and "pushed-error" events.
                const emitter = assetsHelper.getEventEmitter(context);
                const spyPushed = sinon.spy();
                const spyError = sinon.spy();
                emitter.on("resource-pushed", spyPushed);
                emitter.on("resource-pushed-error", spyError);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubResource);
                self.addTestDouble(stubContentLength);

                // Call the method being tested.
                let error;
                assetsHelper.pushAllResources(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (resources) {
                        // Verify that the resource stub was called once and returned an empty resource array.
                        expect(stubResource).to.have.been.calledOnce;
                        expect(resources).to.be.an("array").that.has.lengthOf(0);

                        // Verify that the push spy and the error spy to not have been called.
                        expect(spyPushed).to.not.have.been.called;
                        expect(spyError).to.not.have.been.called;
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        emitter.removeListener("resource-pushed", spyPushed);
                        emitter.removeListener("resource-pushed-error", spyError);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when there is one local resource, even when failing to get that resource's read stream.", function (done) {
                // Create an assetsFS.listResourceNames stub to return a single resource name.
                const stubResource = sinon.stub(assetsFS, "listResourceNames");
                stubResource.resolves([{"path":UnitTest.DUMMY_PATH,"id":UnitTest.DUMMY_ID}]);

                // Create a stub for assetsFS.getResourceContentLength that returns false.
                const stubContentLength = sinon.stub(assetsFS, "getResourceContentLength");
                stubContentLength.resolves(0);

                // Create an assetsFS.getResourceReadStream stub that returns an error.
                const stubStream = sinon.stub(assetsFS, "getResourceReadStream");
                stubStream.rejects(new Error("Error getting resource read stream, as expected by a unit test."));

                // Create spies to listen for "pushed" and "pushed-error" events.
                const emitter = assetsHelper.getEventEmitter(context);
                const spyPushed = sinon.spy();
                const spyError = sinon.spy();
                emitter.on("resource-pushed", spyPushed);
                emitter.on("resource-pushed-error", spyError);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubResource);
                self.addTestDouble(stubContentLength);
                self.addTestDouble(stubStream);

                // Call the method being tested.
                let error;
                assetsHelper.pushAllResources(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (resources) {
                        // Verify that the resource stub was called once and returned an empty resource array.
                        expect(stubResource).to.have.been.calledOnce;
                        expect(resources).to.be.an("array").that.has.lengthOf(0);

                        // Verify that the push and error spies were not called.
                        expect(spyPushed).to.not.have.been.called;
                        expect(spyError).to.not.have.been.called;

                        // Verify that the other stubs were called once with the expected values.
                        expect(stubStream).to.have.been.calledOnce;
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        emitter.removeListener("resource-pushed", spyPushed);
                        emitter.removeListener("resource-pushed-error", spyError);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when there is one local resource, which has to be retried twice.", function (done) {
                // Create a stub for assetsFS.getResourceContentLength that returns false.
                const stubContentLength = sinon.stub(assetsFS, "getResourceContentLength");
                stubContentLength.resolves(0);

                // Read the contents of a test resource file.
                const resourcePath = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_HTML_1;
                const resourceContent = fs.readFileSync(resourcePath);
                const resourceMetadataPath = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_HTML_1;
                const resourceMetadata = UnitTest.getJsonObject(resourceMetadataPath);

                // Create an assetsFS.listResourceNames stub to return a single resource name.
                const stubResource = sinon.stub(assetsFS, "listResourceNames");
                stubResource.resolves([{"path":resourceMetadata.path,"id":UnitTest.DUMMY_ID}]);

                // Create an assetsFS.getResourceReadStream stub that returns a promise for a stream.
                const stubStream = sinon.stub(assetsFS, "getResourceReadStream");
                const resourceStream1 = new stream.Readable();
                resourceStream1.tag = 1;
                resourceStream1.push(resourceContent);
                resourceStream1.push(null);
                const resourceStream2 = new stream.Readable();
                resourceStream2.tag = 2;
                resourceStream2.push(resourceContent);
                resourceStream2.push(null);
                const resourceStream3 = new stream.Readable();
                resourceStream3.push(resourceContent);
                resourceStream3.push(null);
                stubStream.onFirstCall().resolves(resourceStream1);
                stubStream.onSecondCall().resolves(resourceStream2);
                stubStream.onThirdCall().resolves(resourceStream3);

                // Create an assetsREST.pushItem stub that fails the first and second times with an error that can be
                // retried. The third time it returns a promise for the asset metadata and emits a stream close event.
                const PUSH_ERROR = "Error pushing an item, as expected by a unit test.";
                const stubPush = sinon.stub(assetsREST, "pushItem", function (context, isRaw, isContentResource, replaceContentResource, resourceId, resourceMd5, pathname, stream, length, opts) {
                    if (stream.tag === 1 || stream.tag === 2) {
                        const error = new Error(PUSH_ERROR);
                        error.retry = true;
                        return Q.reject(error);
                    } else {
                        stream.emit("close");
                        return Q(resourceMetadata);
                    }
                });

                // Create spies to listen for "pushed" and "pushed-error" events.
                const emitter = assetsHelper.getEventEmitter(context);
                const spyPushed = sinon.spy();
                const spyError = sinon.spy();
                emitter.on("resource-pushed", spyPushed);
                emitter.on("resource-pushed-error", spyError);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubResource);
                self.addTestDouble(stubContentLength);
                self.addTestDouble(stubStream);
                self.addTestDouble(stubPush);

                // Call the method being tested.
                let error;
                assetsHelper.pushAllResources(context, {retryMaxAttempts: 5, retryMinTimeout: 0, retryMaxTimeout: 10, retryFactor: 1, retryRandomize: false})
                    .then(function (resources) {
                        // Verify that the resource stub was called once and returned a single resource.
                        expect(stubResource).to.have.been.calledOnce;
                        expect(resources).to.be.an("array").that.has.lengthOf(1);
                        expect(resources[0].path).to.equal(resourceMetadata.path);

                        // Verify that the stream stub was called thrice with the expected values.
                        expect(stubStream).to.have.been.calledThrice;
                        expect(stubStream.args[0][1]).to.equal(resourceMetadata.path);
                        expect(stubStream.args[1][1]).to.equal(resourceMetadata.path);
                        expect(stubStream.args[2][1]).to.equal(resourceMetadata.path);

                        // Verify that the push stub was called thrice with the expected streams.
                        expect(stubPush).to.have.been.calledThrice;
                        expect(stubPush.args[0][7]["tag"]).to.equal(1);
                        expect(stubPush.args[1][7]["tag"]).to.equal(2);

                        // Verify that the push spy was called once and that the error spy was not called.
                        expect(spyPushed).to.have.been.calledOnce;
                        expect(spyError).to.not.have.been.called;

                        // Verify that an MD5 hash was generated.
                        expect(stubGenerateMD5Hash).to.have.been.calledThrice;
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        emitter.removeListener("resource-pushed", spyPushed);
                        emitter.removeListener("resource-pushed-error", spyError);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when there is one local resource, even when it fails after the maximum number of retries.", function (done) {
                // Create an assetsFS.listResourceNames stub to return a single resource name.
                const stubResource = sinon.stub(assetsFS, "listResourceNames");
                stubResource.resolves([{"path":UnitTest.DUMMY_PATH,"id":UnitTest.DUMMY_ID}]);

                // Create a stub for assetsFS.getResourceContentLength that returns false.
                const stubContentLength = sinon.stub(assetsFS, "getResourceContentLength");
                stubContentLength.resolves(0);

                // Read the contents of a test resource file.
                const resourcePath = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_HTML_1;
                const resourceContent = fs.readFileSync(resourcePath);
                const resourceMetadataPath = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_HTML_1;
                const resourceMetadata = UnitTest.getJsonObject(resourceMetadataPath);

                // Create an assetsFS.getResourceReadStream stub that returns a promise for a stream.
                const stubStream = sinon.stub(assetsFS, "getResourceReadStream");
                const resourceStream1 = new stream.Readable();
                resourceStream1.tag = 1;
                resourceStream1.push(resourceContent);
                resourceStream1.push(null);
                const resourceStream2 = new stream.Readable();
                resourceStream2.tag = 2;
                resourceStream2.push(resourceContent);
                resourceStream2.push(null);
                const resourceStream3 = new stream.Readable();
                resourceStream3.tag = 3;
                resourceStream3.push(resourceContent);
                resourceStream3.push(null);
                stubStream.onFirstCall().resolves(resourceStream1);
                stubStream.onSecondCall().resolves(resourceStream2);
                stubStream.onThirdCall().resolves(resourceStream3);

                // Create an assetsREST.pushItem stub that fails with an error that can be retried.
                const PUSH_ERROR = "Error pushing an item, as expected by a unit test.";
                const stubPush = sinon.stub(assetsREST, "pushItem", function (context, isRaw, isContentResource, replaceContentResource, resourceId, resourceMd5, pathname, stream, length, opts) {
                    const error = new Error(PUSH_ERROR);
                    error.retry = true;
                    error.log = "The log message for this error: ";
                    return Q.reject(error);
                });

                // Create spies to listen for "pushed" and "pushed-error" events.
                const emitter = assetsHelper.getEventEmitter(context);
                const spyPushed = sinon.spy();
                const spyError = sinon.spy();
                emitter.on("resource-pushed", spyPushed);
                emitter.on("resource-pushed-error", spyError);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubResource);
                self.addTestDouble(stubContentLength);
                self.addTestDouble(stubStream);
                self.addTestDouble(stubPush);

                // Call the method being tested.
                let error;
                assetsHelper.pushAllResources(context, {retryMaxAttempts: 3, retryMinTimeout: 0, retryMaxTimeout: 10, retryFactor: 1, retryRandomize: false})
                    .then(function (resources) {
                        // Verify that the result is an empty resource array.
                        expect(resources).to.be.an("array").that.has.lengthOf(0);

                        // Verify that the resource stub was called once.
                        expect(stubResource).to.have.been.calledOnce;

                        // Verify that the stream stub was called thrice with the expected values.
                        expect(stubStream).to.have.been.calledThrice;
                        expect(stubStream.args[0][1]).to.equal(UnitTest.DUMMY_PATH);
                        expect(stubStream.args[1][1]).to.equal(UnitTest.DUMMY_PATH);
                        expect(stubStream.args[2][1]).to.equal(UnitTest.DUMMY_PATH);

                        // Verify that the push stub was called thrice with the expected streams.
                        expect(stubPush).to.have.been.calledThrice;
                        expect(stubPush.args[0][7]["tag"]).to.equal(1);
                        expect(stubPush.args[1][7]["tag"]).to.equal(2);
                        expect(stubPush.args[2][7]["tag"]).to.equal(3);

                        // Verify that the push spy was not called and that the error spy was called once.
                        expect(spyPushed).to.not.have.been.called;
                        expect(spyError).to.have.been.calledOnce;

                        // Verify that an MD5 hash was generated.
                        expect(stubGenerateMD5Hash).to.have.been.calledThrice;
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        emitter.removeListener("resource-pushed", spyPushed);
                        emitter.removeListener("resource-pushed-error", spyError);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when there are two local resources, but one push fails.", function (done) {
                // Create an assetsFS.listResourceNames stub to return two resource names.
                const stubResource = sinon.stub(assetsFS, "listResourceNames");
                stubResource.resolves([{"path":AssetsUnitTest.ASSET_HTML_1, "id":UnitTest.DUMMY_ID},
                                       {"path":AssetsUnitTest.ASSET_CSS_1, "id":UnitTest.DUMMY_ID}]);

                // Create a stub for assetsFS.getResourceContentLength that returns false.
                const stubContentLength = sinon.stub(assetsFS, "getResourceContentLength");
                stubContentLength.resolves(0);

                // Read the contents of two test resource files.
                const resourcePath1 = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_HTML_1;
                const resourceContent1 = fs.readFileSync(resourcePath1);
                const resourceMetadataPath1 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_HTML_1;
                const resourceMetadata1 = UnitTest.getJsonObject(resourceMetadataPath1);
                const resourceStream1 = new stream.Readable();
                const STREAM_TAG_1 = "unique.id.1";
                resourceStream1.tag = STREAM_TAG_1;
                resourceStream1.push(resourceContent1);
                resourceStream1.push(null);
                const resourcePath2 = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CSS_1;
                const resourceContent2 = fs.readFileSync(resourcePath2);
                const resourceMetadataPath2 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CSS_1;
                const resourceStream2 = new stream.Readable();
                const STREAM_TAG_2 = "unique.id.2";
                resourceStream2.tag = STREAM_TAG_2;
                resourceStream2.push(resourceContent2);
                resourceStream2.push(null);

                // Create an assetsFS.getResourceReadStream stub that returns a promise for a stream.
                const stubStream = sinon.stub(assetsFS, "getResourceReadStream");
                stubStream.onFirstCall().resolves(resourceStream1);
                stubStream.onSecondCall().resolves(resourceStream2);

                // Create a stub for assetsHelper.isRetryPushEnabled that returns false.
                const stubRetryPush = sinon.stub(assetsHelper, "isRetryPushEnabled");
                stubRetryPush.returns(false);

                // Create an assetsREST.pushItem stub that returns a promise for resource metadata. The stub also emits
                // a stream close event so that subsequent promises will be resolved.
                const PUSH_ERROR = "Error pushing the resaource, as expected by a unit test.";
                const stubPush = sinon.stub(assetsREST, "pushItem", function (context, isRaw, isContentResource, replaceContentResource, resourceId, resourceMd5, pathname, stream) {
                    stream.emit("close");
                    if (pathname === AssetsUnitTest.ASSET_HTML_1) {
                        return Q(resourceMetadata1);
                    } else if (pathname === AssetsUnitTest.ASSET_CSS_1) {
                        return Q.reject(PUSH_ERROR);
                    }
                });

                // Create spies to listen for "pushed" and "pushed-error" events.
                const emitter = assetsHelper.getEventEmitter(context);
                const spyPushed = sinon.spy();
                const spyError = sinon.spy();
                emitter.on("resource-pushed", spyPushed);
                emitter.on("resource-pushed-error", spyError);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubResource);
                self.addTestDouble(stubContentLength);
                self.addTestDouble(stubStream);
                self.addTestDouble(stubRetryPush);
                self.addTestDouble(stubPush);

                // Call the method being tested.
                let error;
                assetsHelper.pushAllResources(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (resources) {
                        // Verify that the method being tested returned the expected values.
                        expect(resources).to.be.an("array").that.has.lengthOf(1);
                        expect(resources[0].path).to.equal(resourceMetadata1.path);

                        // Verify that the resource stub was called once.
                        expect(stubResource).to.have.been.calledOnce;

                        // Verify that the push and error spies were each called once.
                        expect(spyPushed).to.have.been.calledOnce;
                        expect(spyError).to.have.been.calledOnce;

                        // Verify that an MD5 hash was generated.
                        expect(stubGenerateMD5Hash).to.have.been.calledTwice;

                        // Verify that the other stubs were called once with the expected values.
                        expect(stubStream).to.have.been.calledTwice;
                        expect(stubStream.args[0][1]).to.equal(AssetsUnitTest.ASSET_HTML_1);
                        expect(stubStream.args[1][1]).to.equal(AssetsUnitTest.ASSET_CSS_1);
                        expect(stubPush).to.have.been.calledTwice;
                        expect(stubPush.args[0][7]["tag"]).to.equal(STREAM_TAG_1);
                        expect(stubPush.args[1][7]["tag"]).to.equal(STREAM_TAG_2);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        emitter.removeListener("resource-pushed", spyPushed);
                        emitter.removeListener("resource-pushed-error", spyError);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when there are two local resources, but one push fails (no emitter).", function (done) {
                // Create an assetsFS.listResourceNames stub to return two resource names.
                const stubResource = sinon.stub(assetsFS, "listResourceNames");
                stubResource.resolves([{"path":AssetsUnitTest.ASSET_HTML_1, "id":UnitTest.DUMMY_ID},
                                       {"path":AssetsUnitTest.ASSET_CSS_1, "id":UnitTest.DUMMY_ID}]);

                // Create a stub for assetsFS.getResourceContentLength that returns false.
                const stubContentLength = sinon.stub(assetsFS, "getResourceContentLength");
                stubContentLength.resolves(0);

                // Read the contents of two test resource files.
                const resourcePath1 = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_HTML_1;
                const resourceContent1 = fs.readFileSync(resourcePath1);
                const resourceMetadataPath1 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_HTML_1;
                const resourceMetadata1 = UnitTest.getJsonObject(resourceMetadataPath1);
                const resourceStream1 = new stream.Readable();
                const STREAM_TAG_1 = "unique.id.1";
                resourceStream1.tag = STREAM_TAG_1;
                resourceStream1.push(resourceContent1);
                resourceStream1.push(null);
                const resourcePath2 = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_CSS_1;
                const resourceContent2 = fs.readFileSync(resourcePath2);
                const resourceMetadataPath2 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CSS_1;
                const resourceStream2 = new stream.Readable();
                const STREAM_TAG_2 = "unique.id.2";
                resourceStream2.tag = STREAM_TAG_2;
                resourceStream2.push(resourceContent2);
                resourceStream2.push(null);

                // Create an assetsFS.getResourceReadStream stub that returns a promise for a stream.
                const stubStream = sinon.stub(assetsFS, "getResourceReadStream");
                stubStream.onFirstCall().resolves(resourceStream1);
                stubStream.onSecondCall().resolves(resourceStream2);

                // Create a stub for assetsHelper.isRetryPushEnabled that returns false.
                const stubRetryPush = sinon.stub(assetsHelper, "isRetryPushEnabled");
                stubRetryPush.returns(false);

                // Create an assetsREST.pushItem stub that returns a promise for resource metadata. The stub also emits
                // a stream close event so that subsequent promises will be resolved.
                const PUSH_ERROR = "Error pushing the resaource, as expected by a unit test.";
                const stubPush = sinon.stub(assetsREST, "pushItem", function (context, isRaw, isContentResource, replaceContentResource, resourceId, resourceMd5, pathname, stream) {
                    stream.emit("close");
                    if (pathname === AssetsUnitTest.ASSET_HTML_1) {
                        return Q(resourceMetadata1);
                    } else if (pathname === AssetsUnitTest.ASSET_CSS_1) {
                        return Q.reject(PUSH_ERROR);
                    }
                });

                // Create spies to listen for "pushed" and "pushed-error" events.
                const emitter = assetsHelper.getEventEmitter(context);
                delete context.eventEmitter;
                const spyPushed = sinon.spy();
                const spyError = sinon.spy();
                emitter.on("resource-pushed", spyPushed);
                emitter.on("resource-pushed-error", spyError);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubResource);
                self.addTestDouble(stubContentLength);
                self.addTestDouble(stubStream);
                self.addTestDouble(stubRetryPush);
                self.addTestDouble(stubPush);

                // Call the method being tested.
                let error;
                assetsHelper.pushAllResources(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (resources) {
                        // Verify that the method being tested returned the expected values.
                        expect(resources).to.be.an("array").that.has.lengthOf(1);
                        expect(resources[0].path).to.equal(resourceMetadata1.path);

                        // Verify that the resource stub was called once.
                        expect(stubResource).to.have.been.calledOnce;

                        // Verify that the push and error spies were not called (no emitter).
                        expect(spyPushed).to.not.have.been.called;
                        expect(spyError).to.not.have.been.called;

                        // Verify that an MD5 hash was generated.
                        expect(stubGenerateMD5Hash).to.have.been.calledTwice;

                        // Verify that the other stubs were called once with the expected values.
                        expect(stubStream).to.have.been.calledTwice;
                        expect(stubStream.args[0][1]).to.equal(AssetsUnitTest.ASSET_HTML_1);
                        expect(stubStream.args[1][1]).to.equal(AssetsUnitTest.ASSET_CSS_1);
                        expect(stubPush).to.have.been.calledTwice;
                        expect(stubPush.args[0][7]["tag"]).to.equal(STREAM_TAG_1);
                        expect(stubPush.args[1][7]["tag"]).to.equal(STREAM_TAG_2);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        emitter.removeListener("resource-pushed", spyPushed);
                        emitter.removeListener("resource-pushed-error", spyError);
                        context.eventEmitter = emitter;

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testPushModifiedResources () {
        const self = this;
        describe("pushModifiedResources", function () {
            it("should short-circuit when pushing only web assets.", function (done) {
                // Create an assetsFS.listResourceNames spy to verify that it is not called.
                const spy = sinon.spy(assetsFS, "listResourceNames");

                // The spy should be restored when the test is complete.
                self.addTestDouble(spy);

                // Call the method being tested.
                let error;
                assetsHelper.pushModifiedResources(context, {assetTypes: assetsHelper.ASSET_TYPES_WEB_ASSETS})
                    .then(function () {
                        // Verify that the spy was not called.
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

            it("should short-circuit when pushing with no virtual folder.", function (done) {
                // Create an assetsFS.listResourceNames spy to verify that it is not called.
                const spy = sinon.spy(assetsFS, "listResourceNames");

                // The spy should be restored when the test is complete.
                self.addTestDouble(spy);

                // Call the method being tested.
                let error;
                assetsHelper.pushModifiedResources(context, {noVirtualFolder: true})
                    .then(function () {
                        // Verify that the spy was not called.
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

            it("should fail when there is an error getting local resources.", function (done) {
                // Create an assetsFS.listResourceNames stub that returns an error.
                const RESOURCES_ERROR = "There was an error getting the local resources, as expected by unit test.";
                const stub = sinon.stub(assetsFS, "listResourceNames");
                stub.rejects(RESOURCES_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsHelper.pushModifiedResources(context)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the local resources should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once.
                        expect(stub).to.be.calledOnce;

                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.equal(RESOURCES_ERROR);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when there is one local resource.", function (done) {
                // Create a stub for assetsFS.getResourceContentLength that returns false.
                const stubContentLength = sinon.stub(assetsFS, "getResourceContentLength");
                stubContentLength.resolves(0);

                // Read the contents of a test resource file.
                const resourcePath = AssetsUnitTest.API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_HTML_1;
                const resourceContent = fs.readFileSync(resourcePath);
                const resourceMetadataPath = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_HTML_1;
                const resourceMetadata = UnitTest.getJsonObject(resourceMetadataPath);
                const resourceStream = new stream.Readable();
                const STREAM_TAG = "unique.id";
                resourceStream.tag = STREAM_TAG;
                resourceStream.push(resourceContent);
                resourceStream.push(null);

                // Create an assetsFS.listResourceNames stub to return a single resource name.
                const stubResource = sinon.stub(assetsFS, "listResourceNames");
                stubResource.resolves([{"path":resourceMetadata.path,"id":UnitTest.DUMMY_ID}]);

                // Create an assetsFS.getResourceReadStream stub that returns a promise for a stream.
                const stubStream = sinon.stub(assetsFS, "getResourceReadStream");
                stubStream.resolves(resourceStream);

                // Create an assetsREST.pushItem stub that returns a promise for resource metadata. The stub also emits
                // a stream close event so that subsequent promises will be resolved.
                const stubPush = sinon.stub(assetsREST, "pushItem", function (context, isRaw, isContentResource, replaceContentResource, resourceId, resourceMd5, pathname, stream) {
                    stream.emit("close");
                    return Q(resourceMetadata);
                });

                // Create spies to listen for "pushed" and "pushed-error" events.
                const emitter = assetsHelper.getEventEmitter(context);
                const spyPushed = sinon.spy();
                const spyError = sinon.spy();
                emitter.on("resource-pushed", spyPushed);
                emitter.on("resource-pushed-error", spyError);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubResource);
                self.addTestDouble(stubContentLength);
                self.addTestDouble(stubStream);
                self.addTestDouble(stubPush);

                // Call the method being tested.
                let error;
                assetsHelper.pushModifiedResources(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (resources) {
                        // Verify that the resource stub was called once and returned a single resource.
                        expect(stubResource).to.have.been.calledOnce;
                        expect(resources).to.be.an("array").that.has.lengthOf(1);
                        expect(resources[0].path).to.equal(resourceMetadata.path);

                        // Verify that the push spy was called once and that the error spy was not called.
                        expect(spyPushed).to.have.been.calledOnce;
                        expect(spyError).to.not.have.been.called;

                        // Verify that an MD5 hash was generated.
                        expect(stubGenerateMD5Hash).to.have.been.calledOnce;

                        // Verify that the other stubs were called once with the expected values.
                        expect(stubStream).to.have.been.calledOnce;
                        expect(stubStream.args[0][1]).to.equal(resourceMetadata.path);
                        expect(stubPush).to.have.been.calledOnce;
                        expect(stubPush.args[0][7]["tag"]).to.equal(STREAM_TAG);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        emitter.removeListener("resource-pushed", spyPushed);
                        emitter.removeListener("resource-pushed-error", spyError);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testListRemoteAssetNames() {
        const self = this;
        describe("listRemoteItemNames", function () {
            it("should fail when getting a list of remote asset names fails.", function (done) {
                // Create an assetsREST.getItems stub that returns a promise for the remote asset names.
                const stub = sinon.stub(assetsREST, "getItems");
                const ASSET_ERROR = "There was an error getting a list of remote assets. This error is expected by the test.";
                stub.rejects(ASSET_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsHelper.listRemoteItemNames(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (/*assets*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the list of remote assets should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once.
                            expect(stub).to.be.calledOnce;

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

            it("should succeed when getting a list of remote asset names.", function (done) {
                // List of multiple remote asset names.
                const assetMetadataPath1 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_HTML_1;
                const assetMetadataPath2 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_GIF_1;
                const assetMetadataPath3 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_PNG_1;
                const assetMetadataPath4 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CSS_1;
                const assetMetadataPath5 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JAR_1;
                const assetMetadata1 = UnitTest.getJsonObject(assetMetadataPath1);
                const assetMetadata2 = UnitTest.getJsonObject(assetMetadataPath2);
                const assetMetadata3 = UnitTest.getJsonObject(assetMetadataPath3);
                const assetMetadata4 = UnitTest.getJsonObject(assetMetadataPath4);
                const assetMetadata5 = UnitTest.getJsonObject(assetMetadataPath5);

                // Create an assetsREST.getItems stub that returns a promise for the remote asset names.
                const stub = sinon.stub(assetsREST, "getItems");
                stub.resolves([assetMetadata1, assetMetadata2, assetMetadata3, assetMetadata4, assetMetadata5]);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsHelper.listRemoteItemNames(context, {assetTypes: assetsHelper.ASSET_TYPES_WEB_ASSETS})
                    .then(function (names) {
                        // Verify that the helper returned the expected values.
                        expect(names).to.have.lengthOf(5);
                        expect(names[0].path).to.contain(AssetsUnitTest.ASSET_HTML_1);
                        expect(names[1].path).to.contain(AssetsUnitTest.ASSET_GIF_1);
                        expect(names[2].path).to.contain(AssetsUnitTest.ASSET_PNG_1);
                        expect(names[3].path).to.contain(AssetsUnitTest.ASSET_CSS_1);
                        expect(names[4].path).to.contain(AssetsUnitTest.ASSET_JAR_1);

                        // Verify that the stub was called once.
                        expect(stub).to.have.been.calledOnce;
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

            it("should succeed when getting a chunked list of remote asset names.", function (done) {
                // List of multiple remote asset names.
                const assetMetadataPath1 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_HTML_1;
                const assetMetadataPath2 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_GIF_1;
                const assetMetadataPath3 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_PNG_1;
                const assetMetadataPath4 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CSS_1;
                const assetMetadataPath5 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JAR_1;
                const assetMetadata1 = UnitTest.getJsonObject(assetMetadataPath1);
                const assetMetadata2 = UnitTest.getJsonObject(assetMetadataPath2);
                const assetMetadata3 = UnitTest.getJsonObject(assetMetadataPath3);
                const assetMetadata4 = UnitTest.getJsonObject(assetMetadataPath4);
                const assetMetadata5 = UnitTest.getJsonObject(assetMetadataPath5);

                // Create an assetsREST.getItems stub that returns a promise for the remote asset names.
                const stub = sinon.stub(assetsREST, "getItems", function (context, opts) {
                    if (stub.callCount === 1) {
                        opts.nextURI = "off=4";
                        return Q([assetMetadata1, assetMetadata2, assetMetadata3, assetMetadata4]);
                    } else {
                        delete opts.nextURI;
                        return Q([assetMetadata5]);
                    }
                });

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsHelper.listRemoteItemNames(context, {offset: 0, limit: 4})
                    .then(function (names) {
                        // Verify that the helper returned the expected values.
                        expect(names).to.have.lengthOf(5);
                        expect(names[0].path).to.contain(AssetsUnitTest.ASSET_HTML_1);
                        expect(names[1].path).to.contain(AssetsUnitTest.ASSET_GIF_1);
                        expect(names[2].path).to.contain(AssetsUnitTest.ASSET_PNG_1);
                        expect(names[3].path).to.contain(AssetsUnitTest.ASSET_CSS_1);
                        expect(names[4].path).to.contain(AssetsUnitTest.ASSET_JAR_1);

                        // Verify that the stub was called once.
                        expect(stub).to.have.been.calledTwice;
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

            it("should succeed when getting a chunked list of remote web asset names.", function (done) {
                // List of multiple remote asset names.
                const assetMetadataPath1 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_HTML_1;
                const assetMetadataPath2 = AssetsUnitTest.VALID_CONTENT_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_1;
                const assetMetadataPath3 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_PNG_1;
                const assetMetadataPath4 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CSS_1;
                const assetMetadataPath5 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JAR_1;
                const assetMetadata1 = UnitTest.getJsonObject(assetMetadataPath1);
                const assetMetadata2 = UnitTest.getJsonObject(assetMetadataPath2 + assetsFS.getExtension());
                const assetMetadata3 = UnitTest.getJsonObject(assetMetadataPath3);
                const assetMetadata4 = UnitTest.getJsonObject(assetMetadataPath4);
                const assetMetadata5 = UnitTest.getJsonObject(assetMetadataPath5);

                // Create an assetsREST.getItems stub that returns a promise for the remote asset names.
                const stub = sinon.stub(assetsREST, "getItems", function (context, opts) {
                    if (stub.callCount === 1) {
                        opts.nextURI = "off=3";
                        return Q([assetMetadata1, assetMetadata2, assetMetadata3]);
                    } else {
                        delete opts.nextURI;
                        return Q([assetMetadata4, assetMetadata5]);
                    }
                });

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsHelper.listRemoteItemNames(context, {offset: 0, limit: 3, assetTypes: assetsHelper.ASSET_TYPES_WEB_ASSETS})
                    .then(function (names) {
                        // Verify that the helper returned the expected values.
                        expect(names).to.have.lengthOf(4);
                        expect(names[0].path).to.contain(AssetsUnitTest.ASSET_HTML_1);
                        expect(names[1].path).to.contain(AssetsUnitTest.ASSET_PNG_1);
                        expect(names[2].path).to.contain(AssetsUnitTest.ASSET_CSS_1);
                        expect(names[3].path).to.contain(AssetsUnitTest.ASSET_JAR_1);

                        // Verify that the stub was called once.
                        expect(stub).to.have.been.calledTwice;
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

            it("should succeed when getting a chunked list of remote content asset names.", function (done) {
                // List of multiple remote asset names.
                const assetMetadataPath1 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_HTML_1;
                const assetMetadataPath2 = AssetsUnitTest.VALID_CONTENT_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_1;
                const assetMetadataPath3 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_PNG_1;
                const assetMetadataPath4 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CSS_1;
                const assetMetadataPath5 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JAR_1;
                const assetMetadata1 = UnitTest.getJsonObject(assetMetadataPath1);
                const assetMetadata2 = UnitTest.getJsonObject(assetMetadataPath2 + assetsFS.getExtension());
                const assetMetadata3 = UnitTest.getJsonObject(assetMetadataPath3);
                const assetMetadata4 = UnitTest.getJsonObject(assetMetadataPath4);
                const assetMetadata5 = UnitTest.getJsonObject(assetMetadataPath5);

                // Create an assetsREST.getItems stub that returns a promise for the remote asset names.
                const stub = sinon.stub(assetsREST, "getItems", function (context, opts) {
                    if (stub.callCount === 1) {
                        opts.nextURI = "off=3";
                        return Q([assetMetadata1, assetMetadata2, assetMetadata3]);
                    } else {
                        delete opts.nextURI;
                        return Q([assetMetadata4, assetMetadata5]);
                    }
                });

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsHelper.listRemoteItemNames(context, {offset: 0, limit: 3, assetTypes: assetsHelper.ASSET_TYPES_CONTENT_ASSETS})
                    .then(function (names) {
                        // Verify that the stub was called once.
                        expect(stub).to.have.been.calledTwice;

                        // Verify that the helper returned the expected values.
                        expect(names).to.have.lengthOf(1);
                        expect(names[0].path).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_1);
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

    testListRemoteDeletedAssetNames() {
        const self = this;
        describe("listRemoteDeletedNames", function () {
            it("should fail when getting a list of remote asset names fails.", function (done) {
                // Create an assetsREST.getItems stub that returns a promise for the remote asset names.
                const stub = sinon.stub(assetsREST, "getItems");
                const ASSET_ERROR = "There was an error getting a list of remote assets. This error is expected by the test.";
                stub.rejects(ASSET_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsHelper.listRemoteDeletedNames(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (/*assets*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the list of remote assets should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once.
                            expect(stub).to.be.calledOnce;

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

            it("should succeed when getting a list of names for deleted remote assets.", function (done) {
                // List of multiple remote asset names.
                const assetMetadataPath1 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_HTML_1;
                const assetMetadataPath3 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_PNG_1;
                const assetMetadataPath5 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JAR_1;
                const assetMetadata1 = UnitTest.getJsonObject(assetMetadataPath1);
                const assetMetadata3 = UnitTest.getJsonObject(assetMetadataPath3);
                const assetMetadata5 = UnitTest.getJsonObject(assetMetadataPath5);

                // Create an assetsREST.getItems stub that returns a promise for the remote asset names.
                const stubRemote = sinon.stub(assetsREST, "getItems", function (context, opts) {
                    if (stubRemote.callCount === 1) {
                        opts.nextURI = "off=2";
                        return Q([assetMetadata1, assetMetadata3]);
                    } else {
                        delete opts.nextURI;
                        return Q([assetMetadata5]);
                    }
                });

                // Create a non-default stub for hashes.listFiles that returns the local asset paths.
                stubListFiles.restore();
                stubListFiles = sinon.stub(hashes, "listFiles");
                stubListFiles.returns([{id: undefined, path: AssetsUnitTest.ASSET_HTML_1}, {id: undefined, path: AssetsUnitTest.ASSET_GIF_1}, {id: undefined, path: AssetsUnitTest.ASSET_PNG_1}, {id: undefined, path: AssetsUnitTest.ASSET_CSS_1}, {id: undefined, path: AssetsUnitTest.ASSET_JAR_1}]);

                // The remote stub should be restored when the test is complete. (The list files stub is restored by the afterEach function.)
                self.addTestDouble(stubRemote);

                // Call the method being tested.
                let error;
                assetsHelper.listRemoteDeletedNames(context, {offset: 0, limit: 2})
                    .then(function (names) {
                        // Verify that the helper returned the expected values.
                        expect(names).to.have.lengthOf(2);

                        // ASSET_GIF_1 should have been identified as having been deleted.
                        expect(names[0].path).to.contain(AssetsUnitTest.ASSET_GIF_1);

                        // ASSET_CSS_1 should have been identified as having been deleted.
                        expect(names[1].path).to.contain(AssetsUnitTest.ASSET_CSS_1);

                        // Verify that the remote stub was called once.
                        expect(stubRemote).to.have.been.calledTwice;

                        // Verify that the local stub was called once.
                        expect(stubListFiles).to.have.been.calledOnce;
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

    testListModifiedRemoteAssetNames() {
        const self = this;
        describe("listModifiedRemoteItemNames", function () {
            it("should fail when getting a list of modified remote assets fails.", function (done) {
                // Create an assetsREST.getModifiedItems stub that returns a promise for the remote asset names.
                const stub = sinon.stub(assetsREST, "getModifiedItems");
                const ASSET_ERROR = "There was an error getting a list of modified remote assets. This error is expected by the test.";
                stub.rejects(ASSET_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsHelper.listModifiedRemoteItemNames(context, [assetsHelper.MODIFIED], UnitTest.DUMMY_OPTIONS)
                    .then(function (/*assets*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the list of modified remote assets should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once.
                            expect(stub).to.be.calledOnce;

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

            it("should succeed when getting a list of modified remote assets succeeds.", function (done) {
                // List of multiple remote asset names.
                const assetMetadataPath1 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_HTML_1;
                const assetMetadataPath2 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_GIF_1;
                const assetMetadataPath3 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_PNG_1;
                const assetMetadataPath4 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CSS_1;
                const assetMetadataPath5 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JAR_1;
                const assetMetadata1 = UnitTest.getJsonObject(assetMetadataPath1);
                const assetMetadata2 = UnitTest.getJsonObject(assetMetadataPath2);
                const assetMetadata3 = UnitTest.getJsonObject(assetMetadataPath3);
                const assetMetadata4 = UnitTest.getJsonObject(assetMetadataPath4);
                const assetMetadata5 = UnitTest.getJsonObject(assetMetadataPath5);

                // Create an assetsREST.getModifiedItems stub that returns a promise for the modified remote asset names.
                const stub = sinon.stub(assetsREST, "getModifiedItems");
                stub.resolves([assetMetadata1, assetMetadata2, assetMetadata3, assetMetadata4, assetMetadata5]);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsHelper.listModifiedRemoteItemNames(context, [assetsHelper.MODIFIED], UnitTest.DUMMY_OPTIONS)
                    .then(function (names) {
                        // Verify that the helper returned the expected values.
                        expect(names).to.have.lengthOf(5);
                        expect(names[0].path).to.contain(AssetsUnitTest.ASSET_HTML_1);
                        expect(names[1].path).to.contain(AssetsUnitTest.ASSET_GIF_1);
                        expect(names[2].path).to.contain(AssetsUnitTest.ASSET_PNG_1);
                        expect(names[3].path).to.contain(AssetsUnitTest.ASSET_CSS_1);
                        expect(names[4].path).to.contain(AssetsUnitTest.ASSET_JAR_1);

                        // Verify that the stub was called once.
                        expect(stub).to.have.been.calledOnce;
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


            it("should succeed when getting a list of modified remote ready assets succeeds.", function (done) {
                // List of multiple remote asset names.
                const assetMetadataPath1 = AssetsUnitTest.VALID_CONTENT_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_1;
                const assetMetadataPath2 = AssetsUnitTest.VALID_CONTENT_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_1_DRAFT;
                const assetMetadataPath3 = AssetsUnitTest.VALID_CONTENT_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_2;
                const assetMetadataPath4 = AssetsUnitTest.VALID_CONTENT_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_2_DRAFT;
                const assetMetadata1 = UnitTest.getJsonObject(assetMetadataPath1 + assetsFS.getExtension());
                const assetMetadata2 = UnitTest.getJsonObject(assetMetadataPath2 + assetsFS.getExtension());
                const assetMetadata3 = UnitTest.getJsonObject(assetMetadataPath3 + assetsFS.getExtension());
                const assetMetadata4 = UnitTest.getJsonObject(assetMetadataPath4 + assetsFS.getExtension());

                // Create an assetsREST.getModifiedItems stub that returns a promise for the modified remote asset names.
                const stub = sinon.stub(assetsREST, "getModifiedItems");
                stub.resolves([assetMetadata1, assetMetadata2, assetMetadata3, assetMetadata4]);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsHelper.listModifiedRemoteItemNames(context, [assetsHelper.MODIFIED], {filterReady: true})
                    .then(function (names) {
                        // Verify that the helper returned the expected values.
                        expect(names).to.have.lengthOf(2);
                        expect(names[0].path).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_1);
                        expect(names[1].path).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_2);

                        // Verify that the stub was called once.
                        expect(stub).to.have.been.calledOnce;
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

            it("should succeed when getting a list of modified remote draft assets succeeds.", function (done) {
                // List of multiple remote asset names.
                const assetMetadataPath1 = AssetsUnitTest.VALID_CONTENT_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_1;
                const assetMetadataPath2 = AssetsUnitTest.VALID_CONTENT_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_1_DRAFT;
                const assetMetadataPath3 = AssetsUnitTest.VALID_CONTENT_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_2;
                const assetMetadataPath4 = AssetsUnitTest.VALID_CONTENT_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_2_DRAFT;
                const assetMetadata1 = UnitTest.getJsonObject(assetMetadataPath1 + assetsFS.getExtension());
                const assetMetadata2 = UnitTest.getJsonObject(assetMetadataPath2 + assetsFS.getExtension());
                const assetMetadata3 = UnitTest.getJsonObject(assetMetadataPath3 + assetsFS.getExtension());
                const assetMetadata4 = UnitTest.getJsonObject(assetMetadataPath4 + assetsFS.getExtension());

                // Create an assetsREST.getModifiedItems stub that returns a promise for the modified remote asset names.
                const stub = sinon.stub(assetsREST, "getModifiedItems");
                stub.resolves([assetMetadata1, assetMetadata2, assetMetadata3, assetMetadata4]);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsHelper.listModifiedRemoteItemNames(context, [assetsHelper.MODIFIED], {filterDraft: true})
                    .then(function (names) {
                        // Verify that the helper returned the expected values.
                        expect(names).to.have.lengthOf(2);
                        expect(names[0].path).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_1_DRAFT);
                        expect(names[1].path).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_2_DRAFT);

                        // Verify that the stub was called once.
                        expect(stub).to.have.been.calledOnce;
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

            it("should succeed when getting a list of modified remote assets by path succeeds.", function (done) {
                // List of multiple remote asset names.
                const assetMetadataPath1 = AssetsUnitTest.VALID_CONTENT_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_1;
                const assetMetadataPath2 = AssetsUnitTest.VALID_CONTENT_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_1_DRAFT;
                const assetMetadataPath3 = AssetsUnitTest.VALID_CONTENT_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_2;
                const assetMetadataPath4 = AssetsUnitTest.VALID_CONTENT_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CONTENT_JPG_2_DRAFT;
                const assetMetadata1 = UnitTest.getJsonObject(assetMetadataPath1 + assetsFS.getExtension());
                assetMetadata1.path = "/foo/bar1.json";
                const assetMetadata2 = UnitTest.getJsonObject(assetMetadataPath2 + assetsFS.getExtension());
                assetMetadata2.path = "/bar/foo1.json";
                const assetMetadata3 = UnitTest.getJsonObject(assetMetadataPath3 + assetsFS.getExtension());
                assetMetadata3.path = "/foo/bar2.json";
                const assetMetadata4 = UnitTest.getJsonObject(assetMetadataPath4 + assetsFS.getExtension());
                assetMetadata4.path = "/bar/foo2.json";

                // Create an assetsREST.getModifiedItems stub that returns a promise for the modified remote asset names.
                const stub = sinon.stub(searchREST, "search");
                stub.resolves({documents: [{document: JSON.stringify(assetMetadata1)}, {document: JSON.stringify(assetMetadata2)}, {document: JSON.stringify(assetMetadata3)}, {document: JSON.stringify(assetMetadata4)}]});

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsHelper.listModifiedRemoteItemNames(context, [assetsHelper.MODIFIED], {filterPath: "foo"})
                    .then(function (names) {
                        // Verify that the helper returned the expected values.
                        expect(names).to.have.lengthOf(2);
                        expect(names[0].path).to.contain("/foo/");
                        expect(names[1].path).to.contain("/foo/");

                        // Verify that the stub was called once.
                        expect(stub).to.have.been.calledOnce;
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

            it("should succeed when getting a list of modified and deleted remote assets succeeds.", function (done) {
                // List of multiple remote asset names.
                const assetMetadataPath1 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_HTML_1;
                const assetMetadataPath2 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_GIF_1;
                const assetMetadataPath3 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_PNG_1;
                const assetMetadata1 = UnitTest.getJsonObject(assetMetadataPath1);
                const assetMetadata2 = UnitTest.getJsonObject(assetMetadataPath2);
                const assetMetadata3 = UnitTest.getJsonObject(assetMetadataPath3);

                // Create an assetsREST.getModifiedItems stub that returns a promise for the modified remote asset names.
                const stubModified = sinon.stub(assetsREST, "getModifiedItems");
                stubModified.resolves([assetMetadata1, assetMetadata2, assetMetadata3]);

                // Create an assetsHelper.listRemoteDeletedNames stub that returns a promise for the deleted remote asset names.
                const stubDeleted = sinon.stub(assetsHelper, "listRemoteDeletedNames");
                stubDeleted.resolves([{id: undefined, path: AssetsUnitTest.ASSET_CSS_1}, {id: undefined, path: AssetsUnitTest.ASSET_JAR_1}]);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubModified);
                self.addTestDouble(stubDeleted);

                // Call the method being tested.
                let error;
                assetsHelper.listModifiedRemoteItemNames(context, [assetsHelper.MODIFIED, assetsHelper.DELETED], UnitTest.DUMMY_OPTIONS)
                    .then(function (names) {
                        // Verify that the helper returned the expected values.
                        expect(names).to.have.lengthOf(5);
                        expect(names[0].path).to.contain(AssetsUnitTest.ASSET_HTML_1);
                        expect(names[1].path).to.contain(AssetsUnitTest.ASSET_GIF_1);
                        expect(names[2].path).to.contain(AssetsUnitTest.ASSET_PNG_1);
                        expect(names[3].path).to.contain(AssetsUnitTest.ASSET_CSS_1);
                        expect(names[4].path).to.contain(AssetsUnitTest.ASSET_JAR_1);

                        // Verify that the modified stub was called once.
                        expect(stubModified).to.have.been.calledOnce;

                        // Verify that the deleted stub was called once.
                        expect(stubDeleted).to.have.been.calledOnce;
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

    testListLocalAssetNames () {
        const self = this;
        describe("listLocalItemNames", function () {
            it("should fail when getting asset names fails.", function (done) {
                // Create an assetsFS.listNames stub that returns an error.
                const ASSET_ERROR = "There was an error getting the local assets.";
                const stub = sinon.stub(assetsFS, "listNames");
                stub.rejects(ASSET_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsHelper.listLocalItemNames(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (/*assets*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the local assets should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once.
                            expect(stub).to.be.calledOnce;

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.contain(ASSET_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when getting a list of local asset names.", function (done) {
                // List of multiple local asset names.
                const assetNames = [
                    AssetsUnitTest.ASSET_HTML_1,
                    AssetsUnitTest.ASSET_HTML_2,
                    AssetsUnitTest.ASSET_HTML_3,
                    AssetsUnitTest.ASSET_CSS_1,
                    AssetsUnitTest.ASSET_CSS_2,
                    AssetsUnitTest.ASSET_JPG_1,
                    AssetsUnitTest.ASSET_JPG_2,
                    AssetsUnitTest.ASSET_JPG_3,
                    AssetsUnitTest.ASSET_PNG_1,
                    AssetsUnitTest.ASSET_PNG_2,
                    AssetsUnitTest.ASSET_PNG_3,
                    AssetsUnitTest.ASSET_GIF_1,
                    AssetsUnitTest.ASSET_HBS_1,
                    AssetsUnitTest.ASSET_HBS_2,
                    AssetsUnitTest.ASSET_JAR_1
                ];

                // Create an assetsFS.listNames stub that returns a promise for the local asset names.
                const stub = sinon.stub(assetsFS, "listNames");
                stub.resolves(assetNames);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsHelper.listLocalItemNames(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (names) {
                        // Verify that the helper returned the expected value.
                        expect(UnitTest.stringArraysEqual(assetNames, names)).to.equal(true);

                        // Verify that the stub was called once.
                        expect(stub).to.have.been.calledOnce;
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

    testListLocalModifiedAssetNames () {
        const self = this;
        describe("listModifiedLocalItemNames", function () {
            it("should fail when getting asset names fails.", function (done) {
                // Create an assetsFS.listNames stub that returns an error.
                const ASSET_ERROR = "There was an error getting the local assets.";
                const stub = sinon.stub(assetsFS, "listNames");
                stub.rejects(ASSET_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsHelper.listModifiedLocalItemNames(context, [assetsHelper.NEW, assetsHelper.MODIFIED], UnitTest.DUMMY_OPTIONS)
                    .then(function (/*assets*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the local assets should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once.
                            expect(stub).to.be.calledOnce;

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.contain(ASSET_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when getting a list of modified local asset names.", function (done) {
                // List of multiple local asset names.
                const assetNames = [
                    {id: undefined, path: AssetsUnitTest.ASSET_HTML_1},
                    {id: undefined, path: AssetsUnitTest.ASSET_HTML_2},
                    {id: undefined, path: AssetsUnitTest.ASSET_HTML_3},
                    {id: undefined, path: AssetsUnitTest.ASSET_CSS_1},
                    {id: undefined, path: AssetsUnitTest.ASSET_CSS_2},
                    {id: undefined, path: AssetsUnitTest.ASSET_HBS_1},
                    {id: undefined, path: AssetsUnitTest.ASSET_HBS_2}
                ];

                // Create an assetsFS.listNames stub that returns a promise for the local asset names.
                const stubNames = sinon.stub(assetsFS, "listNames");
                stubNames.resolves(assetNames);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubNames);

                // Call the method being tested.
                let error;
                assetsHelper.listModifiedLocalItemNames(context, [assetsHelper.NEW, assetsHelper.MODIFIED], UnitTest.DUMMY_OPTIONS)
                    .then(function (names) {
                        // Verify that the helper returned the expected value.
                        expect(names).to.have.lengthOf(7);
                        expect(names[0]).to.be.oneOf(assetNames);
                        expect(names[1]).to.be.oneOf(assetNames);
                        expect(names[2]).to.be.oneOf(assetNames);
                        expect(names[3]).to.be.oneOf(assetNames);
                        expect(names[4]).to.be.oneOf(assetNames);
                        expect(names[5]).to.be.oneOf(assetNames);
                        expect(names[6]).to.be.oneOf(assetNames);

                        // Verify that the names stub was called once.
                        expect(stubNames).to.have.been.calledOnce;
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

            it("should succeed when getting a list of modified local ready asset names.", function (done) {
                // List of multiple local asset names.
                const assetNames = [
                    {status: "ready", path: AssetsUnitTest.ASSET_CONTENT_JPG_1},
                    {status: "draft", path: AssetsUnitTest.ASSET_CONTENT_JPG_1_DRAFT},
                    {status: "ready", path: AssetsUnitTest.ASSET_CONTENT_JPG_2},
                    {status: "draft", path: AssetsUnitTest.ASSET_CONTENT_JPG_2_DRAFT}
                ];

                // Create an assetsFS.listNames stub that returns a promise for the local asset names.
                const stubNames = sinon.stub(assetsFS, "listNames");
                stubNames.resolves(assetNames);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubNames);

                // Call the method being tested.
                let error;
                assetsHelper.listModifiedLocalItemNames(context, [assetsHelper.NEW, assetsHelper.MODIFIED], {filterReady: true})
                    .then(function (names) {
                        // Verify that the helper returned the expected value.
                        expect(names).to.have.lengthOf(2);
                        expect(names[0].path).to.be.oneOf([AssetsUnitTest.ASSET_CONTENT_JPG_1, AssetsUnitTest.ASSET_CONTENT_JPG_2]);
                        expect(names[1].path).to.be.oneOf([AssetsUnitTest.ASSET_CONTENT_JPG_1, AssetsUnitTest.ASSET_CONTENT_JPG_2]);

                        // Verify that the names stub was called once.
                        expect(stubNames).to.have.been.calledOnce;
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

            it("should succeed when getting a list of modified local draft asset names.", function (done) {
                // List of multiple local asset names.
                const assetNames = [
                    {status: "ready", path: AssetsUnitTest.ASSET_CONTENT_JPG_1},
                    {status: "draft", path: AssetsUnitTest.ASSET_CONTENT_JPG_1_DRAFT},
                    {status: "ready", path: AssetsUnitTest.ASSET_CONTENT_JPG_2},
                    {status: "draft", path: AssetsUnitTest.ASSET_CONTENT_JPG_2_DRAFT}
                ];

                // Create an assetsFS.listNames stub that returns a promise for the local asset names.
                const stubNames = sinon.stub(assetsFS, "listNames");
                stubNames.resolves(assetNames);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubNames);

                // Call the method being tested.
                let error;
                assetsHelper.listModifiedLocalItemNames(context, [assetsHelper.NEW, assetsHelper.MODIFIED], {filterDraft: true})
                    .then(function (names) {
                        // Verify that the helper returned the expected value.
                        expect(names).to.have.lengthOf(2);
                        expect(names[0].path).to.be.oneOf([AssetsUnitTest.ASSET_CONTENT_JPG_1_DRAFT, AssetsUnitTest.ASSET_CONTENT_JPG_2_DRAFT]);
                        expect(names[1].path).to.be.oneOf([AssetsUnitTest.ASSET_CONTENT_JPG_1_DRAFT, AssetsUnitTest.ASSET_CONTENT_JPG_2_DRAFT]);

                        // Verify that the names stub was called once.
                        expect(stubNames).to.have.been.calledOnce;
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

            it("should succeed when getting a list of modified and deleted local asset names.", function (done) {
                // List of multiple local asset names.
                const assetNames = [
                    {id: undefined, path: AssetsUnitTest.ASSET_HTML_1},
                    {id: undefined, path: AssetsUnitTest.ASSET_HTML_2},
                    {id: undefined, path: AssetsUnitTest.ASSET_HTML_3},
                    {id: undefined, path: AssetsUnitTest.ASSET_CSS_1},
                    {id: undefined, path: AssetsUnitTest.ASSET_CSS_2},
                    {id: undefined, path: AssetsUnitTest.ASSET_HBS_1},
                    {id: undefined, path: AssetsUnitTest.ASSET_HBS_2}
                ];

                // Create an assetsFS.listNames stub that returns a promise for the local asset names.
                const stubNames = sinon.stub(assetsFS, "listNames");
                stubNames.resolves(assetNames);

                // Create an assetsHelper.listLocalDeletedNames stub that returns a promise for the deleted remote asset names.
                const stubDeleted = sinon.stub(assetsHelper, "listLocalDeletedNames");
                stubDeleted.resolves([AssetsUnitTest.ASSET_JPG_1, AssetsUnitTest.ASSET_GIF_1]);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubNames);
                self.addTestDouble(stubDeleted);

                // Call the method being tested.
                let error;
                assetsHelper.listModifiedLocalItemNames(context, [assetsHelper.MODIFIED, assetsHelper.DELETED], UnitTest.DUMMY_OPTIONS)
                    .then(function (names) {
                        // Verify that the helper returned the expected value.
                        expect(names).to.have.lengthOf(9);
                        expect(names[0]).to.be.oneOf(assetNames);
                        expect(names[1]).to.be.oneOf(assetNames);
                        expect(names[2]).to.be.oneOf(assetNames);
                        expect(names[3]).to.be.oneOf(assetNames);
                        expect(names[4]).to.be.oneOf(assetNames);
                        expect(names[5]).to.be.oneOf(assetNames);
                        expect(names[6]).to.be.oneOf(assetNames);
                        expect(names[7]).to.be.oneOf([AssetsUnitTest.ASSET_JPG_1, AssetsUnitTest.ASSET_GIF_1]);
                        expect(names[8]).to.be.oneOf([AssetsUnitTest.ASSET_JPG_1, AssetsUnitTest.ASSET_GIF_1]);

                        // Verify that the names stub was called once.
                        expect(stubNames).to.have.been.calledOnce;

                        // Verify that the deleted stub was called once.
                        expect(stubDeleted).to.have.been.calledOnce;
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

    testListDeletedLocalAssetNames () {
        const self = this;
        describe("listLocalDeletedNames", function () {
            it("should succeed when getting a list of deleted local asset names.", function (done) {
                // List of multiple local asset names.
                const assetNames = [
                    {id: undefined, path: AssetsUnitTest.ASSET_HTML_1},
                    {id: undefined, path: AssetsUnitTest.ASSET_HTML_2},
                    {id: undefined, path: AssetsUnitTest.ASSET_HTML_3},
                    {id: undefined, path: AssetsUnitTest.ASSET_CSS_1},
                    {id: undefined, path: AssetsUnitTest.ASSET_CSS_2},
                    {id: undefined, path: AssetsUnitTest.ASSET_HBS_1},
                    {id: undefined, path: AssetsUnitTest.ASSET_HBS_2}
                ];

                // Create a non-default stub for hashes.listFiles that returns the local asset paths.
                stubListFiles.restore();
                stubListFiles = sinon.stub(hashes, "listFiles");
                stubListFiles.returns(assetNames);

                // Create an fs.stats stub that returns a value for some assets, and no value for others.
                const stubStats = sinon.stub(fs, "statSync");
                const dir = assetsFS.getDir(context);
                stubStats.withArgs(dir + AssetsUnitTest.ASSET_HTML_1).returns({size: 100});
                stubStats.withArgs(dir + AssetsUnitTest.ASSET_HTML_2).returns(null);
                stubStats.withArgs(dir + AssetsUnitTest.ASSET_HTML_3).returns(null);
                stubStats.withArgs(dir + AssetsUnitTest.ASSET_CSS_1).returns({size: 100});
                stubStats.withArgs(dir + AssetsUnitTest.ASSET_CSS_2).returns(null);
                stubStats.withArgs(dir + AssetsUnitTest.ASSET_HBS_1).returns({size: 100});
                stubStats.withArgs(dir + AssetsUnitTest.ASSET_HBS_2).returns(null);

                // The stats stub should be restored when the test is complete. (The list files stub is restored by the afterEach function.)
                self.addTestDouble(stubStats);

                // Call the method being tested.
                let error;
                assetsHelper.listLocalDeletedNames(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (names) {
                        // Verify that the helper returned the expected value.
                        expect(names).to.have.lengthOf(4);
                        expect(names[0].path).to.be.oneOf([AssetsUnitTest.ASSET_HTML_2, AssetsUnitTest.ASSET_HTML_3, AssetsUnitTest.ASSET_CSS_2, AssetsUnitTest.ASSET_HBS_2]);
                        expect(names[1].path).to.be.oneOf([AssetsUnitTest.ASSET_HTML_2, AssetsUnitTest.ASSET_HTML_3, AssetsUnitTest.ASSET_CSS_2, AssetsUnitTest.ASSET_HBS_2]);
                        expect(names[2].path).to.be.oneOf([AssetsUnitTest.ASSET_HTML_2, AssetsUnitTest.ASSET_HTML_3, AssetsUnitTest.ASSET_CSS_2, AssetsUnitTest.ASSET_HBS_2]);
                        expect(names[3].path).to.be.oneOf([AssetsUnitTest.ASSET_HTML_2, AssetsUnitTest.ASSET_HTML_3, AssetsUnitTest.ASSET_CSS_2, AssetsUnitTest.ASSET_HBS_2]);

                        // Verify that the list files stub was called once.
                        expect(stubListFiles).to.have.been.calledOnce;

                        // Verify that the stats stub was called once.
                        expect(stubStats).to.have.callCount(7);
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

            it("should succeed when getting a list of deleted local ready asset names.", function (done) {
                // List of multiple local asset names.
                const assetNames = [
                    {id: "foo", path: AssetsUnitTest.ASSET_HTML_1},
                    {id: "foo:draft", path: AssetsUnitTest.ASSET_HTML_2},
                    {id: "bar", path: AssetsUnitTest.ASSET_HTML_3},
                    {id: "ack", path: AssetsUnitTest.ASSET_CSS_1},
                    {id: "ack:draft", path: AssetsUnitTest.ASSET_CSS_2},
                    {id: "nack:draft", path: AssetsUnitTest.ASSET_HBS_1},
                    {id: "nack", path: AssetsUnitTest.ASSET_HBS_2}
                ];

                // Create a non-default stub for hashes.listFiles that returns the local asset paths.
                stubListFiles.restore();
                stubListFiles = sinon.stub(hashes, "listFiles");
                stubListFiles.returns(assetNames);

                // Create an fs.stats stub that returns a value for some assets, and no value for others.
                const stubStats = sinon.stub(fs, "statSync");
                const dir = assetsFS.getDir(context);
                stubStats.withArgs(dir + AssetsUnitTest.ASSET_HTML_1).returns({size: 100});
                stubStats.withArgs(dir + AssetsUnitTest.ASSET_HTML_2).returns(null);
                stubStats.withArgs(dir + AssetsUnitTest.ASSET_HTML_3).returns(null);
                stubStats.withArgs(dir + AssetsUnitTest.ASSET_CSS_1).returns({size: 100});
                stubStats.withArgs(dir + AssetsUnitTest.ASSET_CSS_2).returns(null);
                stubStats.withArgs(dir + AssetsUnitTest.ASSET_HBS_1).returns({size: 100});
                stubStats.withArgs(dir + AssetsUnitTest.ASSET_HBS_2).returns(null);

                // The stats stub should be restored when the test is complete. (The list files stub is restored by the afterEach function.)
                self.addTestDouble(stubStats);

                // Call the method being tested.
                let error;
                assetsHelper.listLocalDeletedNames(context, {filterReady: true})
                    .then(function (names) {
                        // Verify that the helper returned only the deleted ready items.
                        expect(names).to.have.lengthOf(2);
                        expect(names[0].path).to.be.oneOf([AssetsUnitTest.ASSET_HTML_3, AssetsUnitTest.ASSET_HBS_2]);
                        expect(names[1].path).to.be.oneOf([AssetsUnitTest.ASSET_HTML_3, AssetsUnitTest.ASSET_HBS_2]);

                        // Verify that the list files stub was called once.
                        expect(stubListFiles).to.have.been.calledOnce;

                        // Verify that the stats stub was called once.
                        expect(stubStats).to.have.callCount(7);
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

            it("should succeed when getting a list of deleted local draft asset names.", function (done) {
                // List of multiple local asset names.
                const assetNames = [
                    {id: "foo", path: AssetsUnitTest.ASSET_HTML_1},
                    {id: "foo:draft", path: AssetsUnitTest.ASSET_HTML_2},
                    {id: "bar", path: AssetsUnitTest.ASSET_HTML_3},
                    {id: "ack", path: AssetsUnitTest.ASSET_CSS_1},
                    {id: "ack:draft", path: AssetsUnitTest.ASSET_CSS_2},
                    {id: "nack:draft", path: AssetsUnitTest.ASSET_HBS_1},
                    {id: "nack", path: AssetsUnitTest.ASSET_HBS_2}
                ];

                // Create a non-default stub for hashes.listFiles that returns the local asset paths.
                stubListFiles.restore();
                stubListFiles = sinon.stub(hashes, "listFiles");
                stubListFiles.returns(assetNames);

                // Create an fs.stats stub that returns a value for some assets, and no value for others.
                const stubStats = sinon.stub(fs, "statSync");
                const dir = assetsFS.getDir(context);
                stubStats.withArgs(dir + AssetsUnitTest.ASSET_HTML_1).returns({size: 100});
                stubStats.withArgs(dir + AssetsUnitTest.ASSET_HTML_2).returns(null);
                stubStats.withArgs(dir + AssetsUnitTest.ASSET_HTML_3).returns(null);
                stubStats.withArgs(dir + AssetsUnitTest.ASSET_CSS_1).returns({size: 100});
                stubStats.withArgs(dir + AssetsUnitTest.ASSET_CSS_2).returns(null);
                stubStats.withArgs(dir + AssetsUnitTest.ASSET_HBS_1).returns({size: 100});
                stubStats.withArgs(dir + AssetsUnitTest.ASSET_HBS_2).returns(null);

                // The stats stub should be restored when the test is complete. (The list files stub is restored by the afterEach function.)
                self.addTestDouble(stubStats);

                // Call the method being tested.
                let error;
                assetsHelper.listLocalDeletedNames(context, {filterDraft: true})
                    .then(function (names) {
                        // Verify that the helper returned only the deleted ready items.
                        expect(names).to.have.lengthOf(2);
                        expect(names[0].path).to.be.oneOf([AssetsUnitTest.ASSET_HTML_2, AssetsUnitTest.ASSET_CSS_2]);
                        expect(names[1].path).to.be.oneOf([AssetsUnitTest.ASSET_HTML_2, AssetsUnitTest.ASSET_CSS_2]);

                        // Verify that the list files stub was called once.
                        expect(stubListFiles).to.have.been.calledOnce;

                        // Verify that the stats stub was called once.
                        expect(stubStats).to.have.callCount(7);
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

    testDeleteLocalItem () {
        const self = this;
        describe("deleteLocalItem", function () {
            it("should succeed when deleting a non-existent local item.", function (done) {
                // Create an fsApi.deleteAsset stub that returns no filepath, indicating that the file did not exist.
                const stubDelete = sinon.stub(assetsFS, "deleteAsset");
                stubDelete.resolves(undefined);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubDelete);

                // Call the method being tested.
                let error;
                assetsHelper.deleteLocalItem(context, UnitTest.DUMMY_METADATA, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // Verify that the stub was called once with the expected value.
                        expect(stubDelete).to.have.been.calledOnce;
                        expect(stubDelete.firstCall.args[1]).to.equal(UnitTest.DUMMY_METADATA.path);
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

            it("should succeed when deleting an existing local web asset.", function (done) {
                // Create an assetsFS.deleteAsset stub that returns a filepath, indicating that the file exists.
                const stubDelete = sinon.stub(assetsFS, "deleteAsset");
                stubDelete.resolves(UnitTest.DUMMY_PATH);

                // Create a stub for assetsFS.isContentResource that returns false.
                const stubIsContentResource = sinon.stub(assetsFS, "isContentResource");
                stubIsContentResource.returns(false);

                // Create a hashes.removeHashes stub
                const stubHashes = sinon.stub(hashes, "removeHashesByPath");

                // Create an utils.removeEmptyParentDirectories stub
                const stubUtils = sinon.stub(utils, "removeEmptyParentDirectories");

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubDelete);
                self.addTestDouble(stubIsContentResource);
                self.addTestDouble(stubHashes);
                self.addTestDouble(stubUtils);

                // Call the method being tested.
                let error;
                assetsHelper.deleteLocalItem(context, UnitTest.DUMMY_METADATA, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // Verify that the stubs were called once and that the helper returned the expected value.
                        expect(stubDelete).to.have.been.calledOnce;
                        expect(stubHashes).to.have.been.calledOnce;
                        expect(stubUtils).to.have.been.calledOnce;
                        expect(stubDelete.firstCall.args[1]).to.equal(UnitTest.DUMMY_METADATA.path);
                        expect(stubHashes.firstCall.args[2]).to.equal(UnitTest.DUMMY_METADATA.path);
                        expect(stubUtils.firstCall.args[1]).to.equal(UnitTest.DUMMY_PATH);
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

            it("should succeed when deleting an existing local content asset.", function (done) {
                // Create an assetsFS.deleteAsset stub that returns a filepath, indicating that the file exists.
                const stubDelete = sinon.stub(assetsFS, "deleteAsset");
                stubDelete.resolves(UnitTest.DUMMY_PATH);

                // Create a stub for assetsFS.isContentResource that returns true.
                const stubIsContentResource = sinon.stub(assetsFS, "isContentResource");
                stubIsContentResource.returns(true);

                // Create an assetsFS.deleteMetadata stub that returns a filepath, indicating that the file exists.
                const stubMetadata = sinon.stub(assetsFS, "deleteMetadata");
                stubMetadata.resolves(UnitTest.DUMMY_PATH);

                // Create a hashes.removeHashes stub
                const stubHashes = sinon.stub(hashes, "removeHashesByPath");

                // Create an utils.removeEmptyParentDirectories stub
                const stubUtils = sinon.stub(utils, "removeEmptyParentDirectories");

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubDelete);
                self.addTestDouble(stubIsContentResource);
                self.addTestDouble(stubMetadata);
                self.addTestDouble(stubHashes);
                self.addTestDouble(stubUtils);

                // Call the method being tested.
                let error;
                assetsHelper.deleteLocalItem(context, UnitTest.DUMMY_METADATA, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // Verify that the stubs were called once and that the helper returned the expected value.
                        expect(stubDelete).to.have.been.calledOnce;
                        expect(stubMetadata).to.have.been.calledOnce;
                        expect(stubHashes).to.have.been.calledOnce;
                        expect(stubUtils).to.have.been.calledOnce;
                        expect(stubDelete.firstCall.args[1]).to.equal(UnitTest.DUMMY_METADATA.path);
                        expect(stubMetadata.firstCall.args[1]).to.equal(UnitTest.DUMMY_METADATA.path);
                        expect(stubHashes.firstCall.args[2]).to.equal(UnitTest.DUMMY_METADATA.path);
                        expect(stubUtils.firstCall.args[1]).to.equal(UnitTest.DUMMY_PATH);
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

    testDeleteLocalResource () {
        const self = this;
        describe("deleteLocalResource", function () {
            it("should succeed when deleting a non-existent local resource.", function (done) {
                // Create an fsApi.deleteResource stub that returns no filepath, indicating that the file did not exist.
                const stubDelete = sinon.stub(assetsFS, "deleteResource");
                stubDelete.resolves(undefined);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubDelete);

                // Call the method being tested.
                let error;
                assetsHelper.deleteLocalResource(context, UnitTest.DUMMY_METADATA, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // Verify that the stub was called once with the expected value.
                        expect(stubDelete).to.have.been.calledOnce;
                        expect(stubDelete.firstCall.args[1]).to.equal(UnitTest.DUMMY_METADATA.path);
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

            it("should succeed when deleting an existing local resource.", function (done) {
                // Create an assetsFS.deleteResource stub that returns a filepath, indicating that the file exists.
                const stubDelete = sinon.stub(assetsFS, "deleteResource");
                stubDelete.resolves(UnitTest.DUMMY_PATH);

                // Create a hashes.removeHashes stub
                const stubHashes = sinon.stub(hashes, "removeHashesByPath");

                // Create an utils.removeEmptyParentDirectories stub
                const stubUtils = sinon.stub(utils, "removeEmptyParentDirectories");

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubDelete);
                self.addTestDouble(stubHashes);
                self.addTestDouble(stubUtils);

                // Call the method being tested.
                let error;
                assetsHelper.deleteLocalResource(context, UnitTest.DUMMY_METADATA, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // Verify that the stubs were called once and that the helper returned the expected value.
                        expect(stubDelete).to.have.been.calledOnce;
                        expect(stubHashes).to.have.been.calledOnce;
                        expect(stubUtils).to.have.been.calledOnce;
                        expect(stubDelete.firstCall.args[1]).to.equal(UnitTest.DUMMY_METADATA.path);
                        expect(stubHashes.firstCall.args[2]).to.equal(UnitTest.DUMMY_METADATA.path);
                        expect(stubUtils.firstCall.args[1]).to.equal(UnitTest.DUMMY_PATH);
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

    testCanDeleteItem () {
        const self = this;

        describe("canDeleteItem", function () {
            it("should return false when the item is not valid.", function (done) {
                // Call the method being tested.
                let error;
                try {
                    const canDelete = assetsHelper.canDeleteItem("Invalid object", false, UnitTest.DUMMY_OPTIONS);
                    expect(canDelete).to.equal(false);
                } catch (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                } finally {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
            });

            it("should return true when the item is valid.", function (done) {
                // Call the method being tested.
                let error;
                try {
                    const canDelete = assetsHelper.canDeleteItem({"object": "valid"}, false, UnitTest.DUMMY_OPTIONS);
                    expect(canDelete).to.equal(true);
                } catch (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                } finally {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
            });

            it("should return false when deleting all web assets but the item is a content asset.", function (done) {
                // Create a stub for assetsFS.isContentResource that returns true.
                const stubIsContentResource = sinon.stub(assetsFS, "isContentResource");
                stubIsContentResource.returns(true);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubIsContentResource);

                // Call the method being tested.
                let error;
                try {
                    const opts = {assetTypes: assetsHelper.ASSET_TYPES_WEB_ASSETS};
                    const canDelete = assetsHelper.canDeleteItem(UnitTest.DUMMY_METADATA, true, opts);
                    expect(canDelete).to.equal(false);
                } catch (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                } finally {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
            });

            it("should return true when deleting all web assets and the item is a web asset.", function (done) {
                // Create a stub for assetsFS.isContentResource that returns false.
                const stubIsContentResource = sinon.stub(assetsFS, "isContentResource");
                stubIsContentResource.returns(false);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubIsContentResource);

                // Call the method being tested.
                let error;
                try {
                    const opts = {assetTypes: assetsHelper.ASSET_TYPES_WEB_ASSETS};
                    const canDelete = assetsHelper.canDeleteItem(UnitTest.DUMMY_METADATA, true, opts);
                    expect(canDelete).to.equal(true);
                } catch (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                } finally {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
            });

            it("should return false when deleting all content assets but the item is a web asset.", function (done) {
                // Create a stub for assetsFS.isContentResource that returns false.
                const stubIsContentResource = sinon.stub(assetsFS, "isContentResource");
                stubIsContentResource.returns(false);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubIsContentResource);

                // Call the method being tested.
                let error;
                try {
                    const opts = {assetTypes: assetsHelper.ASSET_TYPES_CONTENT_ASSETS};
                    const canDelete = assetsHelper.canDeleteItem(UnitTest.DUMMY_METADATA, true, opts);
                    expect(canDelete).to.equal(false);
                } catch (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                } finally {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
            });

            it("should return true when deleting all content assets and the item is a content asset.", function (done) {
                // Create a stub for assetsFS.isContentResource that returns true.
                const stubIsContentResource = sinon.stub(assetsFS, "isContentResource");
                stubIsContentResource.returns(true);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubIsContentResource);

                // Call the method being tested.
                let error;
                try {
                    const opts = {assetTypes: assetsHelper.ASSET_TYPES_CONTENT_ASSETS};
                    const canDelete = assetsHelper.canDeleteItem(UnitTest.DUMMY_METADATA, true, opts);
                    expect(canDelete).to.equal(true);
                } catch (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                } finally {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
            });

            it("should return true when deleting all assets and the item is a content asset.", function (done) {
                // Create a stub for assetsFS.isContentResource that returns true.
                const stubIsContentResource = sinon.stub(assetsFS, "isContentResource");
                stubIsContentResource.returns(true);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubIsContentResource);

                // Call the method being tested.
                let error;
                try {
                    const opts = {assetTypes: assetsHelper.ASSET_TYPES_BOTH};
                    const canDelete = assetsHelper.canDeleteItem(UnitTest.DUMMY_METADATA, true, opts);
                    expect(canDelete).to.equal(true);
                } catch (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                } finally {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
            });
        });
    }

    testfilterRetry () {
        describe("filterRetryPush", function () {
            it("should pass specific tests.", function (done) {
                // Call the method being tested.
                let error;
                try {
                    // Shouldn't retry if the error has no response status code.
                    const RETRY_ERROR = "Generic error used by unit test.";
                    let error = new Error(RETRY_ERROR);
                    let result = assetsHelper.filterRetryPush(context, error, UnitTest.DUMMY_OPTIONS);
                    expect(result).to.equal(false);

                    // Should retry if the error has a response status code of 403 (Forbidden), unless one of the errors
                    // has a code of 3193 (operation not allowed based on tenant tier).
                    error = new Error(RETRY_ERROR);
                    error.statusCode = 403;
                    result = assetsHelper.filterRetryPush(context, error, UnitTest.DUMMY_OPTIONS);
                    expect(result).to.equal(true);

                    error = new Error(RETRY_ERROR);
                    error.statusCode = 403;
                    error.response = {body: {errors: [{code: 3193}]}};
                    result = assetsHelper.filterRetryPush(context, error, UnitTest.DUMMY_OPTIONS);
                    expect(result).to.equal(false);

                    error = new Error(RETRY_ERROR);
                    error.statusCode = 403;
                    error.response = {body: {errors: [{code: 0}]}};
                    result = assetsHelper.filterRetryPush(context, error, UnitTest.DUMMY_OPTIONS);
                    expect(result).to.equal(true);

                    // Should retry if the error has a response status code of 429 (Too Many Requests).
                    error = new Error(RETRY_ERROR);
                    error.statusCode = 429;
                    result = assetsHelper.filterRetryPush(context, error, UnitTest.DUMMY_OPTIONS);
                    expect(result).to.equal(true);

                    // Should retry if the error has a response status code of 500 (Internal Server Error).
                    error = new Error(RETRY_ERROR);
                    error.statusCode = 500;
                    result = assetsHelper.filterRetryPush(context, error, UnitTest.DUMMY_OPTIONS);
                    expect(result).to.equal(true);

                    // Should retry if the error has a response status code of 502 (Bad Gateway).
                    error = new Error(RETRY_ERROR);
                    error.statusCode = 502;
                    result = assetsHelper.filterRetryPush(context, error, UnitTest.DUMMY_OPTIONS);
                    expect(result).to.equal(true);

                    // Should retry if the error has a response status code of 503 (Service Unavailable).
                    error = new Error(RETRY_ERROR);
                    error.statusCode = 503;
                    result = assetsHelper.filterRetryPush(context, error, UnitTest.DUMMY_OPTIONS);
                    expect(result).to.equal(true);

                    // Should retry if the error has a response status code of 504 (Gateway Timeout).
                    error = new Error(RETRY_ERROR);
                    error.statusCode = 504;
                    result = assetsHelper.filterRetryPush(context, error, UnitTest.DUMMY_OPTIONS);
                    expect(result).to.equal(true);

                    // Should not retry if the error has a response status code of 418 (I'm a Teapot), unless that error
                    // code has been specified for retry in the options.
                    error = new Error(RETRY_ERROR);
                    error.statusCode = 418;
                    result = assetsHelper.filterRetryPush(context, error, UnitTest.DUMMY_OPTIONS);
                    expect(result).to.equal(false);

                    error = new Error(RETRY_ERROR);
                    error.statusCode = 418;
                    result = assetsHelper.filterRetryPush(context, error, {retryStatusCodes: [418]});
                    expect(result).to.equal(true);

                    // Should retry on network error.
                    error = new Error(RETRY_ERROR);
                    error.statusCode = 500;
                    error.code = "ENOTFOUND";
                    result = assetsHelper.filterRetryPush(context, error);
                    expect(result).to.equal(true);
                } catch (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                } finally {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
            });
        });

        describe("filterRetryDelete", function () {
            it("should pass specific tests.", function (done) {
                // Call the method being tested.
                let error;
                try {
                    // Shouldn't retry if no error.
                    let result = assetsHelper.filterRetryDelete(context);
                    expect(result).to.equal(false);

                    // Shouldn't retry if the error has no response.
                    const RETRY_ERROR = "Generic error used by unit test.";
                    let error = new Error(RETRY_ERROR);
                    result = assetsHelper.filterRetryDelete(context, error);
                    expect(result).to.equal(false);

                    // Shouldn't retry if the error has no response status code.
                    error = new Error(RETRY_ERROR);
                    error.response = {};
                    result = assetsHelper.filterRetryDelete(context, error);
                    expect(result).to.equal(false);

                    // Shouldn't retry if the status code is 400, but no response body.
                    error = new Error(RETRY_ERROR);
                    error.response = {statusCode: 400};
                    result = assetsHelper.filterRetryDelete(context, error);
                    expect(result).to.equal(false);

                    // Shouldn't retry if the status code is 400, but the error has an unknown code.
                    error = new Error(RETRY_ERROR);
                    error.response = {statusCode: 400, body: {errors: [{code: 0}]}};
                    result = assetsHelper.filterRetryDelete(context, error);
                    expect(result).to.equal(false);

                    // Should retry if the status code is 400, and the error code is 3008.
                    error = new Error(RETRY_ERROR);
                    error.response = {statusCode: 400, body: {errors: [{code: 3008}]}};
                    result = assetsHelper.filterRetryDelete(context, error);
                    expect(result).to.equal(true);

                    // Should retry if the status code is 400, and the error code is 6000.
                    error = new Error(RETRY_ERROR);
                    error.response = {statusCode: 400, body: {errors: [{code: 6000}]}};
                    result = assetsHelper.filterRetryDelete(context, error);
                    expect(result).to.equal(true);
                } catch (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                } finally {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
            });
        });
    }

    testDeleteRemoteAsset () {
        const self = this;
        describe("deleteRemoteItem", function () {
            it("should fail when deleting the specified asset fails.", function (done) {
                // Create an assetsREST.deleteItem stub that returns an error.
                const ASSET_ERROR = "There was an error deleting the remote asset.";
                const stubDelete = sinon.stub(assetsREST, "deleteItem");
                stubDelete.rejects(ASSET_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubDelete);

                // Call the method being tested.
                let error;
                assetsHelper.deleteRemoteItem(context, UnitTest.DUMMY_METADATA, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the remote assets should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once.
                            expect(stubDelete).to.be.calledOnce;

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

            it("should succeed when deleting a remote asset.", function (done) {
                // Create an assetsREST.deleteItem stub that returns a promise for the response message.
                const DELETE_MESSAGE = "The asset was deleted.";
                const stubDelete = sinon.stub(assetsREST, "deleteItem");
                stubDelete.resolves(DELETE_MESSAGE);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubDelete);

                // Call the method being tested.
                let error;
                assetsHelper.deleteRemoteItem(context, UnitTest.DUMMY_METADATA, UnitTest.DUMMY_OPTIONS)
                    .then(function (item) {
                        // Verify that the helper returned the expected value.
                        expect(item.id).to.equal(UnitTest.DUMMY_METADATA.id);
                        expect(item.path).to.equal(UnitTest.DUMMY_METADATA.path);

                        // Verify that the delete stub was called once with the expected id.
                        expect(stubDelete).to.have.been.calledOnce;
                        expect(stubDelete.firstCall.args[1].id).to.equal(UnitTest.DUMMY_METADATA.id);
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

    testSearchRemoteAsset () {
        const self = this;
        describe("searchRemote", function () {
            it("should fail when the underlying search fails", function (done) {
                // Create a searchREST.search stub that returns an error.
                const SEARCH_ERROR = "There was an error performing the search, as expected by a unit test.";
                const stub = sinon.stub(searchREST, "search");
                stub.rejects(SEARCH_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                const searchPath = "test-path";
                const recursive = false;
                const searchOptions = undefined;
                const opts = undefined;
                assetsHelper.searchRemote(context, searchOptions, opts, searchPath, recursive)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the remote search results should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once.
                        expect(stub).to.have.been.calledOnce;
                        expect(err.message).to.equal(SEARCH_ERROR);
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

            it("should succeed when searching with no specified options", function (done) {
                // Create a searchREST.search stub that returns a promise.
                const stub = sinon.stub(searchREST, "search");
                stub.resolves({});

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                const searchPath = "test-path";
                const recursive = false;
                const searchOptions = undefined;
                const opts = undefined;
                assetsHelper.searchRemote(context, searchOptions, opts, searchPath, recursive)
                    .then(function (documents) {
                        // Verify that the helper returned the expected message.
                        expect(documents).to.have.lengthOf(0);

                        // Verify that the stub was called once.
                        expect(stub).to.have.been.calledOnce;
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

            it("should succeed when searching with no specified path", function (done) {
                // Create a searchREST.search stub that returns a promise.
                const stub = sinon.stub(searchREST, "search");
                stub.resolves({});

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                const searchPath = null;
                const recursive = false;
                const searchOptions = {};
                const opts = undefined;
                assetsHelper.searchRemote(context, searchOptions, opts, searchPath, recursive)
                    .then(function (documents) {
                        // Verify that the helper returned the expected message.
                        expect(documents).to.have.lengthOf(0);

                        // Verify that the stub was called once.
                        expect(stub).to.have.been.calledOnce;
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

            it("should succeed when searching with specified options", function (done) {
                // Create a searchREST.search stub that returns a promise.
                const stub = sinon.stub(searchREST, "search");
                stub.resolves({});

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                const searchPath = "/test-path";
                const recursive = false;
                const searchOptions = {q: "*:*", fl: "id", fq: "test"};
                const opts = {assetTypes: assetsHelper.ASSET_TYPES_WEB_ASSETS};
                assetsHelper.searchRemote(context, searchOptions, opts, searchPath, recursive )
                    .then(function (documents) {
                        // Verify that the helper returned the expected message.
                        expect(documents).to.have.lengthOf(0);

                        // Verify that the stub was called once.
                        expect(stub).to.have.been.calledOnce;
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

            it("should succeed when searching produces no results", function (done) {
                // Create a searchREST.search stub that returns a promise.
                const stub = sinon.stub(searchREST, "search");
                stub.resolves({"documents": [{document: "{\"id\": \"foo\", \"path\": \"/dxdam/bar\"}"}]});

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                const searchPath = "/test-path*";
                const recursive = false;
                const searchOptions = {q: "*:*", fl: ["path", "document"], fq: ["test"]};
                const opts = {assetTypes: assetsHelper.ASSET_TYPES_CONTENT_ASSETS};
                assetsHelper.searchRemote(context, searchOptions, opts, searchPath, recursive)
                    .then(function (documents) {
                        // Verify that the helper returned the expected message.
                        expect(documents).to.have.lengthOf(0);

                        // Verify that the stub was called once.
                        expect(stub).to.have.been.calledOnce;
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

            it("should succeed when searching produces a result without a wild card", function (done) {
                // Create a searchREST.search stub that returns a promise.
                const stub = sinon.stub(searchREST, "search");
                stub.resolves({"documents": [{document: "{\"id\": \"foo\", \"path\": \"/dxdam/test-path\"}"}]});

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                const searchPath = "/dxdam/test-path";
                const recursive = false;
                const searchOptions = {q: "*:*", fl: ["path", "document"], fq: ["test"]};
                const opts = {assetTypes: assetsHelper.ASSET_TYPES_CONTENT_ASSETS};
                assetsHelper.searchRemote(context, searchOptions, opts, searchPath, recursive)
                    .then(function (documents) {
                        // Verify that the helper returned the expected message.
                        expect(documents).to.have.lengthOf(1);

                        // Verify that the stub was called once.
                        expect(stub).to.have.been.calledOnce;
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

            it("should succeed when searching produces a subfolder result without a wild card", function (done) {
                // Create a searchREST.search stub that returns a promise.
                const stub = sinon.stub(searchREST, "search");
                stub.resolves({"documents": [{document: "{\"id\": \"foo\", \"path\": \"/dxdam/test-path/bar\"}"}]});

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                const searchPath = "/dxdam/test-path";
                const recursive = false;
                const searchOptions = {q: "*:*", fl: ["path", "document"], fq: ["test"]};
                const opts = {assetTypes: assetsHelper.ASSET_TYPES_CONTENT_ASSETS};
                assetsHelper.searchRemote(context, searchOptions, opts, searchPath, recursive)
                    .then(function (documents) {
                        // Verify that the helper returned the expected message.
                        expect(documents).to.have.lengthOf(1);

                        // Verify that the stub was called once.
                        expect(stub).to.have.been.calledOnce;
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

            it("should succeed when searching produces a result with a wild card", function (done) {
                // Create a searchREST.search stub that returns a promise.
                const stub = sinon.stub(searchREST, "search");
                stub.resolves({"documents": [{document: "{\"id\": \"foo\", \"path\": \"/dxdam/test-path\"}"}]});

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                const searchPath = "/dxdam/test*";
                const recursive = false;
                const searchOptions = {q: "*:*", fl: ["path", "document"], fq: ["test"]};
                const opts = {assetTypes: assetsHelper.ASSET_TYPES_CONTENT_ASSETS};
                assetsHelper.searchRemote(context, searchOptions, opts, searchPath, recursive)
                    .then(function (documents) {
                        // Verify that the helper returned the expected message.
                        expect(documents).to.have.lengthOf(1);

                        // Verify that the stub was called once.
                        expect(stub).to.have.been.calledOnce;
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

            it("should succeed when searching produces a subfolder result with a wild card", function (done) {
                // Create a searchREST.search stub that returns a promise.
                const stub = sinon.stub(searchREST, "search");
                stub.resolves({"documents": [{document: "{\"id\": \"foo\", \"path\": \"/dxdam/test-path/bar\"}"}]});

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                const searchPath = "/dxdam/test-path*";
                const recursive = false;
                const searchOptions = {q: "*:*", fl: ["path", "document"], fq: ["test"]};
                const opts = {assetTypes: assetsHelper.ASSET_TYPES_CONTENT_ASSETS};
                assetsHelper.searchRemote(context, searchOptions, opts, searchPath, recursive)
                    .then(function (documents) {
                        // Verify that the helper returned the expected message.
                        expect(documents).to.have.lengthOf(1);

                        // Verify that the stub was called once.
                        expect(stub).to.have.been.calledOnce;
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

            it("should succeed when recursive searching produces a result without a wild card", function (done) {
                // Create a searchREST.search stub that returns a promise.
                const stub = sinon.stub(searchREST, "search");
                stub.resolves({"documents": [{document: "{\"id\": \"foo\", \"path\": \"/dxdam/test-path\"}"}]});

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                const searchPath = "/dxdam/test-path";
                const recursive = true;
                const searchOptions = {q: "*:*", fl: ["path", "document"], fq: ["test"]};
                const opts = {assetTypes: assetsHelper.ASSET_TYPES_CONTENT_ASSETS};
                assetsHelper.searchRemote(context, searchOptions, opts, searchPath, recursive)
                    .then(function (documents) {
                        // Verify that the helper returned the expected message.
                        expect(documents).to.have.lengthOf(1);

                        // Verify that the stub was called once.
                        expect(stub).to.have.been.calledOnce;
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

            it("should succeed when recursive searching produces a result with a wild card", function (done) {
                // Create a searchREST.search stub that returns a promise.
                const stub = sinon.stub(searchREST, "search");
                stub.resolves({"documents": [{document: "{\"id\": \"foo\", \"path\": \"/dxdam/test-path\"}"}]});

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                const searchPath = "/dxdam/test*";
                const recursive = true;
                const searchOptions = {q: "*:*", fl: ["path", "document"], fq: ["test"]};
                const opts = {assetTypes: assetsHelper.ASSET_TYPES_CONTENT_ASSETS};
                assetsHelper.searchRemote(context, searchOptions, opts, searchPath, recursive)
                    .then(function (documents) {
                        // Verify that the helper returned the expected message.
                        expect(documents).to.have.lengthOf(1);

                        // Verify that the stub was called once.
                        expect(stub).to.have.been.calledOnce;
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

    testTimestamps () {
        describe("_getLastPullTimestamps", function () {
            it("should succeed for the old timestamp format", function (done) {
                // Change the hashes.getLastPullTimestamp stub to return the old format.
                const TIMESTAMP = "2017-05-10T04:36:49.987Z";
                stubGetLastPull.returns(TIMESTAMP);

                // Call the method being tested.
                let error;
                try {
                    const timestamp = assetsHelper._getLastPullTimestamps(context, UnitTest.DUMMY_OPTIONS);
                    expect(timestamp.contentAssets.draft).to.equal(TIMESTAMP);
                    expect(timestamp.contentAssets.ready).to.equal(TIMESTAMP);
                    expect(timestamp.webAssets.draft).to.equal(TIMESTAMP);
                    expect(timestamp.webAssets.ready).to.equal(TIMESTAMP);
                } catch (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                } finally {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
            });

            it("should succeed for the new timestamp format", function (done) {
                // Change the hashes.getLastPullTimestamp stub to return the new format.
                const TIMESTAMP = "2017-05-10T04:36:49.987Z";
                stubGetLastPull.returns({webAssets: TIMESTAMP, contentAssets: TIMESTAMP});

                // Call the method being tested.
                let error;
                try {
                    const timestamp = assetsHelper._getLastPullTimestamps(context, UnitTest.DUMMY_OPTIONS);
                    expect(timestamp.contentAssets.draft).to.equal(TIMESTAMP);
                    expect(timestamp.contentAssets.ready).to.equal(TIMESTAMP);
                    expect(timestamp.webAssets.draft).to.equal(TIMESTAMP);
                    expect(timestamp.webAssets.ready).to.equal(TIMESTAMP);
                } catch (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                } finally {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
            });

            it("should succeed when only web assets value returned", function (done) {
                // Change the hashes.getLastPullTimestamp stub to return only a webAssets timestamp.
                const TIMESTAMP = "2017-05-10T04:36:49.987Z";
                stubGetLastPull.returns({webAssets: TIMESTAMP});

                // Call the method being tested.
                let error;
                try {
                    const timestamp = assetsHelper._getLastPullTimestamps(context, UnitTest.DUMMY_OPTIONS);
                    expect(timestamp.contentAssets).to.be.empty;
                    expect(timestamp.webAssets.draft).to.equal(TIMESTAMP);
                    expect(timestamp.webAssets.ready).to.equal(TIMESTAMP);
                } catch (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                } finally {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
            });

            it("should succeed when only content assets value returned", function (done) {
                // Change the hashes.getLastPullTimestamp stub to return only a contentAssets timestamp.
                const TIMESTAMP = "2017-05-10T04:36:49.987Z";
                stubGetLastPull.returns({contentAssets: TIMESTAMP});

                // Call the method being tested.
                let error;
                try {
                    const timestamp = assetsHelper._getLastPullTimestamps(context, UnitTest.DUMMY_OPTIONS);
                    expect(timestamp.webAssets).to.be.empty;
                    expect(timestamp.contentAssets.draft).to.equal(TIMESTAMP);
                    expect(timestamp.contentAssets.ready).to.equal(TIMESTAMP);
                } catch (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                } finally {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
            });
        });

        describe("_setLastPullTimestamps", function () {
            it("should set all timestamps when both assets types are specified with no draft/ready filtering", function (done) {
                // Change the hashes.getLastPullTimestamp stub to return a known value.
                const TIMESTAMP = "2017-05-10T04:36:49.987Z";
                stubGetLastPull.returns({
                    webAssets: {"draft": TIMESTAMP, "ready": TIMESTAMP},
                    contentAssets: {"draft": TIMESTAMP, "ready": TIMESTAMP}
                });
                const NEW_TIMESTAMP = new Date();

                // Call the method being tested.
                let error;
                try {
                    assetsHelper._setLastPullTimestamps(context, NEW_TIMESTAMP, {assetTypes: assetsHelper.ASSET_TYPES_BOTH});
                    expect(stubGetLastPull).to.have.been.calledOnce;
                    expect(stubSetLastPull.args[0][2]["webAssets"]["draft"]).to.equal(NEW_TIMESTAMP);
                    expect(stubSetLastPull.args[0][2]["webAssets"]["ready"]).to.equal(NEW_TIMESTAMP);
                    expect(stubSetLastPull.args[0][2]["contentAssets"]["draft"]).to.equal(NEW_TIMESTAMP);
                    expect(stubSetLastPull.args[0][2]["contentAssets"]["ready"]).to.equal(NEW_TIMESTAMP);
                } catch (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                } finally {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
            });

            it("should set only ready timestamps when both assets types are specified with ready filtering", function (done) {
                // Change the hashes.getLastPullTimestamp stub to return a known value.
                const TIMESTAMP = "2017-05-10T04:36:49.987Z";
                stubGetLastPull.returns({
                    webAssets: {"draft": TIMESTAMP, "ready": TIMESTAMP},
                    contentAssets: {"draft": TIMESTAMP, "ready": TIMESTAMP}
                });
                const NEW_TIMESTAMP = new Date();

                // Call the method being tested.
                let error;
                try {
                    assetsHelper._setLastPullTimestamps(context, NEW_TIMESTAMP, {
                        assetTypes: assetsHelper.ASSET_TYPES_BOTH,
                        filterReady: true
                    });
                    expect(stubGetLastPull).to.have.been.calledOnce;
                    expect(stubSetLastPull.args[0][2]["webAssets"]["draft"]).to.equal(TIMESTAMP);
                    expect(stubSetLastPull.args[0][2]["webAssets"]["ready"]).to.equal(NEW_TIMESTAMP);
                    expect(stubSetLastPull.args[0][2]["contentAssets"]["draft"]).to.equal(TIMESTAMP);
                    expect(stubSetLastPull.args[0][2]["contentAssets"]["ready"]).to.equal(NEW_TIMESTAMP);
                } catch (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                } finally {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
            });

            it("should set only draft timestamps when both assets types are specified with draft filtering", function (done) {
                // Change the hashes.getLastPullTimestamp stub to return a known value.
                const TIMESTAMP = "2017-05-10T04:36:49.987Z";
                stubGetLastPull.returns({
                    webAssets: {"draft": TIMESTAMP, "ready": TIMESTAMP},
                    contentAssets: {"draft": TIMESTAMP, "ready": TIMESTAMP}
                });
                const NEW_TIMESTAMP = new Date();

                // Call the method being tested.
                let error;
                try {
                    assetsHelper._setLastPullTimestamps(context, NEW_TIMESTAMP, {
                        assetTypes: assetsHelper.ASSET_TYPES_BOTH,
                        filterDraft: true
                    });
                    expect(stubGetLastPull).to.have.been.calledOnce;
                    expect(stubSetLastPull.args[0][2]["webAssets"]["draft"]).to.equal(NEW_TIMESTAMP);
                    expect(stubSetLastPull.args[0][2]["webAssets"]["ready"]).to.equal(TIMESTAMP);
                    expect(stubSetLastPull.args[0][2]["contentAssets"]["draft"]).to.equal(NEW_TIMESTAMP);
                    expect(stubSetLastPull.args[0][2]["contentAssets"]["ready"]).to.equal(TIMESTAMP);
                } catch (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                } finally {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
            });

            it("should only set the web assets ready timestamp when the web assets type is specified with ready filtering", function (done) {
                // Change the hashes.getLastPullTimestamp stub to return a known value.
                const TIMESTAMP = "2017-05-10T04:36:49.987Z";
                stubGetLastPull.returns({
                    webAssets: {"draft": TIMESTAMP, "ready": TIMESTAMP},
                    contentAssets: {"draft": TIMESTAMP, "ready": TIMESTAMP}
                });
                const NEW_TIMESTAMP = new Date();

                // Call the method being tested.
                let error;
                try {
                    assetsHelper._setLastPullTimestamps(context, NEW_TIMESTAMP, {
                        assetTypes: assetsHelper.ASSET_TYPES_WEB_ASSETS,
                        filterReady: true
                    });
                    expect(stubGetLastPull).to.have.been.calledOnce;
                    expect(stubSetLastPull.args[0][2]["webAssets"]["draft"]).to.equal(TIMESTAMP);
                    expect(stubSetLastPull.args[0][2]["webAssets"]["ready"]).to.equal(NEW_TIMESTAMP);
                    expect(stubSetLastPull.args[0][2]["contentAssets"]["draft"]).to.equal(TIMESTAMP);
                    expect(stubSetLastPull.args[0][2]["contentAssets"]["ready"]).to.equal(TIMESTAMP);
                } catch (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                } finally {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
            });

            it("should only set the web assets draft timestamp when the web assets type is specified with draft filtering", function (done) {
                // Change the hashes.getLastPullTimestamp stub to return a known value.
                const TIMESTAMP = "2017-05-10T04:36:49.987Z";
                stubGetLastPull.returns({
                    webAssets: {"draft": TIMESTAMP, "ready": TIMESTAMP},
                    contentAssets: {"draft": TIMESTAMP, "ready": TIMESTAMP}
                });
                const NEW_TIMESTAMP = new Date();

                // Call the method being tested.
                let error;
                try {
                    assetsHelper._setLastPullTimestamps(context, NEW_TIMESTAMP, {
                        assetTypes: assetsHelper.ASSET_TYPES_WEB_ASSETS,
                        filterDraft: true
                    });
                    expect(stubGetLastPull).to.have.been.calledOnce;
                    expect(stubSetLastPull.args[0][2]["webAssets"]["draft"]).to.equal(NEW_TIMESTAMP);
                    expect(stubSetLastPull.args[0][2]["webAssets"]["ready"]).to.equal(TIMESTAMP);
                    expect(stubSetLastPull.args[0][2]["contentAssets"]["draft"]).to.equal(TIMESTAMP);
                    expect(stubSetLastPull.args[0][2]["contentAssets"]["ready"]).to.equal(TIMESTAMP);
                } catch (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                } finally {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
            });

            it("should only set the content assets ready timestamp when the content assets type is specified with ready filtering", function (done) {
                // Change the hashes.getLastPullTimestamp stub to return a known value.
                const TIMESTAMP = "2017-05-10T04:36:49.987Z";
                stubGetLastPull.returns({
                    webAssets: {"draft": TIMESTAMP, "ready": TIMESTAMP},
                    contentAssets: {"draft": TIMESTAMP, "ready": TIMESTAMP}
                });
                const NEW_TIMESTAMP = new Date();

                // Call the method being tested.
                let error;
                try {
                    assetsHelper._setLastPullTimestamps(context, NEW_TIMESTAMP, {
                        assetTypes: assetsHelper.ASSET_TYPES_CONTENT_ASSETS,
                        filterReady: true
                    });
                    expect(stubGetLastPull).to.have.been.calledOnce;
                    expect(stubSetLastPull.args[0][2]["webAssets"]["draft"]).to.equal(TIMESTAMP);
                    expect(stubSetLastPull.args[0][2]["webAssets"]["ready"]).to.equal(TIMESTAMP);
                    expect(stubSetLastPull.args[0][2]["contentAssets"]["draft"]).to.equal(TIMESTAMP);
                    expect(stubSetLastPull.args[0][2]["contentAssets"]["ready"]).to.equal(NEW_TIMESTAMP);
                } catch (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                } finally {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
            });

            it("should only set the content assets draft timestamp when the content assets type is specified with draft filtering", function (done) {
                // Change the hashes.getLastPullTimestamp stub to return a known value.
                const TIMESTAMP = "2017-05-10T04:36:49.987Z";
                stubGetLastPull.returns({
                    webAssets: {"draft": TIMESTAMP, "ready": TIMESTAMP},
                    contentAssets: {"draft": TIMESTAMP, "ready": TIMESTAMP}
                });
                const NEW_TIMESTAMP = new Date();

                // Call the method being tested.
                let error;
                try {
                    assetsHelper._setLastPullTimestamps(context, NEW_TIMESTAMP, {
                        assetTypes: assetsHelper.ASSET_TYPES_CONTENT_ASSETS,
                        filterDraft: true
                    });
                    expect(stubGetLastPull).to.have.been.calledOnce;
                    expect(stubSetLastPull.args[0][2]["webAssets"]["draft"]).to.equal(TIMESTAMP);
                    expect(stubSetLastPull.args[0][2]["webAssets"]["ready"]).to.equal(TIMESTAMP);
                    expect(stubSetLastPull.args[0][2]["contentAssets"]["draft"]).to.equal(NEW_TIMESTAMP);
                    expect(stubSetLastPull.args[0][2]["contentAssets"]["ready"]).to.equal(TIMESTAMP);
                } catch (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                } finally {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
            });
        });

        describe("getLastPullTimestamp", function () {
            it("should return the web assets ready timestamp when the web assets type is specified", function (done) {
                const TIMESTAMP_1 = "1962-11-09T11:38:34.123Z";
                const TIMESTAMP_2 = "2017-11-28T14:31:00.456Z";
                const stub = sinon.stub(assetsHelper, "_getLastPullTimestamps");
                stub.returns({
                    webAssets: {"draft": TIMESTAMP_1, "ready": TIMESTAMP_2},
                    contentAssets: {"draft": TIMESTAMP_1, "ready": TIMESTAMP_1}
                });

                // Call the method being tested.
                let error;
                try {
                    const timestamp = assetsHelper.getLastPullTimestamp(context, {
                        assetTypes: assetsHelper.ASSET_TYPES_WEB_ASSETS,
                        filterReady: true
                    });
                    expect(timestamp).to.equal(TIMESTAMP_2);
                } catch (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                } finally {
                    stub.restore();

                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
            });

            it("should return the content assets ready timestamp when the content assets type is specified", function (done) {
                const TIMESTAMP_1 = "1962-11-09T11:38:34.123Z";
                const TIMESTAMP_2 = "2017-11-28T14:31:00.456Z";
                const stub = sinon.stub(assetsHelper, "_getLastPullTimestamps");
                stub.returns({
                    webAssets: {"draft": TIMESTAMP_1, "ready": TIMESTAMP_1},
                    contentAssets: {"draft": TIMESTAMP_1, "ready": TIMESTAMP_2}
                });

                // Call the method being tested.
                let error;
                try {
                    const timestamp = assetsHelper.getLastPullTimestamp(context, {
                        assetTypes: assetsHelper.ASSET_TYPES_CONTENT_ASSETS,
                        filterReady: true
                    });
                    expect(timestamp).to.equal(TIMESTAMP_2);
                } catch (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                } finally {
                    stub.restore();

                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
            });

            it("should return the web assets draft timestamp when it is before the web assets ready timestamp", function (done) {
                const TIMESTAMP_1 = "1962-11-09T11:38:34.123Z";
                const TIMESTAMP_2 = "2017-11-28T14:31:00.456Z";
                const stub = sinon.stub(assetsHelper, "_getLastPullTimestamps");
                stub.returns({
                    webAssets: {"draft": TIMESTAMP_1, "ready": TIMESTAMP_2},
                    contentAssets: {"draft": TIMESTAMP_2, "ready": TIMESTAMP_2}
                });

                // Call the method being tested.
                let error;
                try {
                    const timestamp = assetsHelper.getLastPullTimestamp(context, {assetTypes: assetsHelper.ASSET_TYPES_WEB_ASSETS});
                    expect(timestamp).to.equal(TIMESTAMP_1);
                } catch (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                } finally {
                    stub.restore();

                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
            });

            it("should return the content assets ready timestamp when it is before the content assets draft timestamp", function (done) {
                const TIMESTAMP_1 = "1962-11-09T11:38:34.123Z";
                const TIMESTAMP_2 = "2017-11-28T14:31:00.456Z";
                const stub = sinon.stub(assetsHelper, "_getLastPullTimestamps");
                stub.returns({
                    webAssets: {"draft": TIMESTAMP_2, "ready": TIMESTAMP_2},
                    contentAssets: {"draft": TIMESTAMP_2, "ready": TIMESTAMP_1}
                });

                // Call the method being tested.
                let error;
                try {
                    const timestamp = assetsHelper.getLastPullTimestamp(context, {assetTypes: assetsHelper.ASSET_TYPES_BOTH});
                    expect(timestamp).to.equal(TIMESTAMP_1);
                } catch (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                } finally {
                    stub.restore();

                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
            });

            it("should return an undefined timestamp when no pull timestamps were saved", function (done) {
                const stub = sinon.stub(assetsHelper, "_getLastPullTimestamps");
                stub.returns(undefined);

                // Call the method being tested.
                let error;
                try {
                    const timestamp = assetsHelper.getLastPullTimestamp(context, {assetTypes: assetsHelper.ASSET_TYPES_BOTH});
                    expect(timestamp).to.not.exist;
                } catch (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                } finally {
                    stub.restore();

                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
            });
        });
    }

    testCompare () {
        const folder1 = UnitTest.API_PATH + UnitTest.COMPARE_RESOURCES_DIRECTORY_1;
        const folder2 = UnitTest.API_PATH + UnitTest.COMPARE_RESOURCES_DIRECTORY_2;
        const self = this;
        describe("compare", function () {
            it("should succeed when source and target are equal", function (done) {
                // We need to restore the stub for generateMD5HashFromStream.
                stubGenerateMD5HashFromStream.restore();

                // Create a spy to listen for the "diff" events.
                const emitter = assetsHelper.getEventEmitter(context);
                const spyDiff = sinon.spy();
                emitter.on("diff", spyDiff);
                const spyAdded = sinon.spy();
                emitter.on("added", spyAdded);
                const spyRemoved = sinon.spy();
                emitter.on("removed", spyRemoved);

                let error;
                assetsHelper.compare(context, folder1, folder1)
                    .then(function (diffs) {
                        expect(diffs.diffCount).to.be.equal(0);
                        expect(diffs.totalCount).to.be.equal(8);
                        expect(spyDiff).to.not.have.been.called;
                        expect(spyAdded).to.not.have.been.called;
                        expect(spyRemoved).to.not.have.been.called;
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        emitter.removeListener("diff", spyDiff);
                        emitter.removeListener("added", spyAdded);
                        emitter.removeListener("removed", spyRemoved);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when there is no emitter", function (done) {
                // We need to restore the stub for generateMD5HashFromStream.
                stubGenerateMD5HashFromStream.restore();

                // Remove the event emitter.
                const emitter = assetsHelper.getEventEmitter(context);
                delete context.eventEmitter;

                let error;
                assetsHelper.compare(context, folder1, folder2)
                    .then(function (diffs) {
                        expect(diffs.diffCount).to.be.equal(7);
                        expect(diffs.totalCount).to.be.equal(10);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Restore the emitter.
                        context.eventEmitter = emitter;

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed comparing using urls", function (done) {
                const stubListRemoteItemNames = sinon.stub(assetsHelper, "_listRemoteItemNames");
                stubListRemoteItemNames.resolves([]);

                const stubListRemoteResources = sinon.stub(assetsHelper, "_listRemoteResources");
                stubListRemoteResources.resolves([]);

                let error;
                assetsHelper.compare(context, "http://foo.com/api", "http://foo.com/api")
                    .then(function (diffs) {
                        expect(diffs.diffCount).to.be.equal(0);
                        expect(diffs.totalCount).to.be.equal(0);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        stubListRemoteItemNames.restore();
                        stubListRemoteResources.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed using a manifest list", function (done) {
                // We need to restore the stub for generateMD5HashFromStream.
                stubGenerateMD5HashFromStream.restore();

                const stubListRemoteItemNames = sinon.stub(assetsHelper, "getManifestItems", assetsHelper._listLocalItemNames);
                context.readManifest = {};

                let error;
                assetsHelper.compare(context, folder1, folder2)
                    .then(function (diffs) {
                        expect(diffs.diffCount).to.be.equal(7);
                        expect(diffs.totalCount).to.be.equal(10);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        stubListRemoteItemNames.restore();
                        delete context.readManifest;

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed", function (done) {
                // We need to restore the stub for generateMD5HashFromStream.
                stubGenerateMD5HashFromStream.restore();

                // Create a spy to listen for the "diff" events.
                const emitter = assetsHelper.getEventEmitter(context);
                const spyDiff = sinon.spy();
                emitter.on("diff", spyDiff);
                const spyAdded = sinon.spy();
                emitter.on("added", spyAdded);
                const spyRemoved = sinon.spy();
                emitter.on("removed", spyRemoved);

                let error;
                assetsHelper.compare(context, folder1, folder2)
                    .then(function (diffs) {
                        expect(diffs.diffCount).to.be.equal(7);
                        expect(diffs.totalCount).to.be.equal(10);
                        expect(spyDiff).to.have.callCount(3);
                        expect(spyAdded).to.have.been.calledTwice;
                        expect(spyRemoved).to.have.been.calledTwice;
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        emitter.removeListener("diff", spyDiff);
                        emitter.removeListener("added", spyAdded);
                        emitter.removeListener("removed", spyRemoved);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }
}

module.exports = AssetsHelperUnitTest;
