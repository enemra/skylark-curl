const exec = require('child_process').exec;
const hmacSHA512 = require('./sha512');
const moment = require('moment');
const url = require('url');

const Lib = function() {};

Lib.prototype.escapeShell = function(cmd) {
  if (cmd.indexOf(' ') !== -1 || cmd.indexOf('&') !== -1) {
    return '"'+cmd.replace(/(["'$`\\])/g,'\\$1')+'"';
  }
  if (cmd === '') {
    return "\"\"";
  }
  return cmd;
}

// Parse ['--foo', 'bar', '--baz', 'quux'] to {'foo': 'bar', 'baz': 'quux'}
Lib.prototype.parsePairs = function(arr) {
  const map = {};
  const n = arr.length;
  var i = 0;

  while (i < n) {
    map[arr[i].slice(2)] = arr[i + 1];
    i += 2;
  }

  return map;
}

// Given args like
// --foo bar --baz quux -- --beep boop
// Returns [{'foo': 'bar', 'baz': 'quux'}, ['--beep', 'boop']]
Lib.prototype.parseArgs = function(args) {
  // Find the passthrough marker
  const split = args.findIndex(s => s == '--');
  // Split into a section to parse and one to passthrough
  const endex = split < 0 ? args.length : split;
  const toParse = args.slice(0, endex);
  const passthrough = args.slice(endex + 1);
  const parsed = this.parsePairs(toParse);
  return [parsed, passthrough];
}

// From ['bar', 'baz'] and 'bar' return 'baz'
Lib.prototype.lookupArg = function(args, key) {
  for (var i in args) {
    var arg = args[i];
    if (arg === key) {
      var value = args[parseInt(i) + 1];
      return value;
    }
  }
}

// From ['bar', 'baz', 'bar', 'bang'] and 'bar' return ['baz', 'bang']
Lib.prototype.lookupAllArgs = function(args, key) {
  const found = [];
  for (var i in args) {
    var arg = args[i];
    if (arg === key) {
      var value = args[parseInt(i) + 1];
      found.push(value);
    }
  }
  return found;
}

// Returns the current UTC time in ISO8601.
Lib.prototype.now = function() {
  return moment().utc().format('YYYY-MM-DDTHH:mm:ssZZ');
}

// throw can't be used in expression position, so...
Lib.prototype.die = function(reason) {
  throw reason;
}

// Run the given shell command and exit with its return code.
Lib.prototype.execAndExit = function(command) {
  const p = exec(command);
  p.stdout.pipe(process.stdout);
  p.stderr.pipe(process.stderr);

  p.on('exit', function (code) {
    process.exit(code);
  });
}

// Calculates request signature and returns [auth header, curl command]
Lib.prototype.sign = function(uri, token, secret, time, passthrough) {
  const curlArgs = passthrough.slice();

  curlArgs.unshift(uri);

  // Add date header
  curlArgs.push('-H');
  curlArgs.push('X-SwiftNav-Date: ' + time);

  // Canonicalize headers
  const swiftHeaders = [];
  this.lookupAllArgs(curlArgs, '-H').forEach(function(value) {
    const headerValue = value.split(' ');
    if ((headerValue[0] || '').toLowerCase().indexOf('x-swiftnav') === 0) {
      swiftHeaders.push(headerValue[0].toLowerCase() + headerValue.splice(1).join(' '));
    }
  })

  const canonicalSwiftHeaders = swiftHeaders.sort(function (a, b) {
    const aName = a.split(' ')[0] || a;
    const bName = b.split(' ')[0] || b;
    return aName.localeCompare(bName);
  }).join('\n');

  const parsedUri = url.parse(uri);

  // Canonicalize query string
  const canonicalizedQuery = '?' + (parsedUri.query || '').split('&').sort(function (a, b) {
    const aName = a.split('=')[0] || a;
    const bName = b.split('=')[0] || b;
    return aName.localeCompare(bName);
  }).join('&');

  // Get request method
  const method = this.lookupArg(curlArgs, '-X') || "GET";

  // Get request body, if present
  const body = this.lookupArg(curlArgs, '--data') || '';

  // TODO: put port on a separate line
  const path = parsedUri.pathname;
  const host = parsedUri.hostname;
  const port = parsedUri.port || (parsedUri.protocol === 'https:' ? 443 : 80);
  const query = canonicalizedQuery;
  const digest = method + "\n" + path + "\n" + host + "\n" + port + "\n" + query + "\n" + canonicalSwiftHeaders + "\n" + body;

  // Create auth header
  const signature = hmacSHA512(secret, digest);
  var authorization = '';
  if (token && secret && signature) {
    authorization = 'Authorization: SWIFTNAV-V1-PRF-HMAC-SHA-512 ' + token + ':' + signature;
    curlArgs.push('-H');
    curlArgs.push(authorization);
  }

  const command = 'curl ' + curlArgs.map(this.escapeShell).join(' ');

  return [authorization, command];
}

Lib.prototype.main = function() {
  const argPair = this.parseArgs(process.argv.slice(2));
  const parsedArgs = argPair[0];
  const passthrough = argPair[1];

  // Extract token, secret
  var uri = parsedArgs['uri'] || this.die('need --uri');
  var token = parsedArgs['token'];
  var secret = parsedArgs['secret'];
  var time = parsedArgs['time'] || this.now();

  const signPair = this.sign(uri, token, secret, time, passthrough);
  const authorization = signPair[0];
  const curlCommand = signPair[1];

  console.log(curlCommand);

  this.execAndExit(curlCommand);
}

module.exports = new Lib();
