/*
 Copyright IBM Corporation 2016, 2018
 
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
 * Unit tests for wchToolsApi.js.
 */
"use strict";

// Require the modules used by the test.
const UnitTest = require("./lib/base.unit.js");
const Q = require("q");
const events = require("events");
const sinon = require("sinon");

// Require the local module being tested.
const ToolsApi = require(UnitTest.API_PATH + "wchToolsApi.js");

describe("Unit tests for wchToolsApi.js", function () {
    describe("access the various helpers", function () {
        it("getItemTypeHelper", function (done) {
            const helper = ToolsApi.getItemTypeHelper();
            expect(helper).to.be.ok;
            expect(helper.getArtifactName()).to.equal("types");
            expect(helper).to.have.property("getVirtualFolderName");
            expect(helper).to.have.property("createRemoteItem");
            expect(helper).to.have.property("pullAllItems");
            done();
        });

        it("getAssetsHelper", function (done) {
            const helper = ToolsApi.getAssetsHelper();
            expect(helper).to.be.ok;
            expect(helper.getArtifactName()).to.equal("assets");
            expect(helper).to.have.property("getVirtualFolderName");
            expect(helper).to.have.property("pushModifiedItems");
            expect(helper).to.have.property("deleteRemoteItem");
            done();
        });

        it("getImageProfilesHelper", function (done) {
            const helper = ToolsApi.getImageProfilesHelper();
            expect(helper).to.be.ok;
            expect(helper.getArtifactName()).to.equal("image-profiles");
            expect(helper).to.have.property("canPushItem");
            expect(helper).to.have.property("getLocalItems");
            expect(helper).to.have.property("pushModifiedItems");
            done();
        });

        it("getRenditionsHelper", function (done) {
            const helper = ToolsApi.getRenditionsHelper();
            expect(helper).to.be.ok;
            expect(helper.getArtifactName()).to.equal("renditions");
            expect(helper).to.have.property("doesDirectoryExist");
            expect(helper).to.have.property("getPathName");
            expect(helper).to.have.property("pushAllItems");
            done();
        });

        it("getDefaultContentHelper", function (done) {
            const helper = ToolsApi.getContentHelper();
            expect(helper).to.be.ok;
            expect(helper.getArtifactName()).to.equal("content");
            expect(helper).to.have.property("isRetryPushEnabled");
            expect(helper).to.have.property("listLocalDeletedNames");
            expect(helper).to.have.property("supportsDeleteByPath");
            done();
        });

        it("getContentHelper", function (done) {
            const helper = ToolsApi.getContentHelper();
            expect(helper).to.be.ok;
            expect(helper.getArtifactName()).to.equal("content");
            expect(helper).to.have.property("isRetryPushEnabled");
            expect(helper).to.have.property("listLocalDeletedNames");
            expect(helper).to.have.property("supportsDeleteByPath");
            done();
        });

        it("getCategoriesHelper", function (done) {
            const helper = ToolsApi.getCategoriesHelper();
            expect(helper).to.be.ok;
            expect(helper.getArtifactName()).to.equal("categories");
            expect(helper).to.have.property("canPullItem");
            expect(helper).to.have.property("getLocalItem");
            expect(helper).to.have.property("pullAllItems");
            done();
        });

        it("getPublishingJobsHelper", function (done) {
            const helper = ToolsApi.getPublishingJobsHelper();
            expect(helper).to.be.ok;
            expect(helper).to.have.property("createPublishingJob");
            expect(helper).to.have.property("getPublishingJob");
            done();
        });

        it("getPublishingSiteRevisionsHelper", function (done) {
            const helper = ToolsApi.getPublishingSiteRevisionsHelper();
            expect(helper).to.be.ok;
            expect(helper.getArtifactName()).to.equal("site-revisions");
            expect(helper).to.have.property("getName");
            expect(helper).to.have.property("isRetryPushEnabled");
            expect(helper).to.have.property("getEventEmitter");
            done();
        });

        it("getLayoutsHelper", function (done) {
            const helper = ToolsApi.getLayoutsHelper();
            expect(helper).to.be.ok;
            expect(helper.getArtifactName()).to.equal("layouts");
            expect(helper).to.have.property("supportsDeleteById");
            expect(helper).to.have.property("createRemoteItem");
            expect(helper).to.have.property("getPathName");
            done();
        });

        it("getLayoutMappingsHelper", function (done) {
            const helper = ToolsApi.getLayoutMappingsHelper();
            expect(helper).to.be.ok;
            expect(helper.getArtifactName()).to.equal("layout-mappings");
            expect(helper).to.have.property("supportsDeleteByPath");
            expect(helper).to.have.property("deleteRemoteItem");
            expect(helper).to.have.property("pushModifiedItems");
            done();
        });

        it("getSitesHelper", function (done) {
            const helper = ToolsApi.getSitesHelper();
            expect(helper).to.be.ok;
            expect(helper.getArtifactName()).to.equal("sites");
            expect(helper).to.have.property("addRetryPushProperties");
            expect(helper).to.have.property("getLocalItems");
            expect(helper).to.have.property("pushItem");
            done();
        });

        it("getPagesHelper", function (done) {
            const helper = ToolsApi.getPagesHelper();
            expect(helper).to.be.ok;
            expect(helper.getArtifactName()).to.equal("pages");
            expect(helper).to.have.property("getName");
            expect(helper).to.have.property("filterRetryPush");
            expect(helper).to.have.property("getRemoteItemByPath");
            done();
        });
    });

    let utils;
    describe("utils", function () {
        it("should exist", function (done) {
            utils = ToolsApi.getUtils(); // Save the utils for use in other tests.
            expect(utils).to.be.ok;
            expect(utils.ProductAbrev).to.equal("wchtools");
            expect(utils.ProductName).to.equal("IBM Watson Content Hub");
            done();
        });
    });

    describe("login", function () {
        it("should exist", function (done) {
            const login = ToolsApi.getLogin();
            expect(login).to.be.ok;
            expect(login).to.have.property("login");
            done();
        });
    });

    let context;
    describe("constructor", function () {
        it("should succeed with no options specified", function (done) {
            const api = new ToolsApi();
            context = api.getContext(); // Save this context for use in other tests.
            expect(context["useHashes"]).to.be.true;
            expect(context["rewriteOnPush"]).to.be.true;
            expect(context["saveFileOnConflict"]).to.be.true;
            expect(context["continueOnError"]).to.be.true;
            expect(context["logger"]).to.be.ok;
            done();
        });

        it("should succeed with valid options specified", function (done) {
            const logger = utils.getLogger(utils.apisLog);
            const api = new ToolsApi({
                useHashes: false,
                rewriteOnPush: false,
                saveFileOnConflict: false,
                continueOnError: false,
                logger: logger,
                urls: {
                    assets: "foo",
                    pages: "bar",
                    types: "boo",
                    content: "far"
                }
            });
            const context = api.getContext();
            expect(context["useHashes"]).to.be.false;
            expect(context["rewriteOnPush"]).to.be.false;
            expect(context["saveFileOnConflict"]).to.be.false;
            expect(context["continueOnError"]).to.be.false;
            expect(context["logger"]).to.have.property("error");
            done();
        });

        it("should fail with invalid options specified", function (done) {
            let error;
            try {
                const api = new ToolsApi({logger: {}});
                error = new Error("Expected the ToolsApi constructor to fail.");
            } catch (err) {
                expect(err).to.contain("implement required function");
            }
            done(error);
        });
    });

    describe("initialization errors", function () {
        it("should exist", function (done) {
            const errors = ToolsApi.getInitializationErrors(context);
            expect(errors).to.be.ok;
            expect(errors).to.have.lengthOf(0);
            done();
        });
    });

    describe("logger", function () {
        it("should exist", function (done) {
            const api = new ToolsApi();
            const logger = api.getLogger();
            expect(logger).to.be.ok;
            expect(context["logger"]).to.have.property("error");
            done();
        });
    });

    describe("options", function () {
        it("should exist", function (done) {
            const options = ToolsApi.getOptions();
            expect(options).to.be.ok;
            const properties = options.getPropertyKeys(context);
            expect(properties).to.contain("logger");
            expect(properties).to.contain("eventEmitter");
            expect(properties).to.contain("retryMaxAttempts");
            done();
        });
    });

    describe("pushAllItems", function () {
        it("should succeed when no items to push", function (done) {
            const stubImageProfiles = sinon.stub(ToolsApi.getImageProfilesHelper(), "pushAllItems");
            stubImageProfiles.resolves([]);
            const stubCategories = sinon.stub(ToolsApi.getCategoriesHelper(), "pushAllItems");
            stubCategories.resolves([]);
            const stubAssets = sinon.stub(ToolsApi.getAssetsHelper(), "pushAllItems");
            stubAssets.resolves([]);
            const stubRenditions = sinon.stub(ToolsApi.getRenditionsHelper(), "pushAllItems");
            stubRenditions.resolves([]);
            const stubLayouts = sinon.stub(ToolsApi.getLayoutsHelper(), "pushAllItems");
            stubLayouts.resolves([]);
            const stubTypes = sinon.stub(ToolsApi.getItemTypeHelper(), "pushAllItems");
            stubTypes.resolves([]);
            const stubLayoutMappings = sinon.stub(ToolsApi.getLayoutMappingsHelper(), "pushAllItems");
            stubLayoutMappings.resolves([]);
            const stubContent = sinon.stub(ToolsApi.getContentHelper(), "pushAllItems");
            stubContent.resolves([]);
            const stubDefaultContent = sinon.stub(ToolsApi.getDefaultContentHelper(), "pushAllItems");
            stubDefaultContent.resolves([]);
            const stubSites = sinon.stub(ToolsApi.getSitesHelper(), "pushAllItems");
            stubSites.resolves([]);
            const stubPages = sinon.stub(ToolsApi.getPagesHelper(), "pushAllItems");
            stubPages.resolves([]);
            const stubSiteRevisions = sinon.stub(ToolsApi.getPublishingSiteRevisionsHelper(), "pushAllItems");
            stubSiteRevisions.resolves([]);

            // Call the method being tested.
            let error;
            const api = new ToolsApi();
            api.pushAllItems()
                .then(function (items) {
                    // Verify that the stubs were each called once.
                    expect(stubImageProfiles).to.have.been.calledOnce;
                    expect(stubCategories).to.have.been.calledOnce;
                    expect(stubAssets).to.have.been.calledOnce;
                    expect(stubRenditions).to.have.been.calledOnce;
                    expect(stubLayouts).to.have.been.calledOnce;
                    expect(stubTypes).to.have.been.calledOnce;
                    expect(stubLayoutMappings).to.have.been.calledOnce;
                    expect(stubContent).to.have.been.calledOnce;
                    expect(stubDefaultContent).to.have.been.calledOnce;
                    expect(stubSites).to.have.been.calledOnce;
                    expect(stubPages).to.not.have.been.called; // Because there are no local sites.
                    expect(stubSiteRevisions).to.have.been.calledOnce;

                    // Verify that the expected values are returned.
                    expect(items).to.have.lengthOf(0);
                })
                .catch (function (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                })
                .finally(function () {
                    // The stubs should be restored when the test is complete.
                    stubImageProfiles.restore();
                    stubCategories.restore();
                    stubAssets.restore();
                    stubRenditions.restore();
                    stubLayouts.restore();
                    stubTypes.restore();
                    stubLayoutMappings.restore();
                    stubContent.restore();
                    stubDefaultContent.restore();
                    stubSites.restore();
                    stubPages.restore();
                    stubSiteRevisions.restore();

                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                });
        });

        it("should succeed when items are pushed", function (done) {
            const api = new ToolsApi();
            const context = api.getContext();

            const stubLocalSites = sinon.stub(ToolsApi, "getLocalSites");
            stubLocalSites.resolves([{id: "bar", status: "draft"}, {id: "foo", status: "ready"}]);
            const stubImageProfiles = sinon.stub(ToolsApi.getImageProfilesHelper(), "pushAllItems", function () {
                context.eventEmitter.emit("pushed", "imageProfile1");
                context.eventEmitter.emit("pushed", "imageProfile2");
                const deferred = Q.defer();
                deferred.resolve([{id: "test1", name: "imageProfile1"}, {id: "test2", name: "imageProfile2"}]);
                return deferred.promise;
            });
            const stubCategories = sinon.stub(ToolsApi.getCategoriesHelper(), "pushAllItems", function () {
                context.eventEmitter.emit("pushed", "category1");
                context.eventEmitter.emit("pushed", "category2");
                const deferred = Q.defer();
                deferred.resolve([{id: "test1", name: "category1"}, {id: "test2", name: "category2"}]);
                return deferred.promise;
            });
            const stubAssets = sinon.stub(ToolsApi.getAssetsHelper(), "pushAllItems", function () {
                context.eventEmitter.emit("pushed", "asset1");
                context.eventEmitter.emit("pushed", "asset2");
                const deferred = Q.defer();
                deferred.resolve([{id: "test1", name: "asset1"}, {id: "test2", name: "asset2"}]);
                return deferred.promise;
            });
            const stubRenditions = sinon.stub(ToolsApi.getRenditionsHelper(), "pushAllItems");
            stubRenditions.resolves([]);
            const stubLayouts = sinon.stub(ToolsApi.getLayoutsHelper(), "pushAllItems");
            stubLayouts.resolves([]);
            const stubTypes = sinon.stub(ToolsApi.getItemTypeHelper(), "pushAllItems");
            stubTypes.resolves([]);
            const stubLayoutMappings = sinon.stub(ToolsApi.getLayoutMappingsHelper(), "pushAllItems");
            stubLayoutMappings.resolves([]);
            const stubContent = sinon.stub(ToolsApi.getContentHelper(), "pushAllItems");
            stubContent.resolves([]);
            const stubDefaultContent = sinon.stub(ToolsApi.getDefaultContentHelper(), "pushAllItems");
            stubDefaultContent.resolves([]);
            const stubSites = sinon.stub(ToolsApi.getSitesHelper(), "pushAllItems");
            stubSites.resolves([]);
            const stubPages = sinon.stub(ToolsApi.getPagesHelper(), "pushAllItems");
            stubPages.resolves([]);
            const stubSiteRevisions = sinon.stub(ToolsApi.getPublishingSiteRevisionsHelper(), "pushAllItems");
            stubSiteRevisions.resolves([]);

            // Call the method being tested.
            let error;
            api.pushAllItems()
                .then(function (items) {
                    // Verify that the stubs were each called once.
                    expect(stubImageProfiles).to.have.been.calledOnce;
                    expect(stubCategories).to.have.been.calledOnce;
                    expect(stubAssets).to.have.been.calledOnce;
                    expect(stubRenditions).to.have.been.calledOnce;
                    expect(stubLayouts).to.have.been.calledOnce;
                    expect(stubTypes).to.have.been.calledOnce;
                    expect(stubLayoutMappings).to.have.been.calledOnce;
                    expect(stubContent).to.have.been.calledOnce;
                    expect(stubDefaultContent).to.have.been.calledOnce;
                    expect(stubSites).to.have.been.calledOnce;
                    expect(stubPages).to.have.been.calledTwice; // Because there are two local sites
                    expect(stubSiteRevisions).to.have.been.calledOnce;

                    // Verify that the expected values are returned.
                    expect(items).to.have.lengthOf(6);
                })
                .catch (function (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                })
                .finally(function () {
                    // The stubs should be restored when the test is complete.
                    stubLocalSites.restore();
                    stubImageProfiles.restore();
                    stubCategories.restore();
                    stubAssets.restore();
                    stubRenditions.restore();
                    stubLayouts.restore();
                    stubTypes.restore();
                    stubLayoutMappings.restore();
                    stubContent.restore();
                    stubDefaultContent.restore();
                    stubSites.restore();
                    stubPages.restore();
                    stubSiteRevisions.restore();

                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                });
        });

        it("should succeed when items are pushed (no sites)", function (done) {
            const api = new ToolsApi();
            const context = api.getContext();

            const stubLocalSites = sinon.stub(ToolsApi, "getLocalSites");
            stubLocalSites.resolves(null);
            const stubImageProfiles = sinon.stub(ToolsApi.getImageProfilesHelper(), "pushAllItems", function () {
                context.eventEmitter.emit("pushed", "imageProfile1");
                context.eventEmitter.emit("pushed", "imageProfile2");
                const deferred = Q.defer();
                deferred.resolve([{id: "test1", name: "imageProfile1"}, {id: "test2", name: "imageProfile2"}]);
                return deferred.promise;
            });
            const stubCategories = sinon.stub(ToolsApi.getCategoriesHelper(), "pushAllItems", function () {
                context.eventEmitter.emit("pushed", "category1");
                context.eventEmitter.emit("pushed", "category2");
                const deferred = Q.defer();
                deferred.resolve([{id: "test1", name: "category1"}, {id: "test2", name: "category2"}]);
                return deferred.promise;
            });
            const stubAssets = sinon.stub(ToolsApi.getAssetsHelper(), "pushAllItems", function () {
                context.eventEmitter.emit("pushed", "asset1");
                context.eventEmitter.emit("pushed", "asset2");
                const deferred = Q.defer();
                deferred.resolve([{id: "test1", name: "asset1"}, {id: "test2", name: "asset2"}]);
                return deferred.promise;
            });
            const stubRenditions = sinon.stub(ToolsApi.getRenditionsHelper(), "pushAllItems");
            stubRenditions.resolves([]);
            const stubLayouts = sinon.stub(ToolsApi.getLayoutsHelper(), "pushAllItems");
            stubLayouts.resolves([]);
            const stubTypes = sinon.stub(ToolsApi.getItemTypeHelper(), "pushAllItems");
            stubTypes.resolves([]);
            const stubLayoutMappings = sinon.stub(ToolsApi.getLayoutMappingsHelper(), "pushAllItems");
            stubLayoutMappings.resolves([]);
            const stubContent = sinon.stub(ToolsApi.getContentHelper(), "pushAllItems");
            stubContent.resolves([]);
            const stubDefaultContent = sinon.stub(ToolsApi.getDefaultContentHelper(), "pushAllItems");
            stubDefaultContent.resolves([]);
            const stubSites = sinon.stub(ToolsApi.getSitesHelper(), "pushAllItems");
            stubSites.resolves([]);
            const stubPages = sinon.stub(ToolsApi.getPagesHelper(), "pushAllItems");
            stubPages.resolves([]);
            const stubSiteRevisions = sinon.stub(ToolsApi.getPublishingSiteRevisionsHelper(), "pushAllItems");
            stubSiteRevisions.resolves([]);

            // Call the method being tested.
            let error;
            api.pushAllItems()
                .then(function (items) {
                    // Verify that the stubs were each called once.
                    expect(stubImageProfiles).to.have.been.calledOnce;
                    expect(stubCategories).to.have.been.calledOnce;
                    expect(stubAssets).to.have.been.calledOnce;
                    expect(stubRenditions).to.have.been.calledOnce;
                    expect(stubLayouts).to.have.been.calledOnce;
                    expect(stubTypes).to.have.been.calledOnce;
                    expect(stubLayoutMappings).to.have.been.calledOnce;
                    expect(stubContent).to.have.been.calledOnce;
                    expect(stubDefaultContent).to.have.been.calledOnce;
                    expect(stubSites).to.have.been.calledOnce;
                    expect(stubPages).to.not.have.been.called; // Because there are no local sites
                    expect(stubSiteRevisions).to.have.been.calledOnce;

                    // Verify that the expected values are returned.
                    expect(items).to.have.lengthOf(6);
                })
                .catch (function (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                })
                .finally(function () {
                    // The stubs should be restored when the test is complete.
                    stubLocalSites.restore();
                    stubImageProfiles.restore();
                    stubCategories.restore();
                    stubAssets.restore();
                    stubRenditions.restore();
                    stubLayouts.restore();
                    stubTypes.restore();
                    stubLayoutMappings.restore();
                    stubContent.restore();
                    stubDefaultContent.restore();
                    stubSites.restore();
                    stubPages.restore();
                    stubSiteRevisions.restore();

                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                });
        });

        it("should fail when an item push fails", function (done) {
            const eventEmitter = new events.EventEmitter();
            const api = new ToolsApi({eventEmitter: eventEmitter});
            const PUSH_ERROR = "Push failure, expected by unit test.";

            const stubImageProfiles = sinon.stub(ToolsApi.getImageProfilesHelper(), "pushAllItems", function () {
                eventEmitter.emit("pushed", "imageProfile1");
                eventEmitter.emit("pushed", "imageProfile2");
                const deferred = Q.defer();
                deferred.resolve([{id: "test1", name: "imageProfile1"}, {id: "test2", name: "imageProfile2"}]);
                return deferred.promise;
            });
            const stubCategories = sinon.stub(ToolsApi.getCategoriesHelper(), "pushAllItems", function () {
                eventEmitter.emit("pushed", "category1");
                const err = new Error(PUSH_ERROR);
                eventEmitter.emit("pushed-error", err, "category2");
                const deferred = Q.defer();
                deferred.resolve([{id: "test1", name: "category1"}]);
                return deferred.promise;
            });
            const stubAssets = sinon.stub(ToolsApi.getAssetsHelper(), "pushAllItems", function () {
                eventEmitter.emit("pushed", "asset1");
                const err = new Error(PUSH_ERROR);
                eventEmitter.emit("pushed-error", err, "asset2");
                const deferred = Q.defer();
                deferred.resolve([{id: "test1", name: "asset1"}]);
                return deferred.promise;
            });
            const stubRenditions = sinon.stub(ToolsApi.getRenditionsHelper(), "pushAllItems");
            stubRenditions.resolves([]);
            const stubLayouts = sinon.stub(ToolsApi.getLayoutsHelper(), "pushAllItems");
            stubLayouts.resolves([]);
            const stubTypes = sinon.stub(ToolsApi.getItemTypeHelper(), "pushAllItems");
            stubTypes.resolves([]);
            const stubLayoutMappings = sinon.stub(ToolsApi.getLayoutMappingsHelper(), "pushAllItems");
            stubLayoutMappings.resolves([]);
            const stubContent = sinon.stub(ToolsApi.getContentHelper(), "pushAllItems");
            stubContent.resolves([]);
            const stubDefaultContent = sinon.stub(ToolsApi.getDefaultContentHelper(), "pushAllItems");
            stubDefaultContent.resolves([]);
            const stubSites = sinon.stub(ToolsApi.getSitesHelper(), "pushAllItems");
            stubSites.resolves([]);
            const stubPages = sinon.stub(ToolsApi.getPagesHelper(), "pushAllItems");
            stubPages.resolves([]);
            const stubSiteRevisions = sinon.stub(ToolsApi.getPublishingSiteRevisionsHelper(), "pushAllItems");
            stubSiteRevisions.resolves([]);

            // Call the method being tested.
            let error;
            api.pushAllItems()
                .then(function () {
                    // This is not expected. Pass the error to the "done" function to indicate a failed test.
                    error = new Error("The promise for pushing all items should have been rejected.");
                })
                .catch (function (errs) {
                    // Verify that the expected error is returned.
                    expect(errs).to.have.lengthOf(2);
                    errs.forEach(function (err) {
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.equal(PUSH_ERROR);
                    });
                })
                .catch (function (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                })
                .finally(function () {
                    // The stubs should be restored when the test is complete.
                    stubImageProfiles.restore();
                    stubCategories.restore();
                    stubAssets.restore();
                    stubRenditions.restore();
                    stubLayouts.restore();
                    stubTypes.restore();
                    stubLayoutMappings.restore();
                    stubContent.restore();
                    stubDefaultContent.restore();
                    stubSites.restore();
                    stubPages.restore();
                    stubSiteRevisions.restore();

                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                });
        });

        it("should succeed when a helper pushAllItems fails - continueOnError true", function (done) {
            const eventEmitter = new events.EventEmitter();
            const api = new ToolsApi({eventEmitter: eventEmitter, continueOnError: true});
            const PUSH_ERROR = "Push failure, expected by unit test.";

            const stubImageProfiles = sinon.stub(ToolsApi.getImageProfilesHelper(), "pushAllItems", function () {
                eventEmitter.emit("pushed", "imageProfile1");
                eventEmitter.emit("pushed", "imageProfile2");
                const deferred = Q.defer();
                deferred.resolve([{id: "test1", name: "imageProfile1"}, {id: "test2", name: "imageProfile2"}]);
                return deferred.promise;
            });
            const stubCategories = sinon.stub(ToolsApi.getCategoriesHelper(), "pushAllItems", function () {
                eventEmitter.emit("pushed", "category1");
                eventEmitter.emit("pushed", "category2");
                const deferred = Q.defer();
                deferred.resolve([{id: "test1", name: "category1"}, {id: "test2", name: "category2"}]);
                return deferred.promise;
            });
            const stubAssets = sinon.stub(ToolsApi.getAssetsHelper(), "pushAllItems", function () {
                eventEmitter.emit("pushed", "asset1");
                eventEmitter.emit("pushed", "asset2");
                const deferred = Q.defer();
                deferred.resolve([{id: "test1", name: "asset1"}, {id: "test2", name: "asset2"}]);
                return deferred.promise;
            });
            const stubRenditions = sinon.stub(ToolsApi.getRenditionsHelper(), "pushAllItems");
            stubRenditions.rejects(new Error(PUSH_ERROR));
            const stubLayouts = sinon.stub(ToolsApi.getLayoutsHelper(), "pushAllItems");
            stubLayouts.resolves([]);
            const stubTypes = sinon.stub(ToolsApi.getItemTypeHelper(), "pushAllItems");
            stubTypes.resolves([]);
            const stubLayoutMappings = sinon.stub(ToolsApi.getLayoutMappingsHelper(), "pushAllItems");
            stubLayoutMappings.resolves([]);
            const stubContent = sinon.stub(ToolsApi.getContentHelper(), "pushAllItems");
            stubContent.resolves([]);
            const stubDefaultContent = sinon.stub(ToolsApi.getDefaultContentHelper(), "pushAllItems");
            stubDefaultContent.resolves([]);
            const stubSites = sinon.stub(ToolsApi.getSitesHelper(), "pushAllItems");
            stubSites.resolves([]);
            const stubPages = sinon.stub(ToolsApi.getPagesHelper(), "pushAllItems");
            stubPages.resolves([]);
            const stubSiteRevisions = sinon.stub(ToolsApi.getPublishingSiteRevisionsHelper(), "pushAllItems");
            stubSiteRevisions.resolves([]);

            // Call the method being tested.
            let error;
            api.pushAllItems()
                .then(function (items) {
                    // Verify that the stubs were each called once.
                    expect(stubImageProfiles).to.have.been.calledOnce;
                    expect(stubCategories).to.have.been.calledOnce;
                    expect(stubAssets).to.have.been.calledOnce;
                    expect(stubRenditions).to.have.been.calledOnce;
                    expect(stubLayouts).to.have.been.calledOnce;
                    expect(stubTypes).to.have.been.calledOnce;
                    expect(stubLayoutMappings).to.have.been.calledOnce;
                    expect(stubContent).to.have.been.calledOnce;
                    expect(stubDefaultContent).to.have.been.calledOnce;
                    expect(stubSites).to.have.been.calledOnce;
                    expect(stubPages).to.not.have.been.called;
                    expect(stubSiteRevisions).to.have.been.calledOnce;

                    // Verify that the expected values are returned.
                    expect(items).to.have.lengthOf(6);
                })
                .catch (function (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                })
                .finally(function () {
                    // The stubs should be restored when the test is complete.
                    stubImageProfiles.restore();
                    stubCategories.restore();
                    stubAssets.restore();
                    stubRenditions.restore();
                    stubLayouts.restore();
                    stubTypes.restore();
                    stubLayoutMappings.restore();
                    stubContent.restore();
                    stubDefaultContent.restore();
                    stubSites.restore();
                    stubPages.restore();
                    stubSiteRevisions.restore();

                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                });
        });

        it("should fail when a helper pushAllItems fails - continueOnError false", function (done) {
            const eventEmitter = new events.EventEmitter();
            const api = new ToolsApi({eventEmitter: eventEmitter, continueOnError: false});
            const PUSH_ERROR = "Push failure, expected by unit test.";

            const stubImageProfiles = sinon.stub(ToolsApi.getImageProfilesHelper(), "pushAllItems", function () {
                eventEmitter.emit("pushed", "imageProfile1");
                eventEmitter.emit("pushed", "imageProfile2");
                const deferred = Q.defer();
                deferred.resolve([{id: "test1", name: "imageProfile1"}, {id: "test2", name: "imageProfile2"}]);
                return deferred.promise;
            });
            const stubCategories = sinon.stub(ToolsApi.getCategoriesHelper(), "pushAllItems", function () {
                eventEmitter.emit("pushed", "category1");
                eventEmitter.emit("pushed", "category2");
                const deferred = Q.defer();
                deferred.resolve([{id: "test1", name: "category1"}, {id: "test2", name: "category2"}]);
                return deferred.promise;
            });
            const stubAssets = sinon.stub(ToolsApi.getAssetsHelper(), "pushAllItems", function () {
                eventEmitter.emit("pushed", "asset1");
                eventEmitter.emit("pushed", "asset2");
                const deferred = Q.defer();
                deferred.resolve([{id: "test1", name: "asset1"}, {id: "test2", name: "asset2"}]);
                return deferred.promise;
            });
            const stubRenditions = sinon.stub(ToolsApi.getRenditionsHelper(), "pushAllItems");
            stubRenditions.rejects(new Error(PUSH_ERROR));
            const stubLayouts = sinon.stub(ToolsApi.getLayoutsHelper(), "pushAllItems");
            stubLayouts.resolves([]);
            const stubTypes = sinon.stub(ToolsApi.getItemTypeHelper(), "pushAllItems");
            stubTypes.resolves([]);
            const stubLayoutMappings = sinon.stub(ToolsApi.getLayoutMappingsHelper(), "pushAllItems");
            stubLayoutMappings.resolves([]);
            const stubContent = sinon.stub(ToolsApi.getContentHelper(), "pushAllItems");
            stubContent.resolves([]);
            const stubDefaultContent = sinon.stub(ToolsApi.getDefaultContentHelper(), "pushAllItems");
            stubDefaultContent.resolves([]);
            const stubSites = sinon.stub(ToolsApi.getSitesHelper(), "pushAllItems");
            stubSites.resolves([]);
            const stubPages = sinon.stub(ToolsApi.getPagesHelper(), "pushAllItems");
            stubPages.resolves([]);
            const stubSiteRevisions = sinon.stub(ToolsApi.getPublishingSiteRevisionsHelper(), "pushAllItems");
            stubSiteRevisions.resolves([]);

            // Call the method being tested.
            let error;
            api.pushAllItems()
                .then(function () {
                    // This is not expected. Pass the error to the "done" function to indicate a failed test.
                    error = new Error("The promise for pushing all items should have been rejected.");
                })
                .catch (function (err) {
                    // Verify that the expected error is returned.
                    expect(err.message).to.contain(PUSH_ERROR);
                })
                .catch (function (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                })
                .finally(function () {
                    // The stubs should be restored when the test is complete.
                    stubImageProfiles.restore();
                    stubCategories.restore();
                    stubAssets.restore();
                    stubRenditions.restore();
                    stubLayouts.restore();
                    stubTypes.restore();
                    stubLayoutMappings.restore();
                    stubContent.restore();
                    stubDefaultContent.restore();
                    stubSites.restore();
                    stubPages.restore();
                    stubSiteRevisions.restore();

                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                });
        });
    });

    describe("pushModifiedItems", function () {
        it("should succeed when no items to push", function (done) {
            const stubImageProfiles = sinon.stub(ToolsApi.getImageProfilesHelper(), "pushModifiedItems");
            stubImageProfiles.resolves([]);
            const stubCategories = sinon.stub(ToolsApi.getCategoriesHelper(), "pushModifiedItems");
            stubCategories.resolves([]);
            const stubAssets = sinon.stub(ToolsApi.getAssetsHelper(), "pushModifiedItems");
            stubAssets.resolves([]);
            const stubRenditions = sinon.stub(ToolsApi.getRenditionsHelper(), "pushModifiedItems");
            stubRenditions.resolves([]);
            const stubLayouts = sinon.stub(ToolsApi.getLayoutsHelper(), "pushModifiedItems");
            stubLayouts.resolves([]);
            const stubTypes = sinon.stub(ToolsApi.getItemTypeHelper(), "pushModifiedItems");
            stubTypes.resolves([]);
            const stubLayoutMappings = sinon.stub(ToolsApi.getLayoutMappingsHelper(), "pushModifiedItems");
            stubLayoutMappings.resolves([]);
            const stubContent = sinon.stub(ToolsApi.getContentHelper(), "pushModifiedItems");
            stubContent.resolves([]);
            const stubDefaultContent = sinon.stub(ToolsApi.getDefaultContentHelper(), "pushModifiedItems");
            stubDefaultContent.resolves([]);
            const stubSites = sinon.stub(ToolsApi.getSitesHelper(), "pushModifiedItems");
            stubSites.resolves([]);
            const stubPages = sinon.stub(ToolsApi.getPagesHelper(), "pushModifiedItems");
            stubPages.resolves([]);
            const stubSiteRevisions = sinon.stub(ToolsApi.getPublishingSiteRevisionsHelper(), "pushModifiedItems");
            stubSiteRevisions.resolves([]);

            // Call the method being tested.
            let error;
            const api = new ToolsApi();
            api.pushModifiedItems()
                .then(function (items) {
                    // Verify that the stubs were each called once.
                    expect(stubImageProfiles).to.have.been.calledOnce;
                    expect(stubCategories).to.have.been.calledOnce;
                    expect(stubAssets).to.have.been.calledOnce;
                    expect(stubRenditions).to.have.been.calledOnce;
                    expect(stubLayouts).to.have.been.calledOnce;
                    expect(stubTypes).to.have.been.calledOnce;
                    expect(stubLayoutMappings).to.have.been.calledOnce;
                    expect(stubContent).to.have.been.calledOnce;
                    expect(stubDefaultContent).to.have.been.calledOnce;
                    expect(stubSites).to.have.been.calledOnce;
                    expect(stubPages).to.not.have.been.called;
                    expect(stubSiteRevisions).to.have.been.calledOnce;

                    // Verify that the expected values are returned.
                    expect(items).to.have.lengthOf(0);
                })
                .catch (function (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                })
                .finally(function () {
                    // The stubs should be restored when the test is complete.
                    stubImageProfiles.restore();
                    stubCategories.restore();
                    stubAssets.restore();
                    stubRenditions.restore();
                    stubLayouts.restore();
                    stubTypes.restore();
                    stubLayoutMappings.restore();
                    stubContent.restore();
                    stubDefaultContent.restore();
                    stubSites.restore();
                    stubPages.restore();
                    stubSiteRevisions.restore();

                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                });
        });
    });

    describe("deleteAllItems", function () {
        it("should succeed when no items to delete", function (done) {
            const stubRemoteSites = sinon.stub(ToolsApi.getSitesHelper(), "getRemoteItems");
            stubRemoteSites.resolves(null);
            const stubImageProfiles = sinon.stub(ToolsApi.getImageProfilesHelper(), "deleteRemoteItems");
            stubImageProfiles.resolves(undefined);
            const stubCategories = sinon.stub(ToolsApi.getCategoriesHelper(), "deleteRemoteItems");
            stubCategories.resolves(undefined);
            const stubAssets = sinon.stub(ToolsApi.getAssetsHelper(), "deleteRemoteItems");
            stubAssets.resolves(undefined);
            const stubLayouts = sinon.stub(ToolsApi.getLayoutsHelper(), "deleteRemoteItems");
            stubLayouts.resolves(undefined);
            const stubTypes = sinon.stub(ToolsApi.getItemTypeHelper(), "deleteRemoteItems");
            stubTypes.resolves(undefined);
            const stubLayoutMappings = sinon.stub(ToolsApi.getLayoutMappingsHelper(), "deleteRemoteItems");
            stubLayoutMappings.resolves(undefined);
            const stubContent = sinon.stub(ToolsApi.getContentHelper(), "deleteRemoteItems");
            stubContent.resolves(undefined);
            const stubDefaultContent = sinon.stub(ToolsApi.getDefaultContentHelper(), "deleteRemoteItems");
            stubDefaultContent.resolves(undefined);
            const stubPages = sinon.stub(ToolsApi.getPagesHelper(), "deleteRemoteItems");
            stubPages.resolves(undefined);

            // Call the method being tested.
            let error;
            const api = new ToolsApi();
            api.deleteAllItems()
                .then(function (items) {
                    // Verify that the stubs were each called once.
                    expect(stubRemoteSites).to.have.been.calledOnce;
                    expect(stubImageProfiles).to.have.been.calledOnce;
                    expect(stubCategories).to.have.been.calledOnce;
                    expect(stubAssets).to.have.been.calledOnce;
                    expect(stubLayouts).to.have.been.calledOnce;
                    expect(stubTypes).to.have.been.calledOnce;
                    expect(stubLayoutMappings).to.have.been.calledOnce;
                    expect(stubContent).to.have.been.calledOnce;
                    expect(stubDefaultContent).to.have.been.calledOnce;
                    expect(stubPages).to.not.have.been.called; // Because there are no remote sites.

                    // Verify that the expected values are returned.
                    expect(items).to.have.lengthOf(0);
                })
                .catch (function (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                })
                .finally(function () {
                    // The stubs should be restored when the test is complete.
                    stubRemoteSites.restore();
                    stubImageProfiles.restore();
                    stubCategories.restore();
                    stubAssets.restore();
                    stubLayouts.restore();
                    stubTypes.restore();
                    stubLayoutMappings.restore();
                    stubContent.restore();
                    stubDefaultContent.restore();
                    stubPages.restore();

                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                });
        });

        it("should succeed when items are deleted", function (done) {
            const api = new ToolsApi();
            const context = api.getContext();

            // Make sure there is an event emitter, keep track of the original emitter.
            const emitter = context.eventEmitter;
            context.eventEmitter = new events.EventEmitter();

            const stubRemoteSites = sinon.stub(ToolsApi.getSitesHelper(), "getRemoteItems");
            stubRemoteSites.resolves([{id: "bar", status: "draft"}, {id: "foo", status: "ready"}]);
            const stubImageProfiles = sinon.stub(ToolsApi.getImageProfilesHelper(), "deleteRemoteItems", function () {
                context.eventEmitter.emit("deleted", "imageProfile1");
                context.eventEmitter.emit("deleted", "imageProfile2");
                return Q();
            });
            const stubCategories = sinon.stub(ToolsApi.getCategoriesHelper(), "deleteRemoteItems", function () {
                context.eventEmitter.emit("deleted", "category1");
                context.eventEmitter.emit("deleted", "category2");
                return Q();
            });
            const stubAssets = sinon.stub(ToolsApi.getAssetsHelper(), "deleteRemoteItems", function () {
                context.eventEmitter.emit("deleted", "asset1");
                context.eventEmitter.emit("deleted", "asset2");
                return Q();
            });
            const stubLayouts = sinon.stub(ToolsApi.getLayoutsHelper(), "deleteRemoteItems");
            stubLayouts.resolves(undefined);
            const stubTypes = sinon.stub(ToolsApi.getItemTypeHelper(), "deleteRemoteItems");
            stubTypes.resolves(undefined);
            const stubLayoutMappings = sinon.stub(ToolsApi.getLayoutMappingsHelper(), "deleteRemoteItems");
            stubLayoutMappings.resolves(undefined);
            const stubContent = sinon.stub(ToolsApi.getContentHelper(), "deleteRemoteItems");
            stubContent.resolves(undefined);
            const stubDefaultContent = sinon.stub(ToolsApi.getDefaultContentHelper(), "deleteRemoteItems");
            stubDefaultContent.resolves(undefined);
            const stubPages = sinon.stub(ToolsApi.getPagesHelper(), "deleteRemoteItems");
            stubPages.resolves(undefined);

            // Call the method being tested.
            let error;
            api.deleteAllItems()
                .then(function (items) {
                    // Verify that the stubs were each called once.
                    expect(stubImageProfiles).to.have.been.calledOnce;
                    expect(stubCategories).to.have.been.calledOnce;
                    expect(stubAssets).to.have.been.calledOnce;
                    expect(stubLayouts).to.have.been.calledOnce;
                    expect(stubTypes).to.have.been.calledOnce;
                    expect(stubLayoutMappings).to.have.been.calledOnce;
                    expect(stubContent).to.have.been.calledOnce;
                    expect(stubDefaultContent).to.have.been.calledOnce;
                    expect(stubPages).to.have.been.calledTwice; // Because there are two remote sites

                    // Verify that the expected values are returned.
                    expect(items).to.have.lengthOf(6);
                })
                .catch (function (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                })
                .finally(function () {
                    // Restore the original emitter.
                    context.eventEmitter = emitter;

                    // The stubs should be restored when the test is complete.
                    stubRemoteSites.restore();
                    stubImageProfiles.restore();
                    stubCategories.restore();
                    stubAssets.restore();
                    stubLayouts.restore();
                    stubTypes.restore();
                    stubLayoutMappings.restore();
                    stubContent.restore();
                    stubDefaultContent.restore();
                    stubPages.restore();

                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                });
        });

        it("should fail when an item delete fails", function (done) {
            const api = new ToolsApi();
            const context = api.getContext();
            const DELETE_ERROR = "There was an error deleting an item, as expected by unit test.";

            // Make sure there is an event emitter, keep track of the original emitter.
            const emitter = context.eventEmitter;
            context.eventEmitter = new events.EventEmitter();

            const stubRemoteSites = sinon.stub(ToolsApi.getSitesHelper(), "getRemoteItems");
            stubRemoteSites.resolves([{id: "bar", status: "draft"}, {id: "foo", status: "ready"}]);
            const stubImageProfiles = sinon.stub(ToolsApi.getImageProfilesHelper(), "deleteRemoteItems", function () {
                context.eventEmitter.emit("deleted", "imageProfile1");
                context.eventEmitter.emit("deleted", "imageProfile2");
                return Q();
            });
            const stubCategories = sinon.stub(ToolsApi.getCategoriesHelper(), "deleteRemoteItems", function () {
                context.eventEmitter.emit("deleted", "category1");
                context.eventEmitter.emit("deleted-error", new Error(DELETE_ERROR), "category2");
                return Q();
            });
            const stubAssets = sinon.stub(ToolsApi.getAssetsHelper(), "deleteRemoteItems", function () {
                context.eventEmitter.emit("deleted-error", new Error(DELETE_ERROR), "asset1");
                context.eventEmitter.emit("deleted", "asset2");
                return Q();
            });
            const stubLayouts = sinon.stub(ToolsApi.getLayoutsHelper(), "deleteRemoteItems");
            stubLayouts.resolves(undefined);
            const stubTypes = sinon.stub(ToolsApi.getItemTypeHelper(), "deleteRemoteItems");
            stubTypes.resolves(undefined);
            const stubLayoutMappings = sinon.stub(ToolsApi.getLayoutMappingsHelper(), "deleteRemoteItems");
            stubLayoutMappings.resolves(undefined);
            const stubContent = sinon.stub(ToolsApi.getContentHelper(), "deleteRemoteItems");
            stubContent.resolves(undefined);
            const stubDefaultContent = sinon.stub(ToolsApi.getDefaultContentHelper(), "deleteRemoteItems");
            stubDefaultContent.resolves(undefined);
            const stubPages = sinon.stub(ToolsApi.getPagesHelper(), "deleteRemoteItems");
            stubPages.resolves(undefined);

            // Call the method being tested.
            let error;
            api.deleteAllItems()
                .then(function () {
                    // This is not expected. Pass the error to the "done" function to indicate a failed test.
                    error = new Error("The promise for deleting all items should have been rejected.");
                })
                .catch (function (errs) {
                    // Verify that the expected error is returned.
                    expect(errs).to.have.lengthOf(2);
                    errs.forEach(function (err) {
                        expect(err.name).to.equal("Error");
                        expect(err.message).to.equal(DELETE_ERROR);
                    });

                    // Verify that the stubs were each called once.
                    expect(stubImageProfiles).to.have.been.calledOnce;
                    expect(stubCategories).to.have.been.calledOnce;
                    expect(stubAssets).to.have.been.calledOnce;
                    expect(stubLayouts).to.have.been.calledOnce;
                    expect(stubTypes).to.have.been.calledOnce;
                    expect(stubLayoutMappings).to.have.been.calledOnce;
                    expect(stubContent).to.have.been.calledOnce;
                    expect(stubDefaultContent).to.have.been.calledOnce;
                    expect(stubPages).to.have.been.calledTwice; // Because there are two remote sites
                })
                .catch (function (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                })
                .finally(function () {
                    // Restore the original emitter.
                    context.eventEmitter = emitter;

                    // The stubs should be restored when the test is complete.
                    stubRemoteSites.restore();
                    stubImageProfiles.restore();
                    stubCategories.restore();
                    stubAssets.restore();
                    stubLayouts.restore();
                    stubTypes.restore();
                    stubLayoutMappings.restore();
                    stubContent.restore();
                    stubDefaultContent.restore();
                    stubPages.restore();

                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                });
        });

        it("should succeed when a helper deleteRemoteItems fails - continueOnError true", function (done) {
            const api = new ToolsApi({eventEmitter: new events.EventEmitter(), continueOnError: true});
            const context = api.getContext();
            const DELETE_ERROR = "Delete failure, expected by unit test.";

            const stubRemoteSites = sinon.stub(ToolsApi.getSitesHelper(), "getRemoteItems");
            stubRemoteSites.resolves([{id: "bar", status: "draft"}, {id: "foo", status: "ready"}]);
            const stubImageProfiles = sinon.stub(ToolsApi.getImageProfilesHelper(), "deleteRemoteItems", function () {
                context.eventEmitter.emit("deleted", "imageProfile1");
                context.eventEmitter.emit("deleted", "imageProfile2");
                return Q();
            });
            const stubCategories = sinon.stub(ToolsApi.getCategoriesHelper(), "deleteRemoteItems", function () {
                context.eventEmitter.emit("deleted", "category1");
                context.eventEmitter.emit("deleted", "category2");
                return Q();
            });
            const stubAssets = sinon.stub(ToolsApi.getAssetsHelper(), "deleteRemoteItems", function () {
                context.eventEmitter.emit("deleted", "asset1");
                context.eventEmitter.emit("deleted", "asset2");
                return Q();
            });
            const stubLayouts = sinon.stub(ToolsApi.getLayoutsHelper(), "deleteRemoteItems");
            stubLayouts.rejects(new Error(DELETE_ERROR));
            const stubTypes = sinon.stub(ToolsApi.getItemTypeHelper(), "deleteRemoteItems");
            stubTypes.resolves(undefined);
            const stubLayoutMappings = sinon.stub(ToolsApi.getLayoutMappingsHelper(), "deleteRemoteItems");
            stubLayoutMappings.resolves(undefined);
            const stubContent = sinon.stub(ToolsApi.getContentHelper(), "deleteRemoteItems");
            stubContent.resolves(undefined);
            const stubDefaultContent = sinon.stub(ToolsApi.getDefaultContentHelper(), "deleteRemoteItems");
            stubDefaultContent.resolves(undefined);
            const stubPages = sinon.stub(ToolsApi.getPagesHelper(), "deleteRemoteItems");
            stubPages.resolves(undefined);

            // Call the method being tested.
            let error;
            api.deleteAllItems()
                .then(function (items) {
                    // Verify that the stubs were each called once.
                    expect(stubImageProfiles).to.have.been.calledOnce;
                    expect(stubCategories).to.have.been.calledOnce;
                    expect(stubAssets).to.have.been.calledOnce;
                    expect(stubLayouts).to.have.been.calledOnce;
                    expect(stubTypes).to.have.been.calledOnce;
                    expect(stubLayoutMappings).to.have.been.calledOnce;
                    expect(stubContent).to.have.been.calledOnce;
                    expect(stubDefaultContent).to.have.been.calledOnce;
                    expect(stubPages).to.have.been.calledTwice; // Because there are two remote sites

                    // Verify that the expected values are returned.
                    expect(items).to.have.lengthOf(6);
                })
                .catch (function (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                })
                .finally(function () {
                    // The stubs should be restored when the test is complete.
                    stubRemoteSites.restore();
                    stubImageProfiles.restore();
                    stubCategories.restore();
                    stubAssets.restore();
                    stubLayouts.restore();
                    stubTypes.restore();
                    stubLayoutMappings.restore();
                    stubContent.restore();
                    stubDefaultContent.restore();
                    stubPages.restore();

                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                });
        });

        it("should fail when a helper deleteRemoteItems fails - continueOnError false", function (done) {
            const api = new ToolsApi({eventEmitter: new events.EventEmitter(), continueOnError: false});
            const context = api.getContext();
            const DELETE_ERROR = "Delete failure, expected by unit test.";

            const stubRemoteSites = sinon.stub(ToolsApi.getSitesHelper(), "getRemoteItems");
            stubRemoteSites.resolves([{id: "bar", status: "draft"}, {id: "foo", status: "ready"}]);
            const stubImageProfiles = sinon.stub(ToolsApi.getImageProfilesHelper(), "deleteRemoteItems", function () {
                context.eventEmitter.emit("deleted", "imageProfile1");
                context.eventEmitter.emit("deleted", "imageProfile2");
                return Q();
            });
            const stubCategories = sinon.stub(ToolsApi.getCategoriesHelper(), "deleteRemoteItems", function () {
                context.eventEmitter.emit("deleted", "category1");
                context.eventEmitter.emit("deleted", "category2");
                return Q();
            });
            const stubAssets = sinon.stub(ToolsApi.getAssetsHelper(), "deleteRemoteItems", function () {
                context.eventEmitter.emit("deleted", "asset1");
                context.eventEmitter.emit("deleted", "asset2");
                return Q();
            });
            const stubLayouts = sinon.stub(ToolsApi.getLayoutsHelper(), "deleteRemoteItems");
            stubLayouts.rejects(new Error(DELETE_ERROR));
            const stubTypes = sinon.stub(ToolsApi.getItemTypeHelper(), "deleteRemoteItems");
            stubTypes.resolves(undefined);
            const stubLayoutMappings = sinon.stub(ToolsApi.getLayoutMappingsHelper(), "deleteRemoteItems");
            stubLayoutMappings.resolves(undefined);
            const stubContent = sinon.stub(ToolsApi.getContentHelper(), "deleteRemoteItems");
            stubContent.resolves(undefined);
            const stubDefaultContent = sinon.stub(ToolsApi.getDefaultContentHelper(), "deleteRemoteItems");
            stubDefaultContent.resolves(undefined);
            const stubPages = sinon.stub(ToolsApi.getPagesHelper(), "deleteRemoteItems");
            stubPages.resolves(undefined);

            // Call the method being tested.
            let error;
            api.deleteAllItems()
                .then(function () {
                    // This is not expected. Pass the error to the "done" function to indicate a failed test.
                    error = new Error("The promise for deleting all items should have been rejected.");
                })
                .catch (function (err) {
                    // Verify that the expected error is returned.
                    expect(err.message).to.contain(DELETE_ERROR);

                    // Verify that the stubs were called as expected.
                    expect(stubPages).to.have.been.calledTwice;
                    expect(stubContent).to.have.been.calledOnce;
                    expect(stubDefaultContent).to.have.been.calledOnce;
                    expect(stubLayoutMappings).to.have.been.calledOnce;
                    expect(stubTypes).to.have.been.calledOnce;
                    expect(stubLayouts).to.have.been.calledOnce;
                    expect(stubAssets).to.not.have.been.called;
                    expect(stubCategories).to.not.have.been.called;
                    expect(stubImageProfiles).to.not.have.been.called;
                })
                .catch (function (err) {
                    // NOTE: A failed expectation from above will be handled here.
                    // Pass the error to the "done" function to indicate a failed test.
                    error = err;
                })
                .finally(function () {
                    // The stubs should be restored when the test is complete.
                    stubRemoteSites.restore();
                    stubImageProfiles.restore();
                    stubCategories.restore();
                    stubAssets.restore();
                    stubLayouts.restore();
                    stubTypes.restore();
                    stubLayoutMappings.restore();
                    stubContent.restore();
                    stubDefaultContent.restore();
                    stubPages.restore();

                    // Call mocha's done function to indicate that the test is over.
                    done(error);
                });
        });
    });
});
