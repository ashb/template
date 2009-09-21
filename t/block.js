require.paths.unshift('t/lib', 'lib');

var Template = require('Template').Template;
Template.Test = require('Template/Test').Test;

var t = new Template.Test();
t.name = 'block';

t.build_tests(require('io').File('t/data/block.data'),
              new Template({ 
                POST_CHOMP: 1,
                INCLUDE_PATH: ['t/data/lib'],
                //DBG_OUTPUT_FUNC: 1,
                BLOCKS: {
                  header: '<html><head><title>[% title %]</title></head><body>',
                  footer: '</body></html>',
                  block_a: function() { return 'this is block a' },
                  block_b: function() { return 'this is block b' }
                }
              }), t.callsign());

require('test').runner(t);
