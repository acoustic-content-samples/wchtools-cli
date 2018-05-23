/*
Copyright IBM Corporation 2016, 2017, 2018

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
"use strict";
// Use the chai assertion framework.
const chai = require("chai");

// Use the chai-as-promised promise-assertion extension.
const chaiAsPromised = require("chai-as-promised");

// Use the sinon spy/stub/mock framework.
require("sinon");

// Use the sinon spy/stub/mock framework.
const Q = require("q");

// Use the sinon-as-promised extension.
require("sinon-as-promised")(Q.Promise);

// Use the sinon-chai extension.
const sinonChai = require("sinon-chai");

const rimraf = require("rimraf");

// Tell chai that it should be using chai-as-promised and sinon-chai.
chai.use(chaiAsPromised);
chai.use(sinonChai);

const path  = require("path");
// Now that chai is using chai-as-promised, expose the new expect function.
global.expect = chai.expect;
const sinon = require("sinon");

const ToolsApi = require("wchtools-api");
const helper = ToolsApi.getPublishingJobsHelper();
const srHelper = ToolsApi.getPublishingSiteRevisionsHelper();
const loginHelper = ToolsApi.getLogin();

const toolsCli = require("../../wchToolsCli");

describe("Test publish command", function () {
    let stubLogin;
    before(function (done) {
        stubLogin = sinon.stub(loginHelper, "login");
        stubLogin.resolves("wchuser@wchisgreat.wch");
        done();
    });

    after(function (done) {
        stubLogin.restore();
        done();
    });

    it("check default publish" , function (done) {
        const stubGet = sinon.stub(helper, "createPublishingJob");
        stubGet.resolves({id: 'foo'});

        let error;
        toolsCli.parseArgs(['', process.cwd() + '/index.js', 'publish', '--user', 'uname', '--password', 'pwd', '--url', 'http://foo.bar/api'])
            .then(function (msg) {
                // The stub should only have been called once, and it should have been before the spy.
                expect(stubGet).to.have.been.calledOnce;
                expect (msg).to.contain('accepted');
            })
            .catch(function (err) {
                // NOTE: A failed expectation from above will be handled here.
                // Pass the error to the "done" function to indicate a failed test.
                error = err;
            })
            .finally(function () {
                // Call mocha's done function to indicate that the test is over.
                stubGet.restore();
                done(error);
            });
    });

    it("check publish with -rv args" , function (done) {
        const stubGet = sinon.stub(helper, "createPublishingJob");
        stubGet.resolves({id: 'foo'});

        let error;
        toolsCli.parseArgs(['', process.cwd() + '/index.js', 'publish', '-rv', '--user', 'uname', '--password', 'pwd', '--url', 'http://foo.bar/api'])
            .then(function (msg) {
                // The stub should only have been called once, and it should have been before the spy.
                expect(stubGet).to.have.been.calledOnce;
                expect(msg).to.contain('accepted');
            })
            .catch(function (err) {
                // NOTE: A failed expectation from above will be handled here.
                // Pass the error to the "done" function to indicate a failed test.
                error = err;
            })
            .finally(function () {
                // Call mocha's done function to indicate that the test is over.
                stubGet.restore();
                done(error);
            });
    });

    it("check default publish fail" , function (done) {
        const stubGet = sinon.stub(helper, "createPublishingJob");
        stubGet.rejects("Error");

        let error;
        toolsCli.parseArgs(['', process.cwd() + '/index.js', 'publish', '--user', 'uname', '--password', 'pwd', '--url', 'http://foo.bar/api'])
            .then(function () {
                // This is not expected. Pass the error to the "done" function to indicate a failed test.
                error = new Error("The command should have failed.");
            })
            .catch(function (err) {
                try {
                    // The stub should only have been called once, and it should have been before the spy.
                    expect(stubGet).to.have.been.calledOnce;
                    expect(err.message).to.contain('Error');
                } catch (err) {
                    error = err;
                }
            })
            .finally(function () {
                // Call mocha's done function to indicate that the test is over.
                stubGet.restore();
                done(error);
            });
    });

    it("test fail extra param", function (done) {
        // Execute the command to list the items to the download directory.
        let error;
        toolsCli.parseArgs(['', process.cwd() + "/index.js", 'publish', 'foo', '--user', 'uname', '--password', 'pwd', '--url', 'http://foo.bar/api'])
            // Handle a fulfilled promise.
            .then(function () {
                // This is not expected. Pass the error to the "done" function to indicate a failed test.
                error = new Error("The command should have failed.");
            })
            // Handle a rejected promise, or a failed expectation from the "then" block.
            .catch(function (err) {
                try {
                    // The stub should only have been called once, and it should have been before the spy.
                    expect(err.message).to.contain('Invalid argument');
                } catch (err) {
                    error = err;
                }
            })
            // Handle the cleanup.
            .finally(function () {
                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
    });

    it("check publish --status arg" , function (done) {
        const stubGetSR = sinon.stub(srHelper, "getRemoteItem");
        stubGetSR.resolves({id: 'mypublishingSiteRevision', state: 'WAITING'});

        let error;
        toolsCli.parseArgs(['', process.cwd() + '/index.js', 'publish', '--status', '123456', '--user', 'uname', '--password', 'pwd', '--url', 'http://foo.bar/api'])
            .then(function (msg) {
                // The stub should only have been called once, and it should have been before the spy.
                expect(stubGetSR).to.have.been.calledOnce;
                expect(msg).to.contain('WAITING');
            })
            .catch(function (err) {
                // NOTE: A failed expectation from above will be handled here.
                // Pass the error to the "done" function to indicate a failed test.
                error = err;
            })
            .finally(function () {
                // Call mocha's done function to indicate that the test is over.
                stubGetSR.restore();
                done(error);
            });
    });


    it("check publish --status without job id" , function (done) {
        const stubGetSR = sinon.stub(srHelper, "getRemoteItem");
        stubGetSR.resolves({id: 'mypublishingSiteRevision', state: 'SUCCESS'});

        let error;
        toolsCli.parseArgs(['', process.cwd() + '/index.js', 'publish', '--status', '--user', 'uname', '--password', 'pwd', '--url', 'http://foo.bar/api'])
            .then(function (msg) {
                // The stub should only have been called once, and it should have been before the spy.
                expect(stubGetSR).to.have.been.calledOnce;
                expect(msg).to.contain('SUCCESS');
            })
            .catch(function (err) {
                // NOTE: A failed expectation from above will be handled here.
                // Pass the error to the "done" function to indicate a failed test.
                error = err;
            })
            .finally(function () {
                // Call mocha's done function to indicate that the test is over.
                stubGetSR.restore();
                done(error);
            });
    });

    it("check publish --status -v args" , function (done) {
        const stubGetSR = sinon.stub(srHelper, "getRemoteItem");
        stubGetSR.resolves({id: 'mypublishingSiteRevision', state: 'WAITING'});

        let error;
        toolsCli.parseArgs(['', process.cwd() + '/index.js', 'publish', '--status', '123456', '-v', '--user', 'uname', '--password', 'pwd', '--url', 'http://foo.bar/api'])
            .then(function (msg) {
                // The stub should only have been called once, and it should have been before the spy.
                expect(stubGetSR).to.have.been.calledOnce;
                expect(msg).to.contain('WAITING');
            })
            .catch(function (err) {
                // NOTE: A failed expectation from above will be handled here.
                // Pass the error to the "done" function to indicate a failed test.
                error = err;
            })
            .finally(function () {
                // Call mocha's done function to indicate that the test is over.

                stubGetSR.restore();
                done(error);
            });
    });

    it("check publish --status fails when getRemoteItem() fails" , function (done) {
        const stubGetItem = sinon.stub(srHelper, "getRemoteItem");
        stubGetItem.rejects("Error");

        let error;
        toolsCli.parseArgs(['', process.cwd() + '/index.js', 'publish', '--status', 'badjobid', '--user', 'uname', '--password', 'pwd', '--url', 'http://foo.bar/api'])
            .then(function () {
                // This is not expected. Pass the error to the "done" function to indicate a failed test.
                error = new Error("The publish --status command should have failed.");
            })
            .catch(function (err) {
                // The stubs should only have been called once, and it should have been before the spy.
                expect(stubGetItem).to.have.been.calledOnce;
                expect(err.message).to.contain('Error');
            })
            .catch(function (err) {
                error = err;
            })
            .finally(function () {
                // Call mocha's done function to indicate that the test is over.
                stubGetItem.restore();
                done(error);
            });
    });

    it("check publish --status fails when initialization fails", function (done) {
        const INIT_ERROR = "API initialization failed, as expected by unit test.";
        const stub = sinon.stub(ToolsApi, "getInitializationErrors");
        stub.returns([new Error(INIT_ERROR)]);

        let error;
        toolsCli.parseArgs(['', process.cwd() + '/index.js', 'publish', '--status', 'badjobid', '--user', 'uname', '--password', 'pwd', '--url', 'http://foo.bar/api'])
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

    it("check publish --status fails when login fails" , function (done) {
        stubLogin.throws(new Error("Login failed."));

        let error;
        toolsCli.parseArgs(['', process.cwd() + '/index.js', 'publish', '--status', 'badjobid', '--user', 'uname', '--password', 'pwd', '--url', 'http://foo.bar/api'])
            .then(function () {
                // This is not expected. Pass the error to the "done" function to indicate a failed test.
                error = new Error("The publish --status command should have failed with a login failure.");
            })
            .catch(function (err) {
                // The stubs should only have been called once, and it should have been before the spy.
                expect(err.message).to.contain('Login failed');
            })
            .catch(function (err) {
                error = err;
            })
            .finally(function () {
                done(error);
            });
    });    
});
