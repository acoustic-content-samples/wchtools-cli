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

class TypesUnitTest extends UnitTest {
    // File and directory constants used by all types unit tests.
    static get TYPES_DIRECTORY() { return "types/"; };
    static get VALID_TYPES_DIRECTORY() { return UnitTest.API_PATH + UnitTest.VALID_RESOURCES_DIRECTORY + TypesUnitTest.TYPES_DIRECTORY; };
    static get INVALID_TYPES_DIRECTORY() { return UnitTest.API_PATH + UnitTest.INVALID_RESOURCES_DIRECTORY + TypesUnitTest.TYPES_DIRECTORY; };

    // Path values for test assets.
    static get VALID_TYPE_1() { return "type-1.json"; };
    static get VALID_TYPE_2() { return "type-2.json"; };
    static get INVALID_TYPE_BAD_NAME() { return "type-bad-name.json"; };

    constructor () {
        super();
    }
}

module.exports = TypesUnitTest;
