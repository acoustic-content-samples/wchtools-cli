/*
Copyright IBM Corporation 2016,2017

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
 * Unit tests for the TypesREST object.
 */
"use strict";

// Require the super classes for this class.
const UnitTest = require("./base.unit.js");
const PagesUnitTest = require("./pages.unit.js");
const BaseRestUnit = require("./base.rest.unit.js");

// Require the local module being tested.
const restApi = require(UnitTest.API_PATH + "lib/pagesREST.js").instance;
const options = require(UnitTest.API_PATH + "lib/utils/options.js");
// Get the "lookup" URI for types
const lookupUri =  options.getProperty(UnitTest.DEFAULT_API_CONTEXT, "pages", "uri");
const path1 = PagesUnitTest.VALID_PAGES_DIRECTORY + PagesUnitTest.VALID_PAGE_1;
const path2 = PagesUnitTest.VALID_PAGES_DIRECTORY + PagesUnitTest.VALID_PAGE_2;

class PagesRestUnitTest extends BaseRestUnit {
    constructor() {
        super();
    }
    run(){
        super.run(restApi, lookupUri, "pages", path1, path2);
    }
}

module.exports = PagesRestUnitTest;
