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
const expect = require("chai").expect;
const xman = require("../../../xman");
const sinon = require("sinon");
const COMMAND=  function() {return process.cwd() + "/index.js";};
const aHelper = require("dxauthoringapi").getAssetsHelper();
const CHelper = require("dxauthoringapi").getCategoriesHelper();
const cHelper = require("dxauthoringapi").getContentHelper();
const tHelper = require("dxauthoringapi").getItemTypeHelper();
const pHelper = require("dxauthoringapi").getPresentationsHelper();
const sHelper = require("dxauthoringapi").getPublishingSourcesHelper();
const rHelper = require("dxauthoringapi").getRenditionsHelper();

describe("all switch", function() {
    describe("push ALL", function() {
        it("should push all types --All-authoring", function(done) {
                const aStub = sinon.stub(aHelper, "pushModifiedItems", function (/*opts*/) {
                const aEmitter = aHelper.getEventEmitter();
                aEmitter.emit("pushed", "foo1");
                aEmitter.emit("pushed", "f002");
                aEmitter.emit("pushed-error", "badfoo");
            });
            const cStub = sinon.stub(cHelper, "pushModifiedItems", function (/*opts*/) {
                const cEmitter = cHelper.getEventEmitter();
                cEmitter.emit("pushed", "foo1");
                cEmitter.emit("pushed", "f002");
                cEmitter.emit("pushed-error", "badfoo");
            });
            const CStub = sinon.stub(CHelper, "pushModifiedItems", function (/*opts*/) {
                const CEmitter = CHelper.getEventEmitter();
                CEmitter.emit("pushed", "foo1");
                CEmitter.emit("pushed", "f002");
                CEmitter.emit("pushed-error", "badfoo");
            });
            const tStub = sinon.stub(tHelper, "pushModifiedItems", function (/*opts*/) {
                const tEmitter = tHelper.getEventEmitter();
                tEmitter.emit("pushed", "foo1");
                tEmitter.emit("pushed", "f002");
                tEmitter.emit("pushed-error", "badfoo");
            });
            const pStub = sinon.stub(pHelper, "pushModifiedItems", function (/*opts*/) {
                const pEmitter = pHelper.getEventEmitter();
                pEmitter.emit("pushed", "foo1");
                pEmitter.emit("pushed", "f002");
                pEmitter.emit("pushed-error", "badfoo");
            });
            const sStub = sinon.stub(sHelper, "pushModifiedItems", function (/*opts*/) {
                const sEmitter = sHelper.getEventEmitter();
                sEmitter.emit("pushed", "foo1");
                sEmitter.emit("pushed", "f002");
                sEmitter.emit("pushed-error", "badfoo");
            });
            const rStub = sinon.stub(rHelper, "pushModifiedItems", function (/*opts*/) {
                const rEmitter = rHelper.getEventEmitter();
                rEmitter.emit("pushed", "foo1");
                rEmitter.emit("pushed", "f002");
                rEmitter.emit("pushed-error", "badfoo");
            });
            // Execute the command to push the items to the download directory.
            let error;
            xman.parseArgs(['', COMMAND, "push", "--All-authoring", '--user', 'foo', '--password', 'password', '-v'])
                .then(function (msg) {
                    // Verify that the stub was called once, and that the expected message was returned.
                    expect(aStub).to.have.been.calledOnce;
                    expect(CStub).to.have.been.calledOnce;
                    expect(cStub).to.have.been.calledOnce;
                    expect(tStub).to.have.been.calledOnce;
                    expect(pStub).to.have.been.calledOnce;
                    expect(sStub).to.have.been.calledOnce;
                    expect(rStub).to.have.been.calledOnce;
                    expect(msg).to.contain('12 artifacts successfully');
                    expect(msg).to.contain('6 error');
                })
                .catch(function (err) {
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                })
                .finally(function () {
                    // Restore the helper's "pushModifiedItems" method.
                    aStub.restore();
                    cStub.restore();
                    CStub.restore();
                    tStub.restore();
                    pStub.restore();
                    sStub.restore();
                    rStub.restore();
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                });
        });
        it("should push all types whether modified or not with --All-authoring --Ignore-timestamps", function(done) {
            const aStub = sinon.stub(aHelper, "pushAllItems", function (/*opts*/) {
                const aEmitter = aHelper.getEventEmitter();
                aEmitter.emit("pushed", "foo1");
                aEmitter.emit("pushed", "f002");
                aEmitter.emit("pushed-error", "badfoo");
            });
            const cStub = sinon.stub(cHelper, "pushAllItems", function (/*opts*/) {
                const cEmitter = cHelper.getEventEmitter();
                cEmitter.emit("pushed", "foo1");
                cEmitter.emit("pushed", "f002");
                cEmitter.emit("pushed-error", "badfoo");
            });
            const CStub = sinon.stub(CHelper, "pushAllItems", function (/*opts*/) {
                const CEmitter = CHelper.getEventEmitter();
                CEmitter.emit("pushed", "foo1");
                CEmitter.emit("pushed", "f002");
                CEmitter.emit("pushed-error", "badfoo");
            });
            const tStub = sinon.stub(tHelper, "pushAllItems", function (/*opts*/) {
                const tEmitter = tHelper.getEventEmitter();
                tEmitter.emit("pushed", "foo1");
                tEmitter.emit("pushed", "f002");
                tEmitter.emit("pushed-error", "badfoo");
            });
            const pStub = sinon.stub(pHelper, "pushAllItems", function (/*opts*/) {
                const pEmitter = pHelper.getEventEmitter();
                pEmitter.emit("pushed", "foo1");
                pEmitter.emit("pushed", "f002");
                pEmitter.emit("pushed-error", "badfoo");
            });
            const sStub = sinon.stub(sHelper, "pushAllItems", function (/*opts*/) {
                const sEmitter = sHelper.getEventEmitter();
                sEmitter.emit("pushed", "foo1");
                sEmitter.emit("pushed", "f002");
                sEmitter.emit("pushed-error", "badfoo");
            });
            const rStub = sinon.stub(rHelper, "pushAllItems", function (/*opts*/) {
                const rEmitter = rHelper.getEventEmitter();
                rEmitter.emit("pushed", "foo1");
                rEmitter.emit("pushed", "f002");
                rEmitter.emit("pushed-error", "badfoo");
            });
            // Execute the command to push the items to the download directory.
            let error;
            xman.parseArgs(['', COMMAND, "push", "--All-authoring", "--Ignore-timestamps", '--user', 'foo', '--password', 'password', '-v'])
                .then(function (msg) {
                    // Verify that the stub was called once, and that the expected message was returned.
                    expect(aStub).to.have.been.calledOnce;
                    expect(CStub).to.have.been.calledOnce;
                    expect(cStub).to.have.been.calledOnce;
                    expect(tStub).to.have.been.calledOnce;
                    expect(pStub).to.have.been.calledOnce;
                    expect(sStub).to.have.been.calledOnce;
                    expect(rStub).to.have.been.calledOnce;
                    expect(msg).to.contain('12 artifacts successfully');
                    expect(msg).to.contain('6 error');
                })
                .catch(function (err) {
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                })
                .finally(function () {
                    // Restore the helper's "pushAllItems" method.
                    aStub.restore();
                    cStub.restore();
                    CStub.restore();
                    tStub.restore();
                    pStub.restore();
                    sStub.restore();
                    rStub.restore();
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                });
        });
        it("should push all types -aCctpsr", function(done) {
            const aStub = sinon.stub(aHelper, "pushModifiedItems", function (/*opts*/) {
                const aEmitter = aHelper.getEventEmitter();
                aEmitter.emit("pushed", "foo1");
                aEmitter.emit("pushed", "f002");
                aEmitter.emit("pushed-error", "badfoo");
            });
            const cStub = sinon.stub(cHelper, "pushModifiedItems", function (/*opts*/) {
                const cEmitter = cHelper.getEventEmitter();
                cEmitter.emit("pushed", "foo1");
                cEmitter.emit("pushed", "f002");
                cEmitter.emit("pushed-error", "badfoo");
            });
            const CStub = sinon.stub(CHelper, "pushModifiedItems", function (/*opts*/) {
                const CEmitter = CHelper.getEventEmitter();
                CEmitter.emit("pushed", "foo1");
                CEmitter.emit("pushed", "f002");
                CEmitter.emit("pushed-error", "badfoo");
            });
            const tStub = sinon.stub(tHelper, "pushModifiedItems", function (/*opts*/) {
                const tEmitter = tHelper.getEventEmitter();
                tEmitter.emit("pushed", "foo1");
                tEmitter.emit("pushed", "f002");
                tEmitter.emit("pushed-error", "badfoo");
            });
            const pStub = sinon.stub(pHelper, "pushModifiedItems", function (/*opts*/) {
                const pEmitter = pHelper.getEventEmitter();
                pEmitter.emit("pushed", "foo1");
                pEmitter.emit("pushed", "f002");
                pEmitter.emit("pushed-error", "badfoo");
            });
            const sStub = sinon.stub(sHelper, "pushModifiedItems", function (/*opts*/) {
                const sEmitter = sHelper.getEventEmitter();
                sEmitter.emit("pushed", "foo1");
                sEmitter.emit("pushed", "f002");
                sEmitter.emit("pushed-error", "badfoo");
            });
            const rStub = sinon.stub(rHelper, "pushModifiedItems", function (/*opts*/) {
                const rEmitter = rHelper.getEventEmitter();
                rEmitter.emit("pushed", "foo1");
                rEmitter.emit("pushed", "f002");
                rEmitter.emit("pushed-error", "badfoo");
            });
            // Execute the command to push the items to the download directory.
            let error;
            xman.parseArgs(['', COMMAND, "push", "-aCctps", '--user', 'foo', '--password', 'password', '-v'])
                .then(function (msg) {
                    // Verify that the stub was called once, and that the expected message was returned.
                    expect(aStub).to.have.been.calledOnce;
                    expect(CStub).to.have.been.calledOnce;
                    expect(cStub).to.have.been.calledOnce;
                    expect(tStub).to.have.been.calledOnce;
                    expect(pStub).to.have.been.calledOnce;
                    expect(sStub).to.have.been.calledOnce;
                    expect(rStub).to.have.been.calledOnce;
                    expect(msg).to.contain('12 artifacts successfully');
                    expect(msg).to.contain('6 error');
                })
                .catch(function (err) {
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                })
                .finally(function () {
                    // Restore the helper's "pushModifiedItems" method.
                    aStub.restore();
                    cStub.restore();
                    CStub.restore();
                    tStub.restore();
                    pStub.restore();
                    sStub.restore();
                    rStub.restore();
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                });
        });
    });
    describe("pull ALL", function() {
        it("should pull all types --All-authoring", function(done) {
            const aStub = sinon.stub(aHelper, "pullModifiedItems", function (/*opts*/) {
                const aEmitter = aHelper.getEventEmitter();
                aEmitter.emit("pulled", "foo1");
                aEmitter.emit("pulled", "f002");
                aEmitter.emit("pulled-error", "badfoo");
            });
            const cStub = sinon.stub(cHelper, "pullModifiedItems", function (/*opts*/) {
                const cEmitter = cHelper.getEventEmitter();
                cEmitter.emit("pulled", "foo1");
                cEmitter.emit("pulled", "f002");
                cEmitter.emit("pulled-error", "badfoo");
            });
            const CStub = sinon.stub(CHelper, "pullModifiedItems", function (/*opts*/) {
                const CEmitter = CHelper.getEventEmitter();
                CEmitter.emit("pulled", "foo1");
                CEmitter.emit("pulled", "f002");
                CEmitter.emit("pulled-error", "badfoo");
            });
            const tStub = sinon.stub(tHelper, "pullModifiedItems", function (/*opts*/) {
                const tEmitter = tHelper.getEventEmitter();
                tEmitter.emit("pulled", "foo1");
                tEmitter.emit("pulled", "f002");
                tEmitter.emit("pulled-error", "badfoo");
            });
            const pStub = sinon.stub(pHelper, "pullModifiedItems", function (/*opts*/) {
                const pEmitter = pHelper.getEventEmitter();
                pEmitter.emit("pulled", "foo1");
                pEmitter.emit("pulled", "f002");
                pEmitter.emit("pulled-error", "badfoo");
            });
            const sStub = sinon.stub(sHelper, "pullModifiedItems", function (/*opts*/) {
                const sEmitter = sHelper.getEventEmitter();
                sEmitter.emit("pulled", "foo1");
                sEmitter.emit("pulled", "f002");
                sEmitter.emit("pulled-error", "badfoo");
            });
            const rStub = sinon.stub(rHelper, "pullModifiedItems", function (/*opts*/) {
                const rEmitter = rHelper.getEventEmitter();
                rEmitter.emit("pulled", "foo1");
                rEmitter.emit("pulled", "f002");
                rEmitter.emit("pulled-error", "badfoo");
            });
            // Execute the command to pull the items to the download directory.
            let error;
            xman.parseArgs(['', COMMAND, "pull", "--All-authoring", '--user', 'foo', '--password', 'password', '-v'])
                .then(function (msg) {
                    // Verify that the stub was called once, and that the expected message was returned.
                    expect(aStub).to.have.been.calledOnce;
                    expect(CStub).to.have.been.calledOnce;
                    expect(cStub).to.have.been.calledOnce;
                    expect(tStub).to.have.been.calledOnce;
                    expect(pStub).to.have.been.calledOnce;
                    expect(sStub).to.have.been.calledOnce;
                    expect(rStub).to.have.been.calledOnce;
                    expect(msg).to.contain('12 artifacts successfully');
                    expect(msg).to.contain('6 error');
                })
                .catch(function (err) {
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                })
                .finally(function () {
                    // Restore the helper's "pullModifiedItems" method.
                    aStub.restore();
                    cStub.restore();
                    CStub.restore();
                    tStub.restore();
                    pStub.restore();
                    sStub.restore();
                    rStub.restore();
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                });
        });
        it("should pull all types --All-authoring --Inore-timestamps", function(done) {
            const aStub = sinon.stub(aHelper, "pullAllItems", function (/*opts*/) {
                const aEmitter = aHelper.getEventEmitter();
                aEmitter.emit("pulled", "foo1");
                aEmitter.emit("pulled", "f002");
                aEmitter.emit("pulled-error", "badfoo");
            });
            const cStub = sinon.stub(cHelper, "pullAllItems", function (/*opts*/) {
                const cEmitter = cHelper.getEventEmitter();
                cEmitter.emit("pulled", "foo1");
                cEmitter.emit("pulled", "f002");
                cEmitter.emit("pulled-error", "badfoo");
            });
            const CStub = sinon.stub(CHelper, "pullAllItems", function (/*opts*/) {
                const CEmitter = CHelper.getEventEmitter();
                CEmitter.emit("pulled", "foo1");
                CEmitter.emit("pulled", "f002");
                CEmitter.emit("pulled-error", "badfoo");
            });
            const tStub = sinon.stub(tHelper, "pullAllItems", function (/*opts*/) {
                const tEmitter = tHelper.getEventEmitter();
                tEmitter.emit("pulled", "foo1");
                tEmitter.emit("pulled", "f002");
                tEmitter.emit("pulled-error", "badfoo");
            });
            const pStub = sinon.stub(pHelper, "pullAllItems", function (/*opts*/) {
                const pEmitter = pHelper.getEventEmitter();
                pEmitter.emit("pulled", "foo1");
                pEmitter.emit("pulled", "f002");
                pEmitter.emit("pulled-error", "badfoo");
            });
            const sStub = sinon.stub(sHelper, "pullAllItems", function (/*opts*/) {
                const sEmitter = sHelper.getEventEmitter();
                sEmitter.emit("pulled", "foo1");
                sEmitter.emit("pulled", "f002");
                sEmitter.emit("pulled-error", "badfoo");
            });
            const rStub = sinon.stub(sHelper, "pullAllItems", function (/*opts*/) {
                const rEmitter = rHelper.getEventEmitter();
                rEmitter.emit("pulled", "foo1");
                rEmitter.emit("pulled", "f002");
                rEmitter.emit("pulled-error", "badfoo");
            });
            // Execute the command to pull the items to the download directory.
            let error;
            xman.parseArgs(['', COMMAND, "pull", "--All-authoring", "--Ignore-timestamps", '--user', 'foo', '--password', 'password', '-v'])
                .then(function (msg) {
                    // Verify that the stub was called once, and that the expected message was returned.
                    expect(aStub).to.have.been.calledOnce;
                    expect(CStub).to.have.been.calledOnce;
                    expect(cStub).to.have.been.calledOnce;
                    expect(tStub).to.have.been.calledOnce;
                    expect(pStub).to.have.been.calledOnce;
                    expect(sStub).to.have.been.calledOnce;
                    expect(rStub).to.have.been.calledOnce;
                    expect(msg).to.contain('12 artifacts successfully');
                    expect(msg).to.contain('6 error');
                })
                .catch(function (err) {
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                })
                .finally(function () {
                    // Restore the helper's "pullAllItems" method.
                    aStub.restore();
                    cStub.restore();
                    CStub.restore();
                    tStub.restore();
                    pStub.restore();
                    sStub.restore();
                    rStub.restore();
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                });
        });
        it("should pull all types -aCctpsr", function(done) {
            const aStub = sinon.stub(aHelper, "pullModifiedItems", function (/*opts*/) {
                const aEmitter = aHelper.getEventEmitter();
                aEmitter.emit("pulled", "foo1");
                aEmitter.emit("pulled", "f002");
                aEmitter.emit("pulled-error", "badfoo");
            });
            const cStub = sinon.stub(cHelper, "pullModifiedItems", function (/*opts*/) {
                const cEmitter = cHelper.getEventEmitter();
                cEmitter.emit("pulled", "foo1");
                cEmitter.emit("pulled", "f002");
                cEmitter.emit("pulled-error", "badfoo");
            });
            const CStub = sinon.stub(CHelper, "pullModifiedItems", function (/*opts*/) {
                const CEmitter = CHelper.getEventEmitter();
                CEmitter.emit("pulled", "foo1");
                CEmitter.emit("pulled", "f002");
                CEmitter.emit("pulled-error", "badfoo");
            });
            const tStub = sinon.stub(tHelper, "pullModifiedItems", function (/*opts*/) {
                const tEmitter = tHelper.getEventEmitter();
                tEmitter.emit("pulled", "foo1");
                tEmitter.emit("pulled", "f002");
                tEmitter.emit("pulled-error", "badfoo");
            });
            const pStub = sinon.stub(pHelper, "pullModifiedItems", function (/*opts*/) {
                const pEmitter = pHelper.getEventEmitter();
                pEmitter.emit("pulled", "foo1");
                pEmitter.emit("pulled", "f002");
                pEmitter.emit("pulled-error", "badfoo");
            });
            const sStub = sinon.stub(sHelper, "pullModifiedItems", function (/*opts*/) {
                const sEmitter = sHelper.getEventEmitter();
                sEmitter.emit("pulled", "foo1");
                sEmitter.emit("pulled", "f002");
                sEmitter.emit("pulled-error", "badfoo");
            });
            const rStub = sinon.stub(rHelper, "pullModifiedItems", function (/*opts*/) {
                const rEmitter = rHelper.getEventEmitter();
                rEmitter.emit("pulled", "foo1");
                rEmitter.emit("pulled", "f002");
                rEmitter.emit("pulled-error", "badfoo");
            });
            // Execute the command to pull the items to the download directory.
            let error;
            xman.parseArgs(['', COMMAND, "pull", "-aCctps", '--user', 'foo', '--password', 'password', '-v'])
                .then(function (msg) {
                    // Verify that the stub was called once, and that the expected message was returned.
                    expect(aStub).to.have.been.calledOnce;
                    expect(CStub).to.have.been.calledOnce;
                    expect(cStub).to.have.been.calledOnce;
                    expect(tStub).to.have.been.calledOnce;
                    expect(pStub).to.have.been.calledOnce;
                    expect(sStub).to.have.been.calledOnce;
                    expect(rStub).to.have.been.calledOnce;
                    expect(msg).to.contain('12 artifacts successfully');
                    expect(msg).to.contain('6 error');
                })
                .catch(function (err) {
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                })
                .finally(function () {
                    // Restore the helper's "pullModifiedItems" method.
                    aStub.restore();
                    cStub.restore();
                    CStub.restore();
                    tStub.restore();
                    pStub.restore();
                    sStub.restore();
                    rStub.restore();
                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                });
        });
    });
});
