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
 * Run the unit tests for the site revision objects in the API package.
 */
"use strict";

// Publishing SiteRevisions Helper
const PublishingSiteRevisionsHelperUnitTest = require("./lib/publishingSiteRevisions.helper.unit.js");
const publishingSiteRevisionsHelperUnitTest = new PublishingSiteRevisionsHelperUnitTest();
publishingSiteRevisionsHelperUnitTest.run();

// Publishing SiteRevisions REST
const PublishingSiteRevisionsRestUnitTest = require("./lib/publishingSiteRevisions.rest.unit.js");
const publishingSiteRevisionsRestUnitTest = new PublishingSiteRevisionsRestUnitTest();
publishingSiteRevisionsRestUnitTest.run();

// Publishing SiteRevisions FS
const PublishingSiteRevisionsFsUnitTest = require("./lib/publishingSiteRevisions.fs.unit.js");
const publishingSiteRevisionsFsUnitTest = new PublishingSiteRevisionsFsUnitTest();
publishingSiteRevisionsFsUnitTest.run();
