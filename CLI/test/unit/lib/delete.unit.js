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

// Require the local modules that will be stubbed, mocked, and spied.
const hashes = require(UnitTest.API_PATH + "/lib/utils/hashes.js");

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
        describe("CLI-unit-deleting", function () {
            it("test delete working", function(done) {
                const stub = sinon.stub(helper, "deleteRemoteItem");
                stub.resolves(itemName1);

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api', '--named', itemName1])
                    .then(function (msg) {
                        // The stub should only have been called once, and the expected error should have been returned.
                        expect(stub).to.have.been.calledOnce;
                        expect(msg).to.contain('Deleted');
                   })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's "getRemoteItems" method.
                        stub.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test delete Failing", function (done) {
                const stub = sinon.stub(helper, "deleteRemoteItem");
                const DELETE_FAIL = "The remote web asset could not be deleted.";
                stub.rejects(new Error(DELETE_FAIL));

                // Execute the command to delete the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", switches, '--named', itemName1, '-v','--user', 'foo', '--password','password', '--url', 'http://foo.bar/api'])
                    .then(function (/*msg*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        try {
                            // The stub should only have been called once, and the expected error should have been returned.
                            expect(stub).to.have.been.calledOnce;
                            expect(err.message).to.contain(DELETE_FAIL);
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
/*
        it("test fail bad dir param", function (done) {
            let stub = sinon.stub(fs, "statSync");
            stub.throws("BAD DIRECTORY");
            let error;
            toolsCli.parseArgs(['', UnitTest.COMMAND, command, switches, '--dir', '....'])
                .then(function (msg) {
                    // This is not expected. Pass the error to the "done" function to indicate a failed test.
                    error = new Error("The command should have failed.");
                })
                .catch(function (err) {
                    try {
                        // The stub should only have been called once, and the expected error should have been returned.
                        expect(stub).to.have.been.calledOnce;
                        expect(err.message).to.contain('Invalid directory');
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
*/
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

            it("test Failing no named parameter", function (done) {
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
                            expect(err.message).to.equal('The web asset to be deleted must be specified with the --named argument.');
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
                toolsCli.parseArgs(['', UnitTest.COMMAND, "delete", '--named', 'red', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
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
