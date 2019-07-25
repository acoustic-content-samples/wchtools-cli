/*
Copyright 2019 IBM Corporation

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
 * Base class for Libraries unit tests.
 */
"use strict";

const UnitTest = require("./base.unit.js");

class LibrariesUnitTest extends UnitTest {
    // File and directory constants used by all Libraries unit tests.
    static get LIBRARIES_DIRECTORY() { return "libraries"; };
    static get VALID_LIBRARIES_DIRECTORY() { return UnitTest.API_PATH + UnitTest.VALID_RESOURCES_DIRECTORY + LibrariesUnitTest.LIBRARIES_DIRECTORY; };
    static get INVALID_LIBRARIES_DIRECTORY() { return UnitTest.API_PATH + UnitTest.INVALID_RESOURCES_DIRECTORY + LibrariesUnitTest.LIBRARIES_DIRECTORY; };

    // Path values for test artifacts.
    static get VALID_LIBRARY_1() { return "/library-1.json"; };
    static get VALID_LIBRARY_2() { return "/library-2.json"; };
    static get INVALID_LIBRARY_BAD_NAME() { return "/library-bad-name.json"; };

    constructor () {
        super();
    }
}

module.exports = LibrariesUnitTest;
