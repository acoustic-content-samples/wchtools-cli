/*
Copyright IBM Corporation 2018

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
 * Run the unit tests for the Contents objects in the API package.
 */
"use strict";

// DefaultContent Helper
const DefaultContentHelperUnitTest = require("./lib/defaultContent.helper.unit.js");
const defaultContentHelperUnitTest = new DefaultContentHelperUnitTest();
defaultContentHelperUnitTest.run();

// DefaultContent REST
const DefaultContentRestUnitTest = require("./lib/defaultContent.rest.unit.js");
const defaultContentRestUnitTest = new DefaultContentRestUnitTest();
defaultContentRestUnitTest.run();

// Contents FS
const DefaultContentFsUnitTest = require("./lib/defaultContent.fs.unit.js");
const defaultContentFsUnitTest = new DefaultContentFsUnitTest();
defaultContentFsUnitTest.run();
