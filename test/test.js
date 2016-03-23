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
  testParseAndSign: function(test) {
    const input = '--uri http://localhost:3030 --token asdf --secret sdfg --time 2016-03-23T19:04:45+0000 -- -H "foo: bar"';
    const args = input.split(' ');
    const signed = lib.parseAndSign(args);
    const expectedTime = 'X-SwiftNav-Date: 2016-03-23T19:04:45+0000';
    const expectedAuth = 'Authorization: SWIFTNAV-V1-PRF-HMAC-SHA-512 asdf:10bf2a8f56158ac18989603203b712ea69ce5d21bdc761acfdaf77e68cd8b6d2844eaf0722c1533c92fe62d0650f9f5f16e971953ce84b57e9893654816eda97';
    test.deepEqual(signed[0], expectedTime);
    test.deepEqual(signed[1], expectedAuth);
    test.done();
  }
};
