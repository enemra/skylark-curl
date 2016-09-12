/**
 * Copyright: 2016 Swift Navigation
 * License: MIT
 */

const exec = require('child_process').exec;
const hmacSHA512 = require('./sha512');
const http = require('http');
const request = require('request');
const moment = require('moment');
const url = require('url');

module.exports = {
  dateHeader: 'X-SwiftNav-Date',
  authHeader: 'Authorization',
  tokenHeader: 'X-SwiftNav-Proxy-Token',
  secretHeader: 'X-SwiftNav-Proxy-Secret',
  headerPrefix: 'x-swiftnav-proxy-',

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

  /**
   * Returns the current UTC time in ISO8601, long format (the Skylark standard).
   */
  nowISO8601: function() {
    return moment().utc().format('YYYY-MM-DDTHH:mm:ssZZ');
  },

  logTime: function(msg) {
    console.log('[' + this.nowISO8601() + '] ' + msg);
  },

  // throw can't be used in expression position, so...
  die: function(reason) {
    throw new Error(reason);
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

  /**
   * Given all the parts of a request, generate a digest string.
   */
  makeDigest: function(method, path, host, port, query, headers, body) {
    // Canonicalize headers
    const swiftHeaders = headers.filter(function(h) {
      return h[0].toLowerCase().indexOf('x-swiftnav') == 0;
    });

    const canonicalSwiftHeaders = swiftHeaders.sort(function (a, b) {
      return a[0].toLowerCase().localeCompare(b[0].toLowerCase());
    }).map(function (h) {
      h[0] = h[0].toLowerCase();
      return h.join(':');
    }).join('\n');

    // Canonicalize query string
    const canonicalizedQuery = '?' + query.sort(function (a, b) {
      const aName = a[0];
      const bName = b[0];
      return a[0].toLowerCase().localeCompare(b[0].toLowerCase());
    }).map(function (q) {
      return q.join('=');
    }).join('&');

    return [
      (method + '').toUpperCase(),
      path,
      host,
      port,
      canonicalizedQuery,
      canonicalSwiftHeaders,
      body
    ].join('\n');
  },

  /**
   * Calculates request signature and returns [auth header, curl command]
   */
  sign: function(uri, token, secret, time, passthrough) {
    const curlArgs = passthrough.slice();

    curlArgs.unshift(uri);

    const timeValue = this.dateHeader + ': ' + time;
    var authValue = '';

    // Add date header
    curlArgs.push('-H');
    curlArgs.push(timeValue);

    if (token && secret) {

      const parsedUri = url.parse(uri);

      // Get request method
      const method = this.lookupArg(curlArgs, '-X') || "GET";

      // TODO: put port on a separate line
      const path = parsedUri.pathname;
      const host = parsedUri.hostname;
      const port = parsedUri.port || (parsedUri.protocol === 'https:' ? 443 : 80);

      const query = (parsedUri.query || '').split('&').map(function(p) {
        return p.split('=');
      });

      const headers = this.lookupAllArgs(curlArgs, '-H').map(function(value) {
        const pieces = value.split(' ');
        var key = pieces[0].toLowerCase().slice(0, -1);
        var value = pieces.slice(1).join(' ');
        return [key, value];
      });

      // Get request body, if present
      const body = this.lookupArg(curlArgs, '--data') || '';

      const digest = this.makeDigest(method, path, host, port, query, headers, body);

      const signature = hmacSHA512(secret, digest);

      authValue = this.authHeader + ': SWIFTNAV-V1-PRF-HMAC-SHA-512 ' + token + ':' + signature;

      curlArgs.push('-H');
      curlArgs.push(authValue);
    }

    const command = 'curl ' + curlArgs.map(this.escapeShell).join(' ');

    return [timeValue, authValue, command];
  },

  // Parse arguments and return a signed request
  prepareCurl: function(parsedArgs, passthrough) {
    // Extract token, secret
    const uri = parsedArgs['uri'] || this.die('need --uri');
    const token = parsedArgs['token'];
    const secret = parsedArgs['secret'];
    const time = parsedArgs['time'] || this.nowISO8601();

    return this.sign(uri, token, secret, time, passthrough);
  },

  chunk: function(arr) {
    const out = [];
    const n = arr.length;
    var i = 0;

    while (i < n) {
      out.push([arr[i], arr[i+1]]);
      i += 2;
    }

    return out;
  },

  // Signs the given request
  signRequest: function(destUri, time, request, body) {
    const token = this.yankHeader(request, this.tokenHeader);
    const secret = this.yankHeader(request, this.secretHeader);

    this.setHeader(request, this.dateHeader, time);

    if (token && secret) {
      const parsedDestUri = url.parse(destUri);
      const parsedUri = url.parse(request.url);

      const method = request.method;
      const path = parsedUri.pathname;
      const host = parsedDestUri.hostname;
      const port = parsedDestUri.port || (parsedDestUri.protocol === 'https:' ? 443 : 80);
      const query = (parsedUri.query || '').split('&').map(function (q) {
        return q.split('=');
      });
      const headers = this.chunk(request.rawHeaders).map(function(h) {
        h[0] = h[0].toLowerCase();
        return h;
      });

      const digest = this.makeDigest(method, path, host, port, query, headers, body);

      const signature = hmacSHA512(secret, digest);

      const authValue = 'SWIFTNAV-V1-PRF-HMAC-SHA-512 ' + token + ':' + signature;

      this.setHeader(request, this.authHeader, authValue);

      this.setHeader(request, 'host', host + ':' + port);

      this.cleanHeaders(request);
    }

    return request;
  },

  // Set a header value in the request
  setHeader: function (req, key, value) {
    this.yankHeader(req, key);
    req.rawHeaders.push(key);
    req.rawHeaders.push(value);
    if (req.headers) {
      req.headers[key] = value;
    }
    return req;
  },

  // Clean headers - remove any proxy-related headers
  cleanHeaders: function (req) {
    const args = req.rawHeaders;
    for (var i in args) {
      var arg = args[i];
      if (arg.toLowerCase().indexOf(this.headerPrefix) === 0) {
        this.yankHeader(arg);
      }
    }
  },

  // Finds the given header and removes it from the request!
  yankHeader: function(req, key) {
    const args = req.rawHeaders;
    for (var i in args) {
      var arg = args[i];
      if (arg.toLowerCase() === key.toLowerCase()) {
        var value = args[parseInt(i) + 1];
        args.splice(i, 2);
        if (req.headers) {
          delete req.headers[arg.toLowerCase()];
        }
        return value;
      }
    }
  },

  runProxy: function(uri, port) {
    const self = this;

    const server = http.createServer(function(req, res) {
      self.logTime(req.method + ' ' + req.url);
      const time = self.nowISO8601();

      // Need to read and buffer body
      var reqBody = '';
      req.on('data', function (data) {
        reqBody += data;
      });
      req.on('end', function () {
        const parsedUri = url.parse(req.url);
        self.signRequest(uri, time, req, reqBody);
        var options = {
          method:  req.method
        , uri:     uri + parsedUri.pathname
        , body:    reqBody
        , headers: req.headers
        };
        return request(options).pipe(res);
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
