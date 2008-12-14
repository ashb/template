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
   
    __build_case: function(opt) {
      return function() {
        this.expect(2);
        var output = opt.tproc.process(opt.input, opt.params);
        this.ok(true, 'Template ' + opt.name + ' processed okay');

        // strip any trailing blank lines from expected and real output
        // I dont agree with this, but its for compat with the perl TT tests
        output = output.replace(/[\r\n]*$/, '');
        var expect = opt.expect.replace(/[\r\n]*$/, '');
        if (!this.same(output, expect)) {
          print('  got: ',output.toSource());
          print('  want:',expect.toSource());
        }
      }
    },

    // This is the main testing sub-routine.
    build_tests: function (data, tproc, params) {
      var tprocs;

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
      
      if (tproc instanceof Object && !(tproc instanceof Template)) {
        // Key value pairs of processors
        tprocs = tproc;
        for (var i in tproc) {
          tproc = tproc[i];
          break;
        }
      }
      if (!tproc)
        tproc = new Template;

      this.test_prelude = function() {
        this.expect(3);
           
        // first test is that we got hte data to test
        this.ok(1, "running test_expect()");


        this.ok(tproc, "template processor is engaged");

        // third test is that the input read ok, which it did
        this.ok(1, "input read and split into " + tests.length + " tests");
      }

      var count = 0;

      for (var i in tests) {
        var input = tests[i];
        count++;
        var name ;

        var test = {
          tproc: tproc,
          params: params,
          name: 'template text ' + count
        }
        input = input.replace(
          /^\s*-- name:? (.*?) --\s*\n/im, 
          function(whole,n) { name = test.name = n; return '' }
        );
        input = input.replace(
          /^\s*--\s*use\s+(\S+)\s*--\s*\n/im, 
          function(whole,n) { 
            var tproc_ = tprocs[n];
            if (tproc_) {
              tproc = tproc_;
              test.tproc = tproc_;
            }
            else
              warn("no such template object to use: " + n);
            return '';
          }
        );


        // split input by a line like "-- expect --"
        var split = input.split(/^\s*--\s*expect\s*--\s*\n/im);
        test.expect = split[1] || '';
        test.input = split[0];

        this['test_' + (name || count)] = this.__build_case(test);
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
