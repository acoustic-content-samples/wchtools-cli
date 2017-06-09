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

const itemTypesHelper = require('./itemTypesHelper').instance;
const assetsHelper = require('./assetsHelper.js').instance;
const contentHelper = require('./contentHelper').instance;
const categoriesHelper = require('./categoriesHelper').instance;
const publishingJobsHelper = require('./publishingJobsHelper').instance;
const publishingSourcesHelper = require('./publishingSourcesHelper').instance;
const publishingProfilesHelper = require('./publishingProfilesHelper').instance;
const publishingSiteRevisionsHelper = require('./publishingSiteRevisionsHelper').instance;
const renditionssHelper = require('./renditionsHelper').instance;
const imageProfilesHelper = require('./imageProfilesHelper').instance;
const login = require('./lib/loginREST').instance;
const utils = require('./lib/utils/utils.js');
const options = require('./lib/utils/options.js');

module.exports.getItemTypeHelper = function (options) {
    itemTypesHelper.initGlobalOptions(options);
    return itemTypesHelper;
};

module.exports.getAssetsHelper = function (options){
    assetsHelper.initGlobalOptions(options);
    return assetsHelper;
};

module.exports.getImageProfilesHelper = function (options){
    imageProfilesHelper.initGlobalOptions(options);
    return imageProfilesHelper;
};

module.exports.getRenditionsHelper = function (options){
    renditionssHelper.initGlobalOptions(options);
    return renditionssHelper;
};

module.exports.getContentHelper = function (options) {
    contentHelper.initGlobalOptions(options);
    return contentHelper;
};

module.exports.getCategoriesHelper = function (options) {
    categoriesHelper.initGlobalOptions(options);
    return categoriesHelper;
};

module.exports.getPublishingJobsHelper = function (options) {
    publishingJobsHelper.initGlobalOptions(options);
    return publishingJobsHelper;
};

module.exports.getPublishingSourcesHelper = function (options) {
    publishingSourcesHelper.initGlobalOptions(options);
    return publishingSourcesHelper;
};

module.exports.getPublishingProfilesHelper = function (options) {
    publishingProfilesHelper.initGlobalOptions(options);
    return publishingProfilesHelper;
};

module.exports.getPublishingSiteRevisionsHelper = function (options) {
    publishingSiteRevisionsHelper.initGlobalOptions(options);
    return publishingSiteRevisionsHelper;
};

module.exports.getInitializationErrors = function () {
    // Return any errors that occurred during initialization of the required modules.
    return options.getInitializationErrors();
};

module.exports.login = login;
module.exports.utils = utils;
module.exports.options = options;
