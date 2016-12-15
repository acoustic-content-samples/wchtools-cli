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
 * Use the chai assertion framework.
 */
var chai = require("chai");

/**
 * Use the chai-as-promised promise-assertion extension.
 */
var chaiAsPromised = require("chai-as-promised");

/**
 * Use the sinon spy/stub/mock framework.
 */
require("sinon");

/**
 * Use the sinon-as-promised extension.
 */
require("sinon-as-promised");

/**
 * Use the sinon-chai extension.
 */
var sinonChai = require("sinon-chai");

// Tell chai that it should be using chai-as-promised and sinon-chai.
chai.use(chaiAsPromised);
chai.use(sinonChai);

// Now that chai is using chai-as-promised, expose the new expect function.
global.expect = chai.expect;
