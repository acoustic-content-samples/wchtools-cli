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
const utils = require("wchtools-api").getUtils();
const rimraf = require("rimraf");

var loadPath = path.dirname(__filename);
var cDir = path.normalize(loadPath + path.sep + '../commands');
var homeDir = utils.getUserHome();
try{
    console.log('quote:' + cDir + '/quote.js');
    if(fs.existsSync( cDir + '/quote.js'))
        fs.unlinkSync( cDir + '/quote.js');
    rimraf.sync(homeDir + path.sep +  utils.ProductName);
}
catch(e){

}
