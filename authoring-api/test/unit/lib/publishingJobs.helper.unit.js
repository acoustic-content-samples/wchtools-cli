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
 * Unit tests for the publishingJobsHelper object.
 */
"use strict";

// Require the super classes for this class.
const UnitTest = require("./base.unit.js");
const PublishingJobsUnitTest = require("./publishingJobs.unit.js");

// Require the node modules used in this test file.
const fs = require("fs");
const stream = require("stream");
const diff = require("diff");
const sinon = require("sinon");
const options = require(UnitTest.API_PATH + "lib/utils/options.js");

// Require the local modules that will be stubbed, mocked, and spied.
const publishingJobsREST = require(UnitTest.API_PATH + "lib/publishingJobsREST.js").instance;

// Require the local module being tested.
const publishingJobsHelper = require(UnitTest.API_PATH + "publishingJobsHelper.js").instance;
const path1 = PublishingJobsUnitTest.VALID_PUBLISHING_JOBS_DIRECTORY + PublishingJobsUnitTest.VALID_PUBLISHING_JOB_1;
const path2 = PublishingJobsUnitTest.VALID_PUBLISHING_JOBS_DIRECTORY + PublishingJobsUnitTest.VALID_PUBLISHING_JOB_2;

class PublishingJobsHelperUnitTest extends PublishingJobsUnitTest {

    constructor () {
        super();
    }

    run () {
        const self = this;
        describe("Unit tests for publishingJobsHelper.js", function () {
            // Initialize common resourses before running the unit tests.
            before(function (done) {
                // Signal that the cleanup is complete.
                done();
            });

            // Cleanup common resourses consumed by a test.
            afterEach(function (done) {
                // Restore any stubs and spies used for the test.
                self.restoreTestDoubles();

                // Signal that the cleanup is complete.
                done();
            });

            // Run each of the tests defined in this class.
            self.testInit();
            self.testGetPublishingJobs();
            self.testGetPublishingJob();
            self.testGetPublishingJobStatus();
            self.testCreatePublishingJob();
            self.testCancelPublishingJob();
            self.testDeletePublishingJob();
        });
    }

    testInit () {
        const self = this;
        describe("init", function () {
            // Restore common resourses after running the unit tests.
            after(function (done) {
                UnitTest.restoreOptions();

                // Signal that the cleanup is complete.
                done();
            });

            it("should initialize the global options", function () {
                // Setup the spies and stubs needed for testing the init() method.
                const spy = sinon.spy(options, "setGlobalOptions");

                // The spy and stubs should be restored when the test is complete.
                self.addTestDouble(spy);

                // Call the method being tested.
                publishingJobsHelper.initGlobalOptions({"workingDir": UnitTest.DUMMY_DIR});

                // Verify that the spy was called once with the expected parameter value.
                expect(spy).to.have.been.calledOnce;
                expect(spy.firstCall.args[0].workingDir).to.equal(UnitTest.DUMMY_DIR);
            });
        });
    }

    testGetPublishingJobs() {
        const self = this;
        describe("getPublishingJobs", function () {
            it("should fail when there is an error getting publishing jobs.", function (done) {
                // Create an assetsREST.getItems stub that returns an error.
                const JOBS_ERROR = "There was an error getting publishing jobs.";
                const stub = sinon.stub(publishingJobsREST, "getItems");
                stub.rejects(JOBS_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                publishingJobsHelper.getPublishingJobs(UnitTest.DUMMY_OPTIONS)
                    .then(function (/*jobs*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the publishing jobs should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once.
                            expect(stub).to.be.calledOnce;

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.equal(JOBS_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when getting multiple jobs.", function (done) {
                // Read the contents of five test asset metadata files.

                const job1 = UnitTest.getJsonObject(path1);
                const job2 = UnitTest.getJsonObject(path2);

                // Create an assetsREST.getItems stub that returns a promise for the metadata of the assets.
                const stub = sinon.stub(publishingJobsREST, "getItems");
                stub.resolves([job1, job2]);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                publishingJobsHelper.getPublishingJobs(UnitTest.DUMMY_OPTIONS)
                    .then(function (jobs) {
                        // Verify that the stub was called once and that the helper returned the expected values.
                        expect(stub).to.have.been.calledOnce;
                        expect(diff.diffJson(job1, jobs[0])).to.have.lengthOf(1);
                        expect(diff.diffJson(job2, jobs[1])).to.have.lengthOf(1);
                    })
                    .catch (function (err) {
                        // NOTE: A failed expectation from above will be handled here.
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

    testGetPublishingJob() {
        const self = this;
        describe("getPublishingJob", function () {
            it("should fail when there is an error getting publishing job.", function (done) {
                // Create an assetsREST.getItems stub that returns an error.
                const JOBS_ERROR = "There was an error getting the specified publishing job.";
                const stub = sinon.stub(publishingJobsREST, "getItem");
                stub.rejects(JOBS_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                publishingJobsHelper.getPublishingJob(UnitTest.DUMMY_ID, UnitTest.DUMMY_OPTIONS)
                    .then(function (/*job*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the publishing jobs should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once.
                            expect(stub).to.be.calledOnce;

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.equal(JOBS_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when getting a publishing job.", function (done) {
                // Read the contents of five test asset metadata files.

                const job1 = UnitTest.getJsonObject(path1);

                // Create an assetsREST.getItems stub that returns a promise for the metadata of the assets.
                const stub = sinon.stub(publishingJobsREST, "getItem");
                stub.resolves(job1);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                publishingJobsHelper.getPublishingJob(UnitTest.DUMMY_ID, UnitTest.DUMMY_OPTIONS)
                    .then(function (job) {
                        // Verify that the stub was called once and that the helper returned the expected values.
                        expect(stub).to.have.been.calledOnce;
                        expect(diff.diffJson(job1, job)).to.have.lengthOf(1);
                    })
                    .catch (function (err) {
                        // NOTE: A failed expectation from above will be handled here.
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


    testGetPublishingJobStatus() {
        const self = this;
        describe("getPublishingJobStatus", function () {
            it("should fail when there is an error getting publishing job status.", function (done) {
                // Create an assetsREST.getItems stub that returns an error.
                const JOBS_ERROR = "There was an error getting the specified publishing job status.";
                const stub = sinon.stub(publishingJobsREST, "getPublishingJobStatus");
                stub.rejects(JOBS_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                publishingJobsHelper.getPublishingJobStatus(UnitTest.DUMMY_ID, UnitTest.DUMMY_OPTIONS)
                    .then(function (/*job*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the publishing job status should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once.
                            expect(stub).to.be.calledOnce;

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.equal(JOBS_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when getting a publishing job status.", function (done) {
                // Read the contents of five test asset metadata files.
                const job1 = UnitTest.getJsonObject(path1);

                // Create an assetsREST.getItems stub that returns a promise for the metadata of the assets.
                const stub = sinon.stub(publishingJobsREST, "getPublishingJobStatus");
                stub.resolves(job1);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                publishingJobsHelper.getPublishingJobStatus(UnitTest.DUMMY_ID, UnitTest.DUMMY_OPTIONS)
                    .then(function (job) {
                        // Verify that the stub was called once and that the helper returned the expected values.
                        expect(stub).to.have.been.calledOnce;
                        expect(diff.diffJson(job1, job)).to.have.lengthOf(1);
                    })
                    .catch (function (err) {
                        // NOTE: A failed expectation from above will be handled here.
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

    testCreatePublishingJob () {
        const self = this;
        describe("createPublishingJob", function () {
            it("should fail when there is an error creating a publishing job.", function (done) {
                // Create an restApi.getItems stub that returns an error.
                const ITEMS_ERROR = "There was an error creating the publishing job.";
                const stub = sinon.stub(publishingJobsREST, "createItem");
                stub.rejects(ITEMS_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                publishingJobsHelper.createPublishingJob(null,UnitTest.DUMMY_OPTIONS)
                    .then(function (/*item*/) {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for creating the remote publishing job should have been rejected.");
                    })
                    .catch(function (/*err*/) {
                        try {
                            // Verify that the stub was called once.
                            expect(stub).to.be.calledOnce;
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when publishing job was created.", function (done) {
                    // Read the contents of five test item metadata files.
                    const itemMetadata1 = UnitTest.getJsonObject(path1);

                    // Create an restApi.getItems stub that returns a promise for the metadata of the items.
                    const stub = sinon.stub(publishingJobsREST, "createItem");
                    stub.resolves(itemMetadata1);

                    // The stub should be restored when the test is complete.
                    self.addTestDouble(stub);

                    // Call the method being tested.
                    let error;
                    publishingJobsHelper.createPublishingJob(itemMetadata1,UnitTest.DUMMY_OPTIONS)
                        .then(function (item) {
                            // Verify that the stub was called once and that the helper returned the expected values.
                            expect(stub).to.have.been.calledOnce;
                            expect(diff.diffJson(itemMetadata1, item)).to.have.lengthOf(1);
                        })
                        .catch (function (err) {
                            // NOTE: A failed expectation from above will be handled here.
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

        testDeletePublishingJob () {
            const self = this;
            describe("deletePublishingJob", function () {
                it("should succeed when deleting a publishing job.", function (done) {
                    // Read the contents of five test item metadata files.
                    const itemMetadata1 = UnitTest.getJsonObject(path1);

                    // Create an restApi.getItems stub that returns a promise for the metadata of the items.
                    const stub = sinon.stub(publishingJobsREST, "deleteItem");
                    stub.resolves(itemMetadata1);

                    // The stub should be restored when the test is complete.
                    self.addTestDouble(stub);

                    // Call the method being tested.
                    let error;
                    publishingJobsHelper.deletePublishingJob(UnitTest.DUMMY_ID,UnitTest.DUMMY_OPTIONS)
                        .then(function (/*item*/) {
                            // Verify that the stub was called once and that the helper returned the expected values.
                            expect(stub).to.have.been.calledOnce;
                        })
                        .catch (function (err) {
                            // NOTE: A failed expectation from above will be handled here.
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

        testCancelPublishingJob () {
            const self = this;
            describe("cancelPublishingJob", function () {
                it("should succeed when cancelling a publishing job.", function (done) {
                    // Read the contents of five test item metadata files.
                    const itemMetadata1 = UnitTest.getJsonObject(path1);

                    // Create an restApi.getItems stub that returns a promise for the metadata of the items.
                    const stub = sinon.stub(publishingJobsREST, "cancelPublishingJob");
                    stub.resolves(itemMetadata1);

                    // The stub should be restored when the test is complete.
                    self.addTestDouble(stub);

                    // Call the method being tested.
                    let error;
                    publishingJobsHelper.cancelPublishingJob(UnitTest.DUMMY_ID,UnitTest.DUMMY_OPTIONS)
                        .then(function (/*item*/) {
                            // Verify that the stub was called once and that the helper returned the expected values.
                            expect(stub).to.have.been.calledOnce;
                        })
                        .catch (function (err) {
                            // NOTE: A failed expectation from above will be handled here.
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

}

module.exports = PublishingJobsHelperUnitTest;
