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
"use strict";

const expect = require("chai").expect;
const sinon = require("sinon");
const path = require('path');
const fs = require('fs');
const oslocale = require("os-locale");
const Q = require("q");
const utils = require("../../lib/utils/utils.js");
const BaseUnit = require("./lib/base.unit.js");

describe("utils", function () {
    const context = BaseUnit.DEFAULT_API_CONTEXT;

    describe("isValidApiUrl", function () {
        it("should return false for undefined URL", function (done) {
            let error;
            try {
                const valid = utils.isValidApiUrl();
                expect(valid).to.be.false;
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });

        it("should return false for an invalid URL", function (done) {
            let error;
            try {
                const valid = utils.isValidApiUrl('foo');
                expect(valid).to.be.false;
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });

        it("should return true for a valid URL", function (done) {
            let error;
            try {
                const valid = utils.isValidApiUrl('https://dch-dxcloud.rtp.raleigh.ibm.com/api');
                expect(valid).to.be.true;
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });
    });

    describe("isInvalidPath", function () {
        it("should return false for a valid path", function (done) {
            let error;
            try {
                const valid = utils.isInvalidPath(__dirname);
                expect(valid).to.be.false;
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });

        it("should return true for an invalid Windows path, when on Windows", function (done) {
            let error;

            // Test the code path for Windows, which is more restrictive on valid filename chars
            const stubIsWindows = sinon.stub(utils, "isWindows");
            stubIsWindows.returns(true);

            try {
                const valid = utils.isInvalidPath('foo>bar|loren<ips*m?');
                expect(valid).to.be.true;
            } catch (err) {
                error = err;
            } finally {
                stubIsWindows.restore();
                done(error);
            }
        });
    });

    describe("getError", function () {
        it("should return the error passed in", function (done) {
            const TEST_ERROR = "Error message used for testing.";
            const testError = new Error(TEST_ERROR);
            const testBody = null;
            const testResponse = null;
            const testRequestOptions = null;
            let error;
            try {
                const error = utils.getError(testError, testBody, testResponse, testRequestOptions);
                expect(error.message).to.equal(TEST_ERROR);
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });

        it("should return a combined error", function (done) {
            const TEST_ERROR = "Error message used for testing.";
            const testError = new Error(TEST_ERROR);
            const testBody = null;
            const testResponse = {"statusCode": 404};
            const testRequestOptions = null;
            let error;
            try {
                const error = utils.getError(testError, testBody, testResponse, testRequestOptions);
                expect(error.message).to.equal(TEST_ERROR);
                expect(error.statusCode).to.equal(404);
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });

        it("should return an error based on a response code of 500", function (done) {
            const TEST_ERROR = "Error message used for testing.";
            const testError = new Error(TEST_ERROR);
            const testBody = null;
            const testResponse = {"statusCode": 500, "statusMessage": "Internal Server Error"};
            const testRequestOptions = null;
            let error;
            try {
                const error = utils.getError(testError, testBody, testResponse, testRequestOptions);
                expect(error.message).to.contain("service is reporting technical difficulties");
                expect(error.message).to.contain("Please try again later");
                expect(error.statusCode).to.equal(500);
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });

        it("should return an error based on a response code of 408", function (done) {
            const TEST_ERROR = "Error message used for testing.";
            const testError = new Error(TEST_ERROR);
            const testBody = null;
            const testResponse = {"statusCode": 408, "statusMessage": "Request Timeout"};
            const testRequestOptions = null;
            let error;
            try {
                const error = utils.getError(testError, testBody, testResponse, testRequestOptions);
                expect(error.message).to.contain("service is currently not available");
                expect(error.message).to.contain("Please try again later");
                expect(error.statusCode).to.equal(408);
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });

        it("should return an error based on a response code of 409", function (done) {
            const TEST_ERROR = "Error message used for testing.";
            const testError = new Error(TEST_ERROR);
            const testBody = null;
            const testResponse = {"statusCode": 409, "statusMessage": "Conflict"};
            const testRequestOptions = null;
            let error;
            try {
                const error = utils.getError(testError, testBody, testResponse, testRequestOptions);
                expect(error.message).to.contain("returned an error condition while processing the request for this artifact");
                expect(error.statusCode).to.equal(409);
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });

        it("should return an error based on a refused connection", function (done) {
            const TEST_ERROR = "Error message used for testing.";
            const testError = new Error(TEST_ERROR);
            const testBody = null;
            const testResponse = null;
            const testRequestOptions = null;
            let error;
            try {
                testError.code = "ECONNREFUSED";
                const error = utils.getError(testError, testBody, testResponse, testRequestOptions);
                expect(error.message).to.contain("service is currently not available");
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });

        it("should return an error based on a reset connection", function (done) {
            const TEST_ERROR = "Error message used for testing.";
            const testError = new Error(TEST_ERROR);
            const testBody = null;
            const testResponse = null;
            const testRequestOptions = null;
            let error;
            try {
                testError.code = "ECONNRESET";
                const error = utils.getError(testError, testBody, testResponse, testRequestOptions);
                expect(error.message).to.contain("service is currently not available");
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });

        it("should return an error based on the moreInformation property on the response body", function (done) {
            const TEST_ERROR = "Error message used for testing.";
            const testError = null;
            const testBody = {"moreInformation": TEST_ERROR};
            const testResponse = null;
            const testRequestOptions = null;
            let error;
            try {
                const error = utils.getError(testError, testBody, testResponse, testRequestOptions);
                expect(error.message).to.equal(TEST_ERROR);
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });

        it("should return an error based on the message property on the response body", function (done) {
            const TEST_ERROR = "Error message used for testing.";
            const testError = null;
            const testBody = {"message": TEST_ERROR};
            const testResponse = null;
            const testRequestOptions = null;
            let error;
            try {
                const error = utils.getError(testError, testBody, testResponse, testRequestOptions);
                expect(error.message).to.equal(TEST_ERROR);
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });

        it("should return an error based on the error property on the response body", function (done) {
            const TEST_ERROR = "Error message used for testing.";
            const testError = null;
            const testBody = {"error": new Error(TEST_ERROR)};
            const testResponse = null;
            const testRequestOptions = null;
            let error;
            try {
                const error = utils.getError(testError, testBody, testResponse, testRequestOptions);
                expect(error.message).to.equal(TEST_ERROR);
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });

        it("should return an error based on the errors (array) property on the response body", function (done) {
            const TEST_ERROR_1 = "First error message used for testing.";
            const TEST_ERROR_2 = "Second error message used for testing.";
            const testError = null;
            const testBody = {"errors": [new Error(TEST_ERROR_1), new Error(TEST_ERROR_2)]};
            const testResponse = null;
            const testRequestOptions = null;
            let error;
            try {
                const error = utils.getError(testError, testBody, testResponse, testRequestOptions);
                expect(error.message).to.contain(TEST_ERROR_1);
                expect(error.message).to.contain(TEST_ERROR_2);
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });

        it("should return an error based on the errors (non-array Error) property on the response body", function (done) {
            const TEST_ERROR_1 = "First error message used for testing.";
            const testError = null;
            const testBody = {"errors": new Error(TEST_ERROR_1)};
            const testResponse = null;
            const testRequestOptions = null;
            let error;
            try {
                const error = utils.getError(testError, testBody, testResponse, testRequestOptions);
                expect(error.message).to.contain(TEST_ERROR_1);
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });

        it("should return an error based on the errors (non-array string) property on the response body", function (done) {
            const TEST_ERROR_1 = "First error message used for testing.";
            const testError = null;
            const testBody = {"errors": TEST_ERROR_1};
            const testResponse = null;
            const testRequestOptions = null;
            let error;
            try {
                const error = utils.getError(testError, testBody, testResponse, testRequestOptions);
                expect(error.message).to.contain(TEST_ERROR_1);
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });

        it("should return an unknown error as a last resort", function (done) {
            const testError = null;
            const testBody = {"someProperty": "Not used as an error"};
            const testResponse = null;
            const testRequestOptions = null;
            let error;
            try {
                const error = utils.getError(testError, testBody, testResponse, testRequestOptions);
                expect(error.message).to.contain("Unknown error");
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });
    });

    describe("logErrors", function () {
        it("should log the error passed in", function (done) {
            const TEST_HEADING = "heading";
            const TEST_ERROR = "Error message used for testing.";
            const stub = sinon.stub(context.logger, "error");

            let error;
            try {
                utils.logErrors(context, TEST_HEADING, new Error(TEST_ERROR));
                expect(stub).to.have.been.calledOnce;
                expect(stub.args[0][0]).to.contain(TEST_HEADING);
                expect(stub.args[0][0]).to.contain(TEST_ERROR);
            } catch (err) {
                error = err;
            } finally {
                stub.restore();
                done(error);
            }
        });

        it("should log the string passed in", function (done) {
            const TEST_HEADING = "heading";
            const TEST_ERROR = "Error message used for testing.";
            const stub = sinon.stub(context.logger, "error");

            let error;
            try {
                utils.logErrors(context, TEST_HEADING, TEST_ERROR);
                expect(stub).to.have.been.calledOnce;
                expect(stub.args[0][0]).to.contain(TEST_ERROR);
            } catch (err) {
                error = err;
            } finally {
                stub.restore();
                done(error);
            }
        });
    });

    describe("logDebugInfo", function () {
        it("should log the info passed in", function (done) {
            const TEST_INFO = "Debug message used for testing";
            const stubLevel = sinon.stub(context.logger, "isLevelEnabled");
            stubLevel.returns(true);
            const stubDebug = sinon.stub(context.logger, "debug");

            let error;
            try {
                utils.logDebugInfo(context, TEST_INFO);
                expect(stubDebug).to.have.been.calledOnce;
                expect(stubDebug.args[0][0]).to.contain(TEST_INFO);
            } catch (err) {
                error = err;
            } finally {
                stubLevel.restore();
                stubDebug.restore();
                done(error);
            }
        });
        it("should log the info, response, and options passed in", function (done) {
            const TEST_INFO = "Debug message used for testing";
            const TEST_RESPONSE = {"statusCode": 400};
            const TEST_REQUEST_OPTIONS = {"uri": "http://debug.test.com"};
            const stubLevel = sinon.stub(context.logger, "isLevelEnabled");
            stubLevel.returns(true);
            const stubDebug = sinon.stub(context.logger, "debug");

            let error;
            try {
                utils.logDebugInfo(context, TEST_INFO, TEST_RESPONSE, TEST_REQUEST_OPTIONS);
                expect(stubDebug).to.have.been.calledOnce;
                expect(stubDebug.args[0][0]).to.contain(TEST_INFO);
                expect(stubDebug.args[0][0]).to.contain("http://debug.test.com");
                expect(stubDebug.args[0][0]).to.contain("400");
            } catch (err) {
                error = err;
            } finally {
                stubLevel.restore();
                stubDebug.restore();
                done(error);
            }
        });
    });

    describe("getHTTPLanguage", function () {
        before(function (done) {
            // Reset the utils object so that the tests are not affected by previously set values.
            utils.reset();

            done();
        });

        after(function (done) {
            // Reset the utils object so that subsequent tests are not affected by the values set here.
            utils.reset();

            done();
        });

        it("should not return a value for an undefined OS locale", function (done) {
            const stub = sinon.stub(oslocale, "sync");
            stub.returns(undefined);

            let error;
            try {
                const httpLanguage = utils.getHTTPLanguage();
                expect(httpLanguage).to.not.exist;
            } catch (e) {
                error = e;
            } finally {
                stub.restore();
                done(error);
            }
        });

        it("should succeed for an OS locale of American English", function (done) {
            const stub = sinon.stub(oslocale, "sync");
            stub.returns("en_US");

            let error;
            try {
                const httpLanguage = utils.getHTTPLanguage();
                expect(httpLanguage).to.equal("en-US");
            } catch (e) {
                error = e;
            } finally {
                stub.restore();
                done(error);
            }
        });

        it("should return American English for an undefined OS locale", function (done) {
            const stub = sinon.stub(oslocale, "sync");
            stub.returns("");

            let error;
            try {
                const httpLanguage = utils.getHTTPLanguage();
                expect(httpLanguage).to.equal("en-US");
            } catch (e) {
                error = e;
            } finally {
                stub.restore();
                done(error);
            }
        });
    });

    describe("getI18N", function () {
        const TEST_DEFAULT_LOCALE = "other";
        it("should succeed for an OS locale of American English", function (done) {
            const stub = sinon.stub(oslocale, "sync");
            stub.returns("en_US");

            let error;
            try {
                const i18n = utils.getI18N(__dirname);
                expect(i18n.locale).to.equal("en");
            } catch (e) {
                error = e;
            } finally {
                stub.restore();
                done(error);
            }
        });

        it("should succeed for an OS locale of French", function (done) {
            const stub = sinon.stub(oslocale, "sync");
            stub.returns("fr");

            let error;
            try {
                const i18n = utils.getI18N(__dirname, ".json", TEST_DEFAULT_LOCALE);
                expect(i18n.locale).to.equal("fr");
            } catch (e) {
                error = e;
            } finally {
                stub.restore();
                done(error);
            }
        });

        it("should succeed for an OS locale of French Canadian", function (done) {
            const stub = sinon.stub(oslocale, "sync");
            stub.returns("fr.CA");

            let error;
            try {
                const i18n = utils.getI18N(__dirname, ".json", TEST_DEFAULT_LOCALE);
                expect(i18n.locale).to.equal("fr");
            } catch (e) {
                error = e;
            } finally {
                stub.restore();
                done(error);
            }
        });

        it("should succeed by using the default locale for an undefined OS locale", function (done) {
            const stub = sinon.stub(oslocale, "sync");
            stub.returns("");

            let error;
            try {
                const i18n = utils.getI18N(__dirname, ".json", TEST_DEFAULT_LOCALE);
                expect(i18n.locale).to.equal(TEST_DEFAULT_LOCALE);
            } catch (e) {
                error = e;
            } finally {
                stub.restore();
                done(error);
            }
        });

        it("should succeed by using the default locale for an unknown OS locale", function (done) {
            const stub = sinon.stub(oslocale, "sync");
            stub.returns("qq");

            let error;
            try {
                const i18n = utils.getI18N(__dirname, ".json", TEST_DEFAULT_LOCALE);
                expect(i18n.locale).to.equal(TEST_DEFAULT_LOCALE);
            } catch (e) {
                error = e;
            } finally {
                stub.restore();
                done(error);
            }
        });

        it("should succeed by using the default locale when an nls directory is not found", function (done) {
            const stub = sinon.stub(oslocale, "sync");
            stub.returns("en_US");

            const dirWithoutNls = path.dirname(path.dirname(path.dirname(__dirname)));
            let error;
            try {
                const i18n = utils.getI18N(dirWithoutNls, ".json", TEST_DEFAULT_LOCALE);
                expect(i18n.locale).to.equal(TEST_DEFAULT_LOCALE);
            } catch (e) {
                error = e;
            } finally {
                stub.restore();
                done(error);
            }
        });
    });

    describe("throttledAll", function () {
        it("should throttle concurrency", function () {
            this.timeout(2000);

            // Fill the promise arrays with promises that resolve after a given delay.
            const promises1 = [];
            const promises2 = [];
            const delay500 = function () {
                // 500 ms delay
                const deferred = Q.defer();
                Q.delay(500)
                    .then(function () {
                        deferred.resolve();
                    });
                return deferred.promise;
            };
            const delay200 = function () {
                // 200 ms delay
                const deferred = Q.defer();
                Q.delay(200)
                    .then(function () {
                        deferred.resolve();
                    });
                return deferred.promise;
            };
            for (let i = 0; i < 10; i++) {
                promises1.push(delay500);
                promises2.push(delay200);
            }

            const limit = 2;
            let doneFirst = 0; // will be 1 or 2 depending on which array completes first

            // all in promises1 should execute concurrently and finish in 500ms
            // promises2 should be executed in 5 batches each taking 200ms = total of 1000ms
            return Q.all(
                [
                    Q.allSettled(promises1.map(function (promiseFn) { return promiseFn(); }))
                        .then(function () {
                            doneFirst = doneFirst || 1;
                            return doneFirst;
                        }),
                    utils.throttledAll(context, promises2, limit)
                        .then(function () {
                            doneFirst = doneFirst || 2;
                            return doneFirst;
                        })
                ])
                .then(function () {
                    expect(doneFirst).to.equal(1);
                });
        });

        it("should execute all tasks", function () {
            this.timeout(2000);
            let count = 0;
            const total = 10;
            const promises = [];
            const delay200 = function () {
                const deferred = Q.defer();
                Q.delay(200)
                    .then(function () {
                        deferred.resolve(++count);
                    });
                return deferred.promise;
            };
            for (let i = 0; i < total; i++) {
                promises.push(delay200);
            }

            // No limit is specified, so it will default to the length of the promises array (ie not really throttling).
            return utils.throttledAll(context, promises)
                .then(function () {
                    expect(count).to.equal(total);
                });
        });

        it("should never exceed the limit", function() {
            const limit = 15;
            let counter = 0;
            const promiseCount = 256;
            const promises = [];

            this.timeout(promiseCount / limit * 500);

            // I'm using Array(..).fill(..) instead of a for loop to get around
            // javascript's issues with scope and async functions
            Array(promiseCount).fill(0).forEach(function () {
                promises.push(function () {
                    counter++;
                    return Q.delay(200 + 100 * Math.random())
                        .then(function() {
                            expect(counter).to.be.at.most(limit);
                            counter--;
                            return counter;
                        });
                });
            });

            return utils.throttledAll(context, promises, limit);
        });

        it("should fail with an invalid limit", function () {
            const promises1 = [];
            const promises2 = [];
            const delay200 = function () {
                return Q.delay(200);
            };
            const reject = function () {
                return Q.reject(new Error("ff"));
            };

            // Fill the promise arrays with promises that resolve after 200ms
            for (let i = 0; i < 10; i++) {
                promises1.push(delay200);
                promises2.push(reject);
            }

            const limit = 2;

            return Q.all(
                [
                    Q.all(promises1)
                        .then(function () {
                        }),
                    utils.throttledAll(context, promises2, limit)
                        .then(function () {
                        })
                        .catch(function (err) {
                            expect(err).to.be.an("object");
                        })
                ]);
        });

        it("should execute all tasks even if one fails", function () {
            this.timeout(4000);
            let count = 0;
            const promises3 = [];
            const delay200 = function () {
                const deferred = Q.defer();
                Q.delay(200)
                    .then(function () {
                        if (count === 0) {
                            deferred.reject(new Error("Promise 0 was rejected with an Error."));
                        } else if (count === 1) {
                            deferred.reject({"message": "Promise 1 was rejected with an object."});
                        } else if (count === 2) {
                            deferred.reject("Promise 2 was rejected with a string.");
                        } else {
                            deferred.resolve(count);
                        }
                        count += 1;
                    });
                return deferred.promise;
            };
            for (let i = 0; i < 10; i++) {
                promises3.push(delay200);
            }

            const stubEnabled = sinon.stub(context.logger, "isDebugEnabled");
            stubEnabled.returns(true);

            const limit = 2;
            return utils.throttledAll(context, promises3, limit)
                .then(function (res) {
                    expect(count).to.equal(10);
                    for (let i = 0; i < 2; i++) {
                        expect(res[i].state).to.equals("rejected");
                    }
                    for (let i = 3; i < res.length; i++) {
                        expect(res[i].state).to.equals("fulfilled");
                    }
                })
                .finally(function () {
                    stubEnabled.restore();
                });
        });

        it("should fail if a promise function throws an exception", function (done) {
            const PROMISE_ERROR = "Error creating promise.";
            const throwException = function () {
                throw new Error(PROMISE_ERROR);
            };

            const promiseFunctions = [throwException];
            const limit = 2;
            let error;
            utils.throttledAll(context, promiseFunctions, limit)
                .then(function () {
                    // This is not expected. Pass the error to the "done" function to indicate a failed test.
                    error = new Error("The promise for the throttled functions should have been rejected.");
                })
                .catch(function (e) {
                    expect(e.message).to.contain(PROMISE_ERROR);
                })
                .catch(function (err) {
                    error = err;
                })
                .finally(function () {
                    done(error);
                });
        });
    });

    describe("pathNormalize", function () {
        it("should return a path", function (done) {
            try {
                const path = utils.pathNormalize("/assets");
                expect(path).to.be.an("string");
                done();
            } catch (e) {
                done(e);
            }
        });
    });

    describe("removeEmptyParentDirectories", function () {
        const basePath = "/one/two/three/four";
        const filePath = "/one/two/three/four/five/six/seven/eight/foo.bar";

        it("should work if no basePath specified", function (done) {
            // Create a stub for fs.readdirSync that returns an empty list at each level.
            const stubRead = sinon.stub(fs, "readdirSync");
            stubRead.returns([]);

            // Create a stub for fs.rmdirSync that does nothing.
            const stubRm = sinon.stub(fs, "rmdirSync");

            let error;
            try {
                utils.removeEmptyParentDirectories("", filePath);
                expect(stubRead).to.have.callCount(9);
                expect(stubRm).to.have.callCount(9);
            } catch (e) {
                error = e;
            } finally {
                stubRead.restore();
                stubRm.restore();
                done(error);
            }
        });

        it("should do nothing if the specified file is in basePath", function (done) {
            // Create a spy for fs.readdirSync to verify that it is not called.
            const spyRead = sinon.spy(fs, "readdirSync");

            // Create a spy for fs.rmdirSync to verify that it is not called.
            const spyRm = sinon.spy(fs, "rmdirSync");

            let error;
            try {
                utils.removeEmptyParentDirectories(basePath, basePath + "/foo.bar");
                expect(spyRead).to.not.have.been.called;
                expect(spyRm).to.not.have.been.called;
            } catch (e) {
                error = e;
            } finally {
                spyRead.restore();
                spyRm.restore();
                done(error);
            }
        });

        it("should work as expected if there is a sibling file", function (done) {
            // Create a stub for fs.readdirSync that returns a sibling file in the specified directory.
            const stubRead = sinon.stub(fs, "readdirSync");
            stubRead.returns(["ack.txt"]);

            // Create a spy for fs.rmdirSync to verify that it is not called.
            const spyRm = sinon.spy(fs, "rmdirSync");

            let error;
            try {
                utils.removeEmptyParentDirectories(basePath, filePath);
                expect(stubRead).to.have.been.calledOnce;
                expect(spyRm).to.not.have.been.called;
            } catch (e) {
                error = e;
            } finally {
                stubRead.restore();
                spyRm.restore();
                done(error);
            }
        });

        it("should work as expected if there is no sibling file", function (done) {
            // Create a stub for fs.readdirSync that returns a sibling file in the specified directory.
            const stubRead = sinon.stub(fs, "readdirSync");
            stubRead.returns(null);

            // Create a stub for fs.rmdirSync that does nothing.
            const stubRm = sinon.stub(fs, "rmdirSync");

            let error;
            try {
                utils.removeEmptyParentDirectories(basePath, filePath);
                expect(stubRead).to.have.callCount(4);
                expect(stubRm).to.have.callCount(4);
            } catch (e) {
                error = e;
            } finally {
                stubRead.restore();
                stubRm.restore();
                done(error);
            }
        });
    });

    describe("clone", function () {
        it("should return a matching object", function (done) {
            try {
                const orig = {assets:'foo'};
                const clone = utils.clone(orig);
                orig.assets = 'bar';
                expect(clone).to.be.an("object");
                expect(clone.assets).to.equal('foo');
                done();
            } catch (e) {
                done(e);
            }
        });

        it("should return the passed in string", function (done) {
            try {
                const obj = utils.clone('foo');
                expect(obj).to.be.a("string");
                done();
            } catch (e) {
                done(e);
            }
        });
    });

    describe("cloneOpts", function () {
        it("should succeed if no values specified", function (done) {
            try {
                const orig = {a: 'foo', b: 'bar'};
                const clone = utils.cloneOpts(orig);
                expect(clone).to.be.an("object");
                expect(clone.a).to.equal('foo');
                expect(clone.b).to.equal('bar');
                done();
            } catch (e) {
                done(e);
            }
        });

        it("should succeed if original undefined", function (done) {
            try {
                const orig = undefined;
                const clone = utils.cloneOpts(orig, {a: 'foo'});
                expect(clone).to.be.an("object");
                expect(clone.a).to.equal('foo');
                done();
            } catch (e) {
                done(e);
            }
        });

        it("should override properties", function (done) {
            try {
                const orig = {a: 'foo', b: 'bar'};
                const clone = utils.cloneOpts(orig, {b: 'ack'});
                expect(clone).to.be.an("object");
                expect(orig.a).to.equal('foo');
                expect(orig.b).to.equal('bar');
                expect(clone.a).to.equal('foo');
                expect(clone.b).to.equal('ack');
                done();
            } catch (e) {
                done(e);
            }
        });
    });

    describe("getUserHome", function () {
        it("should return the users home dir", function (done) {
            try {
                const home = utils.getUserHome();
                expect(home).to.be.an("string");
                done();
            } catch (e) {
                done(e);
            }
        });
    });

    describe("getLogger", function () {
        it("should return the logger", function (done) {
            try {
                const logger = utils.getLogger(utils.apisLog);
                expect(logger).to.be.an("object");
                done();
            } catch (e) {
                done(e);
            }
        });

        it("should return null", function (done) {
            try {
                const logger = utils.getLogger("foo");
                expect(logger).to.be.a("null");
                done();
            } catch (e) {
                done(e);
            }
        });
    });

    describe("reset", function () {
        it("should succeed", function (done) {
            try {
                utils.reset();
                done();
            } catch (e) {
                done(e);
            }
        });
    });

    describe("replaceAll", function () {
        it("should replace all occurrences in a string", function (done) {
            try {
                const original = "012345678901234567890123456789";
                const find = "3456";
                const replace = "foobar";
                const expected = "012foobar789012foobar789012foobar789";
                expect(utils.replaceAll(original, find, replace)).to.equal(expected);
                done();
            } catch (e) {
                done(e);
            }
        });
    });
});
