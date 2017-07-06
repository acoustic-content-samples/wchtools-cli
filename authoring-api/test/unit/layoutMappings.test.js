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
 * Run the unit tests for the layoutMapping objects in the API package.
 */
"use strict";

// LayoutMappings Helper
const LayoutMappingsHelperUnitTest = require("./lib/layoutMappings.helper.unit.js");
const layoutMappingsHelperUnitTest = new LayoutMappingsHelperUnitTest();
layoutMappingsHelperUnitTest.run();

// LayoutMappings REST
const LayoutMappingsRestUnitTest = require("./lib/layoutMappings.rest.unit.js");
const layoutMappingsRestUnitTest = new LayoutMappingsRestUnitTest();
layoutMappingsRestUnitTest.run();

// LayoutMappings FS
const LayoutMappingsFsUnitTest = require("./lib/layoutMappings.fs.unit.js");
const layoutMappingsFsUnitTest = new LayoutMappingsFsUnitTest();
layoutMappingsFsUnitTest.run();
