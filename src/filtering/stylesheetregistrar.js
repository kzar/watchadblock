/*
TODO: eventual format, improving on the current lazy/liars format:

'unfinished': {
  'forDomain': map of domain -> list of id // lazies and liars lumped together
  'filters': map of id -> filter
  'wronglyGlobal': set of id // liar ids only, not grouped by domain
}
allById: map of ? -> filter
wronglyGlobalSheet: url

*/

// Handled telling Safari about SelectorFilters.
function StyleSheetRegistrar() {
  this._paused = false;
  this._recentDomains = [];
}

// Applied to frames on $document or $elemhide pages to disable hiding
StyleSheetRegistrar._avoidHidingClass = 'x' + Math.floor(Math.random() * 1E6);
StyleSheetRegistrar._css = {
  prefix: 'html:not(.' + StyleSheetRegistrar._avoidHidingClass + ') ',
  suffix: ' { display: none; orphans: 4321; }'
};

StyleSheetRegistrar.prototype = {

  // Pause or unpause Safari's application of filters to pages.  |paused| is
  // a boolean saying whether to pause.
  pause: function(paused) {
    if (paused == this._paused)
      return;
    this._paused = paused;
    if (paused)
      this._clear();
    else
      this.register(this._filters);
  },

  // Make sure that all filters to be run on |domain| are applied.
  prepareFor: function(domain) {
    if (this._recentDomains.indexOf(domain) !== -1)
      return;
    logGroup("Preparing for", domain);
    for (var nextDomain in DomainSet.domainAndParents(domain)) {
      if (this._needsWork.lazy[nextDomain]) {
        this._applyCorrectly("lazy", nextDomain);
      }
      if (this._needsWork.liars[nextDomain]) {
        logGroup("Extracting some liars and rebuilding liar sheet.");
        this._applyCorrectly("liars", nextDomain); // Correctly apply some liars
        log("Removing old liars sheet");
        safari.extension.removeContentStyleSheet(this._liarSheet);
        this._applyLiars(); // ...and (globally) re-apply the others.
        logGroupEnd();
      }
    }
    logGroupEnd();
    this._recentDomains.unshift(domain);
    this._recentDomains.splice(30); // Keep a limited number
  },

  // Tell Safari to use the given SelectorFilters.  |data| is an object whose
  // values are the Filters to register.  Any prevously registered filters will
  // be unregistered.
  register: function(data) {
    this._filters = data; // All filters.  Needed for unpausing.
    if (this._paused)
      return;

    this._clear();

    var willApply = {
      correctly: [],
      inLiarSheet: []
    };
    // Populate willApply and this._needsWork
    for (var _ in data) {
      var filter = data[_];
      if (filter._domains.full())
        willApply.correctly.push(filter.selector);
      else {
        var isLiar = (filter._domains._has[DomainSet.ALL] == true);
        // Record what kind of work we eventually need to do on this filter
        this._needsWork.byId[filter.id] = filter;
        var ids = (this._needsWork[isLiar ? "liars" : "lazy"]);
        for (var domain in filter._domains._has) {
          if (domain !== DomainSet.ALL) {
            if (ids[domain] === undefined)
              ids[domain] = {};
            ids[domain][filter.id] = true;
          }
        }
      }
    }
    this._applyGlobally(willApply.correctly);
    this._applyLiars();
    
    // Correctly apply filters related to domains in any currently-open tabs.
    this._prepareForRecentDomains();
  },

  // Call prepareFor() on the most recently viewed domains.
  _prepareForRecentDomains: function() {
    var that = this;
    this._recentDomains.splice(-1000).forEach(function(d) { that.prepareFor(d); });
  },

  // Create and apply this._liarSheet, built from this._needsWork.liars.
  _applyLiars: function() {
    var liarFilters = {};
    for (var domain in this._needsWork.liars) {
      for (var id in this._needsWork.liars[domain]) {
        liarFilters[id] = this._needsWork.byId[id];
      }
    }
    var selectors = [];
    for (var id in liarFilters) {
      if (liarFilters[id])
        selectors.push(liarFilters[id].selector);
    }
    logGroup("Creating liar sheet (", selectors.length, "filters)");
    this._liarSheet = this._applyGlobally(selectors);
    logGroupEnd();
  },

  // Apply the array of |selectors| to all domains and return a handle to the
  // created stylesheet.
  _applyGlobally: function(selectors) {
    if (selectors.length === 0)
      return null;
    var _css = StyleSheetRegistrar._css;
    var sheet = _css.prefix + selectors.join(", " + _css.prefix) + _css.suffix;
    log("Adding global sheet (", selectors.length, "filters)"); // TODO
    if (selectors.length < 10) log(sheet);
    var blacklist = [safari.extension.baseURI + "*"];
    return safari.extension.addContentStyleSheet(sheet, undefined, blacklist);
  },

  // this._needsWork[listName][domain] contains filter IDs.  Apply these
  // filters correctly, then remove them from this._needsWork.
  _applyCorrectly: function(listName, domain) {

    // TODO: this method is a mess but it works and is efficient (in that it
    // submits all filters for a given whitelist+blacklist pattern in a single
    // call.) Refactor and clean up.

    var domainStringToSelectorsMap = {};
    for (var id in this._needsWork[listName][domain]) {
      var filter = this._needsWork.byId[id];
      // We delete the pointer to the filter after applying it, so that other
      // domains that reference it don't re-apply it.  Checking for existence
      // is easier than deleting its ID from each of its domains' lists.
      if (!filter)
        continue;

      var list = { white: [], black: [] };
      for (var domain in filter._domains._has) {
        if (domain !== DomainSet.ALL) {
          var theList = list[filter._domains._has[domain] ? 'white' : 'black'];
          theList.push(domain);
        }
      }
      var asString = list.white.sort().join(" ") + "~" + 
                     list.black.sort().join(" ");
      if (domainStringToSelectorsMap[asString] === undefined)
        domainStringToSelectorsMap[asString] = [];
      domainStringToSelectorsMap[asString].push(filter.selector);

      delete this._needsWork.byId[id];
    }
    for (var domainString in domainStringToSelectorsMap) {

      var list = { white: [], black: [] };
      var parts = domainString.split("~");
      for (var domain in parts[0].split(" ")) {
        list.white.push(['http://*.', domain, '/*'].join(''));
        list.white.push(['https://*.', domain, '/*'].join(''));
      }
      for (var domain in parts[1].split(" ")) {
        list.black.push(['http://*.', domain, '/*'].join(''));
        list.black.push(['https://*.', domain, '/*'].join(''));
      }
      list.black.push(safari.extension.baseURI + "*");

      var _css = StyleSheetRegistrar._css;
      var selectors = domainStringToSelectorsMap[domainString];
      var sheet = _css.prefix + selectors.join(", " + _css.prefix) + _css.suffix;
      logGroup("Adding filter sheet for:", selectors.join(", "));
      log("Domains:", domainString);
      logGroupEnd();
      // TODO: wrong behavior for { ALL: true, a: false, sub.a: true }?
      safari.extension.addContentStyleSheet(sheet, list.white, list.black);

    }
    // This domain's filters are now correctly applied.
    delete this._needsWork[listName][domain];
  },

  // Tell Safari to forget about all registered filters.
  _clear: function() {
    this._needsWork = {
      // Filters that only run on certain domains.  We wait until that domain
      // is loaded to apply them.
      lazy: {},  // maps from domain to set of Filter ids that mention it
      // Filters that run almost everywhere.  We apply them globally until an
      // excluded domain is loaded, then apply that domain's filters correctly.
      liars: {}, // maps from domain to set of Filter ids that mention it
      // All filters whose ids are in .lazy or .liars.
      byId: {}   // maps from Filter id to Filter
    };
    // Pointer to stylesheet that globally applies _needsWork.liars
    this._liarSheet = null;

    safari.extension.removeContentStyleSheets();
    log("Removed all style sheets.");
  }

};
