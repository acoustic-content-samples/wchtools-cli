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

const JSONItemFS = require("./JSONItemFS.js");
const fs = require("fs");
const Q = require("q");
const utils = require("./utils/utils.js");
const i18n = utils.getI18N(__dirname, ".json", "en");

const singleton = Symbol();
const singletonEnforcer = Symbol();

class PresentationsFS extends JSONItemFS {

    constructor(enforcer) {
        if (enforcer !== singletonEnforcer)
            throw i18n.__("singleton_construct_error", {classname: "PresentationsFS"});

        super("presentations", "presentations", "_pmd.json");
    }

    static get instance() {
        if (!this[singleton]) {
            this[singleton] = new PresentationsFS(singletonEnforcer);
        }
        return this[singleton];
    }

    /**
     * creates a new presentation with the given name in the local filesystem
     */
    newItem(presentation, opts) {
        const fsObject = this;
        const deferred = Q.defer();
        if (!presentation || !presentation.name || !presentation.name.length) {
            deferred.reject(new Error(i18n.__("name_required")));
        } else if (!presentation || !presentation.template || !presentation.template.length) {
            deferred.reject(new Error(i18n.__("template_required")));
        } else {
            // use fs.stats since fs.exists was deprecated
            fs.stat(this.getItemPath(presentation, opts), function(err, stat) {
                if (stat) {
                    deferred.reject(new Error(i18n.__("presentation_exists", {name: presentation.name})));
                } else {
                    fsObject.saveItem(presentation, opts).then(function(presentation) {
                        deferred.resolve(presentation);
                    }, function(err) {
                        deferred.reject(err);
                    });
                }
            });
        }
        return deferred.promise;
    }

}

module.exports = PresentationsFS;
