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
 * Base class for categories unit tests.
 */
"use strict";

const UnitTest = require("./base.unit.js");

class CategoriesUnitTest extends UnitTest {
    // File and directory constants used by all categories unit tests.
    static get CATEGORIES_DIRECTORY() { return "categories/"; };
    static get VALID_CATEGORIES_DIRECTORY() { return UnitTest.AUTHORING_API_PATH + UnitTest.VALID_RESOURCES_DIRECTORY + CategoriesUnitTest.CATEGORIES_DIRECTORY; };
    static get INVALID_CATEGORIES_DIRECTORY() { return UnitTest.AUTHORING_API_PATH + UnitTest.INVALID_RESOURCES_DIRECTORY + CategoriesUnitTest.CATEGORIES_DIRECTORY; };

    // Path values for test assets.
    static get VALID_CATEGORY_1() { return "category-1.json"; };
    static get VALID_CATEGORY_2() { return "category-2.json"; };
    static get INVALID_CATEGORY_BAD_NAME() { return "category-bad-name.json"; };

    constructor () {
        super();
    }
}

module.exports = CategoriesUnitTest;
