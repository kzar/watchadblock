//This file will clean up the filter lists when they are fetched.
//It will remove broken filters, comments and unsupported things,
//And it will already parse the rules on beforehand.

function cleanThisList(text) {
  //Assuming the $media support branch will be merged before this one
  var unsupported = (ElementTypes.object_subrequest + ElementTypes.font +
                     ElementTypes.dtd + ElementTypes.other + ElementTypes.xbl +
                     ElementTypes.ping + ElementTypes.xmlhttprequest +
                     ElementTypes.document + ElementTypes.elemhide)
  var ignoringCount = 0;
  // Convert a deprecated "old-style" filter text to the new style.
  function old_style_to_new(text) {
    // Old-style is domain#node(attr=value) or domain#node(attr)
    // domain and node are optional, and there can be many () parts.
    text = text.replace('#', '##');
    var parts = text.split('##'); // -> [domain, rule]
    var domain = parts[0];
    var rule = parts[1];
    // Make sure the rule has only the following two things:
    // 1. a node -- this is optional and must be '*' or alphanumeric
    // 2. a series of ()-delimited arbitrary strings -- also optional
    //    the ()s can't be empty, and can't start with '='
    if (rule.length == 0 || 
        !/^(?:\*|[a-z0-9]*)(?:\([^=][^\)]*\))*/i.test(rule))
      return false;

    var first_segment = rule.indexOf('(');

    if (first_segment == -1)
      return domain + '##' + rule;

    var node = rule.substring(0, first_segment);
    var segments = rule.substring(first_segment);

    // turn all (foo) groups into [foo]
    segments = segments.replace(/\((.*?)\)/g, "[$1]");
    // turn all [foo=bar baz] groups into [foo="bar baz"]
    // Specifically match:    = then not " then anything till ]
    segments = segments.replace(/=([^"][^\]]*)/g, '="$1"');
    // turn all [foo] into .foo, #foo
    // #div(adblock) means all divs with class or id adblock
    // class must be a single class, not multiple (not #*(ad listitem))
    // I haven't ever seen filters like #div(foo)(anotherfoo), so ignore these
    var resultFilter = node + segments;
    var match = resultFilter.match(/\[([^\=]*?)\]/);
    if (match)
      resultFilter = resultFilter.replace(match[0], "#" + match[1]) +
       "," + resultFilter.replace(match[0], "." + match[1]);

    return domain + "##" + resultFilter;
  }

  //Really change the filter
  //Returns the filter if the filter was correct, 
  //'false' if the filter was broken
  //'' if the filter was ignored
  function optimizeFilter(filter) {
    filter = filter.trim();

    //Remove comment filters
    if (filter[0] == '!' || filter[0] == '[' || filter[0] == '(')
      return '';
    //Remove empty filters
    if (!filter)
      return '';

    //If it is a hiding rule...
    if (filter.indexOf('##') > -1 || /#.*\(/.test(filter)) {
      //...convert old-style filters to new ones...
      if (filter.indexOf('##') == -1) {
        filter = old_style_to_new(filter);
        if (!filter)
          return false;
      }
      //...check if the domain is of a valid type...
      var parts = filter.split('##');
      if (parts[0]) {
        var domains = parts[0].split(',');
        for (var i=0; i<domains.length; i++)
          if (/^\~?([a-z0-9\-_à-ÿ]+\.)*[a-z0-9]+$/i.test(domains[i]) == false)
            return false;
      }
      //...check if the filter is correct...
      if (!global_filter_validation_regex.test('##' + parts[1]))
          return false;
      if ($(parts[1] + ',html').length == 0)
        return false;
      //...check if the filter type is ignored...
      // WebKit has a bug where style rules aren't parsed properly, so we just
      // skip them until they fix their bug.
      if (/\[style[\^\$\*]?=/i.test(parts[1])) {
        ignoringCount ++;
        return '';
      }
      //...also pick out one special case that cannot be filtered by the regex...
      if (/^\#\d/.test(parts[1]))
        return false;
      
      //...and then allow the filter.
      return filter;

    } else {
      //If it is a blocking rule...
      var parsedFilter = new PatternFilter(filter);
      //...check if it wasn't a broken rule...
      if (parsedFilter._rule.source == '$dummy_rule_matching_nothing')
        return false;
      if (text.lastIndexOf('$') != -1) {
        //...also check if we do support it...
        //Too bad it would be to slow to rebuild the options
        //without the unsupported types
        var allowed = parsedFilter._allowedElementTypes;
        allowed = ~allowed;
        allowed |= unsupported;
        allowed = ~allowed;
        if (allowed == ElementTypes.NONE) {
          ignoringCount++;
          return '';
        }
      }
      //...and then allow it
      return filter;
    }
  }

  var lines = text.split('\n');
  delete text;
  var result = '';
  for (var i=0; i<lines.length; i++) {
    var newfilter = optimizeFilter(lines[i]);
    if (newfilter)
      result = result + newfilter + '\n';
    else if (newfilter === false)
      log("Filter '" + lines[i] + "' could not be parsed");
  }
  if (ignoringCount)
    log('Ingoring ' + ignoringCount + ' unsupported rule(s)');
  return result;
}