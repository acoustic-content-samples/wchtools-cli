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
 * Base class for Layouts unit tests.
 */
"use strict";

const UnitTest = require("./base.unit.js");

class SitesUnitTest extends UnitTest {
    // File and directory constants used by all Sites unit tests.
    static get SITES_DIRECTORY() { return "sites"; };
    static get VALID_SITES_DIRECTORY() { return UnitTest.API_PATH + UnitTest.VALID_RESOURCES_DIRECTORY + SitesUnitTest.SITES_DIRECTORY; };
    static get INVALID_SITES_DIRECTORY() { return UnitTest.API_PATH + UnitTest.INVALID_RESOURCES_DIRECTORY + SitesUnitTest.SITES_DIRECTORY; };

    // Path values for test assets.
    static get VALID_SITE_1() { return "/site-1.json"; };
    static get VALID_SITE_2() { return "/site-2.json"; };
    static get INVALID_SITE_BAD_NAME() { return "/site-bad-name.json"; };

    constructor () {
        super();
    }
}

module.exports = SitesUnitTest;
