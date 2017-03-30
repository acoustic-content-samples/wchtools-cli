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
 * Run the unit tests for the Contents objects in the API package.
 */
"use strict";

// Contents Helper
const ContentsHelperUnitTest = require("./lib/contents.helper.unit.js");
const contentsHelperUnitTest = new ContentsHelperUnitTest();
contentsHelperUnitTest.run();

// Contents REST
const ContentsRestUnitTest = require("./lib/contents.rest.unit.js");
const contentsRestUnitTest = new ContentsRestUnitTest();
contentsRestUnitTest.run();

// Contents FS
const ContentsFsUnitTest = require("./lib/contents.fs.unit.js");
const contentsFsUnitTest = new ContentsFsUnitTest();
contentsFsUnitTest.run();
