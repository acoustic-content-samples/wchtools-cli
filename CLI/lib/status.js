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
"use strict";

let _intervalId = null;

// Define a utility function for console.log(), so that only one line has to be excluded from the Sonar analysis.
const displayToConsole = function (message) {
	console.log(message); // NOSONAR
};

module.exports = {
	start: function () {
		process.stdout.write('.');

		if (process.stdout.isTTY) {
			_intervalId = _intervalId || setInterval(function () {process.stdout.write('.');}, 1000);
		}
	},

	stop: function () {
		if (process.stdout.isTTY && _intervalId) {
			clearInterval(_intervalId);
			_intervalId = null;
			displayToConsole('');
		}
	}
};
