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
 * Unit tests for the list command.
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

class ListUnitTest extends UnitTest {
    constructor () {
        super();
    }

    run (helper, switches, itemName1, itemName2, badItem) {
        const self = this;
        describe("Unit tests for list  " + switches, function () {
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
            self.testList(helper, switches, itemName1, itemName2, badItem);
            self.testListServer(helper, switches, itemName1, itemName2, badItem);
            self.testListModified(helper, switches, itemName1, itemName2, badItem);
            self.testListAll(helper, switches, itemName1, itemName2, badItem);
            self.testListParamFail(helper, switches, itemName1, itemName2, badItem);
        });
    }

    testList (helper, switches, itemName1, itemName2, badItem) {
        describe("CLI-unit-listing", function () {
            it("test list no mod param working", function (done) {
                const stub = sinon.stub(helper, "listModifiedLocalItemNames");
                stub.resolves([itemName1, itemName2, badItem]);

                // Execute the command to list the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "list", switches, "--dir", "./", "-q", "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function (msg) {
                        // Verify that the stub was called once, and the expected message was returned.
                        expect(stub).to.have.been.calledOnce;
                        expect(msg).to.contain('artifacts listed 3');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's "listModifiedLocalItemNames" method.
                        stub.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testListServer (helper, switches, itemName1, itemName2, badItem) {
        describe("CLI-unit-listing", function () {
            it("test list server working", function (done) {
                const stub = sinon.stub(helper, "listModifiedRemoteItemNames");
                stub.resolves([itemName1, itemName2, badItem]);

                // Execute the command to list the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "list", switches, "--server", "-q", "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function (msg) {
                        // Verify that the stub was called once, and the expected message was returned.
                        expect(stub).to.have.been.calledOnce;
                        expect(msg).to.contain('artifacts listed 3');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's "listModifiedLocalItemNames" method.
                        stub.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testListModified (helper, switches, itemName1, itemName2, badItem) {
        describe("CLI-unit-listing", function () {
            it("test list mod param working", function (done) {
                const stub = sinon.stub(helper, "listModifiedLocalItemNames");
                stub.resolves([itemName1, itemName2, badItem]);
                // Execute the command to list the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "list", switches, "--mod", "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function (msg) {
                        // Verify that the stub was called once, and the expected message was returned.
                        expect(stub).to.have.been.calledOnce;
                        expect(msg).to.contain('artifacts listed 3');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's "listModifiedLocalItemNames" method.
                        stub.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testListAll (helper, switches, itemName1, itemName2, badItem) {
        describe("CLI-unit-listing", function() {
            it("test list all param working", function (done) {
                const stub = sinon.stub(helper, "listLocalItemNames");
                stub.resolves([itemName1, itemName2, badItem]);

                // Execute the command to list the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "list", switches, "--ignore-timestamps", "-q", "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function (msg) {
                        // Verify that the stub was called once, and that the expected message was returned.
                        expect(stub).to.have.been.calledOnce;
                        expect(msg).to.contain('artifacts listed 3');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's "listLocalItemNames" method.
                        stub.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testListParamFail (helper, switches, itemName1, itemName2, badItem) {
        describe("CLI-unit-listing", function() {
            const command = 'list';
            it("test fail extra param", function (done) {
                // Execute the command to list the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, command, switches, "foo", "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function (/*msg*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the expected error message was returned.
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

            it("test fail bad dir param", function (done) {
                const stub = sinon.stub(fs, "statSync");
                stub.throws("BAD DIRECTORY");

                // Execute the command to list the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, command, switches, "--dir", "....", "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function (/*msg*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        try {
                            // The stub should only have been called once, and the expected error should be returned.
                            expect(stub).to.have.been.calledOnce;
                            expect(err.message).to.contain('....');
                            expect(err.message).to.contain('does not exist');
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

            it("test fail path and not asset param", function (done) {
                // Execute the command to list the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, command, "-c", "--path", "./", "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function (/*msg*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the expected error message was returned.
                            expect(err.message).to.contain('Invalid options, path can only be used for web assets.');
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

module.exports = ListUnitTest;
