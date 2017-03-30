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

const BaseREST = require("./BaseREST.js");
const utils = require("./utils/utils.js");
const i18n = utils.getI18N(__dirname, ".json", "en");
const Q = require("q");

const singleton = Symbol();
const singletonEnforcer = Symbol();

class RenditionsREST extends BaseREST {
    constructor (enforcer) {
        if (enforcer !== singletonEnforcer) {
            throw i18n.__("singleton_construct_error", {classname: "RenditionsREST"});
        }

        super("renditions", "/authoring/v1/renditions", undefined, "/views/by-created");
    }

    static get instance () {
        if (!this[singleton]) {
            this[singleton] = new RenditionsREST(singletonEnforcer);
        }
        return this[singleton];
    }

    // renditions cannot be updated they only can be created
    updateItem (item, opts) {
        return this.createItem(item, opts);
    }

    deleteItem (item, opts) {
        return Q.reject(new Error(i18n.__("delete_rendition_error", {"id": item.id, "opts": JSON.stringify(opts ? opts : {})})));
    }

    createItem (item, opts) {
        const cOpts = utils.cloneOpts(opts);

        // Bind the super method so that we can call it later.
        const parentMethod = super.createItem.bind(this);

        // make sure if get item fails we don't log the error we expect it to fail if the item was not created yet
        // renditions never get deleted so getting the item is more likely to work
        // instead of trying to create and have the item fail with a 409 and that being logged as an error
        cOpts.noErrorLog = "true";
        return this.getItem(item.id, cOpts)
            .then(function (item) {
                utils.logDebugInfo('This item already exists: ' + item.id + ' :renditionRest');
                return item;
            })
            .catch(function () {
                return parentMethod(item, opts)
                    .then(function (item) {
                        return item;
                    })
                    .catch(function (err) {
                        throw(err);
                    });
            });
    }
}

module.exports = RenditionsREST;
