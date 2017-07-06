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

class LayoutsUnitTest extends UnitTest {
    // File and directory constants used by all Layouts unit tests.
    static get LAYOUTS_DIRECTORY() { return "layouts"; };
    static get VALID_LAYOUTS_DIRECTORY() { return UnitTest.API_PATH + UnitTest.VALID_RESOURCES_DIRECTORY + LayoutsUnitTest.LAYOUTS_DIRECTORY; };
    static get INVALID_LAYOUTS_DIRECTORY() { return UnitTest.API_PATH + UnitTest.INVALID_RESOURCES_DIRECTORY + LayoutsUnitTest.LAYOUTS_DIRECTORY; };

    // Path values for test assets.
    static get VALID_LAYOUT_1() { return "/layout-1.json"; };
    static get VALID_LAYOUT_2() { return "/layout-2.json"; };
    static get INVALID_LAYOUT_BAD_NAME() { return "/layout-bad-name.json"; };

    constructor () {
        super();
    }
}

module.exports = LayoutsUnitTest;
