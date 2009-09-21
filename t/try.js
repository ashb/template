require.paths.unshift('t/lib', 'lib');

var Template = require('Template').Template;
Template.Test = require('Template/Test').Test;

var t = new Template.Test();
t.name = 'try';

var replace = t.callsign();
replace.throw_egg = function() {
  throw new Template.Exception('egg', 'scrambled');
}

replace.throw_any = function() { throw "undefined error"; };

t.build_tests(require('io').File('t/data/try.data'),
              new Template({
                  //DBG_OUTPUT_CHUNKS: 1,
                  //DBG_OUTPUT_FUNC: 1,
                  //DEBUG: 1,
                  INCLUDE_PATH: ['t/data/lib'],
                  POST_CHOMP: 1
              }),
              replace);

require('test').runner(t);

