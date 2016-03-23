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

lib.main();
