const lib = require('../src/lib.js');

module.exports = {
    test1: function (test) {
        test.equals(1, 1);
        test.done();
    }
};
