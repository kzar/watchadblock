// Requires fifocache.js.

// Filter objects representing the given filter text.
function FilterSet() {
  this._whitelistFilters = [];
  this._patternFilters = [];
  this._selectorFilters = [];

  // If not null, the filters in this FilterSet all apply to this domain.
  this._limitedToDomain = null;

  // Caches results for this.matches() 
  this._matchCache = {};

  // Caches the last several domain-limited subsets of this filterset, so
  // that when someone asks several times for our selectors or patterns
  // for a given domain, we aren't recalculating.  The cache lives on the
  // instance rather than being a class attribute so that get free cache
  // clearing when the user's filterset changes.
  this._domainLimitedCache = new FifoCache(10);
}


// Builds Filter objects from text.
// ignoredAdTypes is a bitset of ad types whose filters should not be
// included in this FilterSet (e.g. because the user likes that type of ads.)
FilterSet.fromText = function(text, ignoredAdTypes) {
  var result = new FilterSet();
  result._sourceText = text;

  var lines = text.split('\n');
  for (var i = 0; i < lines.length; i++) {
    var filter = Filter.fromText(lines[i]);
    if (filter._adType & ignoredAdTypes) {
      continue;
    }
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

// Strip third+ level domain names from the domain and return the result.
FilterSet._secondLevelDomainOnly = function(domain) {
  var match = domain.match(/[^.]+\.(co\.)?[^.]+$/) || [ domain ];
  return match[0].toLowerCase();
}

// Given a url, return its domain.
FilterSet._domainFor = function(url) {
  return (url.match('://(.*?)/') || [ null, "unknown.com" ])[1];
}

FilterSet.prototype = {
  // Return a new FilterSet containing the subset of this FilterSet's filters
  // that apply to the given domain.
  limitedToDomain: function(domain) {
    if (this._domainLimitedCache.get(domain) == undefined) {
      var result = new FilterSet();
      result._limitedToDomain = domain;

      result._patternFilters = this._patternFilters.filter(function(f) {
        return f.appliesToDomain(domain);
      });
      result._whitelistFilters = this._whitelistFilters.filter(function(f) {
        return f.appliesToDomain(domain);
      });
      result._selectorFilters = this._selectorFilters.filter(function(f) {
        return f.appliesToDomain(domain);
      });

      this._domainLimitedCache.set(domain, result);
    }
    return this._domainLimitedCache.get(domain);
  },

  // True if the given url requested by the given type of element is matched 
  // by this filterset, taking whitelist and pattern rules into account.  
  // Does not test selector filters.
  matches: function(url, elementType) {
    // TODO: This is probably imperfect third-party testing, but it works
    // better than nothing, and I haven't gotten to looking into ABP's
    // internals for the exact specification.
    // TODO: rework so urlOrigin and docOrigin don't get recalculated over
    // and over; it's always the same answer.
    var urlOrigin = FilterSet._secondLevelDomainOnly(FilterSet._domainFor(url));
    var docOrigin = FilterSet._secondLevelDomainOnly(this._limitedToDomain);
    var isThirdParty = (urlOrigin != docOrigin);

    // matchCache approach taken from ABP
    var key = url + " " + elementType + " " + isThirdParty;
    if (key in this._matchCache)
      return this._matchCache[key];

    // TODO: is there a better place to do this?
    // Limiting length of URL to avoid painful regexes.
    var LENGTH_CUTOFF = 200;
    url = url.substring(0, LENGTH_CUTOFF);

    for (var i = 0; i < this._whitelistFilters.length; i++) {
      if (this._whitelistFilters[i].matches(url, elementType, isThirdParty)) {
        log("Whitelisted: '" + this._whitelistFilters[i]._rule + "' -> " +url);
        this._matchCache[key] = false;
        return false;
      }
    }
    for (var i = 0; i < this._patternFilters.length; i++) {
      if (this._patternFilters[i].matches(url, elementType, isThirdParty)) {
        log("Matched: '" + this._patternFilters[i]._rule + "' -> " + url);
        this._matchCache[key] = true;
        return true;
      }
    }
    this._matchCache[key] = false;
    return false;
  },

  // Return the list of selector strings contained in all SelectorFilters
  // in this FilterSet.
  getSelectors: function() {
    return this._selectorFilters.map(function(f) { return f.selector; });
  }
}
