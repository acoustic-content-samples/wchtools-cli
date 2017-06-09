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
 * NOTE: The StatusTracker and EventEmitter objects used by the helper object are
 * used to execute some of the tests, so the provided functionality is not stubbed out.
 */
"use strict";

// Require the super classes for this class.
const UnitTest = require("./base.unit.js");

// Require the node modules used in this test file.
const fs = require("fs");
const rimraf = require("rimraf");
const diff = require("diff");
const sinon = require("sinon");
const options = require(UnitTest.API_PATH + "lib/utils/options.js");
const hashes = require(UnitTest.API_PATH + "lib/utils/hashes.js");

class BaseHelperUnitTest extends UnitTest {
    constructor () {
        super();
    }

    run (restApi,fsApi, helper, path1, path2, badPath) {
        const self = this;
        const type =  fsApi.getFolderName();

        // The contents of the test item metadata files.
        const itemMetadata1 = UnitTest.getJsonObject(path1);
        const itemMetadata2 = UnitTest.getJsonObject(path2);
        const badMetadata = UnitTest.getJsonObject(badPath);
        describe("Unit tests for Helper " + type, function () {
            // Initialize common resourses before running the unit tests.
            before(function (done) {
                helper.reset();

                // Remove the artifact folder before the tests are run.
                rimraf.sync(fsApi.getPath());

                // Signal that the cleanup is complete.
                done();
            });

            // Cleanup common resourses consumed by a test.
            afterEach(function (done) {
                // Restore any stubs and spies used for the test.
                self.restoreTestDoubles();

                // Reset the state of the helper.
                helper.reset();

                // Signal that the cleanup is complete.
                done();
            });

            // Cleanup common resourses after running the tests.
            after(function (done) {
                // Remove the artifact folder.
                rimraf.sync(fsApi.getPath());

                // Signal that the cleanup is complete.
                done();
            });

            // Run each of the tests defined in this class.
            self.testSingleton(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testEventEmitter(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testGetVirtualFolderName(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testInit(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testGetLocalItem(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testGetLocalItems(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testGetRemoteItems(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testCreateRemoteItem(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testPushItem(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testPushAllItems(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testPushModifiedItems(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testPullItem(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testPullAllItems(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testPullModifiedItems(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testListLocalItemNames(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testListRemoteItemNames(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testListLocalDeletedNames(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testListRemoteDeletedNames(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testListModifiedLocalItemNames(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testListModifiedRemoteItemNames(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testDeleteRemoteItem(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
            self.testFilterRetryPush(restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);

            // Execute any additional tests defined by a subclass. Executing the tests here allows them to be within the
            // same "describe" as the base helper tests, and allows them to leverage the same before and after functions.
            self.runAdditionalTests(restApi,fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata);
        });
    }

    runAdditionalTests (restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata) {
    }

    testSingleton (restApi,fsApi, helper, path1, path2, badPath,type, itemMetadata1, itemMetadata2, badMetadata) {
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

    testEventEmitter (restApi,fsApi, helper, path1, path2, badPath,type, itemMetadata1, itemMetadata2, badMetadata) {
        describe("event emitter", function () {
            it("should call registered functions when an event is emitted.", function () {
                // Setup several spies to listen for emitted events.
                const spyA1 = sinon.spy();
                const spyA2 = sinon.spy();
                const spyB = sinon.spy();
                const spyC = sinon.spy();

                // Use some events that are just for testing, they don't need to correspond to actual system events.
                const eventEmitter = helper.getEventEmitter();
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

    testGetVirtualFolderName (restApi,fsApi, helper, path1, path2, badPath,type, itemMetadata1, itemMetadata2, badMetadata) {
        const self = this;
        describe("getVirtualFolderName", function () {
            it("should get the item folder name from the FS API.", function () {
                const nooptFolder = helper.getVirtualFolderName({"noVirtualFolder":true});
                expect(nooptFolder).to.equal("");

                // Create an fsApi.getFolderName stub that returns the folder name.
                const FAKE_FOLDER_NAME = "Fake name for the items folder.";
                const stub = sinon.stub(fsApi, "getFolderName");
                stub.returns(FAKE_FOLDER_NAME);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                const folderName = helper.getVirtualFolderName();

                // Verify that the stub was called and that the helper returned the expected value.
                expect(stub).to.have.been.calledOnce;
                expect(folderName).to.equal(FAKE_FOLDER_NAME);
            });
        });
    }

    testInit (restApi,fsApi, helper, path1, path2, badPath,type, itemMetadata1, itemMetadata2, badMetadata) {
        const self = this;
        describe("init", function () {
            // Restore common resourses after running the unit tests.
            after(function (done) {
                UnitTest.restoreOptions();

                // Signal that the cleanup is complete.
                done();
            });

            it("should also initialize the REST and FS modules", function () {
                // Setup the spies and stubs needed for testing the init() method.
                const spy = sinon.spy(options, "setGlobalOptions");

                // The spy and stubs should be restored when the test is complete.
                self.addTestDouble(spy);

                // Call the method being tested.
                helper.initGlobalOptions({"workingDir": UnitTest.DUMMY_DIR});

                // Verify that the spy was called once with the expected parameter value.
                expect(spy).to.have.been.calledOnce;
                expect(spy.firstCall.args[0].workingDir).to.equal(UnitTest.DUMMY_DIR);
            });
        });
    }

    testGetLocalItem (restApi,fsApi, helper, path1, path2, badPath,type, itemMetadata1, itemMetadata2, badMetadata) {
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
                helper.getLocalItem("jdfjkfd", UnitTest.DUMMY_OPTIONS)
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
                helper.getLocalItem(itemMetadata1.name, UnitTest.DUMMY_OPTIONS)
                    .then(function (item) {
                        // Verify that the stub was called once and that the helper returned the expected values.
                        expect(stub).to.have.been.calledOnce;
                        expect(diff.diffJson(itemMetadata1, item)).to.have.lengthOf(1);

                        const el = helper.existsLocally(item);
                        expect(el).to.equal(true);
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

    testGetLocalItems (restApi,fsApi, helper, path1, path2, badPath,type, itemMetadata1, itemMetadata2, badMetadata) {
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
                helper.getLocalItems(UnitTest.DUMMY_OPTIONS)
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
                helper.getLocalItems(UnitTest.DUMMY_OPTIONS)
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

    testGetRemoteItems (restApi,fsApi, helper, path1, path2, badPath,type, itemMetadata1, itemMetadata2, badMetadata) {
        const self = this;
        describe("getRemoteItems", function () {
            it("should fail when there is an error getting remote items.", function (done) {
                // Create an restApi.getItems stub that returns an error.
                const ITEMS_ERROR = "There was an error getting the remote items.";
                const stub = sinon.stub(restApi, "getItems");
                stub.rejects(ITEMS_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                helper.getRemoteItems(UnitTest.DUMMY_OPTIONS)
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
                helper.getRemoteItems(UnitTest.DUMMY_OPTIONS)
                    .then(function (items) {
                        // Verify that the stub was called once and that the helper returned the expected values.
                        expect(stub).to.have.been.calledOnce;
                        expect(diff.diffJson(itemMetadata1, items[0])).to.have.lengthOf(1);
                        expect(diff.diffJson(itemMetadata2, items[1])).to.have.lengthOf(1);

                        const el = helper.existsRemotely(items[0]);
                        expect(el).to.equal(true);
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

    testCreateRemoteItem (restApi,fsApi, helper, path1, path2, badPath,type, itemMetadata1, itemMetadata2, badMetadata) {
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
                helper.createRemoteItem(null,UnitTest.DUMMY_OPTIONS)
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
                helper.createRemoteItem(itemMetadata1, UnitTest.DUMMY_OPTIONS)
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

    testPullItem (restApi,fsApi, helper, path1, path2, badPath,type, itemMetadata1, itemMetadata2, badMetadata) {
        const self = this;
        describe("pullItem", function () {
            it("should fail when the specified item is not found.", function (done) {
                // Create a restApi.getItem stub that returns an error.
                const ITEM_ERROR = "An item with the specified ID was not found.";
                const stub = sinon.stub(restApi, "getItem");
                stub.rejects(ITEM_ERROR);

                // Create a spy to listen for the "pulled-error" event.
                const spy = sinon.spy();
                helper.getEventEmitter().on("pulled-error", spy);

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                helper.pullItem(UnitTest.DUMMY_ID, UnitTest.DUMMY_OPTIONS)
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
                const spy = sinon.spy();
                helper.getEventEmitter().on("pulled-error", spy);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubRest);
                self.addTestDouble(stubFs);

                // Call the method being tested.
                let error;
                helper.pullItem(UnitTest.DUMMY_ID, UnitTest.DUMMY_OPTIONS)
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
                            expect(diff.diffJson(stubFs.args[0][0], itemMetadata1)).to.have.lengthOf(1);

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

            it("should succeed when the specified item exists.", function (done) {
                // Create a restApi.getItem stub that returns the contents of a test file.
                const stubRest = sinon.stub(restApi, "getItem");
                stubRest.resolves(itemMetadata1);

                // Create an fsApi.saveItem stub that returns the contents of a test file.
                const stubFs = sinon.stub(fsApi, "saveItem");
                stubFs.resolves(itemMetadata1);

                // Create a spy to listen for the "pulled" event.
                const spy = sinon.spy();
                helper.getEventEmitter().on("pulled", spy);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubRest);
                self.addTestDouble(stubFs);

                // Call the method being tested.
                let error;
                helper.pullItem(UnitTest.DUMMY_ID, UnitTest.DUMMY_OPTIONS)
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
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testPullAllItems (restApi,fsApi, helper, path1, path2, badPath,type, itemMetadata1, itemMetadata2, badMetadata) {
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
                helper.pullAllItems(UnitTest.DUMMY_OPTIONS)
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
                const stub = sinon.stub(restApi, "getItems");
                stub.resolves([]);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                helper.pullAllItems({offset: 0, limit: 2})
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
                stubGet.onCall(2).resolves([badMetadata]);
                stubGet.onCall(3).resolves([]);

                const WRITE_ERROR = "Error writing the item";
                const stubWrite = sinon.stub(fs, "writeFileSync");
                stubWrite.onCall(2).throws(new Error(WRITE_ERROR));
                self.addTestDouble(stubWrite);

                const stubHashes = sinon.stub(hashes, "updateHashes");
                stubHashes.returns("");
                self.addTestDouble(stubHashes);

                // Create spies to listen for the "pulled" and "pulled-error" events.
                const spyPull = sinon.spy();
                helper.getEventEmitter().on("pulled", spyPull);
                const spyError = sinon.spy();
                helper.getEventEmitter().on("pulled-error", spyError);

                // The stubs and spies should be restored when the test is complete.
                self.addTestDouble(stubGet);

                // Call the method being tested.
                let error;
                helper.pullAllItems({offset: 0, limit: 1})
                    .then(function (/*items*/) {
                        // Verify that the get stub was called 4 times.
                        expect(stubGet).to.have.callCount(4);

                        // Verify that the spies were called the expected number of times with the expected values.
                        expect(spyPull).to.have.callCount(2);
                        expect(spyPull.args[0][0]).to.equal(helper.getName(itemMetadata1));
                        expect(spyPull.args[1][0]).to.equal(helper.getName(itemMetadata2));
                        expect(spyError).to.have.been.calledOnce;
                        expect(spyError.args[0][0].message).to.contain(WRITE_ERROR);
                        expect(spyError.args[0][1]).to.equal(badMetadata.id);
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

            it("should succeed when pulling all items partial last getietm.", function (done) {
                // Create an restApi.getItems stub that returns a promise for the metadata of the items.
                const stubGet = sinon.stub(restApi, "getItems");
                stubGet.onCall(0).resolves([itemMetadata1, itemMetadata2]);
                stubGet.onCall(1).resolves([badMetadata]);

                // The stubs and spies should be restored when the test is complete.
                self.addTestDouble(stubGet);

                const WRITE_ERROR = "Error writing the item";
                const stubWrite = sinon.stub(fs, "writeFileSync");
                stubWrite.onCall(2).throws(new Error(WRITE_ERROR));
                self.addTestDouble(stubWrite);

                const stubHashes = sinon.stub(hashes, "updateHashes");
                stubHashes.returns("");
                self.addTestDouble(stubHashes);

                // Create spies to listen for the "pulled" and "pulled-error" events.
                const spyPull = sinon.spy();
                helper.getEventEmitter().on("pulled", spyPull);
                const spyError = sinon.spy();
                helper.getEventEmitter().on("pulled-error", spyError);

                // Call the method being tested.
                let error;
                helper.pullAllItems({offset: 0, limit: 2, validateName: true})
                    .then(function (items) {
                        // Verify that the get stub was called 2 times.
                        expect(stubGet).to.have.callCount(2);

                        // Verify that the spies were called the expected number of times with the expected values.
                        expect(spyPull).to.have.callCount(2);
                        expect(helper.getName(items[0])).to.equal(helper.getName(itemMetadata1));
                        expect(helper.getName(items[1])).to.equal(helper.getName(itemMetadata2));
                        expect(spyError).to.have.been.calledOnce;
                        expect(spyError.args[0][0].message).to.contain(WRITE_ERROR);
                        expect(spyError.args[0][1]).to.equal(badMetadata.id);
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

    testPullModifiedItems (restApi,fsApi, helper, path1, path2, badPath,type, itemMetadata1, itemMetadata2, badMetadata) {
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
                helper.pullModifiedItems(UnitTest.DUMMY_OPTIONS)
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
                helper.pullModifiedItems({offset: 0, limit: 2})
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
                stubGet.onCall(2).resolves([badMetadata]);
                stubGet.onCall(3).resolves([]);

                const WRITE_ERROR = "Error writing the item";
                const stubWrite = sinon.stub(fs, "writeFileSync");
                stubWrite.onCall(2).throws(new Error(WRITE_ERROR));

                const stubHashes = sinon.stub(hashes, "updateHashes");
                stubHashes.returns("");

                // Create spies to listen for the "pulled" and "pulled-error" events.
                const spyPull = sinon.spy();
                helper.getEventEmitter().on("pulled", spyPull);
                const spyError = sinon.spy();
                helper.getEventEmitter().on("pulled-error", spyError);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubWrite);
                self.addTestDouble(stubHashes);

                // Call the method being tested.
                let error;
                helper.pullModifiedItems({offset: 0, limit: 1})
                    .then(function (/*items*/) {
                        // Verify that the get stub was called 4 times.
                        expect(stubGet).to.have.callCount(4);

                        // Verify that the spies were called the expected number of times with the expected values.
                        expect(spyPull).to.have.callCount(2);
                        expect(spyPull.args[0][0]).to.equal(helper.getName(itemMetadata1));
                        expect(spyPull.args[1][0]).to.equal(helper.getName(itemMetadata2));
                        expect(spyError).to.have.been.calledOnce;
                        expect(spyError.args[0][0].message).to.contain(WRITE_ERROR);
                        expect(spyError.args[0][1]).to.equal(badMetadata.id);
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

            it("should succeed when pulling all items partial last getietm.", function (done) {
                // Create an restApi.getItems stub that returns a promise for the metadata of the items.
                const stubGet = sinon.stub(restApi, "getModifiedItems");
                stubGet.onCall(0).resolves([itemMetadata1, itemMetadata2 ]);
                stubGet.onCall(1).resolves([badMetadata]);

                // The stubs and spies should be restored when the test is complete.
                self.addTestDouble(stubGet);

                const WRITE_ERROR = "Error writing the item";
                const stubWrite = sinon.stub(fs, "writeFileSync");
                stubWrite.onCall(2).throws(new Error(WRITE_ERROR));
                self.addTestDouble(stubWrite);

                const stubHashes = sinon.stub(hashes, "updateHashes");
                stubHashes.returns("");
                self.addTestDouble(stubHashes);

                // Create spies to listen for the "pulled" and "pulled-error" events.
                const spyPull = sinon.spy();
                helper.getEventEmitter().on("pulled", spyPull);
                const spyError = sinon.spy();
                helper.getEventEmitter().on("pulled-error", spyError);

                // Call the method being tested.
                let error;
                helper.pullModifiedItems({offset: 0, limit: 2, validateName: true})
                    .then(function (items) {
                        // Verify that the get stub was called 2 times.
                        expect(stubGet).to.have.callCount(2);

                        // Verify that the spies were called the expected number of times with the expected values.
                        expect(spyPull).to.have.callCount(2);
                        expect(helper.getName(items[0])).to.equal(helper.getName(itemMetadata1));
                        expect(helper.getName(items[1])).to.equal(helper.getName(itemMetadata2));
                        expect(spyError).to.have.been.calledOnce;
                        expect(spyError.args[0][0].message).to.contain(WRITE_ERROR);
                        expect(spyError.args[0][1]).to.equal(badMetadata.id);
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

    testPushItem (restApi,fsApi, helper, path1, path2, badPath,type, itemMetadata1, itemMetadata2, badMetadata) {
        const self = this;
        describe("pushItem", function () {
            it("should fail when getting the local item fails.", function (done) {
                // Create an fsApi.getItem stub that returns an error.
                const ITEM_ERROR = "There was an error getting the local item.";
                const stub = sinon.stub(fsApi, "getItem");
                stub.rejects(ITEM_ERROR);

                // Create a restApi.updateItem spy.
                const spy = sinon.spy(restApi, "updateItem");

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stub);
                self.addTestDouble(spy);

                // Call the method being tested.
                let error;
                helper.pushItem(UnitTest.DUMMY_PATH, UnitTest.DUMMY_OPTIONS)
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
                helper.pushItem(UnitTest.DUMMY_PATH, UnitTest.DUMMY_OPTIONS)
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
                            expect(diff.diffJson(stubUpdate.args[0][0], itemMetadata1)).to.have.lengthOf(1);

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

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubCreate);

                // Call the method being tested.
                let error;
                helper.pushItem(UnitTest.DUMMY_PATH, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for creating the remote item should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stubs were called once.
                            expect(stubGet).to.be.calledOnce;
                            expect(stubCreate).to.be.calledOnce;

                            // Verify that the update was called with the expected value.
                            expect(diff.diffJson(stubCreate.args[0][0], itemMetadata2)).to.have.lengthOf(1);

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

            it("should succeed when pushing a local item for update.", function (done) {
                // Create an fsApi.getItem stub that returns a promise for item metadata with a "rev" value.
                const stubGet = sinon.stub(fsApi, "getItem");
                stubGet.resolves(itemMetadata1);

                // Create a restApi.updateItem stub that returns a promise for the item metadata.
                const stubUpdate = sinon.stub(restApi, "updateItem");
                stubUpdate.resolves(itemMetadata1);

                // Create a helper._addRemoteStatus spy.
                const spyStatus = sinon.spy(helper, "_addRemoteStatus");

                // Create a fsApi.saveItem stub that returns a promise for the item metadata.
                const stubSave = sinon.stub(fsApi, "saveItem");
                stubSave.resolves(itemMetadata1);

                // Create spies to listen for the "pushed" and "pushed-error" events.
                const spyPush = sinon.spy();
                helper.getEventEmitter().on("pushed", spyPush);
                const spyError = sinon.spy();
                helper.getEventEmitter().on("pushed-error", spyError);

                // The stubs and spies should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubUpdate);
                self.addTestDouble(spyStatus);
                self.addTestDouble(stubSave);

                // Call the method being tested.
                let error;
                helper.pushItem(UnitTest.DUMMY_PATH, UnitTest.DUMMY_OPTIONS)
                    .then(function (item) {
                        // Verify that the stubs were all called once.
                        expect(stubGet).to.have.been.calledOnce;
                        expect(stubUpdate).to.have.been.calledOnce;
                        expect(stubSave).to.have.been.calledOnce;

                        // Verify that the status stub and push spy were called once, and the error spy was not called.
                        expect(spyStatus).to.have.been.calledOnce;
                        expect(spyPush).to.have.been.calledOnce;
                        expect(spyError).to.not.have.been.called;

                        // Verify that update, save, and status methods were called with the expected values.
                        expect(diff.diffJson(stubUpdate.args[0][0], itemMetadata1)).to.have.lengthOf(1);
                        expect(diff.diffJson(stubSave.args[0][0], itemMetadata1)).to.have.lengthOf(1);
                        expect(diff.diffJson(spyStatus.args[0][0], itemMetadata1)).to.have.lengthOf(1);

                        // Verify that the expected values were returned.
                        expect(diff.diffJson(item, itemMetadata1)).to.have.lengthOf(1);
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

            it("should fail when pushing a local item for update and a conflict.", function (done) {
                // Create an fsApi.getItem stub that returns a promise for item metadata with a "rev" value.
                const stubGet = sinon.stub(fsApi, "getItem");
                stubGet.resolves(itemMetadata1);

                // Create a restApi.updateItem stub that returns a promise for the item metadata.
                const stubUpdate = sinon.stub(restApi, "updateItem");
                const conflictError = new Error("conflict");
                conflictError.statusCode = 409;
                stubUpdate.rejects(conflictError);

                // Create an fsApi.getItem stub that returns a promise for item metadata with a "rev" value.
                const stubrGet = sinon.stub(restApi, "getItem");
                stubrGet.resolves(itemMetadata1);

                // Create a helper._addRemoteStatus spy.
                const spyStatus = sinon.spy(helper, "_addRemoteStatus");

                // Create a fsApi.saveItem stub that returns a promise for the item metadata.
                const stubSave = sinon.stub(fsApi, "saveItem");
                stubSave.resolves(itemMetadata1);

                // Create spies to listen for the "pushed" and "pushed-error" events.
                const spyPush = sinon.spy();
                helper.getEventEmitter().on("pushed", spyPush);
                const spyError = sinon.spy();
                helper.getEventEmitter().on("pushed-error", spyError);

                // The stubs and spies should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubrGet);
                self.addTestDouble(stubUpdate);
                self.addTestDouble(spyStatus);
                self.addTestDouble(stubSave);

                // Call the method being tested.
                let error;
                helper.pushItem(UnitTest.DUMMY_PATH, UnitTest.DUMMY_OPTIONS)
                    .then(function (item) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for creating the remote item should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the stubs were all called once.
                        expect(stubGet).to.have.been.calledOnce;
                        expect(stubrGet).to.have.been.calledOnce;
                        expect(stubUpdate).to.have.been.calledOnce;
                        expect(stubSave).to.have.been.calledOnce;
                        expect(spyPush).to.not.have.been.called;
                        expect(spyError).to.have.been.calledOnce;
                        expect(spyError.firstCall.args[0].message).to.contain("conflict");
                        expect(spyError.firstCall.args[0].statusCode).to.equal(409);
                        expect(spyError.firstCall.args[1]).to.equal(itemMetadata1.id);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
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

                // Create a helper._addRemoteStatus spy.
                const spyStatus = sinon.spy(helper, "_addRemoteStatus");

                // Create a fsApi.saveItem stub that returns a promise for the item metadata.
                const stubSave = sinon.stub(fsApi, "saveItem");
                stubSave.resolves(itemMetadata2);

                // Create spies to listen for the "pushed" and "pushed-error" events.
                const spyPush = sinon.spy();
                helper.getEventEmitter().on("pushed", spyPush);
                const spyError = sinon.spy();
                helper.getEventEmitter().on("pushed-error", spyError);

                // The stubs and spies should be restored when the test is complete.
                self.addTestDouble(stubGet);
                self.addTestDouble(stubCreate);
                self.addTestDouble(spyStatus);
                self.addTestDouble(stubSave);

                // Call the method being tested.
                let error;
                helper.pushItem(UnitTest.DUMMY_PATH, UnitTest.DUMMY_OPTIONS)
                    .then(function (item) {
                        // Verify that the stubs were all called once.
                        expect(stubGet).to.have.been.calledOnce;
                        expect(stubCreate).to.have.been.calledOnce;
                        expect(stubSave).to.have.been.calledOnce;

                        // Verify that the status stub and push spy were called once, and the error spy was not called.
                        expect(spyStatus).to.have.been.calledOnce;
                        expect(spyPush).to.have.been.calledOnce;
                        expect(spyError).to.not.have.been.called;

                        // Verify that create, save, and status methods were called with the expected values.
                        expect(diff.diffJson(stubCreate.args[0][0], itemMetadata2)).to.have.lengthOf(1);
                        expect(diff.diffJson(stubSave.args[0][0], itemMetadata2)).to.have.lengthOf(1);
                        expect(diff.diffJson(spyStatus.args[0][0], itemMetadata2)).to.have.lengthOf(1);

                        // Verify that the expected values were returned.
                        expect(diff.diffJson(item, itemMetadata2)).to.have.lengthOf(1);
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

    testPushAllItems (restApi,fsApi, helper, path1, path2, badPath,type, itemMetadata1, itemMetadata2, badMetadata) {
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
                helper.pushAllItems(UnitTest.DUMMY_OPTIONS)
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
                helper.pushAllItems(UnitTest.DUMMY_OPTIONS)
                    .then(function (items) {
                        // Verify that the stubs were called the expected number of times.
                        expect(stubList).to.have.been.calledOnce;
                        expect(stubPush).to.have.been.calledTwice;

                        // Verify that pushItem method was called with the expected values.
                        expect(diff.diffJson(stubPush.args[0][0], helper.getName(itemMetadata1))).to.have.lengthOf(1);
                        expect(diff.diffJson(stubPush.args[1][0], helper.getName(itemMetadata2))).to.have.lengthOf(1);

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

    testPushModifiedItems (restApi,fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata) {
        const self = this;
        describe("pushModifiedItems", function () {
            it("should fail when getting the local items fails.", function (done) {
                // Create a helper.listLocalModifiedItemNames stub that returns an error.
                const ITEM_ERROR = "There was an error getting the local modified items.";
                const stub = sinon.stub(helper, "listModifiedLocalItemNames");
                stub.rejects(ITEM_ERROR);

                // Create an helper.pushItemByName spy.
                const spy = sinon.spy(helper, "pushItem");

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stub);
                self.addTestDouble(spy);

                // Call the method being tested.
                let error;
                helper.pushModifiedItems(UnitTest.DUMMY_OPTIONS)
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
                // Create a helper.listModifiedLocalItemNames stub that returns a list of items.
                const stubList = sinon.stub(helper, "listModifiedLocalItemNames");
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
                helper.pushModifiedItems(UnitTest.DUMMY_OPTIONS)
                    .then(function (items) {
                        // Verify that the stubs were called the expected number of times.
                        expect(stubList).to.have.been.calledOnce;
                        expect(stubPush).to.have.been.calledTwice;

                        // Verify that pushItem method was called with the expected values.
                        expect(diff.diffJson(stubPush.args[0][0], helper.getName(itemMetadata1))).to.have.lengthOf(1);
                        expect(diff.diffJson(stubPush.args[1][0], helper.getName(itemMetadata2))).to.have.lengthOf(1);

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

    testListLocalItemNames (restApi,fsApi, helper, path1, path2, badPath,type, itemMetadata1, itemMetadata2, badMetadata) {
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
                helper.listLocalItemNames(UnitTest.DUMMY_OPTIONS)
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
                // TODO
                done();
            });
        });
    }

    testListRemoteItemNames (restApi,fsApi, helper, path1, path2, badPath,type, itemMetadata1, itemMetadata2, badMetadata) {
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
                helper.listRemoteItemNames(UnitTest.DUMMY_OPTIONS)
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
                helper.listRemoteItemNames(UnitTest.DUMMY_OPTIONS)
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
            it("should succeed when getting item names succeeds and opt .", function (done) {
                const stub = sinon.stub(restApi, "getItems");
                stub.resolves([itemMetadata1, itemMetadata2]);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                helper.listRemoteItemNames({includeNameInList: true})
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

    testListLocalDeletedNames (restApi,fsApi, helper, path1, path2, badPath,type, itemMetadata1, itemMetadata2, badMetadata) {
        const self = this;
        describe("listLocalDeletedNames", function () {
            it("should get no items.", function (done) {
                // Create an fsApi.listItemNames stub that returns an error.
                const ITEM_ERROR = "There was an error getting the local items.";
                const stub = sinon.stub(hashes, "listFiles");
                stub.returns([]);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                helper.listLocalDeletedNames(UnitTest.DUMMY_OPTIONS)
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
                // Create an fsApi.listItemNames stub that returns an a list.
                const stub = sinon.stub(hashes, "listFiles");
                let rVal = [
                    "file1" + fsApi.getExtension(),
                    "file2" + fsApi.getExtension(),
                    "file3"
                ];
                stub.returns(rVal);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                helper.listLocalDeletedNames(UnitTest.DUMMY_OPTIONS)
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


    testListRemoteDeletedNames (restApi,fsApi, helper, path1, path2, badPath,type, itemMetadata1, itemMetadata2, badMetadata) {
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
                helper.listRemoteDeletedNames(UnitTest.DUMMY_OPTIONS)
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
                let rVal = [
                    "file1" + fsApi.getExtension(),
                    "file2" + fsApi.getExtension(),
                    "file3"
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
                helper.listRemoteDeletedNames(UnitTest.DUMMY_OPTIONS)
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

    testListModifiedLocalItemNames (restApi,fsApi, helper, path1, path2, badPath,type, itemMetadata1, itemMetadata2, badMetadata) {
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
                helper.listModifiedLocalItemNames([helper.NEW, helper.MODIFIED], UnitTest.DUMMY_OPTIONS)
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
                let rVal = [
                    "file1",
                    "file2",
                    "file3"
                ];
                stub.resolves(rVal);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                const stub2= sinon.stub(hashes, "isLocalModified");
                stub2.returns(true);
                self.addTestDouble(stub2);

                // Call the method being tested.
                let error;
                helper.listModifiedLocalItemNames([helper.NEW, helper.MODIFIED], UnitTest.DUMMY_OPTIONS)
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
                let rVal = [
                    "file1" + fsApi.getExtension(),
                    "file2" + fsApi.getExtension(),
                    "file3"
                ];
                stub.returns(rVal);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);
                // Call the method being tested.
                let error;
                helper.listModifiedLocalItemNames([helper.DELETED], UnitTest.DUMMY_OPTIONS)
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


    testListModifiedRemoteItemNames (restApi,fsApi, helper, path1, path2, badPath,type, itemMetadata1, itemMetadata2, badMetadata) {
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
                helper.listModifiedRemoteItemNames([helper.NEW, helper.MODIFIED], UnitTest.DUMMY_OPTIONS)
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
                helper.listModifiedRemoteItemNames([helper.NEW, helper.MODIFIED], UnitTest.DUMMY_OPTIONS)
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
            it("Remote deleted should succeed when getting item names succeeds.", function (done) {
                const stub = sinon.stub(hashes, "listFiles");
                let rVal = [
                    "file1" + fsApi.getExtension(),
                    "file2" + fsApi.getExtension(),
                    "file3"
                ];
                stub.returns(rVal);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                const stub2 = sinon.stub(helper, "listRemoteDeletedNames");
                let rVal2 = [
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
                helper.listModifiedRemoteItemNames([helper.DELETED], UnitTest.DUMMY_OPTIONS)
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

    testDeleteRemoteItem (restApi,fsApi, helper, path1, path2, badPath,type, itemMetadata1, itemMetadata2, badMetadata) {
        const self = this;
        describe("deleteRemoteItem", function () {
/*
            it("should fail when deleting the item fails.", function (done) {
                const ITEM_ERROR = "There was an error deleting the item.";
                const stub = sinon.stub(restApi, "deleteItem");
                stub.rejects(ITEM_ERROR);

                // Create a restApi.deleteItem spy.
                const spy = sinon.spy(restApi, "deleteItem");

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stub);
                self.addTestDouble(spy);

                // Call the method being tested.
                let error;
                helper.deleteItem("asdfqwerty", UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for delete item should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once.
                            expect(stub).to.be.calledOnce;

                            // Verify that the expected error is returned.

                            expect(err.message).to.equal(ITEM_ERROR);

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
*/
            it("should succeed when deleting a remote item.", function (done) {
                  // Create an restApi.getItems stub that returns a promise for the metadata of the items.
                  const stub = sinon.stub(restApi, "deleteItem");
                  stub.resolves("DELETED");

                  // The stub should be restored when the test is complete.
                  self.addTestDouble(stub);

                  // Call the method being tested.
                  let error;
                  helper.deleteRemoteItem({"id": "123456"})
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

    testFilterRetryPush (restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata) {
        describe("filterRetryPush", function () {
            it("should return false when retry push is not enabled.", function (done) {
                if (helper.isRetryPushEnabled && !helper.isRetryPushEnabled()) {
                    // Call the method being tested.
                    let error;
                    try {
                        expect(helper.filterRetryPush(new Error("Retry Push"))).to.equal(false);
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
    }
}

module.exports = BaseHelperUnitTest;
