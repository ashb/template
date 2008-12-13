if (this.Template === undefined)
  throw new Error("Please include Template.js first");

if (this.TestHarness === undefined)
  throw new Error("Please include TestHarness.js first");

(function () {
  var test = Template.Test = function Template$Test() {
    this.__proto__.__proto__.constructor.apply(this)
  }


  test.prototype = {
    __proto__: TestHarness.prototype,
    
    // This is the main testing sub-routine.
    _test_expect: function (data, tproc, params) {
      params = params || {};

      if (data.readWhole instanceof Function)
        data = data.readWhole();
      // Remove comment lines
      data = data.replace(/^#.*?\n/gm, '');
      
      // remove anything before '-- start --' and/or after '-- stop --'
      data = data.replace(/.*?\s*--\s*start\s*--\s*/, "")
                 .replace(/\s*--\s*stop\s*--\s*.*/, "");

      var tests = data.split(/^\s*--\s*test\s*--\s*\n/im);
      // if the first line of the file was '--test--' (optional) then the 
      // first test will be empty and can be discarded
      if (tests[0].match(/^\s*$/))
        tests.shift();

      this.expect(3 + tests.length * 2);
         
      // first test is that we got hte data to test
      this.ok(1, "running test_expect()");

      if (!tproc)
        tproc = new Template;

      this.ok(tproc, "template processor is engaged");

      // third test is that the input read ok, which it did
      this.ok(1, "input read and split into " + tests.length + " tests");

      var count = 0;

      for (var i in tests) {
        var input = tests[i];
        count++;
        var name = 'template text ' + count;

        input = input.replace(
          /^\s*-- name:? (.*?) --\s*\n/im, 
          function(whole,n) { name = n; return '' }
        );

        // split input by a line like "-- expect --"
        var split = input.split(/^\s*--\s*expect\s*--\s*\n/im);
        var expect = split[1] || '';
        input = split[0];
        print(input);

        // TODO "-- use name --"
        var output = tproc.process(input, params);
        throw output;
      }
    },


    callsign: function() {
      var c = {};
      const signs = "alpha bravo charlie delta echo foxtrot golf hotel india  \
        juliet kilo lima mike november oscar papa quebec romeo \
        sierra tango umbrella victor whisky x-ray yankee zulu".split(/ /);
      for (var i in signs)
        c[ signs[i].substring(0,1) ] = signs[i];

      return c;
    }
}

})()
