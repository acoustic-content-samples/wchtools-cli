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
var child_process = require('child_process');
child_process.execSync('node ./node_modules/rimraf/bin.js ./authoring-api/node_modules', { encoding: 'utf8'});
child_process.execSync('node ./node_modules/rimraf/bin.js ./CLI/node_modules', { encoding: 'utf8'});
child_process.execSync('node ./node_modules/rimraf/bin.js ./node_modules/log4js', { encoding: 'utf8'});
process.exit();
