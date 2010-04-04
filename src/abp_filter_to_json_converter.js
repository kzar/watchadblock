infinite_loop_workaround("filter_to_json");

// *** everything matches with one of these:
// !: comment
// contains ## : selector
// starts with @@|http or @@http: don't run on this page
// starts with @@: don't block if it matches this
// starts with ||: regular url match but starts at a (maybe sub) domain
// anything else: regular url match contained anywhere -- possibly with
//   regex built in.
//
// regex stuff:
// * = .*
// ^ = [^-a-zA-Z0-9.%]
// | = ^ or $ depending on location

// Input: filter_text:EasyList string
//        options.show_google_search_text_ads:bool
// Returns: new (unoptimized) filter object
function convert_filter_list_to_object(filter_text, options) {
  var result = new_filter_object();
  filter_rules = filter_text.split('\n');
  for (var i = 0; i < filter_rules.length; i++) {
    // Some rules are separated by \r\n; and hey, some rules may
    // have leading or trailing whitespace for some reason.
    var rule = filter_rules[i].
        replace(/\r$/, '').
        replace(/^ */, '').
        replace(/ *$/, '');
    if (is_comment(rule)) {
      continue;
    }

    else if (is_whitelisted_url_pattern(rule)) {
      var add_these = convert_whitelisted_url_pattern(rule);
      for (var j = 0; j < add_these.length; j++)
        result.whitelisted_url_patterns.push(add_these[j]);
    }

    else if (options.show_google_search_text_ads &&
             is_google_ad(rule)) {
      continue;
    }

    else if (is_selector(rule)) {
      var add_these = convert_selector(rule);
      for (var j = 0; j < add_these.length; j++)
        result.selectors.push(add_these[j]);
    }

    else {
      var add_these = convert_url_pattern(rule);
      for (var j = 0; j < add_these.length; j++)
        result.url_patterns.push(add_these[j]);
    }
  }
  return result;
}

// Returns true if the rule text is a comment.
// TODO: for now, any rule with a ( or ) is a comment, because we don't
// know how to parse them correctly.
function is_comment(rule) {
  return rule.length == 0 ||
         (rule[0] == '!') ||
         (rule[0] == '[' && rule.indexOf('[Adblock') == 0);
}

// Returns true if the rule text is a "exclude this URL pattern" rule,
// e.g. "@@benign.com/ads" or "@@/ads/$domain=benign.com"
function is_whitelisted_url_pattern(rule) {
  return (rule[0] == '@' && rule[1] == '@');
}

// Returns true if this represents a google text ad.
function is_google_ad(rule) {
  // TODO: I'm suspicious of this.  ~all.google.domains should EXCLUDE
  // google domains, and I don't even see ABP using this text.  How is
  // it parsed?  And, better would be to specifically whitelist the google
  // divs that show text ads, so we don't have to catch all versions of
  // google text blocking in all filters.
  return rule.indexOf('~all.google.domains') == 0;
}

// Returns true if the rule text is a CSS selector, e.g. "###foo" or
// "foo.com,~bar.com##.div", or an old-style CSS selector, e.g. "#(id=foo)"
// or "foo.com,~bar.com#.div".
// TODO: If URLs can't have # in them, then this can just be a check for #.
function is_selector(rule) {
  return ( 
           // Quick check for "Starts with ##"
           (rule[0] == '#' && rule[1] == '#') ||
           // Or has ## anywhere
           rule.indexOf('##') != -1 ||
           // Or is simplified ABP syntax: # with parentheses somewhere
           (rule.indexOf('#') != -1 && rule.indexOf('(') > rule.indexOf('#'))
         );
}

// Return a list of "URL pattern" objects for the given whitelisting rule.
function convert_whitelisted_url_pattern(rule) {
  // all rules start with @@
  rule = rule.substring(2);
  return convert_url_pattern(rule);
}

// Return a list of selector match objects for the given rule.
function convert_selector(rule) {
  if (rule.indexOf("##") == -1) {
    // Old-style syntax; convert to new-style
    rule = rule.replace('#', '##');
    rule = rule.replace(/\(/g, '[');
    rule = rule.replace(/\)/g, ']');
  }
  var parts = rule.split('##');
  var result = {
    rule: parts[1]
  };

  var domain_data = parse_domains(parts[0], ',');
  result.only_domains = domain_data.only_domains;
  result.except_domains = domain_data.except_domains;
  return [ result ];
}

// Parse the divider-separated list of domains and excluded domains,
// and return { 
//   only_domains: list_of_string,
//   except_domains: list_of_string
// }
// either key will be missing if its list is empty.
function parse_domains(domains_string, divider) {
  var domains = domains_string.split(divider);
  if (domains == '')
    return {};

  var result = {
    only_domains: [],
    except_domains: []
  };

  for (var i = 0; i < domains.length; i++) {
    var domain = domains[i];
    if (domain[0] == '~') { // don't run on this domain
      result.except_domains.push(domain.substring(1));
    } else { // run only on this domain
      result.only_domains.push(domain);
    }
  }
  if (result.only_domains.length == 0)
      delete result.only_domains;
  if (result.except_domains.length == 0)
      delete result.except_domains;
  return result;
}

// Return a list of "URL pattern" objects for the given rule.
// Works really hard to make patterns substring matches rather than regex
// matches, because regex matches are the bottleneck in AdBlock.  Even if
// it causes a few false positives, it's worth it -- we'll add support for
// AdBlock extras nixing individual rules and replacing them with its own
// if we must.
function convert_url_pattern(rule) {
  var result = {
    is_regex: false
  };

  // TODO: handle match-case option correctly
  rule = rule.toLowerCase();

  var parts = rule.split('$');

  if (parts.length > 1) {
    var options = parts[1].split(',');
    for (var i = 0; i < options.length; i++) {
      var option = options[i];
      if (option.indexOf('domain=') == 0) {
        var domain_data = parse_domains(option.substring(7), '|');
        result.only_domains = domain_data.only_domains;
        result.except_domains = domain_data.except_domains;
      }
      // TODO: handle other options.
    }
  }

  var rule = parts[0];

  // Convert regexy stuff.
  
  // First, check if it's already a complicated regex.  If so, bail.
  // TODO: This is heuristic, but I should be precise.  What am I missing?
  if (rule.indexOf('[^') != -1 ||
      rule.indexOf('(?') != -1 ||
      rule.indexOf('\\/') != -1 ||
      rule.indexOf('\\.') != -1) {
    result.rule = rule;
    try {
      log("Found a true regex rule - " + rule);
      new RegExp(result.rule);
      result.is_regex = true;
      return [ result ];
    } catch(e) {
      log("Found an unparseable regex rule - " + rule);
      // OK, we thought it was a regex but it's not.  Just discard it.
      result.is_regex = false;
      result.rule = 'dummy_rule_matching_nothing';
      return [ result ];
    }
  }

  // If must start at domain, remember this for later -- we'll maybe
  // split the rule into two objects.
  var must_start_at_domain = false;
  if (rule[0] == '|' && rule[1] == '|') {
    must_start_at_domain = true;
    rule = rule.substring(2);
  }

  if (rule[rule.length - 1] == '|') {
    rule = rule.replace(/\|$/, '$');
    result.is_regex = true;
  }

  // If it starts or ends with *, strip that -- it's a no-op.
  if (rule[0] == '*')
    rule = rule.substring(1);
  if (rule[rule.length - 1] == '*')
    rule = rule.replace(/\*$/, '');

  // And then, if it ends with a ^, I frankly don't care that you want
  // to only match a delimiter.  You should have thought of that before
  // being slow, hmmmm?
  if (rule[rule.length - 1] == '^')
    rule = rule.replace(/\^$/, '');

  // Any other *s are legit.
  var newRule;
  newRule = rule.replace(/\*/g, '.*');
  if (newRule != rule)
      result.is_regex = true;
  rule = newRule;

  // TODO we usually forced ^ to mean '/' before -- will this slow us down?
  // It may be better to special case replace ^ after .com/.org/.net with
  // '/', and ^ at the end with nothing (and deal with a few false
  // positives), or something... need to time this.
  // TODO: a quick test replacing this with '.' (match one character)
  // didn't show a marked improvement on slashdot.org.
  // TODO: According to ABP syntax, ^ is supposed to match the end of
  // an address, but EasyList doesn't make use of that, so I won't either.
  newRule = rule.replace(/\^/g, '[^-.%a-zA-Z0-9]');
  if (newRule != rule)
      result.is_regex = true;
  rule = newRule;

  // Do this after ^ lest we re-replace ourselves
  if (rule[0] == '|') {
    if (rule.indexOf('|http://') == 0 || rule.indexOf('|https://') == 0) {
      // If your rule starts with http://, I don't care that you want to
      // make sure you're not in the middle of another URL somewhere.
      // I'm sure you'll be fine.
      rule = rule.substring(1);
    } else {
      // Otherwise, we should pay attention, lest it be e.g. |ad which
      // would match overload.com, unless we add the ^.
      rule = rule.replace('|', '^');
      result.is_regex = true;
    }
  }
  // I've seen AdBlock rules that contain '|' in the middle, which
  // regexes interpret to mean 'or'.  Specifically, 'adddyn|*|adtech;' which
  // converts to 'adddyn|.*|adtech;' which matches EVERYTHING.  So if we
  // see those characters, we strip them.
  // TODO: figure out how this is supposed to be interpreted and interpret
  // it correctly.
  rule = rule.replace(/\|/g, '');

  // Escape what might be interpreted as a special character.
  if (result.is_regex) {
    // ? at the start of a regex means something special; escape it always.
    rule = rule.replace(/\?/g, '\\?');
    // . shouldn't mean "match any character"
    rule = rule.replace(/\./g, '\\.');
  }

  result.rule = rule;

  var results = [ result ];

  // Handle must_start_at_domain by splitting into two rules -- one to check
  // for / and one to check for .
  if (must_start_at_domain) {
    var other = {
      rule: result.rule,
      is_regex: result.is_regex,
      only_domains: result.only_domains,
      except_domains: result.except_domains
    };
    results.push(other);

    var oldrule = result.rule;
    if (result.is_regex) {
      result.rule = '\\.' + oldrule; // aka one backslash and one dot
      other.rule = '://' + oldrule;
    } else {
      result.rule = '.' + oldrule;
      other.rule = '://' + oldrule;
    }
  }

  for (var i = 0; i < results.length; i++) {
    if (results[i].is_regex == false)
      delete results[i].is_regex;
    else {
      // Throw an exception if the regex is invalid.
      new RegExp(results[i].rule);
    }
  }

  return results;
}

function new_filter_object() {
  return {
    // If you visit a website and it in turn tries to load anything from
    // a URL matching any of these filters, AdBlock will let it, even
    // if it also matches a filter in url_patterns.
    // Each entry contains a 'rule', possibly a list of 'only_domains',
    // possibly a list of 'except_domains', 'is_regex' iff the rule
    // is a regex instead of a substring.
    whitelisted_url_patterns: [],
    // If you visit a website and any of its elements are matched by any
    // of these filters, AdBlock will hide it.
    // Each entry is like a whitelisted_url_patterns entry, except it
    // is missing the 'is_regex' attribute.
    selectors: [],
    // If you visit a website and it in turn tries to load anything from
    // a URL matching any of these filters, AdBlock will hide it.
    // Each entry is identicaly to a whitelisted_url_patterns entry.
    url_patterns: []
  }
}

// An empty object for storing optimized filters.
function new_optimized_filter_object() {
  // "included" is a map from a domain substring to rules that should
  // only run on that domain; "excluded" should run on any domain but
  // that one.
  return {
    // If any of these strings match a URL being loaded, do not block that 
    // element, even if it is matched by a later rule.
    whitelisted_src_substrings: {
      global: [],
      included: {},
      excluded: {}
    },
    // If any of these regexes match a URL being loaded, do not block that 
    // element, even if it is matched by a later rule.
    whitelisted_src_regexes: {
      global: [],
      included: {},
      excluded: {}
    },
    // If any of these strings match a URL being loaded, block that element.
    src_substrings: {
      global: [],
      included: {},
      excluded: {}
    },
    // If any of these regexes match a URL being loaded, block that element.
    src_regexes: {
      global: [],
      included: {},
      excluded: {}
    },
    // If any of these selectors match an element, block that element.
    selectors: {
      global: [],
      included: {},
      excluded: {}
    }
  };
}

// Optimize an unoptimized filter object and append the optimized data
// to result (pass new_optimized_filter_object() the first time).  
// Optimize for JSON parsing speed and for processing speed.
function optimize_filters(filters, result) {
  // TODO: make this OO.
  // TODO: detect repeat rules and merge them -- it's OK if this is stupid
  // slow, as long as no list ever has repeats.
  function slot_filter_into_list(filter, filterset) {
    if (filter.only_domains == null && filter.except_domains == null)
      filterset.global.push(filter.rule);
    else {
      if (filter.only_domains != null) {
        for (var i = 0; i < filter.only_domains.length; i++) {
          var domain = filter.only_domains[i];
          if (filterset.included[domain] == null)
            filterset.included[domain] = [];
          filterset.included[domain].push(filter.rule);
        }
      }
      if (filter.except_domains != null) {
        for (var i = 0; i < filter.except_domains.length; i++) {
          var domain = filter.except_domains[i];
          if (filterset.excluded[domain] == null)
            filterset.excluded[domain] = [];
          filterset.excluded[domain].push(filter.rule);
        }
      }
    }
  }

  for (var i = 0; i < filters.whitelisted_url_patterns.length; i++) {
    var filter = filters.whitelisted_url_patterns[i];
    if (filter.is_regex)
      slot_filter_into_list(filter, result.whitelisted_src_regexes);
    else
      slot_filter_into_list(filter, result.whitelisted_src_substrings);
  }

  for (var i = 0; i < filters.url_patterns.length; i++) {
    var filter = filters.url_patterns[i];
    if (filter.is_regex)
      slot_filter_into_list(filter, result.src_regexes);
    else
      slot_filter_into_list(filter, result.src_substrings);
  }

  for (var i = 0; i < filters.selectors.length; i++) {
    slot_filter_into_list(filters.selectors[i], result.selectors);
  }

  return result;
}

// Convert a set of filter subscription texts into an optimized filter
// object.  Any texts that are invalid in any way are discarded.
// Inputs: texts:array of filter text strings.
//         options.show_google_search_text_ads:bool
// Returns: a single optimized filter object.
function optimize_filter_texts(texts, options) {
  var unoptimized_filters = [];
  for (var i = 0; i < texts.length; i++) {
    var as_filter;
    try {
      as_filter = convert_filter_list_to_object(texts[i], options);
    } catch(err) {
      log("ERROR converting filtertext -- skipping this filter: " + err)
      continue;
    }
    unoptimized_filters.push(as_filter);
  }

  var result = new_optimized_filter_object();
  for (var i = 0; i < unoptimized_filters.length; i++) {
    optimize_filters(unoptimized_filters[i], result);
  }

  return result;
}
