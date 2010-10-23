// temporary code while we have Browser Button For AdBlock
button_extension_id = "picdndbpdnapajibahnnogkjofaeooof";
debug_button = false;
if (debug_button)
  button_extension_id = "bfcdhbkjcaonafjgnidbaehjmlldbgnc";
  
// Run a function on the background page.
// Inputs: fn:string, options:object, callback?:function(return_value:any).
extension_call = function(fn, options, callback) {
  if (callback == null) callback = function() {};
  chrome.extension.sendRequest({fn:fn, options:options}, callback);
}

// These are replaced with console.log in adblock_start if the user chooses.
DEBUG = false;
log = function() { };

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
function page_is_whitelisted(whitelist, the_domain) {
  if (the_domain == "acid3.acidtests.org") return true;
  for (var i = 0; i < whitelist.length; i++) {
    if (the_domain.indexOf(whitelist[i]) != -1)
      return true;
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


// Get interesting information about the current tab.
// Inputs:
//   url: string
//   callback: function(info).
//   info object passed to callback: {
//     tab: Tab object
//     whitelisted: bool - whether the current tab's URL is whitelisted.
//     domain: string
//     disabled_site: bool - true if the url is e.g. about:blank or the 
//                           Extension Gallery, where extensions don't run.
//   }
// Returns: null (asynchronous)
function getCurrentTabInfo(callback) {
  var utils = chrome.extension.getBackgroundPage().utils;
  var whitelist = utils.get_whitelist();
  chrome.tabs.getSelected(undefined, function(tab) {
    // TODO: use code from elsewhere to extract domain

    var url = url_parts(tab.url);

    var disabled_site = false;
    if (url.scheme != 'http' && url.scheme != 'https')
      disabled_site = true;
    if (tab.url.match('://chrome.google.com/extensions'))
      disabled_site = true;

    var result = {
      tab: tab,
      disabled_site: disabled_site,
      domain: url.domain,
    };
    if (!disabled_site)
      result.whitelisted = page_is_whitelisted(whitelist, url.domain);

    callback(result);
  });
}


