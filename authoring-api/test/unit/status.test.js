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
const expect = require("chai").expect;
const utils = require("../../lib/utils/utils.js");
const StatusTracker = require("../../lib/utils/statusTracker.js");

describe("status.js", function() {
    var status;
    const testStatusTracker = new StatusTracker();
    before(function() {
        status = {
            id: "123"
        };
    });

    describe("addStatus()", function() {
        it("should set a string value", function() {
            testStatusTracker.addStatus(status, "assets");
            var stats = testStatusTracker.getStatus(status);
            expect(stats).to.be.an("Array");
        });

        it("should set a string object", function() {
            testStatusTracker.addStatus(status, "assets");
            var stats = testStatusTracker.getStatus(status);
            expect(stats).to.be.an("Array");
        });

        it("should set a string number", function() {
            testStatusTracker.addStatus(status, StatusTracker.EXISTS_LOCALLY);
            var stats = testStatusTracker.getStatus(status);
            expect(stats).to.be.an("Array");
        });
        it("should be removed from status", function() {
            testStatusTracker.clearAllStatuses();
            testStatusTracker.addStatus(status, "assets");
            testStatusTracker.removeStatus(status, "assets");
            var stats = testStatusTracker.getStatus(status);
            if(stats.length === 0)
                stats = 'success';
            else
                stats = 'fail';
            expect(stats).to.have.string("success");
        });
        it("should exist remotely", function() {
            testStatusTracker.addStatus(status, StatusTracker.EXISTS_LOCALLY);
            testStatusTracker.addStatus(status, StatusTracker.EXISTS_REMOTELY);
            expect(testStatusTracker.existsLocally(status));
            expect(testStatusTracker.existsRemotely(status));
        });

    });

});
