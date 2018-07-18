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
const prompt = require("prompt");
const Q = require("q");
const sinon = require("sinon");
const ToolsApi = require("wchtools-api");
const hashes = ToolsApi.getHashes();
const toolsCli = require("../../../wchToolsCli");
const BaseCommand = require("../../../lib/baseCommand");
const mkdirp = require("mkdirp");
const manifests = ToolsApi.getManifests();

const DRAFT_OPTION = false;

// TODO When pulling draft sites is supported, the code excluded by this flag should be removed.
const DRAFT_SITES = false;

// Require the local modules that will be stubbed, mocked, and spied.
const options = require("wchtools-api").getOptions();

let stubRemoteSites;
let stubLocalSites;

class ListUnitTest extends UnitTest {
    constructor () {
        super();
    }

    static addRemoteSitesStub () {
        const sitesHelper = ToolsApi.getSitesHelper();
        stubRemoteSites = sinon.stub(sitesHelper._restApi, "getItems");
        stubRemoteSites.resolves([{id: "foo", siteStatus: "ready"}, {id: "bar", siteStatus: "draft"}]);
    }

    static restoreRemoteSitesStub () {
        stubRemoteSites.restore();
    }

    static addLocalSitesStub () {
        const sitesHelper = ToolsApi.getSitesHelper();
        stubLocalSites = sinon.stub(sitesHelper._fsApi, "getItems");
        stubLocalSites.resolves([{id: "foo", siteStatus: "ready"}, {id: "bar", siteStatus: "draft"}]);
    }

    static restoreLocalSitesStub () {
        stubLocalSites.restore();
    }

    run (helper, switches, itemName1, itemName2, badItem) {
        const self = this;
        describe("Unit tests for list  " + switches, function () {
            let stubLogin;
            before(function (done) {
                stubLogin = sinon.stub(self.getLoginHelper(), "login");
                stubLogin.resolves("Adam.iem@mailinator.com");

                ListUnitTest.addRemoteSitesStub();
                ListUnitTest.addLocalSitesStub();

                done();
            });

            after(function (done) {
                stubLogin.restore();
                ListUnitTest.restoreRemoteSitesStub();
                ListUnitTest.restoreLocalSitesStub();
                done();
            });

            // Run each of the tests defined in this class.
            self.testList(helper, switches, itemName1, itemName2, badItem);
            self.testListServer(helper, switches, itemName1, itemName2, badItem);
            self.testListModified(helper, switches, itemName1, itemName2, badItem);
            self.testListAll(helper, switches, itemName1, itemName2, badItem);
            self.testListParamFail(helper, switches);
        });
    }

    testList (helper, switches, itemName1, itemName2, badItem) {
        describe("CLI-unit-listing", function () {
            it("test list no options working", function (done) {
                let error;

                // Create an fs.existsSync stub to return false, in case any spurious virtual folders still exist.
                const stubExists = sinon.stub(fs, "existsSync");
                stubExists.returns(false);

                // Create a stub to return prompt values.
                const stubPrompt = sinon.stub(prompt, "get");
                stubPrompt.yields(null, {"url": "http://www.ibm.com/foo/api"});

                // Execute the command to list the default local items.
                toolsCli.parseArgs(['', UnitTest.COMMAND, "list"])
                    .then(function (msg) {
                        // Verify that the expected message was returned.
                        expect(msg).to.contain('artifacts listed');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the original methods.
                        stubExists.restore();
                        stubPrompt.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test list debug option working", function (done) {
                let error;

                // Create an fs.existsSync stub to return false, in case any spurious virtual folders still exist.
                const stubExists = sinon.stub(fs, "existsSync");
                stubExists.returns(false);

                // Create a stub to return prompt values.
                const stubPrompt = sinon.stub(prompt, "get");
                stubPrompt.yields(null, {"url": "http://www.ibm.com/foo/api"});

                // Execute the command to list the default local items.
                toolsCli.parseArgs(['', UnitTest.COMMAND, "list", "--debug"])
                    .then(function (msg) {
                        // Verify that the expected message was returned.
                        expect(msg).to.contain('artifacts listed');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Clear the debug flag so that it doesn't affect subsequent tests.
                        toolsCli.program.debug = false;

                        // Restore the original methods.
                        stubExists.restore();
                        stubPrompt.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test list no mod param working", function (done) {
                const stub = sinon.stub(helper, "listModifiedLocalItemNames");
                stub.resolves([{name: itemName1, id: "foo", path: itemName1}, {name: itemName2, id: "bar", path: itemName2}, {name: badItem, id: undefined, path: badItem}]);

                // Execute the command to list the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "list", switches, "--dir", "./", "-q", "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function (msg) {
                        if (DRAFT_SITES && switches === "--pages") {
                            // Verify that the stub was called twice (once for each site), and the expected message was returned.
                            expect(stub).to.have.been.calledTwice;
                            expect(msg).to.contain('artifacts listed 6');
                        } else {
                            // Verify that the stub was called once, and the expected message was returned.
                            expect(stub).to.have.been.calledOnce;
                            expect(msg).to.contain('artifacts listed 3');
                        }
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

            it("test list when base URL not defined", function (done) {
                const stubList = sinon.stub(helper, "listModifiedLocalItemNames");
                stubList.resolves([{name: itemName1, id: "foo", path: itemName1}, {name: itemName2, id: "bar", path: itemName2}, {name: undefined, id: badItem, path: badItem}]);

                // Create a stub to return a value for the "x-ibm-dx-tenant-base-url" key.
                const originalGetRelevantOption = options.getRelevantOption.bind(options);
                const stubGet = sinon.stub(options, "getRelevantOption", function (context, opts, key) {
                    if (key === "x-ibm-dx-tenant-base-url") {
                        return null;
                    } else {
                        return originalGetRelevantOption(context, opts, key);
                    }
                });

                // Execute the command to list the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "list", switches, "--url", "http://foo.bar/api"])
                    .then(function (msg) {
                        if (DRAFT_SITES && switches === "--pages") {
                            // Verify that the stub was called twice (once for each site), and the expected message was returned.
                            expect(stubList).to.have.been.calledTwice;
                            expect(msg).to.contain('artifacts listed 6');
                        } else {
                            // Verify that the stub was called once, and the expected message was returned.
                            expect(stubList).to.have.been.calledOnce;
                            expect(msg).to.contain('artifacts listed 3');
                        }
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed method.
                        stubList.restore();
                        stubGet.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test list both types of assets", function (done) {
                if (switches !== "-a" ) {
                    return done();
                }

                const stub = sinon.stub(helper, "listModifiedLocalItemNames");
                stub.resolves([{name: itemName1, id: "foo", path: itemName1}, {name: itemName2, id: "bar", path: itemName2}, {name: badItem, id: badItem, path: undefined}]);

                // Execute the command to list the local assets.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "list", "-aw", "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
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

            it("test list failure", function (done) {
                if (switches !== "-a" ) {
                    return done();
                }

                const LIST_ERROR = "Error listing assets, expected by unit test.";
                const stub = sinon.stub(ToolsApi, "getAssetsHelper");
                stub.throws(new Error(LIST_ERROR));

                // Execute the command to list the local assets.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "list", switches, "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once, and the expected message was returned.
                        expect(err.message).to.contain(LIST_ERROR);
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

            it("test list failure quiet", function (done) {
                if (switches !== "-a" ) {
                    return done();
                }

                const LIST_ERROR = "Error listing assets, expected by unit test.";
                const stub = sinon.stub(ToolsApi, "getAssetsHelper");
                stub.throws(new Error(LIST_ERROR));

                // Execute the command to list the local assets.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "list", switches, "--quiet", "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once, and the expected message was returned.
                        expect(err.message).to.contain(LIST_ERROR);
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

            it("fails if initializeManifests fails", function (done) {
                const stub = sinon.stub(manifests, "initializeManifests");
                stub.rejects(new Error("Expected failure"));

                // Execute the command to push using a manifest.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "list", switches, '--write-manifest', 'foo', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
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
        });
    }

    testListServer (helper, switches, itemName1, itemName2, badItem) {
        describe("CLI-unit-listing", function () {
            it("test list server error", function (done) {
                // Create a stub to return a value for the "username" key.
                const originalGetProperty = options.getProperty.bind(options);
                const stubGet = sinon.stub(options, "getProperty", function (context, key) {
                    if (key === "username") {
                        return "foo";
                    } else {
                        return originalGetProperty(context, key);
                    }
                });

                // Set the password for this test only.
                const originalPassword = process.env.WCHTOOLS_PASSWORD;
                process.env.WCHTOOLS_PASSWORD = "password";

                const stubList = sinon.stub(helper, "listModifiedRemoteItemNames");
                const LIST_ERROR = "Error listing artifacts - expected by unit test.";
                stubList.rejects(LIST_ERROR);

                // Execute the command to list the items on the server.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "list", switches, "--server", "--del", "--url", "http://foo.bar/api"])
                    .then(function (msg) {
                        if (DRAFT_SITES && switches === "--pages") {
                            // Verify that the stub was called twice (once for each site), and the expected message was returned.
                            expect(stubList).to.have.been.calledTwice;
                        } else {
                            // Verify that the stub was called once, and the expected message was returned.
                            expect(stubList).to.have.been.calledOnce;
                        }
                        expect(msg).to.contain('artifacts listed 0');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the original methods and values.
                        stubGet.restore();
                        stubList.restore();
                        process.env.WCHTOOLS_PASSWORD = originalPassword;

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test list server quiet error", function (done) {
                // Create a stub to return a value for the "username" key.
                const originalGetProperty = options.getProperty.bind(options);
                const stubGet = sinon.stub(options, "getProperty", function (context, key) {
                    if (key === "username") {
                        return "foo";
                    } else {
                        return originalGetProperty(context, key);
                    }
                });

                // Set the password for this test only.
                const originalPassword = process.env.WCHTOOLS_PASSWORD;
                process.env.WCHTOOLS_PASSWORD = "password";

                const LIST_ERROR = "Error listing artifacts - expected by unit test.";
                const stubList = sinon.stub(helper, "listModifiedRemoteItemNames", function () {
                    const deferred = Q.defer();
                    deferred.reject(LIST_ERROR);  // Reject with a string instead of an error.
                    return deferred.promise;
                });

                // Execute the command to list the items on the server.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "list", switches, "--quiet", "--server", "--url", "http://foo.bar/api"])
                    .then(function (msg) {
                        if (DRAFT_SITES && switches === "--pages") {
                            // Verify that the stub was called twice (once for each site), and the expected message was returned.
                            expect(stubList).to.have.been.calledTwice;
                        } else {
                            // Verify that the stub was called once, and the expected message was returned.
                            expect(stubList).to.have.been.calledOnce;
                        }
                        expect(msg).to.contain('artifacts listed 0');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the original methods and values.
                        stubGet.restore();
                        stubList.restore();
                        process.env.WCHTOOLS_PASSWORD = originalPassword;

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test list server working with username and password defined", function (done) {
                // Create a stub to return a value for the "username" key.
                const originalGetProperty = options.getProperty.bind(options);
                const stubGet = sinon.stub(options, "getProperty", function (context, key) {
                    if (key === "username") {
                        return "foo";
                    } else {
                        return originalGetProperty(context, key);
                    }
                });

                // Set the password for this test only.
                const originalPassword = process.env.WCHTOOLS_PASSWORD;
                process.env.WCHTOOLS_PASSWORD = "password";

                const stubList = sinon.stub(helper, "listModifiedRemoteItemNames");
                stubList.resolves([{id:"foo", name: itemName1}, {id:"ack", name: itemName2}, {id:undefined, name: badItem}]);

                // Execute the command to list the items on the server.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "list", switches, "--server", "-q", "--url", "http://foo.bar/api"])
                    .then(function (msg) {
                        if (DRAFT_SITES && switches === "--pages") {
                            // Verify that the stub was called twice (once for each site), and the expected message was returned.
                            expect(stubList).to.have.been.calledTwice;
                            expect(msg).to.contain('artifacts listed 6');
                        } else {
                            // Verify that the stub was called once, and the expected message was returned.
                            expect(stubList).to.have.been.calledOnce;
                            expect(msg).to.contain('artifacts listed 3');
                        }
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the original methods and values.
                        stubGet.restore();
                        stubList.restore();
                        process.env.WCHTOOLS_PASSWORD = originalPassword;

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test list server working when save manifest fails", function (done) {
                // Create a stub to return a value for the "username" key.
                const originalGetProperty = options.getProperty.bind(options);
                const stubGet = sinon.stub(options, "getProperty", function (context, key) {
                    if (key === "username") {
                        return "foo";
                    } else {
                        return originalGetProperty(context, key);
                    }
                });

                // Set the password for this test only.
                const originalPassword = process.env.WCHTOOLS_PASSWORD;
                process.env.WCHTOOLS_PASSWORD = "password";

                const stubList = sinon.stub(helper, "listRemoteItemNames");
                stubList.resolves([itemName1, itemName2, badItem]);

                const stubInit = sinon.stub(manifests, "initializeManifests");
                stubInit.resolves(true);

                const stubSave = sinon.stub(manifests, "saveManifest");
                stubSave.throws(new Error("Save manifest error expected by unit test."));

                // Execute the command to list the items on the server.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "list", switches, "--server", "-q", "--write-manifest", "foo", "--url", "http://foo.bar/api"])
                    .then(function (msg) {
                        if (DRAFT_SITES && switches === "--pages") {
                            // Verify that the list stub was called twice (once for each site), and that the expected message was returned.
                            expect(stubList).to.have.been.calledTwice;
                            expect(msg).to.contain('artifacts listed 6');
                        } else {
                            // Verify that the list stub was called once, and the expected message was returned.
                            expect(stubList).to.have.been.calledOnce;
                            expect(msg).to.contain('artifacts listed 3');
                        }

                        // Verify that the manifest was only saved once, after all lists are completed.
                        expect(stubSave).to.have.been.calledOnce;
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the original methods and values.
                        stubGet.restore();
                        stubList.restore();
                        stubInit.restore();
                        stubSave.restore();
                        process.env.WCHTOOLS_PASSWORD = originalPassword;

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test list server working with no username and password defined", function (done) {
                // Create a stub to return a value for the "username" key.
                const originalGetProperty = options.getProperty.bind(options);
                const stubGet = sinon.stub(options, "getProperty", function (context, key) {
                    if (key === "username") {
                        return undefined;
                    } else {
                        return originalGetProperty(context, key);
                    }
                });

                // Set the password for this test only.
                const originalPassword = process.env.WCHTOOLS_PASSWORD;
                process.env.WCHTOOLS_PASSWORD = "";

                const stubList = sinon.stub(helper, "listModifiedRemoteItemNames");
                stubList.resolves([{name: itemName1, id: "foo", path: itemName1}, {name: itemName2, id: "bar", path: itemName2}, {name: badItem, id: undefined, path: badItem}]);

                // Create a stub to return prompt values.
                const stubPrompt = sinon.stub(prompt, "get");
                stubPrompt.yields(null, {"username": "foo", "password": "password"});

                // Execute the command to list the items on the server.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "list", switches, "--server", "-q", "--url", "http://foo.bar/api"])
                    .then(function (msg) {
                        if (DRAFT_SITES && switches === "--pages") {
                            // Verify that the stub was called twice (once for each site), and the expected message was returned.
                            expect(stubList).to.have.been.calledTwice;
                            expect(msg).to.contain('artifacts listed 6');
                        } else {
                            // Verify that the stub was called once, and the expected message was returned.
                            expect(stubList).to.have.been.calledOnce;
                            expect(msg).to.contain('artifacts listed 3');
                        }
                        expect(stubPrompt).to.have.been.calledOnce;
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the original methods and values.
                        stubGet.restore();
                        stubList.restore();
                        stubPrompt.restore();
                        process.env.WCHTOOLS_PASSWORD = originalPassword;

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test list server working with password defined but no username", function (done) {
                // Create a stub to return a value for the "username" key.
                const originalGetProperty = options.getProperty.bind(options);
                const stubGet = sinon.stub(options, "getProperty", function (context, key) {
                    if (key === "username") {
                        return undefined;
                    } else {
                        return originalGetProperty(context, key);
                    }
                });

                // Set the password for this test only.
                const originalPassword = process.env.WCHTOOLS_PASSWORD;
                process.env.WCHTOOLS_PASSWORD = "password";

                const stubList = sinon.stub(helper, "listModifiedRemoteItemNames");
                stubList.resolves([{name: itemName1, id: "ack", path: itemName1}, {name: itemName2, id: "nack", path: itemName2}, {name: badItem, id: undefined, path: badItem}]);

                // Create a stub to return prompt values.
                const stubPrompt = sinon.stub(prompt, "get");
                stubPrompt.yields(null, {"username": "foo"});

                // Execute the command to list the items on the server.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "list", switches, "--server", "-q", "--url", "http://foo.bar/api"])
                    .then(function (msg) {
                        if (DRAFT_SITES && switches === "--pages") {
                            // Verify that the stub was called twice (once for each site), and the expected message was returned.
                            expect(stubList).to.have.been.calledTwice;
                            expect(msg).to.contain('artifacts listed 6');
                        } else {
                            // Verify that the stub was called once, and the expected message was returned.
                            expect(stubList).to.have.been.calledOnce;
                            expect(msg).to.contain('artifacts listed 3');
                        }
                        expect(stubPrompt).to.have.been.calledOnce;
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the original methods and values.
                        stubGet.restore();
                        stubList.restore();
                        stubPrompt.restore();
                        process.env.WCHTOOLS_PASSWORD = originalPassword;

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test list server working with username defined but no password", function (done) {
                // Create a stub to return a value for the "username" key.
                const originalGetProperty = options.getProperty.bind(options);
                const stubGet = sinon.stub(options, "getProperty", function (context, key) {
                    if (key === "username") {
                        return "foo";
                    } else {
                        return originalGetProperty(context, key);
                    }
                });

                // Set the password for this test only.
                const originalPassword = process.env.WCHTOOLS_PASSWORD;
                process.env.WCHTOOLS_PASSWORD = "";

                const stubList = sinon.stub(helper, "listModifiedRemoteItemNames");
                stubList.resolves([{name: itemName1, id: "foo", path: itemName1}, {name: itemName2, id: "bar", path: itemName2}, {name: badItem, id: undefined, path: badItem}]);

                // Create a stub to return prompt values.
                const stubPrompt = sinon.stub(prompt, "get");
                stubPrompt.yields(null, {"password": "password"});

                // Execute the command to list the items on the server.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "list", switches, "--server", "-q", "--url", "http://foo.bar/api"])
                    .then(function (msg) {
                        if (DRAFT_SITES && switches === "--pages") {
                            // Verify that the stub was called twice (once for each site), and the expected message was returned.
                            expect(stubList).to.have.been.calledTwice;
                            expect(msg).to.contain('artifacts listed 6');
                        } else {
                            // Verify that the stub was called once, and the expected message was returned.
                            expect(stubList).to.have.been.calledOnce;
                            expect(msg).to.contain('artifacts listed 3');
                        }
                        expect(stubPrompt).to.have.been.calledOnce;
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the original methods and values.
                        stubGet.restore();
                        stubList.restore();
                        stubPrompt.restore();
                        process.env.WCHTOOLS_PASSWORD = originalPassword;

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test list server working with prompt error", function (done) {
                // Create a stub to return a value for the "username" key.
                const originalGetProperty = options.getProperty.bind(options);
                const stubGet = sinon.stub(options, "getProperty", function (context, key) {
                    if (key === "username") {
                        return "";
                    } else {
                        return originalGetProperty(context, key);
                    }
                });

                // Set the password for this test only.
                const originalPassword = process.env.WCHTOOLS_PASSWORD;
                process.env.WCHTOOLS_PASSWORD = "";

                const stubList = sinon.stub(helper, "listModifiedRemoteItemNames");
                stubList.resolves([{name: itemName1, id: "foo", path: itemName1}, {name: itemName2, id: "bar", path: itemName2}, {name: badItem, id: undefined, path: badItem}]);

                // Create a stub to return prompt values.
                const stubPrompt = sinon.stub(prompt, "get");
                const PROMPT_ERROR = "Error prompting for user name and password, expected by unit test.";
                stubPrompt.yields(new Error(PROMPT_ERROR), {});

                // Create a spy to make sure the console warn function is called.
                const spyConsole = sinon.spy(console, "warn");

                // Execute the command to list the items on the server.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "list", switches, "--server", "-q", "--url", "http://foo.bar/api"])
                    .then(function (msg) {
                        if (DRAFT_SITES && switches === "--pages") {
                            // Verify that the stub was called twice (once for each site), and the expected message was returned.
                            expect(stubList).to.have.been.calledTwice;
                            expect(msg).to.contain('artifacts listed 6');
                        } else {
                            // Verify that the stub was called once, and the expected message was returned.
                            expect(stubList).to.have.been.calledOnce;
                            expect(msg).to.contain('artifacts listed 3');
                        }
                        expect(stubPrompt).to.have.been.calledOnce;
                        expect(spyConsole).to.have.been.calledOnce;
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the original methods and values.
                        stubGet.restore();
                        stubList.restore();
                        stubPrompt.restore();
                        spyConsole.restore();
                        process.env.WCHTOOLS_PASSWORD = originalPassword;

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testListModified (helper, switches, itemName1, itemName2, badItem) {
        describe("CLI-unit-listing", function () {
            it("test list local modified working (all sites)", function (done) {
                const stubList = sinon.stub(helper._fsApi, "listNames");
                stubList.resolves([{name: itemName1, id: "foo", path: itemName1}, {name: itemName2, id: "bar", path: itemName2}, {name: badItem, id: "ack", path: badItem}]);

                const stubHashes = sinon.stub(hashes, "isLocalModified");
                stubHashes.returns(true);

                // Execute the command to list the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "list", switches, "--mod", "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function (msg) {
                        if (DRAFT_SITES && switches === "--pages") {
                            // Verify that the stub was called twice (once for each site), and the expected message was returned.
                            expect(stubList).to.have.been.calledTwice;
                            expect(msg).to.contain('artifacts listed 6');
                        } else {
                            // Verify that the stubs were called as expected, and the expected message was returned.
                            expect(stubList).to.have.been.calledOnce;
                            if (switches.includes("--sites")) {
                                // Sites filtered to those in context.siteList.
                                if (DRAFT_SITES) {
                                    expect(msg).to.contain('artifacts listed 2');
                                } else {
                                    expect(msg).to.contain('artifacts listed 1');
                                }
                            } else {
                                expect(msg).to.contain('artifacts listed 3');
                            }
                        }
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubs.
                        stubList.restore();
                        stubHashes.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test list local modified working (ready sites)", function (done) {
                const stubList = sinon.stub(helper._fsApi, "listNames");
                stubList.resolves([{name: itemName1, id: "foo", path: itemName1}, {name: itemName2, id: "bar", path: itemName2}, {name: badItem, id: "ack", path: badItem}]);

                const stubHashes = sinon.stub(hashes, "isLocalModified");
                stubHashes.returns(true);

                // Execute the command to list the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "list", switches, "--ready", "--mod", "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function (msg) {
                        // Verify that the stubs were called as expected, and the expected message was returned.
                        expect(stubList).to.have.been.calledOnce;
                        if (switches.includes("--sites")) {
                            // Sites filtered to those in context.siteList.
                            expect(msg).to.contain('artifacts listed 1');
                        } else {
                            expect(msg).to.contain('artifacts listed 3');
                        }
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubs.
                        stubList.restore();
                        stubHashes.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test list local modified working (draft sites)", function (done) {
                // TODO Enable when --draft option is avaiable.
                if (!DRAFT_OPTION) {
                    return done();
                }

                const stubList = sinon.stub(helper._fsApi, "listNames");
                stubList.resolves([{name: itemName1, id: "foo", path: itemName1}, {name: itemName2, id: "bar", path: itemName2}, {name: badItem, id: "ack", path: badItem}]);

                const stubHashes = sinon.stub(hashes, "isLocalModified");
                stubHashes.returns(true);

                // Execute the command to list the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "list", switches, "--draft", "--mod", "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function (msg) {
                        // Verify that the stubs were called as expected, and the expected message was returned.
                        expect(stubList).to.have.been.calledOnce;
                        if (switches.includes("--sites")) {
                            // Sites filtered to those in context.siteList.
                            expect(msg).to.contain('artifacts listed 1');
                        } else {
                            expect(msg).to.contain('artifacts listed 3');
                        }
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubs.
                        stubList.restore();
                        stubHashes.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test list remote modified working (all sites)", function (done) {
                const stubList = sinon.stub(helper._restApi, "getModifiedItems");
                stubList.resolves([{name: itemName1, id: "foo", path: itemName1}, {name: itemName2, id: "bar", path: itemName2}, {name: badItem, id: undefined, path: badItem}]);

                const stubHashes = sinon.stub(hashes, "isRemoteModified");
                stubHashes.returns(true);

                let stubContentResource;
                if (switches.includes("-a")) {
                    stubContentResource = sinon.stub(helper._fsApi, "isContentResource");
                    stubContentResource.returns(true);
                } else if (switches.includes("-w")) {
                    stubContentResource = sinon.stub(helper._fsApi, "isContentResource");
                    stubContentResource.returns(false);
                }

                // Execute the command to list the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "list", switches, "--server", "--mod", "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function (msg) {
                        if (DRAFT_SITES && switches === "--pages") {
                            // Verify that the stub was called twice (once for each site), and the expected message was returned.
                            expect(stubList).to.have.been.calledTwice;
                            expect(msg).to.contain('artifacts listed 6');
                        } else {
                            // Verify that the stubs were called as expected, and the expected message was returned.
                            expect(stubList).to.have.been.calledOnce;
                            if (switches.includes("--sites")) {
                                // Sites filtered to those in context.siteList.
                                if (DRAFT_SITES) {
                                    expect(msg).to.contain('artifacts listed 2');
                                } else {
                                    expect(msg).to.contain('artifacts listed 1');
                                }
                                expect(stubHashes).to.have.been.calledThrice;
                            } else {
                                expect(msg).to.contain('artifacts listed 3');
                            }
                        }
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubs.
                        stubList.restore();
                        stubHashes.restore();
                        if (stubContentResource) {
                            stubContentResource.restore();
                        }

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test list remote modified working (ready sites)", function (done) {
                const stubList = sinon.stub(helper._restApi, "getModifiedItems");
                stubList.resolves([{name: itemName1, id: "foo", path: itemName1}, {name: itemName2, id: "bar", path: itemName2}, {name: badItem, id: undefined, path: badItem}]);

                const stubHashes = sinon.stub(hashes, "isRemoteModified");
                stubHashes.returns(true);

                let stubContentResource;
                if (switches.includes("-a")) {
                    stubContentResource = sinon.stub(helper._fsApi, "isContentResource");
                    stubContentResource.returns(true);
                } else if (switches.includes("-w")) {
                    stubContentResource = sinon.stub(helper._fsApi, "isContentResource");
                    stubContentResource.returns(false);
                }

                // Execute the command to list the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "list", switches, "--ready", "--server", "--mod", "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function (msg) {
                        // Verify that the stubs were called as expected, and the expected message was returned.
                        expect(stubList).to.have.been.calledOnce;
                        if (switches.includes("--sites")) {
                            // Sites filtered to those in context.siteList.
                            expect(stubHashes).to.have.been.calledThrice;
                            expect(msg).to.contain('artifacts listed 1');
                        } else {
                            expect(msg).to.contain('artifacts listed 3');
                        }
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubs.
                        stubList.restore();
                        stubHashes.restore();
                        if (stubContentResource) {
                            stubContentResource.restore();
                        }

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test list remote modified working (draft sites)", function (done) {
                // TODO Enable when --draft option is avaiable.
                if (!DRAFT_OPTION) {
                    return done();
                }

                const stubList = sinon.stub(helper._restApi, "getModifiedItems");
                stubList.resolves([{name: itemName1, id: "foo", path: itemName1}, {name: itemName2, id: "bar", path: itemName2}, {name: badItem, id: undefined, path: badItem}]);

                const stubHashes = sinon.stub(hashes, "isRemoteModified");
                stubHashes.returns(true);

                let stubContentResource;
                if (switches.includes("-a")) {
                    stubContentResource = sinon.stub(helper._fsApi, "isContentResource");
                    stubContentResource.returns(true);
                } else if (switches.includes("-w")) {
                    stubContentResource = sinon.stub(helper._fsApi, "isContentResource");
                    stubContentResource.returns(false);
                }

                // Execute the command to list the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "list", switches, "--draft", "--server", "--mod", "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function (msg) {
                        // Verify that the stubs were called as expected, and the expected message was returned.
                        expect(stubList).to.have.been.calledOnce;
                        if (switches.includes("--sites")) {
                            // Sites filtered to those in context.siteList.
                            expect(stubHashes).to.have.been.calledThrice;
                            expect(msg).to.contain('artifacts listed 1');
                        } else {
                            expect(msg).to.contain('artifacts listed 3');
                        }
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubs.
                        stubList.restore();
                        stubHashes.restore();
                        if (stubContentResource) {
                            stubContentResource.restore();
                        }

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testListAll (helper, switches, itemName1, itemName2, badItem) {
        describe("CLI-unit-listing", function() {
            it("test list local working (all sites)", function (done) {
                const stub = sinon.stub(helper._fsApi, "listNames");
                stub.resolves([{name: itemName1, id: "foo", path: itemName1}, {name: itemName2, id: "bar", path: itemName2}, {name: badItem, id: undefined, path: badItem}]);

                // Execute the command to list the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "list", switches, "--ignore-timestamps", "-q", "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function (msg) {
                        if (DRAFT_SITES && switches === "--pages") {
                            // Verify that the stub was called twice (once for each site), and the expected message was returned.
                            expect(stub).to.have.been.calledTwice;
                            expect(msg).to.contain('artifacts listed 6');
                        } else {
                            // Verify that the stub was called once, and that the expected message was returned.
                            expect(stub).to.have.been.calledOnce;
                            if (switches.includes("--sites")) {
                                // Sites filtered to those in context.siteList.
                                if (DRAFT_SITES) {
                                    expect(msg).to.contain('artifacts listed 2');
                                } else {
                                    expect(msg).to.contain('artifacts listed 1');
                                }
                            } else {
                                expect(msg).to.contain('artifacts listed 3');
                            }
                        }
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

            it("test list local working (ready sites)", function (done) {
                const stub = sinon.stub(helper._fsApi, "listNames");
                stub.resolves([{name: itemName1, id: "foo", path: itemName1}, {name: itemName2, id: "bar", path: itemName2}, {name: badItem, id: undefined, path: badItem}]);

                // Execute the command to list the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "list", switches, "--ready", "--ignore-timestamps", "-q", "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function (msg) {
                        // Verify that the stub was called once, and that the expected message was returned.
                        expect(stub).to.have.been.calledOnce;
                        if (switches.includes("--sites")) {
                            // Sites filtered to those in context.siteList.
                            expect(msg).to.contain('artifacts listed 1');
                        } else {
                            expect(msg).to.contain('artifacts listed 3');
                        }
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

            it("test list local working (draft sites)", function (done) {
                // TODO Enable when --draft option is avaiable.
                if (!DRAFT_OPTION) {
                    return done();
                }

                const stub = sinon.stub(helper._fsApi, "listNames");
                stub.resolves([{name: itemName1, id: "foo", path: itemName1}, {name: itemName2, id: "bar", path: itemName2}, {name: badItem, id: undefined, path: badItem}]);

                // Execute the command to list the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "list", switches, "--draft", "--ignore-timestamps", "-q", "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function (msg) {
                        // Verify that the stub was called once, and that the expected message was returned.
                        expect(stub).to.have.been.calledOnce;
                        if (switches.includes("--sites")) {
                            // Sites filtered to those in context.siteList.
                            expect(msg).to.contain('artifacts listed 1');
                        } else {
                            expect(msg).to.contain('artifacts listed 3');
                        }
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

            it("test list local working (path)", function (done) {
                if (switches !== "-w" && switches !== "--types" && switches !== "--layouts" && switches !== "--layout-mappings") {
                    return done();
                }

                const stub = sinon.stub(helper._fsApi, "listNames");
                stub.resolves([{name: itemName1, id: "foo", path: "/test/" + itemName1}, {name: itemName2, id: "bar", path: "/test/" + itemName2}, {name: badItem, id: undefined, path: "/test/" + badItem}]);

                // Execute the command being tested.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "list", switches, "--path", "test", "--ignore-timestamps", "-q", "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
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
                        // Restore the stubbed method.
                        stub.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test list remote working (all sites)", function (done) {
                let stubGet;
                if (switches === "--sites") {
                    // Remove the global stub and create a local SitesREST.getItems stub that returns the standard sites
                    // the first time (initSites) then returns the test values the second time (the actual push).
                    ListUnitTest.restoreRemoteSitesStub();
                    stubGet = sinon.stub(helper._restApi, "getItems");
                    stubGet.onFirstCall().resolves([{id: "foo", siteStatus: "ready"}, {id: "bar", siteStatus: "draft"}]);
                    stubGet.onSecondCall().resolves([{name: itemName1, id: "foo", path: itemName1}, {name: itemName2, id: "bar", path: itemName2}, {name: badItem, id: "ack", path: badItem}]);
                } else {
                    stubGet = sinon.stub(helper._restApi, "getItems");
                    stubGet.resolves([{name: itemName1, id: "foo", path: itemName1}, {name: itemName2, id: "bar", path: itemName2}, {name: badItem, id: "ack", path: badItem}]);
                }

                let stubContentResource;
                if (switches.includes("-a")) {
                    stubContentResource = sinon.stub(helper._fsApi, "isContentResource");
                    stubContentResource.returns(true);
                } else if (switches.includes("-w")) {
                    stubContentResource = sinon.stub(helper._fsApi, "isContentResource");
                    stubContentResource.returns(false);
                }

                // Execute the command to list the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "list", switches, "--server", "--ignore-timestamps", "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function (msg) {
                        if (switches === "--pages" || switches === "--sites") {
                            if (DRAFT_SITES) {
                                // Verify that the stub was called twice (once for each site), and the expected message was returned.
                                expect(stubGet).to.have.been.calledTwice;
                                if (switches.includes("--sites")) {
                                    // Sites filtered to those in context.siteList.
                                    expect(msg).to.contain('artifacts listed 2');
                                } else {
                                    expect(msg).to.contain('artifacts listed 6');
                                }
                            } else {
                                if (switches.includes("--sites")) {
                                    // Verify that the stub was called twice, and the expected message was returned.
                                    expect(stubGet).to.have.been.calledTwice;

                                    // Sites filtered to those in context.siteList.
                                    expect(msg).to.contain('artifacts listed 1');
                                } else {
                                    // Verify that the stub was called once, and the expected message was returned.
                                    expect(stubGet).to.have.been.calledOnce;
                                    expect(msg).to.contain('artifacts listed 3');
                                }
                            }
                        } else {
                            // Verify that the stubs were called as expected, and the expected message was returned.
                            expect(stubGet).to.have.been.calledOnce;
                            expect(msg).to.contain('artifacts listed 3');
                        }
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubs.
                        stubGet.restore();
                        if (stubContentResource) {
                            stubContentResource.restore();
                        }

                        // Add the global stub back now  if it was removed earlier.
                        if (switches === "--sites") {
                            ListUnitTest.addRemoteSitesStub();
                        }

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test list remote working (ready sites)", function (done) {
                let stubGet;
                if (switches === "--sites") {
                    // Remove the global stub and create a local SitesREST.getItems stub that returns the standard sites
                    // the first time (initSites) then returns the test values the second time (the actual push).
                    ListUnitTest.restoreRemoteSitesStub();
                    stubGet = sinon.stub(helper._restApi, "getItems");
                    stubGet.onFirstCall().resolves([{id: "foo", siteStatus: "ready"}, {id: "bar", siteStatus: "draft"}]);
                    stubGet.onSecondCall().resolves([{name: itemName1, id: "foo", path: itemName1}, {name: itemName2, id: "bar", path: itemName2}, {name: badItem, id: "ack", path: badItem}]);
                } else {
                    stubGet = sinon.stub(helper._restApi, "getItems");
                    stubGet.resolves([{name: itemName1, id: "foo", path: itemName1}, {name: itemName2, id: "bar", path: itemName2}, {name: badItem, id: "ack", path: badItem}]);
                }

                let stubContentResource;
                if (switches.includes("-a")) {
                    stubContentResource = sinon.stub(helper._fsApi, "isContentResource");
                    stubContentResource.returns(true);
                } else if (switches.includes("-w")) {
                    stubContentResource = sinon.stub(helper._fsApi, "isContentResource");
                    stubContentResource.returns(false);
                }

                // Execute the command to list the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "list", switches, "--ready", "--server", "--ignore-timestamps", "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function (msg) {
                        // Verify that the stubs were called as expected, and the expected message was returned.
                        if (switches.includes("--sites")) {
                            // Sites filtered to those in context.siteList.
                            expect(stubGet).to.have.been.calledTwice;
                            expect(msg).to.contain('artifacts listed 1');
                        } else {
                            expect(stubGet).to.have.been.calledOnce;
                            expect(msg).to.contain('artifacts listed 3');
                        }
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubs.
                        stubGet.restore();
                        if (stubContentResource) {
                            stubContentResource.restore();
                        }

                        // Add the global stub back now  if it was removed earlier.
                        if (switches === "--sites") {
                            ListUnitTest.addRemoteSitesStub();
                        }

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test list remote working (draft sites)", function (done) {
                // TODO Enable when --draft option is avaiable.
                if (!DRAFT_OPTION) {
                    return done();
                }

                const stubList = sinon.stub(helper._restApi, "getItems");
                stubList.resolves([{name: itemName1, id: "foo", path: itemName1}, {name: itemName2, id: "bar", path: itemName2}, {name: badItem, id: "ack", path: badItem}]);

                let stubContentResource;
                if (switches.includes("-a")) {
                    stubContentResource = sinon.stub(helper._fsApi, "isContentResource");
                    stubContentResource.returns(true);
                } else if (switches.includes("-w")) {
                    stubContentResource = sinon.stub(helper._fsApi, "isContentResource");
                    stubContentResource.returns(false);
                }

                // Execute the command to list the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "list", switches, "--draft", "--server", "--ignore-timestamps", "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function (msg) {
                        // Verify that the stubs were called as expected, and the expected message was returned.
                        expect(stubList).to.have.been.calledOnce;
                        if (switches.includes("--sites")) {
                            // Sites filtered to those in context.siteList.
                            expect(msg).to.contain('artifacts listed 1');
                        } else {
                            expect(msg).to.contain('artifacts listed 3');
                        }
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubs.
                        stubList.restore();
                        if (stubContentResource) {
                            stubContentResource.restore();
                        }

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test list remote working (path)", function (done) {
                if (switches !== "-w" && switches !== "--types" && switches !== "--layouts" && switches !== "--layout-mappings") {
                    return done();
                }

                const stub = sinon.stub(helper._restApi, "getItems");
                stub.resolves([{name: itemName1, id: "foo", path: "/test/" + itemName1}, {name: itemName2, id: "bar", path: "/test/" + itemName2}, {name: badItem, id: undefined, path: "/test/" + badItem}]);

                // Execute the command being tested.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "list", switches, "--server", "--path", "test", "--ignore-timestamps", "-q", "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
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
                        // Restore the stubbed method.
                        stub.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testListParamFail (helper, switches) {
        describe("CLI-unit-listing", function() {
            it("test fail extra param", function (done) {
                // Execute the command to list the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "list", switches, "foo", "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
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
                toolsCli.parseArgs(['', UnitTest.COMMAND, "list", switches, "--dir", "....", "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
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
                toolsCli.parseArgs(['', UnitTest.COMMAND, "list", "-c", "--path", "./", "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function (/*msg*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the expected error message was returned.
                            expect(err.message).to.contain('Invalid options, path can only be used for web assets, content types, layouts, and layout mappings.');
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail if initialization fails", function (done) {
                const INIT_ERROR = "API initialization failed, as expected by unit test.";
                const stub = sinon.stub(ToolsApi, "getInitializationErrors");
                stub.returns([new Error(INIT_ERROR)]);

                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "list", switches, '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // The stub should have been called and the expected error should have been returned.
                        expect(stub).to.have.been.calledOnce;
                        expect(err.message).to.contain(INIT_ERROR);
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

            it("should fail if both ready and draft specified", function (done) {
                // TODO Enable when --draft option is avaiable.
                if (!DRAFT_OPTION) {
                    return done();
                }

                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "list", switches, '--ready', '--draft', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        expect(err.message).to.contain("cannot specifiy both ready and draft");
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

            it("should fail if the ready and draft options are not valid", function (done) {
                const READY_ERROR = "There was a problem with the ready option, as expected by a unit test.";
                const stub = sinon.stub(BaseCommand.prototype, "handleReadyDraftOptions", function () {
                    this.errorMessage(READY_ERROR);
                    this.resetCommandLineOptions();
                    return false;
                });

                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "list", switches, '--ready', '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        expect(err.message).to.contain(READY_ERROR);
                    })
                    .catch (function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        stub.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }
}

module.exports = ListUnitTest;
