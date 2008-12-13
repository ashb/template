$importer.context = this;

$importer.paths.unshift('t/lib', 'lib');

$importer.load('Template');
$importer.load('TestHarness');
$importer.load('Template.Test');

t = new Template.Test();

t.test_tt = function() {
  this._test_expect(new IO.File('t/vars.data'));
}
