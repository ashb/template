$importer.context = this;

$importer.paths.unshift('t/lib', 'lib');

$importer.load('Template');
$importer.load('TestHarness');
$importer.load('Template.Test');

warn = Function.bind(IO.stderr, 'print');

t = new Template.Test();
t.name = 'foreach';

var params = {}

t.build_tests(new IO.File('t/data/foreach.data'),
              new Template({ 
                POST_CHOMP: 1,
                INTERPOLATE: 1,
              }), params);

TestHarness.go();
//t.run('test_1');
