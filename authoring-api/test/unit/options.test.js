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

describe("options.js", function () {
    describe("getProperty()", function () {
        it("should return something synchronously", function () {
            // call getSettings() again to make sure it's synchronous
            const _settings = options.getProperty("assets");
            expect(_settings).to.be.an("object");
        });

        it("should have uri properties for types and presentations", function () {
            expect(options.getProperty("types")).to.not.have.property("uri");
            expect(options.getProperty("presentations")).to.not.have.property("uri");
        });

        it("should return null for unknown property", function () {
            expect(options.getProperty("red")).to.be.a('null');
        });
    });

    describe("setOptions()", function () {
        it("set options should not call getproperty if the parameter is undefined", function () {
            const spy = sinon.spy(fs, "writeFileSync");
            options.setOptions(undefined, true);
            expect(spy).to.have.not.been.calledOnce;
            spy.restore();
        });

        it("should return a prop for set user property", function () {
            const stub = sinon.stub(fs, "writeFileSync");
            stub.returns('foo');
            options.setOptions("types", true);
            expect(stub).to.have.been.calledOnce;
            stub.restore();
        });
    });

    describe("setGlobalOptions()", function () {
        it("set options should not call getproperty if the parameter is undefined", function () {
            const spy = sinon.spy(options, "getProperty");
            options.setGlobalOptions();
            expect(spy).to.not.have.been.called;
            spy.restore();
        });
    });

    describe("getInitializationErrors()", function () {
        const defaultFilename = path.resolve(__dirname + "./../../" + ".wchtoolsoptions");
        const localFilename = process.cwd() + path.sep + ".wchtoolsoptions";
        const userFilename = utils.getUserHome() + path.sep + ".wchtoolsoptions";
        const oldUserFilename1 = utils.getUserHome() + path.sep + ".wchtoolsuseroptions";
        const oldUserFilename2 = utils.getUserHome() + path.sep + "dx_user_options.json";

        after(function () {
            // Reset the options to the normal state so that subsequent tests can use them.
            options.resetState();
        });

        it("should not have initialization errors", function (done) {
            options.resetState();

            let error;
            try {
                expect(options.getInitializationErrors()).to.have.lengthOf(0);
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
                } else if (filename === localFilename) {
                    return false;
                } else if (filename === userFilename) {
                    return true;
                } else if (filename === oldUserFilename1) {
                    return false;
                } else if (filename === oldUserFilename2) {
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

            options.resetState();

            let error;
            try {
                const errors = options.getInitializationErrors();
                expect(errors).to.have.lengthOf(2);
                expect(errors[0].message).to.contain(defaultFilename);
                expect(errors[1].message).to.contain(userFilename);
            } catch (err) {
                error = err;
            } finally {
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
                } else if (filename === oldUserFilename1) {
                    return false;
                } else if (filename === oldUserFilename2) {
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

            options.resetState();

            let error;
            try {
                const errors = options.getInitializationErrors();
                expect(errors).to.have.lengthOf(2);
                expect(errors[0].message).to.contain(defaultFilename);
                expect(errors[1].message).to.contain(localFilename);
            } catch (err) {
                error = err;
            } finally {
                stubExists.restore();
                stubRead.restore();
                done(error);
            }
        });

        it("should have one initialization errors for invalid old (1) user options file", function (done) {
            // Create a stub for fs.existsSync that will return true for the user options file after it has been renamed.
            const originalExistsSync = fs.existsSync;
            let defaultFilenameExistsCount = 0;
            let userFilenameExists = false;
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
                } else if (filename === localFilename) {
                    return false;
                } else if (filename === userFilename) {
                    return userFilenameExists;
                } else if (filename === oldUserFilename1) {
                    return true;
                } else if (filename === oldUserFilename2) {
                    return false;
                } else {
                    return originalExistsSync.call(fs, filename);
                }
            });

            // Create a stub for fs.readFileSync that will return invalid JSON for the user options file.
            const originalReadFileSync = fs.readFileSync;
            const stubRead = sinon.stub(fs, "readFileSync", function (filename, options) {
                if (filename === defaultFilename) {
                    return '{"foo": "bar", "fuz":{}}';
                } else if (filename === userFilename) {
                    return '{"foo": "bar", "foz":{}';
                } else {
                    // Return the contents of the specified file.
                    return originalReadFileSync.call(fs, filename, options);
                }
            });

            // Create a stub for fs.renameSync.
            const stubRename = sinon.stub(fs, "renameSync", function (oldName, newName) {
                // After the old user options file is renamed, then the user options file exists.
                if (newName === userFilename) {
                    userFilenameExists = true;
                }
            });

            options.resetState();

            let error;
            try {
                // Verify that the rename stub was called with the expected values.
                expect(stubRename).to.have.been.calledOnce;
                expect(stubRename.firstCall.args[0]).to.contain(oldUserFilename1);
                expect(stubRename.firstCall.args[1]).to.contain(userFilename);

                // Expect there to be one initialization error.
                const errors = options.getInitializationErrors();
                expect(errors).to.have.lengthOf(1);
                expect(errors[0].message).to.contain(userFilename);
            } catch (err) {
                error = err;
            } finally {
                stubExists.restore();
                stubRead.restore();
                stubRename.restore();
                done(error);
            }
        });

        it("should have one initialization errors for invalid old (2) user options file", function (done) {
            // Create a stub for fs.existsSync that will return true for the user options file after it has been renamed.
            const originalExistsSync = fs.existsSync;
            let defaultFilenameExistsCount = 0;
            let userFilenameExists = false;
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
                } else if (filename === localFilename) {
                    return false;
                } else if (filename === userFilename) {
                    return userFilenameExists;
                } else if (filename === oldUserFilename1) {
                    return false;
                } else if (filename === oldUserFilename2) {
                    return true;
                } else {
                    return originalExistsSync.call(fs, filename);
                }
            });

            // Create a stub for fs.readFileSync that will return invalid JSON for the user options file.
            const originalReadFileSync = fs.readFileSync;
            const stubRead = sinon.stub(fs, "readFileSync", function (filename, options) {
                if (filename === defaultFilename) {
                    return '{"foo": "bar", "fuz":{}}';
                } else if (filename === userFilename) {
                    return '{"foo": "bar", "foz":{}';
                } else {
                    // Return the contents of the specified file.
                    return originalReadFileSync.call(fs, filename, options);
                }
            });

            // Create a stub for fs.renameSync.
            const stubRename = sinon.stub(fs, "renameSync", function (oldName, newName) {
                // After the old user options file is renamed, then the user options file exists.
                if (newName === userFilename) {
                    userFilenameExists = true;
                }
            });

            options.resetState();

            let error;
            try {
                // Verify that the rename stub was called with the expected values.
                expect(stubRename).to.have.been.calledOnce;
                expect(stubRename.firstCall.args[0]).to.contain(oldUserFilename2);
                expect(stubRename.firstCall.args[1]).to.contain(userFilename);

                // Expect there to be one initialization error.
                const errors = options.getInitializationErrors();
                expect(errors).to.have.lengthOf(1);
                expect(errors[0].message).to.contain(userFilename);
            } catch (err) {
                error = err;
            } finally {
                stubExists.restore();
                stubRead.restore();
                stubRename.restore();
                done(error);
            }
        });

        it("should delete old user options files", function (done) {
            // Create a stub for fs.existsSync that will return true for all user options files.
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
                } else if (filename === localFilename) {
                    return false;
                } else if (filename === userFilename) {
                    return true;
                } else if (filename === oldUserFilename1) {
                    return true;
                } else if (filename === oldUserFilename2) {
                    return true;
                } else {
                    return originalExistsSync.call(fs, filename);
                }
            });

            // Create a stub for fs.readFileSync that will return invalid JSON for the user options file.
            const originalReadFileSync = fs.readFileSync;
            const stubRead = sinon.stub(fs, "readFileSync", function (filename, options) {
                if (filename === defaultFilename) {
                    return '{"foo": "bar", "fuz":{}}';
                } else if (filename === userFilename) {
                    return '{"foo": "bar", "fuz":{}}';
                } else {
                    // Return the contents of the specified file.
                    return originalReadFileSync.call(fs, filename, options);
                }
            });

            // Create a stub for fs.unlinkSync.
            const stubUnlink = sinon.stub(fs, "unlinkSync");

            options.resetState();

            let error;
            try {
                // Verify that the rename stub was called with the expected values.
                expect(stubUnlink).to.have.been.calledTwice;
                expect(stubUnlink.firstCall.args[0]).to.contain(oldUserFilename1);
                expect(stubUnlink.secondCall.args[0]).to.contain(oldUserFilename2);

                // Expect there to be no initialization errors.
                const errors = options.getInitializationErrors();
                expect(errors).to.have.lengthOf(0);
            } catch (err) {
                error = err;
            } finally {
                stubExists.restore();
                stubRead.restore();
                stubUnlink.restore();
                done(error);
            }
        });
    });
});
