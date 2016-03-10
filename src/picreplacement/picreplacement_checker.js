// Runs on background page
picreplacement_checker = {
  enabled: function(url) {
    try {
      if (this.denying_existence())
        return false;
      if (/^https:/.test(url))
        return false;
      if (page_is_whitelisted(url, ElementTypes.elemhide)) {
        return false;
      }
      // Honor their choice. If there is none, default to "on" on day 1 only.
      var stored_settings = storage_get("settings") || {};
      var choice = stored_settings.do_picreplacement;
      var default_setting = (new Date() < new Date(2016, 2, 13) ? true : false);
      return (choice === undefined ? default_setting : choice);
    }
    catch (ex) {
      return false;
    }
  },
  denying_existence: function() {
    return (new Date() < new Date(2016, 2, 12));
  },
  get_icons: function(icons, url) {
    if (!this.enabled(url))
      return icons;
    var result = {
      enabled: "picreplacement/icon19.png",
      disabled: "picreplacement/icon19-grayscale.png",
      whitelisted: "img/icon19-whitelisted.png" // same
    };
    return result;
  },
  get_safari_icon: function(item) {
    var url = ((item.browserWindow || {}).activeTab || {}).url || "http://";
    if (this.enabled(url))
      return chrome.extension.getURL("picreplacement/icon16-grayscale.png");
    else
      return chrome.extension.getURL("img/icon16-grayscale.png");
  }
};
// dispatch passthroughs for options page
function picreplacement_is_happening() {
  return picreplacement_checker.enabled("http://google.com");
}
function picreplacement_show_on_options_page() {
  return !picreplacement_checker.denying_existence();
}

if (!SAFARI) {
  chrome.extension.onRequest.addListener(
    function(request, sender, sendResponse) {
      if (request.command !== "picreplacement_inject_jquery")
        return; // not for us
      chrome.tabs.executeScript(undefined,
        {allFrames: request.allFrames, file: "jquery/jquery.min.js"},
        function() { sendResponse({}); }
      );
    }
  );
}
// After 12-March-2016, automatically disable the pic_replacement setting
// This only needs to be done once, hence the use of "picdisabledOneTimer"
// This is invoked from the background script because of the dependency on Settings.
function picreplacementOneTimer() {
  var today = new Date();
  if (today >= new Date(2016, 2, 13)) {
    var picDisabledKey = "picdisabledOneTimer";
    var picDisabled = storage_get(picDisabledKey);
    if (picDisabled === undefined) {
      set_setting("do_picreplacement", false);
      storage_set(picDisabledKey, true);
    }
    clearInterval(intervalOneTimer);
  }
}
// start an 1 hour interval timer to check if it should be disabled
var oneHour = 60 * 60 * 1000;
var intervalOneTimer = setInterval(function(){
  picreplacementOneTimer();
}, oneHour);
