// Used by the generalized_selectors optional feature.
// TODO: once it's no longer optional, change the comment.
// TODO: if 'class' or 'id' is ever removed from this list, fix the TODO
// below.
var generalized_selector_attributes = [
  'src',
  'class',
  'id',
];

// TODO: can't these be case-insensitive?  What about xhtml?
// TODO: make it so I can just put in the TitleCase form.
var generalized_selector_values = [
  'ad',
  'Ad',
  'AD',
  'banner',
  'Banner',
  'BANNER',
  'sponsor',
  'Sponsor',
  'SPONSOR'
];

// Return a list of very general ad selectors.  They will match ads, and
// have false positives.
function get_generalized_selectors() {
  var result = [];
  for (var i = 0; i < generalized_selector_attributes.length; i++) {
    var attr = generalized_selector_attributes[i];
    for (var j = 0; j < generalized_selector_values.length; j++) {
      var val = generalized_selector_values[j];
      result.push('[' + attr + '*="' + val + '"]');
    }
  }
  return result;
}

// Returns true if the elements matched by the given selector are a subset
// of the elements matched by any of the generalized selectors.
function can_be_generalized(selector) {
  for (var i = 0; i < generalized_selector_values.length; i++) {
    var val = generalized_selector_values[i];
    for (var j = 0; j < generalized_selector_attributes.length; j++) {
      var attr = generalized_selector_attributes[j];

      // Check for [attr="...val..."] (or ^= or $= or *=)
      var attr_i = selector.indexOf(attr);
      var equals_i = selector.indexOf('=');
      var val_i = selector.indexOf(val);
      if (0 <= attr_i && attr_i < equals_i && equals_i < val_i)
        return true;
    }

    // Check for #...val... and ....val... (note the fourth dot)
    // TODO: this is hard-coding the assumption that 'id' and 'class'
    // are generalized selectors.
    var dot_i = selector.indexOf('.');
    var hash_i = selector.indexOf('#');
    if (0 <= dot_i && dot_i < val_i)
      return true;
    if (0 <= hash_i && hash_i < val_i)
      return true;
  }
  return false;
}

// Given a list of CSS selectors, return a new list that is the subset of
// selectors that cannot be generalized.
function without_generalizable(selectors) {
  var result = [];
  for (var i = 0; i < selectors.length; i++) {
    if (!can_be_generalized(selectors[i]))
      result.push(selectors[i]);
  }
  return result;
}

// only_generalizable(x) + without_generalizable(x) == x.
function only_generalizable(selectors) {
  var result = [];
  for (var i = 0; i < selectors.length; i++) {
    if (can_be_generalized(selectors[i]))
      result.push(selectors[i]);
  }
  return result;
}
