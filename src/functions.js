function infinite_loop_workaround(where) {
  // Chrome 5 doesn't have this problem, but Chrome 4 gets stupid on XHTML
  // pages when we load jQuery.  So we have to run this function in EVERY
  // script we load, to avoid running if necessary.
  if (typeof abort_abort_abort != "undefined") {
    console.log("Dying in " + where);
    die_to_avoid_infinite_loop_in_chrome_4;
  }
}

infinite_loop_workaround("functions");

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
  var TODO_temp_logging = false;
  if (fn == "get_features_and_filters") {
    console.log("??");
    TODO_temp_logging = true;
  }
  var key = "extension_call::" + fn + "(" + JSON.stringify(options) + ")";
  if (key in _adblock_cache) {
    if (TODO_temp_logging) {
      console.log("** " + key + " cached. Value:");
      console.log(_adblock_cache[key]);
    }
    callback(_adblock_cache[key]);
  } else {
    extension_call(fn, options, function(result) {
      _adblock_cache[key] = result;
      if (TODO_temp_logging) {
        console.log("++ " + key + " not cached.  New value:");
        console.log(_adblock_cache[key]);
      }
      callback(result);
    });
  }
}

icon_extension_id = "picdndbpdnapajibahnnogkjofaeooof";
debug_id = false; // shipit will refuse to ship if this is true
if (debug_id)
  icon_extension_id = "bfcdhbkjcaonafjgnidbaehjmlldbgnc";

// These are replaced with console.log in adblock_start if the user chooses.
DEBUG = false;
log = function() { };
time_log = function() { };

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

//Regex to validate a user-created filter.
//TODO: insert a valid 'domain name regex'-regex, but wait for
//issue 267 to be fixed first. Until this time any user adding
//a filter containing multiple '##' will get a broken filter
var global_filter_validation_regex = /(\#\#|^)(((\*|[A-Za-z0-9]+)|(\*|[A-Za-z0-9]+)?((\[[a-zA-Z0-9\-]+((\~|\^|\$|\*|\|)?\=\".+\")?\])+|\:\:?[a-zA-Z\-]+(\(.+\))?|\.[^\#]+|\#[a-zA-Z0-9_\-\:\.]+)+)\ *((\>|\+|\~)\ *)?)+$/;

//When you click the label after a checkbox, also change
//the status of the checkbox itself.
function checkboxlabel_clicked() {
  $(this).prev('input').
    click(). //trigger the UI
    change(); // activate the handler as if a user had clicked it
}
