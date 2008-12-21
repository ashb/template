$importer.context = this;

$importer.paths.unshift('t/lib', 'lib');

$importer.load('Template');
$importer.load('TestHarness');
$importer.load('Template.Test');

warn = Function.bind(IO.stderr, 'print');

t = new Template.Test();
t.name = 'wrapper';

t.build_tests(new IO.File('t/data/wrapper.data'),
              new Template({ 
                POST_CHOMP: 1,
                INCLUDE_PATH: ['t/data/lib'],
                //DBG_OUTPUT_FUNC: 1,
                TRIM: 1
              }), t.callsign());

TestHarness.go();
//t.run('test_1');
