require.paths.unshift('t/lib', 'lib');

var Template = require('Template').Template;
Template.Test = require('Template/Test').Test;

var t = new Template.Test();
t.name = 'wrapper';

t.build_tests(require('io').File('t/data/wrapper.data'),
              new Template({ 
                INCLUDE_PATH: [
                  't/data/src',
                  't/data/lib',
                ],
                //DBG_OUTPUT_FUNC: 1,
                TRIM: 1
              }), t.callsign());

require('test').runner(t);
