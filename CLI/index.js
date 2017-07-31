/*
Copyright IBM Corporation 2017

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

const program = require('./wchToolsCli').program;
const ToolsApi = require("wchtools-api");
const utils = ToolsApi.getUtils();
const i18n = utils.getI18N(__dirname, ".json", "en");
const updateNotifier = require('update-notifier');
const pkg = require('./package.json');

// The English versions of the localized strings. These are used to find localizable strings that are being displayed in
// English. This object (containing localizable strings) will only be initialized if the current locale is not English.
let english;

// Force localization for any strings that Commander has hard-wired into the help output.
const forcedLocalization = function (helpText) {
    // Only force the localization if the current locale is not English.
    if (i18n.getLocale() !== "en") {
        // Read the English strings if they have not already been read.
        if (!english) {
            //noinspection JSUnresolvedFunction
            english = require(i18n.locateFile("en"));
        }

        // Replace the usage label.
        const usage = english["cli_help_usage"];
        const localizedUsage = i18n.__("cli_help_usage");
        helpText = utils.replaceAll(helpText, usage, localizedUsage);

        // Replace the command placeholder.
        const commandPlaceholder = english["cli_help_command_placeholder"];
        const localizedCommandPlaceholder = i18n.__("cli_help_command_placeholder");
        helpText = utils.replaceAll(helpText, commandPlaceholder, localizedCommandPlaceholder);

        // Replace all occurrences of the options placeholder.
        const optionsPlaceholder = english["cli_help_options_placeholder"];
        const localizedOptionsPlaceholder = i18n.__("cli_help_options_placeholder");
        helpText = utils.replaceAll(helpText, optionsPlaceholder, localizedOptionsPlaceholder);

        // Replace the commands label.
        const commands = english["cli_help_commands"];
        const localizedCommands = i18n.__("cli_help_commands");
        helpText = utils.replaceAll(helpText, commands, localizedCommands);

        // Replace the options label.
        const options = english["cli_help_options"];
        const localizedOptions = i18n.__("cli_help_options");
        helpText = utils.replaceAll(helpText, options, localizedOptions);

        // Replace the text for the help option.
        const helpOptionText = english["cli_help_usage_info"];
        const localizedHelpOptionText = i18n.__("cli_help_usage_info");
        helpText = utils.replaceAll(helpText, helpOptionText, localizedHelpOptionText);

        // Replace the text for the version option.
        const versionOptionText = english["cli_help_version_number"];
        const localizedVersionOptionText = i18n.__("cli_help_version_number");
        helpText = utils.replaceAll(helpText, versionOptionText, localizedVersionOptionText);
    }

    return helpText;
};

// Get the localized help for wchtools.
const getLocalizedProgramHelp = function (helpText) {
    const helpOnCommands = i18n.__('cli_help_on_commands');
    return "\n  " + helpOnCommands + "\n\n  " + forcedLocalization(helpText);
};

// Get the localized help for a specific command.
const getLocalizedCommandHelp = function (helpText) {
    return forcedLocalization(helpText);
};

const checkUpdateNotifier = function() {
    // Checks for available update and returns an instance
    const UPDATE_COMMAND = 'npm install -g wchtools-cli';
    const update_command = (process.platform === 'win32') ? UPDATE_COMMAND : 'sudo ' + UPDATE_COMMAND;
    const notifier = updateNotifier({pkg});
    if (notifier.update) {
        const upmsg = i18n.__('cli_update_notifier',
                              {update_command: update_command,
                               current_version: notifier.update.current,
                               new_version: notifier.update.latest});
        notifier.notify({message: upmsg });
    }
};

if (typeof process.env.NO_UPDATE_NOTIFIER === "undefined") {
    checkUpdateNotifier();
}


/************************************************************************************************************
 * outputHelp
 *
 * Embellish the Commander outputHelp function to allow localized strings to be displayed.
 *
 * Note: The default outputHelp function must be overridden on the program object and on all command objects.
 ***********************************************************************************************************/
program.originalOutputHelp = program.outputHelp;
program.outputHelp = function () {
    // Specify a callback function that will return the localized help for wchtools.
    this.originalOutputHelp(getLocalizedProgramHelp);
};

program.commands.forEach(function (command) {
    command.originalOutputHelp = command.outputHelp;
    command.outputHelp = function () {
        // Specify a callback function that will return the localized help for a specific command.
        this.originalOutputHelp(getLocalizedCommandHelp);
    };
});

// A generic function to allow the display of a localized error message.
const displayErrorMessage = function (message) {
    console.error();
    console.error("  " + message);
    console.error();
    process.exit(1);
};

/***********************************************************************************************************************
 * optionMissingArgument
 *
 * Override the Commander optionMissingArgument function to display a localized error message.
 *
 * Note: The default optionMissingArgument function must be overridden on the program object and on all command objects.
 **********************************************************************************************************************/
program.optionMissingArgument = function(option) {
    displayErrorMessage(i18n.__("cli_option_missing_argument", {"option": option.flags}));
};

program.commands.forEach(function (command) {
    command.optionMissingArgument = function (option) {
        displayErrorMessage(i18n.__("cli_option_missing_argument", {"option": option.flags}));
    };
});

/**************************************************************************************************************
 * unknownOption
 *
 * Override the Commander unknownOption function to display a localized error message.
 *
 * Note: The default unknownOption function must be overridden on the program object and on all command objects.
 **************************************************************************************************************/
program.unknownOption = function(flag) {
    displayErrorMessage(i18n.__("cli_unknown_option", {"option": flag}));
};

program.commands.forEach(function (command) {
    command.unknownOption = function (flag) {
        displayErrorMessage(i18n.__("cli_unknown_option", {"option": flag}));
    };
});

// The first process argument is always the path to the node executable. The second process argument is always the file
// being executed, which in this case should be either "bin/wchtools" or "index.js". If no other argument is specified,
// then there is no action to take, so just output the help information.
if (process.argv.length <= 2) {
    // Output the help information.
    program.outputHelp();
} else {
    // Parse the specified arguments to invoke any matching commands.
    program.parse(process.argv);
}
