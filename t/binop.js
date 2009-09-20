require.paths.unshift('t/lib', 'lib');

var Template = require('Template').Template;
Template.Test = require('Template/Test').Test;

t = new Template.Test();
t.name = 'binop';

var counter = 0;
t.build_tests(require('io').File('t/data/binop.data'),
              new Template({INTERPOLATE: 1, POST_CHOMP: 1}),
              { yes: 1,
                no: 0,
                'true': 'this is true',
                'false': '0',
                happy: 'yes',
                sad: '',
                ten: 10,
                twenty: 20,
                alpha: function() { return ++counter; },
                omega: function() { counter += 10; return 0; },
                count: function() { return counter; },
                reset: function() { return counter = 0; }
              });

require('test').runner(t);
