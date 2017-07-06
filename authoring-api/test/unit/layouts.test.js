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
 * Run the unit tests for the layout objects in the API package.
 */
"use strict";

// Layouts Helper
const LayoutsHelperUnitTest = require("./lib/layouts.helper.unit.js");
const layoutsHelperUnitTest = new LayoutsHelperUnitTest();
layoutsHelperUnitTest.run();

// Layouts REST
const LayoutsRestUnitTest = require("./lib/layouts.rest.unit.js");
const layoutsRestUnitTest = new LayoutsRestUnitTest();
layoutsRestUnitTest.run();

// Layouts FS
const LayoutsFsUnitTest = require("./lib/layouts.fs.unit.js");
const layoutsFsUnitTest = new LayoutsFsUnitTest();
layoutsFsUnitTest.run();
