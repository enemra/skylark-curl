/**
 * Copyright: 2016 Swift Navigation
 * License: MIT
 */

const lib = require('../src/lib.js');

module.exports = {
  testParseArgs: function(test) {
    const input = ['--foo', 'bar', '--baz', 'quux', '--', '--beep', 'boop'];
    const actual = lib.parseArgs(input);
    const expected = [{'foo': 'bar', 'baz': 'quux'}, ['--beep', 'boop']];
    test.deepEqual(actual, expected);
    test.done();
  },
  testLookupArg: function(test) {
    const input = ['--beep', 'boop'];
    test.deepEqual(lib.lookupArg(input, '--beep'), 'boop');
    test.deepEqual(lib.lookupArg(input, '--whatever'), undefined);
    test.done();
  },
  testLookupAllArgs: function(test) {
    const input = ['--beep', 'boop', '--meep', 'moop', '--beep', 'bop'];
    test.deepEqual(lib.lookupAllArgs(input, '--beep'), ['boop', 'bop']);
    test.deepEqual(lib.lookupAllArgs(input, '--whatever'), []);
    test.done();
  },
  testPrepareCurl: function(test) {
    const parsedArgs = {
      'uri': 'http://localhost:3030',
      'token': 'asdf',
      'secret': 'sdfg',
      'time': '2016-03-23T19:04:45+0000'
    };
    const passthrough = ['-H', 'foo: bar'];
    const prepared = lib.prepareCurl(parsedArgs, passthrough);
    const expectedTime = 'X-SwiftNav-Date: 2016-03-23T19:04:45+0000';
    const expectedAuth = 'Authorization: SWIFTNAV-V1-PRF-HMAC-SHA-512 asdf:10bf2a8f56158ac18989603203b712ea69ce5d21bdc761acfdaf77e68cd8b6d2844eaf0722c1533c92fe62d0650f9f5f16e971953ce84b57e9893654816eda97';
    test.deepEqual(prepared[0], expectedTime);
    test.deepEqual(prepared[1], expectedAuth);
    test.done();
  },
  testPreparePost: function(test) {
     const parsedArgs = {
      'uri': 'http://localhost:3030/a/b?c=d&g&e=f',
      'token': 'asdf',
      'secret': 'sdfg',
      'time': '2016-03-23T19:04:45+0000'
    };
    const passthrough = [
      '-H', 'foo: bar',
      '-H', 'X-SwiftNav-Zap: zip',
      '-H', 'x-Swiftnav-Foo: BAR',
      '-X', 'POST',
      '--data', '{abc:123}'
    ];
    const prepared = lib.prepareCurl(parsedArgs, passthrough);
    const expectedTime = 'X-SwiftNav-Date: 2016-03-23T19:04:45+0000';
    const expectedAuth = 'Authorization: SWIFTNAV-V1-PRF-HMAC-SHA-512 asdf:a77db75c804d074dcabe1d051bc5d3f0ce61617d153e1b04b1557955efb23a9771fd804747cdd3480ec0971c6e816abc782f49dc969b8c7e0e19b08ddc7fa137';
    test.deepEqual(prepared[0], expectedTime);
    test.deepEqual(prepared[1], expectedAuth);
    test.done();
  },
  testProxy: function(test) {
    const time = '2016-03-23T19:04:45+0000'
    const token = 'abc'
    const secret = 'def'
    const destUri = 'http://localhost:3030'
    const proxyUri = 'http://localhost:3031'
    const path = '/a/b?c=d&g&e=f'

    const parsedArgs = {
      'uri': destUri + path,
      'token': token,
      'secret': secret,
      'time': time
    }
    const passthrough = ['-H', 'C: D', '-H', 'A: B', '-H', 'E: F']
    const expectedSig = 'd4a2e875ea0d1fd30f76d3de72a85f4c46849c0d2a9fe8723829dc8bddf86d6e44b66459e7db5e887cb3228b34613cb000061e29de4c384bfd7a87d770ca670e'
    const expectedAuth = 'Authorization: SWIFTNAV-V1-PRF-HMAC-SHA-512 abc:' + expectedSig

    const prepared = lib.prepareCurl(parsedArgs, passthrough)
    const actualCurlAuth = prepared[1]
    test.deepEqual(actualCurlAuth, expectedAuth);

    const req = {
      'url': proxyUri + path,
      'method': 'GET',
      'rawHeaders': [
        'C', 'D',
        'X-SwiftNav-Proxy-Token', token,
        'A', 'B',
        'X-SwiftNav-Proxy-Secret', secret,
        'E', 'F'
      ]
    }
    lib.signRequest(destUri, time, req);
    const actualSig = lib.lookupArg(req.rawHeaders, 'Authorization')
    const actualProxyAuth = 'Authorization: ' + actualSig
    test.deepEqual(actualProxyAuth, expectedAuth);

    test.done();
  }
};
