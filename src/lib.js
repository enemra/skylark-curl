/**
 * Copyright: 2016 Swift Navigation
 * License: MIT
 */

const exec = require('child_process').exec;
const hmacSHA512 = require('./sha512');
const http = require('http');
const httpProxy = require('http-proxy');
const moment = require('moment');
const url = require('url');

module.exports = {
  dateHeader: 'X-SwiftNav-Date',
  authHeader: 'Authorization',
  tokenHeader: 'X-SwiftNav-Proxy-Token',
  secretHeader: 'X-SwiftNav-Proxy-Secret',

  // String escape for use with `exec`
  escapeShell: function(cmd) {
    if (cmd.indexOf(' ') !== -1 || cmd.indexOf('&') !== -1) {
      return '"'+cmd.replace(/(["'$`\\])/g,'\\$1')+'"';
    }
    if (cmd === '') {
      return "\"\"";
    }
    return cmd;
  },

  // Parse ['--foo', 'bar', '--baz', 'quux'] to {'foo': 'bar', 'baz': 'quux'}
  parsePairs: function(arr) {
    const map = {};
    const n = arr.length;
    var i = 0;

    while (i < n) {
      map[arr[i].slice(2)] = arr[i + 1];
      i += 2;
    }

    return map;
  },

  // Given args like
  // --foo bar --baz quux -- --beep boop
  // Returns [{'foo': 'bar', 'baz': 'quux'}, ['--beep', 'boop']]
  parseArgs: function(args) {
    // Find the passthrough marker
    const split = args.findIndex(s => s == '--');
    // Split into a section to parse and one to passthrough
    const endex = split < 0 ? args.length : split;
    const toParse = args.slice(0, endex);
    const passthrough = args.slice(endex + 1);
    const parsed = this.parsePairs(toParse);
    return [parsed, passthrough];
  },

  // From ['bar', 'baz'] and 'bar' return 'baz'
  lookupArg: function(args, key) {
    for (var i in args) {
      var arg = args[i];
      if (arg === key) {
        var value = args[parseInt(i) + 1];
        return value;
      }
    }
  },

  // From ['bar', 'baz', 'bar', 'bang'] and 'bar' return ['baz', 'bang']
  lookupAllArgs: function(args, key) {
    const found = [];
    for (var i in args) {
      var arg = args[i];
      if (arg === key) {
        var value = args[parseInt(i) + 1];
        found.push(value);
      }
    }
    return found;
  },

  // Returns the current UTC time in ISO8601.
  now: function() {
    return moment().utc().format('YYYY-MM-DDTHH:mm:ssZZ');
  },

  logTime: function(msg) {
    console.log('[' + this.now() + '] ' + msg);
  },

  // throw can't be used in expression position, so...
  die: function(reason) {
    throw reason;
  },

  // Run the given shell command and exit with its return code.
  execAndExit: function(command) {
    const p = exec(command);
    p.stdout.pipe(process.stdout);
    p.stderr.pipe(process.stderr);

    p.on('exit', function (code) {
      process.exit(code);
    });
  },

  // Calculates request signature and returns [auth header, curl command]
  sign: function(uri, token, secret, time, passthrough) {
    const curlArgs = passthrough.slice();

    curlArgs.unshift(uri);

    const timeHeader = this.dateHeader + ': ' + time;

    // Add date header
    curlArgs.push('-H');
    curlArgs.push(timeHeader);

    // Canonicalize headers
    const swiftHeaders = [];
    this.lookupAllArgs(curlArgs, '-H').forEach(function(value) {
      const headerValue = value.split(' ');
      if ((headerValue[0] || '').toLowerCase().indexOf('x-swiftnav') === 0) {
        swiftHeaders.push(headerValue[0].toLowerCase() + headerValue.slice(1).join(' '));
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
    var authHeader = '';
    if (token && secret) {
      const signature = hmacSHA512(secret, digest);
      authHeader = this.authHeader + ': SWIFTNAV-V1-PRF-HMAC-SHA-512 ' + token + ':' + signature;
      curlArgs.push('-H');
      curlArgs.push(authHeader);
    }

    const command = 'curl ' + curlArgs.map(this.escapeShell).join(' ');

    return [timeHeader, authHeader, command];
  },

  // Parse arguments and return a signed request
  prepareCurl: function(parsedArgs, passthrough) {
    // Extract token, secret
    const uri = parsedArgs['uri'] || this.die('need --uri');
    const token = parsedArgs['token'];
    const secret = parsedArgs['secret'];
    const time = parsedArgs['time'] || this.now();

    return this.sign(uri, token, secret, time, passthrough);
  },

  // Signs the given request
  signRequest: function(uri, token, secret, time, request) {
    // TODO
  },

  // Finds the given header and removes it from the request!
  yankHeader: function(req, key) {
    const args = req.rawHeaders;
    for (var i in args) {
      var arg = args[i];
      if (arg.toLowerCase() === key.toLowerCase()) {
        var value = args[parseInt(i) + 1];
        args.splice(i, 2);
        return value;
      }
    }
  },

  runProxy: function(uri, port) {
    const self = this;
    const proxy = httpProxy.createProxyServer({
      secure: true
    });

    const server = http.createServer(function(req, res) {
      self.logTime(req.method + ' ' + req.url);
      const token = self.yankHeader(req, self.tokenHeader);
      const secret = self.yankHeader(req, self.secretHeader);
      if (token && secret) {
        self.logTime('Signing with token: ' + token);
        const time = self.now();
        self.signRequest(uri, token, secret, time, req);
      } else {
        self.logTime('Not signing');
      }
      proxy.web(req, res, {
        target: uri
      });
    });

    this.logTime('listening on port ' + port)
    server.listen(port);
  },

  // Main function for skylark-curl
  main: function() {
    const args = process.argv.slice(2);
    const argPair = this.parseArgs(args);
    const parsedArgs = argPair[0];
    const passthrough = argPair[1];

    const mode = parsedArgs['mode'] || 'curl';

    if (mode === 'curl') {
      const prepared = this.prepareCurl(parsedArgs, passthrough);
      const curlCommand = prepared[2];
      this.execAndExit(curlCommand);
    } else if (mode === 'proxy') {
      const uri = parsedArgs['uri'] || this.die('need --uri');
      const port = parsedArgs['port'] || this.die('need --port');
      this.runProxy(uri, port);
    } else {
      this.die('unknown mode: ' + mode);
    }
  }
};
