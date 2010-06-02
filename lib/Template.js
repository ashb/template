/*
* Copyright (c) 2007, Ashley Berlin
* All rights reserved.
*
* Redistribution and use in source and binary forms, with or without
* modification, are permitted provided that the following conditions are met:
*     * Redistributions of source code must retain the above copyright
*       notice, this list of conditions and the following disclaimer.
*     * Redistributions in binary form must reproduce the above copyright
*       notice, this list of conditions and the following disclaimer in the
*       documentation and/or other materials provided with the distribution.
*     * Neither the name of the <organization> nor the
*       names of its contributors may be used to endorse or promote products
*       derived from this software without specific prior written permission.
*
* THIS SOFTWARE IS PROVIDED BY THE AUTHOR ``AS IS'' AND ANY
* EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
* WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
* DISCLAIMED. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY
* DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
* (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
* LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
* ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
* (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
* SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

/**
 * == Module ==
 *
 * Module exports from the `Template` module.
**/

/**
 * == Template ==
 *
 * Template toolkit classes and what-nots.
 **/

/** section: Module
 * exports
 **/

/** related_to: Template#parse
 * exports.render() -> String
 *
 * Renders the template
 **/
if (!this.exports) this.exports = {};

/** section: Module 
 *  class exports.Template
 *
 *  Port of perl's Template Toolkit to javascript
**/

/**
 *  new exports.Template(config)
 *  - config (Object): dictionary containing config properties
 *
 *  Create a new Template parser/context/run-time stack. `config` currently
 *  understands the following keys:
 *
 *  - BLOCKS (`Object`): foobar
 *  - TRIM (`boolean`): trim leading and trailing whitespace from output.
 *  - FILTERS (`Object`): extra filter to define on this render.
 *  - POST_COMP: whitespace chomp setting for after `%]` blocks
 *  - PRE_COMP: whitespace chomp setting for before `[%` blocks
 **/
var Template = exports.Template = function Template(config) {
  config = config || {};
  for (var param in config) {
    this[param] = config[param];
  }

  this.blocks = {}
 
  var blocks = config.BLOCKS || {};
  for (var b in blocks) {
    if (blocks.hasOwnProperty(b) == false)
      continue;

    var block = blocks[b];

    if (block instanceof Function) {
      this.blocks[b] = block;
      continue;
    }
    
    // Else stringify it then parse it
    var parser = new Template.Parser(this);
    parser.parse(block.toString());
    var ti = new Template.Interpreter(parser.chunks(), this);
    this.blocks[b] = eval('('+ti.output+')');
  }

};


Template.Constants = {
  CHOMP_NONE: 0,
  CHOMP_ONE: 1,
  CHOMP_COLLAPSE: 2,
  CHOMP_GREEDY: 3

};

Template.Exception = function(code, message) {
  this.type = code;
  this.info = message;
}
Template.Exception.prototype.__proto__ = Error.prototype;
Template.Exception.prototype.name = "Template.Exception";
Template.Exception.prototype.toString = function() {
  return this.type + " error - " + this.info;
}

// Just a place for constants
Template.Stash = {
  'PRIVATE': /^[._]/
}

/** section: Template
 * VMethods
 *
 * Template toolkit has the notion of 'virtual methods' - which are methods
 * defined on `Template.VMethods.<TYPE>_OPS` (where `<TYPE>` is the object
 * type; one of `ARRAY` for Arrays, `HASH` for other objects and `SCALAR` for
 * everything else (primitive values such as strings or numbers).
 *
 * For instance, to define a rot13 virtual method on strings, such that the
 * following example works:
 *
 *     lang: templatetoolkit
 *     [% SET str = "ABC";
 *       str.rot13;
 *     %]
 *
 * You would do:
 *
 *     require('Template').Template.VMethods.SCALAR_OPS.rot13 = function() { 
 *       // `this` is the string the vmethod is called upon
 *     }
 * 
 **/
Template.VMethods = {
  ROOT_OPS: {
    inc: function(x) {
      return ++x;
    },
    dec: function(x) {
      return --x;
    }
  },
  SCALAR_OPS: {},

  /** 
   * VMethods.HASH_OPS
   *
   * Virtual methods that can be called on hashes/objects in TT
   **/
  HASH_OPS: {

    /**
     * VMethods.HASH_OPS#keys() -> Array
     *
     * Return a list of keys on this object
    **/
    keys: function() {
      // A generator would be nice here.
      // return [i for (ver i in obj)]
      var k = [];
      for (var key in this)
        k.push(key);
      return k;
    },

    /**
     * VMethods.HASH_OPS#import(hash2) -> Object
     * - hash2 (Object): object to copy from
     *
     * Copy every value from hash2 into the current hash
    **/
    'import': function(hash2) {
      for (var key in hash2) {
        this[key] = hash2[key];
      }
      return '';
    }
  },

  /**
   * VMethods.LIST_OPS
   *
   * Virtual methods that can be called on lists/arrays in TT.
   *
   * All instance methods are called with an Array as the `this` object.
   **/
  LIST_OPS: {
    /**
     * VMethods.LIST_OPS#sort([key]) -> Array
     * - key (String): optional key name to sort on.
     *
     * Sort the array. If `key` is not provided, the array is sorted
     * (case-insensitively) based on the values. If `key` is provided, then
     * the array is assumed to contain objects. 
     *
     * ##### Example #####
     *
     *     lang: templatetoolkit
     *     [% SET a = [4,3,2];
     *        a = a.sort; 
     *        # -> a == [2,3,4]
     *        SET a = [ { foo: 2 }, { foo: 1} ]
     *        a = a.sort('foo')
     *        # -> a == [ { foo: 1}, { foo: 2} ]
     *     %]
    **/
    sort: function sort(key) {
      if (key !== undefined) {
        return this.sort(function(a,b) {
          a = a[key]; b = b[key];
          return a < b ? -1 : a > b ? 1 : 0;
        });
      }
      return this.sort(function(a,b) {
        a = a.toLowerCase(); b = b.toLowerCase();
        return a < b ? -1 : a > b ? 1 : 0;
      });
    },
    /**
     * VMethods.LIST_OPS#push(val) -> undefined
     * - val (Any): new element.
     *
     * Push `val` onto the end of the array.
    **/
    push: function push(x) { this.push(x); },

    /**
     * VMethods.LIST_OPS#join([sep]) -> String
     * - sep (String): separator character; default "," 
     *
     * Join all elements into a single string separated by `sep`.
    **/
    join: Array.prototype.join,

    /**
     * VMethods.LIST_OPS#reverse() -> Array
     *
     * Return an array with the elements in the reverse order
    **/
    reverse: Array.prototype.reverse,

    /**
     * VMethods.LIST_OPS#size() -> Number
     *
     * Number of elements in this arrray
    **/
    size: function size() { return this.length }
  }
}

Template.prototype = {
  constructor: Template,

  /** section: Module
   * exports.Template#process(input, params) -> String
   * - input (String): the template toolkit string (not file) to parse
   * - params (Object): params/stash/context for the template
   *
   * Parse the TT string using the given variables and return the processed
   * output.
   **/
  process: function Template$prototype$process(input, params) {
    // Reset.
    this.parserOutput = [];

    var parser = new Template.Parser(this);
    var ctx = new Template.Context(this);

    parser.parse(input);
    this.parserTokens = [].concat(parser._tokenBuffer);
    if (this.DBG_OUTPUT_TOKENS)
      require('system').stderr.print('# Tokens: ' + this.parserTokens.toSource());
    var chunks = parser.chunks();
 
    this.parserOutput = [].concat(chunks);

    if (this.DBG_OUTPUT_CHUNKS)
      require('system').stderr.print('# Chunks: ' + chunks.toSource());

    var ti = new Template.Interpreter(chunks, this);

    this.interpreterOutput = ti.output;

    if (this.DBG_OUTPUT_FUNC)
      require('system').stderr.print(ti.output);

    var func = eval('('+ti.output+')');

    if (!params.global)
      params.global = {};

    var Stash = function () { };
    Stash.prototype = params;
    Stash.global = params.global;

    ctx.stash = new Stash();

    var ret = func(ctx);
    if (!this.TRIM)
      return ret;

    return ret.replace(/^\s*([\s\S]*?)\s*$/, '$1');

  }

};

Template.escapeString = function (str) {
    var hexDigits = "0123456789ABCDEF";
    var hex = function (d) { return hexDigits[d >> 8] + hexDigits[d & 0x0F]; }
    var esc = function (string) {
        return string.replace(/[\x00-\x1F'\\]/g,
                    function (x) {
                        if (x === "'" || x === "\\") return "\\" + x;
                        return "\\x" + hex(x.charCodeAt(0));
                    });
    }
    if (typeof str === "string") return "'" + esc(str) + "'";
    else throw new Template.Exception("escape", "Called escapeString on a non-string: " + str);
};

/** section: Template
 * Filters
 **/
Template.Filters = {
  /** 
   *  Filters.html(text) -> String
   *  - text (String): string to html escape
   *
   **/
  html: function(text) {
    return text.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;')
               .replace(/"/g, '&quot;');
  }
};

Template.Context = function (config) { 
  this.config = config || {};
  this.global = {};
  this.blocks = this.config.blocks || {};
  this.filters = [ this.config.FILTERS || {}, Template.Filters ];

  // default include path
  this.config.INCLUDE_PATH = this.config.INCLUDE_PATH || [ "." ];
};

Template.Context.prototype = {

  clone: function clone(obj, deep) {
    // A clone of an object is an empty object 
    // with a prototype reference to the original.

    // a private constructor, used only by this one clone.
    function Clone() { } 
    Clone.prototype = obj;

    if (!deep)
      return new Clone()

    var c = new Clone();

    for (var i in obj) {
      if (obj.hasOwnProperty(i) && typeof obj[i] == 'object')
        c[i] = clone(obj[i], true);
    }
    return c;
  },

  parse_file: function(file) {
    if ("config" in this == false)
      throw new Template.Exception("NO_CONFIG", "No config");

    var contents;
    for (var i in this.config.INCLUDE_PATH) {
      try {
        var f = this.config.INCLUDE_PATH[i] + '/' + file;
        contents = this.load_file(f);
        break;
      }
      // TODO: Handle the error better would be nice
      catch (e) { }
    }
    if (contents === undefined)
      return contents;
    
    var parser = new Template.Parser(this.config);
    parser.parse(contents);
    var ti = new Template.Interpreter(parser.chunks(), this.config);
    return eval('('+ti.output+')');
  },

  include_block: function include_block(block, args) {
    var blocks = this.blocks;
    var stash = this.stash;

    this.blocks = this.clone(blocks);
    this.stash = this.clone(stash, true);

    try {
      return this.process_block(block, args);
    }
    finally {
      this.blocks = blocks;
      this.stash = stash;
    }
  },

  process_block: function(block,args) {
    var trim;
    if (block instanceof Function == false) {
      // Only trim defined blocks, not wrapper/anon-blocks
      trim = this.config.TRIM;
      block = block.toString();
      if (block in this.blocks == false) {
        // If its not a block, it must be a file
        var func = this.parse_file(block);

        if (func === undefined)
          throw new Template.Exception("file", block + ": not found");

        this.blocks[block] = func;
      }
      block = this.blocks[block];
    }

    args = args || [];
    for (var i in args) {
      var arg = args[i]; 

      this.dot_op(this.stash, [arg[0]], {assign: arg[1]});
    }

    var ret = block(this);

    if (trim) {
      ret = ret.replace(/^\s*([\s\S]*?)\s*$/, '$1');
    }
    
    return ret;
  },

  nullObj: { toString: function() { return ''; } },

  dot_op: function Template$Context$dot_op(stash, segments, args) {
    var s = stash;

    if (!args) args = { };

    // We are assigning, so create dict objects as needed...
    if ('assign' in args) {
      var last_seg = segments.pop();
      if (Template.Stash.PRIVATE && Template.Stash.PRIVATE.exec(last_seg))
        return undefined;

      for (var i in segments) {
        var segment = segments[i];
        if (Template.Stash.PRIVATE && Template.Stash.PRIVATE.exec(segment))
          return undefined;

        if (s[segment] === undefined) {
          s[segment] = {};
        }
        s = s[segment];
      }

      var ret = s[last_seg];
      if (!args['default'] || !ret)
        ret = s[last_seg] = args.assign;

      return ret;
    }

    for (var i in segments) {
      var segment = segments[i];
      if (Template.Stash.PRIVATE && Template.Stash.PRIVATE.exec(segment))
        return this.nullObj;

      var op_args = [];
      if (i == segments.length - 1)
        op_args = args.args || [];
      
      // Check vmeths - whats the priority of them?
      if (s[segment] === undefined || s[segment] == null)
        break ;//this.nullObj;
      else if (s instanceof Array && Template.VMethods.LIST_OPS[segment])
        s = Template.VMethods.LIST_OPS[segment].apply(s, op_args);
      else if (s instanceof Object && Template.VMethods.HASH_OPS[segment])
        s = Template.VMethods.HASH_OPS[segment].apply(s, op_args);
      else if (Template.VMethods.SCALAR_OPS[segment])
        s = Template.VMethods.SCALAR_OPS.apply(s, op_args);
      else if (s[segment] instanceof Function)
        s = s[segment].apply(s, op_args);
      else 
        s = s[segment];
    }
    
    // 4.140000000000001 -> 4.14 fix
    if (typeof s == 'number' && /\.[0-9]*00000[1-9]+$/.exec(s)) {
      return s.toPrecision(12).replace(/0+$/, '');
    }

    // ROOT_OPS
    if (s === undefined && segments.length == 1 && 
        this.stash === stash &&
        segments[0] in Template.VMethods.ROOT_OPS) {
      s = Template.VMethods.ROOT_OPS[segments[0]].apply(stash, args.args || [] );
    }
    return s === undefined ? this.nullObj : s;
  },

  $setLoop: function(idx, size) {
    this.dot_op(this.stash, ["loop"], {
      assign: {
        index: idx,
        first: idx == 0,
        count: ++idx,
        'number': idx,
        size: size,
        last: idx == size
      } 
    } )
  },

  $forEachGenerator: function(a, func, novar) {
      function next_val() {
        try {
          return a.next();
        } catch (e) { if (e !== StopIteration) throw e }
        return undefined;
      }

      var idx = 0;
      var curr = next_val(), next = next_val();
      while (curr !== undefined) {
        if (novar && typeof a[curr] == 'object') {
          for (var key in a[curr]) {
            this.stash[key] = a[curr][key];
          }
        }
        this.$setLoop(idx++, next !== undefined ? next+1 : undefined);
        if ( func(a[curr]) == this.StopIteration)
          break;
        curr = next;
        next = next_val();
      }
  },

  // Loop over (sorted) keys of object
  $forEachObject: function(a, func, novar) {
    var keys = [];
    if (Object.keys)
      keys = Object.keys(a);
    else {
      for (var i in a)
        keys.push(i);
    }
    keys = keys.sort();

    for (var i =0; i < keys.length; i++) {
      this.$setLoop(i, a.length || 0);
      if (func({key: keys[i], value: a[keys[i]] }) == this.StopIteration)
        break;
    }
  },
  
  /*
   * For each wrapper that promotes var to an array
   */
  forEach: function(a, func, novar) {
    if (a === undefined || a === this.nullObj)
      return undefined;

    var stash = this.stash;
    var old_loop = this.stash.loop;
    try {
      if (novar) {
        this.stash = this.clone(stash);
      }

      // Generator - SM1.8+ism
      if (a.__iterator__ && a.__iterator__() === a) {
        return this.$forEachGenerator(a, func, novar);
      }
      else if (a instanceof Array == false) {
        if (!novar && typeof a == "object") {
          return this.$forEachObject(a, func, novar);
        }
        a = [a];
      }

      for (var i =0; i < a.length; i++) {
        if (novar && typeof a[i] == 'object') {
          for (var key in a[i]) {
            this.stash[key] = a[i][key];
          }
        }
        this.$setLoop(i, a.length);
        if (func(a[i] || undefined) == this.StopIteration)
          break;
      }
    }
    finally {
      this.stash = stash;
      if (!novar && old_loop)
        this.stash.loop = old_loop;
    }
    return undefined;
  },

  // Default implementation if no file IO.
  load_file: function load_file(file) {
    throw new Template.Exception("file", Template.escapeString(file) + ": not found");
  },

  $catch: function $catch(err) {
    var errType = typeof err == "object" &&
                  err.constructor &&
                  err.constructor.name
                ? err.constructor.name
                : 'undef';
    if (!(err instanceof Template.Exception) ) {
      err = new Template.Exception('undef', err);
    }
    this.dot_op(this.stash, ["error"], { assign: err } );
    this.dot_op(this.stash, ["e"], { assign: err } );
    return err;
  },

  $error_matches: function $error_matches(err, type) {
    if (err.type == type)
      return true;
    type += '.';
    return err.type.substr(0,type.length) == type;
  },

  filter: function filter(name, args) {
    var flt;

    for (var i in this.filters) {
      if (name in this.filters[i] == false)
        continue;
      flt = this.filters[i][name];

      if (typeof flt != "function") {
        throw new Template.Exception( "filter",
            "invalid FILTER entry for '" + name + "' (not a function)"
        );
      }
    }

    if (!flt) {
      throw new Template.Exception("filter",
                                   Template.escapeString(name) + ": not found");
    }

    return flt;

  }
};

try { 
  var fs = require('fs-base');
  
  if (typeof fs != 'undefined' && 'rawOpen' in fs) {
    Template.Context.prototype.load_file = function load_file(file) { 

      var f;
      try {
        f = new fs.rawOpen(file, 'r');
      }
      catch (e) {
        throw new Template.Exception("file", Template.escapeString(file) + ": not found");
      }

      return f.readWhole();
    }
  }
} catch (e) {
    // try Node.js
    try {
        var fs = require("fs");
        if (typeof fs != "undefined" && "readFileSync" in fs) {
            Template.Context.prototype.load_file = function load_file (file) { 
                var f;
                try {
                    return fs.readFileSync(file);
                }
                catch (e) {
                    throw new Template.Exception("file", Template.escapeString(file) + ": not found");
                }
            };
        }
    }
    catch (e) {}
}

Template.Parser = function (config) {
  this.end_tag   = this.default_end_tag;
  this.start_tag = this.default_start_tag;
  this.min_precedence  = 0;
  this._tokenWatermark = 0;
  this._tokenBuffer    = [];

  if (!config)
    config = {};

  this.config = config;

  if (config.DEBUG) {
    var self = this;
    // DEBUG logging of calls!
    this._tracedFunctions.split(/\s+/).forEach(function(name) {
      var func = self.__proto__[name];
      self[name] = function Template$Parser$prototype$logCall() {
        try {
          if (name == 'consumeToken') {
            self._logCall(name + '(' + Template.escapeString(this.token.literal || this.token.type) + ')');

          } else if (name == 'assertToken') {
            self._logCall(name + '(' + arguments[0].toSource() + ')');
          } else if (name == 'binary_expr') {
            self._logCall(name + '(' + (arguments[1] || 0) + ')');
          } else {
            self._logCall(name);
          }
          var ret = func.apply(self, arguments);
          self._exitCall(name);
          return ret;
        } catch (e) {
          self._exitCall(name, 1);
          throw e;
        }
      };
      self[name].origFunc = func;
    });

    this._callIndent = "";
  }
};

Template.Parser.prototype = {

  _logCall: function(name) {
    /*if (confirm(name) == false)
      throw new Error('cancalled at user request');*/
    this.log('* ' + this._callIndent + name);
    this._callIndent += '  ';
  },
  _exitCall: function(name, errorHappened) {
    this._callIndent = this._callIndent.substr(0, this._callIndent.length - 2);
    if (name != "consumeToken")
      this.log('* ' + this._callIndent + (errorHappened ? 'died in ' : 'end ' ) + name);
  },

  // These must be 'regexp-escaped'
  default_start_tag: '\\[%',
  default_end_tag: '%\\]',


  _getToken: function Template$Parser$prototype$_getToken() {
    if (this._tokenBuffer.length > this._tokenWatermark) {
      return this._tokenBuffer[this._tokenWatermark];
    }
    return {type: "NUL"};

  },

  consumeToken: function Template$Parser$prototype$consumeToken() {
    if (this._tokenWatermark >= this._tokenBuffer.length)
      this.parseError(new Error("Tried to consume token when none were in the buffer!"));

    var ret = this.token;

    this._tokenWatermark++;
    this.token = this._getToken();
    return ret;
  },

  unconsumeToken: function() {
    if (this._tokenWatermark < 1)
      this.parseError(new Error("Tried to unconsume token when the buffer was already at start-of-block!"));
    
    this._tokenWatermark--;
    this.token = this._getToken();
  },

  parseError: function Template$parseError(msg) {
    // TODO: Sort out line number
    var substr = this.origInput.substr(this.token.position, 10).replace(/\n/g, '\\n');
    if (this.token.position + 10 < this.origInput.length)
      substr += '...';
    throw new Error(msg + " at '" + substr + "' " + Template.escapeString(this.token));
  },

  log: function(str) {
    if ( typeof window != "undefined" && window.console) {
      this.log = function(str) { 
        return console.log.call(console.log, str.replace(/%([a-z])/g, '%%$1')) 
      };
      return this.log(str);
    }
    else if (typeof print != "undefined") {
      this.log = function(str) { print(str) };
      return this.log(str);
    } 
    else {
      if (!this._log)
        this._log = [];
      this.log = function (str) {
        this._log.push(str);
      }
      return this.log(str);
    }
  },

  assertToken: function assertToken(token, msg) {
    if (typeof token == "string") {
      if (this.token.type != token) {
        this.parseError(msg ? msg : token + ' expected');
      }
    }
    else if (token.type != this.token.type) {
      this.parseError(msg ? msg : token.type + ' expected');
    }
    else if (token.literal && token.literal != this.token.literal) {
      this.parseError(msg ? msg : "'" + token.type + "' expected"); 
    }
    return this.consumeToken();
  },

  assertRule: function Template$Parser$prototype$assertRule(ruleFunc, args) {
    var ret = ruleFunc.apply(this, args);

    if (ruleFunc.origFunc) {
      // DEBUG call logging enabled
      ruleFunc = ruleFunc.origFunc;
    }

    var msg;
    if (ret === undefined) {
      // No message passed, search prototype for function name
      for (var name in this.__proto__) {
        if (this.__proto__[name] === ruleFunc) {
          msg = name + ' expected';
          break;
        }
      }
      if (!msg)
        msg = ruleFunc.name || ruleFunc.toSource();

      this.parseError(msg);
    }
    return ret;
  },

  /* this cant be a regexp object, since we need to anchor it to different places... */
  chompFlags: "[-=~+]",

  /* Chomp chars to integer values */
  chompValues : { 
    '+': Template.Constants.CHOMP_NONE,
    '-': Template.Constants.CHOMP_ONE,
    '=': Template.Constants.CHOMP_COLLAPSE,
    '~': Template.Constants.CHOMP_GREEDY
  },

  precedence: {
    '?' : 0,
    ':' : 0,

    '==': 2,
    '!=': 2,
    '<' : 2,
    '>' : 2,
    '>=': 2,
    '<=': 2,

    OR  : 5,
    AND : 5,

    CAT : 10,

    '-' : 20, 
    '+' : 20,
    
    '%' : 30,

    '*' : 40,
    '/' : 40,
    DIV : 40
  },

  /* 
   * Examine str and split into a list of tokens representing the entire string
   * (including blocks and chunks of text)
   */
  parse: function Template$Parser$prototype$parse(str) {
    // First work out where the start_tag is
    var self = this;

    // ^ doesn't anchor to beging of string only in multi-line mode, it also
    // anchors to start of line This is not what we want, so use .|\n and no /m
    // flag
    var re = new RegExp('^((?:.|\\n)*?)(?:(' + this.start_tag + 
                        ')((?:.|\\n)*?)(' + this.end_tag + '))');
    this.origInput = str;

    var pos=0;
    var post = str;

    var match,pre,dir;

    this._tokenBuffer = [];

    while (1) {
      var postchomp = this.config.POST_CHOMP;
      var left = post.replace(re, function(entire, pre, start,dir,end) {

        if (dir) {
          if(dir[0] == '#') {
            // Comment out entire directive bar any end chomp flag
            dir = dir.match(new RegExp( self.chompFlags + '$' ) ) || '';
          } else {
            var chomp = self.config.PRE_CHOMP;
            dir = dir.replace(new RegExp('^(' + self.chompFlags + ')'), 
                function(entire, flag) {
                    chomp = self.chompValues[flag];
                    return '';
                }
            );


            if (chomp && pre) {
              switch (chomp) {
              case Template.Constants.CHOMP_NONE:
                break;
              case Template.Constants.CHOMP_ONE:
                pre = pre.replace(/\n?[^\S\n]*$/, '');
                break;
              case Template.Constants.CHOMP_COLLAPSE:
                pre = pre.replace(/\s*$/, ' ');
                break;
              case Template.Constants.CHOMP_GREEDY:
                pre = pre.replace(/\s*$/, '');
                break;
              default:
                throw new Error('unhandled prechomp flag ' + chomp);
              }
            }
           
            dir = dir.replace(new RegExp('(' + self.chompFlags + ')\s*$'), 
                function(entire, flag) {
                    postchomp = self.chompValues[flag];
                    return '';
                }
            );


          } // else not commented whole dir
        } // If (directive)
  
        if (pre.length) {
          if (self.config.INTERPOLATE)
            self._tokenBuffer = self._tokenBuffer.concat(self.interpolate_text(pre, pos));
          else
            self._tokenBuffer.push({type: 'TEXT', literal: pre, position: pos});
          
          pos += pre.length;
        }

        pos += start.length;
    
        // Append tokens from this directive to buffer 
        self._tokenBuffer = self._tokenBuffer.concat(self.tokenise(dir, pos));

        pos += dir.length;
        self._tokenBuffer.push({type: ';', position: pos, automatic: 1})

        // move pos past end tag
        pos += end.length;

        return "";
      });

      if (postchomp && left) {
        switch (postchomp) {
        case Template.Constants.CHOMP_NONE:
          break;
        case Template.Constants.CHOMP_ONE:
          left = left.replace(/^(?:[^\S\n]*\n)/, '');
          break;
        case Template.Constants.CHOMP_COLLAPSE:
          left = left.replace(/^\s*/, ' ');
          break;
        case Template.Constants.CHOMP_GREEDY:
          left = left.replace(/^\s*/, '');
          break;
        default:
          throw new Error('unhandled postchomp flag ' + postchomp);
        }
      }
            

      if (post.length == left.length)
        break;
      post = left;
    }

    // done with this now
    self = undefined;

    if (post.length) {
      // Anything after the last directive
      if (this.config.INTERPOLATE)
        this._tokenBuffer = this._tokenBuffer.concat(this.interpolate_text(post, pos));
      else
        this._tokenBuffer.push({type: 'TEXT', literal: post, position: pos});
    }

    this.token = this._getToken();

  },

  // This monster would be so much nicer if JS had the /x flag for regexps
  // Taken from Template::Parser
  tokenise_regexp: /(#[^\n]*)|(["'])((?:\\\\|\\\2|.|\n)*?)\2|(-?\d+(?:\.\d+)?)|(\/?\w+(?:(?:\/|::?)\w*)+|\/\w+)|(\w+)|([(){}\[\]:;,\/\\]|\->|[+\-*]|\$\{?|=>|[=!<>]?=|[!<>]|&&?|\|\|?|\.\.?|\S+)/mg,

  tokenise: function Template$Parser$prototype$tokenise(text, pos) {

    // if you use the /foobar/ constructor, you get a SINGLETON OBJECT - GRRRR
    var re = new RegExp(this.tokenise_regexp.source, 'mg');

    var type, match, token;
    var tokens = [];

    var initPos = pos;

    while ( (match = re.exec(text) ) ) {

      pos = initPos + re.lastIndex - match[0].length;
      // Comment in $1
      if (match[1])
        continue;

      // Quoted pharse in $3 (and quote char in $2)
      if ( (token = match[3]) ) {
        if (match[2] == '"') {
          if (token.match("[\$\\\\]") ) {
            type = 'QUOTED';
            /* unescape " and \ but leave \$ escaped so that 
             * interpolate_text doesn't incorrectly treat it
             * as a variable reference
             */
            token = token.replace(/\\([^\$nrt])/g, "$1");
            token = token.replace(/\\([nrt])/g, function(str) { return eval('"' + str + '"'); });
           
            tokens.push({type: '"', literal: '"', position: pos});
            pos++;
            var segments = this.interpolate_text(token, pos);

            tokens = tokens.concat(segments);

            pos += match[2].length;
            tokens.push({type: '"', literal: '"', position: pos});
            pos++;
            
            continue;
          }
          else {
            type = 'LITERAL';
            //TODO token =~ s['][\\']g;
            token = "'" + token + "'";
          }
        }
        else {
          type = 'LITERAL';
          token = "'" + token + "'";
        }
      } 
      else if (match[2]) {
        // Empty string
        type = 'LITERAL';
        token = "''";
      }

      // number
      else if ( (token = match[4]) !== undefined) {
        type ='NUMBER';
      }
      else if ( (token = match[5]) !== undefined) {
        type = 'FILENAME';
      }
      else if ( (token = match[6]) !== undefined) {
        // TODO: anycase support
        var uctoken = this.config.ANYCASE ? token.toUpperCase() : token;

        type = this.LEXTABLE[uctoken];
        if (type !== undefined) {
          token = uctoken;
        }
        else {
          type = 'IDENT';
        }
      }
      
      else if ( (token = match[7]) !== undefined) {
        // TODO: anycase support
        var uctoken = token;

        if (this.LEXTABLE[uctoken] === undefined) {
          type = 'UNQUOTED';
        }
        else {
          type = this.LEXTABLE[uctoken];
        }
      }
      else {
        throw new Error('Something went wrong in the tokeniser, and it matched nothing');
      }

      tokens.push({type: type, literal: token, position: pos });
    }

    return tokens;
  },

  /*
   * Examines text looking for any variable references embedded like $this or
   * like ${ this }.
   * 
   */

  interpolate_text: function Template$Parser$prototype$interpolate_text(text, pos) {
    var re = /((?:\\.|[^\$]){1,3000})|(\$(?:(?:\{([^\}]*)\})|([\w\.]+)))/g;
    
    var match, pre, v, dir;
    var tokens = [];
    while ( (match = re.exec(text)) ) {
      pre = match[1];
      dir = match[2];
      if (match[3])
        v = match[3];
      else
        v = match[4];

      if (pre && pre.length) {
        pos += pre.length;
        pre = pre.replace(/\\\$/, "$");
        tokens.push({type: 'TEXT', literal: pre, position: pos})
      }

      // $var reference
      if (v) {
        tokens = tokens.concat( this.tokenise(v, pos) );
        pos += v.length;
        tokens.push({type: ';', literal: ';', position: pos, automatic: 1});
      }
      else if (dir) {
        throw new Error('interpolate dir');
        tokens.push({type: 'TEXT', literal: dir, position: pos});
      }
    }
    return tokens;
  },

  LEXTABLE: {
    'FOREACH' : 'FOR',
    'BREAK'   : 'LAST',
    '&&'      : 'AND',
    '||'      : 'OR',
    '!'       : 'NOT',
    '|'      : 'FILTER',
    '.'       : 'DOT',
    '_'       : 'CAT',
    '..'      : 'TO',
//    ':'       : 'MACRO',
    '='       : 'ASSIGN',
    '=>'      : 'ASSIGN',
//    '->'      : 'ARROW',
    ','       : 'COMMA',
    '\\'      : 'REF',
    'and'     : 'AND',  // explicitly specified so that qw( and or
    'or'      : 'OR',   // not ) can always be used in lower case, 
    'not'     : 'NOT',  // regardless of ANYCASE flag
    'mod'     : '%',
    'MOD'     : '%',
    'div'     : 'DIV',

    // Reserved words
    GET: 'GET',
    CALL: 'CALL',
    SET: 'SET',
    DEFAULT: 'DEFAULT',
    INSERT: 'INSERT',
    INCLUDE: 'INCLUDE',
    PROCESS: 'PROCESS',
    WRAPPER: 'WRAPPER',
    BLOCK: 'BLOCK',
    END: 'END',
    USE: 'USE',
    PLUGIN: 'PLUGIN',
    FILTER: 'FILTER',
    MACRO: 'MACRO',
    PERL: 'PERL',
    RAWPERL: 'RAWPERL',
    TO: 'TO',
    STEP: 'STEP',
    AND: 'AND',
    OR: 'OR',
    NOT: 'NOT',
    DIV: 'DIV',
    //MOD: 'MOD',
    IF: 'IF',
    UNLESS: 'UNLESS',
    ELSE: 'ELSE',
    ELSIF: 'ELSIF',
    FOR: 'FOR',
    NEXT: 'NEXT',
    WHILE: 'WHILE',
    SWITCH: 'SWITCH',
    CASE: 'CASE',
    META: 'META',
    IN: 'IN',
    TRY: 'TRY',
    THROW: 'THROW',
    CATCH: 'CATCH',
    FINAL: 'FINAL',
    LAST: 'LAST',
    RETURN: 'RETURN',
    STOP: 'STOP',
    CLEAR: 'CLEAR',
    VIEW: 'VIEW',
    DEBUG: 'DEBUG',

    // cmp ops
    '!=': 'CMPOP',
    '==': 'CMPOP',
    '<' : 'CMPOP',
    '>' : 'CMPOP',
    '>=': 'CMPOP',
    '<=': 'CMPOP',

    // other bin ops
    '-': 'BINOP',
    '*': 'BINOP',
    '%': 'BINOP',

    // other tokens
    '(':'(',
    ')':')',
    '[':'[',
    ']':']',
    '{':'{',
    '}':'}',
    '${':'${',
    '$':'$',
    '+':'+',
    '/':'/',
    ';':';',
    ':':':',
    '?':'?'
  },


  // grammar rules
  expr: function Template$Parser$prototype$expr() {
    if (this.token.type === '(') {
      // '(' assign | expr ')'
      this.consumeToken();
      switch (this.token.type) {
        case 'IDENT':
        case '${':
        case '$':
        case 'LIERAL':
          break;
        default:
          var expr = this.assertRule(this.expr);
          this.assertToken(')')
          return expr;
      }

      // Could be and expr, or could be a assing
      var sterm = this.sterm();
      var ret;
      if (this.token.type == 'ASSIGN') {
        // assign
        this.consumeToken;
        ret = { type: 'ASSIGN', lhs: sterm, rhs: this.assertRule(this.expr) };
      } else {
        // expr
        ret = this.expr_tail(sterm);
      }
      this.assertToken(')');
      return ret;
    }

    var term = this.term();
    if (term === undefined)
      return term;
    return this.expr_tail(term);
  },

  expr_tail: function Template$Parser$prototype$expr_tail(term) {

    switch (this.token.type) {
      
      case '?':
      case 'CMPOP':
      case 'BINOP':
      // binary ops
      case '+':
      case '/':
      case '%':
      case 'DIV':
      case 'CAT':
      case 'AND':
      case 'OR':
        return this.binary_expr(term, this.min_precedence);

    }
    // end switch

    return term;
  },

  token_precedence: function(token) {
    token = token || this.token;
    if (token.type == 'CMPOP' || token.type == 'BINOP')
      token = token.literal;
    else
      token = token.type;

    return token in this.precedence ? this.precedence[token]
                                    : -1;
  },

  binary_expr: function Template$Parser$binary_expr(lhs, min_precedence) {
    var op, rhs, new_precedence;
    while ( this.token_precedence() >= min_precedence) {
      var watermark = this._tokenWatermark;
      op = this.consumeToken();
      new_precedence = this.token_precedence(op);
      if (op.type == 'CMPOP' || op.type == 'BINOP')
        op = op.literal;
      else
        op = op.type;

      //this.min_precedence = new_precedence;
      rhs = this.assertRule(this.term);
      while ( this.token_precedence() >= new_precedence) {
        rhs = this.binary_expr(rhs, this.token_precedence());
      }

      if (op == '?' && rhs.type != ':') {
        this._tokenWatermark = watermark;
        this._getToken();
        this.parseError(": expected after ?");
      } else {
        lhs = { type: op, lhs: lhs, rhs: rhs };
      }
    }
    return lhs;
  },

  term: function Template$Parser$prototype$term() {

    // Is this too low priority? sohuld it be NOT expr() instead of term() ?
    if (this.token.type == 'NOT') { 
      // NOT expr
      this.consumeToken();
      return { type: 'NOT', child: this.term() };
    }

    // todo: do this properly
    var term = this.lterm();
    if (term) {
      return term;
    }
    
    return this.sterm();
  },
  
  sterm: function Template$Parser$prototype$sterm() {
    switch (this.token.type) {
      case 'LITERAL':
      case 'NUMBER':
        return this.consumeToken();
      case 'REF':
        this.consumeToken();
        var ident = this.assertRule(this.ident);
        return { type: 'REF', ident: ident };
      case '"':
        this.consumeToken();
        var quoted = this.quoted();
        this.assertToken('"');
        return quoted;
      default:
        // might be an ident;
        return this.ident();
    }
  },

  quoted: function Template$Parser$prototype$quoted() {
    var segs = [];
    var loop = true;
    while (loop) {
      switch (this.token.type) {
        case ';':
          this.consumeToken();
          break;
        case 'TEXT':
          segs.push(this.consumeToken());
          break;
        default:
          var ident = this.ident();
          if (ident === undefined)
            loop = false;
          else
            segs.push(ident);
          break;
      }
    }

    if (segs.length)
      return {type: 'QUOTED', segments: segs };
    return undefined;
  },

  ident: function Template$Parser$prototype$ident() {
    // DOT separeted list of nodes, followed by an optional DOT number

    var segments = [this.node()];
    if (segments[0] === undefined)
      return undefined;

    while (this.token.type == 'DOT') {
      this.consumeToken();
      
      if (this.token.type == 'NUMBER') {
        segments.push(this.consumeToken());
        break;
      }
      segments.push(this.assertRule(this.node));
    }

    if (segments.length == 1)
      return segments[0];

    return {type: 'ident', segments: segments };
  },

  node: function Template$Parser$prototype$node() {
    var item = this.item();

    if (item !== undefined && this.token.type == '(') {
      this.consumeToken();
      // args
      var ret = {type: 'function_call', func: item };
      ret.args = this.assertRule(this.args);
      this.assertToken(')');
      return ret;
    }
    return item;
  },

  args: function Template$Parser$prototype$args() {
    // named params are stored in ret[0]
    var ret = [ [] ];

    while (1) {
      var ident;
     
      // due to the way ident is written, it will return an ident or item rules
      // so just handle the LITERAL case of param here
      if (this.token.type == 'LITERAL')
        ident = this.consumeToken();
      else 
        ident = this.ident();

      if (ident !== undefined) {
        // an expr could be an ident or a LITERAL, so make sure we have an `=' afterwards
        if (this.token.type != 'ASSIGN') {
          ret.push(ident);
        }
        else {
          // we have a named param
          this.assertToken('ASSIGN');
          ret[0].push(ident);
          ret[0].push(this.assertRule(this.expr));
        }
      } else {
        // else we have a position param
        var expr = this.expr();

        if (expr === undefined)
          break;

        ret.push(expr);
      }

      // Its hard to detect a expr here. It can start with:
      // + / DIV MOD CAT AND OR BINOP CMPOP ? (
      switch (this.token.type) {
        case 'COMMA':
          this.consumeToken();
          break;
        case '(':
        case '?':
        case 'CMPOP':
        case 'BINOP':
        case '+':
        case '/':
        case 'DIV':
        case '%':
        case 'CAT':
        case 'AND':
        case 'OR':
          ident = ret.pop();
          ret.push(this.assertRule(this.expr_tail, [ident]));
          break;
      }

      // Gah - comma is optional
      if (this.token.type == 'COMMA')
        this.consumeToken();
    }

    return ret;
  },

  item: function Template$Parser$prototype$item() {
    var ret;
    switch (this.token.type) {
      case 'IDENT':
        return this.consumeToken();
      case '${':
        this.consumeToken();
        ret = { type: 'interpret', term: this.assertRule(this.sterm) };
        this.consumeToken('}');
        return ret;
      case '$':
        this.consumeToken();
        var ident = this.assertToken('IDENT');
        if (this.config.V1DOLLAR)
          ret = ident;
        else
          ret = { type: 'interpret', term: ident };
        return ret;
      default:
        return undefined;
    }

  },

  lterm: function Template$Parser$prototype$lterm() {
    if (this.token.type == '[') {
      // list, range or empty
      this.consumeToken();

      if (this.token.type == ']') {
        // empty list
        this.consumeToken();
        return {type: 'array', items: [] };
      }
      // range starts with an sterm, list with a term
      var term = this.sterm();

      // could be a range - see if next char is TO '..'
      if (term !== undefined) {
        if (this.token.type == 'TO') {
          this.consumeToken();
          var ret = { type: 'range', from: term, to: this.assertRule(this.sterm) };
          this.assertToken(']');
          return ret;
        }
        // Not followed by a TO, therefore must be a list - just drop out

      } else {
        // No sterm, must be an lterm then
        term = this.assertRule(this.lterm);
      }

      // If we get here, we know we have a list
      var ret = { type: 'array', items: [term] };
  
      while (this.token.type != ']' && this.token.type != 'NUL') {
        if (this.token.type == 'COMMA') {
          this.consumeToken();
          continue;
        }
        ret.items.push(this.assertRule(this.term));
      }

      this.assertToken(']');
      return ret;

    } else if (this.token.type == '{') {
      // hash

      this.consumeToken();

      // cant store data as a dict since it might need interpreting
      var ret = {type: 'hash', data: this.assertRule(this.params) };

      this.assertToken('}');
      
      return ret;
    }
    return undefined;
  },

  params: function Template$Parser$prototype$params() {
    var items = [this.assertRule(this.param)];

    while (this.token.type != 'NUL') {
      if (this.token.type == 'COMMA') {
        this.consumeToken();
        continue;
      }

      var item = this.param();

      if (item === undefined)
        break;
      items.push(item);
    }
 
    return items;
  },

  param: function Template$Parser$prototype$param() {
    var ret = { type: 'assign' };

    if (this.token.type == 'LITERAL') {
      ret.to = this.consumeToken();
    } else {
      ret.to = this.item();
      if (ret.to === undefined)
        return undefined;
    }

    this.assertToken('ASSIGN');

    ret.value = this.assertRule(this.expr);

    return ret;
  },

  /*
   * capture, expr, condition (post-fixed only) and setlist all start with 
   * ambigious things - so this rule embodies this
   */
  complex_statement: function Template$Parser$prototype$complex_statement() {
  
    var expr;

    if (this.token.type == 'LITERAL') {
      // only setlist or expr can start with a LITERAL
      var lit = this.consumeToken();

      // If we have an ASSIGN next, we _must_ be a setlist
      if (this.token.type == 'ASSIGN') {

        this.consumeToken();
        return this.setlist_tail(lit); 

      } else {

        // expr
        expr = this.expr_tail(lit);
      }
    } else {

      var ident = this.ident();

      if (ident !== undefined) {

        // At this point, we can be an expr, a setlist or a capture

        if (this.token.type == 'ASSIGN') {
          // A capture or a setlist
          this.consumeToken();

          if (this.token.type == 'BLOCK') {
            // mdir
            throw new Error('mdir');
          }

          //throw new Error('WTF do i do here' + ident.toSource());
          // TODO: Capture;

          
          return this.setlist_tail(ident);
        } else {
          expr = this.expr_tail(ident);
        }
      }
      else {
        // Not an expression that starts with an ident (probably quoted)
        expr = this.expr();
        if (!expr)
          return undefined;
      }
      
    }

    if (expr) {
      return this.postfixed_condition(expr);
    }
    return undefined;
  },

  // called with an ident or a LITERAL, and the first ASSIGN already consumed
  setlist_tail: function Template$Parser$prototype$setlist_tail(ident) {

    var as = [{ type: 'ASSIGN', lhs: ident }];
    if (this.token.type == 'LITERAL')
      as[0].rhs = this.consumeToken();
    else
      as[0].rhs = this.assertRule(this.expr);

    while (this.token.type != ';') {
      if (this.token.type == 'NUL')
        break;

      // comma seperators are optional
      if (this.token.type == 'COMMA') {
        this.consumeToken();
        continue;
      }

      var i;
      if (this.token.type == 'LITERAL')
        i = this.consumeToken();
      else
        i = this.assertRule(this.ident);

      this.assertToken('ASSIGN');
      as.push( { type: 'ASSIGN', lhs: i, rhs: this.assertRule(this.expr) } );
    }
    return {type: 'setlist', chunks: as};
  },


  postfixed_condition: function Template$Parser$prototype$postfixed_condition(expr) {
    if (this.token.type == 'IF' || this.token.type =='UNLESS') {
      var ret = {type: this.consumeToken().type, body: [expr] };
      ret.condition = this.assertRule(this.expr);
      return this.postfixed_condition(ret);
    }
    if (this.token.type == 'WRAPPER') {
      this.consumeToken();
      var nameargs = this.assertRule(this.nameargs);
      nameargs.type = 'WRAPPER';
      nameargs.chunks = [expr];

      return this.postfixed_condition(nameargs);
    }
    if (this.token.type == 'FOR' || this.token.type == 'WHILE') {
      var token = this.consumeToken();
      var ret = { 
        type: token.type, 
        loopvar: this.assertRule(token.type == 'FOR' ? this.loopvar : this.expr), 
        chunks: [expr]
      };
      return this.postfixed_condition(ret);
    }

    if (this.token.type == 'FILTER') {
      var ret = {
        type: this.consumeToken().type,
        chunks: [expr],
        filter: this.assertRule(this.lnameargs)
      };
      return ret;
    }

    return expr;
  },


  atomexpr: function Template$Parser$prototype$atomexpr() {
    return this.expr();
  },

  atomdir: function Template$Parser$prototype$atomdir() {
    switch (this.token.type) {
      case 'GET':
      case 'CALL':
        return { type: this.consumeToken().type, 
                 expr: this.assertRule(this.expr)
               };

      case 'SET':
        this.consumeToken();
        return this.assertRule(this.setlist);
      case 'DEFAULT':
        return { type: this.consumeToken().type, expr: 
                 this.assertRule(this.setlist) 
               };
      case 'INSERT':
      case 'INCLUDE':
      case 'PROCESS':
      case 'THROW':
        var type = this.consumeToken().type;
        var nameargs = this.assertRule(this.nameargs);
        nameargs.type = type;
        return nameargs;
      case 'NEXT':
      case 'LAST':
      case 'CLEAR':
        return this.consumeToken();
      default:
        return undefined;
    }
  },

  loop: function Template$Parser$prototype$loop() {
    if (this.token.type == 'FOR' || this.token.type == 'WHILE') {
      var token = this.consumeToken();
      var ret = { type: token.type, 
                  loopvar: this.assertRule(token.type == 'FOR' ? this.loopvar : this.expr), 
                  chunks: [] 
                };
      this.assertToken(';');
      while (this.token.type != 'END') {
        if (this.token.type == 'NUL') // EOF
          break;
        ret.chunks.push(this.chunk());
      }
      this.assertToken('END');
      return ret;
    }
    return undefined;
  },

  loopvar: function Template$Parser$prototype$loopvar() {
    var ident;
    if (this.token.type == 'IDENT') {
      ident = this.consumeToken();
      if (this.token.type == 'ASSIGN')
        this.consumeToken();
      else if (this.token.type == 'IN')
        this.consumeToken();
      else {
        ident = undefined;
        this.unconsumeToken();
      }
    }
    var ret = { term: this.assertRule(this.term), args: this.args() };
    if (ident)
      ret.ident = ident;

    return ret;
  },

  // `Top level' gramar rules
  chunks: function Template$Parser$prototype$chunks() {
    var chunks = [];
    while (this.token.type != 'NUL') {
      chunks.push(this.chunk());
    }
    return chunks;
  },

  chunk: function Template$Parser$prototype$chunk() {
    if (this.token.type == 'TEXT') {
      return this.consumeToken();
    } else if (this.token.type == ';') {
      this.consumeToken();
      return undefined;
    } else {
      var ret = this.assertRule(this.statement);
      this.assertToken(';');
      return ret;
    }
  },

  statement: function Template$Parser$prototype$statment() {
    return this.complex_statement() || this.directive() || 
           this.block() || this.wrapper_like() || this.filter() ||
           this.expr();
  },

  directive: function Template$Parser$prototype$directive() {
    var atom = this.atomdir();

    if (atom)
      return this.postfixed_condition(atom);
    
    return this.condition() || this.switchBlock() || 
           this.loop() || this.tryCatch();
  },

  condition: function Template$Parser$prototype$condition() {
    if (this.token.type == 'IF' || this.token.type == 'UNLESS') {
      var ret = {type: this.consumeToken().type };
      ret.condition = this.assertRule(this.expr);
      this.assertToken(';');
      ret.body = [];
      while (['END', 'ELSE', 'ELSIF'].indexOf(this.token.type) == -1) {
        if (this.token.type == 'NUL') // EOF
          break;
        ret.body.push(this.chunk());
      }

      this.conditionElse(ret);

      // TODO make this error say where the block started
      this.assertToken('END');

      return ret;
    }
    return undefined;
  },

  conditionElse: function Template$Parser$prototype$conditionElse(cond) {
    var elseifs = [];
    while (this.token.type == 'ELSIF') {
      this.consumeToken();
      var elseif = { condition: this.assertRule(this.expr) };
      this.assertToken(';');
      elseif.body = [];
      while (['END','ELSE', 'ELSIF'].indexOf(this.token.type) == -1) {
        if (this.token.type == 'NUL') // EOF
          break;
        elseif.body.push(this.chunk());
      }

      elseifs.push(elseif);
    }

    if (elseifs.length) {
      cond.elseifs = elseifs;
    }

    if (this.token.type == 'ELSE') {
      this.consumeToken();
      this.assertToken(';');
      cond['else'] = [];
      while (['END','ELSE', 'ELSIF'].indexOf(this.token.type) == -1) {
        if (this.token.type == 'NUL') // EOF
          break;
        cond['else'].push(this.chunk());
      }
    }

    return cond;
  },

  setlist: function Template$Parser$prototype$setlist() {
    var ident;

    if (this.token.type == 'LITERAL')
      ident = this.consumeToken();
    else
      ident = this.ident();

    if (ident === undefined)
      return ident;

    this.assertToken('ASSIGN');
    return this.setlist_tail(ident);
  },

  block: function Template$Parser$prototype$block() {
    if (this.token.type != 'BLOCK')
      return undefined;

    this.consumeToken();

    var blockname;
    if (this.token.type == 'LITERAL')
      blockname = this.consumeToken();
    else
      blockname = this.assertRule(this.filename);
 
    var block = { 
      type: 'BLOCK',
      name: blockname,
      args: this.metadata(),
      chunks: []
    };

    this.assertToken(';');
    while (this.token.type != 'END') {
      block.chunks.push(this.assertRule(this.chunk));
    }
    this.assertToken('END');

    return block;
  },

  filename: function Template$Parser$prototype$filename() {
    var fn = this.filepart();
    if (fn === undefined)
      return fn;

    while (this.token.type == 'DOT') {
      this.consumeToken();
      var c = this.filepart();
      fn.literal += '.' + c.literal;
    }
    return fn;
  },

  filepart: function Template$Parser$prototype$filepart() {
    if (this.token.type == 'FILENAME' ||
        this.token.type == 'IDENT' ||
        this.token.type == 'NUMBER')
    {
      return this.consumeToken();
    }
    return undefined;
  },

  metadata: function Template$Parser$prototype$metadata() {
    var meta = [];
    while (this.token.type == 'IDENT') {
      var i = this.consumeToken();
      this.assertToken('ASSIGN');

      var rhs;
      if (this.token.type == 'LITERAL' ||
          this.token.type == 'NUMBER')
        rhs = this.consumeToken();
      else if (this.token.type == '"') {
        this.consumeToken();
        rhs = this.assertToken('TEXT');
        this.assertToken('"');
      } else {
        this.assertToken('LITERAL'); // will fail
      }

      meta.push({ type: 'META', lhs: i, rhs: rhs });

      if (this.token.type == 'COMMA')
        this.consumeToken();
    }

    if (meta.length)
      return meta;
    return undefined;
  },

  lnameargs: function Template$Parser$prototype$lnameargs() {
    // Savepoint. This is far easier to do via backtracking
    var watermark = this._tokenWatermark;

    var lvalue;
    if (this.token.type == 'LITERAL') {
      lvalue = this.consumeToken();
    } else if (this.token.type == '"') {
      this.consumeToken();
      lvalue = this.assertRule(this.quoted);
      this.assertToken('"');
    } else {
      lvalue = this.item();
    }

    if (lvalue && this.token.type == 'ASSIGN') {
      this.consumeToken();
      return {
        lvalue: lvalue,
        nameargs: this.assertRule(this.nameargs)
      };
    } else {
      // Just a normal nameargs production.
      this._tokenWatermark = watermark;
      this.token = this._getToken();
      return this.nameargs();
    }

  },

  nameargs : function Template$Parser$protoyep$nameargs() {
    if (this.token.type == '$') {
      // TODO: See if this works as a node instead
      this.consumeToken();
      return { type: 'nameargs',
               names: [ { type: 'interpret', term: this.assertRule(this.ident) } ],
               args: this.args() };
    }
    
    var names = this.assertRule(this.names);
    var args;

    if (this.token.type == '(') {
      this.consumeToken();
      args = this.assertRule(this.args);
      this.assertToken(')');
    }
    else
      args = this.assertRule(this.args);

    return { type: 'nameargs', names: names, args: args };
  },

  names: function Template$Parser$prototype$names() {
    var names = [];

    while (true) {
      var n = this.name();

      if (n === undefined)
        break;

      names.push(n);
      if (this.token.type != '+')
        break;
      this.consumeToken();
    }

    if (names.length)
      return names;
    return undefined;
  },

  name: function Template$Parser$prototype$name() {
    if (this.token.type == '"') {
      this.consumeToken();
      var ret = this.assertRule(this.quoted);
      this.assertToken('"');
      return ret;
    }
    else if (this.token.type == 'LITERAL')
      return this.consumeToken();
    else
      return this.filename();
  },

  wrapper_like: function Template$Parser$wrapper_like() {
    var valid = ['WRAPPER'
                ].indexOf(this.token.type) != -1;
    if (!valid)
      return undefined;

    var type = this.consumeToken().type;
    var block = this.assertRule(this.nameargs);
    block.type = type;
    block.chunks = [];

    this.assertToken(';');
    while (this.token.type != 'END') {
      block.chunks.push(this.assertRule(this.chunk));
    }
    this.assertToken('END');
   
    return block;
  },

  filter: function Template$Parser$filter() {
    if (this.token.type != 'FILTER')
      return undefined;

    var ret = this.consumeToken();

    ret.filter = this.assertRule(this.lnameargs);
    ret.chunks = [];

    this.assertToken(';');
    while (this.token.type != 'END') {
      if (this.token.type == 'NUL')
        break;
      ret.chunks.push(this.assertRule(this.chunk));
    }
    this.assertToken('END');
   
    return ret;
  },

  switchBlock: function Template$Parser$switchBlock() {
    if (this.token.type != 'SWITCH')
      return undefined;

    var ret = this.consumeToken();

    var expr = this.assertRule(this.expr);
    this.assertToken(';');
    
    ret.expr = expr;
    ret.cases = [];

    // The original grammar has a block production here before the cases. not
    // sure why

    while (this.token.type == 'CASE') {
      var c = this.consumeToken();
      if (this.token.type == ';') {
        this.consumeToken();
        c['default'] = true;
      }
      else if (this.token.type == 'DEFAULT') {
        c['default'] = true;
        this.consumeToken();
        this.assertToken(';');
      }
      else {
        c['case'] = this.assertRule(this.term);
        this.assertToken(';');
      }

      c.chunks = [];
      while (['CASE', 'END', 'NUL'].indexOf(this.token.type) == -1) {
        c.chunks.push(this.chunk());
      }
      ret.cases.push(c);
    }

    this.assertToken('END');
    return ret;
  },

  tryCatch: function Template$Parser$tryCatch() {
    if (this.token.type != 'TRY')
      return undefined;

    this.consumeToken();

    var block = {
      type: 'TRY',
      tryBlock: [],
      catches: [],
      'final': []
    };

    this.assertToken(';');
    while (['CATCH', 'FINAL'].indexOf(this.token.type) == -1) {
      if (this.token.type == 'NUL')
        this.assertToken('END');

      block.tryBlock.push(this.assertRule(this.chunk));
    }

    while (this.token.type == 'CATCH') {
      var c = this.consumeToken();
      switch (this.token.type) {
        case ';':
          c.signature = false;
          break;
        case 'DEFAULT':
          c.signature = this.consumeToken();
          break;
        default:
          c.signature = this.assertRule(this.filename);
          break;
      }
      this.assertToken(';');
      c.block = [];
      while (['CATCH', 'FINAL', 'END'].indexOf(this.token.type) == -1) {
        if (this.token.type == 'NUL')
          this.assertToken('END');

        c.block.push(this.assertRule(this.chunk));
      }
      block.catches.push(c);
    }

    if (this.token.type == 'FINAL') {
      this.consumeToken();
      this.assertToken(';');
      while (this.token.type != 'END') {
        block['final'].push(this.assertRule(this.chunk));
      }
    }

    this.assertToken('END');
    return block;
  },

  _tracedFunctions: "consumeToken node ident sterm term expr expr_tail item \
    lterm params param chunks condition conditionElse statement tokenise \
    interpolate_text assign setlist directive loop loopvar binary_expr args \
    block metadata filename nameargs names wrapper_like complex_statement \
    tryCatch lnameargs filter atomdir"
  
};
/*
 * END OF Template.Parser
 */

/* 
 * Template.Interpreter - walks the AST generated by Template.Parser and 
 * returns function that when executed will produce the template output
 */
Template.Interpreter = function Template$Interpreter(chunks, config) {
  this.blocks = {};
  this.config = config || {}
  this.output = this.prelude;
  this.inFor = 0;
  this.inWhile = 0;
  
  var body = this.walk(chunks);

  for (var i in this.blocks) {
    this.output += '  ctx.blocks[' + i + '] = ' + this.blocks[i] + ';\n';
  }
  
  this.output += body 
              +  this.postlude;
} 

Template.Interpreter.prototype = {
  prelude: "function(ctx) {\n\
  var out_arr = []; ctx.StopIteration = (typeof StopIteration === 'undefined') ? 'StopIteration' : StopIteration; \
  function __perl_truth(val) { return (!!val && val != '0' && val !== ctx.nullObj) ? val : '' };\
  function __not_perl_truth(val) { return (!!val && val != '0' && val !== ctx.nullObj) ? '' : 1 };\
  try {\n",

  postlude: "\n\
  }\n\
  catch (e) { if (!(e instanceof Template.Exception && e.type == 'stop')) throw e; } \n\
  return out_arr.join('');\n\
}",

  walk: function Template$Interpreter$prototype$walk(chunks) {
    var output = '';
    var prev = { type: 'NUL' };
    for (var i in chunks) {
      var chunk = chunks[i]
      if (chunk === undefined) {
        continue;
      }

      // check for things like GET, SET or CALL
      // Not everything writes directly.
      var write = ['IF', 'FOR', 'CALL', 'setlist', 'DEFAULT', 'UNLESS', 'BLOCK', 
                   'NEXT', 'LAST', 'WHILE', 'SWITCH', 'TRY', 'THROW', 'CATCH',
                   'CLEAR', 'FILTER'
                  ].indexOf(chunk.type) == -1;
      var add_semicolon = write || ['THROW', 'FILTER'].indexOf(chunk.type) != -1;

      if (chunk.toSource)
        output += '// ' + chunk.toSource() + '\n';
      if (write) {
        output += 'out_arr.push(';
      }
      output += this.$get_term(chunk);

      if (write)
        output += ')';
      if (add_semicolon)
        output += ';\n';
      prev = chunk;

    }
    return output;
  },

  $get_term: function Template$Interpreter$prototype$$get_term(term) {
    if (this["build" + term.type])
      return this["build" + term.type](term);

    switch (term.type) {

      case 'TEXT':
        return  Template.escapeString(term.literal);
      case 'ident':
        return 'ctx.dot_op(' + this.handle_ident_segments(term.segments) + ')';

      case 'IDENT':
        return "ctx.dot_op(ctx.stash, [" + Template.escapeString(term.literal) + "])";
      case 'NUMBER':
        return parseFloat(term.literal);
      case 'LITERAL':
        return term.literal;
      case 'IF':
      case 'UNLESS':
        var condition = this.$get_term(term.condition);
        if (term.type == 'UNLESS')
          condition = '__not_perl_truth(' + condition + ')';
        else if (['<','<=','>','>=','==','!='].indexOf(term.condition.type) == -1) 
          condition = '__perl_truth(' + condition + ')';

        var body = this.walk(term.body);
        var ret = "if (" + condition+ ") {\n" + body.replace(/^/gm, '  ') + "\n}";

        if ('elseifs' in term) {
          for (var i in term.elseifs) {
            var elseif = term.elseifs[i];
            ret += ' else if (__perl_truth(' + this.$get_term(elseif.condition)
                +           ')) {\n'
                +  this.walk(elseif.body).replace(/^/gm, '  ') + '\n}';
          }
        }
        if (term['else']) {
          ret += ' else {\n' + this.walk(term['else']).replace(/^/gm, '  ') + '\n}';
        }
        return ret;
      case '+':
      case '/':
      case '*':
      case '%':
      case '-':
      case 'DIV':
        return this.math_op(term);
      case 'interpret':
        var out = [];
        out.push(this.$get_term(term.term));
        if (term.literal) {
          out.push(term.literal);
        }
        return 'ctx.dot_op(ctx.stash, [ ' + out.join(' + ') + '])';
      case 'GET':
      case 'CALL':
        // GET is default action - return value of the expr
        return this.$get_term(term.expr);

      case 'QUOTED':
        
        var out = [];
        for (var i in term.segments) {
          var seg = term.segments[i];
          if (seg.type == ';')
            continue;
          out.push(this.$get_term(seg));
        }
        return out.join(' + ');
      case 'function_call':
        // an item followed by some args
        var t = this.handle_ident_segments([term.func]);
        var stash = t[0],
            segs = t[1];

        var args = this.handle_function_args(term.args);
      
        return 'ctx.dot_op(' + stash + ', [' + segs + '], { args: ' + args + ' } )';
  
      case 'DEFAULT':
        var defaults = true;
        term = term.expr;
        // Drop thru
      case 'setlist':

        var ret = [];
        for (var i in term.chunks) {
          var assign = term.chunks[i];
          var t = this.handle_ident_segments([assign.lhs]);
          var stash = t[0],
              segs = t[1];

          var prefix = 'ctx.dot_op(' + stash + ', ' + segs + ', { '+ (defaults ? 'default:1, ':'') +'assign: ';
          if (assign.rhs.type == 'interpret') {
            ret.push(prefix + 'ctx.dot_op(ctx.stash, [' + this.$get_term(assign.rhs.term) + '] ) } )');
          } else {
            ret.push(prefix + this.$get_term(assign.rhs) + ' } )');
          }
        }
        return ret.join(', ') + ';';
        
      case 'FOR':
        var loopvar = term.loopvar.ident 
                    ? this.handle_ident_segments([term.loopvar.ident]) 
                    : undefined;

        var loopcond = this.$get_term(term.loopvar.term);

        var ret = 'ctx.forEach(' + loopcond + 
                  ', function(value) {\n  ';

        if (loopvar) {
          ret += '\n  ctx.dot_op(' + loopvar + ', { assign: value } );\n';
        }

        this.inFor++;
        var chunks = this.walk(term.chunks);
        this.inFor--;
        ret += chunks.replace(/^/mg, '  ');

        ret += '\n}';
        if (loopvar === undefined)
          ret += ', true';
        ret += ');';

        return ret;

      case 'WHILE':
        var cond = this.$get_term(term.loopvar);
        if (!cond.match(/^__(?:not_)?perl_truth\(/))
          cond = '__perl_truth(' + cond + ')'
        var ret = 'while(' + cond +
                  ') {\n';

        this.inWhile++;
        var chunks = this.walk(term.chunks);
        this.inWhile--;
        ret += chunks.replace(/^/mg, '  ');

        ret += '\n}';
        return ret;


      case 'array':
        // TODO: Might not work with Safari
        return '[' + term.items.map(this.$get_term, this).join(', ') + ']';

      case 'hash': 
        var pairs = [ ];

        for (var i in term.data) {
          var pair = term.data[i];
          if (pair.to.type != 'IDENT') {
            throw new Error('Cant handle ' + pair.to.type + ' in hash key!');
          }
          pairs.push( pair.to.literal + ': ' + this.$get_term(pair.value) ) ;
        }

        return '{ ' + pairs.join(', ') + ' }';

      case 'OR':
        return '( __perl_truth(' + this.$get_term(term.lhs) + ') || __perl_truth(' + this.$get_term(term.rhs) + ') )';
      case 'AND':
        return '__perl_truth(' + this.$get_term(term.lhs) + ') && __perl_truth(' + this.$get_term(term.rhs) + ')';
      case 'NOT':
        // Use a ternary operator to emulate perl's true/false sematics
        return '__not_perl_truth(' + this.$get_term(term.child) + ')';

      case 'CAT':
        return '('+this.$get_term(term.lhs) + ').toString()+' +
               '('+this.$get_term(term.rhs) + ').toString()';

      case '==':
      case '!=':
      case '>=':
      case '<=':
      case '<':
      case '>':
        return '__perl_truth((' + this.$get_term(term.lhs) + ') ' 
             + term.type 
             +  ' (' + this.$get_term(term.rhs) + '))';

      case '?':
        return '( __perl_truth(' + this.$get_term(term.lhs) + ') ?' +
                                   this.$get_term(term.rhs) + ')';
      case ':':
        return '(' + this.$get_term(term.lhs) + '):(' + 
                     this.$get_term(term.rhs) + ')';

      case 'BLOCK':
        var block_name;
        if (term.name.type == 'IDENT' || term.name.type == 'FILENAME')
          block_name = Template.escapeString(term.name.literal);
        else if (term.name.type == 'LITERAL')
          block_name = term.name.literal;
        else
          throw new Error('Handle ' + Template.escapeString(term.name));

        // Blocks can be defined after the are referenced
        this.blocks[block_name] = (new Template.Interpreter(term.chunks)).output;
        return '';

      case 'PROCESS':
        return 'ctx.process_block(' + this.handle_nameargs(term) + ')';
      case 'INCLUDE':
        return 'ctx.include_block(' + this.handle_nameargs(term) + ')';

      case 'WRAPPER':
        // add content to named args
        term.args[0].push({type:'IDENT', literal:"content"});
        term.args[0].push({type:'LITERAL', literal:'ctx.process_block(' + 
             (new Template.Interpreter(term.chunks)).output + ')' }
        );

        if (term.names.length == 1)
          // TODO: this should maybe clone and reset content?
          return 'ctx.include_block(' + this.handle_nameargs(term) + ')';

        // [% WRAPPER a + b + c %]foo[% END %]
        var ret = '', prev = '';
        for (var i = term.names.length-1; i >=0; i--) {
          var name = term.names[i];
          var ret = 'ctx.include_block(';
          if (i == term.names.length -1)
            ret += this.handle_nameargs({names: [name], args: term.args });
          else {
            ret += this.handle_nameargs({names: [name], args: [[]] });
            ret += ', [["content", ' + prev + ']]' 
          }
          ret += ')';
          prev = ret;
        }

        return ret;

      case 'range':
        if (typeof Range != 'undefined') {
          return 'Range(' + this.$get_term(term.from) + ', '
                          + this.$get_term(term.to) + '+1)';
        } else {
          var range = [];
          for (var i = parseInt(term.from.literal);
               i <= parseInt(term.to.literal);
               i++)
          {
            range.push(i);
          }
          return Template.escapeString(range);
        }
      case 'NEXT':
        // This will need fixing for nested loops
        if (this.inWhile) 
          return 'continue;';
        else if (this.inFor)
          return 'return;';
        else 
          throw new Template.Exception("SYNTAX_ERROR", 
                                       "NEXT used outside of loop");
          
      case 'LAST':
        if (this.inWhile) 
          return 'break;';
        else if (this.inFor)
          return 'return ctx.StopIteration;';
        else 
          throw new Template.Exception("SYNTAX_ERROR", 
                                       term.literal + " used outside of loop");

      case 'SWITCH':
        var ret = 'switch ('+this.$get_term(term.expr)+') {\n';
        
        for (var i in term.cases) {
          var c = term.cases[i];

          if (c['default']) {
            ret += '  default:\n';
          } else {
            ret += '  case ' + this.$get_term(c['case']) + ':\n';
          }
          var body = this.walk(c.chunks);
          ret += body.replace(/^/gm, '    ');

          ret += '\n    break;\n';
        }
        ret += '}\n';
        return ret;

      case 'THROW':
        if (term.names.length && term.args.length > 1) {
          if (term.names.length > 1 ) throw new Error("Dont know how to handle this");

          // THROW barf 'Feeling sick'
          var ret = "throw new Template.Exception(";

          ret += this.handle_nameargs(term);

          return ret + ")";
        }
        return "throw " + this.handle_nameargs(term);
      default:
        throw new Error('Unhandled ' + term.toSource());
    }
  },

  buildTRY: function buildTRY(term) {
    var ret = "(function(out){ var out_arr = []; try {\n",
        has_final = term['final'].length,
        body = this.walk(term.tryBlock);

    ret += body.replace(/^/gm, '  ');

    ret += "}\n";

    if (term.catches.length) {
      ret += 'catch ($e) { $e = ctx.$catch($e); \n';

      var if_count = 0;
      var catchall = false;

      for (var i in term.catches) {
        var c = term.catches[i];
        if(!c.signature || c.signature.type == "DEFAULT"){
          // We've got something that does a catchall
          catchall = true;
          if (if_count) ret += "  else {\n";
          var body = this.walk(c.block);
          ret += body.replace(/^/gm, '    ');
          if (if_count) ret += "\n  }\n";
          // We've got a default catch-all, no need to carry on
          break;
        }
        else if (c.signature) {
          ret += "  ";
          if (if_count) { ret += "else " }
          ret +=     "if (ctx.$error_matches($e, " + Template.escapeString(c.signature.literal) + ") ) {\n";
          ret += this.walk(c.block).replace(/^/gm, '    ');
          ret += "\n  }\n";
          if_count++;
        }
      }

      // if nothing caught all, rethrow the error
      if (!catchall) {
        if (if_count) ret += "else ";
        ret += "throw $e\n";
      }

      ret += '\n}\n';
    }
    ret += 'finally {\n';
    if (term['final'].length) {
      ret += this.walk(term['final']).replace(/^/gm, '  ');
    }
    ret += "out.push.apply(out, out_arr); }})(out_arr)"


    return ret;
  },

  buildCLEAR: function buildCLEAR() {
    return "out_arr=[];";
  },

  buildFILTER: function buildFILTER(term) {
    var ret = "(function(out){ var out_arr = [];";

    ret += "var $filter = ctx.filter(" + this.handle_nameargs(term.filter) + ");\n",

    ret += this.walk(term.chunks).replace(/^/gm, '  ');
    ret += "\n  out.push($filter(out_arr.join('')));";

    return ret + "\n})(out_arr)";
  },

  handle_nameargs: function Template$Interpreter$handle_nameargs(term) {
    var str;
    if (term.names.length == 1) {
      if (term.names[0].type == 'IDENT' || term.names[0].type == 'FILENAME')
        str = Template.escapeString(term.names[0].literal);
      else if (term.names[0].type == 'LITERAL')
        str = term.names[0].literal;
      else if (term.names[0].type == 'interpret')
        str = this.$get_term(term.names[0].term);
      else if (term.names[0].type == 'QUOTED') {
        str = this.$get_term(term.names[0]);
      }
    }
    if (str === undefined)
      throw new Error("handle " + Template.escapeString(term.names));

    if (term.args.length > 1 || term.args[0].length) {
      str += ", " + this.make_namearg_dict(term.args);
    }
    
    return str;
  },

  make_namearg_dict: function Template$Interpreter$make_namearg_dict(args) {
    var named = args.shift();

    var ret = "";
    if (named.length) {
      if (named.length % 2)
        throw new Error("Named args off odd length");

      var a = [];
      while (named.length) {
        var arg = [named.shift(), named.shift()];
        var name, value;
        if (arg[0].type == 'IDENT')
          name = Template.escapeString(arg[0].literal);
        else
          throw new Error("handle");

        if (arg[1].type == 'LITERAL' || arg[1].type == 'NUMBER')
          value = arg[1].literal;
        else if (arg[1].type == 'IDENT' || arg[1].type == 'function_call')
          value = this.$get_term(arg[1]);
        else
          throw new Error("handle " + arg[1].toSource());

        a.push( '[' + name + ', ' + value + ']' );
      }
      ret = '[' + a.join(', ') + ']';
    }

    for (var i in args) {
      if (ret) ret += ", ";
      ret += this.$get_term(args[i]);
    }

    return ret;
  },

  handle_function_args: function Template$Interpreter$prototype$handle_function_args(args) {
    var named = args.shift();
    var argsOut = [];
    var out = ''
    for (var i in args) {
      argsOut.push(this.$get_term(args[i]));
    }

    if (argsOut.length)
      out += argsOut.join(', ');

    return '[' + out + ']';
  },

  handle_ident_segments: function Template$Interpreter$prototype$handle_ident_segments(segs) {
    var stash = 'ctx.stash';
    var var_name = [];
    for (var i in segs) {
      var seg = segs[i];
      if (seg.type == 'IDENT') {
        var_name.push(Template.escapeString(seg.literal)); 
      }
      else if (seg.type == 'interpret') {
        if (seg.term.type == 'LITERAL') {
          var_name.push(seg.term.literal);
        } else {
          var_name.push(this.$get_term(seg.term));
        }
        continue;
      }
      else if (seg.type == 'function_call') {
        if (seg.args[0] instanceof Array == false)
          throw new Error('args[0] is not an array!');
        // This is more difficult - since we could have something like
        // [% foo.bar(1,2,3).baz.fish
        // in which case we want output something like:
        // ctx.dot_op(ctx.dot_op(stash, ['foo','bar'],[1,2,3]), ['baz,'fish'])
        var funcName;
        if (seg.func.type == 'IDENT')
          var_name.push(Template.escapeString(seg.func.literal));
        else if (seg.func.type == 'interpret') {
          var_name.push(this.$get_term(seg.func));
        }
        else
          throw new Error('Unknown function type name ' + seg.func.type + '\n' + seg.toSource());

        stash = 'ctx.dot_op(' + stash + ', [' + var_name + '], { args: '+this.handle_function_args(seg.args)+' } )';
        var_name = [];
      }
      else if (seg.type == 'LITERAL' || seg.type == 'NUMBER') {
        var_name.push(seg.literal);
      }
      else if (seg.type == 'ident') {
        // TODO: this is prolly wrong
        return this.handle_ident_segments(seg.segments);
      }
      else
        throw new Error('Unknown segment type in ident clause: ' + seg.type + '\n' + seg.toSource());
    }
    if (var_name.length == 0)
      return stash;
    return [stash, '[' + var_name + ']'];
  },


  math_op: function(expr) {
    var ret = '( ';
    if (expr.lhs.type != 'NUMBER')
      ret += 'Number( ' + this.$get_term(expr.lhs) + ')';
    else
      ret += this.$get_term(expr.lhs);

    var type = expr.type == 'DIV' ? '/' : expr.type;
    ret += ' ' + type + ' ';

    if (expr.rhs.type != 'NUMBER')
      ret += 'parseInt( ' + this.$get_term(expr.rhs) + ' )';
    else
      ret += this.$get_term(expr.rhs);
    ret += ')';

    if (expr.type == 'DIV')
      return 'parseInt'+ret;
    else
      return ret;
  }

};
/*
 * END OF Template.Interpreter
 */


var log = [];

if (exports) {
  exports.render = function(template, stash) {
    var tt = new Template();
    return tt.process(template, stash);
  }
}
