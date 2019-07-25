/*
Copyright IBM Corporation 2019

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
 * Unit tests for the LibrariesHelper object.
 */
"use strict";

// Require the super classes for this class.
const UnitTest = require("./base.unit.js");
const LibrariesUnitTest = require("./libraries.unit.js");
const BaseHelperUnitTest = require("./base.helper.unit.js");
const sinon = require("sinon");

// Require the local module being tested.
const restApi = require(UnitTest.API_PATH + "lib/librariesREST.js").instance;
const fsApi = require(UnitTest.API_PATH + "lib/librariesFS.js").instance;
const helper = require(UnitTest.API_PATH + "librariesHelper.js").instance;
const path1 = LibrariesUnitTest.VALID_LIBRARIES_DIRECTORY + LibrariesUnitTest.VALID_LIBRARY_1;
const path2 = LibrariesUnitTest.VALID_LIBRARIES_DIRECTORY + LibrariesUnitTest.VALID_LIBRARY_2;
const badPath = LibrariesUnitTest.INVALID_LIBRARIES_DIRECTORY + LibrariesUnitTest.INVALID_LIBRARY_BAD_NAME;

class LibrariesHelperUnitTest extends BaseHelperUnitTest {
    constructor () {
        super();
    }

    run () {
        super.run(restApi, fsApi, helper, path1, path2, badPath);
    }

    runAdditionalTests (restApi, fsApi, helper, path1, path2, badPath) {
        this.testCompare(restApi, fsApi, helper, UnitTest.API_PATH + UnitTest.COMPARE_RESOURCES_DIRECTORY_1, UnitTest.API_PATH + UnitTest.COMPARE_RESOURCES_DIRECTORY_2);
    }

    testPushItem (restApi, fsApi, helper, path1, path2, badPath, type, itemMetadata1, itemMetadata2, badMetadata) {
        // Temporarily skip this test because of issues running it on Jenkins.
    }
}

module.exports = LibrariesHelperUnitTest;
