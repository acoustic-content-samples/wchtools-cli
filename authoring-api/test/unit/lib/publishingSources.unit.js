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
 * Base class for publishingSources unit tests.
 */
"use strict";

const UnitTest = require("./base.unit.js");

class PublishingSourcesUnitTest extends UnitTest {
    // File and directory constants used by all unit tests.
    static get PUBLISHING_SOURCES_DIRECTORY() { return "publishing-sources/"; };
    static get VALID_PUBLISHING_SOURCES_DIRECTORY() { return UnitTest.API_PATH + UnitTest.VALID_RESOURCES_DIRECTORY + PublishingSourcesUnitTest.PUBLISHING_SOURCES_DIRECTORY; };
    static get INVALID_PUBLISHING_SOURCES_DIRECTORY() { return UnitTest.API_PATH + UnitTest.INVALID_RESOURCES_DIRECTORY + PublishingSourcesUnitTest.PUBLISHING_SOURCES_DIRECTORY; };

    // Path values for test assets.
    static get VALID_PUBLISHING_SOURCE_1() { return "publishing-source-1.json"; };
    static get VALID_PUBLISHING_SOURCE_2() { return "publishing-source-2.json"; };
    static get INVALID_PUBLISHING_SOURCE_BAD_NAME() { return "publishing-source-bad-name.json"; };

    constructor () {
        super();
    }
}

module.exports = PublishingSourcesUnitTest;
