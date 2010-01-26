if (typeof _adblock_cache != "undefined") {
  // As of Chrome .288 and 1.2.70, ebay.com runs this 6 times.  Why?
  console.log("Already ran on " + document.location.href + "; aborting.");
  // Prevent adblock_start, adblock, etc from running at all.
  i_am_crashing_on_purpose;
}

// Data that various parts of the program may find useful to cache.
// You can never rely on something being in here if the code that placed
// it in here was run asynchronously, because of race conditions.
_adblock_cache = {
};

// When adblock and adblock_start are both done with the extension cache,
// we can clear it to save RAM.
_done_with_cache = function(whom) {
  _adblock_cache["FINISHED::" + whom] = true;
  if (_adblock_cache["FINISHED::adblock_start"] &&
      _adblock_cache["FINISHED::adblock"]) {
    log("Removing _adblock_cache");
    _adblock_cache = {};
  }
}


// Run a function on the background page.
// Inputs: fn:string, options:object, callback?:function(return_value:any).
extension_call = function(fn, options, callback) {
  if (callback == null) callback = function() {};
  chrome.extension.sendRequest({fn:fn, options:options}, callback);
}

// Like extension_call, but if you've called fn before with the same
// options, return a cached result.
cached_extension_call = function(fn, options, callback) {
  var key = "extension_call::" + fn + "(" + JSON.stringify(options) + ")";
  if (key in _adblock_cache) {
    callback(_adblock_cache[key]);
  } else {
    extension_call(fn, options, function(result) {
      _adblock_cache[key] = result;
      callback(result);
    });
  }
}

icon_extension_id = "picdndbpdnapajibahnnogkjofaeooof";
debug_id = false; // shipit will refuse to ship if this is true
if (debug_id)
  icon_extension_id = "mghkcncoapjmpodfikchllepihialcdc";

// These are replaced with console.log in adblock_start if the user chooses.
log = function() { };
time_log = function() { };

// ruleset contains .global, .included, .excluded.  .global are rules
// that had no domain= suffix.  .included maps specific domains to
// rules in whose domain= list they appear.  .excluded maps specific
// domains to rules in whose domain=~ list they appear.
//
// Based on the given domain name, return a list containing all the 
// relevant entries.
function add_includes_and_excludes(ruleset) {
  // This is confusing stuff, so we're going to work through an example.
  // Let's say my_domain is facebook.com.
  var my_domain = document.domain.toLowerCase();
  var result_hash = {};
  var my_excludes = {};

  // Any rule that didn't specify included or excluded domains clearly
  // applies to facebook.com.  For example, '/ads/banner.php|'
  for (var i =0; i < ruleset.global.length; i++)
    result_hash[ruleset.global[i]] = true;

  // Any rules that specifically mention facebook.com as being included
  // are obviously going to apply to us.  For example,
  // '/sidebar/ads$domain=google.com,facebook.com'
  for (var other_domain in ruleset.included) {
    if (my_domain.indexOf(other_domain) != -1) {
      var to_add = ruleset.included[other_domain];
      for (var i = 0; i < to_add.length; i++)
        result_hash[to_add[i]] = true;
    }
  }

  // Any rules that specifically exclude a non-facebook.com domain are
  // *almost* certainly the same as globals, as far as facebook.com is
  // concerned -- for example, '/bigad$domain=~japantoday.com'.  So we
  // shall apply those rules to us.
  //   There's a case in which they aren't the same as globals in the eyes
  // of facebook.com: '/bigad$domain=~japantoday.com,~facebook.com' .
  // This gets turned into two unrelated .excluded entries:
  //        japantoday.com: '/bigad'
  //        facebook.com: '/bigad'
  // when we run into japantoday.com, we'll happily apply the rule to
  // ourselves.  But we need to remember for later that facebook.com
  // should NOT have applied this rule.
  //   So, we appy every single excluded rule, remember the ones that
  // actually shouldn't have been applied, and remove them from the
  // list at the end.
  for (var other_domain in ruleset.excluded) {
    // Add every rule, no matter the domain.
    var to_add = ruleset.excluded[other_domain];
    for (var i = 0; i < to_add.length; i++) {
      result_hash[to_add[i]] = true;
      // But if it's for our domain, we'll remove it and any other
      // domain's identical rule later.
      if (my_domain.indexOf(other_domain) != -1)
        my_excludes[to_add[i]] = true;
    }
  }

  // Now japantoday.com shall receive its punishment: we remove
  // '/bigad' from the list, because even though japantoday excluded it
  // so we should be OK to apply it, facebook.com also excluded it so
  // we should never have applied it.
  for (var entry in my_excludes)
    delete result_hash[entry];
  
  // TODO: There is yet another case we are still not covering properly.
  // '/smallad$domain=chinadaily.cn,~mail.chinadaily.cn'
  // That really means "only on chinadaily, and not on this subdomain."
  // But since we split those into two rules
  //         INCLUDE: chinadaily.cn: '/smallad'
  //         EXCLUDE: mail.chinadaily.cn: '/smallad'
  // we never realize that the EXCLUDE rule was not meant for consumption
  // by facebook.com.  This is a result of optimizing the filters into
  // .globals, .excluded, .included without knowing the relevant domain.
  // We should revisit whether it's fast enough to pass the domain to the
  // background in get_user_demands and have the background optimize right
  // then and there.

  var result = [];
  for (var entry in result_hash)
    result.push(entry);
  return result;
}

// TODO: when they whitelist a page, make sure the top level domain is
// whitelisted, even if they happened to be clicking inside an iframe.
function page_is_whitelisted(whitelist, the_domain) {
  if (the_domain == "health.google.com") return true;
  for (var i = 0; i < whitelist.length; i++) {
    if (the_domain.indexOf(whitelist[i]) != -1)
      return true;
  }
  return false;
}

