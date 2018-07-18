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
 * Unit tests for the layoutsHelper object.
 *
 * NOTE: The StatusTracker and EventEmitter objects used by the layoutsHelper object
 * are used to execute some of the tests, so the provided functionality is not stubbed out.
 */
"use strict";

// Require the super classes for this class.
const UnitTest = require("./base.unit.js");
const LayoutsUnitTest = require("./layouts.unit.js");
const BaseHelperUnitTest = require("./base.helper.unit.js");
const sinon = require("sinon");

// Require the local module being tested.
const restApi = require(UnitTest.API_PATH + "lib/layoutsREST.js").instance;
const fsApi = require(UnitTest.API_PATH + "lib/layoutsFS.js").instance;
const helper = require(UnitTest.API_PATH + "layoutsHelper.js").instance;
const path1 = LayoutsUnitTest.VALID_LAYOUTS_DIRECTORY + LayoutsUnitTest.VALID_LAYOUT_1;
const path2 = LayoutsUnitTest.VALID_LAYOUTS_DIRECTORY + LayoutsUnitTest.VALID_LAYOUT_2;
const badPath = LayoutsUnitTest.INVALID_LAYOUTS_DIRECTORY + LayoutsUnitTest.INVALID_LAYOUT_BAD_NAME;

class LayoutsHelperUnitTest extends BaseHelperUnitTest {
    constructor() {
        super();
    }

    run () {
        super.run(restApi, fsApi, helper, path1, path2, badPath);
    }

    runAdditionalTests (restApi, fsApi, helper, path1, path2, badPath) {
        this.testCompare(restApi, fsApi, helper, UnitTest.API_PATH + UnitTest.COMPARE_RESOURCES_DIRECTORY_1, UnitTest.API_PATH + UnitTest.COMPARE_RESOURCES_DIRECTORY_2);
    }

}

module.exports = LayoutsHelperUnitTest;
