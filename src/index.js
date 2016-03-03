#!/usr/bin/env node
/**
 * Make cURL requests to a Skylark endpoint.
 * Automatically signs requests with the provided HMAC token, and fills in other headers as necessary.
 * In particular: adds the X-Swift-Date header, and Authorization header, given a token and secret.
 *
 * Use this exactly like you would use curl, but pass `--token x` and `--secret y` arguments as well.
 * That should be your HMAC token and secret.
 *
 * Author: Joshua Gross
 * Copyright: 2016 Swift Navigation
 * License: MIT
 */
var hmacSHA512 = require('./sha512');
var exec = require('child_process').exec;
var util = require('util');
var moment = require('moment');
var url = require('url');

// Get raw arguments
var curlArgs = process.argv.splice(2);

// Extract token, secret
var token = "";
var secret = "";
for (var i in curlArgs) {
  var arg = curlArgs[i];
  if (arg === '--token') {
    token = curlArgs[parseInt(i) + 1];
    curlArgs.splice(i, 2);
    break;
  }
}
for (var i in curlArgs) {
  var arg = curlArgs[i];
  if (arg === '--secret') {
    secret = curlArgs[parseInt(i) + 1];
    curlArgs.splice(i, 2);
    break;
  }
}

// Add date header
var now = moment().utc().format("YYYY-MM-DDTHH:mm:ssZZ");
curlArgs.push('-H');
curlArgs.push('X-Swift-Date: ' + now);

// Canonicalize headers
var swiftHeaders = [];
for (var i in curlArgs) {
  var arg = curlArgs[i];
  if (arg === '-H') {
    var headerValue = curlArgs[parseInt(i) + 1].split(' ');
    if ((headerValue[0] || '').toLowerCase().indexOf('x-swift') === 0) {
      swiftHeaders.push(headerValue[0].toLowerCase() + headerValue.splice(1).join(' '));
    }
  }
}

var canonicalSwiftHeaders = swiftHeaders.sort(function (a, b) {
  var aName = a.split(' ')[0] || a;
  var bName = b.split(' ')[0] || b;
  return aName.localeCompare(bName);
}).join('\n');

// Get URI
var uri = curlArgs.filter(function (arg) {
  return arg.toLowerCase().indexOf('http') === 0;
})[0];
var parsedUri = url.parse(uri);

// Canonicalize query string
var canonicalizedQuery = '?' + parsedUri.query.split('&').sort(function (a, b) {
  var aName = a.split('=')[0] || a;
  var bName = b.split('=')[0] || b;
  return aName.localeCompare(bName);
}).join('&');

// Get request method
var method = "GET";
for (var i in curlArgs) {
  var arg = curlArgs[i];
  if (arg === '-X') {
    method = curlArgs[parseInt(i) + 1];
  }
}

// TODO: put port on a separate line
var path = parsedUri.pathname;
var host = parsedUri.hostname;
var port = parsedUri.port;
var query = canonicalizedQuery;
var digest = method + "\n" + path + "\n" + host + ':' + port + "\n" + query + "\n" + canonicalSwiftHeaders + "\n";

// Create auth header
var signature = hmacSHA512(secret, digest);
curlArgs.push('-H');
curlArgs.push('Authorization: SWIFT-PRF-HMAC-SHA-512 ' + token + ':' + signature);

// Dispatch curl command
var curl = exec('curl ' + curlArgs.map(escapeShell).join(' '));
curl.stdout.pipe(process.stdout);
curl.stderr.pipe(process.stderr);

curl.on('exit', function (code) {
  process.exit(code);
});

function escapeShell (cmd) {
  if (cmd.indexOf(' ') !== -1 || cmd.indexOf('&') !== -1) {
    return '"'+cmd.replace(/(["'$`\\])/g,'\\$1')+'"';
  }
  return cmd;
}
