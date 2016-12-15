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
const helper = require("dxauthoringapi").getPresentationsHelper();
const rest = require("../../../authoring-api/lib/presentationsREST.js").instance;
const fs = require("../../../authoring-api/lib/presentationsFS.js").instance;
if(!fs || !rest)
    console.log('Error could not load required');
// Presentations Tests with CLI
const BASE_NAME = 'presentation';
const PullUnitTest = require("./lib/pull.unit.js");
const pullUnitTest = new PullUnitTest();
pullUnitTest.run(helper, rest, fs, '-p', BASE_NAME + '-1', BASE_NAME + '-2', BASE_NAME + '-bad-name', '_pmd.json');

const PushUnitTest = require("./lib/push.unit.js");
const pushUnitTest = new PushUnitTest();
pushUnitTest.run(helper, rest, fs, '-p', BASE_NAME + '-1', BASE_NAME + '-2', BASE_NAME + '-bad-name', '_pmd.json');

const ListUnitTest = require("./lib/list.unit.js");
const listUnitTest = new ListUnitTest();
listUnitTest.run(helper, '-p', BASE_NAME + '-1', BASE_NAME + '-2', BASE_NAME + '-bad-name');
