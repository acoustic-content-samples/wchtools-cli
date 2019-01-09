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
const Q = require("q");

// Require the local modules that will be stubbed and spied.
const options = require(UnitTest.API_PATH + "lib/utils/options.js");
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
    "password": "This password should never appear in the log",
    "retryMinTimeout": 10,
    "retryMaxTimeout": 100
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
            // Cleanup common resourses consumed by a test.
            afterEach(function (done) {
                // Restore any stubs and spies used for the test.
                self.restoreTestDoubles();

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
                } finally {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
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
                } finally {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
            });

            it("should get the expected tenant value from the process", function (done) {
                let error = undefined;
                const origTenantId = process.env.TENANT_ID;
                try {
                    // Set a tenant ID on the process.
                    process.env.TENANT_ID = UnitTest.DUMMY_ID;

                    const requestOptions = loginREST.getRequestOptions(context, loginOptions);

                    expect(requestOptions).to.exist;
                    expect(requestOptions.uri).to.contain(loginOptions["x-ibm-dx-tenant-base-url"]);
                    expect(requestOptions.headers["x-ibm-dx-tenant-id"]).to.equal(UnitTest.DUMMY_ID);
                    expect(requestOptions.auth.user).to.equal(loginOptions["username"]);
                    expect(requestOptions.auth.pass).to.equal(loginOptions["password"]);
                } catch (err) {
                    error = err;
                } finally {
                    // Restore the original tenant ID.
                    if (origTenantId) {
                        process.env.TENANT_ID = origTenantId;
                    } else {
                        delete process.env.TENANT_ID;
                    }

                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
            });

            it("should get the URI from the base-url or api-gateway option", function (done) {
                let error = undefined;
                try {
                    let requestOptions = loginREST.getRequestOptions(context, {"x-ibm-dx-tenant-base-url": "XXXXX"});
                    expect(requestOptions).to.exist;
                    expect(requestOptions.uri).to.contain("XXXXX");
                } catch (err) {
                    error = err;
                } finally {
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                }
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

                // Create a spy for the utils.logErrors method.
                const spy = sinon.spy(utils, "logErrors");

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stub);
                self.addTestDouble(spy);

                // Call the method being tested.
                let error;
                loginREST.login(context, loginOptions)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the login attempt should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.equal(LOGIN_ERROR);

                        // Verify that the stub was called once with the expected values.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[0].uri).to.contain(loginOptions["x-ibm-dx-tenant-base-url"]);
                        expect(stub.firstCall.args[0].headers["x-ibm-dx-tenant-id"]).to.equal(loginOptions["x-ibm-dx-tenant-id"]);

                        // Verify that the password was not included in the log message.
                        expect(spy).to.have.been.calledOnce;
                        expect(spy.firstCall.args[2].log).to.not.contain(loginOptions["password"]);
                    })
                    .catch(function (err) {
                        error = err;
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

                // Create a spy for the utils.logErrors method.
                const spy = sinon.spy(utils, "logErrors");

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stub);
                self.addTestDouble(spy);

                // Call the method being tested.
                let error;
                loginREST.login(context, loginOptions)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the login attempt should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.contain(LOGIN_ERROR);
                        expect(err.message).to.contain(LOGIN_RESPONSE_CODE);

                        // Verify that the stub was called once with the expected values.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[0].uri).to.contain(loginOptions["x-ibm-dx-tenant-base-url"]);
                        expect(stub.firstCall.args[0].headers["x-ibm-dx-tenant-id"]).to.equal(loginOptions["x-ibm-dx-tenant-id"]);

                        // Verify that the password was not included in the log message.
                        expect(spy).to.have.been.calledOnce;
                        expect(spy.firstCall.args[2].log).to.not.contain(loginOptions["password"]);
                    })
                    .catch(function (err) {
                        error = err;
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

                // Create a spy for the utils.logErrors method.
                const spy = sinon.spy(utils, "logErrors");

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stub);
                self.addTestDouble(spy);

                // Call the method being tested.
                let error;
                loginREST.login(context, loginOptions)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the login attempt should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.contain("login service failed");

                        // Verify that the stub was called once with the expected values.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[0].uri).to.contain(loginOptions["x-ibm-dx-tenant-base-url"]);
                        expect(stub.firstCall.args[0].headers["x-ibm-dx-tenant-id"]).to.equal(loginOptions["x-ibm-dx-tenant-id"]);

                        // Verify that the password was not included in the log message.
                        expect(spy).to.have.been.calledOnce;
                        expect(spy.firstCall.args[2].log).to.not.contain(loginOptions["password"]);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail if the login response body contains FBTBLU101E", function (done) {
                // Create a stub for the GET requests.
                const stub = sinon.stub(request, "get");
                const err = null;
                const res = null;
                const body = "A response body containing the string FBTBLU101E.";
                stub.onCall(0).yields(err, res, body);

                // Create a spy for the utils.logErrors method.
                const spy = sinon.spy(utils, "logErrors");

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stub);
                self.addTestDouble(spy);

                // Call the method being tested.
                let error;
                loginREST.login(context, loginOptions)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the login attempt should have been rejected.");
                    })
                    .catch(function (err) {
                        // Verify that the expected error is returned.
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.contain("FBTBLU101E");

                        // Verify that the stub was called once with the expected values.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[0].uri).to.contain(loginOptions["x-ibm-dx-tenant-base-url"]);
                        expect(stub.firstCall.args[0].headers["x-ibm-dx-tenant-id"]).to.equal(loginOptions["x-ibm-dx-tenant-id"]);

                        // Verify that the password was not included in the log message.
                        expect(spy).to.have.been.calledOnce;
                        expect(spy.firstCall.args[2].message).to.not.contain(loginOptions["password"]);
                    })
                    .catch(function (err) {
                        error = err;
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
                const body = '[{"tier": "Trial"}]';
                stub.onCall(0).yields(err, res, body);

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                loginREST.login(context, loginOptions)
                    .then(function (retval) {
                        // Verify that the expected value is returned.
                        expect(retval).to.not.be.empty;
                        expect(retval.username).to.contain(loginOptions.username);
                        expect(retval["x-ibm-dx-tenant-id"]).to.equal("00000000-0000-0000-000000000000");
                        expect(retval["tier"]).to.equal("Trial");

                        // Verify that the stub was called once with the expected values.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[0].uri).to.contain(loginOptions["x-ibm-dx-tenant-base-url"]);
                        expect(stub.firstCall.args[0].headers["x-ibm-dx-tenant-id"]).to.equal(loginOptions["x-ibm-dx-tenant-id"]);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed if the login response contains a base URL", function (done) {
                // Create a stub for the GET requests.
                const stub = sinon.stub(request, "get");
                const LOGIN_RESPONSE_COOKIE = UnitTest.DUMMY_METADATA;
                const err = null;
                const res = {"statusCode": 302, "headers": {"set-cookie": LOGIN_RESPONSE_COOKIE, "x-ibm-dx-tenant-id": UnitTest.DUMMY_ID, "x-ibm-dx-tenant-base-url": UnitTest.DUMMY_URI}};
                const body = '{"username": "Foo", "x-ibm-dx-tenant-base-url": "Bar"}';
                stub.onCall(0).yields(err, res, body);

                // Create a stub for the options.getProperty method to return null for the base-url.
                const originalGetProperty = options.getProperty;
                const stubProperty = sinon.stub(options, "getProperty", function (context, key) {
                    if (key === "x-ibm-dx-tenant-base-url") {
                        return null;
                    } else {
                        originalGetProperty(context, key);
                    }
                });

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stub);
                self.addTestDouble(stubProperty);

                // Save the base URL value.
                const origBaseUrl = context["x-ibm-dx-tenant-base-url"];

                // Call the method being tested.
                let error;
                loginREST.login(context, loginOptions)
                    .then(function (retval) {
                        // Verify that the expected value is returned.
                        expect(retval).to.not.be.empty;
                        expect(retval.username).to.contain(loginOptions.username);
                        expect(retval["x-ibm-dx-tenant-id"]).to.equal(UnitTest.DUMMY_ID);
                        expect(retval["x-ibm-dx-tenant-base-url"]).to.contain(UnitTest.DUMMY_URI);

                        // Verify that the stub was called once with the expected values.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[0].uri).to.contain(loginOptions["x-ibm-dx-tenant-base-url"]);
                        expect(stub.firstCall.args[0].headers["x-ibm-dx-tenant-id"]).to.equal(loginOptions["x-ibm-dx-tenant-id"]);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Restore the base URL value.
                        context["x-ibm-dx-tenant-base-url"] = origBaseUrl;

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed if the login request is retried once", function (done) {
                // Create a stub for the GET requests.
                const stub = sinon.stub(request.Request, "request");
                const LOGIN_ERROR = "Error logging in, expected by uint test.";
                const resFailure = {"statusCode": 500};
                const resSuccess = {"statusCode": 302, "headers": {"set-cookie": UnitTest.DUMMY_METADATA, "x-ibm-dx-tenant-id": UnitTest.DUMMY_ID}};
                stub.onCall(0).yields(new Error(LOGIN_ERROR), resFailure, null);
                stub.onCall(1).yields(null, resSuccess, null);

                // Create a spy for the utils.logWarnings method.
                const spy = sinon.spy(utils, "logRetryInfo");

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stub);
                self.addTestDouble(spy);

                // Call the method being tested.
                let error;
                loginREST.login(context, loginOptions)
                    .then(function (retval) {
                        // Verify that the expected value is returned.
                        expect(retval["username"]).to.equal(loginOptions.username);
                        expect(retval["x-ibm-dx-tenant-id"]).to.equal(UnitTest.DUMMY_ID);

                        // Verify that the stub was called twice with the expected values.
                        expect(stub).to.have.been.calledTwice;
                        expect(stub.firstCall.args[0].uri).to.contain(loginOptions["x-ibm-dx-tenant-base-url"]);
                        expect(stub.firstCall.args[0].headers["x-ibm-dx-tenant-id"]).to.equal(loginOptions["x-ibm-dx-tenant-id"]);
                        expect(stub.secondCall.args[0].uri).to.contain(loginOptions["x-ibm-dx-tenant-base-url"]);
                        expect(stub.secondCall.args[0].headers["x-ibm-dx-tenant-id"]).to.equal(loginOptions["x-ibm-dx-tenant-id"]);

                        // Verify that the password was not included in the log message.
                        expect(spy).to.have.been.calledOnce;
                        expect(spy.firstCall.args[1]).to.not.contain(loginOptions["password"]);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed if a relogin is attempted", function (done) {
                // Create a stub for the GET requests.
                const stub = sinon.stub(request, "get");
                const resSuccess = {"statusCode": 302, "headers": {"set-cookie": UnitTest.DUMMY_METADATA, "x-ibm-dx-tenant-id": UnitTest.DUMMY_ID}};
                stub.onFirstCall().yields(null, resSuccess, null);
                stub.onSecondCall().yields(null, resSuccess, null);
                const LOGIN_ERROR = "Error logging in, expected by uint test.";
                stub.onThirdCall().yields(new Error(LOGIN_ERROR), null, null);

                // The stub and spy should be restored when the test is complete.
                self.addTestDouble(stub);

                // Use an interval value that will cause an immediate relogin.
                const clonedOptions = utils.clone(loginOptions);
                clonedOptions["reloginInterval"] = 0;

                // Call the method being tested.
                let error;
                loginREST.login(context, clonedOptions)
                    .then(function (retval) {
                        // Verify that the expected value is returned.
                        expect(retval["username"]).to.equal(loginOptions.username);
                        expect(retval["x-ibm-dx-tenant-id"]).to.equal(UnitTest.DUMMY_ID);

                        // Verify that the stub was called once with the expected values.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[0].uri).to.contain(loginOptions["x-ibm-dx-tenant-base-url"]);
                        expect(stub.firstCall.args[0].headers["x-ibm-dx-tenant-id"]).to.equal(loginOptions["x-ibm-dx-tenant-id"]);

                        // Return a promise that will be resolved asynchronously, giving the relogin timer a chance to execute.
                        const deferred = Q.defer();
                        setTimeout(function () {deferred.resolve()}, 0);
                        return deferred.promise;
                    })
                    .then(function () {
                        // Verify that the stub was called again with the expected values.
                        expect(stub).to.have.been.calledTwice;
                        expect(stub.secondCall.args[0].uri).to.contain(loginOptions["x-ibm-dx-tenant-base-url"]);
                        expect(stub.secondCall.args[0].headers["x-ibm-dx-tenant-id"]).to.equal(loginOptions["x-ibm-dx-tenant-id"]);

                        // Return a promise that will be resolved asynchronously, giving the relogin timer a chance to execute again.
                        const deferred = Q.defer();
                        setTimeout(function () {deferred.resolve()}, 0);
                        return deferred.promise;
                    })
                    .then(function () {
                        // Clear the relogin timer so that it won't keep executing.
                        clearInterval(context.reloginTimer);

                        // Verify that the stub was called again with the expected values.
                        expect(stub).to.have.been.calledThrice;
                        expect(stub.secondCall.args[0].uri).to.contain(loginOptions["x-ibm-dx-tenant-base-url"]);
                        expect(stub.secondCall.args[0].headers["x-ibm-dx-tenant-id"]).to.equal(loginOptions["x-ibm-dx-tenant-id"]);
                    })
                    .catch(function (err) {
                        error = err;
                    })
                    .finally(function () {
                        // Remove the interval value we added for this test.
                        delete loginOptions["reloginInterval"];

                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }
}

module.exports = LoginRestUnitTest;
