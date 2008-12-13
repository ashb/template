$importer.context = this;

$importer.paths.unshift('t/lib', 'lib');

$importer.load('Template');
$importer.load('TestHarness');
$importer.load('Template.Test');

warn = Function.bind(IO.stderr, 'print');

t = new Template.Test();

(function() {
  var tts = {
    default: new Template({
      INTERPOLATE: 1, 
      ANYCASE: 1, 
      V1DOLLAR: 1, 
      //DBG_OUTPUT_CHUNKS: 1,
      //DBG_OUTPUT_FUNC: 1
    }),
    notcase: new Template({INTERPOLATE: 1, V1DOLLAR: 0})
  }
  var params = make_params.apply(t);
  t.build_tests(new IO.File('t/vars_v2.data'), tts, params);
})()

var days = "Monday Tuesday Wednesday Thursday Friday Saturday Sunday".split(/ /);
var day = -1;
function yesterday() {
  return "All my troubles seemed so far away...";
}

function today(when) {
  when = when || 'Now';
  return when + " it looks as though they're here to stay.";
}

function tomorrow(dayno) {
  if (dayno === undefined) {
    day++;
    day %= 7;
    dayno = day;
  }
  return days[dayno];
}

function belief() {
  var b = Array.prototype.join.call(arguments, ' and ');
  if (!b)
    b = '<nothing>';
  return "Oh I believe in " + b + ".";
}

function yankee() {
    var a = [];
    a[1] = { a : 1 };
    a[3] = { a : 2 };
    return a;
}

function make_params() {
  c = this.callsign();

  var count = 0;

  function up() { return ++count; }
  function down() { return --count; }
  function reset(arg) {
    count = arguments.length > 0 ? arg : 0;
    return count;
  }
  function halt() { throw new Template.Exception("stop", "stopped"); }
  function expose() { delete Template.Staash.PRIVATE };

  return {
    a: c.a,
    b: c.b,
    c: c.c,
    d: c.d,
    e: c.e,
    f: { g: c.g,
         h: c.h,
         i: { j: c.j,
              k: c.k } },
    g: "solo " + c.g,
    l: c.l,
    r: c.r,
    s: c.s,
    t: c.t,
    w: c.w,
    n: function() { return count },
    up: up,
    down: down,
    reset: reset,
    undef: function() { return undefined },
    zero: function() { return 0 },
    one: function() { return "one" },
    halt: halt,
    join: function() {
      var args = Array.prototype.slice.call(arguments);
      s = args.shift();
      return args.join(s);
    },
    split: function(s,str) { return str.split(s); },
    magic: {
      chant: 'Hocus Pocus',
      spell: function() {
        return Array.prototype.join.call(arguments, " and a bit of ");
      }
    },
    day: {
      prev: yesterday,
      'this': today,
      next: tomorrow
    },
    belief: belief,
    people: function() { return ['Tom', 'Dick', 'Larry'] },
    gee: 'g',
    letteralpha: "'alpha'",
    yankee: yankee,
    _private: 123,
    _hidden: 456,
    expose: expose,
    add: function(x,y) { return x+y }
  };
}
t.go();
