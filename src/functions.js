// Run a function on the background page.
// Inputs: fn:string, options:object, callback?:function(return_value:any).
extension_call = function(fn, options, callback) {
  if (callback == null) callback = function() {};
  chrome.extension.sendRequest({fn:fn, options:options}, callback);
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
  if (the_domain == "acid3.acidtests.org") return true;
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
