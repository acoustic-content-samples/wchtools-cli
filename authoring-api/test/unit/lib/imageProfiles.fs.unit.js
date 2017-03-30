/**
 * Unit tests for the imageProfiles FS  object.
 */
"use strict";

// Require the super classes for this class.
const UnitTest = require("./base.unit.js");
const ImageProfilesUnitTest = require("./imageProfiles.unit.js");
const BaseFsUnit = require("./base.fs.unit.js");

// Require the local module being tested.
const fsApi = require(UnitTest.API_PATH + "lib/imageProfilesFS.js").instance;

class ImageProfilesFsUnitTest extends BaseFsUnit {
    constructor() {
        super();
    }
    run() {
        super.run(fsApi, "imageProfilesFS", ImageProfilesUnitTest.VALID_IMAGE_PROFILE_1, ImageProfilesUnitTest.VALID_IMAGE_PROFILE_2 );
    }
}

module.exports = ImageProfilesFsUnitTest;
