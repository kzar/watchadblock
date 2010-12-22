// Converts non-standard filters to a standard format, and removes
// invalid filters.
var FilterNormalizer = {
  // Normalize a set of filters.
  // Remove broken filters, useless comments and unsupported things.
  // Input: text:string filter strings separated by '\n'
  // Returns: filter strings separated by '\n' with invalid filters
  //          removed or modified
  normalizeList: function(text) {
    var unsupported = (ElementTypes.object_subrequest | ElementTypes.font |
                       ElementTypes.dtd | ElementTypes.other |
                       ElementTypes.xbl | ElementTypes.ping |
                       ElementTypes.xmlhttprequest | ElementTypes.document |
                       ElementTypes.elemhide);
    var lines = text.split('\n');
    delete text;
    var result = [];
    for (var i=0; i<lines.length; i++) {
      try {
        var newfilter = FilterNormalizer.normalizeLine(lines[i]);
        if (newfilter)
          result.push(newfilter);
      } catch (ex) {
        log("Filter '" + lines[i] + "' could not be parsed");
      }
    }
    if (result.length != lines.length)
      log('Ignoring ' + (lines.length - result.length) + ' rule(s)');
    return result.join('\n') + '\n';
  },

  // Normalize a single filter.
  // Input: filter:string a single filter
  // Return: normalized filter string, or null if the line can be ignored. 
  // Throws: exception if filter could not be parsed.
  //
  // Note that 'Expires' comments are considered valid comments that
  // need retention, because they carry information.
  normalizeLine: function(filter) {
    var filter = filter.trim();

    // Remove comment filters
    // TODO(gundlach): retain Expires tag
    if (filter[0] == '!' || filter[0] == '[' || filter[0] == '(')
      return null;
    // Remove empty filters
    if (!filter)
      return null;

    // Convert old-style hiding rules to new-style.
    if (/#.*\(/.test(filter) && !/##/.test(filter)) {
      // Throws exception if unparseable.
      filter = FilterNormalizer.old_style_hiding_to_new(filter);
    }

    // If it is a hiding rule...
    if (/##/.test(filter)) {
      // All specified domains must be valid.
      var parts = filter.split('##');
      // TODO(gundlach): check this for blocking rules too
      if (parts[0] && !FilterNormalizer.verifyDomains(parts[0], ','))
        return null;

      // The selector must be parseable and must not cause other selectors
      // to fail.
      if (!global_filter_validation_regex.test('##' + parts[1]))
          return null;
      if ($(parts[1] + ',html').length == 0)
        return null;

      // Ignore a special case that WebKit parses badly.
      if (SelectorFilter(filter).adType == 
          Filter.adTypes.STYLE_HIDE_BREAKING_GOOGLE_SERVICES)
        return null;

      // Ignore another special case unable to be caught by the previous check.
      if (/^\#\d/.test(parts[1]))
        return null;

    } else { // If it is a blocking rule...
      var parsedFilter = new PatternFilter(filter);

      // TODO(gundlach): move the 'broken rule' checks into here from
      // PatternFilter, like we have for SelectorFilter, and then remove
      // the checks from PatternFilter so it goes faster.
      // Remove unparseable rules.
      if (parsedFilter._rule.source == '$dummy_rule_matching_nothing')
        return null;

      // Remove rules that only apply to unsupported resource types.
      if (/\$/.test(text)) {
        var allowed = parsedFilter._allowedElementTypes;
        if (ElementTypes.NONE == (allowed & ~unsupported))
          return null;
      }

      // TODO(gundlach): verify domain formats.  Extract it out of the
      // if/else and put it below instead.
    }

    // Nothing's wrong with the filter.
    return filter;
  },

  // Convert an old-style hiding rule to a new one.
  // Input: filter:string old-style filter
  // Returns: string new-style filter
  // Throws: exception if filter is unparseable.
  old_style_hiding_to_new: function(filter) {
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

  // Return true if the input only contains valid domains.
  // Input: domainsText: string delim-separated list of domains, possibly
  //                     preceeded by a '~'
  //        delim: the text delimiter separater the domains
  verifyDomains: function(domainsText, delim) {
    var domains = domainsText.split(delim);
    for (var i=0; i<domains.length; i++) {
      if (/^\~?([a-z0-9\-_à-ÿ]+\.)*[a-z0-9]+$/i.test(domains[i]) == false)
        return false;
    }
    return true;
  }
}
