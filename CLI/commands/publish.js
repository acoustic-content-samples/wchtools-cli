/*
Copyright IBM Corporation 2016, 2017, 2018

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

class PublishCommand extends BaseCommand {
    /**
     * Create a PublishCommand object.
     *
     * @param {object} program A Commander program object.
     */
    constructor (program) {
        super(program);
    }

    displaySiteRevisionStatus(helper, context, opts) {
        const self = this;
        const logger = this.getLogger();
        const verbose = self.getCommandLineOption("verbose");
        ToolsApi.getPublishingSiteRevisionsHelper().getRemoteItem(context, "default", opts)
            .then(function (siteRevision) {
                const msg = i18n.__("cli_publishing_site_revision_state", {state: siteRevision.state});
                self.successMessage(msg);
                if (verbose) {
                    logger.info(i18n.__("cli_publishing_site_revision", {site_revision: JSON.stringify(siteRevision, null, "    ")}));
                }
                self.resetCommandLineOptions();
            })
            .catch(function (err) {
                const curError = i18n.__("cli_publishing_site_revision_error", {message: err.message});
                self.errorMessage(curError);
                self.resetCommandLineOptions();
            });
    }

    /**
     * Create a new publishing job, or look up the status of the publishing site revision.
     */
    doPublish () {
        // Create the context for publishing.
        const toolsApi = new ToolsApi();
        const context = toolsApi.getContext();

        const logger = this.getLogger();
        const mode = this.getCommandLineOption("rebuild") ? "REBUILD" : "UPDATE";
        const status = this.getCommandLineOption("status");
        const apiOptions = this.getApiOptions();
        const jobParameters = {"mode": mode};
        const helper = ToolsApi.getPublishingJobsHelper();
        const self = this;

        // Make sure the url option has been specified.
        self.handleUrlOption(context)
            .then(function () {
                // Handle the necessary command line options.
                return self.handleAuthenticationOptions(context);
            })
            .then(function () {
                // Login using the current options.
                return loginHelper.login(context, apiOptions);
            })
            .then(function () {
                // Check to see if the initialization process was successful.
                return self.handleInitialization(context);
            })
            .then(function (/*results*/) {
                if (status) {
                    self.displaySiteRevisionStatus(helper, context, apiOptions);
                } else {
                    BaseCommand.displayToConsole(i18n.__('cli_publishing_job_starting'));
                    self.spinner = self.getProgram().getSpinner();
                    self.spinner.start();
                    return helper.createPublishingJob(context, jobParameters, apiOptions)
                        .then(job => {
                            self.spinner.stop();
                            const startedMsg = i18n.__('cli_publishing_job_started');
                            self.successMessage(startedMsg);
                            if (self.getCommandLineOption("verbose")) {
                                logger.info(i18n.__("cli_publishing_job_details", {job_details: JSON.stringify(job, null, "    ")}));
                            }
                        })
                        .catch(err => {
                            const curError = i18n.__("cli_publishing_job_error", {message: err.message});
                            self.spinner.stop();
                            self.errorMessage(curError);
                        });
                }
            })
            .catch(err => {
                self.errorMessage(i18n.__("cli_publishing_job_error", {message: err.message}));
            })
            .finally(() =>{
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
        this.setCommandLineOption("status", undefined);
        super.resetCommandLineOptions();
    }
}

function publishCommand (program) {
    program
        .command('publish')
        .description(i18n.__('cli_publishing_description'))
        .option('-v --verbose',          i18n.__('cli_opt_verbose'))
        .option('-r --rebuild',          i18n.__('cli_publishing_opt_rebuild'))
        .option('--status [id]',         i18n.__('cli_publishing_opt_status'))
        .option('--user <user>',         i18n.__('cli_opt_user_name'))
        .option('--password <password>', i18n.__('cli_opt_password'))
        .option('--url <url>',           i18n.__('cli_opt_url', {"product_name": utils.ProductName}))
        .action(function (commandLineOptions) {
            const command = new PublishCommand(program);
            if (command.setCommandLineOptions(commandLineOptions, this)) {
                command.doPublish();
            }
        });
}

module.exports = publishCommand;
