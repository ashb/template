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

Template = function Template(config) {
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
    this.blocks[b]

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
  CHOMP_GREEDY: 3,
};

Template.Exception = function(code, message) {
  this.code = code;
  this.message = message;
}
Template.Exception.prototype.__proto__ = Error.prototype;
Template.Exception.prototype.name = "Template.Exception";

// Just a place for constants
Template.Stash = {
  'PRIVATE': /^[._]/
}

Template.VMethods = {
  SCALAR_OPS: {},
  HASH_OPS: {
    keys: function() {
      // A generator would be nice here.
      // return [i for (ver i in obj)]
      var k = [];
      for (var key in this)
        k.push(key);
      return k;
    },
    'import': function(hash2) {
      for (var key in hash2) {
        this[key] = hash2[key];
      }
      return '';
    }
  },
  LIST_OPS: {
    sort: function sort(key) {
      if (key !== undefined) {
        return this.sort(function(a,b) {
          a = a[key]; b = b[key];
          return a < b ? -1 : a > b ? 1 : 0;
        });
      }
      return this.sort();
    },
    join: Array.prototype.join
  }
}

Template.prototype = {
  constructor: Template,

  process: function Template$prototype$process(input, params) {
    // Reset.
    this.parserOutput = [];

    var parser = new Template.Parser(this);
    var ctx = new Template.Context(this);

    parser.parse(input);
    this.parserTokens = [].concat(parser._tokenBuffer);
    var chunks = parser.chunks();
   
    this.parserOutput = [].concat(chunks);

    if (this.DBG_OUTPUT_CHUNKS)
      warn('# Chunks: ' + chunks.toSource());

    var ti = new Template.Interpreter(chunks, this);

    this.interpreterOutput = ti.output;

    if (this.DBG_OUTPUT_FUNC)
      warn(ti.output);

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


Template.Context = function (config) { 
  this.config = config || {};
  this.out_arr = [];
  this.global = {};
  this.blocks = this.config.blocks || {};

  var load_file;
  if (typeof IO != 'undefined' && 'File' in IO) {
    load_file = function load_file(file) { 

      var f;
      try {
        f = new IO.File(file);
      }
      catch (e) {
        throw new Template.Exception("NOT_FOUND", "File " + uneval(file) + 
                                                  " not found");
      }

      return f.readWhole();
    }
  } else {
    load_file = function load_file(file) {
      throw new Template.Exception("NOT_FOUND", "File " + uneval(file) + 
                                                " not found");
    }
  }
  Template.Context.prototype.load_file = load_file;
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
      return;
    
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
          throw new Template.Exception("invalid block",
                                       "No such BLOCK " + uneval(block));

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

  write: function(str) { this.out_arr.push(str); },

  get_output: function() { return this.out_arr.join("") },

  nullObj: { toString: function() { return ''; } },

  dot_op : function Template$Context$dot_op(stash, segments, args) {
    var s = stash;

    if (!args) args = { };

    // We are assigning, so create dict objects as needed...
    if ('assign' in args) {
      var last_seg = segments.pop();
      if (Template.Stash.PRIVATE && Template.Stash.PRIVATE.exec(last_seg))
        return;

      for (var i in segments) {
        var segment = segments[i];
        if (Template.Stash.PRIVATE && Template.Stash.PRIVATE.exec(segment))
          return;

        if (s[segment] === undefined) {
          s[segment] = {};
        }
        s = s[segment];
      }

      var ret = s[last_seg];
      if (!args['default'] || !ret)
        s[last_seg] = args.assign;

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
      var vmeths
      if (s instanceof Array && Template.VMethods.LIST_OPS[segment])
        s = Template.VMethods.LIST_OPS[segment].apply(s, op_args);
      else if (s instanceof Object && Template.VMethods.HASH_OPS[segment])
        s = Template.VMethods.HASH_OPS[segment].apply(s, op_args);
      else if (Template.VMethods.SCALAR_OPS[segment])
        s = Template.VMethods.SCALAR_OPS.apply(s, op_args);
      else 
        s = s[segment];
      if (s === undefined || s == null)
        return ;//this.nullObj;
      if (s instanceof Function) {
        s = s.apply(s, op_args);
      }
    }
    
    // 4.140000000000001 -> 4.14 fix
    if (typeof s == 'number' && /\.[0-9]*00000[1-9]+$/.exec(s)) {
      return s.toPrecision(12).replace(/0+$/, '');
    }
    return s === undefined ? this.nullObj : s;
  },

  /**
   * For each wrapper that promotes var to an array
   */
  forEach: function(a, func) {
    if (a === undefined || a === this.nullObj)
      return;
    if (a instanceof Array == false) {
      a = [a];
    }

    for (var i =0; i < a.length; i++) {
      func(a[i], i, i == a.length);
    }

  }
};

Template.Parser = function (config) {
  this.end_tag   = this.default_end_tag;
  this.start_tag = this.default_start_tag;
  this.min_precedence = 0;
  this._tokenWatermark = 0;
  this._tokenBuffer    = [];

  if (!config)
    config = {};

  this.config = config;

/*
  // Spidermonkey Only
  this.__defineGetter__('token', function() {
    if (this._tokenBuffer.length > this._tokenWatermark) {
      return this._tokenBuffer[this._tokenWatermark];
    }
    return {type: "NUL"};

    if (this.tokenizer.eof)
      return {type:"NUL"};

    var token = this.tokenizer.next();
    if (token === undefined)
      this.parseError('Unexpected EoF!');
    this._tokenBuffer.push(token);
    if (token.type == 'PARSE_ERROR')
      this.parseError('Invalid token!');
    return token;
  }); 
*/

  if (config.DEBUG) {
    var self = this;
    // DEBUG logging of calls!
    this._tracedFunctions.split(/\s+/).forEach(function(name) {
      var func = self.__proto__[name];
      self[name] = function Template$Parser$prototype$logCall() {
        try {
          if (name == 'consumeToken') {
            self._logCall(name + '(' + this.token.literal + ')');
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
    throw new Error(msg + " at '" + substr + "' " + uneval(this.token));
  },

  log: function(str) {
    if ( typeof window != "undefined" && window.console) {
      this.log = function(str) { 
        return console.log.call(console.log, str.replace(/%([a-z])/g, '%%$1')) 
      };
      return this.log(str);
    }
    else if (typeof IO != "undefined" && IO.stdout) {
      this.log = function(str) { IO.stdout.print(str) };
      return this.log(str);
    } 
    else {
      if (!this._log)
        this._log = [];
      this.log = function (str) {
        this._log.push(str);
      }
      this.log(str);
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
    '~': Template.Constants.CHOMP_GREEDY,
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
    DIV : 40,
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
              default:
                throw new Error('unhandled chomp flag ' + chomp);
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
        default:
          throw new Error('unhandled chomp flag ' + postchomp);
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

    while (match = re.exec(text) ) {

      pos = initPos + re.lastIndex - match[0].length;
      // Comment in $1
      if (match[1])
        continue;

      // Quoted pharse in $3 (and quote char in $2)
      if (token = match[3]) {
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
    while (match = re.exec(text)) {
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
        tokens.push({type: ';', literal: ';', position: pos});
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
    '| '      : 'FILTER',
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
    var term = this.term();
    if (term === undefined)
      return; 
    return this.expr_tail(term);
  },

  expr_tail: function Template$Parser$prototype$expr_tail(term) {

    switch (this.token.type) {
      case '(':
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

    if (item === undefined)
      return;
    if (this.token.type == '(') {
      this.consumeToken();
      // args
      var ret = {type: 'function_call', func: item };
      ret.args = this.assertRule(this.args);
      this.assertToken(')');
      return ret;
    } else {
      return item;
    }
  },

  args: function Tempalte$Parser$prototype$args() {
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
        return;
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
        return;
    }

    this.assertToken('ASSIGN');

    ret.value = this.assertRule(this.expr);

    return ret;
  },

  /**
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

      if (ident === undefined)
        return;

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

    if (expr) {
      return this.postfixed_condition(expr);
    }

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
      return ret;
    }
    if (this.token.type == 'WRAPPER') {
      this.consumeToken();
      var nameargs = this.assertRule(this.nameargs);
      nameargs.type = 'WRAPPER';
      nameargs.body = [expr];

      return nameargs;
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
      case 'INCLUDE':
      case 'PROCESS':
        var type = this.consumeToken().type;
        var nameargs = this.assertRule(this.nameargs);
        nameargs.type = type;
        return nameargs;
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
  },

  loopvar: function Template$Parser$prototype$loopvar() {
    var ident;
    if (this.token.type == 'IDENT') {
      ident = this.consumeToken();
      if (this.token.type == 'ASSIGN')
        this.consumeToken();
      else 
        this.assertToken('IN');
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
      return;
    } else {
      var ret = this.assertRule(this.statement);
      this.assertToken(';');
      return ret;
    }
  },

  statement: function Template$Parser$prototype$statment() {
    return this.complex_statement() || this.directive() || 
           this.block() || this.wrapper_like() || this.expr();
  },

  directive: function Template$Parser$prototype$directive() {
    return this.atomdir() || this.condition() || this.loop();
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
      return

    this.assertToken('ASSIGN');
    return this.setlist_tail(ident);
  },

  block: function Template$Parser$prototype$block() {
    if (this.token.type != 'BLOCK')
      return;

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
      return;

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
      return;

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

  _tracedFunctions: "consumeToken node ident sterm term expr expr_tail item \
    lterm params param chunks condition conditionElse statement tokenise \
    interpolate_text assign setlist directive loop loopvar binary_expr args \
    block metadata filename nameargs names wrapper_like"
  
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
  
  var body = this.walk(chunks);

  for (var i in this.blocks) {
    this.output += '  ctx.blocks[' + i + '] = ' + this.blocks[i] + ';\n';
  }
  
  this.output += body 
              +  this.postlude;
} 

Template.Interpreter.prototype = {
  prelude: "function(ctx) {\n\
  var out_arr = [];\
  function __perl_truth(val) { return (!!val && val != '0') ? val : '' };\
  function __not_perl_truth(val) { return (!!val && val != '0') ? '' : 1 };\
  function write() { out_arr = out_arr.concat(Array.prototype.slice.apply(arguments)); };\n\
  try {\n",

  postlude: "\n\
  }\n\
  catch (e if e instanceof Template.Exception && e.code == 'stop') {} \n\
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
      var write = ['IF', 'FOR', 'CALL', 'setlist', 
                   'DEFAULT', 'UNLESS', 'BLOCK'
                  ].indexOf(chunk.type) == -1 ? 1 : 0;
      var add_semicolon = write;// || chunk.type == 'BLOCK';

      if (chunk.toSource)
        output += '/* ' + chunk.toSource() + ' */\n';
      if (write) {
        output += 'write(';
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
    switch (term.type) {

      case 'TEXT':
        return  uneval(term.literal);
      case 'ident':
        return 'ctx.dot_op(' + this.handle_ident_segments(term.segments) + ')';

      case 'IDENT':
        return "ctx.dot_op(ctx.stash, [" + uneval(term.literal) + "])";
      case 'NUMBER':
        return parseFloat(term.literal);
      case 'LITERAL':
        return term.literal;
      case 'IF':
      case 'UNLESS':
        var condition = this.$get_term(term.condition);
        if (term.type == 'UNLESS')
          condition = '!(' + condition + ')';

        var body = this.walk(term.body);
        var ret = "if (" + condition+ ") {\n" + body.replace(/^/gm, '  ') + "\n}";

        if ('elseifs' in term) {
          for (var i in term.elseifs) {
            var elseif = term.elseifs[i];
            ret += ' else if (' + this.$get_term(elseif.condition)
                +           ') {\n'
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
        var loopvar = term.loopvar.ident ? this.handle_ident_segments([term.loopvar.ident]) : undefined;
        var loopcond = this.$get_term(term.loopvar.term);

        if (loopvar === undefined) {
        }

        var ret = 'ctx.forEach(' + loopcond + ', function(value, idx, last) {\n  ctx.dot_op(ctx.stash, [\'loop\'], { assign: {count: idx+1, index: idx, frst: idx == 0, last: last} } )';

        if (loopvar) {
          ret += '\n  ctx.dot_op(' + loopvar + ', { assign: value } );\n';
        }

        var chunks = this.walk(term.chunks);
        ret += chunks.replace(/^/mg, '  ');

        ret += '\n});';

        return ret;

      case 'array':
       return '[' + term.items.map(this.$get_term).join(', ') + ']';

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
          block_name = uneval(term.name.literal);
        else if (term.name.type == 'LITERAL')
          block_name = term.name.literal;
        else
          throw new Error('Handle ' + uneval(term.name));

        // Blocks can be defined after the are referenced
        this.blocks[block_name] = (new Template.Interpreter(term.chunks)).output;
        return '';

      case 'PROCESS':
        return 'ctx.process_block(' + this.handle_nameargs(term) + ')';
      case 'INCLUDE':
        return 'ctx.include_block(' + this.handle_nameargs(term) + ')';

      case 'WRAPPER':
        var content = [
          {type:'IDENT', literal:"content"},
          {type:'LITERAL', literal:'ctx.process_block(' + 
           (new Template.Interpreter(term.chunks)).output + ')' }
        ];
        if (term.args.length > 1 || term.args[0].length)
          term.args.push(content);
        else
          term.args[0] = content;

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

      default:
        throw new Error('Unhandled ' + term.toSource());
    }
  },

  handle_nameargs: function Template$Interpreter$handle_nameargs(term) {
    var str;
    if (term.names.length == 1) {
      if (term.names[0].type == 'IDENT' || term.names[0].type == 'FILENAME')
        str = uneval(term.names[0].literal);
      else if (term.names[0].type == 'LITERAL')
        str = term.names[0].literal;
      else if (term.names[0].type == 'interpret') {
        str = this.$get_term(term.names[0].term);
      }
    }
    if (str === undefined)
      throw new Error("handle " + uneval(term.names));

    if (term.args.length > 1 || term.args[0].length) {
      str += ", " + this.make_namearg_dict(term.args);
    }
    
    return str;
  },

  make_namearg_dict: function Template$Interpreter$make_namearg_dict(args) {
    var ret = [];
    for (var n in args) {
      var arg = args[n];
      var name, value;
      if (arg[0].type == 'IDENT')
        name = uneval(arg[0].literal);
      else
        throw new Error("handle");

      if (arg[1].type == 'LITERAL' || arg[1].type == 'NUMBER')
        value = arg[1].literal;
      else
        throw new Error("handle " + arg[1].type);
      
      ret.push( '[' + name + ', ' + value + ']' );
    }
    return '[' + ret.join(', ') + ']'
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
        var_name.push(uneval(seg.literal)); 
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
          var_name.push(uneval(seg.func.literal));
        else if (seg.func.type == 'interpret') {
          var_name.push(this.$get_term(seg.func));
        }
        else
          throw new Error('Unknown function type name ' + seg.func.type + '\n' + seg.toSource());

        stash = 'ctx.dot_op(' + stash + ', [' + var_name + '], { args: '+this.handle_function_args(seg.args)+' } )';
        var_name = [];
      }
      else if (seg.type == 'LITERAL') {
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
  },


};
/*
 * END OF Template.Interpreter
 */


log = [];

