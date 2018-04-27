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
 * Base class for assets unit tests.
 */
"use strict";

const UnitTest = require("./base.unit.js");

const stream = require("stream");

class AssetsUnitTest extends UnitTest {
    // Create a stream that can be used for testing when no data is required.
    static get API_PATH () { return UnitTest.API_PATH; };
    static get VALID_RESOURCES_DIRECTORY () { return UnitTest.VALID_RESOURCES_DIRECTORY; };
    static get VALID_WORKING_DIRECTORY () { return this.API_PATH + this.VALID_RESOURCES_DIRECTORY; };
    static get DUMMY_STREAM () { return new stream.Readable(); };
    static get DUMMY_WRITE_STREAM () { return new stream.Writable(); };
    static get DUMMY_PASS_STREAM () { return new stream.PassThrough(); };

    // File and directory constants used by all assets unit tests.
    static get ASSETS_DIRECTORY() { return "assets"; };
    static get METADATA_DIRECTORY() { return "/.metadata"; };
    static get VALID_ASSETS_DIRECTORY() { return this.VALID_RESOURCES_DIRECTORY + this.ASSETS_DIRECTORY; };
    static get INVALID_ASSETS_DIRECTORY() { return this.INVALID_RESOURCES_DIRECTORY + this.ASSETS_DIRECTORY; };
    static get VALID_ASSETS_METADATA_DIRECTORY() { return this.API_PATH + this.VALID_ASSETS_DIRECTORY + this.METADATA_DIRECTORY; };
    static get VALID_CONTENT_ASSETS_METADATA_DIRECTORY() { return this.API_PATH + this.VALID_ASSETS_DIRECTORY; };
    static get INVALID_ASSETS_METADATA_DIRECTORY() { return this.API_PATH + this.INVALID_ASSETS_DIRECTORY + this.METADATA_DIRECTORY; };

    // Path values for test content assets.
    static get ASSET_CONTENT_JPG_1() { return "/dxdam/87/87268612-232e-4554-922d-d49e9b2deee7/MB1FishingHoleSunset.jpg"; };
    static get ASSET_CONTENT_JPG_1_DRAFT() { return "/dxdam/87/87268612-232e-4554-922d-d49e9b2deee7/MB1FishingHoleSunset_wchdraft.jpg"; };
    static get ASSET_CONTENT_JPG_2() { return "/dxdam/94/94a5f59a-e52e-44a7-a0b3-fe6470bf7dae/MB1OceanClouds.jpg"; };
    static get ASSET_CONTENT_JPG_2_DRAFT() { return "/dxdam/94/94a5f59a-e52e-44a7-a0b3-fe6470bf7dae/MB1OceanClouds_wchdraft.jpg"; };
    static get ASSET_CONTENT_JPG_3() { return "/dxdam/db/db31d977-ed0e-4995-92b9-6d8c7c104f43/MBImpossibleCompositeSunset.jpg"; };
    static get ASSET_CONTENT_JPG_3_DRAFT() { return "/dxdam/db/db31d977-ed0e-4995-92b9-6d8c7c104f43/MBImpossibleCompositeSunset_wchdraft.jpg"; };
    static get ASSET_CONTENT_JPG_4() { return "/dxdam/f1/f18b7033-108f-47d3-869b-b3d98ed18f83/MB1SmallsFallsME.jpg"; };
    static get ASSET_CONTENT_JPG_4_DRAFT() { return "/dxdam/f1/f18b7033-108f-47d3-869b-b3d98ed18f83/MB1SmallsFallsME_wchdraft.jpg"; };

    // Path values for test assets.
    static get ASSET_HTML_1() { return "/test_1/contact.html"; };
    static get ASSET_HTML_2() { return "/test_1/index.html"; };
    static get ASSET_HTML_3() { return "/test_2/hello.html"; };
    static get ASSET_CSS_1() { return "/test_1/iecss.css"; };
    static get ASSET_CSS_2() { return "/test_1/style.css"; };
    static get ASSET_JPG_1() { return "/test_1/images/banner1.jpg"; };
    static get ASSET_JPG_2() { return "/test_1/images/banner2.jpg"; };
    static get ASSET_JPG_3() { return "/test_1/images/banner3.jpg"; };
    static get ASSET_PNG_1() { return "/test_1/images/logo.png"; };
    static get ASSET_PNG_2() { return "/test_1/images/shoppingcart.png"; };
    static get ASSET_PNG_3() { return "/test_3/screenshot.png"; };
    static get ASSET_GIF_1() { return "/test_1/images/payment.gif"; };
    static get ASSET_HBS_1() { return "/test.hbs"; };
    static get ASSET_HBS_2() { return "/test2.hbs"; };
    static get ASSET_JAR_1() { return "/test.jar"; };
    static get ASSET_INVALID_PATH_1() { return "/test.no.path"; };
    static get ASSET_INVALID_PATH_2() { return "/test.bad.path"; };
    static get ASSET_INVALID_PATH_3() { return "/test.http.path"; };
    static get ASSET_INVALID_PATH_4() { return "/test.https.path"; };

    constructor () {
        super();
    }
}

module.exports = AssetsUnitTest;
