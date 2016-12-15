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
 * Run the unit tests for the asset objects in the authoring-api package.
 */
"use strict";

// Assets Helper
const AssetsHelperUnitTest = require("./lib/assets.helper.unit.js");
const assetsHelperUnitTest = new AssetsHelperUnitTest();
assetsHelperUnitTest.run();

// Assets REST
const AssetsRestUnitTest = require("./lib/assets.rest.unit.js");
const assetsRestUnitTest = new AssetsRestUnitTest();
assetsRestUnitTest.run();

// Assets FS
const AssetsFsUnitTest = require("./lib/assets.fs.unit.js");
const assetsFsUnitTest = new AssetsFsUnitTest();
assetsFsUnitTest.run();
