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
 * Unit tests for the pull command.
 */
"use strict";

// Require the super classes for this class.
const UnitTest = require("./base.cli.unit.js");

// Require the node modules used in this test file.
const fs = require("fs");
const path = require("path");
const rimraf = require("rimraf");
const diff = require("diff");
const Q = require("q");
const sinon = require("sinon");
const ToolsApi = require("wchtools-api");
const hashes = ToolsApi.getHashes();
const toolsCli = require("../../../wchToolsCli");
const events = require("events");
const mkdirp = require("mkdirp");
const options = ToolsApi.getOptions();
const manifests = ToolsApi.getManifests();
const prompt = require("prompt");

const DRAFT_OPTION = false;

let stubRemoteSites;

class PullUnitTest extends UnitTest {
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

    run (helper, switches, itemName1, itemName2, badItem) {
        const self = this;
        describe("Unit tests for pull  " + switches, function () {
            let stubLogin;
            before(function (done) {
                mkdirp.sync(UnitTest.DOWNLOAD_DIR);

                stubLogin = sinon.stub(self.getLoginHelper(), "login");
                stubLogin.resolves("Adam.iem@mailinator.com");

                PullUnitTest.addRemoteSitesStub();

                done();
            });

            after(function (done) {
                rimraf.sync(UnitTest.DOWNLOAD_DIR);

                stubLogin.restore();
                PullUnitTest.restoreRemoteSitesStub();

                done();
            });

            if (switches === "-A") {
                // Test the pull all by type name option
                self.testPullByTypeName(helper, switches, itemName1, itemName2, badItem);

            } else {
                // Run each of the tests defined in this class.
                self.testPull(helper, switches, itemName1, itemName2, badItem);
                self.testPullByManifest(helper, switches, itemName1, itemName2, badItem);
                self.testPullParamFail(helper, switches);
            }
        });
    }

    testPull (helper, switches, itemName1, itemName2, badItem) {
        const DOWNLOAD_TARGET = UnitTest.DOWNLOAD_DIR; // Relative to the CLI directory.
        describe("CLI-unit-pulling " + switches, function () {
            it("test emitters working", function (done) {
                // Stub the helper.pullModifiedItems method to return a promise that is resolved after emitting events.
                const stub = sinon.stub(helper, "pullModifiedItems", function (context) {
                    // When the stubbed method is called, return a promise that will be resolved asynchronously.
                    const stubDeferred = Q.defer();
                    setTimeout(function () {
                        const emitter = helper.getEventEmitter(context);
                        emitter.emit("pulled", {name: itemName1, id: undefined, path: itemName1});
                        emitter.emit("pulled", {name: itemName2, id: undefined, path: undefined});
                        emitter.emit("pulled-error", {message: "This failure was expected by the unit test"}, badItem);
                        emitter.emit("pulled-warning", {message: "This warning was expected by the unit test"});
                        stubDeferred.resolve();
                    }, 0);
                    return stubDeferred.promise;
                });

                // Execute the command to pull the items to the download directory.
                let error;
                const downloadTarget = DOWNLOAD_TARGET;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "pull", switches, "--dir", downloadTarget,'--user','foo','--password','password', '--url', 'http://foo.bar/api','-v'])
                    .then(function (msg) {
                        if (switches === "--pages") {
                            // Verify that the stub was called twice (once for each site), and that the expected message was returned.
                            expect(stub).to.have.been.calledTwice;
                            expect(msg).to.contain('4 artifacts');
                            expect(msg).to.contain('2 error');
                        } else {
                            // Verify that the stub was called once, and that the expected message was returned.
                            expect(stub).to.have.been.calledOnce;
                            expect(msg).to.contain('2 artifacts');
                            expect(msg).to.contain('1 error');
                        }
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's "pullModifiedItems" method.
                        stub.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test resource emitters working", function (done) {
                if (switches !== "-a" ) {
                    return done();
                }

                // Stub the helper.pullModifiedItems method to return a promise that is resolved after emitting events.
                const stub = sinon.stub(helper, "pullModifiedItems", function (context) {
                    // When the stubbed method is called, return a promise that will be resolved asynchronously.
                    const stubDeferred = Q.defer();
                    setTimeout(function () {
                        const emitter = helper.getEventEmitter(context);
                        emitter.emit("resource-pulled", {name: itemName1, id: undefined, path: itemName1});
                        emitter.emit("resource-pulled", {name: itemName2, id: undefined, path: itemName2});
                        emitter.emit("resource-pulled-error", {message: "This failure was expected by the unit test"}, badItem);
                        stubDeferred.resolve();
                    }, 0);
                    return stubDeferred.promise;
                });

                // Execute the command to pull the items to the download directory.
                let error;
                const downloadTarget = DOWNLOAD_TARGET;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "pull", switches, "--dir", downloadTarget,'--user','foo','--password','password', '--url', 'http://foo.bar/api','-v'])
                    .then(function (msg) {
                        // Verify that the stub was called once, and that the expected message was returned.
                        expect(stub).to.have.been.calledOnce;
                        expect(msg).to.contain('2 artifacts');
                        expect(msg).to.contain('1 error');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's "pullModifiedItems" method.
                        stub.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test generic pull working", function (done) {
                if (switches !== '-a') {
                    return done();
                }

                // Stub the helper.pullModifiedItems method to return a promise that is resolved after emitting events.
                const stub = sinon.stub(helper, "pullModifiedItems", function (context) {
                    // When the stubbed method is called, return a promise that will be resolved asynchronously.
                    const stubDeferred = Q.defer();
                    setTimeout(function () {
                        const emitter = helper.getEventEmitter(context);
                        emitter.emit("pulled", {name: itemName1, id: undefined, path: itemName1});
                        emitter.emit("pulled", {name: itemName2, id: undefined, path: itemName2});
                        emitter.emit("pulled-error", {message: "This failure was expected by the unit test"}, badItem);
                        stubDeferred.resolve();
                    }, 0);
                    return stubDeferred.promise;
                });

                // Execute the command to pull the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "pull", "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function (msg) {
                        // Verify that the stub was called once, and that the expected message was returned.
                        expect(stub).to.have.been.calledOnce;
                        expect(msg).to.contain('2 artifacts');
                        expect(msg).to.contain('1 error');
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

            it("test pull of both asset types working", function (done) {
                if (switches !== '-a') {
                    return done();
                }

                // Stub the helper.pullModifiedItems method to return a promise that is resolved after emitting events.
                const stub = sinon.stub(helper, "pullModifiedItems", function (context) {
                    // When the stubbed method is called, return a promise that will be resolved asynchronously.
                    const stubDeferred = Q.defer();
                    setTimeout(function () {
                        const emitter = helper.getEventEmitter(context);
                        emitter.emit("pulled", {name: itemName1, id: undefined, path: itemName1});
                        emitter.emit("pulled", {name: itemName2, id: undefined, path: itemName2});
                        emitter.emit("pulled-error", {message: "This failure was expected by the unit test"}, badItem);
                        stubDeferred.resolve();
                    }, 0);
                    return stubDeferred.promise;
                });

                // Execute the command to pull the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "pull", "-aw", "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function (msg) {
                        // Verify that the stub was called once, and that the expected message was returned.
                        expect(stub).to.have.been.calledOnce;
                        expect(msg).to.contain('2 artifacts');
                        expect(msg).to.contain('1 error');
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

            it("test pull ignore-timestamps working", function (done) {
                // Stub the helper.pullAllItems method to return a promise that is resolved after emitting events.
                const stub = sinon.stub(helper, "pullAllItems", function (context) {
                    // When the stubbed method is called, return a promise that will be resolved asynchronously.
                    const stubDeferred = Q.defer();
                    setTimeout(function () {
                        const emitter = helper.getEventEmitter(context);
                        emitter.emit("pulled", {name: itemName1, id: undefined, path: itemName1});
                        emitter.emit("pulled", {name: itemName2, id: undefined, path: itemName2});
                        stubDeferred.resolve();
                    }, 0);
                    return stubDeferred.promise;
                });

                // Execute the command to pull the items to the download directory.
                let error;
                const downloadTarget = DOWNLOAD_TARGET;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "pull", switches, "--ignore-timestamps", "--dir", downloadTarget,'--user','foo','--password','password', '--url', 'http://foo.bar/api', '-v'])
                    .then(function (msg) {
                        if (switches === "--pages") {
                            // Verify that the stub was called twice (once for each site), and that the expected message was returned.
                            expect(stub).to.have.been.calledTwice;
                            expect(msg).to.contain('4 artifacts');
                        } else {
                            // Verify that the stub was called once, and that the expected message was returned.
                            expect(stub).to.have.been.calledOnce;
                            expect(msg).to.contain('2 artifacts');
                        }
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

            it("test pull ignore-timestamps working (all sites)", function (done) {
                if (switches !== "--sites" && switches !== "--pages") {
                    return done();
                }

                let stubGet;
                if (switches === "--sites") {
                    // Remove the global stub and create a local SitesREST.getItems stub that returns the standard sites
                    // the first time (initSites) then returns the test values the second time (the actual push).
                    PullUnitTest.restoreRemoteSitesStub();
                    stubGet = sinon.stub(helper._restApi, "getItems");
                    stubGet.onFirstCall().resolves([{id: "foo", siteStatus: "ready"}, {id: "bar", siteStatus: "draft"}]);
                    stubGet.onSecondCall().resolves([{name: itemName1, id: "foo", path: itemName1}, {name: itemName2, id: "bar", path: itemName2}, {name: badItem, id: "ack", path: badItem}]);
                } else {
                    stubGet = sinon.stub(helper._restApi, "getItems");
                    stubGet.resolves([{name: itemName1, id: "foo", path: itemName1}, {name: itemName2, id: "bar", path: itemName2}, {name: badItem, id: "ack", path: badItem}]);
                }

                const stubSave = sinon.stub(helper._fsApi, "saveItem");
                stubSave.resolves();

                const stubHashes = sinon.stub(hashes, "setLastPullTimestamp");

                // Execute the command to pull the items to the download directory.
                let error;
                const downloadTarget = DOWNLOAD_TARGET;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "pull", switches, "--ignore-timestamps", "--dir", downloadTarget,'--user','foo','--password','password', '--url', 'http://foo.bar/api', '-v'])
                    .then(function (msg) {
                        if (switches === "--sites") {
                            // Verify that the stub was called twice, and that the expected message was returned.
                            expect(stubGet).to.have.been.calledTwice;
                            expect(stubSave).to.have.been.calledTwice;
                            expect(stubSave.args[0][1].id).to.equal("foo");
                            expect(stubSave.args[1][1].id).to.equal("bar");
                            expect(msg).to.contain('2 artifacts');
                        } else {
                            // Verify that the stub was called twice, and that the expected message was returned.
                            expect(stubGet).to.have.been.calledTwice;
                            expect(stubSave).to.have.callCount(6);
                            expect(stubSave.args[0][1].id).to.equal("foo");
                            expect(stubSave.args[1][1].id).to.equal("bar");
                            expect(stubSave.args[2][1].id).to.equal("ack");
                            expect(stubSave.args[3][1].id).to.equal("foo");
                            expect(stubSave.args[4][1].id).to.equal("bar");
                            expect(stubSave.args[5][1].id).to.equal("ack");
                            expect(msg).to.contain('6 artifacts');
                        }
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed methods.
                        stubGet.restore();
                        stubSave.restore();
                        stubHashes.restore();

                        // Add the global stub back now  if it was removed earlier.
                        if (switches === "--sites") {
                            PullUnitTest.addRemoteSitesStub();
                        }

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test pull modified working (all sites)", function (done) {
                if (switches !== "--sites" && switches !== "--pages") {
                    return done();
                }

                const stubList = sinon.stub(helper._restApi, "getModifiedItems");
                stubList.resolves([{name: itemName1, id: "foo", path: itemName1}, {name: itemName2, id: "bar", path: itemName2}, {name: badItem, id: "ack", path: badItem}]);

                const stubModified = sinon.stub(hashes, "isRemoteModified");
                stubModified.returns(true);

                const stubSave = sinon.stub(helper._fsApi, "saveItem");
                stubSave.resolves();

                const stubHashes = sinon.stub(hashes, "setLastPullTimestamp");

                // Execute the command to pull the items to the download directory.
                let error;
                const downloadTarget = DOWNLOAD_TARGET;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "pull", switches, "--dir", downloadTarget,'--user','foo','--password','password', '--url', 'http://foo.bar/api', '-v'])
                    .then(function (msg) {
                        if (switches === "--sites") {
                            // Verify that the stub was called once, and that the expected message was returned.
                            expect(stubList).to.have.been.calledOnce;
                            expect(stubSave).to.have.been.calledTwice;
                            expect(stubSave.args[0][1].id).to.equal("foo");
                            expect(stubSave.args[1][1].id).to.equal("bar");
                            expect(msg).to.contain('2 artifacts');
                        } else {
                            // Verify that the stub was called twice, and that the expected message was returned.
                            expect(stubList).to.have.been.calledTwice;
                            expect(stubSave).to.have.callCount(6);
                            expect(stubSave.args[0][1].id).to.equal("foo");
                            expect(stubSave.args[1][1].id).to.equal("bar");
                            expect(stubSave.args[2][1].id).to.equal("ack");
                            expect(stubSave.args[3][1].id).to.equal("foo");
                            expect(stubSave.args[4][1].id).to.equal("bar");
                            expect(stubSave.args[5][1].id).to.equal("ack");
                            expect(msg).to.contain('6 artifacts');
                        }
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed methods.
                        stubList.restore();
                        stubModified.restore();
                        stubSave.restore();
                        stubHashes.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test pull ignore-timestamps working (ready sites)", function (done) {
                if (switches !== "--sites" && switches !== "--pages") {
                    return done();
                }

                let stubGet;
                if (switches === "--sites") {
                    // Remove the global stub and create a local SitesREST.getItems stub that returns the standard sites
                    // the first time (initSites) then returns the test values the second time (the actual push).
                    PullUnitTest.restoreRemoteSitesStub();
                    stubGet = sinon.stub(helper._restApi, "getItems");
                    stubGet.onFirstCall().resolves([{id: "foo", siteStatus: "ready"}, {id: "bar", siteStatus: "draft"}]);
                    stubGet.onSecondCall().resolves([{name: itemName1, id: "foo", path: itemName1}, {name: itemName2, id: "bar", path: itemName2}, {name: badItem, id: "ack", path: badItem}]);
                } else {
                    stubGet = sinon.stub(helper._restApi, "getItems");
                    stubGet.resolves([{name: itemName1, id: "foo", path: itemName1}, {name: itemName2, id: "bar", path: itemName2}, {name: badItem, id: "ack", path: badItem}]);
                }

                const stubSave = sinon.stub(helper._fsApi, "saveItem");
                stubSave.resolves();

                const stubHashes = sinon.stub(hashes, "setLastPullTimestamp");

                // Execute the command to pull the items to the download directory.
                let error;
                const downloadTarget = DOWNLOAD_TARGET;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "pull", switches, "--ready", "--ignore-timestamps", "--dir", downloadTarget,'--user','foo','--password','password', '--url', 'http://foo.bar/api', '-v'])
                    .then(function (msg) {
                        if (switches === "--sites") {
                            // Verify that the stub was called twice, and that the expected message was returned.
                            expect(stubGet).to.have.been.calledTwice;
                            expect(stubSave).to.have.been.calledOnce;
                            expect(stubSave.args[0][1].id).to.equal("foo");
                            expect(msg).to.contain('1 artifact');
                        } else {
                            // Verify that the stub was called once, and that the expected message was returned.
                            expect(stubGet).to.have.been.calledOnce;
                            expect(stubSave).to.have.been.calledThrice;
                            expect(stubSave.args[0][1].id).to.equal("foo");
                            expect(stubSave.args[1][1].id).to.equal("bar");
                            expect(stubSave.args[2][1].id).to.equal("ack");
                            expect(msg).to.contain('3 artifacts');
                        }
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed methods.
                        stubGet.restore();
                        stubSave.restore();
                        stubHashes.restore();

                        // Add the global stub back now  if it was removed earlier.
                        if (switches === "--sites") {
                            PullUnitTest.addRemoteSitesStub();
                        }

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test pull modified working (ready sites)", function (done) {
                if (switches !== "--sites" && switches !== "--pages") {
                    return done();
                }

                const stubList = sinon.stub(helper._restApi, "getModifiedItems");
                stubList.resolves([{name: itemName1, id: "foo", path: itemName1}, {name: itemName2, id: "bar", path: itemName2}, {name: badItem, id: "ack", path: badItem}]);

                const stubModified = sinon.stub(hashes, "isRemoteModified");
                stubModified.returns(true);

                const stubSave = sinon.stub(helper._fsApi, "saveItem");
                stubSave.resolves();

                const stubHashes = sinon.stub(hashes, "setLastPullTimestamp");

                // Execute the command to pull the items to the download directory.
                let error;
                const downloadTarget = DOWNLOAD_TARGET;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "pull", switches, "--ready", "--dir", downloadTarget,'--user','foo','--password','password', '--url', 'http://foo.bar/api', '-v'])
                    .then(function (msg) {
                        if (switches === "--sites") {
                            // Verify that the stub was called once, and that the expected message was returned.
                            expect(stubList).to.have.been.calledOnce;
                            expect(stubSave).to.have.been.calledOnce;
                            expect(stubSave.args[0][1].id).to.equal("foo");
                            expect(msg).to.contain('1 artifact');
                        } else {
                            // Verify that the stub was called once, and that the expected message was returned.
                            expect(stubList).to.have.been.calledOnce;
                            expect(stubSave).to.have.been.calledThrice;
                            expect(stubSave.args[0][1].id).to.equal("foo");
                            expect(stubSave.args[1][1].id).to.equal("bar");
                            expect(stubSave.args[2][1].id).to.equal("ack");
                            expect(msg).to.contain('3 artifacts');
                        }
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed methods.
                        stubList.restore();
                        stubModified.restore();
                        stubSave.restore();
                        stubHashes.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test pull ignore-timestamps working (draft sites)", function (done) {
                // TODO Enable when --draft option is avaiable.
                if (!DRAFT_OPTION) {
                    return done();
                }

                if (switches !== "--sites" && switches !== "--pages") {
                    return done();
                }

                const stubList = sinon.stub(helper._restApi, "getItems");
                stubList.resolves([{name: itemName1, id: "foo", path: itemName1}, {name: itemName2, id: "bar", path: itemName2}, {name: badItem, id: "ack", path: badItem}]);

                const stubSave = sinon.stub(helper._fsApi, "saveItem");
                stubSave.resolves();

                const stubHashes = sinon.stub(hashes, "setLastPullTimestamp");

                // Execute the command to pull the items to the download directory.
                let error;
                const downloadTarget = DOWNLOAD_TARGET;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "pull", switches, "--draft", "--ignore-timestamps", "--dir", downloadTarget,'--user','foo','--password','password', '--url', 'http://foo.bar/api', '-v'])
                    .then(function (msg) {
                        if (switches === "--sites") {
                            // Verify that the stub was called once, and that the expected message was returned.
                            expect(stubList).to.have.been.calledOnce;
                            expect(stubSave).to.have.been.calledOnce;
                            expect(stubSave.args[0][1].id).to.equal("bar");
                            expect(msg).to.contain('1 artifact');
                        } else {
                            // Verify that the stub was called once, and that the expected message was returned.
                            expect(stubList).to.have.been.calledOnce;
                            expect(stubSave).to.have.been.calledThrice;
                            expect(stubSave.args[0][1].id).to.equal("foo");
                            expect(stubSave.args[1][1].id).to.equal("bar");
                            expect(stubSave.args[2][1].id).to.equal("ack");
                            expect(msg).to.contain('3 artifacts');
                        }
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed methods.
                        stubList.restore();
                        stubSave.restore();
                        stubHashes.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test pull modified working (draft sites)", function (done) {
                // TODO Enable when --draft option is avaiable.
                if (!DRAFT_OPTION) {
                    return done();
                }

                if (switches !== "--sites" && switches !== "--pages") {
                    return done();
                }

                const stubList = sinon.stub(helper._restApi, "getModifiedItems");
                stubList.resolves([{name: itemName1, id: "foo", path: itemName1}, {name: itemName2, id: "bar", path: itemName2}, {name: badItem, id: "ack", path: badItem}]);

                const stubModified = sinon.stub(hashes, "isRemoteModified");
                stubModified.returns(true);

                const stubSave = sinon.stub(helper._fsApi, "saveItem");
                stubSave.resolves();

                const stubHashes = sinon.stub(hashes, "setLastPullTimestamp");

                // Execute the command to pull the items to the download directory.
                let error;
                const downloadTarget = DOWNLOAD_TARGET;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "pull", switches, "--draft", "--dir", downloadTarget,'--user','foo','--password','password', '--url', 'http://foo.bar/api', '-v'])
                    .then(function (msg) {
                        if (switches === "--sites") {
                            // Verify that the stub was called once, and that the expected message was returned.
                            expect(stubList).to.have.been.calledOnce;
                            expect(stubSave).to.have.been.calledOnce;
                            expect(stubSave.args[0][1].id).to.equal("bar");
                            expect(msg).to.contain('1 artifact');
                        } else {
                            // Verify that the stub was called once, and that the expected message was returned.
                            expect(stubList).to.have.been.calledOnce;
                            expect(stubSave).to.have.been.calledThrice;
                            expect(stubSave.args[0][1].id).to.equal("foo");
                            expect(stubSave.args[1][1].id).to.equal("bar");
                            expect(stubSave.args[2][1].id).to.equal("ack");
                            expect(msg).to.contain('3 artifacts');
                        }
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed methods.
                        stubList.restore();
                        stubModified.restore();
                        stubSave.restore();
                        stubHashes.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test pull ignore-timestamps working (path)", function (done) {
                if (switches !== "--types" && switches !== "--layouts" && switches !== "--layout-mappings") {
                    return done();
                }

                const stubGet = sinon.stub(helper._restApi, "getItems");
                stubGet.resolves([{name: itemName1, id: "foo", path: "/test/" + itemName1}, {name: itemName2, id: "bar", path: "/test/" + itemName2}, {name: badItem, id: "ack", path: "/test/" + badItem}]);

                const stubSave = sinon.stub(helper._fsApi, "saveItem");
                stubSave.resolves(undefined);

                const stubHashes = sinon.stub(hashes, "setLastPullTimestamp");

                // Execute the command to pull the items to the download directory.
                let error;
                const downloadTarget = DOWNLOAD_TARGET;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "pull", switches, "--path", "test", "--ignore-timestamps", "--dir", downloadTarget,'--user','foo','--password','password', '--url', 'http://foo.bar/api', '-v'])
                    .then(function (msg) {
                        // Verify that the stub was called once, and that the expected message was returned.
                        expect(stubGet).to.have.been.calledOnce;
                        expect(stubHashes).to.not.have.been.called;
                        expect(stubSave).to.have.been.calledThrice;
                        expect(stubSave.args[0][1].id).to.equal("foo");
                        expect(stubSave.args[1][1].id).to.equal("bar");
                        expect(stubSave.args[2][1].id).to.equal("ack");
                        expect(msg).to.contain('3 artifacts');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed methods.
                        stubGet.restore();
                        stubSave.restore();
                        stubHashes.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test pull deletions --quiet working", function (done) {
                const pullResources = (switches === '-a') || (switches === '-w');
                const extension = helper._fsApi.getExtension();

                // Stub the helper.pullAllItems method to return a promise that is resolved after emitting events.
                const stub = sinon.stub(helper, "pullAllItems", function (context) {
                    // When the stubbed method is called, return a promise that will be resolved asynchronously.
                    const stubDeferred = Q.defer();
                    setTimeout(function () {
                        const emitter = helper.getEventEmitter(context);
                        emitter.emit("pulled", {name: itemName1, id: undefined, path: itemName1 + extension});
                        emitter.emit("local-only", {name: itemName2, id: undefined, path: itemName2 + extension});
                        emitter.emit("local-only", {name: itemName2 + "-1", id: "bar", path: itemName2 + "-1" + extension});
                        if (pullResources) {
                            emitter.emit("resource-local-only", {name: "foo", id: "foo", path: "foo"});
                        }
                        stubDeferred.resolve();
                    }, 0);
                    return stubDeferred.promise;
                });

                const stubDelete = sinon.stub(helper, "deleteLocalItem");
                stubDelete.onFirstCall().resolves({name: itemName2, id: undefined, path: itemName2});
                stubDelete.onSecondCall().resolves({name: itemName2 + "-1", id: "bar", path: itemName2 + "-1" + extension});
                stubDelete.onThirdCall().resolves({name: itemName2, id: undefined, path: itemName2});
                stubDelete.onCall(4).resolves({name: itemName2 + "-1", id: "bar", path: itemName2 + "-1" + extension});

                let stubResource;
                if (pullResources) {
                    stubResource = sinon.stub(helper, "deleteLocalResource");
                    stubResource.resolves({name: "foo", id: "foo", path: "foo"});
                }

                // Execute the command to pull the items to the download directory.
                let error;
                const downloadTarget = DOWNLOAD_TARGET;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "pull", switches, "--deletions", "--quiet", "--dir", downloadTarget,'--user','foo','--password','password', '--url', 'http://foo.bar/api', '-v'])
                    .then(function (msg) {
                        if (switches === "--pages") {
                            // Verify that the stub was called twice (once for each site), and that the expected message was returned.
                            expect(stub).to.have.been.calledTwice;
                            expect(msg).to.contain('2 artifacts');
                            expect(stubDelete).to.have.callCount(4);
                        } else {
                            // Verify that the stub was called once, and that the expected message was returned.
                            expect(stub).to.have.been.calledOnce;
                            expect(msg).to.contain('1 artifact');
                            expect(stubDelete).to.have.been.calledTwice;
                        }
                        if (stubResource) {
                            expect(stubResource).to.have.been.calledOnce;
                        }
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's "getRemoteItems" method.
                        stub.restore();
                        stubDelete.restore();
                        if (stubResource) {
                            stubResource.restore();
                        }

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test pull deletions w/prompt working", function (done) {
                // Stub the helper.pullAllItems method to return a promise that is resolved after emitting events.
                const stub = sinon.stub(helper, "pullAllItems", function (context) {
                    // When the stubbed method is called, return a promise that will be resolved asynchronously.
                    const stubDeferred = Q.defer();
                    setTimeout(function () {
                        const emitter = helper.getEventEmitter(context);
                        emitter.emit("pulled", {name: itemName1, id: undefined, path: itemName1});
                        emitter.emit("local-only", {name: itemName2, id: undefined, path: itemName2});
                        emitter.emit("local-only", {name: itemName2 + "-1", id: itemName2 + "-1", path: itemName2 + "-1"});
                        stubDeferred.resolve();
                    }, 0);
                    return stubDeferred.promise;
                });
                const stubPrompt = sinon.stub(prompt, "get");
                const promptRes = {};
                promptRes[itemName2] = "y";
                promptRes[itemName2 + "-1"] = "y";
                stubPrompt.yields(null, promptRes );
                const stubDelete = sinon.stub(helper, "deleteLocalItem");
                stubDelete.onFirstCall().resolves({name: itemName2, id: undefined, path: itemName2});
                stubDelete.onSecondCall().resolves({name: itemName2 + "-1", id: itemName2 + "-1", path: itemName2 + "-1"});
                stubDelete.onThirdCall().resolves({name: itemName2, id: undefined, path: itemName2});
                stubDelete.onCall(4).resolves({name: itemName2 + "-1", id: itemName2 + "-1", path: itemName2 + "-1"});

                // Execute the command to pull the items to the download directory.
                let error;
                const downloadTarget = DOWNLOAD_TARGET;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "pull", switches, "--deletions", "--dir", downloadTarget,'--user','foo','--password','password', '--url', 'http://foo.bar/api', '-v'])
                    .then(function (msg) {
                        if (switches === "--pages") {
                            // Verify that the stub was called twice (once for each site), and that the expected message was returned.
                            expect(stub).to.have.been.calledTwice;
                            expect(msg).to.contain('2 artifacts');
                            expect(stubPrompt).to.have.been.calledTwice;
                            expect(stubDelete).to.have.callCount(4);
                        } else {
                            // Verify that the stub was called once, and that the expected message was returned.
                            expect(stub).to.have.been.calledOnce;
                            expect(msg).to.contain('1 artifact');
                            expect(stubPrompt).to.have.been.calledOnce;
                            expect(stubDelete).to.have.been.calledTwice;
                        }
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's "getRemoteItems" method.
                        stub.restore();
                        stubPrompt.restore();
                        stubDelete.restore();
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test pull deletions w/prompt (none confirmed) working", function (done) {
                // Stub the helper.pullAllItems method to return a promise that is resolved after emitting events.
                const stub = sinon.stub(helper, "pullAllItems", function (context) {
                    // When the stubbed method is called, return a promise that will be resolved asynchronously.
                    const stubDeferred = Q.defer();
                    setTimeout(function () {
                        const emitter = helper.getEventEmitter(context);
                        emitter.emit("pulled", {name: itemName1, id: undefined, path: itemName1});
                        emitter.emit("local-only", {name: itemName2, id: undefined, path: itemName2});
                        stubDeferred.resolve();
                    }, 0);
                    return stubDeferred.promise;
                });
                const stubPrompt = sinon.stub(prompt, "get");
                const promptRes = {};
                stubPrompt.yields(null, promptRes);
                const stubDelete = sinon.stub(helper, "deleteLocalItem");

                // Execute the command to pull the items to the download directory.
                let error;
                const downloadTarget = DOWNLOAD_TARGET;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "pull", switches, "--deletions", "--dir", downloadTarget,'--user','foo','--password','password', '--url', 'http://foo.bar/api', '-v'])
                    .then(function (msg) {
                        if (switches === "--pages") {
                            // Verify that the stub was called twice (once for each site), and that the expected message was returned.
                            expect(stub).to.have.been.calledTwice;
                            expect(msg).to.contain('2 artifacts');
                            expect(stubPrompt).to.have.been.calledTwice;
                        } else {
                            // Verify that the stub was called once, and that the expected message was returned.
                            expect(stub).to.have.been.calledOnce;
                            expect(msg).to.contain('1 artifact');
                            expect(stubPrompt).to.have.been.calledOnce;
                        }
                        expect(stubDelete).to.not.have.been.called;
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's "getRemoteItems" method.
                        stub.restore();
                        stubPrompt.restore();
                        stubDelete.restore();
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test pull deletions w/prompt w/1 delete failure working", function (done) {
                // Stub the helper.pullAllItems method to return a promise that is resolved after emitting events.
                const stub = sinon.stub(helper, "pullAllItems", function (context) {
                    // When the stubbed method is called, return a promise that will be resolved asynchronously.
                    const stubDeferred = Q.defer();
                    setTimeout(function () {
                        const emitter = helper.getEventEmitter(context);
                        emitter.emit("pulled", {name: itemName1, id: undefined, path: itemName1});
                        emitter.emit("local-only", {name: itemName2, id: undefined, path: itemName2});
                        emitter.emit("local-only", {name: itemName2 + "-1", id: itemName2 + "-1", path: itemName2 + "-1"});
                        stubDeferred.resolve();
                    }, 0);
                    return stubDeferred.promise;
                });
                const stubPrompt = sinon.stub(prompt, "get");
                const promptRes = {};
                promptRes[itemName2] = "y";
                promptRes[itemName2 + "-1"] = "y";
                stubPrompt.yields(null, promptRes );
                const stubDelete = sinon.stub(helper, "deleteLocalItem");
                stubDelete.rejects("Error deleting local item");


                // Execute the command to pull the items to the download directory.
                let error;
                const downloadTarget = DOWNLOAD_TARGET;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "pull", switches, "--deletions", "--dir", downloadTarget,'--user','foo','--password','password', '--url', 'http://foo.bar/api'])
                    .then(function (msg) {
                        if (switches === "--pages") {
                            // Verify that the stub was called twice (once for each site), and that the expected message was returned.
                            expect(stub).to.have.been.calledTwice;
                            expect(msg).to.contain('2 artifacts');
                            expect(stubPrompt).to.have.been.calledTwice;
                            expect(stubDelete).to.have.callCount(4);
                        } else {
                            // Verify that the stub was called once, and that the expected message was returned.
                            expect(stub).to.have.been.calledOnce;
                            expect(msg).to.contain('1 artifact');
                            expect(stubPrompt).to.have.been.calledOnce;
                            expect(stubDelete).to.have.been.calledTwice;
                        }
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's "getRemoteItems" method.
                        stub.restore();
                        stubPrompt.restore();
                        stubDelete.restore();
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test pull deletions with 1 delete error working", function (done) {
                // Stub the helper.pullAllItems method to return a promise that is resolved after emitting events.
                const stub = sinon.stub(helper, "pullAllItems", function (context) {
                    // When the stubbed method is called, return a promise that will be resolved asynchronously.
                    const stubDeferred = Q.defer();
                    setTimeout(function () {
                        const emitter = helper.getEventEmitter(context);
                        emitter.emit("pulled", {name: itemName1, id: undefined, path: itemName1});
                        emitter.emit("local-only", {name: itemName2, id: undefined, path: itemName2});
                        emitter.emit("local-only", {name: itemName2 + "-1", id: "foo", path: itemName2 + "-1"});
                        stubDeferred.resolve();
                    }, 0);
                    return stubDeferred.promise;
                });
                const stubDelete = sinon.stub(helper, "deleteLocalItem");
                stubDelete.rejects("Error deleting local item");

                // Execute the command to pull the items to the download directory.
                let error;
                const downloadTarget = DOWNLOAD_TARGET;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "pull", switches, "--deletions", "--quiet", "--dir", downloadTarget,'--user','foo','--password','password', '--url', 'http://foo.bar/api', '-v'])
                    .then(function (msg) {
                        if (switches === "--pages") {
                            // Verify that the stub was called twice (once for each site), and that the expected message was returned.
                            expect(stub).to.have.been.calledTwice;
                            expect(msg).to.contain('2 artifacts');
                            expect(stubDelete).to.have.callCount(4);
                        } else {
                            // Verify that the stub was called once, and that the expected message was returned.
                            expect(stub).to.have.been.calledOnce;
                            expect(msg).to.contain('1 artifact');
                            expect(stubDelete).to.have.been.calledTwice;
                        }
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's "getRemoteItems" method.
                        stub.restore();
                        stubDelete.restore();
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test all errors working", function (done) {
                // Stub the helper.pullModifiedItems method to return a promise that is resolved after emitting events.
                const stub = sinon.stub(helper, "pullModifiedItems", function (context) {
                    // When the stubbed method is called, return a promise that will be resolved asynchronously.
                    const stubDeferred = Q.defer();
                    setTimeout(function () {
                        const emitter = helper.getEventEmitter(context);
                        emitter.emit("pulled-error", {message: "This failure was expected by the unit test"}, itemName1);
                        emitter.emit("pulled-error", {message: "This failure was expected by the unit test"}, itemName2);
                        emitter.emit("pulled-error", {message: "This failure was expected by the unit test"}, badItem);
                        stubDeferred.resolve();
                    }, 0);
                    return stubDeferred.promise;
                });

                // Execute the command to pull the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "pull", switches, "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        if (switches === "--pages") {
                            // Verify that the stub was called twice (once for each site), and that the expected message was returned.
                            expect(stub).to.have.been.calledTwice;
                            expect(err.message).to.contain('6 errors');
                        } else {
                            // Verify that the stub was called once, and that the expected message was returned.
                            expect(stub).to.have.been.calledOnce;
                            expect(err.message).to.contain('3 errors');
                        }
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

            it("test nothing to pull working", function (done) {
                // Stub the helper.pullModifiedItems method to return a promise that is resolved after emitting events.
                const stub = sinon.stub(helper, "pullModifiedItems", function () {
                    // When the stubbed method is called, return a promise that will be resolved asynchronously.
                    const stubDeferred = Q.defer();
                    setTimeout(function () {
                        stubDeferred.resolve();
                    }, 0);
                    return stubDeferred.promise;
                });

                // Execute the command to pull the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "pull", switches, "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function (msg) {
                        if (switches === "--pages") {
                            // Verify that the stub was called twice (once for each site), and that the expected message was returned.
                            expect(stub).to.have.been.calledTwice;
                        } else {
                            // Verify that the stub was called once, and that the expected message was returned.
                            expect(stub).to.have.been.calledOnce;
                        }
                        expect(msg).to.contain('No items pulled');
                        expect(msg).to.contain('Use the -I option');
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

            it("test nothing to pull ignore timestamps working", function (done) {
                // Stub the helper.pullModifiedItems method to return a promise that is resolved after emitting events.
                const stub = sinon.stub(helper, "pullAllItems", function () {
                    // When the stubbed method is called, return a promise that will be resolved asynchronously.
                    const stubDeferred = Q.defer();
                    setTimeout(function () {
                        stubDeferred.resolve();
                    }, 0);
                    return stubDeferred.promise;
                });

                // Execute the command to pull the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "pull", switches, "-I", "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function (msg) {
                        if (switches === "--pages") {
                            // Verify that the stub was called twice (once for each site), and that the expected message was returned.
                            expect(stub).to.have.been.calledTwice;
                        } else {
                            // Verify that the stub was called once, and that the expected message was returned.
                            expect(stub).to.have.been.calledOnce;
                        }
                        expect(msg).to.contain('No items to be pulled');
                        expect(msg).to.contain('Pull complete');
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

            it("test pull modified failure, continue on error", function (done) {
                // Stub the helper.pushModifiedItems method to return a rejected promise.
                const PULL_ERROR = "Error pulling items, expected by unit test.";
                const stubPull = sinon.stub(helper, "pullModifiedItems");
                stubPull.rejects(PULL_ERROR);

                // Execute the command to push the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "pull", switches, "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        if (switches === "--pages") {
                            // Verify that the stub was called twice (once for each site), and that the expected message was returned.
                            expect(stubPull).to.have.been.calledTwice;
                            expect(err.message).to.contain('2 errors');
                        } else {
                            // Verify that the stub was called once, and that the expected message was returned.
                            expect(stubPull).to.have.been.calledOnce;
                            expect(err.message).to.contain('1 error');
                        }
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed methods.
                        stubPull.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test pull modified failure, don't continue on error", function (done) {
                // Create a stub to return a value for the "continueOnError" key.
                const originalGetProperty = options.getProperty.bind(options);
                const stubGet = sinon.stub(options, "getProperty", function (context, key) {
                    if (key === "continueOnError") {
                        return false;
                    } else {
                        return originalGetProperty(context, key);
                    }
                });

                // Stub the helper.pushModifiedItems method to return a rejected promise.
                const PULL_ERROR = "Error pulling items, expected by unit test.";
                const stubPull = sinon.stub(helper, "pullModifiedItems");
                stubPull.rejects(PULL_ERROR);

                // Execute the command to push the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "pull", switches, "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once, and that the expected message was returned.
                        expect(stubPull).to.have.been.calledOnce;
                        expect(err.message).to.contain('1 error');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed methods.
                        stubGet.restore();
                        stubPull.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test pull failure", function (done) {
                if (switches !== "-a" ) {
                    return done();
                }

                const PULL_ERROR = "Error pulling assets, expected by unit test.";
                const stub = sinon.stub(ToolsApi, "getAssetsHelper");
                stub.throws(new Error(PULL_ERROR));

                // Execute the command to pull assets.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "pull", switches, "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // Verify that the expected message was returned.
                        expect(err.message).to.contain(PULL_ERROR);
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

    testPullByManifest (helper, switches, itemName1, itemName2, badItem) {
        describe("CLI-unit-pull-manifest-fail", function () {
            it("fails if initializeManifests fails", function (done) {
                const stub = sinon.stub(manifests, "initializeManifests");
                stub.rejects(false);

                // Execute the command to pull using a manifest.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "pull", switches, '-v', "--manifest", "foo", '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // Verify that the expected message was returned.
                        expect(err.message).to.contain("could not be read");
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

                // Create a stub to return a value for the "tier" key.
                const originalGetProperty = options.getProperty.bind(options);
                const stubGet = sinon.stub(options, "getProperty", function (context, key) {
                    if (key === "tier") {
                        return "Base";
                    } else {
                        return originalGetProperty(context, key);
                    }
                });

                // Execute the command to pull using a manifest.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "pull", switches, '-v', "--manifest", "foo", '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
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
                        stubGet.restore();

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

                // Execute the command to pull using a manifest.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "pull", switches, '-v', "--manifest", "foo", '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
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
        });

        describe("CLI-unit-pull-manifest-succeed", function () {
            it("test emitters working", function (done) {
                const stubInit = sinon.stub(manifests, "initializeManifests");
                stubInit.resolves(true);

                const stubSection = sinon.stub(manifests, "getManifestSection");
                stubSection.returns(undefined);
                stubSection.withArgs(sinon.match.any, helper.getArtifactName()).returns({id1: {name: "foo", path: "bar"}, id2: {name: "ack", path: "nak"}});
                if (switches === "--pages") {
                    stubSection.withArgs(sinon.match.any, "sites").returns({id1: {name: "foo", path: "bar"}, id2: {name: "ack", path: "nak"}});
                }

                // Stub the helper.pullManifestItems method to return a promise that is resolved after emitting events.
                const stubPull = sinon.stub(helper, "pullManifestItems", function (context) {
                    // When the stubbed method is called, return a promise that will be resolved asynchronously.
                    const stubDeferred = Q.defer();
                    setTimeout(function () {
                        const emitter = helper.getEventEmitter(context);
                        emitter.emit("pulled", {name: itemName1, id: undefined, path: itemName1});
                        emitter.emit("pulled", {name: itemName2, id: undefined, path: itemName2});
                        emitter.emit("pulled-error", {message: "This failure was expected by the unit test"}, badItem);
                        emitter.emit("pulled-error", {message: "This failure was expected by the unit test"}, {name: "fail-name", id: "fail-id", path: "fail-path"});
                        stubDeferred.resolve();
                    }, 0);
                    return stubDeferred.promise;
                });

                // Execute the command to push the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "pull", switches, '-v', "--manifest", "foo", '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function (msg) {
                        if (switches === "--pages") {
                            // Verify that the pull stub was called twice (once for each site), and that the expected message was returned.
                            expect(stubPull).to.have.been.calledTwice;
                            expect(msg).to.contain('4 artifacts successfully');
                            expect(msg).to.contain('4 errors');
                        } else  {
                            // Verify that the pull stub was called once, and that the expected message was returned.
                            expect(stubPull).to.have.been.calledOnce;
                            expect(msg).to.contain('2 artifacts successfully');
                            expect(msg).to.contain('2 errors');
                        }
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed method.
                        stubInit.restore();
                        stubSection.restore();
                        stubPull.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("succeed even if save mainfest fails", function (done) {
                const stubInit = sinon.stub(manifests, "initializeManifests");
                stubInit.resolves(true);

                const stubSection = sinon.stub(manifests, "getManifestSection");
                stubSection.returns(undefined);
                stubSection.withArgs(sinon.match.any, helper.getArtifactName()).returns({id1: {name: "foo", path: "bar"}, id2: {name: "ack", path: "nak"}});
                if (switches === "--pages") {
                    stubSection.withArgs(sinon.match.any, "sites").returns({id1: {name: "foo", path: "bar"}, id2: {name: "ack", path: "nak"}});
                }

                const stubSave = sinon.stub(manifests, "saveManifest");
                stubSave.throws(new Error("Save manifest error expected by unit test."));

                // Stub the helper.pullManifestItems method to return a promise that is resolved after emitting events.
                const stubPull = sinon.stub(helper, "pullManifestItems", function (context) {
                    // When the stubbed method is called, return a promise that will be resolved asynchronously.
                    const stubDeferred = Q.defer();
                    setTimeout(function () {
                        const emitter = helper.getEventEmitter(context);
                        emitter.emit("pulled", {name: itemName1, id: undefined, path: itemName1});
                        emitter.emit("pulled", {name: itemName2, id: undefined, path: itemName2});
                        emitter.emit("pulled-error", {message: "This failure was expected by the unit test"}, badItem);
                        emitter.emit("pulled-error", {message: "This failure was expected by the unit test"}, {name: "fail-name", id: "fail-id", path: "fail-path"});
                        stubDeferred.resolve();
                    }, 0);
                    return stubDeferred.promise;
                });

                // Execute the command to push the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "pull", switches, '-v', "--manifest", "foo", '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api'])
                    .then(function (msg) {
                        if (switches === "--pages") {
                            // Verify that the pull stub was called twice (once for each site), and that the expected message was returned.
                            expect(stubPull).to.have.been.calledTwice;
                            expect(msg).to.contain('4 artifacts successfully');
                            expect(msg).to.contain('4 errors');
                        } else {
                            // Verify that the pull stub was called once, and that the expected message was returned.
                            expect(stubPull).to.have.been.calledOnce;
                            expect(msg).to.contain('2 artifacts successfully');
                            expect(msg).to.contain('2 errors');
                        }

                        // Verify that the manifest was only saved once, after all pulls are completed.
                        expect(stubSave).to.have.been.calledOnce;
                        expect(stubSave).to.have.been.calledAfter(stubPull);
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed method.
                        stubInit.restore();
                        stubSection.restore();
                        stubSave.restore();
                        stubPull.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testPullParamFail (helper, switches) {
        describe("CLI-unit-pulling", function () {
            const command = 'pull';
            it("test fail extra param", function (done) {
                // Execute the command to list the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, command, switches, 'foo'])
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

            it("test fail arg validation when --deletions used with --by-type-name", function (done) {
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, command, switches, '--by-type-name', 'asdf', '--deletions'])
                    .then(function (/*msg*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the expected error message was returned.
                            expect(err.message).to.contain('--deletions');
                            expect(err.message).to.contain('--by-type-name');
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test fail arg validation when --deletions used with --manifest", function (done) {
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, command, switches, '--manifest', 'foo', '--deletions'])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // Verify that the expected error message was returned.
                        expect(err.message).to.contain('--manifest');
                        expect(err.message).to.contain('--deletions');
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test fail arg validation when --write-deletions-manifest used without --deletions", function (done) {
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, command, switches, '--write-deletions-manifest', 'foo'])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // Verify that the expected error message was returned.
                        expect(err.message).to.contain('deletions manifest');
                        expect(err.message).to.contain('--deletions');
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test fail arg validation when --image-profiles used with --by-type-name", function (done) {
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, command, switches, '-A', '--by-type-name', 'asdf', '--image-profiles'])
                    .then(function (/*msg*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the expected error message was returned.
                            expect(err.message).to.contain('Invalid artifact type');
                            expect(err.message).to.contain('--by-type-name');
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test fail arg validation when no artifact type specified with --by-type-name", function (done) {
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, command, switches, '--by-type-name', 'asdf', '--image-profiles'])
                    .then(function (/*msg*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the expected error message was returned.
                            expect(err.message).to.contain('supports');
                            expect(err.message).to.contain('--by-type-name');
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
                const stub = sinon.stub(fs, "mkdirSync");
                stub.throws("BAD DIRECTORY");

                // Execute the command to list the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, command, switches, '--dir', '....'])
                    .then(function (/*msg*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        try {
                            // The stub should only have been called once, and the expected message should be returned.
                            expect(stub).to.have.been.calledOnce;
                            expect(err.message).to.contain("....");
                            expect(err.message).to.contain("could not be created");
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

            it("test fails when initialization fails", function (done) {
                const INIT_ERROR = "API initialization failed, as expected by unit test.";
                const stub = sinon.stub(ToolsApi, "getInitializationErrors");
                stub.returns([new Error(INIT_ERROR)]);

                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, command, switches, "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
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

                const stubInit = sinon.stub(manifests, "initializeManifests");
                stubInit.resolves(true);

                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, command, switches, "--ready", "--draft", "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
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
                        stubInit.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail if both ready and manifest specified", function (done) {
                const stubInit = sinon.stub(manifests, "initializeManifests");
                stubInit.resolves(true);

                const stubSection = sinon.stub(manifests, "getManifestSection");
                stubSection.returns(undefined);
                stubSection.withArgs(sinon.match.any, helper.getArtifactName()).returns({id1: {name: "foo", path: "bar"}, id2: {name: "ack", path: "nak"}});
                if (switches === "--pages") {
                    stubSection.withArgs(sinon.match.any, "sites").returns({id1: {name: "foo", path: "bar"}, id2: {name: "ack", path: "nak"}});
                }

                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, command, switches, "--ready", "--manifest", "foo", "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        expect(err.message).to.contain("cannot specifiy both ready and manifest");
                    })
                    .catch (function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        stubInit.restore();
                        stubSection.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail if both draft and manifest specified", function (done) {
                // TODO Enable when --draft option is avaiable.
                if (!DRAFT_OPTION) {
                    return done();
                }

                const stubInit = sinon.stub(manifests, "initializeManifests");
                stubInit.resolves(true);

                const stubSection = sinon.stub(manifests, "getManifestSection");
                stubSection.returns(undefined);
                stubSection.withArgs(sinon.match.any, helper.getArtifactName()).returns({id1: {name: "foo", path: "bar"}, id2: {name: "ack", path: "nak"}});
                if (switches === "--pages") {
                    stubSection.withArgs(sinon.match.any, "sites").returns({id1: {name: "foo", path: "bar"}, id2: {name: "ack", path: "nak"}});
                }

                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, command, switches, "--draft", "--manifest", "foo", "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        expect(err.message).to.contain("cannot specifiy both draft and manifest");
                    })
                    .catch (function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        stubInit.restore();
                        stubSection.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail if path specified when not supported", function (done) {
                if (switches === "-w" || switches === "--types" || switches === "--layouts" || switches === "--layout-mappings") {
                    return done();
                }

                const stubInit = sinon.stub(manifests, "initializeManifests");
                stubInit.resolves(true);

                const stubSection = sinon.stub(manifests, "getManifestSection");
                stubSection.returns(undefined);
                stubSection.withArgs(sinon.match.any, helper.getArtifactName()).returns({id1: {name: "foo", path: "bar"}, id2: {name: "ack", path: "nak"}});
                if (switches === "--pages") {
                    stubSection.withArgs(sinon.match.any, "sites").returns({id1: {name: "foo", path: "bar"}, id2: {name: "ack", path: "nak"}});
                }

                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, command, switches, "--path", "foo", "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        expect(err.message).to.contain("path can only be used for web assets, content types, layouts, and layout mappings.");
                    })
                    .catch (function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        stubInit.restore();
                        stubSection.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testPullByTypeName (helper, switches, itemName1, itemName2, badItem) {
        const DOWNLOAD_TARGET = UnitTest.DOWNLOAD_DIR; // Relative to the CLI directory.
        describe("CLI-unit-pulling-by-type-name " + switches, function () {
            it("test emitters working", function (done) {
                // Stub the helper.pullModifiedItems method to return a promise that is resolved after emitting events.
                const item = {"id":UnitTest.DUMMY_ID, name: itemName1, "thumbnail":{"id":"thumbnail-asset-id"},
                    "elements":[{"elementType":"image", "key":"image"}, {"elementType":"reference"}]};
                const typeSearchStub = sinon.stub(helper, "searchRemote", function () {
                    // When the stubbed method is called, return a promise that will be resolved asynchronously.
                    const stubDeferred = Q.defer();
                    setTimeout(function () {
                        stubDeferred.resolve([item] );
                    }, 0);
                    return stubDeferred.promise;
                });
                const typeItemStub = sinon.stub(helper, "pullItem", function (context) {
                    // When the stubbed method is called, return a promise that will be resolved asynchronously.
                    const stubDeferred = Q.defer();
                    setTimeout(function () {
                        const emitter = helper.getEventEmitter(context);
                        emitter.emit("pulled", {name: itemName1, id: UnitTest.DUMMY_ID, path: itemName1});
                        emitter.emit("pulled-error", {message: "This type failure was expected by the unit test"}, badItem);
                        emitter.emit("post-process", item);
                        stubDeferred.resolve(item);
                    }, 0);
                    return stubDeferred.promise;
                });
                const contentItem = { "name": "content-1", "id": "content-1", "path": "none",
                    "elements": {
                        "image":{
                            "renditions":{"thumbnail":{"renditionId":"asset-thumbnail-rendition-id"}},
                            "asset": {"id":"content-asset-id"},
                        },
                        "thumbnail": { "renditionId" : "content-thumbnail-rendition-id", "source": "somesource" },
                    }
                };
                // Stub the helper.pullModifiedItems method to return a promise that is resolved after emitting events.
                const contentHelper = ToolsApi.getContentHelper();
                const contentSearchStub = sinon.stub(contentHelper, "searchRemote", function () {
                    // When the stubbed method is called, return a promise that will be resolved asynchronously.
                    const stubDeferred = Q.defer();
                    setTimeout(function () {
                        stubDeferred.resolve([{"id":"content-1"}]);
                    }, 0);
                    return stubDeferred.promise;
                });
                const contentItemStub = sinon.stub(contentHelper, "pullItem", function (context) {
                    // When the stubbed method is called, return a promise that will be resolved asynchronously.
                    const stubDeferred = Q.defer();
                    setTimeout(function () {
                        const emitter = helper.getEventEmitter(context);
                        emitter.emit("pulled", contentItem );
                        emitter.emit("pulled-error", {message: "This content failure was expected by the unit test"}, badItem);
                        emitter.emit("post-process", contentItem);
                        stubDeferred.resolve();
                    }, 0);
                    return stubDeferred.promise;
                });
                const assetHelper = ToolsApi.getAssetsHelper();
                const assetStub = sinon.stub(assetHelper, "pullItem", function (context) {
                    // When the stubbed method is called, return a promise that will be resolved asynchronously.
                    const stubDeferred = Q.defer();
                    setTimeout(function () {
                        const emitter = helper.getEventEmitter(context);
                        emitter.emit("pulled", {"id":"asset-id", "path":"/some-asset-path", "name":"some-asset"} );
                        emitter.emit("pulled-error", {message: "This asset failure was expected by the unit test"}, badItem);
                        stubDeferred.resolve();
                    }, 0);
                    return stubDeferred.promise;
                });
                const renditionsHelper = ToolsApi.getRenditionsHelper();
                const renditionsStub = sinon.stub(renditionsHelper, "pullItem", function (context) {
                    // When the stubbed method is called, return a promise that will be resolved asynchronously.
                    const stubDeferred = Q.defer();
                    setTimeout(function () {
                        const emitter = helper.getEventEmitter(context);
                        emitter.emit("pulled", {"id":"rendition-id", "path":"/some-rendition-path", "name":"some-rendition"} );
                        emitter.emit("pulled-error", {message: "This rendition failure was expected by the unit test"}, badItem);
                        stubDeferred.resolve();
                    }, 0);
                    return stubDeferred.promise;
                });

                // Execute the command to pull the items to the download directory.
                let error;
                const downloadTarget = DOWNLOAD_TARGET;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "pull", switches, "--by-type-name", "Article", "--dir", downloadTarget,'--user','foo','--password','password', '--url', 'http://foo.bar/api','-v'])
                    .then(function (msg) {
                        // Verify that the stub was called once, and that the expected message was returned.
                        expect(typeSearchStub).to.have.been.calledOnce;
                        expect(typeItemStub).to.have.been.calledOnce;
                        expect(contentSearchStub).to.have.been.calledOnce;
                        expect(contentItemStub).to.have.been.calledOnce;
                        expect(msg).to.contain('artifacts successfully');
                        expect(msg).to.contain('error');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's "pullModifiedItems" method.
                        typeItemStub.restore();
                        typeSearchStub.restore();
                        contentSearchStub.restore();
                        contentItemStub.restore();
                        assetStub.restore();
                        renditionsStub.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }
}

module.exports = PullUnitTest;
