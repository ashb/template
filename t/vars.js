require.paths.unshift('t/lib', 'lib');

var Template = require('Template').Template;
Template.Test = require('Template/Test').Test;

var t = new Template.Test();
t.name = 'vars';
var t_v2 = new Template.Test();
t_v2.name = 'vars_v2';


(function() {
  var tts = {
    default: new Template({
      INTERPOLATE: 1, 
      ANYCASE: 1, 
      V1DOLLAR: 1
      //DBG_OUTPUT_CHUNKS: 1,
      //DBG_OUTPUT_FUNC: 1,
      //DEBUG: 1
    }),
    notcase: new Template({INTERPOLATE: 1})
  }
  t.build_tests(require('io').File('t/data/vars.data'), 
                tts, make_params.apply(t));

  exports.test_vars = t;

  tts = {
    default: new Template({
      INTERPOLATE: 1, 
      ANYCASE: 1
    }),
    notcase: new Template({INTERPOLATE: 1})
  }
  t_v2.build_tests(require('io').File('t/data/vars_v2.data'), 
                   tts, make_params.apply(t_v2));
  exports.test_vars_v2 = t_v2;
})()

// Functions needed for running the tests
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
  var c = this.callsign();

  var count = 0;

  function up() { return ++count; }
  function down() { return --count; }
  function reset(arg) {
    count = arguments.length > 0 ? arg : 0;
    return count;
  }
  function halt() { throw new Template.Exception("stop", "stopped"); }
  function expose() { delete Template.Stash.PRIVATE };

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

require('test').runner(exports);
//t.go();
//t_v2.go();
//t.run('test_1');
