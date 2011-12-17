// Converts non-standard filters to a standard format, and removes
// invalid filters.
var FilterNormalizer = {

  // Normalize a set of filters.
  // Remove broken filters, useless comments and unsupported things.
  // Input: text:string filter strings separated by '\n'
  //        keepComments:boolean if true, comments will not be removed
  // Returns: filter strings separated by '\n' with invalid filters
  //          removed or modified
  normalizeList: function(text, keepComments) {
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
        else if (keepComments)
          result.push(lines[i]);
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
    filter = filter.replace(/\r$/, '').trim();

    // Remove comment/empty filters.
    if (Filter.isComment(filter))
        return false;

    // Convert old-style hiding rules to new-style.
    if (/#[\*a-z0-9_\-]*(\(|$)/.test(filter) && !/##/.test(filter)) {
      // Throws exception if unparseable.
      var oldFilter = filter;
      filter = FilterNormalizer._old_style_hiding_to_new(filter);
      log('Converted ' + oldFilter + ' to ' + filter);
    }

    // If it is a hiding rule...
    if (Filter.isSelectorFilter(filter)) {
      // The filter must be of a correct syntax
      var parts = filter.split('##');
      FilterNormalizer._checkCssSelector(parts[1]);

      if ($(parts[1] + ',html').length == 0)
        throw "Caused other selector filters to fail";

      // On a few sites, we have to ignore [style] rules.
      // Affects Chrome (crbug 68705) and Safari (issue 6225).
      if (/style([\^\$\*]?=|\])/.test(filter)) {
        var ignoreStyleRulesOnTheseSites = "~mail.google.com,~mail.yahoo.com";
        if (filter.indexOf(ignoreStyleRulesOnTheseSites) == -1) {
          if (filter[0] != "#") ignoreStyleRulesOnTheseSites += ",";
          filter = ignoreStyleRulesOnTheseSites + filter;
        }
      }

      // This was a filter which only worked in older Gecko browsers (FF3)
      // They'll never match in WebKit browsers.
      if (/\~pregecko2.*\#\#/.test(filter))
        return null;

      var parsedFilter = new SelectorFilter(filter);

    } else { // If it is a blocking rule...
      // This will throw an exception if the rule is invalid.
      var parsedFilter = PatternFilter.fromText(filter);

      // Remove rules that only apply to unsupported resource types.
      var unsupported = (ElementTypes.font | ElementTypes.donottrack);
      if (SAFARI)
        unsupported |= (ElementTypes.object_subrequest | ElementTypes.other |
                        ElementTypes.xmlhttprequest | ElementTypes.popup);
      if (!Filter.isWhitelistFilter(filter))
        unsupported |= (ElementTypes.document | ElementTypes.elemhide);

      if (!(parsedFilter._allowedElementTypes & ~unsupported))
        return null;

      // Remove rules that contain unknown options
      if (parsedFilter._allowedElementTypes & ElementTypes.UNKNOWN)
        throw "Unknown filter option";
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
        !/^(?:\*|[a-z0-9\-_]*)(?:\([^=][^\)]*?\))*$/i.test(rule))
      throw "bad selector filter";

    var first_segment = rule.indexOf('(');

    if (first_segment == -1)
      return domain + '##' + rule;

    var node = rule.substring(0, first_segment);
    var segments = rule.substring(first_segment);

    // turn all (foo) groups into [foo]
    segments = segments.replace(/\((.*?)\)/g, "[$1]");
    // turn all [foo=bar baz] groups into [foo="bar baz"]
    // Specifically match:    = then not " then anything till ]
    segments = segments.replace(/\=([^"][^\]]*)/g, '="$1"');
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

  // Throw an exception if the selector isn't of a valid type.
  // Input: a CSS selector
  _checkCssSelector: function(selector) {
    function throwError() {
      throw 'Invalid CSS selector syntax';
    }

    // Escaped characters are evil for validations.
    // However, almost everywhere an 'x' is allowed, \" is allowed too.
    // So unless we find a false positive, this would be fine
    // Also, for validation, the case doesn't matter.
    selector = selector.replace(/\\./g, 'x').toLowerCase();

    // Get rid of all valid [elemType="something"] selectors. They are valid,
    // and the risk is that their content will disturb further tests. To prevent
    // a[id="abc"]div to be valid, convert it to a[valid]div, which is invalid
    var test = /\[[a-z0-9\-_]+(\~|\^|\$|\*|\|)?\=(\".*?\"|\'.*?\'|[a-z_\-][a-z0-9\-_]*?)\]/g;
    selector = selector.replace(test, '[valid]');

    // :not may contain every selector except for itself and tree selectors
    // therefore simply put the content of it at the end of the filters
    test = /\:not\(\ *([^\ \)\>\+\~\,]+\)?)\ *\)/g;
    var match = selector.match(test);
    if (match)
      for (var i=0; i<match.length; i++) {
        var content = match[i].substr(5, match[i].length - 6);
        selector = selector.replace(match[i], '[valid]') + ' > ' + content;
      }

    // replace :something and :somethingelse(anotherthing). Do not include :not
    // as this has already been handled. If :not still exists, then it must have
    // been due to :not(:not(X)) which is invalid.
    match = selector.match(/\:(\:?[a-y\-]+(\([\ \-\+\d_a-z]+\))?)/g);
    if (match)
      for (i=0; i<match.length; i++) {
        selector = selector.replace(match[i], '[valid]');
        var pseudo = match[i].replace(/\(.*/, '').substring(1);
        var content = (match[i].match(/\((.*)\)$/) || [null, ''])[1];
        switch (pseudo) {
          case "nth-of-type":
          case "nth-last-of-type":
          case "nth-child":
          case "nth-last-child":
            test = /^\ *((\-|\+)?\d*n\ *((\-|\+)?\ *\d+)?|(\-|\+)?\d+|odd|even)\ *$/;
            break;
          case "lang":
            test = /^\ *[a-z]+(\-[a-z0-9]+)?\ *$/;
            break;
          case "first-child":
          case "last-child":
          case "only-child":
          case "first-of-type":
          case "last-of-type":
          case "only-of-type":
          case "empty":
          case "link":
          case "visited":
          case "active":
          case "hover":
          case "focus":
          case "target":
          case "enabled":
          case "disabled":
          case "checked":
          case ":first-line":
          case ":first-letter":
          case ":before":
          case ":after":
          case ":selection":
          case "root":
            if (content)
              throwError();
            else
              continue;
          default: throwError();
        }
        if (!test.test(content))
          throwError();
      }

    // multiple rules can be seperated by commas. Selectors may not start or end
    // with any of these: >+~, . Also they may not follow each other up. By
    // adding > at the start and end and then checking for multiple >+~, , you
    // will catch both. After this check these characters can be replaced by ' '
    selector = '> ' + selector + ' >';
    if (/(\+|\~|\>|\,)\ *(\+|\~|\>|\,)/.test(selector))
      throwError();
    selector = selector.replace(/[\>\~\+\,]/g, ' ');

    // Get rid of the nodeName selector.
    selector = selector.replace(/(^|\ )(\*|[a-z0-9_\-]+)/g, '');

    // Get rid of #id selectors
    selector = selector.replace(/\#[a-z_][a-z0-9_\-]*/g, '[valid]');

    // Get rid of valid .class selectors. Possibly more characters are valid,
    // but the current list doesn't contain these
    selector = selector.replace(/\.[a-z0-9\-_]+/g, '[valid]');

    // If the filter is correct, nothing but [text] selectors are left.
    // Everything still behind except spaces must be an error.
    selector = selector.replace(/\[[a-z0-9\-_]+\]/g, '');
    selector = selector.trim();

    if (selector)
      throwError();
  },

  // Throw an exception if the input contains invalid domains.
  // Input: domainInfo: { applied_on:array, not_applied_on:array }, where each
  //                    array entry is a domain.
  _verifyDomains: function(domainInfo) {
    for (var name in { "applied_on":1, "not_applied_on":1 }) {
      for (var i = 0; i < domainInfo[name].length; i++) {
        if (/^([a-z0-9\-_\xE3-\xFF]+\.)*[a-z0-9]+$/i.test(domainInfo[name][i]) == false)
          throw "Invalid domain: " + domainInfo[name][i];
      }
    }
  }
}
