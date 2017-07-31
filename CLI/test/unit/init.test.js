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
'use strict';

const expect = require("chai").expect;
const sinon = require("sinon");
const prompt = require("prompt");
const ToolsApi = require("wchtools-api");
const options = ToolsApi.getOptions();
const toolsCli = require("../../wchToolsCli");

const TEST_USER = "testUser";
const TEST_URL = "http://foo.bar/api";
const INVALID_URL = "www.foo.bar";
const OPTIONS_SAVE_DIRECTORY = "saveLocation";

describe("init", function () {
    describe("init command", function () {
        it("test init user and url params", function (done) {
            let error;

            // Stub the setOptions method so that the test doesn't actually modify the options.
            const stubSet = sinon.stub(options, "setOptions");
            stubSet.returns(OPTIONS_SAVE_DIRECTORY);

            // Execute the command to set the user.
            toolsCli.parseArgs(['', process.cwd() + "/index.js", 'init', '--user', TEST_USER, '--url', TEST_URL])
                .then(function (msg) {
                    expect(stubSet).to.have.been.calledTwice;
                    expect(stubSet.args[1][1]["username"]).to.equal(TEST_USER);
                    expect(stubSet.args[1][1]["x-ibm-dx-tenant-base-url"]).to.equal(TEST_URL);
                    expect(msg).to.contain(OPTIONS_SAVE_DIRECTORY);
                })
                .catch(function (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                })
                .finally(function () {
                    // Restore the stub that was created.
                    stubSet.restore();

                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                });
        });

        it("test init user param", function (done) {
            let error;

            // Stub the getProperty method to return null for the url.
            const originalGetProperty = options.getProperty;
            const stubGet = sinon.stub(options, "getProperty", function (context, key) {
                if (key === "x-ibm-dx-tenant-base-url") {
                    return null;
                } else {
                    originalGetProperty(context, key);
                }
            });

            // Stub the setOptions method so that the test doesn't actually modify the options.
            const stubSet = sinon.stub(options, "setOptions");
            stubSet.returns(OPTIONS_SAVE_DIRECTORY);

            // Stub the prompt.get method so that the test doesn't actually prompt for the user and url.
            const stubPrompt = sinon.stub(prompt, "get");
            stubPrompt.yields(null, {"x-ibm-dx-tenant-base-url": TEST_URL});

            // Execute the command to set the user.
            toolsCli.parseArgs(['', process.cwd() + "/index.js", 'init', "--user", TEST_USER])
                .then(function (msg) {
                    expect(stubSet).to.have.been.calledTwice;
                    expect(stubSet.args[1][1]["username"]).to.equal(TEST_USER);
                    expect(stubSet.args[1][1]["x-ibm-dx-tenant-base-url"]).to.equal(TEST_URL);
                    expect(msg).to.contain(OPTIONS_SAVE_DIRECTORY);
                })
                .catch(function (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                })
                .finally(function () {
                    // Restore the stubs that were created.
                    stubGet.restore();
                    stubSet.restore();
                    stubPrompt.restore();

                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                });
        });

        it("test init url param", function (done) {
            let error;

            // Stub the getProperty method to return null for the user.
            const originalGetProperty = options.getProperty;
            const stubGet = sinon.stub(options, "getProperty", function (context, key) {
                if (key === "username") {
                    return null;
                } else {
                    originalGetProperty(context, key);
                }
            });

            // Stub the setOptions method so that the test doesn't actually modify the options.
            const stubSet = sinon.stub(options, "setOptions");
            stubSet.returns(OPTIONS_SAVE_DIRECTORY);

            // Stub the prompt.get method so that the test doesn't actually prompt for the user and url.
            const stubPrompt = sinon.stub(prompt, "get");
            stubPrompt.yields(null, {"username": TEST_USER});

            // Execute the command to set the user.
            toolsCli.parseArgs(['', process.cwd() + "/index.js", 'init', "--url", TEST_URL])
                .then(function (msg) {
                    expect(stubSet).to.have.been.calledTwice;
                    expect(stubSet.args[1][1]["username"]).to.equal(TEST_USER);
                    expect(stubSet.args[1][1]["x-ibm-dx-tenant-base-url"]).to.equal(TEST_URL);
                    expect(msg).to.contain(OPTIONS_SAVE_DIRECTORY);
                })
                .catch(function (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                })
                .finally(function () {
                    // Restore the stubs that were created.
                    stubGet.restore();
                    stubSet.restore();
                    stubPrompt.restore();

                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                });
        });

        it("test init no params", function (done) {
            let error;

            // Stub the setOptions method so that the test doesn't actually modify the options.
            const stubSet = sinon.stub(options, "setOptions");
            stubSet.returns(OPTIONS_SAVE_DIRECTORY);

            // Stub the prompt.get method so that the test doesn't actually prompt for the user and url.
            const stubPrompt = sinon.stub(prompt, "get");
            stubPrompt.yields(null, {"username": TEST_USER, "x-ibm-dx-tenant-base-url": TEST_URL});

            // Execute the command to set the user.
            toolsCli.parseArgs(['', process.cwd() + "/index.js", 'init'])
                .then(function (msg) {
                    expect(stubSet).to.have.been.calledTwice;
                    expect(stubSet.args[1][1]["username"]).to.equal(TEST_USER);
                    expect(stubSet.args[1][1]["x-ibm-dx-tenant-base-url"]).to.equal(TEST_URL);
                    expect(msg).to.contain(OPTIONS_SAVE_DIRECTORY);
                })
                .catch(function (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                })
                .finally(function () {
                    // Restore the stubs that were created.
                    stubSet.restore();
                    stubPrompt.restore();

                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                });
        });

        it("test init no params invalid URL", function (done) {
            let error;

            // Stub the prompt.get method so that the test doesn't actually prompt for the user and url.
            const stubPrompt = sinon.stub(prompt, "get");
            stubPrompt.yields(null, {"username": TEST_USER, "x-ibm-dx-tenant-base-url": INVALID_URL});

            // Execute the command to set the user.
            toolsCli.parseArgs(['', process.cwd() + "/index.js", 'init'])
                .then(function () {
                    // This is not expected. Pass the error to the "done" function to indicate a failed test.
                    error = new Error("The command should have failed.");
                })
                .catch(function (err) {
                    expect(err.message).to.contain("API URL is not valid");
                })
                .catch(function (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                })
                .finally(function () {
                    // Restore the stubs that were created.
                    stubPrompt.restore();

                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                });
        });

        it("test init no params failure", function (done) {
            let error;

            // Stub the prompt.get method so that the test doesn't actually prompt for the user and url.
            const stubPrompt = sinon.stub(prompt, "get");
            stubPrompt.yields(null, {"username": TEST_USER, "x-ibm-dx-tenant-base-url": TEST_URL});

            // Stub the setOptions method to return an error.
            const stubSet = sinon.stub(options, "setOptions");
            const SET_ERROR = "Error setting option values, expected by unit test.";
            stubSet.onSecondCall().throws(new Error(SET_ERROR));

            // Execute the command to set the user.
            toolsCli.parseArgs(['', process.cwd() + "/index.js", 'init'])
                .then(function () {
                    // This is not expected. Pass the error to the "done" function to indicate a failed test.
                    error = new Error("The command should have failed.");
                })
                .catch(function (err) {
                    expect(err.message).to.contain(SET_ERROR);
                })
                .catch(function (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                })
                .finally(function () {
                    // Restore the stubs that were created.
                    stubPrompt.restore();
                    stubSet.restore();

                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                });
        });

        it("test fail extra param", function (done) {
            let error;
            toolsCli.parseArgs(['', process.cwd() + "/index.js", 'init', 'foo'])
                .then(function () {
                    // This is not expected. Pass the error to the "done" function to indicate a failed test.
                    error = new Error("The command should have failed.");
                })
                .catch(function (err) {
                    try {
                        expect(err.message).to.contain('foo');
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

    describe("initialization process", function () {
        // Stub the setOptions method so that the tests don't actually modify the options.
        let stubGet;

        before(function () {
            stubGet = sinon.stub(options, "setOptions");
            stubGet.returns(OPTIONS_SAVE_DIRECTORY);
        });

        after(function () {
            stubGet.restore();
        });

        it("should succeed with no errors", function (done) {
            // Create a spy for ToolsApi.getInitializationErrors.
            const spy = sinon.spy(ToolsApi, "getInitializationErrors");

            let error;
            toolsCli.parseArgs(['', process.cwd() + "/index.js", 'init', '--user', TEST_USER, '--url', TEST_URL])
                .then(function () {
                    expect(spy.firstCall.returnValue).to.have.lengthOf(0);
                })
                .catch(function (err) {
                    error = err;
                })
                .finally(function () {
                    spy.restore();
                    done(error);
                });
        });

        it("should fail when the tools API has a single initialization error", function (done) {
            // Create a stub for ToolsApi.getInitializationErrors that will return a single error.
            const stub = sinon.stub(ToolsApi, "getInitializationErrors");
            const INIT_ERROR = "Something failed during initialization.";
            stub.returns([new Error(INIT_ERROR)]);

            let error;
            toolsCli.parseArgs(['', process.cwd() + "/index.js", 'init', '--user', 'testUser', '--url', 'http://foo.bar/api'])
                .then(function () {
                    // This is not expected. Pass the error to the "done" function to indicate a failed test.
                    error = new Error("The command should have failed.");
                })
                .catch(function (err) {
                    expect(err.message).to.contain(INIT_ERROR);
                })
                .catch(function (err) {
                    error = err;
                })
                .finally(function () {
                    stub.restore();
                    done(error);
                });
        });

        it("should fail when the tools API has multiple initialization errors", function (done) {
            // Create a stub for ToolsApi.getInitializationErrors that will return two errors.
            const stub = sinon.stub(ToolsApi, "getInitializationErrors");
            const INIT_ERROR_1 = "Something failed during initialization.";
            const INIT_ERROR_2 = "Something else failed during initialization.";
            stub.returns([new Error(INIT_ERROR_1), new Error(INIT_ERROR_2)]);

            let error;
            toolsCli.parseArgs(['', process.cwd() + "/index.js", 'init', '--user', 'testUser', '--url', 'http://foo.bar/api'])
                .then(function () {
                    // This is not expected. Pass the error to the "done" function to indicate a failed test.
                    error = new Error("The command should have failed.");
                })
                .catch(function (err) {
                    expect(err.message).to.contain(INIT_ERROR_1);
                    expect(err.message).to.contain(INIT_ERROR_2);
                })
                .catch(function (err) {
                    error = err;
                })
                .finally(function () {
                    stub.restore();
                    done(error);
                });
        });
    });
});
