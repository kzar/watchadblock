// This code exists to make the Browser Button extension work.  Once we don't need the
// browser button extension, we should be able to integrate by
// deleting this file
// deleting button_extension_id from functions.js
// deleting reference to this file from background.html
// adding the browser_action back into manifest.json
// removing the options/general reference to installing the second extension
// Changing the donation request in options/index


if (!SAFARI) {
  chrome.extension.onRequestExternal.addListener(function(request, sender, sendResponse) {
    if (sender.id != button_extension_id)
      return;
    var result = utils[request.fn](request.options, sender);
    sendResponse(result);
  });

  utils.pause_adblock = function(options) {
    localStorage.setItem('adblock_is_paused', true);
    updateButtonUIAndContextMenus();
  }

  utils.unpause_adblock = function(options) {
    localStorage.removeItem('adblock_is_paused');
    updateButtonUIAndContextMenus();
  }

  // Since we've pulled out the browser action temporarily, make API calls noops
  // instead of crashing.
  chrome.browserAction = {
    setPopup: function() {},
    setTitle: function() {},
    setIcon: function() {},
  };
}
