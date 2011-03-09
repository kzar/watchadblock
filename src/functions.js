// Run a function on the background page.
// Inputs: fn:string, options:object, callback?:function(return_value:any).
extension_call = function(fn, options, callback) {
  if (callback == null) callback = function() {};
  chrome.extension.sendRequest({fn:fn, options:options}, callback);
}

// These are replaced with console.log in adblock_start.js and background.html
// if the user chooses.
log = function() { };

function translate(messageID, args) {
  return chrome.i18n.getMessage(messageID, args);
}

function localizePage() {
  //translate a page into the users language
  $("[i18n]:not(.i18n-replaced)").each(function() {
    $(this).html(translate($(this).attr("i18n")));
  });
  $("[i18n_value]:not(.i18n-replaced)").each(function() {
    $(this).val(translate($(this).attr("i18n_value")));
  });
  $("[i18n_title]:not(.i18n-replaced)").each(function() {
    $(this).attr("title", translate($(this).attr("i18n_title")));
  });
  $("[i18n_replacement_el]:not(.i18n-replaced)").each(function() {
    // Replace a dummy <a/> inside of localized text with a real element.
    // Give the real element the same text as the dummy link.
    var dummy_link = $("a", this);
    var text = dummy_link.text();
    var real_el = $("#" + $(this).attr("i18n_replacement_el"));
    real_el.text(text).val(text).replaceAll(dummy_link);
    // If localizePage is run again, don't let the [i18n] code above
    // clobber our work
    $(this).addClass("i18n-replaced");
  });
}

// Returns true if anything in whitelist matches the_domain.
//   url: the url of the page
//   type: one out of ElementTypes, default ElementTypes.document,
//         to check what the page is whitelisted for: hiding rules or everything
//   returnFilter: if the filter that whitelisted the page should be returned
function page_is_whitelisted(url, type, returnFilter) {
  //special case this one
  if (url == "http://acid3.acidtests.org/") return true;
  url = url.replace(/\#.*$/, ''); // Remove anchors
  var bg = chrome.extension.getBackgroundPage();
  if (!type)
    type = bg.ElementTypes.document;
  var both = { global:1, nonglobal: 1 };
  for (var name in both) {
    var whitelist = bg._myfilters[name]._whitelistFilters;
    for (var i = 0; i < whitelist.length; i++) {
      if (whitelist[i].matches(url, type, false))
        return returnFilter ? whitelist[i]._text : true;
    }
  }
  return false;
}

// Returns a data object for a url containing scheme and domain.
function url_parts(url) {
  var parts = url.match("(.*?)://(..*?)/");
  if (!parts) // may be "about:blank" or similar
    parts = url.match("(.*?):(.*)");
  var scheme = parts[1];
  var domain = parts[2];
  return {
    scheme: scheme,
    domain: domain
  };
}


// Return the CSS text that will hide elements matching the given 
// array of selectors.
function css_hide_for_selectors(selectors) {
  var result = [];
  var GROUPSIZE = 1000; // Hide in smallish groups to isolate bad selectors
  for (var i = 0; i < selectors.length; i += GROUPSIZE) {
    var line = selectors.slice(i, i + GROUPSIZE);
    var rule = " { visibility:hidden !important; display:none !important; }";
    result.push(line.join(',') + rule);
  }
  return result.join(' ');
}
