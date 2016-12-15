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
 * Unit tests for the assetsREST object.
 */
"use strict";

// Require the super classes for this class.
const UnitTest = require("./base.unit.js");
const AssetsUnitTest = require("./assets.unit.js");

// Require the node modules used in this test file.
const fs = require("fs");
const Stream = require("stream");
const diff = require("diff");
const sinon = require("sinon");
const options = require(UnitTest.AUTHORING_API_PATH + "lib/utils/options.js");

// Require the local modules that will be stubbed, mocked, and spied.
const utils = require(UnitTest.AUTHORING_API_PATH + "lib/utils/utils.js");
const request = utils.getRequestWrapper();

// Require the local module being tested.
const assetsREST = require(UnitTest.AUTHORING_API_PATH + "lib/assetsREST.js").instance;

// Get the "lookup" URI for assets.
const assetsLookupUri =  options.getProperty("assets", "uri");
const resourcesLookupUri =  options.getProperty("resources", "uri");

class AssetsRestUnitTest extends AssetsUnitTest {
    constructor() {
        super();
    }

    run () {
        const self = this;
        describe("Unit tests for authoring-api/assetsREST.js", function() {
            // Initialize common resourses before running the unit tests.
            before(function (done) {
                // Reset the state of the REST API.
                assetsREST.reset();

                // Signal that the cleanup is complete.
                done();
            });

            // Cleanup common resourses consumed by a test.
            afterEach(function (done) {
                // Restore any stubs and spies used for the test.
                self.restoreTestDoubles();

                // Reset the state of the REST API.
                assetsREST.reset();

                // Signal that the cleanup is complete.
                done();
            });

            // Run each of the tests defined in this class.
            self.testSingleton(assetsREST);
            self.testGetItems();
            self.testPushItem();
            self.testPullItem();
            self.testDeleteItem();
        });
    }

    testSingleton (restApi) {
        describe("is a singleton", function () {
            it("should fail if try to construct an assetsREST directly ", function (done) {
                let error;
                try {
                    const api = new restApi.constructor();
                    if (api) {
                        error = "The constructor should have failed.";
                    } else {
                        error = "The constructor should have thrown an error.";
                    }
                } catch (e) {
                    expect(e).to.equal("An instance of singleton class " + restApi.constructor.name + " cannot be constructed");
                }

                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
        });
    }

    testGetItems () {
        const self = this;

        // Execute several failure cases to test the various ways the server might return an error. Subsequent tests do
        // not need to repeat the test matrix, they can just execute one of these tests to verify an error is returned.
        describe("getItems", function() {

            /*
            it("should fail when getting the assets URI fails with an error", function (done) {
                // Create a stub for the GET request to return an error.
                const ASSETS_URI_ERROR = "Error getting the assets URI.";
                const stub = sinon.stub(request, "get");
                const matcher = sinon.match.has("uri", assetsLookupUri);
                const err = new Error(ASSETS_URI_ERROR);
                const res = null;
                const body = null;
                stub.withArgs(matcher).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsREST.getItems(UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once with the specified URI.
                            expect(stub).to.have.been.calledOnce;
                            expect(stub.firstCall.args[0].uri).to.equal(assetsLookupUri);
                            expect(stub.firstCall.args[0].json).to.equal(true);

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.equal(ASSETS_URI_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when getting the assets URI fails with a body message", function (done) {
                // Create a stub for the GET request to return an error response code and message.
                const ASSETS_URI_ERROR = "Error getting the assets URI.";
                const stub = sinon.stub(request, "get");
                const matcher = sinon.match.has("uri", assetsLookupUri);
                const err = null;
                const res = {"statusCode": 400};
                const body = {"message": ASSETS_URI_ERROR};
                stub.withArgs(matcher).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsREST.getItems(UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once with the specified URI.
                            expect(stub).to.have.been.calledOnce;
                            expect(stub.firstCall.args[0].uri).to.equal(assetsLookupUri);
                            expect(stub.firstCall.args[0].json).to.equal(true);

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.equal(ASSETS_URI_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when getting the assets URI fails with a body error", function (done) {
                // Create a stub for the GET request to return an error response code and message.
                const ASSETS_URI_ERROR = "Error getting the assets URI.";
                const stub = sinon.stub(request, "get");
                const matcher = sinon.match.has("uri", assetsLookupUri);
                const err = null;
                const res = {"statusCode": 401};
                const body = {"error": new Error(ASSETS_URI_ERROR)};
                stub.withArgs(matcher).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsREST.getItems(UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once with the specified URI.
                            expect(stub).to.have.been.calledOnce;
                            expect(stub.firstCall.args[0].uri).to.equal(assetsLookupUri);
                            expect(stub.firstCall.args[0].json).to.equal(true);

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.equal(ASSETS_URI_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when getting the assets URI fails with multiple body errors", function (done) {
                // Create a stub for the GET request to return an error response code and messages.
                const ASSETS_URI_ERROR = "Error getting the assets URI.";
                const stub = sinon.stub(request, "get");
                const matcher = sinon.match.has("uri", assetsLookupUri);
                const err = null;
                const res = {"statusCode": 404};
                const body = {"errors": [new Error(ASSETS_URI_ERROR), new Error("Error 2"), new Error("Error 3")]};
                stub.withArgs(matcher).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsREST.getItems(UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once with the specified URI.
                            expect(stub).to.have.been.calledOnce;
                            expect(stub.firstCall.args[0].uri).to.equal(assetsLookupUri);
                            expect(stub.firstCall.args[0].json).to.equal(true);

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.contain(ASSETS_URI_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when getting the assets URI fails with an error message as the body", function (done) {
                // Create a stub for the GET request to return an error response code and message.
                const ASSETS_URI_ERROR = "Error getting the assets URI.";
                const stub = sinon.stub(request, "get");
                const matcher = sinon.match.has("uri", assetsLookupUri);
                const err = null;
                const res = {"statusCode": 500};
                stub.withArgs(matcher).yields(err, res, ASSETS_URI_ERROR);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsREST.getItems(UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once with the specified URI.
                            expect(stub).to.have.been.calledOnce;
                            expect(stub.firstCall.args[0].uri).to.equal(assetsLookupUri);
                            expect(stub.firstCall.args[0].json).to.equal(true);

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.equal(ASSETS_URI_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
*/
            it("should fail when getting the assets fails with an error", function (done) {

                // Create a stub for the GET requests.
                const stub = sinon.stub(request, "get");
                const ASSETS_URI_ERROR = "Error getting the assets.";
                let err = new Error(ASSETS_URI_ERROR);
                let res = null;
                let body = null;
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsREST.getItems(UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once with the asset URI.
                            expect(stub).to.have.been.calledOnce;
                            expect(stub.firstCall.args[0].uri).to.contain("/authoring/v1/assets");
                            expect(stub.firstCall.args[0].json).to.equal(true);

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.equal(ASSETS_URI_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when getting the assets fails with an error response code", function (done) {
                // Create a stub for the GET requests.
                const stub = sinon.stub(request, "get");

                // The GET request is to retrieve the assets, but returns an error.
                const ASSETS_URI_ERROR = "Error getting the assets.";
                let err = null;
                let res = {"statusCode": 407};
                let body = ASSETS_URI_ERROR;
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsREST.getItems(UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once with the lookup URI and once with the asset URI.
                            expect(stub).to.have.been.calledOnce;
                            expect(stub.firstCall.args[0].uri).to.contain("/authoring/v1/assets");
                            expect(stub.firstCall.args[0].json).to.equal(true);

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.equal(ASSETS_URI_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when getting valid assets", function (done) {
                // Create a stub for GET requests
                const stub = sinon.stub(request, "get");

                // The first GET request is to retrieve the assets lookup URI.
                const err = null;
                const res = {"statusCode": 200};

                // The second GET request is to retrieve the assets metadata.
                const assetMetadataPath1 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JPG_1;
                const assetMetadataPath2 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_GIF_1;
                const assetMetadataPath3 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_PNG_1;
                const assetMetadataPath4 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_CSS_1;
                const assetMetadataPath5 = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JAR_1;
                const assetMetadata1 = UnitTest.getJsonObject(assetMetadataPath1);
                const assetMetadata2 = UnitTest.getJsonObject(assetMetadataPath2);
                const assetMetadata3 = UnitTest.getJsonObject(assetMetadataPath3);
                const assetMetadata4 = UnitTest.getJsonObject(assetMetadataPath4);
                const assetMetadata5 = UnitTest.getJsonObject(assetMetadataPath5);
                let body = {"items": [assetMetadata1, assetMetadata2, assetMetadata3, assetMetadata4, assetMetadata5]};
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                assetsREST.getItems({offset: 10, limit:5})
                    .then(function (assets) {
                        // Verify that the stub was called twice, first with the lookup URI and then with the asset URI.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[0].uri).to.contain("/authoring/v1/assets");

                        // Verify that the specified offset and limit are reflected in the URI.
                        expect(stub.firstCall.args[0].uri).to.match(/.*offset=10.*/);
                        expect(stub.firstCall.args[0].uri).to.match(/.*limit=5.*/);

                        // Verify that the REST API returned the expected values.
                        expect(diff.diffJson(assetMetadata1, assets[0])).to.have.lengthOf(1);
                        expect(diff.diffJson(assetMetadata2, assets[1])).to.have.lengthOf(1);
                        expect(diff.diffJson(assetMetadata3, assets[2])).to.have.lengthOf(1);
                        expect(diff.diffJson(assetMetadata4, assets[3])).to.have.lengthOf(1);
                        expect(diff.diffJson(assetMetadata5, assets[4])).to.have.lengthOf(1);
                    })
                    .catch(function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testPushItem () {
        const self = this;
        describe("pushItem", function() {

            it("should fail when posting to the resources URI fails with an Error response", function (done) {
                // Create a stub for the POST request which returns an error.
                const ASSET_ERROR = "Error pushing the asset.";
                const stubPost = sinon.stub(request, "post");
                let err = new Error(ASSET_ERROR);
                let res = {"statusCode": 500};
                let body = null;
                stubPost.yields(err, res, body);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubPost);

                // Call the method being tested.
                let error;
                assetsREST.pushItem(undefined, undefined, AssetsUnitTest.ASSET_HBS_1, AssetsUnitTest.DUMMY_STREAM, 0)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the post stub was called with a resource URI.
                            expect(stubPost).to.have.been.calledOnce;
                            expect(stubPost.firstCall.args[0].uri).to.contain("/resource");

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.contain(ASSET_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when posting to the assets URI fails with an HTTP 500", function (done) {

                // Create a stub for the POST requests.
                const stubPost = sinon.stub(request, "post");

                // The first POST request specifies the resource URI and returns a promise for the asset metadata.
                const assetMetadataPath = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JPG_1;
                const assetMetadata = UnitTest.getJsonObject(assetMetadataPath);
                let err = null;
                let res = {"statusCode": 200};
                let body = JSON.stringify(assetMetadata);
                stubPost.onCall(0).yields(err, res, body);
                stubPost.onCall(0).returns(AssetsUnitTest.DUMMY_WRITE_STREAM);

                // The second POST request specifies the asset URI and returns an error.
                const ASSET_ERROR = "Error pushing the asset.";
                err = new Error(ASSET_ERROR);
                res = {"statusCode": 500};
                body = null;
                stubPost.onCall(1).yields(err, res, body);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubPost);

                // Call the method being tested.
                let error;
                assetsREST.pushItem(undefined, undefined, "\\" + AssetsUnitTest.ASSET_JPG_1, AssetsUnitTest.DUMMY_STREAM, 0)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the post stub was called twice.
                            expect(stubPost).to.have.been.calledTwice;

                            // Verify that the first post was called with a resource URI and the specified body.
                            expect(stubPost.firstCall.args[0].uri).to.contain("/resource");

                            // Verify that the second post was called with an asset URI and the expected body, which
                            // includes the new asset metadata id and a modified path.
                            expect(stubPost.secondCall.args[0].uri).to.contain("/asset");
                            expect(stubPost.secondCall.args[0].body.resource).to.equal(assetMetadata.id);
                            expect(stubPost.secondCall.args[0].body.path).to.equal("/" + AssetsUnitTest.ASSET_JPG_1);

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.contain(ASSET_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when pushing a valid resource", function (done) {
                // Create a readable stream of the asset content to pass to the method being tested.
                const assetPath = AssetsUnitTest.AUTHORING_API_PATH + AssetsUnitTest.VALID_ASSETS_DIRECTORY + AssetsUnitTest.ASSET_JPG_1;
                const assetContent = fs.readFileSync(assetPath);
                const assetStream = new Stream.Readable();
                assetStream.push(assetContent);
                assetStream.push(null);

                // Create spies to watch the pipe process.
                const spyPipe = sinon.spy();
                const spyData = sinon.spy();
                const spyEnd = sinon.spy();
                const spyFinish = sinon.spy();

                // Catch the data that is being piped from the input stream to the post request.
                const requestContentArray = [];
                let requestContentBuffer;
                assetStream.on("data", function (data) {
                    requestContentArray.push(data);
                });
                assetStream.on("data", spyData);
                assetStream.on("end", function () {
                    requestContentBuffer = Buffer.concat(requestContentArray);
                });
                assetStream.on("end", spyEnd);

                // Create a writable stream to receive the content being sent to the post request.
                const requestStream = new Stream.Writable();
                requestStream.on("pipe", spyPipe);
                requestStream.on("finish", spyFinish);

                // Create a stub for the POST requests.
                const stubPost = sinon.stub(request, "post");

                // The first POST request specifies the resource URI and returns a promise for the asset metadata.
                const assetMetadataPath = AssetsUnitTest.VALID_ASSETS_METADATA_DIRECTORY + AssetsUnitTest.ASSET_JPG_1;
                const assetMetadata = UnitTest.getJsonObject(assetMetadataPath);
                let err = null;
                let res = {"statusCode": 200};
                let body = JSON.stringify(assetMetadata);
                stubPost.onCall(0).returns(requestStream);
                stubPost.onCall(0).yieldsAsync(err, res, body);

                // The second POST request specifies the asset URI and returns the asset metadata.
                err = null;
                res = {"statusCode": 200};
                body = assetMetadata;
                stubPost.onCall(1).yields(err, res, body);

                // The stubs should be restored when the test is complete.
                self.addTestDouble(stubPost);

                // Call the method being tested.
                let error;
                assetsREST.pushItem(undefined, undefined, AssetsUnitTest.ASSET_JPG_1, assetStream, assetContent.length)
                    .then(function (asset) {
                        // Verify that the post stub was called twice.
                        expect(stubPost).to.have.been.calledTwice;

                        // Verify that the first post was called with a resource URI.
                        expect(stubPost.firstCall.args[0].uri).to.contain("/resource");

                        // Verify that the expected content was sent to the first post.
                        expect(Buffer.compare(requestContentBuffer, assetContent)).to.equal(0);

                        // Verify that the pipe process occurred in the order expected.
                        expect(spyData).to.have.been.calledBefore(spyPipe);
                        expect(spyPipe).to.have.been.calledBefore(spyEnd);
                        expect(spyEnd).to.have.been.calledBefore(spyFinish);

                        // Verify that the second post was called with an asset URI and the expected body, which
                        // includes the new asset metadata id and a modified path.
                        expect(stubPost.secondCall.args[0].uri).to.contain("/asset");
                        expect(stubPost.secondCall.args[0].body.resource).to.equal(assetMetadata.id);
                        expect(stubPost.secondCall.args[0].body.path).to.equal("/" + AssetsUnitTest.ASSET_JPG_1);

                        // Verify that the expected value is returned.
                        expect(diff.diffJson(asset, assetMetadata)).to.have.lengthOf(1);
                    })
                    .catch(function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testPullItem () {
        const self = this;
        describe("pullItem", function() {

            it("should fail when getting the asset fails with an error response code", function (done) {
                // Create a stub for GET requests
                const stub = sinon.stub(request, "get");

                // The first GET request is to retrieve the assets lookup URI.
                const err = null;

                // The second GET request is to retrieve the asset file stream.
                const responseStream = new Stream.PassThrough();
                stub.onCall(0).returns(responseStream);

                // Emit the test events to the stream (after the stub has returned the stream to method being tested.)
                setTimeout(function () {
                    responseStream.emit("response", {"statusCode": 404});
                    responseStream.emit("end", {"statusCode": 404});
                }, 0);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                const asset = {path: "test.txt", resource:  AssetsUnitTest.ASSET_JPG_3};
                assetsREST.pullItem(asset, AssetsUnitTest.DUMMY_WRITE_STREAM)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once with the lookup URI and once with the generated URI.
                            expect(stub).to.have.been.calledOnce;
                            expect(stub.firstCall.args[0].uri).to.contain("/authoring/v1/resources/"+ AssetsUnitTest.ASSET_JPG_3);

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.contain("Cannot get asset");
                            expect(err.message).to.contain("404");
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when getting the asset fails with an error event", function (done) {
                // Create a stub for GET requests
                const stub = sinon.stub(request, "get");

                // The first GET request is to retrieve the assets lookup URI.
                const err = null;

                // The second GET request is to retrieve the asset file stream.
                const responseStream = new Stream.PassThrough();
                stub.onCall(0).returns(responseStream);

                // Emit the test events to the stream (after the stub has returned the stream to method being tested.)
                const ASSET_ERROR = "There was an error while retrieving the response data.";
                setTimeout(function () {
                    responseStream.emit("error", new Error(ASSET_ERROR));
                }, 0);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                const asset = {path: "test.txt", resource: AssetsUnitTest.ASSET_JPG_3};
                assetsREST.pullItem(asset, AssetsUnitTest.DUMMY_WRITE_STREAM)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset request URI should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the stub was called once with the lookup URI and once with the generated URI.
                            expect(stub).to.have.been.calledOnce;
                            expect(stub.firstCall.args[0].uri).to.contain("/authoring/v1/resources/"+ AssetsUnitTest.ASSET_JPG_3);

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.contain(ASSET_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when pulling a valid resource", function (done) {
                // Create a stub for GET requests
                const stub = sinon.stub(request, "get");


                // The second GET request is to retrieve the asset file stream.
                const content1 = "Some contents of the downloaded file.\n";
                const content2 = "More contents of the downloaded file.\n";
                const content3 = "The rest of the contents of the downloaded file.";
                const responseStream = new Stream.PassThrough();
                stub.onCall(0).returns(responseStream);

                // Create a passthrough stream to be passed to the method being tested.
                const fileStream = new Stream.PassThrough();

                // Capture the data written to the pass through stream so that we can inspect it later.
                const savedContent = [];
                fileStream.on("data", function (data) {
                    savedContent.push(data);
                });

                // Emit the test events to the stream (after the stub has returned the stream to method being tested.)
                setTimeout(function () {
                    responseStream.emit("response", {"statusCode": 200});
                    responseStream.emit("data", content1);
                    responseStream.emit("data", content2);
                    responseStream.emit("data", content3);
                    responseStream.emit("end");
                }, 0);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                const asset = {path: AssetsUnitTest.ASSET_JPG_3, resource: AssetsUnitTest.ASSET_JPG_3};
                assetsREST.pullItem(asset, fileStream)
                    .then(function (asset) {
                        // Verify that the stub was called once with the lookup URI and once with the generated URI.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[0].uri).to.contain("/authoring/v1/resources/"+ AssetsUnitTest.ASSET_JPG_3);

                        // Verify that the expected value was written to the stream.
                        expect(savedContent.toString()).to.contain(content1);
                        expect(savedContent.toString()).to.contain(content2);
                        expect(savedContent.toString()).to.contain(content3);

                        // Verify that the FS API returned the expected value.
                        expect(asset.path).to.contain(AssetsUnitTest.ASSET_JPG_3);
                    })
                    .catch(function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testDeleteItem () {
        const self = this;
        describe("deleteItem", function() {
            it("should fail when deleting the asset fails", function (done) {
                // Create a stub for the DELETE request which returns an error.
                const ASSET_ERROR = "Error deleting the asset.";
                const stubDelete = sinon.stub(request, "del");
                let err = new Error(ASSET_ERROR);
                let res = {"statusCode": 403};
                let body = null;
                stubDelete.yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubDelete);

                // Call the method being tested.
                let error;
                assetsREST.deleteItem(AssetsUnitTest.ASSET_HBS_1)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the asset should have been rejected.");
                    })
                    .catch(function (err) {
                        try {
                            // Verify that the delete stub was called once with a URI that contains the specified ID.
                            expect(stubDelete).to.have.been.calledOnce;
                            expect(stubDelete.firstCall.args[0].uri).to.contain(AssetsUnitTest.ASSET_HBS_1);

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.contain(ASSET_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when deleting a valid asset specifies a body message", function (done) {
                // Create a stub for the DELETE request to delete the specified asset.
                const DELETE_MESSAGE = "The asset was deleted.";
                const stubDelete = sinon.stub(request, "del");
                let err = null;
                let res = {"statusCode": 200};
                let body = DELETE_MESSAGE;
                stubDelete.yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubDelete);

                // Call the method being tested.
                let error;
                assetsREST.deleteItem(AssetsUnitTest.ASSET_HBS_1)
                    .then(function (message) {
                        // Verify that the delete stub was called once with a URI that contains the specified ID.
                        expect(stubDelete).to.have.been.calledOnce;
                        expect(stubDelete.firstCall.args[0].uri).to.contain(AssetsUnitTest.ASSET_HBS_1);

                        // Verify that the REST API returned the expected value.
                        expect(message).to.equal(DELETE_MESSAGE);
                    })
                    .catch(function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when deleting a valid asset specifies no body message", function (done) {
                // Create a stub for the DELETE request to delete the specified asset.
                const stubDelete = sinon.stub(request, "del");
                let err = null;
                let res = {"statusCode": 204};
                let body = null;
                stubDelete.yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubDelete);

                // Call the method being tested.
                let error;
                assetsREST.deleteItem(AssetsUnitTest.ASSET_HBS_1)
                    .then(function (message) {
                        // Verify that the delete stub was called once with a URI that contains the specified ID.
                        expect(stubDelete).to.have.been.calledOnce;
                        expect(stubDelete.firstCall.args[0].uri).to.contain(AssetsUnitTest.ASSET_HBS_1);

                        // Verify that the REST API returned the expected value.
                        expect(message).to.contain(AssetsUnitTest.ASSET_HBS_1);
                    })
                    .catch(function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }
}

module.exports = AssetsRestUnitTest;
