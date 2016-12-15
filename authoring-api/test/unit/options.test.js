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
const cp = require('cp');
const path = require("path");
const fs = require("fs");
const sinon = require("sinon");
var dest = utils.getUserHome() + path.sep;
var userOptions = dest + 'dx-options.json';
var saveOptions =  dest + 'dx-options.sav';

describe("options.js", function() {
    var options;
    before(function() {
        if(fs.existsSync(userOptions)){
            cp.sync(userOptions, saveOptions);
            fs.unlinkSync(userOptions);
        }
        var loadPath = path.dirname(__filename);
        var cDir = path.normalize(loadPath + path.sep + '../../');
        cp.sync(cDir + 'dx_options.json',userOptions);
        options = require("../../lib/utils/options.js");
    });
    after(function(){
        if(fs.existsSync(saveOptions)){
            cp.sync(saveOptions, userOptions);
            fs.unlinkSync(saveOptions);
        }
    });
    describe("getProperty()", function() {
        it("should return something synchronously", function() {
            // call getSettings() again to make sure it's synchronous
            var _settings = options.getProperty("assets");
            expect(_settings).to.be.an("object");
        });

        it("should have uri properties for types and presentations", function() {
            expect(options.getProperty("types")).to.not.have.property("uri");
            expect(options.getProperty("presentations")).to.not.have.property("uri");
        });
        it("should return null for unknown property", function() {
            expect(options.getUserProperty("red")).to.be.a('null');
        });
        it("set options should not call getproperty if the parameter is undefined", function() {
            const spy = sinon.spy(fs, "writeFileSync");
            options.setOptions(undefined, true);
            expect(spy).to.have.not.been.calledOnce;
            spy.restore();
        });
        it("set options should not call getproperty if the parameter is undefined", function() {
            const spy = sinon.spy(options, "getProperty");
            options.setGlobalOptions();
            expect(spy).to.have.not.been.calledOnce;
            spy.restore();
        });
        it("should return a prop for set user property", function() {
            const stub = sinon.stub(fs, "writeFileSync");
            stub.returns('foo');
            options.setOptions("types", true);
            expect(stub).to.have.been.calledOnce;
            stub.restore();
        });
        it("should return null for unknown property", function() {
            expect(options.getProperty("red")).to.be.a('null');
        });
    });
});
