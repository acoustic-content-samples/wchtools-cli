/*
Copyright IBM Corporation 2017

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
 * Unit tests for the publishingSiteRevisionsHelper object.
 *
 * NOTE: The StatusTracker and EventEmitter objects used by the presentationsHelper object
 * are used to execute some of the tests, so the provided functionality is not stubbed out.
 */
"use strict";

// Require the super classes for this class.
const UnitTest = require("./base.unit.js");
const PublishingSiteRevisionsUnitTest = require("./publishingSiteRevisions.unit.js");
const BaseHelperUnit = require("./base.helper.unit.js");

// Require the local module being tested.
const restApi = require(UnitTest.API_PATH + "lib/publishingSiteRevisionsREST.js").instance;
const fsApi = require(UnitTest.API_PATH + "lib/publishingSiteRevisionsFS.js").instance;
const helper = require(UnitTest.API_PATH + "publishingSiteRevisionsHelper.js").instance;
const path1 = PublishingSiteRevisionsUnitTest.VALID_PUBLISHING_SITEREVISIONS_DIRECTORY + PublishingSiteRevisionsUnitTest.VALID_PUBLISHING_SITEREVISION_1;
const path2 = PublishingSiteRevisionsUnitTest.VALID_PUBLISHING_SITEREVISIONS_DIRECTORY + PublishingSiteRevisionsUnitTest.VALID_PUBLISHING_SITEREVISION_2;
const badPath = PublishingSiteRevisionsUnitTest.INVALID_PUBLISHING_SITEREVISIONS_DIRECTORY + PublishingSiteRevisionsUnitTest.INVALID_PUBLISHING_SITEREVISION_BAD_NAME;

class PublishingSiteRevisionsHelperUnitTest extends BaseHelperUnit {
    constructor() {
        super();
    }
    run(){
        super.run(restApi, fsApi, helper,  path1, path2, badPath );
    }
}
module.exports = PublishingSiteRevisionsHelperUnitTest;
