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
 * Unit tests for the contentsHelper object.
 */
"use strict";

// Require the super classes for this class.
const UnitTest = require("./base.unit.js");
const ContentsUnitTest = require("./contents.unit.js");
const BaseHelperUnit = require("./base.helper.unit.js");

// Require the local module being tested.
const restApi = require(UnitTest.API_PATH + "lib/contentREST.js").instance;
const fsApi = require(UnitTest.API_PATH + "lib/contentFS.js").instance;
const helper = require(UnitTest.API_PATH + "contentHelper.js").instance;
const path1 = ContentsUnitTest.VALID_CONTENTS_DIRECTORY + ContentsUnitTest.VALID_CONTENT_1;
const path2 = ContentsUnitTest.VALID_CONTENTS_DIRECTORY + ContentsUnitTest.VALID_CONTENT_2;
const badPath = ContentsUnitTest.INVALID_CONTENTS_DIRECTORY + ContentsUnitTest.INVALID_CONTENT_BAD_NAME;

class ContentsHelperUnitTest extends BaseHelperUnit {
    constructor() {
        super();
    }
    run(){
        super.run(restApi, fsApi,helper,  path1, path2, badPath);
    }
}

module.exports = ContentsHelperUnitTest;
