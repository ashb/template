$importer.context = this;

$importer.paths.unshift('t/lib', 'lib');

$importer.load('Template');
$importer.load('TestHarness');
$importer.load('Template.Test');

warn = Function.bind(IO.stderr, 'print');

t = new Template.Test();
t.name = 'foreach';

var months = 'jan feb mar apr may jun jul aug sep oct nov dec'.split(/ /);

var params = {
  a: 'alpha',
  b: 'bravo',
  c: 'charlie',
  C: 'CHARLIE',
  d: 'delta',
  l: 'lima',
  o: 'oscar',
  r: 'romeo',
  u: 'uncle',
  w: 'whisky',
  seta: ['alpha', 'bravo', 'whisky'],
  setb: ['charlie', 'lima', 'oscar', 'uncle', 'delta'],
  users: [ {id: 'abw', name: 'Andy Wardley'},
           {id: 'sam', name: 'Simon Matthews'}],
  item: 'foo',
  items: ['foo', 'bar'],
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  months: function() { return months; },

  people: [
    { id: 'abw', code: 'abw', name: 'Andy Wardley' },
    { id: 'aaz', code: 'zaz', name: 'Azbaz Azbaz Zazbazzer' },
    { id: 'bcd', code: 'dec', name: 'Binary Coded Decimal' },
    { id: 'efg', code: 'zzz', name: 'Extra Fine Grass' }
  ],
  sections: {
    one: 'Section One',
    two: 'SectionTrwo',
    three: 'Section Three',
    four: 'Section Four'
  },
  nested: [
    ['a','b','c'],
    ['x','y','z']
  ]
};


t.build_tests(new IO.File('t/data/foreach.data'),
              new Template({ 
                POST_CHOMP: 1,
                INTERPOLATE: 1,
              }), params);

TestHarness.go();
//t.run('test_1');
