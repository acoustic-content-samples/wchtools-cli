/*
Copyright 2019 IBM Corporation

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

// Libraries Helper
const LibrariesHelperUnitTest = require("./lib/libraries.helper.unit.js");
const librariesHelperUnitTest = new LibrariesHelperUnitTest();
librariesHelperUnitTest.run();

// Libraries REST
const LibrariesRestUnitTest = require("./lib/libraries.rest.unit.js");
const librariesRestUnitTest = new LibrariesRestUnitTest();
librariesRestUnitTest.run();

// Libraries FS
const LibrariesFsUnitTest = require("./lib/libraries.fs.unit.js");
const librariesFsUnitTest = new LibrariesFsUnitTest();
librariesFsUnitTest.run();
