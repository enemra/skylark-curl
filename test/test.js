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
  }
};
