#!/usr/bin/env node
/**
 * Make cURL requests to a Skylark endpoint.
 * Automatically signs requests with the provided HMAC token, and fills in other headers as necessary.
 * In particular: adds the X-Swift-Date header, and Authorization header, given a token and secret.
 *
 * See README for usage.
 *
 * Author: Joshua Gross
 * Copyright: 2016 Swift Navigation
 * License: MIT
 */
const lib = require('./lib');

function main() {
  const argPair = lib.parseArgs(process.argv.slice(2));
  const parsedArgs = argPair[0];
  const passthrough = argPair[1];

  // Extract token, secret
  var uri = parsedArgs['uri'] || lib.die('need --uri');
  var token = parsedArgs['token'];
  var secret = parsedArgs['secret'];
  var time = parsedArgs['time'] || lib.now();

  const signPair = lib.sign(uri, token, secret, time, passthrough);
  const authorization = signPair[0];
  const curlCommand = signPair[1];

  console.log(curlCommand);

  lib.execAndExit(curlCommand);
}

main();
