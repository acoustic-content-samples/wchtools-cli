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
 * Run the unit tests for the presentation objects in the authoring-api package.
 */
"use strict";

// Presentations Helper
const PresentationsHelperUnitTest = require("./lib/presentations.helper.unit.js");
const presentationsHelperUnitTest = new PresentationsHelperUnitTest();
presentationsHelperUnitTest.run();

// Presentations REST
const PresentationsRestUnitTest = require("./lib/presentations.rest.unit.js");
const presentationsRestUnitTest = new PresentationsRestUnitTest();
presentationsRestUnitTest.run();

// Presentations FS
const PresentationsFsUnitTest = require("./lib/presentations.fs.unit.js");
const presentationsFsUnitTest = new PresentationsFsUnitTest();
presentationsFsUnitTest.run();
