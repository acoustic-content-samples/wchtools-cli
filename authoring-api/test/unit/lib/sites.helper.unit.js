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
 * Unit tests for the SitesHelper object.
 */
"use strict";

// Require the super classes for this class.
const UnitTest = require("./base.unit.js");
const SitesUnitTest = require("./sites.unit.js");
const BaseHelperUnitTest = require("./base.helper.unit.js");

// Require the local module being tested.
const restApi = require(UnitTest.API_PATH + "lib/sitesREST.js").instance;
const fsApi = require(UnitTest.API_PATH + "lib/sitesFS.js").instance;
const helper = require(UnitTest.API_PATH + "sitesHelper.js").instance;
const path1 = SitesUnitTest.VALID_SITES_DIRECTORY + SitesUnitTest.VALID_SITE_1;
const path2 = SitesUnitTest.VALID_SITES_DIRECTORY + SitesUnitTest.VALID_SITE_2;
const badPath = SitesUnitTest.INVALID_SITES_DIRECTORY + SitesUnitTest.INVALID_SITE_BAD_NAME;

class SitesHelperUnitTest extends BaseHelperUnitTest {
    constructor() {
        super();
    }

    run () {
        super.run(restApi, fsApi, helper, path1, path2, badPath);
    }
}

module.exports = SitesHelperUnitTest;
