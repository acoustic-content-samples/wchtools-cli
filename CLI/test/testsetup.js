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
const path = require("path");
const fs = require("fs");
const cp = require('cp');
const utils = require("wchtools-api").getUtils();

const loadPath = path.dirname(__filename);
const cDir = path.normalize(loadPath + path.sep + '../commands');
cp.sync(loadPath + '/copycommand/quote.js', cDir + '/quote.js');
const dest = utils.getUserHome() + path.sep +  utils.ProductName + path.sep + "cli" +  path.sep + "plugins/hello";
try {
    fs.mkdirSync(utils.getUserHome() + path.sep + utils.ProductName);
} catch (e) {
    // Ignore and keep going.
}
try {
    fs.mkdirSync(utils.getUserHome() + path.sep + utils.ProductName +  path.sep + "cli");
} catch (e) {
    // Ignore and keep going.
}
try {
    fs.mkdirSync(utils.getUserHome() + path.sep +  utils.ProductName +  path.sep + "cli" +  path.sep + "plugins");
} catch (e) {
    // Ignore and keep going.
}
try {
    fs.mkdirSync(dest);
} catch (e) {
    // Ignore and keep going.
}
const ndest = dest.split('\\').join('/');
fs.writeFileSync(dest + "/plugin.json",'{"name": "hello", "loadPath": "' + ndest + '"}');
cp.sync(loadPath + '/copycommand/hello.js', dest + '/hello.js');
