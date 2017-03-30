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

const fs = require('fs');
const path = require('path');
const utils = require("wchtools-api").utils;

function getPlugins () {
    // Loop though command files
    const plugins = [];
    const pluginDir = utils.getUserHome() + path.sep +  utils.ProductName + path.sep + "cli" +  path.sep + "plugins";
    if (fs.existsSync(pluginDir)) {
        fs.readdirSync(pluginDir)
            .forEach(function (filename) {
                if (fs.lstatSync(pluginDir + '/' + filename).isDirectory() &&
                    fs.existsSync(pluginDir + '/' + filename + '/plugin.json')) {
                    const plugin  = fs.readFileSync(pluginDir + '/' + filename + '/plugin.json');
                    const lPath = JSON.parse(plugin).loadPath;
                    plugins.push(lPath);
                }
            });
    }
    return plugins;
}

function commandLoader (program) {
    var commands = {};
    var loadPath = path.dirname(__filename);

    // Loop though command files
    fs.readdirSync(loadPath).filter(function (filename) {
        return (/\.js$/.test(filename) && filename !== 'index.js');
    })
        .forEach(function (filename) {
            var name = filename.substr(0, filename.lastIndexOf('.'));

            // Require command
	        var command = require(path.join(loadPath, filename));

	        // Initialize command
    	    commands[name] = command(program);
    	});

    const plugins = getPlugins();
    plugins.forEach(function (loadPath) {
        if (fs.existsSync(loadPath)) {
            fs.readdirSync(loadPath)
                .filter(function (filename) {
                    return (/\.js$/.test(filename) && filename !== 'index.js');
                })
				.forEach(function (filename) {
                    var name = filename.substr(0, filename.lastIndexOf('.'));

	                // Require command
    	            var command = require(path.join(loadPath, filename));
        	        // Initialize command
            	    commands[name] = command(program);
            	});
        }
    });

    return commands;
}

module.exports = commandLoader;
