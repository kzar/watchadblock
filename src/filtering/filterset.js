infinite_loop_workaround("filterset");

// Filter objects representing the given filter text.
function FilterSet() {
  this._whitelistFilters = [];
  this._patternFilters = [];
  this._selectorFilters = [];
}

// Builds Filter objects from text.
// ignoredAdTypes is a bitset of ad types whose filters should not be
// included in this FilterSet (e.g. because the user likes that type of ads.)
FilterSet.fromText = function(text, ignoredAdTypes) {
  var result = new FilterSet();

  var lines = text.split('\n');
  for (var i = 0; i < lines.length; i++) {
    // Some rules are separated by \r\n; and hey, some rules may
    // have leading or trailing whitespace for some reason.
    var line = lines[i].
      replace(/\r$/, '').
      replace(/^ */, '').
      replace(/ *$/, '');

    var filter = Filter.fromText(line);
    if (filter._adType & ignoredAdTypes)
      continue;
    // What's the right way to do this?
    if (filter.__type == "SelectorFilter")
      result._selectorFilters.push(filter);
    else if (filter.__type == "WhitelistFilter")
      result._whitelistFilters.push(filter);
    else if (filter.__type == "PatternFilter")
      result._patternFilters.push(filter);
    // else it's CommentFilter or some other garbage that we ignore.
  }

  return result;
}

FilterSet.prototype = {
  // Returns the list of CSS selectors that apply to the given domain.
  selectorsForDomain: function(domain) {
    var result = [];
    var filters = this._selectorFilters;
    for (var i = 0; i < filters.length; i++)
      if (filters[i].appliesToDomain(domain))
        result.push(filters[i].selector);
    return result;
  },
  // Returns a new FilterSet object: the subset of this which apply to the
  // given domain.  Excludes selector filters.
  patternFilterSetForDomain: function(domain) {
    var result = new FilterSet();

    var filters = this._patternFilters;
    for (var i = 0; i < filters.length; i++)
      if (filters[i].appliesToDomain(domain))
        result._patternFilters.push(filters[i]);

    filters = this._whitelistFilters;
    for (var i = 0; i < filters.length; i++)
      if (filters[i].appliesToDomain(domain))
        result._whitelistFilters.push(filters[i]);

    return result;
  },
  // True if the given url is matches by this filterset, taking whitelist and
  // pattern rules into account.  Does not test selector filters, and does not
  // take into account domains (call patternFilterSetForDomain() first to get
  // the subset applies to a certain domain.)
  matches: function(url) {
    // TODO: ignoring match-case option for now, and forcing case-insensitive
    // match.
    url = url.toLowerCase();
    // TODO: is there a better place to do this?
    // Limiting length of URL to avoid painful regexes.
    var LENGTH_CUTOFF = 200;
    url = url.substring(0, LENGTH_CUTOFF);

    for (var i = 0; i < this._whitelistFilters.length; i++) {
      if (this._whitelistFilters[i].matches(url)) {
        log("Whitelisted: '" + this._whitelistFilters[i]._rule + 
            "' -> " + url);
        return false;
      }
    }
    for (var i = 0; i < this._patternFilters.length; i++) {
      if (this._patternFilters[i].matches(url)) {
        log("Matched: '" + this._patternFilters[i]._rule + 
            "' -> " + url);
        return true;
      }
    }
    return false;
  }
}
