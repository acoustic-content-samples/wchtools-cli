/*
Copyright IBM Corporation 2016, 2017

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

const ToolsApi = require("wchtools-api");
const loginHelper = ToolsApi.getLogin();
const utils = ToolsApi.getUtils();
const i18n = utils.getI18N(__dirname, ".json", "en");
const ora = require("ora");

const jobParameters =  {
    "mode":"UPDATE",
    "jobDefinition": {
        "profile": {
            "enableRendering":         true,
            "enableContentPublishing": false,
            "enableAssetPublishing":   false,
            "enableAssetIndexing": false,
            "enableContentIndexing": false,
            "enableCategoryIndexing": false
        }
    }
};

class RenderCommand extends BaseCommand {
    /**
     * Create a RenderCommand object.
     *
     * @param {object} program A Commander program object.
     */
    constructor (program) {
        super(program);
    }

    /**
     * Create a new rendering job.
     */
    doRender () {
        // Create the context for rendering.
        const toolsApi = new ToolsApi();
        const context = toolsApi.getContext();

        const logger = this.getLogger();
        jobParameters.mode = this.getCommandLineOption("rebuild") ? "REBUILD" : "UPDATE";
        const helper = ToolsApi.getPublishingJobsHelper();
        const self = this;

        // Check to see if the initialization process was successful.
        if (!self.handleInitialization(context)) {
            return;
        }

        // Make sure the url option has been specified.
        self.handleUrlOption(context)
            .then(function () {
                // Handle the necessary command line options.
                return self.handleAuthenticationOptions(context);
            })
            .then(function () {
                // Login using the current options.
                return loginHelper.login(context, self.getApiOptions());
            })
            .then(function (/*results*/) {
                BaseCommand.displayToConsole(i18n.__('cli_rendering_job_started'));
                self.spinner = ora();
                self.spinner.start();
                return helper.createPublishingJob(context, jobParameters, self.getApiOptions())
                    .then(job => {
                        const createIdMsg = i18n.__('cli_rendering_job_created', {id: job.id});
                        self.spinner.stop();
                        self.successMessage(createIdMsg);
                        if (self.getCommandLineOption("verbose")) {
                            logger.info(i18n.__("cli_publishing_job_details", {job_details: JSON.stringify(job, null, "    ")}));
                        }
                        self.resetCommandLineOptions();
                    })
                    .catch(err => {
                        self.spinner.stop();
                        throw(err);
                    });
            })
            .catch(err => {
                const curError = i18n.__("cli_publishing_job_error", {message: err.message});
                self.errorMessage(curError);
                self.resetCommandLineOptions();
            });
    }

    /**
     * Reset the command line options for this command.
     *
     * NOTE: This is used to reset the values when the command is invoked by the mocha testing. Normally the process
     * ends after the command is executed and so these values go away. But when running the tests, the process isn't
     * terminated and these values need to be reset.
     */
    resetCommandLineOptions () {
        this.setCommandLineOption("rebuild", undefined);
        super.resetCommandLineOptions();
    }
}

function renderCommand (program) {
    program
        .command('render')
        .description(i18n.__('cli_rendering_description'))
        .option('-v --verbose',          i18n.__('cli_opt_verbose'))
        .option('-r --rebuild',          i18n.__('cli_publishing_opt_rebuild'))
        .option('--user <user>',         i18n.__('cli_opt_user_name'))
        .option('--password <password>', i18n.__('cli_opt_password'))
        .option('--url <url>',           i18n.__('cli_opt_url', {"product_name": utils.ProductName}))
        .action(function (commandLineOptions) {
            const command = new RenderCommand(program);
            if (command.setCommandLineOptions(commandLineOptions, this)) {
                command.doRender();
            }
        });
}

module.exports = renderCommand;
