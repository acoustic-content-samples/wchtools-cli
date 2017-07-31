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
const utils = require("../../lib/utils/utils.js");
const cp = require('cp');
const path = require("path");
const fs = require("fs");
const sinon = require("sinon");
const options = require("../../lib/utils/options.js");
const BaseUnit = require("./lib/base.unit.js");

describe("options.js", function () {
    const context = BaseUnit.DEFAULT_API_CONTEXT;

    describe("getProperty()", function () {
        it("should return something synchronously", function () {
            // call getSettings() again to make sure it's synchronous
            const _settings = options.getProperty(context, "assets");
            expect(_settings).to.be.an("object");
        });

        it("should have limit property for types", function () {
            expect(options.getProperty(context, "types")).to.have.property("limit");
        });

        it("should return null for unknown property", function () {
            expect(options.getProperty(context, "red")).to.be.a('null');
        });
    });

    describe("setOptions()", function () {
        it("should not write to file if the options parameter is undefined", function () {
            const stub = sinon.stub(fs, "writeFileSync");
            options.setOptions(context, undefined, true);
            expect(stub).to.not.have.been.called;
            stub.restore();
        });

        it("should write to file if the options property is defined", function () {
            const stub = sinon.stub(fs, "writeFileSync");
            stub.returns('foo');
            options.setOptions(context, "options-test-property", true);
            expect(stub).to.have.been.calledOnce;
            stub.restore();
        });
    });

    describe("getInitializationErrors()", function () {
        const defaultFilename = path.resolve(__dirname + "./../../" + ".wchtoolsoptions");
        const localFilename = process.cwd() + path.sep + ".wchtoolsoptions";
        const userFilename = utils.getUserHome() + path.sep + ".wchtoolsoptions";

        after(function () {
            // Reset the options to the normal state so that subsequent tests can use them.
            options.initialize(context);
        });

        it("should not have initialization errors", function (done) {
            options.initialize(context);

            let error = undefined;
            try {
                expect(options.getInitializationErrors(context)).to.have.lengthOf(0);
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });

        it("should have two initialization errors for invalid default and user options files", function (done) {
            // Create a stub for fs.existsSync that will return false for the test options file.
            const originalExistsSync = fs.existsSync;
            let defaultFilenameExistsCount = 0;
            const stubExists = sinon.stub(fs, "existsSync", function (filename) {
                if (filename === defaultFilename) {
                    // The default filename should always exist. But if this test is running in the default directory,
                    // the defaultFilename and the localFilename will be the same. In that case, the stub should return
                    // true the first time it is called, and false the second time it is called.
                    if (defaultFilename === localFilename) {
                        return (defaultFilenameExistsCount++ < 1);
                    } else {
                        return true;
                    }
                } else if (filename === userFilename) {
                    return true;
                } else if (filename === localFilename) {
                    return false;
                } else {
                    return originalExistsSync.call(fs, filename);
                }
            });

            // Create a stub for fs.readFileSync that will return invlid JSON.
            const originalReadFileSync = fs.readFileSync;
            const stubRead = sinon.stub(fs, "readFileSync", function (filename, options) {
                // The default filename should always exist. But if this test is running in the default directory,
                // the defaultFilename and the localFilename will be the same. In that case, the stub may need to
                // return different content the first time it is called, than the second time it is called.
                if (filename === defaultFilename) {
                    return '{"foo": "bar", "fuz":{}';
                } else if (filename === userFilename) {
                    return '{"foo": "bar", "foz":{}';
                } else {
                    // Return the contents of the specified file.
                    return originalReadFileSync.call(fs, filename, options);
                }
            });

            options.initialize(context);

            let error = undefined;
            try {
                const errors = options.getInitializationErrors(context);
                expect(errors).to.have.lengthOf(2);
                expect(errors[0].message).to.contain(defaultFilename);
                expect(errors[1].message).to.contain(userFilename);
            } catch (err) {
                error = err;
            } finally {
                // Remove the initialization errors added by this test.
                delete context.initErrors;

                stubExists.restore();
                stubRead.restore();
                done(error);
            }
        });

        it("should have two initialization errors for invalid default and test options files", function (done) {
            // Create a stub for fs.existsSync that will return false for the test options file.
            const originalExistsSync = fs.existsSync;
            let defaultFilenameExistsCount = 0;
            const stubExists = sinon.stub(fs, "existsSync", function (filename) {
                if (filename === defaultFilename) {
                    // The default filename should always exist. But if this test is running in the default directory,
                    // the defaultFilename and the localFilename will be the same. In that case, the stub should return
                    // true both times it is called.
                    if (defaultFilename === localFilename) {
                        return (defaultFilenameExistsCount++ < 2);
                    } else {
                        return true;
                    }
                } else if (filename === localFilename) {
                    return true;
                } else if (filename === userFilename) {
                    return false;
                } else {
                    return originalExistsSync.call(fs, filename);
                }
            });

            // Create a stub for fs.readFileSync that will return invlid JSON.
            const originalReadFileSync = fs.readFileSync;
            let defaultFilenameReadCount = 0;
            const stubRead = sinon.stub(fs, "readFileSync", function (filename, options) {
                // The default filename should always exist. But if this test is running in the default directory,
                // the defaultFilename and the localFilename will be the same. In that case, the stub may need to
                // return different content the first time it is called, than the second time it is called.
                if (filename === defaultFilename) {
                    if (defaultFilenameReadCount++ === 0) {
                        return '{"foo": "bar", "fuz":{}';
                    } else {
                        return '{"foo": "bar", "foz":{}';
                    }
                } else if (filename === localFilename) {
                    return '{"foo": "bar", "foz":{}';
                } else {
                    // Return the contents of the specified file.
                    return originalReadFileSync.call(fs, filename, options);
                }
            });

            options.initialize(context);

            let error = undefined;
            try {
                const errors = options.getInitializationErrors(context);
                expect(errors).to.have.lengthOf(2);
                expect(errors[0].message).to.contain(defaultFilename);
                expect(errors[1].message).to.contain(localFilename);
            } catch (err) {
                error = err;
            } finally {
                // Remove the initialization errors added by this test.
                delete context.initErrors;

                stubExists.restore();
                stubRead.restore();
                done(error);
            }
        });
    });
});
