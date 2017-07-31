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
 * Unit tests for the loginREST object.
 */
"use strict";

// Require the super classes for this class.
const UnitTest = require("./base.unit.js");

// Require the node modules used in this test file.
const sinon = require("sinon");

// Require the local modules that will be stubbed and spied.
const utils = require(UnitTest.API_PATH + "lib/utils/utils.js");
const request = utils.getRequestWrapper();

// Require the local module being tested.
const loginREST = require(UnitTest.API_PATH + "lib/loginREST.js").instance;

const tenantId = process.env.TENANT_ID || UnitTest.DUMMY_ID;

// Define some generic login options to be used by the tests.
const loginOptions = {
    "x-ibm-dx-tenant-base-url": "http://foo.com/api",
    "x-ibm-dx-tenant-id": tenantId,
    "username": UnitTest.DUMMY_NAME,
    "password": "foobar"
};

// The default API context used for unit tests.
const context = UnitTest.DEFAULT_API_CONTEXT;

class LoginRestUnitTest extends UnitTest {
    constructor() {
        super();
    }

    run() {
        const self = this;
        describe("Unit tests for loginREST.js", function() {
            before(function (done) {
                // Reset any values that may have been set by other tests.
                loginREST.reset();

                // Signal that the setup is complete.
                done();
            });

            // Cleanup common resourses consumed by a test.
            afterEach(function (done) {
                // Restore any stubs and spies used for the test.
                self.restoreTestDoubles();

                // Signal that the cleanup is complete.
                done();
            });

            after(function (done) {
                // Reset any values that may have been set by these tests.
                loginREST.reset();

                // Signal that the cleanup is complete.
                done();
            });

            // Run each of the tests defined in this class.
            self.testSingleton();
            self.testGetRequestOptions();
            self.testLogin();
        });
    }

    testSingleton () {
        describe("Singleton", function () {
            it("should fail if trying to construct a new object", function (done) {
                let error;
                try {
                    const api = new loginREST.constructor();
                    if (api) {
                        error = "The constructor should have failed.";
                    } else {
                        error = "The constructor should have thrown an error.";
                    }
                } catch (e) {
                    try {
                        expect(e).to.equal("An instance of singleton class " + loginREST.constructor.name + " cannot be constructed");
                    } catch (err) {
                        error = err;
                    }
                }

                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
        });
    }

    testGetRequestOptions () {
        describe("Request options", function () {
            it("should contain the expected values", function (done) {
                let error;
                try {
                    const requestOptions = loginREST.getRequestOptions(context, loginOptions);

                    expect(requestOptions).to.exist;
                    expect(requestOptions.uri).to.contain(loginOptions["x-ibm-dx-tenant-base-url"]);
                    expect(requestOptions.headers["x-ibm-dx-tenant-id"]).to.equal(loginOptions["x-ibm-dx-tenant-id"]);
                    expect(requestOptions.auth.user).to.equal(loginOptions["username"]);
                    expect(requestOptions.auth.pass).to.equal(loginOptions["password"]);
                } catch (err) {
                    error = err;
                }

                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
        });
    }

    testLogin () {
        const self = this;
        describe("Login", function () {
            it("should fail if the login request returns an error", function (done) {
                // Create a stub for the GET requests.
                const stub = sinon.stub(request, "get");
                const LOGIN_ERROR = "Error logging in.";
                const err = new Error(LOGIN_ERROR);
                const res = {};
                const body = null;
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                loginREST.login(context, loginOptions)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the login attempt should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once with the expected values.
                            expect(stub).to.have.been.calledOnce;
                            expect(stub.firstCall.args[0].uri).to.contain(loginOptions["x-ibm-dx-tenant-base-url"]);
                            expect(stub.firstCall.args[0].headers["x-ibm-dx-tenant-id"]).to.equal(loginOptions["x-ibm-dx-tenant-id"]);

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.equal(LOGIN_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail if the login response has an error response code", function (done) {
                // Create a stub for the GET requests.
                const stub = sinon.stub(request, "get");
                const LOGIN_RESPONSE_CODE = 401;
                const LOGIN_ERROR = "Error logging in.";
                const err = null;
                const res = {"statusCode": LOGIN_RESPONSE_CODE, "statusMessage": LOGIN_ERROR};
                const body = null;
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                loginREST.login(context, loginOptions)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the login attempt should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once with the expected values.
                            expect(stub).to.have.been.calledOnce;
                            expect(stub.firstCall.args[0].uri).to.contain(loginOptions["x-ibm-dx-tenant-base-url"]);
                            expect(stub.firstCall.args[0].headers["x-ibm-dx-tenant-id"]).to.equal(loginOptions["x-ibm-dx-tenant-id"]);

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.contain(LOGIN_ERROR);
                            expect(err.message).to.contain(LOGIN_RESPONSE_CODE);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail if the login response does not contain an authentication cookie", function (done) {
                // Create a stub for the GET requests.
                const stub = sinon.stub(request, "get");
                const LOGIN_RESPONSE_CODE = 302;
                const err = null;
                const res = {"statusCode": LOGIN_RESPONSE_CODE};
                const body = null;
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                loginREST.login(context, loginOptions)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the login attempt should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once with the expected values.
                            expect(stub).to.have.been.calledOnce;
                            expect(stub.firstCall.args[0].uri).to.contain(loginOptions["x-ibm-dx-tenant-base-url"]);
                            expect(stub.firstCall.args[0].headers["x-ibm-dx-tenant-id"]).to.equal(loginOptions["x-ibm-dx-tenant-id"]);

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.contain("login service failed");
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed if the login response contains an authentication cookie", function (done) {
                // Create a stub for the GET requests.
                const stub = sinon.stub(request, "get");
                const LOGIN_RESPONSE_CODE = 302;
                const LOGIN_RESPONSE_COOKIE = UnitTest.DUMMY_METADATA;
                const err = null;
                const res = {"statusCode": LOGIN_RESPONSE_CODE, "headers": {"set-cookie": LOGIN_RESPONSE_COOKIE, "x-ibm-dx-tenant-id":"00000000-0000-0000-000000000000"}};
                const body = null;
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                loginREST.login(context, loginOptions)
                    .then(function (retval) {
                        // Verify that the stub was called once with the expected values.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[0].uri).to.contain(loginOptions["x-ibm-dx-tenant-base-url"]);
                        expect(stub.firstCall.args[0].headers["x-ibm-dx-tenant-id"]).to.equal(loginOptions["x-ibm-dx-tenant-id"]);

                        // Verify that the expected value is returned.
                        expect(retval).to.not.be.empty;
                        expect(retval.username).to.not.be.empty;
                        expect(retval.username).to.contain(loginOptions.username);
                        expect(retval["x-ibm-dx-tenant-id"]).to.not.be.empty;

                    })
                    .catch(function (err) {
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

module.exports = LoginRestUnitTest;
