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
var Table = require('cli-table');

module.exports = function helloCommand(program) {
	'use strict';

	program
		.command('quote <symbol>')
		.description('Get stock quote for <symbol>')
		.action(function (symbol, command) {

			var opts = {};

			var dataKeys = {
				s: 'Symbol',
				n: 'Name',
				a: 'Ask',
				b: 'Bid',
				w: '52 week Range',
				v: 'Volume',
				e: 'Earnings / Share',
				j1: 'Market Capitalization'
			};

			opts.uri = 'http://finance.yahoo.com/d/quotes.csv?s=' + symbol.toUpperCase() + '&f=' + Object.keys(dataKeys).join('');
			opts.encodeing = 'utf8';

			process.stdout.write('Fetching [' + symbol + '] ');

			program.request(opts, function (err, req, body) {
				var rows;
				if (err) {
					return program.handleError(err);
				}
				body = body.replace(/\r\n$/, '');
				rows = body.split('\r\n');

				var table = new Table({
					head: Object.keys(dataKeys).map(function (key) {
						return dataKeys[key];
					})
				});

				rows.forEach(function (row) {
					var parts = row.split(',').map(function (cell) {
						return cell.replace(/\"/g, '');
					});
					table.push(parts);
				});
				program.successMessage(table.toString());
			});

		});

};
