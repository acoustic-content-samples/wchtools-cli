/*
Copyright 2018 IBM Corporation

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
 * Unit tests for the compare command.
 */
"use strict";

// Require the super classes for this class.
const UnitTest = require("./base.cli.unit.js");

// Require the node modules used in this test file.
const fs = require("fs");
const Q = require("q");
const sinon = require("sinon");
const ToolsApi = require("wchtools-api");
const toolsCli = require("../../../wchToolsCli");
const manifests = ToolsApi.getManifests();

// Require the local modules that will be stubbed, mocked, and spied.
const options = require("wchtools-api").getOptions();

let stubRemoteSites;
let stubLocalSites;

class CompareUnitTest extends UnitTest {
    constructor () {
        super();
    }

    static addRemoteSitesStub () {
        stubRemoteSites = sinon.stub(ToolsApi.getSitesHelper()._restApi, "getItems");
        stubRemoteSites.resolves([{id: "foo", status: "ready"}, {id: "bar", status: "draft"}]);
    }

    static restoreRemoteSitesStub () {
        stubRemoteSites.restore();
    }

    static addLocalSitesStub () {
        stubLocalSites = sinon.stub(ToolsApi.getSitesHelper()._fsApi, "getItems");
        stubLocalSites.resolves([{id: "foo", status: "ready"}, {id: "bar", status: "draft"}]);
    }

    static restoreLocalSitesStub () {
        stubLocalSites.restore();
    }

    run (helper, switches) {
        const self = this;

        describe("Unit tests for compare  " + switches, function () {
            let stubLogin;
            before(function (done) {
                stubLogin = sinon.stub(self.getLoginHelper(), "login");
                stubLogin.resolves("Adam.iem@mailinator.com");

                CompareUnitTest.addRemoteSitesStub();
                CompareUnitTest.addLocalSitesStub();

                done();
            });

            after(function (done) {
                stubLogin.restore();

                CompareUnitTest.restoreRemoteSitesStub();
                CompareUnitTest.restoreLocalSitesStub();

                done();
            });

            // Run each of the tests defined in this class.
            self.testCompare(helper, switches);
            self.testCompareParamFail(helper, switches);
        });
    }

    testCompare (helper, switches) {
        describe("CLI-unit-compare", function () {
            it("succeeds when local source and target are specified", function (done) {
                const results = {"diffCount": 1, "totalCount": 25};
                const stub = sinon.stub(helper, "compare");
                stub.resolves(results);

                const stubFS = sinon.stub(fs, "statSync");
                const dummyStats = new fs.Stats();
                dummyStats.isDirectory = function () {
                    return true;
                };
                stubFS.returns(dummyStats);

                // Return different site lists for the source and target;
                CompareUnitTest.restoreLocalSitesStub();
                stubLocalSites = sinon.stub(ToolsApi.getSitesHelper()._fsApi, "getItems");
                stubLocalSites.onCall(0).resolves([{id: "foo", status: "ready"}, {id: "bar", status: "draft"}]);
                stubLocalSites.onCall(1).resolves([{id: "ack", status: "ready"}, {
                    id: "bar",
                    status: "draft"
                }, {id: "nak", status: "draft"}]);

                let error;

                // Execute the command to list the default local items.
                toolsCli.parseArgs(['', UnitTest.COMMAND, "compare", switches, "--ready", "--draft", "--source", "foo", "--target", "bar"])
                    .then(function (msg) {
                        // Verify that the expected message was returned.
                        if (switches === "--pages") {
                            expect(msg).to.contain('compared 100');
                            expect(msg).to.contain('differences 4');
                        } else {
                            expect(msg).to.contain('compared 25');
                            expect(msg).to.contain('differences 1');
                        }
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        stub.restore();
                        stubFS.restore();
                        stubLocalSites.restore();

                        // Add the deafult local sites stub.
                        CompareUnitTest.addLocalSitesStub();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("succeeds when local source and remote target are specified with verbose", function (done) {
                const results = {"diffCount": 1, "totalCount": 25};
                const stub = sinon.stub(helper, "compare");
                stub.resolves(results);

                const stubFS = sinon.stub(fs, "statSync");
                const dummyStats = new fs.Stats();
                dummyStats.isDirectory = function () {
                    return true;
                };
                stubFS.returns(dummyStats);

                let error;

                // Execute the command to list the default local items.
                toolsCli.parseArgs(['', UnitTest.COMMAND, "compare", switches, "--verbose", "--source", "foo", "--target", "https://foo/api", "--user", "foo", "--password", "password"])
                    .then(function (msg) {
                        // Verify that the expected message was returned.
                        expect(msg).to.contain('compared 25');
                        expect(msg).to.contain('differences 1');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        stub.restore();
                        stubFS.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("succeeds when remote source and local target are specified", function (done) {
                const results = {"diffCount": 9, "totalCount": 25};
                const stub = sinon.stub(helper, "compare", function (context) {
                    // When the stubbed method is called, return a promise that will be resolved asynchronously.
                    const stubDeferred = Q.defer();
                    setTimeout(function () {
                        // Emit different events to test all of the cases.
                        const emitter = helper.getEventEmitter(context);
                        const artifactName = helper.getArtifactName();
                        emitter.emit("diff", {item: {name: "item-name"}, artifactName: artifactName});
                        emitter.emit("diff", {item: {id: "item-id"}, artifactName: artifactName});
                        emitter.emit("diff", {item: {path: "item-path"}, artifactName: artifactName});
                        emitter.emit("added", {item: {name: "item-name"}, artifactName: artifactName});
                        emitter.emit("added", {item: {id: "item-id"}, artifactName: artifactName});
                        emitter.emit("added", {item: {path: "item-path"}, artifactName: artifactName});
                        emitter.emit("removed", {item: {name: "item-name"}, artifactName: artifactName});
                        emitter.emit("removed", {item: {id: "item-id"}, artifactName: artifactName});
                        emitter.emit("removed", {item: {path: "item-path"}, artifactName: artifactName});
                        stubDeferred.resolve(results);
                    }, 0);
                    return stubDeferred.promise;
                });

                const stubFS = sinon.stub(fs, "statSync");
                const dummyStats = new fs.Stats();
                dummyStats.isDirectory = function () {
                    return true;
                };
                stubFS.returns(dummyStats);

                let error;

                // Execute the command to list the default local items.
                toolsCli.parseArgs(['', UnitTest.COMMAND, "compare", switches, "--source", "https://foo/api", "--target", "bar", "--user", "foo", "--password", "password"])
                    .then(function (msg) {
                        // Verify that the expected message was returned.
                        expect(msg).to.contain('compared 25');
                        expect(msg).to.contain('differences 9');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        stub.restore();
                        stubFS.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("succeeds when remote source and remote target are specified with verbose", function (done) {
                const results = {"diffCount": 5, "totalCount": 25};
                const stub = sinon.stub(helper, "compare", function (context) {
                    // When the stubbed method is called, return a promise that will be resolved asynchronously.
                    const stubDeferred = Q.defer();
                    setTimeout(function () {
                        // Emit different events to test all of the cases.
                        const emitter = helper.getEventEmitter(context);
                        const artifactName = helper.getArtifactName();
                        emitter.emit("diff", {
                            item: {name: "item-name-1", id: "item-id-1", path: "item-path-1"},
                            artifactName: artifactName
                        });
                        emitter.emit("diff", {
                            item: {name: "item-name-2", id: "item-id-2", path: "item-path-2"},
                            artifactName: artifactName,
                            diffs: {}
                        });
                        emitter.emit("diff", {
                            item: {name: "item-name-3", id: "item-id-3", path: "item-path-3"},
                            artifactName: artifactName,
                            diffs: {
                            added: [{node: ["1", "2", "3"], value1: "value"}],
                            removed: [{node: ["1", "2", "3"], value2: "value"}],
                            changed: [{node: ["1", "2", "3"], value1: "value-1", value2: "value-2"}]}});
                        emitter.emit("added", {
                            item: {name: "item-name-4", id: "item-id-4", path: "item-path-4"},
                            artifactName: artifactName
                        });
                        emitter.emit("removed", {
                            item: {name: "item-name-5", id: "item-id-5", path: "item-path-5"},
                            artifactName: artifactName
                        });
                        stubDeferred.resolve(results);
                    }, 0);
                    return stubDeferred.promise;
                });

                const stubFS = sinon.stub(fs, "statSync");
                const dummyStats = new fs.Stats();
                dummyStats.isDirectory = function () {
                    return true;
                };
                stubFS.returns(dummyStats);

                let error;

                // Execute the command to list the default local items.
                toolsCli.parseArgs(['', UnitTest.COMMAND, "compare", switches, "--verbose", "--source", "https://foo/api", "--target", "bar", "--user", "foo", "--password", "password"])
                    .then(function (msg) {
                        // Verify that the expected message was returned.
                        expect(msg).to.contain('compared 25');
                        expect(msg).to.contain('differences 5');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        stub.restore();
                        stubFS.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("succeeds when API compare call fails", function (done) {
                const COMPARE_ERROR = "The compare failed, as expected by unit test.";
                const stub = sinon.stub(helper, "compare");
                stub.rejects(COMPARE_ERROR);

                const stubFS = sinon.stub(fs, "statSync");
                const dummyStats = new fs.Stats();
                dummyStats.isDirectory = function () {
                    return true;
                };
                stubFS.returns(dummyStats);

                let error;

                // Execute the command to list the default local items.
                toolsCli.parseArgs(['', UnitTest.COMMAND, "compare", switches, "--verbose", "--source", "foo", "--target", "bar"])
                    .then(function (msg) {
                        // Verify that the expected message was returned.
                        expect(msg).to.contain('compared 0');
                        expect(msg).to.contain('differences 0');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        stub.restore();
                        stubFS.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("succeeds when API compare call succeeds but save manifest fails", function (done) {
                const MANIFEST_ERROR = "The manifest was not saved, as expected by unit test.";
                const stub = sinon.stub(manifests, "saveManifest");
                stub.throws(MANIFEST_ERROR);

                const stubFS = sinon.stub(fs, "statSync");
                const dummyStats = new fs.Stats();
                dummyStats.isDirectory = function () {
                    return true;
                };
                stubFS.returns(dummyStats);

                let error;

                // Execute the command to list the default local items.
                toolsCli.parseArgs(['', UnitTest.COMMAND, "compare", switches, "--verbose", "--source", "foo", "--target", "bar"])
                    .then(function (msg) {
                        // Verify that the expected message was returned.
                        expect(stub).to.have.been.calledOnce;
                        expect(msg).to.contain('compared 0');
                        expect(msg).to.contain('differences 0');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        stub.restore();
                        stubFS.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testCompareParamFail (helper, switches) {
        describe("CLI-unit-listing", function() {
            it("test fail extra param", function (done) {
                // Execute the command to list the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "compare", switches, "foo"])
                    .then(function (/*msg*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // Verify that the expected error message was returned.
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

            it("fails when no options", function (done) {
                let error;

                // Execute the command to list the default local items.
                toolsCli.parseArgs(['', UnitTest.COMMAND, "compare", switches])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // Verify that the expected message was returned.
                        expect(err.message).to.equal('The --source and --target options are required.');
                    })
                    .catch(function (err) {
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

module.exports = CompareUnitTest;
