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
 * Unit tests for the PublishingJobsREST object.
 */
"use strict";

// Require the super classes for this class.
const UnitTest = require("./base.unit.js");
const PublishingJobsUnitTest = require("./publishingJobs.unit.js");
const BasePublishingJobsRestUnit = require("./basePublishingJobs.rest.unit.js");

// Require the local module being tested.
const restApi = require(UnitTest.AUTHORING_API_PATH + "lib/publishingJobsREST.js").instance;
const options = require(UnitTest.AUTHORING_API_PATH + "lib/utils/options.js");

// Get the "lookup" URI.
const lookupUri =  options.getProperty("publishing", "uri");
const path1 = PublishingJobsUnitTest.VALID_PUBLISHING_JOBS_DIRECTORY + PublishingJobsUnitTest.VALID_PUBLISHING_JOB_1;
const path2 = PublishingJobsUnitTest.VALID_PUBLISHING_JOBS_DIRECTORY + PublishingJobsUnitTest.VALID_PUBLISHING_JOB_2;

class PublishingJobsRestUnitTest extends BasePublishingJobsRestUnit {
    constructor() {
        super();
    }
    run(){
        super.run(restApi, lookupUri, "publishing", path1, path2)
    }
}

module.exports = PublishingJobsRestUnitTest;
