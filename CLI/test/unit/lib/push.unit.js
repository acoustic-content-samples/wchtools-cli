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
 * Unit tests for the push command.
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
const uuid = require("uuid");
const Q = require("q");
const sinon = require("sinon");
const ToolsApi = require("wchtools-api");
const toolsCli = require("../../../wchToolsCli");
const mkdirp = require("mkdirp");
const events = require("events");

// Require the local modules that will be stubbed, mocked, and spied.
const options = require("wchtools-api").getOptions();

class PushUnitTest extends UnitTest {
    constructor () {
        super();
    }

    run (helper, switches, itemName1, itemName2, badItem) {
        const self = this;
        describe("Unit tests for push  " + switches, function () {
            let stubLogin;
            before(function (done) {
                mkdirp.sync(UnitTest.DOWNLOAD_DIR);
                stubLogin = sinon.stub(self.getLoginHelper(), "login");
                stubLogin.resolves("Adam.iem@mailinator.com");
                done();
            });

            after(function (done) {
                rimraf.sync(UnitTest.DOWNLOAD_DIR);
                stubLogin.restore();
                done();
            });

            // Run each of the tests defined in this class.
            self.testPush(helper, switches, itemName1, itemName2, badItem);
            self.testPushUrlOption(helper, switches, itemName1, itemName2, badItem);
            self.testPushParamFail(switches);
        });
    }

    testPush (helper, switches, itemName1, itemName2, badItem) {
        const DOWNLOAD_TARGET = UnitTest.DOWNLOAD_DIR; // Relative to the CLI directory.
        describe("CLI-unit-pushing", function () {
            it("test emitters working", function (done) {
                // Stub the helper.pushModifiedItems method to return a promise that is resolved after emitting events.
                const stub = sinon.stub(helper, "pushModifiedItems", function (context) {
                    // When the stubbed method is called, return a promise that will be resolved asynchronously.
                    const stubDeferred = Q.defer();
                    setTimeout(function () {
                        const emitter = helper.getEventEmitter(context);
                        emitter.emit("pushed", itemName1);
                        emitter.emit("pushed", itemName2);
                        emitter.emit("pushed-error", {message: "This failure was expected by the unit test"}, badItem);
                        stubDeferred.resolve();
                    }, 0);
                    return stubDeferred.promise;
                });

                // Execute the command to push the items to the download directory.
                let error;
                const unique = uuid.v4();
                const downloadTarget = DOWNLOAD_TARGET + unique;
                mkdirp.sync(downloadTarget);
                toolsCli.parseArgs(['', UnitTest.COMMAND, "push", switches, "--dir", downloadTarget, '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api', '-v'])
                    .then(function (msg) {
                        // Verify that the stub was called once, and that the expected message was returned.
                        expect(stub).to.have.been.calledOnce;
                        expect(msg).to.contain('2 artifacts successfully');
                        expect(msg).to.contain('1 error');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's "pushModifiedItems" method.
                        stub.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test generic push working", function (done) {
                // Stub the helper.pushModifiedItems method to return a promise that is resolved after emitting events.
                const stub = sinon.stub(helper, "pushModifiedItems", function (context) {
                    // When the stubbed method is called, return a promise that will be resolved asynchronously.
                    const stubDeferred = Q.defer();
                    setTimeout(function () {
                        const emitter = helper.getEventEmitter(context);
                        emitter.emit("pushed", itemName1);
                        emitter.emit("pushed", itemName2);
                        emitter.emit("pushed-error", {message: "This failure was expected by the unit test"}, badItem);
                        stubDeferred.resolve();
                    }, 0);
                    return stubDeferred.promise;
                });

                // Execute the command to push the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "push", switches, "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
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
                        // Restore the helper's "pushModifiedItems" method.
                        stub.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test push no directories", function (done) {
                // Stub the helper.pushModifiedItems method to return a promise that is resolved after emitting events.
                const stub = sinon.stub(helper, "pushModifiedItems", function () {
                    // When the stubbed method is called, return a promise that will be resolved asynchronously.
                    const stubDeferred = Q.defer();
                    setTimeout(function () {
                        stubDeferred.resolve();
                    }, 0);
                    return stubDeferred.promise;
                });

                // Stub the helper.doesDirectoryExist method to return false.
                const stubExist = sinon.stub(helper, "doesDirectoryExist");
                stubExist.returns(false);

                // Execute the command to push the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "push", switches, "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // Verify that the expected error was specified.
                        expect(err.message).to.contain("does not contain any directories");
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's methods.
                        stub.restore();
                        stubExist.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test push no items ignore timestamps", function (done) {
                // Stub the helper.pushAllItems method to return a promise that is resolved after emitting events.
                const stub = sinon.stub(helper, "pushAllItems", function () {
                    // When the stubbed method is called, return a promise that will be resolved asynchronously.
                    const stubDeferred = Q.defer();
                    setTimeout(function () {
                        stubDeferred.resolve();
                    }, 0);
                    return stubDeferred.promise;
                });

                // Stub the helper.doesDirectoryExist method to return true.
                const stubExist = sinon.stub(helper, "doesDirectoryExist");
                stubExist.returns(true);

                // Execute the command to push the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "push", switches, "-I", "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function (msg) {
                        // Verify that the expected error was specified.
                        expect(msg).to.contain("No items to be pushed");
                        expect(stub).to.have.been.calledOnce;
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's methods.
                        stub.restore();
                        stubExist.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test push no items", function (done) {
                // Stub the helper.pushModifiedItems method to return a promise that is resolved after emitting events.
                const stub = sinon.stub(helper, "pushModifiedItems", function () {
                    // When the stubbed method is called, return a promise that will be resolved asynchronously.
                    const stubDeferred = Q.defer();
                    setTimeout(function () {
                        stubDeferred.resolve();
                    }, 0);
                    return stubDeferred.promise;
                });

                // Stub the helper.doesDirectoryExist method to return true.
                const stubExist = sinon.stub(helper, "doesDirectoryExist");
                stubExist.returns(true);

                // Execute the command to push the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "push", switches, "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function (msg) {
                        // Verify that the expected error was specified.
                        expect(msg).to.contain("nothing has been modified locally");
                        expect(stub).to.have.been.calledOnce;
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's methods.
                        stub.restore();
                        stubExist.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test successful push of named item", function (done) {
                // Stub the helper.pushModifiedItems method to return a promise that is resolved after emitting events.
                const stub = sinon.stub(helper, "pushItem", function (context) {
                    // When the stubbed method is called, return a promise that will be resolved asynchronously.
                    const stubDeferred = Q.defer();
                    setTimeout(function () {
                        const emitter = helper.getEventEmitter(context);
                        emitter.emit("pushed", itemName1);
                        stubDeferred.resolve({id: "foo", name: itemName1});
                    }, 0);
                    return stubDeferred.promise;
                });

                // Execute the command to push the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "push", switches, "--named", itemName1, "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function (msg) {
                        // Verify that the stub was called once, and that the expected message was returned.
                        expect(stub).to.have.been.calledOnce;
                        expect(msg).to.contain('1 artifact');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's "pushModifiedItems" method.
                        stub.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test successful push of both types of assets", function (done) {
                if (switches !== "-a" ) {
                    return done();
                }

                // Stub the helper.pushModifiedItems method to return a promise that is resolved after emitting events.
                const stub = sinon.stub(helper, "pushModifiedItems", function (context) {
                    // When the stubbed method is called, return a promise that will be resolved asynchronously.
                    const stubDeferred = Q.defer();
                    setTimeout(function () {
                        const emitter = helper.getEventEmitter(context);
                        emitter.emit("pushed", itemName1);
                        stubDeferred.resolve();
                    }, 0);
                    return stubDeferred.promise;
                });

                // Execute the command to push the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "push", "-aw", "--path", ".", "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function (msg) {
                        // Verify that the stub was called once, and that the expected message was returned.
                        expect(stub).to.have.been.calledOnce;
                        expect(msg).to.contain('1 artifact');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's "pushModifiedItems" method.
                        stub.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test successful push of web asset with path", function (done) {
                if (switches !== "-w" ) {
                    return done();
                }

                // Stub the helper.pushModifiedItems method to return a promise that is resolved after emitting events.
                const stub = sinon.stub(helper, "pushModifiedItems", function (context) {
                    // When the stubbed method is called, return a promise that will be resolved asynchronously.
                    const stubDeferred = Q.defer();
                    setTimeout(function () {
                        const emitter = helper.getEventEmitter(context);
                        emitter.emit("pushed", itemName1);
                        stubDeferred.resolve();
                    }, 0);
                    return stubDeferred.promise;
                });

                // Execute the command to push the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "push", switches, "--path", ".", "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function (msg) {
                        // Verify that the stub was called once, and that the expected message was returned.
                        expect(stub).to.have.been.calledOnce;
                        expect(msg).to.contain('1 artifact');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's "pushModifiedItems" method.
                        stub.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test failure pushing web asset with path", function (done) {
                if (switches !== "-w" ) {
                    return done();
                }

                // Stub the helper.pushModifiedItems method to return a promise that is resolved after emitting events.
                const stub = sinon.stub(helper, "pushModifiedItems", function (context) {
                    // When the stubbed method is called, return a promise that will be resolved asynchronously.
                    const stubDeferred = Q.defer();
                    setTimeout(function () {
                        const emitter = helper.getEventEmitter(context);
                        emitter.emit("pushed-error", {message: "This failure was expected by the unit test"}, badItem);
                        stubDeferred.resolve();
                    }, 0);
                    return stubDeferred.promise;
                });

                // Execute the command to push the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "push", switches, "--path", ".", "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once, and that the expected message was returned.
                        expect(stub).to.have.been.calledOnce;
                        expect(err.message).to.contain('1 error');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the helper's "pushModifiedItems" method.
                        stub.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test push ignore-timestamps working", function (done) {
                // Stub the helper.pushAllItems method to return a promise that is resolved after emitting events.
                const stub = sinon.stub(helper, "pushAllItems", function (context) {
                    // When the stubbed method is called, return a promise that will be resolved asynchronously.
                    const stubDeferred = Q.defer();
                    setTimeout(function () {
                        const emitter = helper.getEventEmitter(context);
                        emitter.emit("pushed", itemName1);
                        emitter.emit("pushed", itemName2);
                        stubDeferred.resolve();
                    }, 0);
                    return stubDeferred.promise;
                });

                // Execute the command to pull the items to the download directory.
                let error;
                const downloadTarget = DOWNLOAD_TARGET;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "push", switches, "--ignore-timestamps", "--dir", downloadTarget, '--user', 'foo', '--password', 'password', '--url', 'http://foo.bar/api','-v'])
                    .then(function (msg) {
                        // Verify that the stub was called once, and that the expected message was returned.
                        expect(stub).to.have.been.calledOnce;
                        expect(msg).to.contain('2 artifacts');
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

            it("test push failure", function (done) {
                if (switches !== "-a" ) {
                    return done();
                }

                const PUSH_ERROR = "Error pushing assets, expected by unit test.";
                const stub = sinon.stub(ToolsApi, "getAssetsHelper");
                stub.throws(new Error(PUSH_ERROR));

                // Execute the command to push assets.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "push", switches, "--force-override", "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // Verify that the expected message was returned.
                        expect(err.message).to.contain(PUSH_ERROR);
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

    testPushUrlOption (helper, switches, itemName1, itemName2, badItem) {
        describe("CLI-unit-push-url-option", function () {
            it("test push modified failure, continue on error", function (done) {
                // Stub the helper.pushModifiedItems method to return a rejected promise.
                const PUSH_ERROR = "Error pushing items, expected by unit test.";
                const stubPush = sinon.stub(helper, "pushModifiedItems");
                stubPush.rejects(PUSH_ERROR);

                // Execute the command to push the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "push", switches, "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once, and that the expected message was returned.
                        expect(stubPush).to.have.been.calledOnce;
                        expect(err.message).to.contain('1 error');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed methods.
                        stubPush.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test push modified failure, don't continue on error", function (done) {
                // Create a stub to return a value for the "continueOnError" key.
                const originalGetProperty = options.getProperty;
                const stubGet = sinon.stub(options, "getProperty", function (context, key) {
                    if (key === "continueOnError") {
                        return false;
                    } else {
                        return originalGetProperty(context, key);
                    }
                });

                // Stub the helper.pushModifiedItems method to return a rejected promise.
                const PUSH_ERROR = "Error pushing items, expected by unit test.";
                const stubPush = sinon.stub(helper, "pushModifiedItems");
                stubPush.rejects(PUSH_ERROR);

                // Execute the command to push the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "push", switches, "--user", "foo", "--password", "password", "--url", "http://foo.bar/api"])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // Verify that the stub was called once, and that the expected message was returned.
                        expect(stubPush).to.have.been.calledOnce;
                        expect(err.message).to.contain('1 error');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed methods.
                        stubGet.restore();
                        stubPush.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test generic push with configured URL", function (done) {
                // Stub the options.getProperty method to return a base URL value.
                const originalGetProperty = options.getProperty;
                const BASE_URL = "http://www.ibm.com/foo/api";
                const stubGet = sinon.stub(options, "getProperty", function (context, key) {
                    // When the stubbed method is called with the key for the base URL, return a known value.
                    if (key === "x-ibm-dx-tenant-base-url") {
                        return BASE_URL;
                    } else {
                        return originalGetProperty(context, key);
                    }
                });

                // Stub the prompt.get method to make sure it doesn't get called.
                const stubPrompt = sinon.stub(prompt, "get");

                // Stub the helper.pushModifiedItems method to return a promise that is resolved after emitting events.
                const stubPush = sinon.stub(helper, "pushModifiedItems", function (context) {
                    // When the stubbed method is called, return a promise that will be resolved asynchronously.
                    const stubDeferred = Q.defer();
                    setTimeout(function () {
                        const emitter = helper.getEventEmitter(context);
                        emitter.emit("pushed", itemName1);
                        emitter.emit("pushed", itemName2);
                        emitter.emit("pushed-error", {message: "This failure was expected by the unit test"}, badItem);
                        stubDeferred.resolve();
                    }, 0);
                    return stubDeferred.promise;
                });

                // Execute the command to push the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "push", switches, "--user", "foo", "--password", "password"])
                    .then(function (msg) {
                        // Verify that the get stub was called with the expected value.
                        expect(stubGet).to.have.been.calledWith(sinon.match.any, "x-ibm-dx-tenant-base-url");

                        // Verify that the prompt stub was not called.
                        expect(stubPrompt).to.not.have.been.called;

                        // Verify that the push stub was called once, and that the expected message was returned.
                        expect(stubPush).to.have.been.calledOnce;
                        expect(msg).to.contain('2 artifacts successfully');
                        expect(msg).to.contain('1 error');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed methods.
                        stubGet.restore();
                        stubPrompt.restore();
                        stubPush.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test generic push with configured tenant ID", function (done) {
                // Stub the options.getProperty method to return a tenant ID value.
                const originalGetProperty = options.getProperty;
                const TENANT_ID = "1234567890";
                const stubGet = sinon.stub(options, "getProperty", function (context, key) {
                    // When the stubbed method is called with the key for the base URL, return null.
                    // When the stubbed method is called with the key for the tenant ID, return a known value.
                    if (key === "x-ibm-dx-tenant-base-url") {
                        return null;
                    } else if (key === "x-ibm-dx-tenant-id") {
                        return TENANT_ID;
                    } else {
                        return originalGetProperty(context, key);
                    }
                });

                // Stub the prompt.get method to make sure it doesn't get called.
                const stubPrompt = sinon.stub(prompt, "get");

                // Stub the helper.pushModifiedItems method to return a promise that is resolved after emitting events.
                const stubPush = sinon.stub(helper, "pushModifiedItems", function (context) {
                    // When the stubbed method is called, return a promise that will be resolved asynchronously.
                    const stubDeferred = Q.defer();
                    setTimeout(function () {
                        const emitter = helper.getEventEmitter(context);
                        emitter.emit("pushed", itemName1);
                        emitter.emit("pushed", itemName2);
                        emitter.emit("pushed-error", {message: "This failure was expected by the unit test"}, badItem);
                        stubDeferred.resolve();
                    }, 0);
                    return stubDeferred.promise;
                });

                // Execute the command to push the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "push", switches, "--user", "foo", "--password", "password"])
                    .then(function (msg) {
                        // Verify that the get stub was called with the expected values.
                        expect(stubGet).to.have.been.calledWith(sinon.match.any, "x-ibm-dx-tenant-base-url");
                        expect(stubGet).to.have.been.calledWith(sinon.match.any, "x-ibm-dx-tenant-id");

                        // Verify that the prompt stub was not called.
                        expect(stubPrompt).to.not.have.been.called;

                        // Verify that the push stub was called once, and that the expected message was returned.
                        expect(stubPush).to.have.been.calledOnce;
                        expect(msg).to.contain('2 artifacts successfully');
                        expect(msg).to.contain('1 error');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed methods.
                        stubGet.restore();
                        stubPrompt.restore();
                        stubPush.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test generic push with URL prompt failure", function (done) {
                // Stub the options.getProperty method to return a base URL value.
                const originalGetProperty = options.getProperty;
                const stubGet = sinon.stub(options, "getProperty", function (context, key) {
                    // When the stubbed method is called with the key for the base URL or the tenant ID, return null.
                    if (key === "x-ibm-dx-tenant-base-url" || key === "x-ibm-dx-tenant-id") {
                        return null;
                    } else {
                        return originalGetProperty(context, key);
                    }
                });

                // Stub the prompt.get method to pass an error to the callback function.
                const stubPrompt = sinon.stub(prompt, "get");
                const PROMPT_ERROR = "An expected prompt error while executing a unit test.";
                stubPrompt.yields(new Error(PROMPT_ERROR));

                // Execute the command to push the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "push", switches, "--user", "foo", "--password", "password"])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // Verify that the get stub was called with the expected values.
                        expect(stubGet).to.have.been.calledWith(sinon.match.any, "x-ibm-dx-tenant-base-url");
                        expect(stubGet).to.have.been.calledWith(sinon.match.any, "x-ibm-dx-tenant-id");

                        // Verify that the prompt stub was called once.
                        expect(stubPrompt).to.have.been.calledOnce;

                        // Verify that the expected error was specified.
                        expect(err.message).to.equal(PROMPT_ERROR);
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed methods.
                        stubGet.restore();
                        stubPrompt.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test generic push with invalid prompted URL", function (done) {
                // Stub the options.getProperty method to return a base URL value.
                const originalGetProperty = options.getProperty;
                const stubGet = sinon.stub(options, "getProperty", function (context, key) {
                    // When the stubbed method is called with the key for the base URL or the tenant ID, return null.
                    if (key === "x-ibm-dx-tenant-base-url" || key === "x-ibm-dx-tenant-id") {
                        return null;
                    } else {
                        return originalGetProperty(context, key);
                    }
                });

                // Stub the prompt.get method to pass an error to the callback function.
                const stubPrompt = sinon.stub(prompt, "get");
                stubPrompt.yields(null, {"url": "Invalid URL"});

                // Execute the command to push the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "push", switches, "--user", "foo", "--password", "password"])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // Verify that the get stub was called with the expected values.
                        expect(stubGet).to.have.been.calledWith(sinon.match.any, "x-ibm-dx-tenant-base-url");
                        expect(stubGet).to.have.been.calledWith(sinon.match.any, "x-ibm-dx-tenant-id");

                        // Verify that the prompt stub was called once.
                        expect(stubPrompt).to.have.been.calledOnce;

                        // Verify that the expected error was specified.
                        expect(err.message).to.contain("not valid");
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed methods.
                        stubGet.restore();
                        stubPrompt.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test generic push with prompted URL", function (done) {
                // Stub the options.getProperty method to return a base URL value.
                const originalGetProperty = options.getProperty;
                const stubGet = sinon.stub(options, "getProperty", function (context, key) {
                    // When the stubbed method is called with the key for the base URL or the tenant ID, return null.
                    if (key === "x-ibm-dx-tenant-base-url" || key === "x-ibm-dx-tenant-id") {
                        return null;
                    } else {
                        return originalGetProperty(context, key);
                    }
                });

                // Stub the prompt.get method to pass an error to the callback function.
                const stubPrompt = sinon.stub(prompt, "get");
                const BASE_URL = "http://www.ibm.com/foo/api";
                stubPrompt.yields(null, {"url": BASE_URL});

                // Stub the helper.pushModifiedItems method to return a promise that is resolved after emitting events.
                const stubPush = sinon.stub(helper, "pushModifiedItems", function (context) {
                    // When the stubbed method is called, return a promise that will be resolved asynchronously.
                    const stubDeferred = Q.defer();
                    setTimeout(function () {
                        const emitter = helper.getEventEmitter(context);
                        emitter.emit("pushed", itemName1);
                        emitter.emit("pushed", itemName2);
                        emitter.emit("pushed-error", {message: "This failure was expected by the unit test"}, badItem);
                        stubDeferred.resolve();
                    }, 0);
                    return stubDeferred.promise;
                });

                // Execute the command to push the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "push", switches, "--user", "foo", "--password", "password"])
                    .then(function (msg) {
                        // Verify that the get stub was called with the expected values.
                        expect(stubGet).to.have.been.calledWith(sinon.match.any, "x-ibm-dx-tenant-base-url");
                        expect(stubGet).to.have.been.calledWith(sinon.match.any, "x-ibm-dx-tenant-id");

                        // Verify that the prompt stub was called once.
                        expect(stubPrompt).to.have.been.calledOnce;

                        // Verify that the push stub was called once, and that the expected message was returned.
                        expect(stubPush).to.have.been.calledOnce;
                        expect(msg).to.contain('2 artifacts successfully');
                        expect(msg).to.contain('1 error');
                    })
                    .catch(function (err) {
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Restore the stubbed methods.
                        stubGet.restore();
                        stubPrompt.restore();
                        stubPush.restore();

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test generic push with invalid specified URL", function (done) {
                // Execute the command to push the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, "push", switches, "--user", "foo", "--password", "password", "--url", "Invalid URL"])
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        // Verify that the expected error was specified.
                        expect(err.message).to.contain("not valid");
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

    testPushParamFail (switches) {
        describe("CLI-unit-pushing", function () {
            const command = 'push';
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

            it("test fail bad dir param", function (done) {
                const stub = sinon.stub(fs, "statSync");
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
                            // Verify that the stub was called once, and that the expected error message was returned.
                            expect(stub).to.have.been.calledOnce;
                            expect(err.message).to.contain("....");
                            expect(err.message).to.contain("does not exist");
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

            it("test fail all and named", function (done) {
                // Execute the command to list the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, command, '--all-authoring','--named','red'])
                    .then(function (/*msg*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the expected error message was returned.
                            expect(err.message).to.equal('Invalid options, named can only be used for a single type.');
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test fail named and path param", function (done) {
                // Execute the command to list the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, command, switches, '--named', 'foo', '--path', 'foo'])
                    .then(function (/*msg*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the expected error message was returned.
                            expect(err.message).to.equal('Invalid options named and path cannot be used together.');
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("test fail named and ignore param", function (done) {
                // Execute the command to list the items to the download directory.
                let error;
                toolsCli.parseArgs(['', UnitTest.COMMAND, command, switches, '--named', 'foo', '-I', '--path', 'foo'])
                    .then(function (/*msg*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The command should have failed.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the expected error message was returned.
                            expect(err.message).to.equal('Invalid options named and Ignore-timestamps cannot be used together.');
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
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
        });
    }
}

module.exports = PushUnitTest;
