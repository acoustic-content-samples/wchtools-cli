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

'use strict';

const dxAuthoring = require("dxauthoringapi");
const utils = dxAuthoring.utils;
const options = dxAuthoring.options;
const prompt = require("prompt");
const i18n = utils.getI18N(__dirname, ".json", "en");

/**
 * Get the schema for the prompt data.
 *
 * @returns {{username: {description: string, default: *, required: boolean}}} The schema for the prompt data.
 */
function getInitPromptSchema() {
    let defUser = options.getProperty("username");
    if(defUser === null)
        defUser = "";
    return {
        username: {
            description: i18n.__('cli_init_user_name'),
            default: defUser ,
            required: false
        }
    };
}

function updateOptions(results) {
    const username = options.getProperty("username");
    const changes = {};
    let changed = false;
    if (results.username && results.username !== username) {
        changes.username = results.username;
        changed = true;
    }
    else {
        changes.username = username;
    }
    if (changed) {
        options.setOptions(changes, true);
    }
}
/**
 * Execute the "init" command.
 *
 * @param {object} program A Commander program object.
 */
function initCommand(program) {
    program
        .command('init')
        .description(i18n.__('cli_init_description', {product_name: utils.ProductName}))
        .option('--user <user>',      i18n.__('cli_opt_user_name'))
        .action(function(option) {
            if(!(typeof(option) === 'object')){
                program.errorMessage( i18n.__('cli_opt_invalid', {option: option}));
                return;
            }
            options.resetState();
            const schemaProps = {properties: getInitPromptSchema()};
            if(option.user){
                try{
                    updateOptions({username: option.user});
                    program.successMessage(i18n.__('cli_init_success'));
                }
                catch(e){
                    program.errorMessageSave(i18n.__('cli_init_error', {message: e.toString()}));
                }
            }
            else{
                prompt.message = '';
                prompt.delimiter = ' ';
                prompt.start();
                prompt.get(schemaProps, function(err, results) {
                    if (err) {
                        console.warn(err.message);
                    } else {
                        updateOptions(results);
                        program.successMessage(i18n.__('cli_init_success'));
                    }
                });
            }
        });
}

module.exports = initCommand;
