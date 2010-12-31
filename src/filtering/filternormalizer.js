// Converts non-standard filters to a standard format, and removes
// invalid filters.
var FilterNormalizer = {

  // Normalize a set of filters.
  // Remove broken filters, useless comments and unsupported things.
  // Input: text:string filter strings separated by '\n'
  // Returns: filter strings separated by '\n' with invalid filters
  //          removed or modified
  normalizeList: function(text) {
    var lines = text.split('\n');
    delete text;
    var result = [];
    var ignoredFilterCount = 0;
    for (var i=0; i<lines.length; i++) {
      try {
        var newfilter = FilterNormalizer.normalizeLine(lines[i]);
        if (newfilter)
          result.push(newfilter);
        else if (newfilter !== false)
          ignoredFilterCount++;
      } catch (ex) {
        log("Filter '" + lines[i] + "' could not be parsed: " + ex);
        ignoredFilterCount++;
      }
    }
    if (ignoredFilterCount)
      log('Ignoring ' + ignoredFilterCount + ' rule(s)');
    return result.join('\n') + '\n';
  },

  // Normalize a single filter.
  // Input: filter:string a single filter
  // Return: normalized filter string if the filter is valid, null if the filter
  //         will be ignored or false if it isn't supposed to be a filter.
  // Throws: exception if filter could not be parsed.
  //
  // Note that 'Expires' comments are considered valid comments that
  // need retention, because they carry information.
  normalizeLine: function(filter) {
    // Some rules are separated by \r\n; and hey, some rules may
    // have leading or trailing whitespace for some reason.
    var filter = filter.replace(/\r$/, '').trim();

    // Remove comment/empty filters.
    if (Filter.isComment(filter))
        return false;

    // Convert old-style hiding rules to new-style.
    if (/#.*\(/.test(filter) && !/##/.test(filter)) {
      // Throws exception if unparseable.
      filter = FilterNormalizer._old_style_hiding_to_new(filter);
    }

    // If it is a hiding rule...
    if (Filter.isSelectorFilter(filter)) {
      // All specified domains must be valid.
      var parts = filter.split('##');
      if (!global_filter_validation_regex.test('##' + parts[1]))
        throw "Failed filter validation regex";
      if ($(parts[1] + ',html').length == 0)
        throw "Caused other selector filters to fail";

      // Ignore [style] special case that WebKit parses badly.
      var parsedFilter = new SelectorFilter(filter);
      if (/style([\^\$\*]?=|\])/.test(filter))
        return null;

      // Ignore another special case unable to be caught by the previous check.
      if (/^\#\d/.test(parts[1]))
        return null;

    } else { // If it is a blocking rule...
      // This will throw an exception if the rule is invalid.
      var parsedFilter = new PatternFilter(filter);

      // Remove rules that only apply to unsupported resource types.
      var unsupported = (ElementTypes.object_subrequest | ElementTypes.font |
                         ElementTypes.dtd | ElementTypes.other |
                         ElementTypes.xbl | ElementTypes.ping |
                         ElementTypes.xmlhttprequest);
      if (!/^\@\@/.test(parsedFilter._text))
        unsupported |= (ElementTypes.document | ElementTypes.elemhide);
      if (!(parsedFilter._allowedElementTypes & ~unsupported))
        return null;
    }

    // Ignore filters whose domains aren't formatted properly.
    FilterNormalizer._verifyDomains(parsedFilter._domains);

    // Nothing's wrong with the filter.
    return filter;
  },

  // Convert an old-style hiding rule to a new one.
  // Input: filter:string old-style filter
  // Returns: string new-style filter
  // Throws: exception if filter is unparseable.
  _old_style_hiding_to_new: function(filter) {
    // Old-style is domain#node(attr=value) or domain#node(attr)
    // domain and node are optional, and there can be many () parts.
    filter = filter.replace('#', '##');
    var parts = filter.split('##'); // -> [domain, rule]
    var domain = parts[0];
    var rule = parts[1];

    // Make sure the rule has only the following two things:
    // 1. a node -- this is optional and must be '*' or alphanumeric
    // 2. a series of ()-delimited arbitrary strings -- also optional
    //    the ()s can't be empty, and can't start with '='
    if (rule.length == 0 || 
        !/^(?:\*|[a-z0-9]*)(?:\([^=][^\)]*\))*$/i.test(rule))
      throw new Error("bad selector filter");

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
  },

  // Throw an exception if the input contains invalid domains.
  // Input: domainInfo: { applied_on:array, not_applied_on:array }, where each
  //                    array entry is a domain.
  _verifyDomains: function(domainInfo) {
    for (var name in { "applied_on":1, "not_applied_on":1 }) {
      for (var i = 0; i < domainInfo[name].length; i++) {
        if (/^([a-z0-9\-_à-ÿ]+\.)*[a-z0-9]+$/i.test(domainInfo[name][i]) == false)
          throw "Invalid domain: " + domainInfo[name][i];
      }
    }
  }
}
