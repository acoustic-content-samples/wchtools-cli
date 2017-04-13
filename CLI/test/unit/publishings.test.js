/*
Copyright IBM Corporation 2016, 2017

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

const toolsApi = require("wchtools-api");
const helper = toolsApi.getPublishingJobsHelper();
const loginHelper = toolsApi.login;

const toolsCli = require("../../wchToolsCli");
const LONG_TIMEOUT = 80000;

describe("Test Publishing command", function () {
    let stubLogin;
    before(function (done) {
        stubLogin = sinon.stub(loginHelper, "login");
        stubLogin.resolves("Adam.iem@mailinator.com");
        done();
    });

    after(function (done) {
        stubLogin.restore();
        done();
    });

    it("check default publish" , function (done) {
        this.timeout(LONG_TIMEOUT);

        const stubGet = sinon.stub(helper, "createPublishingJob");
        stubGet.resolves({id: 'foo'});

        let error;
        toolsCli.parseArgs(['', process.cwd() + '/index.js', 'publish', '--user', 'uname', '--password', 'pwd'])
            .then(function (msg) {
                // The stub should only have been called once, and it should have been before the spy.
                expect(stubGet).to.have.been.calledOnce;
                expect (msg).to.contain('foo');
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

    it("check publish with -uv args" , function (done) {
        this.timeout(LONG_TIMEOUT);

        const stubGet = sinon.stub(helper, "createPublishingJob");
        stubGet.resolves({id: 'foo'});

        let error;
        toolsCli.parseArgs(['', process.cwd() + '/index.js', 'publish', '-rv', '--user', 'uname', '--password', 'pwd'])
            .then(function (msg) {
                // The stub should only have been called once, and it should have been before the spy.
                expect(stubGet).to.have.been.calledOnce;
                expect(msg).to.contain('foo');
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
        this.timeout(LONG_TIMEOUT);

        const stubGet = sinon.stub(helper, "createPublishingJob");
        stubGet.rejects("Error");

        let error;
        toolsCli.parseArgs(['', process.cwd() + '/index.js', 'publish', '--user', 'uname', '--password', 'pwd'])
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
        toolsCli.parseArgs(['', process.cwd() + "/index.js", 'publish', 'foo', '--user', 'uname', '--password', 'pwd'])
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
        this.timeout(LONG_TIMEOUT);

        const stubGet = sinon.stub(helper, "getPublishingJob");
        stubGet.resolves({id: 'mypublishiingjobid', state: 'WAITING'});

        let error;
        toolsCli.parseArgs(['', process.cwd() + '/index.js', 'publish', '--status', '123456', '--user', 'uname', '--password', 'pwd'])
            .then(function (msg) {
                // The stub should only have been called once, and it should have been before the spy.
                expect(stubGet).to.have.been.calledOnce;
                expect(msg).to.contain('WAITING');
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


    it("check publish --status without job id" , function (done) {
        this.timeout(LONG_TIMEOUT);

        const stubGetJobs = sinon.stub(helper, "getPublishingJobs");
        stubGetJobs.resolves([{id: 'mypublishiingjobid'}]);

        const stubGet = sinon.stub(helper, "getPublishingJob");
        stubGet.resolves({id: 'mypublishiingjobid', state: 'SUCCESS'});

        let error;
        toolsCli.parseArgs(['', process.cwd() + '/index.js', 'publish', '--status', '--user', 'uname', '--password', 'pwd'])
            .then(function (msg) {
                // The stub should only have been called once, and it should have been before the spy.
                expect(stubGet).to.have.been.calledOnce;
                expect(msg).to.contain('SUCCESS');
            })
            .catch(function (err) {
                // NOTE: A failed expectation from above will be handled here.
                // Pass the error to the "done" function to indicate a failed test.
                error = err;
            })
            .finally(function () {
                // Call mocha's done function to indicate that the test is over.
                stubGet.restore();
                stubGetJobs.restore();
                done(error);
            });
    });


    it("check publish --status -v args" , function (done) {
        this.timeout(LONG_TIMEOUT);

        const stubGet = sinon.stub(helper, "getPublishingJob");
        stubGet.resolves({id: 'mypublishiingjobid', state: 'WAITING'});
        let error;
        toolsCli.parseArgs(['', process.cwd() + '/index.js', 'publish', '--status', '123456', '-v', '--user', 'uname', '--password', 'pwd'])
            .then(function (msg) {
                // The stub should only have been called once, and it should have been before the spy.
                expect(stubGet).to.have.been.calledOnce;
                expect(msg).to.contain('WAITING');
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

    it("check publish --status fail" , function (done) {
        this.timeout(LONG_TIMEOUT);

        const stubGet = sinon.stub(helper, "getPublishingJob");
        stubGet.rejects("Error");

        let error;
        toolsCli.parseArgs(['', process.cwd() + '/index.js', 'publish', '--status', 'badjobid', '--user', 'uname', '--password', 'pwd'])
            .then(function () {
                // This is not expected. Pass the error to the "done" function to indicate a failed test.
                error = new Error("The publish --status command with bad job id should have failed.");
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

});
