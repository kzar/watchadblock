// This function will clean up the filter lists when they are fetched.
// It will remove broken filters, comments and unsupported things,
// and it will already parse the rules on beforehand.
// Input: text:string contents of a filter list
// Returns: string contents of filter list after cleanup
function cleanThisList(text) {
  var unsupported = (ElementTypes.object_subrequest | ElementTypes.font |
                     ElementTypes.dtd | ElementTypes.other | ElementTypes.xbl |
                     ElementTypes.ping | ElementTypes.xmlhttprequest |
                     ElementTypes.document | ElementTypes.elemhide);
  var ignoringCount = 0;
  //Really change the filter
  //Input: filter:string one line from a filter list subscription
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
    if (/##/.test(filter) || /#.*\(/.test(filter)) {
      //...convert old-style filters to new ones...
      if (filter.indexOf('##') == -1) {
        try {
          filter = SelectorFilter._old_style_to_new(filter);
        } catch (e) { // couldn't parse it.
          return false;
        }
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
  var result = [];
  for (var i=0; i<lines.length; i++) {
    var newfilter = optimizeFilter(lines[i]);
    if (newfilter)
      result.append(newfilter);
    else if (newfilter === false)
      log("Filter '" + lines[i] + "' could not be parsed");
  }
  if (ignoringCount)
    log('Ingoring ' + ignoringCount + ' unsupported rule(s)');
  return result.join('\n') + '\n';
}
