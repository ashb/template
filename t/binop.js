$importer.context = this;

$importer.paths.unshift('t/lib', 'lib');

$importer.load('Template');
$importer.load('TestHarness');
$importer.load('Template.Test');

warn = Function.bind(IO.stderr, 'print');

t = new Template.Test();
t.name = 'vars';

var counter = 0;
t.build_tests(new IO.File('t/data/binop.data'),
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

TestHarness.go();
//t.run('test_1');
