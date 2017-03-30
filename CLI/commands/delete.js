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

const BaseCommand = require("../lib/baseCommand");

const toolsApi = require("wchtools-api");
const utils = toolsApi.utils;
const login = toolsApi.login;
const i18n = utils.getI18N(__dirname, ".json", "en");

class DeleteCommand extends BaseCommand {
    /**
     * Create a DeleteCommand object.
     *
     * @param {object} program A Commander program object.
     */
    constructor (program) {
        super(program);
    }

    /**
     * Delete the named item.
     */
    doDelete () {
        // Handle the necessary command line options.
        const named = this.getCommandLineOption("named");
        if (named) {
            if (this.getCommandLineOption("webassets")) {
                const self = this;

                // Make sure the url option has been specified.
                self.handleUrlOption()
                    .then(function () {
                        // Make sure the user name and password have been specified.
                        return self.handleAuthenticationOptions();
                    })
                    .then(function () {
                        // Login using the current options.
                        return login.login(self.getApiOptions());
                    })
                    .then(function () {
                        const logger = self.getLogger();
                        logger.info(i18n.__("cli_deleting_web_asset", {"path": named}));

                        // Delete the web asset using the API.
                        const helper = toolsApi.getAssetsHelper(self.getApiOptions());
                        self.setApiOption(helper.ASSET_TYPES, helper.ASSET_TYPES_WEB_ASSETS);
                        return helper.deleteRemoteItem(named, self.getApiOptions());
                    })
                    .then(function (result) {
                        const logger = self.getLogger();
                        logger.info(result);

                        self.successMessage(i18n.__('cli_delete_success', {name: named}));
                    })
                    .catch(function (err) {
                        const logger = self.getLogger();
                        logger.error(i18n.__("cli_delete_failure", {"err": err.toString()}));
                        self.errorMessage(err.message);
                    })
                    .finally(function () {
                        self.resetCommandLineOptions();
                    });
            } else {
                this.errorMessage(i18n.__('cli_delete_webAsset'));
                this.resetCommandLineOptions();
            }
        } else {
            this.errorMessage(i18n.__('cli_delete_named'));
            this.resetCommandLineOptions();
        }
    }

    /**
     * Reset the command line options for this command.
     *
     * NOTE: This is used to reset the values when the command is invoked by the mocha testing. Normally the Commander
     * process ends after the command is executed and so these values go away. But when running the tests, the process
     * isn't terminated and these values need to be reset.
     */
    resetCommandLineOptions () {
        this.setCommandLineOption("webassets", undefined);
        this.setCommandLineOption("named", undefined);

        super.resetCommandLineOptions();
    }
}

function deleteCommand (program) {
    program
        .command('delete')
        .description(i18n.__('cli_delete_description'))
        .option('-w --webassets',        i18n.__('cli_delete_opt_web_assets'))
        .option('-v --verbose',          i18n.__('cli_opt_verbose'))
        .option('--named <path>',        i18n.__('cli_delete_opt_named'))
        .option('--user <user>',         i18n.__('cli_opt_user_name'))
        .option('--password <password>', i18n.__('cli_opt_password'))
        .option('--url <url>',           i18n.__('cli_opt_url', {"product_name": utils.ProductName}))
        .action(function (options) {
            const command = new DeleteCommand(program);
            if (command.setCommandLineOptions(options, this)) {
                command.doDelete();
            }
        });
}

module.exports = deleteCommand;
