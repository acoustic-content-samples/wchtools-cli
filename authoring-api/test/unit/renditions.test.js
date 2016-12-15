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
 * Run the unit tests for the contents objects in the authoring-api package.
 */
"use strict";

// Renditions Helper
const RenditionsHelperUnitTest = require("./lib/renditions.helper.unit.js");
const renditionsHelperUnitTest = new RenditionsHelperUnitTest();
renditionsHelperUnitTest.run();

// Renditions REST
const RenditionsRestUnitTest = require("./lib/renditions.rest.unit.js");
const renditionsRestUnitTest = new RenditionsRestUnitTest();
renditionsRestUnitTest.run();

// Renditions FS
const RenditionsFsUnitTest = require("./lib/renditions.fs.unit.js");
const renditionsFsUnitTest = new RenditionsFsUnitTest();
renditionsFsUnitTest.run();
