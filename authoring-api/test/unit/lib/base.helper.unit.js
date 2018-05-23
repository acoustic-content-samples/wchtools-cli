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
 * Unit tests for the base helper object.
 *
 * NOTE: The EventEmitter used by the assetsHelper object is used to execute some of the tests,
 *       so the provided functionality is not stubbed out.
 */
"use strict";

// Require the super classes for this class.
const UnitTest = require("./base.unit.js");

// Require the node modules used in this test file.
const fs = require("fs");
const Q = require("q");
const rimraf = require("rimraf");
const diff = require("diff");
const sinon = require("sinon");
const manifests = require(UnitTest.API_PATH + "lib/utils/manifests.js");
const hashes = require(UnitTest.API_PATH + "lib/utils/hashes.js");
const utils = require(UnitTest.API_PATH + "lib/utils/utils.js");
const options = require(UnitTest.API_PATH + "lib/utils/options.js");
const BaseHelper = require(UnitTest.API_PATH + "baseHelper.js");
const searchREST = require(UnitTest.API_PATH + "lib/authoringSearchREST.js").instance;

// The default API context used for unit tests.
const context = UnitTest.DEFAULT_API_CONTEXT;

class BaseHelperUnitTest extends UnitTest {
    constructor () {
        super();
    }

    run (restApi, fsApi, helper, path1, path2, badPath) {
        const self = this;
        const type =  fsApi.getFolderName(context);

        // The contents of the test item metadata files.
        const itemMetadata1 = UnitTest.getJsonObject(path1);
        const itemMetadata2 = UnitTest.getJsonObject(path2);
        const badMetadata = UnitTest.getJsonObject(badPath);
        describe("Unit tests for Helper " + restApi.getServiceName(), function () {
            // Initialize common resourses before running the unit tests.
            before(function (done) {
                UnitTest.restoreOptions(context);

                // Remove the artifact folder before the tests are run.
                rimraf.sync(fsApi.getPath(context));

                // Signal that the cleanup is complete.
                done();
            });

            // Cleanup common resourses consumed by a test.
            afterEach(function (done) {
                // Restore any stubs and spies used for the test.
                self.restoreTestDoubles();

                // Signal that the cleanup is complete.
                done();
            });

            // Cleanup common resourses after running the tests.
            after(function (done) {
                // Remove the artifact folder.
                rimraf.sync(fsApi.getPath(context));

                // Signal that the cleanup is complete.
                done();
            });

            // Run each of the tests defined in this class.
            self.testSingleton(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testStaticGetters();
            self.testEventEmitter(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testGetVirtualFolderName(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testGetLocalItem(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testGetLocalItems(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testGetRemoteItemByPath(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testGetRemoteItems(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testInitializeRetryPush(helper);
            self.testMiscellaneous(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testCreateRemoteItem(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testPushItem(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testPushAllItems(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testPushModifiedItems(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testPushManifestItems(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testPullItem(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testPullAllItems(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testPullModifiedItems(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testPullManifestItems(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testListLocalItemNames(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testListRemoteItemNames(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testListLocalDeletedNames(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testListRemoteDeletedNames(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testListModifiedLocalItemNames(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testListModifiedRemoteItemNames(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testDeleteLocalItem(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testDeleteRemoteItem(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testDeleteRemoteItems(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testGetManifestItems(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testDeleteManifestItems(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);

            // Execute any additional tests defined by a subclass. Executing the tests here allows them to be within the
            // same "describe" as the base helper tests, and allows them to leverage the same before and after functions.
            self.runAdditionalTests(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
        });
    }

    runAdditionalTests (restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata) {
    }

    testSingleton (restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata) {
        describe("is a singleton", function () {
            it("should fail if try to create a helper Type", function (done) {
                let error;
                try {
                   const newHelper = new helper.constructor();
                    if (newHelper) {
                        error = "The constructor should have failed.";
                    } else {
                        error = "The constructor should have thrown an error.";
                    }
                } catch (e){
                    expect(e).to.equal("An instance of singleton class " + helper.constructor.name + " cannot be constructed");
                }

                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
        });
    }

    testStaticGetters () {
        describe("static getters", function () {
            it("should succeed getting the various statis values", function (done) {
                expect(BaseHelper.RETRY_PUSH_ITEM_COUNT).to.exist;
                expect(BaseHelper.RETRY_PUSH_ITEMS).to.exist;
                expect(BaseHelper.RETRY_PUSH_ITEM_NAME).to.exist;
                expect(BaseHelper.RETRY_PUSH_ITEM_HEADING).to.exist;
                expect(BaseHelper.RETRY_PUSH_ITEM_ERROR).to.exist;
                expect(BaseHelper.RETRY_PUSH_ITEM_DELAY).to.exist;

                // Call mocha's done function to indicate that the test is over.
                done();
            });
        });
    }

    testEventEmitter (restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata) {
        describe("event emitter", function () {
            it("should call registered functions when an event is emitted.", function () {
                // Setup several spies to listen for emitted events.
                const spyA1 = sinon.spy();
                const spyA2 = sinon.spy();
                const spyB = sinon.spy();
                const spyC = sinon.spy();

                // Use some events that are just for testing, they don't need to correspond to actual system events.
                const eventEmitter = helper.getEventEmitter(context);
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

    testGetVirtualFolderName (restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata) {
        const self = this;
        describe("getVirtualFolderName", function () {
            it("should get the item folder name from the FS API.", function () {
                const nooptFolder = helper.getVirtualFolderName(context, {"noVirtualFolder":true});
                expect(nooptFolder).to.equal("");

                // Create an fsApi.getFolderName stub that returns the folder name.
                const FAKE_FOLDER_NAME = "Fake name for the items folder.";
                const stub = sinon.stub(fsApi, "getFolderName");
                stub.returns(FAKE_FOLDER_NAME);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                const folderName = helper.getVirtualFolderName(context);

                // Verify that the stub was called and that the helper returned the expected value.
                expect(stub).to.have.been.calledOnce;
                expect(folderName).to.equal(FAKE_FOLDER_NAME);
            });
        });
    }

    testGetLocalItem (restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata) {
        const self = this;
        describe("getLocalItem", function () {
            it("should fail when there is an error getting local item.", function (done) {
                // Create an restApi.getItems stub that returns an error.
                const ITEMS_ERROR = "There was an error getting the local item.";
                const stub = sinon.stub(fsApi, "getItem");
                stub.rejects(ITEMS_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                helper.getLocalItem(context, "jdfjkfd", UnitTest.DUMMY_OPTIONS)
                    .then(function (/*item*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the item should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once and the expected error was returned.
                            expect(stub).to.be.calledOnce;
                            expect(err.message).to.equal(ITEMS_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when getting local item.", function (done) {
                // Create an restApi.getItems stub that returns a promise for the metadata of the items.
                const stub = sinon.stub(fsApi, "getItem");
                stub.resolves(itemMetadata1);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                helper.getLocalItem(context, itemMetadata1.name, UnitTest.DUMMY_OPTIONS)
                    .then(function (item) {
                        // Verify that the stub was called once and that the helper returned the expected values.
                        expect(stub).to.have.been.calledOnce;
                        expect(diff.diffJson(itemMetadata1, item)).to.have.lengthOf(1);
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

    testGetLocalItems (restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata) {
        const self = this;
        describe("getLocalItems", function () {
            it("should fail when there is an error getting local items.", function (done) {
                // Create an restApi.getItems stub that returns an error.
                const ITEMS_ERROR = "There was an error getting the local items.";
                const stub = sinon.stub(fsApi, "getItems");
                stub.rejects(ITEMS_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                helper.getLocalItems(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (/*items*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the items should have been rejected.");
                    })
                    .catch(function (/*err*/) {
                        try {
                            // Verify that the stub was called once.
                            expect(stub).to.be.calledOnce;
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when getting multiple local items.", function (done) {
                // Create an restApi.getItems stub that returns a promise for the metadata of the items.
                const stub = sinon.stub(fsApi, "getItems");
                stub.resolves([itemMetadata1, itemMetadata2, badMetadata]);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                helper.getLocalItems(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (items) {
                        // Verify that the stub was called once and that the helper returned the expected values.
                        expect(stub).to.have.been.calledOnce;
                        expect(diff.diffJson(itemMetadata1, items[0])).to.have.lengthOf(1);
                        expect(diff.diffJson(itemMetadata2, items[1])).to.have.lengthOf(1);
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

    testGetRemoteItemByPath (restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata) {
        const self = this;
        describe("getRemoteItemByPath", function () {
            it("should fail when there is an error getting the remote item.", function (done) {
                // Create a restApi.getItemByPath stub that returns an error.
                const ITEM_ERROR = "There was an error getting the remote item.";
                const stub = sinon.stub(restApi, "getItemByPath");
                stub.rejects(ITEM_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                helper.getRemoteItemByPath(context, UnitTest.DUMMY_PATH, UnitTest.DUMMY_OPTIONS)
                    .then(function (/*items*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the remote item should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once and the expected error was returned.
                        expect(stub).to.be.calledOnce;
                        expect(err.message).to.contain(ITEM_ERROR);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when getting a remote item.", function (done) {
                // Create an restApi.getItemByPath stub that returns a promise for the metadata of the items.
                const stub = sinon.stub(restApi, "getItemByPath");
                stub.resolves(itemMetadata1);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                helper.getRemoteItemByPath(context, UnitTest.DUMMY_PATH, UnitTest.DUMMY_OPTIONS)
                    .then(function (item) {
                        // Verify that the stub was called once and that the helper returned the expected value.
                        expect(stub).to.have.been.calledOnce;
                        expect(diff.diffJson(itemMetadata1, item)).to.have.lengthOf(1);
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

    testGetRemoteItems (restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata) {
        const self = this;
        describe("getRemoteItems", function () {
            it("should fail when there is an error getting remote items.", function (done) {
                // Create a restApi.getItems stub that returns an error.
                const ITEMS_ERROR = "There was an error getting the remote items.";
                const stub = sinon.stub(restApi, "getItems");
                stub.rejects(ITEMS_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                helper.getRemoteItems(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (/*items*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the remote items should have been rejected.");
                    })
                    .catch(function (/*err*/) {
                        try {
                            // Verify that the stub was called once.
                            expect(stub).to.be.calledOnce;
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when getting multiple remote items.", function (done) {
                // Create an restApi.getItems stub that returns a promise for the metadata of the items.
                const stub = sinon.stub(restApi, "getItems");
                stub.resolves([itemMetadata1, itemMetadata2, badMetadata]);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                helper.getRemoteItems(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (items) {
                        // Verify that the stub was called once and that the helper returned the expected values.
                        expect(stub).to.have.been.calledOnce;
                        expect(diff.diffJson(itemMetadata1, items[0])).to.have.lengthOf(1);
                        expect(diff.diffJson(itemMetadata2, items[1])).to.have.lengthOf(1);
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

    testInitializeRetryPush (helper) {
        describe("initializeRetryPush", function () {
            it("should succeed when initializing the retry push properties.", function (done) {
                let context = {};
                helper.initializeRetryPush(context, null);
                expect(context.retryPush[BaseHelper.RETRY_PUSH_ITEM_COUNT]).to.equal(0);
                expect(context.retryPush[BaseHelper.RETRY_PUSH_ITEMS]).to.have.lengthOf(0);

                context = {};
                helper.initializeRetryPush(context, ["foo", "bar"]);
                expect(context.retryPush[BaseHelper.RETRY_PUSH_ITEM_COUNT]).to.equal(2);
                expect(context.retryPush[BaseHelper.RETRY_PUSH_ITEMS]).to.have.lengthOf(0);

                done();
            });
        });
    }

    testCreateRemoteItem (restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata) {
        const self = this;
        describe("createRemoteItem", function () {
            it("should fail when there is an error creating remote items.", function (done) {
                // Create an restApi.getItems stub that returns an error.
                const ITEMS_ERROR = "There was an error creating the remote items.";
                const stub = sinon.stub(restApi, "createItem");
                stub.rejects(ITEMS_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                helper.createRemoteItem(context, null, UnitTest.DUMMY_OPTIONS)
                    .then(function (/*item*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the remote items should have been rejected.");
                    })
                    .catch(function (/*err*/) {
                        try {
                            // Verify that the stub was called once.
                            expect(stub).to.be.calledOnce;
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when createItem remote items.", function (done) {
                // Create an restApi.getItems stub that returns a promise for the metadata of the items.
                const stub = sinon.stub(restApi, "createItem");
                stub.resolves(itemMetadata1);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                helper.createRemoteItem(context, itemMetadata1, UnitTest.DUMMY_OPTIONS)
                    .then(function (item) {
                        // Verify that the stub was called once and that the helper returned the expected values.
                        expect(stub).to.have.been.calledOnce;
                        expect(diff.diffJson(itemMetadata1, item)).to.have.lengthOf(1);
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

    testPullItem (restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata) {
        const self = this;
        describe("pullItem", function () {
            it("should fail when the specified item is not found.", function (done) {
                // Create a restApi.getItem stub that returns an error.
                const ITEM_ERROR = "An item with the specified ID was not found.";
                const stub = sinon.stub(restApi, "getItem");
                stub.rejects(ITEM_ERROR);

                // Create an fsApi.saveItem spy.
                const spySave = sinon.spy(fsApi, "saveItem");

                // Remove the emitter from the context to make sure the method still works without it.
                const emitter = helper.getEventEmitter(context);
                delete context.eventEmitter;
                const spyPull = sinon.spy();
                emitter.on("pulled", spyPull);
                const spyError = sinon.spy();
                emitter.on("pulled-error", spyError);

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stub);
                self.addTestDouble(spySave);

                // Call the method being tested.
                let error;
                helper.pullItem(context, UnitTest.DUMMY_ID, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the pulled item should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub and the spy were called.
                            expect(stub).to.have.been.calledOnce;

                            // Verify that the expected error is returned.
                            expect(err.message).to.equal(ITEM_ERROR);

                            // Verify that the save spy was not called.
                            expect(spySave).to.not.have.been.called;

                            // Verify that the pulled spy and the error spy were not called.
                            expect(spyPull).to.not.have.been.called;
                            expect(spyError).to.not.have.been.called;
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        context.eventEmitter = emitter;

                        emitter.removeListener("pulled", spyPull);
                        emitter.removeListener("pulled-error", spyError);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when the specified item is not found, no emitter.", function (done) {
                // Create a restApi.getItem stub that returns an error.
                const ITEM_ERROR = "An item with the specified ID was not found.";
                const stub = sinon.stub(restApi, "getItem");
                stub.rejects(ITEM_ERROR);

                // Create a spy to listen for the "pulled-error" event.
                const emitter = helper.getEventEmitter(context);
                const spy = sinon.spy();
                emitter.on("pulled-error", spy);

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                helper.pullItem(context, UnitTest.DUMMY_ID, UnitTest.DUMMY_OPTIONS)
                    .then(function (/*item*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the pulled item should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub and the spy were called.
                            expect(stub).to.have.been.called;
                            expect(spy).to.have.been.called;

                            // Verify that the expected error is returned.
                            expect(err.message).to.equal(ITEM_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        emitter.removeListener("pulled-error", spy);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when no path is specified.", function (done) {
                // Create a restApi.getItem stub that returns the contents of a test file.
                const stubRest = sinon.stub(restApi, "getItem");
                stubRest.resolves(itemMetadata1);

                // Create an fsApi.saveItem stub that returns an error.
                const ITEM_ERROR = "The item could not be saved.";
                const stubFs = sinon.stub(fsApi, "saveItem");
                stubFs.rejects(ITEM_ERROR);

                // Create a spy to listen for the "pulled-error" event.
                const emitter = helper.getEventEmitter(context);
                const spy = sinon.spy();
                emitter.on("pulled-error", spy);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubRest);
                self.addTestDouble(stubFs);

                // Call the method being tested.
                let error;
                helper.pullItem(context, UnitTest.DUMMY_ID, UnitTest.DUMMY_OPTIONS)
                    .then(function (/*item*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the pulled item should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stubs and the spy were called in the correct order.
                            expect(stubRest).to.have.been.called;
                            expect(stubFs).to.have.been.called;
                            expect(spy).to.have.been.called;
                            expect(spy.args[0][0].message).to.contain(ITEM_ERROR);
                            expect(spy.args[0][1]).to.equal(UnitTest.DUMMY_ID);
                            expect(stubRest).to.have.been.calledBefore(stubFs);
                            expect(stubFs).to.have.been.calledBefore(spy);

                            // Verify that the specified item was passed to the FS API.
                            expect(diff.diffJson(stubFs.args[0][1], itemMetadata1)).to.have.lengthOf(1);

                            // Verify that the expected error is returned.
                            expect(err.message).to.equal(ITEM_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        emitter.removeListener("pulled-error", spy);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should silently succeed when the specified item cannot be pulled.", function (done) {
                // Create an restApi.getItem stub that returns a promise for item metadata.
                const stubGet = sinon.stub(restApi, "getItem");
                stubGet.resolves(itemMetadata1);

                // Create a helper.canPullItem stub that returns false.
                const stubCan = sinon.stub(helper, "canPullItem");
                stubCan.returns(false);

                // Create an fsApi.saveItem spy to make sure that it is not called.
                const spySave = sinon.spy(fsApi, "saveItem");

                // Create a spy to listen for the "pulled" event.
                const emitter = helper.getEventEmitter(context);
                const spyPulled = sinon.spy();
                emitter.on("pulled", spyPulled);
                const spyError = sinon.spy();
                emitter.on("pulled-error", spyError);

                // The stubs and spies should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubCan);
                self.addTestDouble(spySave);

                // Call the method being tested.
                let error;
                helper.pullItem(context, UnitTest.DUMMY_ID, UnitTest.DUMMY_OPTIONS)
                    .then(function (item) {
                        // Verify that the get and can stubs were called once, but the save spy was not.
                        expect(stubGet).to.have.been.calledOnce;
                        expect(stubCan).to.have.been.calledOnce;
                        expect(spySave).to.not.have.been.called;

                        // Verify that the push spy and the error spy were not called.
                        expect(spyPulled).to.not.have.been.called;
                        expect(spyError).to.not.have.been.called;

                        // Verify that no item was returned.
                        expect(item).to.not.exist;
                    })
                    .catch (function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        emitter.removeListener("pulled", spyPulled);
                        emitter.removeListener("pulled-error", spyError);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when the specified item exists.", function (done) {
                // Create a restApi.getItem stub that returns the contents of a test file.
                const stubRest = sinon.stub(restApi, "getItem");
                stubRest.resolves(itemMetadata1);

                // Create an fsApi.saveItem stub that returns the contents of a test file.
                const stubFs = sinon.stub(fsApi, "saveItem");
                stubFs.resolves(itemMetadata1);

                // Create a spy to listen for the "pulled" event.
                const emitter = helper.getEventEmitter(context);
                const spy = sinon.spy();
                emitter.on("pulled", spy);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubRest);
                self.addTestDouble(stubFs);

                // Call the method being tested.
                let error;
                helper.pullItem(context, UnitTest.DUMMY_ID, UnitTest.DUMMY_OPTIONS)
                    .then(function (item) {
                        // Verify that the stubs and the spy were called in the correct order.
                        expect(stubRest).to.have.been.called;
                        expect(stubFs).to.have.been.called;
                        expect(spy).to.have.been.called;
                        expect(stubRest).to.have.been.calledBefore(stubFs);
                        expect(stubFs).to.have.been.calledBefore(spy);

                        // Verify that the specified item was returned.
                        expect(diff.diffJson(item, itemMetadata1)).to.have.lengthOf(1);
                    })
                    .catch (function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        emitter.removeListener("pulled", spy);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when the specified item exists, no emitter.", function (done) {
                // Create a restApi.getItem stub that returns the contents of a test file.
                const stubRest = sinon.stub(restApi, "getItem");
                stubRest.resolves(itemMetadata1);

                // Create an fsApi.saveItem stub that returns the contents of a test file.
                const stubFs = sinon.stub(fsApi, "saveItem");
                stubFs.resolves(itemMetadata1);

                // Create spies to listen for the "pulled" and "pulled-error" events.
                const emitter = helper.getEventEmitter(context);
                delete context.eventEmitter;
                const spyPull = sinon.spy();
                emitter.on("pulled", spyPull);
                const spyError = sinon.spy();
                emitter.on("pulled-error", spyError);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubRest);
                self.addTestDouble(stubFs);

                // Call the method being tested.
                let error;
                helper.pullItem(context, UnitTest.DUMMY_ID, UnitTest.DUMMY_OPTIONS)
                    .then(function (item) {
                        // Verify that the stubs were called and the spy was not.
                        expect(stubRest).to.have.been.called;
                        expect(stubFs).to.have.been.called;
                        expect(spyPull).to.not.have.been.called;

                        // Verify that the specified item was returned.
                        expect(diff.diffJson(item, itemMetadata1)).to.have.lengthOf(1);
                    })
                    .catch (function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        context.eventEmitter = emitter;

                        emitter.removeListener("pulled", spyPull);
                        emitter.removeListener("pulled-error", spyError);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testPullAllItems (restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata) {
        const self = this;
        describe("pullAllItems", function () {
            it("should fail when there is an error getting remote items.", function (done) {
                // Create a restApi.getItems stub that returns an error.
                const ITEMS_ERROR = "There was an error getting the remote items.";
                const stub = sinon.stub(restApi, "getItems");
                stub.rejects(ITEMS_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                helper.pullAllItems(context)
                    .then(function (/*items*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the remote items should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once.
                            expect(stub).to.be.calledOnce;

                            // Verify that the expected error is returned.
                            expect(err.message).to.equal(ITEMS_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when second call to get items fails.", function (done) {
                // Create a restApi.getItems stub that returns an error the second time.
                const ITEMS_ERROR = "There was an error getting the remote items.";
                const stubGet = sinon.stub(restApi, "getItems");
                stubGet.onCall(0).resolves([itemMetadata1, itemMetadata2]);
                stubGet.onCall(1).rejects(ITEMS_ERROR);

                // The saveItem method should only be called for the successfully pulled items.
                const stubSave = sinon.stub(fsApi, "saveItem");
                stubSave.onCall(0).resolves(itemMetadata1);
                stubSave.onCall(1).resolves(itemMetadata2);

                // Create spies to listen for the "pulled" and "pulled-error" events.
                const emitter = helper.getEventEmitter(context);
                const spyPull = sinon.spy();
                emitter.on("pulled", spyPull);
                const spyError = sinon.spy();
                emitter.on("pulled-error", spyError);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubSave);

                // Call the method being tested.
                let error;
                helper.pullAllItems(context, {offset: 0, limit: 2, validateName: true})
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the remote items should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once.
                        expect(stubGet).to.have.been.calledTwice;

                        // Verify that the spies were called the expected number of times with the expected values.
                        expect(spyPull).to.have.callCount(2);
                        expect(spyPull.args[0][0].id).to.equal(itemMetadata1.id);
                        expect(spyPull.args[1][0].id).to.equal(itemMetadata2.id);

                        // Verify that the expected error is returned.
                        expect(err.message).to.equal(ITEMS_ERROR);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        emitter.removeListener("pulled", spyPull);
                        emitter.removeListener("pulled-error", spyError);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when there are no remote items.", function (done) {
                // Create an restApi.getItems stub that returns a promise for the metadata of the items.
                const stub = sinon.stub(restApi, "getItems");
                stub.resolves([]);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                helper.pullAllItems(context, {offset: 0, limit: 2})
                    .then(function (items) {
                        // Verify that the stub was called once.
                        expect(stub).to.have.been.calledOnce;

                        // Verify that the helper returned the expected values.
                        // Note that pullAllItems is designed to return a metadata array, but currently it does not.
                        if (items) {
                            expect(items).to.have.lengthOf(0);
                        }
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

            it("should succeed when pulling all items last getitem is empty hit exact multiple of limit.", function (done) {
                // Create an restApi.getItems stub that returns a promise for the metadata of the items.
                const stubGet = sinon.stub(restApi, "getItems");
                stubGet.onCall(0).resolves([itemMetadata1]);
                stubGet.onCall(1).resolves([itemMetadata2]);
                stubGet.onCall(2).resolves([UnitTest.DUMMY_METADATA]);
                stubGet.onCall(3).resolves([]);

                // The saveItem method should only be called for the successfully pulled items.
                const SAVE_ERROR = "Error saving the item";
                const stubSave = sinon.stub(fsApi, "saveItem");
                stubSave.onCall(0).resolves(itemMetadata1);
                stubSave.onCall(1).resolves(itemMetadata2);
                stubSave.onCall(2).rejects(SAVE_ERROR);

                // Create spies to listen for the "pulled" and "pulled-error" events.
                const emitter = helper.getEventEmitter(context);
                const spyPull = sinon.spy();
                emitter.on("pulled", spyPull);
                const spyError = sinon.spy();
                emitter.on("pulled-error", spyError);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubSave);

                // Call the method being tested.
                let error;
                helper.pullAllItems(context, {offset: 0, limit: 1})
                    .then(function (items) {
                        // Verify that the results have the expected values.
                        expect(items).to.have.lengthOf(3);
                        expect(items[0].id).to.equal(itemMetadata1.id);
                        expect(items[1].id).to.equal(itemMetadata2.id);
                        expect(helper.getName(items[0])).to.equal(helper.getName(itemMetadata1));
                        expect(helper.getName(items[1])).to.equal(helper.getName(itemMetadata2));

                        // Verify that the get stub was called 4 times.
                        expect(stubGet).to.have.callCount(4);

                        // Verify that the spies were called the expected number of times with the expected values.
                        expect(spyPull).to.have.callCount(2);
                        // some object types use the id and some use the name for the getName function
                        expect(helper.getName(itemMetadata1)).to.be.oneOf([spyPull.args[0][0].id, spyPull.args[0][0].name]);
                        expect(helper.getName(itemMetadata2)).to.be.oneOf([spyPull.args[1][0].id, spyPull.args[1][0].name]);
                        expect(spyError).to.have.been.calledOnce;
                        expect(spyError.args[0][0].message).to.contain(SAVE_ERROR);
                        expect(spyError.args[0][1]).to.equal(UnitTest.DUMMY_METADATA.id);
                    })
                    .catch (function (err) {
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

            it("should succeed when pulling all items partial last getitem.", function (done) {
                // Create a restApi.getItems stub that returns a promise for the metadata of the items.
                const stubGet = sinon.stub(restApi, "getItems");
                stubGet.onCall(0).resolves([itemMetadata1, itemMetadata2]);
                stubGet.onCall(1).resolves([UnitTest.DUMMY_METADATA]);

                // The saveItem method should only be called for the successfully pulled items.
                const SAVE_ERROR = "Error saving the item";
                const stubSave = sinon.stub(fsApi, "saveItem");
                stubSave.onCall(0).resolves(itemMetadata1);
                stubSave.onCall(1).resolves(itemMetadata2);
                stubSave.onCall(2).rejects(SAVE_ERROR);

                // Create an helper.listLocalItemNames stub to return the list of local files.
                const stubList = sinon.stub(helper, "listLocalItemNames");
                stubList.resolves([itemMetadata1, itemMetadata2, {"id": "foo"}]);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubSave);
                self.addTestDouble(stubList);

                // Create spies to listen for the "pulled" and "pulled-error" events.
                const emitter = helper.getEventEmitter(context);
                const spyPull = sinon.spy();
                emitter.on("pulled", spyPull);
                const spyError = sinon.spy();
                emitter.on("pulled-error", spyError);

                // Call the method being tested.
                let error;
                helper.pullAllItems(context, {offset: 0, limit: 2, validateName: true, deletions: true})
                    .then(function (items) {
                        // Verify that the results have the expected values.
                        expect(items).to.have.lengthOf(3);
                        expect(items[0].id).to.equal(itemMetadata1.id);
                        expect(items[1].id).to.equal(itemMetadata2.id);
                        expect(helper.getName(items[0])).to.equal(helper.getName(itemMetadata1));
                        expect(helper.getName(items[1])).to.equal(helper.getName(itemMetadata2));

                        // Verify that the get stub was called 2 times.
                        expect(stubGet).to.have.callCount(2);

                        // Verify that the spies were called the expected number of times with the expected values.
                        expect(spyPull).to.have.callCount(2);
                        // some object types use the id and some use the name for the getName function
                        expect(helper.getName(itemMetadata1)).to.be.oneOf([spyPull.args[0][0].id, spyPull.args[0][0].name]);
                        expect(helper.getName(itemMetadata2)).to.be.oneOf([spyPull.args[1][0].id, spyPull.args[1][0].name]);
                        expect(spyError).to.have.been.calledOnce;
                        expect(spyError.args[0][0].message).to.contain(SAVE_ERROR);
                        expect(spyError.args[0][1]).to.equal(UnitTest.DUMMY_METADATA.id);
                    })
                    .catch (function (err) {
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

            it("should succeed when pulling all items, no emitter and some can't be pulled.", function (done) {
                // Create a restApi.getItems stub that returns a promise for the metadata of the items.
                const stubGet = sinon.stub(restApi, "getItems");
                stubGet.onCall(0).resolves([itemMetadata1, itemMetadata2]);
                stubGet.onCall(1).resolves([itemMetadata1, itemMetadata2]);
                stubGet.onCall(2).resolves([UnitTest.DUMMY_METADATA]);

                // Create a helper.canPullItem stub that return false for some of the items.
                const stubCan = sinon.stub(helper, "canPullItem");
                stubCan.onCall(0).returns(true);
                stubCan.onCall(1).returns(true);
                stubCan.onCall(2).returns(true);
                stubCan.onCall(3).returns(false);
                stubCan.onCall(4).returns(false);

                // The saveItem method should only be called for the successfully pulled items.
                const SAVE_ERROR = "Error saving the item";
                const stubSave = sinon.stub(fsApi, "saveItem");
                stubSave.onCall(0).resolves(itemMetadata1);
                stubSave.onCall(1).resolves(itemMetadata2);
                stubSave.onCall(2).rejects(SAVE_ERROR);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubCan);
                self.addTestDouble(stubSave);

                // Create spies to listen for the "pulled" and "pulled-error" events.
                const emitter = helper.getEventEmitter(context);
                delete context.eventEmitter;
                const spyPull = sinon.spy();
                emitter.on("pulled", spyPull);
                const spyError = sinon.spy();
                emitter.on("pulled-error", spyError);

                // Call the method being tested.
                let error;
                helper.pullAllItems(context, {offset: 0, limit: 2, validateName: true})
                    .then(function (items) {
                        // Verify that the results have the expected values.
                        expect(items).to.have.lengthOf(2);
                        expect(items[0].id).to.equal(itemMetadata1.id);
                        expect(items[1].id).to.equal(itemMetadata2.id);
                        expect(helper.getName(items[0])).to.equal(helper.getName(itemMetadata1));
                        expect(helper.getName(items[1])).to.equal(helper.getName(itemMetadata2));

                        // Verify that the get stub was called 3 times.
                        expect(stubGet).to.have.callCount(3);

                        // Verify that the spies were not called.
                        expect(spyPull).to.not.have.been.called;
                        expect(spyError).to.not.have.been.called;
                    })
                    .catch (function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        context.eventEmitter = emitter;

                        emitter.removeListener("pulled", spyPull);
                        emitter.removeListener("pulled-error", spyError);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when pulling all ready items.", function (done) {
                const stubGet = sinon.stub(restApi, "getItems");
                const readyMetadata1 = utils.clone(itemMetadata1);
                readyMetadata1.status = "ready";
                const readyMetadata2 = utils.clone(itemMetadata2);
                readyMetadata2.status = "ready";
                const readyMetadata3 = utils.clone(itemMetadata2);
                readyMetadata3.status = "ready";
                const draftMetadata1 = utils.clone(itemMetadata1);
                draftMetadata1.status = "draft";
                const draftMetadata2 = utils.clone(itemMetadata2);
                draftMetadata2.status = "draft";
                stubGet.resolves([readyMetadata1, readyMetadata2, readyMetadata3, draftMetadata1, draftMetadata2]);

                // Create a helper.canPullItem stub that return false for some of the items.
                const stubCan = sinon.stub(helper, "canPullItem");
                stubCan.returns(true);

                // The saveItem method should only be called for the successfully pulled items.
                const stubSave = sinon.stub(fsApi, "saveItem");
                stubSave.onCall(0).resolves(readyMetadata1);
                stubSave.onCall(1).resolves(readyMetadata2);
                stubSave.onCall(2).resolves(readyMetadata3);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubCan);
                self.addTestDouble(stubSave);

                // Create spies to listen for the "pulled" and "pulled-error" events.
                const emitter = helper.getEventEmitter(context);
                const spyPull = sinon.spy();
                emitter.on("pulled", spyPull);
                const spyError = sinon.spy();
                emitter.on("pulled-error", spyError);

                // Call the method being tested.
                let error;
                helper.pullAllItems(context, {filterReady: true})
                    .then(function (items) {
                        // Verify that the get stub was called once.
                        expect(stubGet).to.be.calledOnce;

                        // Verify that the results have the expected values.
                        expect(items).to.have.lengthOf(3);
                        expect(items[0].status).to.equal("ready");
                        expect(items[1].status).to.equal("ready");
                        expect(items[2].status).to.equal("ready");

                        // Verify that the spies were not called.
                        expect(spyPull).to.have.been.calledThrice;
                        expect(spyError).to.not.have.been.called;
                    })
                    .catch(function (err) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        emitter.removeListener("pulled", spyPull);
                        emitter.removeListener("pulled-error", spyError);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when pulling all draft items.", function (done) {
                const stubGet = sinon.stub(restApi, "getItems");
                const readyMetadata1 = utils.clone(itemMetadata1);
                readyMetadata1.status = "ready";
                const readyMetadata2 = utils.clone(itemMetadata2);
                readyMetadata2.status = "ready";
                const readyMetadata3 = utils.clone(itemMetadata2);
                readyMetadata3.status = "ready";
                const draftMetadata1 = utils.clone(itemMetadata1);
                draftMetadata1.status = "draft";
                const draftMetadata2 = utils.clone(itemMetadata2);
                draftMetadata2.status = "draft";
                stubGet.resolves([readyMetadata1, readyMetadata2, readyMetadata3, draftMetadata1, draftMetadata2]);

                // Create a helper.canPullItem stub that return false for some of the items.
                const stubCan = sinon.stub(helper, "canPullItem");
                stubCan.returns(true);

                // The saveItem method should only be called for the successfully pulled items.
                const stubSave = sinon.stub(fsApi, "saveItem");
                stubSave.onCall(0).resolves(draftMetadata1);
                stubSave.onCall(1).resolves(draftMetadata2);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubCan);
                self.addTestDouble(stubSave);

                // Create spies to listen for the "pulled" and "pulled-error" events.
                const emitter = helper.getEventEmitter(context);
                const spyPull = sinon.spy();
                emitter.on("pulled", spyPull);
                const spyError = sinon.spy();
                emitter.on("pulled-error", spyError);

                // Call the method being tested.
                let error;
                helper.pullAllItems(context, {filterDraft: true})
                    .then(function (items) {
                        // Verify that the get stub was called once.
                        expect(stubGet).to.be.calledOnce;

                        // Verify that the results have the expected values.
                        expect(items).to.have.lengthOf(2);
                        expect(items[0].status).to.equal("draft");
                        expect(items[1].status).to.equal("draft");

                        // Verify that the spies were not called.
                        expect(spyPull).to.have.been.calledTwice;
                        expect(spyError).to.not.have.been.called;
                    })
                    .catch(function (err) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        emitter.removeListener("pulled", spyPull);
                        emitter.removeListener("pulled-error", spyError);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when getting item names succeeds - path.", function (done) {
                const pathBased = (type === "types" || type === "layouts" || type === "layout-mappings" || type === "sites/default");

                // Create a rest.getItems stub that returns metadata for the items.
                const stubGet = sinon.stub(restApi, "getItems");
                const metadata1 = utils.clone(itemMetadata1);
                metadata1.path = "/foo/bar1.json";
                const metadata2 = utils.clone(itemMetadata2);
                metadata2.path = "/bar/foo1.json";
                const metadata3 = utils.clone(itemMetadata2);
                metadata3.path = "/foo/bar2.json";
                const metadata4 = utils.clone(itemMetadata1);
                metadata4.path = "/bar/foo2.json";
                const metadata5 = utils.clone(itemMetadata2);
                metadata5.path = "/foo/bar3.json";
                stubGet.resolves([metadata1, metadata2, metadata3, metadata4, metadata5]);

                // Create a helper.canPullItem stub that return false for some of the items.
                const stubCan = sinon.stub(helper, "canPullItem");
                stubCan.returns(true);

                // The saveItem method should only be called for the successfully pulled items.
                const stubSave = sinon.stub(fsApi, "saveItem");
                if (pathBased) {
                    stubSave.onCall(0).resolves(metadata1);
                    stubSave.onCall(1).resolves(metadata3);
                    stubSave.onCall(2).resolves(metadata5);
                } else {
                    stubSave.onCall(0).resolves(metadata1);
                    stubSave.onCall(1).resolves(metadata2);
                    stubSave.onCall(2).resolves(metadata3);
                    stubSave.onCall(3).resolves(metadata4);
                    stubSave.onCall(4).resolves(metadata5);
                }

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubCan);
                self.addTestDouble(stubSave);

                // Create spies to listen for the "pulled" and "pulled-error" events.
                const emitter = helper.getEventEmitter(context);
                const spyPull = sinon.spy();
                emitter.on("pulled", spyPull);
                const spyError = sinon.spy();
                emitter.on("pulled-error", spyError);

                // Call the method being tested.
                let error;
                helper.pullAllItems(context, {filterPath: "foo"})
                    .then(function (items) {
                        // Verify that the get stub was called once.
                        expect(stubGet).to.be.calledOnce;

                        // Verify that the expected items are returned.
                        if (pathBased) {
                            expect(items.length).to.equal(3);
                            expect(items[0].path).to.contain("/foo/");
                            expect(items[1].path).to.contain("/foo/");
                            expect(items[2].path).to.contain("/foo/");
                        } else {
                            expect(items.length).to.equal(5);
                        }
                        // Verify that the pull spy was called and the error spy was not.
                        expect(spyPull).to.have.been.called;
                        expect(spyError).to.not.have.been.called;
                    })
                    .catch(function (err) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
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

    testPullModifiedItems (restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata) {
        const self = this;
        describe("pullModifiedItems", function () {
            it("should fail when there is an error getting remote items.", function (done) {
                // Create a restApi.getItems stub that returns an error.
                const ITEMS_ERROR = "There was an error getting the remote items.";
                const stub = sinon.stub(restApi, "getModifiedItems");
                stub.rejects(ITEMS_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                helper.pullModifiedItems(context)
                    .then(function (/*items*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the remote items should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once.
                            expect(stub).to.be.calledOnce;

                            // Verify that the expected error is returned.
                            expect(err.message).to.equal(ITEMS_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when there are no remote items.", function (done) {
                // Create an restApi.getItems stub that returns a promise for the metadata of the items.
                const stub = sinon.stub(restApi, "getModifiedItems");
                stub.resolves([]);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                helper.pullModifiedItems(context, {offset: 0, limit: 2})
                    .then(function (items) {
                        // Verify that the stub was called once.
                        expect(stub).to.have.been.calledOnce;

                        // Verify that the helper returned the expected values.
                        // Note that pullAllItems is designed to return a metadata array, but currently it does not.
                        if (items) {
                            expect(items).to.have.lengthOf(0);
                        }
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

            it("should succeed when pulling all items last getitem is empty hit exact multiple of limit.", function (done) {
                // Create an restApi.getItems stub that returns a promise for the metadata of the items.
                const stubGet = sinon.stub(restApi, "getModifiedItems");
                stubGet.onCall(0).resolves([itemMetadata1]);
                stubGet.onCall(1).resolves([itemMetadata2]);
                stubGet.onCall(2).resolves([UnitTest.DUMMY_METADATA]);
                stubGet.onCall(3).resolves([]);

                // The saveItem method should only be called for the successfully pulled items.
                const SAVE_ERROR = "Error saving the item";
                const stubSave = sinon.stub(fsApi, "saveItem");
                stubSave.onCall(0).resolves(itemMetadata1);
                stubSave.onCall(1).resolves(itemMetadata2);
                stubSave.onCall(2).rejects(SAVE_ERROR);

                // Create spies to listen for the "pulled" and "pulled-error" events.
                const emitter = helper.getEventEmitter(context);
                const spyPull = sinon.spy();
                emitter.on("pulled", spyPull);
                const spyError = sinon.spy();
                emitter.on("pulled-error", spyError);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubSave);

                // Call the method being tested.
                let error;
                helper.pullModifiedItems(context, {offset: 0, limit: 1})
                    .then(function (items) {
                        // Verify that the results have the expected values.
                        expect(items).to.have.lengthOf(3);
                        expect(items[0].id).to.equal(itemMetadata1.id);
                        expect(items[1].id).to.equal(itemMetadata2.id);
                        expect(helper.getName(items[0])).to.equal(helper.getName(itemMetadata1));
                        expect(helper.getName(items[1])).to.equal(helper.getName(itemMetadata2));

                        // Verify that the get stub was called 4 times.
                        expect(stubGet).to.have.callCount(4);

                        // Verify that the spies were called the expected number of times with the expected values.
                        expect(spyPull).to.have.callCount(2);
                        // some object types use the id and some use the name for the getName function
                        expect(helper.getName(itemMetadata1)).to.be.oneOf([spyPull.args[0][0].id, spyPull.args[0][0].name]);
                        expect(helper.getName(itemMetadata2)).to.be.oneOf([spyPull.args[1][0].id, spyPull.args[1][0].name]);
                        expect(spyError).to.have.been.calledOnce;
                        expect(spyError.args[0][0].message).to.contain(SAVE_ERROR);
                        expect(spyError.args[0][1]).to.equal(UnitTest.DUMMY_METADATA.id);
                    })
                    .catch (function (err) {
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

            it("should succeed when pulling all items partial last getitem.", function (done) {
                // Create an restApi.getItems stub that returns a promise for the metadata of the items.
                const stubGet = sinon.stub(restApi, "getModifiedItems");
                stubGet.onCall(0).resolves([itemMetadata1, itemMetadata2 ]);
                stubGet.onCall(1).resolves([UnitTest.DUMMY_METADATA]);

                // The saveItem method should only be called for the successfully pulled items.
                const SAVE_ERROR = "Error saving the item";
                const stubSave = sinon.stub(fsApi, "saveItem");
                stubSave.onCall(0).resolves(itemMetadata1);
                stubSave.onCall(1).resolves(itemMetadata2);
                stubSave.onCall(2).rejects(SAVE_ERROR);

                // Create spies to listen for the "pulled" and "pulled-error" events.
                const emitter = helper.getEventEmitter(context);
                const spyPull = sinon.spy();
                emitter.on("pulled", spyPull);
                const spyError = sinon.spy();
                emitter.on("pulled-error", spyError);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubSave);

                // Call the method being tested.
                let error;
                helper.pullModifiedItems(context, {offset: 0, limit: 2, validateName: true})
                    .then(function (items) {
                        // Verify that the results have the expected values.
                        expect(items).to.have.lengthOf(3);
                        expect(items[0].id).to.equal(itemMetadata1.id);
                        expect(items[1].id).to.equal(itemMetadata2.id);
                        expect(helper.getName(items[0])).to.equal(helper.getName(itemMetadata1));
                        expect(helper.getName(items[1])).to.equal(helper.getName(itemMetadata2));

                        // Verify that the get stub was called 2 times.
                        expect(stubGet).to.have.callCount(2);

                        // Verify that the spies were called the expected number of times with the expected values.
                        expect(spyPull).to.have.callCount(2);
                        // some object types use the id and some use the name for the getName function
                        expect(helper.getName(itemMetadata1)).to.be.oneOf([spyPull.args[0][0].id, spyPull.args[0][0].name]);
                        expect(helper.getName(itemMetadata2)).to.be.oneOf([spyPull.args[1][0].id, spyPull.args[1][0].name]);
                        expect(spyError).to.have.been.calledOnce;
                        expect(spyError.args[0][0].message).to.contain(SAVE_ERROR);
                        expect(spyError.args[0][1]).to.equal(UnitTest.DUMMY_METADATA.id);
                    })
                    .catch (function (err) {
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

    testPullManifestItems (restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata) {
        const self = this;
        describe("pullManifestItems", function () {
            it("should fail when getting the manifest items fails.", function (done) {
                // Create a helper.getManifestItems stub that returns an error.
                const MANIFEST_ERROR = "There was an error getting the manifest items.";
                const stub = sinon.stub(helper, "getManifestItems");
                stub.rejects(MANIFEST_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                helper.pullManifestItems(context, UnitTest.DUMMY_OPTIONS)
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

            it("should fail when pulling the list of items fails.", function (done) {
                // Create an helper.getManifestItems stub that returns a promise for the metadata of the items.
                const stubGet = sinon.stub(helper, "getManifestItems");
                stubGet.resolves([itemMetadata1, itemMetadata2, UnitTest.DUMMY_METADATA]);

                // Create a helper._pullItemList stub that returns an error.
                const LIST_ERROR = "There was an error pulling the manifest items.";
                const stubList = sinon.stub(helper, "_pullItemList");
                stubList.rejects(LIST_ERROR);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubList);

                // Call the method being tested.
                let error;
                helper.pullManifestItems(context, UnitTest.DUMMY_OPTIONS)
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
                // Create an helper.getManifestItems stub that returns a promise for the metadata of the items.
                const stubGet = sinon.stub(helper, "getManifestItems");
                stubGet.resolves([itemMetadata1, itemMetadata2, UnitTest.DUMMY_METADATA]);

                // Create a helper.pullItem method that resolves for two items and rejects for one.
                const PULL_ERROR = "Error pulling the item, as expected by a unit test";
                const stubPull = sinon.stub(helper, "pullItem");
                stubPull.onCall(0).resolves(itemMetadata1);
                stubPull.onCall(1).resolves(itemMetadata2);
                stubPull.onCall(2).rejects(PULL_ERROR);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubPull);

                // Call the method being tested.
                let error;
                helper.pullManifestItems(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (items) {
                        // Verify that the results have the expected values.
                        expect(items).to.have.lengthOf(2);
                        expect(items[0].id).to.equal(itemMetadata1.id);
                        expect(items[1].id).to.equal(itemMetadata2.id);

                        // Verify that the get stub was called once.
                        expect(stubGet).to.have.been.calledOnce;
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

    testPushItem (restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata) {
        const self = this;
        describe("pushItem", function () {
            it("should fail when getting the local item fails.", function (done) {
                // Create an fsApi.getItem stub that returns an error.
                const ITEM_ERROR = "There was an error getting the local item.";
                const stub = sinon.stub(fsApi, "getItem");
                stub.rejects(ITEM_ERROR);

                // Create a restApi.updateItem spy.
                const spyUpdate = sinon.spy(restApi, "updateItem");

                // Create spies to listen for the "pushed" and "pushed-error" events.
                const emitter = helper.getEventEmitter(context);
                const spyPush = sinon.spy();
                emitter.on("pushed", spyPush);
                const spyError = sinon.spy();
                emitter.on("pushed-error", spyError);

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stub);
                self.addTestDouble(spyUpdate);

                // Call the method being tested.
                let error;
                helper.pushItem(context, UnitTest.DUMMY_PATH, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the local item should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once.
                            expect(stub).to.be.calledOnce;

                            // Verify that the expected error is returned.
                            expect(err.message).to.equal(ITEM_ERROR);

                            // Verify that the update spy was not called.
                            expect(spyUpdate).to.not.have.been.called;

                            // Verify that the pushed spy was not called, and the error spy was called.
                            expect(spyPush).to.not.have.been.called;
                            expect(spyError).to.have.been.called;
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        emitter.removeListener("pushed", spyPush);
                        emitter.removeListener("pushed-error", spyError);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when getting the local item fails, no emitter.", function (done) {
                // Create an fsApi.getItem stub that returns an error.
                const ITEM_ERROR = "There was an error getting the local item.";
                const stub = sinon.stub(fsApi, "getItem");
                stub.rejects(ITEM_ERROR);

                // Create a restApi.updateItem spy.
                const spyUpdate = sinon.spy(restApi, "updateItem");

                // Remove the emitter from the context to make sure the method still works without it.
                const emitter = helper.getEventEmitter(context);
                delete context.eventEmitter;
                const spyPush = sinon.spy();
                emitter.on("pushed", spyPush);
                const spyError = sinon.spy();
                emitter.on("pushed-error", spyError);

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stub);
                self.addTestDouble(spyUpdate);

                // Call the method being tested.
                let error;
                helper.pushItem(context, UnitTest.DUMMY_PATH, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the local item should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once.
                            expect(stub).to.be.calledOnce;

                            // Verify that the expected error is returned.
                            expect(err.message).to.equal(ITEM_ERROR);

                            // Verify that the update spy was not called.
                            expect(spyUpdate).to.not.have.been.called;

                            // Verify that the pushed spy and the error spy were not called.
                            expect(spyPush).to.not.have.been.called;
                            expect(spyError).to.not.have.been.called;
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        context.eventEmitter = emitter;

                        emitter.removeListener("pushed", spyPush);
                        emitter.removeListener("pushed-error", spyError);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when updating the remote item fails.", function (done) {
                // Create an fsApi.getItem stub that returns a promise for item metadata with a "rev" value.
                const stubGet = sinon.stub(fsApi, "getItem");
                stubGet.resolves(itemMetadata1);

                // Create a restApi.updateItem stub that returns an error.
                const ITEM_ERROR = "There was an error updating the remote item.";
                const stubUpdate = sinon.stub(restApi, "updateItem");
                stubUpdate.rejects(ITEM_ERROR);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubUpdate);

                // Call the method being tested.
                let error;
                helper.pushItem(context, UnitTest.DUMMY_PATH, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for updating the remote item should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stubs were called once.
                            expect(stubGet).to.be.calledOnce;
                            expect(stubUpdate).to.be.calledOnce;

                            // Verify that the update was called with the expected value.
                            expect(diff.diffJson(stubUpdate.args[0][1], itemMetadata1)).to.have.lengthOf(1);

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
            });

            it("should fail when creating the remote item fails.", function (done) {
                // Create an fsApi.getItem stub that returns a promise for item metadata without a "rev" value.
                const stubGet = sinon.stub(fsApi, "getItem");
                stubGet.resolves(itemMetadata2);

                // Create a restApi.createItem stub that returns an error.
                const ITEM_ERROR = "There was an error creating the remote item.";
                const stubCreate = sinon.stub(restApi, "createItem");
                stubCreate.rejects(ITEM_ERROR);

                // Create spies to listen for the "pushed" and "pushed-error" events.
                const emitter = helper.getEventEmitter(context);
                const spyPush = sinon.spy();
                emitter.on("pushed", spyPush);
                const spyError = sinon.spy();
                emitter.on("pushed-error", spyError);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubCreate);

                // Call the method being tested.
                let error;
                helper.pushItem(context, UnitTest.DUMMY_PATH, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for creating the remote item should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stubs were called once.
                            expect(stubGet).to.be.calledOnce;
                            expect(stubCreate).to.be.calledOnce;

                            // Verify that the push spy was not called and the error spy was.
                            expect(spyPush).to.not.have.been.called;
                            expect(spyError).to.have.been.calledOnce;

                            // Verify that the update was called with the expected value.
                            expect(diff.diffJson(stubCreate.args[0][1], itemMetadata2)).to.have.lengthOf(1);

                            // Verify that the expected error is returned.
                            expect(err.message).to.equal(ITEM_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        emitter.removeListener("pushed", spyPush);
                        emitter.removeListener("pushed-error", spyError);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when creating the remote item fails with a retryable error.", function (done) {
                // Create an fsApi.getItem stub that returns a promise for item metadata without a "rev" value.
                const stubGet = sinon.stub(fsApi, "getItem");
                stubGet.resolves(itemMetadata2);

                // Create a restApi.createItem stub that returns an error.
                const ITEM_ERROR = "There was an error creating the remote item.";
                const itemError = new Error(ITEM_ERROR);
                itemError.retry = true;
                const stubCreate = sinon.stub(restApi, "createItem");
                stubCreate.rejects(itemError);

                // Create spies to listen for the "pushed" and "pushed-error" events.
                const emitter = helper.getEventEmitter(context);
                const spyPush = sinon.spy();
                emitter.on("pushed", spyPush);
                const spyError = sinon.spy();
                emitter.on("pushed-error", spyError);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubCreate);

                // Call the method being tested.
                let error;
                helper.pushItem(context, UnitTest.DUMMY_PATH, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for creating the remote item should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stubs were called once.
                            expect(stubGet).to.be.calledOnce;
                            expect(stubCreate).to.be.calledOnce;

                            // Verify that the push spy and the error spy were not called.
                            expect(spyPush).to.not.have.been.called;
                            expect(spyError).to.not.have.been.called;

                            // Verify that the update was called with the expected value.
                            expect(diff.diffJson(stubCreate.args[0][1], itemMetadata2)).to.have.lengthOf(1);

                            // Verify that the expected error is returned.
                            expect(err.message).to.equal(ITEM_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        emitter.removeListener("pushed", spyPush);
                        emitter.removeListener("pushed-error", spyError);

                        // Clear the retry push items.
                        delete context.retryPush;

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when pushing a local item for update.", function (done) {
                // Create an fsApi.getItem stub that returns a promise for item metadata with a "rev" value.
                const stubGet = sinon.stub(fsApi, "getItem");
                stubGet.resolves(itemMetadata1);

                // Create a restApi.updateItem stub that returns a promise for the item metadata.
                const stubUpdate = sinon.stub(restApi, "updateItem");
                stubUpdate.resolves(itemMetadata1);

                // Create a fsApi.saveItem stub that returns a promise for the item metadata.
                const stubSave = sinon.stub(fsApi, "saveItem");
                stubSave.resolves(itemMetadata1);

                // Create spies to listen for the "pushed" and "pushed-error" events.
                const emitter = helper.getEventEmitter(context);
                const spyPush = sinon.spy();
                emitter.on("pushed", spyPush);
                const spyError = sinon.spy();
                emitter.on("pushed-error", spyError);

                // The stubs and spies should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubUpdate);
                self.addTestDouble(stubSave);

                // Call the method being tested.
                let error;
                helper.pushItem(context, UnitTest.DUMMY_PATH, UnitTest.DUMMY_OPTIONS)
                    .then(function (item) {
                        // Verify that the stubs were all called once.
                        expect(stubGet).to.have.been.calledOnce;
                        expect(stubUpdate).to.have.been.calledOnce;
                        expect(stubSave).to.have.been.calledOnce;

                        // Verify that the status stub and push spy were called once, and the error spy was not called.
                        expect(spyPush).to.have.been.calledOnce;
                        expect(spyError).to.not.have.been.called;

                        // Verify that update, save, and status methods were called with the expected values.
                        expect(diff.diffJson(stubUpdate.args[0][1], itemMetadata1)).to.have.lengthOf(1);
                        expect(diff.diffJson(stubSave.args[0][1], itemMetadata1)).to.have.lengthOf(1);

                        // Verify that the expected values were returned.
                        expect(diff.diffJson(item, itemMetadata1)).to.have.lengthOf(1);
                    })
                    .catch (function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        emitter.removeListener("pushed", spyPush);
                        emitter.removeListener("pushed-error", spyError);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should silently succeed when pushing a local item that cannot be pushed.", function (done) {
                // Create an fsApi.getItem stub that returns a promise for item metadata.
                const stubGet = sinon.stub(fsApi, "getItem");
                stubGet.resolves(itemMetadata1);

                // Create a helper.canPushItem stub that returns false.
                const stubCan = sinon.stub(helper, "canPushItem");
                stubCan.returns(false);

                // Create a restApi.updateItem spy to make sure it isn't called.
                const spyUpdate = sinon.stub(restApi, "updateItem");

                // Create a fsApi.saveItem spy to make sure it isn't called.
                const spySave = sinon.stub(fsApi, "saveItem");

                // Create spies to listen for the "pushed" and "pushed-error" events.
                const emitter = helper.getEventEmitter(context);
                const spyPush = sinon.spy();
                emitter.on("pushed", spyPush);
                const spyError = sinon.spy();
                emitter.on("pushed-error", spyError);

                // The stubs and spies should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubCan);
                self.addTestDouble(spyUpdate);
                self.addTestDouble(spySave);

                // Call the method being tested.
                let error;
                helper.pushItem(context, UnitTest.DUMMY_PATH, UnitTest.DUMMY_OPTIONS)
                    .then(function (item) {
                        // Verify that the get and can stubs were called once, but the update and save spies were not.
                        expect(stubGet).to.have.been.calledOnce;
                        expect(stubCan).to.have.been.calledOnce;
                        expect(spyUpdate).to.not.have.been.called;
                        expect(spySave).to.not.have.been.called;

                        // Verify that the push spy and the error spy was not called.
                        expect(spyPush).to.not.have.been.called;
                        expect(spyError).to.not.have.been.called;

                        // Verify that no item was returned.
                        expect(item).to.not.exist;
                    })
                    .catch (function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        emitter.removeListener("pushed", spyPush);
                        emitter.removeListener("pushed-error", spyError);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when pushing a local item for update and a conflict.", function (done) {
                // Create an fsApi.getItem stub that returns a promise for item metadata with a "rev" value.
                const stubGet = sinon.stub(fsApi, "getItem");
                stubGet.resolves(itemMetadata1);

                // Create a restApi.updateItem stub that returns a promise for the item metadata.
                const stubUpdate = sinon.stub(restApi, "updateItem");
                const conflictError = new Error("conflict");
                conflictError.statusCode = 409;
                stubUpdate.rejects(conflictError);

                // Clone itemMetadata1 and modify the description and tags fields.
                const modifiedItemMetadata1 = JSON.parse(JSON.stringify(itemMetadata1));
                modifiedItemMetadata1.description = "modified:" + itemMetadata1.description;
                delete modifiedItemMetadata1.tags;

                // Create an fsApi.getItem stub that returns a promise for item metadata with a "rev" value.
                const stubrGet = sinon.stub(restApi, "getItem");
                stubrGet.resolves(modifiedItemMetadata1);

                // Create a fsApi.saveItem stub that returns a promise for the item metadata.
                const stubSave = sinon.stub(fsApi, "saveItem");
                stubSave.resolves(itemMetadata1);

                // Create spies to listen for the "pushed" and "pushed-error" events.
                const emitter = helper.getEventEmitter(context);
                const spyPush = sinon.spy();
                emitter.on("pushed", spyPush);
                const spyError = sinon.spy();
                emitter.on("pushed-error", spyError);

                // The stubs and spies should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubrGet);
                self.addTestDouble(stubUpdate);
                self.addTestDouble(stubSave);

                // Call the method being tested.
                let error;
                helper.pushItem(context, UnitTest.DUMMY_PATH, UnitTest.DUMMY_OPTIONS)
                    .then(function (/*item*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for creating the remote item should have been rejected.");
                    })
                    .catch(function (/*err*/) {
                        // Verify that the stubs were all called once.
                        expect(stubGet).to.have.been.calledOnce;
                        expect(stubrGet).to.have.been.calledOnce;
                        expect(stubUpdate).to.have.been.calledOnce;
                        expect(stubSave).to.have.been.calledOnce;
                        expect(spyPush).to.not.have.been.called;
                        expect(spyError).to.have.been.calledOnce;
                        expect(spyError.firstCall.args[0].message).to.contain("conflict");
                        expect(spyError.firstCall.args[0].statusCode).to.equal(409);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        emitter.removeListener("pushed", spyPush);
                        emitter.removeListener("pushed-error", spyError);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when pushing a local item for update with an unimportant conflict.", function (done) {
                // Create an fsApi.getItem stub that returns a promise for item metadata with a "rev" value.
                const stubGet = sinon.stub(fsApi, "getItem");
                stubGet.resolves(itemMetadata1);

                // Create a restApi.updateItem stub that returns a promise for the item metadata.
                const stubUpdate = sinon.stub(restApi, "updateItem");
                const conflictError = new Error("conflict");
                conflictError.statusCode = 409;
                stubUpdate.rejects(conflictError);

                // Clone itemMetadata1 and modify the unimportant fields.
                const modifiedItemMetadata1 = JSON.parse(JSON.stringify(itemMetadata1));
                modifiedItemMetadata1.rev = "3-db5c66d33df3b5efd9f63531417f7606";
                modifiedItemMetadata1.created = "2018-03-21T17:34:20.612Z";
                modifiedItemMetadata1.creator = "test_user";
                modifiedItemMetadata1.creatorId = "293d111b-cf5c-4b49-99d9-d7b8d4d1f63e";
                modifiedItemMetadata1.lastModified = "2018-03-21T17:34:20.612Z";
                modifiedItemMetadata1.lastModifier = "test_user";
                modifiedItemMetadata1.lastModifierId = "293d111b-cf5c-4b49-99d9-d7b8d4d1f63e";
                modifiedItemMetadata1.systemModified = "2018-03-21T17:34:20.612Z";

                // Create an fsApi.getItem stub that returns a promise for item metadata with a "rev" value.
                const stubrGet = sinon.stub(restApi, "getItem");
                stubrGet.resolves(modifiedItemMetadata1);

                // Create a fsApi.saveItem stub that returns a promise for the item metadata.
                const stubSave = sinon.stub(fsApi, "saveItem");
                stubSave.resolves(itemMetadata1);

                // Create spies to listen for the "pushed" and "pushed-error" events.
                const emitter = helper.getEventEmitter(context);
                const spyPush = sinon.spy();
                emitter.on("pushed", spyPush);
                const spyError = sinon.spy();
                emitter.on("pushed-error", spyError);

                // The stubs and spies should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubrGet);
                self.addTestDouble(stubUpdate);
                self.addTestDouble(stubSave);

                // Call the method being tested.
                let error;
                helper.pushItem(context, UnitTest.DUMMY_PATH, UnitTest.DUMMY_OPTIONS)
                    .then(function (/*item*/) {
                        // Verify that the stubs were all called once.
                        expect(stubGet).to.have.been.calledOnce;
                        expect(stubrGet).to.have.been.calledOnce;
                        expect(stubUpdate).to.have.been.calledOnce;
                        expect(stubSave).to.have.been.calledOnce;
                        expect(spyPush).to.have.been.calledOnce;
                        expect(spyPush.firstCall.args[0].id).to.not.be.undefined;
                        expect(spyError).to.not.have.been.called;
                    })
                    .catch(function (err) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        emitter.removeListener("pushed", spyPush);
                        emitter.removeListener("pushed-error", spyError);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when pushing a local item for update and a conflict, no emitter and fail getting remote item.", function (done) {
                // Create an fsApi.getItem stub that returns a promise for item metadata with a "rev" value.
                const stubGet = sinon.stub(fsApi, "getItem");
                stubGet.resolves(itemMetadata1);

                // Create a restApi.updateItem stub that returns a promise for the item metadata.
                const stubUpdate = sinon.stub(restApi, "updateItem");
                const conflictError = new Error("conflict");
                conflictError.statusCode = 409;
                stubUpdate.rejects(conflictError);

                // Create an fsApi.getItem stub that returns a promise for item metadata with a "rev" value.
                const stubRest = sinon.stub(restApi, "getItem");
                stubRest.rejects(new Error("Failed to get remote item, as expected by unit test."));

                // Create a fsApi.saveItem spy to verify that it was not called.
                const stubSave = sinon.stub(fsApi, "saveItem");

                // Create spies to listen for the "pushed" and "pushed-error" events.
                const emitter = helper.getEventEmitter(context);
                delete context.eventEmitter;
                const spyPush = sinon.spy();
                emitter.on("pushed", spyPush);
                const spyError = sinon.spy();
                emitter.on("pushed-error", spyError);

                // The stubs and spies should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubUpdate);
                self.addTestDouble(stubRest);
                self.addTestDouble(stubSave);

                // Call the method being tested.
                let error;
                helper.pushItem(context, UnitTest.DUMMY_PATH, UnitTest.DUMMY_OPTIONS)
                    .then(function (/*item*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for creating the remote item should have been rejected.");
                    })
                    .catch(function (/*err*/) {
                        // Verify that the stubs were all called once.
                        expect(stubGet).to.have.been.calledOnce;
                        expect(stubUpdate).to.have.been.calledOnce;
                        expect(stubRest).to.have.been.calledOnce;
                        expect(stubSave).to.not.have.been.called;
                        expect(spyPush).to.not.have.been.called;
                        expect(spyError).to.not.have.been.called;
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        context.eventEmitter = emitter;

                        emitter.removeListener("pushed", spyPush);
                        emitter.removeListener("pushed-error", spyError);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when pushing a local item for create.", function (done) {
                // Create an fsApi.getItem stub that returns a promise for item metadata without a "rev" value.
                const stubGet = sinon.stub(fsApi, "getItem");
                stubGet.resolves(itemMetadata2);

                // Create a restApi.createItem stub that returns a promise for the item metadata.
                const stubCreate = sinon.stub(restApi, "createItem");
                stubCreate.resolves(itemMetadata2);

                // Create a fsApi.saveItem stub that returns a promise for the item metadata.
                const stubSave = sinon.stub(fsApi, "saveItem");
                stubSave.resolves(itemMetadata2);

                // Create spies to listen for the "pushed" and "pushed-error" events.
                const emitter = helper.getEventEmitter(context);
                const spyPush = sinon.spy();
                emitter.on("pushed", spyPush);
                const spyError = sinon.spy();
                emitter.on("pushed-error", spyError);

                // The stubs and spies should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubCreate);
                self.addTestDouble(stubSave);

                // Call the method being tested.
                let error;
                helper.pushItem(context, UnitTest.DUMMY_PATH, UnitTest.DUMMY_OPTIONS)
                    .then(function (item) {
                        // Verify that the stubs were all called once.
                        expect(stubGet).to.have.been.calledOnce;
                        expect(stubCreate).to.have.been.calledOnce;
                        expect(stubSave).to.have.been.calledOnce;

                        // Verify that the status stub and push spy were called once, and the error spy was not called.
                        expect(spyPush).to.have.been.calledOnce;
                        expect(spyError).to.not.have.been.called;

                        // Verify that create, save, and status methods were called with the expected values.
                        expect(diff.diffJson(stubCreate.args[0][1], itemMetadata2)).to.have.lengthOf(1);
                        expect(diff.diffJson(stubSave.args[0][1], itemMetadata2)).to.have.lengthOf(1);

                        // Verify that the expected values were returned.
                        expect(diff.diffJson(item, itemMetadata2)).to.have.lengthOf(1);
                    })
                    .catch (function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        emitter.removeListener("pushed", spyPush);
                        emitter.removeListener("pushed-error", spyError);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when pushing a local item for create, no emitter, no rewrite.", function (done) {
                // Create an fsApi.getItem stub that returns a promise for item metadata without a "rev" value.
                const stubGet = sinon.stub(fsApi, "getItem");
                stubGet.resolves(itemMetadata2);

                // Create a stub for the options.getRelevantOption method to return false for "rewriteOnPush".
                const originalGetRelevantOption = options.getRelevantOption.bind(options);
                const stubOption = sinon.stub(options, "getRelevantOption", function (context, opts, optionName, serviceName) {
                    if (optionName === "rewriteOnPush") {
                        return false;
                    } else {
                        return originalGetRelevantOption(context, opts, optionName, serviceName);
                    }
                });

                // Create a restApi.createItem stub that returns a promise for the item metadata.
                const stubCreate = sinon.stub(restApi, "createItem");
                stubCreate.resolves(itemMetadata2);

                // Create a fsApi.saveItem spy to make sure it is not called.
                const spySave = sinon.spy(fsApi, "saveItem");

                // Create spies to listen for the "pushed" and "pushed-error" events.
                const emitter = helper.getEventEmitter(context);
                delete context.eventEmitter;
                const spyPush = sinon.spy();
                emitter.on("pushed", spyPush);
                const spyError = sinon.spy();
                emitter.on("pushed-error", spyError);

                // The stubs and spies should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubOption);
                self.addTestDouble(stubCreate);
                self.addTestDouble(spySave);

                // Call the method being tested.
                let error;
                helper.pushItem(context, UnitTest.DUMMY_PATH, UnitTest.DUMMY_OPTIONS)
                    .then(function (item) {
                        // Verify that the stubs were called once, and the spy was not.
                        expect(stubGet).to.have.been.calledOnce;
                        expect(stubCreate).to.have.been.calledOnce;
                        expect(spySave).to.not.have.been.called;

                        // Verify that the push spy and the error spy were not called (because there is no emitter).
                        expect(spyPush).to.not.have.been.called;
                        expect(spyError).to.not.have.been.called;

                        // Verify that the create stub was called with the expected values.
                        expect(diff.diffJson(stubCreate.args[0][1], itemMetadata2)).to.have.lengthOf(1);

                        // Verify that the expected values were returned.
                        expect(diff.diffJson(item, itemMetadata2)).to.have.lengthOf(1);
                    })
                    .catch (function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        context.eventEmitter = emitter;

                        emitter.removeListener("pushed", spyPush);
                        emitter.removeListener("pushed-error", spyError);

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testPushAllItems (restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata) {
        const self = this;
        describe("pushAllItems", function () {
            it("should fail when getting the local items fails.", function (done) {
                // Create a helper.listNames stub that returns an error.
                const ITEM_ERROR = "There was an error getting the local items.";
                const stub = sinon.stub(fsApi, "listNames");
                stub.rejects(ITEM_ERROR);

                // Create a helper.pushItem spy.
                const spy = sinon.spy(helper, "pushItem");

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stub);
                self.addTestDouble(spy);

                // Call the method being tested.
                let error;
                helper.pushAllItems(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (/*items*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the local items should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once.
                            expect(stub).to.be.calledOnce;

                            // Verify that the expected error is returned.
                            expect(err.message).to.equal(ITEM_ERROR);

                            // Verify that the spy was not called.
                            expect(spy).to.have.callCount(0);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when getting the local items succeeds.", function (done) {
                // Create a helper.listNames stub that returns a list of items.
                const stubList = sinon.stub(fsApi, "listNames");
                stubList.resolves([helper.getName(itemMetadata1), helper.getName(itemMetadata2)]);

                // Create a helper.pushItem stub that return an item.
                const stubPush = sinon.stub(helper, "pushItem");
                stubPush.onCall(0).resolves(itemMetadata1);
                stubPush.onCall(1).resolves(itemMetadata2);

                const stubGetLocalItem = sinon.stub(helper, "getLocalItem");
                stubGetLocalItem.onCall(0).resolves(itemMetadata1);
                stubGetLocalItem.onCall(1).resolves(itemMetadata2);

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stubList);
                self.addTestDouble(stubPush);
                self.addTestDouble(stubGetLocalItem);

                // Call the method being tested.
                let error;
                helper.pushAllItems(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (items) {
                        // Verify that the stubs were called the expected number of times.
                        expect(stubList).to.have.been.calledOnce;
                        expect(stubPush).to.have.been.calledTwice;

                        // Verify that pushItem method was called with the expected values.
                        expect(diff.diffJson(stubPush.args[0][1], helper.getName(itemMetadata1))).to.have.lengthOf(1);
                        expect(diff.diffJson(stubPush.args[1][1], helper.getName(itemMetadata2))).to.have.lengthOf(1);

                        // Verify that the expected values were returned.
                        expect(diff.diffJson(items[0], itemMetadata1)).to.have.lengthOf(1);
                        expect(diff.diffJson(items[1], itemMetadata2)).to.have.lengthOf(1);
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

            it("should succeed when items succeed on retry.", function (done) {
                // Only do the retry push tests for helpers that enable retry push.
                if (!helper.isRetryPushEnabled()) {
                    return done();
                }

                // The contents of the test item metadata files.
                const itemMetadata1 = UnitTest.getJsonObject(path1);

                // Create a helper.listNames stub that returns a list of items.
                const stubList = sinon.stub(fsApi, "listNames");
                stubList.resolves([helper.getName(itemMetadata1), helper.getName(itemMetadata1), helper.getName(itemMetadata1)]);

                const stubGet = sinon.stub(fsApi, "getItem");
                stubGet.onCall(0).resolves(itemMetadata1);
                stubGet.onCall(1).resolves(itemMetadata1);
                stubGet.onCall(2).resolves(itemMetadata1);
                stubGet.onCall(3).resolves(itemMetadata1);
                stubGet.onCall(4).resolves(itemMetadata1);

                // TODO This is only for categories, maybe the retry tests should be in a separate function, and categories can override.
                const stubGetLocalItem = sinon.stub(helper, "getLocalItem");
                stubGetLocalItem.onCall(0).resolves(itemMetadata1);
                stubGetLocalItem.onCall(1).resolves(itemMetadata1);
                stubGetLocalItem.onCall(2).resolves(itemMetadata1);

                // Create an error that will cause the item to be retried.
                const PUSH_ERROR = "There was a push error - expected by the unit test.";
                const pushError = new Error(PUSH_ERROR);
                pushError.response = {"statusCode": 400, "body": {"errors": [{"code": 6000}]}};
                pushError.retry = true;
                const pushError2 = new Error(PUSH_ERROR);
                pushError2.response = {"statusCode": 400, "body": {"errors": [{"code": 6000}]}};
                pushError2.log = "foobar";
                pushError2.retry = true;

                // Create a restApi.updateItem stub that return an item.
                const stubUpdate = sinon.stub(restApi, "updateItem");
                stubUpdate.onCall(0).resolves(itemMetadata1);
                stubUpdate.onCall(1).rejects(pushError);
                stubUpdate.onCall(2).rejects(pushError2);
                stubUpdate.onCall(3).resolves(itemMetadata1);
                stubUpdate.onCall(4).resolves(itemMetadata1);

                const stubSave = sinon.stub(fsApi, "saveItem");
                stubSave.onCall(0).resolves(itemMetadata1);
                stubSave.onCall(1).resolves(itemMetadata1);
                stubSave.onCall(2).resolves(itemMetadata1);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubList);
                self.addTestDouble(stubGet);
                self.addTestDouble(stubGetLocalItem);
                self.addTestDouble(stubUpdate);
                self.addTestDouble(stubSave);

                // Call the method being tested.
                let error;
                helper.pushAllItems(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (items) {
                        // Verify that the stubs were called the expected number of times.
                        expect(stubList).to.have.been.calledOnce;
                        expect(stubUpdate).to.have.callCount(5);

                        // Verify that pushItem method was called with the expected values.
                        expect(diff.diffJson(stubUpdate.args[0][1], itemMetadata1)).to.have.lengthOf(1);
                        expect(diff.diffJson(stubUpdate.args[1][1], itemMetadata1)).to.have.lengthOf(1);
                        expect(diff.diffJson(stubUpdate.args[2][1], itemMetadata1)).to.have.lengthOf(1);
                        expect(diff.diffJson(stubUpdate.args[3][1], itemMetadata1)).to.have.lengthOf(1);
                        expect(diff.diffJson(stubUpdate.args[4][1], itemMetadata1)).to.have.lengthOf(1);

                        // Verify that the expected values were returned.
                        expect(diff.diffJson(items[0], itemMetadata1)).to.have.lengthOf(1);
                        expect(diff.diffJson(items[1], itemMetadata1)).to.have.lengthOf(1);
                        expect(diff.diffJson(items[2], itemMetadata1)).to.have.lengthOf(1);
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

            it("should succeed with no results when all items need retry.", function (done) {
                // Only do the retry push tests for helpers that enable retry push.
                if (!helper.isRetryPushEnabled()) {
                    return done();
                }

                // The contents of the test item metadata files.
                const itemMetadata1 = UnitTest.getJsonObject(path1);

                // Create a helper.listNames stub that returns a list of items.
                const stubList = sinon.stub(fsApi, "listNames");
                stubList.resolves([helper.getName(itemMetadata1), helper.getName(itemMetadata1), helper.getName(itemMetadata1)]);

                const stubGet = sinon.stub(fsApi, "getItem");
                stubGet.onCall(0).resolves(itemMetadata1);
                stubGet.onCall(1).resolves(itemMetadata1);
                stubGet.onCall(2).resolves(itemMetadata1);

                // TODO This is only for categories, maybe the retry tests should be in a separate function, and categories can override.
                const stubGetLocalItem = sinon.stub(helper, "getLocalItem");
                stubGetLocalItem.onCall(0).resolves(itemMetadata1);
                stubGetLocalItem.onCall(1).resolves(itemMetadata1);
                stubGetLocalItem.onCall(2).resolves(itemMetadata1);

                // Create errors that will cause the item to be retried.
                const PUSH_ERROR = "There was a push error - expected by the unit test.";
                const pushError = new Error(PUSH_ERROR);
                pushError.response = {"statusCode": 400, "body": {"errors": [{"code": 6000}]}};
                pushError.retry = true;

                // Create a restApi.updateItem stub that return an item.
                const stubUpdate = sinon.stub(restApi, "updateItem");
                stubUpdate.onCall(0).rejects(pushError);
                stubUpdate.onCall(1).rejects(pushError);
                stubUpdate.onCall(2).rejects(pushError);

                // Create a helper.getEventEmitter stub that returns the emitter only sometimes.
                const stubEmitter = sinon.stub(helper, "getEventEmitter");
                stubEmitter.onCall(0).returns(context.eventEmitter);
                stubEmitter.onCall(1).returns(null);
                stubEmitter.onCall(2).returns(context.eventEmitter);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubList);
                self.addTestDouble(stubGet);
                self.addTestDouble(stubGetLocalItem);
                self.addTestDouble(stubUpdate);
                self.addTestDouble(stubEmitter);

                // Call the method being tested.
                let error;
                helper.pushAllItems(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (items) {
                        // Verify that the stubs were called the expected number of times.
                        expect(stubList).to.have.been.calledOnce;
                        expect(stubUpdate).to.have.callCount(3);

                        // Verify that pushItem method was called with the expected values.
                        expect(diff.diffJson(stubUpdate.args[0][1], itemMetadata1)).to.have.lengthOf(1);
                        expect(diff.diffJson(stubUpdate.args[1][1], itemMetadata1)).to.have.lengthOf(1);
                        expect(diff.diffJson(stubUpdate.args[2][1], itemMetadata1)).to.have.lengthOf(1);

                        // Verify that no items were returned.
                        expect(items).to.have.lengthOf(0);
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

    testPushModifiedItems (restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata) {
        const self = this;
        describe("pushModifiedItems", function () {
            it("should fail when getting the local items fails.", function (done) {
                // Create a helper._listLocalModifiedItemNames stub that returns an error.
                const ITEM_ERROR = "There was an error getting the local modified items.";
                const stub = sinon.stub(helper, "_listModifiedLocalItemNames");
                stub.rejects(ITEM_ERROR);

                // Create an helper.pushItemByName spy.
                const spy = sinon.spy(helper, "pushItem");

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stub);
                self.addTestDouble(spy);

                // Call the method being tested.
                let error;
                helper.pushModifiedItems(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (/*items*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the local modified items should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once.
                            expect(stub).to.be.calledOnce;

                            // Verify that the expected error is returned.
                            expect(err.message).to.equal(ITEM_ERROR);

                            // Verify that the spy was not called.
                            expect(spy).to.have.callCount(0);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when getting the local items succeeds.", function (done) {
                // Create a helper._listModifiedLocalItemNames stub that returns a list of items.
                const stubList = sinon.stub(helper, "_listModifiedLocalItemNames");
                stubList.resolves([helper.getName(itemMetadata1), helper.getName(itemMetadata2)]);

                // Create a helper.pushItem stub that return an item.
                const stubPush = sinon.stub(helper, "pushItem");
                stubPush.onCall(0).resolves(itemMetadata1);
                stubPush.onCall(1).resolves(itemMetadata2);

                const stubGetLocalItem = sinon.stub(helper, "getLocalItem");
                stubGetLocalItem.onCall(0).resolves(itemMetadata1);
                stubGetLocalItem.onCall(1).resolves(itemMetadata2);

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stubList);
                self.addTestDouble(stubPush);
                self.addTestDouble(stubGetLocalItem);

                // Call the method being tested.
                let error;
                helper.pushModifiedItems(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (items) {
                        // Verify that the stubs were called the expected number of times.
                        expect(stubList).to.have.been.calledOnce;
                        expect(stubPush).to.have.been.calledTwice;

                        // Verify that pushItem method was called with the expected values.
                        expect(diff.diffJson(stubPush.args[0][1], helper.getName(itemMetadata1))).to.have.lengthOf(1);
                        expect(diff.diffJson(stubPush.args[1][1], helper.getName(itemMetadata2))).to.have.lengthOf(1);

                        // Verify that the expected values were returned.
                        expect(diff.diffJson(items[0], itemMetadata1)).to.have.lengthOf(1);
                        expect(diff.diffJson(items[1], itemMetadata2)).to.have.lengthOf(1);
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

    testPushManifestItems (restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata) {
        const self = this;
        describe("pushManifestItems", function () {
            it("should fail when getting the manifest items fails.", function (done) {
                // Create a helper.getManifestItems stub that returns an error.
                const MANIFEST_ERROR = "There was an error getting the manifest items.";
                const stub = sinon.stub(helper, "getManifestItems");
                stub.rejects(MANIFEST_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                helper.pushManifestItems(context, UnitTest.DUMMY_OPTIONS)
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

            it("should fail when pushing the list of items fails.", function (done) {
                // Create a helper._pushNameList stub that returns an error.
                const LIST_ERROR = "There was an error pushing the manifest items.";
                const stub = sinon.stub(helper, "_pushNameList");
                stub.rejects(LIST_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                helper.pushManifestItems(context, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the manifest items should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once.
                            expect(stub).to.be.calledOnce;

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
        });
    }

    testListLocalItemNames (restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata) {
        const self = this;
        describe("listLocalItemNames", function () {
            it("should fail when getting item names fails.", function (done) {
                // Create an fsApi.listItemNames stub that returns an error.
                const ITEM_ERROR = "There was an error getting the local items.";
                const stub = sinon.stub(fsApi, "listNames");
                stub.rejects(ITEM_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                helper.listLocalItemNames(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (/*items*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the local items should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once.
                            expect(stub).to.be.calledOnce;

                            // Verify that the expected error is returned.
                            expect(err.message).to.contain(ITEM_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when getting item names succeeds.", function (done) {
                const stub = sinon.stub(fsApi, "listNames");
                stub.resolves([itemMetadata1, itemMetadata2]);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                helper.listLocalItemNames(context)
                    .then(function (items) {
                        // Verify that the stub was called once.
                        expect(stub).to.be.calledOnce;

                        // Verify that the expected items are returned.
                        expect(items.length).to.equal(2);
                    })
                    .catch(function (err) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("An unexpected Error."  + err);
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when getting item names succeeds - ready only.", function (done) {
                const stub = sinon.stub(fsApi, "listNames");
                const readyMetadata1 = utils.clone(itemMetadata1);
                readyMetadata1.status = "ready";
                const readyMetadata2 = utils.clone(itemMetadata2);
                readyMetadata2.status = "ready";
                const readyMetadata3 = utils.clone(itemMetadata2);
                readyMetadata3.status = "ready";
                const draftMetadata1 = utils.clone(itemMetadata1);
                draftMetadata1.status = "draft";
                const draftMetadata2 = utils.clone(itemMetadata2);
                draftMetadata2.status = "draft";
                stub.resolves([readyMetadata1, readyMetadata2, readyMetadata3, draftMetadata1, draftMetadata2]);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                helper.listLocalItemNames(context, {filterReady: true})
                    .then(function (items) {
                        // Verify that the stub was called once.
                        expect(stub).to.be.calledOnce;

                        // Verify that the expected items are returned.
                        expect(items.length).to.equal(3);
                    })
                    .catch(function (err) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("An unexpected Error."  + err);
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when getting item names succeeds - draft only.", function (done) {
                const stub = sinon.stub(fsApi, "listNames");
                const readyMetadata1 = utils.clone(itemMetadata1);
                readyMetadata1.status = "ready";
                const readyMetadata2 = utils.clone(itemMetadata2);
                readyMetadata2.status = "ready";
                const readyMetadata3 = utils.clone(itemMetadata2);
                readyMetadata3.status = "ready";
                const draftMetadata1 = utils.clone(itemMetadata1);
                draftMetadata1.status = "draft";
                const draftMetadata2 = utils.clone(itemMetadata2);
                draftMetadata2.status = "draft";
                stub.resolves([readyMetadata1, readyMetadata2, readyMetadata3, draftMetadata1, draftMetadata2]);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                helper.listLocalItemNames(context, {filterDraft: true})
                    .then(function (items) {
                        // Verify that the stub was called once.
                        expect(stub).to.be.calledOnce;

                        // Verify that the expected items are returned.
                        expect(items.length).to.equal(2);
                    })
                    .catch(function (err) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("An unexpected Error."  + err);
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testListRemoteItemNames (restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata) {
        const self = this;
        describe("listRemoteItemNames", function () {
            it("should fail when getting item names fails.", function (done) {
                // Create an fsApi.listItemNames stub that returns an error.
                const ITEM_ERROR = "There was an error getting the local items.";
                const stub = sinon.stub(restApi, "getItems");
                stub.rejects(ITEM_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                helper.listRemoteItemNames(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (/*items*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the local items should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once.
                            expect(stub).to.be.calledOnce;

                            // Verify that the expected error is returned.
                            expect(err.message).to.contain(ITEM_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when getting item names succeeds.", function (done) {
                const stub = sinon.stub(restApi, "getItems");
                stub.resolves([itemMetadata1, itemMetadata2]);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                helper.listRemoteItemNames(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (items) {
                        // Verify that the stub was called once.
                        expect(stub).to.be.calledOnce;

                        // Verify that the expected error is returned.
                        expect(items.length).to.equal(2);
                    })
                    .catch(function (err) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("An unexpected Error."  + err);
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when getting item names succeeds with multiple chunks.", function (done) {
                const stub = sinon.stub(restApi, "getItems");
                stub.onFirstCall().resolves([itemMetadata1]);
                stub.onSecondCall().resolves([itemMetadata2]);
                stub.onThirdCall().resolves([]);

                // Create a stub for the options.getProperty method to return 1 for the chunk limit.
                const originalGetRelevantOption = options.getRelevantOption.bind(options);
                const stubOption = sinon.stub(options, "getRelevantOption", function (context, opts, optionName, serviceName) {
                    if (optionName === "limit") {
                        return 1;
                    } else {
                        return originalGetRelevantOption(context, opts, optionName, serviceName);
                    }
                });

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stub);
                self.addTestDouble(stubOption);

                // Call the method being tested.
                let error;
                helper.listRemoteItemNames(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (items) {
                        // Verify that the stub was called three times.
                        expect(stub).to.be.calledThrice;

                        // Verify that the expected items are returned.
                        expect(items.length).to.equal(2);
                    })
                    .catch(function (err) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("An unexpected Error."  + err);
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when getting item names succeeds - ready only.", function (done) {
                const stub = sinon.stub(restApi, "getItems");
                const readyMetadata1 = utils.clone(itemMetadata1);
                readyMetadata1.status = "ready";
                const readyMetadata2 = utils.clone(itemMetadata2);
                readyMetadata2.status = "ready";
                const readyMetadata3 = utils.clone(itemMetadata2);
                readyMetadata3.status = "ready";
                const draftMetadata1 = utils.clone(itemMetadata1);
                draftMetadata1.status = "draft";
                const draftMetadata2 = utils.clone(itemMetadata2);
                draftMetadata2.status = "draft";
                stub.resolves([readyMetadata1, readyMetadata2, readyMetadata3, draftMetadata1, draftMetadata2]);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                helper.listRemoteItemNames(context, {filterReady: true})
                    .then(function (items) {
                        // Verify that the stub was called once.
                        expect(stub).to.be.calledOnce;

                        // Verify that the expected items are returned.
                        expect(items.length).to.equal(3);
                    })
                    .catch(function (err) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("An unexpected Error."  + err);
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when getting item names succeeds - draft only.", function (done) {
                const stub = sinon.stub(restApi, "getItems");
                const readyMetadata1 = utils.clone(itemMetadata1);
                readyMetadata1.status = "ready";
                const readyMetadata2 = utils.clone(itemMetadata2);
                readyMetadata2.status = "ready";
                const readyMetadata3 = utils.clone(itemMetadata2);
                readyMetadata3.status = "ready";
                const draftMetadata1 = utils.clone(itemMetadata1);
                draftMetadata1.status = "draft";
                const draftMetadata2 = utils.clone(itemMetadata2);
                draftMetadata2.status = "draft";
                stub.resolves([readyMetadata1, readyMetadata2, readyMetadata3, draftMetadata1, draftMetadata2]);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                helper.listRemoteItemNames(context, {filterDraft: true})
                    .then(function (items) {
                        // Verify that the stub was called once.
                        expect(stub).to.be.calledOnce;

                        // Verify that the expected items are returned.
                        expect(items.length).to.equal(2);
                    })
                    .catch(function (err) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("An unexpected Error."  + err);
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when getting item names succeeds - path.", function (done) {
                const pathBased = (type === "types" || type === "layouts" || type === "layout-mappings" || type === "sites/default");

                const stub = sinon.stub(restApi, "getItems");
                const metadata1 = utils.clone(itemMetadata1);
                metadata1.path = "/foo/bar1.json";
                const metadata2 = utils.clone(itemMetadata2);
                metadata2.path = "/bar/foo1.json";
                const metadata3 = utils.clone(itemMetadata2);
                metadata3.path = "/foo/bar2.json";
                const metadata4 = utils.clone(itemMetadata1);
                metadata4.path = "/bar/foo2.json";
                const metadata5 = utils.clone(itemMetadata2);
                metadata5.path = "/foo/bar3.json";
                stub.resolves([metadata1, metadata2, metadata3, metadata4, metadata5]);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                helper.listRemoteItemNames(context, {filterPath: "foo"})
                    .then(function (items) {
                        // Verify that the stub was called once.
                        expect(stub).to.be.calledOnce;

                        // Verify that the expected items are returned.
                        if (pathBased) {
                            expect(items.length).to.equal(3);
                            expect(items[0].path).to.contain("/foo/");
                            expect(items[1].path).to.contain("/foo/");
                            expect(items[2].path).to.contain("/foo/");
                        } else {
                            expect(items.length).to.equal(5);
                        }
                    })
                    .catch(function (err) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("An unexpected Error."  + err);
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testListLocalDeletedNames (restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata) {
        const self = this;
        describe("listLocalDeletedNames", function () {
            it("should get no items.", function (done) {
                // Create a hashes.listFiles stub that returns an empty list of files.
                const stub = sinon.stub(hashes, "listFiles");
                stub.returns([]);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                helper.listLocalDeletedNames(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (items) {
                        // Verify that the stub was called once.
                        expect(stub).to.be.calledOnce;

                        // Verify that the expected error is returned.
                        expect(items.length).to.equal(0);
                    })
                    .catch(function (err) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("An unexpected Error."  + err);
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when getting item names succeeds.", function (done) {
                // Create a hashes.listFiles stub that returns a list of files that don't exist locally.
                const stub = sinon.stub(hashes, "listFiles");
                const rVal = [
                    {id: undefined, path: "file1" + fsApi.getExtension()},
                    {id: undefined, path: "file2" + fsApi.getExtension()},
                    {id: undefined, path: "file3"}
                ];
                stub.returns(rVal);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                helper.listLocalDeletedNames(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (items) {
                        // Verify that the stub was called once.
                        expect(stub).to.be.calledOnce;

                        // Verify that the expected error is returned.
                        expect(items.length).to.equal(2);
                    })
                    .catch(function (err) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("An unexpected Error."  + err);
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when getting item names succeeds - ready only.", function (done) {
                // Create a hashes.listFiles stub that returns a list of files that don't exist locally.
                const stub = sinon.stub(hashes, "listFiles");
                const rVal = [
                    {id: "foo", path: "file1" + fsApi.getExtension()},
                    {id: "foo:draft", path: "file2" + fsApi.getExtension()},
                    {id: "bar", path: "file3" + fsApi.getExtension()}
                ];
                stub.returns(rVal);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                helper.listLocalDeletedNames(context, {"filterReady": true})
                    .then(function (items) {
                        // Verify that the stub was called once.
                        expect(stub).to.be.calledOnce;

                        // Verify that the expected items are returned.
                        expect(items.length).to.equal(2);
                        expect(items[0].id).to.equal("foo");
                        expect(items[1].id).to.equal("bar");
                    })
                    .catch(function (err) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("An unexpected Error."  + err);
                    })
                    .finally(function () {
                        stub.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when getting item names succeeds - draft only.", function (done) {
                // Create a hashes.listFiles stub that returns a list of files that don't exist locally.
                const stub = sinon.stub(hashes, "listFiles");
                const rVal = [
                    {id: "foo", path: "file1" + fsApi.getExtension()},
                    {id: "foo:draft", path: "file2" + fsApi.getExtension()},
                    {id: "bar", path: "file3" + fsApi.getExtension()}
                ];
                stub.returns(rVal);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                helper.listLocalDeletedNames(context, {"filterDraft": true})
                    .then(function (items) {
                        // Verify that the stub was called once.
                        expect(stub).to.be.calledOnce;

                        // Verify that the expected item is returned.
                        expect(items.length).to.equal(1);
                        expect(items[0].id).to.equal("foo:draft");
                    })
                    .catch(function (err) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("An unexpected Error."  + err);
                    })
                    .finally(function () {
                        stub.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testListRemoteDeletedNames (restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata) {
        const self = this;
        describe("listRemoteDeletedNames", function () {
            it("should get no items.", function (done) {
                // Create an fsApi.listItemNames stub that returns an error.
                const ITEM_ERROR = "There was an error getting the local items.";
                const stub = sinon.stub(restApi, "getItems");
                stub.rejects(ITEM_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                helper.listRemoteDeletedNames(context, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the local items should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once.
                            expect(stub).to.be.calledOnce;

                            // Verify that the expected error is returned.
                            expect(err.message).to.contain(ITEM_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when getting item names succeeds.", function (done) {
                // Create an fsApi.listItemNames stub that returns an a list.
                const stub = sinon.stub(hashes, "listFiles");
                const rVal = [
                    {id: undefined, path: "file1" + fsApi.getExtension()},
                    {id: undefined, path: "file2" + fsApi.getExtension()},
                    {id: undefined, path: "file3"}
                ];
                stub.returns(rVal);
                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);


                const stub2 = sinon.stub(restApi, "getItems");
                stub2.resolves([itemMetadata1, itemMetadata2]);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub2);

                // Call the method being tested.
                let error;
                helper.listRemoteDeletedNames(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (items) {
                        // Verify that the stub was called once.
                        expect(stub).to.be.calledOnce;

                        // Verify that the expected error is returned.
                        expect(items.length).to.equal(2);
                    })
                    .catch(function (err) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("An unexpected Error."  + err);
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testListModifiedLocalItemNames (restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata) {
        const self = this;
        describe("listLocalModifiedItemNames", function () {
            it("should fail when getting item names fails.", function (done) {
                // Create an fsApi.listItemNames stub that returns an error.
                const ITEM_ERROR = "There was an error getting the local items.";
                const stub = sinon.stub(fsApi, "listNames");
                stub.rejects(ITEM_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                helper.listModifiedLocalItemNames(context, [helper.NEW, helper.MODIFIED], UnitTest.DUMMY_OPTIONS)
                    .then(function (/*items*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the local items should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once.
                            expect(stub).to.be.calledOnce;

                            // Verify that the expected error is returned.
                            expect(err.message).to.contain(ITEM_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("local modified & new should succeed when getting item names succeeds.", function (done) {
                // Create an fsApi.listItemNames stub that returns an a list.
                const stub = sinon.stub(fsApi, "listNames");
                const rVal = [
                    {id: "file1id", name: "file1"},
                    {id: "file2id", name: "file2"},
                    {id: "file3id", name: "file3"}
                ];
                stub.resolves(rVal);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                const stub2= sinon.stub(hashes, "isLocalModified");
                stub2.returns(true);
                self.addTestDouble(stub2);

                // Call the method being tested.
                let error;
                helper.listModifiedLocalItemNames(context, [helper.NEW, helper.MODIFIED], UnitTest.DUMMY_OPTIONS)
                    .then(function (items) {
                        // Verify that the stub was called once.
                        expect(stub).to.be.calledOnce;

                        // Verify that the expected error is returned.
                        expect(items.length).to.equal(3);
                    })
                    .catch(function (err) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("An unexpected Error."  + err);
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("local deleted should succeed when getting item names succeeds.", function (done) {
                const stub = sinon.stub(hashes, "listFiles");
                const rVal = [
                    {id: undefined, path: "file1" + fsApi.getExtension()},
                    {id: undefined, path: "file2" + fsApi.getExtension()},
                    {id: undefined, path: "file3"}
                ];
                stub.returns(rVal);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);
                // Call the method being tested.
                let error;
                helper.listModifiedLocalItemNames(context, [helper.DELETED], UnitTest.DUMMY_OPTIONS)
                    .then(function (items) {
                        // Verify that the stub was called once.
                        expect(stub).to.be.calledOnce;

                        // Verify that the expected error is returned.
                        expect(items.length).to.equal(2);
                    })
                    .catch(function (err) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("An unexpected Error."  + err);
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });


            it("should succeed when getting item names succeeds - ready only.", function (done) {
                const stub = sinon.stub(fsApi, "listNames");
                const readyMetadata1 = utils.clone(itemMetadata1);
                readyMetadata1.status = "ready";
                const readyMetadata2 = utils.clone(itemMetadata1);
                readyMetadata2.status = "ready";
                const readyMetadata3 = utils.clone(itemMetadata1);
                readyMetadata3.status = "ready";
                const draftMetadata1 = utils.clone(itemMetadata1);
                draftMetadata1.status = "draft";
                const draftMetadata2 = utils.clone(itemMetadata1);
                draftMetadata2.status = "draft";
                stub.resolves([readyMetadata1, readyMetadata2, readyMetadata3, draftMetadata1, draftMetadata2]);

                const stubModified = sinon.stub(hashes, "isLocalModified");
                stubModified.returns(true);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);
                self.addTestDouble(stubModified);

                // Call the method being tested.
                let error;
                helper.listModifiedLocalItemNames(context, [helper.NEW, helper.MODIFIED], {filterReady: true})
                    .then(function (items) {
                        // Verify that the stub was called once.
                        expect(stub).to.be.calledOnce;

                        // Verify that the expected items are returned.
                        expect(items.length).to.equal(3);
                    })
                    .catch(function (err) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("An unexpected Error."  + err);
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when getting item names succeeds - draft only.", function (done) {
                const stub = sinon.stub(fsApi, "listNames");
                const readyMetadata1 = utils.clone(itemMetadata1);
                readyMetadata1.status = "ready";
                const readyMetadata2 = utils.clone(itemMetadata1);
                readyMetadata2.status = "ready";
                const readyMetadata3 = utils.clone(itemMetadata1);
                readyMetadata3.status = "ready";
                const draftMetadata1 = utils.clone(itemMetadata1);
                draftMetadata1.status = "draft";
                const draftMetadata2 = utils.clone(itemMetadata1);
                draftMetadata2.status = "draft";
                stub.resolves([readyMetadata1, readyMetadata2, readyMetadata3, draftMetadata1, draftMetadata2]);

                const stubModified = sinon.stub(hashes, "isLocalModified");
                stubModified.returns(true);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);
                self.addTestDouble(stubModified);

                // Call the method being tested.
                let error;
                helper.listModifiedLocalItemNames(context, [helper.NEW, helper.MODIFIED], {filterDraft: true})
                    .then(function (items) {
                        // Verify that the stub was called once.
                        expect(stub).to.be.calledOnce;

                        // Verify that the expected items are returned.
                        expect(items.length).to.equal(2);
                    })
                    .catch(function (err) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("An unexpected Error."  + err);
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }


    testListModifiedRemoteItemNames (restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata) {
        const self = this;
        describe("listRemoteModifiedItemNames", function () {
            it("should fail when getting item names fails.", function (done) {
                const ITEM_ERROR = "There was an error getting the remote items.";
                const stub = sinon.stub(restApi, "getModifiedItems");
                stub.rejects(ITEM_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                helper.listModifiedRemoteItemNames(context, [helper.NEW, helper.MODIFIED], UnitTest.DUMMY_OPTIONS)
                    .then(function (/*items*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the Remote items should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once.
                            expect(stub).to.be.calledOnce;

                            // Verify that the expected error is returned.
                            expect(err.message).to.contain(ITEM_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("Remote modified & new should succeed when getting item names succeeds.", function (done) {
                const stub = sinon.stub(restApi, "getModifiedItems");
                stub.resolves([itemMetadata1, itemMetadata2]);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                const stub2= sinon.stub(hashes, "isRemoteModified");
                stub2.returns(true);
                self.addTestDouble(stub2);

                // Call the method being tested.
                let error;
                helper.listModifiedRemoteItemNames(context, [helper.NEW, helper.MODIFIED], UnitTest.DUMMY_OPTIONS)
                    .then(function (items) {
                        // Verify that the stub was called once.
                        expect(stub).to.be.calledOnce;

                        // Verify that the expected error is returned.
                        expect(items.length).to.equal(2);
                    })
                    .catch(function (err) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("An unexpected Error."  + err);
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("Remote modified & new should succeed even when getting a local item fails.", function (done) {
                const stubGet = sinon.stub(restApi, "getModifiedItems");
                stubGet.resolves([itemMetadata1, itemMetadata2]);

                const stubPath = sinon.stub(fsApi, "getItemPath");
                stubPath.onFirstCall().returns(UnitTest.DUMMY_PATH);
                stubPath.onSecondCall().throws(new Error("Error getting item path, as expected by unit test."));

                const stubModified = sinon.stub(hashes, "isRemoteModified");
                stubModified.returns(true);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubModified);
                self.addTestDouble(stubPath);

                // Call the method being tested.
                let error;
                helper.listModifiedRemoteItemNames(context, [helper.NEW, helper.MODIFIED], UnitTest.DUMMY_OPTIONS)
                    .then(function (items) {
                        // Verify that the stub was called once.
                        expect(stubGet).to.be.calledOnce;

                        // Verify that the expected item is returned.
                        expect(items.length).to.equal(1);
                    })
                    .catch(function (err) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("An unexpected Error."  + err);
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("Remote deleted should succeed when getting item names succeeds.", function (done) {
                const stub = sinon.stub(hashes, "listFiles");
                const rVal = [
                    {id: undefined, path: "file1" + fsApi.getExtension()},
                    {id: undefined, path: "file2" + fsApi.getExtension()},
                    {id: undefined, path: "file3"}
                ];
                stub.returns(rVal);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                const stub2 = sinon.stub(helper, "listRemoteDeletedNames");
                const rVal2 = [
                    "file1",
                    "file2",
                    "file3"
                ];
                stub2.resolves(rVal2);
                // The stub should be restored when the test is complete.
                self.addTestDouble(stub2);

                const stub3 = sinon.stub(restApi, "getModifiedItems");
                stub3.resolves([]);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub3);

                // Call the method being tested.
                let error;
                helper.listModifiedRemoteItemNames(context, [helper.DELETED], UnitTest.DUMMY_OPTIONS)
                    .then(function (items) {
                        // Verify that the stub was called once.
                        expect(stub2).to.be.calledOnce;

                        // Verify that the expected error is returned.
                        expect(items.length).to.equal(3);
                    })
                    .catch(function (err) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("An unexpected Error."  + err);
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testDeleteLocalItem (restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata) {
        const self = this;
        describe("deleteLocalItem", function () {
            it("should succeed when deleting a non-existent local item.", function (done) {
                // Create an fsApi.deleteItem stub that returns no filepath, indicating that the file did not exist.
                const stubDelete = sinon.stub(fsApi, "deleteItem");
                stubDelete.resolves(undefined);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubDelete);

                // Call the method being tested.
                let error;
                helper.deleteLocalItem(context, UnitTest.DUMMY_METADATA)
                    .then(function (item) {
                        // Verify that the stubs were called once and that the helper returned the expected value.
                        expect(stubDelete).to.have.been.calledOnce;
                        expect(diff.diffJson(UnitTest.DUMMY_METADATA, item)).to.have.lengthOf(1);
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

            it("should succeed when deleting an existing local item.", function (done) {
                // Create an fsApi.deleteItem stub that returns no filepath, indicating that the file did not exist.
                const stubDelete = sinon.stub(fsApi, "deleteItem");
                stubDelete.resolves(UnitTest.DUMMY_PATH);

                // Create a hashes.removeHashes stub
                const stubHashes = sinon.stub(hashes, "removeHashes");

                // Create an utils.removeEmptyParentDirectories stub
                const stubUtils = sinon.stub(utils, "removeEmptyParentDirectories");

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubDelete);
                self.addTestDouble(stubHashes);
                self.addTestDouble(stubUtils);

                // Call the method being tested.
                let error;
                helper.deleteLocalItem(context, UnitTest.DUMMY_METADATA)
                    .then(function (item) {
                        // Verify that the stubs were called once and that the helper returned the expected value.
                        expect(stubDelete).to.have.been.calledOnce;
                        expect(stubHashes).to.have.been.calledOnce;
                        expect(stubUtils).to.have.been.calledOnce;
                        expect(diff.diffJson(UnitTest.DUMMY_METADATA, item)).to.have.lengthOf(1);
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

    testDeleteRemoteItem (restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata) {
        const self = this;
        describe("deleteRemoteItem", function () {
            it("should fail when deleting the item fails.", function (done) {
                const ITEM_ERROR = "There was an error deleting the item.";
                const stub = sinon.stub(restApi, "deleteItem");
                const err = new Error(ITEM_ERROR);
                err.retry = true;
                stub.rejects(err);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                helper.deleteRemoteItem(context, "asdfqwerty", UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for delete item should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once and the expected error is returned.
                        expect(stub).to.be.calledOnce;
                        expect(err.message).to.equal(ITEM_ERROR);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when deleting a remote item.", function (done) {
                  // Create an restApi.getItems stub that returns a promise for the metadata of the items.
                  const stub = sinon.stub(restApi, "deleteItem");
                  stub.resolves("DELETED");

                  // The stub should be restored when the test is complete.
                  self.addTestDouble(stub);

                  // Call the method being tested.
                  let error;
                  helper.deleteRemoteItem(context, {"id": "123456"})
                      .then(function (res) {
                          // Verify that the stub was called once and that the helper returned the expected values.
                          expect(stub).to.have.been.calledOnce;
                          expect(res).to.not.be.empty;
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

    testDeleteRemoteItems (restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata) {
        const self = this;
        describe("deleteRemoteItem", function () {
            it("should fail when getting the remote items fails.", function (done) {
                const GET_ERROR = "There was an error getting the remote items.";
                const stub = sinon.stub(helper, "getRemoteItems");
                const err = new Error(GET_ERROR);
                stub.rejects(err);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                helper.deleteRemoteItems(context, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for delete item should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once and the expected error is returned.
                        expect(stub).to.be.calledOnce;
                        expect(err.message).to.equal(GET_ERROR);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when getting the remote items succeeds.", function (done) {
                const stubGet = sinon.stub(helper, "getRemoteItems");
                stubGet.resolves([itemMetadata1, itemMetadata2]);

                const stubCan = sinon.stub(helper, "canDeleteItem");
                stubCan.returns(true);

                const stubDelete = sinon.stub(restApi, "deleteItem");
                stubDelete.onFirstCall().resolves(itemMetadata1);
                stubDelete.onSecondCall().resolves(itemMetadata2);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubCan);
                self.addTestDouble(stubDelete);

                // Call the method being tested.
                let error;
                helper.deleteRemoteItems(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (items) {
                        // Verify that the stubs were called the expected number of times.
                        expect(stubGet).to.be.calledOnce;
                        expect(stubCan).to.be.calledTwice;
                        expect(stubDelete).to.be.calledTwice;

                        expect(items).to.have.lengthOf(2);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when one of the deletes results in a 404 error.", function (done) {
                const stubGet = sinon.stub(helper, "getRemoteItems");
                stubGet.resolves([itemMetadata1, itemMetadata2]);

                const stubCan = sinon.stub(helper, "canDeleteItem");
                stubCan.returns(true);

                const stubDelete = sinon.stub(restApi, "deleteItem");
                const notFoundError = new Error();
                notFoundError.statusCode = 404;
                stubDelete.onFirstCall().resolves(itemMetadata1);
                stubDelete.onSecondCall().rejects(notFoundError);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubCan);
                self.addTestDouble(stubDelete);

                // Call the method being tested.
                let error;
                helper.deleteRemoteItems(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (items) {
                        // Verify that the stubs were called the expected number of times.
                        expect(stubGet).to.be.calledOnce;
                        expect(stubCan).to.be.calledTwice;
                        expect(stubDelete).to.be.calledTwice;

                        expect(items).to.have.lengthOf(2);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when retrying a delete succeeds.", function (done) {
                const stubGet = sinon.stub(helper, "getRemoteItems");
                stubGet.resolves([itemMetadata1, itemMetadata2, itemMetadata1]);

                const stubCan = sinon.stub(helper, "canDeleteItem");
                stubCan.returns(true);

                const stubDelete = sinon.stub(restApi, "deleteItem");
                const DELETE_ERROR = "Error deleting item, expected by unit test.";
                const deleteError = new Error(DELETE_ERROR);
                deleteError.log = DELETE_ERROR;
                deleteError.retry = true;
                stubDelete.onCall(0).resolves(itemMetadata1);
                stubDelete.onCall(1).resolves(itemMetadata2);
                stubDelete.onCall(2).rejects(deleteError);
                stubDelete.onCall(3).resolves(itemMetadata1);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubCan);
                self.addTestDouble(stubDelete);

                // Call the method being tested.
                let error;
                helper.deleteRemoteItems(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (items) {
                        // Verify that the stubs were called the expected number of times.
                        expect(stubGet).to.be.calledOnce;
                        expect(stubCan).to.have.callCount(4);
                        expect(stubDelete).to.have.callCount(4);

                        expect(items).to.have.lengthOf(3);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when retrying a delete fails.", function (done) {
                const stubGet = sinon.stub(helper, "getRemoteItems");
                stubGet.onCall(0).resolves([itemMetadata1]);
                stubGet.onCall(1).resolves([itemMetadata2]);
                stubGet.onCall(2).resolves([itemMetadata1]);
                stubGet.onCall(3).resolves([itemMetadata2]);
                stubGet.onCall(4).resolves([]);

                const stubCan = sinon.stub(helper, "canDeleteItem");
                stubCan.returns(true);

                // Create a stub for the options.getProperty method to return 1 for the chunk limit.
                const originalGetRelevantOption = options.getRelevantOption.bind(options);
                const stubOption = sinon.stub(options, "getRelevantOption", function (context, opts, optionName, serviceName) {
                    if (optionName === "limit") {
                        return 1;
                    } else {
                        return originalGetRelevantOption(context, opts, optionName, serviceName);
                    }
                });

                const stubDelete = sinon.stub(restApi, "deleteItem");
                const notFoundError = new Error();
                notFoundError.statusCode = 404;
                const DELETE_ERROR = "Error deleting item, expected by unit test.";
                const deleteError = new Error(DELETE_ERROR);
                deleteError.retry = true;
                stubDelete.onCall(0).resolves(itemMetadata1);
                stubDelete.onCall(1).resolves(itemMetadata2);
                stubDelete.onCall(2).rejects(notFoundError);
                stubDelete.onCall(3).rejects(deleteError);
                stubDelete.onCall(4).rejects(deleteError);

                // Remove the emitter and make sure the delete still fails as expected.
                const emitter = context.eventEmitter;
                delete context.eventEmitter;

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubCan);
                self.addTestDouble(stubOption);
                self.addTestDouble(stubDelete);

                // Call the method being tested.
                let error;
                helper.deleteRemoteItems(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (items) {
                        // Verify that the stubs were called the expected number of times.
                        expect(stubGet).to.have.callCount(5);
                        expect(stubCan).to.have.callCount(5);
                        expect(stubDelete).to.have.callCount(5);

                        expect(items).to.have.lengthOf(3);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Restore the context's event emitter.
                        context.eventEmitter = emitter;

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when one retry succeeds and one retry fails.", function (done) {
                const stubGet = sinon.stub(helper, "getRemoteItems");
                stubGet.resolves([itemMetadata1, itemMetadata2, itemMetadata1, itemMetadata2]);

                const stubCan = sinon.stub(helper, "canDeleteItem");
                stubCan.returns(true);

                const stubDelete = sinon.stub(restApi, "deleteItem");
                const DELETE_ERROR = "Error deleting item, expected by unit test.";
                const deleteError = new Error(DELETE_ERROR);
                deleteError.retry = true;
                stubDelete.onCall(0).resolves(itemMetadata1);
                stubDelete.onCall(1).resolves(itemMetadata2);
                stubDelete.onCall(2).rejects(deleteError);
                stubDelete.onCall(3).rejects(deleteError);
                stubDelete.onCall(4).resolves(itemMetadata1);
                stubDelete.onCall(5).rejects(deleteError);
                stubDelete.onCall(6).rejects(deleteError);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubCan);
                self.addTestDouble(stubDelete);

                // Call the method being tested.
                let error;
                helper.deleteRemoteItems(context, UnitTest.DUMMY_OPTIONS)
                    .then(function (items) {
                        // Verify that the stubs were called the expected number of times.
                        expect(stubGet).to.be.calledOnce;
                        expect(stubCan).to.have.callCount(7);
                        expect(stubDelete).to.have.callCount(7);

                        expect(items).to.have.lengthOf(3);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail if throttledAll fails while retrying the initial chunk.", function (done) {
                const stubGet = sinon.stub(helper, "getRemoteItems");
                stubGet.resolves([itemMetadata1, itemMetadata2, itemMetadata1]);

                const stubCan = sinon.stub(helper, "canDeleteItem");
                stubCan.returns(true);

                const stubDelete = sinon.stub(restApi, "deleteItem");
                const DELETE_ERROR = "Error deleting item, expected by unit test.";
                const deleteError = new Error(DELETE_ERROR);
                deleteError.retry = true;
                stubDelete.onCall(0).resolves(itemMetadata1);
                stubDelete.onCall(1).resolves(itemMetadata2);
                stubDelete.onCall(2).rejects(deleteError);

                const THROTTLE_ERROR = "Error throttling all, expected by unit test.";
                const originalThrottledAll = utils.throttledAll;
                const stubThrottle = sinon.stub(utils, "throttledAll", function (context, functions, concurrentLimit) {
                    if (functions.length === 1) {
                        // Fail when retrying the failed item.
                        return Q.reject(new Error(THROTTLE_ERROR));
                    } else {
                        return originalThrottledAll(context, functions, concurrentLimit);
                    }
                });

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubCan);
                self.addTestDouble(stubDelete);
                self.addTestDouble(stubThrottle);

                // Call the method being tested.
                let error;
                helper.deleteRemoteItems(context, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for delete items should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stubs were called the expected number of times.
                        expect(stubGet).to.be.calledOnce;
                        expect(stubCan).to.have.callCount(4);
                        expect(stubDelete).to.have.callCount(3);
                        expect(stubThrottle).to.have.callCount(2);

                        // Verify that the expected error was returned.
                        expect(err.message).to.contain(THROTTLE_ERROR)
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail if throttledAll fails while retrying in a subsequent chunk.", function (done) {
                if (helper.isRetryDeleteEnabled()) {
                    const stubGet = sinon.stub(helper, "getRemoteItems");
                    stubGet.onCall(0).resolves([itemMetadata1]);
                    stubGet.onCall(1).resolves([itemMetadata2]);
                    stubGet.onCall(2).resolves([itemMetadata1]);
                    stubGet.onCall(3).resolves([]);

                    const stubCan = sinon.stub(helper, "canDeleteItem");
                    stubCan.returns(true);

                    // Create a stub for the options.getProperty method to return 1 for the chunk limit.
                    const originalGetRelevantOption = options.getRelevantOption.bind(options);
                    const stubOption = sinon.stub(options, "getRelevantOption", function (context, opts, optionName, serviceName) {
                        if (optionName === "limit") {
                            return 1;
                        } else {
                            return originalGetRelevantOption(context, opts, optionName, serviceName);
                        }
                    });

                    const stubDelete = sinon.stub(restApi, "deleteItem");
                    const DELETE_ERROR = "Error deleting item, expected by unit test.";
                    const deleteError = new Error(DELETE_ERROR);
                    deleteError.retry = true;
                    stubDelete.onCall(0).resolves(itemMetadata1);
                    stubDelete.onCall(1).rejects(deleteError);
                    stubDelete.onCall(2).rejects(deleteError);
                    stubDelete.onCall(3).resolves(itemMetadata2);

                    const THROTTLE_ERROR = "Error throttling all, expected by unit test.";
                    const originalThrottledAll = utils.throttledAll;
                    let throttleCallCount = 0;
                    const stubThrottle = sinon.stub(utils, "throttledAll", function (context, functions, concurrentLimit) {
                        if (++throttleCallCount === 6) {
                            // Fail when retrying the failed item.
                            return Q.reject(new Error(THROTTLE_ERROR));
                        } else {
                            return originalThrottledAll(context, functions, concurrentLimit);
                        }
                    });

                    // The stubs should be restored when the test is complete.
                    self.addTestDouble(stubGet);
                    self.addTestDouble(stubCan);
                    self.addTestDouble(stubOption);
                    self.addTestDouble(stubDelete);
                    self.addTestDouble(stubThrottle);

                    // Call the method being tested.
                    let error;
                    helper.deleteRemoteItems(context, UnitTest.DUMMY_OPTIONS)
                        .then(function () {
                            // This is not expected. Pass the error to the "done" function to indicate a failed test.
                            error = new Error("The promise for delete items should have been rejected.");
                        })
                        .catch(function (err) {
                            // Verify that the stubs were called the expected number of times.
                            expect(stubGet).to.have.callCount(4);
                            expect(stubCan).to.have.callCount(5);
                            expect(stubDelete).to.have.callCount(4);
                            expect(stubThrottle).to.have.callCount(6);

                            // Verify that the expected error was returned.
                            expect(err.message).to.contain(THROTTLE_ERROR)
                        })
                        .catch(function (err) {
                            error = err;
                        })
                        .finally(function () {
                            // Call mocha's done function to indicate that the test is over.
                            done(error);
                        });
                } else {
                    done();
                }
            });
        });
    }

    testMiscellaneous (restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata) {
        describe("filterRetryPush", function () {
            it("should return false when retry push is not enabled.", function (done) {
                if (!helper.isRetryPushEnabled()) {
                    // Call the method being tested.
                    let error;
                    try {
                        expect(helper.filterRetryPush(context, new Error("This unit test error is expected."))).to.equal(false);
                    } catch (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    } finally {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    }
                } else {
                    done();
                }
            });
        });

        describe("filterRetryDelete", function () {
            it("should return false when retry delete is not enabled.", function (done) {
                if (!helper.isRetryDeleteEnabled()) {
                    // Call the method being tested.
                    let error;
                    try {
                        expect(helper.filterRetryDelete(context, new Error("This unit test error is expected."))).to.equal(false);
                    } catch (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    } finally {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    }
                } else {
                    done();
                }
            });
        });

        describe("canDeleteItem", function () {
            it("should return false when the item is not valid.", function (done) {
                // Call the method being tested.
                let error;
                try {
                    expect(helper.canDeleteItem("Invalid object")).to.equal(false);
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
                    expect(helper.canDeleteItem({"object": "valid"})).to.equal(true);
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

    testGetManifestItems (restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata) {
        describe("getManifestItems", function () {
            it("should succeed with no section", function (done) {
                const stubSection = sinon.stub(manifests, "getManifestSection");
                stubSection.returns(undefined);

                let error;
                helper.getManifestItems(context)
                    .then(function (items) {
                        expect(items).to.have.lengthOf(0);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        stubSection.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed with empty section", function (done) {
                const stubSection = sinon.stub(manifests, "getManifestSection");
                stubSection.returns({});

                let error;
                helper.getManifestItems(context)
                    .then(function (items) {
                        expect(items).to.have.lengthOf(0);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        stubSection.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed with existing section", function (done) {
                const TEST_MANIFEST_SECTION = {"id1": {"id": "id1", "name": "name1", "path": "path1"}, "id2": {"id": "id2", "name": "name2", "path": "path2"}};
                const stubSection = sinon.stub(manifests, "getManifestSection");
                stubSection.returns(TEST_MANIFEST_SECTION);

                let error;
                helper.getManifestItems(context)
                    .then(function (items) {
                        expect(items).to.have.lengthOf(2);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        stubSection.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed with existing section, some items missing id", function (done) {
                const TEST_MANIFEST_SECTION = {"id1": {"id": "id1", "name": "name1", "path": "path1"}, "id2": {"name": "name2", "path": "path2"}};
                const stubSection = sinon.stub(manifests, "getManifestSection");
                stubSection.returns(TEST_MANIFEST_SECTION);

                let error;
                helper.getManifestItems(context)
                    .then(function (items) {
                        expect(items).to.have.lengthOf(1);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        stubSection.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testDeleteManifestItems (restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata) {
        describe("deleteManifestItems", function () {
            it("should succeed with no section", function (done) {
                const stubSection = sinon.stub(manifests, "getManifestSection");
                stubSection.returns(undefined);

                let error;
                helper.deleteManifestItems(context)
                    .then(function (items) {
                        expect(items).to.have.lengthOf(0);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        stubSection.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed with empty section", function (done) {
                const stubSection = sinon.stub(manifests, "getManifestSection");
                stubSection.returns({});

                let error;
                helper.deleteManifestItems(context)
                    .then(function (items) {
                        expect(items).to.have.lengthOf(0);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        stubSection.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testSearchRemote (restApi, helper, path1, path2, badPath) {
        const self = this;
        describe("searchRemote", function () {
            it("should succeed with default options.", function (done) {
                const itemMetadata1 = UnitTest.getJsonObject(path1);
                const stubRest = sinon.stub(searchREST, "search");
                stubRest.resolves({"documents": [itemMetadata1] });

                // Make sure it can succeed if the helper has no classification.
                const classification = helper._classification;
                delete helper._classification;

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubRest);

                let error;
                helper.searchRemote(context, null, UnitTest.DUMMY_OPTIONS)
                    .then(function (documents) {
                        // Verify that the stub was called once.
                        expect(stubRest).to.have.been.calledOnce;

                        // Verify that the expected options were passed to the stub.
                        expect(stubRest.args[0][1]["q"]).to.equal("*:*");
                        expect(stubRest.args[0][1]["fl"]).to.have.lengthOf(2);
                        expect(stubRest.args[0][1]["fl"][0]).to.equal("name");
                        expect(stubRest.args[0][1]["fl"][1]).to.equal("id");
                        expect(stubRest.args[0][1]["fq"]).to.have.lengthOf(0);

                        // Verify that the expected item was returned.
                        expect(documents).to.have.lengthOf(1);
                        expect(documents[0].id).to.equal(itemMetadata1.id);
                    })
                    .catch (function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's classification.
                        helper._classification = classification;

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed with specific options.", function (done) {
                const itemMetadata1 = UnitTest.getJsonObject(path1);
                const stubRest = sinon.stub(searchREST, "search");
                stubRest.resolves({"documents": [itemMetadata1] });

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubRest);

                let error;
                helper.searchRemote(context, {"q": "foo", "fl": "bar", "fq": "another"}, UnitTest.DUMMY_OPTIONS)
                    .then(function (documents) {
                        // Verify that the stub was called once.
                        expect(stubRest).to.have.been.calledOnce;

                        // Verify that the expected options were passed to the stub.
                        expect(stubRest.args[0][1]["q"]).to.equal("foo");
                        expect(stubRest.args[0][1]["fl"]).to.have.lengthOf(3);
                        expect(stubRest.args[0][1]["fl"][0]).to.equal("bar");
                        expect(stubRest.args[0][1]["fl"][1]).to.equal("id");
                        expect(stubRest.args[0][1]["fl"][2]).to.equal("name");
                        if (helper._classification) {
                            expect(stubRest.args[0][1]["fq"]).to.have.lengthOf(2);
                            expect(stubRest.args[0][1]["fq"][0]).to.equal("another");
                            expect(stubRest.args[0][1]["fq"][1]).to.contain(helper._classification);
                        } else {
                            expect(stubRest.args[0][1]["fq"]).to.have.lengthOf(1);
                            expect(stubRest.args[0][1]["fq"][0]).to.equal("another");
                        }

                        // Verify that the expected item was returned.
                        expect(documents).to.have.lengthOf(1);
                        expect(documents[0].id).to.equal(itemMetadata1.id);
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

            it("should succeed with ready filter.", function (done) {
                const itemMetadata1 = UnitTest.getJsonObject(path1);
                const stubRest = sinon.stub(searchREST, "search");
                stubRest.resolves({"documents": [itemMetadata1] });

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubRest);

                let error;
                helper.searchRemote(context, {"q": "foo", "fl": "bar", "fq": "another"}, {filterReady: true})
                    .then(function (documents) {
                        // Verify that the stub was called once.
                        expect(stubRest).to.have.been.calledOnce;

                        // Verify that the expected options were passed to the stub.
                        expect(stubRest.args[0][1]["q"]).to.equal("foo");
                        expect(stubRest.args[0][1]["fl"]).to.have.lengthOf(4);
                        expect(stubRest.args[0][1]["fl"][0]).to.equal("bar");
                        expect(stubRest.args[0][1]["fl"][1]).to.equal("id");
                        expect(stubRest.args[0][1]["fl"][2]).to.equal("name");
                        expect(stubRest.args[0][1]["fl"][3]).to.equal("status");
                        if (helper._classification) {
                            expect(stubRest.args[0][1]["fq"]).to.have.lengthOf(2);
                            expect(stubRest.args[0][1]["fq"][0]).to.equal("another");
                            expect(stubRest.args[0][1]["fq"][1]).to.contain(helper._classification);
                        } else {
                            expect(stubRest.args[0][1]["fq"]).to.have.lengthOf(1);
                            expect(stubRest.args[0][1]["fq"][0]).to.equal("another");
                        }

                        // Verify that the expected item was returned.
                        expect(documents).to.have.lengthOf(1);
                        expect(documents[0].id).to.equal(itemMetadata1.id);
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

            it("should succeed with draft filter.", function (done) {
                const itemMetadata1 = UnitTest.getJsonObject(path1);
                const stubRest = sinon.stub(searchREST, "search");
                stubRest.resolves({"documents": [itemMetadata1] });

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubRest);

                let error;
                helper.searchRemote(context, {"q": "foo", "fl": "bar", "fq": "another"}, {filterDraft: true})
                    .then(function (documents) {
                        // Verify that the stub was called once.
                        expect(stubRest).to.have.been.calledOnce;

                        // Verify that the expected options were passed to the stub.
                        expect(stubRest.args[0][1]["q"]).to.equal("foo");
                        expect(stubRest.args[0][1]["fl"]).to.have.lengthOf(4);
                        expect(stubRest.args[0][1]["fl"][0]).to.equal("bar");
                        expect(stubRest.args[0][1]["fl"][1]).to.equal("id");
                        expect(stubRest.args[0][1]["fl"][2]).to.equal("name");
                        expect(stubRest.args[0][1]["fl"][3]).to.equal("status");
                        if (helper._classification) {
                            expect(stubRest.args[0][1]["fq"]).to.have.lengthOf(2);
                            expect(stubRest.args[0][1]["fq"][0]).to.equal("another");
                            expect(stubRest.args[0][1]["fq"][1]).to.contain(helper._classification);
                        } else {
                            expect(stubRest.args[0][1]["fq"]).to.have.lengthOf(1);
                            expect(stubRest.args[0][1]["fq"][0]).to.equal("another");
                        }

                        // Verify that no draft items were returned.
                        expect(documents).to.have.lengthOf(0);
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

            it("should succeed when searchREST.searchRemote succeeds.", function (done) {
                const itemMetadata1 = UnitTest.getJsonObject(path1);
                const stubRest = sinon.stub(searchREST, "search");
                stubRest.resolves({"documents": [itemMetadata1] });

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubRest);

                let error;
                helper.searchRemote(context, {"fq": [ "name:(\"" + UnitTest.DUMMY_NAME + "\")"], "fl": []}, UnitTest.DUMMY_OPTIONS)
                    .then(function (documents) {
                        // Verify that the stub was called.
                        expect(stubRest).to.have.been.called;

                        // Verify that the expected options were passed to the stub.
                        expect(stubRest.args[0][1]["q"]).to.equal("*:*");
                        expect(stubRest.args[0][1]["fl"]).to.have.lengthOf(1);
                        expect(stubRest.args[0][1]["fl"][0]).to.equal("*");
                        if (helper._classification) {
                            expect(stubRest.args[0][1]["fq"]).to.have.lengthOf(2);
                            expect(stubRest.args[0][1]["fq"][0]).to.contain(UnitTest.DUMMY_NAME);
                            expect(stubRest.args[0][1]["fq"][1]).to.contain(helper._classification);
                        } else {
                            expect(stubRest.args[0][1]["fq"]).to.have.lengthOf(1);
                            expect(stubRest.args[0][1]["fq"][0]).to.contain(UnitTest.DUMMY_NAME);
                        }

                        // Verify that the expected item was returned.
                        expect(documents).to.not.be.empty;
                        expect(documents[0].id).to.equal(itemMetadata1.id);
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

            it("should fail when the search call fails.", function (done) {
                const ITEM_ERROR = "An error occurred.";
                const stub = sinon.stub(searchREST, "search");
                stub.rejects(ITEM_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                helper.searchRemote(context, {"fq": [ "name:(\"" + UnitTest.DUMMY_NAME + "\")"]}, UnitTest.DUMMY_OPTIONS)
                    .then(function (/*item*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the pulled item should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called.
                        expect(stub).to.have.been.called;

                        // Verify that the expected error is returned.
                        expect(err.message).to.equal(ITEM_ERROR);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when searchREST.searchRemote return no documents.", function (done) {
                const stubRest = sinon.stub(searchREST, "search");
                stubRest.resolves({});

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubRest);

                let error;
                helper.searchRemote(context, {"fq": [ "name:(\"" + UnitTest.DUMMY_NAME + "\")"], "fl": []}, UnitTest.DUMMY_OPTIONS)
                    .then(function (documents) {
                        // Verify that the stub was called.
                        expect(stubRest).to.have.been.called;

                        // Verify that the expected value was returned.
                        expect(documents).to.be.empty;
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
}

module.exports = BaseHelperUnitTest;
