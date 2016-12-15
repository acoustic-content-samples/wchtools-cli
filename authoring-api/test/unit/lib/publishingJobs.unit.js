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
 * Base class for publishing jobs unit tests.
 */
"use strict";

const UnitTest = require("./base.unit.js");

class PublishingJobsUnitTest extends UnitTest {
    // File and directory constants used by all presentations unit tests.
    static get PUBLISHING_JOBS_DIRECTORY() { return "jobs/"; };
    static get VALID_PUBLISHING_JOBS_DIRECTORY() { return UnitTest.AUTHORING_API_PATH + UnitTest.VALID_RESOURCES_DIRECTORY + PublishingJobsUnitTest.PUBLISHING_JOBS_DIRECTORY; };
    static get INVALID_PRESENTATIONS_DIRECTORY() { return UnitTest.AUTHORING_API_PATH + UnitTest.INVALID_RESOURCES_DIRECTORY + PublishingJobsUnitTest.PUBLISHING_JOBS_DIRECTORY; };

    // Path values for test assets.
    static get VALID_PUBLISHING_JOB_1() { return "publishing-job-1.json"; };
    static get VALID_PUBLISHING_JOB_2() { return "publishing-job-2.json"; };
    static get INVALID_PUBLISHING_JOB_BAD_NAME() { return "publishing-job-bad-name.json"; };

    constructor () {
        super();
    }
}

module.exports = PublishingJobsUnitTest;
