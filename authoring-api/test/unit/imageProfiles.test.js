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
 * Run the unit tests for the type objects in the authoring-api package.
 */
"use strict";

// Helper
const ImageProfilesHelperUnitTest = require("./lib/imageProfiles.helper.unit.js");
const imageProfilesHelperUnitTest = new ImageProfilesHelperUnitTest();
imageProfilesHelperUnitTest.run();

// REST
const ImageProfilesRestUnitTest = require("./lib/imageProfiles.rest.unit.js");
const imageProfilesRestUnitTest = new ImageProfilesRestUnitTest();
imageProfilesRestUnitTest.run();

// FS
const ImageProfilesFsUnitTest = require("./lib/imageProfiles.fs.unit.js");
const imageProfilesFsUnitTest = new ImageProfilesFsUnitTest();
imageProfilesFsUnitTest.run();
