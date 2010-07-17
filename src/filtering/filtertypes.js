// A single filter rule.
var Filter = function() {
  this._adType = Filter.adTypes.GENERAL; // can be overridden by subclasses
}

// Maps filter text to Filter instances.  This is important, as it allows
// us to throw away and rebuild the FilterSet at will.
Filter._cache = {};

// Each filter falls into a specific ad type.
Filter.adTypes = {
  NONE: 0,
  GENERAL: 1,
  GOOGLE_TEXT_AD: 2,
}

// Return a Filter instance for the given filter text.
Filter.fromText = function(text) {
  var cache = Filter._cache;
  if (!(text in cache)) {

    if (Filter.isComment(text))
      cache[text] = CommentFilter.get_singleton();
    // old style selector syntax contains a #, then some text, then a (.
    else if (text.match(/##/) || text.match(/#.*\(/))
      cache[text] = new SelectorFilter(text);
    else if (text.match(/^@@/))
      cache[text] = new WhitelistFilter(text);
    else
      cache[text] = new PatternFilter(text);

  }
  return cache[text];
}

Filter.isComment = function(text) {
  return text.length == 0 ||
         (text[0] == '!') ||
         (text[0] == '[' && text.indexOf('[Adblock') == 0) ||
         (text[0] == '(' && text.indexOf('(Adblock') == 0);
}

// Given a comma-separated list of domain includes and excludes, return
// { applied_on:array, not_applied_on:array }.  An empty applied_on array
// means "on all domains except those in the not_applied_on array."  An
// empty not_applied_on array means "defer to the applied_on array."
//
// If a rule runs on *all* domains:
//   { applied_on: [], not_applied_on: [] }
// If a rule runs on *some* domains:
//   { applied_on: [d1, d2,...], not_applied_on: [] }
// If a rule is not run on *some* domains:
//   { applied_on: [], not_applied_on: [ d1, d2, d3... ] }
// If a rule runs on *some* domains but not on *other* domains:
//   { applied_on: [ d1, d2,...], not_applied_on: [ d1, d2,...] }
Filter._domainInfo = function(domainText, divider) {
  var domains = domainText.split(divider);

  var result = {
    applied_on: [],
    not_applied_on: []
  };

  if (domains == '')
    return result;

  for (var i = 0; i < domains.length; i++) {
    var domain = domains[i];
    if (domain[0] == '~') {
      result.not_applied_on.push(domain.substring(1));
    } else {
      result.applied_on.push(domain);
    }
  }

  return result;
}

// Return true if any of the domains in list are a complete component of the
// given domain.  So list [ "a.com" ] matches domain "sub.a.com", but not vice
// versa.
Filter._domainIsInList = function(domain, list) {
  for (var i = 0; i < list.length; i++) {
    if (list[i] == domain)
      return true;
    if (domain.match("\\." + list[i] + "$")) // ends w/ a period + list[i]?
      return true;
  }
  return false;
}

Filter.prototype = {
  __type: "Filter",

  // Returns true if this filter should be run on an element from the given
  // domain.
  appliesToDomain: function(domain) {
    var posEmpty = this._domains.applied_on.length == 0;
    var negEmpty = this._domains.not_applied_on.length == 0;

    // short circuit the common case
    if (posEmpty && negEmpty)
      return true;

    var posMatch = Filter._domainIsInList(domain, this._domains.applied_on);
    var negMatch = Filter._domainIsInList(domain, this._domains.not_applied_on);

    if (posMatch) {
      if (negMatch) return false;
      else return true;
    }
    else if (!posEmpty) { // some domains applied, but we didn't match
      return false;
    }
    else if (negMatch) { // no domains applied, we are excluded
      return false;
    }
    else { // no domains applied, we are not excluded
      return true;
    }
  }
}

// Filters that block by CSS selector.
var SelectorFilter = function(text) {
  Filter.call(this); // call base constructor

  if (text.indexOf('~all.google.domains') == 0)
    this._adType = Filter.adTypes.GOOGLE_TEXT_AD;

  if (text.indexOf("##") == -1) {
    try {
      text = SelectorFilter._old_style_to_new(text);
    } catch (e) { // couldn't parse it.
      log("Found an unparseable selector '" + text + "'");
      this._domains = Filter._domainInfo('nowhere', ',');
      this._selector = "MatchesNothing";
      return;
    }
  }

  var parts = text.split('##');
  this._domains = Filter._domainInfo(parts[0], ',');
  this.selector = parts[1];

  // Handle all the broken selectors that I've ever seen.  I may end up
  // having to take code from AdBlockPlus to correctly parse all possible
  // selectors, since people have verified their selectors against ABP's
  // particular implementation.  For now though, I'll just one-off fix the
  // invalid ones that I come across.

  // ChinaList: #[id^="ad_thread"] -> [id^="ad_thread"]
  this.selector = this.selector.replace(/^#\[/, '*[');
}
SelectorFilter.prototype = {
  // Inherit from Filter.
  __proto__: Filter.prototype,

  __type: "SelectorFilter"
}
// Convert a deprecated "old-style" filter text to the new style.
SelectorFilter._old_style_to_new = function(text) {
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
      !rule.match(/^(?:\*|[a-z0-9]*)(?:\([^=][^\)]*\))*$/i))
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

  return domain + "##" + node + segments;
}

// Filters that block by URL regex or substring.
var PatternFilter = function(text) {
  Filter.call(this); // call base constructor

  var data = PatternFilter._parseRule(text);

  this._domains = Filter._domainInfo(data.domainText, '|');
  this._isRegex = data.isRegex;
  this._allowedElementTypes = data.allowedElementTypes;
  this._options = data.options;

  if (this._isRegex) {
    if (data.rule.match(/^\/.*\/$/))
      data.rule = data.rule.substr(1, data.rule.length - 2);
    this._rule = new RegExp(data.rule);
    }
  else
    this._rule = data.rule;

  if (data.rule2)
    this._rule2 = data.rule2;
}

// Return a { rule, rule2?, isRegex, domainText, allowedElementTypes } object
// for the given filter text.  Works really hard to make patterns substring
// matches rather than regex matches, because regex matches are the bottleneck
// in AdBlock.  Even if it causes a few false positives, it's worth it -- we'll
// add support for AdBlock extras nixing individual rules and replacing them
// with its own if we must.  If rule2 is specified, it must be checked along
// with rule.
//
// TODO: when we divide out the regex time by the # of regexes, versus divide
// out the the substring time by the # of substrings, is it that much better?
// This would be a lot simpler otherwise...
PatternFilter._parseRule = function(text) {

  var result = {
    isRegex: false,
    mustStartAtDomain: false,
    domainText: '',
    allowedElementTypes: ElementTypes.NONE,
    options: FilterOptions.NONE
  };

  // TODO: handle match-case option correctly.  For now we just pretend
  // that everything that shows up was in lower case.
  text = text.toLowerCase();

  var parts = text.split('$');

  var invertedElementTypes = false;

  if (parts.length > 1) {
    var options = parts[parts.length - 1].split(',');
    for (var i = 0; i < options.length; i++) {
      var option = options[i];

      if (option.indexOf('domain=') == 0)
        result.domainText = option.substring(7);

      var inverted = (option[0] == '~');
      if (inverted)
        option = option.substring(1);

      if (option in ElementTypes) { // this option is a known element type
        if (inverted) {
          // They explicitly forbade an element type.  Assume all element
          // types listed are forbidden: we build up the list and then
          // invert it at the end.  (This won't work if they explicitly
          // allow some types and disallow other types, but what would that
          // even mean?  e.g. $image,~object.)
          invertedElementTypes = true;
          option = option.substring(1);
        }
        result.allowedElementTypes |= ElementTypes[option];
      }
      else if (option == 'third-party') {
        // Note: explicitly not supporting ~third-party; we'll incorrectly
        // treat it as third-party and if we ever get a bug report we'll
        // deal with it.  EasyList doesn't use that feature.
        result.options |= FilterOptions.THIRDPARTY;
      }

      // TODO: handle other options.
    }
  }

  // No element types mentioned?  All types are allowed.
  if (result.allowedElementTypes == ElementTypes.NONE)
    result.allowedElementTypes = ElementTypes.ALL;

  // Some mentioned, who were excluded?  Allow ALL except those mentioned.
  if (invertedElementTypes)
    result.allowedElementTypes = ~result.allowedElementTypes;

  var rule = parts[0];
  if (parts.length > 2) {
    for (var i = 1; i <= parts.length - 2; i++)
      rule += parts[i];
  }
  

  // We parse whitelist rules too on behalf of WhitelistFilter, in which case
  // we already know it's a whitelist rule so can ignore the @@s.
  if (rule.match(/^@@/))
    rule = rule.substring(2);

  // Convert regexy stuff.
  
  // First, check if it's already a complicated regex.  If so, bail.
  if (rule.match(/^\/.*[^a-zA-Z0-9\-\/].*\/$/)) {
    result.rule = rule;
    try {
      log("Found a true regex rule - " + rule);
      new RegExp(result.rule);
      result.isRegex = true;
      return result;
    } catch(e) {
      log("Found an unparseable regex rule - " + rule);
      // OK, we thought it was a regex but it's not.  Just discard it.
      result.rule = 'dummy_rule_matching_nothing';
      return result;
    }
  }

  // If must start at domain, remember this for later -- we'll handle
  // two cases to cover it.
  var mustStartAtDomain = false;
  if (rule[0] == '|' && rule[1] == '|') {
    mustStartAtDomain = true;
    rule = rule.substring(2);
  }

  if (rule[rule.length - 1] == '|') {
    rule = rule.replace(/\|$/, '$');
    result.isRegex = true;
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
      result.isRegex = true;
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
      result.isRegex = true;
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
      result.isRegex = true;
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
  if (result.isRegex) {
    // ? at the start of a regex means something special; escape it always.
    rule = rule.replace(/\?/g, '\\?');
    // . shouldn't mean "match any character" unless it's followed by a * in
    // which case we were almost certainly the ones who put it there.
    rule = rule.replace(/\.(?!\*)/g, '\\.');
  }

  result.rule = rule;

  if (result.isRegex) {
    // verify it. TODO copied-and-modified from above.
    try {
      new RegExp(result.rule);
    } catch(e) {
      log("Found an unparseable regex rule - " + result.rule);
      // OK, something went wrong.  Just discard it.
      result.isRegex = false;
      result.rule = 'dummy_rule_matching_nothing';
    }
  }

  if (mustStartAtDomain) {
    if (result.isRegex) { // check for :// or an actual dot before rule.
      result.rule = "(://|\\.)" + result.rule;
    } else {
      var oldrule = result.rule;
      result.rule = "://" + oldrule;
      result.rule2 = "." + oldrule;
    }
  }

  return result;
}

PatternFilter.prototype = {
  // Inherit from Filter.
  __proto__: Filter.prototype,

  __type: "PatternFilter",

  // Returns true if an element of the given type loaded from the given URL 
  // would be matched by this filter.
  //   url:string the url the element is loading.
  //   elementType:ElementTypes the type of DOM element.
  //   isThirdParty: true if the request for url was from a page of a
  //       different origin
  matches: function(url, elementType, isThirdParty) {
    if (!(elementType & this._allowedElementTypes))
      return false;

    // If the resource is being loaded from the same origin as the document,
    // and your rule applies to third-party loads only, we don't care what
    // regex your rule contains, even if it's for someotherserver.com.
    if ((this._options & FilterOptions.THIRDPARTY) && !isThirdParty)
      return false;

    if (this._isRegex)
      return this._rule.test(url);

    if (url.indexOf(this._rule) != -1)
      return true;

    // When parsing, we may have decided we want to check either of two
    // rules, to handle the "||" aka must-start-at-domain option.
    if (this._rule2 && url.indexOf(this._rule2) != -1)
      return true;

    return false;
  }
}

// Filters that specify URL regexes or substrings that should not be blocked.
var WhitelistFilter = function(text) {
  PatternFilter.call(this, text); // call base constructor.

  // TODO: Really, folks, this just ain't the way to do polymorphism.
  this.__type = "WhitelistFilter";
}
// When you call any instance methods on WhitelistFilter, do the same
// thing as in PatternFilter.
WhitelistFilter.prototype = PatternFilter.prototype;

// Garbage that we don't care about.
var CommentFilter = function() {
  Filter.call(this); // call base constructor.
}
CommentFilter._singleton = new CommentFilter();
CommentFilter.get_singleton = function() {
  return CommentFilter._singleton;
}
CommentFilter.prototype = {
  // Inherit from Filter.
  __proto__: Filter.prototype,

  __type: "CommentFilter"
}
