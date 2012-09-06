// Handled telling Safari about SelectorFilters.
function StyleSheetRegistrar() {
  this._paused = false;
}

StyleSheetRegistrar._random = Math.floor(Math.random() * 1E6);
StyleSheetRegistrar._selectorPrefix = 'html:not(.' + StyleSheetRegistrar._random + ') ';

StyleSheetRegistrar.prototype = {

  // Pause or unpause Safari's application of filters to pages.  |paused| is
  // a boolean saying whether to pause.
  pause: function(paused) {
    if (paused == this._paused)
      return;
    if (paused)
      this._clear();
    else
      this.register(this._filters);
  },

  // Make sure that all filters to be run on |domain| are applied.
  prepareFor: function(domain) {
    for (var nextDomain in DomainSet.domainAndParents(domain)) {
      if (this._needsWork.lazy[nextDomain]) {
        this._applyCorrectly("lazy", nextDomain);
      }
      if (this._needsWork.liars[nextDomain]) {
        safari.extension.removeContentStyleSheet(this._liarSheet);
        this._applyCorrectly("liars", nextDomain); // Correctly apply some liars
        this._applyLiars(); // ...and (globally) re-apply the others.
      }
    }
  },

  // Tell Safari to use the given SelectorFilters.  |data| is an object whose
  // values are the Filters to register.  Any prevously registered filters will
  // be unregistered.
  register: function(data) {
    this._clear();

    // All filters.  Needed for unpausing.
    this._filters = data;
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
    this._liarSheet = this._applyGlobally(selectors);
  },

  // Apply the array of |selectors| to all domains and return a handle to the
  // created stylesheet.
  _applyGlobally: function(selectors) {
    var prefix = StyleSheetRegistrar._selectorPrefix;
    var sheet = prefix + selectors.join(", " + prefix) + " {display: none}";
    console.log("Adding global content stylesheet:"); // TODO
    console.log(sheet);
    return safari.extension.addContentStyleSheet(sheet);
  },

  // addContentStyleSheet for |filter|.
  _applyFilter: function(filter) {
    var list = { white: [], black: [] };
    for (var domain in filter._domains._has) {
      if (domain !== DomainSet.ALL)
        list[filter._domains._has[domain] ? 'white' : 'black'].push(domain);
    }
    var prefix = StyleSheetRegistrar._selectorPrefix;
    var sheet = prefix + filter.selector + " {display: none}";
    console.log("Adding individual stylesheet with whitelist:", list.white, " and blacklist ", list.black); // TODO
    console.log(sheet); // TODO
    // TODO: wrong behavior for { ALL: true, a: false, sub.a: true }?
    safari.extension.addContentStyleSheet(sheet, list.white, list.black);
  },

  // this._needsWork[listName][domain] contains filter IDs.  Apply these filters correctly,
  // then remove them from this._needsWork.
  _applyCorrectly: function(listName, domain) {
    for (var id in this._needsWork[listName][domain]) {
      var filter = this._needsWork.byId[id];
      // We delete the pointer to the filter after applying it, so that other
      // domains that reference it don't re-apply it.  Checking for existence
      // is easier than deleting its ID from each of its domains' lists.
      if (filter)
        this._applyFilter(filter);
      delete this._needsWork.byId[id];
    }
    // This domain's filters are now correctly applied.
    delete this._needsWork[listName][domain];
  },

  // Tell Safari to forget about all registered filters.
  _clear: function() {
    safari.extension.removeContentStyleSheets();
  }

};
