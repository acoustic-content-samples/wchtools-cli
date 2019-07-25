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
 * Unit tests for the LibrariesFS object.
 */
"use strict";

// Require the super classes for this class.
const UnitTest = require("./base.unit.js");
const LibrariesUnitTest = require("./libraries.unit.js");
const BaseFsUnit = require("./base.fs.unit.js");

// Require the node modules used in this test file.
const fs = require("fs");
const requireSubvert = require('require-subvert')(__dirname);
const sinon = require("sinon");

// Require the local module being tested.
const fsApi = require(UnitTest.API_PATH + "lib/librariesFS.js").instance;

// The default API context used for unit tests.
const context = UnitTest.DEFAULT_API_CONTEXT;

class LibrariesFsUnitTest extends BaseFsUnit {
    constructor () {
        super();
    }

    run () {
        super.run(fsApi, LibrariesUnitTest.VALID_LIBRARY_1, LibrariesUnitTest.VALID_LIBRARY_2);
    }
}

module.exports = LibrariesFsUnitTest;
