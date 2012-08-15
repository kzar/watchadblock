// DomainSet: a subset of all domains.
//
// It can represent sets like 'all domains', or 'all domains except foo.com',
// or 'only sub.foo.com', or 'a.com, b.com, and c.com, but not sub.a.com or
// sub.b.com (but including sub.sub.b.com)'.

// Create a new DomainSet from the given |data|.
//
// Each key in |data| is a subdomain, domain, or the required pseudodomain
// "DomainSet.ALL" which represents all domains.
// Each value is true/false, meaning "This domain is/is not in the set, and
// all of its subdomains not otherwise mentioned are/are not in the set."
function DomainSet(data) { 
  if (data[DomainSet.ALL] === undefined)
    throw Error("DomainSet: data[DomainSet.ALL] is undefined.");
  this._has = data; // The internal representation of our set of domains.
}

// The pseudodomain representing all domains.
DomainSet.ALL = '';

// Return the parent domain of |domain|, or DomainSet.ALL.
DomainSet._parentDomainOf = function(domain) {
  // Don't worry about co.uk; we can treat it as a domain and all still works
  var match = domain.match(/\.(.*\..*)$/);
  return (match ? match[1] : DomainSet.ALL);
};

DomainSet.prototype = {

  // True if |domain| is in the subset of all domains represented by |this|.
  //
  // E.g. if |this| DomainSet is the set of all domains other than a.com, then
  // 'b.com' will yield true, and both 'a.com' and 's.a.com' will yield false.
  has: function(domain) {
    if (this._has[domain] !== undefined)
      return this._has[domain];
    else
      return this.has(DomainSet._parentDomainOf(domain));
  },

  // Modify |this| by set-subtracting |other|.
  // |this| will contain the subset that was in |this| but not in |other|.
  subtract: function(other) {
    var subtract_operator = function(a,b) { return a && !b };
    this._apply(subtract_operator, other);
  },

  // NB: If we needed them, intersect and union are just like subtract, but use
  // a&&b and a||b respectively.  Union could be used to add two DomainSets.

  // Modify |this| to be the result of applying the given set |operator| (a
  // 2-param boolean function) to |this| and |other|. Returns undefined.
  _apply: function(operator, other) {
    var d; // represents a domain -- an element in ._has

    // Make sure there's an entry in ._has for every entry in other._has, so
    // that we examine every pairing in the next for loop.
    for (d in other._has)
      this._has[d] = this.has(d);
    // Apply the set operation to each pair of entries.  Use other.has() to
    // derive any missing other._has entries.
    for (d in this._has)
      this._has[d] = operator(this._has[d], other.has(d));
    // Optimization: get rid of redundant entries that now exist in this._has.
    // E.g. if DomainSet.ALL, a.com, and s.a.com all = true, delete the last 2.
    var newHas = {};
    newHas[DomainSet.ALL] = this._has[DomainSet.ALL];
    for (d in this._has)
      if (this._has[d] !== this.has(DomainSet._parentDomainOf(d)))
        newHas[d] = this._has[d];
    this._has = newHas;
  }
  
};
