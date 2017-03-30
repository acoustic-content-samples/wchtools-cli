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
 * Run the unit tests for the presentation objects in the API package.
 */
"use strict";

// Publishing Sources Helper
const PublishingSourcesHelperUnitTest = require("./lib/publishingSources.helper.unit.js");
const publishingSourcesHelperUnitTest = new PublishingSourcesHelperUnitTest();
publishingSourcesHelperUnitTest.run();

// Publishing Sources REST
const PublishingSourcesRestUnitTest = require("./lib/publishingSources.rest.unit.js");
const publishingSourcesRestUnitTest = new PublishingSourcesRestUnitTest();
publishingSourcesRestUnitTest.run();

// Publishing Sources FS
const PublishingSourcesFsUnitTest = require("./lib/publishingSources.fs.unit.js");
const publishingSourcesFsUnitTest = new PublishingSourcesFsUnitTest();
publishingSourcesFsUnitTest.run();
