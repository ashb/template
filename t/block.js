$importer.context = this;

$importer.paths.unshift('t/lib', 'lib');

$importer.load('Template');
$importer.load('TestHarness');
$importer.load('Template.Test');

warn = Function.bind(IO.stderr, 'print');

t = new Template.Test();
t.name = 'block';

t.build_tests(new IO.File('t/data/block.data'),
              new Template({ 
                POST_CHOMP: 1,
                INCLUDE_PATH: ['t/data/lib'],
                //DBG_OUTPUT_FUNC: 1,
                BLOCKS: {
                  header: '<html><head><title>[% title %]</title></head><body>',
                  footer: '</body></html>',
                  block_a: function() { return 'this is block a' },
                  block_b: function() { return 'this is block b' },
                  
                }
              }), t.callsign());

TestHarness.go();
//t.run('test_1');
