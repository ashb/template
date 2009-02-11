$importer.context = this;

$importer.paths.unshift('t/lib', 'lib');

$importer.load('Template');
$importer.load('TestHarness');
$importer.load('Template.Test');

warn = Function.bind(IO.stderr, 'print');

t = new Template.Test();
t.name = 'block';
var stderr = '',
    file   = 'xyz';

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


t.build_tests(new IO.File('t/data/filter.data'),
              new Template({ 
                POST_CHOMP: 1,
              }), params);

//TestHarness.go();
t.run('test_1');
