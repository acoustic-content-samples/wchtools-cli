/*
Copyright IBM Corporation 2018

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
 * Base class for contents unit tests.
 */
"use strict";

const UnitTest = require("./base.unit.js");

class DefaultContentUnitTest extends UnitTest {
    // File and directory constants used by all contents unit tests.
    static get CONTENTS_DIRECTORY() { return "default-content/"; };
    static get VALID_CONTENTS_DIRECTORY() { return UnitTest.API_PATH + UnitTest.VALID_RESOURCES_DIRECTORY + DefaultContentUnitTest.CONTENTS_DIRECTORY; };
    static get INVALID_CONTENTS_DIRECTORY() { return UnitTest.API_PATH + UnitTest.INVALID_RESOURCES_DIRECTORY + DefaultContentUnitTest.CONTENTS_DIRECTORY; };

    // Path values for test assets.
    static get VALID_CONTENT_1() { return "content-1.json"; };
    static get VALID_CONTENT_2() { return "content-2.json"; };
    static get INVALID_CONTENT_BAD_NAME() { return "content-bad-name.json"; };

    constructor () {
        super();
    }
}

module.exports = DefaultContentUnitTest;
