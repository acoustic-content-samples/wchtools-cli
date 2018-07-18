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
 * Run the unit tests for the assets objects in the CLI package.
 */
"use strict";

const helper = require("wchtools-api").getAssetsHelper();

// Assets Tests with CLI
const BASE_NAME = 'type';
const PullUnitTest = require("./lib/pull.unit.js");
const pullUnitTest = new PullUnitTest();
pullUnitTest.run(helper, '-a', BASE_NAME + '-1', BASE_NAME + '-2', BASE_NAME + '-bad-name');
pullUnitTest.run(helper, '-w', BASE_NAME + '-1', BASE_NAME + '-2', BASE_NAME + '-bad-name');

const PushUnitTest = require("./lib/push.unit.js");
const pushUnitTest = new PushUnitTest();
pushUnitTest.run(helper, '-a', BASE_NAME + '-1', BASE_NAME + '-2', BASE_NAME + '-bad-name');
pushUnitTest.run(helper, '-w', BASE_NAME + '-1', BASE_NAME + '-2', BASE_NAME + '-bad-name');

const ListUnitTest = require("./lib/list.unit.js");
const listUnitTest = new ListUnitTest();
listUnitTest.run(helper, '-a', BASE_NAME + '-1', BASE_NAME + '-2', BASE_NAME + '-bad-name');
listUnitTest.run(helper, '-w', BASE_NAME + '-1', BASE_NAME + '-2', BASE_NAME + '-bad-name');

const DeleteUnitTest = require("./lib/delete.unit.js");
const deleteUnitTest = new DeleteUnitTest();
deleteUnitTest.run(helper, '-w', BASE_NAME + '-1');
deleteUnitTest.run(helper, '-a', BASE_NAME + '-1');

const CompareUnitTest = require("./lib/compare.unit.js");
const compareUnitTest = new CompareUnitTest();
compareUnitTest.run(helper, '-w');
compareUnitTest.run(helper, '-a');
compareUnitTest.run(helper, '-aw');
