require.paths.unshift('t/lib', 'lib');

var Template = require('Template').Template;
Template.Test = require('Template/Test').Test;

var t = new Template.Test();

var stderr = '',
    file   = 'xyz';

t = new Template.Test();
t.name = 'filter';

var a = 'alpha',
    b = 'bravo',
    c = 'charlie',
    d = 'delta';
var params = { 
    'a'      : a,
    'b'      : b,
    'c'      : c,
    'd'      : d,
    'list'   : [ a, b, c, d ],
    'text'   : 'The cat sat on the mat',
    outfile  : file,
    stderr   : function () { return stderr },
    //despace  : bless(\&despace, 'anything'),
    widetext : "wide:\u65e5\u672c\u8a9e"
};

var filters = {
    'nonfilt'    : 'nonsense',
    'microjive'  : microjive,
    'microsloth' : [ microsloth, 0 ],
    'censor'     : [ censor_factory, 1 ],
    'badfact'    : [ function() { return 'nonsense' }, 1 ],
    'badfilt'    : [ 'rubbish', 1 ],
    'barfilt'    : barf_up
};


t.build_tests(require('io').File('t/data/filter.data'),
              new Template({ 
                //DBG_OUTPUT_CHUNKS: 1,
                //DBG_OUTPUT_FUNC: 1,
                //DEBUG: 1,
                POST_CHOMP: 1,
                FILTERS: filters
              }), params);

require('test').runner(t);


function microjive() {
}

function microsloth() {
}

function censor_factory() {
}

function barf_up(ctx, foad) {
  if (foad === undefined)
    foad = 0;
  require('system').stdout.print("barf up", ctx, foad);
  if (foad == 0)
    return [null, "barfed"];
  else if (foad == 1)
    return [null, new Template.Exception('dead', 'deceased')];
  else if (foad == 2)
    throw "keeled over\n";
  else
    throw new Template.Exception('unwell', 'sick as a parot');
}

function despace(text) {
  return text.replace(/\s+/g, '_');
}

function another() {
}
