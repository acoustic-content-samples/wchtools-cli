/*
Copyright 2017 IBM Corporation

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
const fs = require("fs");
const path = require("path");
const utils = require("../../lib/utils/utils.js");
const options = require("../../lib/utils/options.js");
const hashes = require("../../lib/utils/hashes.js");
const UnitTest = require("./lib/base.unit");

// The default API context used for unit tests.
const context = UnitTest.DEFAULT_API_CONTEXT;

describe("hashes", function () {
    // Common test data.
    const TEST_TENANT_ID = "test-tenant-id";
    const TEST_TENANT_BASE_URL = "test-tenant-base-url";
    const CURRENT_DATE = new Date();
    const TOMORROW_DATE = new Date(CURRENT_DATE.getTime() + 86400000);
    const TEST_OPTS = {"x-ibm-dx-tenant-id": TEST_TENANT_ID, "x-ibm-dx-tenant-base-url": TEST_TENANT_BASE_URL};
    const TEST_DIRECTORY_PATH = __dirname + path.sep + "resources";
    const HASHES_FILE_PATH = TEST_DIRECTORY_PATH + path.sep + hashes.FILENAME;
    const NONEXISENT_FILE_PATH = TEST_DIRECTORY_PATH + path.sep + "foo.bar";

    // Test data for the text file.
    const TEXT_FILE_RELATIVE_PATH = "/bacon-ipsum.txt";
    const TEXT_FILE_PATH = TEST_DIRECTORY_PATH + TEXT_FILE_RELATIVE_PATH;
    const TEXT_FILE_MD5 = "6c5YOxPC+IbYaxtWY3rjDg==";
    const TEXT_FILE_ID = "test-text-id";
    const TEXT_FILE_REV = "test-text-rev";
    const TEXT_FILE_MODIFIED_REV = "test-text-modified-rev";
    const TEXT_FILE_LAST_MODIFIED = new Date(2010, 0, 1); // Date in 2010 should cause local file to be in modified list
    const TEXT_FILE_RESOURCE_ID = "test-text-resource-id";
    const TEXT_FILE_RESOURCE_ID_2 = "test-text-resource-id-2";
    const TEXT_FILE_METADATA = {"id": TEXT_FILE_ID, "rev": TEXT_FILE_REV, "lastModified": TEXT_FILE_LAST_MODIFIED, "resource": TEXT_FILE_RESOURCE_ID};

    // Test data for the image file.
    const IMAGE_FILE_RELATIVE_PATH = "/image.png";
    const IMAGE_FILE_PATH = TEST_DIRECTORY_PATH + IMAGE_FILE_RELATIVE_PATH;
    const IMAGE_FILE_MD5 = "tJlPKh2tPlhDiCBYx+bTmw==";
    const IMAGE_FILE_ID = "test-image-id";
    const IMAGE_FILE_REV = "test-image-rev";
    const IMAGE_FILE_LAST_MODIFIED = new Date(2030, 0, 1); // Date in 2030 should cause remote file to be in modified list
    const IMAGE_FILE_METADATA = {"id": IMAGE_FILE_ID, "rev": IMAGE_FILE_REV, "lastModified": IMAGE_FILE_LAST_MODIFIED};

    before(function () {
        // Make sure there is no hashes file before starting the tests.
        if (fs.existsSync(HASHES_FILE_PATH)) {
            fs.unlinkSync(HASHES_FILE_PATH);
        }
    });

    after(function () {
        // Make sure to delete the hashes file after finishing the tests.
        if (fs.existsSync(HASHES_FILE_PATH)) {
            fs.unlinkSync(HASHES_FILE_PATH);
        }
    });

    describe("generateMD5Hash", function () {
        it("should work for a text file", function (done) {
            let error = undefined;
            try {
                const md5 = hashes.generateMD5Hash(TEXT_FILE_PATH);
                expect(md5).to.equal(TEXT_FILE_MD5);
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });

        it("should work for an image file", function (done) {
            let error = undefined;
            try {
                const md5 = hashes.generateMD5Hash(IMAGE_FILE_PATH);
                expect(md5).to.equal(IMAGE_FILE_MD5);
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });
    });

    describe("updateHashes", function () {
        it("should create a hashes file with metadata for the specified file", function (done) {
            let error = undefined;
            try {
                const result = hashes.updateHashes(context, TEST_DIRECTORY_PATH, TEXT_FILE_PATH, TEXT_FILE_METADATA, TEST_OPTS);
                expect(result).to.exist;
                const tenantValues = result[TEST_TENANT_ID];
                expect(tenantValues).to.exist;
                const fileValues = tenantValues[TEXT_FILE_ID];
                expect(fileValues).to.exist;
                expect(fileValues.id).to.equal(TEXT_FILE_ID);
                expect(fileValues.rev).to.equal(TEXT_FILE_REV);
                expect(fileValues.md5).to.equal(TEXT_FILE_MD5);
                expect(fileValues.path).to.equal(TEXT_FILE_RELATIVE_PATH);
                expect(fileValues.resource).to.equal(TEXT_FILE_RESOURCE_ID);
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });

        it("should add metadata for the specified file to the hashes file", function (done) {
            // At this point the hashes file should already contain information for the text file.
            let error = undefined;
            try {
                const result = hashes.updateHashes(context, TEST_DIRECTORY_PATH, IMAGE_FILE_PATH, IMAGE_FILE_METADATA, TEST_OPTS);
                expect(result).to.exist;
                const tenantValues = result[TEST_TENANT_ID];
                expect(tenantValues).to.exist;
                const fileValues = tenantValues[IMAGE_FILE_ID];
                expect(fileValues).to.exist;
                expect(fileValues.id).to.equal(IMAGE_FILE_ID);
                expect(fileValues.rev).to.equal(IMAGE_FILE_REV);
                expect(fileValues.md5).to.equal(IMAGE_FILE_MD5);
                expect(fileValues.path).to.equal(IMAGE_FILE_RELATIVE_PATH);
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });

        it("should leave the hashes file unchanged if the specified file does not exist", function (done) {
            // At this point the hashes file should already contain information for the text and image files.
            let error = undefined;
            try {
                const result = hashes.updateHashes(context, TEST_DIRECTORY_PATH, null, null, TEST_OPTS);
                expect(result).to.exist;
                const tenantValues = result[TEST_TENANT_ID];
                expect(tenantValues).to.exist;
                let fileValues = tenantValues[TEXT_FILE_ID];
                expect(fileValues).to.exist;
                expect(fileValues.id).to.equal(TEXT_FILE_ID);
                expect(fileValues.rev).to.equal(TEXT_FILE_REV);
                expect(fileValues.md5).to.equal(TEXT_FILE_MD5);
                expect(fileValues.path).to.equal(TEXT_FILE_RELATIVE_PATH);
                expect(fileValues.resource).to.equal(TEXT_FILE_RESOURCE_ID);
                fileValues = tenantValues[IMAGE_FILE_ID];
                expect(fileValues).to.exist;
                expect(fileValues.id).to.equal(IMAGE_FILE_ID);
                expect(fileValues.rev).to.equal(IMAGE_FILE_REV);
                expect(fileValues.md5).to.equal(IMAGE_FILE_MD5);
                expect(fileValues.path).to.equal(IMAGE_FILE_RELATIVE_PATH);
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });

        it("should log an error and reinitialize if the tenant map cannot be loaded", function (done) {
            // At this point the hashes file should already contain information for the text and image files.
            const originalReadFileSync = fs.readFileSync;
            const TENANT_ERROR = "Tenant loading error expected by unit test.";
            const stubRead = sinon.stub(fs, "readFileSync", function (filename) {
                if (filename === TEXT_FILE_PATH) {
                    // Return the contents when reading the test file.
                    return originalReadFileSync.call(fs, filename);
                } else {
                    // Throw an exception when reading the hashes file.
                    throw new Error(TENANT_ERROR);
                }
            });

            // Stub the logger so that the error is not written.
            const stubLog = sinon.stub(context.logger, "error");

            let error = undefined;
            try {
                const result = hashes.updateHashes(context, TEST_DIRECTORY_PATH, TEXT_FILE_PATH, TEXT_FILE_METADATA, TEST_OPTS);
                delete context.hashes[TEST_DIRECTORY_PATH][TEST_TENANT_ID][IMAGE_FILE_ID];

                // An error is logged each time the hashes file is read. The updateHashes method reads the hashes file
                // twice -- the first time to get the metadata for the current tenant so that it can be modified, and
                // the second time to get the entire tenant map so that the modified data can be inserted.
                // expect(stubLog).to.have.been.calledTwice;
                // expect(stubLog.firstCall.args[0]).to.contain("Error in loadTenantMap");
                // expect(stubLog.firstCall.args[0]).to.contain(TENANT_ERROR);
                // expect(stubLog.secondCall.args[0]).to.contain("Error in loadTenantMap");
                // expect(stubLog.secondCall.args[0]).to.contain(TENANT_ERROR);

                // Because the existing tenant map could not be read, the result should only contain the metadata for
                // the file being updated. Any previous metadata for the current tenant is discarded.
                expect(result).to.exist;
                const tenantValues = result[TEST_TENANT_ID];
                expect(tenantValues).to.exist;
                const fileValues = tenantValues[TEXT_FILE_ID];
                expect(fileValues).to.exist;
                expect(fileValues.id).to.equal(TEXT_FILE_ID);
                expect(fileValues.rev).to.equal(TEXT_FILE_REV);
                expect(fileValues.md5).to.equal(TEXT_FILE_MD5);
                expect(fileValues.path).to.equal(TEXT_FILE_RELATIVE_PATH);
                expect(fileValues.resource).to.equal(TEXT_FILE_RESOURCE_ID);
                expect(tenantValues[IMAGE_FILE_ID]).to.not.exist;
            } catch (err) {
                error = err;
            } finally {
                stubRead.restore();
                stubLog.restore();
                done(error);
            }
        });

        it("should log an error and leave the hashes file unchanged if the save fails", function (done) {
            // At this point the hashes file should only contain information for the text file.
            const SAVE_ERROR = "Hashes file save error expected by unit test.";
            const stubWrite = sinon.stub(fs, "writeFileSync");
            stubWrite.throws(new Error(SAVE_ERROR));

            // Stub the logger so that the error is not written.
            const stubLog = sinon.stub(context.logger, "error");

            let error = undefined;
            try {
                context.hashes[TEST_DIRECTORY_PATH].updateCount = 25;
                const result = hashes.updateHashes(context, TEST_DIRECTORY_PATH, IMAGE_FILE_PATH, IMAGE_FILE_METADATA, TEST_OPTS);
                delete context.hashes[TEST_DIRECTORY_PATH][TEST_TENANT_ID][IMAGE_FILE_ID];

                expect(stubLog).to.have.been.calledOnce;
                expect(stubLog.firstCall.args[0]).to.contain("Error in saveHashes");
                expect(stubLog.firstCall.args[0]).to.contain(SAVE_ERROR);

                // Because the hashes file could not be saved, the result should contain the metadata for the text file
                // but not for the image file.
                expect(result).to.exist;
                const tenantValues = result[TEST_TENANT_ID];
                expect(tenantValues).to.exist;
                const fileValues = tenantValues[TEXT_FILE_ID];
                expect(fileValues).to.exist;
                expect(fileValues.id).to.equal(TEXT_FILE_ID);
                expect(fileValues.rev).to.equal(TEXT_FILE_REV);
                expect(fileValues.md5).to.equal(TEXT_FILE_MD5);
                expect(fileValues.path).to.equal(TEXT_FILE_RELATIVE_PATH);
                expect(fileValues.resource).to.equal(TEXT_FILE_RESOURCE_ID);
                expect(tenantValues[IMAGE_FILE_ID]).to.not.exist;
            } catch (err) {
                error = err;
            } finally {
                stubWrite.restore();
                stubLog.restore();
                done(error);
            }
        });

        it("should log an error and leave the hashes file unchanged if the update fails", function (done) {
            // At this point the hashes file should only contain information for the text file.
            const UPDATE_ERROR = "Hashes file update error expected by unit test.";
            const stub = sinon.stub(utils, "getRelativePath");
            stub.throws(new Error(UPDATE_ERROR));

            // Stub the logger so that the error is not written.
            const stubLog = sinon.stub(context.logger, "error");

            let error = undefined;
            try {
                const result = hashes.updateHashes(context, TEST_DIRECTORY_PATH, IMAGE_FILE_PATH, IMAGE_FILE_METADATA, TEST_OPTS);

                expect(stubLog).to.have.been.calledOnce;
                expect(stubLog.firstCall.args[0]).to.contain("Error in updateHashes");
                expect(stubLog.firstCall.args[0]).to.contain(UPDATE_ERROR);

                // Because the hashes file could not be updated, the result should contain the metadata for the text
                // file but not for the image file.
                expect(result).to.exist;
                const tenantValues = result[TEST_TENANT_ID];
                expect(tenantValues).to.exist;
                const fileValues = tenantValues[TEXT_FILE_ID];
                expect(fileValues).to.exist;
                expect(fileValues.id).to.equal(TEXT_FILE_ID);
                expect(fileValues.rev).to.equal(TEXT_FILE_REV);
                expect(fileValues.md5).to.equal(TEXT_FILE_MD5);
                expect(fileValues.path).to.equal(TEXT_FILE_RELATIVE_PATH);
                expect(fileValues.resource).to.equal(TEXT_FILE_RESOURCE_ID);
                expect(tenantValues[IMAGE_FILE_ID]).to.not.exist;
            } catch (err) {
                error = err;
            } finally {
                stub.restore();
                stubLog.restore();
                done(error);
            }
        });

        it("should update the existing metadata for the specified file", function (done) {
            let error = undefined;
            try {
                const metadata = utils.clone(TEXT_FILE_METADATA);
                metadata.resource = TEXT_FILE_RESOURCE_ID_2;
                const result = hashes.updateHashes(context, TEST_DIRECTORY_PATH, TEXT_FILE_PATH, metadata, TEST_OPTS);
                expect(result).to.exist;
                const tenantValues = result[TEST_TENANT_ID];
                expect(tenantValues).to.exist;
                const fileValues = tenantValues[TEXT_FILE_ID];
                expect(fileValues).to.exist;
                expect(fileValues.id).to.equal(TEXT_FILE_ID);
                expect(fileValues.rev).to.equal(TEXT_FILE_REV);
                expect(fileValues.md5).to.equal(TEXT_FILE_MD5);
                expect(fileValues.path).to.equal(TEXT_FILE_RELATIVE_PATH);
                expect(fileValues.resource).to.equal(TEXT_FILE_RESOURCE_ID_2);
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });
    });

    describe("setLastPullTimestamp", function () {
        it("should log an error and leave the hashes file unchanged if the set fails", function (done) {
            // At this point the hashes file should only contain information for the text file.
            const SET_ERROR = "Set timestamp error expected by unit test.";
            const stub = sinon.stub(options, "getRelevantOption");
            stub.onFirstCall().returns(true);
            stub.onSecondCall().throws(new Error(SET_ERROR));

            // Stub the logger so that the error is not written.
            const stubLog = sinon.stub(context.logger, "error");

            let error = undefined;
            try {
                const result = hashes.setLastPullTimestamp(context, TEST_DIRECTORY_PATH, CURRENT_DATE, TEST_OPTS);

                expect(stubLog).to.have.been.calledOnce;
                expect(stubLog.firstCall.args[0]).to.contain("Error in setLastPullTimestamp");
                expect(stubLog.firstCall.args[0]).to.contain(SET_ERROR);

                // Because the timestamp could not be set, the result should be undefined.
                expect(result).to.exist;
                const tenantValues = result[TEST_TENANT_ID];
                expect(tenantValues).to.exist;
                const lastPullTimestamp = tenantValues["lastPullTimestamp"];
                expect(lastPullTimestamp).to.not.exist;
                const fileValues = tenantValues[TEXT_FILE_ID];
                expect(fileValues).to.exist;
                expect(fileValues.id).to.equal(TEXT_FILE_ID);
                expect(fileValues.rev).to.equal(TEXT_FILE_REV);
                expect(fileValues.md5).to.equal(TEXT_FILE_MD5);
                expect(fileValues.path).to.equal(TEXT_FILE_RELATIVE_PATH);
                expect(fileValues.resource).to.equal(TEXT_FILE_RESOURCE_ID_2);
                expect(tenantValues[IMAGE_FILE_ID]).to.not.exist;
            } catch (err) {
                error = err;
            } finally {
                stub.restore();
                stubLog.restore();
                done(error);
            }
        });

        it("should set the specified timestamp", function (done) {
            let error = undefined;
            try {
                const result = hashes.setLastPullTimestamp(context, TEST_DIRECTORY_PATH, CURRENT_DATE, TEST_OPTS);
                expect(result).to.exist;
                const tenantValues = result[TEST_TENANT_ID];
                expect(tenantValues).to.exist;
                const lastPullTimestamp = tenantValues["lastPullTimestamp"];
                expect(lastPullTimestamp.getTime()).to.equal(CURRENT_DATE.getTime());
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });
    });

    describe("getLastPullTimestamp", function () {
        it("should return the timestamp that was set", function (done) {
            let error = undefined;
            try {
                const lastPullTimestamp = hashes.getLastPullTimestamp(context, TEST_DIRECTORY_PATH, TEST_OPTS);
                expect(lastPullTimestamp).to.exist;
                const lastPullDate = new Date(lastPullTimestamp);
                expect(lastPullDate.getTime()).to.equal(CURRENT_DATE.getTime());
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });
    });

    describe("setLastPushTimestamp", function () {
        it("should log an error and leave the hashes file unchanged if the set fails", function (done) {
            // At this point the hashes file should only contain information for the text file and the pull timestamp.
            const SET_ERROR = "Set timestamp error expected by unit test.";
            const stub = sinon.stub(options, "getRelevantOption");
            stub.onFirstCall().returns(true);
            stub.onSecondCall().throws(new Error(SET_ERROR));

            // Stub the logger so that the error is not written.
            const stubLog = sinon.stub(context.logger, "error");

            let error = undefined;
            try {
                const result = hashes.setLastPushTimestamp(context, TEST_DIRECTORY_PATH, CURRENT_DATE, TEST_OPTS);

                expect(stubLog).to.have.been.calledOnce;
                expect(stubLog.firstCall.args[0]).to.contain("Error in setLastPushTimestamp");
                expect(stubLog.firstCall.args[0]).to.contain(SET_ERROR);

                // Because the timestamp could not be set, the result should be undefined.
                expect(result).to.exist;
                const tenantValues = result[TEST_TENANT_ID];
                expect(tenantValues).to.exist;
                const lastPullTimestamp = tenantValues["lastPullTimestamp"];
                expect(lastPullTimestamp).to.exist;
                const lastPushTimestamp = tenantValues["lastPushTimestamp"];
                expect(lastPushTimestamp).to.not.exist;
                const fileValues = tenantValues[TEXT_FILE_ID];
                expect(fileValues).to.exist;
                expect(fileValues.id).to.equal(TEXT_FILE_ID);
                expect(fileValues.rev).to.equal(TEXT_FILE_REV);
                expect(fileValues.md5).to.equal(TEXT_FILE_MD5);
                expect(fileValues.path).to.equal(TEXT_FILE_RELATIVE_PATH);
                expect(fileValues.resource).to.equal(TEXT_FILE_RESOURCE_ID_2);
                expect(tenantValues[IMAGE_FILE_ID]).to.not.exist;
            } catch (err) {
                error = err;
            } finally {
                stub.restore();
                stubLog.restore();
                done(error);
            }
        });

        it("should set the specified timestamp", function (done) {
            let error = undefined;
            try {
                const result = hashes.setLastPushTimestamp(context, TEST_DIRECTORY_PATH, CURRENT_DATE, TEST_OPTS);
                expect(result).to.exist;
                const tenantValues = result[TEST_TENANT_ID];
                expect(tenantValues).to.exist;
                const lastPushTimestamp = tenantValues["lastPushTimestamp"];
                expect(lastPushTimestamp.getTime()).to.equal(CURRENT_DATE.getTime());
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });
    });

    describe("getLastPushTimestamp", function () {
        it("should return the timestamp that was set", function (done) {
            let error = undefined;
            try {
                const lastPushTimestamp = hashes.getLastPushTimestamp(context, TEST_DIRECTORY_PATH, TEST_OPTS);
                expect(lastPushTimestamp).to.exist;
                const lastPushDate = new Date(lastPushTimestamp);
                expect(lastPushDate.getTime()).to.equal(CURRENT_DATE.getTime());
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });
    });

    describe("getHashesForFile", function () {
        it("should get the exisitng metadata from the hashes file", function (done) {
            let error = undefined;
            try {
                const result = hashes.getHashesForFile(context, TEST_DIRECTORY_PATH, TEXT_FILE_PATH, TEST_OPTS);
                expect(result).to.exist;
                expect(result.id).to.equal(TEXT_FILE_ID);
                expect(result.rev).to.equal(TEXT_FILE_REV);
                expect(result.md5).to.equal(TEXT_FILE_MD5);
                expect(result.path).to.equal(TEXT_FILE_RELATIVE_PATH);
                expect(result.resource).to.equal(TEXT_FILE_RESOURCE_ID_2);
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });

        it("should not get a result for a file that has no metadata", function (done) {
            let error = undefined;
            try {
                const result = hashes.getHashesForFile(context, TEST_DIRECTORY_PATH, IMAGE_FILE_PATH, TEST_OPTS);
                expect(result).to.not.exist;
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });

        it("should log an error and leave the hashes file unchanged if the retrieval fails", function (done) {
            // At this point the hashes file should only contain information for the text file.
            const RETRIEVE_ERROR = "Hashes file retrieval error expected by unit test.";
            const stub = sinon.stub(options, "getRelevantOption");
            stub.onFirstCall().returns(true);
            stub.onSecondCall().throws(new Error(RETRIEVE_ERROR));

            // Stub the logger so that the error is not written.
            const stubLog = sinon.stub(context.logger, "error");

            let error = undefined;
            try {
                const result = hashes.getHashesForFile(context, TEST_DIRECTORY_PATH, TEXT_FILE_PATH, TEST_OPTS);

                expect(stubLog).to.have.been.calledOnce;
                expect(stubLog.firstCall.args[0]).to.contain("Error in getHashesForFile");
                expect(stubLog.firstCall.args[0]).to.contain(RETRIEVE_ERROR);

                // Because the hashes for the file could not be retrieved, the result should be undefined.
                expect(result).to.not.exist;
            } catch (err) {
                error = err;
            } finally {
                stub.restore();
                stubLog.restore();
                done(error);
            }
        });
    });

    describe("listFiles", function () {
        it("should list the files with existing metadata", function (done) {
            let error = undefined;
            try {
                const result = hashes.listFiles(context, TEST_DIRECTORY_PATH, TEST_OPTS);
                expect(result).to.exist;
                expect(result.length).to.equal(1);
                expect(result[0]).to.equal(TEXT_FILE_RELATIVE_PATH);
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });
    });

    describe("isLocalModified", function () {
        it("should return false (not new or modified) for an existing local file that has not been modified", function (done) {
            let error = undefined;
            try {
                const result = hashes.isLocalModified(context, null, TEST_DIRECTORY_PATH, TEXT_FILE_PATH, TEST_OPTS);
                expect(result).to.be.false;
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });

        it("should return true (is modified) for an existing local file that has been modified", function (done) {
            // Stub fs.statSync() to set the modified date to tomorrow.
            const originalStatSync = fs.statSync;
            const stubStat = sinon.stub(fs, "statSync", function (filename) {
                // Get the actual results for the specified file.
                const result = originalStatSync.call(fs, filename);

                // Return the results with the modified timestamp set to a later date.
                result.mtime = TOMORROW_DATE;
                return result;
            });

            // Stub fs.readFileSync() to return different file contents for the test file.
            const originalReadFileSync = fs.readFileSync;
            const stubRead = sinon.stub(fs, "readFileSync", function (filename) {
                if (filename === TEXT_FILE_PATH) {
                    // Return different contents when reading the test file.
                    return new Buffer("Different contents than the actual file.");
                } else {
                    // Return the actual contents when reading other files.
                    return originalReadFileSync.call(fs, filename);
                }
            });

            let error = undefined;
            try {
                const result = hashes.isLocalModified(context, [hashes.MODIFIED], TEST_DIRECTORY_PATH, TEXT_FILE_PATH, TEST_OPTS);
                expect(result).to.be.true;
            } catch (err) {
                error = err;
            } finally {
                stubStat.restore();
                stubRead.restore();
                done(error);
            }
        });

        it("should return false (not modified) for an existing local file that has not been modified but has a different modified date", function (done) {
            // Stub fs.statSync() to set the modified date to tomorrow.
            const originalStatSync = fs.statSync;
            const stubStat = sinon.stub(fs, "statSync", function (filename) {
                // Get the actual results for the specified file.
                const result = originalStatSync.call(fs, filename);

                // Return the results with the modified timestamp set to a later date.
                result.mtime = TOMORROW_DATE;
                return result;
            });

            let error = undefined;
            try {
                const result = hashes.isLocalModified(context, [hashes.MODIFIED], TEST_DIRECTORY_PATH, TEXT_FILE_PATH, TEST_OPTS);
                expect(result).to.be.false;
                // Note that this test will modify the metadata in the hashes file. The last modified date for the text
                // file will now be the "tomorrow" date.
            } catch (err) {
                error = err;
            } finally {
                stubStat.restore();
                done(error);
            }
        });

        it("should return false (not modified) for a local file that has no metadata", function (done) {
            let error = undefined;
            try {
                const result = hashes.isLocalModified(context, [hashes.MODIFIED], TEST_DIRECTORY_PATH, IMAGE_FILE_PATH, TEST_OPTS);
                expect(result).to.be.false;
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });

        it("should return true (is new) for a local file that has no metadata", function (done) {
            let error = undefined;
            try {
                const result = hashes.isLocalModified(context, [hashes.NEW], TEST_DIRECTORY_PATH, IMAGE_FILE_PATH, TEST_OPTS);
                expect(result).to.be.true;
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });

        it("should return false (not modified) for a local file that does not exist", function (done) {
            let error = undefined;
            try {
                const result = hashes.isLocalModified(context, [hashes.MODIFIED], TEST_DIRECTORY_PATH, NONEXISENT_FILE_PATH, TEST_OPTS);
                expect(result).to.be.false;
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });

        it("should return false (not new) for a local file that does not exist", function (done) {
            let error = undefined;
            try {
                const result = hashes.isLocalModified(context, [hashes.NEW], TEST_DIRECTORY_PATH, NONEXISENT_FILE_PATH, TEST_OPTS);
                expect(result).to.be.false;
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });
    });

    describe("isRemoteModified", function () {
        it("should return false (not new or modified) for a remote file that exists locally and has not been modified", function (done) {
            let error = undefined;
            try {
                const result = hashes.isRemoteModified(context, null, TEXT_FILE_METADATA, TEST_DIRECTORY_PATH, TEXT_FILE_PATH, TEST_OPTS);
                expect(result).to.be.false;
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });

        it("should return false (not modified) for a remote file that has no local metadata", function (done) {
            let error = undefined;
            try {
                const result = hashes.isRemoteModified(context, [hashes.MODIFIED], IMAGE_FILE_METADATA, TEST_DIRECTORY_PATH, IMAGE_FILE_PATH, TEST_OPTS);
                expect(result).to.be.false;
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });

        it("should return true (is modified) for a remote file that has a different revision", function (done) {
            let error = undefined;
            try {
                const modifiedMetadata = utils.clone(TEXT_FILE_METADATA);
                modifiedMetadata.rev = TEXT_FILE_MODIFIED_REV;
                const result = hashes.isRemoteModified(context, [hashes.MODIFIED], modifiedMetadata, TEST_DIRECTORY_PATH, TEXT_FILE_PATH, TEST_OPTS);
                expect(result).to.be.true;
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });

        it("should return true (is new) for a remote file that does not exist locally", function (done) {
            let error = undefined;
            try {
                const result = hashes.isRemoteModified(context, [hashes.NEW], {}, TEST_DIRECTORY_PATH, NONEXISENT_FILE_PATH, TEST_OPTS);
                expect(result).to.be.true;
            } catch (err) {
                error = err;
            } finally {
                done(error);
            }
        });
    });
});
