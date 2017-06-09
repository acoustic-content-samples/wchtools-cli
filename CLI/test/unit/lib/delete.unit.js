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
const path = require("path");
const rimraf = require("rimraf");
const diff = require("diff");
const sinon = require("sinon");
const toolsCli = require("../../../wchToolsCli");
const mkdirp = require("mkdirp");
const prompt = require("prompt");

class DeleteUnitTest extends UnitTest {
    constructor () {
        super();
    }

    run (helper, switches, itemName1) {
        const self = this;
        describe("Unit tests for delete  " + switches, function () {
            let stubLogin;
            before(function (done) {
                stubLogin = sinon.stub(self.getLoginHelper(), "login");
                stubLogin.resolves("Adam.iem@mailinator.com");

                done();
            });

            after(function (done) {
                stubLogin.restore();
                done();
            });

            // Run each of the tests defined in this class.
            self.testDelete(helper, switches, itemName1);
            self.testDeleteParamFail(helper, switches, itemName1);
        });
    }

    testDelete (helper, switches, itemName1) {
        describe("Deleting web assets", function () {
            it("should fail if no matching artifacts", function(done) {
                const stubSearch = sinon.stub(helper, "searchRemote");
                stubSearch.resolves([]);

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api', '--path', itemName1])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        try {
                            // The stub should only have been called once, and the expected error should have been returned.
                            expect(stubSearch).to.have.been.calledOnce;
                            expect(err.message).to.contain("no artifacts that match");
                        } catch (err) {
                            error = err;
                        }
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
                stubSearch.resolves([{"path": itemName1, "id": UnitTest.DUMMY_ID}]);

                const stubDelete = sinon.stub(helper, "deleteRemoteItem");
                stubDelete.resolves(itemName1);

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api', '--path', itemName1])
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
                stubSearch.resolves([{"path": itemName1, "id": UnitTest.DUMMY_ID}]);

                const DELETE_ERROR = "Delete failure expected by unit test.";
                const stubDelete = sinon.stub(helper, "deleteRemoteItem");
                stubDelete.rejects(DELETE_ERROR);

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api', '--path', itemName1])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        try {
                            // The stubs should only have been called once, and the expected error should have been returned.
                            expect(stubSearch).to.have.been.calledOnce;
                            expect(stubDelete).to.have.been.calledOnce;
                            expect(err.message).to.contain(itemName1);
                            expect(err.message).to.contain(DELETE_ERROR);
                        } catch (err) {
                            error = err;
                        }
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
                stubSearch.resolves([{"path": itemName1, "id": UnitTest.DUMMY_ID}, {"path": itemName1 + "2", "id": UnitTest.DUMMY_ID + "2"}, {"path": itemName1 + "3", "id": UnitTest.DUMMY_ID + "3"}]);

                const spyDelete = sinon.spy(helper, "deleteRemoteItem");

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api', '-P', '--path', itemName1])
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
                stubSearch.resolves([{"path": itemName1, "id": UnitTest.DUMMY_ID}, {"path": itemName1 + "2", "id": UnitTest.DUMMY_ID + "2"}, {"path": itemName1 + "3", "id": UnitTest.DUMMY_ID + "3"}]);

                const DELETE_ERROR = "Delete failure expected by unit test.";
                const stubDelete = sinon.stub(helper, "deleteRemoteItem");
                stubDelete.onFirstCall().resolves(itemName1);
                stubDelete.onSecondCall().rejects(DELETE_ERROR);
                stubDelete.onThirdCall().rejects(DELETE_ERROR);

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api', '-q', '--path', itemName1])
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
                stubSearch.resolves([{"path": itemName1, "id": UnitTest.DUMMY_ID}, {"path": itemName1 + "2", "id": UnitTest.DUMMY_ID + "2"}, {"path": itemName1 + "3", "id": UnitTest.DUMMY_ID + "3"}]);

                const DELETE_ERROR = "Delete failure expected by unit test.";
                const stubDelete = sinon.stub(helper, "deleteRemoteItem");
                stubDelete.onFirstCall().rejects(DELETE_ERROR);
                stubDelete.onSecondCall().rejects(DELETE_ERROR);
                stubDelete.onThirdCall().rejects(DELETE_ERROR);

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api', '-q', '--path', itemName1])
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
                stubSearch.resolves([{"path": itemName1, "id": UnitTest.DUMMY_ID}, {"path": itemName1 + "2", "id": UnitTest.DUMMY_ID + "2"}, {"path": itemName1 + "3", "id": UnitTest.DUMMY_ID + "3"}]);

                const stubDelete = sinon.stub(helper, "deleteRemoteItem");
                stubDelete.onFirstCall().resolves(itemName1);
                stubDelete.onSecondCall().resolves(itemName1 + "2");
                stubDelete.onThirdCall().resolves(itemName1 + "3");

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--verbose', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api', '-q', '--path', itemName1])
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

            it("should succeed for multiple artifacts - prompt", function(done) {
                const stubSearch = sinon.stub(helper, "searchRemote");
                stubSearch.resolves([{"path": itemName1, "id": UnitTest.DUMMY_ID}, {"path": itemName1 + "2", "id": UnitTest.DUMMY_ID + "2"}, {"path": itemName1 + "3", "id": UnitTest.DUMMY_ID + "3"}]);

                const stubPrompt = sinon.stub(prompt, "get");
                stubPrompt.yields(null, {"test": "y", "test2": "y", "test3": "n"});

                const DELETE_ERROR = "Delete failure expected by unit test.";
                const stubDelete = sinon.stub(helper, "deleteRemoteItem");
                stubDelete.onFirstCall().resolves(itemName1);
                stubDelete.onSecondCall().rejects(DELETE_ERROR);

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api', '--path', itemName1])
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

            it("should succeed for none confirmed - prompt", function(done) {
                const stubSearch = sinon.stub(helper, "searchRemote");
                stubSearch.resolves([{"path": itemName1, "id": UnitTest.DUMMY_ID}, {"path": itemName1 + "2", "id": UnitTest.DUMMY_ID + "2"}, {"path": itemName1 + "3", "id": UnitTest.DUMMY_ID + "3"}]);

                const stubPrompt = sinon.stub(prompt, "get");
                stubPrompt.yields(null, {"test": "n", "test2": "n", "test3": "n"});

                const stubDelete = sinon.stub(helper, "deleteRemoteItem");

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api', '--path', itemName1])
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
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--user', 'foo', '--password','password', '--url', 'http://foo.bar/api', '--path', itemName1])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        try {
                            // The stub should only have been called once, and the expected error should have been returned.
                            expect(stub).to.have.been.calledOnce;
                            expect(err.message).to.contain(SEARCH_FAIL);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Restore the helper's "getRemoteItems" method.
                        stub.restore();
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });

        it("test fail bad dir param", function (done) {
            const stub = sinon.stub(fs, "statSync");
            const STAT_ERROR = new Error("BAD DIRECTORY");
            STAT_ERROR.code = "Invalid directory";
            stub.throws(STAT_ERROR);
            let error;
            toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--path', 'foo', '--dir', '....'])
                .then(function (/*msg*/) {
                    // This is not expected. Pass the error to the "done" function to indicate a failed test.
                    error = new Error("The command should have failed.");
                })
                .catch(function (err) {
                    try {
                        // The stub should only have been called once, and the expected error should have been returned.
                        expect(stub).to.have.been.calledOnce;
                        expect(err.message).to.contain(STAT_ERROR.code);
                        expect(err.message).to.contain('....');
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
    }

    testDeleteParamFail (helper, switches, itemName1) {
        describe("CLI-unit-deleting", function () {
            it("test fail extra param", function (done) {
                // Execute the command to list the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--named', itemName1, '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api', 'foo'])
                    .then(function (/*msg*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        try {
                            // The expected error should have been returned.
                            expect(err.message).to.contain('Invalid argument');
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test Failing no path (or named) parameter", function (done) {
                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function (/*msg*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        try {
                            // The expected error should have been returned.
                            expect(err.message).to.contain('The web asset to be deleted must be specified with the');
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test Failing no -w parameter", function (done) {
                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", '--path', 'red', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function (/*msg*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        try {
                            // The expected error should have been returned.
                            expect(err.message).to.contain('Delete currently only supports deleting a web asset');
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
}

module.exports = DeleteUnitTest;
