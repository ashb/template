/*
 * $Id: uneval.js,v 0.1 2007/11/27 10:26:52 dankogai Exp dankogai $
 */

(function(){
    // if uneval is predefined, skip it
    try{ eval('uneval'); return; }catch(e){};

    var protos = [];
    var uneval_asis = function(o){ return o.toString() };

    /* predefine objects where typeof(o) != 'object' */
    var name2uneval = {
	'boolean':uneval_asis,
	'number': uneval_asis,
	'string': function(o){
	    return '\'' 
	    + o.toString().replace(/[\\\"\']/g, function(m0){
		return '\\' + m0;
	    }) 
	    + '\'';
	},
	'undefined': function(o){ return 'undefined' },
	'function':uneval_asis
    };

    var uneval_default = function(o, np){
	var src = []; // a-ha!
	for (var p in o){
	    if (!o.hasOwnProperty(p)) continue;
	    src[src.length] = uneval(p)  + ':' + uneval(o[p], 1);
	}
        // parens needed to make eval() happy
	return np ? '{' + src.toString() + '}' : '({' + src.toString() + '})';
    };

    uneval_set = function(proto, name, func){
	protos[protos.length] = [ proto, name ];
	name2uneval[name] = func || uneval_default;
    };

    uneval_set(Array, 'array', function(o){
	var src = [];
	for (var i = 0, l = o.length; i < l; i++)
	    src[i] = uneval(o[i]);
	return '[' + src.toString() + ']';
    });
    uneval_set(RegExp, 'regexp', uneval_asis);
    uneval_set(Date, 'date', function(o){
	return '(new Date(' + o.valueOf() + '))';
    });
    
    var typeName = function(o){
	// if (o === null) return 'null';
	var t = typeof o;
	if (t != 'object') return t;
	// we have to lenear-search. sigh.
	for (var i = 0, l = protos.length; i < l; i++){
	    if (o instanceof  protos[i][0]) return protos[i][1];
	}
	return 'object';
    };
    
    uneval = function(o, np){
	// if (o.toSource) return o.toSource();
	if (o === null) return 'null';
	var func = name2uneval[typeName(o)] || uneval_default;
	return func(o, np);
    }
})();

(function(){
    try{ eval('clone'); return; }catch(e){};
    clone = function(o){
	try{
	    return eval(uneval(o));
	}catch(e){
	    throw(e);
	}
    };
})();
