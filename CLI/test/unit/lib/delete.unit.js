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
 * Unit tests for the delete command.
 */
"use strict";

// Require the super classes for this class.
const UnitTest = require("./base.cli.unit.js");

// Require the node modules used in this test file.
const fs = require("fs");
const Q = require("q");
const sinon = require("sinon");
const ToolsApi = require("wchtools-api");
const utils = ToolsApi.getUtils();
const toolsCli = require("../../../wchToolsCli");
const prompt = require("prompt");
const options = ToolsApi.getOptions();
const manifests = ToolsApi.getManifests();

const sitesHelper = ToolsApi.getSitesHelper();
let stubRemoteSites;

class DeleteUnitTest extends UnitTest {
    constructor () {
        super();
    }

    static addRemoteSitesStub () {
        stubRemoteSites = sinon.stub(sitesHelper._restApi, "getItems");
        stubRemoteSites.resolves([
            {id: "foo", status: "ready", contextRoot: "foo"},
            {id: "bar", status: "draft", contextRoot: "bar"}
        ]);
    }

    static restoreRemoteSitesStub () {
        stubRemoteSites.restore();
    }

    run (helper, switches, itemName1) {
        const self = this;
        describe("Unit tests for delete " + switches, function () {
            let stubLogin;
            before(function (done) {
                stubLogin = sinon.stub(self.getLoginHelper(), "login");
                stubLogin.resolves("Adam.iem@mailinator.com");

                DeleteUnitTest.addRemoteSitesStub();

                done();
            });

            after(function (done) {
                stubLogin.restore();
                DeleteUnitTest.restoreRemoteSitesStub();

                done();
            });

            // Run each of the tests defined in this class.
            if (helper.supportsDeleteById()) {
                self.testDeleteById(helper, switches, itemName1);
            }
            if (helper.supportsDeleteByPath()) {
                self.testDeleteByPath(helper, switches, itemName1);
            }
            if (helper.supportsDeleteByPathRecursive()) {
                self.testDeleteBySearch(helper, switches, itemName1, '--path');
                self.testDeleteBySearch(helper, switches, itemName1, '--named');
            }

            if (switches.includes("-t")) {
                self.testDeleteBySearch(helper, switches, itemName1, '--named');
                self.testDeleteByTag(helper, switches, itemName1);
                self.testDeleteAll (helper, switches, itemName1);
                self.testDeleteByManifest (helper, switches, itemName1);
                self.testDeleteParamFail(helper, switches, itemName1);
            } else if (switches.includes("-c")) {
                self.testDeleteBySearch(helper, switches, itemName1, '--named');
                self.testDeleteByTag(helper, switches, itemName1);
                self.testDeleteAll (helper, switches, itemName1);
                self.testDeleteByManifest (helper, switches, itemName1);
                self.testDeleteBySearch(helper, switches, itemName1, '--by-type-name');
                self.testDeleteParamFail(helper, switches, itemName1);
                self.testDeletePageContentFail (helper, itemName1);
            } else if (switches.includes("-a")) {
                self.testDeleteByTag(helper, switches, itemName1);
                self.testDeleteAll (helper, switches, itemName1);
                self.testDeleteAll (helper, "-aw", itemName1);
                self.testDeleteByManifest (helper, switches, itemName1);
                self.testDeleteParamFail(helper, switches, itemName1);
            } else if (switches.includes("-w") || switches.includes("-l") || switches.includes("-m")) {
                self.testDeleteAll (helper, switches, itemName1);
                self.testDeleteByManifest (helper, switches, itemName1);
                self.testDeleteParamFail(helper, switches, itemName1);
            } else if (switches.includes("-i") || switches.includes("-C")) {
                self.testDeleteAll (helper, switches, itemName1);
                self.testDeleteByManifest (helper, switches, itemName1);
            } else if (switches.includes("--sites")) {
                self.testDeleteAll(helper, switches, itemName1);
                self.testDeleteByManifest(helper, switches, itemName1);
                self.testDeleteSites(helper, switches, itemName1);
            } else if (switches.includes("--pages")) {
                self.testDeleteAll(helper, switches, itemName1);
                self.testDeleteByManifest(helper, switches, itemName1);
                self.testDeletePageById(helper, switches, itemName1);
                self.testDeletePagesByPath(helper, switches, itemName1);
            }
        });
    }

    testDeleteById (helper, switches, itemName1) {
        describe("Deleting an item by id", function () {
            it("should fail if the helper fails", function (done) {
                const GET_ERROR = "Delete by id failed, as expected by unit test.";
                const stubGet = sinon.stub(helper, "getRemoteItem");
                stubGet.rejects(GET_ERROR);

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--id', itemName1, '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // The stub should only have been called once, and the expected error should have been returned.
                        expect(stubGet).to.have.been.calledOnce;
                        expect(err.message).to.contain(GET_ERROR);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubGet.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed if the helper succeeds", function (done) {
                const stubGet = sinon.stub(helper, "getRemoteItem");
                let stubList;
                if (switches === "--pages") {
                    stubGet.resolves({id: itemName1, hierarchicalPath: itemName1});

                    // Return an empty list of child pages.
                    stubList = sinon.stub(helper, "_listRemoteItemNames");
                    stubList.resolves([]);
                } else {
                    stubGet.resolves({id: itemName1});
                }
                const stubDelete = sinon.stub(helper, "deleteRemoteItem");
                stubDelete.resolves({id: itemName1});

                // Execute the command to delete the items to the download directory.
                let error;
                let promise;
                if (switches === "--pages") {
                    promise = toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--id', itemName1, '--site-context', 'foo', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api']);
                } else {
                    promise = toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--id', itemName1, '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api']);
                }

                promise
                    .then(function (msg) {
                        // The stubs should only have been called once, and the expected message should have been returned.
                        expect(stubGet).to.have.been.calledOnce;
                        expect(stubDelete).to.have.been.calledOnce;
                        expect(msg).to.contain('Deleted');
                        expect(msg).to.contain(itemName1);
                        if (switches === "--pages") {
                            expect(stubList).to.have.been.calledOnce;
                            expect(msg).to.contain("foo");
                        }
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubGet.restore();
                        stubDelete.restore();
                        if (stubList) {
                            stubList.restore();
                        }

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testDeleteByPath (helper, switches, itemName1) {
        describe("Deleting an item by path", function () {
            it("should fail if the helper get fails", function (done) {
                const GET_ERROR = "Get by path failed, as expected by unit test.";
                const stubGet = sinon.stub(helper, "getRemoteItemByPath");
                stubGet.rejects(GET_ERROR);

                // Execute the command to delete the items to the download directory.
                let error;
                let promise;
                if (switches === "--pages") {
                    promise = toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--path', itemName1, '--site-context', 'foo', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                } else {
                    promise = toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--path', itemName1, '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                }

                promise
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // The stub should only have been called once, and the expected error should have been returned.
                        expect(stubGet).to.have.been.calledOnce;
                        expect(err.message).to.contain(GET_ERROR);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubGet.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail if the helper delete fails", function (done) {
                const stubGet = sinon.stub(helper, "getRemoteItemByPath");
                stubGet.resolves({path: itemName1, hierarchicalPath: itemName1});

                let stubList;
                if (switches === "--pages") {
                    // Return an empty list of child pages.
                    stubList = sinon.stub(helper, "_listRemoteItemNames");
                    stubList.resolves([]);
                }

                const DELETE_ERROR = "Delete failed, as expected by unit test.";
                const stubDelete = sinon.stub(helper, "deleteRemoteItem");
                stubDelete.rejects(DELETE_ERROR);

                // Execute the command to delete the items to the download directory.
                let error;
                let promise;
                if (switches === "--pages") {
                    promise = toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--path', itemName1, '--site-context', 'foo', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                } else {
                    promise = toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--path', itemName1, '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                }

                promise
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // The stubs should only have been called once, and the expected error should have been returned.
                        expect(stubGet).to.have.been.calledOnce;
                        if (switches === "--pages") {
                            expect(stubList).to.have.been.calledOnce;
                        }
                        expect(stubDelete).to.have.been.calledOnce;
                        expect(err.message).to.contain(DELETE_ERROR);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubGet.restore();
                        if (switches === "--pages") {
                            stubList.restore();
                        }
                        stubDelete.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed if the helper succeeds", function (done) {
                const stubGet = sinon.stub(helper, "getRemoteItemByPath");
                stubGet.resolves({path: itemName1, hierarchicalPath: itemName1});

                let stubList;
                if (switches === "--pages") {
                    // Return an empty list of child pages.
                    stubList = sinon.stub(helper, "_listRemoteItemNames");
                    stubList.resolves([]);
                }

                const stubDelete = sinon.stub(helper, "deleteRemoteItem");
                stubDelete.resolves({path: itemName1,  hierarchicalPath: itemName1});

                // Execute the command to delete the items to the download directory.
                let error;
                let promise;
                if (switches === "--pages") {
                    promise = toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--path', itemName1, '--site-context', 'foo', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                } else {
                    promise = toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--path', itemName1, '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                }

                promise
                    .then(function (msg) {
                        // The stub should only have been called once, and the expected message should have been returned.
                        expect(stubGet).to.have.been.calledOnce;
                        if (switches === "--pages") {
                            expect(stubList).to.have.been.calledOnce;
                        }
                        expect(stubDelete).to.have.been.calledOnce;
                        expect(msg).to.contain('Deleted');
                        expect(msg).to.contain(itemName1);
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubGet.restore();
                        if (switches === "--pages") {
                            stubList.restore();
                        }
                        stubDelete.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testDeleteBySearch (helper, switches, itemName1, searchArg) {
        describe("Deleting items by search for " + searchArg, function () {
            it("should succeed (with a warning) if no matching artifacts", function(done) {
                const stubSearch = sinon.stub(helper, "searchRemote");
                stubSearch.resolves([]);

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api', searchArg, itemName1])
                    .then(function () {
                        // The stub should only have been called once.
                        expect(stubSearch).to.have.been.calledOnce;
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubSearch.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed for a single artifact", function(done) {
                const stubSearch = sinon.stub(helper, "searchRemote");
                stubSearch.resolves([{"path": itemName1, "id": UnitTest.DUMMY_ID, "name": itemName1}]);

                const stubDelete = sinon.stub(helper, "deleteRemoteItem");
                stubDelete.resolves(itemName1);

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api', searchArg, itemName1])
                    .then(function (msg) {
                        // The stub should only have been called once, and the expected message should have been returned.
                        expect(stubDelete).to.have.been.calledOnce;
                        expect(msg).to.contain('Deleted');
                        expect(msg).to.contain(itemName1);
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubSearch.restore();
                        stubDelete.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when single delete fails", function(done) {
                const stubSearch = sinon.stub(helper, "searchRemote");
                stubSearch.resolves([{"path": itemName1, "id": UnitTest.DUMMY_ID, "name": itemName1}]);

                const DELETE_ERROR = "Delete failure expected by unit test.";
                const stubDelete = sinon.stub(helper, "deleteRemoteItem");
                stubDelete.rejects(DELETE_ERROR);

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api', searchArg, itemName1])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // The stubs should only have been called once, and the expected error should have been returned.
                        expect(stubSearch).to.have.been.calledOnce;
                        expect(stubDelete).to.have.been.calledOnce;
                        expect(err.message).to.contain(itemName1);
                        expect(err.message).to.contain(DELETE_ERROR);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubSearch.restore();
                        stubDelete.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should not delete - preview", function(done) {
                const stubSearch = sinon.stub(helper, "searchRemote");
                stubSearch.resolves([{"path": itemName1, "name": itemName1, "id": UnitTest.DUMMY_ID},
                    {"path": itemName1 + "2", "name": itemName1 + "2", "id": UnitTest.DUMMY_ID + "2"},
                    {"path": itemName1 + "3", "name": itemName1 + "3", "id": UnitTest.DUMMY_ID + "3"}]
                );

                const spyDelete = sinon.spy(helper, "deleteRemoteItem");

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api', '-P', searchArg, itemName1])
                    .then(function () {
                        // The stub should only have been called once, and the expected message should have been returned.
                        expect(stubSearch).to.have.been.calledOnce;
                        expect(spyDelete).to.not.have.been.called;
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubSearch.restore();
                        spyDelete.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when some deletes fail - quiet", function(done) {
                const stubSearch = sinon.stub(helper, "searchRemote");
                stubSearch.resolves([{"path": itemName1, "name": itemName1, "id": UnitTest.DUMMY_ID},
                    {"path": itemName1 + "2", "name": itemName1 + "2", "id": UnitTest.DUMMY_ID + "2"},
                    {"path": itemName1 + "3", "name": itemName1 + "3", "id": UnitTest.DUMMY_ID + "3"}]
                );

                const DELETE_ERROR = "Delete failure expected by unit test.";
                const stubDelete = sinon.stub(helper, "deleteRemoteItem");
                stubDelete.onFirstCall().resolves(itemName1);
                stubDelete.onSecondCall().rejects(DELETE_ERROR);
                stubDelete.onThirdCall().rejects(DELETE_ERROR);

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api', '-q', searchArg, itemName1])
                    .then(function (msg) {
                        // The stub should only have been called once, and the expected message should have been returned.
                        expect(stubDelete).to.have.been.calledThrice;
                        expect(msg).to.contain('Complete');
                        expect(msg).to.contain('Deleted 1 artifact');
                        expect(msg).to.contain('Encountered 2 errors');
                        expect(msg).to.contain('wchtools-cli.log');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubSearch.restore();
                        stubDelete.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when all deletes fail - quiet", function(done) {
                const stubSearch = sinon.stub(helper, "searchRemote");
                stubSearch.resolves([{"path": itemName1, "name": itemName1, "id": UnitTest.DUMMY_ID},
                    {"path": itemName1 + "2", "name": itemName1 + "2", "id": UnitTest.DUMMY_ID + "2"},
                    {"path": itemName1 + "3", "name": itemName1 + "3", "id": UnitTest.DUMMY_ID + "3"}]
                );

                const DELETE_ERROR = "Delete failure expected by unit test.";
                const stubDelete = sinon.stub(helper, "deleteRemoteItem");
                stubDelete.onFirstCall().rejects(DELETE_ERROR);
                stubDelete.onSecondCall().rejects(DELETE_ERROR);
                stubDelete.onThirdCall().rejects(DELETE_ERROR);

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api', '-q', searchArg, itemName1])
                    .then(function (msg) {
                        // The stub should only have been called once, and the expected message should have been returned.
                        expect(stubDelete).to.have.been.calledThrice;
                        expect(msg).to.contain('Complete');
                        expect(msg).to.contain('Encountered 3 errors');
                        expect(msg).to.contain('wchtools-cli.log');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubSearch.restore();
                        stubDelete.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed for multiple artifacts - quiet", function(done) {
                const stubSearch = sinon.stub(helper, "searchRemote");
                stubSearch.resolves([{"name": itemName1, "id": UnitTest.DUMMY_ID}, {"name": itemName1 + "2", "id": UnitTest.DUMMY_ID + "2"}, {"name": itemName1 + "3", "id": UnitTest.DUMMY_ID + "3"}]);

                const stubDelete = sinon.stub(helper, "deleteRemoteItem");
                stubDelete.onFirstCall().resolves(itemName1);
                stubDelete.onSecondCall().resolves(itemName1 + "2");
                stubDelete.onThirdCall().resolves(itemName1 + "3");

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--verbose', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api', '-q', searchArg, itemName1])
                    .then(function (msg) {
                        // The stub should only have been called once, and the expected message should have been returned.
                        expect(stubDelete).to.have.been.calledThrice;
                        expect(msg).to.contain('Complete');
                        expect(msg).to.contain('Deleted 3 artifacts');
                        expect(msg).to.not.contain('errors');
                        expect(msg).to.not.contain('wchtools-cli.log');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubSearch.restore();
                        stubDelete.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail for multiple items if throttledAll fails", function (done) {
                const stubSearch = sinon.stub(helper, "searchRemote");
                stubSearch.resolves([{"path": itemName1, "id": UnitTest.DUMMY_ID}, {"path": itemName1 + "2", "id": UnitTest.DUMMY_ID + "2"}, {"path": itemName1 + "3", "id": UnitTest.DUMMY_ID + "3"}]);

                const DELETE_ERROR = "Delete failed, as expected by unit test.";
                const stubThrottle = sinon.stub(utils, "throttledAll");
                stubThrottle.rejects(DELETE_ERROR);

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api', '-q', searchArg, itemName1])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // The stubs should only have been called once, and the expected error should have been returned.
                        expect(stubSearch).to.have.been.calledOnce;
                        expect(stubThrottle).to.have.been.calledOnce;
                        expect(err.message).to.contain(DELETE_ERROR);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed methods.
                        stubSearch.restore();
                        stubThrottle.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail for multiple items if throttledAll fails - verbose", function (done) {
                const stubSearch = sinon.stub(helper, "searchRemote");
                stubSearch.resolves([{"path": itemName1, "id": UnitTest.DUMMY_ID}, {"path": itemName1 + "2", "id": UnitTest.DUMMY_ID + "2"}, {"path": itemName1 + "3", "id": UnitTest.DUMMY_ID + "3"}]);

                const DELETE_ERROR = "Delete failed, as expected by unit test.";
                const stubThrottle = sinon.stub(utils, "throttledAll");
                stubThrottle.rejects(DELETE_ERROR);

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--verbose', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api', '-q', searchArg, itemName1])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // The stubs should only have been called once, and the expected error should have been returned.
                        expect(stubSearch).to.have.been.calledOnce;
                        expect(stubThrottle).to.have.been.calledOnce;
                        expect(err.message).to.contain(DELETE_ERROR);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed methods.
                        stubSearch.restore();
                        stubThrottle.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed for multiple artifacts - prompt", function(done) {
                const stubSearch = sinon.stub(helper, "searchRemote");
                stubSearch.resolves([{"path": itemName1, "name": itemName1, "id": UnitTest.DUMMY_ID},
                    {"path": itemName1 + "2", "name": itemName1 + "2", "id": UnitTest.DUMMY_ID + "2"},
                    {"path": itemName1 + "3", "name": itemName1 + "3", "id": UnitTest.DUMMY_ID + "3"}]
                );

                const stubPrompt = sinon.stub(prompt, "get");
                stubPrompt.yields(null, {"test": "y", "test2": "y", "test3": "n"});

                const DELETE_ERROR = "Delete failure expected by unit test.";
                const stubDelete = sinon.stub(helper, "deleteRemoteItem");
                stubDelete.onFirstCall().resolves(itemName1);
                stubDelete.onSecondCall().rejects(DELETE_ERROR);

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api', searchArg, itemName1])
                    .then(function (msg) {
                        // The stub should only have been called once, and the expected message should have been returned.
                        expect(stubSearch).to.have.been.calledOnce;
                        expect(stubPrompt).to.have.been.calledOnce;
                        expect(stubDelete).to.have.been.calledTwice;
                        expect(msg).to.contain('Complete');
                        expect(msg).to.contain('Deleted 1 artifact');
                        expect(msg).to.contain('Encountered 1 error');
                        expect(msg).to.contain('wchtools-cli.log');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubSearch.restore();
                        stubPrompt.restore();
                        stubDelete.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail for multiple prompted artifacts if the delete fails", function(done) {
                const stubSearch = sinon.stub(helper, "searchRemote");
                stubSearch.resolves([{"path": itemName1, "id": UnitTest.DUMMY_ID}, {"path": itemName1 + "2", "id": UnitTest.DUMMY_ID + "2"}, {"path": itemName1 + "3", "id": UnitTest.DUMMY_ID + "3"}]);

                const stubPrompt = sinon.stub(prompt, "get");
                stubPrompt.yields(null, {"test": "y", "test2": "y", "test3": "n"});

                const DELETE_ERROR = "Delete failed, as expected by unit test.";
                const stubThrottle = sinon.stub(utils, "throttledAll");
                stubThrottle.rejects(DELETE_ERROR);

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api', searchArg, itemName1])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // The stub should only have been called once, and the expected message should have been returned.
                        expect(stubSearch).to.have.been.calledOnce;
                        expect(stubPrompt).to.have.been.calledOnce;
                        expect(stubThrottle).to.have.been.calledOnce;
                        expect(err.message).to.contain(DELETE_ERROR);
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubSearch.restore();
                        stubPrompt.restore();
                        stubThrottle.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed for none confirmed - prompt", function(done) {
                const stubSearch = sinon.stub(helper, "searchRemote");
                stubSearch.resolves([{"path": itemName1, "id": UnitTest.DUMMY_ID}, {"path": itemName1 + "2", "id": UnitTest.DUMMY_ID + "2"}, {"path": itemName1 + "3", "id": UnitTest.DUMMY_ID + "3"}]);

                const stubPrompt = sinon.stub(prompt, "get");
                stubPrompt.yields(null, {"test": "n", "test2": "n", "test3": "n"});

                const stubDelete = sinon.stub(helper, "deleteRemoteItem");

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api', searchArg, itemName1])
                    .then(function (msg) {
                        // The stub should only have been called once, and the expected message should have been returned.
                        expect(stubSearch).to.have.been.calledOnce;
                        expect(stubPrompt).to.have.been.calledOnce;
                        expect(stubDelete).to.not.have.been.called;
                        expect(msg).to.contain('No artifacts were deleted');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubSearch.restore();
                        stubPrompt.restore();
                        stubDelete.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail if the search fails", function (done) {
                const stub = sinon.stub(helper, "searchRemote");
                const SEARCH_FAIL = "The remote searcxh failed, as expected by a unit test.";
                stub.rejects(new Error(SEARCH_FAIL));

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--user', 'foo', '--password','password', '--url', 'http://foo.bar/api', searchArg, itemName1])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // The stub should only have been called once, and the expected error should have been returned.
                        expect(stub).to.have.been.calledOnce;
                        expect(err.message).to.contain(SEARCH_FAIL);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed method.
                        stub.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail if the dir parameter is invalid", function (done) {
                const stub = sinon.stub(fs, "statSync");
                const STAT_ERROR = new Error("BAD DIRECTORY");
                STAT_ERROR.code = "Invalid directory";
                stub.throws(STAT_ERROR);
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, searchArg, 'foo', '--dir', '....'])
                    .then(function (/*msg*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // The stub should only have been called once, and the expected error should have been returned.
                        expect(stub).to.have.been.calledOnce;
                        expect(err.message).to.contain(STAT_ERROR.code);
                        expect(err.message).to.contain('....');
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed method.
                        stub.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testDeleteSites(helper, switches, itemName1) {
        describe("Deleting sites", function () {
            it("should fail if an invalid artifact type is specified with the site-context option", function (done) {
                // Execute the command to delete the items by site.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", '--layouts', '--site-context', 'foo', '--path', 'bar', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        expect(err.message).to.contain("The --site-context option is only supported for sites and pages.");
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail if required site-context option is missing", function (done) {
                // Execute the command to delete the items by site.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // The expected message should have been returned.
                        expect(err.message).to.contain("To delete a site definition, the --site-context option must be specified.");
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail if no matching artifacts", function (done) {
                // Execute the command to delete the items by site.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--site-context', 'ack', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function (msg) {
                        // The expected message should have been returned.
                        expect(msg).to.contain("There were no artifacts to be deleted.");
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed if deleting a ready site, prompt exclude", function (done) {
                const stubPrompt = sinon.stub(prompt, "get");
                stubPrompt.yields(null, {"foo": "n"});

                const spyDelete = sinon.spy(helper, "deleteRemoteItem");

                // Execute the command to delete a ready site.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--ready', '--site-context', 'foo', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function (msg) {
                        expect(stubPrompt).to.have.been.calledOnce;
                        expect(stubPrompt.args[0][0].properties["foo"].description).to.equal("Delete site foo and all of its pages? y/n");
                        expect(spyDelete).to.not.have.been.called;
                        expect(msg).to.contain("No artifacts were deleted.");
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed methods.
                        stubPrompt.restore();
                        spyDelete.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed if deleting a ready site, prompt include", function (done) {
                const stubPrompt = sinon.stub(prompt, "get");
                stubPrompt.yields(null, {"foo": "y"});

                const stubDelete = sinon.stub(helper, "deleteRemoteItem");
                stubDelete.resolves(itemName1);

                // Execute the command to delete a ready site.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--ready', '--site-context', 'foo', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function (msg) {
                        expect(stubPrompt).to.have.been.calledOnce;
                        expect(stubPrompt.args[0][0].properties["foo"].description).to.equal("Delete site foo and all of its pages? y/n");
                        expect(stubDelete).to.have.been.calledOnce;
                        expect(stubDelete.args[0][1].id).to.equal("foo");
                        expect(stubDelete.args[0][1].contextRoot).to.equal("foo");
                        expect(msg).to.contain('Delete Complete.');
                        expect(msg).to.contain('Deleted 1 artifact');
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed methods.
                        stubPrompt.restore();
                        stubDelete.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed if deleting a draft site, quiet", function (done) {
                const spyPrompt = sinon.spy(prompt, "get");

                const stubDelete = sinon.stub(helper, "deleteRemoteItem");
                stubDelete.resolves(itemName1);

                // Execute the command to delete a ready site.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--quiet', '--draft', '--site-context', 'bar', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function (msg) {
                        expect(spyPrompt).to.not.have.been.called;
                        expect(stubDelete).to.have.been.calledOnce;
                        expect(stubDelete.args[0][1].id).to.equal("bar");
                        expect(stubDelete.args[0][1].contextRoot).to.equal("bar");
                        expect(msg).to.contain('Deleted bar_wchdraft.');
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed methods.
                        spyPrompt.restore();
                        stubDelete.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed if deleting a draft site, prompt include", function (done) {
                const stubPrompt = sinon.stub(prompt, "get");
                stubPrompt.yields(null, {"bar": "y"});

                const stubDelete = sinon.stub(helper, "deleteRemoteItem");
                stubDelete.resolves(itemName1);

                // Execute the command to delete a ready site.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--draft', '--site-context', 'bar', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function (msg) {
                        expect(stubPrompt).to.have.been.calledOnce;
                        expect(stubPrompt.args[0][0].properties["bar"].description).to.equal("Delete site bar_wchdraft and all of its pages? y/n");
                        expect(stubDelete).to.have.been.calledOnce;
                        expect(stubDelete.args[0][1].id).to.equal("bar");
                        expect(stubDelete.args[0][1].contextRoot).to.equal("bar");
                        expect(msg).to.contain('Delete Complete.');
                        expect(msg).to.contain('Deleted 1 artifact');
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed methods.
                        stubPrompt.restore();
                        stubDelete.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed if previewing delete of the default ready site", function (done) {
                // Remove the global stub and create a local SitesREST.getItems stub that returns the default sites.
                DeleteUnitTest.restoreRemoteSitesStub();
                const stubGet = sinon.stub(helper._restApi, "getItems");
                stubGet.resolves([{id: "default", status: "ready"}, {id: "default:draft", status: "draft"}]);

                const spyCanDelete = sinon.spy(helper, "canDeleteItem");

                // Execute the command to delete a ready site.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--preview', '--ready', '--site-context', 'default', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function () {
                        expect(stubGet).to.have.been.calledOnce;
                        expect(spyCanDelete).to.have.been.calledTwice;
                        expect(spyCanDelete.args[0][0].id).to.equal("default:draft");
                        expect(spyCanDelete.args[0][0].contextRoot).to.not.exist;
                        expect(spyCanDelete.returnValues[0]).to.equal(false);
                        expect(spyCanDelete.args[1][0].id).to.equal("default");
                        expect(spyCanDelete.args[1][0].contextRoot).to.not.exist;
                        expect(spyCanDelete.returnValues[1]).to.equal(false);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed methods.
                        stubGet.restore();
                        spyCanDelete.restore();

                        // Add the global stub back now (it was removed earlier).
                        DeleteUnitTest.addRemoteSitesStub();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed if previewing delete of the default draft site", function (done) {
                // Remove the global stub and create a local SitesREST.getItems stub that returns the default sites.
                DeleteUnitTest.restoreRemoteSitesStub();
                const stubGet = sinon.stub(helper._restApi, "getItems");
                stubGet.resolves([{id: "default", status: "ready"}, {id: "default:draft", status: "draft"}]);

                const spyCanDelete = sinon.spy(helper, "canDeleteItem");

                // Execute the command to delete a draft site.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--preview', '--draft', '--site-context', 'default', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function () {
                        expect(stubGet).to.have.been.calledOnce;
                        expect(spyCanDelete).to.have.been.calledOnce;
                        expect(spyCanDelete.args[0][0].id).to.equal("default:draft");
                        expect(spyCanDelete.args[0][0].contextRoot).to.not.exist;
                        expect(spyCanDelete.returnValues[0]).to.equal(false);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed methods.
                        stubGet.restore();
                        spyCanDelete.restore();

                        // Add the global stub back now (it was removed earlier).
                        DeleteUnitTest.addRemoteSitesStub();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed if deleting the default draft site, quiet", function (done) {
                // Remove the global stub and create a local SitesREST.getItems stub that returns the default sites.
                DeleteUnitTest.restoreRemoteSitesStub();
                const stubGet = sinon.stub(helper._restApi, "getItems");
                stubGet.resolves([{id: "default", status: "ready"}, {id: "default:draft", status: "draft"}]);

                const spyCanDelete = sinon.spy(helper, "canDeleteItem");

                // Execute the command to delete a draft site.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--quiet', '--draft', '--site-context', 'default', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function () {
                        expect(stubGet).to.have.been.calledOnce;
                        expect(spyCanDelete).to.have.been.calledOnce;
                        expect(spyCanDelete.args[0][0].id).to.equal("default:draft");
                        expect(spyCanDelete.args[0][0].contextRoot).to.not.exist;
                        expect(spyCanDelete.returnValues[0]).to.equal(false);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed methods.
                        stubGet.restore();
                        spyCanDelete.restore();

                        // Add the global stub back now (it was removed earlier).
                        DeleteUnitTest.addRemoteSitesStub();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed if deleting the default ready and draft sites, quiet", function (done) {
                // Remove the global stub and create a local SitesREST.getItems stub that returns the default sites.
                DeleteUnitTest.restoreRemoteSitesStub();
                const stubGet = sinon.stub(helper._restApi, "getItems");
                stubGet.resolves([{id: "default", status: "ready"}, {id: "default:draft", status: "draft"}]);

                const spyCanDelete = sinon.spy(helper, "canDeleteItem");
                const spyDelete = sinon.spy(helper, "deleteRemoteItem");

                // Execute the command to delete sites.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--quiet', '--ready', '--draft', '--site-context', 'default', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function () {
                        expect(stubGet).to.have.been.calledOnce;
                        expect(spyCanDelete).to.have.been.calledTwice;
                        expect(spyCanDelete.args[0][0].id).to.equal("default:draft");
                        expect(spyCanDelete.args[0][0].contextRoot).to.not.exist;
                        expect(spyCanDelete.returnValues[0]).to.equal(false);
                        expect(spyCanDelete.args[1][0].id).to.equal("default");
                        expect(spyCanDelete.args[1][0].contextRoot).to.not.exist;
                        expect(spyCanDelete.returnValues[1]).to.equal(false);
                        expect(spyDelete).to.not.have.been.called;
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed methods.
                        stubGet.restore();
                        spyCanDelete.restore();
                        spyDelete.restore();

                        // Add the global stub back now (it was removed earlier).
                        DeleteUnitTest.addRemoteSitesStub();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testDeletePageById(helper, switches, itemName1) {
        describe("Deleting pages by id", function () {
            it("should fail if deleting ready and draft pages by id", function (done) {
                // Execute the command to delete the page.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--id', itemName1, '--ready', '--draft', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // The expected message should have been returned.
                        expect(err.message).to.contain("The --ready and --draft options cannot both be specified when deleting by id.");
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed if deleting a page and page content", function (done) {
                const stubGet = sinon.stub(helper, "getRemoteItem");
                stubGet.resolves({id: itemName1, hierarchicalPath: itemName1});
                const stubList = sinon.stub(helper, "_listRemoteItemNames");
                stubList.resolves([]);
                const stubDelete = sinon.stub(helper, "deleteRemoteItem");
                stubDelete.resolves({id: itemName1});

                // Execute the command to delete the page.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--page-content', '--id', itemName1, '--site-context', 'foo', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function (msg) {
                        // The stub should only have been called once, and the expected message should have been returned.
                        expect(stubGet).to.have.been.calledOnce;
                        expect(stubList).to.have.been.calledOnce;
                        expect(stubDelete).to.have.been.calledOnce;
                        expect(msg).to.contain('Deleted');
                        expect(msg).to.contain(itemName1);
                        expect(msg).to.contain("foo");
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubGet.restore();
                        stubList.restore();
                        stubDelete.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed if the page does not exist", function (done) {
                const stubGet = sinon.stub(helper, "getRemoteItem");
                stubGet.resolves(undefined);

                // Execute the command to delete the page.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--id', itemName1, '--site-context', 'foo', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function (msg) {
                        // The stubs should only have been called once, and the expected message should have been returned.
                        expect(stubGet).to.have.been.calledOnce;
                        expect(msg).to.contain("There were no artifacts to be deleted.");
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubGet.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed if deleting a page, quiet", function (done) {
                const stubGet = sinon.stub(helper, "getRemoteItem");
                stubGet.resolves({id: itemName1, hierarchicalPath: itemName1});

                const stubDelete = sinon.stub(helper, "deleteRemoteItem");
                stubDelete.resolves({id: itemName1});

                // Execute the command to delete the page.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--quiet', '--id', itemName1, '--site-context', 'foo', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function (msg) {
                        // The stubs should only have been called once, and the expected message should have been returned.
                        expect(stubGet).to.have.been.calledOnce;
                        expect(stubDelete).to.have.been.calledOnce;
                        expect(msg).to.contain('Deleted');
                        expect(msg).to.contain(itemName1);
                        expect(msg).to.contain("foo");
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubGet.restore();
                        stubDelete.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed if deleting a page with children", function (done) {
                const stubGet = sinon.stub(helper, "getRemoteItem");
                stubGet.resolves({id: "page", name: "page", hierarchicalPath: "/page"});

                // Return a list of child pages.
                const stubList = sinon.stub(helper, "_listRemoteItemNames");
                stubList.resolves([{id: "child", name: "child", hierarchicalPath: "/page/child"}]);

                const stubPrompt = sinon.stub(prompt, "get");
                stubPrompt.yields(null, {"page": "y"});

                const stubDelete = sinon.stub(helper, "deleteRemoteItem");
                stubDelete.resolves({id: itemName1});

                // Execute the command to delete the page.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--id', itemName1, '--site-context', 'foo', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function (msg) {
                        // The stubs should only have been called once, and the expected message should have been returned.
                        expect(stubGet).to.have.been.calledOnce;
                        expect(stubList).to.have.been.calledOnce;
                        expect(stubPrompt).to.have.been.calledOnce;
                        expect(stubDelete).to.have.been.calledOnce;
                        expect(msg).to.contain("Deleted 1 artifact successfully.");
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubGet.restore();
                        stubList.restore();
                        stubPrompt.restore();
                        stubDelete.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail if deleting a page fails when getting children", function (done) {
                const stubGet = sinon.stub(helper, "getRemoteItem");
                stubGet.resolves({id: "page", name: "page", hierarchicalPath: "/page"});

                // Return a list of child pages.
                const LIST_ERROR = "Error getting list of child pages, expected by unit test.";
                const stubList = sinon.stub(helper, "_listRemoteItemNames");
                stubList.rejects(new Error(LIST_ERROR));

                // Execute the command to delete the page.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--id', itemName1, '--site-context', 'foo', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // The stubs should only have been called once, and the expected message should have been returned.
                        expect(stubGet).to.have.been.calledOnce;
                        expect(stubList).to.have.been.calledOnce;
                        expect(err.message).to.contain(LIST_ERROR);
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubGet.restore();
                        stubList.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testDeletePagesByPath(helper, switches, itemName1) {
        describe("Deleting pages by path", function () {
            it("should fail if required site-context option is missing", function (done) {
                // Execute the command to delete the items by path.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--path', 'bar', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // The expected message should have been returned.
                        expect(err.message).to.contain("To delete a page, the --id option or the --path and --site-context options must be specified.");
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail if required path option is missing", function (done) {
                // Execute the command to delete the items by site.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--site-context', 'bar', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // The expected message should have been returned.
                        expect(err.message).to.contain("To delete a page, the --id option or the --path and --site-context options must be specified.");
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail if no matching artifacts", function (done) {
                // Execute the command to delete the items by site.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--site-context', 'ack', '--path', 'bar', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function (msg) {
                        // The expected message should have been returned.
                        expect(msg).to.contain("There were no artifacts to be deleted.");
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail if error getting children", function (done) {
                const stubGet = sinon.stub(helper, "getRemoteItemByPath");
                stubGet.resolves({id: "page", name: "page", hierarchicalPath: "/page", status: "ready"});

                // Return a list of child pages.
                const stubList = sinon.stub(helper, "_listRemoteItemNames");
                const LIST_ERROR = "Error getting child pages, expected by unit test.";
                stubList.rejects(new Error(LIST_ERROR));

                const spyPrompt = sinon.spy(prompt, "get");

                const spyDelete = sinon.spy(helper, "deleteRemoteItem");

                // Execute the command to delete the page.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--path', 'page', '--site-context', 'foo', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // The stubs should only have been called once, and the expected message should have been returned.
                        expect(stubGet).to.have.been.calledOnce;
                        expect(stubList).to.have.been.calledOnce;
                        expect(spyPrompt).to.not.have.been.called;
                        expect(spyDelete).to.not.have.been.called;
                        expect(err.message).to.contain(LIST_ERROR);
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubGet.restore();
                        stubList.restore();
                        spyPrompt.restore();
                        spyDelete.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed if deleting a ready page with children", function (done) {
                const stubGet = sinon.stub(helper, "getRemoteItemByPath");
                stubGet.resolves({id: "page", name: "page", hierarchicalPath: "/page", status: "ready"});

                // Return a list of child pages.
                const stubList = sinon.stub(helper, "_listRemoteItemNames");
                stubList.resolves([{id: "child", name: "child", hierarchicalPath: "/page/child", status: "ready"}]);

                const stubPrompt = sinon.stub(prompt, "get");
                stubPrompt.yields(null, {"page": "y"});

                const stubDelete = sinon.stub(helper, "deleteRemoteItem");
                stubDelete.resolves({id: itemName1});

                // Execute the command to delete the page.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--path', 'page', '--site-context', 'foo', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function (msg) {
                        // The stubs should only have been called once, and the expected message should have been returned.
                        expect(stubGet).to.have.been.calledOnce;
                        expect(stubList).to.have.been.calledOnce;
                        expect(stubPrompt).to.have.been.calledOnce;
                        expect(stubDelete).to.have.been.calledOnce;
                        expect(msg).to.contain("Deleted 1 artifact successfully.");
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubGet.restore();
                        stubList.restore();
                        stubPrompt.restore();
                        stubDelete.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed if deleting a draft page with children", function (done) {
                const stubGet = sinon.stub(helper, "getRemoteItemByPath");
                stubGet.resolves({
                    id: "page",
                    name: "page",
                    hierarchicalPath: "/page",
                    status: "draft",
                    draftType: ["properties"]
                });

                // Return a list of child pages.
                const stubList = sinon.stub(helper, "_listRemoteItemNames");
                stubList.resolves([{
                    id: "child",
                    name: "child",
                    hierarchicalPath: "/page/child",
                    status: "draft",
                    draftType: ["properties"]
                }]);

                const stubPrompt = sinon.stub(prompt, "get");
                stubPrompt.yields(null, {"page": "y"});

                const stubDelete = sinon.stub(helper, "deleteRemoteItem");
                stubDelete.resolves({id: itemName1});

                // Execute the command to delete the page.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--path', 'page', '--site-context', 'bar', '--draft', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function (msg) {
                        // The stubs should only have been called once, and the expected message should have been returned.
                        expect(stubGet).to.have.been.calledOnce;
                        expect(stubList).to.have.been.calledOnce;
                        expect(stubPrompt).to.have.been.calledOnce;
                        expect(stubDelete).to.have.been.calledOnce;
                        expect(msg).to.contain("Deleted 1 artifact successfully.");
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubGet.restore();
                        stubList.restore();
                        stubPrompt.restore();
                        stubDelete.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed if attempting to delete an overlay page", function (done) {
                const stubGet = sinon.stub(helper, "getRemoteItemByPath");
                stubGet.resolves({id: "page", name: "page", hierarchicalPath: "/page", status: "draft"});

                const spyList = sinon.spy(helper, "_listRemoteItemNames");
                const spyPrompt = sinon.spy(prompt, "get");
                const spyDelete = sinon.spy(helper, "deleteRemoteItem");

                // Execute the command to delete the page.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--path', 'page', '--site-context', 'bar', '--draft', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function (msg) {
                        // The stubs should only have been called once, and the expected message should have been returned.
                        expect(stubGet).to.have.been.calledOnce;
                        expect(spyList).to.not.have.been.called;
                        expect(spyPrompt).to.not.have.been.called;
                        expect(spyDelete).to.not.have.been.called;
                        expect(msg).to.contain("There were no artifacts to be deleted.");
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubGet.restore();
                        spyList.restore();
                        spyPrompt.restore();
                        spyDelete.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed if deleting draft and ready pages", function (done) {
                // Remove the global stub and create a local SitesREST.getItems stub that returns the default sites.
                DeleteUnitTest.restoreRemoteSitesStub();
                const stubSites = sinon.stub(sitesHelper._restApi, "getItems");
                stubSites.resolves([
                    {id: "foo", status: "ready", contextRoot: "foo"},
                    {id: "foo:draft", status: "draft", contextRoot: "foo"}
                ]);

                const stubGet = sinon.stub(helper, "getRemoteItemByPath");
                stubGet.onFirstCall().resolves({
                    id: "page:draft",
                    name: "page",
                    hierarchicalPath: "/page",
                    status: "draft",
                    draftType: ["properties"]
                });
                stubGet.onSecondCall().resolves({id: "page", name: "page", hierarchicalPath: "/page", status: "ready"});

                // Return a list of child pages.
                const stubList = sinon.stub(helper, "_listRemoteItemNames");
                stubList.onFirstCall().resolves([{
                    id: "child:draft",
                    name: "child",
                    hierarchicalPath: "/page/child",
                    status: "draft",
                    draftType: ["properties"]
                }]);
                stubList.onSecondCall().resolves([{
                    id: "child",
                    name: "child",
                    hierarchicalPath: "/page/child",
                    status: "ready"
                }]);

                const stubPrompt = sinon.stub(prompt, "get");
                stubPrompt.yields(null, {"page:draft": "y", "page": "y"});

                const stubDelete = sinon.stub(helper, "deleteRemoteItem");
                stubDelete.onFirstCall().resolves({id: "page:draft"});
                stubDelete.onSecondCall().resolves({id: "page"});

                // Execute the command to delete the page.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--path', 'page', '--site-context', 'foo', '--ready', '--draft', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function (msg) {
                        // The stubs should only have been called once, and the expected message should have been returned.
                        expect(stubGet).to.have.been.calledTwice;
                        expect(stubList).to.have.been.calledTwice;
                        expect(stubPrompt).to.have.been.calledOnce;
                        expect(stubDelete).to.have.been.calledTwice;
                        expect(msg).to.contain("Deleted 2 artifacts successfully.");
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubSites.restore();
                        stubGet.restore();
                        stubList.restore();
                        stubPrompt.restore();
                        stubDelete.restore();

                        // Add the global stub back now (it was removed earlier).
                        DeleteUnitTest.addRemoteSitesStub();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed if delete ready page (no draft page), quiet", function (done) {
                // Remove the global stub and create a local SitesREST.getItems stub that returns the default sites.
                DeleteUnitTest.restoreRemoteSitesStub();
                const stubSites = sinon.stub(sitesHelper._restApi, "getItems");
                stubSites.resolves([
                    {id: "foo", status: "ready", contextRoot: "foo"},
                    {id: "foo:draft", status: "draft", contextRoot: "foo"}
                ]);

                const stubGet = sinon.stub(helper, "getRemoteItemByPath");
                const GET_ERROR = new Error("Draft page not found, expected by unit test.");
                GET_ERROR.statusCode = 404;
                stubGet.onFirstCall().rejects(GET_ERROR);
                stubGet.onSecondCall().resolves({id: "page", name: "page", hierarchicalPath: "/page", status: "ready"});

                const spyList = sinon.spy(helper, "_listRemoteItemNames");

                const spyPrompt = sinon.spy(prompt, "get");

                const stubDelete = sinon.stub(helper, "deleteRemoteItem");
                stubDelete.resolves({id: "page"});

                // Execute the command to delete the page.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--quiet', '--path', 'page', '--site-context', 'foo', '--ready', '--draft', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function (msg) {
                        // The stubs should only have been called once, and the expected message should have been returned.
                        expect(stubGet).to.have.been.calledTwice;
                        expect(spyList).to.not.have.been.called;
                        expect(spyPrompt).to.not.have.been.called;
                        expect(stubDelete).to.have.been.calledOnce;
                        expect(msg).to.contain("Deleted /page (in the 'foo' site).");
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubSites.restore();
                        stubGet.restore();
                        spyList.restore();
                        spyPrompt.restore();
                        stubDelete.restore();

                        // Add the global stub back now (it was removed earlier).
                        DeleteUnitTest.addRemoteSitesStub();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testDeleteByTag (helper, switches, itemName1) {
        describe("Deleting items by tag", function () {
            it("should fail if no artifact types specified", function(done) {
                // Execute the command to delete the items.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api', '--tag', itemName1])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        expect(err.message).to.contain("artifact type must be specified");
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail if only an invalid artifact type is specified", function(done) {
                // Execute the command to delete the items.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", '--layouts', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api', '--tag', itemName1])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        expect(err.message).to.contain("only supported for content items, content types, and content assets");
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail if an invalid artifact type is also specified", function(done) {
                // Execute the command to delete the items.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, "--layouts", '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api', '--tag', itemName1])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        expect(err.message).to.contain("only supported for content items, content types, and content assets");
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail if no matching artifacts", function(done) {
                const stubSearch = sinon.stub(helper, "searchRemote");
                stubSearch.resolves([]);

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api', '--tag', itemName1])
                    .then(function (msg) {
                        // The stub should only have been called once, and the expected message should have been returned.
                        expect(stubSearch).to.have.been.calledOnce;
                        expect(msg).to.contain("There were no artifacts to be deleted.");
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubSearch.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed for a single artifact", function(done) {
                const stubSearch = sinon.stub(helper, "searchRemote");
                stubSearch.resolves([{"path": itemName1, "id": UnitTest.DUMMY_ID, "name": itemName1}]);

                const stubDelete = sinon.stub(helper, "deleteRemoteItem");
                stubDelete.resolves(itemName1);

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--quiet', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api', '--tag', itemName1])
                    .then(function (msg) {
                        // The stub should only have been called once, and the expected message should have been returned.
                        expect(stubDelete).to.have.been.calledOnce;
                        expect(msg).to.contain('Deleted 1 artifact successfully.');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubSearch.restore();
                        stubDelete.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when single delete fails", function(done) {
                const stubSearch = sinon.stub(helper, "searchRemote");
                stubSearch.resolves([{"path": itemName1, "id": UnitTest.DUMMY_ID, "name": itemName1}]);

                const DELETE_ERROR = "Delete failure expected by unit test.";
                const stubDelete = sinon.stub(helper, "deleteRemoteItem");
                stubDelete.rejects(DELETE_ERROR);

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--quiet', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api', '--tag', itemName1])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // The stubs should only have been called once, and the expected error should have been returned.
                        expect(stubSearch).to.have.been.calledOnce;
                        expect(stubDelete).to.have.been.calledOnce;
                        expect(err.message).to.contain("Encountered 1 error while deleting artifacts.");
                        expect(err.message).to.contain("wchtools-cli.log");
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubSearch.restore();
                        stubDelete.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should not delete - preview", function(done) {
                const stubSearch = sinon.stub(helper, "searchRemote");
                stubSearch.resolves([{"path": itemName1, "name": itemName1, "id": UnitTest.DUMMY_ID},
                    {"path": itemName1 + "2", "name": itemName1 + "2", "id": UnitTest.DUMMY_ID + "2"},
                    {"path": itemName1 + "3", "name": itemName1 + "3", "id": UnitTest.DUMMY_ID + "3"}]
                );

                const stubCanDelete = sinon.stub(helper, "canDeleteItem");
                stubCanDelete.onFirstCall().returns(true);
                stubCanDelete.onSecondCall().returns(false);
                stubCanDelete.onThirdCall().returns(true);

                const spyDelete = sinon.spy(helper, "deleteRemoteItem");

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api', '-P', '--tag', itemName1])
                    .then(function () {
                        // The stub should only have been called once, and the expected message should have been returned.
                        expect(stubSearch).to.have.been.calledOnce;
                        expect(stubCanDelete).to.have.been.calledThrice;
                        expect(spyDelete).to.not.have.been.called;
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubSearch.restore();
                        spyDelete.restore();
                        stubCanDelete.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when some deletes fail - quiet", function(done) {
                const stubSearch = sinon.stub(helper, "searchRemote");
                stubSearch.resolves([{"path": itemName1, "name": itemName1, "id": UnitTest.DUMMY_ID},
                    {"path": itemName1 + "2", "name": itemName1 + "2", "id": UnitTest.DUMMY_ID + "2"},
                    {"path": itemName1 + "3", "name": itemName1 + "3", "id": UnitTest.DUMMY_ID + "3"}]
                );

                const DELETE_ERROR = "Delete failure expected by unit test.";
                const stubDelete = sinon.stub(helper, "deleteRemoteItem");
                stubDelete.onFirstCall().resolves(itemName1);
                stubDelete.onSecondCall().rejects(DELETE_ERROR);
                stubDelete.onThirdCall().rejects(DELETE_ERROR);

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api', '-q', '--tag', itemName1])
                    .then(function (msg) {
                        // The stub should only have been called once, and the expected message should have been returned.
                        expect(stubDelete).to.have.been.calledThrice;
                        expect(msg).to.contain('Delete by tag complete.');
                        expect(msg).to.contain('Deleted 1 artifact');
                        expect(msg).to.contain('Encountered 2 errors');
                        expect(msg).to.contain('wchtools-cli.log');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubSearch.restore();
                        stubDelete.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when search fails, no continue on error", function(done) {
                // Create a stub to return a value for the "continueOnError" key.
                const originalGetProperty = options.getProperty.bind(options);
                const stubGet = sinon.stub(options, "getProperty", function (context, key) {
                    if (key === "continueOnError") {
                        return false;
                    } else {
                        return originalGetProperty(context, key);
                    }
                });

                const DELETE_ERROR = "Delete failure expected by unit test.";
                const stubSearch = sinon.stub(helper, "searchRemote");
                stubSearch.rejects(DELETE_ERROR);

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api', '--tag', itemName1])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // The stub should only have been called once, and the expected message should have been returned.
                        expect(stubSearch).to.have.been.calledOnce;
                        expect(err.message).to.contain(DELETE_ERROR);
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubGet.restore();
                        stubSearch.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when all deletes fail - quiet", function(done) {
                const stubSearch = sinon.stub(helper, "searchRemote");
                stubSearch.resolves([{"path": itemName1, "name": itemName1, "id": UnitTest.DUMMY_ID},
                    {"path": itemName1 + "2", "name": itemName1 + "2", "id": UnitTest.DUMMY_ID + "2"},
                    {"path": itemName1 + "3", "name": itemName1 + "3", "id": UnitTest.DUMMY_ID + "3"}]
                );

                const DELETE_ERROR = "Delete failure expected by unit test.";
                const stubDelete = sinon.stub(helper, "deleteRemoteItem");
                stubDelete.onFirstCall().rejects(DELETE_ERROR);
                stubDelete.onSecondCall().rejects(DELETE_ERROR);
                stubDelete.onThirdCall().rejects(DELETE_ERROR);

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api', '-q', '--tag', itemName1])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // The stub should only have been called once, and the expected message should have been returned.
                        expect(stubDelete).to.have.been.calledThrice;
                        expect(err.message).to.contain('Encountered 3 errors');
                        expect(err.message).to.contain('wchtools-cli.log');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubSearch.restore();
                        stubDelete.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed for multiple artifacts - quiet", function(done) {
                const stubSearch = sinon.stub(helper, "searchRemote");
                stubSearch.resolves([{"name": itemName1, "id": UnitTest.DUMMY_ID},
                    {"name": itemName1 + "2", "id": UnitTest.DUMMY_ID + "2"},
                    {"name": itemName1 + "3", "id": UnitTest.DUMMY_ID + "3"}]
                );

                const stubDelete = sinon.stub(helper, "deleteRemoteItem");
                stubDelete.onFirstCall().resolves(itemName1);
                stubDelete.onSecondCall().resolves(itemName1 + "2");
                stubDelete.onThirdCall().resolves(itemName1 + "3");

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--verbose', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api', '-q', '--tag', itemName1])
                    .then(function (msg) {
                        // The stub should only have been called once, and the expected message should have been returned.
                        expect(stubDelete).to.have.been.calledThrice;
                        expect(msg).to.contain('Delete by tag complete.');
                        expect(msg).to.contain('Deleted 3 artifacts');
                        expect(msg).to.not.contain('errors');
                        expect(msg).to.not.contain('wchtools-cli.log');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubSearch.restore();
                        stubDelete.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail for multiple items if throttledAll fails", function (done) {
                const stubSearch = sinon.stub(helper, "searchRemote");
                stubSearch.resolves([{"path": itemName1, "id": UnitTest.DUMMY_ID}, {"path": itemName1 + "2", "id": UnitTest.DUMMY_ID + "2"}, {"path": itemName1 + "3", "id": UnitTest.DUMMY_ID + "3"}]);

                const DELETE_ERROR = "Delete failed, as expected by unit test.";
                const stubThrottle = sinon.stub(utils, "throttledAll");
                stubThrottle.rejects(DELETE_ERROR);

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api', '-q', '--tag', itemName1])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // The stubs should only have been called once, and the expected error should have been returned.
                        expect(stubSearch).to.have.been.calledOnce;
                        expect(stubThrottle).to.have.been.calledOnce;
                        expect(err.message).to.contain("1 error while deleting artifacts");
                        expect(err.message).to.contain("wchtools-cli.log");
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed methods.
                        stubSearch.restore();
                        stubThrottle.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail for multiple items if throttledAll fails - verbose", function (done) {
                const stubSearch = sinon.stub(helper, "searchRemote");
                stubSearch.resolves([{"path": itemName1, "id": UnitTest.DUMMY_ID}, {"path": itemName1 + "2", "id": UnitTest.DUMMY_ID + "2"}, {"path": itemName1 + "3", "id": UnitTest.DUMMY_ID + "3"}]);

                const DELETE_ERROR = "Delete failed, as expected by unit test.";
                const stubThrottle = sinon.stub(utils, "throttledAll");
                stubThrottle.rejects(DELETE_ERROR);

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--verbose', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api', '-q', '--tag', itemName1])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // The stubs should only have been called once, and the expected error should have been returned.
                        expect(stubSearch).to.have.been.calledOnce;
                        expect(stubThrottle).to.have.been.calledOnce;
                        expect(err.message).to.contain("1 error while deleting artifacts");
                        expect(err.message).to.not.contain("wchtools-cli.log");
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed methods.
                        stubSearch.restore();
                        stubThrottle.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed for multiple artifacts - prompt", function(done) {
                const stubSearch = sinon.stub(helper, "searchRemote");
                stubSearch.resolves([{"path": itemName1, "name": itemName1, "id": UnitTest.DUMMY_ID},
                    {"path": itemName1 + "2", "name": itemName1 + "2", "id": UnitTest.DUMMY_ID + "2"},
                    {"path": itemName1 + "3", "name": itemName1 + "3", "id": UnitTest.DUMMY_ID + "3"}]
                );

                const stubPrompt = sinon.stub(prompt, "get");
                stubPrompt.yields(null, {"test": "y", "test2": "y", "test3": "n"});

                const DELETE_ERROR = "Delete failure expected by unit test.";
                const stubDelete = sinon.stub(helper, "deleteRemoteItem");
                stubDelete.onFirstCall().resolves(itemName1);
                stubDelete.onSecondCall().rejects(DELETE_ERROR);

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api', '--tag', itemName1])
                    .then(function (msg) {
                        // The stub should only have been called once, and the expected message should have been returned.
                        expect(stubSearch).to.have.been.calledOnce;
                        expect(stubPrompt).to.have.been.calledOnce;
                        expect(stubDelete).to.have.been.calledTwice;
                        expect(msg).to.contain('Delete by tag complete.');
                        expect(msg).to.contain('Deleted 1 artifact');
                        expect(msg).to.contain('Encountered 1 error');
                        expect(msg).to.contain('wchtools-cli.log');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubSearch.restore();
                        stubPrompt.restore();
                        stubDelete.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail for multiple prompted artifacts if the delete fails", function(done) {
                const stubSearch = sinon.stub(helper, "searchRemote");
                stubSearch.resolves([{"path": itemName1, "id": UnitTest.DUMMY_ID}, {"path": itemName1 + "2", "id": UnitTest.DUMMY_ID + "2"}, {"path": itemName1 + "3", "id": UnitTest.DUMMY_ID + "3"}]);

                const stubPrompt = sinon.stub(prompt, "get");
                stubPrompt.yields(null, {"test": "y", "test2": "y", "test3": "n"});

                const DELETE_ERROR = "Delete failed, as expected by unit test.";
                const stubThrottle = sinon.stub(utils, "throttledAll");
                stubThrottle.rejects(DELETE_ERROR);

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api', '--tag', itemName1])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // The stub should only have been called once, and the expected message should have been returned.
                        expect(stubSearch).to.have.been.calledOnce;
                        expect(stubPrompt).to.have.been.calledOnce;
                        expect(stubThrottle).to.have.been.calledOnce;
                        expect(err.message).to.contain("1 error while deleting artifacts");
                        expect(err.message).to.contain("wchtools-cli.log");
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubSearch.restore();
                        stubPrompt.restore();
                        stubThrottle.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed for none confirmed - prompt", function(done) {
                const stubSearch = sinon.stub(helper, "searchRemote");
                stubSearch.resolves([{"path": itemName1, "id": UnitTest.DUMMY_ID}, {"path": itemName1 + "2", "id": UnitTest.DUMMY_ID + "2"}, {"path": itemName1 + "3", "id": UnitTest.DUMMY_ID + "3"}]);

                const stubPrompt = sinon.stub(prompt, "get");
                stubPrompt.yields(null, {"test": "n", "test2": "n", "test3": "n"});

                const stubDelete = sinon.stub(helper, "deleteRemoteItem");

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api', '--tag', itemName1])
                    .then(function (msg) {
                        // The stub should only have been called once, and the expected message should have been returned.
                        expect(stubSearch).to.have.been.calledOnce;
                        expect(stubPrompt).to.have.been.calledOnce;
                        expect(stubDelete).to.not.have.been.called;
                        expect(msg).to.contain('There were no artifacts to be deleted.');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubSearch.restore();
                        stubPrompt.restore();
                        stubDelete.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail if the search fails", function (done) {
                const stub = sinon.stub(helper, "searchRemote");
                const SEARCH_FAIL = "The remote searcxh failed, as expected by a unit test.";
                stub.rejects(new Error(SEARCH_FAIL));

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--user', 'foo', '--password','password', '--url', 'http://foo.bar/api', '--tag', itemName1])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // The stub should only have been called once, and the expected error should have been returned.
                        expect(stub).to.have.been.calledOnce;
                        expect(err.message).to.contain("1 error while deleting artifacts");
                        expect(err.message).to.contain("wchtools-cli.log");
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed method.
                        stub.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail if the dir parameter is invalid", function (done) {
                const stub = sinon.stub(fs, "statSync");
                const STAT_ERROR = new Error("BAD DIRECTORY");
                STAT_ERROR.code = "Invalid directory";
                stub.throws(STAT_ERROR);
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--tag', 'foo', '--dir', '....'])
                    .then(function (/*msg*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // The stub should only have been called once, and the expected error should have been returned.
                        expect(stub).to.have.been.calledOnce;
                        expect(err.message).to.contain(STAT_ERROR.code);
                        expect(err.message).to.contain('....');
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed method.
                        stub.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testDeletePageContentFail (helper, itemName) {
        describe("Deleting items with bad params", function () {
            it("should fail if --page-content is specified with non pages arg", function (done) {
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", '-c', '--id', '1234', '--page-content', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // The expected error should have been returned.
                        expect(err.message).to.contain('--page-content');
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

    testDeleteParamFail (helper, switches, itemName1) {
        describe("Deleting items", function () {
            it("should fail if there is an extra param", function (done) {
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--named', itemName1, '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api', 'foo'])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // The expected error should have been returned.
                        expect(err.message).to.contain('Invalid option');
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail if --all by itself", function (done) {
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", '--all', "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // The expected error should have been returned.
                        expect(err.message).to.contain('must be specified');
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail if --all specifies --preview", function (done) {
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--all', '--preview', "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // The expected error should have been returned.
                        expect(err.message).to.contain('all');
                        expect(err.message).to.contain('does not support')
                        expect(err.message).to.contain('--preview');
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail if no id, path, or named parameter is specified", function (done) {
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // The expected error should have been returned.
                        expect(err.message).to.contain('specified');
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail if --content, but not --id, is specified", function (done) {
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", "--content", '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        try {
                            // The expected error should have been returned.
                            expect(err.message).to.contain('--id');
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail if no artifact type parameter is specified", function (done) {
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", '--path', 'red', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // The expected error should have been returned.
                        expect(err.message).to.contain('An artifact type must be specified.');
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail if multiple artifact type parameters are specified", function (done) {
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", '-wlm', '--path', 'red', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // The expected error should have been returned.
                        expect(err.message).to.contain('Deleting more than one artifact type at a time is only supported when the --all, --tag, or --manifest option is specified.');
                    })
                    .catch (function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail if both path and id parameters are specified", function (done) {
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--id', 'red', '--path', 'red', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // The expected error should have been returned.
                        expect(err.message).to.contain('The --id and --path options cannot both be specified.');
                    })
                    .catch (function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail if delete by id is not supported", function (done) {
                const stubId = sinon.stub(helper, "supportsDeleteById");
                stubId.returns(false);

                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--id', 'red', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        if (!(switches.includes('-a') || (switches.includes('-w')))) {
                            // The stub should have been called and the expected error should have been returned.
                            expect(stubId).to.have.been.calledOnce;
                            expect(err.message).to.contain('The --id option is not supported for the specified artifact type.');
                        }
                    })
                    .catch (function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed method.
                        stubId.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail if delete by path is not supported", function (done) {
                const stubPath = sinon.stub(helper, "supportsDeleteByPath");
                stubPath.returns(false);

                const stubRecursive = sinon.stub(helper, "supportsDeleteByPathRecursive");
                stubRecursive.returns(false);

                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--path', 'red', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function () {
                        // Stubs may not have been called if artifact type errored out before calling them
                    })
                    .catch (function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed methods.
                        stubPath.restore();
                        stubRecursive.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail if delete by path but not recursive delete by path is supported", function (done) {

                // No op if it doesn't even support deletes by path
                if (!helper.supportsDeleteByPath()) {
                    done();
                    return;
                }

                const stubPath = sinon.stub(helper, "supportsDeleteByPath");
                stubPath.returns(true);

                const stubRecursive = sinon.stub(helper, "supportsDeleteByPathRecursive");
                stubRecursive.returns(false);

                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--path', 'red', '--recursive', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // The stubs should have been called and the expected error should have been returned.
                        expect(stubPath).to.have.been.calledOnce;
                        expect(stubRecursive).to.have.been.calledOnce;
                        expect(err.message).to.contain('--recursive option is not supported');
                    })
                    .catch (function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed methods.
                        stubPath.restore();
                        stubRecursive.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail if initialization fails", function (done) {
                const INIT_ERROR = "API initialization failed, as expected by unit test.";
                const stub = sinon.stub(ToolsApi, "getInitializationErrors");
                stub.returns([new Error(INIT_ERROR)]);

                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--path', 'red', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        if (helper.supportsDeleteBypath) {
                            // The stub should have been called and the expected error should have been returned.
                            expect(stub).to.have.been.calledOnce;
                            expect(err.message).to.contain(INIT_ERROR);
                        }
                    })
                    .catch (function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed method.
                        stub.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test fail dir param not a directory", function (done) {
                const stub = sinon.stub(fs, "mkdirSync");
                stub.throws("BAD DIRECTORY");

                // Execute the command to list the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--dir', UnitTest.CLI_PATH + 'package.json'])
                    .then(function (/*msg*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        try {
                            // The stub should only have been called once, and the expected message should be returned.
                            expect(stub).to.not.have.been.called;
                            expect(err.message).to.contain("ENOTDIR");
                            expect(err.message).to.contain("package.json");
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        stub.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testDeleteAll (helper, switches, itemName1) {
        describe("Deleting all items", function () {
            it("should succeed if no matching artifacts", function(done) {
                const stubGet = sinon.stub(helper, "getRemoteItems");
                stubGet.resolves([]);

                const renditionsHelper = ToolsApi.getRenditionsHelper();
                const stubRenditions = sinon.stub(renditionsHelper, "getRemoteItems");
                stubRenditions.resolves([]);

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--all', '-q', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function (msg) {
                        expect(msg).to.contain('There were no artifacts to be deleted.');
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubGet.restore();
                        stubRenditions.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should not delete for a base tier", function(done) {
                if (switches !== "-l" && switches !== "-m" && switches !== "--pages" && switches !== "--sites") {
                    return done();
                }

                // Create a stub to return a value for the "tier" key.
                const originalGetProperty = options.getProperty.bind(options);
                const stubGet = sinon.stub(options, "getProperty", function (context, key) {
                    if (key === "tier") {
                        return "Base";
                    } else {
                        return originalGetProperty(context, key);
                    }
                });

                const stub = sinon.stub(helper, "getRemoteItems");
                stub.resolves([{"path": itemName1, "id": UnitTest.DUMMY_ID, "name": itemName1}]);

                const renditionsHelper = ToolsApi.getRenditionsHelper();
                const stubRenditions = sinon.stub(renditionsHelper, "getRemoteItems");
                stubRenditions.resolves([]);

                const stubCanDelete = sinon.stub(helper, "canDeleteItem");
                stubCanDelete.returns(true);

                const stubDelete = sinon.stub(helper, "deleteRemoteItem");
                stubDelete.resolves(itemName1);

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--all', '-v', '-q', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function (msg) {
                        // The stubs should not have been called, and the expected message should have been returned.
                        if (switches === "--sites") {
                            // For deleting all sites, the syub is called when initializing the site list.
                            expect(stub).to.have.been.calledOnce;
                        } else {
                            expect(stub).to.not.have.been.called;
                        }
                        expect(stubCanDelete).to.not.have.been.called;
                        expect(stubDelete).to.not.have.been.called;
                        expect(msg).to.contain("no artifacts");
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubGet.restore();
                        stub.restore();
                        stubRenditions.restore();
                        stubCanDelete.restore();
                        stubDelete.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed for a single artifact", function(done) {
                const stubGet = sinon.stub(helper, "getRemoteItems");
                stubGet.resolves([{"hierarchicalPath": "/" + itemName1, "path": "/" + itemName1, "id": UnitTest.DUMMY_ID, "name": itemName1}]);

                const renditionsHelper = ToolsApi.getRenditionsHelper();
                const stubRenditions = sinon.stub(renditionsHelper, "getRemoteItems");
                stubRenditions.resolves([]);

                const stubRemove = sinon.stub(renditionsHelper, "removeAllHashes");

                const stubCanDelete = sinon.stub(helper, "canDeleteItem");
                stubCanDelete.returns(true);

                const stubDelete = sinon.stub(helper, "deleteRemoteItem");
                stubDelete.resolves(itemName1);

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--all', '-v', '-q', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function (msg) {
                        if (switches === "--pages") {
                            // The stub should only have been called twice (once for each site), and the expected message should have been returned.
                            expect(stubDelete).to.have.been.calledTwice;
                            expect(msg).to.contain('Deleted 2 artifacts');
                        } else {
                            // The stub should only have been called once, and the expected message should have been returned.
                            expect(stubDelete).to.have.been.calledOnce;
                            expect(msg).to.contain('Deleted 1 artifact');
                        }

                        // There are no renditions returned from getRemoteItems, so expect that the hashes were removed.
                        expect(stubRemove).to.have.been.calledOnce;
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubGet.restore();
                        stubRenditions.restore();
                        stubRemove.restore();
                        stubCanDelete.restore();
                        stubDelete.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when single delete fails", function(done) {
                const stubSearch = sinon.stub(helper, "getRemoteItems");
                stubSearch.resolves([{"hierarchicalPath": "/" + itemName1, "path": "/" + itemName1, "id": UnitTest.DUMMY_ID, "name": itemName1}]);

                const renditionsHelper = ToolsApi.getRenditionsHelper();
                const stubRenditions = sinon.stub(renditionsHelper, "getRemoteItems");
                stubRenditions.resolves([{"id": "someRendition"}]);

                const stubRemove = sinon.stub(renditionsHelper, "removeAllHashes");

                const stubCanDelete = sinon.stub(helper, "canDeleteItem");
                stubCanDelete.returns(true);

                const DELETE_ERROR = "Delete failure expected by unit test.";
                const stubDelete = sinon.stub(helper, "deleteRemoteItem");
                stubDelete.rejects(DELETE_ERROR);

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--all', '-q', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        if (switches === "--pages") {
                            expect(stubSearch).to.have.been.calledTwice;
                            expect(stubDelete).to.have.been.calledTwice;
                            expect(err.message).to.contain('Encountered 2 errors while deleting artifacts.');
                        } else if (switches === "--sites") {
                            expect(stubSearch).to.have.been.calledTwice;
                            expect(stubDelete).to.have.been.calledOnce;
                            expect(err.message).to.contain('Encountered 1 error while deleting artifacts.');
                        } else {
                            expect(stubSearch).to.have.been.calledOnce;
                            expect(stubDelete).to.have.been.calledOnce;
                            expect(err.message).to.contain('Encountered 1 error while deleting artifacts.');
                        }

                        // There were renditions returned from getRemoteItems, so expect that the hashes were not removed.
                        expect(stubRemove).to.not.have.been.called;
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubSearch.restore();
                        stubRenditions.restore();
                        stubRemove.restore();
                        stubCanDelete.restore();
                        stubDelete.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when some deletes fail - quiet", function(done) {
                const stubSearch = sinon.stub(helper, "getRemoteItems");
                stubSearch.resolves([{
                        "hierarchicalPath": "/" + itemName1,
                        "path": itemName1,
                        "name": itemName1,
                        "id": UnitTest.DUMMY_ID
                    },
                        {
                            "hierarchicalPath": "/" + itemName1 + "2",
                            "path": itemName1 + "2",
                            "name": itemName1 + "2",
                            "id": UnitTest.DUMMY_ID + "2"
                        },
                        {
                            "hierarchicalPath": "/" + itemName1 + "3",
                            "path": itemName1 + "3",
                            "name": itemName1 + "3",
                            "id": UnitTest.DUMMY_ID + "3"
                        }]
                );

                const renditionsHelper = ToolsApi.getRenditionsHelper();
                const stubRenditions = sinon.stub(renditionsHelper, "getRemoteItems");
                stubRenditions.resolves([]);

                const stubCanDelete = sinon.stub(helper, "canDeleteItem");
                stubCanDelete.returns(true);

                const DELETE_ERROR = "Delete failure expected by unit test.";
                const stubDelete = sinon.stub(helper, "deleteRemoteItem");
                stubDelete.onFirstCall().rejects(DELETE_ERROR);
                stubDelete.onSecondCall().resolves(itemName1 + "2");
                stubDelete.onThirdCall().rejects(DELETE_ERROR);
                stubDelete.onCall(3).resolves(itemName1);
                stubDelete.onCall(4).rejects(DELETE_ERROR);
                stubDelete.onCall(5).resolves(itemName1 + "3");

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--all', '-q', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api', '-q'])
                    .then(function (msg) {
                        if (switches === "--pages") {
                            // The stub should have been called six times (three for each site), and the expected message should have been returned.
                            expect(stubDelete).to.have.callCount(6);
                            expect(msg).to.contain('complete');
                            expect(msg).to.contain('Deleted 3 artifact');
                            expect(msg).to.contain('Encountered 3 errors');
                            expect(msg).to.contain('wchtools-cli.log');
                        } else {
                            // The stub should have been called three times, and the expected message should have been returned.
                            expect(stubDelete).to.have.callCount(3);
                            expect(msg).to.contain('complete');
                            expect(msg).to.contain('Deleted 1 artifact');
                            expect(msg).to.contain('Encountered 2 errors');
                            expect(msg).to.contain('wchtools-cli.log');
                        }
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubSearch.restore();
                        stubRenditions.restore();
                        stubCanDelete.restore();
                        stubDelete.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when all deletes fail - quiet", function(done) {
                const stubSearch = sinon.stub(helper, "getRemoteItems");
                stubSearch.resolves([{
                        "hierarchicalPath": "/" + itemName1,
                        "path": itemName1,
                        "name": itemName1,
                        "id": UnitTest.DUMMY_ID
                    },
                        {
                            "hierarchicalPath": "/" + itemName1 + "2",
                            "path": itemName1 + "2",
                            "name": itemName1 + "2",
                            "id": UnitTest.DUMMY_ID + "2"
                        },
                        {
                            "hierarchicalPath": "/" + itemName1 + "3",
                            "path": itemName1 + "3",
                            "name": itemName1 + "3",
                            "id": UnitTest.DUMMY_ID + "3"
                        }]
                );

                const renditionsHelper = ToolsApi.getRenditionsHelper();
                const stubRenditions = sinon.stub(renditionsHelper, "getRemoteItems");
                stubRenditions.resolves([]);

                const stubCanDelete = sinon.stub(helper, "canDeleteItem");
                stubCanDelete.returns(true);

                const DELETE_ERROR = "Delete failure expected by unit test.";
                const stubDelete = sinon.stub(helper, "deleteRemoteItem");
                stubDelete.onFirstCall().rejects(DELETE_ERROR);
                stubDelete.onSecondCall().rejects(DELETE_ERROR);
                stubDelete.onThirdCall().rejects(DELETE_ERROR);
                stubDelete.onCall(3).rejects(DELETE_ERROR);
                stubDelete.onCall(4).rejects(DELETE_ERROR);
                stubDelete.onCall(5).rejects(DELETE_ERROR);

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--all', '-q', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        if (switches === "--pages") {
                            // The stub should have been called six times (three for each site), and the expected message should have been returned.
                            expect(stubDelete).to.have.callCount(6);
                            expect(err.message).to.contain('Encountered 6 errors');
                            expect(err.message).to.contain('wchtools-cli.log');
                        } else {
                            // The stub should have been called three times, and the expected message should have been returned.
                            expect(stubDelete).to.have.callCount(3);
                            expect(err.message).to.contain('Encountered 3 errors');
                            expect(err.message).to.contain('wchtools-cli.log');
                        }
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubSearch.restore();
                        stubRenditions.restore();
                        stubCanDelete.restore();
                        stubDelete.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when all deletes fail - quiet, verbose", function(done) {
                const stubSearch = sinon.stub(helper, "getRemoteItems");
                stubSearch.resolves([{
                        "hierarchicalPath": "/" + itemName1,
                        "path": itemName1,
                        "name": itemName1,
                        "id": UnitTest.DUMMY_ID
                    },
                        {
                            "hierarchicalPath": "/" + itemName1 + "2",
                            "path": itemName1 + "2",
                            "name": itemName1 + "2",
                            "id": UnitTest.DUMMY_ID + "2"
                        },
                        {
                            "hierarchicalPath": "/" + itemName1 + "3",
                            "path": itemName1 + "3",
                            "name": itemName1 + "3",
                            "id": UnitTest.DUMMY_ID + "3"
                        }]
                );

                const renditionsHelper = ToolsApi.getRenditionsHelper();
                const stubRenditions = sinon.stub(renditionsHelper, "getRemoteItems");
                stubRenditions.resolves([]);

                const stubCanDelete = sinon.stub(helper, "canDeleteItem");
                stubCanDelete.returns(true);

                const DELETE_ERROR = "Delete failure expected by unit test.";
                const stubDelete = sinon.stub(helper, "deleteRemoteItem");
                stubDelete.onFirstCall().rejects(DELETE_ERROR);
                stubDelete.onSecondCall().rejects(DELETE_ERROR);
                stubDelete.onThirdCall().rejects(DELETE_ERROR);
                stubDelete.onCall(3).rejects(DELETE_ERROR);
                stubDelete.onCall(4).rejects(DELETE_ERROR);
                stubDelete.onCall(5).rejects(DELETE_ERROR);

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--all', '-v', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api', '-q'])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        if (switches === "--pages") {
                            // The stub should have been called six times (three for each site), and the expected message should have been returned.
                            expect(stubDelete).to.have.callCount(6);
                            expect(err.message).to.contain('Encountered 6 errors');
                        } else {
                            // The stub should have been called three times, and the expected message should have been returned.
                            expect(stubDelete).to.have.callCount(3);
                            expect(err.message).to.contain('Encountered 3 errors');
                        }
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubSearch.restore();
                        stubRenditions.restore();
                        stubCanDelete.restore();
                        stubDelete.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed for multiple artifacts - quiet", function(done) {
                const stubSearch = sinon.stub(helper, "getRemoteItems");
                stubSearch.resolves([{
                        "hierarchicalPath": "/" + itemName1,
                        "path": itemName1,
                        "name": itemName1,
                        "id": UnitTest.DUMMY_ID
                    },
                        {
                            "hierarchicalPath": "/" + itemName1 + "2",
                            "path": itemName1 + "2",
                            "name": itemName1 + "2",
                            "id": UnitTest.DUMMY_ID + "2"
                        },
                        {
                            "hierarchicalPath": "/" + itemName1 + "3",
                            "path": itemName1 + "3",
                            "name": itemName1 + "3",
                            "id": UnitTest.DUMMY_ID + "3"
                        }]
                );

                const renditionsHelper = ToolsApi.getRenditionsHelper();
                const stubRenditions = sinon.stub(renditionsHelper, "getRemoteItems");
                stubRenditions.resolves([]);

                const stubPrompt = sinon.stub(prompt, "get");
                stubPrompt.yields(null, {"confirm": "y"});

                const stubCanDelete = sinon.stub(helper, "canDeleteItem");
                stubCanDelete.returns(true);

                const stubDelete = sinon.stub(helper, "deleteRemoteItem");
                stubDelete.onFirstCall().resolves(itemName1);
                stubDelete.onSecondCall().resolves(itemName1 + "2");
                stubDelete.onThirdCall().resolves(itemName1 + "3");
                stubDelete.onCall(3).resolves(itemName1);
                stubDelete.onCall(4).resolves(itemName1 + "2");
                stubDelete.onCall(5).resolves(itemName1 + "3");

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--all', '--verbose', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function (msg) {
                        if (switches === "--pages") {
                            // The stub should have been called six times (three for each site), and the expected message should have been returned.
                            expect(stubDelete).to.have.callCount(6);
                            expect(msg).to.contain('complete');
                            expect(msg).to.contain('Deleted 6 artifacts');
                            expect(msg).to.not.contain('errors');
                            expect(msg).to.not.contain('wchtools-cli.log');
                        } else {
                            // The stub should have been called three times, and the expected message should have been returned.
                            expect(stubDelete).to.have.callCount(3);
                            expect(msg).to.contain('complete');
                            expect(msg).to.contain('Deleted 3 artifacts');
                            expect(msg).to.not.contain('errors');
                            expect(msg).to.not.contain('wchtools-cli.log');
                        }
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's stubbed methods.
                        stubSearch.restore();
                        stubRenditions.restore();
                        stubPrompt.restore();
                        stubCanDelete.restore();
                        stubDelete.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail if the getRemoteItems fails (continue on error)", function (done) {
                const stub = sinon.stub(helper, "getRemoteItems");
                const REMOTE_FAIL = "The getRemoteItems failed, as expected by a unit test.";
                if (switches === "--sites") {
                    stub.onFirstCall().resolves([{
                        "hierarchicalPath": "/" + itemName1,
                        "path": itemName1,
                        "id": UnitTest.DUMMY_ID
                    }]);
                    stub.onSecondCall().rejects(new Error(REMOTE_FAIL));
                } else {
                    stub.rejects(new Error(REMOTE_FAIL));
                }

                const renditionsHelper = ToolsApi.getRenditionsHelper();
                const stubRenditions = sinon.stub(renditionsHelper, "getRemoteItems");
                stubRenditions.resolves([]);

                // Create a stub to return a value for the "continueOnError" key.
                const originalGetProperty = options.getProperty.bind(options);
                const stubGet = sinon.stub(options, "getProperty", function (context, key) {
                    if (key === "continueOnError") {
                        return true;
                    } else {
                        return originalGetProperty(context, key);
                    }
                });

                const stubPrompt = sinon.stub(prompt, "get");
                stubPrompt.yields(null, {"confirm": "y"});

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--all', '--user', 'foo', '--password','password', '--url', 'http://foo.bar/api'])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        if (switches === "--pages") {
                            expect(stub).to.have.been.calledTwice;
                            expect(err.message).to.contain('Encountered 2 errors while deleting artifacts.');
                        } else if (switches === "--sites") {
                            expect(stub).to.have.been.calledTwice;
                            expect(err.message).to.contain('Encountered 1 error while deleting artifacts.');
                        } else {
                            expect(stub).to.have.been.calledOnce;
                            expect(err.message).to.contain('Encountered 1 error while deleting artifacts.');
                        }
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed method.
                        stub.restore();
                        stubRenditions.restore();
                        stubGet.restore();
                        stubPrompt.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail if the getRemoteItems fails (no continue on error)", function (done) {
                const stub = sinon.stub(helper, "getRemoteItems");
                const REMOTE_FAIL = "The getRemoteItems failed, as expected by a unit test.";
                if (switches === "--sites") {
                    stub.onFirstCall().resolves([{
                        "hierarchicalPath": "/" + itemName1,
                        "path": itemName1,
                        "id": UnitTest.DUMMY_ID
                    }]);
                    stub.onSecondCall().rejects(new Error(REMOTE_FAIL));
                } else {
                    stub.rejects(new Error(REMOTE_FAIL));
                }

                const renditionsHelper = ToolsApi.getRenditionsHelper();
                const stubRenditions = sinon.stub(renditionsHelper, "getRemoteItems");
                stubRenditions.resolves([]);

                // Create a stub to return a value for the "continueOnError" key.
                const originalGetProperty = options.getProperty.bind(options);
                const stubGet = sinon.stub(options, "getProperty", function (context, key) {
                    if (key === "continueOnError") {
                        return false;
                    } else {
                        return originalGetProperty(context, key);
                    }
                });

                const stubPrompt = sinon.stub(prompt, "get");
                stubPrompt.yields(null, {"confirm": "y"});

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--all', '--user', 'foo', '--password','password', '--url', 'http://foo.bar/api'])
                    .then(function (msg) {
                        expect(msg).to.contain('There were no artifacts to be deleted.');
                    })
                    .catch(function (err) {
                        if (switches === "--sites") {
                            expect(stub).to.have.been.calledTwice;
                        } else {
                            expect(stub).to.have.been.calledOnce;
                        }
                        expect(err.message).to.contain(REMOTE_FAIL);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed method.
                        stub.restore();
                        stubRenditions.restore();
                        stubGet.restore();
                        stubPrompt.restore();
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should cancel if user says n", function (done) {
                const stub = sinon.stub(helper, "getRemoteItems");
                const REMOTE_FAIL = "The getRemoteItems failed, as expected by a unit test.";
                stub.rejects(new Error(REMOTE_FAIL));

                const renditionsHelper = ToolsApi.getRenditionsHelper();
                const stubRenditions = sinon.stub(renditionsHelper, "getRemoteItems");
                stubRenditions.resolves([]);

                const stubPrompt = sinon.stub(prompt, "get");
                stubPrompt.yields(null, {"confirm": "n"});

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--all', '--user', 'foo', '--password','password', '--url', 'http://foo.bar/api'])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        expect(err.msg).to.contain('Delete all cancelled by user.');
                        expect(stub).to.not.have.been.called;
                    })
                    .finally(function () {
                        // Restore the stubbed method.
                        stub.restore();
                        stubRenditions.restore();
                        stubPrompt.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testDeleteByManifest (helper, switches, itemName1) {
        describe("CLI-unit-delete-manifest-fail", function () {
            it("fails if both --mainfest and --all are specified", function (done) {
                const stub = sinon.stub(manifests, "initializeManifests");
                stub.resolves(true);

                const stubSection = sinon.stub(manifests, "getManifestSection");
                stubSection.returns(undefined);
                stubSection.withArgs(sinon.match.any, helper.getArtifactName()).returns({id1: {name: "foo", path: "bar"}, id2: {name: "ack", path: "nak"}});

                const stubManifestSites = sinon.stub(manifests, "getManifestSites");
                stubManifestSites.returns({id1: {name: "foo", path: "bar"}, id2: {name: "ack", path: "nak"}});

                // Execute the command to delete using a manifest.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '-v', '--all', "--manifest", "foo", '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // Verify that the expected message was returned.
                        expect(err.message).to.contain("manifest cannot be used");
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed methods.
                        stub.restore();
                        stubSection.restore();
                        stubManifestSites.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("fails if initializeManifests fails", function (done) {
                const stub = sinon.stub(manifests, "initializeManifests");
                stub.rejects(new Error("Expected failure"));

                // Execute the command to delete using a manifest.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '-v', "--manifest", "foo", '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // Verify that the expected message was returned.
                        expect(err.message).to.contain("Expected failure");
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed method.
                        stub.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("fails if no items in manifest", function (done) {
                const stubInit = sinon.stub(manifests, "initializeManifests");
                stubInit.resolves(true);

                // No types (so no incompatible types).
                const stubSection = sinon.stub(manifests, "getManifestSection");
                stubSection.returns(undefined);

                const stubManifestSites = sinon.stub(manifests, "getManifestSites");
                stubManifestSites.returns(undefined);

                // Execute the command to delete using a manifest.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '-v', "--manifest", "foo", '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // Verify that the expected message was returned.
                        expect(err.message).to.contain("did not contain any artifacts");
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed methods.
                        stubInit.restore();
                        stubSection.restore();
                        stubManifestSites.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("fails if incompatible types in manifest", function (done) {
                const stubInit = sinon.stub(manifests, "initializeManifests");
                stubInit.resolves(true);

                // Sites is an incompatible type.
                const stubSection = sinon.stub(manifests, "getManifestSection");
                stubSection.returns(undefined);
                stubSection.withArgs(sinon.match.any, "sites").returns({id1: {name: "foo", path: "bar"}, id2: {name: "ack", path: "nak"}});

                // Create a stub to return a value for the "tier" key.
                const originalGetProperty = options.getProperty.bind(options);
                const stubGet = sinon.stub(options, "getProperty", function (context, key) {
                    if (key === "tier") {
                        return "Base";
                    } else {
                        return originalGetProperty(context, key);
                    }
                });

                // Execute the command to delete using a manifest.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '-v', "--manifest", "foo", '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // Verify that the expected message was returned.
                        expect(err.message).to.contain("contains artifact types that are not valid for this tenant");
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed methods.
                        stubInit.restore();
                        stubSection.restore();
                        stubGet.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test delete manifest fails if delete fails and not continue on error", function (done) {
                const stubInit = sinon.stub(manifests, "initializeManifests");
                stubInit.resolves(true);

                const stubSection = sinon.stub(manifests, "getManifestSection");
                stubSection.returns(undefined);
                stubSection.withArgs(sinon.match.any, helper.getArtifactName()).returns({id1: {name: "foo", path: "bar"}, id2: {name: "ack", path: "nak"}});

                const stubManifestSites = sinon.stub(manifests, "getManifestSites");
                stubManifestSites.returns({
                    id1: {id: "id1", name: "foo", status: "ready", contextRoot: "foo"},
                    id2: {id: "id2", name: "bar", status: "draft", contextRoot: "bar"}
                });

                // Create a stub to return a value for the "continueOnError" key.
                const originalGetProperty = options.getProperty.bind(options);
                const stubGet = sinon.stub(options, "getProperty", function (context, key) {
                    if (key === "continueOnError") {
                        return false;
                    } else {
                        return originalGetProperty(context, key);
                    }
                });

                // Stub the helper.deleteManifestItems method to reject with an error.
                const DELETE_ERROR = "Delete failure expected by unit test.";
                const stubDelete = sinon.stub(helper, "deleteManifestItems");
                stubDelete.rejects(DELETE_ERROR);

                // Execute the command to push the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, "--manifest", "foo", '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once, and that the expected message was returned.
                        expect(stubDelete).to.have.been.calledOnce;
                        expect(err.message).to.contain(DELETE_ERROR);
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed method.
                        stubInit.restore();
                        stubSection.restore();
                        stubManifestSites.restore();
                        stubGet.restore();
                        stubDelete.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test delete manifest fails if no artifacts deleted", function (done) {
                const stubInit = sinon.stub(manifests, "initializeManifests");
                stubInit.resolves(true);

                const stubSection = sinon.stub(manifests, "getManifestSection");
                stubSection.returns(undefined);
                stubSection.withArgs(sinon.match.any, helper.getArtifactName()).returns({id1: {name: "foo", path: "bar"}, id2: {name: "ack", path: "nak"}});

                const stubManifestSites = sinon.stub(manifests, "getManifestSites");
                stubManifestSites.returns({
                    id1: {id: "id1", name: "foo", status: "ready", contextRoot: "foo"},
                    id2: {id: "id2", name: "bar", status: "draft", contextRoot: "bar"}
                });

                // Stub the helper.deleteManifestItems method to return a promise that is resolved after emitting events.
                const stubDelete = sinon.stub(helper, "deleteManifestItems", function (context) {
                    // When the stubbed method is called, return a promise that will be resolved asynchronously.
                    const stubDeferred = Q.defer();
                    setTimeout(function () {
                        const emitter = helper.getEventEmitter(context);
                        emitter.emit("deleted-error", {message: "This failure was expected by the unit test"}, {name: "fail-name-1", id: "fail-id-1", path: "fail-path-1"});
                        emitter.emit("deleted-error", {message: "This failure was expected by the unit test"}, {name: "fail-name-2", id: "fail-id-2", path: "fail-path-2"});
                        stubDeferred.resolve();
                    }, 0);
                    return stubDeferred.promise;
                });

                // Execute the command to push the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, "--manifest", "foo", '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once, and that the expected message was returned.
                        if (switches === "--pages") {
                            expect(stubDelete).to.have.been.calledTwice;
                            expect(err.message).to.contain('4 errors');
                        } else {
                            expect(stubDelete).to.have.been.calledOnce;
                            expect(err.message).to.contain('2 errors');
                        }
                        expect(err.message).to.contain('wchtools-cli.log');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed method.
                        stubInit.restore();
                        stubSection.restore();
                        stubManifestSites.restore();
                        stubDelete.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test delete manifest fails if no artifacts deleted, verbose", function (done) {
                const stubInit = sinon.stub(manifests, "initializeManifests");
                stubInit.resolves(true);

                const stubSection = sinon.stub(manifests, "getManifestSection");
                stubSection.returns(undefined);
                stubSection.withArgs(sinon.match.any, helper.getArtifactName()).returns({id1: {name: "foo", path: "bar"}, id2: {name: "ack", path: "nak"}});

                const stubManifestSites = sinon.stub(manifests, "getManifestSites");
                stubManifestSites.returns({
                    id1: {id: "id1", name: "foo", status: "ready", contextRoot: "foo"},
                    id2: {id: "id2", name: "bar", status: "draft", contextRoot: "bar"}
                });

                // Stub the helper.deleteManifestItems method to return a promise that is resolved after emitting events.
                const stubDelete = sinon.stub(helper, "deleteManifestItems", function (context) {
                    // When the stubbed method is called, return a promise that will be resolved asynchronously.
                    const stubDeferred = Q.defer();
                    setTimeout(function () {
                        const emitter = helper.getEventEmitter(context);
                        emitter.emit("deleted-error", {message: "This failure was expected by the unit test"}, {name: "fail-name-1", id: "fail-id-1", path: "fail-path-1"});
                        emitter.emit("deleted-error", {message: "This failure was expected by the unit test"}, {name: "fail-name-2", id: "fail-id-2", path: "fail-path-2"});
                        stubDeferred.resolve();
                    }, 0);
                    return stubDeferred.promise;
                });

                // Execute the command to push the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, "-v", "--manifest", "foo", '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once, and that the expected message was returned.
                        if (switches === "--pages") {
                            expect(stubDelete).to.have.been.calledTwice;
                            expect(err.message).to.contain('4 errors');
                        } else {
                            expect(stubDelete).to.have.been.calledOnce;
                            expect(err.message).to.contain('2 errors');
                        }
                        expect(err.message).to.not.contain('wchtools-cli.log');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed method.
                        stubInit.restore();
                        stubSection.restore();
                        stubManifestSites.restore();
                        stubDelete.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test delete manifest fails if deleting pages and no sites defined in the sites section", function (done) {
                if (switches !== "--pages") {
                    return done();
                }

                const stubInit = sinon.stub(manifests, "initializeManifests");
                stubInit.resolves(true);

                const stubSites = sinon.stub(manifests, "getManifestSites");
                stubSites.returns({});

                const stubSection = sinon.stub(manifests, "getManifestSection", function (context, artifactName, opts) {
                    if (artifactName === "pages") {
                        return {id1: {name: "foo", path: "bar"}, id2: {name: "ack", path: "nak"}};
                    } else {
                        return undefined;
                    }
                });

                // Stub the helper.deleteManifestItems method to return a promise that is resolved after emitting events.
                const spyDelete = sinon.stub(helper, "deleteManifestItems");

                // Execute the command to push the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, "-v", "--manifest", "foo", '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once, and that the expected message was returned.
                        expect(spyDelete).to.not.have.been.called;
                        expect(err.message).to.contain('The specified manifest \'foo\' did not contain any artifacts.');
                        expect(err.message).to.not.contain('wchtools-cli.log');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed method.
                        stubInit.restore();
                        stubSites.restore();
                        stubSection.restore();
                        spyDelete.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });

        describe("CLI-unit-delete-manifest-succeed", function () {
            it("test delete manifest working", function (done) {
                const stubInit = sinon.stub(manifests, "initializeManifests");
                stubInit.resolves(true);

                const stubSection = sinon.stub(manifests, "getManifestSection");
                stubSection.returns(undefined);
                stubSection.withArgs(sinon.match.any, helper.getArtifactName()).returns({id1: {name: "foo", path: "bar"}, id2: {name: "ack", path: "nak"}});

                const stubManifestSites = sinon.stub(manifests, "getManifestSites");
                stubManifestSites.returns({
                    id1: {id: "id1", name: "foo", status: "ready", contextRoot: "foo"},
                    id2: {id: "id2", name: "bar", status: "draft", contextRoot: "bar"}
                });

                // Stub the helper.deleteManifestItems method to return a promise that is resolved after emitting events.
                const stubDelete = sinon.stub(helper, "deleteManifestItems", function (context) {
                    // When the stubbed method is called, return a promise that will be resolved asynchronously.
                    const stubDeferred = Q.defer();
                    setTimeout(function () {
                        const emitter = helper.getEventEmitter(context);
                        emitter.emit("deleted", {name: itemName1, id: undefined, path: itemName1});
                        emitter.emit("deleted", {name: itemName1 + "-2", id: undefined, path: itemName1 + "-2"});
                        emitter.emit("deleted-error", {message: "This failure was expected by the unit test"}, {name: "fail-name-1", id: "fail-id-1", path: "fail-path-1"});
                        emitter.emit("deleted-error", {message: "This failure was expected by the unit test"}, {name: "fail-name-2", id: "fail-id-2", path: "fail-path-2"});
                        stubDeferred.resolve();
                    }, 0);
                    return stubDeferred.promise;
                });

                // Execute the command to push the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, "--manifest", "foo", '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function (msg) {
                        if (switches === "--pages") {
                            // Verify that the stub was called twice, and that the expected message was returned.
                            expect(stubDelete).to.have.been.calledTwice;
                            expect(msg).to.contain('4 artifacts successfully');
                            expect(msg).to.contain('4 errors');
                        } else {
                            // Verify that the stub was called once, and that the expected message was returned.
                            expect(stubDelete).to.have.been.calledOnce;
                            expect(msg).to.contain('2 artifacts successfully');
                            expect(msg).to.contain('2 errors');
                        }
                        expect(msg).to.contain('wchtools-cli.log');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed method.
                        stubInit.restore();
                        stubSection.restore();
                        stubManifestSites.restore();
                        stubDelete.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test delete manifest working, verbose", function (done) {
                const stubInit = sinon.stub(manifests, "initializeManifests");
                stubInit.resolves(true);

                const stubSection = sinon.stub(manifests, "getManifestSection");
                stubSection.returns(undefined);
                stubSection.withArgs(sinon.match.any, helper.getArtifactName()).returns({id1: {name: "foo", path: "bar"}, id2: {name: "ack", path: "nak"}});

                const stubManifestSites = sinon.stub(manifests, "getManifestSites");
                stubManifestSites.returns({
                    id1: {id: "id1", name: "foo", status: "ready", contextRoot: "foo"},
                    id2: {id: "id2", name: "bar", status: "draft", contextRoot: "bar"}
                });

                // Stub the helper.deleteManifestItems method to return a promise that is resolved after emitting events.
                const stubDelete = sinon.stub(helper, "deleteManifestItems", function (context) {
                    // When the stubbed method is called, return a promise that will be resolved asynchronously.
                    const stubDeferred = Q.defer();
                    setTimeout(function () {
                        const emitter = helper.getEventEmitter(context);
                        emitter.emit("deleted", {name: itemName1, id: undefined, path: itemName1});
                        emitter.emit("deleted", {name: itemName1 + "-2", id: undefined, path: itemName1 + "-2"});
                        stubDeferred.resolve();
                    }, 0);
                    return stubDeferred.promise;
                });

                // Execute the command to push the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '-v', "--manifest", "foo", '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function (msg) {
                        if (switches === "--pages") {
                            // Verify that the stub was called twice, and that the expected message was returned.
                            expect(stubDelete).to.have.been.calledTwice;
                            expect(msg).to.contain('4 artifacts successfully');
                        } else {
                            // Verify that the stub was called once, and that the expected message was returned.
                            expect(stubDelete).to.have.been.calledOnce;
                            expect(msg).to.contain('2 artifacts successfully');
                        }
                        expect(msg).to.not.contain('wchtools-cli.log');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed method.
                        stubInit.restore();
                        stubSection.restore();
                        stubManifestSites.restore();
                        stubDelete.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test delete manifest working, preview", function (done) {
                const stubInit = sinon.stub(manifests, "initializeManifests");
                stubInit.resolves(true);

                const stubSection = sinon.stub(manifests, "getManifestSection");
                stubSection.returns(undefined);
                stubSection.withArgs(sinon.match.any, helper.getArtifactName()).returns({id1: {name: "foo", path: "bar"}, id2: {name: "ack", path: "nak"}});

                const stubManifestSites = sinon.stub(manifests, "getManifestSites");
                stubManifestSites.returns({
                    id1: {id: "id1", name: "foo", status: "ready", contextRoot: "foo"},
                    id2: {id: "id2", name: "bar", status: "draft", contextRoot: "bar"}
                });

                // Stub the helper.getManifestItems method to return a promise that is resolved after emitting events.
                const stubGet = sinon.stub(helper, "getManifestItems");
                stubGet.resolves([{name: itemName1, id: undefined, path: itemName1}, {name: itemName1 + "-2", id: undefined, path: itemName1 + "-2"}]);

                // Stub the helper.canDeleteItem method to return false the first time and true otherwise.
                const stubCanDelete = sinon.stub(helper, "canDeleteItem");
                stubCanDelete.returns(true);
                stubCanDelete.onFirstCall().returns(false);

                // Execute the command to push the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--preview', "--manifest", "foo", '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function (msg) {
                        if (switches === "--pages") {
                            // Verify that the stub was called twice, and that the expected message was returned.
                            expect(stubGet).to.have.been.calledTwice;
                        } else {
                            // Verify that the stub was called once, and that the expected message was returned.
                            expect(stubGet).to.have.been.calledOnce;
                        }
                        expect(msg).to.contain('preview complete');
                        expect(msg).to.contain('foo');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed method.
                        stubInit.restore();
                        stubSection.restore();
                        stubManifestSites.restore();
                        stubGet.restore();
                        stubCanDelete.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test delete working when save manifest fails", function (done) {
                const stubInit = sinon.stub(manifests, "initializeManifests");
                stubInit.resolves(true);

                const stubSection = sinon.stub(manifests, "getManifestSection");
                stubSection.returns(undefined);
                stubSection.withArgs(sinon.match.any, helper.getArtifactName()).returns({id1: {name: "foo", path: "bar"}, id2: {name: "ack", path: "nak"}});

                const stubManifestSites = sinon.stub(manifests, "getManifestSites");
                stubManifestSites.returns({
                    id1: {id: "id1", name: "foo", status: "ready", contextRoot: "foo"},
                    id2: {id: "id2", name: "bar", status: "draft", contextRoot: "bar"}
                });

                // Stub the helper.deleteManifestItems method to return a promise that is resolved after emitting events.
                const stubDelete = sinon.stub(helper, "deleteManifestItems", function (context) {
                    // When the stubbed method is called, return a promise that will be resolved asynchronously.
                    const stubDeferred = Q.defer();
                    setTimeout(function () {
                        const emitter = helper.getEventEmitter(context);
                        emitter.emit("deleted", {name: itemName1, id: undefined, path: itemName1});
                        emitter.emit("deleted", {name: itemName1 + "-2", id: undefined, path: itemName1 + "-2"});
                        emitter.emit("deleted-error", {message: "This failure was expected by the unit test"}, {name: "fail-name-1", id: "fail-id-1", path: "fail-path-1"});
                        emitter.emit("deleted-error", {message: "This failure was expected by the unit test"}, {name: "fail-name-2", id: "fail-id-2", path: "fail-path-2"});
                        stubDeferred.resolve();
                    }, 0);
                    return stubDeferred.promise;
                });

                const stubSave = sinon.stub(manifests, "saveManifest");
                stubSave.throws(new Error("Save manifest error expected by unit test."));

                // Execute the command to push the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '-v', "--manifest", "foo", '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function (msg) {
                        if (switches === "--pages") {
                            // Verify that the stub was called twice, and that the expected message was returned.
                            expect(stubDelete).to.have.been.calledTwice;
                            expect(msg).to.contain('4 artifacts successfully');
                            expect(msg).to.contain('4 errors');
                        } else {
                            // Verify that the stub was called once, and that the expected message was returned.
                            expect(stubDelete).to.have.been.calledOnce;
                            expect(msg).to.contain('2 artifacts successfully');
                            expect(msg).to.contain('2 errors');
                        }
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed methods.
                        stubInit.restore();
                        stubSection.restore();
                        stubManifestSites.restore();
                        stubDelete.restore();
                        stubSave.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }
}

module.exports = DeleteUnitTest;
