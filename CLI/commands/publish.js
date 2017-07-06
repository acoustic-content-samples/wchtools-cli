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

const toolsApi = require("wchtools-api");
const loginHelper = toolsApi.login;
const utils = toolsApi.utils;
const i18n = utils.getI18N(__dirname, ".json", "en");
const ora = require("ora");

class PublishCommand extends BaseCommand {
    /**
     * Create a PublishCommand object.
     *
     * @param {object} program A Commander program object.
     */
    constructor (program) {
        super(program);
    }

    displayJobStatus(self, helper, logger, jobId, apiOptions) {
        helper.getPublishingJob(jobId, apiOptions)
            .then(function (job) {
                self.successMessage(i18n.__("cli_publishing_job_status", {job_status: job.state}));
                if (self.getCommandLineOption("verbose")) {
                    helper.getPublishingJobStatus(jobId, apiOptions)
                        .then(function(jobStatus) {
                            job = Object.assign(job, jobStatus);
                            logger.info(i18n.__("cli_publishing_job_details", {job_details: JSON.stringify(job, null, "    ")}));
                        })
                }
                self.resetCommandLineOptions();
            })
            .catch(function (err) {
                const curError = i18n.__("cli_publishing_job_error", {message: err.message});
                self.errorMessage(curError);
                self.resetCommandLineOptions();
            });
    }

    static getJobIdFromStatusOption(self, status, helper) {
        // If status is boolean==true then --status was specified without a job id so lookup most recent job
        if (status === true) {
            const opts = self.getApiOptions();
            opts.limit = 1;
            return helper.getPublishingJobs( opts )
                .then(jobs => { return (jobs ? jobs[0].id : 0) });
        } else {
            return Promise.resolve(status);
        }
    }

    /**
     * Create a new publishing job.
     */
    doPublish () {
        const logger = this.getLogger();
        const mode = this.getCommandLineOption("rebuild") ? "REBUILD" : "UPDATE";
        const status = this.getCommandLineOption("status");
        const jobParameters = {"mode": mode};
        const helper = toolsApi.getPublishingJobsHelper();
        const self = this;

        // Make sure the url option has been specified.
        self.handleUrlOption()
            .then(function () {
                // Handle the necessary command line options.
                return self.handleAuthenticationOptions();
            })
            .then(function () {
                // Login using the current options.
                return loginHelper.login(self.getApiOptions());
            })
            .then(function (/*results*/) {
                if (status) {
                    PublishCommand.getJobIdFromStatusOption(self, status, helper)
                        .then(jobId => {
                            if (jobId && jobId !== 0) {
                                self.displayJobStatus(self, helper, logger, jobId, self.getApiOptions());
                            } else {
                                self.errorMessage(i18n.__('cli_publishing_no_jobs'));
                            }
                        });
                } else {
                    BaseCommand.displayToConsole(i18n.__('cli_publishing_job_started'));
                    self.spinner = ora();
                    self.spinner.start();
                    helper.createPublishingJob(jobParameters, self.getApiOptions())
                        .then(job => {
                            const createIdMsg = i18n.__('cli_publishing_job_created', {id: job.id});
                            if (self.spinner) {
                                self.spinner.stop();
                            }
                            self.successMessage(createIdMsg);
                            if (self.getCommandLineOption("verbose")) {
                                logger.info(i18n.__("cli_publishing_job_details", {job_details: JSON.stringify(job, null, "    ")}));
                            }
                            self.resetCommandLineOptions();
                        })
                        .catch(err => {
                            const curError = i18n.__("cli_publishing_job_error", {message: err.message});
                            if (self.spinner) {
                                self.spinner.stop();
                            }
                            self.errorMessage(curError);
                            self.resetCommandLineOptions();
                        });
                }
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
        .action(function (options) {
            const command = new PublishCommand(program);
            if (command.setCommandLineOptions(options, this)) {
                command.doPublish();
            }
        });
}

module.exports = publishCommand;
