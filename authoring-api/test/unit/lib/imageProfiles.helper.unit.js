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
 * Unit tests for the ImageProfilesHelper object.
 */
"use strict";

// Require the super classes for this class.
const UnitTest = require("./base.unit.js");
const ImageProfilesUnitTest = require("./imageProfiles.unit.js");
const BaseHelperUnit = require("./base.helper.unit.js");

// Require the local module being tested.
const restApi = require(UnitTest.API_PATH + "lib/imageProfilesREST.js").instance;
const fsApi = require(UnitTest.API_PATH + "lib/imageProfilesFS.js").instance;
const helper = require(UnitTest.API_PATH + "imageProfilesHelper.js").instance;
const path1 = ImageProfilesUnitTest.VALID_IMAGE_PROFILES_DIRECTORY + ImageProfilesUnitTest.VALID_IMAGE_PROFILE_1;
const path2 = ImageProfilesUnitTest.VALID_IMAGE_PROFILES_DIRECTORY + ImageProfilesUnitTest.VALID_IMAGE_PROFILE_2;
const badPath = ImageProfilesUnitTest.INVALID_IMAGE_PROFILES_DIRECTORY + ImageProfilesUnitTest.INVALID_IMAGE_PROFILE_BAD_NAME;

class ImageProfilesHelperUnitTest extends BaseHelperUnit {
    constructor() {
        super();
    }
    run(){
        super.run(restApi, fsApi,helper,  path1, path2, badPath );
    }
    runAdditionalTests (restApi, fsApi, helper, path1, path2, badPath) {
        this.testCompare(restApi, fsApi, helper, UnitTest.API_PATH + UnitTest.COMPARE_RESOURCES_DIRECTORY_1, UnitTest.API_PATH + UnitTest.COMPARE_RESOURCES_DIRECTORY_2);
    }
}

module.exports = ImageProfilesHelperUnitTest;
