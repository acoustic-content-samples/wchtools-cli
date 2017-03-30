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

// Publishing Profiles Helper
const PublishingProfilesHelperUnitTest = require("./lib/publishingProfiles.helper.unit.js");
const publishingProfilesHelperUnitTest = new PublishingProfilesHelperUnitTest();
publishingProfilesHelperUnitTest.run();

// Publishing Profiles REST
const PublishingProfilesRestUnitTest = require("./lib/publishingProfiles.rest.unit.js");
const publishingProfilesRestUnitTest = new PublishingProfilesRestUnitTest();
publishingProfilesRestUnitTest.run();

// Publishing Profiles FS
const PublishingProfilesFsUnitTest = require("./lib/publishingProfiles.fs.unit.js");
const publishingProfilesFsUnitTest = new PublishingProfilesFsUnitTest();
publishingProfilesFsUnitTest.run();
