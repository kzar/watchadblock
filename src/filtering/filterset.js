// Requires fifocache.js.

// Filter objects representing the given filter text.
function FilterSet() {
  this._whitelistFilters = [];
  this._patternFilters = [];
  this._selectorFilters = [];

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
// split_out_globals: true if return value should be
//   { globals:FilterSet, nonglobals:FilterSet }
// or false if return value should be a single unified FilterSet.
FilterSet.fromText = function(text, split_out_globals) {
  if (split_out_globals)
    var result = { global: new FilterSet(), nonglobal: new FilterSet() };
  else
    var result = new FilterSet();

  var lines = text.split('\n');
  for (var i = 0; i < lines.length; i++) {
    // Even though we normalized the filters when AdBlock first received them,
    // we may have joined a few lists together with newlines.  Check for these
    // just in case.
    if (lines[i].length == 0)
      continue;
    var filter = Filter.fromText(lines[i]);
    var target = result;
    if (split_out_globals)
      target = result[(filter.isGlobal() ? "global" : "nonglobal")];

    // What's the right way to do this?
    if (filter.__type == "SelectorFilter")
      target._selectorFilters.push(filter);
    else if (filter.__type == "WhitelistFilter")
      target._whitelistFilters.push(filter);
    else // PatternFilter
      target._patternFilters.push(filter);
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

  // True if the url is blocked by this filterset, taking whitelist and pattern
  // rules into account.  Does not test selector filters.
  // Inputs:
  //   url:string - The URL of the resource to possibly block
  //   elementType:ElementType - the type of element that is requesting the 
  //                             resource
  //   pageDomain:string - domain of the page on which the element resides
  //   returnFilter?:bool - see Returns
  // Returns:
  //   if returnFilter is true:
  //       text of matching pattern/whitelist filter, null if no match
  //   if returnFilter is false:
  //       true if the resource should be blocked, false otherwise
  matches: function(url, elementType, pageDomain, returnFilter) {
    // TODO: rework so urlOrigin and docOrigin don't get recalculated over
    // and over; it's always the same answer.
    var urlOrigin = FilterSet._secondLevelDomainOnly(FilterSet._domainFor(url));
    var docOrigin = FilterSet._secondLevelDomainOnly(pageDomain);
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
        return (returnFilter ? this._whitelistFilters[i]._text : false);
      }
    }
    for (var i = 0; i < this._patternFilters.length; i++) {
      if (this._patternFilters[i].matches(url, elementType, isThirdParty)) {
        log("Matched: '" + this._patternFilters[i]._rule + "' -> " + url);
        this._matchCache[key] = true;
        return (returnFilter ? this._patternFilters[i]._text : true);
      }
    }
    this._matchCache[key] = false;
    return false;
  },

  // Return the list of selector strings contained in all SelectorFilters
  // in this FilterSet.
  getSelectors: function() {
    return this._selectorFilters.map(function(f) { return f.selector; });
  },

  // Return this FilterSet's pattern- and whitelist-filter texts in a list.
  getBlockFilters: function() {
    var pat = this._patternFilters.map(function(f) { return f._text; });
    var white = this._whitelistFilters.map(function(f) { return f._text; });
    return pat.concat(white);
  }
}
