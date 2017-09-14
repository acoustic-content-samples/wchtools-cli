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
 * Base class for types unit tests.
 */
"use strict";

const UnitTest = require("./base.unit.js");

class PagesUnitTest extends UnitTest {
    // File and directory constants used by all types unit tests.
    static get PAGES_DIRECTORY() { return "pages/"; };
    static get VALID_PAGES_DIRECTORY() { return UnitTest.API_PATH + UnitTest.VALID_RESOURCES_DIRECTORY + PagesUnitTest.PAGES_DIRECTORY; };
    static get INVALID_PAGES_DIRECTORY() { return UnitTest.API_PATH + UnitTest.INVALID_RESOURCES_DIRECTORY + PagesUnitTest.PAGES_DIRECTORY; };

    // Path values for test assets.
    static get VALID_PAGE_1() { return "/page-1.json"; };
    static get VALID_PAGE_2() { return "/page-2.json"; };
    static get INVALID_PAGE_BAD_NAME() { return "/page-bad-name.json"; };

    constructor () {
        super();
    }
}

module.exports = PagesUnitTest;
