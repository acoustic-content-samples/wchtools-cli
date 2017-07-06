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
 * Unit tests for the assetsHelper object.
 *
 * NOTE: The StatusTracker and EventEmitter objects used by the assetsHelper object are
 * used to execute some of the tests, so the provided functionality is not stubbed out.
 */
"use strict";

// Require the super classes for this class.
const UnitTest = require("./base.unit.js");
const AssetsUnitTest = require("./assets.unit.js");

// Require the node modules used in this test file.
const fs = require("fs");
const mkdirp = require("mkdirp");
const stream = require("stream");
const diff = require("diff");
const sinon = require("sinon");
const Q = require("q");
const options = require(UnitTest.API_PATH + "lib/utils/options.js");
const hashes = require(UnitTest.API_PATH + "lib/utils/hashes.js");

// Require the local modules that will be stubbed, mocked, and spied.
const assetsFS = require(UnitTest.API_PATH + "lib/assetsFS.js").instance;
const assetsREST = require(UnitTest.API_PATH + "lib/assetsREST.js").instance;

// Require the local module being tested.
const assetsHelper = require(UnitTest.API_PATH + "assetsHelper.js").instance;

// Stub mkdirp to guard against creating an assets directory.
let stubMkdirp;

// Stubs for the hashes methods.
let stubGenerateMD5Hash;
let stubUpdateHashes;
let stubGetLastPush;
let stubSetLastPush;
let stubGetLastPull;
let stubSetLastPull;
let stubGetHashesForFile;
let stubListFiles;
let stubIsLocalModified;
let stubIsRemoteModified;
let stubcompareMD5Hashes;

class AssetsHelperUnitTest extends AssetsUnitTest {
    constructor () {
        super();
    }

    run () {
        const self = this;
        describe("Unit tests for assetsHelper.js", function () {
            // Initialize common resourses before running any unit tests.
            before(function (done) {
                assetsHelper.reset();

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
                stubGenerateMD5Hash.returns(undefined);
                self.addTestDouble(stubGenerateMD5Hash);

                stubUpdateHashes = sinon.stub(hashes, "updateHashes");
                stubUpdateHashes.returns(undefined);
                self.addTestDouble(stubUpdateHashes);

                stubGetLastPush = sinon.stub(hashes, "getLastPushTimestamp");
                stubGetLastPush.returns(undefined);
                self.addTestDouble(stubGetLastPush);

                stubSetLastPush = sinon.stub(hashes, "setLastPushTimestamp");
                self.addTestDouble(stubSetLastPush);

                stubGetLastPull = sinon.stub(hashes, "getLastPullTimestamp");
                stubGetLastPull.returns(undefined);
                self.addTestDouble(stubGetLastPull);

                stubSetLastPull = sinon.stub(hashes, "setLastPullTimestamp");
                self.addTestDouble(stubSetLastPull);

                stubGetHashesForFile = sinon.stub(hashes, "getHashesForFile");
                stubGetHashesForFile.returns(undefined);
                self.addTestDouble(stubGetHashesForFile);

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

                // Reset the state of the helper.
                assetsHelper.reset();

                // Reset the state of the options, to remove any values that may have been set during the test.
                options.resetState();

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
            self.testEventEmitter();
            self.testGetAssetFolderName();
            self.testInit();
            self.testPullAsset();
            self.testPullAllAssets();
            self.testPullModifiedAssets();
            self.testPushAsset();
            self.testPushAllAssets();
            self.testPushModifiedAssets();
            self.testListRemoteAssetNames();
            self.testListRemoteDeletedAssetNames();
            self.testListModifiedRemoteAssetNames();
            self.testListLocalAssetNames();
            self.testListLocalModifiedAssetNames();
            self.testListDeletedLocalAssetNames();
            self.testDeleteRemoteAsset();
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
                const eventEmitter = assetsHelper.getEventEmitter();
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
            });
        });
   }

    testGetAssetFolderName () {
        const self = this;
        describe("getAssetFolderName", function () {
            it("should get the asset folder name from the FS API.", function () {
                // Create an assetsFS.getFolderName stub that returns the folder name.
                const FAKE_FOLDER_NAME = "Fake name for the assets folder.";
                const stub = sinon.stub(assetsFS, "getFolderName");
                stub.returns(FAKE_FOLDER_NAME);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                const folderName = assetsHelper.getAssetFolderName();

                // Verify that the stub was called and that the helper returned the expected value.
                expect(stub).to.have.been.calledOnce;
                expect(folderName).to.equal(FAKE_FOLDER_NAME);
            });
        });
    }

    testInit () {
        const self = this;
        describe("init", function () {
            // Restore common resourses after running the unit tests.
            after(function (done) {
                UnitTest.restoreOptions();

                // Signal that the cleanup is complete.
                done();
            });

            it("should initialize the global options", function () {
                // Setup the spies and stubs needed for testing the init() method.
                const spy = sinon.spy(options, "setGlobalOptions");

                // The spy and stubs should be restored when the test is complete.
                self.addTestDouble(spy);

                // Call the method being tested.
                assetsHelper.initGlobalOptions({"workingDir": UnitTest.DUMMY_DIR});

                // Verify that the spy was called once with the expected parameter value.
                expect(spy).to.have.been.calledOnce;
                expect(spy.firstCall.args[0].workingDir).to.equal(UnitTest.DUMMY_DIR);

            });
        });
    }

    testPullAsset () {
        const self = this;
        describe("pullItem", function () {
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
                assetsHelper.pullItem(UnitTest.DUMMY_PATH, UnitTest.DUMMY_OPTIONS)
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
                assetsHelper.pullItem(UnitTest.DUMMY_PATH, {offset: 0, limit: 2})
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
                assetsHelper.pullItem(assetMetadata4.path, UnitTest.DUMMY_OPTIONS)
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
                // Read the contents of four invalid test asset metadata files.
                const assetMetadataPath1 = AssetsUnitTest.INVALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_INVALID_PATH_1;
                const assetMetadataPath2 = AssetsUnitTest.INVALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_INVALID_PATH_2;
                const assetMetadataPath3 = AssetsUnitTest.INVALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_INVALID_PATH_3;
                const assetMetadataPath4 = AssetsUnitTest.INVALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_INVALID_PATH_4;
                const assetMetadata1 = UnitTest.getJsonObject(assetMetadataPath1);
                const assetMetadata2 = UnitTest.getJsonObject(assetMetadataPath2);
                const assetMetadata3 = UnitTest.getJsonObject(assetMetadataPath3);
                const assetMetadata4 = UnitTest.getJsonObject(assetMetadataPath4);

                // Create an assetsREST.getItems stub that returns a promise for the metadata of the assets.
                const stub = sinon.stub(assetsREST, "getItems");
                stub.resolves([assetMetadata1, assetMetadata2, assetMetadata3, assetMetadata4]);

                // Create an assetsFS.getItemWriteStream spy.
                const spy = sinon.spy(assetsFS, "getItemWriteStream");

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stub);
                self.addTestDouble(spy);

                // Call the method being tested with an invalid name.
                let error;
                assetsHelper.pullItem(assetMetadata1.path, UnitTest.DUMMY_OPTIONS)
                    .then(function (/*asset*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the pulled asset should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");

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

            it("should fail when a path with invalid characters is specified.", function (done) {
                // Read the contents of four invalid test asset metadata files.
                const assetMetadataPath1 = AssetsUnitTest.INVALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_INVALID_PATH_1;
                const assetMetadataPath2 = AssetsUnitTest.INVALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_INVALID_PATH_2;
                const assetMetadataPath3 = AssetsUnitTest.INVALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_INVALID_PATH_3;
                const assetMetadataPath4 = AssetsUnitTest.INVALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_INVALID_PATH_4;
                const assetMetadata1 = UnitTest.getJsonObject(assetMetadataPath1);
                const assetMetadata2 = UnitTest.getJsonObject(assetMetadataPath2);
                const assetMetadata3 = UnitTest.getJsonObject(assetMetadataPath3);
                const assetMetadata4 = UnitTest.getJsonObject(assetMetadataPath4);

                // Create an assetsREST.getItems stub that returns a promise for the metadata of the assets.
                const stub = sinon.stub(assetsREST, "getItems");
                stub.resolves([assetMetadata1, assetMetadata2, assetMetadata3, assetMetadata4]);

                // Create an assetsFS.getItemWriteStream spy.
                const spy = sinon.spy(assetsFS, "getItemWriteStream");

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stub);
                self.addTestDouble(spy);

                // Call the method being tested with an invalid name.
                let error;
                assetsHelper.pullItem(assetMetadata2.path, UnitTest.DUMMY_OPTIONS)
                    .then(function (/*asset*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the pulled asset should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");

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

            it("should fail when a path containing 'http:' is specified.", function (done) {
                // Read the contents of four invalid test asset metadata files.
                const assetMetadataPath1 = AssetsUnitTest.INVALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_INVALID_PATH_1;
                const assetMetadataPath2 = AssetsUnitTest.INVALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_INVALID_PATH_2;
                const assetMetadataPath3 = AssetsUnitTest.INVALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_INVALID_PATH_3;
                const assetMetadataPath4 = AssetsUnitTest.INVALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_INVALID_PATH_4;
                const assetMetadata1 = UnitTest.getJsonObject(assetMetadataPath1);
                const assetMetadata2 = UnitTest.getJsonObject(assetMetadataPath2);
                const assetMetadata3 = UnitTest.getJsonObject(assetMetadataPath3);
                const assetMetadata4 = UnitTest.getJsonObject(assetMetadataPath4);

                // Create an assetsREST.getItems stub that returns a promise for the metadata of the assets.
                const stub = sinon.stub(assetsREST, "getItems");
                stub.resolves([assetMetadata1, assetMetadata2, assetMetadata3, assetMetadata4]);

                // Create an assetsFS.getItemWriteStream spy.
                const spy = sinon.spy(assetsFS, "getItemWriteStream");

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stub);
                self.addTestDouble(spy);

                // Call the method being tested with an invalid name.
                let error;
                assetsHelper.pullItem(assetMetadata3.path, UnitTest.DUMMY_OPTIONS)
                    .then(function (/*asset*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the pulled asset should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");

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

            it("should fail when a path containing 'https:' is specified.", function (done) {
                // Read the contents of four invalid test asset metadata files.
                const assetMetadataPath1 = AssetsUnitTest.INVALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_INVALID_PATH_1;
                const assetMetadataPath2 = AssetsUnitTest.INVALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_INVALID_PATH_2;
                const assetMetadataPath3 = AssetsUnitTest.INVALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_INVALID_PATH_3;
                const assetMetadataPath4 = AssetsUnitTest.INVALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_INVALID_PATH_4;
                const assetMetadata1 = UnitTest.getJsonObject(assetMetadataPath1);
                const assetMetadata2 = UnitTest.getJsonObject(assetMetadataPath2);
                const assetMetadata3 = UnitTest.getJsonObject(assetMetadataPath3);
                const assetMetadata4 = UnitTest.getJsonObject(assetMetadataPath4);

                // Create an assetsREST.getItems stub that returns a promise for the metadata of the assets.
                const stub = sinon.stub(assetsREST, "getItems");
                stub.resolves([assetMetadata1, assetMetadata2, assetMetadata3, assetMetadata4]);

                // Create an assetsFS.getItemWriteStream spy.
                const spy = sinon.spy(assetsFS, "getItemWriteStream");

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stub);
                self.addTestDouble(spy);

                // Call the method being tested with an invalid name.
                let error;
                assetsHelper.pullItem(assetMetadata4.path, UnitTest.DUMMY_OPTIONS)
                    .then(function (/*asset*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the pulled asset should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");

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
                assetsHelper.pullItem(assetMetadata1.path, UnitTest.DUMMY_OPTIONS)
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
                            expect(stubFS.args[0][0]).to.equal(assetMetadata1.path);
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
                assetsHelper.pullItem(assetMetadata2.path, UnitTest.DUMMY_OPTIONS)
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
                            expect(stubStream.args[0][0]).to.equal(assetMetadata2.path);
                            expect(diff.diffJson(stubPull.args[0][0], assetMetadata2)).to.have.lengthOf(1);
                            expect(stubPull.args[0][1].tag).to.equal(STREAM_TAG);
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
                const stubPull = sinon.stub(assetsREST, "pullItem");
                stubPull.resolves(assetMetadata3);

                // Create an assetsFS.saveItem spy to make sure it doesn't get called.
                const spySave = sinon.spy(assetsFS, "saveItem");

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stubItems);
                self.addTestDouble(stubStream);
                self.addTestDouble(stubPull);
                self.addTestDouble(spySave);

                // Set the option values directly on the options object instead of passing to the helper. The options
                // state is reset after every test.
                options.setOptions({assets: {offset: 0, limit: 2}});

                // Call the method being tested with an invalid name.
                let error;
                assetsHelper.pullItem(assetMetadata3.path)
                    .then(function (asset) {
                        // Verify that the helper returned the expected value.
                        expect(diff.diffJson(asset, assetMetadata3)).to.have.lengthOf(1);

                        // Verify that all stubs were called once, and with the expected values.
                        expect(stubItems).to.have.been.calledTwice;
                        expect(stubStream).to.have.been.calledOnce;
                        expect(stubPull).to.have.been.calledOnce;
                        expect(stubUpdateHashes).to.have.been.calledOnce;
                        expect(stubStream.args[0][0]).to.equal(assetMetadata3.path);
                        expect(diff.diffJson(stubPull.args[0][0], assetMetadata3)).to.have.lengthOf(1);
                        expect(stubPull.args[0][1].tag).to.equal(STREAM_TAG);
                        expect(diff.diffJson(stubUpdateHashes.args[0][2], assetMetadata3)).to.have.lengthOf(1);

                        // Verify that the spy was not called.
                        expect(spySave).to.not.have.been.called;

                        // Verify that the hashes were called as expected.
                        expect(stubUpdateHashes).to.have.been.calledOnce;
                        expect(stubUpdateHashes.firstCall.args[1]).to.contain(AssetsUnitTest.ASSET_PNG_1);
                        expect(stubUpdateHashes.firstCall.args[2].path).to.contain(AssetsUnitTest.ASSET_PNG_1);

                        // Verify that the local asset is registered with the helper.
                        expect(assetsHelper.existsLocally(assetMetadata3.path)).to.equal(true);
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
                const stubPull = sinon.stub(assetsREST, "pullItem");
                stubPull.resolves(assetMetadata3);

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
                assetsHelper.pullItem(assetMetadata3.path, {offset: 0, limit: 2})
                    .then(function (asset) {
                        // Verify that the helper returned the expected value.
                        expect(diff.diffJson(asset, assetMetadata3)).to.have.lengthOf(1);

                        // Verify that all stubs were called once, and with the expected values.
                        expect(stubItems).to.have.been.calledTwice;
                        expect(stubStream).to.have.been.calledOnce;
                        expect(stubPull).to.have.been.calledOnce;
                        expect(stubUpdateHashes).to.have.been.calledOnce;
                        expect(stubSave).to.have.been.calledOnce;
                        expect(stubStream.args[0][0]).to.equal(assetMetadata3.path);
                        expect(diff.diffJson(stubPull.args[0][0], assetMetadata3)).to.have.lengthOf(1);
                        expect(stubPull.args[0][1].tag).to.equal(STREAM_TAG);
                        expect(diff.diffJson(stubUpdateHashes.args[0][2], assetMetadata3)).to.have.lengthOf(1);
                        expect(diff.diffJson(stubSave.args[0][0], assetMetadata3)).to.have.lengthOf(1);

                        // Verify that the hashes were called as expected.
                        expect(stubUpdateHashes).to.have.been.calledOnce;
                        expect(stubUpdateHashes.firstCall.args[1]).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_3);
                        expect(stubUpdateHashes.firstCall.args[2].path).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_3);

                        // Verify that the local asset is registered with the helper.
                        expect(assetsHelper.existsLocally(assetMetadata3.path)).to.equal(true);
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
                assetsHelper.pullAllItems(UnitTest.DUMMY_OPTIONS)
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

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsHelper.pullAllItems({offset: 0, limit: 2})
                    .then(function (assets) {
                        // Verify that the helper returned the expected values.
                        // Note that pullAllAssets is designed to return a metadata array, but currently it does not.
                        if (assets) {
                            expect(assets).to.have.lengthOf(0);
                        }

                        // Verify that the stub was called once.
                        expect(stub).to.have.been.calledOnce;

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

                // Create an assetsREST.getItems stub that returns a promise for the metadata of the assets.
                const stubGet = sinon.stub(assetsREST, "getItems");
                stubGet.onCall(0).resolves([assetMetadata1, assetMetadata2]);
                stubGet.onCall(1).resolves([assetMetadata3, assetMetadata4]);
                stubGet.onCall(2).resolves([assetMetadata5, assetMetadata6]);
                stubGet.onCall(3).resolves([]);

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

                // Create a stub for assetsREST.pullItem that returns a promise for the asset metadata.
                const stubPull = sinon.stub(assetsREST, "pullItem");
                stubPull.onCall(0).resolves(assetMetadata1);
                stubPull.onCall(1).resolves(assetMetadata2);
                stubPull.onCall(2).resolves(assetMetadata3);
                stubPull.onCall(3).resolves(assetMetadata4);
                stubPull.onCall(4).resolves(assetMetadata6);

                // Create spies to listen for the "pulled" and "pulled-error" events.
                const spyPull = sinon.spy();
                assetsHelper.getEventEmitter().on("pulled", spyPull);
                const spyError = sinon.spy();
                assetsHelper.getEventEmitter().on("pulled-error", spyError);

                // The stubs and spies should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubStream);
                self.addTestDouble(stubPull);

                // Set the option values directly on the options object instead of passing to the helper. The options
                // state is reset after every test.
                options.setOptions({assets: {offset: 0, limit: 2}});

                // Call the method being tested.
                let error;
                assetsHelper.pullAllItems()
                    .then(function (assets) {
                        // Verify that the helper returned the expected values.
                        // Note that pullAllAssets is designed to return a metadata array, but currently it does not.
                        if (assets) {
                            expect(assets).to.have.lengthOf(6);
                            expect(assets[0].path).to.equal(assetMetadata1.path);
                            expect(assets[1].path).to.equal(assetMetadata2.path);
                            expect(assets[2].path).to.equal(assetMetadata3.path);
                            expect(assets[3].path).to.equal(assetMetadata4.path);
                            expect(assets[4].name).to.equal("Error");
                            expect(assets[4].message).to.contain("Invalid path");
                            expect(assets[4].message).to.contain(assetMetadata5.path);
                            expect(assets[5].path).to.equal(assetMetadata6.path);
                        }

                        // Verify that the get stub was called four times.
                        expect(stubGet).to.have.callCount(4);

                        // Verify that the stream stub was called five times, each time with the expected path.
                        expect(stubStream).to.have.callCount(5);
                        expect(stubStream.args[0][0]).to.equal(assetMetadata1.path);
                        expect(stubStream.args[1][0]).to.equal(assetMetadata2.path);
                        expect(stubStream.args[2][0]).to.equal(assetMetadata3.path);
                        expect(stubStream.args[3][0]).to.equal(assetMetadata4.path);
                        expect(stubStream.args[4][0]).to.equal(assetMetadata6.path);

                        // Verify that the pull stub was called five times, each time with the expected path and stream.
                        expect(stubPull).to.have.callCount(5);
                        expect(stubPull.args[0][0].path).to.equal(assetMetadata1.path);
                        expect(stubPull.args[1][0].path).to.equal(assetMetadata2.path);
                        expect(stubPull.args[2][0].path).to.equal(assetMetadata3.path);
                        expect(stubPull.args[3][0].path).to.equal(assetMetadata4.path);
                        expect(stubPull.args[4][0].path).to.equal(assetMetadata6.path);
                        expect(stubPull.args[0][1].tag).to.equal(STREAM_TAG_1);
                        expect(stubPull.args[1][1].tag).to.equal(STREAM_TAG_2);
                        expect(stubPull.args[2][1].tag).to.equal(STREAM_TAG_3);
                        expect(stubPull.args[3][1].tag).to.equal(STREAM_TAG_4);
                        expect(stubPull.args[4][1].tag).to.equal(STREAM_TAG_5);

                        // Verify that the spies were called the expected number of times with the expected values.
                        expect(spyPull).to.have.callCount(5);
                        expect(spyPull.args[0][0]).to.equal(assetMetadata1.path);
                        expect(spyPull.args[1][0]).to.equal(assetMetadata2.path);
                        expect(spyPull.args[2][0]).to.equal(assetMetadata3.path);
                        expect(spyPull.args[3][0]).to.equal(assetMetadata4.path);
                        expect(spyPull.args[4][0]).to.equal(assetMetadata6.path);
                        expect(spyError).to.have.been.calledOnce;
                        expect(spyError.args[0][0].name).to.equal("Error");
                        expect(spyError.args[0][0].message).to.contain("Invalid path");
                        expect(spyError.args[0][0].message).to.contain(assetMetadata5.path);
                        expect(spyError.args[0][1]).to.equal(assetMetadata5.path);

                        // Verify that the hashes were called as expected.
                        expect(stubSetLastPull).to.not.have.been.called;

                        expect(stubUpdateHashes).to.have.callCount(5);
                        expect(stubUpdateHashes.args[0][1]).to.contain(AssetsUnitTest.ASSET_HTML_1);
                        expect(stubUpdateHashes.args[0][2].path).to.contain(AssetsUnitTest.ASSET_HTML_1);
                        expect(stubUpdateHashes.args[1][1]).to.contain(AssetsUnitTest.ASSET_CSS_1);
                        expect(stubUpdateHashes.args[1][2].path).to.contain(AssetsUnitTest.ASSET_CSS_1);
                        expect(stubUpdateHashes.args[2][1]).to.contain(AssetsUnitTest.ASSET_JPG_1);
                        expect(stubUpdateHashes.args[2][2].path).to.contain(AssetsUnitTest.ASSET_JPG_1);
                        expect(stubUpdateHashes.args[3][1]).to.contain(AssetsUnitTest.ASSET_GIF_1);
                        expect(stubUpdateHashes.args[3][2].path).to.contain(AssetsUnitTest.ASSET_GIF_1);
                        expect(stubUpdateHashes.args[4][1]).to.contain(AssetsUnitTest.ASSET_JAR_1);
                        expect(stubUpdateHashes.args[4][2].path).to.contain(AssetsUnitTest.ASSET_JAR_1);
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
                const stubGet = sinon.stub(assetsREST, "getItems");
                stubGet.onCall(0).resolves([assetMetadata1, assetMetadata2]);
                stubGet.onCall(1).resolves([assetMetadata3, assetMetadata4]);
                stubGet.onCall(2).resolves([assetMetadata5, assetMetadata6]);
                stubGet.onCall(3).resolves([]);

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

                // Create a stub for assetsREST.pullItem that returns a promise for the asset metadata.
                const stubPull = sinon.stub(assetsREST, "pullItem");
                stubPull.onCall(0).resolves(assetMetadata1);
                stubPull.onCall(1).resolves(assetMetadata3);
                stubPull.onCall(2).resolves(assetMetadata4);
                stubPull.onCall(3).resolves(assetMetadata6);

                // Create spies to listen for the "pulled" and "pulled-error" events.
                const spyPull = sinon.spy();
                assetsHelper.getEventEmitter().on("pulled", spyPull);
                const spyError = sinon.spy();
                assetsHelper.getEventEmitter().on("pulled-error", spyError);

                // The stubs and spies should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubStream);
                self.addTestDouble(stubPull);

                // Call the method being tested.
                let error;
                assetsHelper.pullAllItems({offset: 0, limit: 2, assetTypes: assetsHelper.ASSET_TYPES_WEB_ASSETS})
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
                        expect(stubStream.args[0][0]).to.equal(assetMetadata1.path);
                        expect(stubStream.args[1][0]).to.equal(assetMetadata3.path);
                        expect(stubStream.args[2][0]).to.equal(assetMetadata4.path);
                        expect(stubStream.args[3][0]).to.equal(assetMetadata6.path);

                        // Verify that the pull stub was called four times, each time with the expected path and stream.
                        expect(stubPull).to.have.callCount(4);
                        expect(stubPull.args[0][0].path).to.equal(assetMetadata1.path);
                        expect(stubPull.args[1][0].path).to.equal(assetMetadata3.path);
                        expect(stubPull.args[2][0].path).to.equal(assetMetadata4.path);
                        expect(stubPull.args[3][0].path).to.equal(assetMetadata6.path);
                        expect(stubPull.args[0][1].tag).to.equal(STREAM_TAG_1);
                        expect(stubPull.args[1][1].tag).to.equal(STREAM_TAG_2);
                        expect(stubPull.args[2][1].tag).to.equal(STREAM_TAG_3);
                        expect(stubPull.args[3][1].tag).to.equal(STREAM_TAG_4);

                        // Verify that the spies were called the expected number of times with the expected values.
                        expect(spyPull).to.have.callCount(4);
                        expect(spyPull.args[0][0]).to.equal(assetMetadata1.path);
                        expect(spyPull.args[1][0]).to.equal(assetMetadata3.path);
                        expect(spyPull.args[2][0]).to.equal(assetMetadata4.path);
                        expect(spyPull.args[3][0]).to.equal(assetMetadata6.path);
                        expect(spyError).to.have.been.calledOnce;
                        expect(spyError.args[0][0].name).to.equal("Error");
                        expect(spyError.args[0][0].message).to.contain("Invalid path");
                        expect(spyError.args[0][0].message).to.contain(assetMetadata5.path);
                        expect(spyError.args[0][1]).to.equal(assetMetadata5.path);

                        // Verify that the hashes were called as expected.
                        expect(stubSetLastPull).to.not.have.been.called;

                        expect(stubUpdateHashes).to.have.callCount(4);
                        expect(stubUpdateHashes.args[0][1]).to.contain(AssetsUnitTest.ASSET_HTML_1);
                        expect(stubUpdateHashes.args[0][2].path).to.contain(AssetsUnitTest.ASSET_HTML_1);
                        expect(stubUpdateHashes.args[1][1]).to.contain(AssetsUnitTest.ASSET_JPG_1);
                        expect(stubUpdateHashes.args[1][2].path).to.contain(AssetsUnitTest.ASSET_JPG_1);
                        expect(stubUpdateHashes.args[2][1]).to.contain(AssetsUnitTest.ASSET_GIF_1);
                        expect(stubUpdateHashes.args[2][2].path).to.contain(AssetsUnitTest.ASSET_GIF_1);
                        expect(stubUpdateHashes.args[3][1]).to.contain(AssetsUnitTest.ASSET_JAR_1);
                        expect(stubUpdateHashes.args[3][2].path).to.contain(AssetsUnitTest.ASSET_JAR_1);
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
                const stubGet = sinon.stub(assetsREST, "getItems");
                stubGet.onCall(0).resolves([assetMetadata1, assetMetadata2]);
                stubGet.onCall(1).resolves([assetMetadata3, assetMetadata4]);
                stubGet.onCall(2).resolves([assetMetadata5, assetMetadata6]);
                stubGet.onCall(3).resolves([]);

                // Create an assetsFS.getItemWriteStream stub that returns a promise for a stream.
                const stubStream = sinon.stub(assetsFS, "getItemWriteStream");
                const stream1 = AssetsUnitTest.DUMMY_PASS_STREAM;
                const STREAM_TAG_1 = "unique.id.1";
                stream1.tag = STREAM_TAG_1;
                stubStream.onCall(0).resolves(stream1);

                // Create a stub for assetsREST.pullItem that returns a promise for the asset metadata.
                const stubPull = sinon.stub(assetsREST, "pullItem");
                stubPull.onCall(0).resolves(assetMetadata2);

                // Create an assetsFS.saveItem stub that returns asset metadata.
                const stubSave = sinon.stub(assetsFS, "saveItem");
                stubSave.resolves(assetMetadata2);

                // Create spies to listen for the "pulled" and "pulled-error" events.
                const spyPull = sinon.spy();
                assetsHelper.getEventEmitter().on("pulled", spyPull);
                const spyError = sinon.spy();
                assetsHelper.getEventEmitter().on("pulled-error", spyError);

                // The stubs and spies should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubStream);
                self.addTestDouble(stubPull);
                self.addTestDouble(stubSave);

                // Call the method being tested.
                let error;
                assetsHelper.pullAllItems({offset: 0, limit: 2, assetTypes: assetsHelper.ASSET_TYPES_CONTENT_ASSETS})
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
                        expect(stubStream.args[0][0]).to.equal(assetMetadata2.path);

                        // Verify that the pull stub was called once with the expected path and stream.
                        expect(stubPull).to.have.been.calledOnce;
                        expect(stubPull.args[0][0].path).to.equal(assetMetadata2.path);
                        expect(stubPull.args[0][1].tag).to.equal(STREAM_TAG_1);

                        // Verify that the save stub was called once with the expected path and stream.
                        expect(stubSave).to.have.been.calledOnce;
                        expect(stubPull.args[0][0].path).to.equal(assetMetadata2.path);
                        expect(stubPull.args[0][1].tag).to.equal(STREAM_TAG_1);

                        // Verify that the spies were called the expected number of times with the expected values.
                        expect(spyPull).to.have.been.calledOnce;
                        expect(spyPull.args[0][0]).to.equal(assetMetadata2.path);
                        expect(spyError).to.not.have.been.called;

                        // Verify that the hashes were called as expected.
                        expect(stubSetLastPull).to.have.been.calledOnce;

                        expect(stubUpdateHashes).to.have.callCount(1);
                        expect(stubUpdateHashes.args[0][1]).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_2);
                        expect(stubUpdateHashes.args[0][2].path).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_2);
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
                assetsHelper.pullModifiedItems(UnitTest.DUMMY_OPTIONS)
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

            it("should succeed when pulling modified web assets with a pull error.", function (done) {
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

                // Create an assetsREST.getModifiedItems stub that returns a promise for the metadata of the assets.
                const stubGet = sinon.stub(assetsREST, "getModifiedItems");
                stubGet.onCall(0).resolves([assetMetadata1, assetMetadata2]);
                stubGet.onCall(1).resolves([assetMetadata3, assetMetadata4]);
                stubGet.onCall(2).resolves([assetMetadata5, assetMetadata6]);
                stubGet.onCall(3).resolves([]);

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

                // Create a stub for assetsREST.pullItem that returns a promise for the asset metadata.
                const stubPull = sinon.stub(assetsREST, "pullItem");
                stubPull.onCall(0).resolves(assetMetadata1);
                stubPull.onCall(1).resolves(assetMetadata2);
                stubPull.onCall(2).resolves(assetMetadata3);
                stubPull.onCall(3).resolves(assetMetadata4);
                stubPull.onCall(4).resolves(assetMetadata6);

                // Create spies to listen for the "pulled" and "pulled-error" events.
                const spyPull = sinon.spy();
                assetsHelper.getEventEmitter().on("pulled", spyPull);
                const spyError = sinon.spy();
                assetsHelper.getEventEmitter().on("pulled-error", spyError);

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
                assetsHelper.pullModifiedItems({offset: 0, limit: 2, assetTypes: assetsHelper.ASSET_TYPES_WEB_ASSETS})
                    .then(function (assets) {
                        // Verify that the helper returned the expected values.
                        // Note that pullAllAssets is designed to return a metadata array, but currently it does not.
                        if (assets) {
                            expect(assets).to.have.lengthOf(6);
                            expect(assets[0].path).to.equal(assetMetadata1.path);
                            expect(assets[1].path).to.equal(assetMetadata2.path);
                            expect(assets[2].path).to.equal(assetMetadata3.path);
                            expect(assets[3].path).to.equal(assetMetadata4.path);
                            expect(assets[4].name).to.equal("Error");
                            expect(assets[4].message).to.contain("Invalid path");
                            expect(assets[4].message).to.contain(assetMetadata5.path);
                            expect(assets[5].path).to.equal(assetMetadata6.path);
                        }

                        // Verify that the get stub was called four times.
                        expect(stubGet).to.have.callCount(4);

                        // Verify that the stream stub was called five times, each time with the expected path.
                        expect(stubStream).to.have.callCount(5);
                        expect(stubStream.args[0][0]).to.equal(assetMetadata1.path);
                        expect(stubStream.args[1][0]).to.equal(assetMetadata2.path);
                        expect(stubStream.args[2][0]).to.equal(assetMetadata3.path);
                        expect(stubStream.args[3][0]).to.equal(assetMetadata4.path);
                        expect(stubStream.args[4][0]).to.equal(assetMetadata6.path);

                        // Verify that the pull stub was called five times, each time with the expected path and stream.
                        expect(stubPull).to.have.callCount(5);
                        expect(stubPull.args[0][0].path).to.equal(assetMetadata1.path);
                        expect(stubPull.args[1][0].path).to.equal(assetMetadata2.path);
                        expect(stubPull.args[2][0].path).to.equal(assetMetadata3.path);
                        expect(stubPull.args[3][0].path).to.equal(assetMetadata4.path);
                        expect(stubPull.args[4][0].path).to.equal(assetMetadata6.path);
                        expect(stubPull.args[0][1].tag).to.equal(STREAM_TAG_1);
                        expect(stubPull.args[1][1].tag).to.equal(STREAM_TAG_2);
                        expect(stubPull.args[2][1].tag).to.equal(STREAM_TAG_3);
                        expect(stubPull.args[3][1].tag).to.equal(STREAM_TAG_4);
                        expect(stubPull.args[4][1].tag).to.equal(STREAM_TAG_5);

                        // Verify that the spies were called the expected number of times with the expected values.
                        expect(spyPull).to.have.callCount(5);
                        expect(spyPull.args[0][0]).to.equal(assetMetadata1.path);
                        expect(spyPull.args[1][0]).to.equal(assetMetadata2.path);
                        expect(spyPull.args[2][0]).to.equal(assetMetadata3.path);
                        expect(spyPull.args[3][0]).to.equal(assetMetadata4.path);
                        expect(spyPull.args[4][0]).to.equal(assetMetadata6.path);
                        expect(spyError).to.have.been.calledOnce;
                        expect(spyError.args[0][0].name).to.equal("Error");
                        expect(spyError.args[0][0].message).to.contain("Invalid path");
                        expect(spyError.args[0][0].message).to.contain(assetMetadata5.path);
                        expect(spyError.args[0][1]).to.equal(assetMetadata5.path);

                        // Verify that the hashes were called as expected.
                        expect(stubSetLastPull).to.not.have.been.called;

                        expect(stubUpdateHashes).to.have.callCount(5);
                        expect(stubUpdateHashes.args[0][1]).to.contain(AssetsUnitTest.ASSET_HTML_1);
                        expect(stubUpdateHashes.args[0][2].path).to.contain(AssetsUnitTest.ASSET_HTML_1);
                        expect(stubUpdateHashes.args[1][1]).to.contain(AssetsUnitTest.ASSET_CSS_1);
                        expect(stubUpdateHashes.args[1][2].path).to.contain(AssetsUnitTest.ASSET_CSS_1);
                        expect(stubUpdateHashes.args[2][1]).to.contain(AssetsUnitTest.ASSET_JPG_1);
                        expect(stubUpdateHashes.args[2][2].path).to.contain(AssetsUnitTest.ASSET_JPG_1);
                        expect(stubUpdateHashes.args[3][1]).to.contain(AssetsUnitTest.ASSET_GIF_1);
                        expect(stubUpdateHashes.args[3][2].path).to.contain(AssetsUnitTest.ASSET_GIF_1);
                        expect(stubUpdateHashes.args[4][1]).to.contain(AssetsUnitTest.ASSET_JAR_1);
                        expect(stubUpdateHashes.args[4][2].path).to.contain(AssetsUnitTest.ASSET_JAR_1);
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

                // Create an assetsREST.getModifiedRemoteItems stub that returns a promise for asset metadata.
                const stubGet = sinon.stub(assetsREST, "getModifiedItems");
                stubGet.onCall(0).resolves([assetMetadata1, assetMetadata2]);
                stubGet.onCall(1).resolves([assetMetadata3, assetMetadata4]);
                stubGet.onCall(2).resolves([assetMetadata5]);

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

                // Create a stub for assetsREST.pullItem that returns a promise for the asset metadata.
                const stubPull = sinon.stub(assetsREST, "pullItem");
                stubPull.onCall(0).resolves(assetMetadata1);
                stubPull.onCall(1).resolves(assetMetadata2);
                stubPull.onCall(2).resolves(assetMetadata3);
                stubPull.onCall(3).resolves(assetMetadata4);
                stubPull.onCall(4).resolves(assetMetadata5);

                // Create spies to listen for the "pulled" and "pulled-error" events.
                const spyPull = sinon.spy();
                assetsHelper.getEventEmitter().on("pulled", spyPull);
                const spyError = sinon.spy();
                assetsHelper.getEventEmitter().on("pulled-error", spyError);

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
                assetsHelper.pullModifiedItems({offset: 0, limit: 2, assetTypes: assetsHelper.ASSET_TYPES_WEB_ASSETS})
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
                        expect(stubStream.args[0][0]).to.equal(assetMetadata1.path);
                        expect(stubStream.args[1][0]).to.equal(assetMetadata2.path);
                        expect(stubStream.args[2][0]).to.equal(assetMetadata3.path);
                        expect(stubStream.args[3][0]).to.equal(assetMetadata4.path);
                        expect(stubStream.args[4][0]).to.equal(assetMetadata5.path);

                        // Verify that the pull stub was called five times, each time with the expected path and stream.
                        expect(stubPull).to.have.callCount(5);
                        expect(stubPull.args[0][0].path).to.equal(assetMetadata1.path);
                        expect(stubPull.args[1][0].path).to.equal(assetMetadata2.path);
                        expect(stubPull.args[2][0].path).to.equal(assetMetadata3.path);
                        expect(stubPull.args[3][0].path).to.equal(assetMetadata4.path);
                        expect(stubPull.args[4][0].path).to.equal(assetMetadata5.path);
                        expect(stubPull.args[0][1].tag).to.equal(STREAM_TAG_1);
                        expect(stubPull.args[1][1].tag).to.equal(STREAM_TAG_2);
                        expect(stubPull.args[2][1].tag).to.equal(STREAM_TAG_3);
                        expect(stubPull.args[3][1].tag).to.equal(STREAM_TAG_4);
                        expect(stubPull.args[4][1].tag).to.equal(STREAM_TAG_5);

                        // Verify that the spies were called the expected number of times with the expected values.
                        expect(spyPull).to.have.callCount(5);
                        expect(spyPull.args[0][0]).to.equal(assetMetadata1.path);
                        expect(spyPull.args[1][0]).to.equal(assetMetadata2.path);
                        expect(spyPull.args[2][0]).to.equal(assetMetadata3.path);
                        expect(spyPull.args[3][0]).to.equal(assetMetadata4.path);
                        expect(spyPull.args[4][0]).to.equal(assetMetadata5.path);
                        expect(spyError).to.not.have.been.called;

                        // Verify that the hashes were called as expected.
                        expect(stubSetLastPull).to.have.been.calledOnce;

                        expect(stubUpdateHashes).to.have.callCount(5);
                        expect(stubUpdateHashes.args[0][1]).to.contain(AssetsUnitTest.ASSET_HTML_1);
                        expect(stubUpdateHashes.args[0][2].path).to.contain(AssetsUnitTest.ASSET_HTML_1);
                        expect(stubUpdateHashes.args[1][1]).to.contain(AssetsUnitTest.ASSET_CSS_1);
                        expect(stubUpdateHashes.args[1][2].path).to.contain(AssetsUnitTest.ASSET_CSS_1);
                        expect(stubUpdateHashes.args[2][1]).to.contain(AssetsUnitTest.ASSET_JPG_1);
                        expect(stubUpdateHashes.args[2][2].path).to.contain(AssetsUnitTest.ASSET_JPG_1);
                        expect(stubUpdateHashes.args[3][1]).to.contain(AssetsUnitTest.ASSET_GIF_1);
                        expect(stubUpdateHashes.args[3][2].path).to.contain(AssetsUnitTest.ASSET_GIF_1);
                        expect(stubUpdateHashes.args[4][1]).to.contain(AssetsUnitTest.ASSET_JAR_1);
                        expect(stubUpdateHashes.args[4][2].path).to.contain(AssetsUnitTest.ASSET_JAR_1);
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

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stub);
                self.addTestDouble(spy);
                self.addTestDouble(stubIsContentResource);
                self.addTestDouble(stubContentLength);

                // Call the method being tested.
                let error;
                assetsHelper.pushItem(UnitTest.DUMMY_PATH, UnitTest.DUMMY_OPTIONS)
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
                assetsHelper.pushItem(AssetsUnitTest.ASSET_HBS_1, {"workingDir": AssetsUnitTest.API_PATH + UnitTest.VALID_RESOURCES_DIRECTORY})
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
                assetsHelper.pushItem(AssetsUnitTest.DUMMY_PATH, AssetsUnitTest.DUMMY_OPTIONS)
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
                assetsHelper.pushItem(AssetsUnitTest.ASSET_HBS_1, UnitTest.DUMMY_OPTIONS)
                    .then(function (asset) {
                        // Verify that the helper returned the expected value.
                        expect(diff.diffJson(assetMetadata, asset)).to.have.lengthOf(1);

                        // Verify that the FS stub was called once with the specified path (before the REST stub).
                        expect(stubFS).to.have.been.calledOnce;
                        expect(stubFS.firstCall.args[0]).to.equal(AssetsUnitTest.ASSET_HBS_1);
                        expect(stubFS).to.have.been.calledBefore(stubREST);

                        // Verify that the REST stub was called once with the specified path and content.
                        expect(stubREST).to.have.been.calledOnce;
                        expect(stubREST.firstCall.args[4]).to.equal(AssetsUnitTest.ASSET_HBS_1);
                        const streamContent = stubREST.firstCall.args[5].read(65536);
                        expect(Buffer.compare(streamContent, assetContent)).to.equal(0);

                        // Verify that the hashes were called as expected.
                        expect(stubSetLastPush).to.not.have.been.called;

                        expect(stubUpdateHashes).to.have.been.calledOnce;
                        expect(stubUpdateHashes.args[0][1]).to.contain(AssetsUnitTest.ASSET_HBS_1);
                        expect(stubUpdateHashes.args[0][2].path).to.contain(AssetsUnitTest.ASSET_HBS_1);
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
                assetsHelper.pushItem(AssetsUnitTest.ASSET_CONTENT_JPG_3, {workingDir: AssetsUnitTest.VALID_WORKING_DIRECTORY})
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
                            expect(stubFS.firstCall.args[0]).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_3);
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
                assetsHelper.pushItem(AssetsUnitTest.ASSET_CONTENT_JPG_3, {workingDir: AssetsUnitTest.VALID_WORKING_DIRECTORY})
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
                            expect(stubFS.firstCall.args[0]).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_3);
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
                assetsHelper.pushItem(AssetsUnitTest.ASSET_CONTENT_JPG_3, {workingDir: AssetsUnitTest.VALID_WORKING_DIRECTORY})
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
                            expect(stubFS.firstCall.args[0]).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_3);
                            expect(stubFS).to.have.been.calledBefore(stubREST);

                            // Verify that the REST stub was called once with the specified path and content.
                            expect(stubREST).to.have.been.calledOnce;
                            expect(stubREST.firstCall.args[4]).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_3);
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
                stubSave.rejects(ASSET_ERROR);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubFS);
                self.addTestDouble(stubREST);
                self.addTestDouble(stubContentLength);
                self.addTestDouble(stubSave);

                // Call the method being tested.
                let error;
                assetsHelper.pushItem(AssetsUnitTest.ASSET_CONTENT_JPG_3, {workingDir: AssetsUnitTest.VALID_WORKING_DIRECTORY})
                    .then(function (asset) {
                        // Verify that the helper returned the expected value.
                        expect(diff.diffJson(assetMetadata, asset)).to.have.lengthOf(1);

                        // Verify that the FS stub was called once with the specified path (before the REST stub).
                        expect(stubFS).to.have.been.calledOnce;
                        expect(stubFS.firstCall.args[0]).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_3);
                        expect(stubFS).to.have.been.calledBefore(stubREST);

                        // Verify that the REST stub was called once with the specified path and content.
                        expect(stubREST).to.have.been.calledOnce;
                        expect(stubREST.firstCall.args[4]).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_3);
                        const streamContent = stubREST.firstCall.args[5].read(65536);
                        expect(Buffer.compare(streamContent, assetContent)).to.equal(0);

                        // Verify that the save stub was called once.
                        expect(stubSave).to.have.been.calledOnce;

                        // Verify that the hashes were called as expected.
                        expect(stubSetLastPush).to.not.have.been.called;

                        expect(stubUpdateHashes).to.have.been.calledOnce;
                        expect(stubUpdateHashes.args[0][1]).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_3);
                        expect(stubUpdateHashes.args[0][2].path).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_3);
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

                // Create an assetsFS.saveItem stub that returns asset metadata.
                const stubSave = sinon.stub(assetsFS, "saveItem");
                stubSave.resolves(assetMetadata);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubFS);
                self.addTestDouble(stubREST);
                self.addTestDouble(stubContentLength);
                self.addTestDouble(stubSave);

                // Set the option values directly on the options object instead of passing to the helper. The options
                // state is reset after every test.
                options.setOptions({workingDir: AssetsUnitTest.VALID_WORKING_DIRECTORY});

                // Call the method being tested.
                let error;
                assetsHelper.pushItem(AssetsUnitTest.ASSET_CONTENT_JPG_3)
                    .then(function (asset) {
                        // Verify that the helper returned the expected value.
                        expect(diff.diffJson(assetMetadata, asset)).to.have.lengthOf(1);

                        // Verify that the FS stub was called once with the specified path (before the REST stub).
                        expect(stubFS).to.have.been.calledOnce;
                        expect(stubFS.firstCall.args[0]).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_3);
                        expect(stubFS).to.have.been.calledBefore(stubREST);

                        // Verify that the REST stub was called once with the specified path and content.
                        expect(stubREST).to.have.been.calledOnce;
                        expect(stubREST.firstCall.args[4]).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_3);
                        const streamContent = stubREST.firstCall.args[5].read(65536);
                        expect(Buffer.compare(streamContent, assetContent)).to.equal(0);

                        // Verify that the save stub was called once.
                        expect(stubSave).to.have.been.calledOnce;

                        // Verify that the hashes were called as expected.
                        expect(stubSetLastPush).to.not.have.been.called;

                        expect(stubUpdateHashes).to.have.been.calledOnce;
                        expect(stubUpdateHashes.args[0][1]).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_3);
                        expect(stubUpdateHashes.args[0][2].path).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_3);
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
                // Create an assetsHelper.listLocalItemNames stub that returns an error.
                const ASSET_ERROR = "There was an error getting the local assets.";
                const stub = sinon.stub(assetsHelper, "listLocalItemNames");
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
                assetsHelper.pushAllItems(UnitTest.DUMMY_OPTIONS)
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
                // Create an assetsHelper.listLocalItemNames stub that returns a promise for the modified names.
                const stubList = sinon.stub(assetsHelper, "listLocalItemNames");
                stubList.resolves([AssetsUnitTest.ASSET_HTML_1]);

                // Create an assetsHelper.pushItem stub that returns an error.
                const ASSET_ERROR = "There was an error pushing an asset. This error is expected by the test.";
                const stubPush = sinon.stub(assetsHelper, "pushItem");
                stubPush.rejects(ASSET_ERROR);

                // Create a spy that listens for the "pushed-error" event to be emitted.
                const spy = sinon.spy();
                assetsHelper.getEventEmitter().on("pushed-error", spy);

                // Create a stub for assetsFS.isContentResource that returns false.
                const stubIsContentResource = sinon.stub(assetsFS, "isContentResource");
                stubIsContentResource.returns(false);

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stubList);
                self.addTestDouble(stubPush);
                self.addTestDouble(stubIsContentResource);

                // Call the method being tested.
                let error;
                assetsHelper.pushAllItems(UnitTest.DUMMY_OPTIONS)
                    .then(function (assets) {
                        // Verify that no assets were returned.
                        expect(assets).to.have.lengthOf(0);

                        // Verify that the FS stub was called once.
                        expect(stubList).to.be.calledOnce;

                        // Verify that the helper stub was called once.
                        expect(stubPush).to.be.calledOnce;

                        // Verify that the spy was called once and that the expected error is returned.
                        expect(spy).to.be.calledOnce;
                        expect(spy.firstCall.args[0].name).to.equal("Error");
                        expect(spy.firstCall.args[0].message).to.equal(ASSET_ERROR);
                        expect(spy.firstCall.args[1]).to.equal(AssetsUnitTest.ASSET_HTML_1);
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
                    AssetsUnitTest.ASSET_HTML_1,
                    AssetsUnitTest.ASSET_CSS_1,
                    AssetsUnitTest.ASSET_HBS_1,
                    AssetsUnitTest.ASSET_GIF_1,
                    AssetsUnitTest.ASSET_JAR_1,
                    AssetsUnitTest.ASSET_CONTENT_JPG_1
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

                // Create an assetsFS.getItemReadStream stub that returns a promise for the asset content.
                const stubFS = sinon.stub(assetsFS, "getItemReadStream");
                stubFS.withArgs(AssetsUnitTest.ASSET_HTML_1).resolves(htmlStream);
                stubFS.withArgs(AssetsUnitTest.ASSET_CSS_1).resolves(cssStream);
                stubFS.withArgs(AssetsUnitTest.ASSET_HBS_1).resolves(hbsStream);
                stubFS.withArgs(AssetsUnitTest.ASSET_GIF_1).resolves(gifStream);
                stubFS.withArgs(AssetsUnitTest.ASSET_JAR_1).resolves(jarStream);
                stubFS.withArgs(AssetsUnitTest.ASSET_CONTENT_JPG_1).resolves(jpgStream);

                // Create an assetsREST.pushItem stub that returns a promise for asset metadata based on the value of
                // the "pathname" parameter. In this case the stub also emits a stream close event so that subsequent
                // promises will be resolved. And in order to test error handling, one of the stub calls will reject.
                const ASSET_ERROR = "There was an error pushing an asset. This error is expected by the test.";
                const stubREST = sinon.stub(assetsREST, "pushItem", function (isContentResource, replaceContentResource, resourceId, resourceMd5, pathname, stream) {
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
                const spyPushed = sinon.spy();
                const spyError = sinon.spy();
                assetsHelper.getEventEmitter().on("pushed", spyPushed);
                assetsHelper.getEventEmitter().on("pushed-error", spyError);

                // Create a stub for assetsFS.isContentResource that returns false.
                const stubContentLength = sinon.stub(assetsFS, "getContentLength");
                stubContentLength.resolves(0);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubList);
                self.addTestDouble(stubFS);
                self.addTestDouble(stubREST);
                self.addTestDouble(stubContentLength);
                self.addTestDouble(stubSave);

                // Call the method being tested.
                let error;
                assetsHelper.pushAllItems(UnitTest.DUMMY_OPTIONS)
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
                        expect(stubFS.getCall(0).args[0]).to.equal(AssetsUnitTest.ASSET_HTML_1);
                        expect(stubFS.getCall(1).args[0]).to.equal(AssetsUnitTest.ASSET_CSS_1);
                        expect(stubFS.getCall(2).args[0]).to.equal(AssetsUnitTest.ASSET_HBS_1);
                        expect(stubFS.getCall(3).args[0]).to.equal(AssetsUnitTest.ASSET_GIF_1);
                        expect(stubFS.getCall(4).args[0]).to.equal(AssetsUnitTest.ASSET_JAR_1);
                        expect(stubFS.getCall(5).args[0]).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_1);

                        // Verify that the REST stub was called five times, with the expected args, and after the FS stub.
                        expect(stubREST).to.have.callCount(6);
                        expect(stubREST.getCall(0).args[4]).to.equal(AssetsUnitTest.ASSET_HTML_1);
                        expect(stubREST.getCall(1).args[4]).to.equal(AssetsUnitTest.ASSET_CSS_1);
                        expect(stubREST.getCall(2).args[4]).to.equal(AssetsUnitTest.ASSET_HBS_1);
                        expect(stubREST.getCall(3).args[4]).to.equal(AssetsUnitTest.ASSET_GIF_1);
                        expect(stubREST.getCall(4).args[4]).to.equal(AssetsUnitTest.ASSET_JAR_1);
                        expect(stubREST.getCall(5).args[4]).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_1);
                        let requestContent = stubREST.getCall(0).args[5].read(65536);
                        expect(Buffer.compare(htmlContent, requestContent)).to.equal(0);
                        requestContent = stubREST.getCall(1).args[5].read(65536);
                        expect(Buffer.compare(cssContent, requestContent)).to.equal(0);
                        requestContent = stubREST.getCall(2).args[5].read(65536);
                        expect(Buffer.compare(hbsContent, requestContent)).to.equal(0);
                        requestContent = stubREST.getCall(3).args[5].read(65536);
                        expect(Buffer.compare(gifContent, requestContent)).to.equal(0);
                        requestContent = stubREST.getCall(4).args[5].read(65536);
                        expect(Buffer.compare(jarContent, requestContent)).to.equal(0);
                        requestContent = stubREST.getCall(5).args[5].read(65536);
                        expect(Buffer.compare(jpgContent, requestContent)).to.equal(0);
                        expect(stubREST).to.have.been.calledAfter(stubFS);

                        // Verify that the save stub was called once.
                        expect(stubSave).to.have.been.calledOnce;

                        // Verify that the spies were called as expected.
                        expect(spyPushed).to.have.callCount(5);
                        expect(spyPushed.getCall(0).args[0]).to.equal(AssetsUnitTest.ASSET_HTML_1);
                        expect(spyPushed.getCall(1).args[0]).to.equal(AssetsUnitTest.ASSET_CSS_1);
                        expect(spyPushed.getCall(2).args[0]).to.equal(AssetsUnitTest.ASSET_GIF_1);
                        expect(spyPushed.getCall(3).args[0]).to.equal(AssetsUnitTest.ASSET_JAR_1);
                        expect(spyPushed.getCall(4).args[0]).to.equal(AssetsUnitTest.ASSET_CONTENT_JPG_1);
                        expect(spyError).to.have.been.calledOnce;
                        expect(spyError.firstCall.args[0].message).to.equal(ASSET_ERROR);
                        expect(spyError.firstCall.args[1]).to.equal(AssetsUnitTest.ASSET_HBS_1);

                        // Verify that the hashes were called as expected.
                        expect(stubSetLastPush).to.not.have.been.called;

                        expect(stubUpdateHashes).to.have.callCount(5);
                        expect(stubUpdateHashes.args[0][1]).to.contain(AssetsUnitTest.ASSET_HTML_1);
                        expect(stubUpdateHashes.args[0][2].path).to.contain(AssetsUnitTest.ASSET_HTML_1);
                        expect(stubUpdateHashes.args[1][1]).to.contain(AssetsUnitTest.ASSET_CSS_1);
                        expect(stubUpdateHashes.args[1][2].path).to.contain(AssetsUnitTest.ASSET_CSS_1);
                        expect(stubUpdateHashes.args[2][1]).to.contain(AssetsUnitTest.ASSET_GIF_1);
                        expect(stubUpdateHashes.args[2][2].path).to.contain(AssetsUnitTest.ASSET_GIF_1);
                        expect(stubUpdateHashes.args[3][1]).to.contain(AssetsUnitTest.ASSET_JAR_1);
                        expect(stubUpdateHashes.args[3][2].path).to.contain(AssetsUnitTest.ASSET_JAR_1);
                        expect(stubUpdateHashes.args[4][1]).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_1);
                        expect(stubUpdateHashes.args[4][2].path).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_1);
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

    testPushModifiedAssets () {
        const self = this;
        describe("pushModifiedAssets", function () {
            it("should fail when getting the local assets fails.", function (done) {
                // Create an assetsHelper.listModifiedLocalItemNames stub that returns an error.
                const ASSET_ERROR = "There was an error getting the local modified assets.";
                const stub = sinon.stub(assetsHelper, "listModifiedLocalItemNames");
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
                assetsHelper.pushModifiedItems(UnitTest.DUMMY_OPTIONS)
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
                // Create an assetsHelper.listModifiedLocalItemNames stub that returns a promise for the modified names.
                const stubList = sinon.stub(assetsHelper, "listModifiedLocalItemNames");
                stubList.resolves([AssetsUnitTest.ASSET_HTML_1]);

                // Create an assetsHelper.pushItem stub that returns an error.
                const ASSET_ERROR = "There was an error pushing an asset. This error is expected by the test.";
                const stubPush = sinon.stub(assetsHelper, "pushItem");
                stubPush.rejects(ASSET_ERROR);

                // Create a spy that listens for the "pushed-error" event to be emitted.
                const spy = sinon.spy();
                assetsHelper.getEventEmitter().on("pushed-error", spy);

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stubList);
                self.addTestDouble(stubPush);

                // Call the method being tested.
                let error;
                assetsHelper.pushModifiedItems(UnitTest.DUMMY_OPTIONS)
                    .then(function (assets) {
                        // Verify that no assets were returned.
                        expect(assets).to.have.lengthOf(0);

                        // Verify that the FS stub was called once.
                        expect(stubList).to.be.calledOnce;

                        // Verify that the helper stub was called once.
                        expect(stubPush).to.be.calledOnce;

                        // Verify that the spy was called once and that the expected error is returned.
                        expect(spy).to.be.calledOnce;
                        expect(spy.firstCall.args[0].name).to.equal("Error");
                        expect(spy.firstCall.args[0].message).to.equal(ASSET_ERROR);
                        expect(spy.firstCall.args[1]).to.equal(AssetsUnitTest.ASSET_HTML_1);
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
                    AssetsUnitTest.ASSET_HTML_1,
                    AssetsUnitTest.ASSET_CSS_1,
                    AssetsUnitTest.ASSET_HBS_1
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

                // Create an assetsFS.listNames stub that returns a promise for the modified names.
                const stubList = sinon.stub(assetsFS, "listNames");
                stubList.resolves(modifiedAssetNames);

                // Create an assetsFS.getFileStats stub that returns a promise for the local asset file stats.
                const stubStats = sinon.stub(assetsFS, "getFileStats");
                stubStats.withArgs(AssetsUnitTest.ASSET_HTML_1).resolves({ctime: "2020-01-01T00:00Z"}); // Modified
                stubStats.withArgs(AssetsUnitTest.ASSET_CSS_1).resolves({ctime: "2020-01-01T00:00Z"}); // Modified
                stubStats.withArgs(AssetsUnitTest.ASSET_HBS_1).resolves({ctime: "2020-01-01T00:00Z"}); // Modified

                // Create an assetsFS.getItemReadStream stub that returns a promise for the asset content.
                const stubGet = sinon.stub(assetsFS, "getItemReadStream");
                stubGet.withArgs(AssetsUnitTest.ASSET_HTML_1).resolves(htmlStream);
                stubGet.withArgs(AssetsUnitTest.ASSET_CSS_1).resolves(cssStream);
                stubGet.withArgs(AssetsUnitTest.ASSET_HBS_1).resolves(hbsStream);

                // Create an assetsREST.pushItem stub that returns a promise for asset metadata based on the value of
                // the "pathname" parameter. In this case the stub also emits a stream close event so that subsequent
                // promises will be resolved. And in order to test error handling, one of the stub calls will reject.
                const ASSET_ERROR = "There was an error pushing an asset. This error is expected by the test.";
                const stubPush = sinon.stub(assetsREST, "pushItem", function (isContentResource, replaceContentResource, resourceId, resourceMd5, pathname, stream) {
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
                const spySuccess = sinon.spy();
                const spyError = sinon.spy();
                assetsHelper.getEventEmitter().on("pushed", spySuccess);
                assetsHelper.getEventEmitter().on("pushed-error", spyError);

                // Create a stub for assetsFS.isContentResource that returns false.
                const stubIsContentResource = sinon.stub(assetsFS, "isContentResource");
                stubIsContentResource.returns(false);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubList);
                self.addTestDouble(stubStats);
                self.addTestDouble(stubGet);
                self.addTestDouble(stubPush);
                self.addTestDouble(stubIsContentResource);

                // Call the method being tested.
                let error;
                assetsHelper.pushModifiedItems({workingDir: AssetsUnitTest.VALID_WORKING_DIRECTORY})
                    .then(function (assets) {
                        // Verify that the helper returned the resolved content, but not the rejected content.
                        expect(assets).to.have.lengthOf(2);

                        // Verify that the list stub was called once.
                        expect(stubList).to.have.been.calledOnce;

                        // Verify that the stats stub was called three times.
                        expect(stubStats).to.have.been.calledThrice;

                        // Verify that the get stub was called three times, once with each specified path.
                        expect(stubGet).to.have.been.calledThrice;
                        expect(stubGet.firstCall.args[0]).to.equal(AssetsUnitTest.ASSET_HTML_1);
                        expect(stubGet.secondCall.args[0]).to.equal(AssetsUnitTest.ASSET_CSS_1);
                        expect(stubGet.thirdCall.args[0]).to.equal(AssetsUnitTest.ASSET_HBS_1);

                        // Verify that the push stub was called three times, once with each specified path and stream.
                        expect(stubPush).to.have.been.calledThrice;
                        expect(stubPush.firstCall.args[4]).to.equal(AssetsUnitTest.ASSET_HTML_1);
                        expect(stubPush.secondCall.args[4]).to.equal(AssetsUnitTest.ASSET_CSS_1);
                        expect(stubPush.thirdCall.args[4]).to.equal(AssetsUnitTest.ASSET_HBS_1);
                        let requestContent = stubPush.firstCall.args[5].read(65536);
                        expect(Buffer.compare(htmlContent, requestContent)).to.equal(0);
                        requestContent = stubPush.secondCall.args[5].read(65536);
                        expect(Buffer.compare(cssContent, requestContent)).to.equal(0);
                        requestContent = stubPush.thirdCall.args[5].read(65536);
                        expect(Buffer.compare(hbsContent, requestContent)).to.equal(0);

                        // Verify that the get and push stubs were called in the order expected.
                        expect(stubPush).to.be.calledAfter(stubGet);

                        // Verify that the spies were called as expected.
                        expect(spySuccess).to.have.been.calledTwice;
                        expect(spySuccess.firstCall.args[0]).to.equal(AssetsUnitTest.ASSET_HTML_1);
                        expect(spySuccess.secondCall.args[0]).to.equal(AssetsUnitTest.ASSET_CSS_1);
                        expect(spyError).to.have.been.calledOnce;
                        expect(spyError.firstCall.args[0].message).to.equal(ASSET_ERROR);
                        expect(spyError.firstCall.args[1]).to.equal(AssetsUnitTest.ASSET_HBS_1);

                        // Verify that the hashes were called as expected.
                        expect(stubGetHashesForFile).to.have.been.calledThrice;
                        expect(stubGetHashesForFile.firstCall.args[1]).to.contain(AssetsUnitTest.ASSET_HTML_1);
                        expect(stubGetHashesForFile.secondCall.args[1]).to.contain(AssetsUnitTest.ASSET_CSS_1);
                        expect(stubGetHashesForFile.thirdCall.args[1]).to.contain(AssetsUnitTest.ASSET_HBS_1);

                        expect(stubSetLastPull).to.not.have.been.called;

                        expect(stubSetLastPush).to.not.have.been.called;

                        expect(stubUpdateHashes).to.have.been.calledTwice;
                        expect(stubUpdateHashes.firstCall.args[1]).to.contain(AssetsUnitTest.ASSET_HTML_1);
                        expect(stubUpdateHashes.firstCall.args[2].path).to.contain(AssetsUnitTest.ASSET_HTML_1);
                        expect(stubUpdateHashes.secondCall.args[1]).to.contain(AssetsUnitTest.ASSET_CSS_1);
                        expect(stubUpdateHashes.secondCall.args[2].path).to.contain(AssetsUnitTest.ASSET_CSS_1);
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
                assetsHelper.listRemoteItemNames(UnitTest.DUMMY_OPTIONS)
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
                assetsHelper.listRemoteItemNames({assetTypes: assetsHelper.ASSET_TYPES_WEB_ASSETS})
                    .then(function (names) {
                        // Verify that the helper returned the expected values.
                        expect(names).to.have.lengthOf(5);
                        expect(names[0]).to.contain(AssetsUnitTest.ASSET_HTML_1);
                        expect(names[1]).to.contain(AssetsUnitTest.ASSET_GIF_1);
                        expect(names[2]).to.contain(AssetsUnitTest.ASSET_PNG_1);
                        expect(names[3]).to.contain(AssetsUnitTest.ASSET_CSS_1);
                        expect(names[4]).to.contain(AssetsUnitTest.ASSET_JAR_1);

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
                const stub = sinon.stub(assetsREST, "getItems");
                stub.onCall(0).resolves([assetMetadata1, assetMetadata2, assetMetadata3, assetMetadata4]);
                stub.onCall(1).resolves([assetMetadata5]);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Set the option values directly on the options object instead of passing to the helper. The options
                // state is reset after every test.
                options.setOptions({assets: {offset: 0, limit: 4}});

                // Call the method being tested.
                let error;
                assetsHelper.listRemoteItemNames()
                    .then(function (names) {
                        // Verify that the helper returned the expected values.
                        expect(names).to.have.lengthOf(5);
                        expect(names[0]).to.contain(AssetsUnitTest.ASSET_HTML_1);
                        expect(names[1]).to.contain(AssetsUnitTest.ASSET_GIF_1);
                        expect(names[2]).to.contain(AssetsUnitTest.ASSET_PNG_1);
                        expect(names[3]).to.contain(AssetsUnitTest.ASSET_CSS_1);
                        expect(names[4]).to.contain(AssetsUnitTest.ASSET_JAR_1);

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
                const stub = sinon.stub(assetsREST, "getItems");
                stub.onCall(0).resolves([assetMetadata1, assetMetadata2, assetMetadata3]);
                stub.onCall(1).resolves([assetMetadata4, assetMetadata5]);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsHelper.listRemoteItemNames({offset: 0, limit: 3, assetTypes: assetsHelper.ASSET_TYPES_WEB_ASSETS})
                    .then(function (names) {
                        // Verify that the helper returned the expected values.
                        expect(names).to.have.lengthOf(4);
                        expect(names[0]).to.contain(AssetsUnitTest.ASSET_HTML_1);
                        expect(names[1]).to.contain(AssetsUnitTest.ASSET_PNG_1);
                        expect(names[2]).to.contain(AssetsUnitTest.ASSET_CSS_1);
                        expect(names[3]).to.contain(AssetsUnitTest.ASSET_JAR_1);

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
                const stub = sinon.stub(assetsREST, "getItems");
                stub.onCall(0).resolves([assetMetadata1, assetMetadata2, assetMetadata3]);
                stub.onCall(1).resolves([assetMetadata4, assetMetadata5]);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsHelper.listRemoteItemNames({offset: 0, limit: 3, assetTypes: assetsHelper.ASSET_TYPES_CONTENT_ASSETS})
                    .then(function (names) {
                        // Verify that the stub was called once.
                        expect(stub).to.have.been.calledTwice;

                        // Verify that the helper returned the expected values.
                        expect(names).to.have.lengthOf(1);
                        expect(names[0]).to.contain(AssetsUnitTest.ASSET_CONTENT_JPG_1);
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
                assetsHelper.listRemoteDeletedNames(UnitTest.DUMMY_OPTIONS)
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
                const stubRemote = sinon.stub(assetsREST, "getItems");
                stubRemote.onCall(0).resolves([assetMetadata1, assetMetadata3]);
                stubRemote.onCall(1).resolves([assetMetadata5]);

                // Create a non-default stub for hashes.listFiles that returns the local asset paths.
                stubListFiles.restore();
                stubListFiles = sinon.stub(hashes, "listFiles");
                stubListFiles.returns([AssetsUnitTest.ASSET_HTML_1, AssetsUnitTest.ASSET_GIF_1, AssetsUnitTest.ASSET_PNG_1, AssetsUnitTest.ASSET_CSS_1, AssetsUnitTest.ASSET_JAR_1]);

                // The remote stub should be restored when the test is complete. (The list files stub is restored by the afterEach function.)
                self.addTestDouble(stubRemote);

                // Call the method being tested.
                let error;
                assetsHelper.listRemoteDeletedNames({offset: 0, limit: 2})
                    .then(function (names) {
                        // Verify that the helper returned the expected values.
                        expect(names).to.have.lengthOf(2);

                        // ASSET_GIF_1 should have been identified as having been deleted.
                        expect(names[0]).to.contain(AssetsUnitTest.ASSET_GIF_1);

                        // ASSET_CSS_1 should have been identified as having been deleted.
                        expect(names[1]).to.contain(AssetsUnitTest.ASSET_CSS_1);

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
                assetsHelper.listModifiedRemoteItemNames([assetsHelper.MODIFIED], UnitTest.DUMMY_OPTIONS)
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
                assetsHelper.listModifiedRemoteItemNames([assetsHelper.MODIFIED], UnitTest.DUMMY_OPTIONS)
                    .then(function (names) {
                        // Verify that the helper returned the expected values.
                        expect(names).to.have.lengthOf(5);
                        expect(names[0]).to.contain(AssetsUnitTest.ASSET_HTML_1);
                        expect(names[1]).to.contain(AssetsUnitTest.ASSET_GIF_1);
                        expect(names[2]).to.contain(AssetsUnitTest.ASSET_PNG_1);
                        expect(names[3]).to.contain(AssetsUnitTest.ASSET_CSS_1);
                        expect(names[4]).to.contain(AssetsUnitTest.ASSET_JAR_1);

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
                stubDeleted.resolves([AssetsUnitTest.ASSET_CSS_1, AssetsUnitTest.ASSET_JAR_1]);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubModified);
                self.addTestDouble(stubDeleted);

                // Call the method being tested.
                let error;
                assetsHelper.listModifiedRemoteItemNames([assetsHelper.MODIFIED, assetsHelper.DELETED], UnitTest.DUMMY_OPTIONS)
                    .then(function (names) {
                        // Verify that the helper returned the expected values.
                        expect(names).to.have.lengthOf(5);
                        expect(names[0]).to.contain(AssetsUnitTest.ASSET_HTML_1);
                        expect(names[1]).to.contain(AssetsUnitTest.ASSET_GIF_1);
                        expect(names[2]).to.contain(AssetsUnitTest.ASSET_PNG_1);
                        expect(names[3]).to.contain(AssetsUnitTest.ASSET_CSS_1);
                        expect(names[4]).to.contain(AssetsUnitTest.ASSET_JAR_1);

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
                assetsHelper.listLocalItemNames(UnitTest.DUMMY_OPTIONS)
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
                assetsHelper.listLocalItemNames(UnitTest.DUMMY_OPTIONS)
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
                assetsHelper.listModifiedLocalItemNames([assetsHelper.NEW, assetsHelper.MODIFIED], UnitTest.DUMMY_OPTIONS)
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
                    AssetsUnitTest.ASSET_HTML_1,
                    AssetsUnitTest.ASSET_HTML_2,
                    AssetsUnitTest.ASSET_HTML_3,
                    AssetsUnitTest.ASSET_CSS_1,
                    AssetsUnitTest.ASSET_CSS_2,
                    AssetsUnitTest.ASSET_HBS_1,
                    AssetsUnitTest.ASSET_HBS_2
                ];

                // Create an assetsFS.listNames stub that returns a promise for the local asset names.
                const stubNames = sinon.stub(assetsFS, "listNames");
                stubNames.resolves(assetNames);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubNames);

                // Call the method being tested.
                let error;
                assetsHelper.listModifiedLocalItemNames([assetsHelper.NEW, assetsHelper.MODIFIED], UnitTest.DUMMY_OPTIONS)
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

            it("should succeed when getting a list of modified and deleted local asset names.", function (done) {
                // List of multiple local asset names.
                const assetNames = [
                    AssetsUnitTest.ASSET_HTML_1,
                    AssetsUnitTest.ASSET_HTML_2,
                    AssetsUnitTest.ASSET_HTML_3,
                    AssetsUnitTest.ASSET_CSS_1,
                    AssetsUnitTest.ASSET_CSS_2,
                    AssetsUnitTest.ASSET_HBS_1,
                    AssetsUnitTest.ASSET_HBS_2
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
                assetsHelper.listModifiedLocalItemNames([assetsHelper.MODIFIED, assetsHelper.DELETED], UnitTest.DUMMY_OPTIONS)
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
                    AssetsUnitTest.ASSET_HTML_1,
                    AssetsUnitTest.ASSET_HTML_2,
                    AssetsUnitTest.ASSET_HTML_3,
                    AssetsUnitTest.ASSET_CSS_1,
                    AssetsUnitTest.ASSET_CSS_2,
                    AssetsUnitTest.ASSET_HBS_1,
                    AssetsUnitTest.ASSET_HBS_2
                ];

                // Create a non-default stub for hashes.listFiles that returns the local asset paths.
                stubListFiles.restore();
                stubListFiles = sinon.stub(hashes, "listFiles");
                stubListFiles.returns(assetNames);

                // Create an fs.stats stub that returns a value for some assets, and no value for others.
                const stubStats = sinon.stub(fs, "statSync");
                const dir = assetsFS.getDir();
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
                assetsHelper.listLocalDeletedNames(UnitTest.DUMMY_OPTIONS)
                    .then(function (names) {
                        // Verify that the helper returned the expected value.
                        expect(names).to.have.lengthOf(4);
                        expect(names[0]).to.be.oneOf([AssetsUnitTest.ASSET_HTML_2, AssetsUnitTest.ASSET_HTML_3, AssetsUnitTest.ASSET_CSS_2, AssetsUnitTest.ASSET_HBS_2]);
                        expect(names[1]).to.be.oneOf([AssetsUnitTest.ASSET_HTML_2, AssetsUnitTest.ASSET_HTML_3, AssetsUnitTest.ASSET_CSS_2, AssetsUnitTest.ASSET_HBS_2]);
                        expect(names[2]).to.be.oneOf([AssetsUnitTest.ASSET_HTML_2, AssetsUnitTest.ASSET_HTML_3, AssetsUnitTest.ASSET_CSS_2, AssetsUnitTest.ASSET_HBS_2]);
                        expect(names[3]).to.be.oneOf([AssetsUnitTest.ASSET_HTML_2, AssetsUnitTest.ASSET_HTML_3, AssetsUnitTest.ASSET_CSS_2, AssetsUnitTest.ASSET_HBS_2]);

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
                assetsHelper.deleteRemoteItem(UnitTest.DUMMY_METADATA, UnitTest.DUMMY_OPTIONS)
                    .then(function (/*assets*/) {
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
                assetsHelper.deleteRemoteItem(UnitTest.DUMMY_METADATA, UnitTest.DUMMY_OPTIONS)
                    .then(function (message) {
                        // Verify that the helper returned the expected message.
                        expect(message).to.equal(DELETE_MESSAGE);

                        // Verify that the delete stub was called once with the expected id.
                        expect(stubDelete).to.have.been.calledOnce;
                        expect(stubDelete.firstCall.args[0].id).to.equal(UnitTest.DUMMY_METADATA.id);

                        // Verify that the remote asset is no longer registered with the helper.
                        expect(assetsHelper.existsRemotely(UnitTest.DUMMY_METADATA.path)).to.equal(false);
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

module.exports = AssetsHelperUnitTest;
