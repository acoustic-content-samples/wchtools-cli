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

const Q = require("q");

describe("utils", function() {
    describe("throttledAll", function() {
        var promises1 = [], promises2 = [];

        before(function() {
            var limit = 10;
            // Fill the promise arrays with promises that resolve after 200ms
            for (var i = 0; i < limit; i++) {
                promises1.push(function() {
                    var d = Q.defer();
                    // 500 ms delay
                    Q.delay(500).then(function() { d.resolve(); });
                    return d.promise;
                });
                promises2.push(function() {
                    var d = Q.defer();
                    // 200 ms delay
                    Q.delay(200).then(function() { d.resolve(); });
                    return d.promise;
                });
            }
        });

        it("should actually throttle concurrency", function() {
            this.timeout(2000);
            var limit = 2;
            var doneFirst = 0; // will be 1 or 2 depending on which array completes first

            // all in promises1 should execute concurrently and finish in 500ms
            // promises2 should be executed in 5 batches each taking 200ms = total of 1000ms
            return Q.all([Q.allSettled(promises1.map(function(promiseFn) { return promiseFn(); }))
                           .then(function() { doneFirst = doneFirst || 1; return doneFirst;}),
                          utils.throttledAll(promises2, limit)
                                .then(function() { doneFirst = doneFirst || 2; return doneFirst;})])
                    .then(function() {
                        expect(doneFirst).to.equal(1);
                    });
        });

        it("should actually execute all tasks", function () {
            this.timeout(2000);
            var count = 0;
            var total = 10;
            var promises0 = [];
            for (var i = 0; i < total; i++) {
                promises0.push(function() {
                    var d = Q.defer();
                    Q.delay(200).then(function() { d.resolve(++count); });
                    return d.promise;
                });
            }
            var limit = 2;
            return utils.throttledAll(promises0, limit).then(function() {
                expect(count).to.equal(total);
            });
        });

        it("should never exceed the limit", function() {
            var limit = 15;
            var counter = 0;
            var promiseCount = 256;
            var promises = [];

            this.timeout(promiseCount / limit * 500);

            // I'm using Array(..).fill(..) instead of a for loop to get around
            // javascript's issues with scope and async functions
            Array(promiseCount).fill(0).forEach(function(_, i) {
                promises.push(function() {
                    counter++;
                    return Q.delay(200 + 100 * Math.random())
                        .then(function() {
                            expect(counter).to.be.at.most(limit);
                            counter--;
                            return counter;
                        });
                });
            });

            return utils.throttledAll(promises, limit);
        });

    });
    describe("throttleFail", function() {
        var promises1 = [], promises2 = [];

        before(function () {
            var limit = 10;
            // Fill the promise arrays with promises that resolve after 200ms
            for (var i = 0; i < limit; i++) {
                promises1.push(function () {
                    return Q.delay(200);
                });
                promises2.push(function (cb) {
                    return Q.reject(new Error("ff"));
                });
            }
        });
        it("should fail with an invalid limit", function() {
            var limit = '2';
            var doneFirst = 0; // will be 1 or 2 depending on which array completes first

            return Q.all([Q.all(promises1)
                .then(function() {}),
                    utils.throttledAll(promises2, limit)
                        .then(function() {
                            }, function(err){
                        expect(err).to.be.an("object");
                    })]);
        });
        it("should actually execute all tasks even if one fails", function () {
            this.timeout(4000);
            var count = 0;
            var promises3 = [];
            for (var i = 0; i < 10; i++) {
                promises3.push(function() {
                    var d = Q.defer();
                    Q.delay(200).then(function() {
                        if (count++ == 0) {
                            d.reject(new Error("bad " + count));
                        } else {
                            d.resolve(count);
                        }
                    });
                    return d.promise;
                });
            }
            var limit = 2;
            return utils.throttledAll(promises3, limit).then(function(res) {
                expect(count).to.equal(10);
                expect(res[0].state).to.equal("rejected");
                for (var i = 1; i < res.length; i++) {
                    expect(res[i].state).to.equals("fulfilled");
                }
            });
        });

    });
    describe("utils functions pathNormalize", function() {
        it("should return a path", function () {
            var path = utils.pathNormalize("/assets");
            expect(path).to.be.an("string");
        });
        it("should return a clone", function () {
            var obj = utils.clone({assets:'foo'});
            expect(obj).to.be.an("object");
        });
        it("should return the users home dir", function () {
            var home = utils.getUserHome();
            expect(home).to.be.an("string");
        });
        it("should return the logger", function () {
            var logger = utils.getLogger(utils.apisLog);
            expect(logger).to.be.an("object");
        });
    });
});
