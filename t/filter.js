$importer.context = this;

$importer.paths.unshift('t/lib', 'lib');

$importer.load('Template');
$importer.load('TestHarness');
$importer.load('Template.Test');

var stderr = '',
    file   = 'xyz';

warn = function() { stderr += Array.prototype.join.call(arguments, " "); };

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
    widetext : "wide:\x{65e5}\x{672c}\x{8a9e}"
};

var filters = {
    'nonfilt'    : 'nonsense',
    'microjive'  : microjive,
    'microsloth' : [ microsloth, 0 ],
    'censor'     : [ censor_factory, 1 ],
    'badfact'    : [ function() { return 'nonsense' }, 1 ],
    'badfilt'    : [ 'rubbish', 1 ],
    'barfilt'    : [ barf_up, 1 ],
};


t.build_tests(new IO.File('t/data/filter.data'),
              new Template({ 
                POST_CHOMP: 1,
                FILTERS: filters,
              }), params);

//TestHarness.go();
t.run('test_1');


function microjive() {
}

function microsloth() {
}

function censor_factory() {
}

function barf_up() {
}

function despace(text) {
  return text.replace(/\s+/g, '_');
}

function another() {
}
