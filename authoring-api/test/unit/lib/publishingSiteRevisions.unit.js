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
 * Base class for publishingSiteRevisions unit tests.
 */
"use strict";

const UnitTest = require("./base.unit.js");

class PublishingSiteRevisionsUnitTest extends UnitTest {
    // File and directory constants used by all unit tests.
    static get PUBLISHING_SITEREVISIONS_DIRECTORY() { return "site-revisions/"; };
    static get VALID_PUBLISHING_SITEREVISIONS_DIRECTORY() { return UnitTest.API_PATH + UnitTest.VALID_RESOURCES_DIRECTORY + PublishingSiteRevisionsUnitTest.PUBLISHING_SITEREVISIONS_DIRECTORY; };
    static get INVALID_PUBLISHING_SITEREVISIONS_DIRECTORY() { return UnitTest.API_PATH + UnitTest.INVALID_RESOURCES_DIRECTORY + PublishingSiteRevisionsUnitTest.PUBLISHING_SITEREVISIONS_DIRECTORY; };

    // Path values for test assets.
    static get VALID_PUBLISHING_SITEREVISION_1() { return "publishing-siterevision-1.json"; };
    static get VALID_PUBLISHING_SITEREVISION_2() { return "publishing-siterevision-2.json"; };
    static get INVALID_PUBLISHING_SITEREVISION_BAD_NAME() { return "publishing-siterevision-bad-name.json"; };

    constructor () {
        super();
    }
}

module.exports = PublishingSiteRevisionsUnitTest;
